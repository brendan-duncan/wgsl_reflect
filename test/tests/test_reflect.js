import { test, group } from "../test.js";
import { WgslReflect } from "../../src/wgsl_reflect.js";

group("Reflect", function() {
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

    test("blocks", function(test) {
        test.equals(reflect.blocks.length, 2);
    });

    test("uniforms", function(test) {
        test.equals(reflect.uniforms.length, 2);
        test.equals(reflect.uniforms[0].name, "viewUniforms");
        test.equals(reflect.uniforms[0].type.name, "ViewUniforms");
        test.notNull(reflect.getBlock(reflect.uniforms[0].type));
    });

    test("textures", function(test) {
        test.equals(reflect.textures.length, 1);
        test.equals(reflect.textures[0].name, "u_texture");
        test.equals(reflect.textures[0].type.name, "texture_2d");
        test.equals(reflect.textures[0].type.format.name, "f32");
        test.equals(reflect.textures[0].group, 0);
        test.equals(reflect.textures[0].binding, 3);
    });

    test("samplers", function(test) {
        test.equals(reflect.samplers.length, 1);
        test.equals(reflect.samplers[0].name, "u_sampler");
        test.equals(reflect.samplers[0].type.name, "sampler");
        test.equals(reflect.samplers[0].group, 0);
        test.equals(reflect.samplers[0].binding, 2);
    });

    test("uniformBufferInfo", function(test) {
        const buffer = reflect.getUniformBufferInfo(reflect.uniforms[1]);
        test.notNull(buffer);
        test.equals(buffer.type, "uniform", "buffer.type");
        test.equals(buffer.size, 96, "buffer.size");
        test.equals(buffer.group.value, "0", "buffer.group.value");
        test.equals(buffer.binding.value, "1", "buffer.binding.value");
        test.equals(buffer.members.length, 3, "buffer.members.length");
        test.equals(buffer.members[0].name, "model", "buffer.members[0].name");
        test.equals(buffer.members[1].name, "color", "buffer.members[1].name");
        test.equals(buffer.members[2].name, "intensity", "buffer.members[1].name");
    });

    test("getBindingGroups", function(test) {
        const groups = reflect.getBindGroups();
        test.equals(groups.length, 1);
        test.equals(groups[0].length, 4);
        test.equals(groups[0][0].type, "buffer");
        test.equals(groups[0][1].type, "buffer");
        test.equals(groups[0][2].type, "sampler");
        test.equals(groups[0][3].type, "texture");
        test.equals(groups[0][3].resource.type.name, "texture_2d");
        test.equals(groups[0][3].resource.type.format.name, "f32");
    });
});
