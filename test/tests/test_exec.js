import { test, group } from "../test.js";
import { WgslExec } from "../../../wgsl_reflect.module.js";

group("WgslExec", function () {
  test("set variable", function (test) {
    const shader = `let foo = 1 + 2;`;
    const wgsl = new WgslExec(shader);
    // Ensure the top-level instructions were executed and the global variable has the correct value.
    test.equals(wgsl.getVariableValue("foo"), 3);
  });

  test("multiple variables", function (test) {
    const shader = `let foo = 1 + 2;
    let bar = foo * 4;`;

    const exec = new WgslExec(shader);
    // Ensure as the top-level instructions are executed, variables are correctly evaluated.
    test.equals(exec.getVariableValue("foo"), 3);
    test.equals(exec.getVariableValue("bar"), 12);
  });

  test("call function", function (test) {
    const shader = `fn foo(a: int, b: int) -> int {
      if (b != 0) {
        return a / b;
      } else {
        return a * b;
      }
    }
    let bar = foo(3, 4);`;
    const exec = new WgslExec(shader);
    // Ensure calling a function works as expected.
    test.equals(exec.getVariableValue("bar"), 0.75);
  });

  test("simple compute dispatch", function (test) {
    const shader = `@group(0) @binding(0) var<storage, read_write> data: array<f32>;
    @compute @workgroup_size(1) fn computeSomething(@builtin(global_invocation_id) id: vec3<u32>) {
        let i = id.x;
        data[i] = data[i] * 2.0;
    }`;
    const wgsl = new WgslExec(shader);
    const dataBuffer = new Float32Array([1, 2, 6]);
    const bindGroups = {0: {0: dataBuffer}};
    // Ensure we can dispatch a compute shader and get the expected results from the output buffer.
    wgsl.dispatchWorkgroups("computeSomething", 3, bindGroups);
    test.equals(dataBuffer, [2, 4, 12]);
  });

  test("compute dispatch builtin variables", function (test) {
    const dispatchCount = [4, 3, 2];
    const workgroupSize = [2, 3, 4];

    // multiply all elements of an array
    const arrayProd = arr => arr.reduce((a, b) => a * b);

    const numThreadsPerWorkgroup = arrayProd(workgroupSize);

    const shader = `
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
    const size = numResults * 4; // vec3u is padded to 4 element alignment

    const workgroupBuffer = new Uint32Array(size);
    const localBuffer = new Uint32Array(size);
    const globalBuffer = new Uint32Array(size);

    const bindGroups = {0: {0: workgroupBuffer, 1: localBuffer, 2: globalBuffer}};

    wgsl.dispatchWorkgroups("computeSomething", dispatchCount, bindGroups);
    test.equals(workgroupBuffer[586], 2);
    test.equals(localBuffer[3], 1);
    test.equals(globalBuffer[3], 1);
  });

  /*test("struct buffers", function (test) {
    const shader = `
        struct Uniforms {
            viewportSize: vec2<u32>
        };
        struct Ray {
            origin: vec3<f32>,
            direction: vec3<f32>
        };
        @group(0) @binding(0) var<uniform> uniforms: Uniforms;
        @group(1) @binding(0) var<storage, read> rays: array<Ray>;
        @group(1) @binding(1) var<storage, read_write> imageBuffer: array<vec3f>;
        override WORKGROUP_SIZE_X: u32;
        override WORKGROUP_SIZE_Y: u32;
        @compute @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y)
        fn main(@builtin(global_invocation_id) globalInvocationId : vec3<u32>,) {
            if (any(globalInvocationId.xy > uniforms.viewportSize)) {
                return;
            }
            let pos = globalInvocationId.xy;
            let x = f32(pos.x);
            let y = f32(pos.y);
            let idx = pos.x + pos.y * uniforms.viewportSize.x;
            var r = rays[idx];
            if (r.direction.x > 0.0 && r.direction.y > 0.0 && r.direction.z > 0.0) {
                imageBuffer[idx] = vec3<f32>(x / f32(uniforms.viewportSize.x), y / f32(uniforms.viewportSize.y), 0.0);
            } else {
                imageBuffer[idx] = r.direction;
            }
        }`;
    const wgsl = new WgslExec(shader);

    const width = 10;
    const height = 10;
    const size = width * height;

    const rayBuffer = new Float32Array(size * 6);
    const imageBuffer = new Float32Array(size * 3);
    const uniforms = new Float32Array(2);
    uniforms[0] = width;
    uniforms[1] = height;

    for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
            const idx = x + y * width;
            rayBuffer[idx * 6 + 0] = 0.0;
            rayBuffer[idx * 6 + 1] = 0.0;
            rayBuffer[idx * 6 + 2] = 0.0;
            if (x > width / 2 && y > height / 2) {
                rayBuffer[idx * 6 + 3] = 1.0;
                rayBuffer[idx * 6 + 4] = 0.0;
                rayBuffer[idx * 6 + 5] = 0.0;
            } else {
                rayBuffer[idx * 6 + 3] = -1.0;
                rayBuffer[idx * 6 + 4] = 0.0;
                rayBuffer[idx * 6 + 5] = 0.0;
            }
        }
    }

    const bindGroups = {0: {0: uniforms}, 1: {0: rayBuffer, 1: imageBuffer}};
    wgsl.dispatchWorkgroups("main", [width, height, 1], bindGroups, {
        constants: {
            "WORKGROUP_SIZE_X": 1,
            "WORKGROUP_SIZE_Y": 1
        }
    });
    console.log(imageBuffer);
  });*/
});
