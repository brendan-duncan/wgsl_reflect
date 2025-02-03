import * as AST from "../wgsl_ast.js";
import { ExecContext } from "./exec_context.js";
export declare class ExecInterface {
    _evalExpression(node: AST.Node, context: ExecContext): any;
}
