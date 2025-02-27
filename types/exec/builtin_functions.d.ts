import { CallExpr, Call } from "../wgsl_ast.js";
import { Data } from "../wgsl_ast.js";
import { ExecContext } from "./exec_context.js";
import { ExecInterface } from "./exec_interface.js";
import { TypeInfo } from "../reflect/info.js";
export declare class BuiltinFunctions {
    exec: ExecInterface;
    constructor(exec: ExecInterface);
    getTypeInfo(type: string): TypeInfo | null;
    All(node: CallExpr | Call, context: ExecContext): Data | null;
    Any(node: CallExpr | Call, context: ExecContext): Data | null;
    Select(node: CallExpr | Call, context: ExecContext): Data | null;
    ArrayLength(node: CallExpr | Call, context: ExecContext): Data | null;
    Abs(node: CallExpr | Call, context: ExecContext): Data | null;
    Acos(node: CallExpr | Call, context: ExecContext): Data | null;
    Acosh(node: CallExpr | Call, context: ExecContext): Data | null;
    Asin(node: CallExpr | Call, context: ExecContext): Data | null;
    Asinh(node: CallExpr | Call, context: ExecContext): Data | null;
    Atan(node: CallExpr | Call, context: ExecContext): Data | null;
    Atanh(node: CallExpr | Call, context: ExecContext): Data | null;
    Atan2(node: CallExpr | Call, context: ExecContext): Data | null;
    Ceil(node: CallExpr | Call, context: ExecContext): Data | null;
    _clamp(value: number, min: number, max: number): number;
    Clamp(node: CallExpr | Call, context: ExecContext): Data | null;
    Cos(node: CallExpr | Call, context: ExecContext): Data | null;
    Cosh(node: CallExpr | Call, context: ExecContext): Data | null;
    CountLeadingZeros(node: CallExpr | Call, context: ExecContext): Data | null;
    _countOneBits(value: number): number;
    CountOneBits(node: CallExpr | Call, context: ExecContext): Data | null;
    _countTrailingZeros(value: number): number;
    CountTrailingZeros(node: CallExpr | Call, context: ExecContext): Data | null;
    Cross(node: CallExpr | Call, context: ExecContext): Data | null;
    Degrees(node: CallExpr | Call, context: ExecContext): Data | null;
    Determinant(node: CallExpr | Call, context: ExecContext): Data | null;
    Distance(node: CallExpr | Call, context: ExecContext): Data | null;
    _dot(e1: Int32Array | Uint32Array | Float32Array, e2: Int32Array | Uint32Array | Float32Array): number;
    Dot(node: CallExpr | Call, context: ExecContext): Data | null;
    Dot4U8Packed(node: CallExpr | Call, context: ExecContext): Data | null;
    Dot4I8Packed(node: CallExpr | Call, context: ExecContext): Data | null;
    Exp(node: CallExpr | Call, context: ExecContext): Data | null;
    Exp2(node: CallExpr | Call, context: ExecContext): Data | null;
    ExtractBits(node: CallExpr | Call, context: ExecContext): Data | null;
    FaceForward(node: CallExpr | Call, context: ExecContext): Data | null;
    _firstLeadingBit(s: number): number;
    FirstLeadingBit(node: CallExpr | Call, context: ExecContext): Data | null;
    _firstTrailingBit(s: number): number;
    FirstTrailingBit(node: CallExpr | Call, context: ExecContext): Data | null;
    Floor(node: CallExpr | Call, context: ExecContext): Data | null;
    Fma(node: CallExpr | Call, context: ExecContext): Data | null;
    Fract(node: CallExpr | Call, context: ExecContext): Data | null;
    Frexp(node: CallExpr | Call, context: ExecContext): Data | null;
    InsertBits(node: CallExpr | Call, context: ExecContext): Data | null;
    InverseSqrt(node: CallExpr | Call, context: ExecContext): Data | null;
    Ldexp(node: CallExpr | Call, context: ExecContext): Data | null;
    Length(node: CallExpr | Call, context: ExecContext): Data | null;
    Log(node: CallExpr | Call, context: ExecContext): Data | null;
    Log2(node: CallExpr | Call, context: ExecContext): Data | null;
    Max(node: CallExpr | Call, context: ExecContext): Data | null;
    Min(node: CallExpr | Call, context: ExecContext): Data | null;
    Mix(node: CallExpr | Call, context: ExecContext): Data | null;
    Modf(node: CallExpr | Call, context: ExecContext): Data | null;
    Normalize(node: CallExpr | Call, context: ExecContext): Data | null;
    Pow(node: CallExpr | Call, context: ExecContext): Data | null;
    QuantizeToF16(node: CallExpr | Call, context: ExecContext): Data | null;
    Radians(node: CallExpr | Call, context: ExecContext): Data | null;
    Reflect(node: CallExpr | Call, context: ExecContext): Data | null;
    Refract(node: CallExpr | Call, context: ExecContext): Data | null;
    ReverseBits(node: CallExpr | Call, context: ExecContext): Data | null;
    Round(node: CallExpr | Call, context: ExecContext): Data | null;
    Saturate(node: CallExpr | Call, context: ExecContext): Data | null;
    Sign(node: CallExpr | Call, context: ExecContext): Data | null;
    Sin(node: CallExpr | Call, context: ExecContext): Data | null;
    Sinh(node: CallExpr | Call, context: ExecContext): Data | null;
    _smoothstep(edge0: number, edge1: number, x: number): number;
    SmoothStep(node: CallExpr | Call, context: ExecContext): Data | null;
    Sqrt(node: CallExpr | Call, context: ExecContext): Data | null;
    Step(node: CallExpr | Call, context: ExecContext): Data | null;
    Tan(node: CallExpr | Call, context: ExecContext): Data | null;
    Tanh(node: CallExpr | Call, context: ExecContext): Data | null;
    _getTransposeType(t: TypeInfo): TypeInfo;
    Transpose(node: CallExpr | Call, context: ExecContext): Data | null;
    Trunc(node: CallExpr | Call, context: ExecContext): Data | null;
    Dpdx(node: CallExpr | Call, context: ExecContext): Data | null;
    DpdxCoarse(node: CallExpr | Call, context: ExecContext): Data | null;
    DpdxFine(node: CallExpr | Call, context: ExecContext): Data | null;
    Dpdy(node: CallExpr | Call, context: ExecContext): Data | null;
    DpdyCoarse(node: CallExpr | Call, context: ExecContext): Data | null;
    DpdyFine(node: CallExpr | Call, context: ExecContext): Data | null;
    Fwidth(node: CallExpr | Call, context: ExecContext): Data | null;
    FwidthCoarse(node: CallExpr | Call, context: ExecContext): Data | null;
    FwidthFine(node: CallExpr | Call, context: ExecContext): Data | null;
    TextureDimensions(node: CallExpr | Call, context: ExecContext): Data | null;
    TextureGather(node: CallExpr | Call, context: ExecContext): Data | null;
    TextureGatherCompare(node: CallExpr | Call, context: ExecContext): Data | null;
    TextureLoad(node: CallExpr | Call, context: ExecContext): Data | null;
    TextureNumLayers(node: CallExpr | Call, context: ExecContext): Data | null;
    TextureNumLevels(node: CallExpr | Call, context: ExecContext): Data | null;
    TextureNumSamples(node: CallExpr | Call, context: ExecContext): Data | null;
    TextureSample(node: CallExpr | Call, context: ExecContext): Data | null;
    TextureSampleBias(node: CallExpr | Call, context: ExecContext): Data | null;
    TextureSampleCompare(node: CallExpr | Call, context: ExecContext): Data | null;
    TextureSampleCompareLevel(node: CallExpr | Call, context: ExecContext): Data | null;
    TextureSampleGrad(node: CallExpr | Call, context: ExecContext): Data | null;
    TextureSampleLevel(node: CallExpr | Call, context: ExecContext): Data | null;
    TextureSampleBaseClampToEdge(node: CallExpr | Call, context: ExecContext): Data | null;
    TextureStore(node: CallExpr | Call, context: ExecContext): Data | null;
    AtomicLoad(node: CallExpr | Call, context: ExecContext): Data | null;
    AtomicStore(node: CallExpr | Call, context: ExecContext): Data | null;
    AtomicAdd(node: CallExpr | Call, context: ExecContext): Data | null;
    AtomicSub(node: CallExpr | Call, context: ExecContext): Data | null;
    AtomicMax(node: CallExpr | Call, context: ExecContext): Data | null;
    AtomicMin(node: CallExpr | Call, context: ExecContext): Data | null;
    AtomicAnd(node: CallExpr | Call, context: ExecContext): Data | null;
    AtomicOr(node: CallExpr | Call, context: ExecContext): Data | null;
    AtomicXor(node: CallExpr | Call, context: ExecContext): Data | null;
    AtomicExchange(node: CallExpr | Call, context: ExecContext): Data | null;
    AtomicCompareExchangeWeak(node: CallExpr | Call, context: ExecContext): Data | null;
    Pack4x8snorm(node: CallExpr | Call, context: ExecContext): Data | null;
    Pack4x8unorm(node: CallExpr | Call, context: ExecContext): Data | null;
    Pack4xI8(node: CallExpr | Call, context: ExecContext): Data | null;
    Pack4xU8(node: CallExpr | Call, context: ExecContext): Data | null;
    Pack4x8Clamp(node: CallExpr | Call, context: ExecContext): Data | null;
    Pack4xU8Clamp(node: CallExpr | Call, context: ExecContext): Data | null;
    Pack2x16snorm(node: CallExpr | Call, context: ExecContext): Data | null;
    Pack2x16unorm(node: CallExpr | Call, context: ExecContext): Data | null;
    Pack2x16float(node: CallExpr | Call, context: ExecContext): Data | null;
    Unpack4x8snorm(node: CallExpr | Call, context: ExecContext): Data | null;
    Unpack4x8unorm(node: CallExpr | Call, context: ExecContext): Data | null;
    Unpack4xI8(node: CallExpr | Call, context: ExecContext): Data | null;
    Unpack4xU8(node: CallExpr | Call, context: ExecContext): Data | null;
    Unpack2x16snorm(node: CallExpr | Call, context: ExecContext): Data | null;
    Unpack2x16unorm(node: CallExpr | Call, context: ExecContext): Data | null;
    Unpack2x16float(node: CallExpr | Call, context: ExecContext): Data | null;
    StorageBarrier(node: CallExpr | Call, context: ExecContext): Data | null;
    TextureBarrier(node: CallExpr | Call, context: ExecContext): Data | null;
    WorkgroupBarrier(node: CallExpr | Call, context: ExecContext): Data | null;
    WorkgroupUniformLoad(node: CallExpr | Call, context: ExecContext): Data | null;
    SubgroupAdd(node: CallExpr | Call, context: ExecContext): Data | null;
    SubgroupExclusiveAdd(node: CallExpr | Call, context: ExecContext): Data | null;
    SubgroupInclusiveAdd(node: CallExpr | Call, context: ExecContext): Data | null;
    SubgroupAll(node: CallExpr | Call, context: ExecContext): Data | null;
    SubgroupAnd(node: CallExpr | Call, context: ExecContext): Data | null;
    SubgroupAny(node: CallExpr | Call, context: ExecContext): Data | null;
    SubgroupBallot(node: CallExpr | Call, context: ExecContext): Data | null;
    SubgroupBroadcast(node: CallExpr | Call, context: ExecContext): Data | null;
    SubgroupBroadcastFirst(node: CallExpr | Call, context: ExecContext): Data | null;
    SubgroupElect(node: CallExpr | Call, context: ExecContext): Data | null;
    SubgroupMax(node: CallExpr | Call, context: ExecContext): Data | null;
    SubgroupMin(node: CallExpr | Call, context: ExecContext): Data | null;
    SubgroupMul(node: CallExpr | Call, context: ExecContext): Data | null;
    SubgroupExclusiveMul(node: CallExpr | Call, context: ExecContext): Data | null;
    SubgroupInclusiveMul(node: CallExpr | Call, context: ExecContext): Data | null;
    SubgroupOr(node: CallExpr | Call, context: ExecContext): Data | null;
    SubgroupShuffle(node: CallExpr | Call, context: ExecContext): Data | null;
    SubgroupShuffleDown(node: CallExpr | Call, context: ExecContext): Data | null;
    SubgroupShuffleUp(node: CallExpr | Call, context: ExecContext): Data | null;
    SubgroupShuffleXor(node: CallExpr | Call, context: ExecContext): Data | null;
    SubgroupXor(node: CallExpr | Call, context: ExecContext): Data | null;
    QuadBroadcast(node: CallExpr | Call, context: ExecContext): Data | null;
    QuadSwapDiagonal(node: CallExpr | Call, context: ExecContext): Data | null;
    QuadSwapX(node: CallExpr | Call, context: ExecContext): Data | null;
    QuadSwapY(node: CallExpr | Call, context: ExecContext): Data | null;
}
