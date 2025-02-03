import * as AST from "../wgsl_ast.js";

type ASTVarNode = AST.Let | AST.Var | AST.Argument;

export class Var {
    name: string;
    value: any;
    node: ASTVarNode | null;

    constructor(n: string, v: any, node: ASTVarNode | null) {
        this.name = n;
        this.value = v;
        this.node = node;
    }

    clone(): Var {
        return new Var(this.name, this.value, this.node);
    }

    getValue() {
        return this.value;
    }
};

export class Function {
    name: string;
    node: AST.Function;

    constructor(node: AST.Function) {
        this.name = node.name;
        this.node = node;
    }

    clone(): Function {
        return new Function(this.node);
    }
};

export class ExecContext {
    parent: ExecContext | null = null;
    variables: Map<string, Var> = new Map<string, Var>();
    functions: Map<string, Function> = new Map<string, Function>();
    currentFunctionName: string = "";

    constructor(parent?: ExecContext) {
        if (parent) {
            this.parent = parent;
            this.currentFunctionName = parent.currentFunctionName;
        }
    }

    getVariable(name: string): Var | null {
        if (this.variables.has(name)) {
            return this.variables.get(name) ?? null;
        }
        if (this.parent) {
            return this.parent.getVariable(name);
        }
        return null;
    }

    getFunction(name: string): Function | null {
        if (this.functions.has(name)) {
            return this.functions.get(name) ?? null;
        }
        if (this.parent) {
            return this.parent.getFunction(name);
        }
        return null
    }

    createVariable(name: string, value: any, node?: ASTVarNode) {
        this.variables.set(name, new Var(name, value, node ?? null));
    }

    setVariable(name: string, value: any, node?: ASTVarNode) {
        const v = this.getVariable(name);
        if (v !== null) {
            v.value = value;
        } else {
            this.createVariable(name, value, node);
        }
    }

    getVariableValue(name: string) {
        const v = this.getVariable(name);
        return v?.value ?? null;
    }

    clone(): ExecContext {
        return new ExecContext(this);
    }
};
