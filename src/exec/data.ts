import { TypeInfo } from "../wgsl_reflect.js";

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
};
