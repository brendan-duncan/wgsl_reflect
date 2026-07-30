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

    await test("swizzle on a hoisted call result", function (test) {
      // Regression: the debugger hoists calls into their own step commands and
      // substitutes the cached return value; the call's postfix (swizzle) was
      // dropped in the substitution.
      const shader = `
        fn pick() -> vec4f { return vec4f(1.0, 2.0, 3.0, 4.0); }
        @vertex
        fn main() -> @builtin(position) vec4f {
          let p = pick().wzyx;
          return p;
        }`;
      const dbg = new WgslDebug(shader);
      const ok = dbg.debugVertex("main", {}, {});
      test.true(ok, "debugVertex should succeed");
      while (dbg.stepNext());
      test.equals(dbg.getReturnValue(), [4, 3, 2, 1]);
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

    await test("uniform buffer bindings", function (test) {
      // Vertex stages read their transforms from uniform buffers, so a nested
      // struct/array uniform has to resolve member offsets correctly.
      const shader = `
        struct Light {
          pos: vec4f,
          color: vec4f,
        };
        struct Scene {
          lights: array<Light, 2>,
          count: u32,
        };
        @group(0) @binding(0) var<uniform> scene: Scene;
        @vertex
        fn main(@location(0) pos: vec2f) -> @builtin(position) vec4f {
          let l = scene.lights[1];
          return vec4f(pos + l.pos.xy, l.color.z, f32(scene.count));
        }`;

      const uniform = new Float32Array(20);
      uniform.set([1, 2, 3, 4], 0);      // lights[0].pos
      uniform.set([5, 6, 7, 8], 4);      // lights[0].color
      uniform.set([10, 20, 30, 40], 8);  // lights[1].pos
      uniform.set([50, 60, 70, 80], 12); // lights[1].color
      new Uint32Array(uniform.buffer, 64, 1)[0] = 3; // count

      const dbg = new WgslDebug(shader);
      test.true(dbg.debugVertex("main", { 0: [0.5, 0.25] }, { 0: { 0: { uniform } } }),
        "debugVertex should succeed");
      while (dbg.stepNext());
      test.equals(dbg.getReturnValue(), [10.5, 20.25, 70, 3]);
    });

    await test("vertex_index and instance_index inside an input struct", function (test) {
      // The same builtins that work as bare arguments must also resolve when
      // they are members of a vertex input struct.
      const shader = `
        struct VertexInput {
          @builtin(vertex_index) vi: u32,
          @builtin(instance_index) ii: u32,
          @location(0) pos: vec2f,
        };
        @vertex
        fn main(in: VertexInput) -> @builtin(position) vec4f {
          return vec4f(in.pos.x + f32(in.vi), in.pos.y + f32(in.ii) * 10.0, 0.0, 1.0);
        }`;
      const dbg = new WgslDebug(shader);
      test.true(dbg.debugVertex("main", { vertex_index: 4, instance_index: 7, 0: [0.5, 0.25] }, {}),
        "debugVertex should succeed");
      while (dbg.stepNext());
      test.equals(dbg.getReturnValue(), [4.5, 70.25, 0, 1]);
    });

    await test("a missing instance_index defaults to zero", function (test) {
      // A caller debugging a non-instanced draw supplies no instance_index; it
      // has to bind as 0 rather than leaving the variable unset.
      const shader = `
        @vertex
        fn main(@builtin(instance_index) ii: u32) -> @builtin(position) vec4f {
          return vec4f(f32(ii), 1.0, 0.0, 1.0);
        }`;
      const dbg = new WgslDebug(shader);
      dbg.debugVertex("main", {}, {});
      while (dbg.stepNext());
      test.equals(dbg.getReturnValue(), [0, 1, 0, 1]);
    });

    await test("override constants apply to a vertex stage", function (test) {
      const shader = `
        override scale: f32 = 1.0;
        @vertex
        fn main(@location(0) pos: vec2f) -> @builtin(position) vec4f {
          return vec4f(pos * scale, 0.0, 1.0);
        }`;

      const dflt = new WgslDebug(shader);
      dflt.debugVertex("main", { 0: [2.0, 3.0] }, {});
      while (dflt.stepNext());
      test.equals(dflt.getReturnValue(), [2, 3, 0, 1]);

      const overridden = new WgslDebug(shader);
      overridden.debugVertex("main", { 0: [2.0, 3.0] }, {}, { constants: { scale: 4 } });
      while (overridden.stepNext());
      test.equals(overridden.getReturnValue(), [8, 12, 0, 1]);
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

    await test("texture and sampler as user-function arguments", function (test) {
      // Referencing a texture/sampler variable as a plain expression (here, as
      // user-function arguments) must resolve to the resource itself.
      const px = (r, g, b) => [r, g, b, 255];
      const mip0 = new Uint8Array([...px(255, 0, 0), ...px(0, 255, 0), ...px(0, 0, 255), ...px(255, 255, 255)]);
      const bg = {
        0: {
          0: { texture: [mip0.buffer],
               descriptor: { format: "rgba8unorm", size: [2, 2, 1], mipLevelCount: 1, dimension: "2d" } },
          1: { sampler: { magFilter: "nearest" } },
        },
      };
      const shader = `
        @group(0) @binding(0) var tex: texture_2d<f32>;
        @group(0) @binding(1) var samp: sampler;
        fn fetchColor(t: texture_2d<f32>, s: sampler, uv: vec2f) -> vec4f {
          return textureSampleLevel(t, s, uv, 0.0);
        }
        @fragment
        fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
          return fetchColor(tex, samp, uv);
        }`;
      const dbg = new WgslDebug(shader);
      dbg.debugFragment("main", { 0: [0.25, 0.25] }, bg);
      while (dbg.stepNext());
      test.equals(dbg.getReturnValue(), [1, 0, 0, 1], 1e-3); // nearest -> texel (0,0)
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

    await test("uniform buffer binding in a fragment stage", function (test) {
      const shader = `
        struct Material {
          tint: vec4f,
          uvScale: vec2f,
          flags: u32,
        };
        @group(0) @binding(0) var<uniform> mat: Material;
        @fragment
        fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
          let scaled = uv * mat.uvScale;
          return mat.tint * vec4f(scaled, f32(mat.flags), 1.0);
        }`;

      const uniform = new Float32Array(8);
      uniform.set([2.0, 3.0, 4.0, 5.0], 0); // tint
      uniform.set([0.5, 10.0], 4);          // uvScale
      new Uint32Array(uniform.buffer, 24, 1)[0] = 3; // flags

      const dbg = new WgslDebug(shader);
      test.true(dbg.debugFragment("main", { 0: [4.0, 0.25] }, { 0: { 0: { uniform } } }),
        "debugFragment should succeed");
      while (dbg.stepNext());
      // scaled = (2, 2.5); tint * (2, 2.5, 3, 1)
      test.equals(dbg.getReturnValue(), [4, 7.5, 12, 5], 1e-6);
    });

    await test("frag_depth output", function (test) {
      const shader = `
        struct FragOut {
          @location(0) color: vec4f,
          @builtin(frag_depth) depth: f32,
        };
        @fragment
        fn main(@location(0) uv: vec2f) -> FragOut {
          var out: FragOut;
          out.color = vec4f(uv, 0.0, 1.0);
          out.depth = uv.x * 0.5;
          return out;
        }`;
      const dbg = new WgslDebug(shader);
      dbg.debugFragment("main", { 0: [0.4, 0.6] }, {});
      while (dbg.stepNext());
      const out = dbg.getReturnValue();
      test.equals(out.color, [0.4, 0.6, 0, 1], 1e-6);
      test.equals(out.depth, 0.2, 1e-6);
    });

    await test("sample_index builtin", function (test) {
      const shader = `
        @fragment
        fn main(@builtin(sample_index) si: u32, @location(0) uv: vec2f) -> @location(0) vec4f {
          return vec4f(uv, f32(si), 1.0);
        }`;

      const dbg = new WgslDebug(shader);
      dbg.debugFragment("main", { sample_index: 2, 0: [0.5, 0.25] }, {});
      while (dbg.stepNext());
      test.equals(dbg.getReturnValue(), [0.5, 0.25, 2, 1]);

      // Not supplied (the single-sample case) binds as 0.
      const single = new WgslDebug(shader);
      single.debugFragment("main", { 0: [0.5, 0.25] }, {});
      while (single.stepNext());
      test.equals(single.getReturnValue(), [0.5, 0.25, 0, 1]);
    });

    await test("discard demotes the invocation instead of ending it", function (test) {
      // `discard` turns the invocation into a helper invocation rather than
      // terminating it: the statements after it still execute, which is what
      // keeps the quad's derivatives defined for the lanes that survive (see
      // the GPU-verified helper-invocation test in test_render.js). Only the
      // fragment's output is suppressed.
      //
      // NOTE: a real helper invocation also has its memory writes disabled;
      // that part is not modeled, so a discarded invocation's stores still
      // land. Nothing here depends on that.
      const shader = `
@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  if (uv.x < 0.5) { discard; }
  let after = uv.y * 2.0;
  return vec4f(after, 0.0, 0.0, 1.0);
}`;
      const dbg = new WgslDebug(shader);
      dbg.debugFragment("main", { 0: [0.2, 0.25] }, {});

      const lines = [];
      for (let i = 0; i < 12; ++i) {
        lines.push(dbg.currentLine);
        if (!dbg.stepNext()) {
          break;
        }
      }
      // The `if` and its discard, then the two statements after it.
      test.equals(lines, [4, 4, 5, 6]);
      test.true(dbg.discarded, "fragment should be discarded");
      test.isNull(dbg.getReturnValue(), "a discarded fragment writes no output");

      // The value computed after the discard is still there to inspect.
      const stepped = new WgslDebug(shader);
      stepped.debugFragment("main", { 0: [0.2, 0.25] }, {});
      while (stepped.currentLine !== 6 && stepped.stepNext());
      test.equals(stepped.getVariableValue("after"), 0.5,
        "the statement after the discard executed");
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

    await test("interactive stepping a struct-output shader to completion", function (test) {
      // Regression: harvesting a finished lane's output (dataToJS on a struct)
      // touches debug.context; the quad scheduler's debug instance never seeds
      // its own exec stack, which used to crash resolving the current state.
      const shader = `
        struct FragOut {
          @location(0) color: vec4f,
          @location(1) extra: vec4f,
        };
        @fragment
        fn main(@location(0) uv: vec2f) -> FragOut {
          var out: FragOut;
          out.color = vec4f(uv, 0.0, 1.0);
          out.extra = vec4f(uv.y, uv.x, 1.0, 1.0);
          return out;
        }`;
      const q = [{ 0: [1, 2] }, { 0: [2, 2] }, { 0: [1, 3] }, { 0: [2, 3] }];
      const { scheduler, errors } = createFragmentQuadDebugger(shader, "main", q, {}, 0);
      test.equals(errors.length, 0);
      let n = 0;
      while (!scheduler.isDone && n < 50) {
        scheduler.stepTarget(true);
        n++;
      }
      test.true(scheduler.isDone, "target lane should finish");
      test.equals(scheduler.targetOutput.color, [1, 2, 0, 1]);
      test.equals(scheduler.targetOutput.extra, [2, 1, 1, 1]);
    });

    await test("missing inputs bind as zero-initialized values", function (test) {
      // A varying the caller didn't supply must not leave the variable unbound
      // (null would flow into vector math); it binds as zeros (w=1).
      const shader = `
        @fragment
        fn main(@location(0) uv: vec2f, @location(1) tint: vec4f) -> @location(0) vec4f {
          let c = tint * 2.0 + vec4f(uv, 0.0, 0.0);
          return c;
        }`;
      const q = [{ 0: [1, 2] }, { 0: [2, 2] }, { 0: [1, 3] }, { 0: [2, 3] }];
      const r = debugFragmentQuad(shader, "main", q, {});
      test.equals(r.errors.length, 0);
      test.equals(r.outputs[0], [1, 2, 0, 2]); // tint = (0,0,0,1)
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

  await group("Texture Sampling Debug", async function () {
    // Sampling paths for the non-2d view dimensions. The face-selection,
    // layer-selection and volume-filtering results are pinned against a real
    // GPU in test_render.js; these cover the forms that test cannot reach
    // (cube arrays, explicit mip levels per layer, integer loads, address
    // modes) with hand-computed expectations.
    const px = (r, g, b, a = 255) => [r, g, b, a];

    await test("cube array selects the face within the array element", function (test) {
      // 2 array elements x 6 faces at 1x1. Slice index is 6 * arrayIndex +
      // face, and each slice's red channel encodes its index.
      const faces = new Uint8Array(12 * 4);
      for (let i = 0; i < 12; ++i) {
        faces.set(px(i * 20, 0, 0), i * 4);
      }
      const bg = {
        0: {
          0: { texture: [faces.buffer],
               descriptor: { format: "rgba8unorm", size: [1, 1, 12], mipLevelCount: 1, dimension: "2d" } },
          1: { sampler: { magFilter: "nearest" } },
        },
      };
      const shader = `
        @group(0) @binding(0) var tex: texture_cube_array<f32>;
        @group(0) @binding(1) var samp: sampler;
        @fragment
        fn main(@location(0) dir: vec3f, @location(1) elem: i32) -> @location(0) vec4f {
          return textureSampleLevel(tex, samp, dir, elem, 0.0);
        }`;
      const sample = (dir, elem) => {
        const d = new WgslDebug(shader);
        d.debugFragment("main", { 0: dir, 1: elem }, bg);
        while (d.stepNext());
        return d.getReturnValue()[0];
      };
      // +Y is face 2; element 1 puts it at slice 8 -> red 160/255.
      test.equals(sample([0.1, 1.0, 0.2], 1), 160 / 255, 1e-6);
      // -Z is face 5; element 0 leaves it at slice 5 -> red 100/255.
      test.equals(sample([0.1, 0.2, -1.0], 0), 100 / 255, 1e-6);
    });

    await test("2d array samples the requested mip of the requested layer", function (test) {
      // 2 layers, 2x2 base + 1x1 mip 1. Layer 0 is red/blue, layer 1 is
      // green/yellow, so a wrong layer or a wrong mip is a distinct color.
      const mip0 = new Uint8Array([
        ...px(255, 0, 0), ...px(255, 0, 0), ...px(255, 0, 0), ...px(255, 0, 0),
        ...px(0, 255, 0), ...px(0, 255, 0), ...px(0, 255, 0), ...px(0, 255, 0),
      ]);
      const mip1 = new Uint8Array([...px(0, 0, 255), ...px(255, 255, 0)]);
      const bg = {
        0: {
          0: { texture: [mip0.buffer, mip1.buffer],
               descriptor: { format: "rgba8unorm", size: [2, 2, 2], mipLevelCount: 2, dimension: "2d" } },
          1: { sampler: { magFilter: "nearest" } },
        },
      };
      const shader = `
        @group(0) @binding(0) var tex: texture_2d_array<f32>;
        @group(0) @binding(1) var samp: sampler;
        @fragment
        fn main(@location(0) layer: i32, @location(1) level: f32) -> @location(0) vec4f {
          return textureSampleLevel(tex, samp, vec2f(0.25, 0.25), layer, level);
        }`;
      const sample = (layer, level) => {
        const d = new WgslDebug(shader);
        d.debugFragment("main", { 0: layer, 1: level }, bg);
        while (d.stepNext());
        return d.getReturnValue();
      };
      test.equals(sample(0, 0), [1, 0, 0, 1]);
      test.equals(sample(1, 0), [0, 1, 0, 1]);
      test.equals(sample(0, 1), [0, 0, 1, 1]);
      test.equals(sample(1, 1), [1, 1, 0, 1]);
    });

    await test("textureLoad addresses a 3d texture's depth slice", function (test) {
      const volume = new Uint8Array(8 * 4);
      for (let i = 0; i < 8; ++i) {
        volume.set(px(i * 30, 0, 0), i * 4);
      }
      const bg = {
        0: { 0: { texture: [volume.buffer],
                  descriptor: { format: "rgba8unorm", size: [2, 2, 2], mipLevelCount: 1, dimension: "3d" } } },
      };
      const shader = `
        @group(0) @binding(0) var tex: texture_3d<f32>;
        @fragment
        fn main(@location(0) c: vec3f) -> @location(0) vec4f {
          return textureLoad(tex, vec3u(c), 0);
        }`;
      const load = (x, y, z) => {
        const d = new WgslDebug(shader);
        d.debugFragment("main", { 0: [x, y, z] }, bg);
        while (d.stepNext());
        return d.getReturnValue()[0];
      };
      test.equals(load(0, 0, 0), 0, 1e-6);          // index 0
      test.equals(load(1, 0, 0), 30 / 255, 1e-6);   // index 1
      test.equals(load(0, 1, 0), 60 / 255, 1e-6);   // index 2
      test.equals(load(0, 0, 1), 120 / 255, 1e-6);  // index 4: second slice
      test.equals(load(1, 1, 1), 210 / 255, 1e-6);  // index 7
    });

    await test("3d sampling honors addressModeW", function (test) {
      // Slice 0 red, slice 1 blue, nearest filtering. A w outside [0, 1) is
      // wrapped by the sampler's W address mode.
      const volume = new Uint8Array(8 * 4);
      for (let i = 0; i < 4; ++i) {
        volume.set(px(255, 0, 0), i * 4);
        volume.set(px(0, 0, 255), (4 + i) * 4);
      }
      const descriptor = { format: "rgba8unorm", size: [2, 2, 2], mipLevelCount: 1, dimension: "3d" };
      const shader = `
        @group(0) @binding(0) var tex: texture_3d<f32>;
        @group(0) @binding(1) var samp: sampler;
        @fragment
        fn main(@location(0) w: f32) -> @location(0) vec4f {
          return textureSampleLevel(tex, samp, vec3f(0.25, 0.25, w), 0.0);
        }`;
      const sample = (w, addressModeW) => {
        const bg = {
          0: {
            0: { texture: [volume.buffer], descriptor },
            1: { sampler: { magFilter: "nearest", addressModeW } },
          },
        };
        const d = new WgslDebug(shader);
        d.debugFragment("main", { 0: w }, bg);
        while (d.stepNext());
        return d.getReturnValue();
      };
      test.equals(sample(0.25, "clamp-to-edge"), [1, 0, 0, 1]); // slice 0
      test.equals(sample(0.75, "clamp-to-edge"), [0, 0, 1, 1]); // slice 1
      test.equals(sample(1.5, "clamp-to-edge"), [0, 0, 1, 1]);  // clamped to slice 1
      test.equals(sample(1.25, "repeat"), [1, 0, 0, 1]);        // wraps to slice 0
    });

    await test("3d filtering blends across depth slices", function (test) {
      const volume = new Uint8Array(8 * 4);
      for (let i = 0; i < 4; ++i) {
        volume.set(px(255, 0, 0), i * 4);
        volume.set(px(0, 0, 255), (4 + i) * 4);
      }
      const bg = {
        0: {
          0: { texture: [volume.buffer],
               descriptor: { format: "rgba8unorm", size: [2, 2, 2], mipLevelCount: 1, dimension: "3d" } },
          1: { sampler: { magFilter: "linear" } },
        },
      };
      const shader = `
        @group(0) @binding(0) var tex: texture_3d<f32>;
        @group(0) @binding(1) var samp: sampler;
        @fragment
        fn main(@location(0) w: f32) -> @location(0) vec4f {
          return textureSampleLevel(tex, samp, vec3f(0.5, 0.5, w), 0.0);
        }`;
      const sample = (w) => {
        const d = new WgslDebug(shader);
        d.debugFragment("main", { 0: w }, bg);
        while (d.stepNext());
        return d.getReturnValue();
      };
      test.equals(sample(0.25), [1, 0, 0, 1], 1e-6);      // entirely slice 0
      test.equals(sample(0.5), [0.5, 0, 0.5, 1], 1e-6);   // halfway between slices
      test.equals(sample(0.75), [0, 0, 1, 1], 1e-6);      // entirely slice 1
    });

    await test("textureDimensions and the texture query builtins", function (test) {
      const volume = new Uint8Array((8 + 1) * 4);
      const bg = {
        0: { 0: { texture: [volume.buffer, volume.buffer],
                  descriptor: { format: "rgba8unorm", size: [4, 4, 2], mipLevelCount: 2, dimension: "3d" } } },
      };
      const shader = `
        @group(0) @binding(0) var tex: texture_3d<f32>;
        @fragment
        fn main() -> @location(0) vec4f {
          let d0 = textureDimensions(tex, 0);
          let d1 = textureDimensions(tex, 1);
          return vec4f(f32(d0.x), f32(d0.z), f32(d1.x), f32(textureNumLevels(tex)));
        }`;
      const dbg = new WgslDebug(shader);
      dbg.debugFragment("main", {}, bg);
      while (dbg.stepNext());
      // A 3d texture's depth halves with the mip level, unlike array layers.
      test.equals(dbg.getReturnValue(), [4, 2, 2, 2]);
    });

    await test("textureGather returns the 2x2 footprint of one channel", function (test) {
      // The red channel encodes the texel index, so the result vector shows
      // both which texels the footprint covered and in which order. The
      // component order (bottom-left, bottom-right, top-right, top-left) is
      // pinned against a real GPU in test_render.js.
      const tex = new Uint8Array([
        ...px(10, 11, 12), ...px(50, 51, 52),
        ...px(90, 91, 92), ...px(130, 131, 132),
      ]);
      const descriptor = { format: "rgba8unorm", size: [2, 2, 1], mipLevelCount: 1, dimension: "2d" };
      const shader = `
        @group(0) @binding(0) var tex: texture_2d<f32>;
        @group(0) @binding(1) var samp: sampler;
        @fragment
        fn main(@location(0) uv: vec2f, @location(1) c: i32) -> @location(0) vec4f {
          return textureGather(c, tex, samp, uv) * 255.0;
        }`;
      const gather = (uv, component, sampler) => {
        const bg = { 0: { 0: { texture: [tex.buffer], descriptor }, 1: { sampler } } };
        const d = new WgslDebug(shader);
        d.debugFragment("main", { 0: uv, 1: component }, bg);
        while (d.stepNext());
        return d.getReturnValue();
      };

      const clamp = { addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" };
      // At the texture center the footprint is all four texels:
      // bottom-left(90), bottom-right(130), top-right(50), top-left(10).
      test.equals(gather([0.5, 0.5], 0, clamp), [90, 130, 50, 10], 1e-3);
      // Channel selection: green is index+1, blue is index+2.
      test.equals(gather([0.5, 0.5], 1, clamp), [91, 131, 51, 11], 1e-3);
      test.equals(gather([0.5, 0.5], 2, clamp), [92, 132, 52, 12], 1e-3);

      // The gather ignores the filter mode -- it always returns four texels --
      // but it does honor the address modes at the texture edge. At uv (0,0)
      // the footprint straddles the border: clamped it collapses onto the
      // top-left texel, wrapped it pulls in the opposite edges. The wrapped
      // result is pinned against a real GPU in test_render.js.
      test.equals(gather([0, 0], 0, { magFilter: "nearest", ...clamp }), [10, 10, 10, 10], 1e-3);
      test.equals(gather([0, 0], 0, { addressModeU: "repeat", addressModeV: "repeat" }),
        [50, 10, 90, 130], 1e-3);
    });

    await test("textureGather on a 2d array and a depth texture", function (test) {
      const layers = new Uint8Array([
        ...px(10, 0, 0), ...px(20, 0, 0), ...px(30, 0, 0), ...px(40, 0, 0),
        ...px(50, 0, 0), ...px(60, 0, 0), ...px(70, 0, 0), ...px(80, 0, 0),
      ]);
      const arrayBg = {
        0: {
          0: { texture: [layers.buffer],
               descriptor: { format: "rgba8unorm", size: [2, 2, 2], mipLevelCount: 1, dimension: "2d" } },
          1: { sampler: {} },
        },
      };
      const arrayShader = `
        @group(0) @binding(0) var tex: texture_2d_array<f32>;
        @group(0) @binding(1) var samp: sampler;
        @fragment
        fn main(@location(0) layer: i32) -> @location(0) vec4f {
          return textureGather(0, tex, samp, vec2f(0.5, 0.5), layer) * 255.0;
        }`;
      const gatherLayer = (layer) => {
        const d = new WgslDebug(arrayShader);
        d.debugFragment("main", { 0: layer }, arrayBg);
        while (d.stepNext());
        return d.getReturnValue();
      };
      test.equals(gatherLayer(0), [30, 40, 20, 10], 1e-3);
      test.equals(gatherLayer(1), [70, 80, 60, 50], 1e-3);

      // A depth texture has no channel argument: the texture is the first
      // argument and the single depth channel is gathered.
      const depth = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      const depthBg = {
        0: {
          0: { texture: [depth.buffer],
               descriptor: { format: "depth32float", size: [2, 2, 1], mipLevelCount: 1, dimension: "2d" } },
          1: { sampler: {} },
        },
      };
      const depthDbg = new WgslDebug(`
        @group(0) @binding(0) var tex: texture_depth_2d;
        @group(0) @binding(1) var samp: sampler;
        @fragment
        fn main() -> @location(0) vec4f {
          return textureGather(tex, samp, vec2f(0.5, 0.5));
        }`);
      depthDbg.debugFragment("main", {}, depthBg);
      while (depthDbg.stepNext());
      test.equals(depthDbg.getReturnValue(), [0.3, 0.4, 0.2, 0.1], 1e-6);
    });

    await test("textureGatherCompare compares each gathered texel", function (test) {
      // Unlike textureSampleCompare, which blends the four comparison results,
      // gatherCompare returns them separately so a shader can filter them
      // itself.
      const depth = new Float32Array([0.1, 0.9, 0.5, 0.5]);
      const descriptor = { format: "depth32float", size: [2, 2, 1], mipLevelCount: 1, dimension: "2d" };
      const shader = `
        @group(0) @binding(0) var shadowMap: texture_depth_2d;
        @group(0) @binding(1) var shadowSamp: sampler_comparison;
        @fragment
        fn main(@location(0) refDepth: f32) -> @location(0) vec4f {
          return textureGatherCompare(shadowMap, shadowSamp, vec2f(0.5, 0.5), refDepth);
        }`;
      const gather = (ref, compare) => {
        const bg = { 0: { 0: { texture: [depth.buffer], descriptor }, 1: { sampler: { compare } } } };
        const d = new WgslDebug(shader);
        d.debugFragment("main", { 0: ref }, bg);
        while (d.stepNext());
        return d.getReturnValue();
      };
      // Footprint order is BL(0.5), BR(0.5), TR(0.9), TL(0.1).
      test.equals(gather(0.5, "less-equal"), [1, 1, 1, 0]);
      test.equals(gather(0.5, "less"), [0, 0, 1, 0]);
      test.equals(gather(0.95, "less-equal"), [0, 0, 0, 0]);
      test.equals(gather(0.05, "less-equal"), [1, 1, 1, 1]);
    });

    await test("textureSampleCompare filters the comparison results", function (test) {
      // Percentage-closer filtering: the compare runs per texel and the 0/1
      // results are bilinearly blended, so a reference depth between the near
      // and far texels produces a fractional value, not 0 or 1.
      const depth = new Float32Array([0.25, 0.75, 0.75, 0.25]);
      const descriptor = { format: "depth32float", size: [2, 2, 1], mipLevelCount: 1, dimension: "2d" };
      const shader = `
        @group(0) @binding(0) var shadowMap: texture_depth_2d;
        @group(0) @binding(1) var shadowSamp: sampler_comparison;
        @fragment
        fn main(@location(0) uv: vec2f, @location(1) refDepth: f32) -> @location(0) vec4f {
          let s = textureSampleCompare(shadowMap, shadowSamp, uv, refDepth);
          return vec4f(s, 0.0, 0.0, 1.0);
        }`;
      const sample = (uv, ref, sampler) => {
        const bg = { 0: { 0: { texture: [depth.buffer], descriptor }, 1: { sampler } } };
        const d = new WgslDebug(shader);
        d.debugFragment("main", { 0: uv, 1: ref }, bg);
        while (d.stepNext());
        return d.getReturnValue()[0];
      };

      // At the texture center all four texels weigh equally: two are at 0.75
      // and two at 0.25, so a reference of 0.5 passes exactly half of them.
      const pcf = { compare: "less-equal", magFilter: "linear" };
      test.equals(sample([0.5, 0.5], 0.1, pcf), 1, 1e-6);   // in front of every texel
      test.equals(sample([0.5, 0.5], 0.5, pcf), 0.5, 1e-6); // half lit
      test.equals(sample([0.5, 0.5], 0.9, pcf), 0, 1e-6);   // behind every texel

      // A nearest comparison sampler resolves to a single texel's 0 or 1.
      const point = { compare: "less-equal", magFilter: "nearest" };
      test.equals(sample([0.25, 0.25], 0.5, point), 0, 1e-6); // texel (0,0) = 0.25
      test.equals(sample([0.75, 0.25], 0.5, point), 1, 1e-6); // texel (1,0) = 0.75

      // The comparison function comes from the sampler.
      test.equals(sample([0.25, 0.25], 0.5, { compare: "greater", magFilter: "nearest" }), 1, 1e-6);
      test.equals(sample([0.25, 0.25], 0.5, { compare: "never", magFilter: "nearest" }), 0, 1e-6);
      test.equals(sample([0.25, 0.25], 0.5, { compare: "always", magFilter: "nearest" }), 1, 1e-6);
    });
  }, true);

  await group("Debugger Stepping", async function () {
    // A debugger is only usable if the line it reports is the line it is about
    // to run, and if step over / step out land where the user expects. These
    // drive the WgslDebug stepping API the way a UI does.

    // run() and stepOut() advance asynchronously in slices so a UI stays
    // responsive; they report completion through runStateCallback.
    const untilStopped = (dbg) => new Promise((resolve) => {
      dbg.runStateCallback = () => {
        if (!dbg.isRunning) {
          resolve();
        }
      };
    });

    // Line numbers below refer to this shader, whose first line is the empty
    // line after the opening backtick:
    //   2 fn scale(v: f32) -> f32 {
    //   3   let doubled = v * 2.0;
    //   4   return doubled + 1.0;
    //   5 }
    //   6 @compute @workgroup_size(1)
    //   7 fn main(...) {
    //   8   let a = 3.0;
    //   9   let b = scale(a);
    //  10   let c = b + a;
    //  11 }
    const CALL_SHADER = `
fn scale(v: f32) -> f32 {
  let doubled = v * 2.0;
  return doubled + 1.0;
}
@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let a = 3.0;
  let b = scale(a);
  let c = b + a;
}`;

    await test("currentLine follows execution into and out of a call", function (test) {
      const dbg = new WgslDebug(CALL_SHADER);
      dbg.debugWorkgroup("main", [0, 0, 0], 1, {});

      const lines = [];
      for (let i = 0; i < 20; ++i) {
        lines.push(dbg.currentLine);
        if (!dbg.stepNext()) {
          break;
        }
      }
      // let a -> the call -> the callee's two statements -> back at the call
      // to consume the result -> the next statement in main.
      test.equals(lines, [8, 9, 3, 4, 9, 10]);
      test.equals(dbg.currentLine, -1, "currentLine is -1 once execution finishes");
    });

    await test("currentLine reports the fragment entry's statements", function (test) {
      const shader = `
@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let a = uv.x;
  let b = a * 2.0;
  return vec4f(b, 0.0, 0.0, 1.0);
}`;
      const dbg = new WgslDebug(shader);
      dbg.debugFragment("main", { 0: [0.5, 0.0] }, {});
      const lines = [];
      for (let i = 0; i < 10; ++i) {
        lines.push(dbg.currentLine);
        if (!dbg.stepNext()) {
          break;
        }
      }
      test.equals(lines, [4, 5, 6]);
      test.equals(dbg.getReturnValue(), [1, 0, 0, 1]);
    });

    await test("stepInto descends into a call, stepOver does not", function (test) {
      const into = new WgslDebug(CALL_SHADER);
      into.debugWorkgroup("main", [0, 0, 0], 1, {});
      into.stepInto();  // let a = 3.0;
      test.equals(into.currentLine, 9, "stopped at the call");
      into.stepInto();
      test.equals(into.currentLine, 3, "stepInto enters scale()");

      const over = new WgslDebug(CALL_SHADER);
      over.debugWorkgroup("main", [0, 0, 0], 1, {});
      over.stepInto();  // let a = 3.0;
      test.equals(over.currentLine, 9, "stopped at the call");
      over.stepOver();
      // The call ran to completion without the callee's lines being visited;
      // the assignment it feeds is still pending on the same line.
      test.equals(over.currentLine, 9, "stepOver stays in main");
      over.stepInto();
      test.equals(over.currentLine, 10);
      test.equals(over.getVariableValue("b"), 7, "scale() ran during the step over");
    });

    await test("stepOut finishes the callee and returns to the caller", async function (test) {
      const dbg = new WgslDebug(CALL_SHADER);
      dbg.debugWorkgroup("main", [0, 0, 0], 1, {});
      dbg.stepInto(); // let a = 3.0;
      dbg.stepInto(); // into scale()
      test.equals(dbg.currentLine, 3, "inside scale()");

      const stopped = untilStopped(dbg);
      dbg.stepOut();
      await stopped;

      test.equals(dbg.currentLine, 9, "back at the call site in main");
      dbg.stepInto();
      test.equals(dbg.getVariableValue("b"), 7);
    });

    await test("run stops at a breakpoint", async function (test) {
      const dbg = new WgslDebug(CALL_SHADER);
      dbg.debugWorkgroup("main", [0, 0, 0], 1, {});
      dbg.toggleBreakpoint(10);

      const stopped = untilStopped(dbg);
      dbg.run();
      await stopped;

      test.equals(dbg.currentLine, 10, "paused before `let c = b + a;`");
      test.equals(dbg.getVariableValue("b"), 7, "statements before the breakpoint ran");
      test.isNull(dbg.getVariableValue("c"), "the breakpoint line has not run yet");

      // Resuming from the breakpoint runs to completion.
      const finished = untilStopped(dbg);
      dbg.run();
      await finished;
      test.equals(dbg.getVariableValue("c"), 10);
      test.equals(dbg.currentLine, -1);
    });

    await test("a breakpoint inside a called function stops there", async function (test) {
      const dbg = new WgslDebug(CALL_SHADER);
      dbg.debugWorkgroup("main", [0, 0, 0], 1, {});
      dbg.toggleBreakpoint(4); // `return doubled + 1.0;` inside scale()

      const stopped = untilStopped(dbg);
      dbg.run();
      await stopped;

      test.equals(dbg.currentLine, 4);
      test.equals(dbg.getVariableValue("doubled"), 6, "the callee's local is in scope");
    });

    await test("a breakpoint in a loop stops on every iteration", async function (test) {
      // Resuming must skip the breakpoint execution is parked on, but must
      // still stop the next time the loop comes back around to it.
      const shader = `
@compute @workgroup_size(1)
fn main() {
  var total = 0;
  for (var i = 0; i < 3; i++) {
    total = total + i;
  }
}`;
      const dbg = new WgslDebug(shader);
      dbg.debugWorkgroup("main", [0, 0, 0], 1, {});
      dbg.toggleBreakpoint(6); // `total = total + i;`

      const seen = [];
      for (let hit = 0; hit < 4; ++hit) {
        const stopped = untilStopped(dbg);
        dbg.run();
        await stopped;
        if (dbg.currentLine !== 6) {
          break;
        }
        seen.push(dbg.getVariableValue("total"));
      }
      // Stopped before each accumulation: 0 + nothing, then 0, then 0 + 1.
      test.equals(seen, [0, 0, 1]);
      test.equals(dbg.getVariableValue("total"), 3, "the loop finished after the last resume");
    });

    await test("toggleBreakpoint and clearBreakpoints", async function (test) {
      const dbg = new WgslDebug(CALL_SHADER);
      dbg.debugWorkgroup("main", [0, 0, 0], 1, {});

      dbg.toggleBreakpoint(10);
      test.true(dbg.breakpoints.has(10), "toggle sets the breakpoint");
      dbg.toggleBreakpoint(10);
      test.false(dbg.breakpoints.has(10), "toggling again clears it");

      dbg.toggleBreakpoint(9);
      dbg.toggleBreakpoint(10);
      dbg.clearBreakpoints();
      test.equals(dbg.breakpoints.size, 0, "clearBreakpoints removes all of them");

      // With no breakpoints left, run() goes to completion.
      const finished = untilStopped(dbg);
      dbg.run();
      await finished;
      test.equals(dbg.getVariableValue("c"), 10);
    });

    await test("stepOut from the entry point runs to completion", async function (test) {
      const dbg = new WgslDebug(CALL_SHADER);
      dbg.debugWorkgroup("main", [0, 0, 0], 1, {});
      dbg.stepInto();

      const stopped = untilStopped(dbg);
      dbg.stepOut();
      await stopped;

      test.equals(dbg.currentLine, -1, "there is no caller to return to");
      test.equals(dbg.getVariableValue("c"), 10);
    });

    // A render stage seeds its exec stack through _debugStage rather than
    // debugWorkgroup, so the stepping controls are re-checked on a vertex entry
    // point. Lines:
    //   2 fn transform(p: vec2f) -> vec2f {
    //   3   let scaled = p * 2.0;
    //   4   return scaled + vec2f(1.0, 0.0);
    //   5 }
    //   6 @vertex
    //   7 fn main(@location(0) pos: vec2f) -> @builtin(position) vec4f {
    //   8   let t = transform(pos);
    //   9   return vec4f(t, 0.0, 1.0);
    //  10 }
    const VERTEX_CALL_SHADER = `
fn transform(p: vec2f) -> vec2f {
  let scaled = p * 2.0;
  return scaled + vec2f(1.0, 0.0);
}
@vertex
fn main(@location(0) pos: vec2f) -> @builtin(position) vec4f {
  let t = transform(pos);
  return vec4f(t, 0.0, 1.0);
}`;

    await test("currentLine follows a vertex stage into and out of a call", function (test) {
      const dbg = new WgslDebug(VERTEX_CALL_SHADER);
      test.true(dbg.debugVertex("main", { 0: [3.0, 4.0] }, {}), "debugVertex should succeed");

      const lines = [];
      for (let i = 0; i < 20; ++i) {
        lines.push(dbg.currentLine);
        if (!dbg.stepNext()) {
          break;
        }
      }
      test.equals(lines, [8, 3, 4, 8, 9]);
      test.equals(dbg.currentLine, -1);
      test.equals(dbg.getReturnValue(), [7, 8, 0, 1]);
    });

    await test("stepOver and stepInto in a vertex stage", function (test) {
      const over = new WgslDebug(VERTEX_CALL_SHADER);
      over.debugVertex("main", { 0: [3.0, 4.0] }, {});
      test.equals(over.currentLine, 8, "starts at the call");
      over.stepOver();
      test.equals(over.currentLine, 8, "stepOver stays in main");
      over.stepInto();
      test.equals(over.currentLine, 9);
      test.equals(over.getVariableValue("t"), [7, 8], "transform() ran during the step over");

      const into = new WgslDebug(VERTEX_CALL_SHADER);
      into.debugVertex("main", { 0: [3.0, 4.0] }, {});
      into.stepInto();
      test.equals(into.currentLine, 3, "stepInto enters transform()");
    });

    // The same shape again on a @fragment entry point. Lines:
    //   2 fn shade(uv: vec2f) -> vec2f {
    //   3   let scaled = uv * 2.0;
    //   4   return scaled + vec2f(1.0, 0.0);
    //   5 }
    //   6 @fragment
    //   7 fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
    //   8   let t = shade(uv);
    //   9   return vec4f(t, 0.0, 1.0);
    //  10 }
    const FRAGMENT_CALL_SHADER = `
fn shade(uv: vec2f) -> vec2f {
  let scaled = uv * 2.0;
  return scaled + vec2f(1.0, 0.0);
}
@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let t = shade(uv);
  return vec4f(t, 0.0, 1.0);
}`;

    await test("stepOver and stepInto in a fragment stage", function (test) {
      const over = new WgslDebug(FRAGMENT_CALL_SHADER);
      test.true(over.debugFragment("main", { 0: [3.0, 4.0] }, {}), "debugFragment should succeed");
      test.equals(over.currentLine, 8, "starts at the call");
      over.stepOver();
      test.equals(over.currentLine, 8, "stepOver stays in main");
      over.stepInto();
      test.equals(over.currentLine, 9);
      test.equals(over.getVariableValue("t"), [7, 8], "shade() ran during the step over");

      const into = new WgslDebug(FRAGMENT_CALL_SHADER);
      into.debugFragment("main", { 0: [3.0, 4.0] }, {});
      into.stepInto();
      test.equals(into.currentLine, 3, "stepInto enters shade()");
    });

    await test("stepOut and breakpoints in a fragment stage", async function (test) {
      const dbg = new WgslDebug(FRAGMENT_CALL_SHADER);
      dbg.debugFragment("main", { 0: [3.0, 4.0] }, {});
      dbg.toggleBreakpoint(4);

      const atBreakpoint = untilStopped(dbg);
      dbg.run();
      await atBreakpoint;
      test.equals(dbg.currentLine, 4, "stopped inside shade()");
      test.equals(dbg.getVariableValue("scaled"), [6, 8], "the callee's local is in scope");

      const returned = untilStopped(dbg);
      dbg.stepOut();
      await returned;
      test.equals(dbg.currentLine, 8, "back at the call site");

      dbg.clearBreakpoints();
      const finished = untilStopped(dbg);
      dbg.run();
      await finished;
      test.equals(dbg.getReturnValue(), [7, 8, 0, 1]);
    });

    await test("stepOut and breakpoints in a vertex stage", async function (test) {
      const dbg = new WgslDebug(VERTEX_CALL_SHADER);
      dbg.debugVertex("main", { 0: [3.0, 4.0] }, {});
      dbg.toggleBreakpoint(4); // `return scaled + vec2f(1.0, 0.0);`

      const atBreakpoint = untilStopped(dbg);
      dbg.run();
      await atBreakpoint;
      test.equals(dbg.currentLine, 4, "stopped inside transform()");
      test.equals(dbg.getVariableValue("scaled"), [6, 8], "the callee's local is in scope");

      // Stepping out of the callee returns to the pending assignment in main.
      const returned = untilStopped(dbg);
      dbg.stepOut();
      await returned;
      test.equals(dbg.currentLine, 8, "back at the call site");

      dbg.clearBreakpoints();
      const finished = untilStopped(dbg);
      dbg.run();
      await finished;
      test.equals(dbg.getReturnValue(), [7, 8, 0, 1]);
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

