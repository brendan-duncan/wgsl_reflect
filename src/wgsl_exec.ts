import { Node, Type, TemplateType, Return, Break, Continue, Let, Var, Const,
    If, For, While, Loop, Continuing, Assign, Increment, Struct, Override,
    Call, Diagnostic, Alias, GroupingExpr, BinaryOperator, LiteralExpr,
    VariableExpr, CallExpr, CreateExpr, ConstExpr, BitcastExpr, UnaryOperator,
    ArrayIndex, StringExpr, Function,
    Data, ScalarData, VectorData, MatrixData, TypedData, VoidData } from "./wgsl_ast.js";
import { Reflect } from "./reflect/reflect.js";
import { TypeInfo, StructInfo, ArrayInfo, TemplateInfo } from "./reflect/info.js";
import { ExecContext, FunctionRef } from "./exec/exec_context.js";
import { ExecInterface } from "./exec/exec_interface.js";
import { BuiltinFunctions } from "./exec/builtin_functions.js";
import { isArray, castScalar, castVector } from "./exec/util.js";

export class WgslExec extends ExecInterface {
    ast: Node[];
    context: ExecContext;
    reflection: Reflect;
    builtins: BuiltinFunctions;
    typeInfo: Object;

    constructor(ast?: Node[], context?: ExecContext) {
        super();
        this.ast = ast ?? [];
        this.reflection = new Reflect();
        this.reflection.updateAST(this.ast);

        this.context = context?.clone() ?? new ExecContext();
        this.builtins = new BuiltinFunctions(this);

        this.typeInfo = {
            "bool": this.getTypeInfo(Type.bool),
            "i32": this.getTypeInfo(Type.i32),
            "u32": this.getTypeInfo(Type.u32),
            "f32": this.getTypeInfo(Type.f32),
            "f16": this.getTypeInfo(Type.f16),
            "vec2f": this.getTypeInfo(TemplateType.vec2f),
            "vec2u": this.getTypeInfo(TemplateType.vec2u),
            "vec2i": this.getTypeInfo(TemplateType.vec2i),
            "vec2h": this.getTypeInfo(TemplateType.vec2h),
            "vec3f": this.getTypeInfo(TemplateType.vec3f),
            "vec3u": this.getTypeInfo(TemplateType.vec3u),
            "vec3i": this.getTypeInfo(TemplateType.vec3i),
            "vec3h": this.getTypeInfo(TemplateType.vec3h),
            "vec4f": this.getTypeInfo(TemplateType.vec4f),
            "vec4u": this.getTypeInfo(TemplateType.vec4u),
            "vec4i": this.getTypeInfo(TemplateType.vec4i),
            "vec4h": this.getTypeInfo(TemplateType.vec4h),
            "mat2x2f": this.getTypeInfo(TemplateType.mat2x2f),
            "mat2x3f": this.getTypeInfo(TemplateType.mat2x3f),
            "mat2x4f": this.getTypeInfo(TemplateType.mat2x4f),
            "mat3x2f": this.getTypeInfo(TemplateType.mat3x2f),
            "mat3x3f": this.getTypeInfo(TemplateType.mat3x3f),
            "mat3x4f": this.getTypeInfo(TemplateType.mat3x4f),
            "mat4x2f": this.getTypeInfo(TemplateType.mat4x2f),
            "mat4x3f": this.getTypeInfo(TemplateType.mat4x3f),
            "mat4x4f": this.getTypeInfo(TemplateType.mat4x4f),
        };
    }

    getVariableValue(name: string): number | number[] | null {
        const v = this.context.getVariable(name)?.value ?? null;
        if (v === null) {
            return null;
        }
        if (v instanceof ScalarData) {
            return v.value;
        }
        if (v instanceof VectorData) {
            return v.value;
        }
        if (v instanceof MatrixData) {
            return v.value;
        }
        console.error(`Unsupported return variable type ${v.typeInfo.name}`);
        return null;
    }

    execute(config?: Object): void {
        config = config ?? {};
        if (config["constants"]) {
            this._setOverrides(config["constants"], this.context);
        }

        this._execStatements(this.ast, this.context);
    }

    dispatchWorkgroups(kernel: string, dispatchCount: number | number[], bindGroups: Object, config?: Object): void {
        const context = this.context.clone();

        config = config ?? {};
        if (config["constants"]) {
            this._setOverrides(config["constants"], context);
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

        const width = dispatchCount[0];
        const height = dispatchCount[1];
        const depth = dispatchCount[2];

        const vec3u = this.getTypeInfo("vec3u");
        context.setVariable("@num_workgroups", new VectorData(dispatchCount, vec3u));

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
                                v.value = new TypedData(entry.texture, this.getTypeInfo(node.type), 0, entry.size);
                            } else if (entry.uniform !== undefined) {
                                // Uniform buffer
                                v.value = new TypedData(entry.uniform, this.getTypeInfo(node.type));
                            } else {
                                // Storage buffer
                                v.value = new TypedData(entry, this.getTypeInfo(node.type));
                            }
                        }
                    }
                });
            }
        }

        for (let z = 0; z < depth; ++z) {
            for (let y = 0; y < height; ++y) {
                for (let x = 0; x < width; ++x) {
                    context.setVariable("@workgroup_id", new VectorData([x, y, z], this.getTypeInfo("vec3u")));
                    this._dispatchWorkgroup(f, [x, y, z], context);
                }
            }
        }
    }

    static _breakObj = new Data(new TypeInfo("BREAK", null));
    static _continueObj = new Data(new TypeInfo("CONTINUE", null));

    execStatement(stmt: Node, context: ExecContext): Data | null {
        if (stmt instanceof Return) {
            return this.evalExpression(stmt.value, context);
        } else if (stmt instanceof Break) {
            if (stmt.condition) {
                const c = this.evalExpression(stmt.condition, context);
                if (!(c instanceof ScalarData)) {
                    throw new Error(`Invalid break-if condition`);
                }
                if (!c.value) {
                    return null;
                }
            }
            return WgslExec._breakObj;
        } else if (stmt instanceof Continue) {
            return WgslExec._continueObj;
        } else if (stmt instanceof Let) {
            this._let(stmt, context);
        } else if (stmt instanceof Var) {
            this._var(stmt, context);
        } else if (stmt instanceof Const) {
            this._const(stmt, context);
        } else if (stmt instanceof Function) {
            this._function(stmt, context);
        } else if (stmt instanceof If) {
            return this._if(stmt, context);
        } else if (stmt instanceof For) {
            return this._for(stmt, context);
        } else if (stmt instanceof While) {
            return this._while(stmt, context);
        } else if (stmt instanceof Loop) {
            return this._loop(stmt, context);
        } else if (stmt instanceof Continuing) {
            const subContext = context.clone();
            subContext.currentFunctionName = context.currentFunctionName;
            return this._execStatements(stmt.body, subContext);
        } else if (stmt instanceof Assign) {
            this._assign(stmt, context);
        } else if (stmt instanceof Increment) {
            this._increment(stmt, context);
        } else if (stmt instanceof Struct) {
            return null;
        } else if (stmt instanceof Override) {
            const name = stmt.name;
            if (context.getVariable(name) === null) {
                console.error(`Override constant ${name} not found. Line ${stmt.line}`);
            }
        } else if (stmt instanceof Call) {
            this._call(stmt, context);
        } else if (stmt instanceof Diagnostic) {
            return null; // Nothing to do here.
        } else if (stmt instanceof Alias) {
            return null; // Nothing to do here.
        } else {
            console.error(`Invalid statement type.`, stmt, `Line ${stmt.line}`);
        }
        return null;
    }

    evalExpression(node: Node, context: ExecContext): Data | null {
        while (node instanceof GroupingExpr) {
            node = node.contents[0];
        }

        if (node instanceof BinaryOperator) {
            return this._evalBinaryOp(node, context);
        } else if (node instanceof LiteralExpr) {
            return this._evalLiteral(node, context);
        } else if (node instanceof VariableExpr) {
            return this._evalVariable(node, context);
        } else if (node instanceof CallExpr) {
            return this._evalCall(node, context);
        } else if (node instanceof CreateExpr) {
            return this._evalCreate(node, context);
        } else if (node instanceof ConstExpr) {
            return this._evalConst(node, context);
        } else if (node instanceof BitcastExpr) {
            return this._evalBitcast(node, context);
        } else if (node instanceof UnaryOperator) {
            return this._evalUnaryOp(node, context);
        }
        console.error(`Invalid expression type`, node, `Line ${node.line}`);
        return null;
    }

    getTypeInfo(type: Type | string): TypeInfo | null {
        if (type instanceof Type) {
            const t = this.reflection.getTypeInfo(type as Type);
            if (t !== null) {
                return t;
            }
        }

        const t = this.typeInfo[type as string] ?? null;
        if (t !== null) {
            return t;
        }

        return null;
    }

    getTypeName(type: TypeInfo | Type): string {
        /*if (type instanceof Type) {
            type = this.getTypeInfo(type);
        }*/
        if (type === null) {
            console.error(`Type is null.`);
            return "unknown";
        }
        let name = type.name;
        if (type instanceof TemplateInfo || type instanceof TemplateType) {
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
                    } else if (type.format.name === "bool") {
                        name += "b";
                        return name;
                    } else if (type.format.name === "f16") {
                        name += "h";
                        return name;
                    }
                }
                name += `<${type.format.name}>`;
            } else {
                if (name === "vec2" || name === "vec3" || name === "vec4") {
                    return name;
                }
                //console.error("Template format is null.");
            }
        }
        return name;
    }

    _setOverrides(constants: Object, context: ExecContext): void {
        for (const k in constants) {
            const v = constants[k];
            const override = this.reflection.getOverrideInfo(k);
            if (override !== null) {
                if (override.type.name === "u32" || override.type.name === "i32" || override.type.name === "f32" || override.type.name === "f16") {
                    context.setVariable(k, new ScalarData(v, override.type));
                } else if (override.type.name === "bool") {
                    context.setVariable(k, new ScalarData(v ? 1 : 0, override.type));
                } else if (override.type.name === "vec2" || override.type.name === "vec3" || override.type.name === "vec4" ||
                    override.type.name === "vec2f" || override.type.name === "vec3f" || override.type.name === "vec4f" ||
                    override.type.name === "vec2i" || override.type.name === "vec3i" || override.type.name === "vec4i" ||
                    override.type.name === "vec2u" || override.type.name === "vec3u" || override.type.name === "vec4u" ||
                    override.type.name === "vec2h" || override.type.name === "vec3h" || override.type.name === "vec4h") {
                    context.setVariable(k, new VectorData(v, override.type));
                } else {
                    console.error(`Invalid constant type for ${k}`);
                }
            } else {
                console.error(`Override ${k} does not exist in the shader.`);
            }
        }
    }

    _dispatchWorkgroup(f: FunctionRef, workgroup_id: number[], context: ExecContext): void {
        const workgroupSize = [1, 1, 1];
        for (const attr of f.node.attributes) {
            if (attr.name === "workgroup_size") {
                if (attr.value.length > 0) {
                    // The value could be an override constant
                    const v = context.getVariableValue(attr.value[0]);
                    if (v instanceof ScalarData) {
                        workgroupSize[0] = v.value;
                    } else {
                        workgroupSize[0] = parseInt(attr.value[0]);
                    }
                }
                if (attr.value.length > 1) {
                    const v = context.getVariableValue(attr.value[1]);
                    if (v instanceof ScalarData) {
                        workgroupSize[1] = v.value;
                    } else {
                        workgroupSize[1] = parseInt(attr.value[1]);
                    }
                }
                if (attr.value.length > 2) {
                    const v = context.getVariableValue(attr.value[2]);
                    if (v instanceof ScalarData) {
                        workgroupSize[2] = v.value;
                    } else {
                        workgroupSize[2] = parseInt(attr.value[2]);
                    }
                }
            }
        }

        const vec3u = this.getTypeInfo("vec3u");
        const u32 = this.getTypeInfo("u32");
        context.setVariable("@workgroup_size", new VectorData(workgroupSize, vec3u));

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

                    context.setVariable("@local_invocation_id", new VectorData(local_invocation_id, vec3u));
                    context.setVariable("@global_invocation_id", new VectorData(global_invocation_id, vec3u));
                    context.setVariable("@local_invocation_index", new ScalarData(li, u32));

                    this._dispatchExec(f, context);
                }
            }
        }
    }

    _dispatchExec(f: FunctionRef, context: ExecContext): void {
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

    getVariableName(node: Node, context: ExecContext): string | null {
        if (node instanceof VariableExpr) {
            return (node as VariableExpr).name;
        } else {
            console.error(`Unknown variable type`, node, 'Line', node.line);
        }
        return null;
    }

    _execStatements(statements: Node[], context: ExecContext): Data | null {
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

            const res = this.execStatement(stmt, context);
            if (res) {
                return res;
            }
        }
        return null;
    }

    _call(node: Call, context: ExecContext): void {
        const subContext = context.clone();
        subContext.currentFunctionName = node.name;

        const f = context.functions.get(node.name);
        if (!f) {
            this._callBuiltinFunction(node, subContext);
            return;
        }

        for (let ai = 0; ai < f.node.args.length; ++ai) {
            const arg = f.node.args[ai];
            const value = this.evalExpression(node.args[ai], subContext);
            subContext.setVariable(arg.name, value, arg);
        }

        this._execStatements(f.node.body, subContext);
    }

    _increment(node: Increment, context: ExecContext): void {
        const name = this.getVariableName(node.variable, context);
        const v = context.getVariable(name);
        if (!v) {
            console.error(`Variable ${name} not found. Line ${node.line}`);
            return;
        }
        if (node.operator === "++") {
            if (v.value instanceof ScalarData) {
                v.value.value++;
            } else {
                console.error(`Variable ${name} is not a scalar. Line ${node.line}`);
            }
        } else if (node.operator === "--") {
            if (v.value instanceof ScalarData) {
                v.value.value--;
            } else {
                console.error(`Variable ${name} is not a scalar. Line ${node.line}`);
            }
        } else {
            console.error(`Unknown increment operator ${node.operator}. Line ${node.line}`);
        }
    }

    _assign(node: Assign, context: ExecContext): void {
        const name = this.getVariableName(node.variable, context);
        const v = context.getVariable(name);

        if (v === null) {
            console.error(`Variable ${name} not found. Line ${node.line}`);
            return;
        }

        const value = this.evalExpression(node.value, context);

        const op = node.operator;
        if (op !== "=") {
            const currentValue = v.value.getDataValue(this, node.variable.postfix, context);

            if (currentValue instanceof VectorData && value instanceof ScalarData) {
                const cv = currentValue.value;
                const v = value.value;

                if (op === "+=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] += v;
                    }
                } else if (op === "-=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] -= v;
                    }
                } else if (op === "*=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] *= v;
                    }
                } else if (op === "/=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] /= v;
                    }
                } else if (op === "%=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] %= v;
                    }
                } else if (op === "&=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] &= v;
                    }
                } else if (op === "|=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] |= v;
                    }
                } else if (op === "^=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] ^= v;
                    }
                } else if (op === "<<=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] <<= v;
                    }
                } else if (op === ">>=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] >>= v;
                    }
                } else {
                    console.error(`Invalid operator ${op}. Line ${node.line}`);
                }
            } else if (currentValue instanceof VectorData && value instanceof VectorData) {
                const cv = currentValue.value;
                const v = value.value;
                if (cv.length !== v.length) {
                    console.error(`Vector length mismatch. Line ${node.line}`);
                    return;
                }

                if (op === "+=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] += v[i];
                    }
                } else if (op === "-=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] -= v[i];
                    }
                } else if (op === "*=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] *= v[i];
                    }
                } else if (op === "/=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] /= v[i];
                    }
                } else if (op === "%=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] %= v[i];
                    }
                } else if (op === "&=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] &= v[i];
                    }
                } else if (op === "|=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] |= v[i];
                    }
                } else if (op === "^=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] ^= v[i];
                    }
                } else if (op === "<<=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] <<= v[i];
                    }
                } else if (op === ">>=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] >>= v[i];
                    }
                } else {
                    console.error(`Invalid operator ${op}. Line ${node.line}`);
                }
            } else if (currentValue instanceof ScalarData && value instanceof ScalarData) {
                if (op === "+=") {
                    currentValue.value += value.value;
                } else if (op === "-=") {
                    currentValue.value -= value.value;
                } else if (op === "*=") {
                    currentValue.value *= value.value;
                } else if (op === "/=") {
                    currentValue.value /= value.value;
                } else if (op === "%=") {
                    currentValue.value %= value.value;
                } else if (op === "&=") {
                    currentValue.value &= value.value;
                } else if (op === "|=") {
                    currentValue.value |= value.value;
                } else if (op === "^=") {
                    currentValue.value ^= value.value;
                } else if (op === "<<=") {
                    currentValue.value <<= value.value;
                } else if (op === ">>=") {
                    currentValue.value >>= value.value;
                } else {
                    console.error(`Invalid operator ${op}. Line ${node.line}`);
                }
            } else {
                console.error(`Invalid type for ${node.operator} operator. Line ${node.line}`);
                return;
            }

            // If the variable is a TypedData, as in a struct or array, and we're assigning a
            // sub portion of it, set the data in the original buffer.
            if (v.value instanceof TypedData) {
                v.value.setDataValue(this, currentValue, node.variable.postfix, context);
            }

            return;
        }

        if (v.value instanceof TypedData) {
            v.value.setDataValue(this, value, node.variable.postfix, context);
        } else if (node.variable.postfix) {
            if (!(v.value instanceof VectorData) && !(v.value instanceof MatrixData)) {
                console.error(`Variable ${v.name} is not a vector or matrix. Line ${node.line}`);
                return;
            }

            if (node.variable.postfix instanceof ArrayIndex) {
                const idx = (this.evalExpression(node.variable.postfix.index, context) as ScalarData).value;

                if (v.value instanceof VectorData) {
                    if (value instanceof ScalarData) {
                        v.value.value[idx] = value.value;
                    } else {
                        console.error(`Invalid assignment to ${v.name}. Line ${node.line}`);
                        return;
                    }
                } else if (v.value instanceof MatrixData) {
                    const idx = (this.evalExpression(node.variable.postfix.index, context) as ScalarData).value;
                    if (idx < 0) {
                        console.error(`Invalid assignment to ${v.name}. Line ${node.line}`);
                        return;
                    }
                    if (value instanceof VectorData) {
                        const typeName = this.getTypeName(v.value.typeInfo);
                        if (typeName === "mat2x2" || typeName === "mat2x2f" || typeName === "mat2x2h") {
                            if (idx < 2 && value.value.length === 2) {
                                v.value.value[idx * 2] = value.value[0];
                                v.value.value[idx * 2 + 1] = value.value[1];
                            } else {
                                console.error(`Invalid assignment to ${v.name}. Line ${node.line}`);
                                return;
                            }
                        } else if (typeName === "mat2x3" || typeName === "mat2x3f" || typeName === "mat2x3h") {
                            if (idx < 2 && value.value.length === 3) {
                                v.value.value[idx * 3] = value.value[0];
                                v.value.value[idx * 3 + 1] = value.value[1];
                                v.value.value[idx * 3 + 2] = value.value[2];
                            } else {
                                console.error(`Invalid assignment to ${v.name}. Line ${node.line}`);
                                return;
                            }
                        } else if (typeName === "mat2x4" || typeName === "mat2x4f" || typeName === "mat2x4h") {
                            if (idx < 2 && value.value.length === 4) {
                                v.value.value[idx * 4] = value.value[0];
                                v.value.value[idx * 4 + 1] = value.value[1];
                                v.value.value[idx * 4 + 2] = value.value[2];
                                v.value.value[idx * 4 + 3] = value.value[3];
                            } else {
                                console.error(`Invalid assignment to ${v.name}. Line ${node.line}`);
                                return;
                            }
                        } else if (typeName === "mat3x2" || typeName === "mat3x2f" || typeName === "mat3x2h") {
                            if (idx < 3 && value.value.length === 2) {
                                v.value.value[idx * 2] = value.value[0];
                                v.value.value[idx * 2 + 1] = value.value[1];
                            } else {
                                console.error(`Invalid assignment to ${v.name}. Line ${node.line}`);
                                return;
                            }
                        } else if (typeName === "mat3x3" || typeName === "mat3x3f" || typeName === "mat3x3h") {
                            if (idx < 3 && value.value.length === 3) {
                                v.value.value[idx * 3] = value.value[0];
                                v.value.value[idx * 3 + 1] = value.value[1];
                                v.value.value[idx * 3 + 2] = value.value[2];
                            } else {
                                console.error(`Invalid assignment to ${v.name}. Line ${node.line}`);
                                return;
                            }
                        } else if (typeName === "mat3x4" || typeName === "mat3x4f" || typeName === "mat3x4h") {
                            if (idx < 3 && value.value.length === 4) {
                                v.value.value[idx * 4] = value.value[0];
                                v.value.value[idx * 4 + 1] = value.value[1];
                                v.value.value[idx * 4 + 2] = value.value[2];
                                v.value.value[idx * 4 + 3] = value.value[3];
                            } else {
                                console.error(`Invalid assignment to ${v.name}. Line ${node.line}`);
                                return;
                            }
                        } else if (typeName === "mat4x2" || typeName === "mat4x2f" || typeName === "mat4x2h") {
                            if (idx < 4 && value.value.length === 2) {
                                v.value.value[idx * 2] = value.value[0];
                                v.value.value[idx * 2 + 1] = value.value[1];
                            } else {
                                console.error(`Invalid assignment to ${v.name}. Line ${node.line}`);
                                return;
                            }
                        } else if (typeName === "mat4x3" || typeName === "mat4x3f" || typeName === "mat4x3h") {
                            if (idx < 4 && value.value.length === 3) {
                                v.value.value[idx * 3] = value.value[0];
                                v.value.value[idx * 3 + 1] = value.value[1];
                                v.value.value[idx * 3 + 2] = value.value[2];
                            } else {
                                console.error(`Invalid assignment to ${v.name}. Line ${node.line}`);
                                return;
                            }
                        } else if (typeName === "mat4x4" || typeName === "mat4x4f" || typeName === "mat4x4h") {
                            if (idx < 4 && value.value.length === 4) {
                                v.value.value[idx * 4] = value.value[0];
                                v.value.value[idx * 4 + 1] = value.value[1];
                                v.value.value[idx * 4 + 2] = value.value[2];
                                v.value.value[idx * 4 + 3] = value.value[3];
                            } else {
                                console.error(`Invalid assignment to ${v.name}. Line ${node.line}`);
                                return;
                            }
                        } else {
                            console.error(`Invalid assignment to ${v.name}. Line ${node.line}`);
                            return;
                        }
                    } else {
                        console.error(`Invalid assignment to ${v.name}. Line ${node.line}`);
                        return;
                    }
                } else {
                    console.error(`Invalid assignment to ${v.name}. Line ${node.line}`);
                    return;
                }
            } else if (node.variable.postfix instanceof StringExpr) {
                const member = node.variable.postfix.value;
                if (!(v.value instanceof VectorData)) {
                    console.error(`Invalid assignment to ${member}. Variable ${v.name} is not a vector. Line ${node.line}`);
                    return;
                }
                if (value instanceof ScalarData) {
                    if (member.length > 1) {
                        console.error(`Invalid assignment to ${member} for variable ${v.name}. Line ${node.line}`);
                        return;
                    }
                    if (member === "x") {
                        v.value.value[0] = value.value;
                    } else if (member === "y") {
                        if (v.value.value.length < 2) {
                            console.error(`Invalid assignment to ${member} for variable ${v.name}. Line ${node.line}`);
                            return;
                        }
                        v.value.value[1] = value.value;
                    } else if (member === "z") {
                        if (v.value.value.length < 3) {
                            console.error(`Invalid assignment to ${member} for variable ${v.name}. Line ${node.line}`);
                            return;
                        }
                        v.value.value[2] = value.value;
                    } else if (member === "w") {
                        if (v.value.value.length < 4) {
                            console.error(`Invalid assignment to ${member} for variable ${v.name}. Line ${node.line}`);
                            return;
                        }
                        v.value.value[3] = value.value;
                    }
                } else if (value instanceof VectorData) {
                    if (member.length !== value.value.length) {
                        console.error(`Invalid assignment to ${member} for variable ${v.name}. Line ${node.line}`);
                        return;
                    }
                    for (let i = 0; i < member.length; ++i) {
                        const m = member[i];
                        if (m === "x" || m === "r") {
                            v.value.value[0] = value.value[i];
                        } else if (m === "y" || m === "g") {
                            if (value.value.length < 2) {
                                console.error(`Invalid assignment to ${m} for variable ${v.name}. Line ${node.line}`);
                                return;
                            }
                            v.value.value[1] = value.value[i];
                        } else if (m === "z" || m === "b") {
                            if (value.value.length < 3) {
                                console.error(`Invalid assignment to ${m} for variable ${v.name}. Line ${node.line}`);
                                return;
                            }
                            v.value.value[2] = value.value[i];
                        } else if (m === "w" || m === "a") {
                            if (value.value.length < 4) {
                                console.error(`Invalid assignment to ${m} for variable ${v.name}. Line ${node.line}`);
                                return;
                            }
                            v.value.value[3] = value.value[i];
                        } else {
                            console.error(`Invalid assignment to ${m} for variable ${v.name}. Line ${node.line}`);
                            return;
                        }
                    }
                } else {
                    console.error(`Invalid assignment to ${v.name}. Line ${node.line}`);
                    return;
                }
            }
        } else {
            v.value = value;
        }
        return;
    }

    _function(node: Function, context: ExecContext): void {
        const f = new FunctionRef(node);
        context.functions.set(node.name, f);
    }

    _const(node: Const, context: ExecContext): void {
        let value = null;
        if (node.value != null) {
            value = this.evalExpression(node.value, context);
        }
        context.createVariable(node.name, value, node);
    }

    _let(node: Let, context: ExecContext): void {
        let value = null;
        if (node.value != null) {
            value = this.evalExpression(node.value, context);
        }
        context.createVariable(node.name, value, node);
    }

    _var(node: Var, context: ExecContext): void {
        let value = null;
        if (node.value !== null) {
            value = this.evalExpression(node.value, context);
        } else {
            if (node.type === null) {
                console.error(`Variable ${node.name} has no type. Line ${node.line}`);
                return;
            }

            if (node.type.name === "f32" || node.type.name === "i32" || node.type.name === "u32" ||
                node.type.name === "bool" || node.type.name === "f16" ||
                node.type.name === "vec2" || node.type.name === "vec3" || node.type.name === "vec4" ||
                node.type.name === "vec2f" || node.type.name === "vec3f" || node.type.name === "vec4f" ||
                node.type.name === "vec2i" || node.type.name === "vec3i" || node.type.name === "vec4i" ||
                node.type.name === "vec2u" || node.type.name === "vec3u" || node.type.name === "vec4u" ||
                node.type.name === "vec2h" || node.type.name === "vec3h" || node.type.name === "vec4h" ||
                node.type.name === "mat2x2" || node.type.name === "mat2x3" || node.type.name === "mat2x4" ||
                node.type.name === "mat3x2" || node.type.name === "mat3x3" || node.type.name === "mat3x4" ||
                node.type.name === "mat4x2" || node.type.name === "mat4x3" || node.type.name === "mat4x4" ||
                node.type.name === "mat2x2f" || node.type.name === "mat2x3f" || node.type.name === "mat2x4f" ||
                node.type.name === "mat3x2f" || node.type.name === "mat3x3f" || node.type.name === "mat3x4f" ||
                node.type.name === "mat4x2f" || node.type.name === "mat4x3f" || node.type.name === "mat4x4f" ||
                node.type.name === "mat2x2h" || node.type.name === "mat2x3h" || node.type.name === "mat2x4h" ||
                node.type.name === "mat3x2h" || node.type.name === "mat3x3h" || node.type.name === "mat3x4h" ||
                node.type.name === "mat4x2h" || node.type.name === "mat4x3h" || node.type.name === "mat4x4h") {
                const defType = new CreateExpr(node.type, []);
                value = this._evalCreate(defType, context);
            }

            if (node.type.name === "array") {
                const defType = new CreateExpr(node.type, []);
                value = this._evalCreate(defType, context);
            }
        }

        context.createVariable(node.name, value, node);
    }

    _if(node: If, context: ExecContext): Data | null {
        context = context.clone();
        const condition = this.evalExpression(node.condition, context);
        if (!(condition instanceof ScalarData)) {
            console.error(`Invalid if condition. Line ${node.line}`);
            return null;
        }

        if (condition.value) {
            return this._execStatements(node.body, context);
        }

        for (const e of node.elseif) {
            const condition = this.evalExpression(e.condition, context);
            if (!(condition instanceof ScalarData)) {
                console.error(`Invalid if condition. Line ${node.line}`);
                return null;
            }
            if (condition.value) {
                return this._execStatements(e.body, context);
            }
        }

        if (node.else) {
            return this._execStatements(node.else, context);
        }

        return null;
    }

    _getScalarValue(v: Data | null): number {
        if (v instanceof ScalarData) {
            return v.value;
        }
        console.error(`Expected scalar value.`, v);
        return 0;
    }

    _for(node: For, context: ExecContext): Data | null {
        context = context.clone();
        this.execStatement(node.init, context);
        while (this._getScalarValue(this.evalExpression(node.condition, context))) {
            const res = this._execStatements(node.body, context);
            if (res === WgslExec._breakObj) {
                break;
            }
            if (res !== null && res !== WgslExec._continueObj) {
                return res;
            }
            this.execStatement(node.increment, context);
        }

        return null;
    }

    _loop(node: Loop, context: ExecContext): Data | null {
        context = context.clone();

        while (true) {
            const res = this._execStatements(node.body, context);
            if (res === WgslExec._breakObj) {
                break;
            } else if (res === WgslExec._continueObj) {
                if (node.continuing) {
                    const cres = this._execStatements(node.continuing.body, context);
                    if (cres === WgslExec._breakObj) {
                        break;
                    }
                }
            } else if (res !== null) {
                return res;
            }
        }

        return null;
    }

    _while(node: While, context: ExecContext): Data | null {
        context = context.clone();
        while (this._getScalarValue(this.evalExpression(node.condition, context))) {
            const res = this._execStatements(node.body, context);
            if (res === WgslExec._breakObj) {
                break;
            } else if (res === WgslExec._continueObj) {
                continue;
            } else if (res !== null) {
                return res;
            }
        }
        return null;
    }

    _evalBitcast(node: BitcastExpr, context: ExecContext): Data | null {
        const value = this.evalExpression(node.value, context);
        const type = node.type;

        if (value instanceof ScalarData) {
            const v = castScalar(value.value, value.typeInfo.name, type.name);
            return new ScalarData(v, this.getTypeInfo(type));
        }

        if (value instanceof VectorData) {
            const fromType = this.getTypeName(value.typeInfo);
            let fromCast = "";
            if (fromType.endsWith("f")) {
                fromCast = "f32";
            } else if (fromType.endsWith("i")) {
                fromCast = "i32";
            } else if (fromType.endsWith("u")) {
                fromCast = "u32";
            } else if (fromType.endsWith("b")) {
                fromCast = "bool";
            } else if (fromType.endsWith("h")) {
                fromCast = "f16";
            } else {
                console.error(`Unknown vector type ${fromType}. Line ${node.line}`);
                return null;
            }

            const toType = this.getTypeName(type);
            let toCast = "";
            if (toType.endsWith("f")) {
                toCast = "f32";
            } else if (toType.endsWith("i")) {
                toCast = "i32";
            } else if (toType.endsWith("u")) {
                toCast = "u32";
            } else if (toType.endsWith("b")) {
                toCast = "bool";
            } else if (toType.endsWith("h")) {
                toCast = "f16";
            } else {
                console.error(`Unknown vector type ${toCast}. Line ${node.line}`);
                return null;
            }

            const v = castVector(value.value, fromCast, toCast);
            return new VectorData(v, this.getTypeInfo(type));
        }

        console.error(`TODO: bitcast for ${value.typeInfo.name}. Line ${node.line}`);
        return null;
    }

    _evalConst(node: ConstExpr, context: ExecContext): Data | null {
        const data = context.getVariableValue(node.name);
        if (node.postfix) {
            return data.getDataValue(this, node.postfix, context);
        }
        return data;
    }

    _evalCreate(node: CreateExpr, context: ExecContext): Data | null {
        if (node.type === null) {
            return VoidData.void;
        }

        const typeName = this.getTypeName(node.type);

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
                case "vec2f":
            case "vec3h":
            case "vec4h":
            case "vec2h":
            case "vec3i":
            case "vec4i":
            case "vec2u":
            case "vec3u":
            case "vec4u":
            case "vec2b":
            case "vec3b":
            case "vec4b":
                return this._callConstructorVec(node, context);
            case "mat2x2":
            case "mat2x2f":
            case "mat2x2h":
            case "mat2x3":
            case "mat2x3f":
            case "mat2x3h":
            case "mat2x4":
            case "mat2x4f":
            case "mat2x4h":
            case "mat3x2":
            case "mat3x2f":
            case "mat3x2h":
            case "mat3x3":
            case "mat3x3f":
            case "mat3x3h":
            case "mat3x4":
            case "mat3x4f":
            case "mat3x4h":
            case "mat4x2":
            case "mat4x2f":
            case "mat4x2h":
            case "mat4x3":
            case "mat4x3f":
            case "mat4x3h":
            case "mat4x4":
            case "mat4x4f":
            case "mat4x4h":
                return this._callConstructorMatrix(node, context);
        }

        const typeInfo = this.getTypeInfo(node.type);
        if (typeInfo === null) {
            console.error(`Unknown type ${typeName}. Line ${node.line}`);
            return null;
        }

        if (typeInfo.size === 0) {
            return null;
        }

        const data = new TypedData(new ArrayBuffer(typeInfo.size), typeInfo, 0);

        // Assign the values in node.args to the data.
        if (typeInfo instanceof StructInfo) {
            if (node.args) {
                for (let i = 0; i < node.args.length; ++i) {
                    const memberInfo = typeInfo.members[i];
                    const arg = node.args[i];
                    const value = this.evalExpression(arg, context);
                    data.setData(this, value, memberInfo.type, memberInfo.offset, context);
                }
            }
        } else if (typeInfo instanceof ArrayInfo) {
            let offset = 0;
            if (node.args) {
                for (let i = 0; i < node.args.length; ++i) {
                    const arg = node.args[i];
                    const value = this.evalExpression(arg, context);
                    if (typeInfo.format === null) {
                        if (value.typeInfo?.name === "x32") {
                            typeInfo.format = this.getTypeInfo("i32");
                        } else {
                            typeInfo.format = value.typeInfo;
                        }
                    }
                    data.setData(this, value, typeInfo.format, offset, context);
                    offset += typeInfo.stride;
                }
            }
        } else {
            console.error(`Unknown type "${typeName}". Line ${node.line}`);
        }

        return data;
    }

    _evalLiteral(node: LiteralExpr, context: ExecContext): Data | null {
        const typeInfo = this.getTypeInfo(node.type);
        const typeName = typeInfo.name;
        if (typeName === "x32" || typeName === "u32" || typeName === "f32" || typeName === "f16" ||
            typeName === "i32" || typeName === "bool") {
            const data = new ScalarData(node.scalarValue, typeInfo);
            return data;
        }
        if (typeName === "vec2" || typeName === "vec3" || typeName === "vec4" ||
            typeName === "vec2f" || typeName === "vec3f" || typeName === "vec4f" ||
            typeName === "vec2h" || typeName === "vec3h" || typeName === "vec4h" ||
            typeName === "vec2i" || typeName === "vec3i" || typeName === "vec4i" ||
            typeName === "vec2u" || typeName === "vec3u" || typeName === "vec4u") {
            return this._callConstructorVec(node, context);
        }
        if (typeName === "mat2x2" || typeName === "mat2x3" || typeName === "mat2x4" ||
            typeName === "mat3x2" || typeName === "mat3x3" || typeName === "mat3x4" ||
            typeName === "mat4x2" || typeName === "mat4x3" || typeName === "mat4x4" ||
            typeName === "mat2x2f" || typeName === "mat2x3f" || typeName === "mat2x4f" ||
            typeName === "mat3x2f" || typeName === "mat3x3f" || typeName === "mat3x4f" ||
            typeName === "mat4x2f" || typeName === "mat4x3f" || typeName === "mat4x4f" ||
            typeName === "mat2x2h" || typeName === "mat2x3h" || typeName === "mat2x4h" ||
            typeName === "mat3x2h" || typeName === "mat3x3h" || typeName === "mat3x4h" ||
            typeName === "mat4x2h" || typeName === "mat4x3h" || typeName === "mat4x4h") {
            return this._callConstructorMatrix(node, context);
        }
        return node.value;
    }

    _evalVariable(node: VariableExpr, context: ExecContext): Data | null {
        const value = context.getVariableValue(node.name);
        if (value === null) {
            return value;
        }
        if (node?.postfix) {
            return value.getDataValue(this, node.postfix, context);
        }
        return value;
    }

    static _priority = new Map<string, number>([["f32", 0], ["f16", 1], ["u32", 2], ["i32", 3], ["x32", 3]]);
    _maxFormatTypeInfo(x: TypeInfo[]): TypeInfo | null {
        let t = x[0];
        if (t.name === "f32") {
            return t;
        }
        for (let i = 1; i < x.length; ++i) {
            const tv = WgslExec._priority.get(t.name);
            const xv = WgslExec._priority.get(x[i].name);
            if (xv < tv) {
                t = x[i];
            }
        }

        if (t.name === "x32") {
            return this.getTypeInfo("i32");
        }

        return t;
    }

    _evalUnaryOp(node: UnaryOperator, context: ExecContext): Data | null {
        const _r = this.evalExpression(node.right, context);
        const r = _r instanceof ScalarData ? _r.value : 
            _r instanceof VectorData ? _r.value : null;

        switch (node.operator) {
            case "+": {
                if (isArray(r)) {
                    const ra = r as number[];
                    const result = ra.map((x: number, i: number) => +x);
                    return new VectorData(result, _r.typeInfo);
                }
                const rn = r as number;
                const t = this._maxFormatTypeInfo([_r.typeInfo, _r.typeInfo]);
                return new ScalarData(+rn, t);
            }
            case "-": {
                if (isArray(r)) {
                    const ra = r as number[];
                    const result = ra.map((x: number, i: number) => -x);
                    return new VectorData(result, _r.typeInfo);
                }
                const rn = r as number;
                const t = this._maxFormatTypeInfo([_r.typeInfo, _r.typeInfo]);
                return new ScalarData(-rn, t);
            }
            case "!": {
                if (isArray(r)) {
                    const ra = r as number[];
                    const result = ra.map((x: number, i: number) => !x ? 1 : 0);
                    return new VectorData(result, _r.typeInfo);
                }
                const rn = r as number;
                const t = this._maxFormatTypeInfo([_r.typeInfo, _r.typeInfo]);
                return new ScalarData(!rn ? 1 : 0, t);
            }
            case "~": {
                if (isArray(r)) {
                    const ra = r as number[];
                    const result = ra.map((x: number, i: number) => ~x);
                    return new VectorData(result, _r.typeInfo);
                }
                const rn = r as number;
                const t = this._maxFormatTypeInfo([_r.typeInfo, _r.typeInfo]);
                return new ScalarData(~rn, t);
            }
        }
        console.error(`Invalid unary operator ${node.operator}. Line ${node.line}`);
        return null;
    }

    _evalBinaryOp(node: BinaryOperator, context: ExecContext): Data | null {
        const _l = this.evalExpression(node.left, context);
        const _r = this.evalExpression(node.right, context);

        const l = _l instanceof ScalarData ? _l.value : 
            _l instanceof VectorData ? _l.value :
            _l instanceof MatrixData ? _l.value : null;
        const r = _r instanceof ScalarData ? _r.value : 
            _r instanceof VectorData ? _r.value : 
            _r instanceof MatrixData ? _r.value :
            null;

        switch (node.operator) {
            case "+": {
                if (isArray(l) && isArray(r)) {
                    const la = l as number[];
                    const ra = r as number[];
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x: number, i: number) => x + ra[i]);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(l)) {
                    const la = l as number[];
                    const rn = r as number;
                    const result = la.map((x: number, i: number) => x + rn);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(r)) {
                    const ln = l as number;
                    const ra = r as number[];
                    const result = ra.map((x: number, i: number) => ln + x);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l as number;
                const rn = r as number;
                const t = this._maxFormatTypeInfo([_l.typeInfo, _r.typeInfo]);
                return new ScalarData(ln + rn, t);
            }
            case "-": {
                if (isArray(l) && isArray(r)) {
                    const la = l as number[];
                    const ra = r as number[];
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x: number, i: number) => x - ra[i]);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(l)) {
                    const la = l as number[];
                    const rn = r as number;
                    const result = la.map((x: number, i: number) => x - rn);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(r)) {
                    const ln = l as number;
                    const ra = r as number[];
                    const result = ra.map((x: number, i: number) => ln - x);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l as number;
                const rn = r as number;
                const t = this._maxFormatTypeInfo([_l.typeInfo, _r.typeInfo]);
                return new ScalarData(ln - rn, t);
            }
            case "*": {
                if (isArray(l) && isArray(r)) {
                    const la = l as number[];
                    const ra = r as number[];
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x: number, i: number) => x * ra[i]);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(l)) {
                    const la = l as number[];
                    const rn = r as number;
                    const result = la.map((x: number, i: number) => x * rn);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(r)) {
                    const ln = l as number;
                    const ra = r as number[];
                    const result = ra.map((x: number, i: number) => ln * x);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l as number;
                const rn = r as number;
                const t = this._maxFormatTypeInfo([_l.typeInfo, _r.typeInfo]);
                return new ScalarData(ln * rn, t);
            }
            case "%": {
                if (isArray(l) && isArray(r)) {
                    const la = l as number[];
                    const ra = r as number[];
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x: number, i: number) => x % ra[i]);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(l)) {
                    const la = l as number[];
                    const rn = r as number;
                    const result = la.map((x: number, i: number) => x % rn);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(r)) {
                    const ln = l as number;
                    const ra = r as number[];
                    const result = ra.map((x: number, i: number) => ln % x);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l as number;
                const rn = r as number;
                const t = this._maxFormatTypeInfo([_l.typeInfo, _r.typeInfo]);
                return new ScalarData(ln % rn, t);
            }
            case "/": {
                if (isArray(l) && isArray(r)) {
                    const la = l as number[];
                    const ra = r as number[];
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x: number, i: number) => x / ra[i]);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(l)) {
                    const la = l as number[];
                    const rn = r as number;
                    const result = la.map((x: number, i: number) => x / rn);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(r)) {
                    const ln = l as number;
                    const ra = r as number[];
                    const result = ra.map((x: number, i: number) => ln / x);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l as number;
                const rn = r as number;
                const t = this._maxFormatTypeInfo([_l.typeInfo, _r.typeInfo]);
                return new ScalarData(ln / rn, t);
            }
            case "&": {
                if (isArray(l) && isArray(r)) {
                    const la = l as number[];
                    const ra = r as number[];
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x: number, i: number) => x & ra[i]);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(l)) {
                    const la = l as number[];
                    const rn = r as number;
                    const result = la.map((x: number, i: number) => x & rn);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(r)) {
                    const ln = l as number;
                    const ra = r as number[];
                    const result = ra.map((x: number, i: number) => ln & x);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l as number;
                const rn = r as number;
                const t = this._maxFormatTypeInfo([_l.typeInfo, _r.typeInfo]);
                return new ScalarData(ln & rn, t);
            }
            case "|": {
                if (isArray(l) && isArray(r)) {
                    const la = l as number[];
                    const ra = r as number[];
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x: number, i: number) => x | ra[i]);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(l)) {
                    const la = l as number[];
                    const rn = r as number;
                    const result = la.map((x: number, i: number) => x | rn);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(r)) {
                    const ln = l as number;
                    const ra = r as number[];
                    const result = ra.map((x: number, i: number) => ln | x);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l as number;
                const rn = r as number;
                const t = this._maxFormatTypeInfo([_l.typeInfo, _r.typeInfo]);
                return new ScalarData(ln | rn, t);
            }
            case "^": {
                if (isArray(l) && isArray(r)) {
                    const la = l as number[];
                    const ra = r as number[];
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x: number, i: number) => x ^ ra[i]);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(l)) {
                    const la = l as number[];
                    const rn = r as number;
                    const result = la.map((x: number, i: number) => x ^ rn);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(r)) {
                    const ln = l as number;
                    const ra = r as number[];
                    const result = ra.map((x: number, i: number) => ln ^ x);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l as number;
                const rn = r as number;
                const t = this._maxFormatTypeInfo([_l.typeInfo, _r.typeInfo]);
                return new ScalarData(ln ^ rn, t);
            }
            case "<<": {
                if (isArray(l) && isArray(r)) {
                    const la = l as number[];
                    const ra = r as number[];
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x: number, i: number) => x << ra[i]);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(l)) {
                    const la = l as number[];
                    const rn = r as number;
                    const result = la.map((x: number, i: number) => x << rn);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(r)) {
                    const ln = l as number;
                    const ra = r as number[];
                    const result = ra.map((x: number, i: number) => ln << x);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l as number;
                const rn = r as number;
                const t = this._maxFormatTypeInfo([_l.typeInfo, _r.typeInfo]);
                return new ScalarData(ln << rn, t);
            }
            case ">>": {
                if (isArray(l) && isArray(r)) {
                    const la = l as number[];
                    const ra = r as number[];
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x: number, i: number) => x >> ra[i]);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(l)) {
                    const la = l as number[];
                    const rn = r as number;
                    const result = la.map((x: number, i: number) => x >> rn);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(r)) {
                    const ln = l as number;
                    const ra = r as number[];
                    const result = ra.map((x: number, i: number) => ln >> x);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l as number;
                const rn = r as number;
                const t = this._maxFormatTypeInfo([_l.typeInfo, _r.typeInfo]);
                return new ScalarData(ln >> rn, t);
            }
            case ">": {
                if (isArray(l) && isArray(r)) {
                    const la = l as number[];
                    const ra = r as number[];
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x: number, i: number) => x > ra[i] ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(l)) {
                    const la = l as number[];
                    const rn = r as number;
                    const result = la.map((x: number, i: number) => x > rn ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(r)) {
                    const ln = l as number;
                    const ra = r as number[];
                    const result = ra.map((x: number, i: number) => ln > x ? 1 : 0);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l as number;
                const rn = r as number;
                return new ScalarData(ln > rn ? 1 : 0, this.getTypeInfo("bool"));
            }
            case "<":
                if (isArray(l) && isArray(r)) {
                    const la = l as number[];
                    const ra = r as number[];
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x: number, i: number) => x < ra[i] ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(l)) {
                    const la = l as number[];
                    const rn = r as number;
                    const result = la.map((x: number, i: number) => x < rn ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(r)) {
                    const ln = l as number;
                    const ra = r as number[];
                    const result = ra.map((x: number, i: number) => ln < x ? 1 : 0);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l as number;
                const rn = r as number;
                return new ScalarData(ln < rn ? 1 : 0, this.getTypeInfo("bool"));
            case "==": {
                if (isArray(l) && isArray(r)) {
                    const la = l as number[];
                    const ra = r as number[];
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x: number, i: number) => x === ra[i] ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(l)) {
                    const la = l as number[];
                    const rn = r as number;
                    const result = la.map((x: number, i: number) => x == rn ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(r)) {
                    const ln = l as number;
                    const ra = r as number[];
                    const result = ra.map((x: number, i: number) => ln == x ? 1 : 0);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l as number;
                const rn = r as number;
                return new ScalarData(ln === rn ? 1 : 0, this.getTypeInfo("bool"));
            }
            case "!=": {
                if (isArray(l) && isArray(r)) {
                    const la = l as number[];
                    const ra = r as number[];
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x: number, i: number) => x !== ra[i] ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(l)) {
                    const la = l as number[];
                    const rn = r as number;
                    const result = la.map((x: number, i: number) => x !== rn ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(r)) {
                    const ln = l as number;
                    const ra = r as number[];
                    const result = ra.map((x: number, i: number) => ln !== x ? 1 : 0);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l as number;
                const rn = r as number;
                return new ScalarData(ln !== rn ? 1 : 0, this.getTypeInfo("bool"));
            }
            case ">=": {
                if (isArray(l) && isArray(r)) {
                    const la = l as number[];
                    const ra = r as number[];
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x: number, i: number) => x >= ra[i] ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(l)) {
                    const la = l as number[];
                    const rn = r as number;
                    const result = la.map((x: number, i: number) => x >= rn ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(r)) {
                    const ln = l as number;
                    const ra = r as number[];
                    const result = ra.map((x: number, i: number) => ln >= x ? 1 : 0);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l as number;
                const rn = r as number;
                return new ScalarData(ln >= rn ? 1 : 0, this.getTypeInfo("bool"));
            }
            case "<=": {
                if (isArray(l) && isArray(r)) {
                    const la = l as number[];
                    const ra = r as number[];
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x: number, i: number) => x <= ra[i] ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(l)) {
                    const la = l as number[];
                    const rn = r as number;
                    const result = la.map((x: number, i: number) => x <= rn ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(r)) {
                    const ln = l as number;
                    const ra = r as number[];
                    const result = ra.map((x: number, i: number) => ln <= x ? 1 : 0);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l as number;
                const rn = r as number;
                return new ScalarData(ln <= rn ? 1 : 0, this.getTypeInfo("bool"));
            }
            case "&&": {
                if (isArray(l) && isArray(r)) {
                    const la = l as number[];
                    const ra = r as number[];
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x: number, i: number) => x && ra[i] ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(l)) {
                    const la = l as number[];
                    const rn = r as number;
                    const result = la.map((x: number, i: number) => x && rn ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(r)) {
                    const ln = l as number;
                    const ra = r as number[];
                    const result = ra.map((x: number, i: number) => ln && x ? 1 : 0);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l as number;
                const rn = r as number;
                return new ScalarData(ln && rn ? 1 : 0, this.getTypeInfo("bool"));
            }
            case "||": {
                if (isArray(l) && isArray(r)) {
                    const la = l as number[];
                    const ra = r as number[];
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x: number, i: number) => x || ra[i] ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(l)) {
                    const la = l as number[];
                    const rn = r as number;
                    const result = la.map((x: number, i: number) => x || rn ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                } else if (isArray(r)) {
                    const ln = l as number;
                    const ra = r as number[];
                    const result = ra.map((x: number, i: number) => ln || x ? 1 : 0);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l as number;
                const rn = r as number;
                return new ScalarData(ln || rn ? 1 : 0, this.getTypeInfo("bool"));
            }
        }
        console.error(`Unknown operator ${node.operator}. Line ${node.line}`);
        return null;
    }

    _evalCall(node: CallExpr, context: ExecContext): Data | null {
        if (node.cachedReturnValue !== null) {
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
            const value = this.evalExpression(node.args[ai], subContext);
            subContext.setVariable(arg.name, value, arg);
        }

        return this._execStatements(f.node.body, subContext);
    }

    _callBuiltinFunction(node: CallExpr | Call, context: ExecContext): Data | null {
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
                const value = this.evalExpression(node.args[ai], subContext);
                subContext.setVariable(arg.name, value, arg);
            }
            return this._execStatements(f.node.body, subContext);
        }

        //console.error(`Function ${node.name} not found. Line ${node.line}`);
        return null;
    }

    _callConstructorValue(node: CreateExpr, context: ExecContext): Data | null {
        if (!node.args || node.args.length === 0) {
            return new ScalarData(0, this.getTypeInfo(node.type));
        }
        const v = this.evalExpression(node.args[0], context);
        v.typeInfo = this.getTypeInfo(node.type);
        return v;
    }

    _callConstructorVec(node: CreateExpr | LiteralExpr, context: ExecContext): Data | null {
        const typeInfo = this.getTypeInfo(node.type);
        const typeName = this.getTypeName(node.type);

        const elementCounts = {
            "vec2": 2, "vec2f": 2, "vec2i": 2, "vec2u": 2, "vec2b": 2, "vec2h": 2,
            "vec3": 3, "vec3f": 3, "vec3i": 3, "vec3u": 3, "vec3b": 3, "vec3h": 3,
            "vec4": 4, "vec4f": 4, "vec4i": 4, "vec4u": 4, "vec4b": 4, "vec4h": 4
        };

        const count = elementCounts[typeName];
        if (count === undefined) {
            console.error(`Invalid vec constructor ${typeName}. Line ${node.line}`);
            return null;
        }

        const isInt = typeName.endsWith("i") || typeName.endsWith("u");

        const values: number[] = [];
        if (node instanceof LiteralExpr) {
            if (node.isVector) {
                const a = node.vectorValue;
                for (const v of a) {
                    values.push(v);
                }
            } else {
                values.push(node.scalarValue);
            }
        } else {
            if (node.args) {
                for (const arg of node.args) {
                    const argValue = this.evalExpression(arg, context) ;
                    if (argValue instanceof VectorData) {
                        const vd = argValue.value;
                        for (let i = 0; i < vd.length; ++i) {
                            let e = vd[i];
                            if (isInt) {
                                e = Math.floor(e);
                            }
                            values.push(e);
                        }
                    } else if (argValue instanceof ScalarData) {
                        let v = argValue.value;
                        if (isInt) {
                            v = Math.floor(v);
                        }
                        values.push(v);
                    }
                }
            }
        }

        if (node.type instanceof TemplateType && node.type.format === null) {
            node.type.format = TemplateType.f32; // TODO: get the format from the type of the arg.
        }

        if (values.length === 0) {
            const values = new Array(count).fill(0);
            return new VectorData(values, typeInfo);
        }

        if (values.length === 1) {
            while (values.length < count) {
                values.push(values[0]);
            }
        }

        if (values.length < count) {
            console.error(`Invalid vec constructor. Line ${node.line}`);
            return null;
        }

        return new VectorData(values.length > count ? values.slice(0, count) : values, typeInfo);
    }

    _callConstructorMatrix(node: CreateExpr | LiteralExpr, context: ExecContext): Data | null {
        const typeInfo = this.getTypeInfo(node.type);
        const typeName = this.getTypeName(node.type);

        const elementCounts = {
            "mat2x2": 4, "mat2x2f": 4, "mat2x2h": 4,
            "mat2x3": 6, "mat2x3f": 6, "mat2x3h": 6,
            "mat2x4": 8, "mat2x4f": 8, "mat2x4h": 8,
            "mat3x2": 6, "mat3x2f": 6, "mat3x2h": 6,
            "mat3x3": 9, "mat3x3f": 9, "mat3x3h": 9,
            "mat3x4": 12, "mat3x4f": 12, "mat3x4h": 12,
            "mat4x2": 8, "mat4x2f": 8, "mat4x2h": 8,
            "mat4x3": 12, "mat4x3f": 12, "mat4x3h": 12,
            "mat4x4": 16, "mat4x4f": 16, "mat4x4h": 16
        };

        const count = elementCounts[typeName];
        if (count === undefined) {
            console.error(`Invalid matrix constructor ${typeName}. Line ${node.line}`);
            return null;
        }

        const values = [];
        if (node instanceof LiteralExpr) {
            if (node.isVector) {
                const a = node.vectorValue;
                for (const v of a) {
                    values.push(v);
                }
            } else {
                values.push(node.scalarValue);
            }
        } else {
            if (node.args) {
                for (const arg of node.args) {
                    const argValue = this.evalExpression(arg, context) ;
                    if (argValue instanceof VectorData) {
                        const vd = argValue.value;
                        for (let i = 0; i < vd.length; ++i) {
                            values.push(vd[i]);
                        }
                    } else if (argValue instanceof ScalarData) {
                        values.push(argValue.value);
                    } else if (argValue instanceof MatrixData) {
                        values.push(...argValue.value);
                    }
                }
            }
        }

        if ((typeInfo instanceof TemplateInfo) && typeInfo.format === null) {
            typeInfo.format = this.getTypeInfo("f32");
        }

        if (values.length === 0) {
            const values = new Array(count).fill(0);
            return new MatrixData(values, typeInfo);
        }

        if (values.length !== count) {
            console.error(`Invalid matrix constructor. Line ${node.line}`);
            return null;
        }

        return new MatrixData(values, typeInfo);
    }
}
