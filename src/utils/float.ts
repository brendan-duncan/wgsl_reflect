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

// Unsigned 11- and 10-bit floats (rg11b10ufloat): no sign bit, a 5-bit exponent
// with a bias of 15, and a 6- or 5-bit mantissa.
function unsignedFloatToFloat32(v: number, mantissaBits: number): number {
  const e = (v >> mantissaBits) & 0x1F;
  const m = v & ((1 << mantissaBits) - 1);
  if (e === 0) {
    return m * Math.pow(2, -14 - mantissaBits);
  }
  if (e === 0x1F) {
    return m ? NaN : Infinity;
  }
  return Math.pow(2, e - 15) * (1 + m / (1 << mantissaBits));
}

function float32ToUnsignedFloat(f: number, mantissaBits: number): number {
  if (Number.isNaN(f)) {
    return (0x1F << mantissaBits) | 1;
  }
  if (f <= 0) {
    return 0; // Negative values clamp to zero.
  }
  if (f === Infinity) {
    return 0x1F << mantissaBits;
  }
  let e = Math.floor(Math.log2(f));
  if (Math.pow(2, e) > f) {
    e--;
  } else if (Math.pow(2, e + 1) <= f) {
    e++;
  }
  if (e < -14) {
    // Denormal. Rounding up to 1 << mantissaBits gives the smallest normal.
    return Math.round(f / Math.pow(2, -14 - mantissaBits));
  }
  let m = Math.round((f / Math.pow(2, e) - 1) * (1 << mantissaBits));
  if (m === (1 << mantissaBits)) {
    m = 0;
    e++;
  }
  if (e > 15) {
    return 0x1F << mantissaBits; // Overflow to infinity.
  }
  return ((e + 15) << mantissaBits) | m;
}

export function float11ToFloat32(f11: number): number {
  return unsignedFloatToFloat32(f11, 6);
}

export function float10ToFloat32(f10: number): number {
  return unsignedFloatToFloat32(f10, 5);
}

export function float32ToFloat11(f: number): number {
  return float32ToUnsignedFloat(f, 6);
}

export function float32ToFloat10(f: number): number {
  return float32ToUnsignedFloat(f, 5);
}
