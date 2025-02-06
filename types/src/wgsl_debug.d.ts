import * as AST from "./wgsl_ast.js";
import { WgslExec } from "./wgsl_exec.js";
import { ExecContext, Function } from "./exec/exec_context.js";
declare class Command {
    get line(): number;
}
export declare class ExecState {
    parent: ExecState | null;
    context: ExecContext;
    commands: Array<Command>;
    current: number;
    parentCallExpr: AST.CallExpr | null;
    constructor(context: ExecContext, parent?: ExecState);
    get isAtEnd(): boolean;
    getNextCommand(): Command | null;
    getCurrentCommand(): Command | null;
}
declare class ExecStack {
    states: Array<ExecState>;
    get isEmpty(): boolean;
    get last(): ExecState | null;
    pop(): void;
}
export declare class WgslDebug {
    _exec: WgslExec;
    _execStack: ExecStack;
    _dispatchId: number[];
    constructor(code: string, context?: ExecContext);
    getVariableValue(name: string): any;
    startDebug(): void;
    get context(): ExecContext;
    get currentState(): ExecState | null;
    get currentCommand(): Command | null;
    debugWorkgroup(kernel: string, dispatchId: number[], dispatchCount: number | number[], bindGroups: Object, config?: Object): boolean;
    _shouldExecuteNectCommand(): boolean;
    stepNext(stepInto?: boolean): boolean;
    _dispatchWorkgroup(f: Function, workgroup_id: number[], context: ExecContext): boolean;
    _dispatchExec(f: Function, context: ExecContext): void;
    _createState(ast: Array<AST.Node>, context: ExecContext, parent?: ExecState): ExecState;
    _collectFunctionCalls(node: AST.Expression, functionCalls: Array<AST.CallExpr>): void;
}
export {};
