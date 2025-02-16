import { Node, CallExpr, Continue, Expression, Break } from "../wgsl_ast.js";
export declare class Command {
    get line(): number;
}
export declare class StatementCommand extends Command {
    node: Node;
    constructor(node: Node);
    get line(): number;
}
export declare class CallExprCommand extends Command {
    node: CallExpr;
    statement: Node;
    constructor(node: CallExpr, statement: Node);
    get line(): number;
}
export declare class ContinueTargetCommand extends Command {
    id: number;
    constructor(id: number);
}
export declare class BreakTargetCommand extends Command {
    id: number;
    constructor(id: number);
}
export declare class ContinueCommand extends Command {
    id: number;
    node: Continue;
    constructor(id: number, node: Continue);
    get line(): number;
}
export declare class BreakCommand extends Command {
    id: number;
    condition: Expression | null;
    node: Break;
    constructor(id: number, condition: Expression | null, node: Break);
    get line(): number;
}
export declare class GotoCommand extends Command {
    condition: Node | null;
    position: number;
    lineNo: number;
    constructor(condition: Node | null, position: number, line: number);
    get line(): number;
}
export declare class BlockCommand extends Command {
    statements: Array<Node>;
    constructor(statements: Array<Node>);
    get line(): number;
}
