import * as AST from "./wgsl_ast.js";
declare class Var {
    name: string;
    value: any;
    constructor(n: string, v: any);
}
declare class ExecContext {
    variables: Map<string, Var>;
}
export declare class WgslExec {
    ast: Array<AST.Node>;
    context: ExecContext;
    constructor(ast: Array<AST.Node>);
    getVariableValue(name: string): any;
    exec(): void;
    _execStatement(stmt: AST.Node): void;
    _let(node: AST.Let): void;
    _evalExpression(node: AST.Node): any;
    _evalLiteral(node: AST.LiteralExpr): number;
    _evalVariable(node: AST.VariableExpr): any;
    _evalBinaryOp(node: AST.BinaryOperator): any;
}
export {};
