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

// The view dimension of a texture entry, "1d", "2d", "2d-array", "cube",
// "cube-array", or "3d": its view's dimension if given, otherwise derived from
// the texture descriptor.
function _viewDimension(entry: any): string {
    const viewDimension = entry.view?.dimension;
    if (viewDimension) {
        return viewDimension;
    }
    const descriptor = entry.descriptor ?? {};
    const dimension = descriptor.dimension ?? "2d";
    if (dimension !== "2d") {
        return dimension;
    }
    const size = descriptor.size;
    const layers = Array.isArray(size) ? (size[2] ?? 1) : (size?.depthOrArrayLayers ?? 1);
    return layers > 1 ? "2d-array" : "2d";
}

// The view dimension a texture type name binds, as a GPUTextureViewDimension.
function _typeViewDimension(typeName: string): string {
    return typeName.replace(/^texture_(depth_|multisampled_|storage_)*/, "").replace("_", "-");
}

// The sample type of a texture format: "u32", "i32", "depth", or "f32".
function _formatSampleType(format: string): string {
    if (TextureFormatInfo[format]?.isDepthStencil || format.startsWith("depth")) {
        return "depth";
    }
    if (format.endsWith("uint")) {
        return "u32";
    }
    if (format.endsWith("sint")) {
        return "i32";
    }
    return "f32";
}

// True if a resource table entry can be accessed as the given resource type
// by getResource<T> or hasResource<T>.
export function resourceMatchesType(entry: any, typeInfo: TypeInfo): boolean {
    if (entry === null || entry === undefined) {
        return false;
    }
    const typeName = typeInfo.name;
    if (typeName === "sampler" || typeName === "sampler_comparison") {
        if (entry.sampler === undefined) {
            return false;
        }
        const isComparison = entry.sampler?.compare !== undefined;
        return isComparison === (typeName === "sampler_comparison");
    }

    if (!typeName.startsWith("texture_") || entry.texture === undefined || entry.descriptor === undefined) {
        return false;
    }
    if (_viewDimension(entry) !== _typeViewDimension(typeName)) {
        return false;
    }
    const multisampled = (entry.descriptor.sampleCount ?? 1) > 1;
    if (multisampled !== typeName.includes("multisampled")) {
        return false;
    }
    const format = entry.view?.format ?? entry.descriptor.format ?? "rgba8unorm";
    if (typeName.startsWith("texture_storage")) {
        return (typeInfo as TemplateInfo).format?.name === format;
    }
    const sampleType = _formatSampleType(format);
    if (typeName.startsWith("texture_depth")) {
        return sampleType === "depth";
    }
    // A depth format can also be bound to a texture with an f32 sample type.
    const typeSampleType = (typeInfo as TemplateInfo).format?.name ?? "f32";
    return typeSampleType === sampleType || (typeSampleType === "f32" && sampleType === "depth");
}

// The default resource getResource<T> returns for an index that is out of
// bounds or holds a resource of a different type: a zero-filled 1x1 texture,
// or a sampler with default settings.
export function makeDefaultResource(typeInfo: TypeInfo): Data {
    const typeName = typeInfo.name;
    if (typeName === "sampler" || typeName === "sampler_comparison") {
        return new SamplerData(typeName === "sampler_comparison" ? { compare: "never" } : {}, typeInfo);
    }
    const viewDimension = _typeViewDimension(typeName);
    const layers = viewDimension.startsWith("cube") ? 6 : 1;
    const sampleType = (typeInfo as TemplateInfo).format?.name ?? "f32";
    const format = typeName.startsWith("texture_storage") ? sampleType
        : typeName.startsWith("texture_depth") ? "depth32float"
        : sampleType === "u32" ? "rgba32uint"
        : sampleType === "i32" ? "rgba32sint"
        : "rgba32float";
    const dimension = viewDimension === "1d" || viewDimension === "3d" ? viewDimension : "2d";
    const descriptor = { size: [1, 1, layers], format, dimension };
    return new TextureData([new ArrayBuffer(16 * layers)], typeInfo, descriptor, null);
}
