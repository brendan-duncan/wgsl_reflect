import * as AST from "./wgsl_ast.js";
import { WgslExec } from "./wgsl_exec.js";
import { ExecContext, FunctionRef } from "./exec/exec_context.js";
import { Command } from "./exec/command.js";
import { StackFrame } from "./exec/stack_frame.js";
import { ExecStack } from "./exec/exec_stack.js";
type RuntimeStateCallbackType = () => void;
interface BindingEntry {
    texture?: {
        view?: unknown;
    };
    descriptor?: unknown;
    uniform?: ArrayBuffer;
}
export declare class WgslDebug {
    private _code;
    private _exec;
    private _execStack;
    private _dispatchId;
    private _runTimer;
    runSliceSize: number;
    readonly breakpoints: Set<number>;
    runStateCallback: RuntimeStateCallbackType | null;
    private _commandCache;
    constructor(code: string, runStateCallback?: RuntimeStateCallbackType);
    getVariableValue(name: string): number | number[] | null;
    reset(): void;
    startDebug(): void;
    get context(): ExecContext;
    private _resolveState;
    private _resolveCurrentState;
    get currentState(): StackFrame | null;
    get currentCommand(): Command | null;
    toggleBreakpoint(line: number): void;
    clearBreakpoints(): void;
    get isRunning(): boolean;
    private _stopRunning;
    run(): void;
    pause(): void;
    _setOverrides(constants: Record<string, unknown>, context: ExecContext): void;
    debugWorkgroup(kernel: string, dispatchId: number[], dispatchCount: number | number[], bindGroups: Record<string, Record<string, BindingEntry>>, config?: Record<string, unknown>): boolean;
    _shouldExecuteNextCommand(stack?: ExecStack): boolean;
    stepInto(): void;
    stepOver(): void;
    stepOut(): void;
    stepNext(stepInto?: boolean): boolean;
    stepStack(stack: ExecStack, stepInto?: boolean): boolean;
    get exec(): WgslExec;
    applyOverrides(constants: Record<string, unknown>, context: ExecContext): void;
    createStackFrame(body: AST.Node[], context: ExecContext, parent?: StackFrame): StackFrame;
    _dispatchWorkgroup(f: FunctionRef, workgroup_id: number[], context: ExecContext): boolean;
    _dispatchExec(f: FunctionRef, context: ExecContext): void;
    _createState(ast: AST.Node[], context: ExecContext, parent?: StackFrame): StackFrame;
    _collectFunctionCalls(node: AST.Expression, functionCalls: AST.CallExpr[]): void;
}
export {};
