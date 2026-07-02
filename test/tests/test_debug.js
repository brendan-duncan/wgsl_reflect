import { test, group } from "../test.js";
import { WgslDebug, detectRaces, debugFragmentQuad, createFragmentQuadDebugger } from "../../wgsl_reflect.module.js";

export async function run() {
  await group("Debug", async function () {
    await test("mat4x4 uniform multiply", async function (test) {
      const shader = `
          @group(0) @binding(0) var<storage, read_write> mat: mat4x4<f32>;
          @group(0) @binding(1) var<storage, read_write> vec: vec4<f32>;
          fn foo(m: mat4x4<f32>, v: vec4<f32>) -> vec4<f32> {
            return m * v;
          }
          @compute @workgroup_size(1)
          fn main(@builtin(global_invocation_id) id: vec3<u32>) {
              vec = foo(mat, vec);
          }`;

      // Verify the emulated dispatch has the same results as the WebGPU dispatch.
      const mat = new Float32Array([2.0, 0.0, 0.0, 0.0,
                                       0.0, 2.0, 0.0, 0.0,
                                       0.0, 0.0, 2.0, 0.0,
                                       0.0, 0.0, 0.0, 1.0]);
                                        
      const vec = new Float32Array([1.0, 2.0, 3.0, 1.0]);
      const bg = {0: {0: mat, 1: vec}};
      const dbg = new WgslDebug(shader);
      dbg.debugWorkgroup("main", [1, 0, 0], 4, bg);
      while (dbg.stepNext());
      test.equals(vec, [2.0, 4.0, 6.0, 1.0]);
    });

    await test("mat4x4 multiply", async function (test) {
        const shader = `
          let a = mat4x4<f32>(
                      2.0, 0.0, 0.0, 0.0,
                      0.0, 2.0, 0.0, 0.0,
                      0.0, 0.0, 2.0, 0.0,
                      0.0, 0.0, 0.0, 1.0);
          let b = mat4x4<f32>(
                      2.0, 0.0, 0.0, 0.0,
                      0.0, 2.0, 0.0, 0.0,
                      0.0, 0.0, 2.0, 0.0,
                      0.0, 0.0, 0.0, 1.0 );
          let m = foo(a * b);
          fn foo(m: mat4x4<f32>) -> mat4x4<f32> {
            return m;
          }
        `;
        const dbg = new WgslDebug(shader);
        dbg.startDebug()
        dbg.stepNext(); // LET a
        dbg.stepNext(); // LET b
        dbg.stepNext(); // LET m
        const m = dbg.context.getVariable("m")?.value;
        const mStr = m?.toString();
        console.log(mStr);
        test.equals(mStr, "4, 0, 0, 0, 0, 4, 0, 0, 0, 0, 4, 0, 0, 0, 0, 1");
    });

    await test("default value override", async function (test) {
      const shader = `
      override test_val = 64;
      let bar = test_val;`;
      const dbg = new WgslDebug(shader);
      dbg.startDebug()
      while (dbg.stepNext());
      const v = dbg.getVariableValue("bar");
      test.equals(v, 64);
    });

    await test("default value override actually overridden", async function (test) {
      const shader = `
      override test_val = 64;
      let bar = test_val;`;
      const dbg = new WgslDebug(shader);
      dbg.startDebug()
      dbg._setOverrides({test_val: 65}, dbg.context);
      while (dbg.stepNext());
      const v = dbg.getVariableValue("bar");
      test.equals(v, 65);
    });

    await test("callexpr", function (test) {
      const shader = `
        let foo = photon();
        fn photon() -> vec3f {
          var ray = new_light_ray();
          return ray.dir;
        }
        fn new_light_ray() -> Ray {
          let center = vec3f(0.0, 0.0, 0.0);
          let pos = center + vec3f(0.0, 0.1, 0.0);
          var rc = vec3f(1.0, 2.0, 3.0);
          var dir = rc.xzy;
          dir.y = -dir.y;
          return Ray(pos, dir);
        }
        struct Ray {
          start : vec3f,
          dir   : vec3f,
        };`;
      const dbg = new WgslDebug(shader);
      while (dbg.stepNext());
      test.equals(dbg.getVariableValue("foo"), [1, -3, 2]);
    });

    await test("switch default selector", function (test) {
        const shader = `
          const c = 2;
          fn foo(x: i32) -> i32 {
            var a : i32;
            switch x {
              case 0: { // colon is optional
                a = 1;
              }
              case 3, default { // The default keyword can be used with other clauses
                a = 4;
              }
              case 1, c { // Const-expression can be used in case selectors
                a = 3;
              }
            }
            return a;
          }
          let x = foo(2);
          let y = foo(5);`;
        const dbg = new WgslDebug(shader);
        while (dbg.stepNext());
        test.equals(dbg.getVariableValue("x"), 3);
        test.equals(dbg.getVariableValue("y"), 4);
    });

    await test("nested loops", async function (test) {
      const shader = `
      fn foo() -> i32 {
        let j = 0;
        loop {
          if j >= 2 { break; }
          loop {
            j++;
            if j >= 3 { break; }
          }
        }
        return j;
      }
      let bar = foo();`;
      const dbg = new WgslDebug(shader);
      while (dbg.stepNext());
      const v = dbg.getVariableValue("bar");
      test.equals(v, 3);
    });

    await test("vec2 operators", async function (test) {
      var shader = `let i = 2;
        var a = vec2<f32>(1.0, 2.0);
        var b = vec2<f32>(3.0, 4.0);
        var c = (a / vec2(f32(i))) - b;`;
      const dbg = new WgslDebug(shader);
      while (dbg.stepNext());
      const v = dbg.getVariableValue("c");
      test.equals(v, [-2.5, -3]);
    });

    await test("call statement", async function (test) {
      const shader = `var j: i32;
      fn foo() -> i32 {
        var a: i32 = 2;
        var i: i32 = 0;
        loop {
          let step: i32 = 1;
          if i % 2 == 0 { continue; }
          a = a * 2;
          continuing {
            i = i + step;
            break if i >= 4;
          }
        }
        j = a;
        return j;
      }
      fn bar() -> i32 {
        foo();
        return j;
      }
      let k = bar();`;
      const dbg = new WgslDebug(shader);
      while (dbg.stepNext());
      test.equals(dbg.getVariableValue("j"), 8);
    });

    await test("early return in if without else", async function (test) {
      // Regression: a `return` inside an if-body (no else) followed by a
      // fall-through statement must terminate the function, not fall through.
      const shader = `
      fn f(b: bool) -> i32 {
        if (b) { return 7; }
        return 9;
      }
      let hit = f(true);
      let miss = f(false);`;
      const dbg = new WgslDebug(shader);
      while (dbg.stepNext());
      test.equals(dbg.getVariableValue("hit"), 7);
      test.equals(dbg.getVariableValue("miss"), 9);
    });

    await test("early return from nested loop", async function (test) {
      const shader = `
      fn f() -> i32 {
        for (var i = 0; i < 10; i++) {
          if (i == 3) { return i; }
        }
        return -1;
      }
      let r = f();`;
      const dbg = new WgslDebug(shader);
      while (dbg.stepNext());
      test.equals(dbg.getVariableValue("r"), 3);
    });

    await test("break", async function (test) {
      const shader = `fn foo() -> i32 {
        let j = 0;
        for (var i = 0; i < 5; i++) {
          if i == 0 { break; }
          j++;
        }
        return j;
      }
      let j = foo();`;
      const dbg = new WgslDebug(shader);
      while (dbg.stepNext());
      test.equals(dbg.getVariableValue("j"), 0);
    });

    await test("continue", async function (test) {
      const shader = `fn foo() -> i32 {
        let j = 0;
        for (var i = 0; i < 5; i++) {
          if i == 0 { continue; }
          j++;
        }
        return j;
      }
      let j = foo();`;
      const dbg = new WgslDebug(shader);
      while (dbg.stepNext());
      test.equals(dbg.getVariableValue("j"), 4);
    });

    await test("set variable", async function (test) {
      const shader = `let foo = 1 + 2;`;
      const dbg = new WgslDebug(shader);
      let res = dbg.stepNext();
      test.equals(res, false);
      test.equals(dbg.getVariableValue("foo"), 3);
    });

    await test("multiple variables", function (test) {
      const shader = `let foo = 1 + 2;
      let bar = foo * 4;`;

      const dbg = new WgslDebug(shader);
      dbg.stepNext();
      dbg.stepNext();
      // Ensure as the top-level instructions are executed, variables are correctly evaluated.
      test.equals(dbg.getVariableValue("foo"), 3);
      test.equals(dbg.getVariableValue("bar"), 12);
    });

    await test("call function", function (test) {
      const shader = `
      fn foo(a: i32, b: i32) -> i32 {
        if b > 0 {
            return a / b;
        } else {
            return a * b;
        }
      }
      let bar = foo(3, 4);
      let bar2 = foo(5, -2);`;
      const dbg = new WgslDebug(shader);
      while (dbg.stepNext());
      // Ensure calling a function works as expected.
      test.equals(dbg.getVariableValue("bar"), 0);
      test.equals(dbg.getVariableValue("bar2"), -10);
    });

    await test("data", async function (test) {
      const shader = `
          @group(0) @binding(0) var<storage, read_write> buffer: array<f32>;
          @compute @workgroup_size(1)
          fn main(@builtin(global_invocation_id) id: vec3<u32>) {
              let i = id.x;
              buffer[i] = buffer[i] * 2.0;
          }`;

      // Verify the emulated dispatch has the same results as the WebGPU dispatch.
      const buffer = new Float32Array([1, 2, 6, 0]);
      const bg = {0: {0: buffer}};

      const dbg = new WgslDebug(shader);
      dbg.debugWorkgroup("main", [1, 0, 0], 4, bg);
      while (dbg.stepNext());

      // Test that we only executed the [1, 0, 0] global_invocation_id.
      test.equals(buffer, [1, 4, 6, 0]);
    });

    await test("scalar binding", async function (test) {
      const shader = `
          @group(0) @binding(0) var<storage, read_write> buffer: f32;
          @compute @workgroup_size(1)
          fn main(@builtin(global_invocation_id) id: vec3<u32>) {
              buffer = 42 + buffer;
          }`;

      const buffer = new Float32Array([6]);
      const bg = {0: {0: buffer}};
      const dbg = new WgslDebug(shader);
      dbg.debugWorkgroup("main", [1, 0, 0], 4, bg);
      while (dbg.stepNext());
      test.equals(buffer, [48]);
    });

    await test("dispatch function call", async function (test) {
      const shader = `
          fn scale(x: f32, y: f32) -> f32 {
            return x * y;
          }
          @group(0) @binding(0) var<storage, read_write> buffer: array<f32>;
          @compute @workgroup_size(1)
          fn main(@builtin(global_invocation_id) id: vec3<u32>) {
              let i = id.x;
              buffer[i] = scale(buffer[i], 2.0);
          }`;

      // Verify the emulated dispatch has the same results as the WebGPU dispatch.
      const buffer = new Float32Array([1, 2, 6, 0]);
      const bg = {0: {0: buffer}};

      const dbg = new WgslDebug(shader);
      dbg.debugWorkgroup("main", [1, 0, 0], 4, bg);
      dbg.stepNext(); // LET: i = id.x;
      dbg.stepNext(); // CALL: scale(buffer[i], 2.0)
      dbg.stepNext(); // RETURN: x * y
      dbg.stepNext(); // ASSIGN: buffer[i] = <value>

      // Test that we only executed the [1, 0, 0] global_invocation_id.
      test.equals(buffer, [1, 4, 6, 0]);
    });
  }, true);

  await group("Vertex Debug", async function () {
    await test("separate args, struct output", function (test) {
      const shader = `
        struct VertexOutput {
          @builtin(position) position: vec4f,
          @location(0) color: vec3f,
        };
        @vertex
        fn main(@builtin(vertex_index) vi: u32, @location(0) pos: vec2f) -> VertexOutput {
          var out: VertexOutput;
          out.position = vec4f(pos, 0.0, 1.0);
          out.color = vec3f(f32(vi), 0.0, 0.0);
          return out;
        }`;
      const dbg = new WgslDebug(shader);
      const ok = dbg.debugVertex("main", { vertex_index: 2, 0: [0.5, -0.5] }, {});
      test.true(ok, "debugVertex should succeed");
      while (dbg.stepNext());
      const out = dbg.getReturnValue();
      test.equals(out.position, [0.5, -0.5, 0, 1]);
      test.equals(out.color, [2, 0, 0]);
    });

    await test("input struct, bare position output", function (test) {
      const shader = `
        struct VertexInput {
          @builtin(vertex_index) vi: u32,
          @location(0) pos: vec2f,
          @location(1) uv: vec2f,
        };
        @vertex
        fn main(in: VertexInput) -> @builtin(position) vec4f {
          return vec4f(in.pos + in.uv, f32(in.vi), 1.0);
        }`;
      const dbg = new WgslDebug(shader);
      const ok = dbg.debugVertex("main", { vertex_index: 3, 0: [1.0, 2.0], 1: [0.5, 0.5] }, {});
      test.true(ok, "debugVertex should succeed");
      while (dbg.stepNext());
      test.equals(dbg.getReturnValue(), [1.5, 2.5, 3, 1]);
    });

    await test("storage resource binding", function (test) {
      const shader = `
        @group(0) @binding(0) var<storage, read> offset: array<f32>;
        @vertex
        fn main(@location(0) pos: vec2f) -> @builtin(position) vec4f {
          return vec4f(pos.x + offset[0], pos.y + offset[1], 0.0, 1.0);
        }`;
      const buffer = new Float32Array([10, 20]);
      const dbg = new WgslDebug(shader);
      const ok = dbg.debugVertex("main", { 0: [1.0, 2.0] }, { 0: { 0: buffer } });
      test.true(ok, "debugVertex should succeed");
      while (dbg.stepNext());
      test.equals(dbg.getReturnValue(), [11, 22, 0, 1]);
    });

    await test("inputs conform to the declared type", function (test) {
      // A vertex buffer's format can have fewer or more components than the
      // shader's input type; the value must conform the way GPU vertex fetch
      // does (truncate extras; missing y/z default to 0 and w to 1).
      const shader = `
        struct VertexInput {
          @location(0) pos: vec4f,
          @location(1) scale: f32,
          @location(2) uv: vec2f,
        };
        @vertex
        fn main(in: VertexInput) -> @builtin(position) vec4f {
          if (in.scale > 0.0) {
            return in.pos * in.scale + vec4f(in.uv, 0.0, 0.0);
          }
          return in.pos;
        }`;
      const dbg = new WgslDebug(shader);
      const ok = dbg.debugVertex("main", {
        0: [1.0, 2.0, 3.0],      // float32x3 -> vec4f: w defaults to 1
        1: [2.0, 9.0],           // float32x2 -> f32: takes x
        2: [5.0, 6.0, 7.0, 8.0], // float32x4 -> vec2f: truncates
      }, {});
      test.true(ok, "debugVertex should succeed");
      while (dbg.stepNext());
      test.equals(dbg.getReturnValue(), [7, 10, 6, 2]);
    });

    await test("step and inspect locals", function (test) {
      const shader = `
        @vertex
        fn main(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
          let x = f32(vi) * 2.0;
          return vec4f(x, 0.0, 0.0, 1.0);
        }`;
      const dbg = new WgslDebug(shader);
      dbg.debugVertex("main", { vertex_index: 5 }, {});
      dbg.stepNext(); // let x = f32(vi) * 2.0;
      test.equals(dbg.getVariableValue("x"), 10);
    });

    await test("rejects non-vertex entry", function (test) {
      const shader = `
        @compute @workgroup_size(1)
        fn main() {}`;
      const dbg = new WgslDebug(shader);
      const ok = dbg.debugVertex("main", {}, {});
      test.false(ok, "debugVertex should reject a @compute entry");
    });
  }, true);

  await group("Fragment Debug", async function () {
    await test("interpolated inputs, color output", function (test) {
      const shader = `
        @fragment
        fn main(@location(0) color: vec3f, @location(1) uv: vec2f) -> @location(0) vec4f {
          return vec4f(color * uv.x, 1.0);
        }`;
      const dbg = new WgslDebug(shader);
      const ok = dbg.debugFragment("main", { 0: [0.2, 0.4, 0.6], 1: [0.5, 0.0] }, {});
      test.true(ok, "debugFragment should succeed");
      while (dbg.stepNext());
      test.equals(dbg.getReturnValue(), [0.1, 0.2, 0.3, 1], 1e-6);
    });

    await test("builtin position and front_facing", function (test) {
      const shader = `
        @fragment
        fn main(@builtin(position) pos: vec4f, @builtin(front_facing) front: bool) -> @location(0) vec4f {
          if (front) {
            return vec4f(pos.x, pos.y, 0.0, 1.0);
          }
          return vec4f(0.0);
        }`;
      const dbg = new WgslDebug(shader);
      dbg.debugFragment("main", { position: [12.5, 7.5, 0.0, 1.0], front_facing: 1 }, {});
      while (dbg.stepNext());
      test.equals(dbg.getReturnValue(), [12.5, 7.5, 0, 1]);
    });

    await test("multiple render target struct output", function (test) {
      const shader = `
        struct FragOut {
          @location(0) albedo: vec4f,
          @location(1) normal: vec4f,
        };
        @fragment
        fn main(@location(0) n: vec3f) -> FragOut {
          var out: FragOut;
          out.albedo = vec4f(1.0, 0.0, 0.0, 1.0);
          out.normal = vec4f(n, 0.0);
          return out;
        }`;
      const dbg = new WgslDebug(shader);
      dbg.debugFragment("main", { 0: [0.0, 1.0, 0.0] }, {});
      while (dbg.stepNext());
      const out = dbg.getReturnValue();
      test.equals(out.albedo, [1, 0, 0, 1]);
      test.equals(out.normal, [0, 1, 0, 0]);
    });

    await test("rejects non-fragment entry", function (test) {
      const shader = `
        @vertex
        fn main() -> @builtin(position) vec4f { return vec4f(0.0); }`;
      const dbg = new WgslDebug(shader);
      const ok = dbg.debugFragment("main", {}, {});
      test.false(ok, "debugFragment should reject a @vertex entry");
    });

    await test("discard kills the fragment", function (test) {
      const shader = `
        @fragment
        fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
          if (uv.x < 0.5) { discard; }
          return vec4f(1.0);
        }`;
      const killed = new WgslDebug(shader);
      killed.debugFragment("main", { 0: [0.2, 0.0] }, {});
      while (killed.stepNext());
      test.true(killed.discarded, "fragment should be discarded");
      test.isNull(killed.getReturnValue());

      const kept = new WgslDebug(shader);
      kept.debugFragment("main", { 0: [0.8, 0.0] }, {});
      while (kept.stepNext());
      test.false(kept.discarded, "fragment should not be discarded");
      test.equals(kept.getReturnValue(), [1, 1, 1, 1]);
    });

    await test("textureSampleCompare shadow lookup", function (test) {
      // 2x2 depth32float shadow map, all texels at depth 0.5.
      const depth = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const bg = {
        0: {
          0: { texture: [depth.buffer],
               descriptor: { format: "depth32float", size: [2, 2, 1], mipLevelCount: 1, dimension: "2d" } },
          1: { sampler: { compare: "less-equal" } },
        },
      };
      const shader = `
        @group(0) @binding(0) var shadowMap: texture_depth_2d;
        @group(0) @binding(1) var shadowSamp: sampler_comparison;
        @fragment
        fn main(@location(0) uv: vec2f, @location(1) refDepth: f32) -> @location(0) vec4f {
          let s = textureSampleCompare(shadowMap, shadowSamp, uv, refDepth);
          return vec4f(s, s, s, 1.0);
        }`;
      const run = (ref) => {
        const d = new WgslDebug(shader);
        d.debugFragment("main", { 0: [0.5, 0.5], 1: ref }, bg);
        while (d.stepNext());
        return d.getReturnValue();
      };
      test.equals(run(0.3), [1, 1, 1, 1]); // 0.3 <= 0.5 -> lit
      test.equals(run(0.7), [0, 0, 0, 1]); // 0.7 <= 0.5 -> shadowed
    });

    await test("sampler address and filter modes", function (test) {
      const px = (r, g, b) => [r, g, b, 255];
      const mip0 = new Uint8Array([...px(255, 0, 0), ...px(0, 255, 0), ...px(0, 0, 255), ...px(255, 255, 255)]);
      const bg = {
        0: {
          0: { texture: [mip0.buffer],
               descriptor: { format: "rgba8unorm", size: [2, 2, 1], mipLevelCount: 1, dimension: "2d" } },
          1: { sampler: { magFilter: "nearest", addressModeU: "repeat", addressModeV: "repeat" } },
        },
      };
      const shader = `
        @group(0) @binding(0) var t: texture_2d<f32>;
        @group(0) @binding(1) var s: sampler;
        @fragment
        fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
          return textureSampleLevel(t, s, uv, 0.0);
        }`;
      const dbg = new WgslDebug(shader);
      dbg.debugFragment("main", { 0: [1.25, 0.25] }, bg); // 1.25 wraps to 0.25 -> texel(0,0), nearest
      while (dbg.stepNext());
      test.equals(dbg.getReturnValue(), [1, 0, 0, 1]);
    });

    await test("single-lane derivatives are zero", function (test) {
      const shader = `
        @fragment
        fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
          return vec4f(dpdx(uv), dpdy(uv));
        }`;
      const dbg = new WgslDebug(shader);
      dbg.debugFragment("main", { 0: [5.0, 7.0] }, {});
      while (dbg.stepNext());
      test.equals(dbg.getReturnValue(), [0, 0, 0, 0]);
    });

    await test("textureSampleLevel bilinear filtering", function (test) {
      // 2x2 with four distinct colors; center uv averages all four texels.
      const px = (r, g, b) => [r, g, b, 255];
      const mip0 = new Uint8Array([...px(255, 0, 0), ...px(0, 255, 0), ...px(0, 0, 255), ...px(255, 255, 255)]);
      const bg = {
        0: { 0: { texture: [mip0.buffer],
                  descriptor: { format: "rgba8unorm", size: [2, 2, 1], mipLevelCount: 1, dimension: "2d" } } },
      };
      const shader = `
        @group(0) @binding(0) var tex: texture_2d<f32>;
        @group(0) @binding(1) var samp: sampler;
        @fragment
        fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
          return textureSampleLevel(tex, samp, uv, 0.0);
        }`;
      const center = new WgslDebug(shader);
      center.debugFragment("main", { 0: [0.5, 0.5] }, bg);
      while (center.stepNext());
      test.equals(center.getReturnValue(), [0.5, 0.5, 0.5, 1], 1e-3);

      const corner = new WgslDebug(shader);
      corner.debugFragment("main", { 0: [0.25, 0.25] }, bg);
      while (corner.stepNext());
      test.equals(corner.getReturnValue(), [1, 0, 0, 1], 1e-3);
    });

    await test("single-lane textureSample uses base mip", function (test) {
      const mip0 = new Uint8Array([255, 0, 0, 255]);
      const mip1 = new Uint8Array([0, 0, 255, 255]);
      const bg = {
        0: { 0: { texture: [mip0.buffer, mip1.buffer],
                  descriptor: { format: "rgba8unorm", size: [1, 1, 1], mipLevelCount: 2, dimension: "2d" } } },
      };
      const shader = `
        @group(0) @binding(0) var tex: texture_2d<f32>;
        @group(0) @binding(1) var samp: sampler;
        @fragment
        fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
          return textureSample(tex, samp, uv);
        }`;
      const dbg = new WgslDebug(shader);
      dbg.debugFragment("main", { 0: [0.5, 0.5] }, bg);
      while (dbg.stepNext());
      test.equals(dbg.getReturnValue(), [1, 0, 0, 1]); // LOD 0 outside a quad
    });
  }, true);

  await group("Fragment Quad Debug", async function () {
    // Quad uv layout: TL(0,0) TR(2,0) BL(0,3) BR(2,3)
    const quad = [{ 0: [0, 0] }, { 0: [2, 0] }, { 0: [0, 3] }, { 0: [2, 3] }];

    await test("coarse dpdx / dpdy", function (test) {
      const shader = `
        @fragment
        fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
          return vec4f(dpdx(uv), dpdy(uv));
        }`;
      const r = debugFragmentQuad(shader, "main", quad, {});
      test.equals(r.errors.length, 0);
      // dpdx = TR-TL = (2,0), dpdy = BL-TL = (0,3)
      for (let i = 0; i < 4; ++i) {
        test.equals(r.outputs[i], [2, 0, 0, 3]);
      }
    });

    await test("fwidth", function (test) {
      const shader = `
        @fragment
        fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
          return vec4f(fwidth(uv), 0.0, 1.0);
        }`;
      const r = debugFragmentQuad(shader, "main", quad, {});
      test.equals(r.errors.length, 0);
      test.equals(r.outputs[0], [2, 3, 0, 1]); // |dpdx| + |dpdy|
    });

    await test("fine derivatives differ per row", function (test) {
      // Bottom row has a larger x-gradient than the top row.
      const q = [{ 0: [0, 0] }, { 0: [2, 0] }, { 0: [0, 3] }, { 0: [10, 3] }];
      const shader = `
        @fragment
        fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
          return vec4f(dpdxFine(uv), dpdxCoarse(uv));
        }`;
      const r = debugFragmentQuad(shader, "main", q, {});
      test.equals(r.errors.length, 0);
      test.equals(r.outputs[0], [2, 0, 2, 0]);   // top row: fine == coarse
      test.equals(r.outputs[2], [10, 0, 2, 0]);  // bottom row: fine differs
    });

    await test("two derivatives in one statement", function (test) {
      const shader = `
        @fragment
        fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
          return vec4f(dpdx(uv) + dpdy(uv), 0.0, 1.0);
        }`;
      const r = debugFragmentQuad(shader, "main", quad, {});
      test.equals(r.errors.length, 0);
      test.equals(r.outputs[0], [2, 3, 0, 1]); // (2,0)+(0,3)
    });

    await test("derivative inside a loop re-rendezvous each iteration", function (test) {
      const shader = `
        @fragment
        fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
          var acc = vec2f(0.0);
          for (var i = 0; i < 3; i++) { acc = acc + dpdx(uv); }
          return vec4f(acc, 0.0, 1.0);
        }`;
      const r = debugFragmentQuad(shader, "main", quad, {});
      test.equals(r.errors.length, 0);
      test.equals(r.outputs[0], [6, 0, 0, 1]); // 3 * (2,0)
    });

    await test("non-uniform control flow warns", function (test) {
      const shader = `
        @fragment
        fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
          var d = vec2f(0.0);
          if (uv.x > 1.0) { d = dpdx(uv); }
          return vec4f(d, 0.0, 1.0);
        }`;
      const r = debugFragmentQuad(shader, "main", quad, {});
      test.true(r.errors.length > 0, "expected a uniformity warning");
    });

    await test("rejects wrong lane count", function (test) {
      const shader = `
        @fragment
        fn main(@location(0) uv: vec2f) -> @location(0) vec4f { return vec4f(uv, 0.0, 1.0); }`;
      const r = debugFragmentQuad(shader, "main", [{ 0: [0, 0] }], {});
      test.true(r.errors.length > 0, "expected an error for < 4 lanes");
    });

    // 2x2 base (red) + 1x1 mip 1 (blue), rgba8unorm.
    const RED = [255, 0, 0, 255], BLUE = [0, 0, 255, 255];
    const mip0 = new Uint8Array([...RED, ...RED, ...RED, ...RED]);
    const mip1 = new Uint8Array([...BLUE]);
    const mippedTex = {
      0: { 0: { texture: [mip0.buffer, mip1.buffer],
                descriptor: { format: "rgba8unorm", size: [2, 2, 1], mipLevelCount: 2, dimension: "2d" } } },
    };
    const sampleShader = `
      @group(0) @binding(0) var tex: texture_2d<f32>;
      @group(0) @binding(1) var samp: sampler;
      @fragment
      fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
        return textureSample(tex, samp, uv);
      }`;

    await test("textureSample implicit LOD picks a coarse mip", function (test) {
      // uv spans the whole texture across the quad -> LOD 1 -> mip 1 (blue).
      const q = [{ 0: [0, 0] }, { 0: [1, 0] }, { 0: [0, 1] }, { 0: [1, 1] }];
      const r = debugFragmentQuad(sampleShader, "main", q, mippedTex);
      test.equals(r.errors.length, 0);
      test.equals(r.outputs[0], [0, 0, 1, 1]);
    });

    await test("textureSample implicit LOD picks the base mip", function (test) {
      // Tiny uv deltas -> LOD < 0 -> clamped to mip 0 (red).
      const q = [{ 0: [0.5, 0.5] }, { 0: [0.5001, 0.5] }, { 0: [0.5, 0.5001] }, { 0: [0.5001, 0.5001] }];
      const r = debugFragmentQuad(sampleShader, "main", q, mippedTex);
      test.equals(r.errors.length, 0);
      test.equals(r.outputs[0], [1, 0, 0, 1]);
    });

    await test("textureSample trilinear blends mips at fractional LOD", function (test) {
      // LOD ~= 0.5 -> halfway between red (mip0) and blue (mip1).
      const d = 0.70710678; // 2^0.5 / 2  -> rho = 2^0.5 -> LOD 0.5
      const q = [{ 0: [0, 0] }, { 0: [d, 0] }, { 0: [0, d] }, { 0: [d, d] }];
      const r = debugFragmentQuad(sampleShader, "main", q, mippedTex);
      test.equals(r.errors.length, 0);
      test.equals(r.outputs[0], [0.5, 0, 0.5, 1], 1e-3);
    });

    await test("textureSampleGrad uses explicit gradients", function (test) {
      const shader = `
        @group(0) @binding(0) var tex: texture_2d<f32>;
        @group(0) @binding(1) var samp: sampler;
        @fragment
        fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
          return textureSampleGrad(tex, samp, uv, vec2f(1.0, 0.0), vec2f(0.0, 1.0));
        }`;
      const q = [{ 0: [0.5, 0.5] }, { 0: [0.5, 0.5] }, { 0: [0.5, 0.5] }, { 0: [0.5, 0.5] }];
      const r = debugFragmentQuad(shader, "main", q, mippedTex);
      test.equals(r.outputs[0], [0, 0, 1, 1]); // grads span texture -> LOD 1 -> blue
    });

    await test("discard reported per lane", function (test) {
      const shader = `
        @fragment
        fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
          if (uv.x < 1.0) { discard; }
          return vec4f(1.0);
        }`;
      // TL/BL have uv.x=0 (discard), TR/BR have uv.x=2 (kept).
      const q = [{ 0: [0, 0] }, { 0: [2, 0] }, { 0: [0, 3] }, { 0: [2, 3] }];
      const r = debugFragmentQuad(shader, "main", q, {});
      test.equals(r.discarded, [true, false, true, false]);
      test.isNull(r.outputs[0]);
      test.equals(r.outputs[1], [1, 1, 1, 1]);
    });

    await test("interactive stepping resolves derivatives", function (test) {
      const shader = `
        @fragment
        fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
          let a = uv.x + 1.0;
          let dx = dpdx(uv);
          let dy = dpdy(uv);
          return vec4f(dx + dy, a, 1.0);
        }`;
      const q = [{ 0: [0, 0] }, { 0: [2, 0] }, { 0: [0, 3] }, { 0: [2, 3] }];
      const { scheduler, errors } = createFragmentQuadDebugger(shader, "main", q, {}, 0);
      test.equals(errors.length, 0);
      test.notNull(scheduler);
      let n = 0;
      while (!scheduler.isDone && n < 50) {
        scheduler.stepTarget(true);
        n++;
      }
      test.true(scheduler.isDone, "target lane should finish");
      test.equals(scheduler.targetOutput, [2, 3, 1, 1]); // dpdx=(2,0), dpdy=(0,3), a=1
    });

    await test("step-over services derivatives inside a function", function (test) {
      const shader = `
        fn shade(uv: vec2f) -> vec2f {
          return dpdx(uv) + dpdy(uv);
        }
        @fragment
        fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
          let c = shade(uv);
          return vec4f(c, 0.0, 1.0);
        }`;
      const q = [{ 0: [0, 0] }, { 0: [2, 0] }, { 0: [0, 3] }, { 0: [2, 3] }];
      const { scheduler } = createFragmentQuadDebugger(shader, "main", q, {}, 0);
      // Advance to `let c = shade(uv);` (line 7), then step over the call.
      let guard = 0;
      while (scheduler.targetLine !== 7 && !scheduler.isDone && guard++ < 30) {
        scheduler.stepTarget(true);
      }
      test.equals(scheduler.targetLine, 7);
      scheduler.stepTarget(false); // step over shade(): derivatives inside must resolve
      test.equals(scheduler.targetContext.getVariableValue("c").toString(), "2, 3");
      while (!scheduler.isDone && guard++ < 60) scheduler.stepTarget(true);
      test.equals(scheduler.targetOutput, [2, 3, 0, 1]);
    });

    await test("interactive breakpoint stops on line", function (test) {
      const shader = `
        @fragment
        fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
          let a = uv.x;
          let b = uv.y;
          let c = a + b;
          return vec4f(c, 0.0, 0.0, 1.0);
        }`;
      const q = [{ 0: [1, 0] }, { 0: [2, 0] }, { 0: [1, 3] }, { 0: [2, 3] }];
      const { scheduler } = createFragmentQuadDebugger(shader, "main", q, {}, 0);
      scheduler.breakpoints.add(6); // `let c = a + b;`
      scheduler.runTarget();
      test.false(scheduler.isDone, "should pause at breakpoint");
      test.equals(scheduler.targetLine, 6);
      // 'a' and 'b' are in scope; 'c' is not yet assigned.
      test.equals(scheduler.targetContext.getVariableValue("a").value, 1);
      test.equals(scheduler.targetContext.getVariableValue("b").value, 0);
    });
  }, true);

  await group("Race Detection", async function () {
    await test("detect missing workgroupBarrier", async function (test) {
      // Each lane writes tile[lid] then reads tile[3-lid], which another lane
      // wrote. With no workgroupBarrier between the write and the read the two
      // accesses are unordered -> data race on `tile`.
      const shader = `
          @group(0) @binding(0) var<storage, read_write> data: array<u32>;
          var<workgroup> tile: array<u32, 4>;
          @compute @workgroup_size(4)
          fn main(@builtin(local_invocation_index) lid: u32) {
            tile[lid] = data[lid];
            data[lid] = tile[3u - lid];
          }`;
      const buffer = new Uint32Array([10, 20, 30, 40]);
      const { races } = detectRaces(shader, "main", [1, 1, 1], { 0: { 0: buffer } });
      test.true(races.length > 0, "expected a data race");
      test.true(races.some((r) => r.bufferId === "tile"), "race should be on 'tile'");
    });

    await test("no race with workgroupBarrier", async function (test) {
      // Same kernel, but the barrier separates the writes from the reads into
      // two phases -> no race.
      const shader = `
          @group(0) @binding(0) var<storage, read_write> data: array<u32>;
          var<workgroup> tile: array<u32, 4>;
          @compute @workgroup_size(4)
          fn main(@builtin(local_invocation_index) lid: u32) {
            tile[lid] = data[lid];
            workgroupBarrier();
            data[lid] = tile[3u - lid];
          }`;
      const buffer = new Uint32Array([10, 20, 30, 40]);
      const { races, errors } = detectRaces(shader, "main", [1, 1, 1], { 0: { 0: buffer } });
      test.equals(races.length, 0);
      test.equals(errors.length, 0);
    });

    await test("no false race for atomics", async function (test) {
      // Many lanes hit the same atomic bins; atomic-vs-atomic never races.
      const shader = `
          @group(0) @binding(0) var<storage, read_write> hist: array<atomic<u32>, 4>;
          @compute @workgroup_size(8)
          fn main(@builtin(local_invocation_index) lid: u32) {
            atomicAdd(&hist[lid % 4u], 1u);
          }`;
      const buffer = new Uint32Array([0, 0, 0, 0]);
      const { races } = detectRaces(shader, "main", [1, 1, 1], { 0: { 0: buffer } });
      test.equals(races.length, 0);
    });
  }, true);
}

