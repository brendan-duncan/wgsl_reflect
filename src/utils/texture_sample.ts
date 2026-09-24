import { float16ToFloat32, float32ToFloat16, float10ToFloat32, float11ToFloat32,
    float32ToFloat10, float32ToFloat11 } from "./float.js";

// Channel encoding and channel count of the formats that store each channel in
// its own 8, 16 or 32 bits. Depth formats are stored as r32float.
const channelFormats: Record<string, [string, number]> = {
    "r8unorm": ["8unorm", 1],
    "r8snorm": ["8snorm", 1],
    "r8uint": ["8uint", 1],
    "r8sint": ["8sint", 1],
    "rg8unorm": ["8unorm", 2],
    "rg8snorm": ["8snorm", 2],
    "rg8uint": ["8uint", 2],
    "rg8sint": ["8sint", 2],
    "rgba8unorm": ["8unorm", 4],
    "rgba8unorm-srgb": ["8unorm", 4],
    "rgba8snorm": ["8snorm", 4],
    "rgba8uint": ["8uint", 4],
    "rgba8sint": ["8sint", 4],
    "bgra8unorm": ["8unorm", 4],
    "bgra8unorm-srgb": ["8unorm", 4],

    "r16unorm": ["16unorm", 1],
    "r16snorm": ["16snorm", 1],
    "r16uint": ["16uint", 1],
    "r16sint": ["16sint", 1],
    "r16float": ["16float", 1],
    "rg16unorm": ["16unorm", 2],
    "rg16snorm": ["16snorm", 2],
    "rg16uint": ["16uint", 2],
    "rg16sint": ["16sint", 2],
    "rg16float": ["16float", 2],
    "rgba16unorm": ["16unorm", 4],
    "rgba16snorm": ["16snorm", 4],
    "rgba16uint": ["16uint", 4],
    "rgba16sint": ["16sint", 4],
    "rgba16float": ["16float", 4],

    "r32uint": ["32uint", 1],
    "r32sint": ["32sint", 1],
    "r32float": ["32float", 1],
    "rg32uint": ["32uint", 2],
    "rg32sint": ["32sint", 2],
    "rg32float": ["32float", 2],
    "rgba32uint": ["32uint", 4],
    "rgba32sint": ["32sint", 4],
    "rgba32float": ["32float", 4],

    "depth16unorm": ["32float", 1],
    "depth24plus": ["32float", 1],
    "depth24plus-stencil8": ["32float", 1],
    "depth32float": ["32float", 1],
    "depth32float-stencil8": ["32float", 1],
};

function _texelOffset(x: number, y: number, z: number, mipLevel: number, height: number,
        bytesPerRow: number, texelByteSize: number): number {
    bytesPerRow = bytesPerRow >> mipLevel;
    height = height >> mipLevel;
    return (z * bytesPerRow * height) + y * bytesPerRow + x * texelByteSize;
}

function _isBGRA(format: string): boolean {
    return format === "bgra8unorm" || format === "bgra8unorm-srgb";
}

export function setTexturePixel(imageData: Uint8Array, x: number, y: number, z: number, mipLevel: number,
        height: number, bytesPerRow: number, texelByteSize: number, format: string, value: number[]): void {
    const offset = _texelOffset(x, y, z, mipLevel, height, bytesPerRow, texelByteSize);
    const view = new DataView(imageData.buffer, imageData.byteOffset, imageData.byteLength);

    const channels = channelFormats[format];
    if (channels !== undefined) {
        if (_isBGRA(format)) {
            value = [value[2], value[1], value[0], value[3]];
        }
        setPixelValue(view, offset, channels[0], channels[1], value);
        return;
    }

    const v = (i: number) => value[i] ?? 0;
    switch (format) {
        case "rgb10a2unorm": {
            const packed = _unorm(v(0), 1023) | (_unorm(v(1), 1023) << 10) |
                (_unorm(v(2), 1023) << 20) | (_unorm(v(3), 3) << 30);
            view.setUint32(offset, packed >>> 0, true);
            return;
        }
        case "rgb10a2uint": {
            const packed = (v(0) & 0x3FF) | ((v(1) & 0x3FF) << 10) | ((v(2) & 0x3FF) << 20) | ((v(3) & 0x3) << 30);
            view.setUint32(offset, packed >>> 0, true);
            return;
        }
        case "rg11b10ufloat": {
            const packed = float32ToFloat11(v(0)) | (float32ToFloat11(v(1)) << 11) | (float32ToFloat10(v(2)) << 22);
            view.setUint32(offset, packed >>> 0, true);
            return;
        }
    }

    console.error(`setTexturePixel: Unsupported texture format ${format}`);
}

export function getTexturePixel(imageData: Uint8Array, x: number, y: number, z: number, mipLevel: number,
        height: number, bytesPerRow: number, texelByteSize: number, format: string): number[] | null {
    const offset = _texelOffset(x, y, z, mipLevel, height, bytesPerRow, texelByteSize);
    const view = new DataView(imageData.buffer, imageData.byteOffset, imageData.byteLength);

    const channels = channelFormats[format];
    if (channels !== undefined) {
        const value = pixelValue(view, offset, channels[0], channels[1]);
        return _isBGRA(format) ? [value[2], value[1], value[0], value[3]] : value;
    }

    switch (format) {
        case "rgb10a2unorm": {
            const p = view.getUint32(offset, true);
            return [(p & 0x3FF) / 1023, ((p >>> 10) & 0x3FF) / 1023, ((p >>> 20) & 0x3FF) / 1023, (p >>> 30) / 3];
        }
        case "rgb10a2uint": {
            const p = view.getUint32(offset, true);
            return [p & 0x3FF, (p >>> 10) & 0x3FF, (p >>> 20) & 0x3FF, p >>> 30];
        }
        case "rg11b10ufloat": {
            const p = view.getUint32(offset, true);
            return [float11ToFloat32(p & 0x7FF), float11ToFloat32((p >>> 11) & 0x7FF), float10ToFloat32(p >>> 22), 1.0];
        }
    }

    return null;
}

// Normalized conversions, following the WebGPU/WGSL texel format rules.
function _unorm(v: number, max: number): number {
    return Math.round(Math.min(Math.max(v, 0), 1) * max);
}

function _snorm(v: number, max: number): number {
    return Math.round(Math.min(Math.max(v, -1), 1) * max);
}

function pixelValue(view: DataView, offset: number, format: string, numChannels: number): number[] {
    const value: number[] = [];
    for (let i = 0; i < numChannels; ++i) {
      switch (format) {
        case "8unorm":
          value.push(view.getUint8(offset) / 255);
          offset++;
          break;
        case "8snorm":
          value.push(Math.max(view.getInt8(offset) / 127, -1));
          offset++;
          break;
        case "8uint":
          value.push(view.getUint8(offset));
          offset++;
          break;
        case "8sint":
          value.push(view.getInt8(offset));
          offset++;
          break;
        case "16unorm":
          value.push(view.getUint16(offset, true) / 65535);
          offset += 2;
          break;
        case "16snorm":
          value.push(Math.max(view.getInt16(offset, true) / 32767, -1));
          offset += 2;
          break;
        case "16uint":
          value.push(view.getUint16(offset, true));
          offset += 2;
          break;
        case "16sint":
          value.push(view.getInt16(offset, true));
          offset += 2;
          break;
        case "16float":
          value.push(float16ToFloat32(view.getUint16(offset, true)));
          offset += 2;
          break;
        case "32uint":
          value.push(view.getUint32(offset, true));
          offset += 4;
          break;
        case "32sint":
          value.push(view.getInt32(offset, true));
          offset += 4;
          break;
        case "32float":
          value.push(view.getFloat32(offset, true));
          offset += 4;
          break;
      }
    }
    return value;
}

function setPixelValue(view: DataView, offset: number, format: string, numChannels: number, value: number[]): void {
    for (let i = 0; i < numChannels; ++i) {
      const v = value[i] ?? 0;
      switch (format) {
        case "8unorm":
          view.setUint8(offset, _unorm(v, 255));
          offset++;
          break;
        case "8snorm":
          view.setInt8(offset, _snorm(v, 127));
          offset++;
          break;
        case "8uint":
          view.setUint8(offset, v);
          offset++;
          break;
        case "8sint":
          view.setInt8(offset, v);
          offset++;
          break;
        case "16unorm":
          view.setUint16(offset, _unorm(v, 65535), true);
          offset += 2;
          break;
        case "16snorm":
          view.setInt16(offset, _snorm(v, 32767), true);
          offset += 2;
          break;
        case "16uint":
          view.setUint16(offset, v, true);
          offset += 2;
          break;
        case "16sint":
          view.setInt16(offset, v, true);
          offset += 2;
          break;
        case "16float":
          view.setUint16(offset, float32ToFloat16(v), true);
          offset += 2;
          break;
        case "32uint":
          view.setUint32(offset, v, true);
          offset += 4;
          break;
        case "32sint":
          view.setInt32(offset, v, true);
          offset += 4;
          break;
        case "32float":
          view.setFloat32(offset, v, true);
          offset += 4;
          break;
      }
    }
}
