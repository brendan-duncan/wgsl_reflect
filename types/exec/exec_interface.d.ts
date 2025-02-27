import { Node, Type } from "../wgsl_ast.js";
import { ExecContext } from "./exec_context.js";
import { TypeInfo } from "../wgsl_reflect.js";
import { Data } from "../wgsl_ast.js";
export declare class ExecInterface {
    evalExpression(node: Node, context: ExecContext): Data | null;
    getTypeInfo(type: Type | string): TypeInfo | null;
    getVariableName(node: Node, context: ExecContext): string | null;
}
