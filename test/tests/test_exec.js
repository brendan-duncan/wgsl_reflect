import { test, group, webgpuDispatch } from "../test.js";
import { WgslExec, WgslParser } from "../../wgsl_reflect.module.js";

function _newWgslExec(code) {
    return new WgslExec(WgslParser.Parse(code));
}

export async function run() {
    await group("WgslExec", async function () {
        await test("swizzle on a call result", async function (test) {
            // Regression: a postfix on a call expression (user function or
            // builtin) was dropped, so `three().wzy` evaluated as the full
            // vec4 — flowing 4-vectors into 3-vector math downstream.
            const shader = `
                @group(0) @binding(0) var<storage, read_write> data: array<vec3f, 2>;
                fn three() -> vec4f { return vec4f(1.0, 2.0, 3.0, 4.0); }
                @compute @workgroup_size(1) fn main() {
                    data[0] = three().wzy;
                    data[1] = abs(vec4f(-5.0, -6.0, -7.0, -8.0)).wzy;
                }`;
            const dataBuffer = new Float32Array(8);
            const bg = {0: {0: dataBuffer}};
            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", 1, bg);
            test.equals(Array.from(dataBuffer.slice(0, 3)), [4, 3, 2]);
            test.equals(Array.from(dataBuffer.slice(4, 7)), [8, 7, 6]);
        });

        await test("mat4x4 vec4f multiply", async function (test) {
            const shader = `
                @group(0) @binding(0) var<storage, read_write> data: vec4f;
                @compute @workgroup_size(1) fn main() {
                    let m = mat4x4<f32>(
                                2.0, 0.0, 0.0, 0.0,
                                0.0, 2.0, 0.0, 0.0,
                                0.0, 0.0, 2.0, 0.0,
                                0.0, 0.0, 0.0, 1.0 );
                    data = m * vec4f(1.0, 1.0, 1.0, 1.0);
                }`;
            const dataBuffer = new Float32Array([0, 0, 0, 0]);
            const bg = {0: {0: dataBuffer}};

            const _data = await webgpuDispatch(shader, "main", 1, bg);
            const webgpuData = new Float32Array(_data);
            // Ensure we can dispatch a compute shader and get the expected results from the output buffer.
            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", 1, bg);
            test.equals(dataBuffer, webgpuData);
        });

        await test("mat3x2 array index", async function (test) {
            const shader = `
                struct S {
                    v4: vec4f,
                };
                @group(0) @binding(0) var<storage, read_write> data: vec3f;
                @compute @workgroup_size(1) fn main() {
                    let m = mat3x3<f32>(2.0, 0.0, 0.0, 
                                0.0, 2.0, 0.0,
                                0.0, 0.0, 2.0, );
                    let v = S(vec4f(vec3f(1.0, 4.0, 8.0), 10.0));
                    data = m[0] * v.v4.xyz * v.v4[1];
                }`;
            const dataBuffer = new Float32Array([0, 0, 0]);
            const bg = {0: {0: dataBuffer}};

            const _data = await webgpuDispatch(shader, "main", 1, bg);
            const webgpuData = new Float32Array(_data);
            // Ensure we can dispatch a compute shader and get the expected results from the output buffer.
            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", 1, bg);
            test.equals(dataBuffer, webgpuData);
        });

        await test("deferred const", async function (test) {
            const shader = `
                @group(0) @binding(0) var<storage, read_write> data: vec4f;
                @compute @workgroup_size(1) fn main() {
                    data = foo;
                }
                const foo = vec4f(1.0 + 2);`;
            const dataBuffer = new Float32Array([0, 0, 0, 0]);
            const bg = {0: {0: dataBuffer}};
            const _data = await webgpuDispatch(shader, "main", 1, bg);
            const webgpuData = new Float32Array(_data);
            // Ensure we can dispatch a compute shader and get the expected results from the output buffer.
            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", 1, bg);
            test.equals(dataBuffer, webgpuData);
        });

        await test("mat3x4 * mat4x3", async function (test) {
            const shader = `
                @group(0) @binding(0) var<storage, read_write> data: vec4f;
                @compute @workgroup_size(1) fn main() {
                    let m1 = mat3x4f(1.0, 0.0, 0.0,
                                     0.0, 2.0, 0.0,
                                     0.0, 0.0, 3.0,
                                     0.0, 0.0, 0.0);
                    let m2 = mat4x3f(3.0, 0.0, 0.0, 0.0,
                                     0.0, 1.0, 0.0, 0.0,
                                     0.0, 0.0, 2.0, 0.0);
                    let m = m1 * m2;
                    let v = vec4(vec3f(1.0, 1.0, 1.0), 1.0);
                    data = v * m;
                }`;
            const dataBuffer = new Float32Array([0, 0, 0, 0]);
            const bg = {0: {0: dataBuffer}};

            const _data = await webgpuDispatch(shader, "main", 1, bg);
            const webgpuData = new Float32Array(_data);
            // Ensure we can dispatch a compute shader and get the expected results from the output buffer.
            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", 1, bg);
            test.equals(dataBuffer, webgpuData);
        });

        await test("mat3x2 * vec3", async function (test) {
            const shader = `
                @group(0) @binding(0) var<storage, read_write> data: vec2f;
                @compute @workgroup_size(1) fn main() {
                    let m = mat3x2f(1.0, 0.0, 0.0, 
                                0.0, 2.0, 0.0, );
                    let v = vec3f(1.0, 1.0, 1.0);
                    data = m * v;
                }`;
            const dataBuffer = new Float32Array([0, 0]);
            const bg = {0: {0: dataBuffer}};

            const _data = await webgpuDispatch(shader, "main", 1, bg);
            const webgpuData = new Float32Array(_data);
            // Ensure we can dispatch a compute shader and get the expected results from the output buffer.
            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", 1, bg);
            test.equals(dataBuffer, webgpuData);
        });

        await test("vec3 * mat2x3", async function (test) {
            const shader = `
                @group(0) @binding(0) var<storage, read_write> data: vec3f;
                @compute @workgroup_size(1) fn main() {
                    let m = mat2x3f(1.0, 0.0, 0.0, 
                                0.0, 2.0, 0.0, );
                    let v = vec2f(1.0, 1.0);
                    data = m * v;
                }`;
            const dataBuffer = new Float32Array([0, 0, 0]);
            const bg = {0: {0: dataBuffer}};

            const _data = await webgpuDispatch(shader, "main", 1, bg);
            const webgpuData = new Float32Array(_data);
            // Ensure we can dispatch a compute shader and get the expected results from the output buffer.
            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", 1, bg);
            test.equals(dataBuffer, webgpuData);
        });

        await test("mat4x4 * mat4x4", async function (test) {
            const shader = `
                @group(0) @binding(0) var<storage, read_write> data: vec4f;
                @compute @workgroup_size(1) fn main() {
                    let m1 = mat4x4f(1.0, 0.0, 0.0, 0.0,
                                     0.0, 2.0, 0.0, 0.0,
                                     0.0, 0.0, 3.0, 0.0,
                                     0.0, 0.0, 0.0, 1.0);
                    let m2 = mat4x4f(3.0, 0.0, 0.0, 0.0,
                                     0.0, 1.0, 0.0, 0.0,
                                     0.0, 0.0, 2.0, 0.0,
                                     0.0, 0.0, 0.0, 1.0);
                    let m = m1 * m2;
                    let v = vec4(vec3f(1.0, 1.0, 1.0), 1.0);
                    data = v * m;
                }`;
            const dataBuffer = new Float32Array([0, 0, 0, 0]);
            const bg = {0: {0: dataBuffer}};

            const _data = await webgpuDispatch(shader, "main", 1, bg);
            const webgpuData = new Float32Array(_data);
            // Ensure we can dispatch a compute shader and get the expected results from the output buffer.
            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", 1, bg);
            test.equals(dataBuffer, webgpuData);
        });

        await test("vec4 * mat4x4 ", async function (test) {
            const shader = `
                @group(0) @binding(0) var<storage, read_write> data: vec4f;
                @compute @workgroup_size(1) fn main() {
                    let m = mat4x4f(1.0, 0.0, 0.0, 0.0,
                                0.0, 2.0, 0.0, 0.0,
                                0.0, 0.0, 3.0, 0.0,
                                0.0, 0.0, 0.0, 1.0);
                    let v = vec4(vec3f(1.0, 1.0, 1.0), 1.0);
                    data = v * m;
                }`;
            const dataBuffer = new Float32Array([0, 0, 0, 0]);
            const bg = {0: {0: dataBuffer}};

            const _data = await webgpuDispatch(shader, "main", 1, bg);
            const webgpuData = new Float32Array(_data);
            // Ensure we can dispatch a compute shader and get the expected results from the output buffer.
            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", 1, bg);
            test.equals(dataBuffer, webgpuData);
        });

        await test("mat4x4 * vec4", async function (test) {
            const shader = `
                @group(0) @binding(0) var<storage, read_write> data: vec4f;
                @compute @workgroup_size(1) fn main() {
                    let m = mat4x4f(1.0, 0.0, 0.0, 0.0,
                                0.0, 2.0, 0.0, 0.0,
                                0.0, 0.0, 3.0, 0.0,
                                0.0, 0.0, 0.0, 1.0);
                    let v = vec4(vec3f(1.0, 1.0, 1.0), 1.0);
                    data = m * v;
                }`;
            const dataBuffer = new Float32Array([0, 0, 0, 0]);
            const bg = {0: {0: dataBuffer}};

            const _data = await webgpuDispatch(shader, "main", 1, bg);
            const webgpuData = new Float32Array(_data);
            // Ensure we can dispatch a compute shader and get the expected results from the output buffer.
            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", 1, bg);
            test.equals(dataBuffer, webgpuData);
        });

        await test("callexpr", async function (test) {
            const shader = `
                fn photon() -> vec3f {
                    var ray = new_light_ray();
                    return ray.dir;
                }
                fn new_light_ray() -> Ray {
                    let center = vec3f(0.0, 0.0, 0.0);
                    let pos = center + vec3f(0.0, 0.1, 0.0);
                    var rc = vec3f(1.0, 2.0, 3.0);
                    var dir = rc.xzy;
                    dir.y = -dir.y;
                    return Ray(pos, dir);
                }
                struct Ray {
                    start : vec3f,
                    dir   : vec3f,
                };
                let foo = photon();`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            test.equals(wgsl.getVariableValue("foo"), [1, -3, 2]);
        });

        await test("atomic add struct", async function (test) {
            const shader = `
            struct Counter {
                countX: atomic<u32>,
                countY: atomic<u32>,
                countZ: atomic<u32>,
                countW: atomic<u32>,
            };
            @group(0) @binding(0) var<storage, read_write> data: Counter;
            @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id: vec3<u32>) {
                atomicAdd(&data.countX, 1u);
                atomicAdd(&data.countY, 2u);
                atomicAdd(&data.countZ, 3u);
                atomicAdd(&data.countW, 4u);
            }`;
            const dataBuffer = new Uint32Array([1, 2, 3, 4]);
            const bg = {0: {0: dataBuffer}};

            const _data = await webgpuDispatch(shader, "main", 2, bg);
            const webgpuData = new Uint32Array(_data);
            // Ensure we can dispatch a compute shader and get the expected results from the output buffer.
            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", 2, bg);
            test.equals(dataBuffer, webgpuData);
        });

        await test("vec4 format", async function (test) {
            const shader = `let lightViewPos = vec4(vec3f(1.0, 2.0, 3.0), 4.0);`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            test.equals(wgsl.getVariableValue("lightViewPos"), [1, 2, 3, 4]);
        });

        await test("pointer accessor", async function (test) {
            const shader = `
            fn foo(p : ptr<function, array<u32, 4>>, i : i32) -> u32 {
                let p1 = p;
                var x = i;
                let p2 = &((*p1)[x]);
                x = 0;
                *p2 = 6;
                return (*p1)[x];
            }

            fn foo_for_analysis(p : ptr<function, array<u32, 4>>, i : i32) -> u32 {
                var p_var = *p;
                let p1 = &p_var;
                var x = i;
                let x_tmp1 = x;
                let p2 = &(p_var[x_tmp1]);
                x = 0;
                *(&(p_var[x_tmp1])) = 5;
                return (*(&p_var))[x + 1];
            }

            let a = array<u32, 4>(1, 2, 3, 4);
            let b = foo(&a, 2);
            let c = foo_for_analysis(&a, 1);`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            test.equals(wgsl.getVariableValue("a"), [1, 5, 6, 4]);
            test.equals(wgsl.getVariableValue("b"), 1);
            test.equals(wgsl.getVariableValue("c"), 5);
        });

        await test("shadow variable", async function (test) {
            const shader = `@group(0) @binding(0) var<storage, read_write> data: array<vec3f>;
            @compute @workgroup_size(1) fn main(@builtin(global_invocation_id) id: vec3<u32>) {
                let i = id.x;
                let j = 2.0;
                var k = f32(id.x);
                let l = vec3f(j, j, j);
                data[i].x = data[i].x * j;
                {
                    // Make sure variables defined in blocks shadow outer variables, and that
                    // changes to non-shadowed variables are reflected in the outer scope.
                    k = 3.0;
                    let j = 3.0;
                    data[i].y = data[i].y * 3.0;
                    let l = 42.0;
                }
                data[i].z = k * j * l.x;
            }`;

            const buffer = new Float32Array([1, 2, 3, 0, 4, 5, 6, 0, 7, 8, 9, 0]);
            const bg = {0: {0: buffer}};

            const _data = await webgpuDispatch(shader, "main", 3, bg);
            const webgpuData = new Float32Array(_data);

            // Ensure we can dispatch a compute shader and get the expected results from the output buffer.
            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", 3, bg);
            test.equals(buffer, webgpuData);
        });

        await test("component reference from composite reference", async function (test) {
            const shader = `
                struct S {
                    age: i32,
                    weight: f32
                }
                var<private> person: S;
                var<private> uv: vec2<f32>;
                var<private> m: mat3x2<f32>;

                fn f() -> f32 {
                    uv.x = 1.0;
                    uv[1] = 2.0;

                    let p_m_col2: vec2<f32> = m[2];

                    var A: array<i32,5>;
                    let A_4_value: i32 = A[4];

                    let person_weight: f32 = person.weight;

                    let uv_ptr = &uv;
                    *uv_ptr = vec2f(3.0, 4.0);
                    uv_ptr.x = 5.0;
                    uv_ptr[1] = 6.0;

                    let m_ptr = &m;
                    m_ptr[2] = vec2f(7.0, 8.0);
                    let p_m_col2: vec2<f32> = m_ptr[2];

                    let A_Ptr = &A;
                    let A_4_value: i32 = A_Ptr[4];

                    let person_ptr = &person;
                    person_ptr.weight = 9.0;
                    let person_weight: f32 = person_ptr.weight;

                    return person_weight;
                }

                let person_weight = f();`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            test.equals(wgsl.getVariableValue("uv"), [5, 6]);
            test.equals(wgsl.getVariableValue("m"), [0, 0, 0, 0, 7, 8]);
            test.equals(wgsl.getVariableValue("person_weight"), 9);
        });

        await test("matrix pointer", async function (test) {
            const shader = `
                var<private> m: mat3x2<f32>;
                fn f() -> f32 {
                    let m_ptr = &m;
                    m_ptr[2] = vec2f(1.0, 2.0);
                    return m[2].y;
                }
                let foo = f();`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            test.equals(wgsl.getVariableValue("foo"), 2);
        });

        await test("pointer", async function (test) {
            const shader = `
            fn foo() -> f32 {
                var x = 1.5;
                let px = &x;  // Get a pointer to x
                *px = 3.0;    // Update x through px.
                return x;
            }
            var bar = foo();`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            test.equals(wgsl.getVariableValue("bar"), 3);
        });

        await test("variable pointer", async function (test) {
            const shader = `
                var<private> x: f32;
                fn f() -> i32 {
                    var y: i32;
                    let x_ptr: ptr<private,f32> = &x;
                    let y_ptr: ptr<function,i32> = &y;
                    *y_ptr = 3;
                    var x: u32;
                    let inner_x_ptr: ptr<function,u32> = &x;
                    *inner_x_ptr = 5;
                    *x_ptr = 8.0;
                    return y;
                }
                let y = f();`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            test.equals(wgsl.getVariableValue("x"), 8);
            test.equals(wgsl.getVariableValue("y"), 3);
        });

        await test("struct pointer", async function (test) {
            const shader = `
                struct Particle {
                    position: vec3<f32>,
                    velocity: vec3<f32>
                }
                struct System {
                    active_index: i32,
                    timestep: f32,
                    particles: array<Particle,100>
                }
                @group(0) @binding(0) var<storage,read_write> system: System;

                @compute @workgroup_size(1)
                fn main(@builtin(global_invocation_id) id: vec3u) {
                    // Form a pointer to a specific Particle in storage memory.
                    let active_particle: ptr<storage,Particle,read_write> =
                        &system.particles[id.x];

                    let delta_position: vec3<f32> = (*active_particle).velocity * system.timestep;
                    let current_position: vec3<f32>  = (*active_particle).position;
                    (*active_particle).position = delta_position + current_position;
                }`;

            // Verify the emulated dispatch has the same results as the WebGPU dispatch.
            const buffer = new Float32Array(32 * 100 + 4);
            buffer[0] = 0; // active_index
            buffer[1] = 1; // timestep
            for (let i = 0, j = 3; i < 100; ++i, j += 8) {
                buffer[j + 0] = i;
                buffer[j + 1] = i + 1;
                buffer[j + 2] = i + 2;
                buffer[j + 3] = i + 3;

                buffer[j + 4] = i + 4;
                buffer[j + 5] = i + 5;
                buffer[j + 6] = i + 6;
                buffer[j + 7] = i + 7;
            }
            const bg = {0: {0: buffer}};

            const wgCount = 100;
            const _data = await webgpuDispatch(shader, "main", wgCount, bg);
            const webgpuData = new Float32Array(_data);

            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", wgCount, bg);
            test.closeTo(buffer, webgpuData);
        });

        await test("pointers", function (test) {
            const shader = `
                fn f() -> f32 {
                    var x: f32 = 1.5;
                    let px = &x;  // Get a pointer to x
                    *px = 3.0;    // Update x through px.
                    // Now x is 3.0
                    return x;
                }
                var<private> age: f32;
                fn happy_birthday() {
                    let age_ptr = &age;       // Get a pointer.
                    *age_ptr = *age_ptr + 1;  // Updates 'age'
                }
                fn main() -> f32 {
                    age = 6.0 * f();
                    happy_birthday();
                    // Now age is 19.0
                    return age;
                }
                let foo = main();`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            test.equals(wgsl.getVariableValue("foo"), 19);
        });

        await test("default value", function (test) {
            const shader = `var<private> foo: vec3f; var<private> bar: vec3f;
            fn main()-> f32 { bar.y = 5.0; foo.x = bar.y; return foo.x; }
            let bar2 = main();`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            // Ensure the top-level instructions were executed and the global variable has the correct value.
            test.equals(wgsl.getVariableValue("bar2"), 5);
        });

        await test("array struct member", function (test) {
            const shader = `
                struct Ray {
                    origin: vec3f,
                    direction: vec3f
                }
                fn foo() -> vec3f {
                    let r = array<Ray, 2>();
                    r[0].direction = vec3f(4.0, 5.0, 6.0);
                    let foo = r[0].direction * 0.5;
                    return foo;
                }
                let bar = foo();`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            test.closeTo(wgsl.getVariableValue("bar"), [2, 2.5, 3]);
        });

        await test("mat array access", function (test) {
            const shader = `const a = mat4x4f(1.0, 0.0, 0.0, 0.0,
                                              0.0, 1.0, 0.0, 0.0,
                                              0.0, 0.0, 1.0, 0.0,
                                              0.0, 0.0, 0.0, 1.0);
            const v4 = vec4f(a[1].xyz * vec3f(0.5), 0.5);
            struct Foo { a: mat4x4f }
            const foo = Foo(a);
            const v4b = vec4f(foo.a[1].xyz * vec3f(0.5), 0.5);`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            // Ensure the top-level instructions were executed and the global variable has the correct value.
            test.equals(wgsl.getVariableValue("v4"), [0, 0.5, 0, 0.5]);
            test.equals(wgsl.getVariableValue("v4b"), [0, 0.5, 0, 0.5]);
        });

        await test("vec component", function (test) {
            const shader = `let foo = vec2f(1.0, 2.0).y;`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            // Ensure the top-level instructions were executed and the global variable has the correct value.
            test.equals(wgsl.getVariableValue("foo"), 2);
        });

        await test("any vec2", function (test) {
            const shader = `
                fn foo() -> i32 {
                    let dims = vec2u(3, 4);
                    let coord = vec2u(1, 2);
                    if (all(coord < dims)) {
                        return 1;
                    }
                    return 0;
                }
                let bar = foo();`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            test.equals(wgsl.getVariableValue("bar"), 1);
        });

        await test("struct construction in return", function (test) {
            const shader = `
                struct Foo {
                    a: i32,
                    b: f32
                }
                fn foo() -> Foo {
                    return Foo(1, 2.0);
                }
                let bar = foo();
                let baz = bar.a + bar.b;`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            test.equals(wgsl.getVariableValue("baz"), 3.0);
        });

        await test("switch default selector", function (test) {
            const shader = `
              const c = 2;
              fn foo(x: i32) -> i32 {
                var a : i32;
                switch x {
                  case 0: { // colon is optional
                    a = 1;
                  }
                  case 3, default { // The default keyword can be used with other clauses
                    a = 4;
                  }
                  case 1, c { // Const-expression can be used in case selectors
                    a = 3;
                  }
                }
                return a;
              }
              let x = foo(2);
              let y = foo(5);`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            test.equals(wgsl.getVariableValue("x"), 3);
            test.equals(wgsl.getVariableValue("y"), 4);
        });

        await test("struct shadow", function (test) {
            const shader = `struct Time { frame: u32, elapsed: f32, delta: f32 }
            const time = Time(1, 2.0, 3.0);
            fn foo() -> f32 {
                let time = 0.5;
                return time;
            }
            fn bar() -> f32 {
                return time.elapsed;
            }
            let frame = bar() * foo();`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            // Ensure the top-level instructions were executed and the global variable has the correct value.
            test.equals(wgsl.getVariableValue("frame"), 1.0);
        });

        await test("array construction", function (test) {
            const shader = `var<private> a: array<vec4f, 3u>;
            var<private> v4 = vec4f(vec2f().xy, a[0].zw);`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            // Ensure the top-level instructions were executed and the global variable has the correct value.
            test.equals(wgsl.getVariableValue("v4"), [0, 0, 0, 0]);
        });

        await test("bitcast vec", function (test) {
            const shader = `var<private> v2 = vec2f(-1.0, -2.0);
            var<private> v3a = bitcast<vec2u>(v2);
            var<private> v3b = bitcast<vec2<i32>>(v2);`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            // Ensure the top-level instructions were executed and the global variable has the correct value.
            test.equals(wgsl.getVariableValue("v3a"), [3212836864, 3221225472]);
            test.equals(wgsl.getVariableValue("v3b"), [3212836864, 3221225472]);
        });

        await test("vec construction", function (test) {
            const shader = `var<private> v2 = vec2f(-1.0, -2.0);
            var<private> v3a = vec3f(1, 2, 3);
            var<private> v3b = vec3f(v2, 4);
            var<private> v3c = vec3f(5, v2);
            var<private> v4a = vec4f(1, 2, 3, 4);
            var<private> v4b = vec4f(v2, 3, 4);
            var<private> v4c = vec4f(1, v2, 4);
            var<private> v4d = vec4f(1, 2, v2);
            var<private> v4e = vec4f(v2, v2);
            var<private> v4f = vec4f(v3a, 4);
            var<private> v4g = vec4f(1, v3b);
            var<private> v4h = vec4f(v4g);`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            // Ensure the top-level instructions were executed and the global variable has the correct value.
            test.equals(wgsl.getVariableValue("v4h"), [1, -1, -2, 4]);
        });

        await test("vec bool", function (test) {
            const shader = `var<private> foo: vec3<bool>;`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            // Ensure the top-level instructions were executed and the global variable has the correct value.
            test.equals(wgsl.getVariableValue("foo"), [0, 0, 0]);
        });

        await test("set variable", function (test) {
            const shader = `let foo = 1 + 2;`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            // Ensure the top-level instructions were executed and the global variable has the correct value.
            test.equals(wgsl.getVariableValue("foo"), 3);
        });

        await test("multiple variables", function (test) {
            const shader = `let foo = 1.0 + 2;
            let bar = foo * 4;`;

            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            // Ensure as the top-level instructions are executed, variables are correctly evaluated.
            test.equals(wgsl.getVariableValue("foo"), 3);
            test.equals(wgsl.getVariableValue("bar"), 12);
        });

        await test("bitcast", function (test) {
            const shader = `let foo = bitcast<u32>(1.5);`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            // Ensure the top-level instructions were executed and the global variable has the correct value.
            test.equals(wgsl.getVariableValue("foo"), 1069547520);
        });

        await test("call function", function (test) {
            const shader = `
            var<private> bvec: vec2<bool>;
            fn foo(a: i32, b: i32) -> i32 {
                if (b != 0) {
                    bvec.x = true;
                    return a / b;
                } else {
                    bvec.y = true;
                    return a * b;
                }
            }
            let bar = foo(3, 4);`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            // Ensure calling a function works as expected.
            test.equals(wgsl.getVariableValue("bar"), 0);
            test.equals(wgsl.getVariableValue("bvec"), [1, 0]);
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
            const bg = {0: {0: buffer}};

            const _data = await webgpuDispatch(shader, "main", 4, bg);
            const webgpuData = new Float32Array(_data);

            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", 4, bg);
            test.equals(buffer, webgpuData);
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
            const bindGroups = {0: {0: buffer}};

            const _data = await webgpuDispatch(shader, "main", 1, bindGroups);
            const webgpuData = new Uint32Array(_data);

            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", 1, bindGroups);
            test.equals(buffer, webgpuData);
        });

        await test("struct data", async function (test) {
            const shader = `
                @group(0) @binding(0) var<storage, read_write> buffer: array<f32>;
                struct Bar {
                    a: vec3f,
                    b: vec2f
                }
                struct Foo {
                    bar: Bar,
                    bar2: Bar
                }
                var<private> bar3: vec2f;
                @compute @workgroup_size(1)
                fn main(@builtin(global_invocation_id) id: vec3<u32>) {
                    let foo = Foo(Bar(vec3f(1.0, 2.0, 3.0), vec2f(4.0, 5.0)),
                                Bar(vec3f(6.0, 7.0, 8.0), vec2f(10.0, 10.0)));
                    let i = id.x;
                    let bar2 = foo.bar2;
                    bar3.x = foo.bar2.a.y;
                    bar3.y = foo.bar2.a.x;
                    buffer[i] = bar3.x;
                }`;

            // Verify the emulated dispatch has the same results as the WebGPU dispatch.
            const buffer = new Float32Array([1, 2, 6, 0]);
            const bg = {0: {0: buffer}};

            const _data = await webgpuDispatch(shader, "main", 4, bg);
            const webgpuData = new Float32Array(_data);

            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", 4, bg);
            test.equals(buffer, webgpuData);
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
            const bg = {0: {0: buffer}};

            const _data = await webgpuDispatch(shader, "main", 3, bg);
            const webgpuData = new Float32Array(_data);

            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", 3, bg);
            test.equals(buffer, webgpuData);
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
            const bg = {0: {0: dataBuffer}};

            const _data = await webgpuDispatch(shader, "main", 3, bg);
            const webgpuData = new Float32Array(_data);
            // Ensure we can dispatch a compute shader and get the expected results from the output buffer.
            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", 2, bg);
            test.equals(dataBuffer, webgpuData);
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
            const bg = {0: {0: dataBuffer}};
            const _data = await webgpuDispatch(shader, "main", 2, bg);
            const webgpuData = new Float32Array(_data);

            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", 2, bg);
            test.equals(dataBuffer, webgpuData);
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
            const bg = {0: {0: workgroupBuffer, 1: localBuffer, 2: globalBuffer}};

            const _data = await webgpuDispatch(shader, "main", dispatchCount, bg);

            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", dispatchCount, bg);
            const execData = [workgroupBuffer, localBuffer, globalBuffer];
            for (let i = 0; i < 3; i++) {
                const webgpuData = new Uint32Array(_data[i]);
                test.equals(execData[i], webgpuData);
            }
        });

        await test("override / structs", async function (test) {
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
                override WORKGROUP_SIZE_X = 1; // constant overrides
                override WORKGROUP_SIZE_Y = 1;
                @compute @workgroup_size(WORKGROUP_SIZE_X, WORKGROUP_SIZE_Y)
                fn main(@builtin(global_invocation_id) globalInvocationId : vec3<u32>) {
                    if any(globalInvocationId.xy > uniforms.viewportSize) {
                        return;
                    }
                    let wave = vec3<f32>(1.0, 0.0, 0.5);
                    let read = wave.z * f32(uniforms.viewportSize.x);
                    let w = uniforms.viewportSize.x;
                    let h = uniforms.viewportSize.y;
                    let pos = globalInvocationId.xy;
                    let x = f32(pos.x);
                    let y = f32(pos.y);
                    let idx = pos.x + pos.y * w;
                    var r = rays[idx];
                    if all(r.direction > vec3<f32>(0.0)) {
                        imageBuffer[idx] = vec3<f32>(x / f32(uniforms.viewportSize.x), y / f32(uniforms.viewportSize.y), 0.0);
                    } else {
                        imageBuffer[idx] = r.direction;
                    }
                }`;

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

            const bindGroups = {0: {0: {uniform: uniforms}}, 1: {0: rayBuffer, 1: imageBuffer}};

            const constants = {
                "WORKGROUP_SIZE_X": 1,
                "WORKGROUP_SIZE_Y": 1
            };

            const _webgpuData = await webgpuDispatch(shader, "main", [width, height], bindGroups, { constants });
            const webgpuData = new Float32Array(_webgpuData[1]);

            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", [width, height, 1], bindGroups, { constants });

            test.closeTo(imageBuffer, webgpuData);
        });

        await test("workgroupBarrier", async function (test) {
            const shader = `const chunkWidth = 256;
                const chunkHeight = 1;
                const chunkSize = chunkWidth * chunkHeight;
                var<workgroup> bins: array<atomic<u32>, chunkSize>;
                @group(0) @binding(0) var<storage, read_write> chunks: array<array<u32, chunkSize>>;
                @group(0) @binding(1) var ourTexture: texture_2d<f32>;

                const kSRGBLuminanceFactors = vec3f(0.2126, 0.7152, 0.0722);
                fn srgbLuminance(color: vec3f) -> f32 {
                    return saturate(dot(color, kSRGBLuminanceFactors));
                }

                @compute @workgroup_size(chunkWidth, chunkHeight, 1)
                fn cs(
                    @builtin(global_invocation_id) global_invocation_id: vec3u,
                    @builtin(workgroup_id) workgroup_id: vec3u,
                    @builtin(local_invocation_id) local_invocation_id: vec3u,
                ) {
                    let size = textureDimensions(ourTexture, 0);
                    let position = global_invocation_id.xy;
                    if (all(position < size)) {
                        let numBins = f32(chunkSize);
                        let lastBinIndex = u32(numBins - 1);
                        let color = textureLoad(ourTexture, position, 0);
                        let v = srgbLuminance(color.rgb);
                        let bin = min(u32(v * numBins), lastBinIndex);
                        atomicAdd(&bins[bin], 1u);
                    }

                    workgroupBarrier();

                    let chunksAcross = (size.x + chunkWidth - 1) / chunkWidth;
                    let chunk = workgroup_id.y * chunksAcross + workgroup_id.x;
                    let bin = local_invocation_id.y * chunkWidth + local_invocation_id.x;

                    chunks[chunk][bin] = atomicLoad(&bins[bin]);
                }`;

            const chunks = new Uint32Array(256 * 256);

            const size = [16, 16];
            const inTexture = new Uint8Array(size[0] * size[1] * 4);
            for (let y = 0, idx = 0; y < size[1]; ++y) {
                for (let x = 0; x < size[0]; ++x, idx += 4) {
                    inTexture[idx + 0] = x * (255 / size[0]);
                    inTexture[idx + 1] = y * (255 / size[1]);
                    inTexture[idx + 2] = 0;
                    inTexture[idx + 3] = 255;
                }
            }

            const descriptor = {
                dimension: "2d",
                size: size,
                mipLevelCount: 1,
                sampleCount: 1,
                format: "rgba8unorm",
                usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
            };

            const bg = {0: {
                0: chunks,
                1: {texture: [inTexture], descriptor},
            }};

            const _data = await webgpuDispatch(shader, "cs", 1, bg);
            const webgpuData = new Uint32Array(_data);

            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("cs", 1, bg);

            test.equals(chunks, webgpuData);
        });

        await test("textureLoad", async function (test) {
            const shader = `
                @group(0) @binding(0) var<storage, read_write> bins: array<u32>;
                @group(0) @binding(1) var inTexture: texture_2d<f32>;
                @group(0) @binding(2) var outTexture: texture_storage_2d<rgba8unorm, write>;

                // from: https://www.w3.org/WAI/GL/wiki/Relative_luminance
                const kSRGBLuminanceFactors = vec3f(0.2126, 0.7152, 0.0722);
                fn srgbLuminance(color: vec3f) -> f32 {
                    return saturate(dot(color, kSRGBLuminanceFactors));
                }
                @compute @workgroup_size(1) fn main() {
                    let size = textureDimensions(inTexture, 0);
                    let numBins = f32(arrayLength(&bins));
                    let lastBinIndex = u32(numBins - 1);
                    for (var y = 0u; y < size.y; y++) {
                        for (var x = 0u; x < size.x; x++) {
                            let position = vec2u(x, y);
                            let color = textureLoad(inTexture, position, 0);
                            let v = srgbLuminance(color.rgb);
                            let bin = min(u32(v * numBins), lastBinIndex);
                            bins[bin] += 1;
                            textureStore(outTexture, position, vec4<f32>(v, v, v, 1.0));
                        }
                    }
                }`;

                const numBins = 256;
                const histogramBuffer = new Uint32Array(numBins);

                const size = [16, 16];
                const inTexture = new Uint8Array(size[0] * size[1] * 4);
                for (let y = 0, idx = 0; y < size[1]; ++y) {
                    for (let x = 0; x < size[0]; ++x, idx += 4) {
                        inTexture[idx + 0] = x * (255 / size[0]);
                        inTexture[idx + 1] = y * (255 / size[1]);
                        inTexture[idx + 2] = 0;
                        inTexture[idx + 3] = 255;
                    }
                }

                const outTexture = new Uint8Array(size[0] * size[1] * 4);
                for (let y = 0, idx = 0; y < size[1]; ++y) {
                    for (let x = 0; x < size[0]; ++x, idx += 4) {
                        outTexture[idx + 0] = x * (255 / size[0]);
                        outTexture[idx + 1] = y * (255 / size[1]);
                        outTexture[idx + 2] = 0;
                        outTexture[idx + 3] = 255;
                    }
                }

                const descriptor = {
                    dimension: "2d",
                    size: size,
                    mipLevelCount: 1,
                    sampleCount: 1,
                    format: "rgba8unorm",
                    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
                };

                const storageDescriptor = {
                    dimension: "2d",
                    size: size,
                    mipLevelCount: 1,
                    sampleCount: 1,
                    format: "rgba8unorm",
                    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.STORAGE_BINDING
                };

                const bg = {0: {
                    0: histogramBuffer,
                    1: {texture: [inTexture], descriptor},
                    2: {texture: [outTexture], descriptor: storageDescriptor}
                }};

                const _data = await webgpuDispatch(shader, "main", 1, bg);
                const webgpuData = new Uint32Array(_data);

                const wgsl = _newWgslExec(shader);
                wgsl.dispatchWorkgroups("main", 1, bg);

                test.equals(histogramBuffer, webgpuData);
        });

        await test("atomic array", async function (test) {
            // Exercises atomic-aware paths in WgslExec that aren't reached by
            // the existing nested-array atomic test:
            //   - atomicAdd/atomicStore on a directly-bound array<atomic<u32>, N>
            //     and array<atomic<i32>, N> (i32 atomics are new),
            //   - _maxFormatTypeInfo resolving the atomic<u32> type of atomicLoad
            //     result when used as a binary-op operand (b + 3u),
            //   - default zero-init of a var<workgroup> atomic<u32> via the
            //     atomic<u32>() constructor path in _evalCreate.
            const shader = `
                @group(0) @binding(0) var<storage, read_write> bins: array<atomic<u32>, 4>;
                @group(0) @binding(1) var<storage, read_write> signed: array<atomic<i32>, 3>;
                var<workgroup> scratch: atomic<u32>;
                @compute @workgroup_size(1) fn main() {
                    atomicStore(&scratch, 0u);
                    atomicAdd(&bins[0], 1u);
                    atomicAdd(&bins[1], 2u);
                    let b = atomicLoad(&bins[2]);
                    atomicStore(&bins[2], b + 3u);
                    atomicAdd(&bins[3], 4u);
                    atomicStore(&signed[0], -1);
                    atomicStore(&signed[1], -2);
                    atomicAdd(&signed[2], -3);
                }`;
            const binsBuffer = new Uint32Array([0, 0, 0, 0]);
            const signedBuffer = new Int32Array([0, 0, 0]);
            const bg = {0: {0: binsBuffer, 1: signedBuffer}};

            const _data = await webgpuDispatch(shader, "main", 1, bg);
            const webgpuBins = new Uint32Array(_data[0]);
            const webgpuSigned = new Int32Array(_data[1]);

            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", 1, bg);

            test.equals(binsBuffer, webgpuBins);
            test.equals(signedBuffer, webgpuSigned);
            test.equals(Array.from(binsBuffer), [1, 2, 3, 4]);
            test.equals(Array.from(signedBuffer), [-1, -2, -3]);
        });

        await test("atomic", async function (test) {
            const shader = `
                @group(0) @binding(0) var<storage, read_write> bins: array<array<atomic<u32>, 3>>;
                @group(0) @binding(1) var ourTexture: texture_2d<f32>;

                const kSRGBLuminanceFactors = vec3f(0.2126, 0.7152, 0.0722);
                fn srgbLuminance(color: vec3f) -> f32 {
                    return saturate(dot(color, kSRGBLuminanceFactors));
                }

                @compute @workgroup_size(1, 1, 1)
                fn main(@builtin(global_invocation_id) global_invocation_id: vec3u) {
                    let numBins = f32(arrayLength(&bins));
                    let lastBinIndex = u32(numBins - 1);
                    let position = global_invocation_id.xy;
                    let color = textureLoad(ourTexture, position, 0);
                    let v = srgbLuminance(color.rgb);
                    let bin = min(u32(v * numBins), lastBinIndex);
                    let b = atomicLoad(&bins[bin][0]);
                    atomicStore(&bins[bin][0], b + 1u);
                    atomicAdd(&bins[bin][0], 1u);
                }`;

            const numBins = 256;
            const histogramBuffer = new Uint32Array(numBins*3);

            const size = [16, 16];
            const texture = new Uint8Array(size[0] * size[1] * 4);
            for (let y = 0, idx = 0; y < size[1]; ++y) {
                for (let x = 0; x < size[0]; ++x, idx += 4) {
                    texture[idx + 0] = x * (255 / size[0]);
                    texture[idx + 1] = y * (255 / size[1]);
                    texture[idx + 2] = 0;
                    texture[idx + 3] = 255;
                }
            }

            const descriptor = {
                dimension: "2d",
                size,
                mipLevelCount: 1,
                sampleCount: 1,
                format: "rgba8unorm",
                usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
            };

            const bg = {0: {0: histogramBuffer, 1: {texture: [texture], descriptor}}};

            const _data = await webgpuDispatch(shader, "main", 1, bg);
            const webgpuData = new Uint32Array(_data);

            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", 1, bg);

            test.equals(histogramBuffer, webgpuData);
        });

        test("particles", async function (test) {
            const shader = `
    struct Particle {
        pos : vec2f,
        vel : vec2f,
    }
    struct SimParams {
        deltaT : f32,
        rule1Distance : f32,
        rule2Distance : f32,
        rule3Distance : f32,
        rule1Scale : f32,
        rule2Scale : f32,
        rule3Scale : f32,
    }
    struct Particles {
        particles : array<Particle>,
    }
    @binding(0) @group(0) var<uniform> params : SimParams;
    @binding(1) @group(0) var<storage, read> particlesA : Particles;
    @binding(2) @group(0) var<storage, read_write> particlesB : Particles;

    // https://github.com/austinEng/Project6-Vulkan-Flocking/blob/master/data/shaders/computeparticles/particle.comp
    @compute @workgroup_size(1)
    fn main(@builtin(global_invocation_id) GlobalInvocationID : vec3u) {
        var index = GlobalInvocationID.x;

        var vPos = particlesA.particles[index].pos;
        var vVel = particlesA.particles[index].vel;
        var cMass = vec2(0.0);
        var cVel = vec2(0.0);
        var colVel = vec2(0.0);
        var cMassCount = 0u;
        var cVelCount = 0u;
        var pos : vec2f;
        var vel : vec2f;

        for (var i = 0u; i < arrayLength(&particlesA.particles); i++) {
            if i == index {
                continue;
            }

            pos = particlesA.particles[i].pos.xy;
            vel = particlesA.particles[i].vel.xy;
            if distance(pos, vPos) < params.rule1Distance {
                cMass += pos;
                cMassCount++;
            }
            if distance(pos, vPos) < params.rule2Distance {
                colVel -= pos - vPos;
            }
            if distance(pos, vPos) < params.rule3Distance {
                cVel += vel;
                cVelCount++;
            }
        }
        if cMassCount > 0 {
            cMass = (cMass / vec2(f32(cMassCount))) - vPos;
        }
        if cVelCount > 0 {
            cVel /= f32(cVelCount);
        }
        vVel += (cMass * params.rule1Scale) + (colVel * params.rule2Scale) + (cVel * params.rule3Scale);

        // clamp velocity for a more pleasing simulation
        vVel = normalize(vVel) * clamp(length(vVel), 0.0, 0.1);
        // kinematic update
        vPos = vPos + (vVel * params.deltaT);
        // Wrap around boundary
        if vPos.x < -1.0 {
            vPos.x = 1.0;
        }
        if vPos.x > 1.0 {
            vPos.x = -1.0;
        }
        if vPos.y < -1.0 {
            vPos.y = 1.0;
        }
        if vPos.y > 1.0 {
            vPos.y = -1.0;
        }
        // Write back
        particlesB.particles[index].pos = vPos;
        particlesB.particles[index].vel = vVel;
    }`;
            const params = new Float32Array(8);
            params[0] = 0.03999999910593033;
            params[1] = 0.10000000149011612;
            params[2] = 0.02500000037252903;
            params[3] = 0.02500000037252903;
            params[4] = 0.019999999552965164;
            params[5] = 0.05000000074505806;
            params[6] = 0.004999999888241291;
            const particlesA = new Float32Array(1500 * 4);
            const particlesB = new Float32Array(1500 * 4);
            for (let i = 0; i < 1500; i += 4) {
                particlesA[i] = i / 1499;
                particlesA[i + 1] = i / 1499;
                particlesA[i + 2] = i / 1499;

                particlesB[i] = i / 1499;
                particlesB[i + 1] = i / 1499;
                particlesB[i + 2] = i / 1499;
            }
            const bg = {0: {0: {uniform:params}, 1: particlesA, 2: particlesB }};
            const wgsl = _newWgslExec(shader);
            const t1 = performance.now();
            wgsl.dispatchWorkgroups("main", 24, bg);
            const t2 = performance.now();
            //console.log("wgsl time: ", t2 - t1);
            //while (dbg.stepInto());
            //const t4 = performance.now();
            //console.log("dbg time: ", t4 - t3);
        });

        await test("pack/unpack 8-bit", async function (test) {
            const shader = `
                let psn = pack4x8snorm(vec4f(-1.0, -0.5, 0.5, 1.0));
                let pun = pack4x8unorm(vec4f(0.0, 0.25, 0.75, 1.0));
                let pi8 = pack4xI8(vec4i(1, -1, 127, -128));
                let pu8 = pack4xU8(vec4u(1u, 2u, 254u, 255u));
                let pi8c = pack4x8Clamp(vec4i(200, -200, 50, -50));
                let pu8c = pack4xU8Clamp(vec4u(300u, 1u, 0u, 256u));
                let usn = unpack4x8snorm(psn);
                let uun = unpack4x8unorm(pun);
                let ui8 = unpack4xI8(pi8);
                let uu8 = unpack4xU8(pu8);`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            // pack4x8snorm: round(x*127) clamped, packed little-endian per component.
            const psn = (((-127) & 0xff)
                | (((Math.round(-0.5*127)) & 0xff) << 8)
                | (((Math.round(0.5*127)) & 0xff) << 16)
                | ((127 & 0xff) << 24)) >>> 0;
            test.equals(wgsl.getVariableValue("psn"), psn);
            const pun = ((0 & 0xff)
                | ((Math.round(0.25*255) & 0xff) << 8)
                | ((Math.round(0.75*255) & 0xff) << 16)
                | ((255 & 0xff) << 24)) >>> 0;
            test.equals(wgsl.getVariableValue("pun"), pun);
            test.equals(wgsl.getVariableValue("pi8"),
                ((1) | ((-1 & 0xff) << 8) | (127 << 16) | ((-128 & 0xff) << 24)) >>> 0);
            test.equals(wgsl.getVariableValue("pu8"),
                (1 | (2 << 8) | (254 << 16) | (255 << 24)) >>> 0);
            // Signed clamp(200) = 127, clamp(-200) = -128.
            test.equals(wgsl.getVariableValue("pi8c"),
                (127 | ((-128 & 0xff) << 8) | (50 << 16) | ((-50 & 0xff) << 24)) >>> 0);
            // Unsigned clamp(300) = 255, clamp(256) = 255.
            test.equals(wgsl.getVariableValue("pu8c"),
                (255 | (1 << 8) | (0 << 16) | (255 << 24)) >>> 0);
            test.closeTo(wgsl.getVariableValue("usn"), [-1, Math.round(-0.5*127)/127, Math.round(0.5*127)/127, 1], 1e-6);
            test.closeTo(wgsl.getVariableValue("uun"), [0, Math.round(0.25*255)/255, Math.round(0.75*255)/255, 1], 1e-6);
            test.equals(wgsl.getVariableValue("ui8"), [1, -1, 127, -128]);
            test.equals(wgsl.getVariableValue("uu8"), [1, 2, 254, 255]);
        });

        await test("pack/unpack 16-bit", async function (test) {
            const shader = `
                let psn = pack2x16snorm(vec2f(-1.0, 1.0));
                let pun = pack2x16unorm(vec2f(0.25, 1.0));
                let pf  = pack2x16float(vec2f(1.0, 0.5));
                let usn = unpack2x16snorm(psn);
                let uun = unpack2x16unorm(pun);
                let uf  = unpack2x16float(pf);`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            test.equals(wgsl.getVariableValue("psn"), ((-32767 & 0xffff) | (32767 << 16)) >>> 0);
            test.equals(wgsl.getVariableValue("pun"), ((Math.round(0.25*65535) & 0xffff) | (65535 << 16)) >>> 0);
            // f16 bits: 1.0 -> 0x3c00, 0.5 -> 0x3800.
            test.equals(wgsl.getVariableValue("pf"), (0x3c00 | (0x3800 << 16)) >>> 0);
            test.closeTo(wgsl.getVariableValue("usn"), [-1, 1], 1e-6);
            test.closeTo(wgsl.getVariableValue("uun"), [Math.round(0.25*65535)/65535, 1], 1e-6);
            test.closeTo(wgsl.getVariableValue("uf"), [1.0, 0.5], 1e-6);
        });

        await test("dot4 packed", async function (test) {
            // a = (1,2,3,4), b = (5,6,7,8); dot = 5+12+21+32 = 70.
            const shader = `
                let a = (1u) | (2u << 8) | (3u << 16) | (4u << 24);
                let b = (5u) | (6u << 8) | (7u << 16) | (8u << 24);
                let u = dot4U8Packed(a, b);
                // Signed: pack -1 (=0xff) and -2 (=0xfe) in low bytes of c, multiplied by 5,6 -> -5 + -12 = -17.
                let c = (0xffu) | (0xfeu << 8) | (3u << 16) | (4u << 24);
                let i = dot4I8Packed(c, b);`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            test.equals(wgsl.getVariableValue("u"), 70);
            test.equals(wgsl.getVariableValue("i"), -5 + -12 + 21 + 32);
        });

        await test("reverseBits", async function (test) {
            const shader = `
                let a = reverseBits(1u);
                let b = reverseBits(0x80000000u);
                let c = reverseBits(0xdeadbeefu);`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            test.equals(wgsl.getVariableValue("a"), 0x80000000);
            test.equals(wgsl.getVariableValue("b"), 1);
            // Bit-reverse 0xdeadbeef -> 0xf77db57b.
            test.equals(wgsl.getVariableValue("c"), 0xf77db57b);
        });

        await test("ldexp", async function (test) {
            const shader = `
                let a = ldexp(1.5, 4);
                let b = ldexp(vec3f(1.0, 2.0, -0.5), vec3i(2, -1, 3));`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            test.closeTo(wgsl.getVariableValue("a"), 24.0, 1e-6);
            test.closeTo(wgsl.getVariableValue("b"), [4.0, 1.0, -4.0], 1e-6);
        });

        await test("frexp", async function (test) {
            // Only the fract component is observable until the parser learns
            // __frexp_result_* struct names; full struct return is still TODO.
            const shader = `
                let a = frexp(6.0);
                let b = frexp(vec2f(0.25, -8.0));
                let z = frexp(0.0);`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            // 6 = 0.75 * 2^3.
            test.closeTo(wgsl.getVariableValue("a"), 0.75, 1e-6);
            // 0.25 = 0.5 * 2^-1, -8 = -0.5 * 2^4.
            test.closeTo(wgsl.getVariableValue("b"), [0.5, -0.5], 1e-6);
            test.closeTo(wgsl.getVariableValue("z"), 0, 1e-6);
        });

        await test("quantizeToF16", async function (test) {
            const shader = `
                let a = quantizeToF16(1.0);
                let b = quantizeToF16(0.5);
                let c = quantizeToF16(1.0 + 1.0 / 2048.0);
                let d = quantizeToF16(vec2f(2.0, -3.5));`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            test.closeTo(wgsl.getVariableValue("a"), 1.0, 1e-6);
            test.closeTo(wgsl.getVariableValue("b"), 0.5, 1e-6);
            // 1 + 1/2048 is below the f16 ULP at 1.0 (1/1024), so it rounds back to 1.0.
            test.closeTo(wgsl.getVariableValue("c"), 1.0, 1e-6);
            test.closeTo(wgsl.getVariableValue("d"), [2.0, -3.5], 1e-6);
        });

        await test("determinant mat4x4", async function (test) {
            const shader = `
                let d_id = determinant(mat4x4f(1.0, 0.0, 0.0, 0.0,
                                               0.0, 1.0, 0.0, 0.0,
                                               0.0, 0.0, 1.0, 0.0,
                                               0.0, 0.0, 0.0, 1.0));
                let d_diag = determinant(mat4x4f(2.0, 0.0, 0.0, 0.0,
                                                 0.0, 3.0, 0.0, 0.0,
                                                 0.0, 0.0, 4.0, 0.0,
                                                 0.0, 0.0, 0.0, 5.0));
                // Singular matrix: two equal columns -> det 0.
                let d_zero = determinant(mat4x4f(1.0, 2.0, 3.0, 4.0,
                                                 1.0, 2.0, 3.0, 4.0,
                                                 5.0, 6.0, 7.0, 8.0,
                                                 9.0, 8.0, 7.0, 6.0));`;
            const wgsl = _newWgslExec(shader);
            wgsl.execute();
            test.closeTo(wgsl.getVariableValue("d_id"), 1.0, 1e-6);
            test.closeTo(wgsl.getVariableValue("d_diag"), 120.0, 1e-6);
            test.closeTo(wgsl.getVariableValue("d_zero"), 0.0, 1e-5);
        });

        await test("atomicCompareExchangeWeak", async function (test) {
            const shader = `
                @group(0) @binding(0) var<storage, read_write> data: array<atomic<u32>, 4>;
                @compute @workgroup_size(1) fn main() {
                    // data starts as [10, 20, 30, 40].
                    // Match: data[0] == 10 -> swap to 99, store old 10 in slot 2 below.
                    let r0 = atomicCompareExchangeWeak(&data[0], 10u, 99u);
                    // Miss: data[1] == 20, cmp=5 -> no swap, return old value 20.
                    let r1 = atomicCompareExchangeWeak(&data[1], 5u, 77u);
                    // Use the returned old-value to confirm the swap path executed correctly.
                    atomicStore(&data[2], r0);
                    atomicStore(&data[3], r1);
                }`;
            const dataBuffer = new Uint32Array([10, 20, 30, 40]);
            const bg = {0: {0: dataBuffer}};
            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", 1, bg);
            test.equals(Array.from(dataBuffer), [99, 20, 10, 20]);
        });

        await test("subgroup ops single-lane identities", async function (test) {
            // WgslExec models subgroups as size-1; reductions/scans/broadcasts return the
            // input. This test just verifies the builtins don't error and produce the
            // documented single-lane values.
            const shader = `
                @group(0) @binding(0) var<storage, read_write> data: array<u32, 6>;
                @compute @workgroup_size(1) fn main() {
                    data[0] = subgroupAdd(7u);
                    data[1] = subgroupExclusiveAdd(7u);
                    data[2] = subgroupInclusiveAdd(7u);
                    data[3] = subgroupMax(3u);
                    data[4] = subgroupBroadcastFirst(42u);
                    data[5] = select(0u, 1u, subgroupElect());
                }`;
            const dataBuffer = new Uint32Array(6);
            const bg = {0: {0: dataBuffer}};
            const wgsl = _newWgslExec(shader);
            wgsl.dispatchWorkgroups("main", 1, bg);
            test.equals(Array.from(dataBuffer), [7, 0, 7, 3, 42, 1]);
        });
    }, true);
}
