import { test, group } from "../test.js";
import { analyzePerformance, PerfRuleId, PerfRuleNames } from "../../wgsl_reflect.module.js";

// A shader that triggers several different rules at a few severities/confidences.
const MIXED = `
  @group(0) @binding(0) var<storage, read_write> hist: array<atomic<u32>>;
  @group(0) @binding(1) var<uniform> k: f32;
  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) id: vec3u) {
    var acc = 0.0;
    for (var i = 0u; i < 10u; i++) {
      for (var j = 0u; j < 10u; j++) {
        acc += pow(f32(i), f32(j));   // expensive-builtin-in-loop, high
      }
      acc += sin(k * 3.14);           // loop-invariant-expression, medium
      atomicAdd(&hist[i], 1u);        // atomic-in-loop, high
    }
  }`;

function findingsByRule(code) {
  const { findings } = analyzePerformance(code);
  const byRule = {};
  for (const f of findings) {
    (byRule[f.rule] ??= []).push(f);
  }
  return { findings, byRule };
}

export async function run() {
  await group("PerfAnalyzer", async function () {
    await test("expensive builtin in loop is flagged and depth-weighted", function (test) {
      const { byRule } = findingsByRule(`
        @compute @workgroup_size(64)
        fn main(@builtin(global_invocation_id) id: vec3u) {
          var acc = 0.0;
          for (var i = 0u; i < 10u; i++) {
            for (var j = 0u; j < 10u; j++) {
              acc += pow(f32(i), f32(j));
            }
          }
        }`);
      const f = byRule["expensive-builtin-in-loop"];
      test.notNull(f, "expected an expensive-builtin-in-loop finding");
      test.equals(f.length, 1);
      test.equals(f[0].loopDepth, 2);
      test.equals(f[0].stage, "compute");
      test.true(f[0].score > 8, "nested expensive builtin should score high");
    });

    await test("expensive builtin outside a loop is not flagged", function (test) {
      const { findings } = findingsByRule(`
        @compute @workgroup_size(1)
        fn main(@builtin(global_invocation_id) id: vec3u) {
          let x = pow(f32(id.x), 2.0);
        }`);
      test.equals(findings.length, 0);
    });

    await test("loop-invariant expensive call is flagged as invariant, not just in-loop", function (test) {
      const { byRule } = findingsByRule(`
        @group(0) @binding(0) var<uniform> k: f32;
        @fragment
        fn fs() -> @location(0) vec4f {
          var acc = 0.0;
          for (var i = 0u; i < 100u; i++) {
            acc += sin(k * 3.14);
          }
          return vec4f(acc);
        }`);
      test.notNull(byRule["loop-invariant-expression"], "expected loop-invariant finding");
      // It must NOT be double-reported as expensive-builtin-in-loop.
      test.true(byRule["expensive-builtin-in-loop"] === undefined,
        "invariant call should not also be reported as expensive-builtin-in-loop");
    });

    await test("expression using the loop variable is not invariant", function (test) {
      const { byRule } = findingsByRule(`
        @compute @workgroup_size(1)
        fn main() {
          var acc = 0.0;
          for (var i = 0u; i < 100u; i++) {
            acc += sin(f32(i));
          }
        }`);
      test.true(byRule["loop-invariant-expression"] === undefined,
        "sin(f32(i)) depends on the loop variable and must not be invariant");
      test.notNull(byRule["expensive-builtin-in-loop"]);
    });

    await test("division by a non-constant is flagged, by a constant is not", function (test) {
      const { byRule } = findingsByRule(`
        @compute @workgroup_size(1)
        fn main(@builtin(global_invocation_id) id: vec3u) {
          var s = 0u;
          for (var i = 0u; i < 32u; i++) {
            s += i / id.x;
            s += i / 4u;
            s += i % id.y;
          }
        }`);
      const f = byRule["costly-arithmetic-in-loop"];
      test.notNull(f, "expected costly-arithmetic-in-loop findings");
      test.equals(f.length, 2, "only the two non-constant divisor ops should flag");
    });

    await test("atomics and barriers in loops are flagged", function (test) {
      const { byRule } = findingsByRule(`
        @group(0) @binding(0) var<storage, read_write> hist: array<atomic<u32>>;
        @compute @workgroup_size(64)
        fn main(@builtin(local_invocation_index) lid: u32) {
          for (var i = 0u; i < 16u; i++) {
            atomicAdd(&hist[i], 1u);
            workgroupBarrier();
          }
        }`);
      test.notNull(byRule["atomic-in-loop"]);
      test.notNull(byRule["barrier-in-loop"]);
    });

    await test("a clean shader produces no findings", function (test) {
      const { findings } = findingsByRule(`
        @compute @workgroup_size(64)
        fn main(@builtin(global_invocation_id) id: vec3u) {
          let x = f32(id.x) * 2.0 + 1.0;
        }`);
      test.equals(findings.length, 0);
    });

    await test("every finding carries a stable numeric id matching its rule name", function (test) {
      const { findings } = analyzePerformance(MIXED);
      test.true(findings.length > 0);
      for (const f of findings) {
        test.notNull(PerfRuleNames[f.id], "id should be a known PerfRuleId");
        test.equals(f.rule, PerfRuleNames[f.id], "rule string should match its id");
      }
    });

    await test("include.ids keeps only findings with those ids", function (test) {
      const { findings } = analyzePerformance(MIXED, {
        include: { ids: [PerfRuleId.AtomicInLoop] },
      });
      test.true(findings.length > 0);
      test.true(findings.every(f => f.id === PerfRuleId.AtomicInLoop),
        "only atomic-in-loop findings should remain");
    });

    await test("exclude.ids drops findings with those ids", function (test) {
      const all = analyzePerformance(MIXED).findings;
      const { findings } = analyzePerformance(MIXED, {
        exclude: { ids: [PerfRuleId.AtomicInLoop] },
      });
      test.true(all.some(f => f.id === PerfRuleId.AtomicInLoop),
        "baseline should contain an atomic finding to exclude");
      test.true(findings.every(f => f.id !== PerfRuleId.AtomicInLoop));
      test.equals(findings.length,
        all.filter(f => f.id !== PerfRuleId.AtomicInLoop).length);
    });

    await test("include by severity filters out lower-severity findings", function (test) {
      const { findings } = analyzePerformance(MIXED, {
        include: { severities: ["high"] },
      });
      test.true(findings.length > 0);
      test.true(findings.every(f => f.severity === "high"));
    });

    await test("exclude by confidence removes matching findings", function (test) {
      const { findings } = analyzePerformance(MIXED, {
        exclude: { confidences: ["medium"] },
      });
      test.true(findings.every(f => f.confidence !== "medium"));
    });

    await test("include categories are ANDed together", function (test) {
      // high severity AND high confidence — loop-invariant (medium) is excluded
      // by severity, costly-arithmetic (medium) by confidence.
      const { findings } = analyzePerformance(MIXED, {
        include: { severities: ["high"], confidences: ["high"] },
      });
      test.true(findings.length > 0);
      test.true(findings.every(f => f.severity === "high" && f.confidence === "high"));
    });

    await test("include then exclude both apply", function (test) {
      const { findings } = analyzePerformance(MIXED, {
        include: { confidences: ["high"] },
        exclude: { ids: [PerfRuleId.AtomicInLoop] },
      });
      test.true(findings.every(f => f.confidence === "high" && f.id !== PerfRuleId.AtomicInLoop));
    });

    // --- translation-aware rules (HLSL->Tint->WGSL pathologies) --------------

    await test("#1 atomicLoad of an atomic storage buffer is flagged once per buffer", function (test) {
      const { byRule } = findingsByRule(`
        @group(0) @binding(0) var<storage, read_write> TransferBuffer: array<atomic<u32>>;
        @compute @workgroup_size(64)
        fn main(@builtin(local_invocation_index) lid: u32) {
          let a = bitcast<f32>(atomicLoad(&TransferBuffer[160]));
          let b = atomicLoad(&TransferBuffer[lid]);
          atomicAdd(&TransferBuffer[0], 1u);
        }`);
      const f = byRule["atomic-storage-read"];
      test.notNull(f, "expected an atomic-storage-read finding");
      test.equals(f.length, 1, "one finding per buffer, not per read site");
      test.equals(f[0].id, PerfRuleId.AtomicStorageRead);
    });

    await test("#1 plain reads of a non-atomic buffer are not flagged", function (test) {
      const { byRule } = findingsByRule(`
        @group(0) @binding(0) var<storage, read_write> Counter: array<atomic<u32>>;
        @group(0) @binding(1) var<storage, read> Histogram: array<u32>;
        @compute @workgroup_size(64)
        fn main(@builtin(local_invocation_index) lid: u32) {
          let a = Histogram[160];
          atomicAdd(&Counter[0], 1u);
        }`);
      test.true(byRule["atomic-storage-read"] === undefined,
        "reading a separate non-atomic buffer should not be flagged");
    });

    await test("#2a workgroup array indexed only by local id is flagged", function (test) {
      const { byRule } = findingsByRule(`
        var<workgroup> staged: array<u32, 128>;
        @compute @workgroup_size(128)
        fn main(@builtin(local_invocation_id) tid: vec3u) {
          staged[tid.x] = tid.x * 2u;
          workgroupBarrier();
          let v = staged[tid.x];
        }`);
      test.notNull(byRule["workgroup-array-thread-private"]);
    });

    await test("#2a workgroup array with cross-thread access is not flagged", function (test) {
      const { byRule } = findingsByRule(`
        var<workgroup> tile: array<u32, 128>;
        @compute @workgroup_size(128)
        fn main(@builtin(local_invocation_id) tid: vec3u) {
          tile[tid.x] = tid.x * 2u;
          workgroupBarrier();
          let v = tile[127u - tid.x];
        }`);
      test.true(byRule["workgroup-array-thread-private"] === undefined,
        "an array read at a different index than written is genuine sharing");
    });

    await test("#2b workgroup storage over 16 KB is flagged", function (test) {
      const { byRule } = findingsByRule(`
        struct SplatData { a: array<u32, 62> }
        var<workgroup> staged: array<SplatData, 128>;
        @compute @workgroup_size(128)
        fn main(@builtin(local_invocation_id) tid: vec3u) {
          staged[tid.x].a[0] = 1u;
        }`);
      const f = byRule["workgroup-storage-oversized"];
      test.notNull(f, "31.7 KB of workgroup storage should be flagged");
      test.equals(f[0].severity, "high");
    });

    await test("#2b small workgroup storage is not flagged", function (test) {
      const { byRule } = findingsByRule(`
        var<workgroup> tmp: array<u32, 128>;
        @compute @workgroup_size(128)
        fn main(@builtin(local_invocation_id) tid: vec3u) { tmp[tid.x] = 1u; }`);
      test.true(byRule["workgroup-storage-oversized"] === undefined);
    });

    await test("#3 serial scan over workgroup memory is flagged with high confidence", function (test) {
      const { byRule } = findingsByRule(`
        var<workgroup> sums: array<u32, 128>;
        @compute @workgroup_size(128)
        fn main(@builtin(local_invocation_index) localID: u32) {
          sums[localID] = localID;
          workgroupBarrier();
          var prefix = 0u;
          for (var i = 0u; i < localID; i++) {
            prefix += sums[i];
          }
        }`);
      const f = byRule["serial-scan-emulation"];
      test.notNull(f, "expected a serial-scan-emulation finding");
      test.equals(f[0].confidence, "high", "trip count derived from local id");
    });

    await test("#3 a log-step (Hillis-Steele) scan is not flagged as serial", function (test) {
      const { byRule } = findingsByRule(`
        var<workgroup> sums: array<u32, 128>;
        @compute @workgroup_size(128)
        fn main(@builtin(local_invocation_index) localID: u32) {
          for (var off = 1u; off < 128u; off = off * 2u) {
            workgroupBarrier();
            if (localID >= off) { sums[localID] = sums[localID] + sums[localID - off]; }
          }
        }`);
      test.true(byRule["serial-scan-emulation"] === undefined,
        "accumulating into the workgroup array (not a local) is the good pattern");
    });
  });
}
