// =============================================================================
// 2x2 fragment-quad scheduler for evaluating derivative builtins
// (dpdx/dpdy/fwidth and their Coarse/Fine variants) in a WGSL @fragment shader.
//
// Derivatives are defined across the 2x2 quad of fragments the GPU shades
// together. A single invocation can't compute them, so this scheduler runs four
// lanes in lockstep -- reusing WgslDebug's re-entrant stepStack, one ExecStack
// per lane -- and pauses the whole quad whenever a lane reaches a derivative
// call. With all four lanes parked on the same call it evaluates the argument in
// each lane, differences neighbours across the quad, and stashes each lane's
// result on that lane's context (see ExecContext.derivatives) so the enclosing
// statement reads a per-lane value.
//
// Lane layout (index -> quad position), matching @builtin(position) x/y parity:
//     0 = (x,   y  )   top-left      1 = (x+1, y  )   top-right
//     2 = (x,   y+1)   bottom-left   3 = (x+1, y+1)   bottom-right
//
// textureSample / textureSampleBias are rendezvous points too: their mip level
// is derived from the texture-coordinate derivatives, so the scheduler computes
// the LOD across the quad and the TextureSample builtin samples with it.
//
// LIMITATIONS:
//   * The caller supplies all four lanes' interpolated inputs; there is no
//     rasterizer, so this does not derive quad neighbours from a triangle. A
//     helper invocation (a quad neighbour outside the primitive) is just one of
//     the four supplied lanes whose output the caller ignores.
//   * A custom function call *inside* a derivative or sample argument caches its
//     result on the shared AST node, so its value may not be per-lane-correct
//     (same limitation as the race detector). Derivatives/sample coordinates
//     that are plain expressions over interpolated inputs -- the common case --
//     are exact.
//   * `dpdx`/`dpdy`/`fwidth` (unqualified) and the implicit sample LOD use the
//     Coarse definition (as on typical D3D hardware).
//   * Under data-dependent non-uniform control flow, derivatives are undefined
//     per the WGSL spec; missing quad lanes contribute zero and a warning is
//     emitted. Anisotropic filtering is not modeled.
// =============================================================================

import { ScalarData, VectorData, Data } from "../wgsl_ast.js";
import { CallExpr, VariableExpr, TextureData } from "../wgsl_ast.js";
import { WgslDebug, DERIVATIVE_BUILTINS, IMPLICIT_LOD_BUILTINS, QUAD_RENDEZVOUS_BUILTINS } from "../wgsl_debug.js";
import { WgslExec } from "../wgsl_exec.js";
import { ExecContext } from "./exec_context.js";
import { ExecStack } from "./exec_stack.js";
import { StackFrame } from "./stack_frame.js";
import { CallExprCommand, Command } from "./command.js";

// Per-lane interpolated inputs, keyed by pipeline semantic exactly like
// WgslDebug.debugFragment (builtins by name, @location(n) by index).
export type QuadInputs = Record<string, number | number[] | Float32Array | Uint32Array | Int32Array>;

export interface FragmentQuadResult {
    // Each lane's shader output as plain JS (number | number[] | struct object),
    // indexed by quad position; null if a lane discarded or never returned.
    outputs: (number | number[] | Record<string, unknown> | null)[];
    // Whether each lane executed `discard` (indexed by quad position).
    discarded: boolean[];
    errors: string[];
}

// -----------------------------------------------------------------------------
// Derivative arithmetic over ScalarData/VectorData
// -----------------------------------------------------------------------------

function zeroLike(a: Data): Data {
    if (a instanceof VectorData) {
        return new VectorData(Array.from(a.data, () => 0), a.typeInfo);
    }
    if (a instanceof ScalarData) {
        return new ScalarData(0, a.typeInfo);
    }
    return a;
}

// Component-wise a - b (b defaults to zero when a neighbour lane is absent).
function sub(a: Data | null, b: Data | null): Data | null {
    if (a === null || b === null) {
        return null;
    }
    if (a instanceof VectorData && b instanceof VectorData) {
        return new VectorData(Array.from(a.data, (x, i) => x - b.data[i]), a.typeInfo);
    }
    if (a instanceof ScalarData && b instanceof ScalarData) {
        return new ScalarData(a.value - b.value, a.typeInfo);
    }
    return zeroLike(a);
}

// Component-wise |a| + |b|.
function absAdd(a: Data, b: Data): Data {
    if (a instanceof VectorData && b instanceof VectorData) {
        return new VectorData(Array.from(a.data, (x, i) => Math.abs(x) + Math.abs(b.data[i])), a.typeInfo);
    }
    if (a instanceof ScalarData && b instanceof ScalarData) {
        return new ScalarData(Math.abs(a.value) + Math.abs(b.value), a.typeInfo);
    }
    return zeroLike(a);
}

// Compute the derivative variant named by `name` for lane `lane`, given the four
// lanes' argument values (some may be null under non-uniform control flow).
function derivativeFor(name: string, v: (Data | null)[], lane: number): Data {
    const sample = v.find((x) => x !== null) ?? null;
    if (sample === null) {
        // No lane reached the call with a value; nothing sensible to return.
        return new ScalarData(0, (v[lane] ?? new ScalarData(0, null as never)).typeInfo);
    }
    const z = () => zeroLike(sample);
    const or0 = (d: Data | null) => d ?? z();

    const dxCoarse = or0(sub(v[1], v[0]));                 // right - left, top pair
    const dyCoarse = or0(sub(v[2], v[0]));                 // bottom - top, left pair
    const dxFine = (lane === 0 || lane === 1)
        ? or0(sub(v[1], v[0]))
        : or0(sub(v[3], v[2]));
    const dyFine = (lane === 0 || lane === 2)
        ? or0(sub(v[2], v[0]))
        : or0(sub(v[3], v[1]));

    switch (name) {
        case "dpdx": case "dpdxCoarse": return dxCoarse;
        case "dpdxFine": return dxFine;
        case "dpdy": case "dpdyCoarse": return dyCoarse;
        case "dpdyFine": return dyFine;
        case "fwidth": case "fwidthCoarse": return absAdd(dxCoarse, dyCoarse);
        case "fwidthFine": return absAdd(dxFine, dyFine);
    }
    return z();
}

// -----------------------------------------------------------------------------
// Per-lane execution state
// -----------------------------------------------------------------------------

enum LaneState { Running, AtRendezvous, Done }

class Lane {
    readonly index: number;
    readonly stack: ExecStack;
    state: LaneState = LaneState.Running;
    node: CallExpr | null = null;         // derivative call this lane is parked on
    frame: StackFrame | null = null;      // frame the parked call lives in
    output: (number | number[] | Record<string, unknown> | null) = null;
    discarded = false;

    constructor(index: number, stack: ExecStack) {
        this.index = index;
        this.stack = stack;
    }
}

function resolveTop(stack: ExecStack): StackFrame | null {
    while (stack.states.length > 0) {
        const s = stack.states[stack.states.length - 1];
        if (!s.isAtEnd) return s;
        stack.states.pop();
    }
    return null;
}

function asRendezvous(cmd: Command | null): CallExpr | null {
    if (cmd instanceof CallExprCommand && QUAD_RENDEZVOUS_BUILTINS.has(cmd.node.name)) {
        return cmd.node;
    }
    return null;
}

// -----------------------------------------------------------------------------
// The lockstep quad scheduler
// -----------------------------------------------------------------------------

export class QuadScheduler {
    private _debug: WgslDebug;
    private _exec: WgslExec;
    private _lanes: Lane[];
    readonly errors: string[] = [];

    stepBudget = 10_000_000;

    // Interactive stepping: the lane the user is debugging, and source-line
    // breakpoints applied to it. See stepTarget()/runTarget().
    targetLane = 0;
    readonly breakpoints: Set<number> = new Set();

    constructor(debug: WgslDebug, exec: WgslExec, lanes: Lane[]) {
        this._debug = debug;
        this._exec = exec;
        this._lanes = lanes;
    }

    run(): void {
        const prev = this._debug.quadRendezvous;
        this._debug.quadRendezvous = true;
        try {
            this._loop();
        } finally {
            this._debug.quadRendezvous = prev;
        }
    }

    // Record a lane's output/discard the moment its stack empties. The debug
    // instance's return value and discard flag are shared across lanes, so this
    // must run immediately after the step that finished the lane.
    private _captureDone(lane: Lane): void {
        lane.state = LaneState.Done;
        lane.output = this._debug.dataToJS(this._debug.takeReturnValue());
        lane.discarded = this._debug.takeDiscarded();
    }

    private _loop(): void {
        let steps = 0;
        while (true) {
            let stepped = false;

            for (const lane of this._lanes) {
                if (lane.state !== LaneState.Running) continue;

                const frame = resolveTop(lane.stack);
                if (frame === null) {
                    lane.state = LaneState.Done;
                    continue;
                }

                const node = asRendezvous(frame.getCurrentCommand());
                if (node !== null && frame.context.getDerivative(node) === null) {
                    // Uncomputed derivative: park this lane for the quad sync.
                    lane.state = LaneState.AtRendezvous;
                    lane.node = node;
                    lane.frame = frame;
                    continue;
                }

                this._debug.stepStack(lane.stack, true);
                stepped = true;

                if (resolveTop(lane.stack) === null) {
                    this._captureDone(lane);
                }

                if (++steps > this.stepBudget) {
                    this.errors.push("fragment quad: step budget exceeded (possible infinite loop)");
                    return;
                }
            }

            if (stepped) {
                continue;
            }

            const parked = this._lanes.filter((l) => l.state === LaneState.AtRendezvous);
            if (parked.length === 0) {
                return; // everyone finished
            }
            this._rendezvous(parked);
        }
    }

    // All parked lanes should sit on the same derivative call (uniform control
    // flow). Evaluate the argument per lane, difference across the quad, and
    // store each lane's result so its statement reads a per-lane value.
    private _rendezvous(parked: Lane[]): void {
        const node = parked[0].node!;
        const done = this._lanes.filter((l) => l.state === LaneState.Done);

        if (done.length > 0 || parked.length < this._lanes.length) {
            this.errors.push(
                `Non-uniform control flow at ${node.name}() (line ${node.line}): ` +
                `only ${parked.length} of ${this._lanes.length} quad lanes reached it. ` +
                `Derivatives require quad-uniform control flow; result may be inexact.`);
        }
        for (const lane of parked) {
            if (lane.node !== node) {
                this.errors.push(
                    `Non-uniform control flow: quad lanes reached different derivative ` +
                    `calls (${node.name}() line ${node.line} vs ${lane.node!.name}() line ${lane.node!.line}).`);
            }
        }

        if (IMPLICIT_LOD_BUILTINS.has(node.name)) {
            this._rendezvousSample(parked, node);
        } else {
            this._rendezvousDerivative(parked, node);
        }
    }

    // dpdx/dpdy/fwidth: difference the argument across the quad.
    private _rendezvousDerivative(parked: Lane[], node: CallExpr): void {
        // Gather each lane's argument value at the call site (indexed by quad
        // position, not by parked order, so neighbour differencing is correct).
        const values: (Data | null)[] = [null, null, null, null];
        for (const lane of parked) {
            values[lane.index] = this._exec.evalExpression(node.args![0], lane.frame!.context);
        }
        for (const lane of parked) {
            const result = derivativeFor(node.name, values, lane.index);
            this._release(lane, result);
        }
    }

    // textureSample / textureSampleBias: the mip level (LOD) is implicit,
    // computed from how fast the texture coordinates change across the quad,
    // scaled to texel space. The LOD is uniform over the quad; each lane samples
    // at its own coordinate using that LOD (the TextureSample builtin reads it
    // back from the context).
    private _rendezvousSample(parked: Lane[], node: CallExpr): void {
        const coordIndex = 2; // textureSample(t, s, coords, ...)
        const uv: (number[] | null)[] = [null, null, null, null];
        for (const lane of parked) {
            const c = this._exec.evalExpression(node.args![coordIndex], lane.frame!.context);
            if (c instanceof VectorData && c.data.length >= 2) {
                uv[lane.index] = [c.data[0], c.data[1]];
            }
        }

        // Scale coordinate derivatives by the base texture size to get texel-space
        // deltas; rho is the longer of the two quad edges, LOD = log2(rho).
        let width = 1, height = 1;
        const arg0 = node.args![0];
        if (arg0 instanceof VariableExpr) {
            const t = parked[0].frame!.context.getVariableValue(arg0.name);
            if (t instanceof TextureData) {
                width = t.width;
                height = t.height;
            }
        }
        let lod = 0;
        const [uv0, uv1, uv2] = uv;
        if (uv0 && uv1 && uv2) {
            const dux = (uv1[0] - uv0[0]) * width, dvx = (uv1[1] - uv0[1]) * height;
            const duy = (uv2[0] - uv0[0]) * width, dvy = (uv2[1] - uv0[1]) * height;
            const rho = Math.max(Math.hypot(dux, dvx), Math.hypot(duy, dvy));
            lod = rho > 0 ? Math.log2(rho) : 0;
        }

        const f32 = this._exec.getTypeInfo("f32")!;
        const isArray = arg0 instanceof VariableExpr &&
            (parked[0].frame!.context.getVariableValue(arg0.name) as TextureData)?.typeInfo?.name?.includes("_array");
        const biasIndex = isArray ? coordIndex + 2 : coordIndex + 1;
        for (const lane of parked) {
            let laneLod = lod;
            if (node.name === "textureSampleBias") {
                const b = this._exec.evalExpression(node.args![biasIndex], lane.frame!.context);
                if (b instanceof ScalarData) laneLod += b.value;
            }
            this._release(lane, new ScalarData(laneLod, f32));
        }
    }

    private _release(lane: Lane, value: Data): void {
        lane.frame!.context.setDerivative(lane.node!, value);
        lane.state = LaneState.Running;
        lane.node = null;
        lane.frame = null;
    }

    // --- Interactive stepping -------------------------------------------------
    //
    // The batch run() advances all lanes to completion. For an interactive
    // debugger (breakpoints, watch, step) the user drives the *target* lane while
    // the other three stay in lockstep only where it matters: at each derivative
    // / texture-sample rendezvous. Between rendezvous the helpers lag lazily and
    // catch up when the target next needs them, which is correct because their
    // intermediate values are never observed. Uniform control flow keeps them
    // together; divergence is reported the same way as in the batch path.

    private get _target(): Lane {
        return this._lanes[this.targetLane];
    }

    // The source line the target lane is about to execute, or -1 when finished.
    get targetLine(): number {
        const frame = resolveTop(this._target.stack);
        const cmd = frame === null ? null : frame.getCurrentCommand();
        return cmd === null ? -1 : cmd.line;
    }

    // The target lane's current scope, for inspecting variables (watch/locals).
    get targetContext(): ExecContext | null {
        const frame = resolveTop(this._target.stack);
        return frame === null ? null : frame.context;
    }

    get isDone(): boolean {
        return this._target.state === LaneState.Done || resolveTop(this._target.stack) === null;
    }

    // The target lane's final output / discard flag (valid once isDone).
    get targetOutput(): number | number[] | Record<string, unknown> | null {
        return this._target.output;
    }
    get targetDiscarded(): boolean {
        return this._target.discarded;
    }

    // Live call depth of the target lane (finished frames popped first).
    private _depth(): number {
        resolveTop(this._target.stack);
        return this._target.stack.states.length;
    }

    // Advance the target lane by one user-visible step, servicing any rendezvous
    // it reaches so derivatives/samples resolve. Returns false once the target
    // has finished. `stepInto` steps into called functions; when false, the call
    // is still executed command-by-command internally (so derivatives inside it
    // rendezvous correctly) but the debugger only pauses once back at the calling
    // statement's level -- a true step-over.
    stepTarget(stepInto = true): boolean {
        const prev = this._debug.quadRendezvous;
        this._debug.quadRendezvous = true;
        try {
            if (stepInto) {
                return this._stepTargetOnce(true);
            }
            const startDepth = this._depth();
            const startLine = this.targetLine;
            let alive = this._stepTargetOnce(true);
            while (alive) {
                const d = this._depth();
                if (d < startDepth) break;                                  // stepped out
                if (d === startDepth && this.targetLine !== startLine) break; // next statement
                alive = this._stepTargetOnce(true);
            }
            return alive;
        } finally {
            this._debug.quadRendezvous = prev;
        }
    }

    // Run the target lane until it returns out of the current function.
    stepOutTarget(): boolean {
        const prev = this._debug.quadRendezvous;
        this._debug.quadRendezvous = true;
        try {
            const startDepth = this._depth();
            let alive = this._stepTargetOnce(true);
            while (alive && this._depth() >= startDepth) {
                alive = this._stepTargetOnce(true);
            }
            return alive;
        } finally {
            this._debug.quadRendezvous = prev;
        }
    }

    // Run the target lane until it hits a breakpoint or finishes.
    runTarget(): void {
        const prev = this._debug.quadRendezvous;
        this._debug.quadRendezvous = true;
        try {
            let steps = 0;
            while (this._stepTargetOnce(true)) {
                const line = this.targetLine;
                if (line >= 0 && this.breakpoints.has(line)) {
                    return;
                }
                if (++steps > this.stepBudget) {
                    this.errors.push("fragment quad: step budget exceeded (possible infinite loop)");
                    return;
                }
            }
        } finally {
            this._debug.quadRendezvous = prev;
        }
    }

    private _stepTargetOnce(stepInto: boolean): boolean {
        const target = this._target;
        while (true) {
            if (target.state === LaneState.Done) {
                return false;
            }
            const frame = resolveTop(target.stack);
            if (frame === null) {
                this._captureDone(target);
                return false;
            }
            const node = asRendezvous(frame.getCurrentCommand());
            if (node !== null && frame.context.getDerivative(node) === null) {
                // The target needs a derivative/sample: bring the whole quad to a
                // rendezvous and resolve it, then retry stepping the target.
                this._serviceRendezvous();
                continue;
            }
            this._debug.stepStack(target.stack, stepInto);
            if (resolveTop(target.stack) === null) {
                this._captureDone(target);
                return false;
            }
            return true;
        }
    }

    // Advance every lane until it parks at the pending rendezvous (or finishes),
    // then resolve it. Used by interactive stepping to keep helper lanes lockstep
    // with the target only at the points where derivatives are computed.
    private _serviceRendezvous(): void {
        let steps = 0;
        for (const lane of this._lanes) {
            while (lane.state === LaneState.Running) {
                const frame = resolveTop(lane.stack);
                if (frame === null) {
                    this._captureDone(lane);
                    break;
                }
                const node = asRendezvous(frame.getCurrentCommand());
                if (node !== null && frame.context.getDerivative(node) === null) {
                    lane.state = LaneState.AtRendezvous;
                    lane.node = node;
                    lane.frame = frame;
                    break;
                }
                this._debug.stepStack(lane.stack, true);
                if (resolveTop(lane.stack) === null) {
                    this._captureDone(lane);
                    break;
                }
                if (++steps > this.stepBudget) {
                    this.errors.push("fragment quad: step budget exceeded (possible infinite loop)");
                    return;
                }
            }
        }
        const parked = this._lanes.filter((l) => l.state === LaneState.AtRendezvous);
        if (parked.length > 0) {
            this._rendezvous(parked);
        }
    }
}

// -----------------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------------

// Debug a @fragment entry over its 2x2 quad so derivative builtins resolve.
//
//   code       - WGSL source
//   entry      - @fragment entry-point name
//   quadInputs - four lanes of interpolated inputs, [TL, TR, BL, BR]; each keyed
//                like WgslDebug.debugFragment's `inputs`
//   bindGroups - same shape debugFragment expects
//
// Returns each lane's output (plain JS) and any uniformity warnings. To inspect
// a single target fragment, read outputs[targetLane].
export function debugFragmentQuad(
    code: string,
    entry: string,
    quadInputs: QuadInputs[],
    bindGroups: Record<string, Record<string, unknown>>,
    config?: Record<string, unknown>,
): FragmentQuadResult {

    const built = buildQuadScheduler(code, entry, quadInputs, bindGroups, config);
    if (built.scheduler === null) {
        return { outputs: [null, null, null, null], discarded: [false, false, false, false], errors: built.errors };
    }

    built.scheduler.run();

    return {
        outputs: built.lanes.map((l) => l.output),
        discarded: built.lanes.map((l) => l.discarded),
        errors: built.scheduler.errors,
    };
}

// Build a fragment quad debugger for interactive stepping (breakpoints, watch,
// step) instead of running to completion. Set `scheduler.targetLane` to the
// quad lane the user is debugging (0=TL, 1=TR, 2=BL, 3=BR), add source-line
// `scheduler.breakpoints`, then drive with `stepTarget()` / `runTarget()` and
// read `targetLine` / `targetContext` / `targetOutput`.
//
// Returns { scheduler: null, errors } if setup failed (bad entry, wrong lane
// count, etc.).
export function createFragmentQuadDebugger(
    code: string,
    entry: string,
    quadInputs: QuadInputs[],
    bindGroups: Record<string, Record<string, unknown>>,
    targetLane = 0,
    config?: Record<string, unknown>,
): { scheduler: QuadScheduler | null, errors: string[] } {
    const built = buildQuadScheduler(code, entry, quadInputs, bindGroups, config);
    if (built.scheduler !== null) {
        built.scheduler.targetLane = targetLane;
    }
    return { scheduler: built.scheduler, errors: built.errors };
}

// Shared setup for the batch and interactive entry points: parse, bind
// resources, seed one lane (ExecStack) per quad position.
function buildQuadScheduler(
    code: string,
    entry: string,
    quadInputs: QuadInputs[],
    bindGroups: Record<string, Record<string, unknown>>,
    config?: Record<string, unknown>,
): { scheduler: QuadScheduler | null, lanes: Lane[], errors: string[] } {

    const fail = (msg: string) => ({ scheduler: null, lanes: [] as Lane[], errors: [msg] });

    if (quadInputs.length !== 4) {
        return fail("fragment quad debugger expects exactly 4 lanes of inputs");
    }

    const debug = new WgslDebug(code);
    const exec = debug.exec;
    const base = exec.context;
    base.currentFunctionName = entry;

    if (config && config["constants"]) {
        debug.applyOverrides(config["constants"] as Record<string, unknown>, base);
    }

    // Module-scope statements (globals) and function registration.
    exec._execStatements(exec.ast, base);

    const entryFn = base.getFunction(entry);
    if (entryFn === null) {
        return fail(`Function ${entry} not found`);
    }
    const refl = exec.reflection.getFunctionInfo(entry);
    if (refl === null || refl.stage !== "fragment") {
        return fail(`Function ${entry} is not a @fragment entry point`);
    }

    // Resources are read-only for a fragment stage; bind them once on the shared
    // base context so every lane sees the same memory.
    debug._bindResources(bindGroups as never, refl, base);

    const lanes: Lane[] = [];
    for (let i = 0; i < 4; ++i) {
        const ctx = base.clone();
        debug._bindStageInputs(entryFn, quadInputs[i] as never, ctx);
        const frame = debug.createStackFrame(entryFn.node.body, ctx);
        const stack = new ExecStack();
        stack.states.push(frame);
        lanes.push(new Lane(i, stack));
    }

    return { scheduler: new QuadScheduler(debug, exec, lanes), lanes, errors: [] };
}
