import * as AST from "./wgsl_ast.js";
declare class Var {
    name: string;
    value: any;
    constructor(n: string, v: any);
}
declare class Function {
    name: string;
    node: AST.Function;
    constructor(node: AST.Function);
}
declare class ExecContext {
    variables: Map<string, Var>;
    functions: Map<string, Function>;
    clone(): ExecContext;
}
export declare class WgslExec {
    ast: Array<AST.Node>;
    context: ExecContext;
    constructor(code: string);
    getVariableValue(name: string): any;
    exec(): void;
    _execStatements(statements: Array<AST.Node>, context: ExecContext): void;
    _execStatement(stmt: AST.Node, context: ExecContext): void;
    _function(node: AST.Function, context: ExecContext): void;
    _let(node: AST.Let, context: ExecContext): void;
    _evalExpression(node: AST.Node, context: ExecContext): any;
    _evalLiteral(node: AST.LiteralExpr, context: ExecContext): number;
    _evalVariable(node: AST.VariableExpr, context: ExecContext): any;
    _evalBinaryOp(node: AST.BinaryOperator, context: ExecContext): any;
    _evalCall(node: AST.CallExpr, context: ExecContext): void;
    _evalFunction(statements: Array<AST.Statement>, context: ExecContext): void;
}
export {};
