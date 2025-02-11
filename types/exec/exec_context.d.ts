import * as AST from "../wgsl_ast.js";
import { Data } from "./data.js";
type ASTVarNode = AST.Let | AST.Var | AST.Argument;
export declare class Var {
    name: string;
    value: Data;
    node: ASTVarNode | null;
    constructor(n: string, v: Data, node: ASTVarNode | null);
    clone(): Var;
}
export declare class Function {
    name: string;
    node: AST.Function;
    constructor(node: AST.Function);
    clone(): Function;
}
export declare class ExecContext {
    parent: ExecContext | null;
    variables: Map<string, Var>;
    functions: Map<string, Function>;
    currentFunctionName: string;
    constructor(parent?: ExecContext);
    getVariable(name: string): Var | null;
    getFunction(name: string): Function | null;
    createVariable(name: string, value: Data, node?: ASTVarNode): void;
    setVariable(name: string, value: Data, node?: ASTVarNode): void;
    getVariableValue(name: string): Data | null;
    clone(): ExecContext;
}
export {};
