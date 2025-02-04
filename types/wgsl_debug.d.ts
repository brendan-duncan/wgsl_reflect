import * as AST from "./wgsl_ast.js";
import { WgslExec } from "./wgsl_exec.js";
import { ExecContext, Function } from "./exec/exec_context.js";
export declare enum CommandType {
    Statement = 0
}
export declare class Command {
    type: CommandType;
    data: AST.Node | number | null;
    constructor(type: CommandType, data?: AST.Node | number | null);
    get isStatement(): boolean;
    get node(): AST.Node;
    get position(): number;
}
declare class _ExecState {
    context: ExecContext;
    commands: Array<Command>;
    current: number;
    constructor(context: ExecContext);
    get isAtEnd(): boolean;
    getNextCommand(): Command | null;
    getCurrentCommand(): Command | null;
}
declare class _ExecStack {
    states: Array<_ExecState>;
    get isEmpty(): boolean;
    get last(): _ExecState | null;
    pop(): void;
}
export declare class WgslDebug {
    _exec: WgslExec;
    _execStack: _ExecStack;
    _dispatchId: number[];
    constructor(code: string, context?: ExecContext);
    getVariableValue(name: string): any;
    startDebug(): void;
    debugWorkgroup(kernel: string, dispatchId: number[], dispatchCount: number | number[], bindGroups: Object, config?: Object): boolean;
    _dispatchWorkgroup(f: Function, workgroup_id: number[], context: ExecContext): boolean;
    _dispatchExec(f: Function, context: ExecContext): void;
    _collectFunctionCommands(ast: Array<AST.Node>, state: _ExecState): void;
    _collectFunctionCalls(node: AST.Expression, functionCalls: Array<AST.CallExpr>): void;
    currentCommand(): Command | null;
    stepNext(stepInto?: boolean): boolean;
}
export {};
