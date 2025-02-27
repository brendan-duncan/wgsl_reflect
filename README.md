# WebGPU Shading Language Reflection Library

A WebGPU Shading Language parser and reflection library for Typescript and Javascript.

**wgsl_reflect** can parse a WGSL shader and analyze its contents, providing information about the shader. It can determine the bind group layout of the shader, resource bindings, uniform buffers, the members of a uniform buffer, their names, types, sizes, offsets into the buffer.

## Usage

From NPM
```
npm install wgsl_reflect
```

The _wgsl_reflect.module.js_ file is a self-contained roll-up of the library that can be included in your project and imported with:

```javascript
import { WgslReflect } from "wgsl_reflect/wgsl_reflect.module.js";
const reflect = new WgslReflect(shader_code);
```

## Example

[WGSL Reflect Example](https://brendan-duncan.github.io/wgsl_reflect/example.html)

## Documentation

```javascript
// A collection of gathered reflection information about the shader.
class WgslReflect {
  // All top-level uniform vars in the shader.
  uniforms: Array<VariableInfo>;
  // All top-level storage vars in the shader, including storage buffers and textures.
  storage: Array<VariableInfo>;
  // All top-level texture vars in the shader;
  textures: Array<VariableInfo>;
  // All top-level sampler vars in the shader.
  samplers: Array<VariableInfo>;
  // All top-level type aliases in the shader.
  aliases: Array<AliasInfo>;
  // All top-level overrides in the shader.
  overrides: Array<OverrideInfo> = [];
  // All top-level structs in the shader.
  structs: Array<StructInfo>;
  // All entry functions in the shader: vertex, fragment, and/or compute.
  entry: EntryFunctions;
  // All functions in the shader, including entry functions.
  functions: Array<FunctionInfo>;

  // Parse the given WGSL shader code, populating the info properties of this class.
  constructor(shader?: string);

  // Parse the given WGSL shader code, adding to the info properties of this class.
  update(shader: string);

  // Find a resource by its group and binding.
  findResource(group: number, binding: number): VariableInfo | null;

  // Get the bind groups used by the shader, bindGroups[group][binding].
  getBindGroups(): Array<Array<VariableInfo>>;
}

// A variable can be a resource passed to the shader, of this type.
enum ResourceType {
  Uniform, // Uniform buffer
  Storage, // Storage buffer
  Texture, // Texture
  Sampler, // Sampler to sample a Texture
  StorageTexture // StorageTexture
}

// Information about a resource variable. This will be a uniform buffer,
// storage buffer, texture, sampler, or storageTexture.
class VariableInfo {
  // The name of the variable.
  name: string;
  // The type of the variable.
  type: TypeInfo;
  // The binding group of the variable.
  group: number;
  // The binding index of the variable.
  binding: number;
  // The resource type of the variable.
  resourceType: ResourceType;
  // The access mode of the variable, can be: "", "read", "write", or "read_write".
  access: string;

  // True if the type of the variable is an array.
  get isArray(): boolean;
  // True if the type of the variable is a struct.
  get isStruct(): boolean;
  // True if the type of the variable is a template.
  get isTemplate(): boolean;
  // Size of the data pointed to by the variable, in bytes.
  get size(): number;
  // The alignment size if the variable type is a struct, otherwise 0.
  get align(): number;
  // The list of members of the variable type if it's a struct, otherwise null.
  get members(): Array<MemberInfo> | null;
  // The format if the type is a template or array, otherwise null.
  get format(): TypeInfo | null;
  // The array size if it's an array, otherwise 0.
  get count(): number;
  // The array stride if it's an array, otherwise 0.
  get stride(): number;
}

// Base class for variable types.
class TypeInfo {
  // The name of the type declaration.
  name: string;
  // Size of the data used by this type, in bytes
  size: number;

  // True if this is an array type, can be cast to ArrayInfo.
  get isArray(): boolean;
  // True if this is a struct type, can be cast to StructInfo.
  get isStruct(): boolean;
  // True if this is a template type, can be cast to TemplateInfo.
  get isTemplate(): boolean;
}

// Information about struct type declarations
class StructInfo extends TypeInfo {
  // The list of members of the struct.
  members: Array<MemberInfo>;
  // The alignment, in bytes, for the structs data.
  align: number;
  // The line in the shader code the type declaration starts at.
  startLine: number;
  // The line in the shader code the type declaration ends at.
  endLine: number;
  // True if the struct is used by a uniform, storage, or directly or indirectly by an entry function.
  inUse: boolean;
}

// Information about array type declarations
class ArrayInfo extends TypeInfo {
  // The format for the data in the array
  format: TypeInfo;
  // The number of elements in the array
  count: number;
  // The stride, in bytes, of the array. This is the alignment of elements in the array data, including padding.
  stride: number;
}

// Information about template type declarations
class TemplateInfo extends TypeInfo {
  // The format type of the template
  format: TypeInfo;
  // Access mode of the template, which can be: "", "read", "write", or "read_write"
  access: string;
}

// Information about a struct member declaration.
class MemberInfo {
  // The name of the struct member.
  name: string;
  // The type of the struct member.
  type: TypeInfo;
  // The offset, in bytes, of the member from the start of the struct data.
  offset: number;
  // The size of the members data, in bytes.
  size: number;

  // True if the member type is an array and can be cast to ArrayInfo
  get isArray(): boolean;
  // True if the member type is a struct and can be cast to StructInfo.
  get isStruct(): boolean;
  // True if the member type is a template and can be cast to TemplateInfo.
  get isTemplate(): boolean;
  // If the member type is a struct, the alignment of the struct in bytes, otherwise 0.
  get align(): number;
  // If the member type is a struct, the members of the struct, otherwise null.
  get members(): Array<MemberInfo> | null;
  // If the member type is an array or template, the format of the type, otherwise null.
  get format(): TypeInfo | null;
  // If the member type is an array, the number of elements in the array, otherwise 0.
  get count(): number;
  // If the member type is an array, the stride of the array elements in bytes, otherwise 0.
  get stride(): number;
}

// Information about type aliases declared in the shader.
class AliasInfo {
  // The name of the alias type.
  name: string;
  // The information of the type being aliased.
  type: TypeInfo;
}

// The lists of shader vertex, fragment, and/or compute entry functions.
class EntryFunctions {
  // Any vertex entry points in the shader.
  vertex: Array<FunctionInfo>;
  // Any fragment entry points in the shader.
  fragment: Array<FunctionInfo>;
  // Any compute entry points in the shader.
  compute: Array<FunctionInfo>;
}

// Information about a function in the shader.
class FunctionInfo {
  // The name of the function.
  name: string;
  // If the function is an entry function, which stage is it for, either "vertex", "fragment", "compute", or null if none.
  stage: string | null;
  // The list of shader inputs used by the function, which includes vertex and index buffers.
  inputs: Array<InputInfo>;
  // The list of shader outputs updated by the function, such as inter-stage buffers.
  outputs: Array<OutputInfo>;
  // The arguments of the function.
  arguments: Array<ArgumentInfo>;
  // The return type of the function, or null if the function returns void.
  returnType: TypeInfo | null;
  // The resources used by the function, including uniform buffers, storage buffers, textures,
  // samplers, and storage textures.
  resources: Array<VariableInfo>;
  // The line in the shader the function definition starts at.
  startLine: number;
  // The line in the shader the function definition ends at.
  endLine: number;
  // True if called directly or indirectly by an entry function.
  inUse: boolean;
  // All custom functions called directly by this function.
  calls: Set<FunctionInfo>;
}

// Information about a shader inputs.
class InputInfo {
  // The name of the input variable
  name: string;
  // The type of the input variable.
  type: TypeInfo | null;
  // The location type of the input.
  locationType: string;
  // The location index or built-in location name.
  location: number | string;
  // The interpolation mode of the binding.
  interpolation: string | null;
}

// Information about a shader output.
class OutputInfo {
  // The name of the output variable.
  name: string;
  // The type of the output variable.
  type: TypeInfo | null;
  // The location type of the output.
  locationType: string;
  // The location index or built-in location name.
  location: number | string;
}

// Information about override constants in the shader.
class OverrideInfo {
  // The name of the override constant.
  name: string;
  // The type of the override constant.
  type: TypeInfo | null;
  // A unique ID given to the override constant.
  id: number;
}

// Information about a function argument.
class ArgumentInfo {
  // Then ame of the argument variable.
  name: string;
  // The type of the argument variable.
  type: TypeInfo;
}
```

## Examples

Calculate the bind group information in the shader:

```javascript
import { WgslReflect } from "./wgsl_reflect.module.js";

const shader = `
struct ViewUniforms {
    viewProjection: mat4x4<f32>
}

struct ModelUniforms {
    model: mat4x4<f32>,
    color: vec4<f32>,
    intensity: f32
}

@binding(0) @group(0) var<uniform> viewUniforms: ViewUniforms;
@binding(1) @group(0) var<uniform> modelUniforms: ModelUniforms;
@binding(2) @group(0) var u_sampler: sampler;
@binding(3) @group(0) var u_texture: texture_2d<f32>;

struct VertexInput {
    @location(0) a_position: vec3<f32>,
    @location(1) a_normal: vec3<f32>,
    @location(2) a_color: vec4<f32>,
    @location(3) a_uv: vec2<f32>
}

struct VertexOutput {
    @builtin(position) Position: vec4<f32>,
    @location(0) v_position: vec4<f32>,
    @location(1) v_normal: vec3<f32>,
    @location(2) v_color: vec4<f32>,
    @location(3) v_uv: vec2<f32>
}

@vertex
fn main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    output.Position = viewUniforms.viewProjection * modelUniforms.model * vec4<f32>(input.a_position, 1.0);
    output.v_position = output.Position;
    output.v_normal = input.a_normal;
    output.v_color = input.a_color * modelUniforms.color * modelUniforms.intensity;
    output.v_uv = input.a_uv;
    return output;
}`;

const reflect = new WgslReflect(shader);

console.log(reflect.functions.length); // 1
console.log(reflect.structs.length); // 4
console.log(reflect.uniforms.length); // 2

// Shader entry points
console.log(reflect.entry.vertex.length); // 1, there is 1 vertex entry function.
console.log(reflect.entry.fragment.length); // 0, there are no fragment entry functions.
console.log(reflect.entry.compute.length); // 0, there are no compute entry functions.

console.log(reflect.entry.vertex[0].name); // "main", the name of the vertex entry function.

console.log(reflect.entry.vertex[0].resources.length); // 2, main uses modelUniforms and viewUniforms resource bindings.
console.log(reflect.entry.vertex[0].resources[0].name); // viewUniforms
console.log(reflect.entry.vertex[0].resources[1].name); // modelUniforms

// Vertex shader inputs
console.log(reflect.entry.vertex[0].inputs.length); // 4, inputs to "main"
console.log(reflect.entry.vertex[0].inputs[0].name); // "a_position"
console.log(reflect.entry.vertex[0].inputs[0].location); // 0
console.log(reflect.entry.vertex[0].inputs[0].locationType); // "location" (can be "builtin")
console.log(reflect.entry.vertex[0].inputs[0].type.name); // "vec3"
console.log(reflect.entry.vertex[0].inputs[0].type.format.name); // "f32"

// Gather the bind groups used by the shader.
const groups = reflect.getBindGroups();
console.log(groups.length); // 1
console.log(groups[0].length); // 4, bindings in group(0)

console.log(groups[0][1].resourceType); // ResourceType.Uniform, the type of resource at group(0) binding(1)
console.log(groups[0][1].size); // 96, the size of the uniform buffer.
console.log(groups[0][1].members.length); // 3, members in ModelUniforms.
console.log(groups[0][1].members[0].name); // "model", the name of the first member in the uniform buffer.
console.log(groups[0][1].members[0].offset); // 0, the offset of 'model' in the uniform buffer.
console.log(groups[0][1].members[0].size); // 64, the size of 'model'.
console.log(groups[0][1].members[0].type.name); // "mat4x4", the type of 'model'.
console.log(groups[0][1].members[0].type.format.name); // "f32", the format of the mat4x4.

console.log(groups[0][2].resourceType); // ResourceType.Sampler

console.log(groups[0][3].resourceType); // ResourceType.Texture
console.log(groups[0][3].type.name); // "texture_2d"
console.log(groups[0][3].type.format.name); // "f32"
```

---

Calculate the member information for a uniform buffer block:

```javascript
import { WgslReflect } from "./wgsl_reflect.module.js";

// WgslReflect can calculate the size and offset for members of a uniform buffer block.

const shader = `
struct A {                                     //             align(8)  size(32)
    u: f32,                                    // offset(0)   align(4)  size(4)
    v: f32,                                    // offset(4)   align(4)  size(4)
    w: vec2<f32>,                              // offset(8)   align(8)  size(8)
    @size(16) x: f32                          // offset(16)  align(4)  size(16)
}

struct B {                                     //             align(16) size(208)
    a: vec2<f32>,                              // offset(0)   align(8)  size(8)
    // -- implicit member alignment padding -- // offset(8)             size(8)
    b: vec3<f32>,                              // offset(16)  align(16) size(12)
    c: f32,                                    // offset(28)  align(4)  size(4)
    d: f32,                                    // offset(32)  align(4)  size(4)
    // -- implicit member alignment padding -- // offset(36)            size(12)
    @align(16) e: A,                           // offset(48)  align(16) size(32)
    f: vec3<f32>,                              // offset(80)  align(16) size(12)
    // -- implicit member alignment padding -- // offset(92)            size(4)
    g: @stride(32) array<A, 3>,                // offset(96)  align(8)  size(96)
    h: i32,                                    // offset(192) align(4)  size(4)
    // -- implicit struct size padding --      // offset(196)           size(12)
}

@group(0) @binding(0)
var<uniform> uniform_buffer: B;`;

const reflect = new WgslReflect(shader);

const u = reflect.uniforms[0];
console.log(u.size); // 208, the size of the uniform buffer in bytes
console.log(u.group); // 0
console.log(u.binding); // 0
console.log(u.members.length); // 8, members in B
console.log(u.members[0].name); // "a"
console.log(u.members[0].offset); // 0, the offset of 'a' in the buffer
console.log(u.members[0].size); // 8, the size of 'a' in bytes
console.log(u.members[0].type.name); // "vec2", the type of 'a'
console.log(u.members[0].type.format.name); // "f32", the format of the vec2.

console.log(u.members[4].name); // "e"
console.log(u.members[4].offset); // 48, the offset of 'e' in the buffer
console.log(u.members[4].size); // 32, the size of 'e' in the buffer
```
