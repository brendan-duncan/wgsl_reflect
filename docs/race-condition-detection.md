# Race Condition Detection

A compute shader that shares `var<workgroup>` or storage memory between
invocations must guard that sharing with barriers. A missing
`workgroupBarrier()` or `storageBarrier()` is a data race: it produces correct
results on one GPU and garbage on another, and it never fails on a sequential
CPU emulator.

`detectRaces()` finds these bugs. It runs every invocation of a workgroup
*concurrently*, in lockstep, and reports unsynchronized memory accesses.

- [Overview](#overview)
- [Using detectRaces](#using-detectraces)
- [Interpreting the results](#interpreting-the-results)
- [What counts as a data race](#what-counts-as-a-data-race)
- [Barrier divergence](#barrier-divergence)
- [How the lockstep scheduler works](#how-the-lockstep-scheduler-works)
- [Limitations](#limitations)

## Overview

The default emulator ([`WgslExec`](./shader-execution.md)) runs invocations
strictly one after another, so a missing barrier is invisible — every read
happens to see a fully written buffer. The race detector instead advances all
invocations of a workgroup one command at a time and *parks* each one when it
reaches a barrier.

When every invocation is parked, that is a **sync point**. All memory accesses
recorded since the previous barrier form one **phase**, and within a phase the
invocations are unordered relative to each other. The detector cross-checks
every pair of accesses in the phase for conflicts, then releases the
invocations to run to the next barrier.

## Using detectRaces

```javascript
import { detectRaces } from "wgsl_reflect/wgsl_reflect.module.js";

const { races, errors } = detectRaces(code, kernel, dispatchCount, bindGroups, config?);
```

| Parameter       | Description |
| --------------- | ----------- |
| `code`          | WGSL shader source. |
| `kernel`        | Name of the `@compute` entry function. |
| `dispatchCount` | Workgroup grid dimensions — `[x]`, `[x, y]`, or `[x, y, z]`. |
| `bindGroups`    | Bound resources, in the same format as [`WgslExec`](./shader-execution.md#bind-group-format). |
| `config`        | Optional; may carry `constants` for override constants. |

### Example: a missing barrier

```javascript
import { detectRaces } from "wgsl_reflect/wgsl_reflect.module.js";

const shader = `
  @group(0) @binding(0) var<storage, read_write> data: array<u32>;
  var<workgroup> tile: array<u32, 64>;
  @compute @workgroup_size(64)
  fn main(@builtin(local_invocation_index) lid: u32) {
    tile[lid] = data[lid];
    // MISSING workgroupBarrier() here
    data[lid] = tile[63u - lid];
  }`;

const buffer = new Uint32Array(64);
const { races, errors } = detectRaces(shader, "main", [1, 1, 1], {
  0: { 0: buffer },
});

races.forEach(r => console.warn(r.message));
errors.forEach(e => console.warn(e));
```

Each lane writes `tile[lid]` and then reads `tile[63 - lid]`, which a *different*
lane wrote. With no barrier between the write and the read, the two accesses are
unordered — a data race on `tile`. Adding `workgroupBarrier()` between the lines
splits them into separate phases and the race disappears.

## Interpreting the results

`detectRaces()` returns `{ races, errors }`.

`races` is an array of `RaceReport` objects:

```typescript
interface RaceReport {
  bufferId: string;       // the buffer / variable the race is on
  byte: number;           // first conflicting byte offset
  a: MemoryAccess;        // one of the two conflicting accesses
  b: MemoryAccess;        // the other conflicting access
  message: string;        // a human-readable description
}

interface MemoryAccess {
  bufferId: string;
  offset: number;         // byte offset within the buffer
  size: number;           // byte length of the access
  kind: "read" | "write";
  atomic: boolean;
  invocation: number;     // local_invocation_index that made the access
  line: number;           // source line of the access
}
```

A typical `message`:

> Data race on 'tile' byte 0: invocation 0 (write, line 6) and invocation 63
> (read, line 8) are unordered. Add a workgroupBarrier()/storageBarrier()
> between them.

`errors` is an array of strings reporting structural problems found while
running — most importantly [barrier divergence](#barrier-divergence), and a
safety-valve message if a buggy shader exceeds the step budget.

An empty `races` and empty `errors` means no race was found for the given
dispatch size and inputs.

## What counts as a data race

Two memory accesses in the same phase are a data race when **all** of the
following hold:

- They come from **different invocations**. Accesses within one invocation are
  ordered by program order.
- They touch the **same buffer** and their **byte ranges overlap**.
- At least one of them is a **write**. Two reads never conflict.
- They are **not both atomic**. Atomic-vs-atomic access is always safe;
  atomic-vs-non-atomic on the same location is still a race.

Atomics are recognized structurally: a location whose resolved type is
`atomic<T>` is recorded as an atomic access, so histogram-style kernels using
`atomicAdd` and friends do not produce false positives.

## Barrier divergence

WGSL requires barriers to sit in *workgroup-uniform* control flow — every
invocation must reach the same barrier. The detector reports an `errors` entry
when this is violated, for example:

- Some invocations exit the kernel before others reach a barrier those others
  are waiting on.
- Invocations park on *different* barrier statements.

Barrier divergence is undefined behavior on a real GPU, so it is flagged
separately from data races.

## How the lockstep scheduler works

1. Each invocation of the workgroup gets its own execution stack, seeded with
   the kernel body and that lane's builtin ids. All invocations share the same
   backing memory for storage and `var<workgroup>` buffers — that shared memory
   is what makes races possible.
2. Storage and workgroup buffers are bound through an instrumented buffer view
   that records every read and write (offset, size, kind, atomic-ness) to a
   per-workgroup memory tracker.
3. The scheduler advances each `Running` invocation by one command, reusing the
   re-entrant [shader debugging](./shader-debugging.md) interpreter. When an invocation reaches
   a barrier statement it is parked instead of stepped.
4. When no invocation can advance, every surviving invocation is parked on a
   barrier — a sync point. The tracker checks the phase that just ended for
   races and validates barrier uniformity.
5. All parked invocations are released and the cycle repeats. When the last
   invocation finishes, the final post-barrier phase is checked.

One scheduler runs per workgroup; `detectRaces()` iterates the whole grid.

## Limitations

- **Within-workgroup only.** It detects races caused by missing
  workgroup/storage barriers *inside* a workgroup. Races between *different*
  workgroups on storage memory are not decidable — WebGPU provides no
  cross-workgroup ordering — and are out of scope.
- **`workgroupUniformLoad` is not treated as a barrier.** It acts as one on the
  GPU, but it is an expression rather than a statement and would need a separate
  hook.
- **Vector components are tracked coarsely.** A swizzle such as `v.xy` is
  treated as touching the whole vector, which can over-report.
- **Workgroup memory is not re-initialized between workgroups** in the current
  prototype.
- **Textures are not instrumented**; only buffer and `var<workgroup>` accesses
  are tracked.
