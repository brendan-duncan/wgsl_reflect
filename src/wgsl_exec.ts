import * as AST from "./wgsl_ast.js";
import { WgslParser } from "./wgsl_parser.js";
import { WgslReflect, TypeInfo, ArrayInfo, StructInfo, TemplateInfo } from "./wgsl_reflect.js";

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

    _assign(node: AST.Assign, context: ExecContext) {
        const name = this._getVariableName(node.variable, context);
        const v = context.getVariable(name);

        if (!v) {
            console.error(`Variable ${name} not found. Line ${node.line}`);
            return;
        }

        let value = this._evalExpression(node.value, context);

        if (node.operator !== "=") {
            const currentValue = this._getDataValue(v.value, node.variable.postfix, context);

            if (currentValue.length !== undefined && value.length !== undefined) {
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
                this._callConstructorValue(node, context) ? 1 : 0;
            case "i32":
            case "u32":
                return Math.floor(this._callConstructorValue(node, context));
            case "f32":
            case "f16":
                this._callConstructorValue(node, context);
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
            return this._callFunction(node, context);
        }

        const subContext = context.clone();
        for (let ai = 0; ai < f.node.args.length; ++ai) {
            const arg = f.node.args[ai];
            const value = this._evalExpression(node.args[ai], subContext);
            subContext.setVariable(arg.name, value, arg);
        }

        return this._execStatements(f.node.body, subContext);
    }

    _callFunction(node: AST.CallExpr, context: ExecContext) {
        switch (node.name) {
            // Logical Built-in Functions
            case "all":
                return this._callAll(node, context);
            case "any":
                return this._callAny(node, context);
            case "select":
                return this._callSelect(node, context);

            // Array Built-in Functions
            case "arrayLength":
                return this._callArrayLength(node, context);

            // Numeric Built-in Functions
            case "abs":
                return this._callAbs(node, context);
            case "acos":
                return this._callAcos(node, context);
            case "acosh":
                return this._callAcosh(node, context);
            case "asin":
                return this._callAsin(node, context);
            case "asinh":
                return this._callAsinh(node, context);
            case "atan":
                return this._callAtan(node, context);
            case "atanh":
                return this._callAtanh(node, context);
            case "atan2":
                return this._callAtan2(node, context);
            case "ceil":
                return this._callCeil(node, context);
            case "clamp":
                return this._callClamp(node, context);
            case "cos":
                return this._callCos(node, context);
            case "cosh":
                return this._callCosh(node, context);
            case "countLeadingZeros":
                return this._callCountLeadingZeros(node, context);
            case "countOneBits":
                return this._callCountOneBits(node, context);
            case "countTrailingZeros":
                return this._callCountTrailingZeros(node, context);
            case "cross":
                return this._callCross(node, context);
            case "degrees":
                return this._callDegrees(node, context);
            case "determinant":
                return this._callDeterminant(node, context);
            case "distance":
                return this._callDistance(node, context);
            case "dot":
                return this._callDot(node, context);
            case "dot4U8Packed":
                return this._callDot4U8Packed(node, context);
            case "dot4I8Packed":
                return this._callDot4I8Packed(node, context);
            case "exp":
                return this._callExp(node, context);
            case "exp2":
                return this._callExp2(node, context);
            case "extractBits":
                return this._callExtractBits(node, context);
            case "faceForward":
                return this._callFaceForward(node, context);
            case "firstLeadingBit":
                return this._callFirstLeadingBit(node, context);
            case "firstTrailingBit":
                return this._callFirstTrailingBit(node, context);
            case "floor":
                return this._callFloor(node, context);
            case "fma":
                return this._callFma(node, context);
            case "fract":
                return this._callFract(node, context);
            case "frexp":
                return this._callFrexp(node, context);
            case "insertBits":
                return this._callInsertBits(node, context);
            case "inverseSqrt":
                return this._callInverseSqrt(node, context);
            case "ldexp":
                return this._callLdexp(node, context);
            case "length":
                return this._callLength(node, context);
            case "log":
                return this._callLog(node, context);
            case "log2":
                return this._callLog2(node, context);
            case "max":
                return this._callMax(node, context);
            case "min":
                return this._callMin(node, context);
            case "mix":
                return this._callMix(node, context);
            case "modf":
                return this._callModf(node, context);
            case "normalize":
                return this._callNormalize(node, context);
            case "pow":
                return this._callPow(node, context);
            case "quantizeToF16":
                return this._callQuantizeToF16(node, context);
            case "radians":
                return this._callRadians(node, context);
            case "reflect":
                return this._callReflect(node, context);
            case "refract":
                return this._callRefract(node, context);
            case "reverseBits":
                return this._callReverseBits(node, context);
            case "round":
                return this._callRound(node, context);
            case "saturate":
                return this._callSaturate(node, context);
            case "sign":
                return this._callSign(node, context);
            case "sin":
                return this._callSin(node, context);
            case "sinh":
                return this._callSinh(node, context);
            case "smoothStep":
                return this._callSmoothStep(node, context);
            case "sqrt":
                return this._callSqrt(node, context);
            case "step":
                return this._callStep(node, context);
            case "tan":
                return this._callTan(node, context);
            case "tanh":
                return this._callTanh(node, context);
            case "transpose":
                return this._callTranspose(node, context);
            case "trunc":
                return this._callTrunc(node, context);

            // Derivative Built-in Functions
            case "dpdx":
                return this._callDpdx(node, context);
            case "dpdxCoarse":
                return this._callDpdxCoarse(node, context);
            case "dpdxFine":
                return this._callDpdxFine(node, context);
            case "dpdy":
                return this._callDpdy(node, context);
            case "dpdyCoarse":
                return this._callDpdyCoarse(node, context);
            case "dpdyFine":
                return this._callDpdyFine(node, context);
            case "fwidth":
                return this._callFwidth(node, context);
            case "fwidthCoarse":
                return this._callFwidthCoarse(node, context);
            case "fwidthFine":
                return this._callFwidthFine(node, context);

            // Texture Built-in Functions
            case "textureDimensions":
                return this._callTextureDimensions(node, context);
            case "textureGather":
                return this._callTextureGather(node, context);
            case "textureGatherCompare":
                return this._callTextureGatherCompare(node, context);
            case "textureLoad":
                return this._callTextureLoad(node, context);
            case "textureNumLayers":
                return this._callTextureNumLayers(node, context);
            case "textureNumLevels":
                return this._callTextureNumLevels(node, context);
            case "textureNumSamples":
                return this._callTextureNumSamples(node, context);
            case "textureSample":
                return this._callTextureSample(node, context);
            case "textureSampleBias":
                return this._callTextureSampleBias(node, context);
            case "textureSampleCompare":
                return this._callTextureSampleCompare(node, context);
            case "textureSampleCompareLevel":
                return this._callTextureSampleCompareLevel(node, context);
            case "textureSampleGrad":
                return this._callTextureSampleGrad(node, context);
            case "textureSampleLevel":
                return this._callTextureSampleLevel(node, context);
            case "textureSampleBaseClampToEdge":
                return this._callTextureSampleBaseClampToEdge(node, context);
            case "textureStore":
                return this._callTextureStore(node, context);

            // Atomic Built-in Functions
            case "atomicLoad":
                return this._callAtomicLoad(node, context);
            case "atomicStore":
                return this._callAtomicStore(node, context);
            case "atomicAdd":
                return this._callAtomicAdd(node, context);
            case "atomicSub":
                return this._callAtomicSub(node, context);
            case "atomicMax":
                return this._callAtomicMax(node, context);
            case "atomicMin":
                return this._callAtomicMin(node, context);
            case "atomicAnd":
                return this._callAtomicAnd(node, context);
            case "atomicOr":
                return this._callAtomicOr(node, context);
            case "atomicXor":
                return this._callAtomicXor(node, context);
            case "atomicExchange":
                return this._callAtomicExchange(node, context);
            case "atomicCompareExchangeWeak":
                return this._callAtomicCompareExchangeWeak(node, context);

            // Data Packing Built-in Functions
            case "pack4x8snorm":
                return this._callPack4x8snorm(node, context);
            case "pack4x8unorm":
                return this._callPack4x8unorm(node, context);
            case "pack4xI8":
                return this._callPack4xI8(node, context);
            case "pack4xU8":
                return this._callPack4xU8(node, context);
            case "pack4x8Clamp":
                return this._callPack4x8Clamp(node, context);
            case "pack4xU8Clamp":
                return this._callPack4xU8Clamp(node, context);
            case "pack2x16snorm":
                return this._callPack2x16snorm(node, context);
            case "pack2x16unorm":
                return this._callPack2x16unorm(node, context);
            case "pack2x16float":
                return this._callPack2x16float(node, context);

            // Data Unpacking Built-in Functions
            case "unpack4x8snorm":
                return this._callUnpack4x8snorm(node, context);
            case "unpack4x8unorm":
                return this._callUnpack4x8unorm(node, context);
            case "unpack4xI8":
                return this._callUnpack4xI8(node, context);
            case "unpack4xU8":
                return this._callUnpack4xU8(node, context);
            case "unpack2x16snorm":
                return this._callUnpack2x16snorm(node, context);
            case "unpack2x16unorm":
                return this._callUnpack2x16unorm(node, context);
            case "unpack2x16float":
                return this._callUnpack2x16float(node, context);

            // Synchronization Built-in Functions
            case "storageBarrier":
                return this._callStorageBarrier(node, context);
            case "textureBarrier":
                return this._callTextureBarrier(node, context);
            case "workgroupBarrier":
                return this._callWorkgroupBarrier(node, context);
            case "workgroupUniformLoad":
                return this._callWorkgroupUniformLoad(node, context);

            // Subgroup Built-in Functions
            case "subgroupAdd":
                return this._callSubgroupAdd(node, context);
            case "subgroupExclusiveAdd":
                return this._callSubgroupExclusiveAdd(node, context);
            case "subgroupInclusiveAdd":
                return this._callSubgroupInclusiveAdd(node, context);
            case "subgroupAll":
                return this._callSubgroupAll(node, context);
            case "subgroupAnd":
                return this._callSubgroupAnd(node, context);
            case "subgroupAny":
                return this._callSubgroupAny(node, context);
            case "subgroupBallot":
                return this._callSubgroupBallot(node, context);
            case "subgroupBroadcast":
                return this._callSubgroupBroadcast(node, context);
            case "subgroupBroadcastFirst":
                return this._callSubgroupBroadcastFirst(node, context);
            case "subgroupElect":
                return this._callSubgroupElect(node, context);
            case "subgroupMax":
                return this._callSubgroupMax(node, context);
            case "subgroupMin":
                return this._callSubgroupMin(node, context);
            case "subgroupMul":
                return this._callSubgroupMul(node, context);
            case "subgroupExclusiveMul":
                return this._callSubgroupExclusiveMul(node, context);
            case "subgroupInclusiveMul":
                return this._callSubgroupInclusiveMul(node, context);
            case "subgroupOr":
                return this._callSubgroupOr(node, context);
            case "subgroupShuffle":
                return this._callSubgroupShuffle(node, context);
            case "subgroupShuffleDown":
                return this._callSubgroupShuffleDown(node, context);
            case "subgroupShuffleUp":
                return this._callSubgroupShuffleUp(node, context);
            case "subgroupShuffleXor":
                return this._callSubgroupShuffleXor(node, context);
            case "subgroupXor":
                return this._callSubgroupXor(node, context);

            // Quad Operations
            case "quadBroadcast":
                return this._callQuadBroadcast(node, context);
            case "quadSwapDiagonal":
                return this._callQuadSwapDiagonal(node, context);
            case "quadSwapX":
                return this._callQuadSwapX(node, context);
            case "quadSwapY":
                return this._callQuadSwapY(node, context);
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

        if (typeName == "f32" || typeName == "f16" || typeName == "i32" || typeName == "u32") {
            return values[0];
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

    // Logical Built-in Functions
    _callAll(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        let isTrue = true;
        value.forEach((x: any) => { if (!x) isTrue = false; });
        return isTrue;
    }

    _callAny(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        return value.some((v: any) => v);
    }

    _callSelect(node: AST.CallExpr, context: ExecContext) {
        const condition = this._evalExpression(node.args[2], context);
        if (condition) {
            return this._evalExpression(node.args[0], context);
        } else {
            return this._evalExpression(node.args[1], context);
        }
    }

    // Array Built-in Functions
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

    // Numeric Built-in Functions
    _callAbs(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.abs(v));
        }
        return Math.abs(value);
    }

    _callAcos(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.acos(v));
        }
        return Math.acos(value);
    }

    _callAcosh(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.acosh(v));
        }
        return Math.acosh(value);
    }

    _callAsin(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.asin(v));
        }
        return Math.asin(value);
    }

    _callAsinh(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.asinh(v));
        }
        return Math.asinh(value);
    }

    _callAtan(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.atan(v));
        }
        return Math.atan(value);
    }

    _callAtanh(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.atanh(v));
        }
        return Math.atanh(value);
    }

    _callAtan2(node: AST.CallExpr, context: ExecContext) {
        const y = this._evalExpression(node.args[0], context);
        const x = this._evalExpression(node.args[1], context);
        if (y.length !== undefined) {
            return y.map((v: number, i: number) => Math.atan2(v, x[i]));
        }
        return Math.atan2(y, x);
    }

    _callCeil(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.ceil(v));
        }
        return Math.ceil(value);
    }

    _clamp(value: number, min: number, max: number) {
        return Math.min(Math.max(value, min), max);
    }

    _callClamp(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        const min = this._evalExpression(node.args[1], context);
        const max = this._evalExpression(node.args[2], context);
        if (value.length !== undefined) {
            return value.map((v: number, i: number) => this._clamp(v, min[i], max[i]));
        }
        return this._clamp(value, min, max);
    }

    _callCos(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.cos(v));
        }
        return Math.cos(value);
    }

    _callCosh(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.cosh(v));
        }
        return Math.cosh(value);
    }

    _callCountLeadingZeros(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.clz32(v));
        }
        return Math.clz32(value);
    }

    _countOneBits(value: number) {
        let count = 0;
        while (value !== 0) {
            if (value & 1) {
                count++;
            }
            value >>= 1;
        }
        return count;
    }

    _callCountOneBits(node: AST.CallExpr, context: ExecContext) {
        let x = this._evalExpression(node.args[0], context);
        if (x.length !== undefined) {
            return x.map((v: number) => this._countOneBits(v));
        }
        return this._countOneBits(x);
    }

    _countTrailingZeros(value: number) {
        if (x === 0) {
            return 32; // Special case for 0
        }
        let count = 0;
        while ((x & 1) === 0) {
            x >>= 1;
            count++;
        }
        return count;
    }

    _callCountTrailingZeros(node: AST.CallExpr, context: ExecContext) {
        let x = this._evalExpression(node.args[0], context);
        if (x.length !== undefined) {
            return x.map((v: number) => this._countTrailingZeros(v));
        }
        this._countTrailingZeros(x);
    }

    _callCross(node: AST.CallExpr, context: ExecContext) {
        const l = this._evalExpression(node.args[0], context);
        const r = this._evalExpression(node.args[1], context);
        return [
            l[1] * r[2] - r[1] * l[2],
            l[2] * r[0] - r[2] * l[0],
            l[0] * r[1] - r[0] * l[1],
        ];
    }

    _callDegrees(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => v * 180 / Math.PI);
        }
        return value * 180 / Math.PI;
    }

    _callDeterminant(node: AST.CallExpr, context: ExecContext) {
        const m = this._evalExpression(node.args[0], context);
        // TODO: get the dimensions of the matrix
        if (m.length === 4) {
            return m[0] * m[3] - m[1] * m[2];
        }
        console.error(`TODO: determinant for matrix. Line ${node.line}`);
        return null;
    }

    _callDistance(node: AST.CallExpr, context: ExecContext) {
        const l = this._evalExpression(node.args[0], context);
        const r = this._evalExpression(node.args[1], context);
        let sum = 0;
        for (let i = 0; i < l.length; ++i) {
            sum += (l[i] - r[i]) * (l[i] - r[i]);
        }
        return Math.sqrt(sum);
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

    _callDot4U8Packed(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: dot4U8Packed");
        return null;
    }

    _callDot4I8Packed(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: dot4I8Packed");
        return null;
    }

    _callExp(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.exp(v));
        }
        return Math.exp(value);
    }

    _callExp2(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.pow(2, v));
        }
        return Math.pow(2, value);
    }

    _callExtractBits(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        const offset = this._evalExpression(node.args[1], context);
        const count = this._evalExpression(node.args[2], context);
        return (value >> offset) & ((1 << count) - 1);
    }

    _callFaceForward(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: faceForward");
        return null;
    }

    _callFirstLeadingBit(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: firstLeadingBit");
        return null;
    }

    _callFirstTrailingBit(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: firstTrailingBit");
        return null;
    }

    _callFloor(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.floor(v));
        }
        return Math.floor(value);
    }

    _callFma(node: AST.CallExpr, context: ExecContext) {
        const a = this._evalExpression(node.args[0], context);
        const b = this._evalExpression(node.args[1], context);
        const c = this._evalExpression(node.args[2], context);
        if (a.length !== undefined) {
            return a.map((v: number, i: number) => v * b[i] + c[i]);
        }
        return a * b + c;
    }

    _callFract(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => v - Math.floor(v));
        }
        return value - Math.floor(value);
    }

    _callFrexp(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: frexp");
        return null;
    }

    _callInsertBits(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        const insert = this._evalExpression(node.args[1], context);
        const offset = this._evalExpression(node.args[2], context);
        const count = this._evalExpression(node.args[3], context);
        const mask = ((1 << count) - 1) << offset;
        return (value & ~mask) | ((insert << offset) & mask);
    }

    _callInverseSqrt(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => 1 / Math.sqrt(v));
        }
        return 1 / Math.sqrt(value);
    }

    _callLdexp(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: ldexp");
        return null;
    }

    _callLength(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        let sum = 0;
        for (let i = 0; i < value.length; ++i) {
            sum += value[i] * value[i];
        }
        return Math.sqrt(sum);
    }

    _callLog(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.log(v));
        }
        return Math.log(value);
    }

    _callLog2(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.log2(v));
        }
        return Math.log2(value);
    }

    _callMax(node: AST.CallExpr, context: ExecContext) {
        const l = this._evalExpression(node.args[0], context);
        const r = this._evalExpression(node.args[1], context);
        if (l.length !== undefined) {
            return l.map((v: number, i: number) => Math.max(v, r[i]));
        }
        return Math.max(l, r);
    }

    _callMin(node: AST.CallExpr, context: ExecContext) {
        const l = this._evalExpression(node.args[0], context);
        const r = this._evalExpression(node.args[1], context);
        if (l.length !== undefined) {
            return l.map((v: number, i: number) => Math.min(v, r[i]));
        }
        return Math.min(l, r);
    }

    _callMix(node: AST.CallExpr, context: ExecContext) {
        const x = this._evalExpression(node.args[0], context);
        const y = this._evalExpression(node.args[1], context);
        const a = this._evalExpression(node.args[2], context);
        if (x.length !== undefined) {
            return x.map((v: number, i: number) => x[i] * (1 - a[i]) + y[i] * a[i]);
        }
        return x * (1 - a) + y * a;
    }

    _callModf(node: AST.CallExpr, context: ExecContext) {
        const x = this._evalExpression(node.args[0], context);
        const y = this._evalExpression(node.args[1], context);
        if (x.length !== undefined) {
            return x.map((v: number, i: number) => v % y[i]);
        }
        return x % y;
    }

    _callNormalize(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        const length = this._callLength(node, context);
        return value.map((v: any) => v / length);
    }

    _callPow(node: AST.CallExpr, context: ExecContext) {
        const x = this._evalExpression(node.args[0], context);
        const y = this._evalExpression(node.args[1], context);
        if (x.length !== undefined) {
            return x.map((v: number, i: number) => Math.pow(v, y[i]));
        }
        return Math.pow(x, y);
    }

    _callQuantizeToF16(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: quantizeToF16");
        return null;
    }

    _callRadians(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => v * Math.PI / 180);
        }
        return value * Math.PI / 180;
    }

    _callReflect(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: reflect");
        return null;
    }

    _callRefract(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: refract");
        return null;
    }

    _callReverseBits(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: reverseBits");
        return null;
    }

    _callRound(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.round(v));
        }
        return Math.round(value);
    }

    _callSaturate(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.min(Math.max(v, 0), 1));
        }
        return Math.min(Math.max(value, 0), 1);
    }

    _callSign(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.sign(v));
        }
        return Math.sign(value);
    }

    _callSin(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.sin(v));
        }
        return Math.sin(value);
    }

    _callSinh(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.sinh(v));
        }
        return Math.sinh(value);
    }

    _smoothstep(edge0: number, edge1: number, x: number) {
        const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
        return t * t * (3 - 2 * t);
    }

    _callSmoothStep(node: AST.CallExpr, context: ExecContext) {
        const edge0 = this._evalExpression(node.args[0], context);
        const edge1 = this._evalExpression(node.args[1], context);
        const x = this._evalExpression(node.args[2], context);
        if (x.length !== undefined) {
            return x.map((v: number, i: number) => this._smoothstep(edge0[i], edge1[i], v));
        }
        return this._smoothstep(edge0, edge1, x);
    }

    _callSqrt(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.sqrt(v));
        }
        return Math.sqrt(value);
    }

    _callStep(node: AST.CallExpr, context: ExecContext) {
        const edge = this._evalExpression(node.args[0], context);
        const x = this._evalExpression(node.args[1], context);
        if (x.length !== undefined) {
            return x.map((v: number, i: number) => v < edge[i] ? 0 : 1);
        }
        return x < edge ? 0 : 1;
    }

    _callTan(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.tan(v));
        }
        return Math.tan(value);
    }

    _callTanh(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.tanh(v));
        }
        return Math.tanh(value);
    }

    _callTranspose(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: transpose");
        return null;
    }

    _callTrunc(node: AST.CallExpr, context: ExecContext) {
        const value = this._evalExpression(node.args[0], context);
        if (value.length !== undefined) {
            return value.map((v: number) => Math.trunc(v));
        }
        return Math.trunc(value);
    }

    // Derivative Built-in Functions
    _callDpdx(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: dpdx");
        return null;
    }

    _callDpdxCoarse(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: dpdxCoarse");
        return null;
    }

    _callDpdxFine(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: dpdxFine");
        return null;
    }

    _callDpdy(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: dpdy");
        return null;
    }

    _callDpdyCoarse(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: dpdyCoarse");
        return null;
    }

    _callDpdyFine(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: dpdyFine");
        return null;
    }

    _callFwidth(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: fwidth");
        return null;
    }

    _callFwidthCoarse(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: fwidthCoarse");
        return null;
    }

    _callFwidthFine(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: fwidthFine");
        return null;
    }

    // Texture Built-in Functions
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

    _callTextureGather(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureGather");
        return null;
    }

    _callTextureGatherCompare(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureGatherCompare");
        return null;
    }

    _callTextureLoad(node: AST.CallExpr, context: ExecContext) {
        const textureArg = node.args[0];
        const uv = this._evalExpression(node.args[1], context);
        const level = node.args.length > 2 ? this._evalExpression(node.args[2], context) : 0;
        if (textureArg instanceof AST.VariableExpr) {
            const textureName = (textureArg as AST.VariableExpr).name;
            const texture = context.getVariableValue(textureName);
            if (texture instanceof Data) {
                const textureSize = texture.textureSize;
                const x = Math.floor(uv[0]);
                const y = Math.floor(uv[1]);
                // TODO non RGBA8 textures
                const offset = (y * textureSize[0] + x) * 4; 
                const texel = new Uint8Array(texture.buffer, offset, 4);
                // TODO: non-f32 textures
                return [texel[0] / 255, texel[1] / 255, texel[2] / 255, texel[3] / 255];
            } else {
                console.error(`Texture ${textureName} not found. Line ${node.line}`);
                return null;
            }
        }
        return null;
    }

    _callTextureNumLayers(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureNumLayers");
        return null;
    }

    _callTextureNumLevels(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureNumLevels");
        return null;
    }

    _callTextureNumSamples(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureNumSamples");
        return null;
    }

    _callTextureSample(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureSample");
        return null;
    }

    _callTextureSampleBias(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureSampleBias");
        return null;
    }

    _callTextureSampleCompare(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureSampleCompare");
        return null;
    }

    _callTextureSampleCompareLevel(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureSampleCompareLevel");
        return null;
    }

    _callTextureSampleGrad(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureSampleGrad");
        return null;
    }

    _callTextureSampleLevel(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureSampleLevel");
        return null;
    }

    _callTextureSampleBaseClampToEdge(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureSampleBaseClampToEdge");
        return null;
    }

    _callTextureStore(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureStore");
        return null;
    }

    // Atomic Built-in Functions
    _callAtomicLoad(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: atomicLoad");
        return null;
    }

    _callAtomicStore(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: atomicStore");
        return null;
    }

    _callAtomicAdd(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: atomicAdd");
        return null;
    }

    _callAtomicSub(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: atomicSub");
        return null;
    }

    _callAtomicMax(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: atomicMax");
        return null;
    }

    _callAtomicMin(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: atomicMin");
        return null;
    }

    _callAtomicAnd(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: atomicAnd");
        return null;
    }

    _callAtomicOr(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: atomicOr");
        return null;
    }

    _callAtomicXor(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: atomicXor");
        return null;
    }

    _callAtomicExchange(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: atomicExchange");
        return null;
    }

    _callAtomicCompareExchangeWeak(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: atomicCompareExchangeWeak");
        return null;
    }

    // Data Packing Built-in Functions
    _callPack4x8snorm(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: pack4x8snorm");
        return null;
    }

    _callPack4x8unorm(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: pack4x8unorm");
        return null;
    }

    _callPack4xI8(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: pack4xI8");
        return null;
    }

    _callPack4xU8(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: pack4xU8");
        return null;
    }

    _callPack4x8Clamp(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: pack4x8Clamp");
        return null;
    }

    _callPack4xU8Clamp(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: pack4xU8Clamp");
        return null;
    }

    _callPack2x16snorm(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: pack2x16snorm");
        return null;
    }

    _callPack2x16unorm(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: pack2x16unorm");
        return null;
    }

    _callPack2x16float(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: pack2x16float");
        return null;
    }

    // Data Unpacking Built-in Functions
    _callUnpack4x8snorm(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: unpack4x8snorm");
        return null;
    }

    _callUnpack4x8unorm(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: unpack4x8unorm");
        return null;
    }

    _callUnpack4xI8(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: unpack4xI8");
        return null;
    }

    _callUnpack4xU8(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: unpack4xU8");
        return null;
    }

    _callUnpack2x16snorm(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: unpack2x16snorm");
        return null;
    }

    _callUnpack2x16unorm(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: unpack2x16unorm");
        return null;
    }

    _callUnpack2x16float(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: unpack2x16float");
        return null;
    }

    // Synchronization Functions
    _callStorageBarrier(node: AST.CallExpr, context: ExecContext) {
        // Execution is single threaded, barriers not necessary.
        return null;
    }

    _callTextureBarrier(node: AST.CallExpr, context: ExecContext) {
        // Execution is single threaded, barriers not necessary.
        return null;
    }

    _callWorkgroupBarrier(node: AST.CallExpr, context: ExecContext) {
        // Execution is single threaded, barriers not necessary.
        return null;
    }

    _callWorkgroupUniformLoad(node: AST.CallExpr, context: ExecContext) {
        // Execution is single threaded, barriers not necessary.
        return null;
    }

    // Subgroup Functions
    _callSubgroupAdd(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupAdd");
        return null;
    }

    _callSubgroupExclusiveAdd(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupExclusiveAdd");
        return null;
    }

    _callSubgroupInclusiveAdd(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupInclusiveAdd");
        return null;
    }

    _callSubgroupAll(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupAll");
        return null;
    }

    _callSubgroupAnd(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupAnd");
        return null;
    }

    _callSubgroupAny(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupAny");
        return null;
    }

    _callSubgroupBallot(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupBallot");
        return null;
    }

    _callSubgroupBroadcast(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupBroadcast");
        return null;
    }

    _callSubgroupBroadcastFirst(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupBroadcastFirst");
        return null;
    }

    _callSubgroupElect(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupElect");
        return null;
    }

    _callSubgroupMax(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupMax");
        return null;
    }

    _callSubgroupMin(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupMin");
        return null;
    }

    _callSubgroupMul(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupMul");
        return null;
    }

    _callSubgroupExclusiveMul(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupExclusiveMul");
        return null;
    }

    _callSubgroupInclusiveMul(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupInclusiveMul");
        return null;
    }

    _callSubgroupOr(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupOr");
        return null;
    }

    _callSubgroupShuffle(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupShuffle");
        return null;
    }

    _callSubgroupShuffleDown(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupShuffleDown");
        return null;
    }

    _callSubgroupShuffleUp(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupShuffleUp");
        return null;
    }

    _callSubgroupShuffleXor(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupShuffleXor");
        return null;
    }

    _callSubgroupXor(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupXor");
        return null;
    }

    // Quad Functions
    _callQuadBroadcast(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: quadBroadcast");
        return null;
    }

    _callQuadSwapDiagonal(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: quadSwapDiagonal");
        return null;
    }

    _callQuadSwapX(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: quadSwapX");
        return null;
    }

    _callQuadSwapY(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: quadSwapY");
        return null;
    }
}
