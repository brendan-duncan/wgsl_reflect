import { TypeInfo } from "../wgsl_reflect.js";
export declare class Data {
    buffer: ArrayBuffer;
    typeInfo: TypeInfo;
    offset: number;
    textureSize: number[];
    constructor(data: ArrayBuffer | Float32Array | Uint32Array | Int32Array | Uint8Array | Int8Array, typeInfo: TypeInfo, offset?: number, textureSize?: number[]);
}
