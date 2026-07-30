
export class Test {
    static isArray(obj) {
        return obj && (obj.constructor === Array ||
            (obj.buffer && obj.buffer.constructor === ArrayBuffer));
    }

    static isObject(obj) {
        return obj && obj.constructor === Object;
    }

    constructor() {
        this.state = true;
        this.messages = [];
        this._log = [];
    }

    log() {
        console.log(...arguments);
        this._log.push(Array.prototype.slice.call(arguments));
    }

    fail(message) {
        this.state = false;
        this.messages.push(message || "failed");
    }

    true(b, message) {
        if (!b) {
            this.state = false;
            this.messages.push(message || "!true");
        }
    }

    false(b, message) {
        if (b) {
            this.state = false;
            this.messages.push(message || "!false");
        }
    }

    _closeTo(a, b, e = 1.0e-6) {
        return Math.abs(b - a) <= e;
    }

    closeTo(a, b, e = 1.0e-6, message) {
        if (e.constructor === String) {
            message = e;
            e = 1.0e-6;
        }

        if (Test.isArray(a) && Test.isArray(b)) {
            let al = a.length;
            let bl = b.length;
            if (al != bl) {
                this.state = false;
                if (message) {
                    this.messages.push(message);
                } else {
                    this.messages.push(a, "!=", b);
                }
                return;
            }
            for (let i = 0, l = a.length; i < l; ++i) {
                if (!this._closeTo(a[i], b[i], e)) {
                    this.state = false;
                    if (message) {
                        this.messages.push(message);
                    } else {
                        this.messages.push(a, "!=", b);
                    }
                    return;
                }
            }
            return;
        }

        if (!this._closeTo(a, b, e)) {
            this.state = false;
            if (message) {
                this.messages.push(message);
            } else {
                this.messages.push(a, "!=", b);
            }
        }
    }

    objectEquals(a, b, message) {
        if (a !== b) {
            this.state = false;
            if (message) {
                this.messages.push(message);
            } else {
                this.messages.push(a, "!=", b);
            }
            return;
        }
    }

    objectNotEquals(a, b, message) {
        if (a === b) {
            this.state = false;
            if (message) {
                this.messages.push(message);
            } else {
                this.messages.push(a, "!=", b);
            }
            return;
        }
    }

    _error(message) {
        this.state = false;
        this.messages.push(message);
        return false;
    }

    validateObject(object, validator, message) {
        if (object === undefined || typeof(object) != typeof(validator)) {
            if (typeof(validator) == "string") {
                if (object) {
                    if (object.toString() == validator) {
                        return true;
                    }
                }
            }
            return this._error(message || `type mismatch ${typeof(object)} != ${typeof(validator)} : ${object} ${validator}`);
        }

        if (Test.isArray(object)) {
            if (!Test.isArray(validator)) {
                return this._error(message || `array mismatch`);
            }
            if (validator.length != object.length)  {
                return this._error(message || `array length mismatch: ${validator.length} != ${object.length}`);
            }
            for (let i = 0, l = validator.length; i < l; ++i) {
                if (!this.validateObject(object[i], validator[i]))
                    return false;
            }
            return true;
        }

        if (typeof(object) != "object") {
            if (object !== validator) {
                return this._error(message || `value mismatch: ${object} != ${validator}`);
            }
            return true;
        }

        for (let p in validator) {
            let gp = object[p];
            let vp = validator[p];
            if (!this.validateObject(gp, vp)) {
                return false;
            }
        }

        return true;
    }

    equals(a, b, epsilon_message, message) {
        if (a === b) {
            return;
        }

        let epsilon = typeof(epsilon_message) === "number" ? epsilon_message : undefined;
        message = typeof(epsilon_message) === "string" ? epsilon_message : message;

        if (Test.isArray(a) && Test.isArray(b)) {
            let al = a.length;
            let bl = b.length;
            if (al != bl) {
                this.state = false;
                if (message) {
                    this.messages.push(message);
                } else {
                    this.messages.push(a.toString(), "!=", b.toString());
                }
                return;
            }
            for (let i = 0, l = a.length; i < l; ++i) {
                if (epsilon !== undefined) {
                    if (Math.abs(a[i] - b[i]) > epsilon) {
                        this.state = false;
                        if (message) {
                            this.messages.push(message);
                        } else {
                            this.messages.push(a.toString(), "!=", b.toString());
                        }
                        return;
                    }
                } else if (a[i] != b[i]) {
                    this.state = false;
                    if (message) {
                        this.messages.push(message);
                    } else {
                        this.messages.push(a, "!=", b);
                    }
                    return;
                }
            }
            return;
        }

        if (epsilon !== undefined) {
            if (Math.abs(a - b) > epsilon) {
                this.state = false;
                if (message) {
                    this.messages.push(message);
                } else {
                    this.messages.push(a, "!=", b);
                }
            }
        } else if (a != b) {
            this.state = false;
            if (message) {
                this.messages.push(message);
            } else {
                this.messages.push(a, "!=", b);
            }
        }
    }

    notEquals(a, b, message) {
        if (Test.isArray(a) && Test.isArray(b)) {
            if (a.length != b.length) {
                return;
            }
            let found = false;
            for (let i = 0, l = a.length; i < l; ++i) {
                if (a[i] != b[i]) {
                    found = true;
                }
            }
            if (!found) {
                this.state = false;
                if (message) {
                    this.messages.push(message);
                } else {
                    this.messages.push(a, "==", b);
                }
                return;
            }
            return;
        }
        if (a == b) {
            this.state = false;
            if (message) {
                this.messages.push(message);
            } else {
                this.messages.push(a, "==", b);
            }
        }
    }

    defined(a, message) {
        if (a === undefined) {
            this.state = false;
            this.messages.push(message || (a + " undefined"));
        }
    }

    undefined(a, message) {
        if (a !== undefined) {
            this.state = false;
            this.messages.push(message || (a + " defined"));
        }
    }

    isNull(a, message) {
        if (a !== undefined && a !== null) {
            this.state = false;
            this.messages.push(message || "expected null");
        }
    }

    notNull(a, message) {
        if (a === undefined || a === null) {
            this.state = false;
            this.messages.push(message || "expected not null");
        }
    }
}

export const __test = {
    totalTests: 0,
    totalFailed: 0,
};

let __group = {
    group: undefined,
    numTests: 0,
    testsFailed: 0,
    skipCatchError: false
};

function _copy(src) {
    const dst = new Uint8Array(src.byteLength);
    dst.set(new Uint8Array(src));
    return dst.buffer;
}

let __device = null;
async function getWebGPUDevice() {
    if (__device !== null) {
        return __device;
    }
    const adapter = await navigator.gpu.requestAdapter();
    __device = await adapter.requestDevice();

    __device.addEventListener('uncapturederror', (event) => {
        console.error(event.error.message);
    });

    return __device;
}

export async function shutdownDevice() {
    const dev = __device;
    if (dev !== null) {
        dev.destroy();
        __device = null;
    }
}

// Bytes per texel for the formats the GPU test helpers upload. Only the
// uncompressed formats the tests actually use need an entry.
const TexelByteSize = {
    "r8unorm": 1, "r8snorm": 1, "r8uint": 1, "r8sint": 1,
    "rg8unorm": 2, "rg8snorm": 2, "rg8uint": 2, "rg8sint": 2,
    "rgba8unorm": 4, "rgba8unorm-srgb": 4, "rgba8snorm": 4, "rgba8uint": 4, "rgba8sint": 4,
    "bgra8unorm": 4, "bgra8unorm-srgb": 4,
    "r16uint": 2, "r16sint": 2, "r16float": 2,
    "rg16uint": 4, "rg16sint": 4, "rg16float": 4,
    "rgba16uint": 8, "rgba16sint": 8, "rgba16float": 8,
    "r32uint": 4, "r32sint": 4, "r32float": 4,
    "rg32uint": 8, "rg32sint": 8, "rg32float": 8,
    "rgba32uint": 16, "rgba32sint": 16, "rgba32float": 16,
    "depth16unorm": 2, "depth32float": 4,
};

function _texelByteSize(format) {
    const size = TexelByteSize[format];
    if (size === undefined) {
        throw new Error(`Test helper does not know the texel size of ${format}`);
    }
    return size;
}

// Build the GPU resources for a bindgroup description, using the same entry
// conventions the emulator's bindGroups argument uses so a test can hand the
// identical object to both the GPU and the debugger:
//   TypedArray                                 -> storage buffer (read back)
//   { uniform: TypedArray }                    -> uniform buffer
//   { texture: [mip0, mip1, ...], descriptor } -> sampled / storage texture
//   { sampler: {...} }                         -> sampler
// `descriptor.usage` is optional: emulator-only descriptors omit it, so a
// sensible default is filled in. `viewDimension` on the entry (e.g. "cube",
// "2d-array", "3d") selects the view the shader binds; it is inferred from the
// descriptor when not given.
function _createBindGroupEntries(device, bindgroupData, readbackBuffers) {
    const bindGroups = {};

    const push = (group, entry) => {
        if (bindGroups[group] === undefined) {
            bindGroups[group] = [];
        }
        bindGroups[group].push(entry);
    };

    for (const group in bindgroupData) {
        for (const _binding in bindgroupData[group]) {
            const binding = parseInt(_binding);
            const data = bindgroupData[group][_binding];

            if (data.buffer instanceof ArrayBuffer) {
                const bufferSize = data.byteLength;
                const storageBuffer = device.createBuffer({
                    size: bufferSize,
                    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
                });
                device.queue.writeBuffer(storageBuffer, 0, data);
                push(group, { binding, resource: { buffer: storageBuffer } });

                if (readbackBuffers !== null) {
                    const readbackBuffer = device.createBuffer({
                        size: bufferSize,
                        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
                    });
                    readbackBuffers.push([storageBuffer, readbackBuffer, bufferSize]);
                }
            } else if (data.uniform !== undefined) {
                const uniformBuffer = device.createBuffer({
                    size: data.uniform.byteLength,
                    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                });
                device.queue.writeBuffer(uniformBuffer, 0, data.uniform);
                push(group, { binding, resource: { buffer: uniformBuffer } });
            } else if (data.sampler !== undefined) {
                push(group, { binding, resource: device.createSampler(data.sampler) });
            } else if (data.texture !== undefined && data.descriptor !== undefined) {
                const descriptor = data.descriptor;
                const format = descriptor.format ?? "rgba8unorm";
                const texelSize = _texelByteSize(format);
                const size = descriptor.size;
                const dimension = descriptor.dimension ?? "2d";
                const mips = Array.isArray(data.texture) ? data.texture : [data.texture];

                const texture = device.createTexture({
                    ...descriptor,
                    usage: descriptor.usage ?? (GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING),
                });

                // Each entry of `texture` is one mip level, tightly packed.
                // Only a 3d texture's depth shrinks with the mip level; array
                // layers and cube faces do not.
                for (let mip = 0; mip < mips.length; ++mip) {
                    const w = Math.max(1, size[0] >> mip);
                    const h = Math.max(1, (size[1] ?? 1) >> mip);
                    const layers = size[2] ?? 1;
                    const d = dimension === "3d" ? Math.max(1, layers >> mip) : layers;
                    device.queue.writeTexture({ texture, mipLevel: mip }, mips[mip],
                        { bytesPerRow: w * texelSize, rowsPerImage: h },
                        { width: w, height: h, depthOrArrayLayers: d });
                }

                const viewDimension = data.viewDimension ??
                    (dimension === "3d" ? "3d" : ((size[2] ?? 1) > 1 ? "2d-array" : "2d"));
                push(group, { binding, resource: texture.createView({ dimension: viewDimension }) });
            }
        }
    }

    return bindGroups;
}

export async function webgpuDispatch(shader, module, dispatchCount, bindgroupData, options) {
    const device = await getWebGPUDevice();

    if (dispatchCount.length === undefined) {
        dispatchCount = [dispatchCount, 1, 1];
    }

    const readbackBuffers = [];
    const bindGroups = _createBindGroupEntries(device, bindgroupData, readbackBuffers);

    const shaderModule = device.createShaderModule({code: shader});
    const info = await shaderModule.getCompilationInfo();
    if (info.messages.length) {
        for (const m of info.messages) {
            console.log(`${m.lineNum}:${m.linePos}: ${m.message}`);
        }
        throw new Error("Shader compilation failed");
    }

    let constants = {};
    if (options !== undefined) {
        if (options.constants !== undefined) {
            constants = options.constants
        }
    }

    const computePipeline = device.createComputePipeline({
        layout: "auto",
        compute: { module: shaderModule, entryPoint: module, constants }
    });

    const commandEncoder = device.createCommandEncoder();
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(computePipeline);

    for (const group in bindGroups) {
        const groupIndex = parseInt(group);
        const bindings = bindGroups[group];
        const bindGroup = device.createBindGroup({
            layout: computePipeline.getBindGroupLayout(groupIndex),
            entries: bindings
        });
        computePass.setBindGroup(groupIndex, bindGroup);
    }

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

// Render one draw and read the color target(s) back, so a render-stage test can
// compare the debugger's emulated vertex/fragment result against the GPU's.
//
// The color targets are rgba32float and are read back as tightly packed
// Float32Arrays of width * height * 4 values in row-major order, so a pixel's
// value is exactly what the fragment shader returned -- no format quantization
// sits between the shader and the assertion.
//
// options:
//   vertex / fragment  entry point names (default "vs" / "fs")
//   size               [width, height] of the color target(s) (default [1, 1])
//   targetCount        number of @location(n) color targets (default 1)
//   topology           primitive topology (default "point-list")
//   vertexCount / instanceCount / firstVertex / firstInstance  draw arguments
//   vertexBuffers      [{ arrayStride, stepMode, attributes, data }]
//   bindGroups         same shape as webgpuDispatch's bindgroupData
//   constants          pipeline-overridable constant values
//
// Returns a Float32Array when targetCount is 1, otherwise an array of them.
export async function webgpuRender(shader, options) {
    const device = await getWebGPUDevice();
    options = options ?? {};

    const vertexEntry = options.vertex ?? "vs";
    const fragmentEntry = options.fragment ?? "fs";
    const [width, height] = options.size ?? [1, 1];
    const targetCount = options.targetCount ?? 1;
    const constants = options.constants ?? {};
    const vertexBuffers = options.vertexBuffers ?? [];

    const shaderModule = device.createShaderModule({ code: shader });
    const info = await shaderModule.getCompilationInfo();
    if (info.messages.length) {
        for (const m of info.messages) {
            console.log(`${m.lineNum}:${m.linePos}: ${m.message}`);
        }
        throw new Error("Shader compilation failed");
    }

    const buffers = [];
    const gpuVertexBuffers = [];
    for (const vb of vertexBuffers) {
        const buffer = device.createBuffer({
            size: vb.data.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(buffer, 0, vb.data);
        gpuVertexBuffers.push(buffer);
        buffers.push({
            arrayStride: vb.arrayStride,
            stepMode: vb.stepMode ?? "vertex",
            attributes: vb.attributes,
        });
    }

    const targets = [];
    for (let i = 0; i < targetCount; ++i) {
        targets.push({ format: "rgba32float" });
    }

    const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: { module: shaderModule, entryPoint: vertexEntry, constants, buffers },
        fragment: { module: shaderModule, entryPoint: fragmentEntry, constants, targets },
        primitive: { topology: options.topology ?? "point-list" },
    });

    const bindGroups = _createBindGroupEntries(device, options.bindGroups ?? {}, null);

    const colorTextures = [];
    const colorAttachments = [];
    for (let i = 0; i < targetCount; ++i) {
        const texture = device.createTexture({
            size: [width, height, 1],
            format: "rgba32float",
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        });
        colorTextures.push(texture);
        colorAttachments.push({
            view: texture.createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: "clear",
            storeOp: "store",
        });
    }

    const commandEncoder = device.createCommandEncoder();
    const pass = commandEncoder.beginRenderPass({ colorAttachments });
    pass.setPipeline(pipeline);

    for (const group in bindGroups) {
        const groupIndex = parseInt(group);
        pass.setBindGroup(groupIndex, device.createBindGroup({
            layout: pipeline.getBindGroupLayout(groupIndex),
            entries: bindGroups[group],
        }));
    }

    for (let i = 0; i < gpuVertexBuffers.length; ++i) {
        pass.setVertexBuffer(i, gpuVertexBuffers[i]);
    }

    pass.draw(options.vertexCount ?? 1, options.instanceCount ?? 1,
        options.firstVertex ?? 0, options.firstInstance ?? 0);
    pass.end();

    // copyTextureToBuffer requires a 256-byte aligned bytesPerRow, so the
    // readback is padded and unpacked back to a tightly packed array below.
    const texelSize = _texelByteSize("rgba32float");
    const paddedBytesPerRow = (width * texelSize + 255) & ~255;
    const readbacks = [];
    for (let i = 0; i < targetCount; ++i) {
        const readback = device.createBuffer({
            size: paddedBytesPerRow * height,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        commandEncoder.copyTextureToBuffer({ texture: colorTextures[i] },
            { buffer: readback, bytesPerRow: paddedBytesPerRow, rowsPerImage: height },
            { width, height, depthOrArrayLayers: 1 });
        readbacks.push(readback);
    }

    device.queue.submit([commandEncoder.finish()]);

    const results = [];
    for (let i = 0; i < targetCount; ++i) {
        const readback = readbacks[i];
        await readback.mapAsync(GPUMapMode.READ);
        const padded = new Uint8Array(_copy(readback.getMappedRange()));
        readback.unmap();
        readback.destroy();
        colorTextures[i].destroy();

        const pixels = new Float32Array(width * height * 4);
        for (let y = 0; y < height; ++y) {
            const row = new Float32Array(padded.buffer, y * paddedBytesPerRow, width * 4);
            pixels.set(row, y * width * 4);
        }
        results.push(pixels);
    }

    for (const b of gpuVertexBuffers) {
        b.destroy();
    }

    return targetCount === 1 ? results[0] : results;
}

// The interpolated value of `uv = clipPosition.xy * 0.5 + 0.5` at each pixel
// center of a `width` x `height` render target, in the same TL, TR, BL, BR lane
// order the fragment quad debugger uses. Framebuffer y runs down while clip y
// runs up, so uv.y is flipped.
//
// A test renders a full-viewport triangle carrying that uv, then feeds these
// exact values to the debugger as the fragment stage's interpolated inputs.
export function pixelCenterUVs(width, height) {
    const uvs = [];
    for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
            uvs.push([(x + 0.5) / width, 1 - (y + 0.5) / height]);
        }
    }
    return uvs;
}

export async function group(name, f, skipCatchError) {
    let div = document.createElement("div");
    div.className = "test_group";
    div.textContent = name;
    document.body.append(div);

    const group = {
        group: div,
        numTests: 0,
        testsFailed: 0,
        skipCatchError: !!skipCatchError
    };

    __group = group;

    if (skipCatchError) {
        await f()
    } else {
        try {
            await f();
        } catch (error) {
            div = document.createElement("div");
            div.className = "test_status_fail";
            div.textContent = `${error}`;
            document.body.appendChild(div);
        }
    }

    div = document.createElement("div");
    document.body.appendChild(div);

    const numPassed = group.numTests - group.testsFailed;
    div.className = (group.testsFailed > 0) ? "test_status_fail" : "test_status_pass";
    div.textContent = `Tests: ${numPassed} / ${group.numTests}`;

    __test.totalTests += group.numTests;
    __test.totalFailed += group.testsFailed;
}

function _printLog(log) {
    const space = "<span class=\"test_log_space\"></span>";
    for (const l of log) {
        const div = document.createElement("div");
        div.className = "test_log";
        div.innerHTML = l.join(space);
        if (group.group !== undefined) {
            group.group.appendChild(div);
        } else {
            document.body.appendChild(div);
        }
    }
}

export async function test(name, func, skipCatchError) {
    const t = new Test();
    const group = __group;
    group.numTests++;

    skipCatchError = !!skipCatchError || group.skipCatchError;

    if (skipCatchError) {
        await func(t);
    } else {
        try {
            await func(t);
        } catch (error) {
            group.testsFailed++;
            const div = document.createElement("div");
            div.className = "test_fail";
            let stack = "";
            if (error.stack !== undefined) {
                stack = ` ${error.stack}`;
            }
            if (error.fileName !== undefined) {
                div.textContent = `${name} FAILED: ${error.fileName}:${error.lineNumber}: ${error} ${stack}`;
            } else {
                div.textContent = `${name} FAILED: ${error} ${stack}`;
            }

            if (group.group !== undefined) {
                group.group.appendChild(div);
            } else {
                document.body.append(div);
            }

            _printLog(t._log);

            return;
        }
    }

    let msg = "";
    if (!t.state) {
        group.testsFailed++;
        for (let m of t.messages) {
            msg += " : " + m;
        }
    }

    const div = document.createElement("div");
    div.className = t.state ? "test_pass" : "test_fail";
    div.textContent = `${name} ${t.state ? "PASSED" : "FAILED"}: ${msg}`;

    if (group.group != undefined) {
        group.group.appendChild(div);
    } else {
        document.body.append(div);
    }

    _printLog(t._log);
}

