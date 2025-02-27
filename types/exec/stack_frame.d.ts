import { Command } from "./command.js";
import { CallExpr } from "../wgsl_ast.js";
import { ExecContext } from "./exec_context.js";
export declare class StackFrame {
    parent: StackFrame | null;
    context: ExecContext;
    commands: Command[];
    current: number;
    parentCallExpr: CallExpr | null;
    constructor(context: ExecContext, parent?: StackFrame);
    get isAtEnd(): boolean;
    getNextCommand(): Command | null;
    getCurrentCommand(): Command | null;
}
