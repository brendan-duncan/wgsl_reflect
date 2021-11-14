# WebGPU Shading Lanuguage (WGSL) Reflection Library

A WebGPU Shading Language parser and reflection library for Javascript.

## Example

```javascript
import { WgslReflect } from "./wgsl_reflect.js";

const shader = `
[[block]] struct ViewUniforms {
    viewProjection: mat4x4<f32>;
};

[[block]] struct ModelUniforms {
    model: mat4x4<f32>;
    color: vec4<f32>;
    intensity: f32;
};

[[binding(0), group(0)]] var<uniform> viewUniforms: ViewUniforms;
[[binding(1), group(0)]] var<uniform> modelUniforms: ModelUniforms;
[[binding(2), group(0)]] var u_sampler: sampler;
[[binding(3), group(0)]] var u_texture: texture_2d<f32>;

struct VertexInput {
    [[location(0)]] a_position: vec3<f32>;
    [[location(1)]] a_normal: vec3<f32>;
    [[location(2)]] a_color: vec4<f32>;
    [[location(3)]] a_uv: vec2<f32>;
};

struct VertexOutput {
    [[builtin(position)]] Position: vec4<f32>;
    [[location(0)]] v_position: vec4<f32>;
    [[location(1)]] v_normal: vec3<f32>;
    [[location(2)]] v_color: vec4<f32>;
    [[location(3)]] v_uv: vec2<f32>;
};

[[stage(vertex)]]
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

console.log(reflect.structs.length); // 4
console.log(reflect.blocks.length); // 2
console.log(reflect.uniforms.length); // 2

const info = reflect.getUniformBufferInfo(uniforms[1]);
console.log(info.size); // size of the uniform buffer in bytes: 108
console.log(info.group); // binding group: 0
console.log(info.binding); // binding index: 1
console.log(info.members.length); // 3 members in ModelUniforms
console.log(info.members[0].name); // model
console.log(info.members[0].offset); // The offset of 'model' in the uniform buffer is 0
console.log(info.members[0].size); // The size of 'model' is 64 bytes
console.log(info.members[0].type.name); // The type of 'model' is mat4x4
console.log(info.members[0].type.format.name); // The format of 'model' is f32 (mat4x4<f32>).
```
