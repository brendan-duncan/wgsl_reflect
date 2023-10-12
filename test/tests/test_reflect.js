import { test, group } from "../test.js";
import { WgslReflect, ResourceType } from "../../../wgsl_reflect.module.js";

group("Reflect", function () {
  test("uniform u32", function (test) {
    const reflect = new WgslReflect(`
      @group(0) @binding(0) var<uniform> foo : u32;`);
    test.equals(reflect.uniforms.length, 1);
    test.equals(reflect.uniforms[0].name, "foo");
    test.equals(reflect.uniforms[0].type.name, "u32");
    test.equals(reflect.uniforms[0].type.size, 4);
  });

  test("uniform array<u32, 5>", function (test) {
    const reflect = new WgslReflect(`
      @group(0) @binding(0) var<uniform> foo : array<u32, 5>;`);
    test.equals(reflect.uniforms.length, 1);
    test.equals(reflect.uniforms[0].name, "foo");
    test.equals(reflect.uniforms[0].type.isArray, true);
    test.equals(reflect.uniforms[0].type.count, 5);
    test.equals(reflect.uniforms[0].type.size, 20);
    test.equals(reflect.uniforms[0].type.format.name, "u32");
    test.equals(reflect.uniforms[0].type.format.size, 4);
  });

  test("uniform array<array<u32, 6>, 5>", function (test) {
    const reflect = new WgslReflect(`
      @group(0) @binding(0) var<uniform> foo : array<array<u32, 6u>, 5>;`);
    test.equals(reflect.uniforms.length, 1);
    test.equals(reflect.uniforms[0].name, "foo");
    test.equals(reflect.uniforms[0].type.isArray, true);
    test.equals(reflect.uniforms[0].type.count, 5);
    test.equals(reflect.uniforms[0].type.stride, 24);
    test.equals(reflect.uniforms[0].type.size, 120);
    test.equals(reflect.uniforms[0].type.format.isArray, true);
    test.equals(reflect.uniforms[0].type.format.size, 24);
    test.equals(reflect.uniforms[0].type.format.stride, 4);
  });

  test("struct", function (test) {
    const reflect = new WgslReflect(`
      struct Bar {
        a : u32,
      };
      alias Bar1 = Bar;
      alias Bar2 = Bar1;
      const count = 2 * 2;
      struct Foo {
        a: u32,
        b: Bar,
        c: array<Bar2, count>,
      };
      @group(0) @binding(0) var<uniform> foo : Foo;`);
    test.equals(reflect.uniforms.length, 1);
    test.equals(reflect.uniforms[0].type.size, 24);
    test.equals(reflect.uniforms[0].type.members.length, 3);
    test.equals(reflect.uniforms[0].type.members[0].name, "a");
    test.equals(reflect.uniforms[0].type.members[0].offset, 0);
    test.equals(reflect.uniforms[0].type.members[0].size, 4);
    test.equals(reflect.uniforms[0].type.members[1].offset, 4);
    test.equals(reflect.uniforms[0].type.members[1].size, 4);
    test.equals(reflect.uniforms[0].type.members[2].type.format.name, "Bar");
    test.equals(reflect.uniforms[0].type.members[2].type.count, 4);
    test.equals(reflect.uniforms[0].type.members[2].offset, 8);
    test.equals(reflect.uniforms[0].type.members[2].size, 16);
  });

  test("entry functions", function (test) {
    const reflect = new WgslReflect(`
      struct ViewUniforms {
          viewProjection: mat4x4<f32>
      };
      
      struct ModelUniforms {
          model: mat4x4<f32>,
          color: vec4<f32>,
          intensity: f32
      };
      
      @binding(0) @group(0) var<uniform> viewUniforms: ViewUniforms;
      @binding(1) @group(0) var<uniform> modelUniforms: ModelUniforms;
      @binding(0) @group(1) var u_sampler: sampler;
      @binding(1) @group(1) var u_texture: texture_2d<f32>;
      
      struct VertexInput {
          @builtin(position) a_position: vec3<f32>,
          @location(1) a_normal: vec3<f32>,
          @location(2) a_color: vec4<f32>,
          @location(3) a_uv: vec2<f32>
      };
      
      struct VertexOutput {
          @builtin(position) Position: vec4<f32>,
          @location(0) v_position: vec4<f32>,
          @location(1) v_normal: vec3<f32>,
          @location(2) v_color: vec4<f32>,
          @location(3) v_uv: vec2<f32>,
      };
      
      @vertex
      fn vertex_main(input: VertexInput) -> VertexOutput {
          var output: VertexOutput;
          output.Position = viewUniforms.viewProjection * modelUniforms.model * vec4<f32>(input.a_position, 1.0);
          output.v_position = output.Position;
          output.v_normal = input.a_normal;
          output.v_color = input.a_color * modelUniforms.color * modelUniforms.intensity;
          output.v_uv = input.a_uv;
          return output;
      }
      
      @fragment
      fn frag_main() {}
      
      @compute @workgroup_size(8,4,1)
      fn sorter() { }
      
      @compute @workgroup_size(8u)
      fn reverser() { }
      
      // Using an pipeline-overridable constant.
      @id(42) override block_width = 12u;
      @compute @workgroup_size(block_width)
      fn shuffler() { }
    `);

    test.equals(reflect.entryPoints.vertex.length, 1);
    test.equals(reflect.entryPoints.fragment.length, 1);
    test.equals(reflect.entryPoints.compute.length, 3);

    test.equals(reflect.entryPoints.vertex[0].name, "vertex_main");
    test.equals(reflect.entryPoints.vertex[0].stage, "vertex");
    test.equals(reflect.entryPoints.vertex[0].inputs.length, 4);
    test.equals(reflect.entryPoints.vertex[0].inputs[0].name, "a_position");
    test.equals(reflect.entryPoints.vertex[0].inputs[0].location, "position");
    test.equals(reflect.entryPoints.vertex[0].inputs[1].location, 1);
    test.equals(reflect.entryPoints.vertex[0].inputs[2].location, 2);
    test.equals(reflect.entryPoints.vertex[0].inputs[3].location, 3);
    test.equals(reflect.entryPoints.vertex[0].outputs.length, 5);
    test.equals(reflect.entryPoints.vertex[0].outputs[0].name, "Position");
    test.equals(reflect.entryPoints.vertex[0].outputs[0].location, "position");

    test.equals(reflect.entryPoints.fragment[0].name, "frag_main");
    test.equals(reflect.entryPoints.fragment[0].stage, "fragment");

    test.equals(reflect.entryPoints.compute[0].name, "sorter");
    test.equals(reflect.entryPoints.compute[0].stage, "compute");

    test.equals(reflect.entryPoints.compute[1].name, "reverser");
    test.equals(reflect.entryPoints.compute[1].stage, "compute");

    test.equals(reflect.entryPoints.compute[2].name, "shuffler");
    test.equals(reflect.entryPoints.compute[2].stage, "compute");

    const bindGroups = reflect.getBindGroups();
    test.equals(bindGroups.length, 2);
    test.equals(bindGroups[0].length, 2);
    test.equals(bindGroups[0][0].resourceType, ResourceType.Uniform);
    test.equals(bindGroups[0][0].type.isStruct, true);
    test.equals(bindGroups[0][1].resourceType, ResourceType.Uniform);
    test.equals(bindGroups[1].length, 2);
    test.equals(bindGroups[1][0].resourceType, ResourceType.Sampler);
    test.equals(bindGroups[1][1].resourceType, ResourceType.Texture);
  });

  test("uniform buffer info", function (test) {
    const reflect = new WgslReflect(`
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
      var<uniform> uniform_buffer: B;`);
    test.equals(reflect.uniforms[0].size, 208);
    test.equals(reflect.uniforms[0].group, 0);
    test.equals(reflect.uniforms[0].binding, 0);
    test.equals(reflect.uniforms[0].members.length, 8);
    test.equals(reflect.uniforms[0].members[0].name, "a");
    test.equals(reflect.uniforms[0].members[0].type.name, "vec2");
    test.equals(reflect.uniforms[0].members[0].type.format.name, "f32");
    test.equals(reflect.uniforms[0].members[0].offset, 0);
    test.equals(reflect.uniforms[0].members[0].size, 8);

    test.equals(reflect.uniforms[0].members[4].name, "e");
    test.equals(reflect.uniforms[0].members[4].type.name, "A");
    test.equals(reflect.uniforms[0].members[4].type.members.length, 4);
    test.equals(reflect.uniforms[0].members[4].offset, 48);
    test.equals(reflect.uniforms[0].members[4].size, 32);
  });
});
