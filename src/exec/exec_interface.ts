import * as AST from "../wgsl_ast.js";
import { ExecContext } from "./exec_context.js";
import { TypeInfo } from "../wgsl_reflect.js";

export class ExecInterface {
    evalExpression(node: AST.Node, context: ExecContext) {
        return null;
    }

    _getTypeName(type: TypeInfo | AST.Type): string {
        return "";
    }
}
