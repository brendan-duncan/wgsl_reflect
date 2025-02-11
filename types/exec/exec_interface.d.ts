import * as AST from "../wgsl_ast.js";
import { ExecContext } from "./exec_context.js";
import { TypeInfo } from "../wgsl_reflect.js";
import { Data } from "./data.js";
export declare class ExecInterface {
    evalExpression(node: AST.Node, context: ExecContext): Data | null;
    getTypeName(type: TypeInfo | AST.Type): string;
    getTypeInfo(type: AST.Type | string): TypeInfo | null;
}
