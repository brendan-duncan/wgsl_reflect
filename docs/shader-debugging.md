# Shader Debugging

`WgslDebug` is a source-level debugger for WGSL shaders. It runs a shader on the
CPU one step at a time, so you can set breakpoints, step through statements,
step into and out of functions, and inspect variable values at any point — the
building blocks for a shader debugger UI. Compute, vertex, and fragment stages
are all supported, including fragment derivatives and texture sampling.

- [Overview](#overview)
- [Creating a debugger](#creating-a-debugger)
- [Debugging module-scope code](#debugging-module-scope-code)
- [Debugging a compute invocation](#debugging-a-compute-invocation)
- [Stage inputs](#stage-inputs)
- [Debugging a vertex invocation](#debugging-a-vertex-invocation)
- [Debugging a fragment invocation](#debugging-a-fragment-invocation)
- [The fragment quad](#the-fragment-quad)
- [Texture sampling and samplers](#texture-sampling-and-samplers)
- [Reading the stage output](#reading-the-stage-output)
- [Stepping](#stepping)
- [Breakpoints](#breakpoints)
- [Running and pausing](#running-and-pausing)
- [Inspecting state](#inspecting-state)
- [Resetting](#resetting)
- [How it works](#how-it-works)

## Overview

Where [`WgslExec`](./shader-execution.md) runs a shader to completion in one
call, `WgslDebug` exposes the same interpreter incrementally. Internally it
lowers each statement body into a flat list of *commands* and keeps an explicit
call stack, so every step is a discrete, observable transition.

## Creating a debugger

Unlike `WgslExec`, `WgslDebug` takes the shader **source string** directly and
parses it for you:

```javascript
import { WgslDebug } from "wgsl_reflect/wgsl_reflect.module.js";

const dbg = new WgslDebug(shaderCode);
```

An optional second argument is a callback invoked whenever the run state
changes (see [Running and pausing](#running-and-pausing)):

```javascript
const dbg = new WgslDebug(shaderCode, () => updateDebuggerUI());
```

## Debugging module-scope code

`startDebug()` prepares the debugger to step through the shader's top-level
statements:

```javascript
const dbg = new WgslDebug(`
  let foo = 1 + 2;
  let bar = foo * 4;
`);

dbg.startDebug();
dbg.stepNext();                       // executes: let foo = 1 + 2;
console.log(dbg.getVariableValue("foo")); // 3
dbg.stepNext();                       // executes: let bar = foo * 4;
console.log(dbg.getVariableValue("bar")); // 12
```

`stepNext()` returns `false` once execution has finished, so a shader can be run
to completion with:

```javascript
while (dbg.stepNext());
```

## Debugging a compute invocation

`debugWorkgroup()` sets up the debugger to step through a single compute shader
invocation — the one whose global invocation id matches `dispatchId`.

```javascript
debugWorkgroup(kernel, dispatchId, dispatchCount, bindGroups, config?)
```

| Parameter       | Description |
| --------------- | ----------- |
| `kernel`        | Name of the `@compute` entry function. |
| `dispatchId`    | The `global_invocation_id` `[x, y, z]` of the invocation to debug. |
| `dispatchCount` | Workgroup grid size — a number or `[x, y, z]` array. |
| `bindGroups`    | Bound resources, in the same format as [`WgslExec`](./shader-execution.md#bind-group-format). |
| `config`        | Optional; may carry `constants` for override constants. |

Only the invocation matching `dispatchId` is executed; the rest of the grid is
skipped. After the call, drive execution with the stepping API.

```javascript
const shader = `
  @group(0) @binding(0) var<storage, read_write> buffer: array<f32>;
  @compute @workgroup_size(1)
  fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let i = id.x;
    buffer[i] = buffer[i] * 2.0;
  }`;

const buffer = new Float32Array([1, 2, 6, 0]);
const dbg = new WgslDebug(shader);

dbg.debugWorkgroup("main", [1, 0, 0], 4, { 0: { 0: buffer } });
while (dbg.stepNext());

console.log(buffer); // [1, 4, 6, 0] - only invocation 1 ran
```

## Stage inputs

Vertex and fragment invocations receive their inputs through an `inputs` object,
keyed by pipeline semantic rather than by argument name:

- **Builtins** by name — `{ vertex_index: 3, instance_index: 0 }` for vertex, or
  `{ position: [x, y, z, w], front_facing: 1 }` for fragment.
- **`@location(n)`** attributes by index — `{ 0: [x, y, z], 1: [u, v] }`.

Scalars are numbers; vectors are arrays. The keys are the same whether the entry
point declares its inputs as separate arguments or grouped together in an input
struct — an input struct is filled in member by member from these values.

## Debugging a vertex invocation

`debugVertex()` sets up the debugger to step through a single `@vertex`
invocation.

```javascript
debugVertex(entry, inputs, bindGroups, config?)
```

| Parameter    | Description |
| ------------ | ----------- |
| `entry`      | Name of the `@vertex` entry function. |
| `inputs`     | Per-vertex [stage inputs](#stage-inputs) (vertex/instance builtins and `@location` attributes). |
| `bindGroups` | Bound resources, in the same format as [`WgslExec`](./shader-execution.md#bind-group-format). |
| `config`     | Optional; may carry `constants` for override constants. |

It returns `true` on success. Drive execution with the stepping API just like a
compute invocation, and read the stage output with
[`returnValue` / `getReturnValue()`](#reading-the-stage-output).

```javascript
const shader = `
  struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec3f,
  };
  @vertex
  fn main(@builtin(vertex_index) vi: u32, @location(0) pos: vec2f) -> VertexOutput {
    var out: VertexOutput;
    out.position = vec4f(pos, 0.0, 1.0);
    out.color = vec3f(f32(vi), 0.0, 0.0);
    return out;
  }`;

const dbg = new WgslDebug(shader);
dbg.debugVertex("main", { vertex_index: 2, 0: [0.5, -0.5] }, {});
while (dbg.stepNext());

dbg.getReturnValue(); // { position: [0.5, -0.5, 0, 1], color: [2, 0, 0] }
```

## Debugging a fragment invocation

A fragment can be debugged two ways. Use `debugFragment()` for a single
invocation, or [the fragment quad](#the-fragment-quad) when the shader's output
depends on derivatives or `textureSample` mip selection.

```javascript
debugFragment(entry, inputs, bindGroups, config?)
```

`debugFragment()` mirrors `debugVertex()`: pass the interpolated fragment
[inputs](#stage-inputs) (`@location` varyings plus builtins such as `position`
and `front_facing`) and drive it with the stepping API. Because it runs a single
invocation, quad-derivative operations behave as if the quad were uniform —
`dpdx`/`dpdy`/`fwidth` evaluate to zero and `textureSample` uses the base mip
(LOD 0). This is exact for shaders that don't use derivatives.

```javascript
const shader = `
  @fragment
  fn main(@location(0) color: vec3f, @location(1) uv: vec2f) -> @location(0) vec4f {
    return vec4f(color * uv.x, 1.0);
  }`;

const dbg = new WgslDebug(shader);
dbg.debugFragment("main", { 0: [0.2, 0.4, 0.6], 1: [0.5, 0.0] }, {});
while (dbg.stepNext());

dbg.getReturnValue(); // [0.1, 0.2, 0.3, 1]
```

### Discard

If a fragment executes `discard`, the invocation is killed: no further
statements run and it produces no output. The `discarded` flag records it.

```javascript
dbg.debugFragment("main", inputs, bindGroups);
while (dbg.stepNext());
dbg.discarded;          // true if the fragment discarded
dbg.getReturnValue();   // null when discarded
```

## The fragment quad

Derivatives (`dpdx`/`dpdy`/`fwidth`) and `textureSample`'s implicit mip level are
defined across the 2×2 quad of fragments the GPU shades together. To resolve them
correctly, run all four quad lanes. Supply the four lanes' interpolated inputs in
quad order — `0` = top-left, `1` = top-right, `2` = bottom-left, `3` =
bottom-right.

`debugFragmentQuad()` runs the whole quad to completion and returns each lane's
result:

```javascript
import { debugFragmentQuad } from "wgsl_reflect/wgsl_reflect.module.js";

const shader = `
  @fragment
  fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
    return vec4f(dpdx(uv), dpdy(uv));
  }`;

// uv per lane: TL(0,0) TR(2,0) BL(0,3) BR(2,3)
const quad = [{ 0: [0, 0] }, { 0: [2, 0] }, { 0: [0, 3] }, { 0: [2, 3] }];
const { outputs, discarded, errors } = debugFragmentQuad(shader, "main", quad, {});

outputs[0]; // [2, 0, 0, 3] - dpdx(uv) = (2,0), dpdy(uv) = (0,3)
```

`errors` reports non-uniform control flow (derivatives are undefined per the WGSL
spec when the quad diverges) and `discarded[i]` reports whether lane `i`
executed `discard`.

### Interactive quad stepping

`createFragmentQuadDebugger()` returns a scheduler for stepping *interactively*
through one lane of the quad, while the other three stay in lockstep at each
derivative / texture-sample point so those resolve correctly. The scheduler
mirrors the `WgslDebug` stepping surface.

```javascript
import { createFragmentQuadDebugger } from "wgsl_reflect/wgsl_reflect.module.js";

const { scheduler, errors } =
  createFragmentQuadDebugger(shader, "main", quad, bindGroups, /*targetLane*/ 0, config);

scheduler.breakpoints.add(4);   // Set<number> of source lines
scheduler.stepTarget();         // step the target lane (stepInto; pass false to step over)
scheduler.stepOutTarget();      // run until the target returns out of the current function
scheduler.runTarget();          // run to a breakpoint or completion

scheduler.targetLine;           // source line about to execute, or -1 when finished
scheduler.targetContext;        // the target lane's ExecContext (for watch/locals)
scheduler.isDone;               // true once the target lane finishes
scheduler.targetOutput;         // the target lane's output (plain JS), valid once done
scheduler.targetDiscarded;      // whether the target lane discarded
```

## Texture sampling and samplers

The `textureSample*` builtins — `textureSample`, `textureSampleLevel`,
`textureSampleGrad`, `textureSampleBias`, and `textureSampleCompare` /
`textureSampleCompareLevel` — are supported when debugging. Bind the resources
they use in `bindGroups`:

- **Sampler** — `{ sampler: descriptor }`, where `descriptor` is a
  `GPUSamplerDescriptor`. Filtering honors the sampler's `magFilter` /
  `mipmapFilter` (linear vs nearest), `addressModeU` / `addressModeV`
  (clamp / repeat / mirror), and `compare` function for depth-compare sampling.
- **Mipmapped texture** — `{ texture: [mip0, mip1, ...], descriptor }`, an array
  of per-mip buffers, so implicit- and explicit-LOD sampling can select a mip.

`textureSample`'s implicit LOD is a quad operation — it is computed from the
texture-coordinate derivatives across the quad, so it only resolves correctly
under [the fragment quad](#the-fragment-quad). In a single invocation it samples
the base mip.

## Reading the stage output

A vertex or fragment entry point returns a value, which the debugger captures
once execution reaches its `return`:

| Member              | Description |
| ------------------- | ----------- |
| `returnValue`       | The raw returned `Data`, or `null` if not yet returned / discarded. |
| `getReturnValue()`  | The return value as plain JS: a number for a scalar, an array for a vector/matrix, or an object keyed by member name for a struct output. |

```javascript
dbg.debugVertex("main", inputs, bindGroups);
while (dbg.stepNext());
const out = dbg.getReturnValue(); // e.g. { position: [...], color: [...] }
```

## Stepping

| Method                  | Behavior |
| ----------------------- | -------- |
| `stepNext(stepInto?)`   | Advance one command. `stepInto` defaults to `true`. Returns `false` when execution is complete. |
| `stepInto()`            | Step a single command, descending into any user-defined function call. |
| `stepOver()`            | Step a single command, executing a function call without descending into it. |
| `stepOut()`             | Run until the current function returns to its caller. |

`stepInto` / `stepOver` / `stepOut` are convenience wrappers; `stepInto()` is
`stepNext(true)` and `stepOver()` is `stepNext(false)`. Stepping is ignored
while the debugger is in [run mode](#running-and-pausing).

```javascript
dbg.debugWorkgroup("main", [1, 0, 0], 4, bindGroups);
dbg.stepNext(); // let i = id.x;
dbg.stepNext(); // call: scale(buffer[i], 2.0)
dbg.stepNext(); // return x * y;
dbg.stepNext(); // buffer[i] = <result>;
```

## Breakpoints

Breakpoints are keyed by source line number.

```javascript
dbg.toggleBreakpoint(12);  // add or remove a breakpoint on line 12
dbg.clearBreakpoints();    // remove all breakpoints
dbg.breakpoints;           // the live Set<number> of breakpoint lines
```

Breakpoints are honored by [`run()`](#running-and-pausing) and `stepOut()` —
both stop before executing a command on a breakpoint line. They do not affect
single stepping.

## Running and pausing

`run()` executes the shader continuously without blocking the UI thread. It
processes commands in slices and yields to the event loop between them, so the
page stays responsive and `pause()` can interrupt it.

```javascript
dbg.run();              // start running
dbg.isRunning;          // true while a run is in progress
dbg.pause();            // stop at the next slice boundary
```

Running stops automatically when execution finishes or a breakpoint is hit.

- `runStateCallback` — invoked whenever the run state changes (run, pause,
  stop). Use it to refresh a debugger UI. It can be passed to the constructor
  or assigned directly.
- `runSliceSize` — number of commands executed per slice before yielding to the
  event loop. Defaults to `1000`. Larger values increase throughput; smaller
  values make `pause()` and the UI more responsive.

## Inspecting state

While paused, the debugger exposes its current position and memory:

| Member                   | Description |
| ------------------------ | ----------- |
| `getVariableValue(name)` | Value of a variable in the current scope — a number, an array, or `null`. |
| `context`                | The active `ExecContext` — its `getVariable(name)` exposes full typed values. |
| `currentState`           | The top `StackFrame` of the call stack, or `null` when finished. |
| `currentCommand`         | The next command to execute. Its `.line` property is the source line — use it to highlight the current line in an editor. |

```javascript
const line = dbg.currentCommand?.line;     // line about to execute
const value = dbg.getVariableValue("acc"); // a local's current value
```

Walk `currentState.parent` to traverse the call stack; each frame carries its
own `context` for inspecting locals at that level.

## Resetting

`reset()` rebuilds the interpreter from the original AST and restarts module-
scope debugging, discarding all execution state. Breakpoints are preserved.

```javascript
dbg.reset();
```

## How it works

When a function or block is first entered, `WgslDebug` lowers its statement
body into a flat array of *commands*: statements, conditional/unconditional
gotos (for `if`/`switch`), loop continue/break targets, block entries, and
function-call expressions. Structured control flow becomes explicit jumps over
this list, which is what makes single-stepping — and stepping *into* a function
call expression nested inside a larger statement — possible.

Each active function or block has a `StackFrame` holding its command list,
instruction pointer, and `ExecContext`. The command lists are pure functions of
the AST, so they are cached and reused on re-entry.

This same re-entrant interpreter is what the
[race condition detector](./race-condition-detection.md) and the
[fragment quad](#the-fragment-quad) drive — each runs several invocations
concurrently by giving every invocation its own command stack and interleaving
their steps. The quad additionally pauses all four lanes at a derivative or
texture-sample call, evaluates them together, and hands each lane its own result
so the enclosing statement reads a per-lane value.
