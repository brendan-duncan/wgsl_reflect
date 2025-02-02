import { test, group } from "../test.js";
import { WgslExec } from "../../../wgsl_reflect.module.js";

function _copy(src) {
    const dst = new Uint8Array(src.byteLength);
    dst.set(new Uint8Array(src));
    return dst.buffer;
}

await group("WgslExec", async function () {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();

  device.addEventListener('uncapturederror', (event) => {
    console.error(event.error.message);
  });

  async function webgpuDispatch(shader, module, dispatchCount, initialData) {
    if (dispatchCount.length === undefined) {
        dispatchCount = [dispatchCount, 1, 1];
    }

    if (!(initialData instanceof Array)) {
        initialData = [initialData];
    }

    const readbackBuffers = [];
    const bindings = [];
    let index = 0;
    for (const data of initialData) {
        const bufferSize = data.byteLength;

        const storageBuffer = device.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(storageBuffer, 0, data);

        bindings.push({ binding: index, resource: { buffer: storageBuffer } });
        index++;

        const readbackBuffer = device.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        readbackBuffers.push([storageBuffer, readbackBuffer, bufferSize]);
    }

    const shaderModule = device.createShaderModule({code: shader});
    const info = await shaderModule.getCompilationInfo();
    if (info.messages.length) {
        for (const m of info.messages) {
            console.log(`${m.lineNum}:${m.linePos}: ${m.message}`);
        }
        throw new Error("Shader compilation failed");
    }

    const computePipeline = device.createComputePipeline({
        layout: "auto",
        compute: { module: shaderModule, entryPoint: module }
    });
    const bindGroup = device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: bindings
    });

    const commandEncoder = device.createCommandEncoder();
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, bindGroup);
    computePass.dispatchWorkgroups(...dispatchCount);
    computePass.end();

    device.queue.submit([commandEncoder.finish()]);

    const copyEncoder = device.createCommandEncoder();
    for (const b of readbackBuffers) {
        copyEncoder.copyBufferToBuffer(b[0], 0, b[1], 0, b[2]);
    }
    device.queue.submit([copyEncoder.finish()]);

    const results = [];
    for (const b of readbackBuffers) {
        await b[1].mapAsync(GPUMapMode.READ, 0, b[2]);
        const mappedArray = _copy(b[1].getMappedRange(0, b[2]));
        b[1].unmap();
        b[0].destroy();
        b[1].destroy();
        results.push(mappedArray);
    }

    if (results.length === 1) {
        return results[0];
    }
    return results;
  }

  await test("set variable", function (test) {
    const shader = `let foo = 1 + 2;`;
    const wgsl = new WgslExec(shader);
    wgsl.execute();
    // Ensure the top-level instructions were executed and the global variable has the correct value.
    test.equals(wgsl.getVariableValue("foo"), 3);
  });

  await test("multiple variables", function (test) {
    const shader = `let foo = 1 + 2;
    let bar = foo * 4;`;

    const wgsl = new WgslExec(shader);
    wgsl.execute();
    // Ensure as the top-level instructions are executed, variables are correctly evaluated.
    test.equals(wgsl.getVariableValue("foo"), 3);
    test.equals(wgsl.getVariableValue("bar"), 12);
  });

  await test("call function", function (test) {
    const shader = `fn foo(a: int, b: int) -> int {
      if (b != 0) {
        return a / b;
      } else {
        return a * b;
      }
    }
    let bar = foo(3, 4);`;
    const wgsl = new WgslExec(shader);
    wgsl.execute();
    // Ensure calling a function works as expected.
    test.equals(wgsl.getVariableValue("bar"), 0.75);
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
    const wgpuData = await webgpuDispatch(shader, "main", 4, buffer);
    const data = new Float32Array(wgpuData);

    const wgsl = new WgslExec(shader);
    wgsl.dispatchWorkgroups("main", 4, {0: {0: buffer}});
    test.equals(buffer, data);
  });

  await test("constructors", async function(test) {
    const shader = `
        @group(0) @binding(0) var<storage, read_write> buffer: array<vec3u>;
        @compute @workgroup_size(1)
        fn main(@builtin(global_invocation_id) id: vec3<u32>) {
            var v1 = vec3u();
            var a1 = array<bool, 2>();
            var a2 = array<f32, 2>(1, 2);
            let m1 = mat2x2<f32>();
            var foo = buffer[id.x].y;
            buffer[id.x].x = foo + 10;
        }`;

    const buffer = new Uint32Array([1, 2, 6, 0]);
    const _data = await webgpuDispatch(shader, "main", 1, buffer);
    const data = new Uint32Array(_data);
    test.equals(data, [12, 2, 6, 0]);

    const wgsl = new WgslExec(shader);
    const bindGroups = {0: {0: buffer}};
    wgsl.dispatchWorkgroups("main", 1, bindGroups);
    test.equals(buffer, data);
  });

  await test("vec3f buffer stride", async function (test) {
    const shader = `@group(0) @binding(0) var<storage, read_write> data: array<vec3f>;
    @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id: vec3<u32>) {
        let i = id.x;
        data[i].x = data[i].x * 2.0;
        data[i].y = data[i].y * 3.0;
        data[i].z = data[i].z * 4.0;
    }`;

    const buffer = new Float32Array([1, 2, 3, 0, 4, 5, 6, 0, 7, 8, 9, 0]);
    const _data = await webgpuDispatch(shader, "main", 3, buffer);
    const data = new Float32Array(_data);
    test.equals(data, [1*2, 2*3, 3*4, 0, 4*2, 5*3, 6*4, 0, 7*2, 8*3, 9*4, 0]);

    const wgsl = new WgslExec(shader);
    wgsl.dispatchWorkgroups("main", 3, {0: {0: buffer}});
    test.equals(buffer, data);
  });

  await test("shadow variable", async function (test) {
    const shader = `@group(0) @binding(0) var<storage, read_write> data: array<vec3f>;
    @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id: vec3<u32>) {
        let i = id.x;
        let j = 2.0;
        var k = f32(id.x);
        data[i].x = data[i].x * j;
        {
            // Make sure variables defined in blocks shadow outer variables, and that
            // changes to non-shadowed variables are reflected in the outer scope.
            k = 3.0;
            let j = 3.0;
            data[i].y = data[i].y * 3.0;
        }
        data[i].z = k * j;
    }`;

    const buffer = new Float32Array([1, 2, 3, 0, 4, 5, 6, 0, 7, 8, 9, 0]);
    const _data = await webgpuDispatch(shader, "main", 3, buffer);
    const data = new Float32Array(_data);
    const wgsl = new WgslExec(shader);

    // Ensure we can dispatch a compute shader and get the expected results from the output buffer.
    wgsl.dispatchWorkgroups("main", 3, {0: {0: buffer}});
    test.equals(buffer, data);
  });

  await test("struct buffer", async function (test) {
    const shader = `
    struct Ray {
        origin: vec3<f32>,
        direction: vec3<f32>
    };
    @group(0) @binding(0) var<storage, read_write> data: array<Ray>;
    @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id: vec3<u32>) {
        let i = id.x;
        data[i].origin.x = data[i].origin.x + 2.0;
        data[i].origin.y = data[i].origin.y + 3.0;
        data[i].origin.z = data[i].origin.z + 4.0;
        data[i].direction.x = data[i].direction.x + 2.0;
        data[i].direction.y = data[i].direction.y + 3.0;
        data[i].direction.z = data[i].direction.z + 4.0;
    }`;
    const dataBuffer = new Float32Array([
        1, 2, 3, 0,
        4, 5, 6, 0,
        7, 8, 9, 0,
        10, 11, 12, 0]);
    const _data = await webgpuDispatch(shader, "main", 3, dataBuffer);
    const data = new Float32Array(_data);
    // Ensure we can dispatch a compute shader and get the expected results from the output buffer.
    const wgsl = new WgslExec(shader);
    wgsl.dispatchWorkgroups("main", 2, {0: {0: dataBuffer}});
    test.equals(dataBuffer, data);
  });

  await test("struct construction", async function (test) {
    const shader = `
    struct Ray {
        origin: vec3f,
        direction: vec3f
    };
    @group(0) @binding(0) var<storage, read_write> data: array<Ray>;
    @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id: vec3<u32>) {
        let i = id.x;
        let j = f32(i * 10);
        let ray = Ray(
            vec3f(j + 1.0, j + 2.0, j + 3.0),
            vec3f(j + 4.0, j + 5.0, j + 6.0)
        );
        data[i] = ray;
    }`;
    const dataBuffer = new Float32Array([
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0]);
    const _data = await webgpuDispatch(shader, "main", 3, dataBuffer);
    const data = new Float32Array(_data);
    const wgsl = new WgslExec(shader);
    wgsl.dispatchWorkgroups("main", 2, {0: {0: dataBuffer}});
    test.equals(dataBuffer, data);
  });

  await test("compute dispatch builtin variables", async function (test) {
    const dispatchCount = [4, 3, 2];
    const workgroupSize = [2, 3, 4];

    // multiply all elements of an array
    const arrayProd = arr => arr.reduce((a, b) => a * b);

    const numThreadsPerWorkgroup = arrayProd(workgroupSize);

    const shader = `
    @group(0) @binding(0) var<storage, read_write> workgroupResult: array<vec3u>;
    @group(0) @binding(1) var<storage, read_write> localResult: array<vec3u>;
    @group(0) @binding(2) var<storage, read_write> globalResult: array<vec3u>;

    @compute @workgroup_size(${workgroupSize}) fn main(
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

    const numWorkgroups = arrayProd(dispatchCount);
    const numResults = numWorkgroups * numThreadsPerWorkgroup;
    const size = numResults * 4; // vec3u is padded to 4 element alignment

    const workgroupBuffer = new Uint32Array(size);
    const localBuffer = new Uint32Array(size);
    const globalBuffer = new Uint32Array(size);

    const _data = await webgpuDispatch(shader, "main", dispatchCount, [workgroupBuffer, localBuffer, globalBuffer]);

    const wgsl = new WgslExec(shader);
    wgsl.dispatchWorkgroups("main", dispatchCount, {0: {0: workgroupBuffer, 1: localBuffer, 2: globalBuffer}});
    const execData = [workgroupBuffer, localBuffer, globalBuffer];
    for (let i = 0; i < 3; i++) {
        const a = new Uint32Array(_data[i]);
        test.equals(execData[i], a);
    }
  });

  await test("override / structs", function (test) {
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
        override WORKGROUP_SIZE_X: u32; // specialization constants
        override WORKGROUP_SIZE_Y: u32;
        @compute @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y)
        fn main(@builtin(global_invocation_id) globalInvocationId : vec3<u32>) {
            if (any(globalInvocationId.xy > uniforms.viewportSize)) {
                return;
            }
            let w = uniforms.viewportSize.x;
            let h = uniforms.viewportSize.y;
            let pos = globalInvocationId.xy;
            let x = f32(pos.x);
            let y = f32(pos.y);
            let idx = pos.x + pos.y * w;
            var r = rays[idx];
            if (all(r.direction > vec3<f32>(0.0, 0.0, 0.0))) {
                imageBuffer[idx] = vec3<f32>(x / f32(uniforms.viewportSize.x), y / f32(uniforms.viewportSize.y), 0.0);
            } else {
                imageBuffer[idx] = r.direction;
            }
        }`;
    const wgsl = new WgslExec(shader);

    const width = 10;
    const height = 10;
    const size = width * height;

    const rayBuffer = new Float32Array(size * 8);
    const imageBuffer = new Float32Array(size * 4);
    const uniforms = new Uint32Array(2);
    uniforms[0] = width;
    uniforms[1] = height;

    for (let y = 0, idx = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x, idx += 8) {
            rayBuffer[idx + 0] = 0.0;
            rayBuffer[idx + 1] = 0.0;
            rayBuffer[idx + 2] = 0.0;
            if (x > width / 2 && y > height / 2) {
                rayBuffer[idx + 4] = 1.0;
                rayBuffer[idx + 5] = 2.0;
                rayBuffer[idx + 6] = 3.0;
            } else {
                rayBuffer[idx + 4] = -1.0;
                rayBuffer[idx + 5] = 0.0;
                rayBuffer[idx + 6] = 0.0;
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

    let valid = true;
    for (let y = 0, idx = 0; y < height; ++y) {
      for (let x = 0; x < width; ++x, idx += 4) {
        if (x > width / 2 && y > height / 2) {
            let gx = x / 10.0;
            let gy = y / 10.0;
            let r = imageBuffer[idx];
            let g = imageBuffer[idx + 1];
            // stupid floating point errors
            let dr = Math.abs(r - gx);
            let dg = Math.abs(g - gy);
            if (dr > 1.0e-4) {
              valid = false;
            }
            if (dg > 1.0e-4) {
              valid = false;
            }
        } else {
          if (imageBuffer[idx] != -1.0) {
            valid = false;
          }
        }
      }
    }

    test.equals(valid, true);
  });

  await test("texture", async function (test) {
    const shader = `
        @group(0) @binding(0) var<storage, read_write> bins: array<u32>;
        @group(0) @binding(1) var ourTexture: texture_2d<f32>;

        // from: https://www.w3.org/WAI/GL/wiki/Relative_luminance
        const kSRGBLuminanceFactors = vec3f(0.2126, 0.7152, 0.0722);
        fn srgbLuminance(color: vec3f) -> f32 {
            return saturate(dot(color, kSRGBLuminanceFactors));
        }
        @compute @workgroup_size(1) fn cs() {
            let size = textureDimensions(ourTexture, 0);
            let numBins = f32(arrayLength(&bins));
            let lastBinIndex = u32(numBins - 1);
            for (var y = 0u; y < size.y; y++) {
                for (var x = 0u; x < size.x; x++) {
                    let position = vec2u(x, y);
                    let color = textureLoad(ourTexture, position, 0);
                    let v = srgbLuminance(color.rgb);
                    let bin = min(u32(v * numBins), lastBinIndex);
                    bins[bin] += 1;
                }
            }
        }`;

        const numBins = 256;
        const histogramBuffer = new Uint32Array(numBins);

        const texture = new Uint8Array(16 * 16 * 4);
        for (let y = 0, idx = 0; y < 16; ++y) {
            for (let x = 0; x < 16; ++x, idx += 4) {
                texture[idx + 0] = x * 16;
                texture[idx + 1] = y * 16;
                texture[idx + 2] = 0;
                texture[idx + 3] = 255;
            }
        }

        const bindGroups = {0: {0: histogramBuffer, 1: {data: texture, size: [16, 16]}}};
        const wgsl = new WgslExec(shader);
        wgsl.dispatchWorkgroups("cs", 1, bindGroups);
  });
});
