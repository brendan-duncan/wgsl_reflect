import { Let, Var, Argument, Function } from "../wgsl_ast.js";
import { Data } from "../wgsl_ast.js";

type ASTVarNode = Let | Var | Argument;

let _id = 0;

export class VarRef {
    name: string;
    value: Data;
    node: ASTVarNode | null;
    readonly id: number = _id++;

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
    readonly id: number = _id++;

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
    // Precomputed results for quad-derivative builtins (dpdx/dpdy/fwidth, ...),
    // keyed by the call-site AST node. A fragment quad scheduler evaluates the
    // 2x2 quad at each derivative call and stashes this lane's result here so the
    // enclosing statement reads a per-lane value (CallExpr.cachedReturnValue is
    // shared across lanes and cannot hold one). Empty for compute/vertex and for
    // single-lane fragment debugging, where derivatives evaluate to zero.
    derivatives = new Map<object, Data>();
    currentFunctionName = "";
    readonly id: number = _id++;

    constructor(parent?: ExecContext) {
        if (parent) {
            this.parent = parent;
            this.currentFunctionName = parent.currentFunctionName;
        }
    }

    setDerivative(node: object, value: Data): void {
        this.derivatives.set(node, value);
    }

    // Look up a precomputed derivative for `node`, walking up to enclosing
    // scopes (a derivative call and the statement that consumes it may sit in
    // different child contexts of the same lane).
    getDerivative(node: object): Data | null {
        if (this.derivatives.has(node)) {
            return this.derivatives.get(node) ?? null;
        }
        if (this.parent) {
            return this.parent.getDerivative(node);
        }
        return null;
    }

    // Consume a precomputed derivative so the same call site re-rendezvouses on
    // the next loop iteration rather than reusing a stale value.
    clearDerivative(node: object): void {
        if (this.derivatives.has(node)) {
            this.derivatives.delete(node);
            return;
        }
        if (this.parent) {
            this.parent.clearDerivative(node);
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
