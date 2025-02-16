import * as AST from "../wgsl_ast.js";
import { ExecContext } from "./exec_context.js";
import { ExecInterface } from "./exec_interface.js";
import { TypeInfo, ArrayInfo, StructInfo, TemplateInfo } from "../reflect/info.js";

export class Data {
    typeInfo: TypeInfo;
    constructor(typeInfo: TypeInfo) {
        this.typeInfo = typeInfo;
    }

    setDataValue(exec: ExecInterface, value: Data, postfix: AST.Expression | null, context: ExecContext): void {
        console.error(`SetDataValue: Not implemented`, value, postfix);
    }

    getDataValue(exec: ExecInterface, postfix: AST.Expression | null, context: ExecContext): Data | null {
        console.error(`GetDataValue: Not implemented`, postfix);
        return null;
    }

    toString(): string {
        return `<${this.typeInfo.name}>`;
    }
}

export class VoidData extends Data {
    constructor() {
        super(new TypeInfo("void", null));
    }

    static void = new VoidData();

    toString(): string {
        return "void";
    }
}

// Used to store scalar data
export class ScalarData extends Data {
    value: number;

    constructor(value: number, typeInfo: TypeInfo) {
        super(typeInfo);
        if (this.typeInfo.name === "i32" || this.typeInfo.name === "u32") {
            value = Math.floor(value);
        } else if (this.typeInfo.name === "bool") {
            value = value ? 1 : 0;
        }
        this.value = value;
    }

    setDataValue(exec: ExecInterface, value: Data, postfix: AST.Expression | null, context: ExecContext): void {
        if (postfix) {
            console.error(`SetDataValue: Scalar data does not support postfix`, postfix);
            return;
        }

        if (!(value instanceof ScalarData)) {
            console.error(`SetDataValue: Invalid value`, value);
            return;
        }

        let v = value.value;

        if (this.typeInfo.name === "i32" || this.typeInfo.name === "u32") {
            v = Math.floor(v);
        } else if (this.typeInfo.name === "bool") {
            v = v ? 1 : 0;
        }

        this.value = value.value;
    }

    getDataValue(exec: ExecInterface, postfix: AST.Expression | null, context: ExecContext): Data | null {
        if (postfix) {
            console.error(`GetDataValue: Scalar data does not support postfix`, postfix);
            return null;
        }

        return this;
    }

    toString(): string {
        return `${this.value}`;
    }
}

function _getVectorData(exec: ExecInterface, values: number[], formatName: string): VectorData | null {
    const size = values.length;
    if (size === 2) {
        if (formatName === "f32") {
            return new VectorData(values, exec.getTypeInfo("vec2f"));
        } else if (formatName === "i32") {
            return new VectorData(values, exec.getTypeInfo("vec2i"));
        } else if (formatName === "u32") {
            return new VectorData(values, exec.getTypeInfo("vec2u"));
        } else if (formatName === "f16") {
            return new VectorData(values, exec.getTypeInfo("vec2h"));
        } else {
            console.error(`GetDataValue: Unknown format ${formatName}`);
        }
        return null;
    }

    if (size === 3) {
        if (formatName === "f32") {
            return new VectorData(values, exec.getTypeInfo("vec3f"));
        } else if (formatName === "i32") {
            return new VectorData(values, exec.getTypeInfo("vec3i"));
        } else if (formatName === "u32") {
            return new VectorData(values, exec.getTypeInfo("vec3u"));
        } else if (formatName === "f16") {
            return new VectorData(values, exec.getTypeInfo("vec3h"));
        } else {
            console.error(`GetDataValue: Unknown format ${formatName}`);
        }
        return null;
    }

    if (size === 4) {
        if (formatName === "f32") {
            return new VectorData(values, exec.getTypeInfo("vec4f"));
        } else if (formatName === "i32") {
            return new VectorData(values, exec.getTypeInfo("vec4i"));
        } else if (formatName === "u32") {
            return new VectorData(values, exec.getTypeInfo("vec4u"));
        } else if (formatName === "f16") {
            return new VectorData(values, exec.getTypeInfo("vec4h"));
        }
        console.error(`GetDataValue: Unknown format ${formatName}`);
        return null;
    }

    console.error(`GetDataValue: Invalid vector size ${values.length}`);
    return null;
}

export class VectorData extends Data {
    value: number[];

    constructor(value: number[] | Float32Array | Uint32Array | Int32Array, typeInfo: TypeInfo) {
        super(typeInfo);
        if (Array.isArray(value)) {
            this.value = value;
        } else {
            this.value = Array.from(value);
        }
    }

    setDataValue(exec: ExecInterface, value: Data, postfix: AST.Expression | null, context: ExecContext): void {
        if (postfix instanceof AST.StringExpr) {
            console.error("TODO: Set vector postfix");
            return;
        }

        if (!(value instanceof VectorData)) {
            console.error(`SetDataValue: Invalid value`, value);
            return
        }

        this.value = value.value;
    }

    getDataValue(exec: ExecInterface, postfix: AST.Expression | null, context: ExecContext): Data | null {
        let format = exec.getTypeInfo("f32");
        if (this.typeInfo instanceof TemplateInfo) {
            format = this.typeInfo.format;
        } else {
            const typeName = this.typeInfo.name;
            if (typeName === "vec2f" || typeName === "vec3f" || typeName === "vec4f") {
                format = exec.getTypeInfo("f32");
            } else if (typeName === "vec2i" || typeName === "vec3i" || typeName === "vec4i") {
                format = exec.getTypeInfo("i32");
            } else if (typeName === "vec2u" || typeName === "vec3u" || typeName === "vec4u") {
                format = exec.getTypeInfo("u32");
            } else if ( typeName === "vec2h" || typeName === "vec3h" || typeName === "vec4h") {
                format = exec.getTypeInfo("f16");
            } else {
                console.error(`GetDataValue: Unknown type ${typeName}`);
            }
        }

        if (postfix instanceof AST.ArrayIndex) {
            const idx = postfix.index;
            let i = -1;
            if (idx instanceof AST.LiteralExpr) {
                i = idx.value as number;
            } else {
                const d = exec.evalExpression(idx, context);
                if (d instanceof ScalarData) {
                    i = d.value;
                } else {
                    console.error(`GetDataValue: Unknown index type`, idx);
                    return null;
                }
            }
            if (i < 0 || i >= this.value.length) {
                console.error(`GetDataValue: Index out of range`, i);
                return null;
            }
            return new ScalarData(this.value[i], format);
        }

        if (postfix instanceof AST.StringExpr) {
            const member = postfix.value;
            const values = [];
            for (const m of member) {
                if (m === "x" || m === "r") {
                    values.push(this.value[0]);
                } else if (m === "y" || m === "g") {
                    values.push(this.value[1]);
                } else if (m === "z" || m === "b") {
                    values.push(this.value[2]);
                } else if (m === "w" || m === "a") {
                    values.push(this.value[3]);
                } else {
                    console.error(`GetDataValue: Unknown member ${m}`);
                }
            }

            if (values.length === 1) {
                return new ScalarData(values[0], format);
            }

            return _getVectorData(exec, values, format.name);
        }

        return this;
    }

    toString(): string {
        let s = `${this.value[0]}`;
        for (let i = 1; i < this.value.length; ++i) {
            s += `, ${this.value[i]}`;
        }
        return s;
    }
}

export class MatrixData extends Data {
    value: number[];

    constructor(value: number[], typeInfo: TypeInfo) {
        super(typeInfo);
        this.value = value;
    }

    setDataValue(exec: ExecInterface, value: Data, postfix: AST.Expression | null, context: ExecContext): void {
        if (postfix instanceof AST.StringExpr) {
            console.error("TODO: Set matrix postfix");
            return;
        }

        if (!(value instanceof MatrixData)) {
            console.error(`SetDataValue: Invalid value`, value);
            return
        }

        this.value = value.value;
    }

    getDataValue(exec: ExecInterface, postfix: AST.Expression | null, context: ExecContext): Data | null {
        const typeName = this.typeInfo.name;
        let format = exec.getTypeInfo("f32");
        if (this.typeInfo instanceof TemplateInfo) {
            format = this.typeInfo.format;
        } else {
            if (typeName.endsWith("f")) {
                format = exec.getTypeInfo("f32");
            } else if (typeName.endsWith("i")) {
                format = exec.getTypeInfo("i32");
            } else if (typeName.endsWith("u")) {
                format = exec.getTypeInfo("u32");
            } else if ( typeName.endsWith("h")) {
                format = exec.getTypeInfo("f16");
            } else {
                console.error(`GetDataValue: Unknown type ${typeName}`);
            }
        }

        if (postfix instanceof AST.ArrayIndex) {
            const idx = postfix.index;
            let i = -1;
            if (idx instanceof AST.LiteralExpr) {
                i = idx.value as number;
            } else {
                const d = exec.evalExpression(idx, context);
                if (d instanceof ScalarData) {
                    i = d.value;
                } else {
                    console.error(`GetDataValue: Unknown index type`, idx);
                    return null;
                }
            }
            if (i < 0 || i >= this.value.length) {
                console.error(`GetDataValue: Index out of range`, i);
                return null;
            }

            let values: number[];
            if (typeName === "mat2x2" || typeName === "mat2x2f" || typeName === "mat2x2h") {
                values = this.value.slice(i * 2, i * 2 + 2);
            } else if (typeName === "mat2x3" || typeName === "mat2x3f" || typeName === "mat2x3h") {
                values = this.value.slice(i * 3, i * 3 + 3);
            } else if (typeName === "mat2x4" || typeName === "mat2x4f" || typeName === "mat2x4h") {
                values = this.value.slice(i * 4, i * 4 + 4);
            } else if (typeName === "mat3x2" || typeName === "mat3x2f" || typeName === "mat3x2h") {
                values = this.value.slice(i * 2, i * 2 + 2);
            } else if (typeName === "mat3x3" || typeName === "mat3x3f" || typeName === "mat3x3h") {
                values = this.value.slice(i * 3, i * 3 + 3);
            } else if (typeName === "mat3x4" || typeName === "mat3x4f" || typeName === "mat3x4h") {
                values = this.value.slice(i * 4, i * 4 + 4);
            } else if (typeName === "mat4x2" || typeName === "mat4x2f" || typeName === "mat4x2h") {
                values = this.value.slice(i * 2, i * 2 + 2);
            } else if (typeName === "mat4x3" || typeName === "mat4x3f" || typeName === "mat4x3h") {
                values = this.value.slice(i * 3, i * 3 + 3);
            } else if (typeName === "mat4x4" || typeName === "mat4x4f" || typeName === "mat4x4h") {
                values = this.value.slice(i * 4, i * 4 + 4);
            } else {
                console.error(`GetDataValue: Unknown type ${typeName}`);
                return null;
            }

            const vecData = _getVectorData(exec, values, format.name);
            if (postfix.postfix) {
                return vecData.getDataValue(exec, postfix.postfix, context);
            }
        }

        return this;
    }

    toString(): string {
        let s = `${this.value[0]}`;
        for (let i = 1; i < this.value.length; ++i) {
            s += `, ${this.value[i]}`;
        }
        return s;
    }
}

// Used to store array and struct data
export class TypedData extends Data {
    buffer: ArrayBuffer;
    offset: number;
    textureSize: number[] = [0, 0, 0];

    constructor(data: ArrayBuffer | Float32Array | Uint32Array | Int32Array | Uint8Array | Int8Array,
        typeInfo: TypeInfo, offset: number = 0, textureSize?: number[]) {
        super(typeInfo);
        this.buffer = data instanceof ArrayBuffer ? data : data.buffer;
        this.offset = offset;
        if (textureSize !== undefined) {
            this.textureSize = textureSize;
        }
    }

    setDataValue(exec: ExecInterface, value: Data, postfix: AST.Expression | null, context: ExecContext): void {
        if (value === null) {
            console.log(`setDataValue: NULL data.`);
            return;
        }

        let offset = this.offset;
        let typeInfo = this.typeInfo;
        while (postfix) {
            if (postfix instanceof AST.ArrayIndex) {
                if (typeInfo instanceof ArrayInfo) {
                    const idx = postfix.index;
                    if (idx instanceof AST.LiteralExpr) {
                        offset += (idx.value as number) * typeInfo.stride;
                    } else {
                        const i = exec.evalExpression(idx, context);
                        if (i instanceof ScalarData) {
                            offset += i.value * typeInfo.stride;
                        } else {
                            console.error(`SetDataValue: Unknown index type`, idx);
                            return;
                        }
                    }
                    typeInfo = typeInfo.format;
                } else {
                    console.error(`SetDataValue: Type ${exec.getTypeName(typeInfo)} is not an array`);
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
                    const typeName = exec.getTypeName(typeInfo);
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
                    if (!(value instanceof ScalarData)) {
                        console.error(`SetDataValue: Invalid value`, value);
                        return;
                    }
                    const v = value.value;
                    if (typeName === "vec2f") {
                        new Float32Array(this.buffer, offset, 2)[element] = v;
                        return;
                    } else if (typeName === "vec3f") {
                        new Float32Array(this.buffer, offset, 3)[element] = v;
                        return;
                    } else if (typeName === "vec4f") {
                        new Float32Array(this.buffer, offset, 4)[element] = v;
                        return;
                    } else if (typeName === "vec2i") {
                        new Int32Array(this.buffer, offset, 2)[element] = v;
                        return;
                    } else if (typeName === "vec3i") {
                        new Int32Array(this.buffer, offset, 3)[element] = v;
                        return;
                    } else if (typeName === "vec4i") {
                        new Int32Array(this.buffer, offset, 4)[element] = v;
                        return;
                    } else if (typeName === "vec2u") {
                        new Uint32Array(this.buffer, offset, 2)[element] = v;
                        return;
                    } else if (typeName === "vec3u") {
                        new Uint32Array(this.buffer, offset, 3)[element] = v;
                        return;
                    } else if (typeName === "vec4u") {
                        new Uint32Array(this.buffer, offset, 4)[element] = v;
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

        this.setData(exec, value, typeInfo, offset, context);
    }

    setData(exec: ExecInterface, value: Data, typeInfo: TypeInfo, offset: number, context: ExecContext): void {
        const typeName = exec.getTypeName(typeInfo);

        if (typeName === "f32" || typeName === "f16") {
            if (value instanceof ScalarData) {
                new Float32Array(this.buffer, offset, 1)[0] = value.value;
            }
            return;
        } else if (typeName === "i32" || typeName === "atomic<i32>") {
            if (value instanceof ScalarData) {
                new Int32Array(this.buffer, offset, 1)[0] = value.value;
            }
            return;
        } else if (typeName === "u32" || typeName === "atomic<u32>") {
            if (value instanceof ScalarData) {
                new Uint32Array(this.buffer, offset, 1)[0] = value.value;
            }
            return;
        } else if (typeName === "bool") {
            if (value instanceof ScalarData) {
                new Int32Array(this.buffer, offset, 1)[0] = value.value;
            }
            return;
        } else if (typeName === "vec2f" || typeName === "vec2h") {
            const x = new Float32Array(this.buffer, offset, 2);
            if (value instanceof VectorData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
            } else {
                x[0] = value[0];
                x[1] = value[1];
            }
            return;
        } else if (typeName === "vec3f" || typeName === "vec3h") {
            const x = new Float32Array(this.buffer, offset, 3);
            if (value instanceof VectorData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
                x[2] = value.value[2];
            } else {
                x[0] = value[0];
                x[1] = value[1];
                x[2] = value[2];
            }
            return;
        } else if (typeName === "vec4f" || typeName === "vec4h") {
            const x = new Float32Array(this.buffer, offset, 4);
            if (value instanceof VectorData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
                x[2] = value.value[2];
                x[3] = value.value[3];
            } else {
                x[0] = value[0];
                x[1] = value[1];
                x[2] = value[2];
                x[3] = value[3];
            }
            return;
        } else if (typeName === "vec2i") {
            const x = new Int32Array(this.buffer, offset, 2);
            if (value instanceof VectorData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
            } else {
                x[0] = value[0];
                x[1] = value[1];
            }
            return;
        } else if (typeName === "vec3i") {
            const x = new Int32Array(this.buffer, offset, 3);
            if (value instanceof VectorData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
                x[2] = value.value[2];
            } else {
                x[0] = value[0];
                x[1] = value[1];
                x[2] = value[2];
            }
            return;
        } else if (typeName === "vec4i") {
            const x = new Int32Array(this.buffer, offset, 4);
            if (value instanceof VectorData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
                x[2] = value.value[2];
                x[3] = value.value[3];
            } else {
                x[0] = value[0];
                x[1] = value[1];
                x[2] = value[2];
                x[3] = value[3];
            }
            return;
        } else if (typeName === "vec2u") {
            const x = new Uint32Array(this.buffer, offset, 2);
            if (value instanceof VectorData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
            } else {
                x[0] = value[0];
                x[1] = value[1];
            }
            return;
        } else if (typeName === "vec3u") {
            const x = new Uint32Array(this.buffer, offset, 3);
            if (value instanceof VectorData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
                x[2] = value.value[2];
            } else {
                x[0] = value[0];
                x[1] = value[1];
                x[2] = value[2];
            }
            return;
        } else if (typeName === "vec4u") {
            const x = new Uint32Array(this.buffer, offset, 4);
            if (value instanceof VectorData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
                x[2] = value.value[2];
                x[3] = value.value[3];
            } else {
                x[0] = value[0];
                x[1] = value[1];
                x[2] = value[2];
                x[3] = value[3];
            }
            return;
        } else if (typeName === "vec2b") {
            const x = new Uint32Array(this.buffer, offset, 2);
            if (value instanceof VectorData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
            } else {
                x[0] = value[0];
                x[1] = value[1];
            }
            return;
        } else if (typeName === "vec3b") {
            const x = new Uint32Array(this.buffer, offset, 3);
            if (value instanceof VectorData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
                x[2] = value.value[2];
            } else {
                x[0] = value[0];
                x[1] = value[1];
                x[2] = value[2];
            }
            return;
        } else if (typeName === "vec4b") {
            const x = new Uint32Array(this.buffer, offset, 4);
            if (value instanceof VectorData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
                x[2] = value.value[2];
                x[3] = value.value[3];
            } else {
                x[0] = value[0];
                x[1] = value[1];
                x[2] = value[2];
                x[3] = value[3];
            }
            return;
        } else if (typeName === "mat2x2f" || typeName === "mat2x2h") {
            const x = new Float32Array(this.buffer, offset, 4);
            if (value instanceof MatrixData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
                x[2] = value.value[2];
                x[3] = value.value[3];
            } else {
                x[0] = value[0];
                x[1] = value[1];
                x[2] = value[2];
                x[3] = value[3];
            }
            return;
        } else if (typeName === "mat2x3f" || typeName === "mat2x3h") {
            const x = new Float32Array(this.buffer, offset, 6);
            if (value instanceof MatrixData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
                x[2] = value.value[2];
                x[3] = value.value[3];
                x[4] = value.value[4];
                x[5] = value.value[5];
            } else {
                x[0] = value[0];
                x[1] = value[1];
                x[2] = value[2];
                x[3] = value[3];
                x[4] = value[4];
                x[5] = value[5];
            }
            return;
        } else if (typeName === "mat2x4f" || typeName === "mat2x4h") {
            const x = new Float32Array(this.buffer, offset, 8);
            if (value instanceof MatrixData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
                x[2] = value.value[2];
                x[3] = value.value[3];
                x[4] = value.value[4];
                x[5] = value.value[5];
                x[6] = value.value[6];
                x[7] = value.value[7];
            } else {
                x[0] = value[0];
                x[1] = value[1];
                x[2] = value[2];
                x[3] = value[3];
                x[4] = value[4];
                x[5] = value[5];
                x[6] = value[6];
                x[7] = value[7];
            }
            return;
        } else if (typeName === "mat3x2f" || typeName === "mat3x2h") {
            const x = new Float32Array(this.buffer, offset, 6);
            if (value instanceof MatrixData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
                x[2] = value.value[2];
                x[3] = value.value[3];
                x[4] = value.value[4];
                x[5] = value.value[5];
            } else {
                x[0] = value[0];
                x[1] = value[1];
                x[2] = value[2];
                x[3] = value[3];
                x[4] = value[4];
                x[5] = value[5];
            }
            return;
        } else if (typeName === "mat3x3f" || typeName === "mat3x3h") {
            const x = new Float32Array(this.buffer, offset, 9);
            if (value instanceof MatrixData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
                x[2] = value.value[2];
                x[3] = value.value[3];
                x[4] = value.value[4];
                x[5] = value.value[5];
                x[6] = value.value[6];
                x[7] = value.value[7];
                x[8] = value.value[8];
            } else {
                x[0] = value[0];
                x[1] = value[1];
                x[2] = value[2];
                x[3] = value[3];
                x[4] = value[4];
                x[5] = value[5];
                x[6] = value[6];
                x[7] = value[7];
                x[8] = value[8];
            }
            return;
        } else if (typeName === "mat3x4f" || typeName === "mat3x4h") {
            const x = new Float32Array(this.buffer, offset, 12);
            if (value instanceof MatrixData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
                x[2] = value.value[2];
                x[3] = value.value[3];
                x[4] = value.value[4];
                x[5] = value.value[5];
                x[6] = value.value[6];
                x[7] = value.value[7];
                x[8] = value.value[8];
                x[9] = value.value[9];
                x[10] = value.value[10];
                x[11] = value.value[11];
            } else {
                x[0] = value[0];
                x[1] = value[1];
                x[2] = value[2];
                x[3] = value[3];
                x[4] = value[4];
                x[5] = value[5];
                x[6] = value[6];
                x[7] = value[7];
                x[8] = value[8];
                x[9] = value[9];
                x[10] = value[10];
                x[11] = value[11];
            }
            return;
        } else if (typeName === "mat4x2f" || typeName === "mat4x2h") {
            const x = new Float32Array(this.buffer, offset, 8);
            if (value instanceof MatrixData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
                x[2] = value.value[2];
                x[3] = value.value[3];
                x[4] = value.value[4];
                x[5] = value.value[5];
                x[6] = value.value[6];
                x[7] = value.value[7];
            } else {
                x[0] = value[0];
                x[1] = value[1];
                x[2] = value[2];
                x[3] = value[3];
                x[4] = value[4];
                x[5] = value[5];
                x[6] = value[6];
                x[7] = value[7];
            }
            return;
        } else if (typeName === "mat4x3f" || typeName === "mat4x3h") {
            const x = new Float32Array(this.buffer, offset, 12);
            if (value instanceof MatrixData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
                x[2] = value.value[2];
                x[3] = value.value[3];
                x[4] = value.value[4];
                x[5] = value.value[5];
                x[6] = value.value[6];
                x[7] = value.value[7];
                x[8] = value.value[8];
                x[9] = value.value[9];
                x[10] = value.value[10];
                x[11] = value.value[11];
            } else {
                x[0] = value[0];
                x[1] = value[1];
                x[2] = value[2];
                x[3] = value[3];
                x[4] = value[4];
                x[5] = value[5];
                x[6] = value[6];
                x[7] = value[7];
                x[8] = value[8];
                x[9] = value[9];
                x[10] = value[10];
                x[11] = value[11];
            }
            return;
        } else if (typeName === "mat4x4f" || typeName === "mat4x4h") {
            const x = new Float32Array(this.buffer, offset, 16);
            if (value instanceof MatrixData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
                x[2] = value.value[2];
                x[3] = value.value[3];
                x[4] = value.value[4];
                x[5] = value.value[5];
                x[6] = value.value[6];
                x[7] = value.value[7];
                x[8] = value.value[8];
                x[9] = value.value[9];
                x[10] = value.value[10];
                x[11] = value.value[11];
                x[12] = value.value[12];
                x[13] = value.value[13];
                x[14] = value.value[14];
                x[15] = value.value[15];
            } else {
                x[0] = value[0];
                x[1] = value[1];
                x[2] = value[2];
                x[3] = value[3];
                x[4] = value[4];
                x[5] = value[5];
                x[6] = value[6];
                x[7] = value[7];
                x[8] = value[8];
                x[9] = value[9];
                x[10] = value[10];
                x[11] = value[11];
                x[12] = value[12];
                x[13] = value[13];
                x[14] = value[14];
                x[15] = value[15];
            }
            return;
        }

        if (value instanceof TypedData) {
            if (typeInfo === value.typeInfo) {
                const x = new Uint8Array(this.buffer, offset, value.buffer.byteLength);
                x.set(new Uint8Array(value.buffer));
                return;
            } else {
                console.error(`SetDataValue: Type mismatch`, typeName, exec.getTypeName(value.typeInfo));
                return;
            }
        }

        console.error(`SetData: Unknown type ${typeName}`);
    }

    getDataValue(exec: ExecInterface, postfix: AST.Expression | null, context: ExecContext): Data | null {
        let offset = this.offset;
        let typeInfo = this.typeInfo;
        while (postfix) {
            if (postfix instanceof AST.ArrayIndex) {
                if (typeInfo instanceof ArrayInfo) {
                    const idx = postfix.index;
                    if (idx instanceof AST.LiteralExpr) {
                        offset += (idx.value as number) * typeInfo.stride;
                    } else {
                        const i = exec.evalExpression(idx, context);
                        if (i instanceof ScalarData) {
                            offset += i.value * typeInfo.stride;
                        } else {
                            console.error(`GetDataValue: Unknown index type`, idx);
                            return null;
                        }
                    }
                    typeInfo = typeInfo.format;
                } else {
                    console.error(`Type ${exec.getTypeName(typeInfo)} is not an array`);
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
                    const typeName = exec.getTypeName(typeInfo);
                    if (typeName === "vec2f" || typeName === "vec3f" || typeName === "vec4f" ||
                        typeName === "vec2i" || typeName === "vec3i" || typeName === "vec4i" ||
                        typeName === "vec2u" || typeName === "vec3u" || typeName === "vec4u" ||
                        typeName === "vec2b" || typeName === "vec3b" || typeName === "vec4b" ||
                        typeName === "vec2h" || typeName === "vec3h" || typeName === "vec4h" ||
                        typeName === "vec2" || typeName === "vec3" || typeName === "vec4") {

                        if (member.length > 0 && member.length < 5) {
                            let formatName = "f32";
                            const value = [];
                            for (let i = 0; i < member.length; ++i) {
                                const m = member[i].toLocaleLowerCase();
                                let element = 0;
                                if (m === "x" || m === "r") {
                                    element = 0;
                                } else if (m === "y" || m === "g") {
                                    element = 1;
                                } else if (m === "z" || m === "b") {
                                    element = 2;
                                } else if (m === "w" || m === "a") {
                                    element = 3;
                                } else {
                                    console.error(`Unknown member ${member}`);
                                    return null;
                                }
                                if (typeName === "vec2f") {
                                    value.push(new Float32Array(this.buffer, offset, 2)[element]);
                                } else if (typeName === "vec3f") {
                                    if ((offset + 12) >= this.buffer.byteLength) {
                                        console.log("Insufficient buffer data");
                                        return null;
                                    }
                                    const fa = new Float32Array(this.buffer, offset, 3);
                                    value.push(fa[element]);
                                } else if (typeName === "vec4f") {
                                    value.push(new Float32Array(this.buffer, offset, 4)[element]);
                                } else if (typeName === "vec2i") {
                                    formatName = "i32";
                                    value.push(new Int32Array(this.buffer, offset, 2)[element]);
                                } else if (typeName === "vec3i") {
                                    formatName = "i32";
                                    value.push(new Int32Array(this.buffer, offset, 3)[element]);
                                } else if (typeName === "vec4i") {
                                    formatName = "i32";
                                    value.push(new Int32Array(this.buffer, offset, 4)[element]);
                                } else if (typeName === "vec2u") {
                                    formatName = "u32";
                                    const ua = new Uint32Array(this.buffer, offset, 2);
                                    value.push(ua[element]);
                                } else if (typeName === "vec3u") {
                                    formatName = "u32";
                                    value.push(new Uint32Array(this.buffer, offset, 3)[element]);
                                } else if (typeName === "vec4u") {
                                    formatName = "u32";
                                    value.push(new Uint32Array(this.buffer, offset, 4)[element]);
                                }
                            }

                            if (value.length === 1) {
                                return new ScalarData(value[0], exec.getTypeInfo(formatName));
                            }

                            return new VectorData(value, typeInfo);
                        } else {
                            console.error(`GetDataValue: Unknown member ${member}`);
                            return null;
                        }
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

        const typeName = exec.getTypeName(typeInfo);

        if (typeName === "f32") {
            return new ScalarData(new Float32Array(this.buffer, offset, 1)[0], typeInfo);
        } else if (typeName === "i32") {
            return new ScalarData(new Int32Array(this.buffer, offset, 1)[0], typeInfo);
        } else if (typeName === "u32") {
            return new ScalarData(new Uint32Array(this.buffer, offset, 1)[0], typeInfo);
        } else if (typeName === "vec2f") {
            return new VectorData(new Float32Array(this.buffer, offset, 2), typeInfo);
        } else if (typeName === "vec3f") {
            return new VectorData(new Float32Array(this.buffer, offset, 3), typeInfo);
        } else if (typeName === "vec4f") {
            return new VectorData(new Float32Array(this.buffer, offset, 4), typeInfo);
        } else if (typeName === "vec2i") {
            return new VectorData(new Int32Array(this.buffer, offset, 2), typeInfo);
        } else if (typeName === "vec3i") {
            return new VectorData(new Int32Array(this.buffer, offset, 3), typeInfo);
        } else if (typeName === "vec4i") {
            return new VectorData(new Int32Array(this.buffer, offset, 4), typeInfo);
        } else if (typeName === "vec2u") {
            return new VectorData(new Uint32Array(this.buffer, offset, 2), typeInfo);
        } else if (typeName === "vec3u") {
            return new VectorData(new Uint32Array(this.buffer, offset, 3), typeInfo);
        } else if (typeName === "vec4u") {
            return new VectorData(new Uint32Array(this.buffer, offset, 4), typeInfo);
        }

        if (typeInfo instanceof TemplateInfo && typeInfo.name === "atomic") {
            if (typeInfo.format.name === "u32") {
                return new ScalarData(new Uint32Array(this.buffer, offset, 1)[0], typeInfo.format);
            } else if (typeInfo.format.name === "i32") {
                return new ScalarData(new Int32Array(this.buffer, offset, 1)[0], typeInfo.format);
            } else {
                console.error(`GetDataValue: Invalid atomic format ${typeInfo.format.name}`);
                return null;
            }
        }

        return new TypedData(this.buffer, typeInfo, offset);
    }

    toString(): string {
        let s = "";
        if (this.typeInfo instanceof ArrayInfo) {
            if (this.typeInfo.format.name === "f32") {
                const fa = new Float32Array(this.buffer, this.offset);
                s = `[${fa[0]}`;
                for (let i = 1; i < fa.length; ++i) {
                    s += `, ${fa[i]}`;
                }
            } else if (this.typeInfo.format.name === "i32") {
                const fa = new Int32Array(this.buffer, this.offset);
                s = `[${fa[0]}`;
                for (let i = 1; i < fa.length; ++i) {
                    s += `, ${fa[i]}`;
                }
            } else if (this.typeInfo.format.name === "u32") {
                const fa = new Uint32Array(this.buffer, this.offset);
                s = `[${fa[0]}`;
                for (let i = 1; i < fa.length; ++i) {
                    s += `, ${fa[i]}`;
                }
            } else if (this.typeInfo.format.name === "vec2f") {
                const fa = new Float32Array(this.buffer, this.offset);
                s = `[${fa[0]}, ${fa[1]}]`;
                for (let i = 1; i < fa.length / 2; ++i) {
                    s += `, [${fa[i * 2]}, ${fa[i * 2 + 1]}]`;
                }
            } else if (this.typeInfo.format.name === "vec3f") {
                const fa = new Float32Array(this.buffer, this.offset);
                s = `[${fa[0]}, ${fa[1]}, ${fa[2]}]`;
                for (let i = 4; i < fa.length; i += 4) {
                    s += `, [${fa[i]}, ${fa[i + 1]}, ${fa[i + 2]}]`;
                }
            } else if (this.typeInfo.format.name === "vec4f") {
                const fa = new Float32Array(this.buffer, this.offset);
                s = `[${fa[0]}, ${fa[1]}, ${fa[2]}, ${fa[3]}]`;
                for (let i = 4; i < fa.length; i += 4) {
                    s += `, [${fa[i]}, ${fa[i + 1]}, ${fa[i + 2]}, ${fa[i + 3]}]`;
                }
            } else {
                s = `[...]`;
            }
        } else if (this.typeInfo instanceof StructInfo) {
            s += `{...}`;
        } else {
            s = `[...]`;
        }
        return s;
    }
};
