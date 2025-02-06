import * as AST from "../wgsl_ast.js";
type ASTVarNode = AST.Let | AST.Var | AST.Argument;
export declare class Var {
    name: string;
    value: any;
    node: ASTVarNode | null;
    constructor(n: string, v: any, node: ASTVarNode | null);
    clone(): Var;
    getValue(): any;
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
    createVariable(name: string, value: any, node?: ASTVarNode): void;
    setVariable(name: string, value: any, node?: ASTVarNode): void;
    getVariableValue(name: string): any;
    clone(): ExecContext;
}
export {};
