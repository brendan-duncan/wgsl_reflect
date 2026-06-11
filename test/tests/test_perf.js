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
  });
}
