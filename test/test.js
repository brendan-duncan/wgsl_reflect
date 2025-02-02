
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
            if (object !== validator)
                return this._error(message || `value mismatch: ${object} != ${validator}`);
            return true;
        }

        for (let p in validator) {
            let gp = object[p];
            let vp = validator[p];
            if (!this.validateObject(gp, vp))
                return false;
        }

        return true;
    }

    equals(a, b, message) {
        if (a === b) {
            return;
        }
        if (Test.isArray(a) && Test.isArray(b)) {
            let al = a.length;
            let bl = b.length;
            if (al != bl) {
                this.state = false;
                if (message)
                    this.messages.push(message);
                else
                    this.messages.push(a.toString(), "!=", b.toString());
                return;
            }
            for (let i = 0, l = a.length; i < l; ++i) {
                if (a[i] != b[i]) {
                    this.state = false;
                    if (message)
                        this.messages.push(message);
                    else
                        this.messages.push(a, "!=", b);
                    return;
                }
            }
            return;
        }

        if (a != b) {
            this.state = false;
            if (message)
                this.messages.push(message);
            else
                this.messages.push(a, "!=", b);
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

export async function webgpuDispatch(shader, module, dispatchCount, bindgroupData) {
    const device = await getWebGPUDevice();

    if (dispatchCount.length === undefined) {
        dispatchCount = [dispatchCount, 1, 1];
    }

    const readbackBuffers = [];
    const bindGroups = {};

    for (const group in bindgroupData) {
        for (const binding in bindgroupData[group]) {
            const data = bindgroupData[group][binding];
            if (data.buffer instanceof ArrayBuffer) {
                const bufferSize = data.byteLength;

                const storageBuffer = device.createBuffer({
                    size: bufferSize,
                    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
                });
                device.queue.writeBuffer(storageBuffer, 0, data);

                if (bindGroups[group] === undefined) {
                    bindGroups[group] = [];
                }
                bindGroups[group].push({ binding: parseInt(binding), resource: { buffer: storageBuffer } });

                const readbackBuffer = device.createBuffer({
                    size: bufferSize,
                    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
                });
                readbackBuffers.push([storageBuffer, readbackBuffer, bufferSize]);
            }
        }
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

export async function group(name, f, skipCatchError) {
    let div = document.createElement("div");
    div.className = "test_group";
    div.innerText = name;
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
            div.innerText = `${error}`;
            document.body.appendChild(div);
        }
    }

    div = document.createElement("div");
    document.body.appendChild(div);

    const numPassed = group.numTests - group.testsFailed;
    div.className = (group.testsFailed > 0) ? "test_status_fail" : "test_status_pass";
    div.innerText = `Tests: ${numPassed} / ${group.numTests}`;

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
            if (error.fileName != undefined) {
                div.innerText = `${name} FAILED: ${error.fileName}:${error.lineNumber}: ${error}. ${error.stack}`;
            } else {
                div.innerText = `${name} FAILED: ${error}. ${error.stack}`;
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
    div.innerText = `${name} ${t.state ? "PASSED" : "FAILED"}: ${msg}`;

    if (group.group != undefined) {
        group.group.appendChild(div);
    } else {
        document.body.append(div);
    }

    _printLog(t._log);
}

