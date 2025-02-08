import * as AST from "../wgsl_ast.js";
import { TypedData } from "./data.js";
import { ExecContext } from "./exec_context.js";
import { ExecInterface } from "./exec_interface.js";

export class BuiltinFunctions {
    exec: ExecInterface;

    constructor(exec: ExecInterface) {
        this.exec = exec;
    }

    // Logical Built-in Functions
    All(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        let isTrue = true;
        value.forEach((x: any) => { if (!x) isTrue = false; });
        return isTrue;
    }

    Any(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        return value.some((v: any) => v);
    }

    Select(node: AST.CallExpr, context: ExecContext) {
        const condition = this.exec._evalExpression(node.args[2], context);
        if (condition) {
            return this.exec._evalExpression(node.args[0], context);
        } else {
            return this.exec._evalExpression(node.args[1], context);
        }
    }

    // Array Built-in Functions
    ArrayLength(node: AST.CallExpr, context: ExecContext) {
        let arrayArg = node.args[0];
        // TODO: handle "&" operator
        if (arrayArg instanceof AST.UnaryOperator) {
            arrayArg = (arrayArg as AST.UnaryOperator).right;
        }
        const arrayData = this.exec._evalExpression(arrayArg, context);
        if (arrayData.typeInfo.size === 0) {
            const count = arrayData.buffer.byteLength / arrayData.typeInfo.stride;
            return count;
        }
        return arrayData.typeInfo.size;
    }

    // Numeric Built-in Functions
    Abs(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => Math.abs(v));
        }
        return Math.abs(value);
    }

    Acos(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => Math.acos(v));
        }
        return Math.acos(value);
    }

    Acosh(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => Math.acosh(v));
        }
        return Math.acosh(value);
    }

    Asin(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => Math.asin(v));
        }
        return Math.asin(value);
    }

    Asinh(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => Math.asinh(v));
        }
        return Math.asinh(value);
    }

    Atan(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => Math.atan(v));
        }
        return Math.atan(value);
    }

    Atanh(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => Math.atanh(v));
        }
        return Math.atanh(value);
    }

    Atan2(node: AST.CallExpr, context: ExecContext) {
        const y = this.exec._evalExpression(node.args[0], context);
        const x = this.exec._evalExpression(node.args[1], context);
        if (y.length !== undefined) {
            return y.map((v: number, i: number) => Math.atan2(v, x[i]));
        }
        return Math.atan2(y, x);
    }

    Ceil(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => Math.ceil(v));
        }
        return Math.ceil(value);
    }

    _clamp(value: number, min: number, max: number) {
        return Math.min(Math.max(value, min), max);
    }

    Clamp(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        const min = this.exec._evalExpression(node.args[1], context);
        const max = this.exec._evalExpression(node.args[2], context);
        if (value instanceof Array) {
            return value.map((v: number, i: number) => this._clamp(v, min[i], max[i]));
        }
        return this._clamp(value, min, max);
    }

    Cos(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => Math.cos(v));
        }
        return Math.cos(value);
    }

    Cosh(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => Math.cosh(v));
        }
        return Math.cosh(value);
    }

    CountLeadingZeros(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
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

    CountOneBits(node: AST.CallExpr, context: ExecContext) {
        let x = this.exec._evalExpression(node.args[0], context);
        if (x instanceof Array) {
            return x.map((v: number) => this._countOneBits(v));
        }
        return this._countOneBits(x);
    }

    _countTrailingZeros(value: number) {
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

    CountTrailingZeros(node: AST.CallExpr, context: ExecContext) {
        let x = this.exec._evalExpression(node.args[0], context);
        if (x instanceof Array) {
            return x.map((v: number) => this._countTrailingZeros(v));
        }
        this._countTrailingZeros(x);
    }

    Cross(node: AST.CallExpr, context: ExecContext) {
        const l = this.exec._evalExpression(node.args[0], context);
        const r = this.exec._evalExpression(node.args[1], context);
        return [
            l[1] * r[2] - r[1] * l[2],
            l[2] * r[0] - r[2] * l[0],
            l[0] * r[1] - r[0] * l[1],
        ];
    }

    Degrees(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        const radToDeg = 180.0 / Math.PI;
        if (value instanceof Array) {
            return value.map((v: number) => v * radToDeg);
        }
        return value * radToDeg;
    }

    Determinant(node: AST.CallExpr, context: ExecContext) {
        const m = this.exec._evalExpression(node.args[0], context);
        // TODO: get the dimensions of the matrix
        if (m.length === 4) {
            return m[0] * m[3] - m[1] * m[2];
        }
        console.error(`TODO: determinant for matrix. Line ${node.line}`);
        return null;
    }

    Distance(node: AST.CallExpr, context: ExecContext) {
        const l = this.exec._evalExpression(node.args[0], context);
        const r = this.exec._evalExpression(node.args[1], context);
        let sum = 0;
        for (let i = 0; i < l.length; ++i) {
            sum += (l[i] - r[i]) * (l[i] - r[i]);
        }
        return Math.sqrt(sum);
    }

    _dot(e1: number[], e2: number[]) {
        let dot = 0;
        for (let i = 0; i < e1.length; ++i) {
            dot += e2[i] * e1[i];
        }
        return dot;
    }

    Dot(node: AST.CallExpr, context: ExecContext) {
        const l = this.exec._evalExpression(node.args[0], context);
        const r = this.exec._evalExpression(node.args[1], context);
        return this._dot(l, r);
    }

    Dot4U8Packed(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: dot4U8Packed");
        return null;
    }

    Dot4I8Packed(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: dot4I8Packed");
        return null;
    }

    Exp(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => Math.exp(v));
        }
        return Math.exp(value);
    }

    Exp2(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => Math.pow(2, v));
        }
        return Math.pow(2, value);
    }

    ExtractBits(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        const offset = this.exec._evalExpression(node.args[1], context);
        const count = this.exec._evalExpression(node.args[2], context);
        return (value >> offset) & ((1 << count) - 1);
    }

    FaceForward(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: faceForward");
        return null;
    }

    FirstLeadingBit(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: firstLeadingBit");
        return null;
    }

    FirstTrailingBit(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: firstTrailingBit");
        return null;
    }

    Floor(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => Math.floor(v));
        }
        return Math.floor(value);
    }

    Fma(node: AST.CallExpr, context: ExecContext) {
        const a = this.exec._evalExpression(node.args[0], context);
        const b = this.exec._evalExpression(node.args[1], context);
        const c = this.exec._evalExpression(node.args[2], context);
        if (a.length !== undefined) {
            return a.map((v: number, i: number) => v * b[i] + c[i]);
        }
        return a * b + c;
    }

    Fract(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => v - Math.floor(v));
        }
        return value - Math.floor(value);
    }

    Frexp(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: frexp");
        return null;
    }

    InsertBits(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        const insert = this.exec._evalExpression(node.args[1], context);
        const offset = this.exec._evalExpression(node.args[2], context);
        const count = this.exec._evalExpression(node.args[3], context);
        const mask = ((1 << count) - 1) << offset;
        return (value & ~mask) | ((insert << offset) & mask);
    }

    InverseSqrt(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => 1 / Math.sqrt(v));
        }
        return 1 / Math.sqrt(value);
    }

    Ldexp(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: ldexp");
        return null;
    }

    Length(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        let sum = this._dot(value, value);
        return Math.sqrt(sum);
    }

    Log(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => Math.log(v));
        }
        return Math.log(value);
    }

    Log2(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => Math.log2(v));
        }
        return Math.log2(value);
    }

    Max(node: AST.CallExpr, context: ExecContext) {
        const l = this.exec._evalExpression(node.args[0], context);
        const r = this.exec._evalExpression(node.args[1], context);
        if (l instanceof Array) {
            return l.map((v: number, i: number) => Math.max(v, r[i]));
        }
        return Math.max(l, r);
    }

    Min(node: AST.CallExpr, context: ExecContext) {
        const l = this.exec._evalExpression(node.args[0], context);
        const r = this.exec._evalExpression(node.args[1], context);
        if (l instanceof Array) {
            return l.map((v: number, i: number) => Math.min(v, r[i]));
        }
        return Math.min(l, r);
    }

    Mix(node: AST.CallExpr, context: ExecContext) {
        const x = this.exec._evalExpression(node.args[0], context);
        const y = this.exec._evalExpression(node.args[1], context);
        const a = this.exec._evalExpression(node.args[2], context);
        if (x instanceof Array) {
            return x.map((v: number, i: number) => x[i] * (1 - a[i]) + y[i] * a[i]);
        }
        return x * (1 - a) + y * a;
    }

    Modf(node: AST.CallExpr, context: ExecContext) {
        const x = this.exec._evalExpression(node.args[0], context);
        const y = this.exec._evalExpression(node.args[1], context);
        if (x instanceof Array) {
            return x.map((v: number, i: number) => v % y[i]);
        }
        return x % y;
    }

    Normalize(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        const length = this.Length(node, context);
        return value.map((v: any) => v / length);
    }

    Pow(node: AST.CallExpr, context: ExecContext) {
        const x = this.exec._evalExpression(node.args[0], context);
        const y = this.exec._evalExpression(node.args[1], context);
        if (x instanceof Array) {
            return x.map((v: number, i: number) => Math.pow(v, y[i]));
        }
        return Math.pow(x, y);
    }

    QuantizeToF16(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: quantizeToF16");
        return null;
    }

    Radians(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => v * Math.PI / 180);
        }
        return value * Math.PI / 180;
    }

    Reflect(node: AST.CallExpr, context: ExecContext) {
        // e1 - 2 * dot(e2, e1) * e2
        let e1 = this.exec._evalExpression(node.args[0], context);
        let e2 = this.exec._evalExpression(node.args[1], context);
        let dot = this._dot(e1, e2);
        return e1.map((v: number, i: number) => v - 2 * dot * e2[i]);
    }

    Refract(node: AST.CallExpr, context: ExecContext) {
        let e1 = this.exec._evalExpression(node.args[0], context);
        let e2 = this.exec._evalExpression(node.args[1], context);
        let e3 = this.exec._evalExpression(node.args[2], context);
        let dot = this.Dot(e2, e1);
        const k = 1.0 - e3 * e3 * (1.0 - dot * dot);
        if (k < 0) {
            return e1.map((v: number) => 0);
        }
        const sqrtK = Math.sqrt(k);
        return e1.map((v: number, i: number) => e3 * v - (e3 * dot + sqrtK) * e2[i]);
    }

    ReverseBits(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: reverseBits");
        return null;
    }

    Round(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => Math.round(v));
        }
        return Math.round(value);
    }

    Saturate(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => Math.min(Math.max(v, 0), 1));
        }
        return Math.min(Math.max(value, 0), 1);
    }

    Sign(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => Math.sign(v));
        }
        return Math.sign(value);
    }

    Sin(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => Math.sin(v));
        }
        return Math.sin(value);
    }

    Sinh(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => Math.sinh(v));
        }
        return Math.sinh(value);
    }

    _smoothstep(edge0: number, edge1: number, x: number) {
        const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
        return t * t * (3 - 2 * t);
    }

    SmoothStep(node: AST.CallExpr, context: ExecContext) {
        const edge0 = this.exec._evalExpression(node.args[0], context);
        const edge1 = this.exec._evalExpression(node.args[1], context);
        const x = this.exec._evalExpression(node.args[2], context);
        if (x instanceof Array) {
            return x.map((v: number, i: number) => this._smoothstep(edge0[i], edge1[i], v));
        }
        return this._smoothstep(edge0, edge1, x);
    }

    Sqrt(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => Math.sqrt(v));
        }
        return Math.sqrt(value);
    }

    Step(node: AST.CallExpr, context: ExecContext) {
        const edge = this.exec._evalExpression(node.args[0], context);
        const x = this.exec._evalExpression(node.args[1], context);
        if (x instanceof Array) {
            return x.map((v: number, i: number) => v < edge[i] ? 0 : 1);
        }
        return x < edge ? 0 : 1;
    }

    Tan(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => Math.tan(v));
        }
        return Math.tan(value);
    }

    Tanh(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => Math.tanh(v));
        }
        return Math.tanh(value);
    }

    Transpose(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: transpose");
        return null;
    }

    Trunc(node: AST.CallExpr, context: ExecContext) {
        const value = this.exec._evalExpression(node.args[0], context);
        if (value instanceof Array) {
            return value.map((v: number) => Math.trunc(v));
        }
        return Math.trunc(value);
    }

    // Derivative Built-in Functions
    Dpdx(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: dpdx");
        return null;
    }

    DpdxCoarse(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: dpdxCoarse");
        return null;
    }

    DpdxFine(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: dpdxFine");
        return null;
    }

    Dpdy(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: dpdy");
        return null;
    }

    DpdyCoarse(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: dpdyCoarse");
        return null;
    }

    DpdyFine(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: dpdyFine");
        return null;
    }

    Fwidth(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: fwidth");
        return null;
    }

    FwidthCoarse(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: fwidthCoarse");
        return null;
    }

    FwidthFine(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: fwidthFine");
        return null;
    }

    // Texture Built-in Functions
    TextureDimensions(node: AST.CallExpr, context: ExecContext) {
        const textureArg = node.args[0];
        const level = node.args.length > 1 ? this.exec._evalExpression(node.args[1], context) : 0;
        if (textureArg instanceof AST.VariableExpr) {
            const textureName = (textureArg as AST.VariableExpr).name;
            const texture = context.getVariableValue(textureName);
            if (texture instanceof TypedData) {
                return texture.textureSize;
            } else {
                console.error(`Texture ${textureName} not found. Line ${node.line}`);
                return null;
            }
        }
        console.error(`Invalid texture argument for textureDimensions. Line ${node.line}`);
        return null;
    }

    TextureGather(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureGather");
        return null;
    }

    TextureGatherCompare(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureGatherCompare");
        return null;
    }

    TextureLoad(node: AST.CallExpr, context: ExecContext) {
        const textureArg = node.args[0];
        const uv = this.exec._evalExpression(node.args[1], context);
        const level = node.args.length > 2 ? this.exec._evalExpression(node.args[2], context) : 0;
        if (textureArg instanceof AST.VariableExpr) {
            const textureName = (textureArg as AST.VariableExpr).name;
            const texture = context.getVariableValue(textureName);
            if (texture instanceof TypedData) {
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

    TextureNumLayers(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureNumLayers");
        return null;
    }

    TextureNumLevels(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureNumLevels");
        return null;
    }

    TextureNumSamples(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureNumSamples");
        return null;
    }

    TextureSample(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureSample");
        return null;
    }

    TextureSampleBias(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureSampleBias");
        return null;
    }

    TextureSampleCompare(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureSampleCompare");
        return null;
    }

    TextureSampleCompareLevel(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureSampleCompareLevel");
        return null;
    }

    TextureSampleGrad(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureSampleGrad");
        return null;
    }

    TextureSampleLevel(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureSampleLevel");
        return null;
    }

    TextureSampleBaseClampToEdge(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureSampleBaseClampToEdge");
        return null;
    }

    TextureStore(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: textureStore");
        return null;
    }

    // Atomic Built-in Functions
    AtomicLoad(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: atomicLoad");
        return null;
    }

    AtomicStore(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: atomicStore");
        return null;
    }

    AtomicAdd(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: atomicAdd");
        return null;
    }

    AtomicSub(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: atomicSub");
        return null;
    }

    AtomicMax(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: atomicMax");
        return null;
    }

    AtomicMin(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: atomicMin");
        return null;
    }

    AtomicAnd(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: atomicAnd");
        return null;
    }

    AtomicOr(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: atomicOr");
        return null;
    }

    AtomicXor(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: atomicXor");
        return null;
    }

    AtomicExchange(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: atomicExchange");
        return null;
    }

    AtomicCompareExchangeWeak(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: atomicCompareExchangeWeak");
        return null;
    }

    // Data Packing Built-in Functions
    Pack4x8snorm(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: pack4x8snorm");
        return null;
    }

    Pack4x8unorm(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: pack4x8unorm");
        return null;
    }

    Pack4xI8(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: pack4xI8");
        return null;
    }

    Pack4xU8(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: pack4xU8");
        return null;
    }

    Pack4x8Clamp(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: pack4x8Clamp");
        return null;
    }

    Pack4xU8Clamp(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: pack4xU8Clamp");
        return null;
    }

    Pack2x16snorm(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: pack2x16snorm");
        return null;
    }

    Pack2x16unorm(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: pack2x16unorm");
        return null;
    }

    Pack2x16float(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: pack2x16float");
        return null;
    }

    // Data Unpacking Built-in Functions
    Unpack4x8snorm(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: unpack4x8snorm");
        return null;
    }

    Unpack4x8unorm(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: unpack4x8unorm");
        return null;
    }

    Unpack4xI8(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: unpack4xI8");
        return null;
    }

    Unpack4xU8(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: unpack4xU8");
        return null;
    }

    Unpack2x16snorm(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: unpack2x16snorm");
        return null;
    }

    Unpack2x16unorm(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: unpack2x16unorm");
        return null;
    }

    Unpack2x16float(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: unpack2x16float");
        return null;
    }

    // Synchronization Functions
    StorageBarrier(node: AST.CallExpr, context: ExecContext) {
        // Execution is single threaded, barriers not necessary.
        return null;
    }

    TextureBarrier(node: AST.CallExpr, context: ExecContext) {
        // Execution is single threaded, barriers not necessary.
        return null;
    }

    WorkgroupBarrier(node: AST.CallExpr, context: ExecContext) {
        // Execution is single threaded, barriers not necessary.
        return null;
    }

    WorkgroupUniformLoad(node: AST.CallExpr, context: ExecContext) {
        // Execution is single threaded, barriers not necessary.
        return null;
    }

    // Subgroup Functions
    SubgroupAdd(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupAdd");
        return null;
    }

    SubgroupExclusiveAdd(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupExclusiveAdd");
        return null;
    }

    SubgroupInclusiveAdd(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupInclusiveAdd");
        return null;
    }

    SubgroupAll(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupAll");
        return null;
    }

    SubgroupAnd(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupAnd");
        return null;
    }

    SubgroupAny(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupAny");
        return null;
    }

    SubgroupBallot(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupBallot");
        return null;
    }

    SubgroupBroadcast(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupBroadcast");
        return null;
    }

    SubgroupBroadcastFirst(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupBroadcastFirst");
        return null;
    }

    SubgroupElect(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupElect");
        return null;
    }

    SubgroupMax(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupMax");
        return null;
    }

    SubgroupMin(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupMin");
        return null;
    }

    SubgroupMul(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupMul");
        return null;
    }

    SubgroupExclusiveMul(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupExclusiveMul");
        return null;
    }

    SubgroupInclusiveMul(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupInclusiveMul");
        return null;
    }

    SubgroupOr(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupOr");
        return null;
    }

    SubgroupShuffle(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupShuffle");
        return null;
    }

    SubgroupShuffleDown(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupShuffleDown");
        return null;
    }

    SubgroupShuffleUp(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupShuffleUp");
        return null;
    }

    SubgroupShuffleXor(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupShuffleXor");
        return null;
    }

    SubgroupXor(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: subgroupXor");
        return null;
    }

    // Quad Functions
    QuadBroadcast(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: quadBroadcast");
        return null;
    }

    QuadSwapDiagonal(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: quadSwapDiagonal");
        return null;
    }

    QuadSwapX(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: quadSwapX");
        return null;
    }

    QuadSwapY(node: AST.CallExpr, context: ExecContext) {
        console.error("TODO: quadSwapY");
        return null;
    }
}
