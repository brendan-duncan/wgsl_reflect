import * as AST from "./wgsl_ast.js";
import { WgslParser } from "./wgsl_parser.js";

class Var {
    name: string;
    value: any;
    constructor(n: string, v: any) {
        this.name = n;
        this.value = v;
    }
};

class Function {
    name: string;
    node: AST.Function;
    constructor(node: AST.Function) {
        this.name = node.name;
        this.node = node;
    }
};

class ExecContext {
    variables: Map<string, Var> = new Map<string, Var>();
    functions: Map<string, Function> = new Map<string, Function>();

    clone(): ExecContext {
        const c = new ExecContext();
        c.variables = new Map<string, Var>(this.variables);
        c.functions = new Map<string, Function>(this.functions);
        return c;
    }
};

export class WgslExec {
    ast: Array<AST.Node>;
    context: ExecContext;
    
    constructor(code: string) {
        const parser = new WgslParser();
        this.ast = parser.parse(code);
    }

    getVariableValue(name: string) {
        const v = this.context.variables.get(name);
        return v?.value ?? null;
    } 

    exec() {
        this.context = new ExecContext();
        this._execStatements(this.ast, this.context);
    }

    _execStatements(statements: Array<AST.Node>, context: ExecContext) {
        for (const stmt of statements) {
            this._execStatement(stmt, context);
        }
    }

    _execStatement(stmt: AST.Node, context: ExecContext) {
        if (stmt instanceof AST.Let) {
            this._let(stmt as AST.Let, context);
        } else if (stmt instanceof AST.Function) {
            this._function(stmt as AST.Function, context);
        }
    }

    _function(node: AST.Function, context: ExecContext) {
        const f = new Function(node);
        context.functions.set(node.name, f);
    }

    _let(node: AST.Let, context: ExecContext) {
        let value = null;
        if (node.value != null) {
            value = this._evalExpression(node.value, context);
        }
        const v = new Var(node.name, value);
        context.variables.set(node.name, v);
        console.log(`LET ${node.name} ${value}`);
    }

    _evalExpression(node: AST.Node, context: ExecContext) {
        if (node instanceof AST.BinaryOperator) {
            return this._evalBinaryOp(node as AST.BinaryOperator, context);
        } else if (node instanceof AST.LiteralExpr) {
            return this._evalLiteral(node as AST.LiteralExpr, context);
        } else if (node instanceof AST.VariableExpr) {
            return this._evalVariable(node as AST.VariableExpr, context);
        } else if (node instanceof AST.CallExpr) {
            return this._evalCall(node as AST.CallExpr, context);
        }
        return null;
    }

    _evalLiteral(node: AST.LiteralExpr, context: ExecContext) {
        return node.value;
    }

    _evalVariable(node: AST.VariableExpr, context: ExecContext) {
        return this.getVariableValue(node.name);
    }

    _evalBinaryOp(node: AST.BinaryOperator, context: ExecContext) {
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

    _evalCall(node: AST.CallExpr, context: ExecContext) {
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

    _evalFunction(statements: Array<AST.Statement>, context: ExecContext) {
        for (const stmt of statements) {
            if (stmt instanceof AST.Return) {
                
            }
            this._execStatement(stmt, context);
        }
    }
}
