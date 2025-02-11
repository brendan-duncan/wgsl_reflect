import * as AST from "./wgsl_ast.js";
import { WgslExec } from "./wgsl_exec.js";
import { ExecContext, Function } from "./exec/exec_context.js";
declare class Command {
    get line(): number;
}
export declare class StackFrame {
    parent: StackFrame | null;
    context: ExecContext;
    commands: Array<Command>;
    current: number;
    parentCallExpr: AST.CallExpr | null;
    constructor(context: ExecContext, parent?: StackFrame);
    get isAtEnd(): boolean;
    getNextCommand(): Command | null;
    getCurrentCommand(): Command | null;
}
declare class ExecStack {
    states: Array<StackFrame>;
    get isEmpty(): boolean;
    get last(): StackFrame | null;
    pop(): void;
}
type RuntimeStateCallbackType = () => void;
export declare class WgslDebug {
    _code: string;
    _exec: WgslExec;
    _execStack: ExecStack;
    _dispatchId: number[];
    _runTimer: number | null;
    breakpoints: Set<number>;
    runStateCallback: RuntimeStateCallbackType | null;
    constructor(code: string, runStateCallback?: RuntimeStateCallbackType);
    getVariableValue(name: string): number | number[] | null;
    reset(): void;
    startDebug(): void;
    get context(): ExecContext;
    get currentState(): StackFrame | null;
    get currentCommand(): Command | null;
    toggleBreakpoint(line: number): void;
    clearBreakpoints(): void;
    get isRunning(): boolean;
    run(): void;
    pause(): void;
    debugWorkgroup(kernel: string, dispatchId: number[], dispatchCount: number | number[], bindGroups: Object, config?: Object): boolean;
    _shouldExecuteNectCommand(): boolean;
    stepInto(): void;
    stepOver(): void;
    stepOut(): void;
    stepNext(stepInto?: boolean): boolean;
    _dispatchWorkgroup(f: Function, workgroup_id: number[], context: ExecContext): boolean;
    _dispatchExec(f: Function, context: ExecContext): void;
    _createState(ast: Array<AST.Node>, context: ExecContext, parent?: StackFrame): StackFrame;
    _collectFunctionCalls(node: AST.Expression, functionCalls: Array<AST.CallExpr>): void;
}
export {};
