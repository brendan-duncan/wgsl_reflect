# Shader Debugging

`WgslDebug` is a source-level debugger for WGSL shaders. It runs a shader on the
CPU one step at a time, so you can set breakpoints, step through statements,
step into and out of functions, and inspect variable values at any point — the
building blocks for a shader debugger UI.

- [Overview](#overview)
- [Creating a debugger](#creating-a-debugger)
- [Debugging module-scope code](#debugging-module-scope-code)
- [Debugging a compute invocation](#debugging-a-compute-invocation)
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
[race condition detector](./race-condition-detection.md) drives — it runs many
invocations concurrently by giving each its own command stack and interleaving
their steps.
