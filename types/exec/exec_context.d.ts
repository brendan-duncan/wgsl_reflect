import { Let, Var, Argument, Function } from "../wgsl_ast.js";
import { Data } from "../wgsl_ast.js";
type ASTVarNode = Let | Var | Argument;
export declare class VarRef {
    name: string;
    value: Data;
    node: ASTVarNode | null;
    constructor(n: string, v: Data, node: ASTVarNode | null);
    clone(): VarRef;
}
export declare class FunctionRef {
    name: string;
    node: Function;
    constructor(node: Function);
    clone(): FunctionRef;
}
export declare class ExecContext {
    parent: ExecContext | null;
    variables: Map<string, VarRef>;
    functions: Map<string, FunctionRef>;
    currentFunctionName: string;
    constructor(parent?: ExecContext);
    getVariable(name: string): VarRef | null;
    getFunction(name: string): FunctionRef | null;
    createVariable(name: string, value: Data, node?: ASTVarNode): void;
    setVariable(name: string, value: Data, node?: ASTVarNode): void;
    getVariableValue(name: string): Data | null;
    clone(): ExecContext;
}
export {};
