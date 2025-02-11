import * as AST from "../wgsl_ast.js";
import { ExecContext } from "./exec_context.js";
import { TypeInfo } from "../wgsl_reflect.js";
import { Data } from "./data.js";

export class ExecInterface {
    evalExpression(node: AST.Node, context: ExecContext): Data | null {
        return null;
    }

    getTypeName(type: TypeInfo | AST.Type): string {
        return "";
    }

    getTypeInfo(type: AST.Type | string): TypeInfo | null {
        return null; 
    }
}
