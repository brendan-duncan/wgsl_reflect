// =============================================================================
// Static performance analysis for WGSL shaders.
//
// A *static* counterpart to the (dynamic) race detector: instead of emulating
// execution, this walks the parsed AST and flags patterns with a well-known GPU
// cost. It needs no bind groups, no inputs, and no dispatch size — just source.
//
// These are HEURISTIC SMELLS, not a profiler. Real cost depends on the target
// GPU's architecture, occupancy, and scheduler; this pass can only point at
// constructs whose cost is high *relative to the surrounding code* and explain
// why. Every finding carries a confidence and a loop-depth-weighted score so
// callers can rank and threshold them.
//
// Rules implemented:
//   * expensive-builtin-in-loop  - transcendental / SFU builtins inside a loop
//   * costly-arithmetic-in-loop  - division / modulo by a non-constant in a loop
//   * loop-invariant-expression  - expensive work in a loop that never changes
//                                  across iterations (hoist it out)
//   * barrier-in-loop            - a workgroup/storage barrier inside a loop
//   * atomic-in-loop             - an atomic op inside a loop (contention)
//
// An expensive expression that is *also* loop-invariant is reported once, as
// loop-invariant (the more actionable finding), never double-counted.
// =============================================================================

import * as AST from "../wgsl_ast.js";
import { WgslParser } from "../wgsl_parser.js";

// -----------------------------------------------------------------------------
// Cost model for builtin functions.
//
// Tiers reflect how a typical GPU lowers these: tier 3 are multi-instruction
// special-function-unit ops (or compositions of them), tier 2 are a single
// SFU/sqrt op, tier 1 are several ALU ops. Cheap elementwise builtins (abs,
// min, floor, dot, ...) are deliberately absent — they are not worth flagging.
// -----------------------------------------------------------------------------

const BUILTIN_COST = new Map<string, number>([
    // tier 3 — most expensive
    ["pow", 3], ["exp", 3], ["exp2", 3], ["log", 3], ["log2", 3],
    ["atan", 3], ["atan2", 3], ["asin", 3], ["acos", 3],
    ["sinh", 3], ["cosh", 3], ["tanh", 3],
    ["asinh", 3], ["acosh", 3], ["atanh", 3],
    // tier 2 — one SFU / sqrt
    ["sin", 2], ["cos", 2], ["tan", 2],
    ["sqrt", 2], ["inverseSqrt", 2], ["ldexp", 2],
    ["normalize", 2], ["length", 2], ["distance", 2], ["determinant", 2],
    // tier 1 — a handful of ALU ops
    ["cross", 1], ["reflect", 1], ["refract", 1],
    ["faceForward", 1], ["smoothstep", 1], ["transpose", 1],
]);

// Atomic builtins — serialization / contention point when in a loop.
const ATOMIC_BUILTINS = new Set([
    "atomicAdd", "atomicSub", "atomicMax", "atomicMin", "atomicAnd",
    "atomicOr", "atomicXor", "atomicExchange", "atomicCompareExchangeWeak",
    "atomicStore", "atomicLoad",
]);

const BARRIER_BUILTINS = new Set([
    "workgroupBarrier", "storageBarrier", "textureBarrier",
]);

// Builtins that read memory another invocation can change, or that have side
// effects / unknown purity — excluded from loop-invariant hoisting.
const IMPURE_BUILTINS = new Set([
    ...ATOMIC_BUILTINS, ...BARRIER_BUILTINS,
    "workgroupUniformLoad",
]);

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export type PerfSeverity = "info" | "low" | "medium" | "high";
export type PerfConfidence = "high" | "medium" | "low";

// Stable numeric identifier for each kind of finding. Prefer filtering on these
// over the human-readable `rule` string, which may change wording over time.
export enum PerfRuleId {
    ExpensiveBuiltinInLoop = 1,
    CostlyArithmeticInLoop = 2,
    LoopInvariantExpression = 3,
    AtomicInLoop = 4,
    BarrierInLoop = 5,
}

// Stable kebab-case name for each rule id (the value of `PerfFinding.rule`).
export const PerfRuleNames: Record<PerfRuleId, string> = {
    [PerfRuleId.ExpensiveBuiltinInLoop]: "expensive-builtin-in-loop",
    [PerfRuleId.CostlyArithmeticInLoop]: "costly-arithmetic-in-loop",
    [PerfRuleId.LoopInvariantExpression]: "loop-invariant-expression",
    [PerfRuleId.AtomicInLoop]: "atomic-in-loop",
    [PerfRuleId.BarrierInLoop]: "barrier-in-loop",
};

export interface PerfFinding {
    id: PerfRuleId;             // stable numeric id; filter on this, not `rule`
    rule: string;               // human-readable name of `id` (see PerfRuleNames)
    message: string;
    line: number;
    function: string;
    stage: string | null;       // "vertex" | "fragment" | "compute" | null (helper)
    loopDepth: number;
    severity: PerfSeverity;
    confidence: PerfConfidence;
    score: number;              // for ranking; higher = more impactful
}

export interface PerfAnalysisResult {
    findings: PerfFinding[];
}

// A set of criteria a finding can be matched against. Within one filter the
// specified categories are ANDed (a finding must satisfy every category that is
// present); an unspecified category does not constrain.
export interface PerfFilter {
    ids?: PerfRuleId[];
    severities?: PerfSeverity[];
    confidences?: PerfConfidence[];
}

export interface PerfAnalysisOptions {
    // Keep only findings that match this filter. Omit to keep everything.
    include?: PerfFilter;
    // Drop findings that match this filter. Applied after `include`. A finding
    // is excluded if it matches ANY specified category here.
    exclude?: PerfFilter;
}

// -----------------------------------------------------------------------------
// Module-scope symbol classification
// -----------------------------------------------------------------------------

// How a name's storage behaves for invariance purposes.
type VarClass =
    | "uniform"      // constant across the whole dispatch -> invariant-safe
    | "const"        // module/function const or override -> invariant-safe
    | "memory"       // storage / workgroup -> may change underfoot, treat varying
    | "other";       // private / function / unknown local

// -----------------------------------------------------------------------------
// Analyzer
// -----------------------------------------------------------------------------

export function analyzePerformance(
    code: string,
    options?: PerfAnalysisOptions,
): PerfAnalysisResult {
    const parser = new WgslParser();
    let ast: AST.Statement[];
    try {
        ast = parser.parse(code);
    } catch (e) {
        return { findings: [] };
    }

    const analyzer = new PerfAnalyzer(ast);
    analyzer.run();
    analyzer.findings.sort((a, b) => b.score - a.score);

    const findings = options
        ? analyzer.findings.filter(f => matchesOptions(f, options))
        : analyzer.findings;
    return { findings };
}

// A finding survives if it passes the `include` filter (every specified
// category contains it) and is not caught by the `exclude` filter (no specified
// category contains it).
function matchesOptions(f: PerfFinding, options: PerfAnalysisOptions): boolean {
    if (options.include && !passesInclude(f, options.include)) return false;
    if (options.exclude && matchesAny(f, options.exclude)) return false;
    return true;
}

function passesInclude(f: PerfFinding, filter: PerfFilter): boolean {
    if (filter.ids && !filter.ids.includes(f.id)) return false;
    if (filter.severities && !filter.severities.includes(f.severity)) return false;
    if (filter.confidences && !filter.confidences.includes(f.confidence)) return false;
    return true;
}

function matchesAny(f: PerfFinding, filter: PerfFilter): boolean {
    if (filter.ids && filter.ids.includes(f.id)) return true;
    if (filter.severities && filter.severities.includes(f.severity)) return true;
    if (filter.confidences && filter.confidences.includes(f.confidence)) return true;
    return false;
}

// A loop scope on the walk stack. `written` is the set of names assigned to
// anywhere in this loop's body (including nested loops) — a name in this set
// varies across iterations.
interface LoopScope {
    written: Set<string>;
}

class PerfAnalyzer {
    readonly findings: PerfFinding[] = [];
    private _moduleVars = new Map<string, VarClass>();
    private _ast: AST.Statement[];

    // current-function context
    private _fnName = "";
    private _stage: string | null = null;
    private _loops: LoopScope[] = [];

    constructor(ast: AST.Statement[]) {
        this._ast = ast;
    }

    run(): void {
        this._collectModuleVars();
        for (const node of this._ast) {
            if (node instanceof AST.Function) {
                this._analyzeFunction(node);
            }
        }
    }

    // Classify module-scope vars/consts/overrides so invariance checks can tell
    // uniforms (constant per dispatch) from storage/workgroup memory.
    private _collectModuleVars(): void {
        for (const node of this._ast) {
            if (node instanceof AST.Var) {
                this._moduleVars.set(node.name, classifyStorage(node.storage));
            } else if (node instanceof AST.Const) {
                this._moduleVars.set(node.name, "const");
            } else if (node instanceof AST.Override) {
                this._moduleVars.set(node.name, "const");
            }
        }
    }

    private _analyzeFunction(fn: AST.Function): void {
        this._fnName = fn.name;
        this._stage = stageOf(fn);
        this._loops = [];
        this._walkBlock(fn.body);
    }

    private get _loopDepth(): number {
        return this._loops.length;
    }

    // -------------------------------------------------------------------------
    // Statement walk
    // -------------------------------------------------------------------------

    private _walkBlock(body: AST.Statement[] | null): void {
        if (!body) return;
        for (const s of body) {
            if (Array.isArray(s)) {
                this._walkBlock(s as unknown as AST.Statement[]);
            } else {
                this._walkStatement(s);
            }
        }
    }

    private _walkStatement(s: AST.Statement): void {
        if (s instanceof AST.For) {
            s.init && this._walkStatement(s.init);
            s.condition && this._walkExpr(s.condition);
            s.increment && this._walkStatement(s.increment);
            // The induction variable is written by init/increment, not the body,
            // so seed it explicitly — otherwise expressions using it look invariant.
            const seed = new Set<string>();
            if (s.init) collectWrites([s.init], seed);
            if (s.increment) collectWrites([s.increment], seed);
            this._enterLoop(s.body, seed);
        } else if (s instanceof AST.While) {
            this._walkExpr(s.condition);
            this._enterLoop(s.body);
        } else if (s instanceof AST.Loop) {
            const body = s.continuing ? [...s.body, s.continuing] : s.body;
            this._enterLoop(body as AST.Statement[]);
        } else if (s instanceof AST.Continuing) {
            this._walkBlock(s.body);
        } else if (s instanceof AST.If) {
            this._walkExpr(s.condition);
            this._walkBlock(s.body);
            if (s.elseif) {
                for (const e of s.elseif) {
                    this._walkExpr(e.condition);
                    this._walkBlock(e.body);
                }
            }
            this._walkBlock(s.else);
        } else if (s instanceof AST.Switch) {
            this._walkExpr(s.condition);
            for (const c of s.cases) {
                this._walkBlock(c.body);
            }
        } else if (s instanceof AST.Assign) {
            this._walkExpr(s.value);
            this._walkExpr(s.variable);
        } else if (s instanceof AST.Increment) {
            this._walkExpr(s.variable);
        } else if (s instanceof AST.Call) {
            this._checkCallStatement(s);
            for (const a of s.args) this._walkExpr(a);
        } else if (s instanceof AST.Var || s instanceof AST.Let || s instanceof AST.Const) {
            s.value && this._walkExpr(s.value);
        } else if (s instanceof AST.Return) {
            s.value && this._walkExpr(s.value);
        }
        // Break / Continue / Discard / etc. carry no expressions of interest.
    }

    private _enterLoop(body: AST.Statement[], seed?: Set<string>): void {
        const written = new Set<string>(seed);
        collectWrites(body, written);
        this._loops.push({ written });
        this._walkBlock(body);
        this._loops.pop();
    }

    // A `barrier()` / atomic invoked as a bare statement (most common form).
    private _checkCallStatement(call: AST.Call): void {
        if (this._loopDepth === 0) return;
        if (BARRIER_BUILTINS.has(call.name)) {
            this._report({
                id: PerfRuleId.BarrierInLoop, line: call.line, baseCost: 2,
                confidence: "high",
                message: `'${call.name}()' is inside a loop (depth ${this._loopDepth}). ` +
                    `Each iteration forces the whole workgroup to synchronize; ` +
                    `hoist it out of the loop if the loop body does not require per-iteration ordering.`,
            });
        } else if (ATOMIC_BUILTINS.has(call.name)) {
            this._reportAtomicInLoop(call.name, call.line);
        }
    }

    // -------------------------------------------------------------------------
    // Expression walk
    // -------------------------------------------------------------------------

    private _walkExpr(e: AST.Expression | null): void {
        if (!e) return;

        if (e instanceof AST.CallExpr) {
            // Try the whole call as one expensive/invariant candidate first; if
            // it is reported as loop-invariant we skip descending (the inner
            // cost is subsumed by hoisting the whole expression).
            if (this._checkExpensiveCall(e)) {
                return;
            }
            if (e.args) for (const a of e.args) this._walkExpr(a);
        } else if (e instanceof AST.BinaryOperator) {
            if (this._checkDivision(e)) {
                return;
            }
            this._walkExpr(e.left);
            this._walkExpr(e.right);
        } else if (e instanceof AST.UnaryOperator) {
            this._walkExpr(e.right);
        } else if (e instanceof AST.CreateExpr || e instanceof AST.TypecastExpr) {
            if (e.args) for (const a of e.args) this._walkExpr(a);
        } else if (e instanceof AST.BitcastExpr) {
            this._walkExpr(e.value);
        } else if (e instanceof AST.VariableExpr) {
            this._walkPostfix(e.postfix);
        }
        // LiteralExpr / ConstExpr / StringExpr: nothing to flag.
    }

    private _walkPostfix(p: AST.Expression | null): void {
        while (p) {
            if (p instanceof AST.ArrayIndex) this._walkExpr(p.index);
            p = p.postfix;
        }
    }

    // Returns true if it consumed the expression (reported as loop-invariant).
    private _checkExpensiveCall(call: AST.CallExpr): boolean {
        const cost = BUILTIN_COST.get(call.name);
        if (cost === undefined || this._loopDepth === 0) return false;

        if (this._isInvariant(call)) {
            this._report({
                id: PerfRuleId.LoopInvariantExpression, line: call.line, baseCost: cost + 2,
                confidence: "medium",
                message: `'${call.name}(...)' inside a loop (depth ${this._loopDepth}) does not ` +
                    `depend on the loop — its operands are constant across iterations. ` +
                    `Compute it once before the loop and reuse the result.`,
            });
            return true;
        }

        this._report({
            id: PerfRuleId.ExpensiveBuiltinInLoop, line: call.line, baseCost: cost,
            confidence: "high",
            message: `'${call.name}(...)' is an expensive builtin called inside a loop ` +
                `(depth ${this._loopDepth}). It runs every iteration; consider hoisting ` +
                `invariant parts, precomputing a table, or a cheaper approximation.`,
        });
        return false;   // still descend into args for nested expensive calls
    }

    // Returns true if reported as loop-invariant (consumes the expression).
    private _checkDivision(op: AST.BinaryOperator): boolean {
        if (op.operator !== "/" && op.operator !== "%") return false;
        if (this._loopDepth === 0) return false;
        if (this._isConstExpr(op.right)) return false;   // div by constant: cheap

        const what = op.operator === "%" ? "modulo" : "division";
        if (this._isInvariant(op)) {
            this._report({
                id: PerfRuleId.LoopInvariantExpression, line: op.line, baseCost: 3,
                confidence: "medium",
                message: `${what} ('${op.operator}') inside a loop (depth ${this._loopDepth}) ` +
                    `does not depend on the loop. Compute it once before the loop.`,
            });
            return true;
        }

        this._report({
            id: PerfRuleId.CostlyArithmeticInLoop, line: op.line, baseCost: 2,
            confidence: "medium",
            message: `${what} by a non-constant ('${op.operator}') inside a loop ` +
                `(depth ${this._loopDepth}). Division/modulo is costly on GPUs — very ` +
                `expensive for integers. If the divisor is constant or a power of two, ` +
                `refactor so the compiler can see it (e.g. multiply by a reciprocal, or '& (n-1)').`,
        });
        return false;
    }

    private _reportAtomicInLoop(name: string, line: number): void {
        this._report({
            id: PerfRuleId.AtomicInLoop, line, baseCost: 2, confidence: "high",
            message: `'${name}(...)' is an atomic operation inside a loop (depth ${this._loopDepth}). ` +
                `Repeated atomics on the same address serialize invocations; consider ` +
                `accumulating in a local/register and doing a single atomic after the loop.`,
        });
    }

    // -------------------------------------------------------------------------
    // Invariance / constness
    // -------------------------------------------------------------------------

    // True if `e` evaluates to the same value on every iteration of every
    // enclosing loop. SOUND-leaning: returns false whenever it cannot prove
    // invariance, so it never wrongly advises hoisting.
    private _isInvariant(e: AST.Expression): boolean {
        if (this._loopDepth === 0) return false;
        const varying = this._varyingNames();
        return this._exprInvariant(e, varying);
    }

    private _varyingNames(): Set<string> {
        const all = new Set<string>();
        for (const scope of this._loops) {
            for (const n of scope.written) all.add(n);
        }
        return all;
    }

    private _exprInvariant(e: AST.Expression, varying: Set<string>): boolean {
        if (e instanceof AST.LiteralExpr) {
            return true;
        }
        if (e instanceof AST.VariableExpr) {
            if (varying.has(e.name)) return false;
            // storage / workgroup memory can be written by other invocations.
            if (this._moduleVars.get(e.name) === "memory") return false;
            // any index in the postfix must itself be invariant.
            return this._postfixInvariant(e.postfix, varying);
        }
        if (e instanceof AST.ConstExpr || e instanceof AST.StringExpr) {
            return true;
        }
        if (e instanceof AST.BinaryOperator) {
            return this._exprInvariant(e.left, varying) && this._exprInvariant(e.right, varying);
        }
        if (e instanceof AST.UnaryOperator) {
            return this._exprInvariant(e.right, varying);
        }
        if (e instanceof AST.BitcastExpr) {
            return this._exprInvariant(e.value, varying);
        }
        if (e instanceof AST.CreateExpr || e instanceof AST.TypecastExpr) {
            return (e.args ?? []).every(a => this._exprInvariant(a, varying));
        }
        if (e instanceof AST.CallExpr) {
            // Only builtins of known purity can be hoisted; a user function or
            // an impure builtin may observe state that changes across iterations.
            if (!e.isBuiltin || IMPURE_BUILTINS.has(e.name)) return false;
            return (e.args ?? []).every(a => this._exprInvariant(a, varying));
        }
        // Unknown node: assume not provably invariant.
        return false;
    }

    private _postfixInvariant(p: AST.Expression | null, varying: Set<string>): boolean {
        while (p) {
            if (p instanceof AST.ArrayIndex && !this._exprInvariant(p.index, varying)) {
                return false;
            }
            p = p.postfix;
        }
        return true;
    }

    // A compile-time constant divisor: a literal, or a name bound to a
    // const/override. (The compiler can optimize division by these.)
    private _isConstExpr(e: AST.Expression): boolean {
        if (e instanceof AST.LiteralExpr) return true;
        if (e instanceof AST.ConstExpr) return true;
        if (e instanceof AST.VariableExpr && e.postfix === null) {
            return this._moduleVars.get(e.name) === "const";
        }
        if (e instanceof AST.UnaryOperator) return this._isConstExpr(e.right);
        return false;
    }

    // -------------------------------------------------------------------------
    // Finding construction
    // -------------------------------------------------------------------------

    private _report(p: {
        id: PerfRuleId; line: number; baseCost: number;
        confidence: PerfConfidence; message: string;
    }): void {
        // Cost grows geometrically with loop nesting: a body at depth d runs
        // roughly N^d times. We don't know N, so use a fixed multiplier as a
        // stand-in for "deeper loops matter more".
        const depth = this._loopDepth;
        const score = p.baseCost * Math.pow(4, Math.max(0, depth - 1)) *
            (p.confidence === "high" ? 1 : p.confidence === "medium" ? 0.75 : 0.5);

        this.findings.push({
            id: p.id,
            rule: PerfRuleNames[p.id],
            message: p.message,
            line: p.line,
            function: this._fnName,
            stage: this._stage,
            loopDepth: depth,
            severity: scoreToSeverity(score),
            confidence: p.confidence,
            score,
        });
    }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function stageOf(fn: AST.Function): string | null {
    for (const attr of fn.attributes ?? []) {
        if (attr.name === "vertex" || attr.name === "fragment" || attr.name === "compute") {
            return attr.name;
        }
    }
    return null;
}

function classifyStorage(storage: string | null): VarClass {
    switch (storage) {
        case "uniform": return "uniform";
        case "storage":
        case "workgroup": return "memory";
        default: return "other";   // private / function / null
    }
}

function scoreToSeverity(score: number): PerfSeverity {
    if (score >= 8) return "high";
    if (score >= 3) return "medium";
    if (score >= 1) return "low";
    return "info";
}

// Collect every name written (assigned, incremented, or declared) anywhere in a
// block, recursing into nested control flow. A name here varies across loop
// iterations.
function collectWrites(body: AST.Statement[] | null, out: Set<string>): void {
    if (!body) return;
    for (const s of body) {
        if (Array.isArray(s)) {
            collectWrites(s as unknown as AST.Statement[], out);
            continue;
        }
        if (s instanceof AST.Assign) {
            addLvalueRoot(s.variable, out);
        } else if (s instanceof AST.Increment) {
            addLvalueRoot(s.variable, out);
        } else if (s instanceof AST.Var || s instanceof AST.Let || s instanceof AST.Const) {
            out.add(s.name);
        } else if (s instanceof AST.For) {
            if (s.init) collectWrites([s.init], out);
            if (s.increment) collectWrites([s.increment], out);
            collectWrites(s.body, out);
        } else if (s instanceof AST.While) {
            collectWrites(s.body, out);
        } else if (s instanceof AST.Loop) {
            collectWrites(s.body, out);
            if (s.continuing) collectWrites(s.continuing.body, out);
        } else if (s instanceof AST.If) {
            collectWrites(s.body, out);
            if (s.elseif) for (const e of s.elseif) collectWrites(e.body, out);
            collectWrites(s.else, out);
        } else if (s instanceof AST.Switch) {
            for (const c of s.cases) collectWrites(c.body, out);
        }
    }
}

// The base variable name of an lvalue expression (`a`, `a.b`, `a[i]`, `a.b[i].c`
// all have root `a`).
function addLvalueRoot(e: AST.Expression, out: Set<string>): void {
    if (e instanceof AST.VariableExpr) {
        out.add(e.name);
    }
}
