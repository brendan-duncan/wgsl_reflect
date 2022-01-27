# WebGPU Shading Language Reflection Library

A WebGPU Shading Language parser and reflection library for Javascript.

**wgsl_reflect** can parse a WGSL shader and analyze its contents, providing information about the shader. It can determine the bind group layout of the shader, resource bindings, uniform buffers, the members of a uniform buffer, their names, types, sizes, offsets into the buffer.

## Usage

The *wgsl_reflect.module.js* file is a self-contained roll-up of the library that can be included in your project and imported with:

```javascript
import { WgslReflect } from "./wgsl_reflect.module.js";
const reflect = new WgslReflect(shader_code);
```

## Try It Out
[WGSL Reflect Example](https://brendan-duncan.github.io/wgsl_reflect/example.html)

## Examples

Calculate the bind group information in the shader:

```javascript
import { WgslReflect } from "./wgsl_reflect.module.js";

const shader = `
struct ViewUniforms {
    viewProjection: mat4x4<f32>;
}

struct ModelUniforms {
    model: mat4x4<f32>;
    color: vec4<f32>;
    intensity: f32;
}

@binding(0) @group(0) var<uniform> viewUniforms: ViewUniforms;
@binding(1) @group(0) var<uniform> modelUniforms: ModelUniforms;
@binding(2) @group(0) var u_sampler: sampler;
@binding(3) @group(0) var u_texture: texture_2d<f32>;

struct VertexInput {
    @location(0) a_position: vec3<f32>;
    @location(1) a_normal: vec3<f32>;
    @location(2) a_color: vec4<f32>;
    @location(3) a_uv: vec2<f32>;
}

struct VertexOutput {
    @builtin(position) Position: vec4<f32>;
    @location(0) v_position: vec4<f32>;
    @location(1) v_normal: vec3<f32>;
    @location(2) v_color: vec4<f32>;
    @location(3) v_uv: vec2<f32>;
}

@stage(vertex)
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

// Vertex shader inputs
console.log(reflect.entry.vertex[0].inputs.length); // 4, inputs to "main"
console.log(reflect.entry.vertex[0].inputs[0].name); // "a_position"
console.log(reflect.entry.vertex[0].inputs[0].location); // 0
console.log(reflect.entry.vertex[0].inputs[0].locationType); // "location" (can be "builtin")
console.log(reflect.entry.vertex[0].inputs[0].type.name); // "vec3"
console.log(reflect.entry.vertex[0].inputs[0].type.format.name); // "f32"

// Bind groups
const groups = reflect.getBindGroups();
console.log(groups.length); // 1
console.log(groups[0].length); // 4, bindings in group(0)

console.log(groups[0][1].type); // "buffer", the type of resource at group(0) binding(1)
console.log(groups[0][1].resource.size); // 108, the size of the uniform buffer.
console.log(groups[0][1].resource.members.length); // 3, members in ModelUniforms.
console.log(groups[0][1].resource.members[0].name); // "model", the name of the first member in the uniform buffer.
console.log(groups[0][1].resource.members[0].offset); // 0, the offset of 'model' in the uniform buffer.
console.log(groups[0][1].resource.members[0].size); // 64, the size of 'model'.
console.log(groups[0][1].resource.members[0].type.name); // "mat4x4", the type of 'model'.
console.log(groups[0][1].resource.members[0].type.format.name); // "f32", the format of the mat4x4.

console.log(groups[0][2].type); // "sampler"

console.log(groups[0][3].type); // "texture"
console.log(groups[0][3].resource.type.name); // "texture_2d"
console.log(groups[0][3].resource.type.format.name); // "f32"
```

---

Calculate the member information for a uniform buffer block:

```javascript
import { WgslReflect } from "./wgsl_reflect.module.js";

// WgslReflect can calculate the size and offset for members of a uniform buffer block.

const shader = `
struct A {                                     //             align(8)  size(32)
    u: f32;                                    // offset(0)   align(4)  size(4)
    v: f32;                                    // offset(4)   align(4)  size(4)
    w: vec2<f32>;                              // offset(8)   align(8)  size(8)
    @size(16) x: f32;                          // offset(16)  align(4)  size(16)
}

struct B {                                     //             align(16) size(208)
    a: vec2<f32>;                              // offset(0)   align(8)  size(8)
    // -- implicit member alignment padding -- // offset(8)             size(8)
    b: vec3<f32>;                              // offset(16)  align(16) size(12)
    c: f32;                                    // offset(28)  align(4)  size(4)
    d: f32;                                    // offset(32)  align(4)  size(4)
    // -- implicit member alignment padding -- // offset(36)            size(12)
    @align(16) e: A;                           // offset(48)  align(16) size(32)
    f: vec3<f32>;                              // offset(80)  align(16) size(12)
    // -- implicit member alignment padding -- // offset(92)            size(4)
    g: @stride(32) array<A, 3>;                // offset(96)  align(8)  size(96)
    h: i32;                                    // offset(192) align(4)  size(4)
    // -- implicit struct size padding --      // offset(196)           size(12)
}

@group(0) @binding(0)
var<uniform> uniform_buffer: B;`;

const reflect = new WgslReflect(shader);

// Get the buffer info for the uniform var 'uniform_buffer'.
const info = reflect.getUniformBufferInfo(reflect.uniforms[0]);

console.log(info.size); // 208, the size of the uniform buffer in bytes
console.log(info.group); // 0
console.log(info.binding); // 0
console.log(info.members.length); // 7, members in B
console.log(info.members[0].name); // "a"
console.log(info.members[0].offset); // 0, the offset of 'a' in the buffer
console.log(info.members[0].size); // 8, the size of 'a' in bytes
console.log(info.members[0].type.name); // "vec2", the type of 'a'
console.log(info.members[0].type.format.name); // "f32", the format of the vec2.

console.log(info.members[4].name); // "e"
console.log(info.members[4].offset); // 48, the offset of 'e' in the buffer
console.log(info.members[4].size); // 32, the size of 'e' in the buffer
```
