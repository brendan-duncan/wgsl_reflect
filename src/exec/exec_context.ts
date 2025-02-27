import { Let, Var, Argument, Function } from "../wgsl_ast.js";
import { Data } from "../wgsl_ast.js";

type ASTVarNode = Let | Var | Argument;

export class VarRef {
    name: string;
    value: Data;
    node: ASTVarNode | null;

    constructor(n: string, v: Data, node: ASTVarNode | null) {
        this.name = n;
        this.value = v;
        this.node = node;
    }

    clone(): VarRef {
        return new VarRef(this.name, this.value, this.node);
    }
};

export class FunctionRef {
    name: string;
    node: Function;

    constructor(node: Function) {
        this.name = node.name;
        this.node = node;
    }

    clone(): FunctionRef {
        return new FunctionRef(this.node);
    }
};

export class ExecContext {
    parent: ExecContext | null = null;
    variables = new Map<string, VarRef>();
    functions = new Map<string, FunctionRef>();
    currentFunctionName = "";

    constructor(parent?: ExecContext) {
        if (parent) {
            this.parent = parent;
            this.currentFunctionName = parent.currentFunctionName;
        }
    }

    getVariable(name: string): VarRef | null {
        if (this.variables.has(name)) {
            return this.variables.get(name) ?? null;
        }
        if (this.parent) {
            return this.parent.getVariable(name);
        }
        return null;
    }

    getFunction(name: string): FunctionRef | null {
        if (this.functions.has(name)) {
            return this.functions.get(name) ?? null;
        }
        if (this.parent) {
            return this.parent.getFunction(name);
        }
        return null
    }

    createVariable(name: string, value: Data, node?: ASTVarNode) {
        this.variables.set(name, new VarRef(name, value, node ?? null));
    }

    setVariable(name: string, value: Data, node?: ASTVarNode) {
        const v = this.getVariable(name);
        if (v !== null) {
            v.value = value;
        } else {
            this.createVariable(name, value, node);
        }
    }

    getVariableValue(name: string): Data | null {
        const v = this.getVariable(name);
        return v?.value ?? null;
    }

    clone(): ExecContext {
        return new ExecContext(this);
    }
};
