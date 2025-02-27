// From https://stackoverflow.com/questions/5678432/decompressing-half-precision-floats-in-javascript
export function float16ToFloat32(float16: number): number {
    var s = (float16 & 0x8000) >> 15;
    var e = (float16 & 0x7C00) >> 10;
    var f = float16 & 0x03FF;

    if (e == 0) {
      return (s ? -1:1) * Math.pow(2, -14) * (f / Math.pow(2, 10));
    } else if (e == 0x1F) {
      return f ? NaN : ((s ? -1 : 1) * Infinity);
    }

    return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + (f / Math.pow(2, 10)));
}

const float32View = new Float32Array(1);
const int32View = new Int32Array(float32View.buffer);
const float16View = new Uint16Array(1);

export function float32ToFloat16(float32: number): number {
  float32View[0] = float32;

  const f32 = int32View[0];
  const sign = (f32 >> 31) & 1;
  let exponent = (f32 >> 23) & 0xff;
  let fraction = f32 & 0x7fffff;

  if (exponent === 0xff) { // Infinity or NaN
    float16View[0] = (sign << 15) | 0x7c00 | (fraction !== 0 ? 0x0200 : 0);
    return float16View[0];
  }

  if (exponent === 0) { // Zero or subnormal
    if (fraction === 0) { // Zero
      float16View[0] = sign << 15;
      return float16View[0];
    }
    // Subnormal
    fraction |= 0x800000;
    let shift = 113;
    while ((fraction & 0x800000) === 0) {
      fraction <<= 1;
      shift--;
    }
    exponent = 127 - shift;
    fraction &= 0x7fffff;
    if (exponent > 0) {
      fraction = (fraction >> (126 - exponent)) + ((fraction >> (127 - exponent)) & 1);
      float16View[0] = (sign << 15) | (exponent << 10) | (fraction >> 13);
      return float16View[0];
    } else {
      float16View[0] = sign << 15;
      return float16View[0];
    }
  }

  // Normalized
  exponent = exponent - 127 + 15;
  if (exponent >= 31) { // Overflow
    float16View[0] = (sign << 15) | 0x7c00;
    return float16View[0];
  }
  if (exponent <= 0) { // Underflow
    if (exponent < -10) {
      float16View[0] = sign << 15;
      return float16View[0];
    }
    fraction = (fraction | 0x800000) >> (1 - exponent);
    float16View[0] = (sign << 15) | (fraction >> 13);
    return float16View[0];
  }

  fraction = fraction >> 13;
  float16View[0] = (sign << 15) | (exponent << 10) | fraction;
  return float16View[0];
}

const uint32 = new Uint32Array(1);
const uint32ToFloat32 = new Float32Array(uint32.buffer, 0, 1);

export function float11ToFloat32(f11: number): number {
  const u32 = (((((f11) >> 6) & 0x1F) + (127 - 15)) << 23) | (((f11) & 0x3F) << 17);
  uint32[0] = u32;
  return uint32ToFloat32[0];
}

export function float10ToFloat32(f10: number): number {
  const u32 = (((((f10) >> 5) & 0x1F) + (127 - 15)) << 23) | (((f10) & 0x1F) << 18);
  uint32[0] = u32;
  return uint32ToFloat32[0];
}
