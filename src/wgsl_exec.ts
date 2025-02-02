import * as AST from "./wgsl_ast.js";
import { WgslParser } from "./wgsl_parser.js";
import { WgslReflect, TypeInfo, ArrayInfo, StructInfo, MemberInfo, TemplateInfo } from "./wgsl_reflect.js";

class Data {
    buffer: ArrayBuffer;
    typeInfo: TypeInfo;
    offset: number;
    textureSize: number[] = [0, 0, 0];

    constructor(data: ArrayBuffer | Float32Array | Uint32Array | Int32Array | Uint8Array | Int8Array,
        typeInfo: TypeInfo, offset: number = 0, textureSize?: number[]) {
        this.buffer = data instanceof ArrayBuffer ? data : data.buffer;
        this.typeInfo = typeInfo;
        this.offset = offset;
        if (textureSize !== undefined) {
            this.textureSize = textureSize;
        }
    }
};

type ASTVarNode = AST.Let | AST.Var | AST.Argument;

class Var {
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
    parent: ExecContext | null = null;
    variables: Map<string, Var> = new Map<string, Var>();
    functions: Map<string, Function> = new Map<string, Function>();

    constructor(parent?: ExecContext) {
        if (parent) {
            this.parent = parent;
        }
    }

    getVariable(name: string): Var | null {
        if (this.variables.has(name)) {
            return this.variables.get(name);
        }
        if (this.parent) {
            return this.parent.getVariable(name);
        }
        return null;
    }

    getFunction(name: string): Function | null {
        if (this.functions.has(name)) {
            return this.functions.get(name);
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
    }

    getVariableValue(name: string) {
        return this.context.getVariableValue(name);
    }

    execute(config?: Object) {
        config = config ?? {};
        if (config["constants"]) {
            for (const k in config["constants"]) {
                const v = config["constants"][k];
                this.context.setVariable(k, v);
            }
        }

        this._execStatements(this.ast, this.context);
    }

    dispatchWorkgroups(kernel: string, dispatchCount: number | number[], bindGroups: Object, config?: Object) {
        const context = this.context.clone();

        config = config ?? {};
        if (config["constants"]) {
            for (const k in config["constants"]) {
                const v = config["constants"][k];
                context.setVariable(k, v);
            }
        }

        this._execStatements(this.ast, context);

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

        context.setVariable("@num_workgroups", dispatchCount);

        for (const set in bindGroups) {
            for (const binding in bindGroups[set]) {
                const entry = bindGroups[set][binding];

                context.variables.forEach((v) => {
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
                            if (entry.data !== undefined && entry.size !== undefined) {
                                v.value = new Data(entry.data, this._getTypeInfo(node.type), 0, entry.size);
                            } else {
                                v.value = new Data(entry, this._getTypeInfo(node.type));
                            }
                        }
                    }
                });
            }
        }

        for (let z = 0; z < depth; ++z) {
            for (let y = 0; y < height; ++y) {
                for (let x = 0; x < width; ++x) {
                    context.setVariable("@workgroup_id", [x, y, z]);
                    this._dispatchWorkgroup(f, [x, y, z], context);
                }
            }
        }
    }

    _dispatchWorkgroup(f: Function, workgroup_id: number[], context: ExecContext) {
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

        context.setVariable("@workgroup_size", workgroupSize);

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

                    context.setVariable("@local_invocation_id", local_invocation_id);
                    context.setVariable("@global_invocation_id", global_invocation_id);
                    context.setVariable("@local_invocation_index", li);

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
                    const globalVar = context.getVariable(globalName);
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
            // Block statements are declared as arrays of statements.
            if (stmt instanceof Array) {
                const subContext = context.clone();
                const res = this._execStatements(stmt, subContext);
                if (res) {
                    return res;
                }
                continue;
            }

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
        } else if (stmt instanceof AST.Const) {
            this._const(stmt as AST.Const, context);
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
        } else if (stmt instanceof AST.Increment) {
            this._increment(stmt as AST.Increment, context);
        } else if (stmt instanceof AST.Struct) {
            return null;
        } else if (stmt instanceof AST.Override) {
            const name = (stmt as AST.Override).name;
            if (context.getVariable(name) === null) {
                console.error(`Override constant ${name} not found. Line ${stmt.line}`);
                return null;
            }
        } else {
            console.error(`Unknown statement type.`, stmt, `Line ${stmt.line}`);
        }
        return null;
    }

    _increment(node: AST.Increment, context: ExecContext) {
        const name = this._getVariableName(node.variable, context);
        const v = context.getVariable(name);
        if (!v) {
            console.error(`Variable ${name} not found. Line ${node.line}`);
            return;
        }
        if (node.operator === "++") {
            v.value++;
        } else if (node.operator === "--") {
            v.value--;
        }
        return v.value;
    }

    _getVariableName(node: AST.Node, context: ExecContext) {
        if (node instanceof AST.VariableExpr) {
            return (node as AST.VariableExpr).name;
        } else {
            console.error(`Unknown variable type`, node, 'Line', node.line);
        }
        return null;
    }

    _assign(node: AST.Assign, context: ExecContext) {
        const name = this._getVariableName(node.variable, context);
        const v = context.getVariable(name);

        if (!v) {
            console.error(`Variable ${name} not found. Line ${node.line}`);
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
                    console.error(`Variable ${v.name} is not an array. Line ${node.line}`);
                }
            } else if (node.variable.postfix instanceof AST.StringExpr) {
                console.error(`TODO Struct member. Line ${node.line}`);
            }
        } else {
            v.value = value;
        }
    }

    _function(node: AST.Function, context: ExecContext) {
        const f = new Function(node);
        context.functions.set(node.name, f);
    }

    _const(node: AST.Const, context: ExecContext) {
        let value = null;
        if (node.value != null) {
            value = this._evalExpression(node.value, context);
        }
        context.createVariable(node.name, value, node);
    }

    _let(node: AST.Let, context: ExecContext) {
        let value = null;
        if (node.value != null) {
            value = this._evalExpression(node.value, context);
        }
        context.createVariable(node.name, value, node);
    }

    _var(node: AST.Var, context: ExecContext) {
        let value = null;
        if (node.value != null) {
            value = this._evalExpression(node.value, context);
        }
        context.createVariable(node.name, value, node);
    }

    _if(node: AST.If, context: ExecContext) {
        context = context.clone();
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
        context = context.clone();
        this._execStatement(node.init, context);
        while (this._evalExpression(node.condition, context)) {
            const res = this._execStatements(node.body, context);
            if (res) {
                return res;
            }
            this._execStatement(node.increment, context);
        }

        return null;
    }

    _while(node: AST.While, context: ExecContext) {
        context = context.clone();
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
        } else if (node instanceof AST.ConstExpr) {
            return this._evalConst(node as AST.ConstExpr, context);
        }
        console.error(`Unknown expression type`, node, `Line ${node.line}`);
        return null;
    }

    _evalConst(node: AST.ConstExpr, context: ExecContext) {
        const v = context.getVariableValue(node.name);
        return v;
    }

    _evalCreate(node: AST.CreateExpr, context: ExecContext) {
        const typeName = this._getTypeName(node.type);

        switch (typeName) {
            // Constructor Built-in Functions
            // Value Constructor Built-in Functions
            case "bool":
            case "i32":
            case "u32":
            case "f32":
            case "f16":
                return this._callConstructorValue(node, context);
            case "vec2":
            case "vec3":
            case "vec4":
            case "vec2f":
            case "vec3f":
            case "vec4f":
            case "vec2i":
            case "vec3i":
            case "vec4i":
            case "vec2u":
            case "vec3u":
            case "vec4u":
                return this._callConstructorVec(node, context);
            case "mat2x2":
            case "mat2x2i":
            case "mat2x2u":
            case "mat2x2f":
            case "mat2x3":
            case "mat2x3i":
            case "mat2x3u":
            case "mat2x3f":
            case "mat2x4":
            case "mat2x4i":
            case "mat2x4u":
            case "mat2x4f":
            case "mat3x2":
            case "mat3x2i":
            case "mat3x2u":
            case "mat3x2f":
            case "mat3x3":
            case "mat3x3i":
            case "mat3x3u":
            case "mat3x3f":
            case "mat3x4":
            case "mat3x4i":
            case "mat3x4u":
            case "mat3x4f":
            case "mat4x2":
            case "mat4x2i":
            case "mat4x2u":
            case "mat4x2f":
            case "mat4x3":
            case "mat4x3i":
            case "mat4x3u":
            case "mat4x3f":
            case "mat4x4":
            case "mat4x4i":
            case "mat4x4u":
            case "mat4x4f":
                return this._callConstructorMatrix(node, context);
            case "array":
                return this._callConstructorArray(node, context);
        }

        const typeInfo = this._getTypeInfo(node.type);
        if (typeInfo === null) {
            console.error(`Unknown type ${typeName}. Line ${node.line}`);
            return null;
        }

        const data = new Data(new ArrayBuffer(typeInfo.size), typeInfo, 0);

        // Assign the values in node.args to the data.
        if (typeInfo instanceof StructInfo) {
            for (let i = 0; i < node.args.length; ++i) {
                const memberInfo = typeInfo.members[i];
                const arg = node.args[i];
                const value = this._evalExpression(arg, context);
                this._setData(data, value, memberInfo.type, memberInfo.offset, context);
            }
        } else {
            console.error(`Unknown type "${typeName}". Line ${node.line}`);
        }

        return data;
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
                    console.error(`Variable ${node.name} is not an array. Line ${node.line}`);
                }
            } else if (node.postfix instanceof AST.StringExpr) {
                const member = node.postfix.value;
                if (value instanceof Array) {
                    return this._getArraySwizzle(value, member);
                } else {
                    const variable = context.getVariable(node.name);
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
                    console.error(`Unknown variable postfix`, node.postfix, `. Line ${node.line}`);
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
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    return l.map((x: number, i: number) => x > r[i])
                }
                return l > r;
            case "<":
                if (l.length !== undefined && r.length !== undefined) {
                    if (l.length !== r.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
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
        console.error(`Unknown operator ${node.operator}. Line ${node.line}`);
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
            subContext.setVariable(arg.name, value, arg);
        }

        return this._execStatements(f.node.body, subContext);
    }

    _callIntrinsicFunction(node: AST.CallExpr, context: ExecContext) {
        switch (node.name) {
            case "all":
                return this._callAll(node, context);
            case "any":
                return this._callAny(node, context);
            case "arrayLength":
                return this._callArrayLength(node, context);
            case "dot":
                return this._callDot(node, context);
            case "min":
                return this._callMin(node, context);
            case "max":
                return this._callMax(node, context);
            case "saturate":
                return this._callSaturate(node, context);
            case "select":
                return this._callSelect(node, context);

            case "textureDimensions":
                return this._callTextureDimensions(node, context);
            case "textureLoad":
                return this._callTextureLoad(node, context);

            // Constructor Built-in Functions
            // Value Constructor Built-in Functions
            case "bool":
            case "i32":
            case "u32":
            case "f32":
            case "f16":
                return this._callConstructorValue(node, context);
            case "vec2":
            case "vec3":
            case "vec4":
            case "vec2f":
            case "vec3f":
            case "vec4f":
            case "vec2i":
            case "vec3i":
            case "vec4i":
            case "vec2u":
            case "vec3u":
            case "vec4u":
                return this._callConstructorVec(node, context);
            case "mat2x2":
            case "mat2x3":
            case "mat2x4":
            case "mat3x2":
            case "mat3x3":
            case "mat3x4":
            case "mat4x2":
            case "mat4x3":
            case "mat4x4":
                return this._callConstructorMatrix(node, context);
            case "array":
                return this._callConstructorArray(node, context);
        }

        const f = context.getFunction(node.name);
        if (f) {
            const subContext = context.clone();
            for (let ai = 0; ai < f.node.args.length; ++ai) {
                const arg = f.node.args[ai];
                const value = this._evalExpression(node.args[ai], subContext);
                subContext.setVariable(arg.name, value, arg);
            }
            return this._execStatements(f.node.body, subContext);
        }

        console.error(`Function ${node.name} not found. Line ${node.line}`);
        return null;
    }

    _callDot(node: AST.CallExpr, context: ExecContext) {
        const l = this._evalExpression(node.args[0], context);
        const r = this._evalExpression(node.args[1], context);
        let sum = 0;
        for (let i = 0; i < l.length; ++i) {
            sum += l[i] * r[i];
        }
        return sum;
    }

    _callMin(node: AST.CallExpr, context: ExecContext) {
        const l = this._evalExpression(node.args[0], context);
        const r = this._evalExpression(node.args[1], context);
        return Math.min(l, r);
    }

    _callMax(node: AST.CallExpr, context: ExecContext) {
        const l = this._evalExpression(node.args[0], context);
        const r = this._evalExpression(node.args[1], context);
        return Math.max(l, r);
    }

    _callSaturate(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        return Math.min(Math.max(value, 0), 1);
    }

    _callTextureLoad(node: AST.CallExpr, context: ExecContext) {
        return [0, 0, 0, 0];
    }

    _callArrayLength(node: AST.CallExpr, context: ExecContext) {
        let arrayArg = node.args[0];
        // TODO: handle "&" operator
        if (arrayArg instanceof AST.UnaryOperator) {
            arrayArg = (arrayArg as AST.UnaryOperator).right;
        }
        const arrayData = this._evalExpression(arrayArg, context);
        if (arrayData.typeInfo.size === 0) {
            const count = arrayData.buffer.byteLength / arrayData.typeInfo.stride;
            return count;
        }
        return arrayData.typeInfo.size;
    }

    _callConstructorValue(node: AST.CallExpr | AST.CreateExpr, context: ExecContext) {
        if (node.args.length === 0) {
            return 0;
        }
        return this._evalExpression(node.args[0], context);
    }

    _callConstructorArray(node: AST.CallExpr | AST.CreateExpr, context: ExecContext) {
        if (node.args.length === 0) {
            if (node instanceof AST.CreateExpr) {
                if (node.type instanceof AST.ArrayType) {
                    if (node.type.count) {
                        const format = node.type.format.name;
                        if (format === "bool" || format === "i32" || format === "u32" || format === "f32" || format === "f16") {
                            return new Array(node.type.count).fill(0);
                        } else if (format === "vec2" || format === "vec2u" || format === "vec2i" || format === "vec2f") {
                            return new Array(node.type.count).fill([0, 0]);
                        } else if (format === "vec3" || format === "vec3u" || format === "vec3i" || format === "vec3f") {
                            return new Array(node.type.count).fill([0, 0, 0]);
                        } else if (format === "vec4" || format === "vec4u" || format === "vec4i" || format === "vec4f") {
                            return new Array(node.type.count).fill([0, 0, 0, 0]);
                        } else if (format === "mat2x2") {
                            return new Array(node.type.count).fill([0, 0, 0, 0]);
                        } else if (format === "mat2x3") {
                            return new Array(node.type.count).fill([0, 0, 0, 0, 0, 0]);
                        } else if (format === "mat2x4") {
                            return new Array(node.type.count).fill([0, 0, 0, 0, 0, 0, 0, 0]);
                        } else if (format === "mat3x2") {
                            return new Array(node.type.count).fill([0, 0, 0, 0, 0, 0]);
                        } else if (format === "mat3x3") {
                            return new Array(node.type.count).fill([0, 0, 0, 0, 0, 0, 0, 0, 0]);
                        } else if (format === "mat3x4") {
                            return new Array(node.type.count).fill([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
                        } else if (format === "mat4x2") {
                            return new Array(node.type.count).fill([0, 0, 0, 0, 0, 0, 0, 0]);
                        } else if (format === "mat4x3") {
                            return new Array(node.type.count).fill([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
                        } else if (format === "mat4x4") {
                            return new Array(node.type.count).fill([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
                        } else {
                            console.error(`TODO: support array format ${format}. Line ${node.line}`);
                            return null;
                        }
                    }
                }
            }
            return [];
        }
        const values = [];
        for (const arg of node.args) {
            values.push(this._evalExpression(arg, context));
        }
        return values;
    }

    _callConstructorVec(node: AST.CallExpr | AST.CreateExpr, context: ExecContext) {
        const typeName = node instanceof AST.CallExpr ? node.name : this._getTypeName(node.type);
        if (node.args.length === 0) {
            if (typeName === "vec2" || typeName === "vec2f" || typeName === "vec2i" || typeName === "vec2u") {
                return [0, 0];
            } else if (typeName === "vec3" || typeName === "vec3f" || typeName === "vec3i" || typeName === "vec3u") {
                return [0, 0, 0];
            } else if (typeName === "vec4" || typeName === "vec4f" || typeName === "vec4i" || typeName === "vec4u") {
                return [0, 0, 0, 0];
            }
            console.error(`Invalid vec constructor ${typeName}. Line ${node.line}`);
            return null;
        }

        const values = [];
        // TODO: make sure the number of args matches the vector length.
        for (const arg of node.args) {
            values.push(this._evalExpression(arg, context));
        }
        return values;
    }

    _callConstructorMatrix(node: AST.CallExpr | AST.CreateExpr, context: ExecContext) {
        const typeName = node instanceof AST.CallExpr ? node.name : this._getTypeName(node.type);
        if (node.args.length === 0) {
            if (typeName === "mat2x2" || typeName === "mat2x2f" || typeName === "mat2x2i" || typeName === "mat2x2u") {
                return [0, 0, 0, 0];
            } else if (typeName === "mat2x3" || typeName === "mat2x3f" || typeName === "mat2x3i" || typeName === "mat2x3u") {
                return [0, 0, 0, 0, 0, 0];
            } else if (typeName === "mat2x4" || typeName === "mat2x4f" || typeName === "mat2x4i" || typeName === "mat2x4u") {
                return [0, 0, 0, 0, 0, 0, 0, 0];
            } else if (typeName === "mat3x2" || typeName === "mat3x2f" || typeName === "mat3x2i" || typeName === "mat3x2u") {
                return [0, 0, 0, 0, 0, 0];
            } else if (typeName === "mat3x3" || typeName === "mat3x3f" || typeName === "mat3x3i" || typeName === "mat3x3u") {
                return [0, 0, 0, 0, 0, 0, 0, 0, 0];
            } else if (typeName === "mat3x4" || typeName === "mat3x4f" || typeName === "mat3x4i" || typeName === "mat3x4u") {
                return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            } else if (typeName === "mat4x2" || typeName === "mat4x2f" || typeName === "mat4x2i" || typeName === "mat4x2u") {
                return [0, 0, 0, 0, 0, 0, 0, 0];
            } else if (typeName === "mat4x3" || typeName === "mat4x3f" || typeName === "mat4x3i" || typeName === "mat4x3u") {
                return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            } else if (typeName === "mat4x4" || typeName === "mat4x4f" || typeName === "mat4x4i" || typeName === "mat4x4u") {
                return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            }
            console.error(`Invalid matrix constructor ${typeName}. Line ${node.line}`);
            return null;
        }

        const values = [];
        // TODO: make sure the number of args matches the matrix size.
        for (const arg of node.args) {
            values.push(this._evalExpression(arg, context));
        }

        return values;
    }

    _callAny(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        return value.some((v: any) => v);
    }

    _callAll(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        let isTrue = true;
        value.forEach((x: any) => { if (!x) isTrue = false; });
        return isTrue;
    }

    _callSelect(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        let isTrue = true;
        value.forEach((x: any) => { if (!x) isTrue = false; });
        return isTrue;
    }

    _callTextureDimensions(node: AST.CallExpr, context: ExecContext) {
        const textureArg = node.args[0];
        const level = node.args.length > 1 ? this._evalExpression(node.args[1], context) : 0;
        if (textureArg instanceof AST.VariableExpr) {
            const textureName = (textureArg as AST.VariableExpr).name;
            const texture = context.getVariableValue(textureName);
            if (texture instanceof Data) {
                return texture.textureSize;
            } else {
                console.error(`Texture ${textureName} not found. Line ${node.line}`);
                return null;
            }
        }
        console.error(`Invalid texture argument for textureDimensions. Line ${node.line}`);
        return null;
    }

    _getTypeInfo(type: AST.Type): TypeInfo {
        return this.reflection._types.get(type);
    }

    _getTypeName(type: TypeInfo | AST.Type): string {
        if (type instanceof AST.Type) {
            type = this._getTypeInfo(type);
        }
        let name = type.name;
        if (type instanceof TemplateInfo) {
            if (type.format !== null) {
                if (name === "vec2" || name === "vec3" || name === "vec4" ||
                    name === "mat2x2" || name === "mat2x3" || name === "mat2x4" ||
                    name === "mat3x2" || name === "mat3x3" || name === "mat3x4" ||
                    name === "mat4x2" || name === "mat4x3" || name === "mat4x4") {
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
            } else {
                console.log("Template format is null.");
            }
        }
        return name;
    }

    _setDataValue(data: Data, value: any, postfix: AST.Expression | null, context: ExecContext) {
        if (value === null) {
            console.log("_setDataValue: NULL data");
            return;
        }

        let offset = data.offset;
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
                    console.error(`SetDataValue: Type ${this._getTypeName(typeInfo)} is not an array`);
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
                    console.error(`SetDataValue: Type ${typeName} is not a struct`);
                    return;
                }
            } else {
                console.error(`SetDataValue: Unknown postfix type`, postfix);
                return;
            }
            postfix = postfix.postfix;
        }

        this._setData(data, value, typeInfo, offset, context);
    }

    _setData(data: Data, value: any, typeInfo: TypeInfo, offset: number, context: ExecContext) {
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

        if (value instanceof Data) {
            if (typeInfo === value.typeInfo) {
                const x = new Uint8Array(data.buffer, offset, value.buffer.byteLength);
                x.set(new Uint8Array(value.buffer));
                return;
            } else {
                console.error(`SetDataValue: Type mismatch`, typeName, this._getTypeName(value.typeInfo));
                return;
            }
        }

        console.error(`SetDataValue: Unknown type ${typeName}`);
    }

    _getDataValue(data: Data, postfix: AST.Expression | null, context: ExecContext): any {
        let offset = data.offset;
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
                    console.error(`Type ${this._getTypeName(typeInfo)} is not an array`);
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
                        if ((offset + 12) >= data.buffer.byteLength) {
                            console.log("Insufficient buffer data");
                            return null;
                        }
                        const fa = new Float32Array(data.buffer, offset, 3);
                        return fa[element];
                    } else if (typeName === "vec4f") {
                        return new Float32Array(data.buffer, offset, 4)[element];
                    } else if (typeName === "vec2i") {
                        return new Int32Array(data.buffer, offset, 2)[element];
                    } else if (typeName === "vec3i") {
                        return new Int32Array(data.buffer, offset, 3)[element];
                    } else if (typeName === "vec4i") {
                        return new Int32Array(data.buffer, offset, 4)[element];
                    } else if (typeName === "vec2u") {
                        const ua = new Uint32Array(data.buffer, offset, 2);
                        return ua[element];
                    } else if (typeName === "vec3u") {
                        return new Uint32Array(data.buffer, offset, 3)[element];
                    } else if (typeName === "vec4u") {
                        return new Uint32Array(data.buffer, offset, 4)[element];
                    }
                    console.error(`GetDataValue: Type ${typeName} is not a struct`);
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

        const newData = new Data(data.buffer, typeInfo, offset);
        return newData;
    }
}
