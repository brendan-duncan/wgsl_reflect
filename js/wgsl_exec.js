import * as AST from "./wgsl_ast.js";
class Var {
    constructor(n, v) {
        this.name = n;
        this.value = v;
    }
}
;
class ExecContext {
    constructor() {
        this.variables = new Map();
    }
}
;
export class WgslExec {
    constructor(ast) {
        this.ast = ast;
        this.context = new ExecContext();
    }
    getVariableValue(name) {
        var _a;
        const v = this.context.variables.get(name);
        return (_a = v === null || v === void 0 ? void 0 : v.value) !== null && _a !== void 0 ? _a : null;
    }
    exec() {
        const context = new ExecContext();
        for (const stmt of this.ast) {
            this._execStatement(stmt);
        }
    }
    _execStatement(stmt) {
        if (stmt instanceof AST.Let) {
            this._let(stmt);
        }
    }
    _let(node) {
        let value = null;
        if (node.value != null) {
            value = this._evalExpression(node.value);
        }
        const v = new Var(node.name, value);
        this.context.variables.set(node.name, v);
        console.log(`LET ${node.name} ${value}`);
    }
    _evalExpression(node) {
        if (node instanceof AST.BinaryOperator) {
            return this._evalBinaryOp(node);
        }
        else if (node instanceof AST.LiteralExpr) {
            return this._evalLiteral(node);
        }
        else if (node instanceof AST.VariableExpr) {
            return this._evalVariable(node);
        }
        return null;
    }
    _evalLiteral(node) {
        return node.value;
    }
    _evalVariable(node) {
        return this.getVariableValue(node.name);
    }
    _evalBinaryOp(node) {
        const l = this._evalExpression(node.left);
        const r = this._evalExpression(node.right);
        switch (node.operator) {
            case "+":
                return l + r;
            case "-":
                return l - r;
            case "*":
                return l * r;
            case "/":
                return l / r;
        }
        return null;
    }
}
