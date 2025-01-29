import { test, group } from "../test.js";
import { WgslExec } from "../../../wgsl_reflect.module.js";

group("Exec", function () {
  test("ast 1", function (test) {
    const shader = `let foo = 1 + 2;`;
    const exec = new WgslExec(shader);
    exec.exec();
    test.equals(exec.getVariableValue("foo"), 3);
  });

  test("ast 2", function (test) {
    const shader = `let foo = 1 + 2;
    let bar = foo * 4;`;

    const exec = new WgslExec(shader);
    exec.exec();
    test.equals(exec.getVariableValue("foo"), 3);
    test.equals(exec.getVariableValue("bar"), 12);
  });

  test("ast 3", function (test) {
    const shader = `fn foo(a: int, b: int) -> int {
      if (b != 0) {
        return a / b;
      } else {
        return a * b;
      }
    }
    let bar = foo(3, 4);`;
    const exec = new WgslExec(shader);
    exec.exec();
    test.equals(exec.getVariableValue("bar"), 0.75);
  });

  test("ast 4", function (test) {
    const shader = `@group(0) @binding(0) var<storage, read_write> data: array<f32>;
    @compute @workgroup_size(1) fn computeSomething(@builtin(global_invocation_id) id: vec3<u32>) {
        let i = id.x;
        data[i] = data[i] * 2.0;
    }`;
    const wgsl = new WgslExec(shader);
    const dataBuffer = [1, 2, 6];
    for (let i = 0; i < 3; ++i) {
        wgsl.dispatch("computeSomething", [i, 0, 0], {0: {0: dataBuffer}});
    }
    test.equals(dataBuffer, [2, 4, 12]);
  });
});
