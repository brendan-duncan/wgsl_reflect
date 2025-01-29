import { test, group } from "../test.js";
import { WgslExec } from "../../../wgsl_reflect.module.js";

group("Exec", function () {
  /*test("ast 1", function (test) {
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
    const bindGroups = {0: {0: dataBuffer}};
    for (let i = 0; i < 3; ++i) {
        wgsl.dispatch("computeSomething", [i, 0, 0], bindGroups);
    }
    test.equals(dataBuffer, [2, 4, 12]);
  });*/

  test("ast 5", function (test) {
    const dispatchCount = [4, 3, 2];
    const workgroupSize = [2, 3, 4];

    // multiply all elements of an array
    const arrayProd = arr => arr.reduce((a, b) => a * b);

    const numThreadsPerWorkgroup = arrayProd(workgroupSize);

    const shader = `
    // NOTE!: vec3u is padded to by 4 bytes
    @group(0) @binding(0) var<storage, read_write> workgroupResult: array<vec3u>;
    @group(0) @binding(1) var<storage, read_write> localResult: array<vec3u>;
    @group(0) @binding(2) var<storage, read_write> globalResult: array<vec3u>;

    @compute @workgroup_size(${workgroupSize}) fn computeSomething(
        @builtin(workgroup_id) workgroup_id : vec3<u32>,
        @builtin(local_invocation_id) local_invocation_id : vec3<u32>,
        @builtin(global_invocation_id) global_invocation_id : vec3<u32>,
        @builtin(local_invocation_index) local_invocation_index: u32,
        @builtin(num_workgroups) num_workgroups: vec3<u32>
    ) {
        // workgroup_index is similar to local_invocation_index except for
        // workgroups, not threads inside a workgroup.
        // It is not a builtin so we compute it ourselves.

        let workgroup_index =  
            workgroup_id.x +
            workgroup_id.y * num_workgroups.x +
            workgroup_id.z * num_workgroups.x * num_workgroups.y;

        // global_invocation_index is like local_invocation_index
        // except linear across all invocations across all dispatched
        // workgroups. It is not a builtin so we compute it ourselves.

        let global_invocation_index =
            workgroup_index * ${numThreadsPerWorkgroup} +
            local_invocation_index;

        // now we can write each of these builtins to our buffers.
        workgroupResult[global_invocation_index] = workgroup_id;
        localResult[global_invocation_index] = local_invocation_id;
        globalResult[global_invocation_index] = global_invocation_id;
    }`;
    const wgsl = new WgslExec(shader);

    const numWorkgroups = arrayProd(dispatchCount);
    const numResults = numWorkgroups * numThreadsPerWorkgroup;
    const size = numResults * 4;// * 4;  // vec3f * u32

    let usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC;
    const workgroupBuffer = new Uint32Array(size);//device.createBuffer({size, usage});
    const localBuffer = new Uint32Array(size);//device.createBuffer({size, usage});
    const globalBuffer = new Uint32Array(size);//device.createBuffer({size, usage});

    const bindGroups = {0: {0: workgroupBuffer, 1: localBuffer, 2: globalBuffer}};
    //for (let i = 0; i < 3; ++i) {
        wgsl.dispatch("computeSomething", [0, 0, 0], bindGroups);
    //}
    //test.equals(dataBuffer, [2, 4, 12]);
    //console.log(workgroupBuffer);
    //console.log(localBuffer);
    //console.log(globalBuffer);
  });
});
