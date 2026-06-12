# Static Performance Analysis

Some shader performance problems are not bugs — the shader produces the correct
result — but they cost more GPU time than they need to. `analyzePerformance()`
is a *static* analyzer: it parses a WGSL shader and flags constructs with a
well-known GPU cost, such as expensive math inside a loop, integer division by a
non-constant, or atomics and barriers in a loop. It also flags
[translation-aware](#translation-aware-rules) pathologies — patterns that are
cheap in native HLSL/D3D but become expensive once translated to WGSL (atomic
buffers whose every read is an RMW, oversized workgroup storage, serial scan
emulations), which are best caught by running this over the translated WGSL.

Unlike [`detectRaces`](./race-condition-detection.md), it does **not** execute
the shader. It needs no bind groups, no inputs, and no dispatch size — just the
source — so it is cheap enough to run on every shader in a build step.

- [Overview](#overview)
- [Using analyzePerformance](#using-analyzeperformance)
- [Interpreting the results](#interpreting-the-results)
- [Rules](#rules)
- [Filtering the results](#filtering-the-results)
- [Limitations](#limitations)

## Overview

The analyzer walks the parsed AST of every function — vertex, fragment, compute,
and helper functions — and emits a `PerfFinding` for each construct it
recognizes as costly. Every finding is weighted by **loop nesting depth**: the
same operation matters far more inside a doubly-nested loop than at the top of a
function, because it runs many more times. Findings are returned sorted by a
numeric `score`, most impactful first.

These are **heuristic smells, not a profiler**. The real cost of a shader
depends on the target GPU's architecture, occupancy, and scheduler, none of
which a static pass can see. The analyzer can only point at constructs whose
cost is high *relative to the surrounding code* and explain why — so each
finding carries a `severity` and a `confidence` you can threshold on.

## Using analyzePerformance

```javascript
import { analyzePerformance } from "wgsl_reflect/wgsl_reflect.module.js";

const { findings } = analyzePerformance(code, options?);
```

| Parameter | Description |
| --------- | ----------- |
| `code`    | WGSL shader source. |
| `options` | Optional; filters which findings are returned. See [Filtering](#filtering-the-results). |

### Example

```javascript
import { analyzePerformance } from "wgsl_reflect/wgsl_reflect.module.js";

const shader = `
  @group(0) @binding(0) var<uniform> k: f32;
  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) id: vec3u) {
    var acc = 0.0;
    for (var i = 0u; i < 100u; i++) {
      acc += pow(f32(id.x), f32(i));   // expensive builtin, runs every iteration
      acc += sin(k * 3.14);            // loop-invariant: hoist it out
    }
  }`;

const { findings } = analyzePerformance(shader);
for (const f of findings) {
  console.log(`[${f.severity}/${f.confidence}] ${f.rule} (line ${f.line}): ${f.message}`);
}
```

## Interpreting the results

`analyzePerformance()` returns `{ findings }`, an array of `PerfFinding` objects
sorted by `score` descending:

```typescript
interface PerfFinding {
  id: PerfRuleId;          // stable numeric id for the kind of finding
  rule: string;            // human-readable name of `id` (e.g. "atomic-in-loop")
  message: string;         // a human-readable description and suggested fix
  line: number;            // source line of the flagged construct
  function: string;        // the function the finding is in
  stage: string | null;    // "vertex" | "fragment" | "compute", or null for a helper
  loopDepth: number;       // how deeply the construct is nested in loops
  severity: "info" | "low" | "medium" | "high";
  confidence: "high" | "medium" | "low";
  score: number;           // for ranking; higher = more impactful
}
```

- **`id`** is the stable identifier — prefer it over `rule` when filtering, since
  the `rule` wording may change. `PerfRuleNames[id]` gives the matching `rule`
  string.
- **`severity`** is derived from the loop-depth-weighted `score`: deeper nesting
  raises the severity of the same construct.
- **`confidence`** reflects how sure the analyzer is that the finding is real and
  actionable. The `loop-invariant-expression` and `costly-arithmetic-in-loop`
  rules are `medium`; the `expensive-builtin-in-loop`, `atomic-in-loop`, and
  `barrier-in-loop` rules are `high`.

## Rules

Each rule has a stable id in the `PerfRuleId` enum.

### Loop-cost rules

| `PerfRuleId` | `rule` | What it flags |
| ------------ | ------ | ------------- |
| `ExpensiveBuiltinInLoop` | `expensive-builtin-in-loop` | A transcendental / special-function builtin (`pow`, `exp`, `log`, `sin`, `sqrt`, `normalize`, …) called inside a loop. |
| `CostlyArithmeticInLoop` | `costly-arithmetic-in-loop` | Division or modulo (`/`, `%`) by a non-constant inside a loop. Very expensive for integers. |
| `LoopInvariantExpression` | `loop-invariant-expression` | An expensive expression inside a loop whose operands never change across iterations — compute it once before the loop. |
| `AtomicInLoop` | `atomic-in-loop` | An atomic operation inside a loop. Repeated atomics on the same address serialize invocations. |
| `BarrierInLoop` | `barrier-in-loop` | A `workgroupBarrier()` / `storageBarrier()` inside a loop, forcing a workgroup-wide sync every iteration. |

An expensive expression that is *also* loop-invariant is reported once, as
`loop-invariant-expression` (the more actionable finding), never double-counted
as `expensive-builtin-in-loop`. Division by a compile-time constant (a literal,
`const`, or `override`) is **not** flagged — the compiler can optimize that.

### Translation-aware rules

These flag patterns that are cheap in native HLSL/D3D but become expensive after
an HLSL→Tint→WGSL translation. They are most useful run over the **translated
WGSL** a tool like WebGPU Inspector already has in hand — not the original HLSL,
where the pathology does not yet exist.

| `PerfRuleId` | `rule` | What it flags |
| ------------ | ------ | ------------- |
| `AtomicStorageRead` | `atomic-storage-read` | An `atomicLoad` of a storage buffer typed `atomic<T>`. WGSL has no mixed plain/atomic access, so every *read* of such a buffer is atomic; Tint lowers `atomicLoad` to `InterlockedOr(dest, 0)` — a full read-modify-write that is free on D3D11 but a GPU-wide serializer on WebGPU. Fix: split the read-only data into its own non-atomic binding. |
| `WorkgroupArrayThreadPrivate` | `workgroup-array-thread-private` | A `var<workgroup>` array indexed only by the local invocation id in every access — each thread touches only its own slot, so it shares nothing. A register spill in disguise; use a local variable. |
| `WorkgroupStorageOversized` | `workgroup-storage-oversized` | Total `var<workgroup>` bytes exceeding WebGPU's default `maxComputeWorkgroupStorageSize` (16 KB), which fails to compile on a default device and otherwise caps occupancy. |
| `SerialScanEmulation` | `serial-scan-emulation` | A loop that serially accumulates workgroup memory into a local (`for (i..localID) prefix += lds[i];`) — the O(n) no-wave fallback shipped in ported HLSL middleware. Suggests a log-step (Hillis-Steele) scan or WGSL subgroups. |

The serial-scan rule distinguishes the bad O(n) form (accumulating into a *local*
scalar) from a correct log-step scan (accumulating *into* the workgroup array),
and is reported with high confidence when the loop's trip count derives from the
local invocation id.

## Filtering the results

Pass a `PerfAnalysisOptions` object to keep or drop findings by id, severity, or
confidence:

```typescript
interface PerfFilter {
  ids?: PerfRuleId[];
  severities?: ("info" | "low" | "medium" | "high")[];
  confidences?: ("high" | "medium" | "low")[];
}

interface PerfAnalysisOptions {
  include?: PerfFilter;   // keep only findings matching this filter
  exclude?: PerfFilter;   // then drop findings matching this filter
}
```

- Within an `include` filter the categories are **ANDed**: a finding is kept only
  if it matches *every* category that is present. A category you omit does not
  constrain.
- The `exclude` filter is applied after `include`: a finding is dropped if it
  matches *any* category present in it.

```javascript
import { analyzePerformance, PerfRuleId } from "wgsl_reflect/wgsl_reflect.module.js";

// Only high-severity findings.
analyzePerformance(code, { include: { severities: ["high"] } });

// Everything except barrier-in-loop.
analyzePerformance(code, { exclude: { ids: [PerfRuleId.BarrierInLoop] } });

// High-confidence findings, but ignore atomics.
analyzePerformance(code, {
  include: { confidences: ["high"] },
  exclude: { ids: [PerfRuleId.AtomicInLoop] },
});
```

## Limitations

- **Heuristics, not a profiler.** The analyzer flags patterns with a known cost;
  it cannot predict cycles, occupancy, or memory-bandwidth limits, and it does
  not model the target GPU.
- **Loop trip counts are unknown.** Cost is weighted by nesting depth using a
  fixed per-level multiplier, not the actual iteration count, which is often a
  runtime value.
- **Invariance is conservative.** The loop-invariant check only reports a finding
  when it can prove the expression does not change across iterations, so it never
  wrongly advises hoisting — but it will miss some genuinely-invariant
  expressions (for example, those that read storage/workgroup memory, which
  another invocation could change).
- **Intra-function only.** Findings are reported per function; cost is not
  propagated across calls, and a cheap-looking call to an expensive helper is not
  charged to the call site. The translation-aware rules
  (`workgroup-array-thread-private`, `serial-scan-emulation`) inspect accesses
  within a single entry function and recognize the local invocation id only when
  it arrives as a direct `@builtin` parameter, not when passed through a call.
- **Workgroup sizing is approximate.** `workgroup-storage-oversized` estimates
  `var<workgroup>` sizes with std-layout rules and skips any type it cannot
  resolve (e.g. an array whose length is an unresolved override), so it is meant
  to catch gross overruns (the 16 KB limit), not to be byte-exact.
- **Memory access patterns are out of scope.** Uncoalesced global memory access
  and workgroup bank conflicts depend on the actual per-invocation addresses and
  are better suited to a dynamic analysis built on the
  [race detector](./race-condition-detection.md)'s instrumentation.
