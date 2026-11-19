import { Data, TextureData, SamplerData, BindingArrayData, TypedData } from "../wgsl_ast.js";
import { TypeInfo, TemplateInfo, BindingArrayInfo } from "../reflect/info.js";
import { TextureFormatInfo } from "../utils/texture_format_info.js";

// The bytes of a buffer given as an ArrayBuffer or a typed array, viewed in
// place so writes reach the caller's data.
function _bytes(buffer: ArrayBuffer | ArrayBufferView): Uint8Array {
    return ArrayBuffer.isView(buffer)
        ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
        : new Uint8Array(buffer);
}

// Build the value of an opaque resource variable (a texture, sampler, texel
// buffer, or binding_array of them) from its bind group entry. Returns null
// for an entry that isn't one of those, which the caller binds as a buffer.
//
// Entries:
//   texture:       { texture: ArrayBuffer | ArrayBuffer[] (per mip), descriptor, view? }
//   sampler:       { sampler: GPUSamplerDescriptor }
//   texel_buffer:  ArrayBuffer | TypedArray | { texelBuffer: ArrayBuffer | TypedArray }
//   binding_array: an array of the entries above, one per element
export function makeResourceValue(typeInfo: TypeInfo | null, entry: any): Data | null {
    if (typeInfo === null || entry === null || entry === undefined) {
        return null;
    }

    if (typeInfo instanceof BindingArrayInfo) {
        if (!Array.isArray(entry)) {
            console.error(`A binding_array binding must be an array of entries.`);
            return null;
        }
        const elements = entry.map((e) => makeResourceValue(typeInfo.format, e));
        return new BindingArrayData(elements, typeInfo);
    }

    if (typeInfo.name === "texel_buffer") {
        const buffer = entry.texelBuffer ?? entry;
        if (!(buffer instanceof ArrayBuffer) && !ArrayBuffer.isView(buffer)) {
            console.error(`A texel_buffer binding must be an ArrayBuffer or typed array.`);
            return null;
        }
        const format = (typeInfo as TemplateInfo).format?.name ?? "rgba8unorm";
        const bytes = _bytes(buffer);
        const texelSize = TextureFormatInfo[format]?.bytesPerBlock ?? 4;
        const width = Math.floor(bytes.byteLength / texelSize);
        const descriptor = { size: [width, 1, 1], format, dimension: "1d" };
        return new TextureData([bytes], typeInfo, descriptor, null);
    }

    if (entry.texture !== undefined && entry.descriptor !== undefined) {
        // `texture` may be one buffer or an array of per-mip buffers.
        const mips = Array.isArray(entry.texture) ? entry.texture : [entry.texture];
        return new TextureData(mips, typeInfo, entry.descriptor, entry.view ?? null);
    }

    if (entry.sampler !== undefined) {
        return new SamplerData(entry.sampler, typeInfo);
    }

    return null;
}

// Bind a uniform ({ uniform: buffer }) or storage (the buffer itself) entry.
export function makeBufferValue(typeInfo: TypeInfo, entry: any): Data {
    if (entry.uniform !== undefined) {
        return new TypedData(entry.uniform, typeInfo);
    }
    return new TypedData(entry, typeInfo);
}
