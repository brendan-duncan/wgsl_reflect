import * as AST from "./wgsl_ast.js";
import { WgslExec } from "./wgsl_exec.js";
import { WgslParser } from "./wgsl_parser.js";
import { ExecContext, FunctionRef } from "./exec/exec_context.js";
import { Command, StatementCommand, CallExprCommand, GotoCommand, BlockCommand,
        ContinueTargetCommand, ContinueCommand, BreakCommand, BreakTargetCommand } from "./exec/command.js";
import { StackFrame } from "./exec/stack_frame.js";
import { ExecStack } from "./exec/exec_stack.js";
import { ScalarData, VectorData, MatrixData, TextureData, TypedData, VoidData } from "./wgsl_ast.js";

type RuntimeStateCallbackType = () => void;

export class WgslDebug {
    _code: string;
    _exec: WgslExec;
    _execStack: ExecStack;
    _dispatchId: number[];
    _runTimer: any = null;
    breakpoints: Set<number> = new Set();
    runStateCallback: RuntimeStateCallbackType | null = null;

    constructor(code: string, runStateCallback?: RuntimeStateCallbackType) {
        this._code = code;
        const parser = new WgslParser();
        const ast = parser.parse(code);
        this._exec = new WgslExec(ast);
        this.runStateCallback = runStateCallback ?? null
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

    get currentState(): StackFrame | null {
        while (true) {
            if (this._execStack.isEmpty) {
                return null;
            }

            let state = this._execStack.last;
            if (state === null) {
                return null;
            }

            if (state.isAtEnd) {
                this._execStack.pop();
                if (this._execStack.isEmpty) {
                    return null;
                }
                state = this._execStack.last;
            }

            return state;
        }
    }

    get currentCommand(): Command | null {
        while (true) {
            if (this._execStack.isEmpty) {
                return null;
            }

            let state = this._execStack.last;
            if (state === null) {
                return null;
            }

            if (state.isAtEnd) {
                this._execStack.pop();
                if (this._execStack.isEmpty) {
                    return null;
                }
                state = this._execStack.last;
            }

            const command = state.getCurrentCommand();
            if (command === null) {
                continue;
            }

            return command;
        }
    }

    toggleBreakpoint(line: number) {
        if (this.breakpoints.has(line)) {
            this.breakpoints.delete(line);
        } else {
            this.breakpoints.add(line);
        }
    }

    clearBreakpoints() {
        this.breakpoints.clear();
    }

    get isRunning() {
        return this._runTimer !== null;
    }

    run() {
        if (this.isRunning) {
            return;
        }
        this._runTimer = setInterval(() => {
            const command = this.currentCommand;
            if (command) {
                if (this.breakpoints.has(command.line)) {
                    clearInterval(this._runTimer!);
                    this._runTimer = null;
                    if (this.runStateCallback !== null) {
                        this.runStateCallback();
                    }
                    return;
                }
            }
            if (!this.stepNext(true)) {
                clearInterval(this._runTimer!);
                this._runTimer = null;
                if (this.runStateCallback !== null) {
                    this.runStateCallback();
                }
            }
        }, 0);
        if (this.runStateCallback !== null) {
            this.runStateCallback();
        }
    }

    pause() {
        if (this._runTimer !== null) {
            clearInterval(this._runTimer);
            this._runTimer = null;
            if (this.runStateCallback !== null) {
                this.runStateCallback();
            }
        }
    }

    _setOverrides(constants: Object, context: ExecContext): void {
        for (const k in constants) {
            const v = constants[k];
            const override = this._exec.reflection.getOverrideInfo(k);
            if (override !== null) {
                if (override.type === null) {
                    override.type = this._exec.getTypeInfo("u32");
                }
                if (override.type.name === "u32" || override.type.name === "i32" || override.type.name === "f32" || override.type.name === "f16") {
                    context.setVariable(k, new ScalarData(v, override.type));
                } else if (override.type.name === "bool") {
                    context.setVariable(k, new ScalarData(v ? 1 : 0, override.type));
                } else if (override.type.name === "vec2" || override.type.name === "vec3" || override.type.name === "vec4" ||
                    override.type.name === "vec2f" || override.type.name === "vec3f" || override.type.name === "vec4f" ||
                    override.type.name === "vec2i" || override.type.name === "vec3i" || override.type.name === "vec4i" ||
                    override.type.name === "vec2u" || override.type.name === "vec3u" || override.type.name === "vec4u" ||
                    override.type.name === "vec2h" || override.type.name === "vec3h" || override.type.name === "vec4h") {
                    context.setVariable(k, new VectorData(v, override.type));
                } else {
                    console.error(`Invalid constant type for ${k}`);
                }
            } else {
                console.error(`Override ${k} does not exist in the shader.`);
            }
        }
    }

    debugWorkgroup(kernel: string, dispatchId: number[], 
        dispatchCount: number | number[], bindGroups: Object, config?: Object): boolean {

        this._execStack = new ExecStack();

        const context = this._exec.context;
        context.currentFunctionName = kernel;

        this._dispatchId = dispatchId;

        config = config ?? {};
        if (config["constants"]) {
            this._setOverrides(config["constants"], context);
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
                        if (binding == b && set == s) {
                            let found = false;
                            for (const resource of kernelRefl.resources) {
                                if (resource.name === v.name && resource.group === parseInt(set) && resource.binding === parseInt(binding)) {
                                    found = true;
                                    break;
                                }
                            }
                            if (found) {
                                let typeInfo = this._exec.getTypeInfo(node.type);
                                if (entry.texture !== undefined && entry.descriptor !== undefined) {
                                    // Texture
                                    v.value = new TextureData(entry.texture, typeInfo, entry.descriptor,
                                        entry.texture.view ?? null);
                                } else if (entry.uniform !== undefined) {
                                    // Uniform buffer
                                    v.value = new TypedData(entry.uniform, typeInfo);
                                } else {
                                    if (typeInfo.isStruct || typeInfo.isArray) {
                                        // Storage buffer
                                        v.value = new TypedData(entry, typeInfo);
                                    } else {
                                        // all other types
                                        // trashy, create an array size one and pull the first element, couldn't find a better way to support a ton of types.
                                        const arrayType = new ArrayType(`array<${node.type.name}>`, [], node.type, 1)
                                        // noinspection TypeScriptValidateTypes
                                        const index = new ArrayIndex(0);
                                        v.value = new TypedData(entry, this._exec.getTypeInfo(arrayType)).getSubData(null, index, null);
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }

        let found = false;
        for (let z = 0; z < depth && !found; ++z) {
            for (let y = 0; y < height && !found; ++y) {
                for (let x = 0; x < width && !found; ++x) {
                    context.setVariable("@workgroup_id", new VectorData([x, y, z], vec3u));
                    if (this._dispatchWorkgroup(kernelFn, [x, y, z], context)) {
                        found = true;
                        break;
                    }
                }
            }
        }

        return found;
    }

    _shouldExecuteNextCommand(): boolean {
        const command = this.currentCommand;
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

    stepInto() {
        if (this.isRunning) {
            return;
        }
        this.stepNext(true);
    }

    stepOver() {
        if (this.isRunning) {
            return;
        }
        this.stepNext(false);
    }

    stepOut() {
        const state = this.currentState;
        if (state === null) {
            return;
        }
        const parentState = state.parent;

        if (this.isRunning) {
            clearInterval(this._runTimer);
            this._runTimer = null;
        }

        this._runTimer = setInterval(() => {
            const command = this.currentCommand;
            if (command) {
                if (this.breakpoints.has(command.line)) {
                    clearInterval(this._runTimer!);
                    this._runTimer = null;
                    if (this.runStateCallback !== null) {
                        this.runStateCallback();
                    }
                    return;
                }
            }
            if (!this.stepNext(true)) {
                clearInterval(this._runTimer!);
                this._runTimer = null;
                if (this.runStateCallback !== null) {
                    this.runStateCallback();
                }
            }

            const state = this.currentState;
            if (state === parentState) {
                clearInterval(this._runTimer!);
                this._runTimer = null;
                if (this.runStateCallback !== null) {
                    this.runStateCallback();
                }
            }
        }, 0);
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

        while (true) {
            if (this._execStack.isEmpty) {
                return false;
            }

            let state = this._execStack.last;
            if (state === null) {
                return false;
            }

            if (state.isAtEnd) {
                this._execStack.pop();
                if (this._execStack.isEmpty) {
                    return false;
                }
                state = this._execStack.last;
            }

            const command = state!.getNextCommand();
            if (command === null) {
                continue;
            }

            if (stepInto && command instanceof CallExprCommand) {
                const node = command.node;
                const fn = state.context.getFunction(node.name);
                if (!fn) {
                    continue; // it's not a custom function, step over it
                }
                const fnState = this._createState(fn.node.body, state.context.clone(), state);

                for (let ai = 0; ai < fn.node.args.length; ++ai) {
                    const arg = fn.node.args[ai];
                    const value = this._exec.evalExpression(node.args[ai], fnState.context);
                    fnState.context.createVariable(arg.name, value, arg);
                }

                fnState.parentCallExpr = node;
                this._execStack.states.push(fnState);
                fnState.context.currentFunctionName = fn.name;

                if (this._shouldExecuteNextCommand()) {
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

                        this._execStack.states.push(fnState);
                        fnState.context.currentFunctionName = fn.name;

                        if (this._shouldExecuteNextCommand()) {
                            continue;
                        }
                        return true;
                    }
                }

                const res = this._exec.execStatement(node, state.context);
                if (res !== null && res !== undefined && !(res instanceof VoidData)) {
                    let s = state;
                    // Find the CallExpr to store the return value in.
                    while (s) {
                        if (s.parentCallExpr) {
                            s.parentCallExpr.setCachedReturnValue(res);
                            break;
                        }
                        s = s.parent;
                    }
                    if (s === null) {
                        console.error("Could not find CallExpr to store return value in");
                    }
                    if (this._shouldExecuteNextCommand()) {
                        continue;
                    }
                    return true;
                }
            } else if (command instanceof ContinueTargetCommand) {
                continue;
            } else if (command instanceof BreakTargetCommand) {
                continue;
            } else if (command instanceof ContinueCommand) {
                const targetId = command.id;
                while (!this._execStack.isEmpty) {
                    state = this._execStack.last;
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
                    this._execStack.pop();
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
                        if (this._shouldExecuteNextCommand()) {
                            continue;
                        }
                        return true;
                    }
                }

                while (!this._execStack.isEmpty) {
                    state = this._execStack.last;
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
                    this._execStack.pop();
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
                        if (this._shouldExecuteNextCommand()) {
                            continue;
                        }
                        return true;
                    }
                }
                state.current = command.position;
                if (this._shouldExecuteNextCommand()) {
                    continue;
                }
                return true;
            } else if (command instanceof BlockCommand) {
                const blockState = this._createState(command.statements, state.context.clone(), state);
                this._execStack.states.push(blockState);
                continue; // step into the first statement of the block
            }

            if (state.isAtEnd) {
                this._execStack.pop();
                if (this._execStack.isEmpty) {
                    return false;
                }
            }

            if (this._shouldExecuteNextCommand()) {
                continue;
            }
            return true;
        }
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

        let found = false;
        for (let z = 0, li = 0; z < depth && !found; ++z) {
            for (let y = 0; y < height && !found; ++y) {
                for (let x = 0; x < width && !found; ++x, ++li) {
                    const local_invocation_id = [x, y, z];
                    const global_invocation_id = [
                        x + workgroup_id[0] * workgroupSize[0],
                        y + workgroup_id[1] * workgroupSize[1],
                        z + workgroup_id[2] * workgroupSize[2]];

                    context.setVariable("@local_invocation_id", new VectorData(local_invocation_id, vec3u));
                    context.setVariable("@global_invocation_id", new VectorData(global_invocation_id, vec3u));
                    context.setVariable("@local_invocation_index", new ScalarData(li, u32));

                    if (global_invocation_id[0] === this._dispatchId[0] &&
                        global_invocation_id[1] === this._dispatchId[1] &&
                        global_invocation_id[2] === this._dispatchId[2]) {
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

        for (const statement of ast) {
            // A statement may have expressions that include function calls.
            // Gather all of the internal function calls from the statement.
            // We can then include them as commands to step through, storing their
            // values with the call node so that when it is evaluated, it uses that
            // already computed value. This allows us to step into the function
            if (statement instanceof AST.Let ||
                statement instanceof AST.Var ||
                statement instanceof AST.Const ||
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
                const f = new FunctionRef(statement);
                state.context.functions.set(statement.name, f);
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
            } else if (statement instanceof AST.Struct) {
                // nothing to do
            } else {
                console.error(`TODO: statement type ${statement.constructor.name}`);
            }
        }

        return state;
    }

    _collectFunctionCalls(node: AST.Expression, functionCalls: AST.CallExpr[]) {
        if (node instanceof AST.CallExpr) {
            if (node.args) {
                for (const arg of node.args) {
                    this._collectFunctionCalls(arg, functionCalls);
                }
            }
            // Only collect custom function calls, not built-in functions.
            if (!node.isBuiltin) {
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
