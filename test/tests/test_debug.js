/*import { test, group, webgpuDispatch } from "../test.js";
import { WgslExec } from "../../../wgsl_reflect.module.js";

await group("WgslExec Debug", async function () {
  await test("set variable", function (test) {
    const shader = `let foo = 1 + 2;`;
    const wgsl = new WgslExec(shader);

    wgsl.initDebug();
    let res = wgsl.stepNextCommand();
    test.equals(res, true);
  });
});*/
