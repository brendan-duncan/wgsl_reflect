import * as AST from "./wgsl_ast.js";
import { WgslReflect, TypeInfo } from "./wgsl_reflect.js";
declare class Data {
    type: AST.Type;
    buffer: ArrayBuffer;
    typeInfo: TypeInfo;
    constructor(type: AST.Type, data: ArrayBuffer | Float32Array | Uint32Array | Int32Array | Uint8Array | Int8Array, reflection?: WgslReflect);
}
declare class Var {
    name: string;
    value: any;
    node: AST.Let | AST.Var | AST.Argument;
    constructor(n: string, v: any, node: AST.Let | AST.Var | AST.Argument);
    clone(): Var;
    getValue(): any;
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
    reflection: WgslReflect;
    constructor(code: string, context?: ExecContext);
    getVariableValue(name: string): any;
    dispatchWorkgroups(kernel: string, dispatchCount: number | number[], bindGroups: Object, config?: Object): void;
    _dispatchWorkgroup(f: Function, workgroup_id: number[], bindGroups: Object, context: ExecContext): void;
    _dispatchExec(f: Function, context: ExecContext): void;
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
    _evalCreate(node: AST.CreateExpr, context: ExecContext): any;
    _evalLiteral(node: AST.LiteralExpr, context: ExecContext): number;
    _getArraySwizzle(value: any, member: string): any;
    _evalVariable(node: AST.VariableExpr, context: ExecContext): any;
    _evalBinaryOp(node: AST.BinaryOperator, context: ExecContext): any;
    _evalCall(node: AST.CallExpr, context: ExecContext): any;
    _callIntrinsicFunction(node: AST.CallExpr, context: ExecContext): any;
    _callIntrinsicAny(node: AST.CallExpr, context: ExecContext): any;
    _callIntrinsicAll(node: AST.CallExpr, context: ExecContext): any;
    _getTypeName(type: TypeInfo): string;
    _setDataValue(data: Data, value: any, postfix: AST.Expression | null, context: ExecContext): void;
    _getDataValue(data: Data, postfix: AST.Expression | null, context: ExecContext): any;
}
export {};
