import { test, group, webgpuDispatch } from "../test.js";
import { WgslDebug } from "../../../wgsl_reflect.module.js";

export async function run() {
  await group("Debug", async function () {
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
      let res = dbg.stepNext();
      test.equals(res, true);
      res = dbg.stepNext();
      test.equals(res, false);
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
      dbg.startDebug();
      console.log(dbg.currentCommand?.line, dbg.currentCommand);
      while (dbg.stepNext()) {
        console.log(dbg.currentCommand?.line,dbg.currentCommand);
      }
      // Ensure calling a function works as expected.
      test.equals(dbg.getVariableValue("bar"), 0.75);
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
  });
}
