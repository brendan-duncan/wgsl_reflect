import { Data } from "./data.js";
import { TypeInfo } from "../reflect/info.js";
import { ExecContext } from "./exec_context.js";
import { ExecInterface } from "./exec_interface.js";
import { Expression } from "../wgsl_ast.js";
export declare class VoidData extends Data {
    constructor();
    static void: VoidData;
    toString(): string;
}
export declare class PointerData extends Data {
    reference: Data;
    constructor(reference: Data);
    clone(): Data;
    setDataValue(exec: ExecInterface, value: Data, postfix: Expression | null, context: ExecContext): void;
    getSubData(exec: ExecInterface, postfix: Expression | null, context: ExecContext): Data | null;
}
export declare class ScalarData extends Data {
    data: Int32Array | Uint32Array | Float32Array;
    constructor(value: number | Int32Array | Uint32Array | Float32Array, typeInfo: TypeInfo, parent?: Data | null);
    clone(): Data;
    get value(): number;
    set value(v: number);
    setDataValue(exec: ExecInterface, value: Data, postfix: Expression | null, context: ExecContext): void;
    getSubData(exec: ExecInterface, postfix: Expression | null, context: ExecContext): Data | null;
    toString(): string;
}
export declare class VectorData extends Data {
    data: Int32Array | Uint32Array | Float32Array;
    constructor(value: number[] | Float32Array | Uint32Array | Int32Array, typeInfo: TypeInfo, parent?: Data | null);
    clone(): Data;
    setDataValue(exec: ExecInterface, value: Data, postfix: Expression | null, context: ExecContext): void;
    getSubData(exec: ExecInterface, postfix: Expression | null, context: ExecContext): Data | null;
    toString(): string;
}
export declare class MatrixData extends Data {
    data: Float32Array;
    constructor(value: number[] | Float32Array, typeInfo: TypeInfo, parent?: Data | null);
    clone(): Data;
    setDataValue(exec: ExecInterface, value: Data, postfix: Expression | null, context: ExecContext): void;
    getSubData(exec: ExecInterface, postfix: Expression | null, context: ExecContext): Data | null;
    toString(): string;
}
export declare class TypedData extends Data {
    buffer: ArrayBuffer;
    offset: number;
    constructor(data: ArrayBuffer | Float32Array | Uint32Array | Int32Array | Uint8Array | Int8Array, typeInfo: TypeInfo, offset?: number, parent?: Data | null);
    clone(): Data;
    setDataValue(exec: ExecInterface, value: Data, postfix: Expression | null, context: ExecContext): void;
    setData(exec: ExecInterface, value: Data, typeInfo: TypeInfo, offset: number, context: ExecContext): void;
    getSubData(exec: ExecInterface, postfix: Expression | null, context: ExecContext): Data | null;
    toString(): string;
}
export declare class TextureData extends TypedData {
    descriptor: Object;
    view: Object | null;
    constructor(data: ArrayBuffer | Float32Array | Uint32Array | Int32Array | Uint8Array | Int8Array, typeInfo: TypeInfo, offset: number, descriptor: Object, view: Object | null);
    clone(): Data;
    get width(): number;
    get height(): number;
    get depthOrArrayLayers(): number;
    get format(): string;
    get sampleCount(): number;
    get mipLevelCount(): number;
    get dimension(): string;
    getMipLevelSize(level: number): number[];
    get texelByteSize(): number;
    get bytesPerRow(): number;
    get isDepthStencil(): boolean;
    getGpuSize(): number;
    getPixel(x: number, y: number, z?: number, mipLevel?: number): number[] | null;
    setPixel(x: number, y: number, z: number, mipLevel: number, value: number[]): void;
}
