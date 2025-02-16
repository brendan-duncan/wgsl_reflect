import { Node, Type } from "../wgsl_ast.js";
import { ExecContext } from "./exec_context.js";
import { TypeInfo } from "../wgsl_reflect.js";
import { Data } from "./data.js";

export class ExecInterface {
    evalExpression(node: Node, context: ExecContext): Data | null {
        return null;
    }

    getTypeName(type: TypeInfo | Type): string {
        return "";
    }

    getTypeInfo(type: Type | string): TypeInfo | null {
        return null; 
    }

    getVariableName(node: Node, context: ExecContext): string | null {
        return "";
    }
}
