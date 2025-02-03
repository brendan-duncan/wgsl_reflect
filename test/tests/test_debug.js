import { test, group, webgpuDispatch } from "../test.js";
import { WgslExec } from "../../../wgsl_reflect.module.js";

export async function run() {
  await group("Debug", async function () {
    await test("set variable", async function (test) {
      const shader = `let foo = 1 + 2;`;
      const wgsl = new WgslExec(shader);

      wgsl.initDebug();
      let res = wgsl.stepNextCommand();
      test.equals(res, true);

      res = wgsl.stepNextCommand();
      test.equals(res, false);

      test.equals(wgsl.getVariableValue("foo"), 3);
    });
  });
}
