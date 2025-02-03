import * as AST from "../wgsl_ast.js";
import { ExecContext } from "./exec_context.js";

export class ExecInterface {
    _evalExpression(node: AST.Node, context: ExecContext) {
        return null;
    }
}
