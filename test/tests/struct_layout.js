import { test, group } from "../test.js";
import { WgslReflect } from "../../wgsl_reflect.module.js";

export async function run() {
  await group("struct_layout", async function () {
    const shader = `
  struct A {                                     //             align(8)  size(32)
      u: f32,                                    // offset(0)   align(4)  size(4)
      v: f32,                                    // offset(4)   align(4)  size(4)
      w: vec2<f32>,                              // offset(8)   align(8)  size(8)
      @size(16) x: f32                       // offset(16)  align(4)  size(16)
  };

  struct B {                           //             align(16) size(208)
      a: vec2<f32>,                              // offset(0)   align(8)  size(8)
      // -- implicit member alignment padding -- // offset(8)             size(8)
      b: vec3<f32>,                              // offset(16)  align(16) size(12)
      c: f32,                                    // offset(28)  align(4)  size(4)
      d: f32,                                    // offset(32)  align(4)  size(4)
      // -- implicit member alignment padding -- // offset(36)            size(12)
      @align(16) e: A,                        // offset(48)  align(16) size(32)
      f: vec3<f32>,                              // offset(80)  align(16) size(12)
      // -- implicit member alignment padding -- // offset(92)            size(4)
      g: @stride(32) array<A, 3>,             // offset(96)  align(8)  size(96)
      h: i32,                                    // offset(192) align(4)  size(4)
      // -- implicit struct size padding --      // offset(196)           size(12)
  }

  @group(0) @binding(0)
  var<uniform> uniform_buffer: B;`;

    let reflect = null;

    await test("reflect", function (test) {
      reflect = new WgslReflect(shader);
      test.equals(reflect.uniforms.length, 1);
      test.equals(reflect.structs.length, 2);
    });

    await test("getMemberInfo(B)", function (test) {
      test.equals(reflect.uniforms[0].align, 16);
      test.equals(reflect.uniforms[0].size, 208);
    });
  });
}
