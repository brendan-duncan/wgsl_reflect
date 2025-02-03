import * as AST from "../wgsl_ast.js";
import { ExecContext } from "./exec_context.js";
import { ExecInterface } from "./exec_interface.js";
export declare class BuiltinFunctions {
    exec: ExecInterface;
    constructor(exec: ExecInterface);
    All(node: AST.CallExpr, context: ExecContext): boolean;
    Any(node: AST.CallExpr, context: ExecContext): any;
    Select(node: AST.CallExpr, context: ExecContext): any;
    ArrayLength(node: AST.CallExpr, context: ExecContext): any;
    Abs(node: AST.CallExpr, context: ExecContext): number | number[];
    Acos(node: AST.CallExpr, context: ExecContext): number | number[];
    Acosh(node: AST.CallExpr, context: ExecContext): number | number[];
    Asin(node: AST.CallExpr, context: ExecContext): number | number[];
    Asinh(node: AST.CallExpr, context: ExecContext): number | number[];
    Atan(node: AST.CallExpr, context: ExecContext): number | number[];
    Atanh(node: AST.CallExpr, context: ExecContext): number | number[];
    Atan2(node: AST.CallExpr, context: ExecContext): any;
    Ceil(node: AST.CallExpr, context: ExecContext): number | number[];
    _clamp(value: number, min: number, max: number): number;
    Clamp(node: AST.CallExpr, context: ExecContext): number | number[];
    Cos(node: AST.CallExpr, context: ExecContext): number | number[];
    Cosh(node: AST.CallExpr, context: ExecContext): number | number[];
    CountLeadingZeros(node: AST.CallExpr, context: ExecContext): number | number[];
    _countOneBits(value: number): number;
    CountOneBits(node: AST.CallExpr, context: ExecContext): number | number[];
    _countTrailingZeros(value: number): number;
    CountTrailingZeros(node: AST.CallExpr, context: ExecContext): number[];
    Cross(node: AST.CallExpr, context: ExecContext): number[];
    Degrees(node: AST.CallExpr, context: ExecContext): number | number[];
    Determinant(node: AST.CallExpr, context: ExecContext): number;
    Distance(node: AST.CallExpr, context: ExecContext): number;
    _dot(e1: number[], e2: number[]): number;
    Dot(node: AST.CallExpr, context: ExecContext): number;
    Dot4U8Packed(node: AST.CallExpr, context: ExecContext): any;
    Dot4I8Packed(node: AST.CallExpr, context: ExecContext): any;
    Exp(node: AST.CallExpr, context: ExecContext): number | number[];
    Exp2(node: AST.CallExpr, context: ExecContext): number | number[];
    ExtractBits(node: AST.CallExpr, context: ExecContext): number;
    FaceForward(node: AST.CallExpr, context: ExecContext): any;
    FirstLeadingBit(node: AST.CallExpr, context: ExecContext): any;
    FirstTrailingBit(node: AST.CallExpr, context: ExecContext): any;
    Floor(node: AST.CallExpr, context: ExecContext): number | number[];
    Fma(node: AST.CallExpr, context: ExecContext): any;
    Fract(node: AST.CallExpr, context: ExecContext): number | number[];
    Frexp(node: AST.CallExpr, context: ExecContext): any;
    InsertBits(node: AST.CallExpr, context: ExecContext): number;
    InverseSqrt(node: AST.CallExpr, context: ExecContext): number | number[];
    Ldexp(node: AST.CallExpr, context: ExecContext): any;
    Length(node: AST.CallExpr, context: ExecContext): number;
    Log(node: AST.CallExpr, context: ExecContext): number | number[];
    Log2(node: AST.CallExpr, context: ExecContext): number | number[];
    Max(node: AST.CallExpr, context: ExecContext): number | number[];
    Min(node: AST.CallExpr, context: ExecContext): number | number[];
    Mix(node: AST.CallExpr, context: ExecContext): number | number[];
    Modf(node: AST.CallExpr, context: ExecContext): number | number[];
    Normalize(node: AST.CallExpr, context: ExecContext): any;
    Pow(node: AST.CallExpr, context: ExecContext): number | number[];
    QuantizeToF16(node: AST.CallExpr, context: ExecContext): any;
    Radians(node: AST.CallExpr, context: ExecContext): number | number[];
    Reflect(node: AST.CallExpr, context: ExecContext): any;
    Refract(node: AST.CallExpr, context: ExecContext): any;
    ReverseBits(node: AST.CallExpr, context: ExecContext): any;
    Round(node: AST.CallExpr, context: ExecContext): number | number[];
    Saturate(node: AST.CallExpr, context: ExecContext): number | number[];
    Sign(node: AST.CallExpr, context: ExecContext): number | number[];
    Sin(node: AST.CallExpr, context: ExecContext): number | number[];
    Sinh(node: AST.CallExpr, context: ExecContext): number | number[];
    _smoothstep(edge0: number, edge1: number, x: number): number;
    SmoothStep(node: AST.CallExpr, context: ExecContext): number | number[];
    Sqrt(node: AST.CallExpr, context: ExecContext): number | number[];
    Step(node: AST.CallExpr, context: ExecContext): 0 | 1 | (0 | 1)[];
    Tan(node: AST.CallExpr, context: ExecContext): number | number[];
    Tanh(node: AST.CallExpr, context: ExecContext): number | number[];
    Transpose(node: AST.CallExpr, context: ExecContext): any;
    Trunc(node: AST.CallExpr, context: ExecContext): number | number[];
    Dpdx(node: AST.CallExpr, context: ExecContext): any;
    DpdxCoarse(node: AST.CallExpr, context: ExecContext): any;
    DpdxFine(node: AST.CallExpr, context: ExecContext): any;
    Dpdy(node: AST.CallExpr, context: ExecContext): any;
    DpdyCoarse(node: AST.CallExpr, context: ExecContext): any;
    DpdyFine(node: AST.CallExpr, context: ExecContext): any;
    Fwidth(node: AST.CallExpr, context: ExecContext): any;
    FwidthCoarse(node: AST.CallExpr, context: ExecContext): any;
    FwidthFine(node: AST.CallExpr, context: ExecContext): any;
    TextureDimensions(node: AST.CallExpr, context: ExecContext): number[];
    TextureGather(node: AST.CallExpr, context: ExecContext): any;
    TextureGatherCompare(node: AST.CallExpr, context: ExecContext): any;
    TextureLoad(node: AST.CallExpr, context: ExecContext): number[];
    TextureNumLayers(node: AST.CallExpr, context: ExecContext): any;
    TextureNumLevels(node: AST.CallExpr, context: ExecContext): any;
    TextureNumSamples(node: AST.CallExpr, context: ExecContext): any;
    TextureSample(node: AST.CallExpr, context: ExecContext): any;
    TextureSampleBias(node: AST.CallExpr, context: ExecContext): any;
    TextureSampleCompare(node: AST.CallExpr, context: ExecContext): any;
    TextureSampleCompareLevel(node: AST.CallExpr, context: ExecContext): any;
    TextureSampleGrad(node: AST.CallExpr, context: ExecContext): any;
    TextureSampleLevel(node: AST.CallExpr, context: ExecContext): any;
    TextureSampleBaseClampToEdge(node: AST.CallExpr, context: ExecContext): any;
    TextureStore(node: AST.CallExpr, context: ExecContext): any;
    AtomicLoad(node: AST.CallExpr, context: ExecContext): any;
    AtomicStore(node: AST.CallExpr, context: ExecContext): any;
    AtomicAdd(node: AST.CallExpr, context: ExecContext): any;
    AtomicSub(node: AST.CallExpr, context: ExecContext): any;
    AtomicMax(node: AST.CallExpr, context: ExecContext): any;
    AtomicMin(node: AST.CallExpr, context: ExecContext): any;
    AtomicAnd(node: AST.CallExpr, context: ExecContext): any;
    AtomicOr(node: AST.CallExpr, context: ExecContext): any;
    AtomicXor(node: AST.CallExpr, context: ExecContext): any;
    AtomicExchange(node: AST.CallExpr, context: ExecContext): any;
    AtomicCompareExchangeWeak(node: AST.CallExpr, context: ExecContext): any;
    Pack4x8snorm(node: AST.CallExpr, context: ExecContext): any;
    Pack4x8unorm(node: AST.CallExpr, context: ExecContext): any;
    Pack4xI8(node: AST.CallExpr, context: ExecContext): any;
    Pack4xU8(node: AST.CallExpr, context: ExecContext): any;
    Pack4x8Clamp(node: AST.CallExpr, context: ExecContext): any;
    Pack4xU8Clamp(node: AST.CallExpr, context: ExecContext): any;
    Pack2x16snorm(node: AST.CallExpr, context: ExecContext): any;
    Pack2x16unorm(node: AST.CallExpr, context: ExecContext): any;
    Pack2x16float(node: AST.CallExpr, context: ExecContext): any;
    Unpack4x8snorm(node: AST.CallExpr, context: ExecContext): any;
    Unpack4x8unorm(node: AST.CallExpr, context: ExecContext): any;
    Unpack4xI8(node: AST.CallExpr, context: ExecContext): any;
    Unpack4xU8(node: AST.CallExpr, context: ExecContext): any;
    Unpack2x16snorm(node: AST.CallExpr, context: ExecContext): any;
    Unpack2x16unorm(node: AST.CallExpr, context: ExecContext): any;
    Unpack2x16float(node: AST.CallExpr, context: ExecContext): any;
    StorageBarrier(node: AST.CallExpr, context: ExecContext): any;
    TextureBarrier(node: AST.CallExpr, context: ExecContext): any;
    WorkgroupBarrier(node: AST.CallExpr, context: ExecContext): any;
    WorkgroupUniformLoad(node: AST.CallExpr, context: ExecContext): any;
    SubgroupAdd(node: AST.CallExpr, context: ExecContext): any;
    SubgroupExclusiveAdd(node: AST.CallExpr, context: ExecContext): any;
    SubgroupInclusiveAdd(node: AST.CallExpr, context: ExecContext): any;
    SubgroupAll(node: AST.CallExpr, context: ExecContext): any;
    SubgroupAnd(node: AST.CallExpr, context: ExecContext): any;
    SubgroupAny(node: AST.CallExpr, context: ExecContext): any;
    SubgroupBallot(node: AST.CallExpr, context: ExecContext): any;
    SubgroupBroadcast(node: AST.CallExpr, context: ExecContext): any;
    SubgroupBroadcastFirst(node: AST.CallExpr, context: ExecContext): any;
    SubgroupElect(node: AST.CallExpr, context: ExecContext): any;
    SubgroupMax(node: AST.CallExpr, context: ExecContext): any;
    SubgroupMin(node: AST.CallExpr, context: ExecContext): any;
    SubgroupMul(node: AST.CallExpr, context: ExecContext): any;
    SubgroupExclusiveMul(node: AST.CallExpr, context: ExecContext): any;
    SubgroupInclusiveMul(node: AST.CallExpr, context: ExecContext): any;
    SubgroupOr(node: AST.CallExpr, context: ExecContext): any;
    SubgroupShuffle(node: AST.CallExpr, context: ExecContext): any;
    SubgroupShuffleDown(node: AST.CallExpr, context: ExecContext): any;
    SubgroupShuffleUp(node: AST.CallExpr, context: ExecContext): any;
    SubgroupShuffleXor(node: AST.CallExpr, context: ExecContext): any;
    SubgroupXor(node: AST.CallExpr, context: ExecContext): any;
    QuadBroadcast(node: AST.CallExpr, context: ExecContext): any;
    QuadSwapDiagonal(node: AST.CallExpr, context: ExecContext): any;
    QuadSwapX(node: AST.CallExpr, context: ExecContext): any;
    QuadSwapY(node: AST.CallExpr, context: ExecContext): any;
}
