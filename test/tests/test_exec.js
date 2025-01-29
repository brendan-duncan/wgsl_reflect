import { test, group } from "../test.js";
import { WgslParser, WgslExec } from "../../../wgsl_reflect.module.js";

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
    return a + b;
    }
    let bar = foo(3, 4);`;
    const exec = new WgslExec(shader);
    exec.exec();
    test.equals(exec.getVariableValue("bar"), 7);
  });
});
