import * as AST from "./wgsl_ast.js";

class Var {
    name: string;
    value: any;
    constructor(n: string, v: any) {
        this.name = n;
        this.value = v;
    }
};

class ExecContext {
    variables: Map<string, Var> = new Map<string, Var>();
};

export class WgslExec {
    ast: Array<AST.Node>;
    context: ExecContext;
    
    constructor(ast: Array<AST.Node>) {
        this.ast = ast;
        this.context = new ExecContext();
    }

    getVariableValue(name: string) {
        const v = this.context.variables.get(name);
        return v?.value ?? null;
    } 

    exec() {
        const context = new ExecContext();
        for (const stmt of this.ast) {
            this._execStatement(stmt);
        }
    }

    _execStatement(stmt: AST.Node) {
        if (stmt instanceof AST.Let) {
            this._let(stmt as AST.Let);
        }
    }

    _let(node: AST.Let) {
        let value = null;
        if (node.value != null) {
            value = this._evalExpression(node.value);
        }
        const v = new Var(node.name, value);
        this.context.variables.set(node.name, v);
        console.log(`LET ${node.name} ${value}`);
    }

    _evalExpression(node: AST.Node) {
        if (node instanceof AST.BinaryOperator) {
            return this._evalBinaryOp(node as AST.BinaryOperator);
        } else if (node instanceof AST.LiteralExpr) {
            return this._evalLiteral(node as AST.LiteralExpr);
        } else if (node instanceof AST.VariableExpr) {
            return this._evalVariable(node as AST.VariableExpr);
        }
        return null;
    }

    _evalLiteral(node: AST.LiteralExpr) {
        return node.value;
    }

    _evalVariable(node: AST.VariableExpr) {
        return this.getVariableValue(node.name);
    }

    _evalBinaryOp(node: AST.BinaryOperator) {
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
