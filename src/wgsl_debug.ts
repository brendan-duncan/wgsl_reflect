import * as AST from "./wgsl_ast.js";
import { WgslExec } from "./wgsl_exec.js";
import { ExecContext, Function } from "./exec/exec_context.js";
import { Data } from "./exec/data.js";

export enum CommandType {
    Statement,
}

export class Command {
    type: CommandType;
    data: AST.Node | number | null;

    constructor(type: CommandType, data: AST.Node | number | null = null) {
        this.type = type;
        this.data = data;
    }

    get isStatement(): boolean { return this.type === CommandType.Statement; }

    get node(): AST.Node { return this.data as AST.Node; }

    get position(): number { return this.data as number; }
}

class _ExecState {
    context: ExecContext;
    commands: Array<Command> = [];
    current: number = 0;

    constructor(context: ExecContext) {
        this.context = context;
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

class _ExecStack {
    states: Array<_ExecState> = [];

    get isEmpty(): boolean { return this.states.length == 0; }

    get last(): _ExecState | null { return this.states[this.states.length - 1] ?? null; }

    pop() {
        this.states.pop();
    }
}

class _Dispatch {
    kernel: string = "";
    id: [number, number, number] = [0, 0, 0];
    bindGroups: Object | null = null;
    constants: Object | null = null;
}

export class WgslDebug {
    _exec: WgslExec;
    _execStack: _ExecStack;
    _dispatchId: number[];

    constructor(code: string, context?: ExecContext) {
        this._exec = new WgslExec(code, context);
    }

    getVariableValue(name: string) {
        return this._exec.context.getVariableValue(name);
    }

    startDebug() {
        this._execStack = new _ExecStack();
        const state = new _ExecState(this._exec.context);
        this._execStack.states.push(state);
        for (const statement of this._exec.ast) {
            state.commands.push(new Command(CommandType.Statement, statement));
        }
    }

    debugWorkgroup(kernel: string, dispatchId: number[], 
        dispatchCount: number | number[], bindGroups: Object, config?: Object): boolean {
        
        this._execStack = new _ExecStack();

        const context = this._exec.context;

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
                                v.value = new Data(entry.texture, this._exec._getTypeInfo(node.type), 0, entry.size);
                            } else if (entry.uniform !== undefined) {
                                // Uniform buffer
                                v.value = new Data(entry.uniform, this._exec._getTypeInfo(node.type));
                            } else {
                                // Storage buffer
                                v.value = new Data(entry, this._exec._getTypeInfo(node.type));
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

        const state = new _ExecState(context);
        this._execStack.states.push(state);
        for (const statement of f.node.body) {
            state.commands.push(new Command(CommandType.Statement, statement));
        }
    }

    currentCommand(): Command | null {
        let state = this._execStack.last;
        return state?.getCurrentCommand() ?? null;
    }

    stepInfo(): boolean {
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
            return false;
        }

        const res = this._exec._execStatement(command.node, state!.context);
        if (res !== null && res !== undefined) {
            return false;
        }

        if (state.isAtEnd) {
            this._execStack.pop();
            if (this._execStack.isEmpty) {
                return false;
            }
        }

        return true;
    }

    // Returns true if execution is not finished, false if execution is complete
    stepNext(): boolean {
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
            return false;
        }

        const res = this._exec._execStatement(command.node, state!.context);
        if (res !== null && res !== undefined) {
            return false;
        }

        if (state.isAtEnd) {
            this._execStack.pop();
            if (this._execStack.isEmpty) {
                return false;
            }
        }

        return true;
    }
}
