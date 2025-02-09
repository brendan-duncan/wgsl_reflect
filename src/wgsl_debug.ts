import * as AST from "./wgsl_ast.js";
import { WgslExec } from "./wgsl_exec.js";
import { ExecContext, Function } from "./exec/exec_context.js";
import { TypedData } from "./exec/data.js";

class Command {
    get line() { return -1; }
}

class StatementCommand extends Command {
    node: AST.Node;

    constructor(node: AST.Node) {
        super();
        this.node = node;
    }

    get line() { return this.node.line; }
}

class CallExprCommand extends Command {
    node: AST.CallExpr;
    statement: AST.Node;

    constructor(node: AST.CallExpr, statement: AST.Node) {
        super();
        this.node = node;
        this.statement = statement;
    }

    get line() { return this.statement.line; }
}

class GotoCommand extends Command {
    static kLoopTarget = -1;
    static kContinue = -2;

    condition: AST.Node | null;
    position: number;

    constructor(condition: AST.Node | null, position: number) {
        super();
        this.condition = condition;
        this.position = position;
    }

    get line() {
        return this.condition?.line ?? -1;
    }
}

class BlockCommand extends Command {
    statements: Array<AST.Node> = [];

    constructor(statements: Array<AST.Node>) {
      super();
      this.statements = statements;
    }

    get line() {
      return this.statements.length > 0 ? this.statements[0].line : -1;
    }
}

export class ExecState {
    parent: ExecState | null = null;
    context: ExecContext;
    commands: Array<Command> = [];
    current: number = 0;
    parentCallExpr: AST.CallExpr | null = null;

    constructor(context: ExecContext, parent?: ExecState) {
        this.context = context;
        this.parent = parent ?? null;
    }

    get isAtEnd(): boolean { return this.current >= this.commands.length; }

    getNextCommand(): Command | null {
        if (this.current >= this.commands.length) {
            return null;
        }
        const command = this.commands[this.current];
        this.current++;
        return command;
    }

    getCurrentCommand(): Command | null {
        if (this.current >= this.commands.length) {
            return null;
        }
        return this.commands[this.current];
    }
}

class ExecStack {
    states: Array<ExecState> = [];

    get isEmpty(): boolean { return this.states.length == 0; }

    get last(): ExecState | null { return this.states[this.states.length - 1] ?? null; }

    pop() {
        this.states.pop();
    }
}

export class WgslDebug {
    _exec: WgslExec;
    _execStack: ExecStack;
    _dispatchId: number[];

    constructor(code: string, context?: ExecContext) {
        this._exec = new WgslExec(code, context);
    }

    getVariableValue(name: string) {
        return this._exec.context.getVariableValue(name);
    }

    startDebug() {
        this._execStack = new ExecStack();
        const state = this._createState(this._exec.ast, this._exec.context);
        this._execStack.states.push(state);
    }

    get context(): ExecContext {
        return this._exec.context;
    }

    get currentState(): ExecState | null {
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

    debugWorkgroup(kernel: string, dispatchId: number[], 
        dispatchCount: number | number[], bindGroups: Object, config?: Object): boolean {

        this._execStack = new ExecStack();

        const context = this._exec.context;
        context.currentFunctionName = kernel;

        this._dispatchId = dispatchId;

        config = config ?? {};
        if (config["constants"]) {
            for (const k in config["constants"]) {
                const v = config["constants"][k];
                context.setVariable(k, v);
            }
        }

        // Use this to debug the top level statements, otherwise call _execStatements.
        /*const state = new _ExecState(this._exec.context);
        this._execStack.states.push(state);
        for (const statement of this._exec.ast) {
            state.commands.push(new Command(CommandType.Statement, statement));
        }*/
        this._exec._execStatements(this._exec.ast, context);

        const f = context.functions.get(kernel);
        if (!f) {
            console.error(`Function ${kernel} not found`);
            return false;
        }

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

        context.setVariable("@num_workgroups", dispatchCount);

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
                            if (entry.texture !== undefined && entry.size !== undefined) {
                                // Texture
                                v.value = new TypedData(entry.texture, this._exec._getTypeInfo(node.type), 0, entry.size);
                            } else if (entry.uniform !== undefined) {
                                // Uniform buffer
                                v.value = new TypedData(entry.uniform, this._exec._getTypeInfo(node.type));
                            } else {
                                // Storage buffer
                                v.value = new TypedData(entry, this._exec._getTypeInfo(node.type));
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
                    context.setVariable("@workgroup_id", [x, y, z]);
                    if (this._dispatchWorkgroup(f, [x, y, z], context)) {
                        found = true;
                        break;
                    }
                }
            }
        }

        return found;
    }

    _shouldExecuteNectCommand(): boolean {
        const command = this.currentCommand;
        if (command === null) {
            return false;
        }
        if (command instanceof GotoCommand) {
            if (command.condition === null) {
                return true;
            }
        }
        return false;
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
                const fn = state.context.functions.get(node.name);
                if (!fn) {
                    continue; // it's not a custom function, step over it
                }
                const fnState = this._createState(fn.node.body, state.context.clone(), state);

                for (let ai = 0; ai < fn.node.args.length; ++ai) {
                    const arg = fn.node.args[ai];
                    const value = this._exec._evalExpression(node.args[ai], fnState.context);
                    fnState.context.setVariable(arg.name, value, arg);
                }

                fnState.parentCallExpr = node;
                this._execStack.states.push(fnState);
                fnState.context.currentFunctionName = fn.name;

                if (this._shouldExecuteNectCommand()) {
                    continue;
                }
                return true;
            } else if (command instanceof StatementCommand) {
                const res = this._exec._execStatement(command.node, state.context);
                if (res !== null && res !== undefined) {
                    if (state.parent?.parentCallExpr) {
                        state.parent?.parentCallExpr?.setCachedReturnValue(res);
                    } else {
                        state.parentCallExpr?.setCachedReturnValue(res);
                    }
                    if (this._shouldExecuteNectCommand()) {
                        continue;
                    }
                    return true;
                }
            } else if (command instanceof GotoCommand) {
                // -1 is used as a marker for continue statements. Skip it.
                if (command.position === GotoCommand.kLoopTarget) {
                    continue; // continue to the next command
                }
                // -2 is used as a marker for continue statements. If we encounter it,
                // then we need to find the nearest proceding GotoCommand with a -1 position.
                if (command.position === GotoCommand.kContinue) {
                    while (!this._execStack.isEmpty) {
                        state = this._execStack.last;
                        for (let i = state.current; i >= 0; --i) {
                            const cmd = state.commands[i];
                            if (cmd instanceof GotoCommand) {
                                if (cmd.position === GotoCommand.kLoopTarget) {
                                    state.current = i + 1;
                                    return true;
                                }
                            }
                        }
                        // For loops can have the loop target ahead in the stack, for the
                        // increment command, so we need to search ahead as well.
                        for (let i = state.current; i < state.commands.length; ++i) {
                            const cmd = state.commands[i];
                            if (cmd instanceof GotoCommand) {
                                if (cmd.position === GotoCommand.kLoopTarget) {
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
                }
                if (command.condition) {
                    const res = this._exec._evalExpression(command.condition, state.context);
                    if (res) {
                        if (this._shouldExecuteNectCommand()) {
                            continue;
                        }
                        return true;
                    }
                }
                state.current = command.position;
                if (this._shouldExecuteNectCommand()) {
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

            if (this._shouldExecuteNectCommand()) {
                continue;
            }
            return true;
        }
    }

    _dispatchWorkgroup(f: Function, workgroup_id: number[], context: ExecContext): boolean {
        const workgroupSize = [1, 1, 1];
        for (const attr of f.node.attributes) {
            if (attr.name === "workgroup_size") {
                if (attr.value.length > 0) {
                    // The value could be an override constant
                    const v = context.getVariableValue(attr.value[0]);
                    if (v !== null) {
                        workgroupSize[0] = v;
                    } else {
                        workgroupSize[0] = parseInt(attr.value[0]);
                    }
                }
                if (attr.value.length > 1) {
                    const v = context.getVariableValue(attr.value[1]);
                    if (v !== null) {
                        workgroupSize[1] = v;
                    } else {
                        workgroupSize[1] = parseInt(attr.value[1]);
                    }
                }
                if (attr.value.length > 2) {
                    const v = context.getVariableValue(attr.value[2]);
                    if (v !== null) {
                        workgroupSize[2] = v;
                    } else {
                        workgroupSize[2] = parseInt(attr.value[2]);
                    }
                }
            }
        }

        context.setVariable("@workgroup_size", workgroupSize);

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

                    context.setVariable("@local_invocation_id", local_invocation_id);
                    context.setVariable("@global_invocation_id", global_invocation_id);
                    context.setVariable("@local_invocation_index", li);

                    if (global_invocation_id[0] === this._dispatchId[0] &&
                        global_invocation_id[1] === this._dispatchId[1] &&
                        global_invocation_id[2] === this._dispatchId[2]) {
                        found = true;
                        break;
                    }
                    //this._dispatchExec(f, context);
                }
            }
        }

        if (found) {
            this._dispatchExec(f, context);
        }

        return found;
    }

    _dispatchExec(f: Function, context: ExecContext) {
        // Update any built-in input args.
        // TODO: handle input structs.
        for (const arg of f.node.args) {
            for (const attr of arg.attributes) {
                if (attr.name === "builtin") {
                    const globalName = `@${attr.value}`;
                    const globalVar = context.getVariable(globalName);
                    if (globalVar !== undefined) {
                        context.variables.set(arg.name, globalVar);
                    }
                }
            }
        }

        const state = this._createState(f.node.body, context);
        this._execStack.states.push(state);
    }

    _createState(ast: Array<AST.Node>, context: ExecContext, parent?: ExecState): ExecState {
        const state = new ExecState(context, parent ?? null);

        for (const statement of ast) {
            // A statement may have expressions that include function calls.
            // Gather all of the internal function calls from the statement.
            // We can then include them as commands to step through, storing their
            // values with the call node so that when it is evaluated, it uses that
            // already computed value. This allows us to step into the function
            if (statement instanceof AST.Let ||
                statement instanceof AST.Var ||
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
                const f = new Function(statement);
                state.context.functions.set(statement.name, f);
                continue;
            } else if (statement instanceof AST.While) {
                const functionCalls = [];
                state.commands.push(new GotoCommand(null, GotoCommand.kLoopTarget));
                this._collectFunctionCalls(statement.condition, functionCalls);
                for (const call of functionCalls) {
                    state.commands.push(new CallExprCommand(call, statement));
                }
                const conditionCmd = new GotoCommand(statement.condition, 0);
                state.commands.push(conditionCmd);
                state.commands.push(new BlockCommand(statement.body));
                state.commands.push(new GotoCommand(statement.condition, 0));
                conditionCmd.position = state.commands.length;
            } else if (statement instanceof AST.If) {
                const functionCalls = [];
                this._collectFunctionCalls(statement.condition, functionCalls);
                for (const call of functionCalls) {
                    state.commands.push(new CallExprCommand(call, statement));
                }

                let conditionCmd = new GotoCommand(statement.condition, 0);
                state.commands.push(conditionCmd);
                state.commands.push(new BlockCommand(statement.body));
                const gotoEnd = new GotoCommand(null, 0);
                state.commands.push(gotoEnd);

                for (const elseIf of statement.elseif) {
                    conditionCmd.position = state.commands.length;

                    const functionCalls = [];
                    this._collectFunctionCalls(elseIf.condition, functionCalls);
                    for (const call of functionCalls) {
                        state.commands.push(new CallExprCommand(call, statement));
                    }

                    conditionCmd = new GotoCommand(elseIf.condition, 0);
                    state.commands.push(conditionCmd);
                    state.commands.push(new BlockCommand(elseIf.body));
                    state.commands.push(gotoEnd);
                }

                conditionCmd.position = state.commands.length;
                if (statement.else) {
                    state.commands.push(new BlockCommand(statement.else));
                }

                gotoEnd.position = state.commands.length;
            } else if (statement instanceof AST.For) {
                if (statement.init) {
                    state.commands.push(new StatementCommand(statement.init));
                }

                let conditionPos = state.commands.length;

                if (statement.increment === null) {
                    state.commands.push(new GotoCommand(null, GotoCommand.kLoopTarget));
                }
                let conditionCmd = null;
                if (statement.condition) {
                    const functionCalls = [];
                    this._collectFunctionCalls(statement.condition!, functionCalls);
                    for (const call of functionCalls) {
                        state.commands.push(new CallExprCommand(call, statement));
                    }
                    conditionCmd = new GotoCommand(statement.condition, 0);
                    state.commands.push(conditionCmd);
                }

                state.commands.push(new BlockCommand(statement.body));

                if (statement.increment) {
                    state.commands.push(new GotoCommand(null, GotoCommand.kLoopTarget));
                    state.commands.push(new StatementCommand(statement.increment));
                }
                state.commands.push(new GotoCommand(null, conditionPos));
                conditionCmd.position = state.commands.length;
            } else if (statement instanceof AST.Continue) {
                state.commands.push(new GotoCommand(null, GotoCommand.kContinue));
            } else {
                console.error(`TODO: statement type ${statement.constructor.name}`);
            }
        }

        return state;
    }

    _collectFunctionCalls(node: AST.Expression, functionCalls: Array<AST.CallExpr>) {
        if (node instanceof AST.CallExpr) {
            for (const arg of node.args) {
                this._collectFunctionCalls(arg, functionCalls);
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
        } else if (node instanceof AST.GroupingExpr) {
            for (const n of node.contents) {
                this._collectFunctionCalls(n, functionCalls);
            }
        } else if (node instanceof AST.CreateExpr) {
            for (const arg of node.args) {
                this._collectFunctionCalls(arg, functionCalls);
            }
        } else if (node instanceof AST.BitcastExpr) {
            this._collectFunctionCalls(node.value, functionCalls);
        } else if (node instanceof AST.ArrayIndex) {
            this._collectFunctionCalls(node.index, functionCalls);
        } else if (AST.LiteralExpr) {
        } else {
            console.error(`TODO: expression type ${node.constructor.name}`);
        }
    }
}
