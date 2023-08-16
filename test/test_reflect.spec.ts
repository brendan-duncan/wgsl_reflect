import { assert, describe, it } from 'vitest';
const { ok, equal, deepEqual, strictEqual, isNotNull } = assert;

import { ArrayType, TemplateType, WgslReflect } from '../src';
import { validateObject } from './common';

describe('Reflect', () =>
{
  it('alias struct', () =>
  {
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
    @describe(0) @binding(0) var<uniform> ocean: Ocean;`;

    const reflect = new WgslReflect(shader);
    equal(reflect.uniforms.length, 1);
    const bufferInfo = reflect.getUniformBufferInfo(reflect.uniforms[0]);
    equal(bufferInfo.size, 64);
  });

  it('const', () =>
  {
    const shader = `const NUM_COLORS = 10 + 2;
    @describe(0) @binding(0) var<uniform> uni: array<vec4f, NUM_COLORS>;`;
    const reflect = new WgslReflect(shader);
    equal(reflect.uniforms.length, 1);
    const bufferInfo = reflect.getUniformBufferInfo(reflect.uniforms[0]);
    equal(bufferInfo.size, 16 * 12);
  });

  it('const2', () =>
  {
    const shader = `const FOO = radians(90);
    const BAR = sin(FOO);
    const NUM_COLORS = u32(BAR + 3); // result 4
    @describe(0) @binding(0) var<uniform> uni: array<vec4f, NUM_COLORS>;`;
    const reflect = new WgslReflect(shader);
    equal(reflect.uniforms.length, 1);
    const bufferInfo = reflect.getUniformBufferInfo(reflect.uniforms[0]);
    equal(bufferInfo.size, 16 * 4);
  });

  it('alias', () =>
  {
    const shader = `alias material_index = u32;
        alias color = vec3f;
        struct material {
            index: material_index,
            diffuse: color,
        }
        @describe(0) @binding(1) var<storage> materials: array<material, 10>;`;

    const reflect = new WgslReflect(shader);
    equal(reflect.aliases.length, 2);
    const info = reflect.getStorageBufferInfo(reflect.storages[0]);
    equal(!!info, true);
  });

  it('nested-alias', () =>
  {
    const shader = `
          struct Foo {
            a: u32,
            b: f32,
          };
          alias foo1 = Foo;
          alias foo2 = foo1;
          alias foo3 = foo2;
          @describe(0) @binding(1) var<storage> materials: foo3;
    `;
    const reflect = new WgslReflect(shader);
    equal(reflect.aliases.length, 3);
    const info = reflect.getStorageBufferInfo(reflect.storages[0]);
    equal(info.isStruct, true);
    equal(info.isArray, false);
    equal(info.members.length, 2);
    equal(info.size, 8);
  });

  it('nested-alias-array', () =>
  {
    const shader = `
        struct Foo {
          a: u32,
          b: f32,
        };
        alias foo1 = Foo;
        alias foo2 = foo1;
        alias foo3 = foo2;
        @describe(0) @binding(1) var<storage> materials: array<foo3, 10>;
    `;
    const reflect = new WgslReflect(shader);
    equal(reflect.aliases.length, 3);
    const info = reflect.getStorageBufferInfo(reflect.storages[0]);
    equal(info.isStruct, true);
    equal(info.isArray, true);
    equal(info.members.length, 2);
    equal(info.size, 80);
  });

  it('typedef', () =>
  {
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
        @describe(0) @binding(24) var<uniform> x_75 : VGlobals;`;
    const reflect = new WgslReflect(shader);

    equal(reflect.uniforms.length, 1);
    equal(reflect.uniforms[0].name, 'x_75');
    const bufferInfo = reflect.getUniformBufferInfo(reflect.uniforms[0]);
    equal(bufferInfo.size, 560);
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

@binding(0) @describe(0) var<uniform> viewUniforms: ViewUniforms;
@binding(1) @describe(0) var<uniform> modelUniforms: ModelUniforms;
@binding(2) @describe(0) var u_sampler: sampler;
@binding(3) @describe(0) var u_texture: texture_2d<f32>;

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

  it('struct', () =>
  {
    equal(reflect.structs.length, 4);

    const names = reflect.structs.map((s) => s.name);
    ok(names.includes('ViewUniforms'));
    ok(names.includes('ModelUniforms'));
    ok(names.includes('VertexInput'));
    ok(names.includes('VertexOutput'));

    isNotNull(reflect.getStructInfo(reflect.structs[0]));
    isNotNull(reflect.getStructInfo(reflect.structs[1]));
    isNotNull(reflect.getStructInfo(reflect.structs[2]));
    isNotNull(reflect.getStructInfo(reflect.structs[3]));
  });

  it('uniforms', () =>
  {
    equal(reflect.uniforms.length, 2);
    equal(reflect.uniforms[0].name, 'viewUniforms');
    equal(reflect.uniforms[0].type.name, 'ViewUniforms');
    isNotNull(reflect.getStruct(reflect.uniforms[0].type));
  });

  it('textures', () =>
  {
    equal(reflect.textures.length, 1);
    equal(reflect.textures[0].name, 'u_texture');
    equal(reflect.textures[0].type.name, 'texture_2d');
    equal((reflect.textures[0].type as TemplateType).format.name, 'f32');
    equal(reflect.textures[0].group, 0);
    equal(reflect.textures[0].binding, 3);
  });

  it('samplers', () =>
  {
    equal(reflect.samplers.length, 1);
    equal(reflect.samplers[0].name, 'u_sampler');
    equal(reflect.samplers[0].type.name, 'sampler');
    equal(reflect.samplers[0].group, 0);
    equal(reflect.samplers[0].binding, 2);
  });

  it('uniformBufferInfo', () =>
  {
    const buffer = reflect.getUniformBufferInfo(reflect.uniforms[1]);
    isNotNull(buffer);
    equal(buffer.type.name, 'ModelUniforms', 'buffer.type');
    equal(buffer.size, 96, 'buffer.size');
    equal(buffer.group, 0, 'buffer.group.value');
    equal(buffer.binding, 1, 'buffer.binding.value');
    equal(buffer.members.length, 3, 'buffer.members.length');
    equal(buffer.members[0].name, 'model', 'buffer.members[0].name');
    equal(buffer.members[1].name, 'color', 'buffer.members[1].name');
    equal(buffer.members[2].name, 'intensity', 'buffer.members[1].name');
  });

  it('getBindingGroups', () =>
  {
    const groups = reflect.getBindGroups();
    equal(groups.length, 1);
    equal(groups[0].length, 4);
    equal(groups[0][0].type, 'buffer');
    equal(groups[0][1].type, 'buffer');
    equal(groups[0][2].type, 'sampler');
    equal(groups[0][3].type, 'texture');
    equal(groups[0][3].resource.type.name, 'texture_2d');
    equal(groups[0][3].resource.type.format.name, 'f32');
  });

  it('function', () =>
  {
    equal(reflect.functions.length, 5);
    equal(reflect.functions[0].name, 'vertex_main');
    equal(reflect.functions[1].name, 'frag_main');
    equal(reflect.functions[2].name, 'sorter');
    equal(reflect.functions[3].name, 'reverser');
    equal(reflect.functions[4].name, 'shuffler');
  });

  it('entry', () =>
  {
    equal(reflect.entry.vertex.length, 1);
    equal(reflect.entry.fragment.length, 1);
    equal(reflect.entry.compute.length, 3);
  });

  it('vertexInputs', () =>
  {
    const inputs = reflect.entry.vertex[0].inputs;
    equal(inputs.length, 4);

    validateObject(inputs[0], {
      name: 'a_position',
      locationType: 'builtin',
      location: 'position',
      type: { name: 'vec3' },
    });

    validateObject(inputs[1], {
      name: 'a_normal',
      locationType: 'location',
      location: 1,
      type: { name: 'vec3' },
    });
  });

  it('storageBuffers', () =>
  {
    const shader = `@describe(0) @binding(0) var<storage, read> x : array<f32>;
        @describe(0) @binding(1) var<storage, read> y : array<f32>;
        @describe(0) @binding(2) var<storage, write> z : array<f32>;
        
        @stage(compute) @workgroup_size(64)
        fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
          // Guard against out-of-bounds work group sizes
          var idx = global_id.x;
          z[idx] = x[idx] + y[idx];
        }`;
    const reflect = new WgslReflect(shader);

    const groups = reflect.getBindGroups();

    equal(reflect.storages.length, 3);
    equal(groups.length, 1);
    equal(groups[0].length, 3);
    equal(groups[0][0].type, 'storage');
    equal(groups[0][0].resource.name, 'x');
    equal(groups[0][0].resource.type.name, 'array');
    equal(groups[0][0].resource.type.format.name, 'f32');
    equal(groups[0][1].type, 'storage');
    equal(groups[0][1].resource.name, 'y');
    equal(groups[0][1].resource.type.name, 'array');
    equal(groups[0][1].resource.type.format.name, 'f32');
    equal(groups[0][2].type, 'storage');
    equal(groups[0][2].resource.name, 'z');
    equal(groups[0][2].resource.type.name, 'array');
    equal(groups[0][2].resource.type.format.name, 'f32');
  });

  it('nested structs', () =>
  {
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
        @describe(0) @binding(0) var<uniform> model : ModelUniforms;
        @binding(1) @describe(0) var<uniform> uArray: array<vec4<f32>, 7>;
        @binding(2) @describe(0) var<uniform> uFloat: f32;`;
    const reflect = new WgslReflect(shader);

    equal(reflect.uniforms.length, 3);

    const info = reflect.getStructInfo(reflect.structs[1]);
    equal(info.members.length, 5);
    equal(info.members[0].name, 'model');
    equal(info.members[0].isStruct, false);
    equal(info.members[0].offset, 0);
    equal(info.members[0].size, 64);
    equal(info.members[0].arrayStride, 64);
    equal(info.members[1].name, 'color');
    equal(info.members[1].offset, 64);
    equal(info.members[1].size, 16);
    equal(info.members[2].name, 'intensity');
    equal(info.members[2].offset, 80);
    equal(info.members[2].size, 4);
    equal(info.members[3].name, 'view');
    equal(info.members[3].type.name, 'array');
    equal((info.members[3].type as ArrayType).format.name, 'ViewUniforms');
    equal(info.members[3].isStruct, true);
    equal(info.members[3].isArray, true);
    equal(info.members[3].arrayCount, 2);
    equal(info.members[3].offset, 96);
    equal(info.members[3].size, 128);
    equal(info.members[3].arrayStride, 64);
    equal(info.members[3].members.length, 1);
    equal(info.members[3].members[0].name, 'viewProjection');
    equal(info.members[3].members[0].offset, 0);
    equal(info.members[3].members[0].size, 64);
    equal(info.members[4].name, 'f32Array');
    equal(info.members[4].arrayCount, 2);
    equal(info.members[4].offset, 224);
    equal(info.members[4].size, 8);
    equal(info.members[4].arrayStride, 4);

    const u0 = reflect.getUniformBufferInfo(reflect.uniforms[0]);
    equal(u0.name, 'model');
    equal(u0.type.name, 'ModelUniforms');
    equal(u0.members.length, 5);
    equal(u0.size, 240);

    const u1 = reflect.getUniformBufferInfo(reflect.uniforms[1]);
    equal(u1.name, 'uArray');
    equal(u1.type.name, 'array');
    equal((u1.type as ArrayType).format.name, 'vec4');
    equal(((u1.type as ArrayType).format as TemplateType).format.name, 'f32');
    equal(u1.size, 112);
    equal(u1.align, 16);
    equal(u1.isArray, true);
    equal(u1.arrayStride, 16);
    equal(u1.arrayCount, 7);

    const u2 = reflect.getUniformBufferInfo(reflect.uniforms[2]);
    equal(u2.name, 'uFloat');
    equal(u2.type.name, 'f32');
    equal(u2.size, 4);
    equal(u2.align, 4);
  });

  it('nested structs', () =>
  {
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

        @describe(0) @binding(0) var<uniform> uni1 : f32;
        @describe(0) @binding(1) var<uniform> uni2 : array<f32, 4>;
        @describe(0) @binding(2) var<uniform> uni3 : SomeStruct;
        @describe(0) @binding(2) var<uniform> uni4 : array<SomeStruct, 4>;

        @describe(1) @binding(0) var<storage> storage1 : f32;
        @describe(1) @binding(1) var<storage> storage2 : array<f32, 4>;
        @describe(1) @binding(2) var<storage> storage3 : SomeStruct;
        @describe(1) @binding(2) var<storage> storage4 : array<SomeStruct, 4>;
        `;
    const reflect = new WgslReflect(shader);
    const uniforms = Object.fromEntries(
      reflect.uniforms.map((u) => [u.name, u])
    );
    const structs = Object.fromEntries(reflect.structs.map((s) => [s.name, s]));
    const storages = Object.fromEntries(
      reflect.storages.map((s) => [s.name, s])
    );

    const someOtherStruct = reflect.getStructInfo(structs.SomeOtherStruct);
    const members = Object.fromEntries(
      someOtherStruct.members.map((m) => [m.name, m])
    );

    const compare = (uniName, memberName, storageName) =>
    {
      const uni = uniforms[uniName];
      const member = members[memberName];
      const storage = storages[storageName];

      const uniInfo = reflect.getUniformBufferInfo(uni);
      const storageInfo = reflect.getStorageBufferInfo(storage);
      // console.log(uniInfo, member);
      equal(
        uniInfo.size,
        member.size,
        `size: ${uniName} vs ${memberName}`
      );
      equal(
        storageInfo.size,
        member.size,
        `size: ${storageName} vs ${memberName}`
      );

      equal(
        !!uniInfo.isArray,
        !!member.isArray,
        `isArray: ${uniName} vs ${memberName}`
      );
      equal(
        !!storageInfo.isArray,
        !!member.isArray,
        `isArray: ${storageName} vs ${memberName}`
      );
      if (!uniInfo.isArray)
      {
        equal(
          uniInfo.arrayCount,
          member.arrayCount,
          `arrayCount: ${uniName} vs ${memberName}`
        );
        equal(
          uniInfo.arrayStride,
          member.arrayStride,
          `arrayStride: ${uniName} vs ${memberName}`
        );
        equal(
          storageInfo.arrayCount,
          member.arrayCount,
          `arrayCount: ${storageName} vs ${memberName}`
        );
        equal(
          storageInfo.arrayStride,
          member.arrayStride,
          `arrayStride: ${storageName} vs ${memberName}`
        );
      }

      equal(
        !!uniInfo.isStruct,
        !!member.isStruct,
        `isStruct: ${uniName} vs ${memberName}`
      );
      equal(
        !!storageInfo.isStruct,
        !!member.isStruct,
        `isStruct: ${storageName} vs ${memberName}`
      );
      if (uniInfo.isStruct)
      {
        equal(
          uniInfo.members.length,
          member.members.length,
          `members.length: ${uniName} vs ${memberName}`
        );
        equal(
          storageInfo.members.length,
          member.members.length,
          `members.length: ${storageName} vs ${memberName}`
        );
        // should we test deeper?
      }
    };

    compare('uni1', 'member1', 'storage1');
    compare('uni2', 'member2', 'storage2');
    compare('uni3', 'member3', 'storage3');
    compare('uni4', 'member4', 'storage4');
  });

  function roundUp(k, n)
  {
    return Math.ceil(n / k) * k;
  }

  function testType(test, type)
  {
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
        @describe(0) @binding(0) var<uniform> u: Types;
        `;
    console.log(shader);
    const reflect = new WgslReflect(shader);

    const info = reflect.getStructInfo(reflect.structs[0]);

    const fields = [
      { name: 'm_base', align: 4, size: 4 },
      { name: 'm_vec2', align: 8, size: 8 },
      { name: 'm_vec3', align: 16, size: 12 },
      { name: 'm_vec4', align: 16, size: 16 },
      { name: 'm_mat2x2', align: 8, size: 16 },
      { name: 'm_mat3x2', align: 8, size: 24 },
      { name: 'm_mat4x2', align: 8, size: 32 },
      { name: 'm_mat2x3', align: 16, size: 32 },
      { name: 'm_mat3x3', align: 16, size: 48 },
      { name: 'm_mat4x3', align: 16, size: 64 },
      { name: 'm_mat2x4', align: 16, size: 32 },
      { name: 'm_mat3x4', align: 16, size: 48 },
      { name: 'm_mat4x4', align: 16, size: 64 },
    ];
    equal(info.members.length, fields.length);

    const divisor = type === 'f16' ? 2 : 1;
    let offset = 0;
    for (let i = 0; i < fields.length; ++i)
    {
      const { name, align, size } = fields[i];
      offset = roundUp(align / divisor, offset);

      const member = info.members[i];
      equal(member.name, name);
      equal(member.isStruct, false);
      equal(member.offset, offset);
      equal(member.size, size / divisor);
      offset += size;
    }
  }

  // it('test f16', (test) => testType(test, 'f16'));
  it('test f32', (test) => testType(test, 'f32'));
  it('test i32', (test) => testType(test, 'i32'));
  it('test u32', (test) => testType(test, 'u32'));

  function testTypeAlias(test, suffix)
  {
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
        @describe(0) @binding(0) var<uniform> u: Types;
        `;
    console.log(shader);
    const reflect = new WgslReflect(shader);

    const info = reflect.getStructInfo(reflect.structs[0]);

    const fields = [
      { name: 'm_vec2', align: 8, size: 8 },
      { name: 'm_vec3', align: 16, size: 12 },
      { name: 'm_vec4', align: 16, size: 16 },
      { name: 'm_mat2x2', align: 8, size: 16 },
      { name: 'm_mat3x2', align: 8, size: 24 },
      { name: 'm_mat4x2', align: 8, size: 32 },
      { name: 'm_mat2x3', align: 16, size: 32 },
      { name: 'm_mat3x3', align: 16, size: 48 },
      { name: 'm_mat4x3', align: 16, size: 64 },
      { name: 'm_mat2x4', align: 16, size: 32 },
      { name: 'm_mat3x4', align: 16, size: 48 },
      { name: 'm_mat4x4', align: 16, size: 64 },
    ];
    equal(info.members.length, fields.length);

    const divisor = suffix === 'h' ? 2 : 1;
    let offset = 0;
    for (let i = 0; i < fields.length; ++i)
    {
      const { name, align, size } = fields[i];
      offset = roundUp(align / divisor, offset);

      const member = info.members[i];
      equal(member.name, name);
      equal(member.isStruct, false);
      equal(member.offset, offset);
      equal(member.size, size / divisor);
      offset += size;
    }
  }

  // it('test h', (test) => testTypeAlias(test, 'h'));
  it('test f', (test) => testTypeAlias(test, 'f'));
  it('test i', (test) => testTypeAlias(test, 'i'));
  it('test u', (test) => testTypeAlias(test, 'u'));

  it('override', function (test)
  {
    const shader = `
    @id(0)    override has_point_light: bool = true;
    @id(1200) override specular_param: f32 = 2.3;
    @id(1300) override gain: f32;
              override width: f32 = 0.0;
              override depth: f32;   
              override height = 2;
        `;

    const reflect = new WgslReflect(shader);
    equal(reflect.overrides.length, 6);

    let override = reflect.overrides[0];
    equal(override.name, 'has_point_light');
    equal(override.id, 0);
    equal(override.type.name, 'bool');
    equal(override.declaration.toString(), 'true');

    override = reflect.overrides[1];
    equal(override.name, 'specular_param');
    equal(override.id, 1200);
    equal(override.type.name, 'f32');
    equal(override.declaration.toString(), '2.3');

    override = reflect.overrides[2];
    equal(override.name, 'gain');
    equal(override.id, 1300);
    equal(override.type.name, 'f32');
    equal(override.declaration, undefined);

    override = reflect.overrides[3];
    equal(override.name, 'width');
    equal(override.id, undefined);
    equal(override.type.name, 'f32');
    equal(override.declaration.toString(), '0.0');

    override = reflect.overrides[4];
    equal(override.name, 'depth');
    equal(override.id, undefined);
    equal(override.type.name, 'f32');
    equal(override.declaration?.toString(), undefined);

    override = reflect.overrides[5];
    equal(override.name, 'height');
    equal(override.id, undefined);
    equal(override.type?.name, undefined);
    equal(override.declaration.toString(), '2');
  });

  // depends on another overridable constant.
  // @see https://gpuweb.github.io/gpuweb/wgsl/#override-declaration
  // it('override ', function (test)
  // {
  //   const shader = `
  //             override depth: f32;
  //             override height = 2 * depth;
  //       `;

  //   const reflect = new WgslReflect(shader);
  //   equal(reflect.overrides.length, 2);

  //   let override = reflect.overrides[0];
  //   equal(override.name, 'depth');
  //   equal(override.type.name, 'f32');

  //   override = reflect.overrides[1];
  //   equal(override.name, 'height');
  //   equal(override.declaration.toString(), '2 * depth');
  // });
});
