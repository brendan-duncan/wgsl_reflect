import { Node, Type, Data } from "../wgsl_ast.js";
import { ExecContext } from "./exec_context.js";
import { TypeInfo } from "../wgsl_reflect.js";
export declare class ExecInterface {
    evalExpression(node: Node, context: ExecContext): Data | null;
    getTypeName(type: TypeInfo | Type): string;
    getTypeInfo(type: Type | string): TypeInfo | null;
    getVariableName(node: Node, context: ExecContext): string | null;
}
