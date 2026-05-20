// =============================================================================
// Barrier-phase ("lockstep") scheduler for WGSL compute shader data-race
// detection. Implements the feature requested in
// github.com/brendan-duncan/webgpu_inspector issue #36.
//
// The default emulator runs invocations strictly sequentially, so a missing
// storageBarrier/workgroupBarrier is invisible. This scheduler instead runs
// every invocation of one workgroup *concurrently*: it advances each one a
// command at a time and parks it when it reaches a barrier. When every
// invocation is parked, that is a "sync point" — the memory accesses recorded
// since the previous barrier (one "phase") are cross-checked for races, then
// all invocations are released.
//
// A data race = two invocations touch overlapping bytes within the same phase,
// at least one access is a write, and the accesses are not both atomic.
//
// Stepping reuses WgslDebug's command interpreter via the re-entrant
// WgslDebug.stepStack(stack): each invocation owns its own ExecStack.
//
// LIMITATIONS:
//   * Detects races *within* a workgroup (missing workgroup/storage barriers).
//     Races between different workgroups on storage memory are not decidable —
//     WebGPU gives no cross-workgroup ordering — and are out of scope.
//   * workgroupUniformLoad is a barrier too, but it is an expression that
//     returns a value, so it needs a different hook and is not handled here.
//   * Vector-component access (`v.x`) is tracked at whole-vector granularity.
//   * `var<workgroup>` memory is not re-initialized between workgroups.
// =============================================================================

import * as AST from "../wgsl_ast.js";
import { ScalarData, VectorData, TypedData, Data, Expression } from "../wgsl_ast.js";
import { TypeInfo } from "../wgsl_reflect.js";
import { WgslDebug } from "../wgsl_debug.js";
import { WgslExec } from "../wgsl_exec.js";
import { ExecContext } from "./exec_context.js";
import { ExecInterface } from "./exec_interface.js";
import { ExecStack } from "./exec_stack.js";
import { StackFrame } from "./stack_frame.js";
import { Command, StatementCommand } from "./command.js";

// Barriers that act as a workgroup-wide sync point.
const BARRIER_BUILTINS = new Set(["workgroupBarrier", "storageBarrier", "textureBarrier"]);

function isAtomicType(t: any): boolean {
    if (!t) return false;
    if (t.name === "atomic") return true;
    // array<atomic<T>> when a dynamic index could not be resolved.
    return !!(t.isArray && t.format && t.format.name === "atomic");
}

// -----------------------------------------------------------------------------
// Memory access tracking
// -----------------------------------------------------------------------------

type AccessKind = "read" | "write";

interface MemoryAccess {
    bufferId: string;   // backing-buffer identity (the resource/variable name)
    offset: number;     // byte offset within that buffer
    size: number;       // byte length
    kind: AccessKind;
    atomic: boolean;
    invocation: number; // local invocation index that made the access
    line: number;       // source line
}

export interface RaceReport {
    bufferId: string;
    byte: number;
    a: MemoryAccess;
    b: MemoryAccess;
    message: string;
}

// Accumulates memory accesses for the current barrier-delimited phase and
// cross-checks them when the phase ends. One tracker per workgroup.
export class MemoryTracker {
    private _phase: MemoryAccess[] = [];

    // The scheduler sets these immediately before it steps an invocation, so the
    // TrackedTypedData hooks know who is accessing memory and on which line.
    currentInvocation = 0;
    currentLine = -1;

    readonly races: RaceReport[] = [];

    record(bufferId: string, offset: number, size: number, kind: AccessKind, atomic: boolean): void {
        this._phase.push({
            bufferId, offset, size, kind, atomic,
            invocation: this.currentInvocation,
            line: this.currentLine,
        });
    }

    // Called at every barrier sync point and once at workgroup completion.
    endPhase(): void {
        this._checkPhase();
        this._phase.length = 0;
    }

    private _checkPhase(): void {
        const a = this._phase;
        for (let i = 0; i < a.length; ++i) {
            for (let j = i + 1; j < a.length; ++j) {
                const x = a[i];
                const y = a[j];
                if (x.invocation === y.invocation) continue;   // same lane: program order
                if (x.bufferId !== y.bufferId) continue;
                if (x.kind === "read" && y.kind === "read") continue;  // read/read is safe
                if (x.atomic && y.atomic) continue;            // atomic vs atomic is safe
                // disjoint byte ranges?
                if (x.offset + x.size <= y.offset) continue;
                if (y.offset + y.size <= x.offset) continue;

                const byte = Math.max(x.offset, y.offset);
                this.races.push({
                    bufferId: x.bufferId,
                    byte,
                    a: x,
                    b: y,
                    message:
                        `Data race on '${x.bufferId}' byte ${byte}: ` +
                        `invocation ${x.invocation} (${x.kind}, line ${x.line}) and ` +
                        `invocation ${y.invocation} (${y.kind}, line ${y.line}) ` +
                        `are unordered. Add a workgroupBarrier()/storageBarrier() between them.`,
                });
            }
        }
    }
}

// -----------------------------------------------------------------------------
// Instrumented buffer view
// -----------------------------------------------------------------------------

// Drop-in replacement for TypedData that reports every read/write to a
// MemoryTracker. Storage buffers and workgroup arrays are bound as instances of
// this class so the scheduler sees their accesses.
//
// Atomic accesses are detected structurally: WGSL only permits an `atomic<T>`
// location to be accessed through the atomic builtins, so an access whose
// resolved leaf type is `atomic` is recorded as atomic. The atomic builtins
// route through getSubData/setDataValue (see builtin_functions.ts), so no
// per-builtin hook is required.
//
// TODO(precision): _range() resolves array indices and struct members exactly,
// but a vector swizzle (`v.xy`) is treated as touching the whole vector.
export class TrackedTypedData extends TypedData {
    private _tracker: MemoryTracker;
    private _bufferId: string;

    constructor(data: ArrayBuffer, typeInfo: TypeInfo, tracker: MemoryTracker, bufferId: string) {
        super(data, typeInfo, 0, null);
        this._tracker = tracker;
        this._bufferId = bufferId;
    }

    setDataValue(exec: ExecInterface, value: Data, postfix: Expression | null, context: ExecContext): void {
        const r = this._range(postfix, exec, context);
        this._tracker.record(this._bufferId, r.offset, r.size, "write", r.atomic);
        super.setDataValue(exec, value, postfix, context);
    }

    getSubData(exec: ExecInterface, postfix: Expression | null, context: ExecContext): Data | null {
        const r = this._range(postfix, exec, context);
        this._tracker.record(this._bufferId, r.offset, r.size, "read", r.atomic);
        return super.getSubData(exec, postfix, context);
    }

    // Best-effort resolution of an access path to a (byteOffset, byteSize) range
    // plus whether the touched location is atomic. Mirrors the offset walk in
    // TypedData.setDataValue.
    private _range(postfix: Expression | null, exec: ExecInterface, context: ExecContext)
        : { offset: number, size: number, atomic: boolean } {
        let offset = this.offset;
        let typeInfo: any = this.typeInfo;
        let p: any = postfix;

        while (p) {
            if (p instanceof AST.ArrayIndex && typeInfo && typeInfo.isArray) {
                const idx = this._evalIndex(p.index, exec, context);
                if (idx === null) break;            // dynamic index unresolved: stay coarse
                offset += idx * typeInfo.stride;
                typeInfo = typeInfo.format;
            } else if (p instanceof AST.StringExpr && typeInfo && typeInfo.isStruct) {
                const m = (typeInfo.members || []).find((x: any) => x.name === p.value);
                if (!m) break;
                offset += m.offset;
                typeInfo = m.type;
            } else {
                // vector component / swizzle / unsupported: keep current range.
                break;
            }
            p = p.postfix;
        }

        const size = (typeInfo && typeInfo.size) ? typeInfo.size : this.typeInfo.size;
        return { offset, size, atomic: isAtomicType(typeInfo) };
    }

    private _evalIndex(idx: Expression, exec: ExecInterface, context: ExecContext): number | null {
        let v: any = null;
        if (idx instanceof AST.LiteralExpr && idx.value instanceof ScalarData) {
            v = idx.value.value;
        } else {
            const d = exec.evalExpression(idx, context);
            if (d instanceof ScalarData) v = d.value;
        }
        if (v === null) return null;
        return typeof v === "number" ? v : Number((v as ArrayLike<number>)[0]);
    }
}

// -----------------------------------------------------------------------------
// Per-invocation execution state
// -----------------------------------------------------------------------------

enum InvState { Running, AtBarrier, Done }

class Invocation {
    readonly index: number;                  // local_invocation_index
    readonly stack: ExecStack;
    state: InvState = InvState.Running;
    barrierNode: AST.Call | null = null;     // the barrier it is currently parked on

    constructor(index: number, stack: ExecStack) {
        this.index = index;
        this.stack = stack;
    }
}

// -----------------------------------------------------------------------------
// The lockstep scheduler — one per workgroup
// -----------------------------------------------------------------------------

export class WorkgroupScheduler {
    private _debug: WgslDebug;
    private _tracker: MemoryTracker;
    private _invocations: Invocation[];
    readonly errors: string[] = [];

    // Safety valve against an infinite loop in a buggy shader/emulator.
    stepBudget = 50_000_000;

    constructor(debug: WgslDebug, tracker: MemoryTracker, invocations: Invocation[]) {
        this._debug = debug;
        this._tracker = tracker;
        this._invocations = invocations;
    }

    run(): void {
        let steps = 0;

        while (true) {
            let stepped = false;

            for (const inv of this._invocations) {
                if (inv.state !== InvState.Running) continue;

                const cmd = this._peek(inv);
                if (cmd === null) {
                    inv.state = InvState.Done;
                    continue;
                }

                const barrier = this._asBarrier(cmd);
                if (barrier !== null) {
                    inv.state = InvState.AtBarrier;
                    inv.barrierNode = barrier;
                    continue;
                }

                // Advance this invocation by one command. stepStack always stops
                // *before* a barrier statement (a StatementCommand makes
                // _shouldExecuteNextCommand return false), so the scheduler is
                // guaranteed a chance to park it on the next pass.
                this._tracker.currentInvocation = inv.index;
                this._tracker.currentLine = cmd.line;
                this._debug.stepStack(inv.stack, true);
                stepped = true;

                if (++steps > this.stepBudget) {
                    this.errors.push("race detector: step budget exceeded (possible infinite loop)");
                    return;
                }
            }

            if (stepped) {
                continue;  // progress made — keep going
            }

            // No invocation could step this pass. Everyone still alive is parked
            // on a barrier (or just became Done).
            const parked = this._invocations.filter(i => i.state === InvState.AtBarrier);
            if (parked.length === 0) {
                // All invocations finished. Check the final (post-last-barrier) phase.
                this._tracker.endPhase();
                return;
            }

            this._syncBarrier(parked);
        }
    }

    // A barrier sync point: validate barrier uniformity, run the race check for
    // the phase that just ended, then release every parked invocation.
    private _syncBarrier(parked: Invocation[]): void {
        const done = this._invocations.filter(i => i.state === InvState.Done);

        // WGSL requires barriers to sit in workgroup-uniform control flow: every
        // invocation must reach the same barrier. If some invocations exited
        // early, or are parked on different barrier statements, that is itself a
        // bug — barrier divergence.
        if (done.length > 0) {
            this.errors.push(
                `Barrier divergence near line ${parked[0].barrierNode!.line}: ` +
                `${done.length} invocation(s) exited before reaching the barrier ` +
                `that ${parked.length} other invocation(s) are waiting on. ` +
                `Barriers must be in workgroup-uniform control flow.`);
        }
        const firstBarrier = parked[0].barrierNode;
        for (const inv of parked) {
            if (inv.barrierNode !== firstBarrier) {
                this.errors.push(
                    `Barrier divergence: invocations reached different barrier ` +
                    `statements (line ${firstBarrier!.line} vs ${inv.barrierNode!.line}).`);
                break;
            }
        }

        // The accesses since the previous barrier are now fully unordered with
        // respect to each other — check them.
        this._tracker.endPhase();

        // Release: step each parked invocation once to execute the barrier
        // builtin (a no-op) and move past it, then mark it Running again.
        for (const inv of parked) {
            inv.state = InvState.Running;
            inv.barrierNode = null;
            this._tracker.currentInvocation = inv.index;
            this._debug.stepStack(inv.stack, true);
        }
    }

    // Peek the next command of an invocation without executing it.
    private _peek(inv: Invocation): Command | null {
        const frame = resolveTop(inv.stack);
        return frame === null ? null : frame.getCurrentCommand();
    }

    private _asBarrier(cmd: Command): AST.Call | null {
        if (cmd instanceof StatementCommand && cmd.node instanceof AST.Call &&
            BARRIER_BUILTINS.has(cmd.node.name)) {
            return cmd.node;
        }
        return null;
    }
}

// Topmost stack frame with commands remaining; pops finished frames. Mirrors
// WgslDebug._resolveState.
function resolveTop(stack: ExecStack): StackFrame | null {
    while (stack.states.length > 0) {
        const s = stack.states[stack.states.length - 1];
        if (!s.isAtEnd) return s;
        stack.states.pop();
    }
    return null;
}

// -----------------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------------

export interface RaceDetectionResult {
    races: RaceReport[];
    errors: string[];
}

// Run the data-race detector over a compute kernel.
//
//   code          - WGSL source
//   kernel        - entry point name
//   dispatchCount - workgroup grid dimensions ([x], [x,y] or [x,y,z])
//   bindGroups    - same shape WgslDebug.debugWorkgroup expects:
//                   { [group]: { [binding]: <uniform ArrayBuffer> | <storage ArrayBuffer> } }
export function detectRaces(
    code: string,
    kernel: string,
    dispatchCount: number[],
    bindGroups: Record<string, Record<string, any>>,
    config?: Record<string, unknown>,
): RaceDetectionResult {

    const debug = new WgslDebug(code);
    const exec: WgslExec = debug.exec;
    const context: ExecContext = exec.context;

    // Define module-scope declarations (globals, functions, workgroup vars).
    exec._execStatements(exec.ast, context);

    if (config && config["constants"]) {
        debug.applyOverrides(config["constants"] as Record<string, unknown>, context);
    }

    const kernelFn = context.getFunction(kernel);
    if (kernelFn === null) {
        return { races: [], errors: [`Kernel '${kernel}' not found`] };
    }
    const kernelRefl = exec.reflection.getFunctionInfo(kernel);

    const vec3u = exec.getTypeInfo("vec3u");
    const u32 = exec.getTypeInfo("u32");

    const grid = normalizeDim(dispatchCount);
    context.setVariable("@num_workgroups", new VectorData(grid, vec3u));

    const wgSize = workgroupSize(kernelFn.node, context);
    const workgroupId = new VectorData([0, 0, 0], vec3u);
    context.setVariable("@workgroup_id", workgroupId);
    context.setVariable("@workgroup_size", new VectorData(wgSize, vec3u));

    const races: RaceReport[] = [];
    const errors: string[] = [];

    // One scheduler run per workgroup. NOTE: `var<workgroup>` memory should be
    // re-initialized between workgroups; a production version would re-run the
    // relevant initializers here.
    for (let wz = 0; wz < grid[2]; ++wz) {
        for (let wy = 0; wy < grid[1]; ++wy) {
            for (let wx = 0; wx < grid[0]; ++wx) {
                workgroupId.data[0] = wx;
                workgroupId.data[1] = wy;
                workgroupId.data[2] = wz;

                const tracker = new MemoryTracker();
                bindResources(exec, context, kernelRefl, bindGroups, tracker);
                wrapWorkgroupVars(context, tracker);

                const invocations: Invocation[] = [];
                for (let lz = 0, li = 0; lz < wgSize[2]; ++lz) {
                    for (let ly = 0; ly < wgSize[1]; ++ly) {
                        for (let lx = 0; lx < wgSize[0]; ++lx, ++li) {
                            invocations.push(makeInvocation(
                                debug, context, kernelFn, vec3u, u32,
                                li, [lx, ly, lz],
                                [lx + wx * wgSize[0], ly + wy * wgSize[1], lz + wz * wgSize[2]]));
                        }
                    }
                }

                const scheduler = new WorkgroupScheduler(debug, tracker, invocations);
                scheduler.run();

                races.push(...tracker.races);
                errors.push(...scheduler.errors);
            }
        }
    }

    return { races, errors };
}

// Build one invocation: its own context (own builtin ids) and its own ExecStack.
function makeInvocation(
    debug: WgslDebug, base: ExecContext, kernelFn: any,
    vec3u: TypeInfo, u32: TypeInfo,
    index: number, localId: number[], globalId: number[],
): Invocation {
    // clone() makes a child context: locals and the per-lane builtins live here,
    // while storage/workgroup buffers and functions resolve through the parent —
    // so every invocation shares the same backing memory. Critical for races.
    const ctx = base.clone();
    ctx.createVariable("@local_invocation_id", new VectorData([...localId], vec3u));
    ctx.createVariable("@global_invocation_id", new VectorData([...globalId], vec3u));
    ctx.createVariable("@local_invocation_index", new ScalarData(index, u32));

    // Bind the kernel's @builtin parameters to this lane's builtin variables.
    // TODO: handle a single struct parameter carrying multiple @builtins.
    for (const arg of kernelFn.node.args ?? []) {
        for (const attr of arg.attributes ?? []) {
            if (attr.name === "builtin") {
                const g = ctx.getVariable(`@${attr.value}`);
                if (g !== null) ctx.variables.set(arg.name, g);
            }
        }
    }

    const frame = debug.createStackFrame(kernelFn.node.body, ctx);
    const stack = new ExecStack();
    stack.states.push(frame);
    return new Invocation(index, stack);
}

// Bind bindGroup resources onto the global context, using TrackedTypedData for
// storage buffers so their accesses are recorded. Condensed from
// WgslDebug.debugWorkgroup's binding loop.
function bindResources(
    exec: WgslExec, context: ExecContext, kernelRefl: any,
    bindGroups: Record<string, Record<string, any>>, tracker: MemoryTracker,
): void {
    for (const set in bindGroups) {
        for (const binding in bindGroups[set]) {
            const entry = bindGroups[set][binding];
            context.variables.forEach((v: any) => {
                const node = v.node;
                if (!node || !node.attributes) return;

                let b: string | null = null;
                let s: string | null = null;
                for (const attr of node.attributes) {
                    if (attr.name === "binding") b = attr.value;
                    else if (attr.name === "group") s = attr.value;
                }
                if (binding !== b || set !== s) return;

                const inKernel = kernelRefl && kernelRefl.resources && kernelRefl.resources.some(
                    (r: any) => r.name === v.name &&
                                r.group === parseInt(set) && r.binding === parseInt(binding));
                if (!inKernel) return;

                const typeInfo = exec.getTypeInfo(node.type);
                if (entry.uniform !== undefined) {
                    v.value = new TypedData(entry.uniform, typeInfo);          // uniforms are read-only
                } else if (entry.texture !== undefined) {
                    // Textures need their own access model — skipped in this prototype.
                } else {
                    v.value = new TrackedTypedData(entry as ArrayBuffer, typeInfo, tracker, v.name);
                }
            });
        }
    }
}

// Wrap any remaining module-global TypedData (i.e. `var<workgroup>` arrays /
// structs) so workgroup-memory races are tracked too.
function wrapWorkgroupVars(context: ExecContext, tracker: MemoryTracker): void {
    context.variables.forEach((v: any) => {
        if (v.value instanceof TypedData && !(v.value instanceof TrackedTypedData)) {
            const td = v.value as TypedData;
            v.value = new TrackedTypedData(td.buffer, td.typeInfo, tracker, v.name);
        }
    });
}

function normalizeDim(d: number[]): [number, number, number] {
    return [d[0] ?? 1, d[1] ?? 1, d[2] ?? 1];
}

function workgroupSize(fnNode: any, context: ExecContext): [number, number, number] {
    const wg: [number, number, number] = [1, 1, 1];
    for (const attr of fnNode.attributes ?? []) {
        if (attr.name !== "workgroup_size") continue;
        const vals = Array.isArray(attr.value) ? attr.value : [attr.value];
        for (let i = 0; i < 3 && i < vals.length; ++i) {
            const n = parseInt(vals[i]);
            if (!isNaN(n)) {
                wg[i] = n;
            } else {
                const ov = context.getVariableValue(vals[i]);   // override constant
                if (ov instanceof ScalarData) {
                    wg[i] = typeof ov.value === "number" ? ov.value : Number((ov.value as any)[0]);
                }
            }
        }
    }
    return wg;
}

// -----------------------------------------------------------------------------
// Example usage:
//
//   const wgsl = `
//     @group(0) @binding(0) var<storage, read_write> data: array<u32>;
//     var<workgroup> tile: array<u32, 64>;
//     @compute @workgroup_size(64)
//     fn main(@builtin(local_invocation_index) lid: u32) {
//       tile[lid] = data[lid];
//       // MISSING workgroupBarrier() here -> race on `tile`
//       data[lid] = tile[63u - lid];
//     }`;
//
//   const buffer = new Uint32Array(64).buffer;
//   const { races, errors } = detectRaces(wgsl, "main", [1, 1, 1],
//       { "0": { "0": buffer } });
//   races.forEach(r => console.warn(r.message));
//   errors.forEach(e => console.warn(e));
// -----------------------------------------------------------------------------
