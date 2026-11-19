import { TypedData } from "../wgsl_ast.js";
import { TypeInfo, ArrayInfo, TemplateInfo, SubgroupMatrixInfo } from "../reflect/info.js";
import { float16ToFloat32, float32ToFloat16 } from "../utils/float.js";

// Subgroup matrix support (chromium_experimental_subgroup_matrix) for
// WgslExec. A matrix is held whole by each invocation as row-major element
// values; see SubgroupMatrixData.

// Convert a value to a subgroup matrix element type, wrapping integers and
// rounding floats the way storing them in that type would.
export function toSubgroupMatrixElement(type: string, v: number): number {
    switch (type) {
        case "i32": return v | 0;
        case "u32": return v >>> 0;
        case "i8": return ((v | 0) << 24) >> 24;
        case "u8": return (v >>> 0) & 0xff;
        case "f16": return float16ToFloat32(float32ToFloat16(v));
        case "bf16": {
            // bf16 is the upper 16 bits of an f32; round to nearest even.
            const f = new Float32Array([v]);
            const u = new Uint32Array(f.buffer);
            u[0] = (u[0] + 0x7fff + ((u[0] >>> 16) & 1)) & 0xffff0000;
            return f[0];
        }
        default: return Math.fround(v);
    }
}

// Element access into the array a subgroup matrix is loaded from or stored to:
// an array of scalars or vectors, read as consecutive scalars. An i8 or u8
// matrix accesses an array of i32 or u32 as packed bytes, four per element.
class _MatrixMemory {
    view: DataView;
    base: number;
    stride: number; // Bytes between array elements.
    components: number; // Scalars per array element.
    scalar: string; // The array's scalar type.
    scalarSize: number;
    length: number; // Addressable matrix elements.
    packedBytes: boolean;

    constructor(data: TypedData, elementType: string) {
        const arrayInfo = data.typeInfo as ArrayInfo;
        const format: TypeInfo = arrayInfo.format;
        const isVector = format instanceof TemplateInfo && format.format !== null && format.name.startsWith("vec");
        this.scalar = isVector ? (format as TemplateInfo).format!.name : format.name;
        this.components = isVector ? parseInt(format.name.substring(3)) : 1;
        this.scalarSize = this.scalar === "f16" ? 2 : 4;
        this.stride = arrayInfo.stride || this.scalarSize * this.components;
        this.view = new DataView(data.buffer);
        this.base = data.offset;
        const arrayElements = arrayInfo.count > 0 ? arrayInfo.count
            : Math.floor((data.buffer.byteLength - data.offset) / this.stride);
        this.packedBytes = (elementType === "i8" || elementType === "u8") && this.scalarSize === 4;
        this.length = arrayElements * this.components * (this.packedBytes ? 4 : 1);
    }

    _byteOffset(scalarIndex: number): number {
        const element = Math.floor(scalarIndex / this.components);
        const component = scalarIndex % this.components;
        return this.base + element * this.stride + component * this.scalarSize;
    }

    read(index: number, elementType: string): number {
        if (index < 0 || index >= this.length) {
            return 0;
        }
        if (this.packedBytes) {
            const byte = this._byteOffset(Math.floor(index / 4)) + (index % 4);
            return elementType === "i8" ? this.view.getInt8(byte) : this.view.getUint8(byte);
        }
        const byte = this._byteOffset(index);
        switch (this.scalar) {
            case "i32": return this.view.getInt32(byte, true);
            case "u32": return this.view.getUint32(byte, true);
            case "f16": return float16ToFloat32(this.view.getUint16(byte, true));
            default: return this.view.getFloat32(byte, true);
        }
    }

    write(index: number, elementType: string, value: number): void {
        if (index < 0 || index >= this.length) {
            return;
        }
        if (this.packedBytes) {
            const byte = this._byteOffset(Math.floor(index / 4)) + (index % 4);
            if (elementType === "i8") {
                this.view.setInt8(byte, value);
            } else {
                this.view.setUint8(byte, value);
            }
            return;
        }
        const byte = this._byteOffset(index);
        switch (this.scalar) {
            case "i32": this.view.setInt32(byte, value, true); break;
            case "u32": this.view.setUint32(byte, value, true); break;
            case "f16": this.view.setUint16(byte, float32ToFloat16(value), true); break;
            default: this.view.setFloat32(byte, value, true); break;
        }
    }
}

// The array index of element (row, column) of a matrix in memory. Consecutive
// elements of a row (row-major) or column (column-major) are adjacent, and
// `stride` elements separate the starts of consecutive rows or columns.
function _elementIndex(offset: number, row: number, column: number, columnMajor: boolean, stride: number): number {
    return columnMajor ? offset + column * stride + row : offset + row * stride + column;
}

// Load a matrix of the given type from an array.
export function loadSubgroupMatrix(data: TypedData, info: SubgroupMatrixInfo, offset: number,
    columnMajor: boolean, stride: number): number[] {
    const type = info.format.name;
    const memory = new _MatrixMemory(data, type);
    const values = new Array<number>(info.rows * info.columns);
    for (let r = 0; r < info.rows; ++r) {
        for (let c = 0; c < info.columns; ++c) {
            const v = memory.read(_elementIndex(offset, r, c, columnMajor, stride), type);
            values[r * info.columns + c] = toSubgroupMatrixElement(type, v);
        }
    }
    return values;
}

// Store a matrix of the given type to an array.
export function storeSubgroupMatrix(data: TypedData, info: SubgroupMatrixInfo, values: number[],
    offset: number, columnMajor: boolean, stride: number): void {
    const type = info.format.name;
    const memory = new _MatrixMemory(data, type);
    for (let r = 0; r < info.rows; ++r) {
        for (let c = 0; c < info.columns; ++c) {
            memory.write(_elementIndex(offset, r, c, columnMajor, stride), type, values[r * info.columns + c]);
        }
    }
}

// left (K columns, M rows) x right (N columns, K rows) + accumulator, as a
// result matrix of N columns and M rows of the result's element type.
export function multiplySubgroupMatrices(left: number[], leftInfo: SubgroupMatrixInfo,
    right: number[], rightInfo: SubgroupMatrixInfo, resultInfo: SubgroupMatrixInfo,
    accumulator: number[] | null): number[] {
    const m = leftInfo.rows;
    const k = leftInfo.columns;
    const n = rightInfo.columns;
    const type = resultInfo.format.name;
    // Integer products and sums wrap at 32 bits.
    const isInteger = type === "i32" || type === "u32" || type === "i8" || type === "u8";
    const values = new Array<number>(m * n);
    for (let r = 0; r < m; ++r) {
        for (let c = 0; c < n; ++c) {
            let sum = accumulator ? accumulator[r * n + c] : 0;
            for (let i = 0; i < k; ++i) {
                const a = left[r * k + i];
                const b = right[i * n + c];
                sum = isInteger ? (sum + Math.imul(a, b)) | 0 : sum + a * b;
            }
            values[r * n + c] = toSubgroupMatrixElement(type, sum);
        }
    }
    return values;
}
