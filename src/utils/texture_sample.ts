import { float16ToFloat32, float32ToFloat16, float10ToFloat32, float11ToFloat32 } from "./float.js";

export function setTexturePixel(imageData: Uint8Array, x: number, y: number, z: number, mipLevel: number,
        height: number, bytesPerRow: number, texelByteSize: number, format: string, value: number[]): void {
    bytesPerRow = bytesPerRow >> mipLevel;
    height = height >> mipLevel;

    const offset = (z * bytesPerRow * height) + y * bytesPerRow + x * texelByteSize;

    switch (format) {
        case "r8unorm": {
            setPixelValue(imageData, offset, "8unorm", 1, value);
            return;
        }
        case "r8snorm": {
            setPixelValue(imageData, offset, "8snorm", 1, value);
            return;
        }
        case "r8uint": {
            setPixelValue(imageData, offset, "8uint", 1, value);
            return;
        }
        case "r8sint": {
            setPixelValue(imageData, offset, "8sint", 1, value);
            return;
        }

        case "rg8unorm": {
            setPixelValue(imageData, offset, "8unorm", 2, value);
            return;
        }
        case "rg8snorm": {
            setPixelValue(imageData, offset, "8snorm", 2, value);
            return;
        }
        case "rg8uint": {
            setPixelValue(imageData, offset, "8uint", 2, value);
            return;
        }
        case "rg8sint": {
            setPixelValue(imageData, offset, "8sint", 2, value);
            return;
        }

        case "rgba8unorm-srgb":
        case "rgba8unorm": {
            setPixelValue(imageData, offset, "8unorm", 4, value);
            return;
        }
        case "rgba8snorm": {
            setPixelValue(imageData, offset, "8snorm", 4, value);
            return;
        }
        case "rgba8uint": {
            setPixelValue(imageData, offset, "8uint", 4, value);
            return;
        }
        case "rgba8sint": {
            setPixelValue(imageData, offset, "8sint", 4, value);
            return;
        }

        case "bgra8unorm-srgb":
        case "bgra8unorm": {
            setPixelValue(imageData, offset, "8unorm", 4, value);
            return;
        }

        case "r16uint": {
            setPixelValue(imageData, offset, "16uint", 1, value);
            return;
        }
        case "r16sint": {
            setPixelValue(imageData, offset, "16sint", 1, value);
            return;
        }
        case "r16float": {
            setPixelValue(imageData, offset, "16float", 1, value);
            return;
        }

        case "rg16uint": {
            setPixelValue(imageData, offset, "16uint", 2, value);
            return;
        }
        case "rg16sint": {
            setPixelValue(imageData, offset, "16sint", 2, value);
            return;
        }
        case "rg16float": {
            setPixelValue(imageData, offset, "16float", 2, value);
            return;
        }

        case "rgba16uint": {
            setPixelValue(imageData, offset, "16uint", 4, value);
            return;
        }
        case "rgba16sint": {
            setPixelValue(imageData, offset, "16sint", 4, value);
            return;
        }
        case "rgba16float": {
            setPixelValue(imageData, offset, "16float", 4, value);
            return;
        }

        case "r32uint": {
            setPixelValue(imageData, offset, "32uint", 1, value);
            return;
        }
        case "r32sint": {
            setPixelValue(imageData, offset, "32sint", 1, value);
            return;
        }
        case "depth16unorm": // depth formats get conerted to r32float
        case "depth24plus":
        case "depth24plus-stencil8":
        case "depth32float":
        case "depth32float-stencil8":
        case "r32float": {
            setPixelValue(imageData, offset, "32float", 1, value);
            return;
        }
        case "rg32uint": {
            setPixelValue(imageData, offset, "32uint", 2, value);
            return;
        }
        case "rg32sint": {
            setPixelValue(imageData, offset, "32sint", 2, value);
            return;
        }
        case "rg32float": {
            setPixelValue(imageData, offset, "32float", 2, value);
            return;
        }
        case "rgba32uint": {
            setPixelValue(imageData, offset, "32uint", 4, value);
            return;
        }
        case "rgba32sint": {
            setPixelValue(imageData, offset, "32sint", 4, value);
            return;
        }
        case "rgba32float": {
            setPixelValue(imageData, offset, "32float", 4, value);
            return;
        }

        case "rg11b10ufloat": {
            console.error("TODO: rg11b10ufloat not supported for writing");
            /*const uintValue = new Uint32Array(imageData.buffer, offset, 1)[0];
            const ri = uintValue & 0x7FF;
            const gi = (uintValue & 0x3FF800) >> 11;
            const bi = (uintValue & 0xFFC00000) >> 22;
            const rf = float11ToFloat32(ri);
            const gf = float11ToFloat32(gi);
            const bf = float10ToFloat32(bi);
            return [rf, gf, bf, 1.0];*/
            return;
        }
    }
}

export function getTexturePixel(imageData: Uint8Array, x: number, y: number, z: number, mipLevel: number,
        height: number, bytesPerRow: number, texelByteSize: number, format: string): number[] | null {
    bytesPerRow = bytesPerRow >> mipLevel;
    height = height >> mipLevel;

    const offset = (z * bytesPerRow * height) + y * bytesPerRow + x * texelByteSize;

    switch (format) {
        case "r8unorm": {
            const value = pixelValue(imageData, offset, "8unorm", 1);
            return [value[0]];
        }
        case "r8snorm": {
            const value = pixelValue(imageData, offset, "8snorm", 1);
            return [value[0]];
        }
        case "r8uint": {
            const value = pixelValue(imageData, offset, "8uint", 1);
            return [value[0]];
        }
        case "r8sint": {
            const value = pixelValue(imageData, offset, "8sint", 1);
            return [value[0]];
        }

        case "rg8unorm": {
            const value = pixelValue(imageData, offset, "8unorm", 2);
            return [value[0], value[1]];
        }
        case "rg8snorm": {
            const value = pixelValue(imageData, offset, "8snorm", 2);
            return [value[0], value[1]];
        }
        case "rg8uint": {
            const value = pixelValue(imageData, offset, "8uint", 2);
            return [value[0], value[1]];
        }
        case "rg8sint": {
            const value = pixelValue(imageData, offset, "8sint", 2);
            return [value[0], value[1]];
        }

        case "rgba8unorm-srgb":
        case "rgba8unorm": {
            const value = pixelValue(imageData, offset, "8unorm", 4);
            return [value[0], value[1], value[2], value[3]];
        }
        case "rgba8snorm": {
            const value = pixelValue(imageData, offset, "8snorm", 4);
            return [value[0], value[1], value[2], value[3]];
        }
        case "rgba8uint": {
            const value = pixelValue(imageData, offset, "8uint", 4);
            return [value[0], value[1], value[2], value[3]];
        }
        case "rgba8sint": {
            const value = pixelValue(imageData, offset, "8sint", 4);
            return [value[0], value[1], value[2], value[3]];
        }

        case "bgra8unorm-srgb":
        case "bgra8unorm": {
            const value = pixelValue(imageData, offset, "8unorm", 4);
            return [value[2], value[1], value[0], value[3]];
        }

        case "r16uint": {
            const value = pixelValue(imageData, offset, "16uint", 1);
            return [value[0]];
        }
        case "r16sint": {
            const value = pixelValue(imageData, offset, "16sint", 1);
            return [value[0]];
        }
        case "r16float": {
            const value = pixelValue(imageData, offset, "16float", 1);
            return [value[0]];
        }

        case "rg16uint": {
            const value = pixelValue(imageData, offset, "16uint", 2);
            return [value[0], value[1]];
        }
        case "rg16sint": {
            const value = pixelValue(imageData, offset, "16sint", 2);
            return [value[0], value[1]];
        }
        case "rg16float": {
            const value = pixelValue(imageData, offset, "16float", 2);
            return [value[0], value[1]];
        }

        case "rgba16uint": {
            const value = pixelValue(imageData, offset, "16uint", 4);
            return [value[0], value[1], value[2], value[3]];
        }
        case "rgba16sint": {
            const value = pixelValue(imageData, offset, "16sint", 4);
            return [value[0], value[1], value[2], value[3]];
        }
        case "rgba16float": {
            const value = pixelValue(imageData, offset, "16float", 4);
            return [value[0], value[1], value[2], value[3]];
        }

        case "r32uint": {
            const value = pixelValue(imageData, offset, "32uint", 1);
            return [value[0]];
        }
        case "r32sint": {
            const value = pixelValue(imageData, offset, "32sint", 1);
            return [value[0]];
        }
        case "depth16unorm": // depth formats get conerted to r32float
        case "depth24plus":
        case "depth24plus-stencil8":
        case "depth32float":
        case "depth32float-stencil8":
        case "r32float": {
            const value = pixelValue(imageData, offset, "32float", 1);
            return [value[0]];
        }
        case "rg32uint": {
            const value = pixelValue(imageData, offset, "32uint", 2);
            return [value[0], value[1]];
        }
        case "rg32sint": {
            const value = pixelValue(imageData, offset, "32sint", 2);
            return [value[0], value[1]];
        }
        case "rg32float": {
            const value = pixelValue(imageData, offset, "32float", 2);
            return [value[0], value[1]];
        }
        case "rgba32uint": {
            const value = pixelValue(imageData, offset, "32uint", 4);
            return [value[0], value[1], value[2], value[3]];
        }
        case "rgba32sint": {
            const value = pixelValue(imageData, offset, "32sint", 4);
            return [value[0], value[1], value[2], value[3]];
        }
        case "rgba32float": {
            const value = pixelValue(imageData, offset, "32float", 4);
            return [value[0], value[1], value[2], value[3]];
        }

        case "rg11b10ufloat": {
            const uintValue = new Uint32Array(imageData.buffer, offset, 1)[0];
            const ri = uintValue & 0x7FF;
            const gi = (uintValue & 0x3FF800) >> 11;
            const bi = (uintValue & 0xFFC00000) >> 22;
            const rf = float11ToFloat32(ri);
            const gf = float11ToFloat32(gi);
            const bf = float10ToFloat32(bi);
            return [rf, gf, bf, 1.0];
        }
    }

    return null;
}

function pixelValue(imageData: Uint8Array, offset: number, format: string, numChannels: number) {
    const value = [0, 0, 0, 0];
    for (let i = 0; i < numChannels; ++i) {
      switch (format) {
        case "8unorm":
          value[i] = imageData[offset] / 255;
          offset++;
          break;
        case "8snorm":
          value[i] = (imageData[offset] / 255) * 2 - 1;
          offset++;
          break;
        case "8uint":
          value[i] = imageData[offset];
          offset++;
          break;
        case "8sint":
          value[i] = imageData[offset] - 127;
          offset++;
          break;
        case "16uint":
          value[i] = imageData[offset] | (imageData[offset + 1] << 8);
          offset += 2;
          break;
        case "16sint":
          value[i] = (imageData[offset] | (imageData[offset + 1] << 8)) - 32768;
          offset += 2;
          break;
        case "16float":
          value[i] = float16ToFloat32(imageData[offset] | (imageData[offset + 1] << 8));
          offset += 2;
          break;
        case "32uint":
          value[i] = imageData[offset] | (imageData[offset + 1] << 8) | (imageData[offset + 2] << 16) | (imageData[offset + 3] << 24);
          offset += 4;
          break;
        case "32sint":
          value[i] = (imageData[offset] | (imageData[offset + 1] << 8) | (imageData[offset + 2] << 16) | (imageData[offset + 3] << 24)) | 0;
          offset += 4;
          break;
        case "32float":
          value[i] = new Float32Array(imageData.buffer, offset, 1)[0];
          offset += 4;
          break;
      }
    }
    return value;
}

function setPixelValue(imageData: Uint8Array, offset: number, format: string, numChannels: number, value: number[]) {
    for (let i = 0; i < numChannels; ++i) {
      switch (format) {
        case "8unorm":
          imageData[offset] = value[i] * 255;
          offset++;
          break;
        case "8snorm":
          imageData[offset] = ((value[i] + 1.0) * 0.5) * 255;
          offset++;
          break;
        case "8uint":
          imageData[offset] = value[i];
          offset++;
          break;
        case "8sint":
          imageData[offset] = value[i] + 127;
          offset++;
          break;
        case "16uint":
          new Uint16Array(imageData.buffer, offset, 1)[0] = value[i];
          offset += 2;
          break;
        case "16sint":
          new Int16Array(imageData.buffer, offset, 1)[0] = value[i];
          offset += 2;
          break;
        case "16float": {
          const f16 = float32ToFloat16(value[i]);
          new Uint16Array(imageData.buffer, offset, 1)[0] = f16;
          offset += 2;
          break;
        }
        case "32uint":
          new Uint32Array(imageData.buffer, offset, 1)[0] = value[i];
          offset += 4;
          break;
        case "32sint":
          new Int32Array(imageData.buffer, offset, 1)[0] = value[i];
          offset += 4;
          break;
        case "32float":
          new Float32Array(imageData.buffer, offset, 1)[0] = value[i];
          offset += 4;
          break;
      }
    }
    return value;
}
