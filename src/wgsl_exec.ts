import * as AST from "./wgsl_ast.js";
import { WgslParser } from "./wgsl_parser.js";
import { WgslReflect, TypeInfo, ArrayInfo, StructInfo, MemberInfo, TemplateInfo } from "./wgsl_reflect.js";

class Data {
    type: AST.Type;
    buffer: ArrayBuffer;
    typeInfo: TypeInfo;

    constructor(type: AST.Type, data: ArrayBuffer | Float32Array | Uint32Array | Int32Array | Uint8Array | Int8Array,
        reflection: WgslReflect = null) {
        this.type = type;
        this.buffer = data instanceof ArrayBuffer ? data : data.buffer;
        this.typeInfo = reflection._types.get(this.type);
    }
};

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

    getValue() {
        return this.value;
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
    reflection: WgslReflect;

    constructor(code: string, context?: ExecContext) {
        const parser = new WgslParser();
        this.ast = parser.parse(code);
        this.reflection = new WgslReflect();
        this.reflection.updateAST(this.ast);

        this.context = context?.clone() ?? new ExecContext();
        this._execStatements(this.ast, this.context);
    }

    getVariableValue(name: string) {
        return this.context.getVariableValue(name);
    }

    dispatchWorkgroups(kernel: string, dispatchCount: number | number[], bindGroups: Object, config?: Object) {
        const context = this.context.clone();

        config = config ?? {};
        if (config["constants"]) {
            for (const k in config["constants"]) {
                const v = config["constants"][k];
                context.variables.set(k, new Var(k, v, null));
            }
        }
        const f = context.functions.get(kernel);
        if (!f) {
            console.error(`Function ${kernel} not found`);
            return;
        }

        if (typeof dispatchCount === "number") {
            dispatchCount = [dispatchCount, 1, 1];
        } else if (dispatchCount.length === 0) {
            console.error(`Invalid dispatch count`);
            return;
        } else if (dispatchCount.length === 1) {
            dispatchCount = [dispatchCount[0], 1, 1];
        } else if (dispatchCount.length === 2) {
            dispatchCount = [dispatchCount[0], dispatchCount[1], 1];
        } else if (dispatchCount.length > 3) {
            dispatchCount = [dispatchCount[0], dispatchCount[1], dispatchCount[2]];
        }

        const depth = dispatchCount[2];
        const height = dispatchCount[1];
        const width = dispatchCount[0];

        context.variables.set("@num_workgroups",  new Var("@num_workgroups", dispatchCount, null));

        for (const set in bindGroups) {
            for (const binding in bindGroups[set]) {
                const entry = bindGroups[set][binding];

                context.variables.forEach((v, k) => {
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
                            const data = new Data(node.type, entry, this.reflection);
                            v.value = data;
                        }
                    }
                });
            }
        }

        for (let z = 0; z < depth; ++z) {
            for (let y = 0; y < height; ++y) {
                for (let x = 0; x < width; ++x) {
                    context.variables.set("@workgroup_id",  new Var("@workgroup_id", [x, y, z], null));
                    this._dispatchWorkgroup(f, [x, y, z], bindGroups, context);
                }
            }
        }
    }

    _dispatchWorkgroup(f: Function, workgroup_id: number[], bindGroups: Object, context: ExecContext) {
        const workgroupSize = [1, 1, 1];
        for (const attr of f.node.attributes) {
            if (attr.name === "workgroup_size") {
                if (attr.value.length > 0) {
                    // The value could be an override constant
                    const v = context.getVariableValue(attr.value[0]);
                    if (v !== null) {
                        workgroupSize[0] = v;
                    } else {
                        workgroupSize[0] = parseInt(attr.value[0]);
                    }
                }
                if (attr.value.length > 1) {
                    const v = context.getVariableValue(attr.value[1]);
                    if (v !== null) {
                        workgroupSize[1] = v;
                    } else {
                        workgroupSize[1] = parseInt(attr.value[1]);
                    }
                }
                if (attr.value.length > 2) {
                    const v = context.getVariableValue(attr.value[2]);
                    if (v !== null) {
                        workgroupSize[2] = v;
                    } else {
                        workgroupSize[2] = parseInt(attr.value[2]);
                    }
                }
            }
        }

        context.variables.set("@workgroup_size",  new Var("@workgroup_size", workgroupSize, null));

        const width = workgroupSize[0];
        const height = workgroupSize[1];
        const depth = workgroupSize[2];

        for (let z = 0, li = 0; z < depth; ++z) {
            for (let y = 0; y < height; ++y) {
                for (let x = 0; x < width; ++x, ++li) {
                    const local_invocation_id = [x, y, z];
                    const global_invocation_id = [
                        x + workgroup_id[0] * workgroupSize[0],
                        y + workgroup_id[1] * workgroupSize[1],
                        z + workgroup_id[2] * workgroupSize[2]];

                    context.variables.set("@local_invocation_id",  new Var("@local_invocation_id", local_invocation_id, null));
                    context.variables.set("@global_invocation_id",  new Var("@global_invocation_id", global_invocation_id, null));
                    context.variables.set("@local_invocation_index",  new Var("@local_invocation_index", li, null));

                    this._dispatchExec(f, context);
                }
            }
        }
    }

    _dispatchExec(f: Function, context: ExecContext) {
        // Update any built-in input args.
        // TODO: handle input structs.
        for (const arg of f.node.args) {
            for (const attr of arg.attributes) {
                if (attr.name === "builtin") {
                    const globalName = `@${attr.value}`;
                    const globalVar = context.variables.get(globalName);
                    if (globalVar !== undefined) {
                        context.variables.set(arg.name, globalVar);
                    }
                }
            }
        }

        this._execStatements(f.node.body, context);
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
        } else if (stmt instanceof AST.Struct) {
            return null;
        } else if (stmt instanceof AST.Override) {
            const name = (stmt as AST.Override).name;
            if (!context.variables.has(name)) {
                console.error(`Override constant ${name} not found`);
                return null;
            }
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
        if (v.value instanceof Data) {
            this._setDataValue(v.value, value, node.variable.postfix, context);
        } else if (node.variable.postfix) {
            if (node.variable.postfix instanceof AST.ArrayIndex) {
                const idx = this._evalExpression(node.variable.postfix.index, context);
                // TODO: use array format to determine how to set the value
                if (v.value.length !== undefined) {
                    if (v.node.type.isArray) {
                        const arrayType = v.node.type as AST.ArrayType;
                        if (arrayType.format.name === "vec3" ||
                            arrayType.format.name === "vec3u" ||
                            arrayType.format.name === "vec3i" ||
                            arrayType.format.name === "vec3f") {
                            v.value[idx * 3 + 0] = value[0];
                            v.value[idx * 3 + 1] = value[1];
                            v.value[idx * 3 + 2] = value[2];
                        } else if (arrayType.format.name === "vec4" ||
                            arrayType.format.name === "vec4u" ||
                            arrayType.format.name === "vec4i" ||
                            arrayType.format.name === "vec4f") {
                            v.value[idx * 4 + 0] = value[0];
                            v.value[idx * 4 + 1] = value[1];
                            v.value[idx * 4 + 2] = value[2];
                            v.value[idx * 4 + 3] = value[3];
                        } else {
                            v.value[idx] = value;
                        }
                    } else {
                        v.value[idx] = value;
                    }
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
        const v = new Var(node.name, value, node);
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
        } else if (node instanceof AST.StringExpr) {
            return (node as AST.StringExpr).value;
        } else if (node instanceof AST.VariableExpr) {
            return this._evalVariable(node as AST.VariableExpr, context);
        } else if (node instanceof AST.CallExpr) {
            return this._evalCall(node as AST.CallExpr, context);
        } else if (node instanceof AST.CreateExpr) {
            return this._evalCreate(node as AST.CreateExpr, context);
        } else {
            console.error(`Unknown expression type`, node);
        }
        return null;
    }

    _evalCreate(node: AST.CreateExpr, context: ExecContext) {
        if (node.type.name === "f32") {
            return this._evalExpression(node.args[0], context);
        } else if (node.type.name == "i32") {
            return this._evalExpression(node.args[0], context);
        } else if (node.type.name == "u32") {
            return this._evalExpression(node.args[0], context);
        } else if (node.type.name == "vec2f") {
            return [this._evalExpression(node.args[0], context), this._evalExpression(node.args[1], context)];
        } else if (node.type.name == "vec3f") {
            return [this._evalExpression(node.args[0], context), this._evalExpression(node.args[1], context), this._evalExpression(node.args[2], context)];
        } else if (node.type.name == "vec4f") {
            return [this._evalExpression(node.args[0], context), this._evalExpression(node.args[1], context), this._evalExpression(node.args[2], context), this._evalExpression(node.args[3], context)];
        } else if (node.type.name == "vec2i") {
            return [this._evalExpression(node.args[0], context), this._evalExpression(node.args[1], context)];
        } else if (node.type.name == "vec3i") {
            return [this._evalExpression(node.args[0], context), this._evalExpression(node.args[1], context), this._evalExpression(node.args[2], context)];
        } else if (node.type.name == "vec4i") {
            return [this._evalExpression(node.args[0], context), this._evalExpression(node.args[1], context), this._evalExpression(node.args[2], context), this._evalExpression(node.args[3], context)];
        } else if (node.type.name == "vec2u") {
            return [this._evalExpression(node.args[0], context), this._evalExpression(node.args[1], context)];
        } else if (node.type.name == "vec3u") {
            return [this._evalExpression(node.args[0], context), this._evalExpression(node.args[1], context), this._evalExpression(node.args[2], context)];
        } else if (node.type.name == "vec4u") {
            return [this._evalExpression(node.args[0], context), this._evalExpression(node.args[1], context), this._evalExpression(node.args[2], context), this._evalExpression(node.args[3], context)];
        }
        console.error(`Unknown type ${node.type.name}`);
        return null;
    }

    _evalLiteral(node: AST.LiteralExpr, context: ExecContext) {
        return node.value;
    }

    _getArraySwizzle(value: any, member: string) {
        const swizzleIndex = { "x": 0, "y": 1, "z": 2, "w": 3, "r": 0, "g": 1, "b": 2, "a": 3 };
        const m = member.toLocaleLowerCase();
        if (member.length === 1) {
            const idx = swizzleIndex[m];
            if (idx !== undefined) {
                return value[idx];
            }
        } else if (member.length === 2) {
            const idx0 = swizzleIndex[m[0]];
            const idx1 = swizzleIndex[m[1]];
            if (idx0 !== undefined && idx1 !== undefined) {
                return [value[idx0], value[idx1]];
            }
        } else if (member.length === 3) {
            const idx0 = swizzleIndex[m[0]];
            const idx1 = swizzleIndex[m[1]];
            const idx2 = swizzleIndex[m[2]];
            if (idx0 !== undefined && idx1 !== undefined && idx2 !== undefined) {
                return [value[idx0], value[idx1], value[idx2]];
            }
        } else if (member.length === 4) {
            const idx0 = swizzleIndex[m[0]];
            const idx1 = swizzleIndex[m[1]];
            const idx2 = swizzleIndex[m[2]];
            const idx3 = swizzleIndex[m[3]];
            if (idx0 !== undefined && idx1 !== undefined && idx2 !== undefined && idx3 !== undefined) {
                return [value[idx0], value[idx1], value[idx2], value[idx3]];
            }
        }
        console.error(`Unknown member ${member}`);
        return null;
    }

    _evalVariable(node: AST.VariableExpr, context: ExecContext) {
        const value = context.getVariableValue(node.name);
        if (value instanceof Data) {
            return this._getDataValue(value, node.postfix, context);
        }
        if (node.postfix) {
            if (node.postfix instanceof AST.ArrayIndex) {
                const idx = this._evalExpression(node.postfix.index, context);
                if (value?.length !== undefined) {
                    return value[idx];
                } else {
                    console.error(`Variable ${node.name} is not an array`);
                }
            } else if (node.postfix instanceof AST.StringExpr) {
                const member = node.postfix.value;
                if (value instanceof Array) {
                    return this._getArraySwizzle(value, member);
                } else {
                    const variable = context.variables.get(node.name);
                    if (variable) {
                        if (variable.node.type?.isStruct) {
                            const structInfo = this.reflection.getStructInfo(variable.node.type.name);
                            for (const m of structInfo.members) {
                                if (m.name === member) {
                                    const v = new Float32Array(variable.value.buffer, m.offset);
                                    if (node.postfix.postfix) {
                                        const postfix = this._evalExpression(node.postfix.postfix, context);
                                        return this._getArraySwizzle(value, postfix);
                                    }
                                    return v;
                                }
                            }
                            console.log(structInfo);
                        }
                    }
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
                if (l.length !== undefined && r.length !== undefined) {
                    if (l.length !== r.length) {
                        console.error(`Vector length mismatch`);
                        return null;
                    }
                    return l.map((x: number, i: number) => x > r[i])
                }
                return l > r;
            case "<":
                if (l.length !== undefined && r.length !== undefined) {
                    if (l.length !== r.length) {
                        console.error(`Vector length mismatch`);
                        return null;
                    }
                    return l.map((x: number, i: number) => x < r[i])
                }
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
            return this._callIntrinsicFunction(node, context);
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

    _callIntrinsicFunction(node: AST.CallExpr, context: ExecContext) {
        switch (node.name) {
            case "any":
                return this._callIntrinsicAny(node, context);
            case "all":
                return this._callIntrinsicAll(node, context);
        }
        console.error(`Function ${node.name} not found`);
        return null;
    }

    _callIntrinsicAny(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        return value.some((v) => v);
    }

    _callIntrinsicAll(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        return value.all((v) => v);
    }

    _getTypeName(type: TypeInfo): string {
        let name = type.name;
        if (type instanceof TemplateInfo) {
            if (name === "vec2" || name === "vec3" || name === "vec4") {
                if (type.format.name === "f32") {
                    name += "f";
                    return name;
                } else if (type.format.name === "i32") {
                    name += "i";
                    return name;
                } else if (type.format.name === "u32") {
                    name += "u";
                    return name;
                }
            }
            name += `<${type.format.name}>`;
        }
        return name;
    }

    _setDataValue(data: Data, value: any, postfix: AST.Expression | null, context: ExecContext) {
        let offset = 0;
        let typeInfo = data.typeInfo;
        while (postfix) {
            if (postfix instanceof AST.ArrayIndex) {
                if (typeInfo instanceof ArrayInfo) {
                    const idx = postfix.index;
                    if (idx instanceof AST.LiteralExpr) {
                        offset += idx.value * typeInfo.stride;
                    } else {
                        const i = this._evalExpression(idx, context);
                        if (i !== null) {
                            offset += i * typeInfo.stride;
                        } else {
                            console.error(`SetDataValue: Unknown index type`, idx);
                            return;
                        }
                    }
                    typeInfo = typeInfo.format;
                } else {
                    console.error(`SetDataValue: Type ${data.type.name} is not an array`);
                }
            } else if (postfix instanceof AST.StringExpr) {
                const member = postfix.value;
                if (typeInfo instanceof StructInfo) {
                    let found = false;
                    for (const m of typeInfo.members) {
                        if (m.name === member) {
                            offset += m.offset;
                            typeInfo = m.type;
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        console.error(`SetDataValue: Member ${member} not found`);
                        return;
                    }
                } else if (typeInfo instanceof TypeInfo) {
                    const typeName = this._getTypeName(typeInfo);
                    let element = 0;
                    if (member === "x" || member === "r") {
                        element = 0;
                    } else if (member === "y" || member === "g") {
                        element = 1;
                    } else if (member === "z" || member === "b") {
                        element = 2;
                    } else if (member === "w" || member === "a") {
                        element = 3;
                    } else {
                        console.error(`SetDataValue: Unknown member ${member}`);
                        return;
                    }
                    if (typeName === "vec2f") {
                        new Float32Array(data.buffer, offset, 2)[element] = value;
                        return;
                    } else if (typeName === "vec3f") {
                        new Float32Array(data.buffer, offset, 3)[element] = value;
                        return;
                    } else if (typeName === "vec4f") {
                        new Float32Array(data.buffer, offset, 4)[element] = value;
                        return;
                    } else if (typeName === "vec2i") {
                        new Int32Array(data.buffer, offset, 2)[element] = value;
                        return;
                    } else if (typeName === "vec3i") {
                        new Int32Array(data.buffer, offset, 3)[element] = value;
                        return;
                    } else if (typeName === "vec4i") {
                        new Int32Array(data.buffer, offset, 4)[element] = value;
                        return;
                    } else if (typeName === "vec2u") {
                        new Uint32Array(data.buffer, offset, 2)[element] = value;
                        return;
                    } else if (typeName === "vec3u") {
                        new Uint32Array(data.buffer, offset, 3)[element] = value;
                        return;
                    } else if (typeName === "vec4u") {
                        new Uint32Array(data.buffer, offset, 4)[element] = value;
                        return;
                    }
                    console.error(`SetDataValue: Type ${data.type.name} is not a struct`);
                    return;
                }
            } else {
                console.error(`SetDataValue: Unknown postfix type`, postfix);
                return;
            }
            postfix = postfix.postfix;
        }

        const typeName = this._getTypeName(typeInfo);

        if (typeName === "f32") {
            new Float32Array(data.buffer, offset, 1)[0] = value;
            return;
        } else if (typeName === "i32") {
            new Int32Array(data.buffer, offset, 1)[0] = value;
            return;
        } else if (typeName === "u32") {
            new Uint32Array(data.buffer, offset, 1)[0] = value;
            return;
        } else if (typeName === "vec2f") {
            const x = new Float32Array(data.buffer, offset, 2);
            x[0] = value[0];
            x[1] = value[1];
            return;
        } else if (typeName === "vec3f") {
            const x = new Float32Array(data.buffer, offset, 3);
            x[0] = value[0];
            x[1] = value[1];
            x[2] = value[2];
            return;
        } else if (typeName === "vec4f") {
            const x = new Float32Array(data.buffer, offset, 4);
            x[0] = value[0];
            x[1] = value[1];
            x[2] = value[2];
            x[3] = value[3];
            return;
        } else if (typeName === "vec2i") {
            const x = new Int32Array(data.buffer, offset, 2);
            x[0] = value[0];
            x[1] = value[1];
            return;
        } else if (typeName === "vec3i") {
            const x = new Int32Array(data.buffer, offset, 3);
            x[0] = value[0];
            x[1] = value[1];
            x[2] = value[2];
            return;
        } else if (typeName === "vec4i") {
            const x = new Int32Array(data.buffer, offset, 4);
            x[0] = value[0];
            x[1] = value[1];
            x[2] = value[2];
            x[3] = value[3];
            return;
        } else if (typeName === "vec2u") {
            const x = new Uint32Array(data.buffer, offset, 2);
            x[0] = value[0];
            x[1] = value[1];
            return;
        } else if (typeName === "vec3u") {
            const x = new Uint32Array(data.buffer, offset, 3);
            x[0] = value[0];
            x[1] = value[1];
            x[2] = value[2];
            return;
        } else if (typeName === "vec4u") {
            const x = new Uint32Array(data.buffer, offset, 4);
            x[0] = value[0];
            x[1] = value[1];
            x[2] = value[2];
            x[3] = value[3];
            return;
        }

        console.error(`SetDataValue: Unknown type ${data.type.name}`);
    }

    _getDataValue(data: Data, postfix: AST.Expression | null, context: ExecContext): any {
        let offset = 0;
        let typeInfo = data.typeInfo;
        while (postfix) {
            if (postfix instanceof AST.ArrayIndex) {
                if (typeInfo instanceof ArrayInfo) {
                    const idx = postfix.index;
                    if (idx instanceof AST.LiteralExpr) {
                        offset += idx.value * typeInfo.stride;
                    } else {
                        const i = this._evalExpression(idx, context);
                        if (i !== null) {
                            offset += i * typeInfo.stride;
                        } else {
                            console.error(`GetDataValue: Unknown index type`, idx);
                            return null;
                        }
                    }
                    typeInfo = typeInfo.format;
                } else {
                    console.error(`Type ${data.type.name} is not an array`);
                }
            } else if (postfix instanceof AST.StringExpr) {
                const member = postfix.value;
                if (typeInfo instanceof StructInfo) {
                    let found = false;
                    for (const m of typeInfo.members) {
                        if (m.name === member) {
                            offset += m.offset;
                            typeInfo = m.type;
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        console.error(`GetDataValue: Member ${member} not found`);
                        return null;
                    }
                } else if (typeInfo instanceof TypeInfo) {
                    const typeName = this._getTypeName(typeInfo);
                    let element = 0;
                    if (member === "x" || member === "r") {
                        element = 0;
                    } else if (member === "y" || member === "g") {
                        element = 1;
                    } else if (member === "z" || member === "b") {
                        element = 2;
                    } else if (member === "w" || member === "a") {
                        element = 3;
                    } else {
                        console.error(`Unknown member ${member}`);
                        return null;
                    }
                    if (typeName === "vec2f") {
                        return new Float32Array(data.buffer, offset, 2)[element];
                    } else if (typeName === "vec3f") {
                        return new Float32Array(data.buffer, offset, 3)[element];
                    } else if (typeName === "vec4f") {
                        return new Float32Array(data.buffer, offset, 4)[element];
                    } else if (typeName === "vec2i") {
                        return new Int32Array(data.buffer, offset, 2)[element];
                    } else if (typeName === "vec3i") {
                        return new Int32Array(data.buffer, offset, 3)[element];
                    } else if (typeName === "vec4i") {
                        return new Int32Array(data.buffer, offset, 4)[element];
                    } else if (typeName === "vec2u") {
                        return new Uint32Array(data.buffer, offset, 2)[element];
                    } else if (typeName === "vec3u") {
                        return new Uint32Array(data.buffer, offset, 3)[element];
                    } else if (typeName === "vec4u") {
                        return new Uint32Array(data.buffer, offset, 4)[element];
                    }
                    console.error(`GetDataValue: Type ${data.type.name} is not a struct`);
                    return null;
                }
            } else {
                console.error(`GetDataValue: Unknown postfix type`, postfix);
                return null;
            }
            postfix = postfix.postfix;
        }

        const typeName = this._getTypeName(typeInfo);

        if (typeName === "f32") {
            return new Float32Array(data.buffer, offset, 1)[0];
        } else if (typeName === "i32") {
            return new Int32Array(data.buffer, offset, 1)[0];
        } else if (typeName === "u32") {
            return new Uint32Array(data.buffer, offset, 1)[0];
        } else if (typeName === "vec2f") {
            return new Float32Array(data.buffer, offset, 2);
        } else if (typeName === "vec3f") {
            return new Float32Array(data.buffer, offset, 3);
        } else if (typeName === "vec4f") {
            return new Float32Array(data.buffer, offset, 4);
        } else if (typeName === "vec2i") {
            return new Int32Array(data.buffer, offset, 2);
        } else if (typeName === "vec3i") {
            return new Int32Array(data.buffer, offset, 3);
        } else if (typeName === "vec4i") {
            return new Int32Array(data.buffer, offset, 4);
        } else if (typeName === "vec2u") {
            return new Uint32Array(data.buffer, offset, 2);
        } else if (typeName === "vec3u") {
            return new Uint32Array(data.buffer, offset, 3);
        } else if (typeName === "vec4u") {
            return new Uint32Array(data.buffer, offset, 4);
        }

        console.error(`GET Unknown type ${data.type.name}`);
        return null;
    }
}
