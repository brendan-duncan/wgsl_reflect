import * as AST from "../wgsl_ast.js";
import { ExecContext } from "./exec_context.js";
import { TypeInfo } from "../wgsl_reflect.js";
export declare class ExecInterface {
    _evalExpression(node: AST.Node, context: ExecContext): any;
    _getTypeName(type: TypeInfo | AST.Type): string;
}
