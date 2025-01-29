import * as AST from "./wgsl_ast.js";
import { WgslParser } from "./wgsl_parser.js";
class Var {
    constructor(n, v) {
        this.name = n;
        this.value = v;
    }
}
;
class Function {
    constructor(node) {
        this.name = node.name;
        this.node = node;
    }
}
;
class ExecContext {
    constructor() {
        this.variables = new Map();
        this.functions = new Map();
    }
    clone() {
        const c = new ExecContext();
        c.variables = new Map(this.variables);
        c.functions = new Map(this.functions);
        return c;
    }
}
;
export class WgslExec {
    constructor(code) {
        const parser = new WgslParser();
        this.ast = parser.parse(code);
    }
    getVariableValue(name) {
        var _a;
        const v = this.context.variables.get(name);
        return (_a = v === null || v === void 0 ? void 0 : v.value) !== null && _a !== void 0 ? _a : null;
    }
    exec() {
        this.context = new ExecContext();
        this._execStatements(this.ast, this.context);
    }
    _execStatements(statements, context) {
        for (const stmt of statements) {
            this._execStatement(stmt, context);
        }
    }
    _execStatement(stmt, context) {
        if (stmt instanceof AST.Let) {
            this._let(stmt, context);
        }
        else if (stmt instanceof AST.Function) {
            this._function(stmt, context);
        }
    }
    _function(node, context) {
        const f = new Function(node);
        context.functions.set(node.name, f);
    }
    _let(node, context) {
        let value = null;
        if (node.value != null) {
            value = this._evalExpression(node.value, context);
        }
        const v = new Var(node.name, value);
        context.variables.set(node.name, v);
        console.log(`LET ${node.name} ${value}`);
    }
    _evalExpression(node, context) {
        if (node instanceof AST.BinaryOperator) {
            return this._evalBinaryOp(node, context);
        }
        else if (node instanceof AST.LiteralExpr) {
            return this._evalLiteral(node, context);
        }
        else if (node instanceof AST.VariableExpr) {
            return this._evalVariable(node, context);
        }
        else if (node instanceof AST.CallExpr) {
            return this._evalCall(node, context);
        }
        return null;
    }
    _evalLiteral(node, context) {
        return node.value;
    }
    _evalVariable(node, context) {
        return this.getVariableValue(node.name);
    }
    _evalBinaryOp(node, context) {
        const l = this._evalExpression(node.left, context);
        const r = this._evalExpression(node.right, context);
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
    _evalCall(node, context) {
        const f = context.functions.get(node.name);
        if (!f) {
            return null;
        }
        const subContext = context.clone();
        console.log(`CALL ${node.name}`);
        for (let ai = 0; ai < f.node.args.length; ++ai) {
            const v = new Var(f.node.args[ai].name, this._evalExpression(node.args[ai], subContext));
            subContext.variables.set(v.name, v);
            console.log(`    ARG: ${v.name} : ${v.value}`);
        }
        return this._evalFunction(f.node.body, subContext);
    }
    _evalFunction(statements, context) {
        for (const stmt of statements) {
            if (stmt instanceof AST.Return) {
            }
            this._execStatement(stmt, context);
        }
    }
}
