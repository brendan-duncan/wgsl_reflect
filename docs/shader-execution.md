# Shader Execution

`wgsl_reflect` includes a WGSL interpreter, `WgslExec`, that can run a shader on
the CPU. It evaluates module-scope declarations and emulates compute dispatches,
producing the same results a GPU would write into your buffers — useful for unit
testing shaders, golden-image comparisons, or validating math without a GPU.

- [Overview](#overview)
- [Creating a WgslExec](#creating-a-wgslexec)
- [Running module-scope code](#running-module-scope-code)
- [Dispatching a compute shader](#dispatching-a-compute-shader)
- [Bind group format](#bind-group-format)
- [Override constants](#override-constants)
- [Reading back values](#reading-back-values)
- [Supported features](#supported-features)
- [Limitations](#limitations)

## Overview

`WgslExec` parses a shader into an AST and walks it directly. It supports:

- Scalars, vectors, matrices, arrays, structs, and pointers.
- The full set of WGSL operators and most builtin functions.
- `var`, `let`, `const`, and `override` declarations.
- Control flow: `if`/`else`, `for`, `while`, `loop`/`continuing`, `switch`,
  `break`, `continue`, and `return`.
- User-defined functions, including recursion.
- Compute entry points dispatched over a workgroup grid.
- Storage buffers, uniform buffers, textures, and `var<workgroup>` memory.

For interactive, step-by-step execution see [Shader Debugging](./shader-debugging.md). To find
missing barriers in compute shaders see
[Race Condition Detection](./race-condition-detection.md).

## Creating a WgslExec

`WgslExec` takes a parsed AST, so parse the source first with `WgslParser`:

```javascript
import { WgslExec, WgslParser } from "wgsl_reflect/wgsl_reflect.module.js";

const ast = WgslParser.Parse(shaderCode);
const exec = new WgslExec(ast);
```

## Running module-scope code

`execute()` evaluates every top-level statement in the shader — `const`, `let`,
`var`, `override`, and `alias` declarations. This is enough to run shaders that
do all their work at module scope.

```javascript
const exec = new WgslExec(WgslParser.Parse(`
  let a = 1 + 2;
  let b = a * 4;
`));

exec.execute();

console.log(exec.getVariableValue("a")); // 3
console.log(exec.getVariableValue("b")); // 12
```

## Dispatching a compute shader

`dispatchWorkgroups()` emulates a `GPUComputePassEncoder.dispatchWorkgroups()`
call. It runs the named compute entry point over a grid of workgroups, executing
every invocation and writing results back into the bound buffers.

```javascript
dispatchWorkgroups(kernel, dispatchCount, bindGroups, config?)
```

| Parameter       | Description |
| --------------- | ----------- |
| `kernel`        | Name of the `@compute` entry function. |
| `dispatchCount` | Workgroup grid size. A number, or `[x]`, `[x, y]`, or `[x, y, z]`. The total invocation count is the grid multiplied by the shader's `@workgroup_size`. |
| `bindGroups`    | Resources bound to the shader — see [Bind group format](#bind-group-format). |
| `config`        | Optional. May contain `constants` for [override constants](#override-constants). |

Each invocation receives the standard compute builtins: `global_invocation_id`,
`local_invocation_id`, `local_invocation_index`, `workgroup_id`,
`num_workgroups`, and `workgroup_size`.

```javascript
import { WgslExec, WgslParser } from "wgsl_reflect/wgsl_reflect.module.js";

const shader = `
  @group(0) @binding(0) var<storage, read_write> buffer: array<f32>;
  @compute @workgroup_size(1)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let i = id.x;
    buffer[i] = buffer[i] * 2.0;
  }`;

// The TypedArray is updated in place by the dispatch.
const buffer = new Float32Array([1, 2, 6, 0]);
const bindGroups = { 0: { 0: buffer } };

const exec = new WgslExec(WgslParser.Parse(shader));
exec.dispatchWorkgroups("main", 4, bindGroups);

console.log(buffer); // Float32Array [2, 4, 12, 0]
```

## Bind group format

`bindGroups` is a nested object keyed first by `@group` index and then by
`@binding` index. The value at each binding describes the resource:

```javascript
const bindGroups = {
  0: {                            // @group(0)
    0: storageTypedArray,         // @binding(0) - storage buffer
    1: { uniform: arrayBuffer },  // @binding(1) - uniform buffer
    2: { texture, descriptor },   // @binding(2) - texture
  },
};
```

- **Storage buffer** — pass a `TypedArray` (e.g. `Float32Array`, `Uint32Array`)
  or `ArrayBuffer` directly. The interpreter reads from and writes to it in
  place, so after the dispatch the array holds the shader's output.
- **Uniform buffer** — pass `{ uniform: ArrayBuffer }`. Uniforms are read-only.
- **Texture** — pass `{ texture, descriptor }`, where `descriptor` matches the
  `GPUTextureDescriptor` shape (`size`, `format`, `mipLevelCount`, etc.).
  `texture` is the mip-level-0 data, or an array of per-mip buffers
  `[mip0, mip1, ...]` when the texture is mipmapped.

Only resources actually used by the dispatched kernel are bound; entries for
other bindings are ignored.

The [debugger](./shader-debugging.md) accepts this same format and adds one more
resource kind — a **sampler**, `{ sampler: descriptor }` — used when debugging
vertex and fragment shaders that call the `textureSample*` builtins.

## Override constants

WGSL `override` declarations can be supplied at dispatch time through
`config.constants`, mirroring the `constants` field of a WebGPU pipeline:

```javascript
const shader = `
  override scale: f32 = 1.0;
  @group(0) @binding(0) var<storage, read_write> data: array<f32>;
  @compute @workgroup_size(1)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    data[id.x] = data[id.x] * scale;
  }`;

const data = new Float32Array([1, 2, 3, 4]);
exec.dispatchWorkgroups("main", 4, { 0: { 0: data } }, {
  constants: { scale: 10.0 },
});
// data -> [10, 20, 30, 40]
```

Override values may be numbers, booleans, or arrays for vector overrides. An
`@workgroup_size` that references an override constant is resolved from these
values too.

## Reading back values

For storage buffers, the simplest way to read results is to inspect the
`TypedArray` you passed in — it is mutated in place.

`getVariableValue(name)` reads a named module-scope variable and returns a
plain JavaScript value:

```javascript
exec.getVariableValue("a");      // number for a scalar
exec.getVariableValue("v");      // number[] for a vector or matrix
```

It returns `null` if the variable does not exist or has an unsupported type.

## Supported features

`WgslExec` aims for parity with a real WebGPU dispatch. The test suite
(`test/tests/test_exec.js`) cross-checks emulated results against an actual
WebGPU device for matrix math, struct layout, array indexing, control flow,
builtin functions, and more.

## Limitations

- `WgslExec` runs every invocation sequentially. A missing `workgroupBarrier()`
  or `storageBarrier()` therefore has no visible effect — use
  [Race Condition Detection](./race-condition-detection.md) to catch those.
- `WgslExec` dispatches compute shaders. Individual vertex and fragment
  invocations can be run and stepped through with
  [`WgslDebug`](./shader-debugging.md#debugging-a-vertex-invocation), which
  drives the same interpreter — including the 2×2 quad needed for fragment
  derivatives and `textureSample` mip selection.
- Some rarely used builtin functions may not be implemented; an unimplemented
  feature logs a `console.error` describing what is missing.
