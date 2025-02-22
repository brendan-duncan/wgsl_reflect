export function isArray(value: any): boolean {
    return Array.isArray(value) || value?.buffer instanceof ArrayBuffer;
}

export function isNumber(value: any): boolean {
    return typeof value === "number";
}

const _f32 = new Float32Array(1);
const _f32_i32 = new Uint32Array(_f32.buffer);
const _f32_u32 = new Uint32Array(_f32.buffer);
const _i32 = new Int32Array(1);
const _i32_f32 = new Float32Array(_i32.buffer);
const _i32_u32 = new Uint32Array(_i32.buffer);
const _u32 = new Uint32Array(1);
const _u32_f32 = new Float32Array(_u32.buffer);
const _u32_i32 = new Int32Array(_u32.buffer);

export function castScalar(v: number, from: string, to: string): number {
    if (from === to) {
        return v;
    }

    if (from === "f32") {
        if (to === "i32" || to === "x32") {
            _f32[0] = v;
            return _f32_i32[0];
        } else if (to === "u32") {
            _f32[0] = v;
            return _f32_u32[0];
        }
    } else if (from === "i32" || from === "x32") {
        if (to === "f32") {
            _i32[0] = v;
            return _i32_f32[0];
        } else if (to === "u32") {
            _i32[0] = v;
            return _i32_u32[0];
        }
    } else if (from === "u32") {
        if (to === "f32") {
            _u32[0] = v;
            return _u32_f32[0];
        } else if (to === "i32" || to === "x32") {
            _u32[0] = v;
            return _u32_i32[0];
        }
    }

    console.error(`Unsupported cast from ${from} to ${to}`);
    return v;
}

export function castVector(v: number[], from: string, to: string): number[] {
    if (from === to) {
        return v;
    }

    const cast = new Array<number>(v.length);
    for (let i = 0; i < v.length; i++) {
        cast[i] = castScalar(v[i], from, to);
    }

    return cast;
}
