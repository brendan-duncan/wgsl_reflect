import { CallExpr, Call, UnaryOperator, VariableExpr } from "../wgsl_ast.js";
import { Data, TypedData, TextureData, SamplerData, ScalarData, VectorData, MatrixData } from "../wgsl_ast.js";
import { ExecContext } from "./exec_context.js";
import { ExecInterface } from "./exec_interface.js";
import { ArrayInfo, TypeInfo } from "../reflect/info.js";

// Map a cube-map direction to the face it hits and the 2d coordinate within
// that face, using WebGPU's cube face order:
//   0 +X, 1 -X, 2 +Y, 3 -Y, 4 +Z, 5 -Z
// The major axis picks the face; the other two axes, divided by the major
// axis's magnitude, give the face-local coordinate in [0, 1]. Shared with the
// fragment quad scheduler, which needs the same mapping to derive a cube
// sample's implicit LOD from face-local derivatives.
export function cubeFaceUV(x: number, y: number, z: number): { face: number, u: number, v: number } {
    const ax = Math.abs(x);
    const ay = Math.abs(y);
    const az = Math.abs(z);
    let face: number;
    let sc: number;
    let tc: number;
    let ma: number;
    if (ax >= ay && ax >= az) {
        face = x > 0 ? 0 : 1;
        sc = x > 0 ? -z : z;
        tc = -y;
        ma = ax;
    } else if (ay >= az) {
        face = y > 0 ? 2 : 3;
        sc = x;
        tc = y > 0 ? z : -z;
        ma = ay;
    } else {
        face = z > 0 ? 4 : 5;
        sc = z > 0 ? x : -x;
        tc = -y;
        ma = az;
    }
    if (ma === 0) {
        return { face, u: 0.5, v: 0.5 };
    }
    return { face, u: 0.5 * (sc / ma + 1), v: 0.5 * (tc / ma + 1) };
}

export class BuiltinFunctions {
    exec: ExecInterface;

    constructor(exec: ExecInterface) {
        this.exec = exec;
    }

    getTypeInfo(type: string): TypeInfo | null {
        return this.exec.getTypeInfo(type);
    }

    // Logical Built-in Functions
    All(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        let isTrue = true;
        if (value instanceof VectorData) {
            value.data.forEach((x: any) => { if (!x) isTrue = false; });
            return new ScalarData(isTrue ? 1 : 0, this.getTypeInfo("bool"));
        }
        throw new Error(`All() expects a vector argument. Line ${node.line}`);
    }

    Any(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            const res = value.data.some((v: any) => v);
            return new ScalarData(res ? 1 : 0, this.getTypeInfo("bool"));
        }
        throw new Error(`Any() expects a vector argument. Line ${node.line}`);
    }

    Select(node: CallExpr | Call, context: ExecContext): Data | null {
        // select(false, true, condition)
        const condition = this.exec.evalExpression(node.args[2], context);
        if (condition instanceof VectorData) {
            // select(f: vecN, t: vecN, cond: vecN<bool>): component-wise.
            const f = this.exec.evalExpression(node.args[0], context);
            const t = this.exec.evalExpression(node.args[1], context);
            if (!(f instanceof VectorData) || !(t instanceof VectorData)) {
                throw new Error(`Select() with a vector condition expects vector values. Line ${node.line}`);
            }
            return new VectorData(condition.data.map((c: number, i: number) => c ? t.data[i] : f.data[i]), f.typeInfo);
        }
        if (!(condition instanceof ScalarData)) {
            throw new Error(`Select() expects a bool condition. Line ${node.line}`);
        }
        if (!condition.value) {
            return this.exec.evalExpression(node.args[0], context);
        } else {
            return this.exec.evalExpression(node.args[1], context);
        }
    }

    // Array Built-in Functions
    ArrayLength(node: CallExpr | Call, context: ExecContext): Data | null {
        let arrayArg = node.args[0];
        // TODO: handle "&" operator
        if (arrayArg instanceof UnaryOperator) {
            arrayArg = (arrayArg as UnaryOperator).right;
        }
        const arrayData = this.exec.evalExpression(arrayArg, context);
        if (arrayData instanceof TypedData && arrayData.typeInfo.size === 0) {
            const ta = arrayData.typeInfo as ArrayInfo;
            const count = arrayData.buffer.byteLength / ta.stride;
            return new ScalarData(count, this.getTypeInfo("u32"));
        }
        return new ScalarData(arrayData.typeInfo.size, this.getTypeInfo("u32"));
    }

    // Numeric Built-in Functions
    Abs(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.abs(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.abs(s.value), s.typeInfo);
    }

    Acos(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.acos(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.acos(s.value), value.typeInfo);
    }

    Acosh(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.acosh(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.acosh(s.value), value.typeInfo);
    }

    Asin(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.asin(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.asin(s.value), value.typeInfo);
    }

    Asinh(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.asinh(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.asinh(s.value), value.typeInfo);
    }

    Atan(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.atan(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.atan(s.value), value.typeInfo);
    }

    Atanh(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.atanh(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.atanh(s.value), value.typeInfo);
    }

    Atan2(node: CallExpr | Call, context: ExecContext): Data | null {
        const y = this.exec.evalExpression(node.args[0], context);
        const x = this.exec.evalExpression(node.args[1], context);
        if (y instanceof VectorData && x instanceof VectorData) {
            return new VectorData(y.data.map((v: number, i: number) => Math.atan2(v, x.data[i])), y.typeInfo);
        }
        const ys = y as ScalarData;
        const xs = x as ScalarData;
        return new ScalarData(Math.atan2(ys.value, xs.value), y.typeInfo);
    }

    Ceil(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.ceil(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.ceil(s.value), value.typeInfo);
    }

    _clamp(value: number, min: number, max: number): number {
        return Math.min(Math.max(value, min), max);
    }

    Clamp(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        const min = this.exec.evalExpression(node.args[1], context);
        const max = this.exec.evalExpression(node.args[2], context);
        if (value instanceof VectorData && min instanceof VectorData && max instanceof VectorData) {
            return new VectorData(value.data.map((v: number, i: number) => this._clamp(v, min.data[i], max.data[i])), value.typeInfo);
        }
        const s = value as ScalarData;
        const minS = min as ScalarData;
        const maxS = max as ScalarData
        return new ScalarData(this._clamp(s.value, minS.value, maxS.value), value.typeInfo);
    }

    Cos(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.cos(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.cos(s.value), value.typeInfo);
    }

    Cosh(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.cosh(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.cos(s.value), value.typeInfo);
    }

    CountLeadingZeros(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.clz32(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.clz32(s.value), value.typeInfo);
    }

    _countOneBits(value: number): number {
        let count = 0;
        while (value !== 0) {
            if (value & 1) {
                count++;
            }
            value >>= 1;
        }
        return count;
    }

    CountOneBits(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => this._countOneBits(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(this._countOneBits(s.value), value.typeInfo);
    }

    _countTrailingZeros(value: number): number {
        if (value === 0) {
            return 32; // Special case for 0
        }
        let count = 0;
        while ((value & 1) === 0) {
            value >>= 1;
            count++;
        }
        return count;
    }

    CountTrailingZeros(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => this._countTrailingZeros(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(this._countTrailingZeros(s.value), value.typeInfo);
    }

    Cross(node: CallExpr | Call, context: ExecContext): Data | null {
        const l = this.exec.evalExpression(node.args[0], context);
        const r = this.exec.evalExpression(node.args[1], context);
        if (l instanceof VectorData && r instanceof VectorData) {
            if (l.data.length !== 3 || r.data.length !== 3) {
                console.error(`Cross() expects 3D vectors. Line ${node.line}`);
                return null;
            }
            const lv = l.data;
            const rv = r.data;
            return new VectorData([
                lv[1] * rv[2] - rv[1] * lv[2],
                lv[2] * rv[0] - rv[2] * lv[0],
                lv[0] * rv[1] - rv[0] * lv[1],
            ], l.typeInfo);
        }
        console.error(`Cross() expects vector arguments. Line ${node.line}`);
        return null;
    }

    Degrees(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        const radToDeg = 180.0 / Math.PI;
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => v * radToDeg), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(s.value * radToDeg, this.getTypeInfo("f32"));
    }

    Determinant(node: CallExpr | Call, context: ExecContext): Data | null {
        // WGSL only defines determinant() for square matrices (matNxN).
        const m = this.exec.evalExpression(node.args[0], context);
        if (m instanceof MatrixData) {
            const mv = m.data;
            const mt = m.typeInfo.getTypeName();
            const isHalf = mt.endsWith("h");
            const formatType = isHalf ? this.getTypeInfo("f16") : this.getTypeInfo("f32");
            if (mt === "mat2x2" || mt === "mat2x2f" || mt === "mat2x2h") {
                return new ScalarData(mv[0] * mv[3] - mv[1] * mv[2], formatType);
            } else if (mt === "mat3x3" || mt === "mat3x3f" || mt === "mat3x3h") {
                return new ScalarData(mv[0] * (mv[4] * mv[8] - mv[5] * mv[7]) -
                        mv[1] * (mv[3] * mv[8] - mv[5] * mv[6]) + mv[2] * (mv[3] * mv[7] - mv[4] * mv[6]), formatType);
            } else if (mt === "mat4x4" || mt === "mat4x4f" || mt === "mat4x4h") {
                // Column-major: m[c, r] = mv[c*4 + r].
                const m00 = mv[0], m01 = mv[1], m02 = mv[2], m03 = mv[3];
                const m10 = mv[4], m11 = mv[5], m12 = mv[6], m13 = mv[7];
                const m20 = mv[8], m21 = mv[9], m22 = mv[10], m23 = mv[11];
                const m30 = mv[12], m31 = mv[13], m32 = mv[14], m33 = mv[15];
                const s0 = m00 * m11 - m10 * m01;
                const s1 = m00 * m12 - m10 * m02;
                const s2 = m00 * m13 - m10 * m03;
                const s3 = m01 * m12 - m11 * m02;
                const s4 = m01 * m13 - m11 * m03;
                const s5 = m02 * m13 - m12 * m03;
                const c5 = m22 * m33 - m32 * m23;
                const c4 = m21 * m33 - m31 * m23;
                const c3 = m21 * m32 - m31 * m22;
                const c2 = m20 * m33 - m30 * m23;
                const c1 = m20 * m32 - m30 * m22;
                const c0 = m20 * m31 - m30 * m21;
                return new ScalarData(s0 * c5 - s1 * c4 + s2 * c3 + s3 * c2 - s4 * c1 + s5 * c0, formatType);
            }
            console.error(`Determinant: unsupported matrix type ${mt}. Line ${node.line}`);
            return null;
        }
        console.error(`Determinant expects a matrix argument. Line ${node.line}`);
        return null;
    }

    Distance(node: CallExpr | Call, context: ExecContext): Data | null {
        const l = this.exec.evalExpression(node.args[0], context);
        const r = this.exec.evalExpression(node.args[1], context);
        if (l instanceof VectorData && r instanceof VectorData) {
            let sum = 0;
            for (let i = 0; i < l.data.length; ++i) {
                sum += (l.data[i] - r.data[i]) * (l.data[i] - r.data[i]);
            }
            return new ScalarData(Math.sqrt(sum), this.getTypeInfo("f32"));
        }
        const ls = l as ScalarData;
        const rs = r as ScalarData;
        return new ScalarData(Math.abs(ls.value - rs.value), l.typeInfo);
    }

    _dot(e1: Int32Array | Uint32Array | Float32Array, e2: Int32Array | Uint32Array | Float32Array) {
        let dot = 0;
        for (let i = 0; i < e1.length; ++i) {
            dot += e2[i] * e1[i];
        }
        return dot;
    }

    Dot(node: CallExpr | Call, context: ExecContext): Data | null {
        const l = this.exec.evalExpression(node.args[0], context);
        const r = this.exec.evalExpression(node.args[1], context);
        if (l instanceof VectorData && r instanceof VectorData) {
            return new ScalarData(this._dot(l.data, r.data), this.getTypeInfo("f32"));
        }
        console.error(`Dot() expects vector arguments. Line ${node.line}`);
        return null;
    }

    Dot4U8Packed(node: CallExpr | Call, context: ExecContext): Data | null {
        const a = this.exec.evalExpression(node.args[0], context) as ScalarData;
        const b = this.exec.evalExpression(node.args[1], context) as ScalarData;
        const ua = a.value >>> 0;
        const ub = b.value >>> 0;
        let sum = 0;
        for (let i = 0; i < 4; ++i) {
            sum += ((ua >>> (i * 8)) & 0xff) * ((ub >>> (i * 8)) & 0xff);
        }
        return new ScalarData(sum >>> 0, this.getTypeInfo("u32"));
    }

    Dot4I8Packed(node: CallExpr | Call, context: ExecContext): Data | null {
        const a = this.exec.evalExpression(node.args[0], context) as ScalarData;
        const b = this.exec.evalExpression(node.args[1], context) as ScalarData;
        const ua = a.value >>> 0;
        const ub = b.value >>> 0;
        const sext = (x: number) => (x & 0x80) ? x - 256 : x;
        let sum = 0;
        for (let i = 0; i < 4; ++i) {
            sum += sext((ua >>> (i * 8)) & 0xff) * sext((ub >>> (i * 8)) & 0xff);
        }
        return new ScalarData(sum | 0, this.getTypeInfo("i32"));
    }

    Exp(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.exp(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.exp(s.value), value.typeInfo);
    }

    Exp2(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.pow(2, v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.pow(2, s.value), value.typeInfo);
    }

    ExtractBits(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        const offset = this.exec.evalExpression(node.args[1], context);
        const count = this.exec.evalExpression(node.args[2], context);
        if (offset.typeInfo.name !== "u32" && offset.typeInfo.name !== "x32") {
            console.error(`ExtractBits() expects an i32 offset argument. Line ${node.line}`);
            return null;
        }
        if (count.typeInfo.name !== "u32" && count.typeInfo.name !== "x32") {
            console.error(`ExtractBits() expects an i32 count argument. Line ${node.line}`);
            return null;
        }

        const o = (offset as ScalarData).value;
        const c = (count as ScalarData).value;

        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => (v >> o) & ((1 << c) - 1)), value.typeInfo);
        }

        if (value.typeInfo.name !== "i32" && value.typeInfo.name !== "x32") {
            console.error(`ExtractBits() expects an i32 argument. Line ${node.line}`);
            return null;
        }
        const v = (value as ScalarData).value;
        return new ScalarData((v >> o) & ((1 << c) - 1), this.getTypeInfo("i32"));
    }

    FaceForward(node: CallExpr | Call, context: ExecContext): Data | null {
        const e1 = this.exec.evalExpression(node.args[0], context);
        const e2 = this.exec.evalExpression(node.args[1], context);
        const n = this.exec.evalExpression(node.args[2], context);
        if (e1 instanceof VectorData && e2 instanceof VectorData && n instanceof VectorData) {
            const dot = this._dot(e2.data, n.data);
            if (dot < 0) {
                return new VectorData(Array.from(e1.data), e1.typeInfo);
            }
            return new VectorData(e1.data.map((v: number) => -v), e1.typeInfo);
        }
        console.error(`FaceForward() expects vector arguments. Line ${node.line}`);
        return null;
    }

    _firstLeadingBit(s: number): number {
        if (s === 0) {
            return -1;
        }
        return 31 - Math.clz32(s);  // clz32: count leading zeros
    }

    FirstLeadingBit(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => this._firstLeadingBit(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(this._firstLeadingBit(s.value), value.typeInfo);
    }

    _firstTrailingBit(s: number): number {
        if (s === 0) {
            return -1;
        }
        return Math.log2(s & -s); // n & -n isolates the lowest set bit.  Math.log2 gives its position.
    }

    FirstTrailingBit(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => this._firstTrailingBit(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(this._firstTrailingBit(s.value), value.typeInfo);
    }

    Floor(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.floor(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.floor(s.value), value.typeInfo);
    }

    Fma(node: CallExpr | Call, context: ExecContext): Data | null {
        const a = this.exec.evalExpression(node.args[0], context);
        const b = this.exec.evalExpression(node.args[1], context);
        const c = this.exec.evalExpression(node.args[2], context);
        if (a instanceof VectorData && b instanceof VectorData && c instanceof VectorData) {
            if (a.data.length !== b.data.length || a.data.length !== c.data.length) {
                console.error(`Fma() expects vectors of the same length. Line ${node.line}`);
                return null;
            }
            return new VectorData(a.data.map((v: number, i: number) => v * b.data[i] + c.data[i]), a.typeInfo);
        }
        const av = a as ScalarData;
        const bv = b as ScalarData;
        const cv = c as ScalarData;
        return new ScalarData(av.value * bv.value + cv.value, av.typeInfo);
    }

    Fract(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => v - Math.floor(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(s.value - Math.floor(s.value), value.typeInfo);
    }

    Frexp(node: CallExpr | Call, context: ExecContext): Data | null {
        // WGSL frexp returns __frexp_result_{f32,f16,vecN<...>}. Struct returns from builtins
        // aren't wired through the type system here (see Modf), so we return only the fract
        // component as a Data of matching shape; the .exp field isn't surfaceable in shaders
        // until the parser learns the result struct names.
        const value = this.exec.evalExpression(node.args[0], context);
        const fract = (x: number) => {
            if (x === 0 || !isFinite(x) || isNaN(x)) return x;
            const e = Math.floor(Math.log2(Math.abs(x))) + 1;
            return x / Math.pow(2, e);
        };
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => fract(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(fract(s.value), value.typeInfo);
    }

    InsertBits(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        const insert = this.exec.evalExpression(node.args[1], context);
        const offset = this.exec.evalExpression(node.args[2], context);
        const count = this.exec.evalExpression(node.args[3], context);

        if (offset.typeInfo.name !== "u32" && offset.typeInfo.name !== "x32") {
            console.error(`InsertBits() expects an i32 offset argument. Line ${node.line}`);
            return null;
        }

        const o = (offset as ScalarData).value;
        const c = (count as ScalarData).value;
        const mask = ((1 << c) - 1) << o;
        const invMask = ~mask;

        if (value instanceof VectorData && insert instanceof VectorData) {
            return new VectorData(value.data.map((v: number, i: number) => {
                return (v & invMask) | ((insert.data[i] << o) & mask);
            }), value.typeInfo);
        }
        const v = (value as ScalarData).value;
        const i = (insert as ScalarData).value;
        return new ScalarData((v & invMask) | ((i << o) & mask), value.typeInfo);
    }

    InverseSqrt(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => 1 / Math.sqrt(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(1 / Math.sqrt(s.value), value.typeInfo);
    }

    Ldexp(node: CallExpr | Call, context: ExecContext): Data | null {
        const e1 = this.exec.evalExpression(node.args[0], context);
        const e2 = this.exec.evalExpression(node.args[1], context);
        if (e1 instanceof VectorData && e2 instanceof VectorData) {
            return new VectorData(e1.data.map((v: number, i: number) => v * Math.pow(2, e2.data[i])), e1.typeInfo);
        }
        const a = e1 as ScalarData;
        const b = e2 as ScalarData;
        return new ScalarData(a.value * Math.pow(2, b.value), e1.typeInfo);
    }

    Length(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            let sum = 0;
            value.data.forEach((v: number) => { sum += v * v; });
            return new ScalarData(Math.sqrt(sum), this.getTypeInfo("f32"));
        }
        const s = value as ScalarData;
        return new ScalarData(Math.abs(s.value), value.typeInfo);
    }

    Log(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.log(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.log(s.value), value.typeInfo);
    }

    Log2(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.log2(v)), value.typeInfo);
        }
        const s = value as ScalarData
        return new ScalarData(Math.log2(s.value), value.typeInfo);
    }

    Max(node: CallExpr | Call, context: ExecContext): Data | null {
        const l = this.exec.evalExpression(node.args[0], context);
        const r = this.exec.evalExpression(node.args[1], context);
        if (l instanceof VectorData && r instanceof VectorData) {
            return new VectorData(l.data.map((v: number, i: number) => Math.max(v, r.data[i])), l.typeInfo);
        }
        const ls = l as ScalarData;
        const rs = r as ScalarData;
        return new ScalarData(Math.max(ls.value, rs.value), l.typeInfo);
    }

    Min(node: CallExpr | Call, context: ExecContext): Data | null {
        const l = this.exec.evalExpression(node.args[0], context);
        const r = this.exec.evalExpression(node.args[1], context);
        if (l instanceof VectorData && r instanceof VectorData) {
            return new VectorData(l.data.map((v: number, i: number) => Math.min(v, r.data[i])), l.typeInfo);
        }
        const ls = l as ScalarData;
        const rs = r as ScalarData;
        return new ScalarData(Math.min(ls.value, rs.value), l.typeInfo);
    }

    Mix(node: CallExpr | Call, context: ExecContext): Data | null {
        const x = this.exec.evalExpression(node.args[0], context);
        const y = this.exec.evalExpression(node.args[1], context);
        const a = this.exec.evalExpression(node.args[2], context);
        if (x === null || y === null || a === null) {
            console.error(`Mix: invalid arguments. Line ${node.line}`);
            return null;
        }
        if (x instanceof VectorData && y instanceof VectorData) {
            if (a instanceof VectorData) {
                return new VectorData(x.data.map((v: number, i: number) => x.data[i] * (1 - a.data[i]) + y.data[i] * a.data[i]), x.typeInfo);
            }
            // mix(vecN, vecN, scalar): the blend factor broadcasts.
            const t = (a as ScalarData).value;
            return new VectorData(x.data.map((v: number, i: number) => x.data[i] * (1 - t) + y.data[i] * t), x.typeInfo);
        }
        const xs = x as ScalarData;
        const ys = y as ScalarData;
        const as = a as ScalarData;
        return new ScalarData(xs.value * (1 - as.value) + ys.value * as.value, x.typeInfo);
    }

    Modf(node: CallExpr | Call, context: ExecContext): Data | null {
        const x = this.exec.evalExpression(node.args[0], context);
        const y = this.exec.evalExpression(node.args[1], context);
        if (x instanceof VectorData && y instanceof VectorData) {
            return new VectorData(x.data.map((v: number, i: number) => v % y.data[i]), x.typeInfo);
        }
        const xs = x as ScalarData;
        const ys = y as ScalarData;
        return new ScalarData(xs.value % ys.value, x.typeInfo);
    }

    Normalize(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            const length = (this.Length(node, context) as ScalarData).value;
            return new VectorData(value.data.map((v: number) => v / length), value.typeInfo);
        }
        console.error(`Normalize() expects a vector argument. Line ${node.line}`);
        return null;
    }

    Pow(node: CallExpr | Call, context: ExecContext): Data | null {
        const x = this.exec.evalExpression(node.args[0], context);
        const y = this.exec.evalExpression(node.args[1], context);
        if (x instanceof VectorData && y instanceof VectorData) {
            return new VectorData(x.data.map((v: number, i: number) => Math.pow(v, y.data[i])), x.typeInfo);
        }
        const xs = x as ScalarData;
        const ys = y as ScalarData;
        return new ScalarData(Math.pow(xs.value, ys.value), x.typeInfo);
    }

    QuantizeToF16(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        const q = (v: number) => BuiltinFunctions._f16BitsToF32(BuiltinFunctions._f32ToF16Bits(v));
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => q(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(q(s.value), value.typeInfo);
    }

    Radians(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => v * Math.PI / 180), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(s.value * Math.PI / 180, this.getTypeInfo("f32"));
    }

    Reflect(node: CallExpr | Call, context: ExecContext): Data | null {
        // e1 - 2 * dot(e2, e1) * e2
        const e1 = this.exec.evalExpression(node.args[0], context);
        const e2 = this.exec.evalExpression(node.args[1], context);
        if (e1 instanceof VectorData && e2 instanceof VectorData) {
            const dot = this._dot(e1.data, e2.data);
            return new VectorData(e1.data.map((v: number, i: number) => v - 2 * dot * e2.data[i]), e1.typeInfo);
        }
        console.error(`Reflect() expects vector arguments. Line ${node.line}`);
        return null;
    }

    Refract(node: CallExpr | Call, context: ExecContext): Data | null {
        const e1 = this.exec.evalExpression(node.args[0], context);
        const e2 = this.exec.evalExpression(node.args[1], context);
        const e3 = this.exec.evalExpression(node.args[2], context);
        if (e1 instanceof VectorData && e2 instanceof VectorData && e3 instanceof ScalarData) {
            const dot = this._dot(e2.data, e1.data);
            return new VectorData(e1.data.map((v: number, i: number) => {
                const k = 1.0 - e3.value * e3.value * (1.0 - dot * dot);
                if (k < 0) {
                    return 0;
                }
                const sqrtK = Math.sqrt(k);
                return e3.value * v - (e3.value * dot + sqrtK) * e2.data[i];
            }), e1.typeInfo);
        }

        console.error(`Refract() expects vector arguments and a scalar argument. Line ${node.line}`);
        return null;
    }

    ReverseBits(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        const reverse = (n: number) => {
            let x = n >>> 0;
            x = ((x & 0x55555555) << 1) | ((x >>> 1) & 0x55555555);
            x = ((x & 0x33333333) << 2) | ((x >>> 2) & 0x33333333);
            x = ((x & 0x0f0f0f0f) << 4) | ((x >>> 4) & 0x0f0f0f0f);
            x = ((x & 0x00ff00ff) << 8) | ((x >>> 8) & 0x00ff00ff);
            return ((x << 16) | (x >>> 16)) >>> 0;
        };
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => reverse(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(reverse(s.value), value.typeInfo);
    }

    Round(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.round(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.round(s.value), value.typeInfo);
    }

    Saturate(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.min(Math.max(v, 0), 1)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.min(Math.max(s.value, 0), 1), value.typeInfo);
    }

    Sign(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.sign(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.sign(s.value), value.typeInfo);
    }

    Sin(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.sin(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.sin(s.value), value.typeInfo);
    }

    Sinh(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.sinh(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.sinh(s.value), value.typeInfo);
    }

    _smoothstep(edge0: number, edge1: number, x: number): number {
        const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
        return t * t * (3 - 2 * t);
    }

    SmoothStep(node: CallExpr | Call, context: ExecContext): Data | null {
        const edge0 = this.exec.evalExpression(node.args[0], context);
        const edge1 = this.exec.evalExpression(node.args[1], context);
        const x = this.exec.evalExpression(node.args[2], context);
        if (x instanceof VectorData && edge0 instanceof VectorData && edge1 instanceof VectorData) {
            return new VectorData(x.data.map((v: number, i: number) => this._smoothstep(edge0.data[i], edge1.data[i], v)), x.typeInfo);
        }
        const e0 = edge0 as ScalarData;
        const e1 = edge1 as ScalarData;
        const xS = x as ScalarData;
        return new ScalarData(this._smoothstep(e0.value, e1.value, xS.value), x.typeInfo);
    }

    Sqrt(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.sqrt(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.sqrt(s.value), value.typeInfo);
    }

    Step(node: CallExpr | Call, context: ExecContext): Data | null {
        const edge = this.exec.evalExpression(node.args[0], context);
        const x = this.exec.evalExpression(node.args[1], context);
        if (x instanceof VectorData && edge instanceof VectorData) {
            return new VectorData(x.data.map((v: number, i: number) => v < edge.data[i] ? 0 : 1), x.typeInfo);
        }
        const e = edge as ScalarData;
        const s = x as ScalarData;
        return new ScalarData(s.value < e.value ? 0 : 1, e.typeInfo);
    }

    Tan(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.tan(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.tan(s.value), value.typeInfo);
    }

    Tanh(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.tanh(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.tanh(s.value), value.typeInfo);
    }

    _getTransposeType(t: TypeInfo): TypeInfo {
        const tname = t.getTypeName();
        if (tname === "mat2x2f" || tname === "mat2x2h") {
            return t;
        } else if (tname === "mat2x3f") {
            return this.getTypeInfo("mat3x2f");
        } else if (tname === "mat2x3h") {
            return this.getTypeInfo("mat3x2h");
        } else if (tname === "mat2x4f") {
            return this.getTypeInfo("mat4x2f");
        } else if (tname === "mat2x4h") {
            return this.getTypeInfo("mat4x2h");
        } else if (tname === "mat3x2f") {
            return this.getTypeInfo("mat2x3f");
        } else if (tname === "mat3x2h") {
            return this.getTypeInfo("mat2x3h");
        } else if (tname === "mat3x3f" || tname === "mat3x3h") {
            return t;
        } else if (tname === "mat3x4f") {
            return this.getTypeInfo("mat4x3f");
        } else if (tname === "mat3x4h") {
            return this.getTypeInfo("mat4x3h");
        } else if (tname === "mat4x2f") {
            return this.getTypeInfo("mat2x4f");
        } else if (tname === "mat4x2h") {
            return this.getTypeInfo("mat2x4h");
        } else if (tname === "mat4x3f") {
            return this.getTypeInfo("mat3x4f");
        } else if (tname === "mat4x3h") {
            return this.getTypeInfo("mat3x4h");
        } else if (tname === "mat4x4f" || tname === "mat4x4h") {
            return t;
        }

        console.error(`Invalid matrix type ${tname}`);
        return t;
    }

    Transpose(node: CallExpr | Call, context: ExecContext): Data | null {
        const m = this.exec.evalExpression(node.args[0], context);
        if (!(m instanceof MatrixData)) {
            console.error(`Transpose() expects a matrix argument. Line ${node.line}`);
            return null;
        }

        const ttype = this._getTransposeType(m.typeInfo);

        if (m.typeInfo.name === "mat2x2" || m.typeInfo.name === "mat2x2f" || m.typeInfo.name === "mat2x2h") {
            const mv = m.data;
            return new MatrixData([mv[0], mv[2], mv[1], mv[3]], ttype);
        } else if (m.typeInfo.name === "mat2x3" || m.typeInfo.name === "mat2x3f" || m.typeInfo.name === "mat2x3h") {
            const mv = m.data;
            return new MatrixData([mv[0], mv[3], mv[6], mv[1], mv[4], mv[7]], ttype);
        } else if (m.typeInfo.name === "mat2x4" || m.typeInfo.name === "mat2x4f" || m.typeInfo.name === "mat2x4h") {
            const mv = m.data;
            return new MatrixData([mv[0], mv[4], mv[8], mv[12], mv[1], mv[5], mv[9], mv[13]], ttype);
        } else if (m.typeInfo.name === "mat3x2" || m.typeInfo.name === "mat3x2f" || m.typeInfo.name === "mat3x2h") {
            const mv = m.data;
            return new MatrixData([mv[0], mv[3], mv[1], mv[4], mv[2], mv[5]], ttype);
        } else if (m.typeInfo.name === "mat3x3" || m.typeInfo.name === "mat3x3f" || m.typeInfo.name === "mat3x3h") {
            const mv = m.data;
            return new MatrixData([mv[0], mv[3], mv[6], mv[1], mv[4], mv[7], mv[2], mv[5], mv[8]], ttype);
        } else if (m.typeInfo.name === "mat3x4" || m.typeInfo.name === "mat3x4f" || m.typeInfo.name === "mat3x4h") {
            const mv = m.data;
            return new MatrixData([mv[0], mv[4], mv[8], mv[12], mv[1], mv[5], mv[9], mv[13], mv[2], mv[6], mv[10], mv[14]], ttype);
        } else if (m.typeInfo.name === "mat4x2" || m.typeInfo.name === "mat4x2f" || m.typeInfo.name === "mat4x2h") {
            const mv = m.data;
            return new MatrixData([mv[0], mv[4], mv[1], mv[5], mv[2], mv[6]], ttype);
        } else if (m.typeInfo.name === "mat4x3" || m.typeInfo.name === "mat4x3f" || m.typeInfo.name === "mat4x3h") {
            const mv = m.data;
            return new MatrixData([mv[0], mv[4], mv[8], mv[1], mv[5], mv[9], mv[2], mv[6], mv[10]], ttype);
        } else if (m.typeInfo.name === "mat4x4" || m.typeInfo.name === "mat4x4f" || m.typeInfo.name === "mat4x4h") {
            const mv = m.data;
            return new MatrixData([mv[0], mv[4], mv[8], mv[12],
                                   mv[1], mv[5], mv[9], mv[13],
                                   mv[2], mv[6], mv[10], mv[14],
                                   mv[3], mv[7], mv[11], mv[15]], ttype);
        }

        console.error(`Invalid matrix type ${m.typeInfo.name}`);
        return null;
    }

    Trunc(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map((v: number) => Math.trunc(v)), value.typeInfo);
        }
        const s = value as ScalarData
        return new ScalarData(Math.trunc(s.value), value.typeInfo);
    }

    // Derivative Built-in Functions
    //
    // Derivatives are defined over the 2x2 fragment quad. When a quad scheduler
    // is driving execution (see exec/fragment_quad.ts) it evaluates all four
    // lanes at the call site and stashes this lane's result on the context; every
    // variant (dpdx/dpdxCoarse/dpdxFine, dpdy..., fwidth...) is computed there
    // from the call's name, so the builtins just return the stored value.
    //
    // With no quad (compute/vertex, or single-lane fragment debugging) the value
    // is uniform across the quad, so every derivative is zero.
    _derivative(node: CallExpr | Call, context: ExecContext): Data | null {
        const stored = context.getDerivative(node);
        if (stored !== null) {
            context.clearDerivative(node);
            return stored;
        }
        const arg = this.exec.evalExpression(node.args[0], context);
        if (arg instanceof VectorData) {
            return new VectorData(Array.from(arg.data, () => 0), arg.typeInfo);
        }
        if (arg instanceof ScalarData) {
            return new ScalarData(0, arg.typeInfo);
        }
        return arg;
    }

    Dpdx(node: CallExpr | Call, context: ExecContext): Data | null {
        return this._derivative(node, context);
    }

    DpdxCoarse(node: CallExpr | Call, context: ExecContext): Data | null {
        return this._derivative(node, context);
    }

    DpdxFine(node: CallExpr | Call, context: ExecContext): Data | null {
        return this._derivative(node, context);
    }

    Dpdy(node: CallExpr | Call, context: ExecContext): Data | null {
        return this._derivative(node, context);
    }

    DpdyCoarse(node: CallExpr | Call, context: ExecContext): Data | null {
        return this._derivative(node, context);
    }

    DpdyFine(node: CallExpr | Call, context: ExecContext): Data | null {
        return this._derivative(node, context);
    }

    Fwidth(node: CallExpr | Call, context: ExecContext): Data | null {
        return this._derivative(node, context);
    }

    FwidthCoarse(node: CallExpr | Call, context: ExecContext): Data | null {
        return this._derivative(node, context);
    }

    FwidthFine(node: CallExpr | Call, context: ExecContext): Data | null {
        return this._derivative(node, context);
    }

    // Texture Built-in Functions
    TextureDimensions(node: CallExpr | Call, context: ExecContext): Data | null {
        const textureArg = node.args[0];
        const level = node.args.length > 1 ? (this.exec.evalExpression(node.args[1], context) as ScalarData).value : 0;
        if (textureArg instanceof VariableExpr) {
            const textureName = (textureArg as VariableExpr).name;
            const texture = context.getVariableValue(textureName);
            if (texture instanceof TextureData) {
                if (level < 0 || level >= texture.mipLevelCount) {
                    console.error(`Invalid mip level for textureDimensions. Line ${node.line}`);
                    return null;
                }

                const textureSize = texture.getMipLevelSize(level);

                const dimension = texture.dimension;

                if (dimension === "1d") {
                    return new ScalarData(textureSize[0], this.getTypeInfo("u32"));
                } else if (dimension === "3d") {
                    return new VectorData(textureSize, this.getTypeInfo("vec3u"));
                } else if (dimension === "2d") {
                    return new VectorData(textureSize.slice(0, 2), this.getTypeInfo("vec2u"));
                } else {
                    console.error(`Invalid texture dimension ${dimension} not found. Line ${node.line}`);
                    return null;
                }
            } else {
                console.error(`Texture ${textureName} not found. Line ${node.line}`);
                return null;
            }
        }
        console.error(`Invalid texture argument for textureDimensions. Line ${node.line}`);
        return null;
    }

    TextureGather(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: textureGather");
        return null;
    }

    TextureGatherCompare(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: textureGatherCompare");
        return null;
    }

    TextureLoad(node: CallExpr | Call, context: ExecContext): Data | null {
        // https://www.w3.org/TR/WGSL/#textureload
        const textureArg = node.args[0];
        const uv = this.exec.evalExpression(node.args[1], context);

        // A 3d texture's coordinate carries its own slice, so it is a vec3;
        // every other loadable dimension uses a vec2 plus an optional layer.
        if (!(uv instanceof VectorData) || (uv.data.length !== 2 && uv.data.length !== 3)) {
            console.error(`Invalid UV argument for textureLoad. Line ${node.line}`);
            return null;
        }

        if (textureArg instanceof VariableExpr) {
            const textureName = (textureArg as VariableExpr).name;
            const texture = context.getVariableValue(textureName);
            if (texture instanceof TextureData) {
                let zVal = 0;
                let mipLevel = 0;
                if (["texture_storage_2d_array", "texture_2d_array", "texture_depth_2d_array"].indexOf(texture.typeInfo.name) > -1) {
                    zVal = (this.exec.evalExpression(node.args[2], context)as ScalarData).value;
                }
                if (["texture_1d", "texture_2d", "texture_depth_2d", "texture_3d"].indexOf(texture.typeInfo.name) > -1) {
                    mipLevel = (this.exec.evalExpression(node.args[2], context)as ScalarData).value;
                }
                if (["texture_2d_array", "texture_depth_2d_array"].indexOf(texture.typeInfo.name) > -1) {
                    mipLevel = (this.exec.evalExpression(node.args[3], context)as ScalarData).value;
                }
                if (texture.typeInfo.name.includes("_3d") && uv.data.length === 3) {
                    zVal = uv.data[2];
                }
                const x = Math.floor(uv.data[0]);
                const y = Math.floor(uv.data[1]);
                const z = Math.floor(zVal);
                const level = Math.floor(mipLevel)
                if (x < 0 || x >= texture.width || y < 0 || y >= texture.height) {
                    console.error(`Texture ${textureName} out of bounds. Line ${node.line}`);
                    return null;
                }

                const texel = texture.getPixel(x, y, z, level);
                if (texel === null) {
                    console.error(`Invalid texture format for textureLoad. Line ${node.line}`);
                    return null;
                }

                return new VectorData(texel, this.getTypeInfo("vec4f"));
            } else {
                console.error(`Texture ${textureName} not found. Line ${node.line}`);
                return null;
            }
        }

        console.error(`Invalid texture argument for textureLoad. Line ${node.line}`);
        return null;
    }

    TextureNumLayers(node: CallExpr | Call, context: ExecContext): Data | null {
        const textureArg = node.args[0];
        if (textureArg instanceof VariableExpr) {
            const textureName = (textureArg as VariableExpr).name;
            const texture = context.getVariableValue(textureName);
            if (texture instanceof TextureData) {
                return new ScalarData(texture.depthOrArrayLayers, this.getTypeInfo("u32"));
            } else {
                console.error(`Texture ${textureName} not found. Line ${node.line}`);
                return null;
            }
        }
        console.error(`Invalid texture argument for textureNumLayers. Line ${node.line}`);
        return null;
    }

    TextureNumLevels(node: CallExpr | Call, context: ExecContext): Data | null {
        const textureArg = node.args[0];
        if (textureArg instanceof VariableExpr) {
            const textureName = (textureArg as VariableExpr).name;
            const texture = context.getVariableValue(textureName);
            if (texture instanceof TextureData) {
                return new ScalarData(texture.mipLevelCount, this.getTypeInfo("u32"));
            } else {
                console.error(`Texture ${textureName} not found. Line ${node.line}`);
                return null;
            }
        }
        console.error(`Invalid texture argument for textureNumLevels. Line ${node.line}`);
        return null;
    }

    TextureNumSamples(node: CallExpr | Call, context: ExecContext): Data | null {
        const textureArg = node.args[0];
        if (textureArg instanceof VariableExpr) {
            const textureName = (textureArg as VariableExpr).name;
            const texture = context.getVariableValue(textureName);
            if (texture instanceof TextureData) {
                return new ScalarData(texture.sampleCount, this.getTypeInfo("u32"));
            } else {
                console.error(`Texture ${textureName} not found. Line ${node.line}`);
                return null;
            }
        }
        console.error(`Invalid texture argument for textureNumSamples. Line ${node.line}`);
        return null;
    }

    // --- Texture sampling -----------------------------------------------------
    //
    // Sampling is filtered texel access at a mip level. The mip level (LOD) is
    // either given explicitly (textureSampleLevel), derived from explicit
    // gradients (textureSampleGrad), or computed implicitly from the derivatives
    // of the texture coordinates across the 2x2 fragment quad (textureSample,
    // textureSampleBias). The implicit case only has meaning inside a fragment
    // quad, so the quad scheduler (exec/fragment_quad.ts) computes the LOD and
    // stashes it on the context; here it is read back the same way derivatives
    // are. With no quad (single-lane / compute), the implicit LOD defaults to 0.
    //
    // Filtering honors the bound sampler's descriptor: mag filter (linear /
    // nearest), mipmap filter (trilinear / nearest mip), and address modes
    // (clamp-to-edge / repeat / mirror-repeat), for 2d / 2d-array / depth-2d.
    // Defaults (no sampler bound) are linear + clamp-to-edge. Anisotropy and
    // per-min/mag distinction are not modeled.

    // Resolve a texture argument (a bare texture variable) to its TextureData.
    _resolveTexture(arg: CallExpr | Call | any, context: ExecContext): TextureData | null {
        if (arg instanceof VariableExpr) {
            const t = context.getVariableValue(arg.name);
            return t instanceof TextureData ? t : null;
        }
        const t = this.exec.evalExpression(arg, context);
        return t instanceof TextureData ? t : null;
    }

    // Resolve a sampler argument (a bare sampler variable) to its SamplerData.
    _resolveSampler(arg: CallExpr | Call | any, context: ExecContext): SamplerData | null {
        if (arg instanceof VariableExpr) {
            const s = context.getVariableValue(arg.name);
            return s instanceof SamplerData ? s : null;
        }
        return null;
    }

    // Address one axis: wrap an integer texel coordinate per the address mode.
    _wrap(coord: number, size: number, mode: string): number {
        if (mode === "repeat") {
            return ((coord % size) + size) % size;
        }
        if (mode === "mirror-repeat") {
            const p = 2 * size;
            const c = ((coord % p) + p) % p;
            return c < size ? c : p - 1 - c;
        }
        return Math.max(0, Math.min(coord, size - 1)); // clamp-to-edge (default)
    }

    // Read a texel and normalize to rgba (missing G/B -> 0, missing A -> 1),
    // applying the given per-axis address modes at the given mip level.
    _texel(texture: TextureData, x: number, y: number, layer: number, level: number,
        addrU: string, addrV: string): number[] {
        const size = texture.getMipLevelSize(level);
        const w = Math.max(1, size[0]);
        const h = Math.max(1, size[1]);
        const t = texture.getPixel(this._wrap(x, w, addrU), this._wrap(y, h, addrV), layer, level) ?? [0, 0, 0, 0];
        return [t[0] ?? 0, t[1] ?? 0, t[2] ?? 0, t[3] ?? 1];
    }

    // Filter one slice (array layer, cube face, or 3d depth slice) of one mip
    // level: nearest (point) or linear (bilinear) per the sampler's mag filter;
    // address modes come from the sampler too.
    _filterSlice(texture: TextureData, u: number, v: number, layer: number, level: number,
        sampler: SamplerData | null): number[] {
        const d = sampler?.descriptor ?? {};
        const addrU = (d.addressModeU as string) ?? "clamp-to-edge";
        const addrV = (d.addressModeV as string) ?? "clamp-to-edge";
        const size = texture.getMipLevelSize(level);
        const w = Math.max(1, size[0]);
        const h = Math.max(1, size[1]);
        if ((d.magFilter as string) === "nearest") {
            return this._texel(texture, Math.floor(u * w), Math.floor(v * h), layer, level, addrU, addrV);
        }
        const x = u * w - 0.5;
        const y = v * h - 0.5;
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const fx = x - x0;
        const fy = y - y0;
        const t00 = this._texel(texture, x0, y0, layer, level, addrU, addrV);
        const t10 = this._texel(texture, x0 + 1, y0, layer, level, addrU, addrV);
        const t01 = this._texel(texture, x0, y0 + 1, layer, level, addrU, addrV);
        const t11 = this._texel(texture, x0 + 1, y0 + 1, layer, level, addrU, addrV);
        const out = [0, 0, 0, 0];
        for (let i = 0; i < 4; ++i) {
            const a = t00[i] + (t10[i] - t00[i]) * fx;
            const b = t01[i] + (t11[i] - t01[i]) * fx;
            out[i] = a + (b - a) * fy;
        }
        return out;
    }

    // Filter one mip level. For a 3d texture `r` is the normalized depth
    // coordinate and filtering is trilinear across the two bracketing depth
    // slices; otherwise `layer` selects the array layer / cube face and
    // filtering is bilinear within that slice.
    _filterMip(texture: TextureData, u: number, v: number, layer: number, level: number,
        sampler: SamplerData | null, r: number | null = null): number[] {
        if (r === null) {
            return this._filterSlice(texture, u, v, layer, level, sampler);
        }
        const d = sampler?.descriptor ?? {};
        const addrW = (d.addressModeW as string) ?? "clamp-to-edge";
        const depth = Math.max(1, texture.getMipLevelSize(level)[2]);
        if ((d.magFilter as string) === "nearest") {
            return this._filterSlice(texture, u, v,
                this._wrap(Math.floor(r * depth), depth, addrW), level, sampler);
        }
        const z = r * depth - 0.5;
        const z0 = Math.floor(z);
        const fz = z - z0;
        const c0 = this._filterSlice(texture, u, v, this._wrap(z0, depth, addrW), level, sampler);
        if (fz === 0) {
            return c0;
        }
        const c1 = this._filterSlice(texture, u, v, this._wrap(z0 + 1, depth, addrW), level, sampler);
        return c0.map((x, i) => x + (c1[i] - x) * fz);
    }

    // Trilinear sample: filter the two bracketing mips and lerp by the fractional
    // LOD (or pick the nearest mip if mipmapFilter is "nearest"). LOD is clamped
    // to the texture's available mip range.
    _sampleTexture(texture: TextureData, u: number, v: number, layer: number, lod: number,
        sampler: SamplerData | null, r: number | null = null): number[] {
        const maxLod = texture.mipLevelCount - 1;
        lod = Math.max(0, Math.min(lod, maxLod));
        if ((sampler?.descriptor.mipmapFilter as string) === "nearest") {
            return this._filterMip(texture, u, v, layer, Math.round(lod), sampler, r);
        }
        const l0 = Math.floor(lod);
        const frac = lod - l0;
        const c0 = this._filterMip(texture, u, v, layer, l0, sampler, r);
        if (frac === 0 || l0 >= maxLod) {
            return c0;
        }
        const c1 = this._filterMip(texture, u, v, layer, l0 + 1, sampler, r);
        return c0.map((x, i) => x + (c1[i] - x) * frac);
    }

    _cubeFaceUV(x: number, y: number, z: number): { face: number, u: number, v: number } {
        return cubeFaceUV(x, y, z);
    }

    // The comparison predicate named by a sampler_comparison's compare function.
    _compareFn(name: string): (ref: number, stored: number) => boolean {
        switch (name) {
            case "less": return (r, s) => r < s;
            case "greater": return (r, s) => r > s;
            case "less-equal": return (r, s) => r <= s;
            case "greater-equal": return (r, s) => r >= s;
            case "equal": return (r, s) => r === s;
            case "not-equal": return (r, s) => r !== s;
            case "always": return () => true;
            case "never": return () => false;
            default: return (r, s) => r <= s; // typical shadow-map default
        }
    }

    // Percentage-closer filtering: compare depth_ref against each texel at mip 0,
    // then bilinear-blend the 0/1 results (or a single compare if mag is nearest).
    _sampleCompareValue(node: CallExpr | Call, context: ExecContext): Data | null {
        const a = this._sampleArgs(node, context, 2);
        if (a === null) {
            return null;
        }
        const sampler = this._resolveSampler(node.args[1], context);
        const d = sampler?.descriptor ?? {};
        const depthIndex = a.texture.typeInfo.name.includes("_array") ? 4 : 3;
        const refArg = this.exec.evalExpression(node.args[depthIndex], context);
        const ref = refArg instanceof ScalarData ? refArg.value : 0;
        const cmp = this._compareFn((d.compare as string) ?? "less-equal");
        const addrU = (d.addressModeU as string) ?? "clamp-to-edge";
        const addrV = (d.addressModeV as string) ?? "clamp-to-edge";
        const size = a.texture.getMipLevelSize(0);
        const w = Math.max(1, size[0]);
        const h = Math.max(1, size[1]);
        const c = (tx: number, ty: number) =>
            cmp(ref, this._texel(a.texture, tx, ty, a.layer, 0, addrU, addrV)[0]) ? 1 : 0;
        if ((d.magFilter as string) === "nearest") {
            return new ScalarData(c(Math.floor(a.u * w), Math.floor(a.v * h)), this.getTypeInfo("f32"));
        }
        const x = a.u * w - 0.5;
        const y = a.v * h - 0.5;
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const fx = x - x0;
        const fy = y - y0;
        const top = c(x0, y0) + (c(x0 + 1, y0) - c(x0, y0)) * fx;
        const bot = c(x0, y0 + 1) + (c(x0 + 1, y0 + 1) - c(x0, y0 + 1)) * fx;
        return new ScalarData(top + (bot - top) * fy, this.getTypeInfo("f32"));
    }

    // Package a sampled rgba as the WGSL result: f32 for depth textures, vec4f
    // otherwise.
    _sampleResult(texture: TextureData, rgba: number[]): Data {
        if (texture.typeInfo.name.includes("depth")) {
            return new ScalarData(rgba[0], this.getTypeInfo("f32"));
        }
        return new VectorData(rgba, this.getTypeInfo("vec4f"));
    }

    // Common evaluation for the textureSample* family: resolve the texture and
    // turn the coordinate argument into a (u, v, slice) address for the
    // texture's view dimension.
    //
    //   2d / depth-2d    coords.xy, one slice
    //   2d-array         coords.xy, slice = the array_index argument
    //   cube             coords.xyz is a direction; the major axis picks the
    //                    face, which is the slice, and gives the face-local uv
    //   cube-array       as cube, slice = 6 * array_index + face
    //   3d               coords.xyz addresses a volume; `r` is the depth
    //                    coordinate, filtered across slices rather than
    //                    selecting one
    //
    // Returns null on an unsupported form.
    _sampleArgs(node: CallExpr | Call, context: ExecContext, coordIndex: number)
        : { texture: TextureData, u: number, v: number, layer: number, r: number | null } | null {
        const texture = this._resolveTexture(node.args[0], context);
        if (texture === null) {
            console.error(`Invalid texture argument for ${node.name}. Line ${node.line}`);
            return null;
        }
        const typeName = texture.typeInfo.name;
        const isCube = typeName.includes("_cube");
        const is3d = typeName.includes("_3d");
        const isArray = typeName.includes("_array");

        const coords = this.exec.evalExpression(node.args[coordIndex], context);
        const needed = (isCube || is3d) ? 3 : 2;
        if (!(coords instanceof VectorData) || coords.data.length < needed) {
            console.error(`${node.name} requires ${needed}d texture coordinates for ${typeName}. Line ${node.line}`);
            return null;
        }

        // The array_index argument follows the coordinate for array textures.
        let arrayIndex = 0;
        if (isArray) {
            const layerArg = this.exec.evalExpression(node.args[coordIndex + 1], context);
            if (layerArg instanceof ScalarData) {
                arrayIndex = Math.floor(layerArg.value);
            }
        }

        if (isCube) {
            const f = this._cubeFaceUV(coords.data[0], coords.data[1], coords.data[2]);
            return { texture, u: f.u, v: f.v, layer: arrayIndex * 6 + f.face, r: null };
        }
        if (is3d) {
            return { texture, u: coords.data[0], v: coords.data[1], layer: 0, r: coords.data[2] };
        }
        return { texture, u: coords.data[0], v: coords.data[1], layer: arrayIndex, r: null };
    }

    TextureSample(node: CallExpr | Call, context: ExecContext): Data | null {
        const a = this._sampleArgs(node, context, 2);
        if (a === null) {
            return null;
        }
        // Implicit LOD supplied by the quad scheduler; 0 outside a quad.
        let lod = 0;
        const stored = context.getDerivative(node);
        if (stored instanceof ScalarData) {
            lod = stored.value;
            context.clearDerivative(node);
        }
        const sampler = this._resolveSampler(node.args[1], context);
        return this._sampleResult(a.texture, this._sampleTexture(a.texture, a.u, a.v, a.layer, lod, sampler, a.r));
    }

    TextureSampleBias(node: CallExpr | Call, context: ExecContext): Data | null {
        // textureSampleBias(t, s, coords [, array_index], bias [, offset]).
        // The bias is already folded into the quad-computed LOD; outside a quad
        // the implicit LOD (and thus the biased LOD) is 0.
        const a = this._sampleArgs(node, context, 2);
        if (a === null) {
            return null;
        }
        let lod = 0;
        const stored = context.getDerivative(node);
        if (stored instanceof ScalarData) {
            lod = stored.value;
            context.clearDerivative(node);
        }
        const sampler = this._resolveSampler(node.args[1], context);
        return this._sampleResult(a.texture, this._sampleTexture(a.texture, a.u, a.v, a.layer, lod, sampler, a.r));
    }

    TextureSampleLevel(node: CallExpr | Call, context: ExecContext): Data | null {
        // textureSampleLevel(t, s, coords [, array_index], level [, offset]).
        const a = this._sampleArgs(node, context, 2);
        if (a === null) {
            return null;
        }
        const levelIndex = a.texture.typeInfo.name.includes("_array") ? 4 : 3;
        const levelArg = this.exec.evalExpression(node.args[levelIndex], context);
        const lod = levelArg instanceof ScalarData ? levelArg.value : 0;
        const sampler = this._resolveSampler(node.args[1], context);
        return this._sampleResult(a.texture, this._sampleTexture(a.texture, a.u, a.v, a.layer, lod, sampler, a.r));
    }

    TextureSampleGrad(node: CallExpr | Call, context: ExecContext): Data | null {
        // textureSampleGrad(t, s, coords [, array_index], ddx, ddy [, offset]).
        const a = this._sampleArgs(node, context, 2);
        if (a === null) {
            return null;
        }
        const gradBase = a.texture.typeInfo.name.includes("_array") ? 4 : 3;
        const ddx = this.exec.evalExpression(node.args[gradBase], context);
        const ddy = this.exec.evalExpression(node.args[gradBase + 1], context);
        let lod = 0;
        if (ddx instanceof VectorData && ddy instanceof VectorData) {
            // Scale each gradient by the texture's size along that axis; a 3d
            // texture's depth participates too.
            const size = a.texture.getMipLevelSize(0);
            const scale = (g: ArrayLike<number>) => {
                let sum = 0;
                for (let i = 0; i < g.length && i < 3; ++i) {
                    const s = (g[i] as number) * Math.max(1, size[i]);
                    sum += s * s;
                }
                return Math.sqrt(sum);
            };
            const rho = Math.max(scale(ddx.data), scale(ddy.data));
            lod = rho > 0 ? Math.log2(rho) : 0;
        }
        const sampler = this._resolveSampler(node.args[1], context);
        return this._sampleResult(a.texture, this._sampleTexture(a.texture, a.u, a.v, a.layer, lod, sampler, a.r));
    }

    TextureSampleCompare(node: CallExpr | Call, context: ExecContext): Data | null {
        // textureSampleCompare(t, s, coords [, array_index], depth_ref [, offset]).
        // Depth compare (shadow) sampling at mip 0 with percentage-closer
        // filtering; the compare op comes from the sampler_comparison.
        return this._sampleCompareValue(node, context);
    }

    TextureSampleCompareLevel(node: CallExpr | Call, context: ExecContext): Data | null {
        // Like textureSampleCompare but always at mip level 0 (which is what the
        // compare path already uses).
        return this._sampleCompareValue(node, context);
    }

    TextureSampleBaseClampToEdge(node: CallExpr | Call, context: ExecContext): Data | null {
        // Always samples mip 0 with clamp-to-edge (its whole purpose).
        const a = this._sampleArgs(node, context, 2);
        if (a === null) {
            return null;
        }
        return this._sampleResult(a.texture, this._filterMip(a.texture, a.u, a.v, a.layer, 0, null, a.r));
    }

    TextureStore(node: CallExpr | Call, context: ExecContext): Data | null {
        const textureArg = node.args[0];
        const uv = this.exec.evalExpression(node.args[1], context);
        const index = (node.args.length === 4) ? (this.exec.evalExpression(node.args[2], context) as ScalarData).value : 0;
        const value = (node.args.length === 4) ? (this.exec.evalExpression(node.args[3], context) as VectorData).data :
            (this.exec.evalExpression(node.args[2], context) as VectorData).data;

        if (value.length !== 4) {
            console.error(`Invalid value argument for textureStore. Line ${node.line}`);
            return null;
        }

        // TODO: non-vec2 UVs, for non-2D textures
        if (!(uv instanceof VectorData) || uv.data.length !== 2) {
            console.error(`Invalid UV argument for textureStore. Line ${node.line}`);
            return null;
        }

        if (textureArg instanceof VariableExpr) {
            const textureName = (textureArg as VariableExpr).name;
            const texture = context.getVariableValue(textureName);
            if (texture instanceof TextureData) {
                const textureSize = texture.getMipLevelSize(0);
                const x = Math.floor(uv.data[0]);
                const y = Math.floor(uv.data[1]);
                if (x < 0 || x >= textureSize[0] || y < 0 || y >= textureSize[1]) {
                    console.error(`Texture ${textureName} out of bounds. Line ${node.line}`);
                    return null;
                }

                texture.setPixel(x, y, 0, index, Array.from(value));

                return null;
            } else {
                console.error(`Texture ${textureName} not found. Line ${node.line}`);
                return null;
            }
        }

        console.error(`Invalid texture argument for textureStore. Line ${node.line}`);
        return null;
    }

    // Atomic Built-in Functions
    AtomicLoad(node: CallExpr | Call, context: ExecContext): Data | null {
        let l = node.args[0];
        if (l instanceof UnaryOperator) {
            l = l.right;
        }

        const name = this.exec.getVariableName(l, context);
        const v = context.getVariable(name);

        const currentValue = v.value.getSubData(this.exec, l.postfix, context);
        return currentValue;
    }

    AtomicStore(node: CallExpr | Call, context: ExecContext): Data | null {
        let l = node.args[0];
        if (l instanceof UnaryOperator) {
            l = l.right;
        }

        const name = this.exec.getVariableName(l, context);
        const v = context.getVariable(name);

        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);

        const currentValue = v.value.getSubData(this.exec, l.postfix, context);

        if (currentValue instanceof ScalarData && value instanceof ScalarData) {
            currentValue.value = value.value;
        }

        if (v.value instanceof TypedData) {
            v.value.setDataValue(this.exec, currentValue, l.postfix, context);
        }

        return null;
    }

    AtomicAdd(node: CallExpr | Call, context: ExecContext): Data | null {
        let l = node.args[0];
        if (l instanceof UnaryOperator) {
            l = l.right;
        }

        const name = this.exec.getVariableName(l, context);
        const v = context.getVariable(name);

        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);

        const currentValue = v.value.getSubData(this.exec, l.postfix, context);
        const originalValue = new ScalarData((currentValue as ScalarData).value, currentValue.typeInfo);

        if (currentValue instanceof ScalarData && value instanceof ScalarData) {
            currentValue.value += value.value;
        }

        if (v.value instanceof TypedData) {
            v.value.setDataValue(this.exec, currentValue, l.postfix, context);
        }

        return originalValue;
    }

    AtomicSub(node: CallExpr | Call, context: ExecContext): Data | null {
        let l = node.args[0];
        if (l instanceof UnaryOperator) {
            l = l.right;
        }

        const name = this.exec.getVariableName(l, context);
        const v = context.getVariable(name);

        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);

        const currentValue = v.value.getSubData(this.exec, l.postfix, context);
        const originalValue = new ScalarData((currentValue as ScalarData).value, currentValue.typeInfo);

        if (currentValue instanceof ScalarData && value instanceof ScalarData) {
            currentValue.value -= value.value;
        }

        if (v.value instanceof TypedData) {
            v.value.setDataValue(this.exec, currentValue, l.postfix, context);
        }

        return originalValue;
    }

    AtomicMax(node: CallExpr | Call, context: ExecContext): Data | null {
        let l = node.args[0];
        if (l instanceof UnaryOperator) {
            l = l.right;
        }

        const name = this.exec.getVariableName(l, context);
        const v = context.getVariable(name);

        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);

        const currentValue = v.value.getSubData(this.exec, l.postfix, context);

        const originalValue = new ScalarData((currentValue as ScalarData).value, currentValue.typeInfo);

        if (currentValue instanceof ScalarData && value instanceof ScalarData) {
            currentValue.value = Math.max(currentValue.value, value.value);
        }

        if (v.value instanceof TypedData) {
            v.value.setDataValue(this.exec, currentValue, l.postfix, context);
        }

        return originalValue;
    }

    AtomicMin(node: CallExpr | Call, context: ExecContext): Data | null {
        let l = node.args[0];
        if (l instanceof UnaryOperator) {
            l = l.right;
        }

        const name = this.exec.getVariableName(l, context);
        const v = context.getVariable(name);

        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);

        const currentValue = v.value.getSubData(this.exec, l.postfix, context);

        const originalValue = new ScalarData((currentValue as ScalarData).value, currentValue.typeInfo);

        if (currentValue instanceof ScalarData && value instanceof ScalarData) {
            currentValue.value = Math.min(currentValue.value, value.value);
        }

        if (v.value instanceof TypedData) {
            v.value.setDataValue(this.exec, currentValue, l.postfix, context);
        }

        return originalValue;
    }

    AtomicAnd(node: CallExpr | Call, context: ExecContext): Data | null {
        let l = node.args[0];
        if (l instanceof UnaryOperator) {
            l = l.right;
        }

        const name = this.exec.getVariableName(l, context);
        const v = context.getVariable(name);

        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);

        const currentValue = v.value.getSubData(this.exec, l.postfix, context);

        const originalValue = new ScalarData((currentValue as ScalarData).value, currentValue.typeInfo);

        if (currentValue instanceof ScalarData && value instanceof ScalarData) {
            currentValue.value = currentValue.value & value.value;
        }

        if (v.value instanceof TypedData) {
            v.value.setDataValue(this.exec, currentValue, l.postfix, context);
        }

        return originalValue;
    }

    AtomicOr(node: CallExpr | Call, context: ExecContext): Data | null {
        let l = node.args[0];
        if (l instanceof UnaryOperator) {
            l = l.right;
        }

        const name = this.exec.getVariableName(l, context);
        const v = context.getVariable(name);

        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);

        const currentValue = v.value.getSubData(this.exec, l.postfix, context);

        const originalValue = new ScalarData((currentValue as ScalarData).value, currentValue.typeInfo);

        if (currentValue instanceof ScalarData && value instanceof ScalarData) {
            currentValue.value = currentValue.value | value.value;
        }

        if (v.value instanceof TypedData) {
            v.value.setDataValue(this.exec, currentValue, l.postfix, context);
        }

        return originalValue;
    }

    AtomicXor(node: CallExpr | Call, context: ExecContext): Data | null {
        let l = node.args[0];
        if (l instanceof UnaryOperator) {
            l = l.right;
        }

        const name = this.exec.getVariableName(l, context);
        const v = context.getVariable(name);

        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);

        const currentValue = v.value.getSubData(this.exec, l.postfix, context);

        const originalValue = new ScalarData((currentValue as ScalarData).value, currentValue.typeInfo);

        if (currentValue instanceof ScalarData && value instanceof ScalarData) {
            currentValue.value = currentValue.value ^ value.value;
        }

        if (v.value instanceof TypedData) {
            v.value.setDataValue(this.exec, currentValue, l.postfix, context);
        }

        return originalValue;
    }

    AtomicExchange(node: CallExpr | Call, context: ExecContext): Data | null {
        let l = node.args[0];
        if (l instanceof UnaryOperator) {
            l = l.right;
        }

        const name = this.exec.getVariableName(l, context);
        const v = context.getVariable(name);

        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);

        const currentValue = v.value.getSubData(this.exec, l.postfix, context);

        const originalValue = new ScalarData((currentValue as ScalarData).value, currentValue.typeInfo);

        if (currentValue instanceof ScalarData && value instanceof ScalarData) {
            currentValue.value = value.value;
        }

        if (v.value instanceof TypedData) {
            v.value.setDataValue(this.exec, currentValue, l.postfix, context);
        }

        return originalValue;
    }

    AtomicCompareExchangeWeak(node: CallExpr | Call, context: ExecContext): Data | null {
        // WGSL atomicCompareExchangeWeak returns a struct __atomic_compare_exchange_result<T>
        // { old_value: T, exchanged: bool }. Struct returns from builtins aren't wired through
        // the type system here (see also Modf), so we model the spec's "exchanged: true on
        // match" path by performing the swap and returning the prior value as a ScalarData.
        let l = node.args[0];
        if (l instanceof UnaryOperator) {
            l = l.right;
        }

        const name = this.exec.getVariableName(l, context);
        const v = context.getVariable(name);

        const cmp = this.exec.evalExpression(node.args[1], context);
        const value = this.exec.evalExpression(node.args[2], context);

        const currentValue = v.value.getSubData(this.exec, l.postfix, context);
        const originalValue = new ScalarData((currentValue as ScalarData).value, currentValue.typeInfo);

        if (currentValue instanceof ScalarData && cmp instanceof ScalarData && value instanceof ScalarData) {
            if (currentValue.value === cmp.value) {
                currentValue.value = value.value;
                if (v.value instanceof TypedData) {
                    v.value.setDataValue(this.exec, currentValue, l.postfix, context);
                }
            }
        }

        return originalValue;
    }

    // Data Packing Built-in Functions
    _packSnormByte(v: number): number {
        // clamp(round(v * 127), -128, 127) as signed 8-bit
        const s = Math.round(v * 127);
        const c = s < -128 ? -128 : s > 127 ? 127 : s;
        return c & 0xff;
    }

    _packUnormByte(v: number): number {
        // clamp(round(v * 255), 0, 255) as unsigned 8-bit
        const u = Math.round(v * 255);
        const c = u < 0 ? 0 : u > 255 ? 255 : u;
        return c & 0xff;
    }

    Pack4x8snorm(node: CallExpr | Call, context: ExecContext): Data | null {
        const e = this.exec.evalExpression(node.args[0], context);
        if (!(e instanceof VectorData)) {
            console.error(`Pack4x8snorm() expects a vec4<f32> argument. Line ${node.line}`);
            return null;
        }
        const d = e.data;
        const result = (this._packSnormByte(d[0])
                | (this._packSnormByte(d[1]) << 8)
                | (this._packSnormByte(d[2]) << 16)
                | (this._packSnormByte(d[3]) << 24)) >>> 0;
        return new ScalarData(result, this.getTypeInfo("u32"));
    }

    Pack4x8unorm(node: CallExpr | Call, context: ExecContext): Data | null {
        const e = this.exec.evalExpression(node.args[0], context);
        if (!(e instanceof VectorData)) {
            console.error(`Pack4x8unorm() expects a vec4<f32> argument. Line ${node.line}`);
            return null;
        }
        const d = e.data;
        const result = (this._packUnormByte(d[0])
                | (this._packUnormByte(d[1]) << 8)
                | (this._packUnormByte(d[2]) << 16)
                | (this._packUnormByte(d[3]) << 24)) >>> 0;
        return new ScalarData(result, this.getTypeInfo("u32"));
    }

    Pack4xI8(node: CallExpr | Call, context: ExecContext): Data | null {
        const e = this.exec.evalExpression(node.args[0], context);
        if (!(e instanceof VectorData)) {
            console.error(`Pack4xI8() expects a vec4<i32> argument. Line ${node.line}`);
            return null;
        }
        const d = e.data;
        const result = ((d[0] & 0xff)
                | ((d[1] & 0xff) << 8)
                | ((d[2] & 0xff) << 16)
                | ((d[3] & 0xff) << 24)) >>> 0;
        return new ScalarData(result, this.getTypeInfo("u32"));
    }

    Pack4xU8(node: CallExpr | Call, context: ExecContext): Data | null {
        const e = this.exec.evalExpression(node.args[0], context);
        if (!(e instanceof VectorData)) {
            console.error(`Pack4xU8() expects a vec4<u32> argument. Line ${node.line}`);
            return null;
        }
        const d = e.data;
        const result = ((d[0] & 0xff)
                | ((d[1] & 0xff) << 8)
                | ((d[2] & 0xff) << 16)
                | ((d[3] & 0xff) << 24)) >>> 0;
        return new ScalarData(result, this.getTypeInfo("u32"));
    }

    Pack4x8Clamp(node: CallExpr | Call, context: ExecContext): Data | null {
        // Signed-i8 clamp variant (matches the WGSL name used by this codebase).
        const e = this.exec.evalExpression(node.args[0], context);
        if (!(e instanceof VectorData)) {
            console.error(`Pack4x8Clamp() expects a vec4<i32> argument. Line ${node.line}`);
            return null;
        }
        const d = e.data;
        const clamp = (v: number) => (v < -128 ? -128 : v > 127 ? 127 : v) & 0xff;
        const result = (clamp(d[0])
                | (clamp(d[1]) << 8)
                | (clamp(d[2]) << 16)
                | (clamp(d[3]) << 24)) >>> 0;
        return new ScalarData(result, this.getTypeInfo("u32"));
    }

    Pack4xU8Clamp(node: CallExpr | Call, context: ExecContext): Data | null {
        const e = this.exec.evalExpression(node.args[0], context);
        if (!(e instanceof VectorData)) {
            console.error(`Pack4xU8Clamp() expects a vec4<u32> argument. Line ${node.line}`);
            return null;
        }
        const d = e.data;
        const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v) & 0xff;
        const result = (clamp(d[0])
                | (clamp(d[1]) << 8)
                | (clamp(d[2]) << 16)
                | (clamp(d[3]) << 24)) >>> 0;
        return new ScalarData(result, this.getTypeInfo("u32"));
    }

    Pack2x16snorm(node: CallExpr | Call, context: ExecContext): Data | null {
        const e = this.exec.evalExpression(node.args[0], context);
        if (!(e instanceof VectorData)) {
            console.error(`Pack2x16snorm() expects a vec2<f32> argument. Line ${node.line}`);
            return null;
        }
        const d = e.data;
        const half = (v: number) => {
            const s = Math.round(v * 32767);
            const c = s < -32768 ? -32768 : s > 32767 ? 32767 : s;
            return c & 0xffff;
        };
        const result = (half(d[0]) | (half(d[1]) << 16)) >>> 0;
        return new ScalarData(result, this.getTypeInfo("u32"));
    }

    Pack2x16unorm(node: CallExpr | Call, context: ExecContext): Data | null {
        const e = this.exec.evalExpression(node.args[0], context);
        if (!(e instanceof VectorData)) {
            console.error(`Pack2x16unorm() expects a vec2<f32> argument. Line ${node.line}`);
            return null;
        }
        const d = e.data;
        const half = (v: number) => {
            const u = Math.round(v * 65535);
            return (u < 0 ? 0 : u > 65535 ? 65535 : u) & 0xffff;
        };
        const result = (half(d[0]) | (half(d[1]) << 16)) >>> 0;
        return new ScalarData(result, this.getTypeInfo("u32"));
    }

    Pack2x16float(node: CallExpr | Call, context: ExecContext): Data | null {
        const e = this.exec.evalExpression(node.args[0], context);
        if (!(e instanceof VectorData)) {
            console.error(`Pack2x16float() expects a vec2<f32> argument. Line ${node.line}`);
            return null;
        }
        const d = e.data;
        const result = (BuiltinFunctions._f32ToF16Bits(d[0])
                | (BuiltinFunctions._f32ToF16Bits(d[1]) << 16)) >>> 0;
        return new ScalarData(result, this.getTypeInfo("u32"));
    }

    // Data Unpacking Built-in Functions
    Unpack4x8snorm(node: CallExpr | Call, context: ExecContext): Data | null {
        const e = this.exec.evalExpression(node.args[0], context);
        if (!(e instanceof ScalarData)) {
            console.error(`Unpack4x8snorm() expects a u32 argument. Line ${node.line}`);
            return null;
        }
        const u = e.value >>> 0;
        const toSnorm = (b: number) => {
            const s = b & 0x80 ? b - 256 : b;
            const f = s / 127;
            return f < -1 ? -1 : f > 1 ? 1 : f;
        };
        return new VectorData([toSnorm(u & 0xff), toSnorm((u >>> 8) & 0xff),
                toSnorm((u >>> 16) & 0xff), toSnorm((u >>> 24) & 0xff)],
                this.getTypeInfo("vec4f"));
    }

    Unpack4x8unorm(node: CallExpr | Call, context: ExecContext): Data | null {
        const e = this.exec.evalExpression(node.args[0], context);
        if (!(e instanceof ScalarData)) {
            console.error(`Unpack4x8unorm() expects a u32 argument. Line ${node.line}`);
            return null;
        }
        const u = e.value >>> 0;
        return new VectorData([(u & 0xff) / 255, ((u >>> 8) & 0xff) / 255,
                ((u >>> 16) & 0xff) / 255, ((u >>> 24) & 0xff) / 255],
                this.getTypeInfo("vec4f"));
    }

    Unpack4xI8(node: CallExpr | Call, context: ExecContext): Data | null {
        const e = this.exec.evalExpression(node.args[0], context);
        if (!(e instanceof ScalarData)) {
            console.error(`Unpack4xI8() expects a u32 argument. Line ${node.line}`);
            return null;
        }
        const u = e.value >>> 0;
        const sext = (b: number) => (b & 0x80) ? b - 256 : b;
        return new VectorData([sext(u & 0xff), sext((u >>> 8) & 0xff),
                sext((u >>> 16) & 0xff), sext((u >>> 24) & 0xff)],
                this.getTypeInfo("vec4i"));
    }

    Unpack4xU8(node: CallExpr | Call, context: ExecContext): Data | null {
        const e = this.exec.evalExpression(node.args[0], context);
        if (!(e instanceof ScalarData)) {
            console.error(`Unpack4xU8() expects a u32 argument. Line ${node.line}`);
            return null;
        }
        const u = e.value >>> 0;
        return new VectorData([u & 0xff, (u >>> 8) & 0xff,
                (u >>> 16) & 0xff, (u >>> 24) & 0xff],
                this.getTypeInfo("vec4u"));
    }

    Unpack2x16snorm(node: CallExpr | Call, context: ExecContext): Data | null {
        const e = this.exec.evalExpression(node.args[0], context);
        if (!(e instanceof ScalarData)) {
            console.error(`Unpack2x16snorm() expects a u32 argument. Line ${node.line}`);
            return null;
        }
        const u = e.value >>> 0;
        const toSnorm = (h: number) => {
            const s = h & 0x8000 ? h - 0x10000 : h;
            const f = s / 32767;
            return f < -1 ? -1 : f > 1 ? 1 : f;
        };
        return new VectorData([toSnorm(u & 0xffff), toSnorm((u >>> 16) & 0xffff)],
                this.getTypeInfo("vec2f"));
    }

    Unpack2x16unorm(node: CallExpr | Call, context: ExecContext): Data | null {
        const e = this.exec.evalExpression(node.args[0], context);
        if (!(e instanceof ScalarData)) {
            console.error(`Unpack2x16unorm() expects a u32 argument. Line ${node.line}`);
            return null;
        }
        const u = e.value >>> 0;
        return new VectorData([(u & 0xffff) / 65535, ((u >>> 16) & 0xffff) / 65535],
                this.getTypeInfo("vec2f"));
    }

    Unpack2x16float(node: CallExpr | Call, context: ExecContext): Data | null {
        const e = this.exec.evalExpression(node.args[0], context);
        if (!(e instanceof ScalarData)) {
            console.error(`Unpack2x16float() expects a u32 argument. Line ${node.line}`);
            return null;
        }
        const u = e.value >>> 0;
        return new VectorData([BuiltinFunctions._f16BitsToF32(u & 0xffff),
                BuiltinFunctions._f16BitsToF32((u >>> 16) & 0xffff)],
                this.getTypeInfo("vec2f"));
    }

    static _f32Convert = new Float32Array(1);
    static _u32View = new Uint32Array(BuiltinFunctions._f32Convert.buffer);

    static _f32ToF16Bits(val: number): number {
        BuiltinFunctions._f32Convert[0] = val;
        const bits = BuiltinFunctions._u32View[0];
        const sign = (bits >>> 16) & 0x8000;
        let exp = ((bits >>> 23) & 0xff) - 127 + 15;
        const mantissa = bits & 0x7fffff;
        if (((bits >>> 23) & 0xff) === 0xff) {
            // NaN / Inf
            return sign | 0x7c00 | (mantissa ? 0x200 : 0);
        }
        if (exp >= 31) {
            return sign | 0x7c00; // Inf (overflow)
        }
        if (exp <= 0) {
            if (exp < -10) {
                return sign;
            }
            const m = (mantissa | 0x800000) >>> (14 - exp);
            return sign | m;
        }
        return sign | (exp << 10) | (mantissa >>> 13);
    }

    static _f16BitsToF32(bits: number): number {
        const sign = (bits & 0x8000) << 16;
        const exp = (bits >>> 10) & 0x1f;
        const mantissa = bits & 0x3ff;
        let u32bits = 0;
        if (exp === 0) {
            if (mantissa === 0) {
                u32bits = sign;
            } else {
                let m = mantissa;
                let e = -14;
                while ((m & 0x400) === 0) {
                    m <<= 1;
                    e--;
                }
                m &= 0x3ff;
                u32bits = sign | ((e + 127) << 23) | (m << 13);
            }
        } else if (exp === 31) {
            u32bits = sign | 0x7f800000 | (mantissa << 13);
        } else {
            u32bits = sign | ((exp - 15 + 127) << 23) | (mantissa << 13);
        }
        BuiltinFunctions._u32View[0] = u32bits;
        return BuiltinFunctions._f32Convert[0];
    }

    // Synchronization Functions
    StorageBarrier(node: CallExpr | Call, context: ExecContext): Data | null {
        // Execution is single threaded, barriers not necessary.
        return null;
    }

    TextureBarrier(node: CallExpr | Call, context: ExecContext): Data | null {
        // Execution is single threaded, barriers not necessary.
        return null;
    }

    WorkgroupBarrier(node: CallExpr | Call, context: ExecContext): Data | null {
        // Execution is single threaded, barriers not necessary.
        return null;
    }

    WorkgroupUniformLoad(node: CallExpr | Call, context: ExecContext): Data | null {
        // Execution is single threaded, barriers not necessary.
        return null;
    }

    // Subgroup Functions
    // WgslExec runs one invocation at a time, so subgroup operations are modelled as if the
    // subgroup contained only the current lane: reductions/scans return the input value,
    // broadcasts/shuffles return the operand, predicates return its truthiness, and ballot
    // returns 1. This lets compute shaders that mention these builtins execute, but the
    // result will not match real hardware that has multi-lane subgroups.
    SubgroupAdd(node: CallExpr | Call, context: ExecContext): Data | null {
        return this.exec.evalExpression(node.args[0], context);
    }

    SubgroupExclusiveAdd(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map(() => 0), value.typeInfo);
        }
        return new ScalarData(0, value.typeInfo);
    }

    SubgroupInclusiveAdd(node: CallExpr | Call, context: ExecContext): Data | null {
        return this.exec.evalExpression(node.args[0], context);
    }

    SubgroupAll(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context) as ScalarData;
        return new ScalarData(value.value ? 1 : 0, this.getTypeInfo("bool"));
    }

    SubgroupAnd(node: CallExpr | Call, context: ExecContext): Data | null {
        return this.exec.evalExpression(node.args[0], context);
    }

    SubgroupAny(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context) as ScalarData;
        return new ScalarData(value.value ? 1 : 0, this.getTypeInfo("bool"));
    }

    SubgroupBallot(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context) as ScalarData;
        const bit = value.value ? 1 : 0;
        return new VectorData([bit, 0, 0, 0], this.getTypeInfo("vec4u"));
    }

    SubgroupBroadcast(node: CallExpr | Call, context: ExecContext): Data | null {
        return this.exec.evalExpression(node.args[0], context);
    }

    SubgroupBroadcastFirst(node: CallExpr | Call, context: ExecContext): Data | null {
        return this.exec.evalExpression(node.args[0], context);
    }

    SubgroupElect(node: CallExpr | Call, context: ExecContext): Data | null {
        return new ScalarData(1, this.getTypeInfo("bool"));
    }

    SubgroupMax(node: CallExpr | Call, context: ExecContext): Data | null {
        return this.exec.evalExpression(node.args[0], context);
    }

    SubgroupMin(node: CallExpr | Call, context: ExecContext): Data | null {
        return this.exec.evalExpression(node.args[0], context);
    }

    SubgroupMul(node: CallExpr | Call, context: ExecContext): Data | null {
        return this.exec.evalExpression(node.args[0], context);
    }

    SubgroupExclusiveMul(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.data.map(() => 1), value.typeInfo);
        }
        return new ScalarData(1, value.typeInfo);
    }

    SubgroupInclusiveMul(node: CallExpr | Call, context: ExecContext): Data | null {
        return this.exec.evalExpression(node.args[0], context);
    }

    SubgroupOr(node: CallExpr | Call, context: ExecContext): Data | null {
        return this.exec.evalExpression(node.args[0], context);
    }

    SubgroupShuffle(node: CallExpr | Call, context: ExecContext): Data | null {
        return this.exec.evalExpression(node.args[0], context);
    }

    SubgroupShuffleDown(node: CallExpr | Call, context: ExecContext): Data | null {
        return this.exec.evalExpression(node.args[0], context);
    }

    SubgroupShuffleUp(node: CallExpr | Call, context: ExecContext): Data | null {
        return this.exec.evalExpression(node.args[0], context);
    }

    SubgroupShuffleXor(node: CallExpr | Call, context: ExecContext): Data | null {
        return this.exec.evalExpression(node.args[0], context);
    }

    SubgroupXor(node: CallExpr | Call, context: ExecContext): Data | null {
        return this.exec.evalExpression(node.args[0], context);
    }

    // Quad Functions
    // As with subgroups, modelled as identity for a quad of size 1.
    QuadBroadcast(node: CallExpr | Call, context: ExecContext): Data | null {
        return this.exec.evalExpression(node.args[0], context);
    }

    QuadSwapDiagonal(node: CallExpr | Call, context: ExecContext): Data | null {
        return this.exec.evalExpression(node.args[0], context);
    }

    QuadSwapX(node: CallExpr | Call, context: ExecContext): Data | null {
        return this.exec.evalExpression(node.args[0], context);
    }

    QuadSwapY(node: CallExpr | Call, context: ExecContext): Data | null {
        return this.exec.evalExpression(node.args[0], context);
    }
}
