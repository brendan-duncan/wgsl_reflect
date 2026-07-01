import { Let, Var, Argument, Function } from "../wgsl_ast.js";
import { Data } from "../wgsl_ast.js";
type ASTVarNode = Let | Var | Argument;
export declare class VarRef {
    name: string;
    value: Data;
    node: ASTVarNode | null;
    readonly id: number;
    constructor(n: string, v: Data, node: ASTVarNode | null);
    clone(): VarRef;
}
export declare class FunctionRef {
    name: string;
    node: Function;
    readonly id: number;
    constructor(node: Function);
    clone(): FunctionRef;
}
export declare class ExecContext {
    parent: ExecContext | null;
    variables: Map<string, VarRef>;
    functions: Map<string, FunctionRef>;
    derivatives: Map<object, Data>;
    currentFunctionName: string;
    readonly id: number;
    constructor(parent?: ExecContext);
    setDerivative(node: object, value: Data): void;
    getDerivative(node: object): Data | null;
    clearDerivative(node: object): void;
    getVariable(name: string): VarRef | null;
    getFunction(name: string): FunctionRef | null;
    createVariable(name: string, value: Data, node?: ASTVarNode): void;
    setVariable(name: string, value: Data, node?: ASTVarNode): void;
    getVariableValue(name: string): Data | null;
    clone(): ExecContext;
}
export {};
