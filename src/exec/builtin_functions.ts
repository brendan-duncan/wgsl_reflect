import { CallExpr, Call, UnaryOperator, VariableExpr,
    Data, TypedData, ScalarData, VectorData, MatrixData } from "../wgsl_ast.js";
import { ExecContext } from "./exec_context.js";
import { ExecInterface } from "./exec_interface.js";
import { ArrayInfo, TemplateInfo, TypeInfo } from "../reflect/info.js";

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
            value.value.forEach((x: any) => { if (!x) isTrue = false; });
            return new ScalarData(isTrue ? 1 : 0, this.getTypeInfo("bool"));
        }
        throw new Error(`All() expects a vector argument. Line ${node.line}`);
    }

    Any(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            const res = value.value.some((v: any) => v);
            return new ScalarData(res ? 1 : 0, this.getTypeInfo("bool"));
        }
        throw new Error(`Any() expects a vector argument. Line ${node.line}`);
    }

    Select(node: CallExpr | Call, context: ExecContext): Data | null {
        // select(false, true, condition)
        const condition = this.exec.evalExpression(node.args[2], context);
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
            return new VectorData(value.value.map((v: number) => Math.abs(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.abs(s.value), s.typeInfo);
    }

    Acos(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => Math.acos(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.acos(s.value), value.typeInfo);
    }

    Acosh(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => Math.acosh(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.acosh(s.value), value.typeInfo);
    }

    Asin(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => Math.asin(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.asin(s.value), value.typeInfo);
    }

    Asinh(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => Math.asinh(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.asinh(s.value), value.typeInfo);
    }

    Atan(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => Math.atan(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.atan(s.value), value.typeInfo);
    }

    Atanh(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => Math.atanh(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.atanh(s.value), value.typeInfo);
    }

    Atan2(node: CallExpr | Call, context: ExecContext): Data | null {
        const y = this.exec.evalExpression(node.args[0], context);
        const x = this.exec.evalExpression(node.args[1], context);
        if (y instanceof VectorData && x instanceof VectorData) {
            return new VectorData(y.value.map((v: number, i: number) => Math.atan2(v, x.value[i])), y.typeInfo);
        }
        const ys = y as ScalarData;
        const xs = x as ScalarData;
        return new ScalarData(Math.atan2(ys.value, xs.value), y.typeInfo);
    }

    Ceil(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => Math.ceil(v)), value.typeInfo);
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
            return new VectorData(value.value.map((v: number, i: number) => this._clamp(v, min.value[i], max.value[i])), value.typeInfo);
        }
        const s = value as ScalarData;
        const minS = min as ScalarData;
        const maxS = max as ScalarData
        return new ScalarData(this._clamp(s.value, minS.value, maxS.value), value.typeInfo);
    }

    Cos(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => Math.cos(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.cos(s.value), value.typeInfo);
    }

    Cosh(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => Math.cosh(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.cos(s.value), value.typeInfo);
    }

    CountLeadingZeros(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => Math.clz32(v)), value.typeInfo);
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
            return new VectorData(value.value.map((v: number) => this._countOneBits(v)), value.typeInfo);
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
            return new VectorData(value.value.map((v: number) => this._countTrailingZeros(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(this._countTrailingZeros(s.value), value.typeInfo);
    }

    Cross(node: CallExpr | Call, context: ExecContext): Data | null {
        const l = this.exec.evalExpression(node.args[0], context);
        const r = this.exec.evalExpression(node.args[1], context);
        if (l instanceof VectorData && r instanceof VectorData) {
            if (l.value.length !== 3 || r.value.length !== 3) {
                console.error(`Cross() expects 3D vectors. Line ${node.line}`);
                return null;
            }
            const lv = l.value;
            const rv = r.value;
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
            return new VectorData(value.value.map((v: number) => v * radToDeg), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(s.value * radToDeg, value.typeInfo);
    }

    Determinant(node: CallExpr | Call, context: ExecContext): Data | null {
        const m = this.exec.evalExpression(node.args[0], context);
        if (m instanceof MatrixData) {
            const mv = m.value;
            const mt = this.exec.getTypeName(m.typeInfo);
            const isHalf = mt.endsWith("h");
            const formatType = isHalf ? this.getTypeInfo("f16") : this.getTypeInfo("f32");
            if (mt === "mat2x2" || mt === "mat2x2f" || mt === "mat2x2h") {
                return new ScalarData(mv[0] * mv[3] - mv[1] * mv[2], formatType);
            } else if (mt === "mat2x3" || mt === "mat2x3f" || mt === "mat2x3h") {
                return new ScalarData(mv[0] * (mv[4] * mv[8] - mv[5] * mv[7]) -
                        mv[1] * (mv[3] * mv[8] - mv[5] * mv[6]) + mv[2] * (mv[3] * mv[7] - mv[4] * mv[6]), formatType);
            } else if (mt === "mat2x4" || mt === "mat2x4f" || mt === "mat2x4h") {
                console.error(`TODO: Determinant for ${mt}`);
            } else if (mt === "mat3x2" || mt === "mat3x2f" || mt === "mat3x2h") {
                console.error(`TODO: Determinant for ${mt}`);
            } else if (mt === "mat3x3" || mt === "mat3x3f" || mt === "mat3x3h") {
                return new ScalarData(mv[0] * (mv[4] * mv[8] - mv[5] * mv[7]) -
                        mv[1] * (mv[3] * mv[8] - mv[5] * mv[6]) + mv[2] * (mv[3] * mv[7] - mv[4] * mv[6]), formatType);
            } else if (mt === "mat3x4" || mt === "mat3x4f" || mt === "mat3x4h") {
                console.error(`TODO: Determinant for ${mt}`);
            } else if (mt === "mat4x2" || mt === "mat4x2f" || mt === "mat4x2h") {
                console.error(`TODO: Determinant for ${mt}`);
            } else if (mt === "mat4x3" || mt === "mat4x3f" || mt === "mat4x3h") {
                console.error(`TODO: Determinant for ${mt}`);
            } else if (mt === "mat4x4" || mt === "mat4x4f" || mt === "mat4x4h") {
                console.error(`TODO: Determinant for ${mt}`);
            }
        }
        console.error(`Determinant expects a matrix argument. Line ${node.line}`);
        return null;
    }

    Distance(node: CallExpr | Call, context: ExecContext): Data | null {
        const l = this.exec.evalExpression(node.args[0], context);
        const r = this.exec.evalExpression(node.args[1], context);
        if (l instanceof VectorData && r instanceof VectorData) {
            let sum = 0;
            for (let i = 0; i < l.value.length; ++i) {
                sum += (l.value[i] - r.value[i]) * (l.value[i] - r.value[i]);
            }
            return new ScalarData(Math.sqrt(sum), this.getTypeInfo("f32"));
        }
        const ls = l as ScalarData;
        const rs = r as ScalarData;
        return new ScalarData(Math.abs(ls.value - rs.value), l.typeInfo);
    }

    _dot(e1: number[], e2: number[]) {
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
            return new ScalarData(this._dot(l.value, r.value), this.getTypeInfo("f32"));
        }
        console.error(`Dot() expects vector arguments. Line ${node.line}`);
        return null;
    }

    Dot4U8Packed(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error(`TODO: dot4U8Packed. Line ${node.line}`);
        return null;
    }

    Dot4I8Packed(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error(`TODO: dot4I8Packed. Line ${node.line}`);
        return null;
    }

    Exp(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => Math.exp(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.exp(s.value), value.typeInfo);
    }

    Exp2(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => Math.pow(2, v)), value.typeInfo);
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
            return new VectorData(value.value.map((v: number) => (v >> o) & ((1 << c) - 1)), value.typeInfo);
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
            const dot = this._dot(e2.value, n.value);
            if (dot < 0) {
                return new VectorData(e1.value, e1.typeInfo);
            }
            return new VectorData(e1.value.map((v: number) => -v), e1.typeInfo);
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
            return new VectorData(value.value.map((v: number) => this._firstLeadingBit(v)), value.typeInfo);
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
            return new VectorData(value.value.map((v: number) => this._firstTrailingBit(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(this._firstTrailingBit(s.value), value.typeInfo);
    }

    Floor(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => Math.floor(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.floor(s.value), value.typeInfo);
    }

    Fma(node: CallExpr | Call, context: ExecContext): Data | null {
        const a = this.exec.evalExpression(node.args[0], context);
        const b = this.exec.evalExpression(node.args[1], context);
        const c = this.exec.evalExpression(node.args[2], context);
        if (a instanceof VectorData && b instanceof VectorData && c instanceof VectorData) {
            if (a.value.length !== b.value.length || a.value.length !== c.value.length) {
                console.error(`Fma() expects vectors of the same length. Line ${node.line}`);
                return null;
            }
            return new VectorData(a.value.map((v: number, i: number) => v * b.value[i] + c.value[i]), a.typeInfo);
        }
        const av = a as ScalarData;
        const bv = b as ScalarData;
        const cv = c as ScalarData;
        return new ScalarData(av.value * bv.value + cv.value, av.typeInfo);
    }

    Fract(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => v - Math.floor(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(s.value - Math.floor(s.value), value.typeInfo);
    }

    Frexp(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error(`TODO: frexp. Line ${node.line}`);
        return null;
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
            return new VectorData(value.value.map((v: number, i: number) => {
                return (v & invMask) | ((insert.value[i] << o) & mask);
            }), value.typeInfo);
        }
        const v = (value as ScalarData).value;
        const i = (insert as ScalarData).value;
        return new ScalarData((v & invMask) | ((i << o) & mask), value.typeInfo);
    }

    InverseSqrt(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => 1 / Math.sqrt(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(1 / Math.sqrt(s.value), value.typeInfo);
    }

    Ldexp(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error(`TODO: ldexp. Line ${node.line}`);
        return null;
    }

    Length(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            let sum = 0;
            value.value.forEach((v: number) => { sum += v * v; });
            return new ScalarData(Math.sqrt(sum), this.getTypeInfo("f32"));
        }
        const s = value as ScalarData;
        return new ScalarData(Math.abs(s.value), value.typeInfo);
    }

    Log(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => Math.log(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.log(s.value), value.typeInfo);
    }

    Log2(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => Math.log2(v)), value.typeInfo);
        }
        const s = value as ScalarData
        return new ScalarData(Math.log2(s.value), value.typeInfo);
    }

    Max(node: CallExpr | Call, context: ExecContext): Data | null {
        const l = this.exec.evalExpression(node.args[0], context);
        const r = this.exec.evalExpression(node.args[1], context);
        if (l instanceof VectorData && r instanceof VectorData) {
            return new VectorData(l.value.map((v: number, i: number) => Math.max(v, r.value[i])), l.typeInfo);
        }
        const ls = l as ScalarData;
        const rs = r as ScalarData;
        return new ScalarData(Math.max(ls.value, rs.value), l.typeInfo);
    }

    Min(node: CallExpr | Call, context: ExecContext): Data | null {
        const l = this.exec.evalExpression(node.args[0], context);
        const r = this.exec.evalExpression(node.args[1], context);
        if (l instanceof VectorData && r instanceof VectorData) {
            return new VectorData(l.value.map((v: number, i: number) => Math.min(v, r.value[i])), l.typeInfo);
        }
        const ls = l as ScalarData;
        const rs = r as ScalarData;
        return new ScalarData(Math.min(ls.value, rs.value), l.typeInfo);
    }

    Mix(node: CallExpr | Call, context: ExecContext): Data | null {
        const x = this.exec.evalExpression(node.args[0], context);
        const y = this.exec.evalExpression(node.args[1], context);
        const a = this.exec.evalExpression(node.args[2], context);
        if (x instanceof VectorData && y instanceof VectorData && a instanceof VectorData) {
            return new VectorData(x.value.map((v: number, i: number) => x.value[i] * (1 - a.value[i]) + y.value[i] * a.value[i]), x.typeInfo);
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
            return new VectorData(x.value.map((v: number, i: number) => v % y.value[i]), x.typeInfo);
        }
        const xs = x as ScalarData;
        const ys = y as ScalarData;
        return new ScalarData(xs.value % ys.value, x.typeInfo);
    }

    Normalize(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            const length = (this.Length(node, context) as ScalarData).value;
            return new VectorData(value.value.map((v: number) => v / length), value.typeInfo);
        }
        console.error(`Normalize() expects a vector argument. Line ${node.line}`);
        return null;
    }

    Pow(node: CallExpr | Call, context: ExecContext): Data | null {
        const x = this.exec.evalExpression(node.args[0], context);
        const y = this.exec.evalExpression(node.args[1], context);
        if (x instanceof VectorData && y instanceof VectorData) {
            return new VectorData(x.value.map((v: number, i: number) => Math.pow(v, y.value[i])), x.typeInfo);
        }
        const xs = x as ScalarData;
        const ys = y as ScalarData;
        return new ScalarData(Math.pow(xs.value, ys.value), x.typeInfo);
    }

    QuantizeToF16(node: CallExpr | Call, context: ExecContext): Data | null {
        // TODO: actually quantize the f32 to f16
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => v), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(s.value, value.typeInfo);
    }

    Radians(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => v * Math.PI / 180), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(s.value * Math.PI / 180, value.typeInfo);
    }

    Reflect(node: CallExpr | Call, context: ExecContext): Data | null {
        // e1 - 2 * dot(e2, e1) * e2
        let e1 = this.exec.evalExpression(node.args[0], context);
        let e2 = this.exec.evalExpression(node.args[1], context);
        if (e1 instanceof VectorData && e2 instanceof VectorData) {
            const dot = this._dot(e1.value, e2.value);
            return new VectorData(e1.value.map((v: number, i: number) => v - 2 * dot * e2.value[i]), e1.typeInfo);
        }
        console.error(`Reflect() expects vector arguments. Line ${node.line}`);
        return null;
    }

    Refract(node: CallExpr | Call, context: ExecContext): Data | null {
        let e1 = this.exec.evalExpression(node.args[0], context);
        let e2 = this.exec.evalExpression(node.args[1], context);
        let e3 = this.exec.evalExpression(node.args[2], context);
        if (e1 instanceof VectorData && e2 instanceof VectorData && e3 instanceof ScalarData) {
            const dot = this._dot(e2.value, e1.value);
            return new VectorData(e1.value.map((v: number, i: number) => {
                const k = 1.0 - e3.value * e3.value * (1.0 - dot * dot);
                if (k < 0) {
                    return 0;
                }
                const sqrtK = Math.sqrt(k);
                return e3.value * v - (e3.value * dot + sqrtK) * e2.value[i];
            }), e1.typeInfo);
        }

        console.error(`Refract() expects vector arguments and a scalar argument. Line ${node.line}`);
        return null;
    }

    ReverseBits(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error(`TODO: reverseBits. Line ${node.line}`);
        return null;
    }

    Round(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => Math.round(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.round(s.value), value.typeInfo);
    }

    Saturate(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => Math.min(Math.max(v, 0), 1)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.min(Math.max(s.value, 0), 1), value.typeInfo);
    }

    Sign(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => Math.sign(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.sign(s.value), value.typeInfo);
    }

    Sin(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => Math.sin(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.sin(s.value), value.typeInfo);
    }

    Sinh(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => Math.sinh(v)), value.typeInfo);
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
            return new VectorData(x.value.map((v: number, i: number) => this._smoothstep(edge0.value[i], edge1.value[i], v)), x.typeInfo);
        }
        const e0 = edge0 as ScalarData;
        const e1 = edge1 as ScalarData;
        const xS = x as ScalarData;
        return new ScalarData(this._smoothstep(e0.value, e1.value, xS.value), x.typeInfo);
    }

    Sqrt(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => Math.sqrt(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.sqrt(s.value), value.typeInfo);
    }

    Step(node: CallExpr | Call, context: ExecContext): Data | null {
        const edge = this.exec.evalExpression(node.args[0], context);
        const x = this.exec.evalExpression(node.args[1], context);
        if (x instanceof VectorData && edge instanceof VectorData) {
            return new VectorData(x.value.map((v: number, i: number) => v < edge.value[i] ? 0 : 1), x.typeInfo);
        }
        const e = edge as ScalarData;
        const s = x as ScalarData;
        return new ScalarData(s.value < e.value ? 0 : 1, e.typeInfo);
    }

    Tan(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => Math.tan(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.tan(s.value), value.typeInfo);
    }

    Tanh(node: CallExpr | Call, context: ExecContext): Data | null {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v: number) => Math.tanh(v)), value.typeInfo);
        }
        const s = value as ScalarData;
        return new ScalarData(Math.tanh(s.value), value.typeInfo);
    }

    _getTransposeType(t: TypeInfo): TypeInfo {
        const tname = this.exec.getTypeName(t);
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
            const mv = m.value;
            return new MatrixData([mv[0], mv[2], mv[1], mv[3]], ttype);
        } else if (m.typeInfo.name === "mat2x3" || m.typeInfo.name === "mat2x3f" || m.typeInfo.name === "mat2x3h") {
            const mv = m.value;
            return new MatrixData([mv[0], mv[3], mv[6], mv[1], mv[4], mv[7]], ttype);
        } else if (m.typeInfo.name === "mat2x4" || m.typeInfo.name === "mat2x4f" || m.typeInfo.name === "mat2x4h") {
            const mv = m.value;
            return new MatrixData([mv[0], mv[4], mv[8], mv[12], mv[1], mv[5], mv[9], mv[13]], ttype);
        } else if (m.typeInfo.name === "mat3x2" || m.typeInfo.name === "mat3x2f" || m.typeInfo.name === "mat3x2h") {
            const mv = m.value;
            return new MatrixData([mv[0], mv[3], mv[1], mv[4], mv[2], mv[5]], ttype);
        } else if (m.typeInfo.name === "mat3x3" || m.typeInfo.name === "mat3x3f" || m.typeInfo.name === "mat3x3h") {
            const mv = m.value;
            return new MatrixData([mv[0], mv[3], mv[6], mv[1], mv[4], mv[7], mv[2], mv[5], mv[8]], ttype);
        } else if (m.typeInfo.name === "mat3x4" || m.typeInfo.name === "mat3x4f" || m.typeInfo.name === "mat3x4h") {
            const mv = m.value;
            return new MatrixData([mv[0], mv[4], mv[8], mv[12], mv[1], mv[5], mv[9], mv[13], mv[2], mv[6], mv[10], mv[14]], ttype);
        } else if (m.typeInfo.name === "mat4x2" || m.typeInfo.name === "mat4x2f" || m.typeInfo.name === "mat4x2h") {
            const mv = m.value;
            return new MatrixData([mv[0], mv[4], mv[1], mv[5], mv[2], mv[6]], ttype);
        } else if (m.typeInfo.name === "mat4x3" || m.typeInfo.name === "mat4x3f" || m.typeInfo.name === "mat4x3h") {
            const mv = m.value;
            return new MatrixData([mv[0], mv[4], mv[8], mv[1], mv[5], mv[9], mv[2], mv[6], mv[10]], ttype);
        } else if (m.typeInfo.name === "mat4x4" || m.typeInfo.name === "mat4x4f" || m.typeInfo.name === "mat4x4h") {
            const mv = m.value;
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
            return new VectorData(value.value.map((v: number) => Math.trunc(v)), value.typeInfo);
        }
        const s = value as ScalarData
        return new ScalarData(Math.trunc(s.value), value.typeInfo);
    }

    // Derivative Built-in Functions
    Dpdx(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error(`TODO: dpdx. Line ${node.line}`);
        return null;
    }

    DpdxCoarse(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error(`TODO: dpdxCoarse. Line ${node.line}`);
        return null;
    }

    DpdxFine(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: dpdxFine");
        return null;
    }

    Dpdy(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: dpdy");
        return null;
    }

    DpdyCoarse(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: dpdyCoarse");
        return null;
    }

    DpdyFine(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: dpdyFine");
        return null;
    }

    Fwidth(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: fwidth");
        return null;
    }

    FwidthCoarse(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: fwidthCoarse");
        return null;
    }

    FwidthFine(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: fwidthFine");
        return null;
    }

    // Texture Built-in Functions
    TextureDimensions(node: CallExpr | Call, context: ExecContext): Data | null {
        const textureArg = node.args[0];
        const level = node.args.length > 1 ? (this.exec.evalExpression(node.args[1], context) as ScalarData).value : 0;
        if (level > 0) {
            console.error(`TODO: Mip levels. Line ${node.line}`);
            return null;
        }

        if (textureArg instanceof VariableExpr) {
            const textureName = (textureArg as VariableExpr).name;
            const texture = context.getVariableValue(textureName);
            if (texture instanceof TypedData) {
                return new VectorData(texture.textureSize, this.getTypeInfo("vec2u"));
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
        const textureArg = node.args[0];
        const uv = this.exec.evalExpression(node.args[1], context);
        const level = node.args.length > 2 ? (this.exec.evalExpression(node.args[2], context) as ScalarData).value : 0;
        if (level > 0) {
            console.error(`TODO: Mip levels. Line ${node.line}`);
            return null;
        }

        // TODO: non-vec2 UVs, for non-2D textures
        if (!(uv instanceof VectorData) || uv.value.length !== 2) {
            console.error(`Invalid UV argument for textureLoad. Line ${node.line}`);
            return null;
        }

        if (textureArg instanceof VariableExpr) {
            const textureName = (textureArg as VariableExpr).name;
            const texture = context.getVariableValue(textureName);
            if (texture instanceof TypedData) {
                const textureSize = texture.textureSize;
                const x = Math.floor(uv.value[0]);
                const y = Math.floor(uv.value[1]);
                if (x < 0 || x >= textureSize[0] || y < 0 || y >= textureSize[1]) {
                    console.error(`Texture ${textureName} out of bounds. Line ${node.line}`);
                    return null;
                }
                // TODO non RGBA8 textures
                const offset = (y * textureSize[0] + x) * 4; 
                const texel = new Uint8Array(texture.buffer, offset, 4);
                // TODO: non-f32 textures
                return new VectorData([texel[0] / 255, texel[1] / 255, texel[2] / 255, texel[3] / 255], this.getTypeInfo("vec4f"));
            } else {
                console.error(`Texture ${textureName} not found. Line ${node.line}`);
                return null;
            }
        }

        console.error(`Invalid texture argument for textureLoad. Line ${node.line}`);
        return null;
    }

    TextureNumLayers(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: textureNumLayers");
        return null;
    }

    TextureNumLevels(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: textureNumLevels");
        return null;
    }

    TextureNumSamples(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: textureNumSamples");
        return null;
    }

    TextureSample(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: textureSample");
        return null;
    }

    TextureSampleBias(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: textureSampleBias");
        return null;
    }

    TextureSampleCompare(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: textureSampleCompare");
        return null;
    }

    TextureSampleCompareLevel(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: textureSampleCompareLevel");
        return null;
    }

    TextureSampleGrad(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: textureSampleGrad");
        return null;
    }

    TextureSampleLevel(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: textureSampleLevel");
        return null;
    }

    TextureSampleBaseClampToEdge(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: textureSampleBaseClampToEdge");
        return null;
    }

    TextureStore(node: CallExpr | Call, context: ExecContext): Data | null {
        const textureArg = node.args[0];
        const uv = this.exec.evalExpression(node.args[1], context);
        const value = (this.exec.evalExpression(node.args[2], context) as VectorData).value;
        if (value.length !== 4) {
            console.error(`Invalid value argument for textureStore. Line ${node.line}`);
            return null;
        }

        // TODO: non-vec2 UVs, for non-2D textures
        if (!(uv instanceof VectorData) || uv.value.length !== 2) {
            console.error(`Invalid UV argument for textureStore. Line ${node.line}`);
            return null;
        }

        if (textureArg instanceof VariableExpr) {
            const textureName = (textureArg as VariableExpr).name;
            const texture = context.getVariableValue(textureName);
            if (texture instanceof TypedData) {
                const textureSize = texture.textureSize;
                const x = Math.floor(uv.value[0]);
                const y = Math.floor(uv.value[1]);
                if (x < 0 || x >= textureSize[0] || y < 0 || y >= textureSize[1]) {
                    console.error(`Texture ${textureName} out of bounds. Line ${node.line}`);
                    return null;
                }
                // TODO non RGBA8 textures
                const offset = (y * textureSize[0] + x) * 4; 
                const texel = new Uint8Array(texture.buffer, offset, 4);

                // TODO: non-f32 textures
                texel[0] = value[0] * 255;
                texel[1] = value[1] * 255;
                texel[2] = value[2] * 255;
                texel[3] = value[3] * 255;

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
            // TODO: handle & operator
            l = l.right;
        }

        const name = this.exec.getVariableName(l, context);
        const v = context.getVariable(name);

        const currentValue = v.value.getDataValue(this.exec, l.postfix, context);
        return currentValue;
    }

    AtomicStore(node: CallExpr | Call, context: ExecContext): Data | null {
        let l = node.args[0];
        if (l instanceof UnaryOperator) {
            // TODO: handle & operator
            l = l.right;
        }

        const name = this.exec.getVariableName(l, context);
        const v = context.getVariable(name);

        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);

        const currentValue = v.value.getDataValue(this.exec, l.postfix, context);

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
            // TODO: handle & operator
            l = l.right;
        }

        const name = this.exec.getVariableName(l, context);
        const v = context.getVariable(name);

        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);

        const currentValue = v.value.getDataValue(this.exec, l.postfix, context);

        if (currentValue instanceof ScalarData && value instanceof ScalarData) {
            currentValue.value += value.value;
        }

        if (v.value instanceof TypedData) {
            v.value.setDataValue(this.exec, currentValue, l.postfix, context);
        }

        return null;
    }

    AtomicSub(node: CallExpr | Call, context: ExecContext): Data | null {
        let l = node.args[0];
        if (l instanceof UnaryOperator) {
            // TODO: handle & operator
            l = l.right;
        }

        const name = this.exec.getVariableName(l, context);
        const v = context.getVariable(name);

        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);

        const currentValue = v.value.getDataValue(this.exec, l.postfix, context);

        if (currentValue instanceof ScalarData && value instanceof ScalarData) {
            currentValue.value -= value.value;
        }

        if (v.value instanceof TypedData) {
            v.value.setDataValue(this.exec, currentValue, l.postfix, context);
        }

        return null;
    }

    AtomicMax(node: CallExpr | Call, context: ExecContext): Data | null {
        let l = node.args[0];
        if (l instanceof UnaryOperator) {
            // TODO: handle & operator
            l = l.right;
        }

        const name = this.exec.getVariableName(l, context);
        const v = context.getVariable(name);

        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);

        const currentValue = v.value.getDataValue(this.exec, l.postfix, context);

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
            // TODO: handle & operator
            l = l.right;
        }

        const name = this.exec.getVariableName(l, context);
        const v = context.getVariable(name);

        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);

        const currentValue = v.value.getDataValue(this.exec, l.postfix, context);

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
            // TODO: handle & operator
            l = l.right;
        }

        const name = this.exec.getVariableName(l, context);
        const v = context.getVariable(name);

        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);

        const currentValue = v.value.getDataValue(this.exec, l.postfix, context);

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
            // TODO: handle & operator
            l = l.right;
        }

        const name = this.exec.getVariableName(l, context);
        const v = context.getVariable(name);

        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);

        const currentValue = v.value.getDataValue(this.exec, l.postfix, context);

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
            // TODO: handle & operator
            l = l.right;
        }

        const name = this.exec.getVariableName(l, context);
        const v = context.getVariable(name);

        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);

        const currentValue = v.value.getDataValue(this.exec, l.postfix, context);

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
            // TODO: handle & operator
            l = l.right;
        }

        const name = this.exec.getVariableName(l, context);
        const v = context.getVariable(name);

        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);

        const currentValue = v.value.getDataValue(this.exec, l.postfix, context);

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
        console.error("TODO: atomicCompareExchangeWeak");
        return null;
    }

    // Data Packing Built-in Functions
    Pack4x8snorm(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: pack4x8snorm");
        return null;
    }

    Pack4x8unorm(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: pack4x8unorm");
        return null;
    }

    Pack4xI8(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: pack4xI8");
        return null;
    }

    Pack4xU8(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: pack4xU8");
        return null;
    }

    Pack4x8Clamp(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: pack4x8Clamp");
        return null;
    }

    Pack4xU8Clamp(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: pack4xU8Clamp");
        return null;
    }

    Pack2x16snorm(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: pack2x16snorm");
        return null;
    }

    Pack2x16unorm(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: pack2x16unorm");
        return null;
    }

    Pack2x16float(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: pack2x16float");
        return null;
    }

    // Data Unpacking Built-in Functions
    Unpack4x8snorm(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: unpack4x8snorm");
        return null;
    }

    Unpack4x8unorm(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: unpack4x8unorm");
        return null;
    }

    Unpack4xI8(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: unpack4xI8");
        return null;
    }

    Unpack4xU8(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: unpack4xU8");
        return null;
    }

    Unpack2x16snorm(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: unpack2x16snorm");
        return null;
    }

    Unpack2x16unorm(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: unpack2x16unorm");
        return null;
    }

    Unpack2x16float(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: unpack2x16float");
        return null;
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
    SubgroupAdd(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: subgroupAdd");
        return null;
    }

    SubgroupExclusiveAdd(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: subgroupExclusiveAdd");
        return null;
    }

    SubgroupInclusiveAdd(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: subgroupInclusiveAdd");
        return null;
    }

    SubgroupAll(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: subgroupAll");
        return null;
    }

    SubgroupAnd(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: subgroupAnd");
        return null;
    }

    SubgroupAny(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: subgroupAny");
        return null;
    }

    SubgroupBallot(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: subgroupBallot");
        return null;
    }

    SubgroupBroadcast(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: subgroupBroadcast");
        return null;
    }

    SubgroupBroadcastFirst(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: subgroupBroadcastFirst");
        return null;
    }

    SubgroupElect(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: subgroupElect");
        return null;
    }

    SubgroupMax(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: subgroupMax");
        return null;
    }

    SubgroupMin(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: subgroupMin");
        return null;
    }

    SubgroupMul(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: subgroupMul");
        return null;
    }

    SubgroupExclusiveMul(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: subgroupExclusiveMul");
        return null;
    }

    SubgroupInclusiveMul(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: subgroupInclusiveMul");
        return null;
    }

    SubgroupOr(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: subgroupOr");
        return null;
    }

    SubgroupShuffle(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: subgroupShuffle");
        return null;
    }

    SubgroupShuffleDown(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: subgroupShuffleDown");
        return null;
    }

    SubgroupShuffleUp(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: subgroupShuffleUp");
        return null;
    }

    SubgroupShuffleXor(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: subgroupShuffleXor");
        return null;
    }

    SubgroupXor(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: subgroupXor");
        return null;
    }

    // Quad Functions
    QuadBroadcast(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: quadBroadcast");
        return null;
    }

    QuadSwapDiagonal(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: quadSwapDiagonal");
        return null;
    }

    QuadSwapX(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: quadSwapX");
        return null;
    }

    QuadSwapY(node: CallExpr | Call, context: ExecContext): Data | null {
        console.error("TODO: quadSwapY");
        return null;
    }
}
