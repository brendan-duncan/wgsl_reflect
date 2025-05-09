import { test, group } from "../test.js";
import { WgslReflect, ResourceType } from "../../../wgsl_reflect.module.js";

export async function run() {
  await group("Reflect", async function () {
    await test("switch", async function (test) {
      const t = new WgslReflect(`
        @group(0) @binding(0) var<storage> buffer1: array<u32>;
        @compute
        fn main() {
        let count = 0;
          switch(count) {
            case 0: {
              let a = buffer1[0]; // issue here
            }
          }
        }`);
        test.equals(t.entry.compute.length, 1);
        test.equals(t.entry.compute[0].resources.length, 1);
    });

    await test("deferred uniform usage", async function (test) {
      const t = new WgslReflect(`
        fn foo() {
          let f = uni.x;
        }
        @vertex fn vsMain() {
          foo();
        }
        @fragment fn fsMain() {
          let f = uni.y;
        }
        @group(0) @binding(0) var<uniform> uni: vec4<f32>;`);
      test.equals(t.uniforms.length, 1);
      test.equals(t.entry.vertex[0].resources.length, 1);
      test.equals(t.entry.fragment[0].resources.length, 1);
    });

    await test("deferred alias definition", async function (test) {
      const t = new WgslReflect(`
        struct Uniforms {
            size: vec2<f32>,
            light: LightAlias,
            lights: LightArray
        }
        struct Light {
            power: f32,
            position: vec2<i32>
        }
        alias LightAlias = Light;
        alias LightArray = array<Light, 3>;
        struct X {
          light: Light,
          lights: array<Light, 3>
        }
        @group(0) @binding(0) var<uniform> uni: Uniforms;`);
        test.equals(t.uniforms.length, 1);
        test.equals(t.uniforms[0].type.size, 72);
    });

    await test("deferred struct definition", async function (test) {
      const t = new WgslReflect(`
        struct Uniforms {
            size: vec2<f32>,
            light: Light,
            lights: array<Light,3>
        }
        struct Light {
            power: f32,
            position: vec2<i32>
        }
        struct X {
          light: Light,
          lights: array<Light, 3>
        }
        @group(0) @binding(0) var<uniform> uni: Uniforms;`);
        test.equals(t.uniforms.length, 1);
        test.equals(t.uniforms[0].type.size, 72);
    });

    await test("texture_depth_multisampled_2d", function (test) {
      const t = new WgslReflect(`
          @group(0) @binding(0) var msaaDepth: texture_2d<f32>;
          @group(0) @binding(1) var msaaDepth: texture_2d_array<f32>;
          @group(0) @binding(2) var msaaDepth: texture_cube<f32>;
          @group(0) @binding(3) var msaaDepth: texture_cube_array<f32>;
          @group(0) @binding(4) var msaaDepth: texture_multisampled_2d<f32>;
          @group(0) @binding(5) var msaaDepth: texture_depth_2d;
          @group(0) @binding(6) var msaaDepth: texture_depth_2d_array;
          @group(0) @binding(7) var msaaDepth: texture_depth_cube;
          @group(0) @binding(8) var msaaDepth: texture_depth_cube_array;
          @group(0) @binding(9) var msaaDepth: texture_depth_multisampled_2d;
          @group(0) @binding(10) var msaaDepth: texture_storage_2d<rgba8unorm, read_write>;
          @group(0) @binding(11) var msaaDepth: texture_storage_2d_array<rgba8unorm, read_write>;
          @group(0) @binding(12) var msaaDepth: texture_external;

          @compute @workgroup_size(8, 8)
          fn main(@builtin(global_invocation_id) globalId : vec3<u32>) {
            let sampleCount = textureNumSamples(msaaDepth);
          }`);
      test.equals(t.textures.length, 11);
      test.equals(t.storage.length, 2);
    });

    await test("multi entry", function (test) {
      const t = new WgslReflect(`
          var<private> rand_seed : vec2f;

          fn init_rand(invocation_id : u32, seed : vec4f) {
            rand_seed = seed.xz;
            rand_seed = fract(rand_seed * cos(35.456+f32(invocation_id) * seed.yw));
            rand_seed = fract(rand_seed * cos(41.235+f32(invocation_id) * seed.xw));
          }
          struct RenderParams {
            modelViewProjectionMatrix : mat4x4f,
            right : vec3f,
            up : vec3f
          }
          @binding(0) @group(0) var<uniform> render_params : RenderParams;

          struct VertexInput {
            @location(0) position : vec3f,
            @location(1) color : vec4f,
            @location(2) quad_pos : vec2f, // -1..+1
          }
          struct VertexOutput {
            @builtin(position) position : vec4f,
            @location(0) color : vec4f,
            @location(1) quad_pos : vec2f, // -1..+1
          }
          @vertex
          fn vs_main(in : VertexInput) -> VertexOutput {
            var out : VertexOutput;
            return out;
          }
          @fragment
          fn fs_main(in : VertexOutput) -> @location(0) vec4f {
            return in.color;
          }
          struct SimulationParams {
            deltaTime : f32,
            brightnessFactor : f32,
            seed : vec4f,
          }
          struct Particle {
            position : vec3f,
            lifetime : f32,
            color    : vec4f,
            velocity : vec3f,
          }
          struct Particles {
            particles : array<Particle>,
          }
          @binding(0) @group(0) var<uniform> sim_params : SimulationParams;
          @binding(1) @group(0) var<storage, read_write> data : Particles;
          @binding(2) @group(0) var texture : texture_2d<f32>;

          @compute @workgroup_size(64)
          fn simulate(@builtin(global_invocation_id) global_invocation_id : vec3u) {
            init_rand(idx, sim_params.seed);
          }`);
          test.equals(t.entry.vertex.length, 1);
          test.equals(t.entry.fragment.length, 1);
          test.equals(t.entry.compute.length, 1);
    });

    await test("array_no_format", function (test) {
      const t = new WgslReflect(`
        @vertex fn vs() -> VertexData {
          let pos = array(
            vec2f( 0.0,  0.366),  // top center: (√3/2)-0.5
            vec2f(-0.5, -0.5),  // bottom left
            vec2f( 0.5, -0.5)   // bottom right
          );
        }`);
        test.equals(t.entry.vertex.length, 1);
    });
    await test("builtin", function (test) {
      const reflect = new WgslReflect(`@compute @workgroup_size(64) fn compute(@builtin(global_invocation_id) id : vec3<u32>) {
        if (id.x > 1000.) { return; }
        let f = vec2(0.);
      }`);
      test.equals(reflect.entry.compute.length, 1);
    });

    await test("override", function (test) {
      const reflect = new WgslReflect(`override red = 0.0;
        override green = 0.0;
        override blue = 0.0;
        @fragment fn fs() -> @location(0) vec4f {
          return vec4f(red, green, blue, 1.0);
        }`);
        test.equals(reflect.overrides.length, 3);
        test.equals(reflect.entry.fragment[0].name, "fs");
        test.equals(reflect.entry.fragment[0].overrides.length, 3);
    });

    await test("f16", function (test) {
      const reflect = new WgslReflect(`
        @binding(0) @group(0) var<uniform> a1: f16;            // This is correctly sized at 2 bytes!
        @binding(0) @group(1) var<uniform> a2: vec2<f16>;      // This should be 4 bytes, not 8
        @binding(0) @group(2) var<uniform> a3: vec3<f16>;      // This should be 6 bytes, not 12
        @binding(0) @group(3) var<uniform> a4: vec4<f16>;      // This should be 8 bytes, not 16

        @binding(0) @group(4) var<uniform> a5: mat2x2<f16>;    // This should be 8 bytes, not 16
        @binding(0) @group(5) var<uniform> a6: mat2x3<f16>;    // This should be 16 bytes, not 32
        @binding(0) @group(6) var<uniform> a7: mat2x4<f16>;    // This should be 16 bytes, not 32
        @binding(0) @group(7) var<uniform> a8: mat3x2<f16>;    // This should be 12 bytes, not 24
        @binding(0) @group(8) var<uniform> a9: mat3x3<f16>;    // This should be 24 bytes, not 48
        @binding(0) @group(9) var<uniform> a10: mat3x4<f16>;   // This should be 24 bytes, not 48
        @binding(0) @group(10) var<uniform> a11: mat4x2<f16>;  // This should be 16 bytes, not 32
        @binding(0) @group(11) var<uniform> a11: mat4x3<f16>;  // This should be 32 bytes, not 64
        @binding(0) @group(12) var<uniform> a11: mat4x4<f16>;  // This should be 32 bytes, not 64`);

        test.equals(reflect.uniforms.length, 13);
        test.equals(reflect.uniforms[0].size, 2);
        test.equals(reflect.uniforms[1].size, 4);
        test.equals(reflect.uniforms[2].size, 6);
        test.equals(reflect.uniforms[3].size, 8);
        test.equals(reflect.uniforms[4].size, 8);
        test.equals(reflect.uniforms[5].size, 16);
        test.equals(reflect.uniforms[6].size, 16);
        test.equals(reflect.uniforms[7].size, 12);
        test.equals(reflect.uniforms[8].size, 24);
        test.equals(reflect.uniforms[9].size, 24);
        test.equals(reflect.uniforms[10].size, 16);
        test.equals(reflect.uniforms[11].size, 32);
        test.equals(reflect.uniforms[12].size, 32);
    });

    await test("uniform index", function (test) {
      const reflect = new WgslReflect(`
        struct BatchIndex {
          index: u32,
        }
        @group(0) @binding(2) var<uniform>  batchIndex: BatchIndex;
        @group(0) @binding(3) var<storage, read> batchOffsets: array<u32>;
        @vertex
        fn main() {
          let batchOffset = batchOffsets[batchIndex.index];
        }`);
        test.equals(reflect.uniforms.length, 1);
        test.equals(reflect.uniforms[0].name, "batchIndex");
        test.equals(reflect.entry.vertex[0].resources.length, 2);
        test.equals(reflect.entry.vertex[0].resources[0].name, "batchOffsets");
        test.equals(reflect.entry.vertex[0].resources[1].name, "batchIndex");
    });

    await test("enable", function (test) {
      const reflect = new WgslReflect(`enable chromium_experimental_subgroups;
        @compute @workgroup_size(64) fn main(
            @builtin(global_invocation_id) global_id : vec3u,
            @builtin(subgroup_size) sg_size : u32,
            @builtin(subgroup_invocation_id) sg_id : u32) {
        }`);
      test.equals(reflect.functions.length, 1);
    });

    await test("requires", function(test) {
      const reflect = new WgslReflect(`requires readonly_and_readwrite_storage_textures;
        @group(0) @binding(0) var tex : texture_storage_2d<r32uint, read_write>;
        @compute @workgroup_size(1, 1)
        fn main(@builtin(local_invocation_id) local_id: vec3u) {
          var data = textureLoad(tex, vec2i(local_id.xy));
          data.x *= 2;
          textureStore(tex, vec2i(local_id.xy), data);
        }`);
        test.equals(reflect.functions.length, 1);
    });

    await test("read_write storage buffer", function (test) {
      const reflect = new WgslReflect(`
        struct Particle {
          pos : vec2<f32>,
          vel : vec2<f32>,
        }
        
        struct Particles {
          particles : array<Particle>,
        }
        
        @binding(0) @group(0) var<storage, read> particlesA: Particles;
        @binding(1) @group(0) var<storage, read_write> particlesB : Particles;
        
        @compute @workgroup_size(64)
        fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3<u32>) {
          var index = GlobalInvocationID.x;
          var vPos = particlesA.particles[index].pos;
          particlesB.particles[index].pos = vPos;
        }`);
      test.equals(reflect.storage.length, 2);
      test.equals(reflect.functions.length, 1);
      test.equals(reflect.functions[0].resources.length, 2);
      test.equals(reflect.functions[0].resources[0].name, "particlesA");
      test.equals(reflect.functions[0].resources[1].name, "particlesB");
    });

    await test("unused structs", function (test) {
      const reflect = new WgslReflect(`
        struct A {
          a: u32,
        };
        struct B {
          b: u32,
        };
        struct C {
          c: u32,
        };
        fn notInUse() -> void { }
        fn inUse2() -> void {
          let b = B(1);
        }
        fn inUse() -> void { inUse2(); }
        @group(0) @binding(0) var<uniform> foo : A;
        @vertex
        fn vertex_main() -> void {
          inUse();
        }`);
      test.equals(reflect.structs.length, 3);
      
      test.equals(reflect.structs[0].startLine, 2);
      test.equals(reflect.structs[0].endLine, 4);

      test.equals(reflect.structs[1].startLine, 5);
      test.equals(reflect.structs[1].endLine, 7);

      test.equals(reflect.structs[2].startLine, 8);
      test.equals(reflect.structs[2].endLine, 10);

      test.equals(reflect.entry.vertex.length, 1);
      test.equals(reflect.entry.vertex[0].startLine, 18);
      test.equals(reflect.entry.vertex[0].endLine, 20);

      test.equals(reflect.structs[0].inUse, true, "A inUse"); // A, used by uniform
      test.equals(reflect.structs[1].inUse, true, "B inUse"); // B, used by inUse2
      test.equals(reflect.structs[2].inUse, false, "C inUse"); // C is not used

      test.equals(reflect.functions.length, 4);
      test.equals(reflect.functions[0].name, "notInUse");
      test.equals(reflect.functions[0].inUse, false, "notInUse");
      test.equals(reflect.functions[0].calls.size, 0, "notInUse calls");
      test.equals(reflect.functions[1].name, "inUse2");
      test.equals(reflect.functions[1].inUse, true, "inUse2");
      test.equals(reflect.functions[1].calls.size, 0, "inUse2 calls");
      test.equals(reflect.functions[2].name, "inUse");
      test.equals(reflect.functions[2].inUse, true, "inUse");
      test.equals(reflect.functions[2].calls.size, 1, "inUse calls"); // inUse2
      test.equals(reflect.functions[3].name, "vertex_main");
      test.equals(reflect.functions[3].inUse, true, "vertex_main");
      test.equals(reflect.functions[3].calls.size, 1, "vertex_main calls"); // inUse
    });

    await test("uniform u32", function (test) {
      const reflect = new WgslReflect(`
        @group(0) @binding(0) var<uniform> foo : u32;`);
      test.equals(reflect.uniforms.length, 1);
      test.equals(reflect.uniforms[0].name, "foo");
      test.equals(reflect.uniforms[0].type.name, "u32");
      test.equals(reflect.uniforms[0].type.size, 4);
    });

    await test("uniform array<u32, 5>", function (test) {
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

    await test("uniform array<array<u32, 6>, 5>", function (test) {
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

    await test("struct", function (test) {
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

    await test("entry functions", function (test) {
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

      test.equals(reflect.entry.vertex.length, 1);
      test.equals(reflect.entry.fragment.length, 1);
      test.equals(reflect.entry.compute.length, 3);

      test.equals(reflect.entry.vertex[0].name, "vertex_main");
      test.equals(reflect.entry.vertex[0].stage, "vertex");
      test.equals(reflect.entry.vertex[0].inputs.length, 4);
      test.equals(reflect.entry.vertex[0].inputs[0].name, "a_position");
      test.equals(reflect.entry.vertex[0].inputs[0].location, "position");
      test.equals(reflect.entry.vertex[0].inputs[1].location, 1);
      test.equals(reflect.entry.vertex[0].inputs[2].location, 2);
      test.equals(reflect.entry.vertex[0].inputs[3].location, 3);
      test.equals(reflect.entry.vertex[0].outputs.length, 5);
      test.equals(reflect.entry.vertex[0].outputs[0].name, "Position");
      test.equals(reflect.entry.vertex[0].outputs[0].location, "position");

      test.equals(reflect.entry.fragment[0].name, "frag_main");
      test.equals(reflect.entry.fragment[0].stage, "fragment");

      test.equals(reflect.entry.compute[0].name, "sorter");
      test.equals(reflect.entry.compute[0].stage, "compute");

      test.equals(reflect.entry.compute[1].name, "reverser");
      test.equals(reflect.entry.compute[1].stage, "compute");

      test.equals(reflect.entry.compute[2].name, "shuffler");
      test.equals(reflect.entry.compute[2].stage, "compute");

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

    await test("uniform buffer info", function (test) {
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

    await test("alias struct", function (test) {
      const shader = `alias foo = u32;
      alias bar = foo;
      struct Vehicle {
        num_wheels: bar,
        mass_kg: f32,
      }
      alias Car = Vehicle;
      const num_cars = 2 * 2;
      struct Ship {
          cars: array<Car, num_cars>,
      };
      const a_bicycle = Car(2, 10.5);
      const bike_num_wheels = a_bicycle.num_wheels;
      struct Ocean {
          things: array<Ship, a_bicycle.num_wheels>,
      };
      @group(0) @binding(0) var<uniform> ocean: Ocean;`;

      const reflect = new WgslReflect(shader);
      test.equals(reflect.uniforms.length, 1);
      test.equals(reflect.uniforms[0].size, 64);
    });

    await test("const", function (test) {
      const shader = `const NUM_COLORS = 10 + 2;
      @group(0) @binding(0) var<uniform> uni: array<vec4f, NUM_COLORS>;`;
      const reflect = new WgslReflect(shader);
      test.equals(reflect.uniforms.length, 1);
      test.equals(reflect.uniforms[0].size, 16 * 12);
    });

    await test("const2", function (test) {
      const shader = `const FOO = radians(90);
      const BAR = sin(FOO);
      const NUM_COLORS = u32(BAR + 3); // result 4
      @group(0) @binding(0) var<uniform> uni: array<vec4f, NUM_COLORS>;`;
      const reflect = new WgslReflect(shader);
      test.equals(reflect.uniforms.length, 1);
      test.equals(reflect.uniforms[0].type.size, 16 * 4);
    });

    await test("alias", function (test) {
      const shader = `alias material_index = u32;
          alias color = vec3f;
          struct material {
              index: material_index,
              diffuse: color,
          }
          @group(0) @binding(1) var<storage> materials: array<material, 10>;`;

      const reflect = new WgslReflect(shader);
      test.equals(reflect.aliases.length, 2);
    });

    await test("nested-alias", function (test) {
      const shader = `
            struct Foo {
              a: u32,
              b: f32,
            };
            alias foo1 = Foo;
            alias foo2 = foo1;
            alias foo3 = foo2;
            @group(0) @binding(1) var<storage> materials: foo3;
      `;
      const reflect = new WgslReflect(shader);
      test.equals(reflect.aliases.length, 3);
      test.equals(reflect.storage[0].type.isArray, false);
      test.equals(reflect.storage[0].type.isStruct, true);
      test.equals(reflect.storage[0].type.members.length, 2);
      test.equals(reflect.storage[0].type.size, 8);
    });

    await test("nested-alias-array", function (test) {
      const shader = `
          struct Foo {
            a: u32,
            b: f32,
          };
          alias foo1 = Foo;
          alias foo2 = foo1;
          alias foo3 = foo2;
          @group(0) @binding(1) var<storage> materials: array<foo3, 10>;
      `;
      const reflect = new WgslReflect(shader);
      test.equals(reflect.aliases.length, 3);
      test.equals(reflect.storage[0].type.isStruct, false);
      test.equals(reflect.storage[0].type.isArray, true);
      test.equals(reflect.storage[0].type.format.isStruct, true);
      test.equals(reflect.storage[0].type.format.members.length, 2);
      test.equals(reflect.storage[0].type.size, 80);
    });

    await test("typedef", function (test) {
      const shader = `alias Arr_1 = array<vec4<f32>, 20u>;

          struct VGlobals {
            x_Time : vec4<f32>,
            x_WorldSpaceCameraPos : vec3<f32>,
            @size(4)
            padding : u32,
            x_ProjectionParams : vec4<f32>,
            unity_FogParams : vec4<f32>,
            unity_MatrixV : mat4x4<f32>,
            unity_MatrixVP : mat4x4<f32>,
            x_MaxDepth : f32,
            x_MaxWaveHeight : f32,
            @size(8)
            padding_1 : u32,
            x_VeraslWater_DepthCamParams : vec4<f32>,
            x_WaveCount : u32,
            @size(12)
            padding_2 : u32,
            waveData : Arr_1,
          }
          @group(0) @binding(24) var<uniform> x_75 : VGlobals;`;
      const reflect = new WgslReflect(shader);

      test.equals(reflect.uniforms.length, 1);
      test.equals(reflect.uniforms[0].name, "x_75");
      test.equals(reflect.uniforms[0].type.size, 560);
    });

    const shader = `
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
  @binding(2) @group(0) var u_sampler: sampler;
  @binding(3) @group(0) var u_texture: texture_2d<f32>;

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
  `;

    const reflect = new WgslReflect(shader);

    await test("struct", function (test) {
      test.equals(reflect.structs.length, 4);

      const names = reflect.structs.map((s) => s.name);
      test.true(names.includes("ViewUniforms"));
      test.true(names.includes("ModelUniforms"));
      test.true(names.includes("VertexInput"));
      test.true(names.includes("VertexOutput"));
    });

    await test("uniforms", function (test) {
      test.equals(reflect.uniforms.length, 2);
      test.equals(reflect.uniforms[0].name, "viewUniforms");
      test.equals(reflect.uniforms[0].type.name, "ViewUniforms");
    });

    await test("textures", function (test) {
      test.equals(reflect.textures.length, 1);
      test.equals(reflect.textures[0].name, "u_texture");
      test.equals(reflect.textures[0].type.name, "texture_2d");
      test.equals(reflect.textures[0].type.format.name, "f32");
      test.equals(reflect.textures[0].group, 0);
      test.equals(reflect.textures[0].binding, 3);
    });

    await test("samplers", function (test) {
      test.equals(reflect.samplers.length, 1);
      test.equals(reflect.samplers[0].name, "u_sampler");
      test.equals(reflect.samplers[0].type.name, "sampler");
      test.equals(reflect.samplers[0].group, 0);
      test.equals(reflect.samplers[0].binding, 2);
    });

    await test("uniformBufferInfo", function (test) {
      test.equals(reflect.uniforms[1].type.name, "ModelUniforms", "buffer.type");
      test.equals(reflect.uniforms[1].size, 96, "buffer.size");
      test.equals(reflect.uniforms[1].group, 0, "buffer.group.value");
      test.equals(reflect.uniforms[1].binding, 1, "buffer.binding.value");
      test.equals(reflect.uniforms[1].members.length, 3, "buffer.members.length");
      test.equals(
        reflect.uniforms[1].members[0].name,
        "model",
        "buffer.members[0].name"
      );
      test.equals(
        reflect.uniforms[1].members[1].name,
        "color",
        "buffer.members[1].name"
      );
      test.equals(
        reflect.uniforms[1].members[2].name,
        "intensity",
        "buffer.members[1].name"
      );
    });

    await test("getBindingGroups", function (test) {
      const groups = reflect.getBindGroups();
      test.equals(groups.length, 1);
      test.equals(groups[0].length, 4);
      test.equals(groups[0][0].resourceType, ResourceType.Uniform);
      test.equals(groups[0][1].resourceType, ResourceType.Uniform);
      test.equals(groups[0][2].resourceType, ResourceType.Sampler);
      test.equals(groups[0][3].resourceType, ResourceType.Texture);
      test.equals(groups[0][3].type.name, "texture_2d");
      test.equals(groups[0][3].type.format.name, "f32");
    });

    await test("entry", function (test) {
      test.equals(reflect.entry.vertex.length, 1);
      test.equals(reflect.entry.fragment.length, 1);
      test.equals(reflect.entry.compute.length, 3);
    });

    await test("vertexInputs", function (test) {
      const inputs = reflect.entry.vertex[0].inputs;
      test.equals(inputs.length, 4);
      test.validateObject(inputs[0], {
        name: "a_position",
        locationType: "builtin",
        location: "position",
        type: { name: "vec3" },
      });

      test.validateObject(inputs[1], {
        name: "a_normal",
        locationType: "location",
        location: 1,
        type: { name: "vec3" },
      });
    });

    await test("storageBuffers", function (test) {
      const shader = `@group(0) @binding(0) var<storage, read> x : array<f32>;
          @group(0) @binding(1) var<storage, read> y : array<f32>;
          @group(0) @binding(2) var<storage, write> z : array<f32>;
          
          @stage(compute) @workgroup_size(64)
          fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
            // Guard against out-of-bounds work group sizes
            var idx = global_id.x;
            z[idx] = x[idx] + y[idx];
          }`;
      const reflect = new WgslReflect(shader);

      const groups = reflect.getBindGroups();

      test.equals(reflect.storage.length, 3);
      test.equals(groups.length, 1);
      test.equals(groups[0].length, 3);
      test.equals(groups[0][0].resourceType, ResourceType.Storage);
      test.equals(groups[0][0].name, "x");
      test.equals(groups[0][0].type.name, "array");
      test.equals(groups[0][0].type.format.name, "f32");
      test.equals(groups[0][1].resourceType, ResourceType.Storage);
      test.equals(groups[0][1].name, "y");
      test.equals(groups[0][1].type.name, "array");
      test.equals(groups[0][1].type.format.name, "f32");
      test.equals(groups[0][2].resourceType, ResourceType.Storage);
      test.equals(groups[0][2].name, "z");
      test.equals(groups[0][2].type.name, "array");
      test.equals(groups[0][2].type.format.name, "f32");
    });

    await test("nested structs", function (test) {
      const shader = `struct ViewUniforms {
              viewProjection: mat4x4<f32>
          };
          
          struct ModelUniforms {
              model: mat4x4<f32>,
              color: vec4<f32>,
              intensity: f32,
              view: array<ViewUniforms,2>,
              f32Array: array<f32,2>
          };
          @group(0) @binding(0) var<uniform> model : ModelUniforms;
          @binding(1) @group(0) var<uniform> uArray: array<vec4<f32>, 7>;
          @binding(2) @group(0) var<uniform> uFloat: f32;`;
      const reflect = new WgslReflect(shader);

      test.equals(reflect.uniforms.length, 3);

      const s1 = reflect.structs[1];
      test.equals(s1.members.length, 5);
      test.equals(s1.members[0].name, "model");
      test.equals(s1.members[0].isStruct, false);
      test.equals(s1.members[0].offset, 0);
      test.equals(s1.members[0].size, 64);
      test.equals(s1.members[0].stride, 64);
      test.equals(s1.members[1].name, "color");
      test.equals(s1.members[1].offset, 64);
      test.equals(s1.members[1].size, 16);
      test.equals(s1.members[2].name, "intensity");
      test.equals(s1.members[2].offset, 80);
      test.equals(s1.members[2].size, 4);
      test.equals(s1.members[3].name, "view");
      test.equals(s1.members[3].type.name, "array");
      test.equals(s1.members[3].type.format.name, "ViewUniforms");
      test.equals(s1.members[3].isStruct, false);
      test.equals(s1.members[3].isArray, true);
      test.equals(s1.members[3].count, 2);
      test.equals(s1.members[3].offset, 96);
      test.equals(s1.members[3].size, 128);
      test.equals(s1.members[3].stride, 64);
      test.equals(s1.members[3].format.members.length, 1);
      test.equals(s1.members[3].format.members[0].name, "viewProjection");
      test.equals(s1.members[3].format.members[0].offset, 0);
      test.equals(s1.members[3].format.members[0].size, 64);
      test.equals(s1.members[4].name, "f32Array");
      test.equals(s1.members[4].count, 2);
      test.equals(s1.members[4].offset, 224);
      test.equals(s1.members[4].size, 8);
      test.equals(s1.members[4].stride, 4);

      test.equals(reflect.uniforms[0].name, "model");
      test.equals(reflect.uniforms[0].type.name, "ModelUniforms");
      test.equals(reflect.uniforms[0].members.length, 5);
      test.equals(reflect.uniforms[0].size, 240);

      test.equals(reflect.uniforms[1].name, "uArray");
      test.equals(reflect.uniforms[1].type.name, "array");
      test.equals(reflect.uniforms[1].type.format.name, "vec4");
      test.equals(reflect.uniforms[1].type.format.format.name, "f32");
      test.equals(reflect.uniforms[1].size, 112);
      test.equals(reflect.uniforms[1].isArray, true);
      test.equals(reflect.uniforms[1].stride, 16);
      test.equals(reflect.uniforms[1].count, 7);

      test.equals(reflect.uniforms[2].name, "uFloat");
      test.equals(reflect.uniforms[2].type.name, "f32");
      test.equals(reflect.uniforms[2].size, 4);
    });

    await test("nested structs", function (test) {
      const shader = `
          struct SomeStruct {
              value: f32,
          };

          struct SomeOtherStruct {
              member1: f32,
              member2: array<f32, 4>,
              member3: SomeStruct,
              member4: array<SomeStruct, 4>,
          };

          @group(0) @binding(0) var<uniform> uni1 : f32;
          @group(0) @binding(1) var<uniform> uni2 : array<f32, 4>;
          @group(0) @binding(2) var<uniform> uni3 : SomeStruct;
          @group(0) @binding(2) var<uniform> uni4 : array<SomeStruct, 4>;

          @group(1) @binding(0) var<storage> storage1 : f32;
          @group(1) @binding(1) var<storage> storage2 : array<f32, 4>;
          @group(1) @binding(2) var<storage> storage3 : SomeStruct;
          @group(1) @binding(2) var<storage> storage4 : array<SomeStruct, 4>;
          `;
      const reflect = new WgslReflect(shader);
      const uniforms = Object.fromEntries(
        reflect.uniforms.map((u) => [u.name, u])
      );
      const structs = Object.fromEntries(reflect.structs.map((s) => [s.name, s]));
      const storages = Object.fromEntries(
        reflect.storage.map((s) => [s.name, s])
      );

      const members = Object.fromEntries(
        structs.SomeOtherStruct.members.map((m) => [m.name, m])
      );

      const compare = (uniName, memberName, storageName) => {
        const uniInfo = uniforms[uniName];
        const member = members[memberName];
        const storageInfo = storages[storageName];

        //console.log(uniInfo, member);
        test.equals(
          uniInfo.size,
          member.size,
          `size: ${uniName} vs ${memberName}`
        );
        test.equals(
          storageInfo.size,
          member.size,
          `size: ${storageName} vs ${memberName}`
        );

        test.equals(
          !!uniInfo.isArray,
          !!member.isArray,
          `isArray: ${uniName} vs ${memberName}`
        );
        test.equals(
          !!storageInfo.isArray,
          !!member.isArray,
          `isArray: ${storageName} vs ${memberName}`
        );
        if (!uniInfo.isArray) {
          test.equals(
            uniInfo.arrayCount,
            member.arrayCount,
            `arrayCount: ${uniName} vs ${memberName}`
          );
          test.equals(
            uniInfo.arrayStride,
            member.arrayStride,
            `arrayStride: ${uniName} vs ${memberName}`
          );
          test.equals(
            storageInfo.arrayCount,
            member.arrayCount,
            `arrayCount: ${storageName} vs ${memberName}`
          );
          test.equals(
            storageInfo.arrayStride,
            member.arrayStride,
            `arrayStride: ${storageName} vs ${memberName}`
          );
        }

        test.equals(
          !!uniInfo.isStruct,
          !!member.isStruct,
          `isStruct: ${uniName} vs ${memberName}`
        );
        test.equals(
          !!storageInfo.isStruct,
          !!member.isStruct,
          `isStruct: ${storageName} vs ${memberName}`
        );
        if (uniInfo.isStruct) {
          test.equals(
            uniInfo.members.length,
            member.members.length,
            `members.length: ${uniName} vs ${memberName}`
          );
          test.equals(
            storageInfo.members.length,
            member.members.length,
            `members.length: ${storageName} vs ${memberName}`
          );
          // should we test deeper?
        }
      };

      compare("uni1", "member1", "storage1");
      compare("uni2", "member2", "storage2");
      compare("uni3", "member3", "storage3");
      compare("uni4", "member4", "storage4");
    });

    function roundUp(k, n) {
      return Math.ceil(n / k) * k;
    }

    function testType(test, type) {
      const shader = `
          struct Types {
              m_base: ${type},
              m_vec2: vec2<${type}>,
              m_vec3: vec3<${type}>,
              m_vec4: vec4<${type}>,
              m_mat2x2: mat2x2<${type}>,
              m_mat3x2: mat3x2<${type}>,
              m_mat4x2: mat4x2<${type}>,
              m_mat2x3: mat2x3<${type}>,
              m_mat3x3: mat3x3<${type}>,
              m_mat4x3: mat4x3<${type}>,
              m_mat2x4: mat2x4<${type}>,
              m_mat3x4: mat3x4<${type}>,
              m_mat4x4: mat4x4<${type}>,
          };
          @group(0) @binding(0) var<uniform> u: Types;`;
      //console.log(shader);
      const reflect = new WgslReflect(shader);

      const info = reflect.structs[0];

      const fields = [
        { name: "m_base", align: 4, size: 4 },
        { name: "m_vec2", align: 8, size: 8 },
        { name: "m_vec3", align: 16, size: 12 },
        { name: "m_vec4", align: 16, size: 16 },
        { name: "m_mat2x2", align: 8, size: 16 },
        { name: "m_mat3x2", align: 8, size: 24 },
        { name: "m_mat4x2", align: 8, size: 32 },
        { name: "m_mat2x3", align: 16, size: 32 },
        { name: "m_mat3x3", align: 16, size: 48 },
        { name: "m_mat4x3", align: 16, size: 64 },
        { name: "m_mat2x4", align: 16, size: 32 },
        { name: "m_mat3x4", align: 16, size: 48 },
        { name: "m_mat4x4", align: 16, size: 64 },
      ];
      test.equals(info.members.length, fields.length);

      const divisor = type === "f16" ? 2 : 1;
      let offset = 0;
      for (let i = 0; i < fields.length; ++i) {
        const { name, align, size } = fields[i];
        offset = roundUp(align / divisor, offset);

        const member = info.members[i];
        test.equals(member.name, name, `name ${i}`);
        test.equals(member.isStruct, false, `isStruct ${i}`);
        test.equals(member.offset, offset, `offset ${i}`);
        test.equals(member.size, size / divisor, `size ${i}`);
        offset += size;
      }
    }

    //test('test f16', (test) => testType(test, 'f16'));
    await test("test f32", (test) => testType(test, "f32"));
    await test("test i32", (test) => testType(test, "i32"));
    await test("test u32", (test) => testType(test, "u32"));

    function testTypeAlias(test, suffix) {
      const shader = `
          struct Types {
              m_vec2: vec2${suffix},
              m_vec3: vec3${suffix},
              m_vec4: vec4${suffix},
              m_mat2x2: mat2x2${suffix},
              m_mat3x2: mat3x2${suffix},
              m_mat4x2: mat4x2${suffix},
              m_mat2x3: mat2x3${suffix},
              m_mat3x3: mat3x3${suffix},
              m_mat4x3: mat4x3${suffix},
              m_mat2x4: mat2x4${suffix},
              m_mat3x4: mat3x4${suffix},
              m_mat4x4: mat4x4${suffix},
          };
          @group(0) @binding(0) var<uniform> u: Types;
          `;
      //console.log(shader);
      const reflect = new WgslReflect(shader);

      const info = reflect.structs[0];

      const fields = [
        { name: "m_vec2", align: 8, size: 8 },
        { name: "m_vec3", align: 16, size: 12 },
        { name: "m_vec4", align: 16, size: 16 },
        { name: "m_mat2x2", align: 8, size: 16 },
        { name: "m_mat3x2", align: 8, size: 24 },
        { name: "m_mat4x2", align: 8, size: 32 },
        { name: "m_mat2x3", align: 16, size: 32 },
        { name: "m_mat3x3", align: 16, size: 48 },
        { name: "m_mat4x3", align: 16, size: 64 },
        { name: "m_mat2x4", align: 16, size: 32 },
        { name: "m_mat3x4", align: 16, size: 48 },
        { name: "m_mat4x4", align: 16, size: 64 },
      ];
      test.equals(info.members.length, fields.length);

      const divisor = suffix === "h" ? 2 : 1;
      let offset = 0;
      for (let i = 0; i < fields.length; ++i) {
        const { name, align, size } = fields[i];
        offset = roundUp(align / divisor, offset);

        const member = info.members[i];
        test.equals(member.name, name);
        test.equals(member.isStruct, false);
        test.equals(member.offset, offset);
        test.equals(member.size, size / divisor);
        offset += size;
      }
    }

    //test('test h', (test) => testTypeAlias(test, 'h'));
    await test("test f", (test) => testTypeAlias(test, "f"));
    await test("test i", (test) => testTypeAlias(test, "i"));
    await test("test u", (test) => testTypeAlias(test, "u"));

    await test("override", function (test) {
      const shader = `
          @id(0) override workgroupSize: u32 = 42;
          @id(1) override PI: f32 = 3.14;
          `;

      const reflect = new WgslReflect(shader);
      test.equals(reflect.overrides.length, 2);

      let override = reflect.overrides[0];
      test.equals(override.name, "workgroupSize");
      test.equals(override.id, 0);
      test.equals(override.type.name, "u32");
      //test.equals(override.declaration.toString(), "42");

      override = reflect.overrides[1];
      test.equals(override.name, "PI");
      test.equals(override.id, 1);
      test.equals(override.type.name, "f32");
      //test.equals(override.declaration.toString(), "3.14");
    });

    await test("texture_external", function (test) {
      const reflect = new WgslReflect(
        `@group(0) @binding(2) var myTexture: texture_external;`
      );

      test.equals(reflect.textures.length, 1);
      test.equals(reflect.textures[0].name, "myTexture");
      test.equals(reflect.textures[0].type.name, "texture_external");
      test.equals(reflect.textures[0].group, 0);
      test.equals(reflect.textures[0].binding, 2);
    });

    await test("array of structs", function (test) {
      const reflect = new WgslReflect(`
      struct InnerUniforms {
          bar: u32,
      };

      struct VSUniforms {
          foo: u32,
          moo: InnerUniforms,
      };
      @group(0) @binding(0) var<uniform> foo0: vec3f;
      @group(0) @binding(1) var<uniform> foo1: array<vec3f, 5>;
      @group(0) @binding(2) var<uniform> foo2: array<array<vec3f, 5>, 6>;
      @group(0) @binding(3) var<uniform> foo3: array<array<array<vec3f, 5>, 6>, 7>;

      @group(0) @binding(4) var<uniform> foo4: VSUniforms;
      @group(0) @binding(5) var<uniform> foo5: array<VSUniforms, 5>;
      @group(0) @binding(6) var<uniform> foo6: array<array<VSUniforms, 5>, 6>;
      @group(0) @binding(7) var<uniform> foo7: array<array<array<VSUniforms, 5>, 6>, 7>;
      `);

      test.equals(reflect.uniforms.length, 8);

      test.equals(reflect.uniforms[0].type.size, 12); // type is a AST.Type

      test.equals(reflect.uniforms[1].type.isArray, true); // type is an AST.ArrayType
      test.equals(reflect.uniforms[1].type.isStruct, false);
      test.equals(reflect.uniforms[1].type.count, 5);
      test.equals(reflect.uniforms[1].type.size, 80);

      test.equals(reflect.uniforms[2].type.isArray, true); // type is an AST.ArrayType
      test.equals(reflect.uniforms[2].type.isStruct, false);
      test.equals(reflect.uniforms[2].type.count, 6);
      test.equals(reflect.uniforms[2].type.size, 480);
      test.equals(reflect.uniforms[2].type.format.isArray, true); // format is an AST.ArrayType
      test.equals(reflect.uniforms[2].type.format.count, 5);
      test.equals(reflect.uniforms[2].type.format.size, 80);

      test.equals(reflect.uniforms[4].type.isStruct, true);
      test.equals(reflect.uniforms[4].type.members.length, 2);
      test.equals(reflect.uniforms[4].type.members[0].type.size, 4);
      test.equals(reflect.uniforms[4].type.members[1].type.size, 4);
      test.equals(reflect.uniforms[4].type.members[1].type.isStruct, true);
      test.equals(reflect.uniforms[4].type.members[1].type.members.length, 1);

      function getTypeString(type) {
        if (type.isArray) {
          return `array<${getTypeString(type.format)}, ${type.count}>[size: ${
            type.size
          }, stride: ${type.stride}]`;
        } else if (type.isStruct) {
          return (
            type.name +
            " {\n" +
            type.members.map((m) => `  ${m.name}: ${getTypeString(m.type)}\n`) +
            `}[size: ${type.size}, align: ${type.align}]`
          );
        }
        return `${type.name}[size: ${type.size}]`;
      }

      reflect.uniforms.map((uniform) => {
        //console.log("---------:", uniform.name);
        //console.log(getTypeString(uniform.type));
      });
    });

    await test("storage texture", function (test) {
      const reflect = new WgslReflect(
        `@binding(0) @group(0) var<storage> storage_tex: texture_storage_2d<rgba8unorm, read_write>;`
      );

      // storage textures are reflected as storage and not textures
      test.equals(reflect.storage.length, 1);
      test.equals(reflect.textures.length, 0);

      const groups = reflect.getBindGroups();
      test.equals(groups.length, 1);
      test.equals(groups[0][0].name, "storage_tex");
      test.equals(groups[0][0].resourceType, ResourceType.StorageTexture);
      test.equals(groups[0][0].type.name, "texture_storage_2d");
      test.equals(groups[0][0].type.format.name, "rgba8unorm");
      test.equals(groups[0][0].type.access, "read_write");
    });

    await test("access mode", function (test) {
      const reflect = new WgslReflect(`
      struct ReadonlyStorageBufferBlockName {
        a : f32,
      }   
      struct ReadWriteStorageBufferBlockName {
        b : f32,
      }    
      @group(3) @binding(1) var<storage, read> readonlyStorageBuffer : ReadonlyStorageBufferBlockName;
      @group(3) @binding(2) var<storage, read_write> readWriteStorageBuffer : ReadWriteStorageBufferBlockName;
      @compute @workgroup_size(1,1,1)
      fn main() {}`);
      const groups = reflect.getBindGroups();
      test.equals(groups.length, 4);
      test.equals(groups[3].length, 3);
      test.equals(groups[3][1].name, "readonlyStorageBuffer");
      test.equals(groups[3][1].access, "read");
      test.equals(groups[3][2].name, "readWriteStorageBuffer");
      test.equals(groups[3][2].access, "read_write");
    });

    await test("entry resources", function (test) {
      const reflect = new WgslReflect(`
        @group(0) @binding(0) var<uniform> u1: vec4f;
        @group(0) @binding(1) var<uniform> u2: vec4f;
        @group(0) @binding(1) var<uniform> u3: vec4f;

        // resources [u1]
        @vertex fn vs1() -> @builtin(position) vec4f {
          _ = u1;
          return u1;
        }

        // resources [u1, u2]
        @vertex fn vs2() -> @builtin(position) vec4f {
          var v1 = u1 + u2;
          return v1;
        }

        fn getU3() -> vec4f {
          return u3;
        }
        
        // resources [u1, u2, u3]
        @vertex fn vs3() -> @builtin(position) vec4f {
          return u1 + u2 + getU3();
        }

        // resources [u1, u3]. u2 is shadowed by a local variable.
        @vertex fn vs4() -> @builtin(position) vec4f {
          var u2 = vec4f(0);
          return u1 + u2 + getU3();
        }

        // resources [u1, u3]. u2 is shadowed by a local variable.
        @vertex fn vs5() -> @builtin(position) vec4f {
          var u2 = u1;
          return u2 + getU3();
        }
        
        // resources [u1, u2]
        @vertex fn vs6() -> @builtin(position) vec4f {
          {
            var u1 = vec4f(0);
          }
          _ = u1;
          _ = u2;
          return vec4f(0);
        }
        `);
      test.equals(reflect.entry.vertex.length, 6);
      
      test.equals(reflect.entry.vertex[0].resources.length, 1);
      test.equals(reflect.entry.vertex[0].resources[0].name, "u1");
      test.equals(reflect.entry.vertex[0].resources[0].type.name, "vec4f");
      test.equals(reflect.entry.vertex[0].resources[0].size, 16);

      test.equals(reflect.entry.vertex[1].resources.length, 2);
      test.equals(reflect.entry.vertex[1].resources[0].name, "u1");
      test.equals(reflect.entry.vertex[1].resources[1].name, "u2");

      test.equals(reflect.entry.vertex[2].resources.length, 3);
      test.equals(reflect.entry.vertex[2].resources[0].name, "u1");
      test.equals(reflect.entry.vertex[2].resources[1].name, "u2");
      test.equals(reflect.entry.vertex[2].resources[2].name, "u3");

      test.equals(reflect.entry.vertex[3].resources.length, 2);
      test.equals(reflect.entry.vertex[3].resources[0].name, "u1");
      test.equals(reflect.entry.vertex[3].resources[1].name, "u3");

      test.equals(reflect.entry.vertex[4].resources.length, 2);
      test.equals(reflect.entry.vertex[4].resources[0].name, "u1");
      test.equals(reflect.entry.vertex[4].resources[1].name, "u3");

      test.equals(reflect.entry.vertex[5].resources.length, 2);
      test.equals(reflect.entry.vertex[5].resources[0].name, "u1");
      test.equals(reflect.entry.vertex[5].resources[1].name, "u2");
    });

    await test("function arguments and return types", function (test) {
      const reflect = new WgslReflect(`
        fn rotate(v: vec2<f32>, angle: f32) -> vec2f {
          let pos = vec2(
            (v.x * cos(angle)) - (v.y * sin(angle)),
            (v.x * sin(angle)) + (v.y * cos(angle))
          );
          return pos;
        }`);

      const args = reflect.functions[0].arguments;
      test.equals(args[0].name, "v");
      test.equals(args[0].type.name, "vec2");
      test.equals(args[0].type.format.name, "f32");
      test.equals(args[1].name, "angle");
      test.equals(args[1].type.name, "f32");

      test.equals(reflect.functions[0].returnType.name, "vec2f");

      const logFunc = new WgslReflect("fn log() {}").functions[0];
      test.equals(logFunc.arguments.length, 0);
      test.equals(logFunc.returnType, null);
    });
  });
}
