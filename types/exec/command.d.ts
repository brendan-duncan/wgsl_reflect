import * as AST from "../wgsl_ast.js";
export declare class Command {
    get line(): number;
}
export declare class StatementCommand extends Command {
    node: AST.Node;
    constructor(node: AST.Node);
    get line(): number;
}
export declare class CallExprCommand extends Command {
    node: AST.CallExpr;
    statement: AST.Node;
    constructor(node: AST.CallExpr, statement: AST.Node);
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
    node: AST.Continue;
    constructor(id: number, node: AST.Continue);
    get line(): number;
}
export declare class BreakCommand extends Command {
    id: number;
    condition: AST.Expression | null;
    node: AST.Break;
    constructor(id: number, condition: AST.Expression | null, node: AST.Break);
    get line(): number;
}
export declare class GotoCommand extends Command {
    condition: AST.Node | null;
    position: number;
    lineNo: number;
    constructor(condition: AST.Node | null, position: number, line: number);
    get line(): number;
}
export declare class BlockCommand extends Command {
    statements: Array<AST.Node>;
    constructor(statements: Array<AST.Node>);
    get line(): number;
}
