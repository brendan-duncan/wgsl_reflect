import { test, group } from "../test.js";
import { WgslParser, WgslExec } from "../../../wgsl_reflect.module.js";

group("Exec", function () {
  test("ast 1", function (test) {
    const shader = `let foo = 1 + 2;`;
    const parser = new WgslParser();
    const ast = parser.parse(shader);

    const exec = new WgslExec(ast);
    exec.exec();
    test.equals(exec.getVariableValue("foo"), 3);
  });

  test("ast 2", function (test) {
    const shader = `let foo = 1 + 2;
    let bar = foo * 4;`;
    const parser = new WgslParser();
    const ast = parser.parse(shader);

    const exec = new WgslExec(ast);
    exec.exec();
    test.equals(exec.getVariableValue("foo"), 3);
    test.equals(exec.getVariableValue("bar"), 12);
  });
});
