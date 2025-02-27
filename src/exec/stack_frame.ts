import { Command } from "./command.js";
import { CallExpr } from "../wgsl_ast.js";
import { ExecContext } from "./exec_context.js";

export class StackFrame {
    parent: StackFrame | null = null;
    context: ExecContext;
    commands: Command[] = [];
    current: number = 0;
    parentCallExpr: CallExpr | null = null;

    constructor(context: ExecContext, parent?: StackFrame) {
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
