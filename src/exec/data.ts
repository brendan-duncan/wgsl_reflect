import * as AST from "../wgsl_ast.js";
import { ExecContext } from "./exec_context.js";
import { ExecInterface } from "./exec_interface.js";
import { TypeInfo, ArrayInfo, StructInfo } from "../wgsl_reflect.js";

export class Data {
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

    setDataValue(exec: ExecInterface, value: any, postfix: AST.Expression | null, context: ExecContext) {
        if (value === null) {
            console.log("_setDataValue: NULL data");
            return;
        }

        let offset = this.offset;
        let typeInfo = this.typeInfo;
        while (postfix) {
            if (postfix instanceof AST.ArrayIndex) {
                if (typeInfo instanceof ArrayInfo) {
                    const idx = postfix.index;
                    if (idx instanceof AST.LiteralExpr) {
                        offset += idx.value * typeInfo.stride;
                    } else {
                        const i = exec._evalExpression(idx, context);
                        if (i !== null) {
                            offset += i * typeInfo.stride;
                        } else {
                            console.error(`SetDataValue: Unknown index type`, idx);
                            return;
                        }
                    }
                    typeInfo = typeInfo.format;
                } else {
                    console.error(`SetDataValue: Type ${exec._getTypeName(typeInfo)} is not an array`);
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
                    const typeName = exec._getTypeName(typeInfo);
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
                        new Float32Array(this.buffer, offset, 2)[element] = value;
                        return;
                    } else if (typeName === "vec3f") {
                        new Float32Array(this.buffer, offset, 3)[element] = value;
                        return;
                    } else if (typeName === "vec4f") {
                        new Float32Array(this.buffer, offset, 4)[element] = value;
                        return;
                    } else if (typeName === "vec2i") {
                        new Int32Array(this.buffer, offset, 2)[element] = value;
                        return;
                    } else if (typeName === "vec3i") {
                        new Int32Array(this.buffer, offset, 3)[element] = value;
                        return;
                    } else if (typeName === "vec4i") {
                        new Int32Array(this.buffer, offset, 4)[element] = value;
                        return;
                    } else if (typeName === "vec2u") {
                        new Uint32Array(this.buffer, offset, 2)[element] = value;
                        return;
                    } else if (typeName === "vec3u") {
                        new Uint32Array(this.buffer, offset, 3)[element] = value;
                        return;
                    } else if (typeName === "vec4u") {
                        new Uint32Array(this.buffer, offset, 4)[element] = value;
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

    setData(exec: ExecInterface, value: any, typeInfo: TypeInfo, offset: number, context: ExecContext) {
        const typeName = exec._getTypeName(typeInfo);

        if (typeName === "f32") {
            new Float32Array(this.buffer, offset, 1)[0] = value;
            return;
        } else if (typeName === "i32") {
            new Int32Array(this.buffer, offset, 1)[0] = value;
            return;
        } else if (typeName === "u32") {
            new Uint32Array(this.buffer, offset, 1)[0] = value;
            return;
        } else if (typeName === "vec2f") {
            const x = new Float32Array(this.buffer, offset, 2);
            x[0] = value[0];
            x[1] = value[1];
            return;
        } else if (typeName === "vec3f") {
            const x = new Float32Array(this.buffer, offset, 3);
            x[0] = value[0];
            x[1] = value[1];
            x[2] = value[2];
            return;
        } else if (typeName === "vec4f") {
            const x = new Float32Array(this.buffer, offset, 4);
            x[0] = value[0];
            x[1] = value[1];
            x[2] = value[2];
            x[3] = value[3];
            return;
        } else if (typeName === "vec2i") {
            const x = new Int32Array(this.buffer, offset, 2);
            x[0] = value[0];
            x[1] = value[1];
            return;
        } else if (typeName === "vec3i") {
            const x = new Int32Array(this.buffer, offset, 3);
            x[0] = value[0];
            x[1] = value[1];
            x[2] = value[2];
            return;
        } else if (typeName === "vec4i") {
            const x = new Int32Array(this.buffer, offset, 4);
            x[0] = value[0];
            x[1] = value[1];
            x[2] = value[2];
            x[3] = value[3];
            return;
        } else if (typeName === "vec2u") {
            const x = new Uint32Array(this.buffer, offset, 2);
            x[0] = value[0];
            x[1] = value[1];
            return;
        } else if (typeName === "vec3u") {
            const x = new Uint32Array(this.buffer, offset, 3);
            x[0] = value[0];
            x[1] = value[1];
            x[2] = value[2];
            return;
        } else if (typeName === "vec4u") {
            const x = new Uint32Array(this.buffer, offset, 4);
            x[0] = value[0];
            x[1] = value[1];
            x[2] = value[2];
            x[3] = value[3];
            return;
        }

        if (value instanceof Data) {
            if (typeInfo === value.typeInfo) {
                const x = new Uint8Array(this.buffer, offset, value.buffer.byteLength);
                x.set(new Uint8Array(value.buffer));
                return;
            } else {
                console.error(`SetDataValue: Type mismatch`, typeName, exec._getTypeName(value.typeInfo));
                return;
            }
        }

        console.error(`SetDataValue: Unknown type ${typeName}`);
    }

    getDataValue(exec: ExecInterface, postfix: AST.Expression | null, context: ExecContext): any {
        let offset = this.offset;
        let typeInfo = this.typeInfo;
        while (postfix) {
            if (postfix instanceof AST.ArrayIndex) {
                if (typeInfo instanceof ArrayInfo) {
                    const idx = postfix.index;
                    if (idx instanceof AST.LiteralExpr) {
                        offset += idx.value * typeInfo.stride;
                    } else {
                        const i = exec._evalExpression(idx, context);
                        if (i !== null) {
                            offset += i * typeInfo.stride;
                        } else {
                            console.error(`GetDataValue: Unknown index type`, idx);
                            return null;
                        }
                    }
                    typeInfo = typeInfo.format;
                } else {
                    console.error(`Type ${exec._getTypeName(typeInfo)} is not an array`);
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
                    const typeName = exec._getTypeName(typeInfo);
                    if (typeName === "vec2f" || typeName === "vec3f" || typeName === "vec4f" ||
                        typeName === "vec2i" || typeName === "vec3i" || typeName === "vec4i" ||
                        typeName === "vec2u" || typeName === "vec3u" || typeName === "vec4u" ||
                        typeName === "vec2b" || typeName === "vec3b" || typeName === "vec4b" ||
                        typeName === "vec2h" || typeName === "vec3h" || typeName === "vec4h" ||
                        typeName === "vec2" || typeName === "vec3" || typeName === "vec4") {

                        if (member.length > 0 && member.length < 5) {
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
                                    value.push(new Int32Array(this.buffer, offset, 2)[element]);
                                } else if (typeName === "vec3i") {
                                    value.push(new Int32Array(this.buffer, offset, 3)[element]);
                                } else if (typeName === "vec4i") {
                                    value.push(new Int32Array(this.buffer, offset, 4)[element]);
                                } else if (typeName === "vec2u") {
                                    const ua = new Uint32Array(this.buffer, offset, 2);
                                    value.push(ua[element]);
                                } else if (typeName === "vec3u") {
                                    value.push(new Uint32Array(this.buffer, offset, 3)[element]);
                                } else if (typeName === "vec4u") {
                                    value.push(new Uint32Array(this.buffer, offset, 4)[element]);
                                }
                            }

                            if (value.length === 1) {
                                return value[0];
                            }

                            return value;
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

        const typeName = exec._getTypeName(typeInfo);

        if (typeName === "f32") {
            return new Float32Array(this.buffer, offset, 1)[0];
        } else if (typeName === "i32") {
            return new Int32Array(this.buffer, offset, 1)[0];
        } else if (typeName === "u32") {
            return new Uint32Array(this.buffer, offset, 1)[0];
        } else if (typeName === "vec2f") {
            return new Float32Array(this.buffer, offset, 2);
        } else if (typeName === "vec3f") {
            return new Float32Array(this.buffer, offset, 3);
        } else if (typeName === "vec4f") {
            return new Float32Array(this.buffer, offset, 4);
        } else if (typeName === "vec2i") {
            return new Int32Array(this.buffer, offset, 2);
        } else if (typeName === "vec3i") {
            return new Int32Array(this.buffer, offset, 3);
        } else if (typeName === "vec4i") {
            return new Int32Array(this.buffer, offset, 4);
        } else if (typeName === "vec2u") {
            return new Uint32Array(this.buffer, offset, 2);
        } else if (typeName === "vec3u") {
            return new Uint32Array(this.buffer, offset, 3);
        } else if (typeName === "vec4u") {
            return new Uint32Array(this.buffer, offset, 4);
        }

        return new Data(this.buffer, typeInfo, offset);
    }
};
