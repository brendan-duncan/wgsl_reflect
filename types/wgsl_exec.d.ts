import * as AST from "./wgsl_ast.js";
import { WgslReflect, TypeInfo } from "./wgsl_reflect.js";
declare class Data {
    buffer: ArrayBuffer;
    typeInfo: TypeInfo;
    offset: number;
    textureSize: number[];
    constructor(data: ArrayBuffer | Float32Array | Uint32Array | Int32Array | Uint8Array | Int8Array, typeInfo: TypeInfo, offset?: number, textureSize?: number[]);
}
type ASTVarNode = AST.Let | AST.Var | AST.Argument;
declare class Var {
    name: string;
    value: any;
    node: ASTVarNode | null;
    constructor(n: string, v: any, node: ASTVarNode | null);
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
    setVariable(name: string, value: any, node?: ASTVarNode): void;
    getVariableValue(name: string): any;
    clone(): ExecContext;
}
export declare class WgslExec {
    ast: Array<AST.Node>;
    context: ExecContext;
    reflection: WgslReflect;
    constructor(code: string, context?: ExecContext);
    getVariableValue(name: string): any;
    execute(config?: Object): void;
    dispatchWorkgroups(kernel: string, dispatchCount: number | number[], bindGroups: Object, config?: Object): void;
    _dispatchWorkgroup(f: Function, workgroup_id: number[], bindGroups: Object, context: ExecContext): void;
    _dispatchExec(f: Function, context: ExecContext): void;
    _execStatements(statements: Array<AST.Node>, context: ExecContext): any;
    _execStatement(stmt: AST.Node, context: ExecContext): any;
    _getVariableName(node: AST.Node, context: ExecContext): string;
    _assign(node: AST.Assign, context: ExecContext): void;
    _function(node: AST.Function, context: ExecContext): void;
    _const(node: AST.Const, context: ExecContext): void;
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
    _callArrayLength(node: AST.CallExpr, context: ExecContext): any;
    _callConstructorValue(node: AST.CallExpr | AST.CreateExpr, context: ExecContext): any;
    _callConstructorArray(node: AST.CallExpr | AST.CreateExpr, context: ExecContext): any[];
    _callConstructorVec(node: AST.CallExpr | AST.CreateExpr, context: ExecContext): any[];
    _callConstructorMatrix(node: AST.CallExpr | AST.CreateExpr, context: ExecContext): any[];
    _callAny(node: AST.CallExpr, context: ExecContext): any;
    _callAll(node: AST.CallExpr, context: ExecContext): boolean;
    _callSelect(node: AST.CallExpr, context: ExecContext): boolean;
    _callTextureDimensions(node: AST.CallExpr, context: ExecContext): number[];
    _getTypeInfo(type: AST.Type): TypeInfo;
    _getTypeName(type: TypeInfo | AST.Type): string;
    _setDataValue(data: Data, value: any, postfix: AST.Expression | null, context: ExecContext): void;
    _setData(data: Data, value: any, typeInfo: TypeInfo, offset: number, context: ExecContext): void;
    _getDataValue(data: Data, postfix: AST.Expression | null, context: ExecContext): any;
}
export {};
