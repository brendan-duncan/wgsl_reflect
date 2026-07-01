import * as AST from "./wgsl_ast.js";
import { WgslExec } from "./wgsl_exec.js";
import { WgslParser } from "./wgsl_parser.js";
import { ExecContext, FunctionRef } from "./exec/exec_context.js";
import { Command, StatementCommand, CallExprCommand, GotoCommand, BlockCommand,
        ContinueTargetCommand, ContinueCommand, BreakCommand, BreakTargetCommand } from "./exec/command.js";
import { StackFrame } from "./exec/stack_frame.js";
import { ExecStack } from "./exec/exec_stack.js";
import { ScalarData, VectorData, MatrixData, TextureData, SamplerData, TypedData, VoidData, ArrayType, LiteralExpr, Data } from "./wgsl_ast.js";
import { StructInfo, TypeInfo, FunctionInfo } from "./reflect/info.js";

type RuntimeStateCallbackType = () => void;

// Quad-derivative builtins. These are rendezvous points for the fragment quad
// scheduler (exec/fragment_quad.ts): unlike ordinary builtins they are hoisted
// into their own step commands so the scheduler can pause the 2x2 quad at the
// call site, evaluate all four lanes, and compute the derivative.
export const DERIVATIVE_BUILTINS: Set<string> = new Set([
    "dpdx", "dpdxCoarse", "dpdxFine",
    "dpdy", "dpdyCoarse", "dpdyFine",
    "fwidth", "fwidthCoarse", "fwidthFine",
]);

// Texture-sampling builtins whose mip level (LOD) is computed implicitly from
// the derivatives of the texture coordinates, so they are quad rendezvous
// points too. Explicit-LOD/grad variants (textureSampleLevel/Grad) are not.
export const IMPLICIT_LOD_BUILTINS: Set<string> = new Set([
    "textureSample", "textureSampleBias",
]);

// All builtins the fragment quad scheduler pauses on. Used for hoisting into
// step commands and for the stepStack rendezvous guard.
export const QUAD_RENDEZVOUS_BUILTINS: Set<string> = new Set([
    ...DERIVATIVE_BUILTINS, ...IMPLICIT_LOD_BUILTINS,
]);

interface BindingEntry {
    texture?: { view?: unknown };
    descriptor?: unknown;
    uniform?: ArrayBuffer;
    // A GPUSamplerDescriptor (compareFunction, magFilter, addressMode*, ...).
    sampler?: Record<string, unknown>;
}

// Per-invocation inputs to a render-stage entry point, keyed by pipeline
// semantic: builtins by name ("vertex_index") and @location(n) attributes by
// location index. Scalars are numbers; vectors are arrays (or typed arrays).
type StageInputs = Record<string, number | number[] | Float32Array | Uint32Array | Int32Array>;

export class WgslDebug {
    private _code: string;
    private _exec: WgslExec;
    private _execStack: ExecStack;
    private _dispatchId: number[];
    // The value returned by a debugged entry point (e.g. a @vertex stage's
    // output struct). Top-level entries have no enclosing CallExpr to receive
    // their return, so stepStack stashes it here instead. null until the entry
    // executes its `return`.
    private _returnValue: Data | null = null;
    // Set when a fragment invocation executes `discard`. The invocation is then
    // killed (its stack unwound) and produces no output.
    private _discarded = false;
    // When true, stepStack pauses on a quad-derivative call instead of evaluating
    // it inline, so a fragment quad scheduler can compute it across the 2x2 quad.
    // Off for compute/vertex and single-lane fragment debugging (derivatives
    // there evaluate to zero). Owned by the QuadScheduler for its run.
    private _quadRendezvous = false;
    private _runTimer: ReturnType<typeof setTimeout> | null = null;
    // Number of commands processed synchronously per scheduler slice before
    // yielding to the event loop. Larger = higher throughput, smaller = more
    // responsive pause/UI. 1000 is a good default for most kernels.
    runSliceSize: number = 1000;
    readonly breakpoints: Set<number> = new Set();
    runStateCallback: RuntimeStateCallbackType | null = null;
    // Memoizes _createState's command list per AST body. Commands are pure
    // functions of the AST and immutable once built (positions patched at build
    // time), so re-entering the same function/block reuses the cached array.
    private _commandCache: WeakMap<AST.Node[], Command[]> = new WeakMap();

    constructor(code: string, runStateCallback?: RuntimeStateCallbackType) {
        this._code = code;
        const parser = new WgslParser();
        const ast = parser.parse(code);
        this._exec = new WgslExec(ast);
        this.runStateCallback = runStateCallback ?? null;
    }

    getVariableValue(name: string): number | number[] | null {
        const context = this.context;
        const v = context.getVariable(name)?.value ?? null;
        if (v === null) {
            return null;
        }
        if (v instanceof ScalarData) {
            return v.value;
        }
        if (v instanceof VectorData) {
            return Array.from(v.data);
        }
        if (v instanceof MatrixData) {
            return Array.from(v.data);
        }
        console.error(`Unsupported return variable type ${v.typeInfo.name}`);
        return null;
    }

    reset(): void {
        this._exec = new WgslExec(this._exec.ast);
        this.startDebug();
    }

    startDebug(): void {
        this._execStack = new ExecStack();
        const state = this._createState(this._exec.ast, this._exec.context);
        this._execStack.states.push(state);
    }

    get context(): ExecContext {
        const state = this.currentState;
        if (state === null) {
            return this._exec.context;
        }
        return state.context;
    }

    // Walks an exec stack, popping any frames that have run to completion.
    // Returns the topmost frame with at least one remaining command, or null
    // if execution is done. Shared by currentState/currentCommand/stepStack and
    // the slice loops so the walk-and-pop logic only lives in one place.
    private _resolveState(stack: ExecStack): StackFrame | null {
        while (!stack.isEmpty) {
            const state = stack.last!;
            if (!state.isAtEnd) {
                return state;
            }
            stack.pop();
        }
        return null;
    }

    private _resolveCurrentState(): StackFrame | null {
        return this._resolveState(this._execStack);
    }

    get currentState(): StackFrame | null {
        return this._resolveCurrentState();
    }

    get currentCommand(): Command | null {
        const state = this._resolveCurrentState();
        return state === null ? null : state.getCurrentCommand();
    }

    toggleBreakpoint(line: number): void {
        if (this.breakpoints.has(line)) {
            this.breakpoints.delete(line);
        } else {
            this.breakpoints.add(line);
        }
    }

    clearBreakpoints(): void {
        this.breakpoints.clear();
    }

    get isRunning(): boolean {
        return this._runTimer !== null;
    }

    private _stopRunning(): void {
        if (this._runTimer !== null) {
            clearTimeout(this._runTimer);
            this._runTimer = null;
        }
        if (this.runStateCallback !== null) {
            this.runStateCallback();
        }
    }

    run(): void {
        if (this.isRunning) {
            return;
        }
        const runSlice = () => {
            for (let i = 0; i < this.runSliceSize; ++i) {
                // Peek the next user-visible command directly off the resolved
                // state to avoid going through the currentCommand getter (which
                // would walk the stack a second time after stepNext re-walks).
                const state = this._resolveCurrentState();
                if (state === null) {
                    this._stopRunning();
                    return;
                }
                const peek = state.getCurrentCommand();
                if (peek !== null && this.breakpoints.has(peek.line)) {
                    this._stopRunning();
                    return;
                }
                if (!this.stepNext(true)) {
                    this._stopRunning();
                    return;
                }
            }
            // Yield to the event loop so pause()/UI can interject between slices.
            this._runTimer = setTimeout(runSlice, 0);
        };

        this._runTimer = setTimeout(runSlice, 0);
        if (this.runStateCallback !== null) {
            this.runStateCallback();
        }
    }

    pause(): void {
        if (this._runTimer !== null) {
            clearTimeout(this._runTimer);
            this._runTimer = null;
            if (this.runStateCallback !== null) {
                this.runStateCallback();
            }
        }
    }

    _setOverrides(constants: Record<string, unknown>, context: ExecContext): void {
        for (const k in constants) {
            const v = constants[k];
            const override = this._exec.reflection.getOverrideInfo(k);
            if (override !== null) {
                if (override.type === null) {
                    override.type = this._exec.getTypeInfo("u32");
                }
                if (override.type.name === "u32" || override.type.name === "i32" || override.type.name === "f32" || override.type.name === "f16") {
                    context.setVariable(k, new ScalarData(v as number, override.type));
                } else if (override.type.name === "bool") {
                    context.setVariable(k, new ScalarData(v ? 1 : 0, override.type));
                } else if (override.type.name === "vec2" || override.type.name === "vec3" || override.type.name === "vec4" ||
                    override.type.name === "vec2f" || override.type.name === "vec3f" || override.type.name === "vec4f" ||
                    override.type.name === "vec2i" || override.type.name === "vec3i" || override.type.name === "vec4i" ||
                    override.type.name === "vec2u" || override.type.name === "vec3u" || override.type.name === "vec4u" ||
                    override.type.name === "vec2h" || override.type.name === "vec3h" || override.type.name === "vec4h") {
                    context.setVariable(k, new VectorData(v as number[], override.type));
                } else {
                    console.error(`Invalid constant type for ${k}`);
                }
            } else {
                console.error(`Override ${k} does not exist in the shader.`);
            }
        }
    }

    debugWorkgroup(kernel: string, dispatchId: number[], 
        dispatchCount: number | number[], bindGroups: Record<string, Record<string, BindingEntry>>, config?: Record<string, unknown>): boolean {

        this._execStack = new ExecStack();

        const context = this._exec.context;
        context.currentFunctionName = kernel;

        this._dispatchId = dispatchId;

        config = config ?? {};
        const constants = config["constants"] as Record<string, number> | undefined;
        if (constants) {
            this._setOverrides(constants, context);
        }

        // Use this to debug the top level statements, otherwise call _execStatements.
        /*const state = new _ExecState(this._exec.context);
        this._execStack.states.push(state);
        for (const statement of this._exec.ast) {
            state.commands.push(new Command(CommandType.Statement, statement));
        }*/
        this._exec._execStatements(this._exec.ast, context);

        const kernelFn = context.getFunction(kernel);
        if (!kernelFn) {
            console.error(`Function ${kernel} not found`);
            return false;
        }

        const kernelRefl = this._exec.reflection.getFunctionInfo(kernel);

        if (typeof dispatchCount === "number") {
            dispatchCount = [dispatchCount, 1, 1];
        } else if (dispatchCount.length === 0) {
            console.error(`Invalid dispatch count`);
            return false;
        } else if (dispatchCount.length === 1) {
            dispatchCount = [dispatchCount[0], 1, 1];
        } else if (dispatchCount.length === 2) {
            dispatchCount = [dispatchCount[0], dispatchCount[1], 1];
        } else if (dispatchCount.length > 3) {
            dispatchCount = [dispatchCount[0], dispatchCount[1], dispatchCount[2]];
        }

        const depth = dispatchCount[2];
        const height = dispatchCount[1];
        const width = dispatchCount[0];

        const vec3u = this._exec.typeInfo["vec3u"];
        context.setVariable("@num_workgroups", new VectorData(dispatchCount, vec3u));

        this._bindResources(bindGroups, kernelRefl, context);

        const workgroupId = new VectorData([0, 0, 0], vec3u);
        context.setVariable("@workgroup_id", workgroupId);

        let found = false;
        for (let z = 0; z < depth && !found; ++z) {
            for (let y = 0; y < height && !found; ++y) {
                for (let x = 0; x < width && !found; ++x) {
                    workgroupId.data[0] = x;
                    workgroupId.data[1] = y;
                    workgroupId.data[2] = z;
                    if (this._dispatchWorkgroup(kernelFn, [x, y, z], context)) {
                        found = true;
                        break;
                    }
                }
            }
        }

        return found;
    }

    // Bind pipeline resources (uniforms, storage buffers, textures) onto the
    // execution context. Shared by debugWorkgroup and debugVertex: resource
    // binding is identical across shader stages, only the stage inputs differ.
    _bindResources(bindGroups: Record<string, Record<string, BindingEntry>>,
        refl: FunctionInfo, context: ExecContext): void {

        for (const set in bindGroups) {
            for (const binding in bindGroups[set]) {
                const entry = bindGroups[set][binding];

                context.variables.forEach((v) => {
                    const node = v.node;
                    if (node?.attributes) {
                        let b = null;
                        let s = null;
                        for (const attr of node.attributes) {
                            if (attr.name === "binding") {
                                b = attr.value;
                            } else if (attr.name === "group") {
                                s = attr.value;
                            }
                        }
                        if (binding === b && set === s) {
                            let found = false;
                            for (const resource of refl.resources) {
                                if (resource.name === v.name && resource.group === parseInt(set) && resource.binding === parseInt(binding)) {
                                    found = true;
                                    break;
                                }
                            }
                            if (found) {
                                const typeInfo = this._exec.getTypeInfo(node.type);
                                if (entry.texture !== undefined && entry.descriptor !== undefined) {
                                    // `texture` may be one buffer or an array of per-mip
                                    // buffers (index = mip level), matching the exec path.
                                    const mips = Array.isArray(entry.texture)
                                        ? entry.texture as unknown as ArrayBuffer[]
                                        : [entry.texture as unknown as ArrayBuffer];
                                    v.value = new TextureData(mips, typeInfo, entry.descriptor as unknown,
                                        (entry.texture as unknown as { view?: unknown }).view ?? null);
                                } else if (entry.sampler !== undefined) {
                                    v.value = new SamplerData(entry.sampler as Record<string, unknown>, typeInfo);
                                } else if (entry.uniform !== undefined) {
                                    v.value = new TypedData(entry.uniform, typeInfo);
                                } else {
                                    if (typeInfo.isStruct || typeInfo.isArray) {
                                        v.value = new TypedData(entry as unknown as ArrayBuffer, typeInfo);
                                    } else {
                                        const arrayType = new ArrayType(`array<${node.type.name}>`, [], node.type, 1)
                                        let i32 = this._exec.getTypeInfo('i32');
                                        const index = new AST.ArrayIndex(new AST.LiteralExpr(new ScalarData(new Int32Array([0]), i32), AST.Type.u32));
                                        v.value = new TypedData(entry as unknown as ArrayBuffer, this._exec.getTypeInfo(arrayType)).getSubData(this._exec, index, null);
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }
    }

    // Debug a single @vertex shader invocation.
    //
    // `inputs` provides the per-vertex inputs keyed by pipeline semantic:
    //   - builtins by name:    { vertex_index: 3, instance_index: 0 }
    //   - @location(n) attrs:  { 0: [x, y, z], 1: [u, v] }
    // The semantics are identical whether the shader declares them as separate
    // arguments or grouped together in an input struct.
    //
    // After this returns true, step the invocation with stepNext()/run() exactly
    // like a compute dispatch. The stage's output is available via returnValue /
    // getReturnValue() once the entry executes its `return`.
    debugVertex(entry: string, inputs: StageInputs,
        bindGroups: Record<string, Record<string, BindingEntry>>, config?: Record<string, unknown>): boolean {
        return this._debugStage(entry, "vertex", inputs, bindGroups, config);
    }

    // Debug a single @fragment shader invocation.
    //
    // `inputs` provides the interpolated fragment inputs keyed by pipeline
    // semantic, exactly like debugVertex:
    //   - builtins by name:    { position: [x,y,z,w], front_facing: 1, sample_index: 0 }
    //   - @location(n) attrs:  { 0: [r, g, b], 1: [u, v] }
    // The @location inputs are the already-interpolated values for this fragment;
    // supply them from a captured draw (this debugger does not rasterize).
    //
    // NOTE: this runs a *single* invocation, so quad-derivative operations
    // (dpdx/dpdy/fwidth) evaluate as if the quad were uniform — their
    // derivatives are zero — and textureSample's implicit LOD is 0 (base mip).
    // Use debugFragmentQuad to debug shaders whose output depends on
    // derivatives or mip selection.
    debugFragment(entry: string, inputs: StageInputs,
        bindGroups: Record<string, Record<string, BindingEntry>>, config?: Record<string, unknown>): boolean {
        return this._debugStage(entry, "fragment", inputs, bindGroups, config);
    }

    // Shared setup for a single render-stage invocation: apply overrides, bind
    // resources and stage inputs, and seed the exec stack. `stage` is the
    // reflected entry-point stage ("vertex" | "fragment") this call expects.
    _debugStage(entry: string, stage: string, inputs: StageInputs,
        bindGroups: Record<string, Record<string, BindingEntry>>, config?: Record<string, unknown>): boolean {

        this._execStack = new ExecStack();
        this._returnValue = null;
        this._discarded = false;

        const context = this._exec.context;
        context.currentFunctionName = entry;

        config = config ?? {};
        const constants = config["constants"] as Record<string, number> | undefined;
        if (constants) {
            this._setOverrides(constants, context);
        }

        // Execute module-scope statements (global consts, etc.) and register
        // function declarations into the context.
        this._exec._execStatements(this._exec.ast, context);

        const entryFn = context.getFunction(entry);
        if (!entryFn) {
            console.error(`Function ${entry} not found`);
            return false;
        }

        const entryRefl = this._exec.reflection.getFunctionInfo(entry);
        if (entryRefl === null) {
            console.error(`Function ${entry} not found in reflection data`);
            return false;
        }
        if (entryRefl.stage !== stage) {
            console.error(`Function ${entry} is not a @${stage} entry point`);
            return false;
        }

        this._bindResources(bindGroups, entryRefl, context);
        this._bindStageInputs(entryFn, inputs, context);

        const state = this._createState(entryFn.node.body, context);
        this._execStack.states.push(state);
        return true;
    }

    // Resolve each entry-point argument from the supplied stage inputs and bind
    // it as a local variable. Builtin/location arguments are taken directly from
    // `inputs`; a struct argument is assembled member-by-member from inputs.
    _bindStageInputs(fn: FunctionRef, inputs: StageInputs, context: ExecContext): void {
        for (const arg of fn.node.args) {
            const typeInfo = this._exec.getTypeInfo(arg.type);
            const { builtin, location } = this._inputSemantic(arg.attributes);
            let value: Data | null = null;

            if (builtin !== null || location !== null) {
                const key = (builtin !== null ? builtin : location) as string;
                const raw = inputs[key];
                if (raw !== undefined) {
                    value = this._makeStageValue(typeInfo, raw);
                }
            } else if (typeInfo !== null && typeInfo.isStruct) {
                value = this._makeStructInput(typeInfo as StructInfo, inputs, context);
            }

            if (value !== null) {
                context.createVariable(arg.name, value, arg);
            }
        }
    }

    // Extract the @builtin(name) / @location(n) semantic from an attribute list.
    _inputSemantic(attributes: AST.Attribute[] | null): { builtin: string | null, location: string | null } {
        let builtin: string | null = null;
        let location: string | null = null;
        if (attributes) {
            for (const attr of attributes) {
                if (attr.name === "builtin") {
                    builtin = attr.value as string;
                } else if (attr.name === "location") {
                    location = attr.value as string;
                }
            }
        }
        return { builtin, location };
    }

    // Build a ScalarData/VectorData for a stage input value. The concrete type
    // name (e.g. "vec3f" rather than the bare "vec3" template) is resolved so the
    // value gets the correct backing array kind (f32/u32/i32).
    _makeStageValue(typeInfo: TypeInfo | null,
        value: number | number[] | Float32Array | Uint32Array | Int32Array): Data | null {
        if (typeInfo === null) {
            return null;
        }
        const concrete = this._exec.getTypeInfo(typeInfo.getTypeName()) ?? typeInfo;
        if (typeof value === "number") {
            return new ScalarData(value, concrete);
        }
        return new VectorData(Array.from(value as ArrayLike<number>), concrete);
    }

    // Assemble an input struct value by writing each member, resolved by its own
    // @builtin/@location semantic, into a fresh buffer laid out per the struct.
    _makeStructInput(typeInfo: StructInfo, inputs: StageInputs, context: ExecContext): Data {
        const data = new TypedData(new ArrayBuffer(typeInfo.size), typeInfo);
        for (const m of typeInfo.members) {
            const { builtin, location } = this._inputSemantic(m.attributes);
            const key = builtin !== null ? builtin : location;
            if (key === null) {
                continue;
            }
            const raw = inputs[key];
            if (raw === undefined) {
                continue;
            }
            const memberData = this._makeStageValue(m.type, raw);
            if (memberData !== null) {
                data.setDataValue(this._exec, memberData, new AST.StringExpr(m.name), context);
            }
        }
        return data;
    }

    // Raw return value of a debugged entry point (null until it returns).
    get returnValue(): Data | null {
        return this._returnValue;
    }

    // Take and clear the captured entry return value. Used by the fragment quad
    // scheduler to harvest each lane's output before running the next lane on the
    // shared debug instance.
    takeReturnValue(): Data | null {
        const v = this._returnValue;
        this._returnValue = null;
        return v;
    }

    // Whether the most recent invocation executed `discard` (fragment killed).
    get discarded(): boolean {
        return this._discarded;
    }

    // Take and clear the discard flag. Used by the quad scheduler to record which
    // lanes discarded on the shared debug instance.
    takeDiscarded(): boolean {
        const d = this._discarded;
        this._discarded = false;
        return d;
    }

    // Convert a raw Data value to plain JS (see getReturnValue). Exposed for
    // schedulers that collect per-lane outputs.
    dataToJS(v: Data | null): number | number[] | Record<string, unknown> | null {
        return this._dataToJS(v);
    }

    // Whether stepStack pauses on quad-derivative calls (see _quadRendezvous).
    // The QuadScheduler sets this for the duration of its run.
    get quadRendezvous(): boolean {
        return this._quadRendezvous;
    }
    set quadRendezvous(v: boolean) {
        this._quadRendezvous = v;
    }

    // The entry's return value as plain JS: a number for scalars, an array for
    // vectors/matrices, or an object keyed by member name for a struct output.
    getReturnValue(): number | number[] | Record<string, unknown> | null {
        return this._dataToJS(this._returnValue);
    }

    _dataToJS(v: Data | null): number | number[] | Record<string, unknown> | null {
        if (v === null) {
            return null;
        }
        if (v instanceof ScalarData) {
            return v.value;
        }
        if (v instanceof VectorData || v instanceof MatrixData) {
            return Array.from(v.data);
        }
        if (v instanceof TypedData && v.typeInfo instanceof StructInfo) {
            const out: Record<string, unknown> = {};
            for (const m of v.typeInfo.members) {
                const md = v.getSubData(this._exec, new AST.StringExpr(m.name), this.context);
                out[m.name] = this._dataToJS(md);
            }
            return out;
        }
        return null;
    }

    _shouldExecuteNextCommand(stack?: ExecStack): boolean {
        const resolved = this._resolveState(stack ?? this._execStack);
        const command = resolved === null ? null : resolved.getCurrentCommand();
        if (command === null) {
            return false;
        }
        if (command instanceof GotoCommand) {
            if (command.condition === null) {
                return true;
            }
        } else if (command instanceof ContinueTargetCommand || command instanceof BreakTargetCommand) {
            return true;
        }
        return false;
    }

    stepInto(): void {
        if (this.isRunning) {
            return;
        }
        this.stepNext(true);
    }

    stepOver(): void {
        if (this.isRunning) {
            return;
        }
        this.stepNext(false);
    }

    stepOut(): void {
        const state = this.currentState;
        if (state === null) {
            return;
        }
        const parentState = state.parent;

        if (this._runTimer !== null) {
            clearTimeout(this._runTimer);
            this._runTimer = null;
        }

        const stepOutSlice = () => {
            for (let i = 0; i < this.runSliceSize; ++i) {
                const peekState = this._resolveCurrentState();
                if (peekState === null) {
                    this._stopRunning();
                    return;
                }
                const peek = peekState.getCurrentCommand();
                if (peek !== null && this.breakpoints.has(peek.line)) {
                    this._stopRunning();
                    return;
                }
                if (!this.stepNext(true)) {
                    this._stopRunning();
                    return;
                }
                if (this._resolveCurrentState() === parentState) {
                    this._stopRunning();
                    return;
                }
            }
            this._runTimer = setTimeout(stepOutSlice, 0);
        };

        this._runTimer = setTimeout(stepOutSlice, 0);
        if (this.runStateCallback !== null) {
            this.runStateCallback();
        }
    }

    // Returns true if execution is not finished, false if execution is complete.
    stepNext(stepInto = true): boolean {
        if (!this._execStack) {
            this._execStack = new ExecStack();
            const state = this._createState(this._exec.ast, this._exec.context);
            this._execStack.states.push(state);
        }
        return this.stepStack(this._execStack, stepInto);
    }

    // Advance a single command on an arbitrary ExecStack. This is the same
    // interpreter engine as stepNext, but re-entrant: a scheduler can own
    // several ExecStacks (one per concurrent compute invocation) and interleave
    // them by calling stepStack on each in turn. Returns false once `stack` has
    // finished. See exec/race_detector.ts for the lockstep workgroup scheduler.
    stepStack(stack: ExecStack, stepInto = true): boolean {
        while (true) {
            let state = this._resolveState(stack);
            if (state === null) {
                return false;
            }

            const command = state.getNextCommand();
            if (command === null) {
                continue;
            }

            if (stepInto && command instanceof CallExprCommand) {
                const node = command.node;
                const fn = state.context.getFunction(node.name);
                if (!fn) {
                    // A quad-derivative call: in quad mode, pause here (leaving
                    // the command in place) so the scheduler can rendezvous the
                    // 2x2 quad. Once it has stored this lane's result, the guard
                    // falls through and the enclosing statement consumes it.
                    if (this._quadRendezvous && QUAD_RENDEZVOUS_BUILTINS.has(node.name) &&
                        state.context.getDerivative(node) === null) {
                        state.current--;
                        return true;
                    }
                    continue; // it's not a custom function, step over it
                }
                const fnState = this._createState(fn.node.body, state.context.clone(), state);

                for (let ai = 0; ai < fn.node.args.length; ++ai) {
                    const arg = fn.node.args[ai];
                    const value = this._exec.evalExpression(node.args[ai], fnState.context);
                    fnState.context.createVariable(arg.name, value, arg);
                }

                fnState.parentCallExpr = node;
                stack.states.push(fnState);
                fnState.context.currentFunctionName = fn.name;

                if (this._shouldExecuteNextCommand(stack)) {
                    continue;
                }
                return true;
            } else if (command instanceof StatementCommand) {
                const node = command.node;
                if (stepInto && node instanceof AST.Call) {
                    const fn = state.context.getFunction(node.name);
                    // We want to step into custom functions, not directly execute them
                    if (fn) {
                        const fnState = this._createState(fn.node.body, state.context.clone(), state);

                        for (let ai = 0; ai < fn.node.args.length; ++ai) {
                            const arg = fn.node.args[ai];
                            const value = this._exec.evalExpression(node.args[ai], fnState.context);
                            fnState.context.createVariable(arg.name, value, arg);
                        }

                        stack.states.push(fnState);
                        fnState.context.currentFunctionName = fn.name;

                        if (this._shouldExecuteNextCommand(stack)) {
                            continue;
                        }
                        return true;
                    }
                }

                if (node instanceof AST.Discard) {
                    // `discard` kills the fragment invocation: no further
                    // statements run and it produces no output. Unwind the whole
                    // stack and report completion.
                    this._discarded = true;
                    while (!stack.isEmpty) {
                        stack.pop();
                    }
                    return false;
                }

                const res = this._exec.execStatement(node, state.context);
                if (res !== null && res !== undefined && !(res instanceof VoidData)) {
                    // A `return` executed. Find the frame it returns from: either
                    // a called function frame (parentCallExpr set) or the
                    // top-level entry frame (no parent).
                    let fnFrame = state;
                    while (fnFrame.parentCallExpr === null && fnFrame.parent !== null) {
                        fnFrame = fnFrame.parent;
                    }
                    if (fnFrame.parentCallExpr !== null) {
                        fnFrame.parentCallExpr.setCachedReturnValue(res);
                    } else {
                        // No enclosing CallExpr: this is the return of a
                        // top-level entry point (e.g. a @vertex/@fragment stage).
                        // Surface it via returnValue rather than dropping it.
                        this._returnValue = res;
                    }
                    // `return` exits the function: unwind every frame up to and
                    // including fnFrame. Without this, execution falls through to
                    // statements that follow the return's enclosing block (e.g.
                    // `if c { return a; } return b;` would run `return b` too).
                    while (!stack.isEmpty) {
                        const popped = stack.last;
                        stack.pop();
                        if (popped === fnFrame) {
                            break;
                        }
                    }
                    if (this._shouldExecuteNextCommand(stack)) {
                        continue;
                    }
                    return this._resolveState(stack) !== null;
                }
            } else if (command instanceof ContinueTargetCommand) {
                continue;
            } else if (command instanceof BreakTargetCommand) {
                continue;
            } else if (command instanceof ContinueCommand) {
                const targetId = command.id;
                while (!stack.isEmpty) {
                    state = stack.last;
                    for (let i = state.commands.length - 1; i >= 0; --i) {
                        const cmd = state.commands[i];
                        if (cmd instanceof ContinueTargetCommand) {
                            if (cmd.id === targetId) {
                                state.current = i + 1;
                                return true;
                            }
                        }
                    }
                    // No Goto -1 found (loop), pop the current state and continue searching.
                    stack.pop();
                }
                // If we got here, we've reached the end of the stack and didn't find a -1.
                // That means a continue was used outside of a loop, so we're done.
                console.error("Continue statement used outside of a loop");
                return false;
            } else if (command instanceof BreakCommand) {
                const targetId = command.id;
                // break-if conditional break 
                if (command.condition) {
                    const res = this._exec.evalExpression(command.condition, state.context);
                    if (!(res instanceof ScalarData)) {
                        console.error("Condition must be a scalar");
                        return false;
                    }
                    // If the condition is false, then we should not the break.
                    if (!res.value) {
                        if (this._shouldExecuteNextCommand(stack)) {
                            continue;
                        }
                        return true;
                    }
                }

                while (!stack.isEmpty) {
                    state = stack.last;
                    for (let i = state.commands.length - 1; i >= 0; --i) {
                        const cmd = state.commands[i];
                        if (cmd instanceof BreakTargetCommand) {
                            if (cmd.id === targetId) {
                                state.current = i + 1;
                                return true;
                            }
                        }
                    }
                    // No Goto -2 found (loop), pop the current state and continue searching.
                    stack.pop();
                }
                // If we got here, we've reached the end of the stack and didn't find a BreakTarget.
                // That means a break was used outside of a loop, so we're done.
                console.error("Break statement used outside of a loop");
                return false;
            } else if (command instanceof GotoCommand) {
                if (command.condition) {
                    const res = this._exec.evalExpression(command.condition, state.context);
                    if (!(res instanceof ScalarData)) {
                        console.error("Condition must be a scalar");
                        return false;
                    }
                    // If the GOTO condition value is true, then continue to the next command.
                    // Otherwise, jump to the specified position.
                    if (res.value) {
                        if (this._shouldExecuteNextCommand(stack)) {
                            continue;
                        }
                        return true;
                    }
                }
                state.current = command.position;
                if (this._shouldExecuteNextCommand(stack)) {
                    continue;
                }
                return true;
            } else if (command instanceof BlockCommand) {
                const blockState = this._createState(command.statements, state.context.clone(), state);
                stack.states.push(blockState);
                continue; // step into the first statement of the block
            }

            if (this._shouldExecuteNextCommand(stack)) {
                continue;
            }
            // Empty frames are popped by _resolveState; if it unwinds the
            // whole stack there is nothing left to step, so report completion.
            return this._resolveState(stack) !== null;
        }
    }

    // --- Public API for external schedulers (see exec/race_detector.ts) ---

    // The underlying execution engine: global memory, bound resources, functions.
    get exec(): WgslExec {
        return this._exec;
    }

    // Apply override-constant values to a context (public form of _setOverrides).
    applyOverrides(constants: Record<string, unknown>, context: ExecContext): void {
        this._setOverrides(constants, context);
    }

    // Lower a statement body into a StackFrame (command list). Used to seed an
    // independent ExecStack per concurrent invocation.
    createStackFrame(body: AST.Node[], context: ExecContext, parent?: StackFrame): StackFrame {
        return this._createState(body, context, parent);
    }

    _dispatchWorkgroup(f: FunctionRef, workgroup_id: number[], context: ExecContext): boolean {
        const workgroupSize = [1, 1, 1];
        for (const attr of f.node.attributes) {
            if (attr.name === "workgroup_size") {
                if (Array.isArray(attr.value)) {
                    if (attr.value.length > 0) {
                        // The value could be an override constant
                        const v = context.getVariableValue(attr.value[0]);
                        if (v instanceof ScalarData) {
                            workgroupSize[0] = v.value;
                        } else {
                            workgroupSize[0] = parseInt(attr.value[0]);
                        }
                    }
                    if (attr.value.length > 1) {
                        const v = context.getVariableValue(attr.value[1]);
                        if (v instanceof ScalarData) {
                            workgroupSize[1] = v.value;
                        } else {
                            workgroupSize[1] = parseInt(attr.value[1]);
                        }
                    }
                    if (attr.value.length > 2) {
                        const v = context.getVariableValue(attr.value[2]);
                        if (v instanceof ScalarData) {
                            workgroupSize[2] = v.value;
                        } else {
                            workgroupSize[2] = parseInt(attr.value[2]);
                        }
                    }
                } else {
                    const v = context.getVariableValue(attr.value);
                    if (v instanceof ScalarData) {
                        workgroupSize[0] = v.value;
                    } else if (v instanceof VectorData) {
                        workgroupSize[0] = v.data[0];
                        workgroupSize[1] = v.data.length > 1 ? v.data[1] : 1;
                        workgroupSize[2] = v.data.length > 2 ? v.data[2] : 1;
                    } else {
                        workgroupSize[0] = parseInt(attr.value);
                    }
                }
            }
        }

        const vec3u = this._exec.typeInfo["vec3u"];
        const u32 = this._exec.typeInfo["u32"];
        context.setVariable("@workgroup_size", new VectorData(workgroupSize, vec3u));

        const width = workgroupSize[0];
        const height = workgroupSize[1];
        const depth = workgroupSize[2];

        // The loop only searches for the invocation matching the debugged
        // dispatch id; reuse single Data instances and populate them once the
        // match is found rather than allocating on every iteration.
        const localId = new VectorData([0, 0, 0], vec3u);
        const globalId = new VectorData([0, 0, 0], vec3u);
        const localIndex = new ScalarData(0, u32);
        context.setVariable("@local_invocation_id", localId);
        context.setVariable("@global_invocation_id", globalId);
        context.setVariable("@local_invocation_index", localIndex);

        let found = false;
        for (let z = 0, li = 0; z < depth && !found; ++z) {
            for (let y = 0; y < height && !found; ++y) {
                for (let x = 0; x < width && !found; ++x, ++li) {
                    const gx = x + workgroup_id[0] * workgroupSize[0];
                    const gy = y + workgroup_id[1] * workgroupSize[1];
                    const gz = z + workgroup_id[2] * workgroupSize[2];

                    if (gx === this._dispatchId[0] &&
                        gy === this._dispatchId[1] &&
                        gz === this._dispatchId[2]) {
                        localId.data[0] = x;
                        localId.data[1] = y;
                        localId.data[2] = z;
                        globalId.data[0] = gx;
                        globalId.data[1] = gy;
                        globalId.data[2] = gz;
                        localIndex.value = li;
                        found = true;
                        break;
                    }
                }
            }
        }

        if (found) {
            this._dispatchExec(f, context);
        }

        return found;
    }

    _dispatchExec(f: FunctionRef, context: ExecContext) {
        // Update any built-in input args.
        // TODO: handle input structs.
        for (const arg of f.node.args) {
            for (const attr of arg.attributes) {
                if (attr.name === "builtin") {
                    const globalName = `@${attr.value}`;
                    const globalVar = context.getVariable(globalName);
                    if (globalVar !== null) {
                        context.variables.set(arg.name, globalVar);
                    }
                }
            }
        }

        const state = this._createState(f.node.body, context);
        this._execStack.states.push(state);
    }

    _createState(ast: AST.Node[], context: ExecContext, parent?: StackFrame): StackFrame {
        const state = new StackFrame(context, parent ?? null);

        // Register function declarations into the context. This is a scope side
        // effect (not a command), so it runs on every entry — including cache hits.
        for (const statement of ast) {
            if (statement instanceof AST.Function) {
                const f = new FunctionRef(statement);
                context.functions.set(statement.name, f);
            }
        }

        const cached = this._commandCache.get(ast);
        if (cached !== undefined) {
            state.commands = cached;
            return state;
        }

        for (const statement of ast) {
            // A statement may have expressions that include function calls.
            // Gather all of the internal function calls from the statement.
            // We can then include them as commands to step through, storing their
            // values with the call node so that when it is evaluated, it uses that
            // already computed value. This allows us to step into the function
            if (Array.isArray(statement)) {
                // Bare compound block `{ ... }` — the parser returns it as a raw
                // Statement[] embedded in the parent body.
                state.commands.push(new BlockCommand(statement));
                continue;
            }
            if (statement instanceof AST.Let ||
                statement instanceof AST.Var ||
                statement instanceof AST.Const ||
                statement instanceof AST.Override ||
                statement instanceof AST.Assign) {
                const functionCalls = [];
                this._collectFunctionCalls(statement.value, functionCalls);
                for (const call of functionCalls) {
                    state.commands.push(new CallExprCommand(call, statement));
                }
                state.commands.push(new StatementCommand(statement));
            } else if (statement instanceof AST.Call) {
                const functionCalls = [];
                for (const arg of statement.args) {
                    this._collectFunctionCalls(arg, functionCalls);
                }
                for (const call of functionCalls) {
                    state.commands.push(new CallExprCommand(call, statement));
                }
                state.commands.push(new StatementCommand(statement));
            } else if (statement instanceof AST.Return) {
                const functionCalls = [];
                this._collectFunctionCalls(statement.value, functionCalls);
                for (const call of functionCalls) {
                    state.commands.push(new CallExprCommand(call, statement));
                }
                state.commands.push(new StatementCommand(statement));
            } else if (statement instanceof AST.Increment) {
                state.commands.push(new StatementCommand(statement));
            } else if (statement instanceof AST.Function) {
                // Already registered into context above; no command emitted.
                continue;
            } else if (statement instanceof AST.If) {
                const functionCalls = [];
                this._collectFunctionCalls(statement.condition, functionCalls);
                for (const call of functionCalls) {
                    state.commands.push(new CallExprCommand(call, statement));
                }

                let conditionCmd = new GotoCommand(statement.condition, 0, statement.line);
                state.commands.push(conditionCmd);
                if (statement.body.length > 0) {
                    state.commands.push(new BlockCommand(statement.body));
                }
                const gotoEnd = new GotoCommand(null, 0, statement.line);
                state.commands.push(gotoEnd);

                for (const elseIf of statement.elseif) {
                    conditionCmd.position = state.commands.length;

                    const functionCalls = [];
                    this._collectFunctionCalls(elseIf.condition, functionCalls);
                    for (const call of functionCalls) {
                        state.commands.push(new CallExprCommand(call, statement));
                    }

                    conditionCmd = new GotoCommand(elseIf.condition, 0, elseIf.line);
                    state.commands.push(conditionCmd);
                    if (elseIf.body.length > 0) {
                        state.commands.push(new BlockCommand(elseIf.body));
                    }
                    state.commands.push(gotoEnd);
                }

                conditionCmd.position = state.commands.length;
                if (statement.else) {
                    state.commands.push(new BlockCommand(statement.else));
                }

                gotoEnd.position = state.commands.length;
            } else if (statement instanceof AST.Switch) {
                const functionCalls = [];
                this._collectFunctionCalls(statement.condition, functionCalls);
                for (const call of functionCalls) {
                    state.commands.push(new CallExprCommand(call, statement));
                }

                let defaultCase: AST.SwitchCase | null = null;
                for (const c of statement.cases) {
                    if (c instanceof AST.Default) {
                        defaultCase = c;
                        break;
                    } else if (c instanceof AST.Case) {
                        for (const selector of c.selectors) {
                            if (selector instanceof AST.DefaultSelector) {
                                defaultCase = c;
                                break;
                            }
                        }
                    }
                }

                const gotoEndCommands: GotoCommand[] = [];

                for (const c of statement.cases) {
                    if (c === defaultCase) {
                        continue;
                    }

                    if (!(c instanceof AST.Case)) {
                        continue;
                    }

                    let lastCondition = null;
                    for (const selector of c.selectors) {
                        let conditionExpr = new AST.BinaryOperator("==", statement.condition, selector);
                        if (lastCondition) {
                            conditionExpr = new AST.BinaryOperator("||", lastCondition, conditionExpr);
                        }
                        lastCondition = conditionExpr;
                    }

                    const gotoCommand = new GotoCommand(lastCondition, 0, c.line);
                    state.commands.push(gotoCommand);

                    if (c.body.length > 0) {
                        state.commands.push(new BlockCommand(c.body));
                    }

                    const gotoEndCommand = new GotoCommand(null, 0, c.line);
                    gotoEndCommands.push(gotoEndCommand);
                    state.commands.push(gotoEndCommand);

                    gotoCommand.position = state.commands.length;
                }

                if (defaultCase) {
                    state.commands.push(new BlockCommand(defaultCase.body));
                }

                state.commands.push(new BreakTargetCommand(statement.id));

                const commandPos = state.commands.length;
                for (let i = 0; i < gotoEndCommands.length; ++i) {
                    gotoEndCommands[i].position = commandPos;
                }
            } else if (statement instanceof AST.While) {
                const functionCalls = [];
                state.commands.push(new ContinueTargetCommand(statement.id));
                this._collectFunctionCalls(statement.condition, functionCalls);
                for (const call of functionCalls) {
                    state.commands.push(new CallExprCommand(call, statement));
                }
                const conditionCmd = new GotoCommand(statement.condition, 0, statement.line);
                state.commands.push(conditionCmd);
                let lastLine = statement.line;

                if (statement.body.length > 0) {
                    state.commands.push(new BlockCommand(statement.body));
                    lastLine = statement.body[statement.body.length - 1].line;
                }

                state.commands.push(new GotoCommand(statement.condition, 0, lastLine));
                state.commands.push(new BreakTargetCommand(statement.id));
                conditionCmd.position = state.commands.length;
            } else if (statement instanceof AST.For) {
                if (statement.init) {
                    state.commands.push(new StatementCommand(statement.init));
                }

                let conditionPos = state.commands.length;

                if (statement.increment === null) {
                    state.commands.push(new ContinueTargetCommand(statement.id));
                }
                let conditionCmd = null;
                if (statement.condition) {
                    const functionCalls = [];
                    this._collectFunctionCalls(statement.condition!, functionCalls);
                    for (const call of functionCalls) {
                        state.commands.push(new CallExprCommand(call, statement));
                    }
                    conditionCmd = new GotoCommand(statement.condition, 0, statement.line);
                    state.commands.push(conditionCmd);
                }

                let lastLine = statement.line;
                if (statement.body.length > 0) {
                    state.commands.push(new BlockCommand(statement.body));
                    lastLine = statement.body[statement.body.length - 1].line;
                }

                if (statement.increment) {
                    state.commands.push(new ContinueTargetCommand(statement.id));
                    state.commands.push(new StatementCommand(statement.increment));
                }
                state.commands.push(new GotoCommand(null, conditionPos, lastLine));
                state.commands.push(new BreakTargetCommand(statement.id));
                conditionCmd.position = state.commands.length;
            } else if (statement instanceof AST.Loop) {
                let loopStartPos = state.commands.length;
                if (!statement.continuing) {
                    state.commands.push(new ContinueTargetCommand(statement.id));
                }
                let lastLine = statement.line;
                if (statement.body.length > 0) {
                    state.commands.push(new BlockCommand(statement.body));
                    lastLine = statement.body[statement.body.length - 1].line;
                }
                state.commands.push(new GotoCommand(null, loopStartPos, lastLine));
                state.commands.push(new BreakTargetCommand(statement.id));
            } else if (statement instanceof AST.Continuing) {
                state.commands.push(new ContinueTargetCommand(statement.loopId));
                state.commands.push(new BlockCommand(statement.body));
            } else if (statement instanceof AST.Continue) {
                state.commands.push(new ContinueCommand(statement.loopId, statement));
            } else if (statement instanceof AST.Break) {
                state.commands.push(new BreakCommand(statement.loopId, statement.condition, statement));
            } else if (statement instanceof AST.StaticAssert) {
                state.commands.push(new StatementCommand(statement));
            } else if (statement instanceof AST.Discard) {
                state.commands.push(new StatementCommand(statement));
            } else if (statement instanceof AST.Struct) {
                // nothing to do
            } else {
                console.error(`TODO: statement type ${statement.constructor.name}`);
            }
        }

        this._commandCache.set(ast, state.commands);
        return state;
    }

    _collectFunctionCalls(node: AST.Expression, functionCalls: AST.CallExpr[]) {
        if (node instanceof AST.CallExpr) {
            if (node.args) {
                for (const arg of node.args) {
                    this._collectFunctionCalls(arg, functionCalls);
                }
            }
            // Collect custom function calls (to step into them) and quad
            // derivative builtins (rendezvous points for the fragment quad
            // scheduler). Other builtins are evaluated inline by their statement.
            if (!node.isBuiltin || QUAD_RENDEZVOUS_BUILTINS.has(node.name)) {
                functionCalls.push(node);
            }
        } else if (node instanceof AST.BinaryOperator) {
            this._collectFunctionCalls(node.left, functionCalls);
            this._collectFunctionCalls(node.right, functionCalls);
        } else if (node instanceof AST.UnaryOperator) {
            this._collectFunctionCalls(node.right, functionCalls);
        } else if (node instanceof AST.CreateExpr) {
            if (node.args) {
                for (const arg of node.args) {
                    this._collectFunctionCalls(arg, functionCalls);
                }
            }
        } else if (node instanceof AST.BitcastExpr) {
            this._collectFunctionCalls(node.value, functionCalls);
        } else if (node instanceof AST.ArrayIndex) {
            this._collectFunctionCalls(node.index, functionCalls);
        } else if (AST.LiteralExpr) {
            // nothing to do
        } else {
            console.error(`TODO: expression type ${node.constructor.name}`);
        }
    }
}

