import * as AST from "./wgsl_ast.js";
import { WgslParser } from "./wgsl_parser.js";

class Var {
    name: string;
    value: any;
    node: AST.Let | AST.Var | AST.Argument;

    constructor(n: string, v: any, node: AST.Let | AST.Var | AST.Argument) {
        this.name = n;
        this.value = v;
        this.node = node;
    }

    clone(): Var {
        return new Var(this.name, this.value, this.node);
    }
};

class Function {
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

class ExecContext {
    variables: Map<string, Var> = new Map<string, Var>();
    functions: Map<string, Function> = new Map<string, Function>();

    getVariableValue(name: string) {
        const v = this.variables.get(name);
        return v?.value ?? null;
    }

    clone(): ExecContext {
        const c = new ExecContext();
        for (const [k, v] of this.variables) {
            c.variables.set(k, v.clone());
        }
        for (const [k, v] of this.functions) {
            c.functions.set(k, v.clone());
        }
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
        return this.context.getVariableValue(name);
    }

    exec(context?: ExecContext) {
        this.context = context?.clone() ?? new ExecContext();
        this._execStatements(this.ast, this.context);
    }

    execFunction(functionName: string, args: Array<any>, context?: ExecContext): any {
        this.context = context?.clone() ?? new ExecContext();
        this._execStatements(this.ast, this.context);
        const f = this.context.functions.get(functionName);
        for (const arg of f.node.args) {
            const value = args.shift();
            const v = new Var(arg.name, value, arg);
            this.context.variables.set(v.name, v);
        }
        return this._execStatements(f.node.body, this.context);
    }

    dispatchWorkgroups(kernel: string, dispatchCount: [number, number, number], bindGroups: Object, context?: ExecContext) {
        this.context = context?.clone() ?? new ExecContext();
        this._execStatements(this.ast, this.context);
        const f = this.context.functions.get(kernel);
        if (!f) {
            console.error(`Function ${kernel} not found`);
            return;
        }
        let workgroupSize = [1, 1, 1];
        for (const attr of f.node.attributes) {
            if (attr.name === "workgroup_size") {
                if (attr.value.length > 0) {
                    workgroupSize[0] = parseInt(attr.value[0]);
                }
                if (attr.value.length > 1) {
                    workgroupSize[1] = parseInt(attr.value[1]);
                }
                if (attr.value.length > 2) {
                    workgroupSize[2] = parseInt(attr.value[2]);
                }
            }
        }

        for (let dz = 0; dz < dispatchCount[2]; ++dz) {
            for (let dy = 0; dy < dispatchCount[1]; ++dy) {
                for (let dx = 0; dx < dispatchCount[0]; ++dx) {
                    for (let wz = 0, li = 0; wz < workgroupSize[2]; ++wz) {
                        for (let wy = 0; wy < workgroupSize[1]; ++wy) {
                            for (let wx = 0; wx < workgroupSize[0]; ++wx, ++li) {
                                let lx = wx + dx * workgroupSize[0];
                                let ly = wy + dy * workgroupSize[1];
                                let lz = wz + dz * workgroupSize[2];

                                this.context.variables.set("@workgroup_id",  new Var("@workgroup_id", [dx, dy, dz], null));
                                this.context.variables.set("@local_invocation_id",  new Var("@local_invocation_id", [wx, wy, wz], null));
                                this.context.variables.set("@num_workgroups",  new Var("@num_workgroups", dispatchCount, null));
                                this.context.variables.set("@local_invocation_index",  new Var("@local_invocation_index", li, null));

                                this._dispatchExec(kernel, [lx, ly, lz], bindGroups, this.context);
                            }
                        }
                    }
                }
            }
        }
    }

    dispatch(kernel: string, dispatch: [number, number, number], bindGroups: Object, context?: ExecContext) {
        this.context = context?.clone() ?? new ExecContext();
        this._execStatements(this.ast, this.context);
        this._dispatchExec(kernel, dispatch, bindGroups, context);
    }

    _dispatchExec(kernel: string, dispatch: [number, number, number], bindGroups: Object, context: ExecContext) {
        const f = this.context.functions.get(kernel);
        if (!f) {
            console.error(`Function ${kernel} not found`);
            return;
        }

        let workgroupSize = [1, 1, 1];
        for (const attr of f.node.attributes) {
            if (attr.name === "workgroup_size") {
                if (attr.value.length > 0) {
                    workgroupSize[0] = parseInt(attr.value[0]);
                }
                if (attr.value.length > 1) {
                    workgroupSize[1] = parseInt(attr.value[1]);
                }
                if (attr.value.length > 2) {
                    workgroupSize[2] = parseInt(attr.value[2]);
                }
            }
        }

        const subContext = this.context.clone();

        for (const set in bindGroups) {
            for (const binding in bindGroups[set]) {
                const entry = bindGroups[set][binding];

                subContext.variables.forEach((v, k) => {
                    const node = v.node;
                    if (node?.attributes) {
                        let b = null;
                        let s = null;
                        for (const attr of node.attributes) {
                            if (attr.name === "binding") {
                                b = attr.value;
                            } else if (attr.name === "group") {
                                s = attr.value;
                            }
                        }
                        if (binding == b && set == s) {
                            v.value = entry;
                        }
                    }
                });
            }
        }

        for (const arg of f.node.args) {
            for (const attr of arg.attributes) {
                if (attr.name === "builtin") {
                    if (attr.value === "global_invocation_id") {
                        subContext.variables.set(arg.name, new Var(arg.name, dispatch, arg));
                    } else if (attr.value === "workgroup_id") {
                        const workgroup_id = subContext.getVariableValue("@workgroup_id") ?? [0, 0, 0];
                        subContext.variables.set(arg.name, new Var(arg.name, workgroup_id, arg));
                    } else if (attr.value === "workgroup_size") {
                        subContext.variables.set(arg.name, new Var(arg.name, workgroupSize, arg));
                    } else if (attr.value === "local_invocation_id") {
                        const local_invocation_id = subContext.getVariableValue("@local_invocation_id") ?? [0, 0, 0];
                        subContext.variables.set(arg.name, new Var(arg.name, local_invocation_id, arg));
                    } else if (attr.value === "num_workgroups") {
                        const num_workgroups = subContext.getVariableValue("@num_workgroups") ?? [1, 1, 1];
                        subContext.variables.set(arg.name, new Var(arg.name, num_workgroups, arg));
                    } else if (attr.value === "local_invocation_index") {
                        const local_invocation_index = subContext.getVariableValue("@local_invocation_index") ?? 0;
                        subContext.variables.set(arg.name, new Var(arg.name, local_invocation_index, arg));
                    } else {
                        console.error(`Unknown builtin ${attr.value}`);
                    }
                }
            }
        }

        this._execStatements(f.node.body, subContext);
    }

    _execStatements(statements: Array<AST.Node>, context: ExecContext) {
        for (const stmt of statements) {
            const res = this._execStatement(stmt, context);
            if (res) {
                return res;
            }
        }
        return null;
    }

    _execStatement(stmt: AST.Node, context: ExecContext): any {
        if (stmt instanceof AST.Return) {
            return this._evalExpression(stmt.value, context);
        } else if (stmt instanceof AST.Break) {
            return stmt;
        } else if (stmt instanceof AST.Continue) {
            return stmt;
        } else if (stmt instanceof AST.Let) {
            this._let(stmt as AST.Let, context);
        } else if (stmt instanceof AST.Var) {
            this._var(stmt as AST.Var, context);
        } else if (stmt instanceof AST.Function) {
            this._function(stmt as AST.Function, context);
        } else if (stmt instanceof AST.If) {
            return this._if(stmt as AST.If, context);
        } else if (stmt instanceof AST.For) {
            return this._for(stmt as AST.For, context);
        } else if (stmt instanceof AST.While) {
            return this._while(stmt as AST.While, context);
        } else if (stmt instanceof AST.Assign) {
            return this._assign(stmt as AST.Assign, context);
        } else {
            console.error(`Unknown statement type`, stmt);
        }
        return null;
    }

    _getVariableName(node: AST.Node, context: ExecContext) {
        if (node instanceof AST.VariableExpr) {
            return (node as AST.VariableExpr).name;
        } else {
            console.error(`Unknown variable type`, node);
        }
        return null;
    }

    _assign(node: AST.Assign, context: ExecContext) {
        const name = this._getVariableName(node.variable, context);
        const v = context.variables.get(name);

        if (!v) {
            console.error(`Variable ${name} not found`);
            return;
        }
        const value = this._evalExpression(node.value, context);
        if (node.variable.postfix) {
            if (node.variable.postfix instanceof AST.ArrayIndex) {
                const idx = this._evalExpression(node.variable.postfix.index, context);
                if (v.value.length !== undefined) {
                    v.value[idx] = value;
                } else {
                    console.error(`Variable ${v.name} is not an array`);
                }
            } else if (node.variable.postfix instanceof AST.StringExpr) {
            }
        } else {
            v.value = value;
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
        const v = new Var(node.name, value, node);
        context.variables.set(node.name, v);
    }

    _var(node: AST.Var, context: ExecContext) {
        let value = null;
        if (node.value != null) {
            value = this._evalExpression(node.value, context);
        }
        const v = new Var(node.name, value ,node);
        context.variables.set(node.name, v);
    }

    _if(node: AST.If, context: ExecContext) {
        const condition = this._evalExpression(node.condition, context);
        if (condition) {
            return this._execStatements(node.body, context);
        }

        for (const e of node.elseif) {
            const condition = this._evalExpression(e.condition, context);
            if (condition) {
                return this._execStatements(e.body, context);
            }
        }

        if (node.else) {
            return this._execStatements(node.else, context);
        }

        return null;
    }

    _for(node: AST.For, context: ExecContext) {
        const start = this._evalExpression(node.init, context);
        const end = this._evalExpression(node.condition, context);
        const step = this._evalExpression(node.increment, context);

        /*const v = new Var(node.name, start);
        for (let i = start; i < end; i += step) {
            
            context.variables.set(node.name, v);
            const res = this._execStatements(node.body, context);
            if (res) {
                return res;
            }
        }*/

        return null;
    }

    _while(node: AST.While, context: ExecContext) {
        let condition = this._evalExpression(node.condition, context);
        while (condition) {
            const res = this._execStatements(node.body, context);
            if (res instanceof AST.Break) {
                break;
            } else if (res instanceof AST.Continue) {
                continue;
            } else if (res !== null) {
                return res;
            }
            condition = this._evalExpression(node.condition, context);
        }
        return null;
    }

    _evalExpression(node: AST.Node, context: ExecContext) {
        if (node instanceof AST.GroupingExpr) {
            const grp = node as AST.GroupingExpr;
            return this._evalExpression(grp.contents[0], context);
        } else if (node instanceof AST.BinaryOperator) {
            return this._evalBinaryOp(node as AST.BinaryOperator, context);
        } else if (node instanceof AST.LiteralExpr) {
            return this._evalLiteral(node as AST.LiteralExpr, context);
        } else if (node instanceof AST.VariableExpr) {
            return this._evalVariable(node as AST.VariableExpr, context);
        } else if (node instanceof AST.CallExpr) {
            return this._evalCall(node as AST.CallExpr, context);
        } else {
            console.error(`Unknown expression type`, node);
        }
        return null;
    }

    _evalLiteral(node: AST.LiteralExpr, context: ExecContext) {
        return node.value;
    }

    _evalVariable(node: AST.VariableExpr, context: ExecContext) {
        const value = context.getVariableValue(node.name);
        if (node.postfix) {
            if (node.postfix instanceof AST.ArrayIndex) {
                const idx = this._evalExpression(node.postfix.index, context);
                if (value.length !== undefined) {
                    return value[idx];
                } else {
                    console.error(`Variable ${node.name} is not an array`);
                }
            } else if (node.postfix instanceof AST.StringExpr) {
                const member = node.postfix.value;
                if (value instanceof Array) {
                    if (member === "x") {
                        return value[0];
                    } else if (member === "y") {
                        return value[1];
                    } else if (member === "z") {
                        return value[2];
                    } else if (member === "w") {
                        return value[3];
                    } else {
                        console.error(`Unknown member ${member}`);
                    }
                } else {
                    console.error(`Unknown variable postfix`, node.postfix);
                }
            }
        }
        return value;
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
            case "%":
                return l % r;
            case "/":
                return l / r;
            case ">":
                return l > r;
            case "<":
                return l < r;
            case "==":
                return l === r;
            case "!=":
                return l !== r;
            case ">=":
                return l >= r;
            case "<=":
                return l <= r;
            case "&&":
                return l && r;
            case "||":
                return l || r;

        }
        return null;
    }

    _evalCall(node: AST.CallExpr, context: ExecContext) {
        const f = context.functions.get(node.name);
        if (!f) {
            return null;
        }

        const subContext = context.clone();
        for (let ai = 0; ai < f.node.args.length; ++ai) {
            const arg = f.node.args[ai];
            const value = this._evalExpression(node.args[ai], subContext);
            const v = new Var(arg.name, value, arg);
            subContext.variables.set(v.name, v);
        }

        return this._execStatements(f.node.body, subContext);
    }
}
