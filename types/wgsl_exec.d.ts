import * as AST from "./wgsl_ast.js";
import { WgslReflect, TypeInfo } from "./wgsl_reflect.js";
import { ExecContext, Function } from "./exec/exec_context.js";
import { ExecInterface } from "./exec/exec_interface.js";
import { BuiltinFunctions } from "./exec/builtin_functions.js";
import { Data } from "./exec/data.js";
declare enum _CommandType {
    Break = 0,
    Goto = 1,
    Statement = 2
}
declare class _Command {
    type: _CommandType;
    data: AST.Node | number | null;
    constructor(type: _CommandType, data?: AST.Node | number | null);
    get node(): AST.Node;
    get position(): number;
}
declare class _ExecState {
    context: ExecContext;
    commands: Array<_Command>;
    current: number;
    constructor(context: ExecContext);
    get isAtEnd(): boolean;
    getNextCommand(): _Command;
}
declare class _ExecStack {
    states: Array<_ExecState>;
    get isEmpty(): boolean;
    get last(): _ExecState;
    pop(): void;
}
export declare class WgslExec extends ExecInterface {
    ast: Array<AST.Node>;
    context: ExecContext;
    reflection: WgslReflect;
    builtins: BuiltinFunctions;
    constructor(code: string, context?: ExecContext);
    _execStack: _ExecStack;
    initDebug(): void;
    stepNextCommand(): boolean;
    getVariableValue(name: string): any;
    execute(config?: Object): void;
    dispatchWorkgroups(kernel: string, dispatchCount: number | number[], bindGroups: Object, config?: Object): void;
    _dispatchWorkgroup(f: Function, workgroup_id: number[], context: ExecContext): void;
    _dispatchExec(f: Function, context: ExecContext): void;
    _getTypeInfo(type: AST.Type): TypeInfo;
    _getTypeName(type: TypeInfo | AST.Type): string;
    _setDataValue(data: Data, value: any, postfix: AST.Expression | null, context: ExecContext): void;
    _setData(data: Data, value: any, typeInfo: TypeInfo, offset: number, context: ExecContext): void;
    _getDataValue(data: Data, postfix: AST.Expression | null, context: ExecContext): any;
    _getVariableName(node: AST.Node, context: ExecContext): string;
    _execStatements(statements: Array<AST.Node>, context: ExecContext): any;
    _execStatement(stmt: AST.Node, context: ExecContext): any;
    _increment(node: AST.Increment, context: ExecContext): any;
    _assign(node: AST.Assign, context: ExecContext): void;
    _function(node: AST.Function, context: ExecContext): void;
    _const(node: AST.Const, context: ExecContext): void;
    _let(node: AST.Let, context: ExecContext): void;
    _var(node: AST.Var, context: ExecContext): void;
    _if(node: AST.If, context: ExecContext): any;
    _for(node: AST.For, context: ExecContext): any;
    _while(node: AST.While, context: ExecContext): any;
    _evalExpression(node: AST.Node, context: ExecContext): any;
    _evalConst(node: AST.ConstExpr, context: ExecContext): any;
    _evalCreate(node: AST.CreateExpr, context: ExecContext): any;
    _evalLiteral(node: AST.LiteralExpr, context: ExecContext): number;
    _getArraySwizzle(value: any, member: string): any;
    _evalVariable(node: AST.VariableExpr, context: ExecContext): any;
    _evalBinaryOp(node: AST.BinaryOperator, context: ExecContext): any;
    _evalCall(node: AST.CallExpr, context: ExecContext): any;
    _callBuiltinFunction(node: AST.CallExpr, context: ExecContext): any;
    _callConstructorValue(node: AST.CreateExpr, context: ExecContext): any;
    _callConstructorArray(node: AST.CreateExpr, context: ExecContext): any[];
    _callConstructorVec(node: AST.CallExpr | AST.CreateExpr, context: ExecContext): any;
    _callConstructorMatrix(node: AST.CallExpr | AST.CreateExpr, context: ExecContext): any[];
}
export {};
