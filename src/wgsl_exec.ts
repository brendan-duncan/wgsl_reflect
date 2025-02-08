import * as AST from "./wgsl_ast.js";
import { WgslParser } from "./wgsl_parser.js";
import { WgslReflect, TypeInfo, StructInfo, TemplateInfo } from "./wgsl_reflect.js";
import { ExecContext, Function } from "./exec/exec_context.js";
import { ExecInterface } from "./exec/exec_interface.js";
import { BuiltinFunctions } from "./exec/builtin_functions.js";
import { Data } from "./exec/data.js";

export class WgslExec extends ExecInterface {
    ast: Array<AST.Node>;
    context: ExecContext;
    reflection: WgslReflect;
    builtins: BuiltinFunctions;

    constructor(code: string, context?: ExecContext) {
        super();
        const parser = new WgslParser();
        this.ast = parser.parse(code);
        this.reflection = new WgslReflect();
        this.reflection.updateAST(this.ast);

        this.context = context?.clone() ?? new ExecContext();
        this.builtins = new BuiltinFunctions(this);
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
                            if (entry.texture !== undefined && entry.size !== undefined) {
                                // Texture
                                v.value = new Data(entry.texture, this._getTypeInfo(node.type), 0, entry.size);
                            } else if (entry.uniform !== undefined) {
                                // Uniform buffer
                                v.value = new Data(entry.uniform, this._getTypeInfo(node.type));
                            } else {
                                // Storage buffer
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
                if (name === "vec2" || name === "vec3" || name === "vec4") {
                    return name;
                }
                console.log("Template format is null.");
            }
        }
        return name;
    }

    _getVariableName(node: AST.Node, context: ExecContext) {
        if (node instanceof AST.VariableExpr) {
            return (node as AST.VariableExpr).name;
        } else {
            console.error(`Unknown variable type`, node, 'Line', node.line);
        }
        return null;
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
            const v = this._evalExpression(stmt.value, context);
            const f = context.getFunction(context.currentFunctionName);
            if (f?.node.returnType) {
                if (f.node.returnType.name === "i32" || f.node.returnType.name === "u32") {
                    return Math.floor(v);
                }
            }
            return v;
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

    _assign(node: AST.Assign, context: ExecContext) {
        const name = this._getVariableName(node.variable, context);
        const v = context.getVariable(name);

        if (!v) {
            console.error(`Variable ${name} not found. Line ${node.line}`);
            return null;
        }

        let value = this._evalExpression(node.value, context);

        if (node.operator !== "=") {
            const currentValue = v.value instanceof Data ? 
                v.value.getDataValue(this, node.variable.postfix, context) :
                v.value;

            if (currentValue instanceof Array && value instanceof Array) {
                if (currentValue.length !== value.length) {
                    console.error(`Vector length mismatch. Line ${node.line}`);
                    return;
                }

                if (node.operator === "+=") {
                    for (let i = 0; i < currentValue.length; ++i) {
                        value[i] = currentValue[i] + value[i];
                    }
                } else if (node.operator === "-=") {
                    for (let i = 0; i < currentValue.length; ++i) {
                        value[i] = currentValue[i] - value[i];
                    }
                } else if (node.operator === "*=") {
                    for (let i = 0; i < currentValue.length; ++i) {
                        value[i] = currentValue[i] * value[i];
                    }
                } else if (node.operator === "/=") {
                    for (let i = 0; i < currentValue.length; ++i) {
                        value[i] = currentValue[i] / value[i];
                    }
                } else if (node.operator === "%=") {
                    for (let i = 0; i < currentValue.length; ++i) {
                        value[i] = currentValue[i] % value[i];
                    }
                } else if (node.operator === "&=") {
                    for (let i = 0; i < currentValue.length; ++i) {
                        value[i] = currentValue[i] & value[i];
                    }
                } else if (node.operator === "|=") {
                    for (let i = 0; i < currentValue.length; ++i) {
                        value[i] = currentValue[i] | value[i];
                    }
                } else if (node.operator === "^=") {
                    for (let i = 0; i < currentValue.length; ++i) {
                        value[i] = currentValue[i] ^ value[i];
                    }
                } else if (node.operator === "<<=") {
                    for (let i = 0; i < currentValue.length; ++i) {
                        value[i] = currentValue[i] << value[i];
                    }
                } else if (node.operator === ">>=") {
                    for (let i = 0; i < currentValue.length; ++i) {
                        value[i] = currentValue[i] >> value[i];
                    }
                }
            } else {
                if (node.operator === "+=") {
                    value = currentValue + value;
                } else if (node.operator === "-=") {
                    value = currentValue - value;
                } else if (node.operator === "*=") {
                    value = currentValue * value;
                } else if (node.operator === "/=") {
                    value = currentValue / value;
                } else if (node.operator === "%=") {
                    value = currentValue % value;
                } else if (node.operator === "&=") {
                    value = currentValue & value;
                } else if (node.operator === "|=") {
                    value = currentValue | value;
                } else if (node.operator === "^=") {
                    value = currentValue - value;
                } else if (node.operator === "<<=") {
                    value = currentValue << value;
                } else if (node.operator === ">>=") {
                    value = currentValue >> value;
                }
            }
        }

        if (v.value instanceof Data) {
            v.value.setDataValue(this, value, node.variable.postfix, context);
        } else if (node.variable.postfix) {
            if (node.variable.postfix instanceof AST.ArrayIndex) {
                const idx = this._evalExpression(node.variable.postfix.index, context);
                // TODO: use array format to determine how to set the value
                if (v.value instanceof Array) {
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
        return null;
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
                this._callConstructorValue(node, context) ? 1 : 0;
            case "i32":
            case "u32":
                return Math.floor(this._callConstructorValue(node, context));
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
                data.setData(this, value, memberInfo.type, memberInfo.offset, context);
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
            return value.getDataValue(this, node.postfix, context);
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
        if (node.cachedReturnValue) {
            return node.cachedReturnValue;
        }

        const subContext = context.clone();
        subContext.currentFunctionName = node.name;

        const f = context.functions.get(node.name);
        if (!f) {
            return this._callBuiltinFunction(node, subContext);
        }

        for (let ai = 0; ai < f.node.args.length; ++ai) {
            const arg = f.node.args[ai];
            const value = this._evalExpression(node.args[ai], subContext);
            subContext.setVariable(arg.name, value, arg);
        }

        const res = this._execStatements(f.node.body, subContext);
        if (f.node.returnType) {
            if (f.node.returnType.name === "i32" || f.node.returnType.name === "u32") {
                return Math.floor(res);
            }
        }
        return res;
    }

    _callBuiltinFunction(node: AST.CallExpr, context: ExecContext) {
        switch (node.name) {
            // Logical Built-in Functions
            case "all":
                return this.builtins.All(node, context);
            case "any":
                return this.builtins.Any(node, context);
            case "select":
                return this.builtins.Select(node, context);

            // Array Built-in Functions
            case "arrayLength":
                return this.builtins.ArrayLength(node, context);

            // Numeric Built-in Functions
            case "abs":
                return this.builtins.Abs(node, context);
            case "acos":
                return this.builtins.Acos(node, context);
            case "acosh":
                return this.builtins.Acosh(node, context);
            case "asin":
                return this.builtins.Asin(node, context);
            case "asinh":
                return this.builtins.Asinh(node, context);
            case "atan":
                return this.builtins.Atan(node, context);
            case "atanh":
                return this.builtins.Atanh(node, context);
            case "atan2":
                return this.builtins.Atan2(node, context);
            case "ceil":
                return this.builtins.Ceil(node, context);
            case "clamp":
                return this.builtins.Clamp(node, context);
            case "cos":
                return this.builtins.Cos(node, context);
            case "cosh":
                return this.builtins.Cosh(node, context);
            case "countLeadingZeros":
                return this.builtins.CountLeadingZeros(node, context);
            case "countOneBits":
                return this.builtins.CountOneBits(node, context);
            case "countTrailingZeros":
                return this.builtins.CountTrailingZeros(node, context);
            case "cross":
                return this.builtins.Cross(node, context);
            case "degrees":
                return this.builtins.Degrees(node, context);
            case "determinant":
                return this.builtins.Determinant(node, context);
            case "distance":
                return this.builtins.Distance(node, context);
            case "dot":
                return this.builtins.Dot(node, context);
            case "dot4U8Packed":
                return this.builtins.Dot4U8Packed(node, context);
            case "dot4I8Packed":
                return this.builtins.Dot4I8Packed(node, context);
            case "exp":
                return this.builtins.Exp(node, context);
            case "exp2":
                return this.builtins.Exp2(node, context);
            case "extractBits":
                return this.builtins.ExtractBits(node, context);
            case "faceForward":
                return this.builtins.FaceForward(node, context);
            case "firstLeadingBit":
                return this.builtins.FirstLeadingBit(node, context);
            case "firstTrailingBit":
                return this.builtins.FirstTrailingBit(node, context);
            case "floor":
                return this.builtins.Floor(node, context);
            case "fma":
                return this.builtins.Fma(node, context);
            case "fract":
                return this.builtins.Fract(node, context);
            case "frexp":
                return this.builtins.Frexp(node, context);
            case "insertBits":
                return this.builtins.InsertBits(node, context);
            case "inverseSqrt":
                return this.builtins.InverseSqrt(node, context);
            case "ldexp":
                return this.builtins.Ldexp(node, context);
            case "length":
                return this.builtins.Length(node, context);
            case "log":
                return this.builtins.Log(node, context);
            case "log2":
                return this.builtins.Log2(node, context);
            case "max":
                return this.builtins.Max(node, context);
            case "min":
                return this.builtins.Min(node, context);
            case "mix":
                return this.builtins.Mix(node, context);
            case "modf":
                return this.builtins.Modf(node, context);
            case "normalize":
                return this.builtins.Normalize(node, context);
            case "pow":
                return this.builtins.Pow(node, context);
            case "quantizeToF16":
                return this.builtins.QuantizeToF16(node, context);
            case "radians":
                return this.builtins.Radians(node, context);
            case "reflect":
                return this.builtins.Reflect(node, context);
            case "refract":
                return this.builtins.Refract(node, context);
            case "reverseBits":
                return this.builtins.ReverseBits(node, context);
            case "round":
                return this.builtins.Round(node, context);
            case "saturate":
                return this.builtins.Saturate(node, context);
            case "sign":
                return this.builtins.Sign(node, context);
            case "sin":
                return this.builtins.Sin(node, context);
            case "sinh":
                return this.builtins.Sinh(node, context);
            case "smoothStep":
                return this.builtins.SmoothStep(node, context);
            case "sqrt":
                return this.builtins.Sqrt(node, context);
            case "step":
                return this.builtins.Step(node, context);
            case "tan":
                return this.builtins.Tan(node, context);
            case "tanh":
                return this.builtins.Tanh(node, context);
            case "transpose":
                return this.builtins.Transpose(node, context);
            case "trunc":
                return this.builtins.Trunc(node, context);

            // Derivative Built-in Functions
            case "dpdx":
                return this.builtins.Dpdx(node, context);
            case "dpdxCoarse":
                return this.builtins.DpdxCoarse(node, context);
            case "dpdxFine":
                return this.builtins.DpdxFine(node, context);
            case "dpdy":
                return this.builtins.Dpdy(node, context);
            case "dpdyCoarse":
                return this.builtins.DpdyCoarse(node, context);
            case "dpdyFine":
                return this.builtins.DpdyFine(node, context);
            case "fwidth":
                return this.builtins.Fwidth(node, context);
            case "fwidthCoarse":
                return this.builtins.FwidthCoarse(node, context);
            case "fwidthFine":
                return this.builtins.FwidthFine(node, context);

            // Texture Built-in Functions
            case "textureDimensions":
                return this.builtins.TextureDimensions(node, context);
            case "textureGather":
                return this.builtins.TextureGather(node, context);
            case "textureGatherCompare":
                return this.builtins.TextureGatherCompare(node, context);
            case "textureLoad":
                return this.builtins.TextureLoad(node, context);
            case "textureNumLayers":
                return this.builtins.TextureNumLayers(node, context);
            case "textureNumLevels":
                return this.builtins.TextureNumLevels(node, context);
            case "textureNumSamples":
                return this.builtins.TextureNumSamples(node, context);
            case "textureSample":
                return this.builtins.TextureSample(node, context);
            case "textureSampleBias":
                return this.builtins.TextureSampleBias(node, context);
            case "textureSampleCompare":
                return this.builtins.TextureSampleCompare(node, context);
            case "textureSampleCompareLevel":
                return this.builtins.TextureSampleCompareLevel(node, context);
            case "textureSampleGrad":
                return this.builtins.TextureSampleGrad(node, context);
            case "textureSampleLevel":
                return this.builtins.TextureSampleLevel(node, context);
            case "textureSampleBaseClampToEdge":
                return this.builtins.TextureSampleBaseClampToEdge(node, context);
            case "textureStore":
                return this.builtins.TextureStore(node, context);

            // Atomic Built-in Functions
            case "atomicLoad":
                return this.builtins.AtomicLoad(node, context);
            case "atomicStore":
                return this.builtins.AtomicStore(node, context);
            case "atomicAdd":
                return this.builtins.AtomicAdd(node, context);
            case "atomicSub":
                return this.builtins.AtomicSub(node, context);
            case "atomicMax":
                return this.builtins.AtomicMax(node, context);
            case "atomicMin":
                return this.builtins.AtomicMin(node, context);
            case "atomicAnd":
                return this.builtins.AtomicAnd(node, context);
            case "atomicOr":
                return this.builtins.AtomicOr(node, context);
            case "atomicXor":
                return this.builtins.AtomicXor(node, context);
            case "atomicExchange":
                return this.builtins.AtomicExchange(node, context);
            case "atomicCompareExchangeWeak":
                return this.builtins.AtomicCompareExchangeWeak(node, context);

            // Data Packing Built-in Functions
            case "pack4x8snorm":
                return this.builtins.Pack4x8snorm(node, context);
            case "pack4x8unorm":
                return this.builtins.Pack4x8unorm(node, context);
            case "pack4xI8":
                return this.builtins.Pack4xI8(node, context);
            case "pack4xU8":
                return this.builtins.Pack4xU8(node, context);
            case "pack4x8Clamp":
                return this.builtins.Pack4x8Clamp(node, context);
            case "pack4xU8Clamp":
                return this.builtins.Pack4xU8Clamp(node, context);
            case "pack2x16snorm":
                return this.builtins.Pack2x16snorm(node, context);
            case "pack2x16unorm":
                return this.builtins.Pack2x16unorm(node, context);
            case "pack2x16float":
                return this.builtins.Pack2x16float(node, context);

            // Data Unpacking Built-in Functions
            case "unpack4x8snorm":
                return this.builtins.Unpack4x8snorm(node, context);
            case "unpack4x8unorm":
                return this.builtins.Unpack4x8unorm(node, context);
            case "unpack4xI8":
                return this.builtins.Unpack4xI8(node, context);
            case "unpack4xU8":
                return this.builtins.Unpack4xU8(node, context);
            case "unpack2x16snorm":
                return this.builtins.Unpack2x16snorm(node, context);
            case "unpack2x16unorm":
                return this.builtins.Unpack2x16unorm(node, context);
            case "unpack2x16float":
                return this.builtins.Unpack2x16float(node, context);

            // Synchronization Built-in Functions
            case "storageBarrier":
                return this.builtins.StorageBarrier(node, context);
            case "textureBarrier":
                return this.builtins.TextureBarrier(node, context);
            case "workgroupBarrier":
                return this.builtins.WorkgroupBarrier(node, context);
            case "workgroupUniformLoad":
                return this.builtins.WorkgroupUniformLoad(node, context);

            // Subgroup Built-in Functions
            case "subgroupAdd":
                return this.builtins.SubgroupAdd(node, context);
            case "subgroupExclusiveAdd":
                return this.builtins.SubgroupExclusiveAdd(node, context);
            case "subgroupInclusiveAdd":
                return this.builtins.SubgroupInclusiveAdd(node, context);
            case "subgroupAll":
                return this.builtins.SubgroupAll(node, context);
            case "subgroupAnd":
                return this.builtins.SubgroupAnd(node, context);
            case "subgroupAny":
                return this.builtins.SubgroupAny(node, context);
            case "subgroupBallot":
                return this.builtins.SubgroupBallot(node, context);
            case "subgroupBroadcast":
                return this.builtins.SubgroupBroadcast(node, context);
            case "subgroupBroadcastFirst":
                return this.builtins.SubgroupBroadcastFirst(node, context);
            case "subgroupElect":
                return this.builtins.SubgroupElect(node, context);
            case "subgroupMax":
                return this.builtins.SubgroupMax(node, context);
            case "subgroupMin":
                return this.builtins.SubgroupMin(node, context);
            case "subgroupMul":
                return this.builtins.SubgroupMul(node, context);
            case "subgroupExclusiveMul":
                return this.builtins.SubgroupExclusiveMul(node, context);
            case "subgroupInclusiveMul":
                return this.builtins.SubgroupInclusiveMul(node, context);
            case "subgroupOr":
                return this.builtins.SubgroupOr(node, context);
            case "subgroupShuffle":
                return this.builtins.SubgroupShuffle(node, context);
            case "subgroupShuffleDown":
                return this.builtins.SubgroupShuffleDown(node, context);
            case "subgroupShuffleUp":
                return this.builtins.SubgroupShuffleUp(node, context);
            case "subgroupShuffleXor":
                return this.builtins.SubgroupShuffleXor(node, context);
            case "subgroupXor":
                return this.builtins.SubgroupXor(node, context);

            // Quad Operations
            case "quadBroadcast":
                return this.builtins.QuadBroadcast(node, context);
            case "quadSwapDiagonal":
                return this.builtins.QuadSwapDiagonal(node, context);
            case "quadSwapX":
                return this.builtins.QuadSwapX(node, context);
            case "quadSwapY":
                return this.builtins.QuadSwapY(node, context);
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

    _callConstructorValue(node: AST.CreateExpr, context: ExecContext) {
        if (node.args.length === 0) {
            return 0;
        }
        return this._evalExpression(node.args[0], context);
    }

    _callConstructorArray(node: AST.CreateExpr, context: ExecContext) {
        if (node.args.length === 0) {
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
            return [];
        }
        const values = [];
        for (const arg of node.args) {
            values.push(this._evalExpression(arg, context));
        }
        return values;
    }

    _callConstructorVec(node: AST.CreateExpr, context: ExecContext) {
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

        if (node.type instanceof AST.TemplateType && node.type.format === null) {
            node.type.format = AST.TemplateType.f32; // TODO: get the format from the type of the arg.
        }

        const isInt = typeName.endsWith("i") || typeName.endsWith("u");

        const values = [];
        // TODO: make sure the number of args matches the vector length.
        for (const arg of node.args) {
            let v = this._evalExpression(arg, context);
            if (isInt) {
                v = Math.floor(v);
            }
            values.push(v);
        }

        if (typeName === "vec2" || typeName === "vec2f" || typeName === "vec2i" || typeName === "vec2u") {
            if (values.length === 1) {
                values.push(values[0]);
            }
        } else if (typeName === "vec3" || typeName === "vec3f" || typeName === "vec3i" || typeName === "vec3u") {
            if (values.length === 1) {
                values.push(values[0], values[0]);
            } else if (values.length === 2) {
                console.error(`Invalid vec3 constructor. Line ${node.line}`);
            }
        } else if (typeName === "vec4" || typeName === "vec4f" || typeName === "vec4i" || typeName === "vec4u") {
            if (values.length === 1) {
                values.push(values[0], values[0], values[0]);
            } else if (values.length < 4) {
                console.error(`Invalid vec3 constructor. Line ${node.line}`);
            }
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

        const isInt = typeName.endsWith("i") || typeName.endsWith("u");

        const values = [];
        // TODO: make sure the number of args matches the matrix size.
        for (const arg of node.args) {
            let v = this._evalExpression(arg, context);
            if (isInt) {
                v = Math.floor(v);
            }
            values.push(v);
        }

        return values;
    }
}
