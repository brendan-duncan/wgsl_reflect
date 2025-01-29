import * as AST from "./wgsl_ast.js";
declare class Var {
    name: string;
    value: any;
    node: AST.Let | AST.Var | AST.Argument;
    constructor(n: string, v: any, node: AST.Let | AST.Var | AST.Argument);
    clone(): Var;
}
declare class Function {
    name: string;
    node: AST.Function;
    constructor(node: AST.Function);
    clone(): Function;
}
declare class ExecContext {
    variables: Map<string, Var>;
    functions: Map<string, Function>;
    getVariableValue(name: string): any;
    clone(): ExecContext;
}
export declare class WgslExec {
    ast: Array<AST.Node>;
    context: ExecContext;
    constructor(code: string);
    getVariableValue(name: string): any;
    exec(context?: ExecContext): void;
    execFunction(functionName: string, args: Array<any>, context?: ExecContext): any;
    dispatchWorkgroups(kernel: string, dispatchCount: [number, number, number], bindGroups: Object, context?: ExecContext): void;
    dispatch(kernel: string, dispatch: [number, number, number], bindGroups: Object, context?: ExecContext): void;
    _dispatchExec(kernel: string, dispatch: [number, number, number], bindGroups: Object, context: ExecContext): void;
    _execStatements(statements: Array<AST.Node>, context: ExecContext): any;
    _execStatement(stmt: AST.Node, context: ExecContext): any;
    _getVariableName(node: AST.Node, context: ExecContext): string;
    _assign(node: AST.Assign, context: ExecContext): void;
    _function(node: AST.Function, context: ExecContext): void;
    _let(node: AST.Let, context: ExecContext): void;
    _var(node: AST.Var, context: ExecContext): void;
    _if(node: AST.If, context: ExecContext): any;
    _for(node: AST.For, context: ExecContext): any;
    _while(node: AST.While, context: ExecContext): any;
    _evalExpression(node: AST.Node, context: ExecContext): any;
    _evalLiteral(node: AST.LiteralExpr, context: ExecContext): number;
    _evalVariable(node: AST.VariableExpr, context: ExecContext): any;
    _evalBinaryOp(node: AST.BinaryOperator, context: ExecContext): any;
    _evalCall(node: AST.CallExpr, context: ExecContext): any;
}
export {};
