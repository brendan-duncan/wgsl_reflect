/**
 * Static cost model for WGSL shaders.
 *
 * Produces a hierarchical, flame-graph-shaped tree of estimated work for each
 * entry point: entry -> called functions -> loops -> branches -> statements.
 * Costs are *per shader invocation* (one vertex, one fragment, one compute
 * thread), expressed in abstract op units across four dimensions:
 *
 *   alu      - plain arithmetic / logic instructions
 *   sfu      - special function unit ops (transcendentals, sqrt, division)
 *   texture  - texture sample / load / store, including the likely cache miss
 *   memory   - storage and uniform buffer accesses
 *
 * The dimensions are weighted into a single scalar so a flame graph has one
 * width axis, but callers can re-weight for a specific GPU, or read the
 * dimensions directly to see *why* something is expensive.
 *
 * This is a model, not a measurement. It cannot see the driver's optimizer,
 * register pressure, occupancy, or divergence. Multiply the per-invocation cost
 * by a real invocation count (draw/dispatch sizes, measured fragment counts) to
 * get a frame-relative picture, and normalize against a measured pass duration
 * to land in real time units.
 */

import * as AST from "../wgsl_ast.js";
import { WgslParser } from "../wgsl_parser.js";

// -----------------------------------------------------------------------------
// Cost dimensions and weights
// -----------------------------------------------------------------------------

export interface CostVec {
    alu: number;
    sfu: number;
    texture: number;
    memory: number;
}

export type CostDimension = keyof CostVec;

export const CostDimensions: CostDimension[] = ["alu", "sfu", "texture", "memory"];

/**
 * Relative cost of one op in each dimension, in "alu-equivalents". Defaults are
 * a rough consensus across desktop and mobile GPUs: an SFU op is a handful of
 * ALU slots, a buffer access costs bandwidth and latency, and a filtered texture
 * sample is the most expensive thing a fragment shader typically does.
 */
export const DefaultCostWeights: CostVec = {
    alu: 1,
    sfu: 4,
    texture: 20,
    memory: 8,
};

export function emptyCost(): CostVec {
    return { alu: 0, sfu: 0, texture: 0, memory: 0 };
}

export function addCost(dst: CostVec, src: CostVec, scale: number = 1): CostVec {
    dst.alu += src.alu * scale;
    dst.sfu += src.sfu * scale;
    dst.texture += src.texture * scale;
    dst.memory += src.memory * scale;
    return dst;
}

export function scaleCost(c: CostVec, scale: number): CostVec {
    return {
        alu: c.alu * scale,
        sfu: c.sfu * scale,
        texture: c.texture * scale,
        memory: c.memory * scale,
    };
}

export function weighCost(c: CostVec, w: CostVec = DefaultCostWeights): number {
    return c.alu * w.alu + c.sfu * w.sfu + c.texture * w.texture + c.memory * w.memory;
}

/** The dimension contributing the most weighted cost, for coloring/summaries. */
export function dominantDimension(c: CostVec, w: CostVec = DefaultCostWeights): CostDimension {
    let best: CostDimension = "alu";
    let bestValue = -1;
    for (const d of CostDimensions) {
        const v = c[d] * w[d];
        if (v > bestValue) {
            bestValue = v;
            best = d;
        }
    }
    return best;
}

// -----------------------------------------------------------------------------
// Op cost tables
// -----------------------------------------------------------------------------

// Builtins that touch a texture. Every one of these is modeled as a texture op;
// the filtered-sample variants also do address math.
const TEXTURE_BUILTINS = new Set([
    "textureSample", "textureSampleBias", "textureSampleLevel", "textureSampleGrad",
    "textureSampleCompare", "textureSampleCompareLevel", "textureSampleBaseClampToEdge",
    "textureGather", "textureGatherCompare",
    "textureLoad", "textureStore",
]);

// Texture queries are cheap metadata reads, not sampling.
const TEXTURE_QUERY_BUILTINS = new Set([
    "textureDimensions", "textureNumLayers", "textureNumLevels", "textureNumSamples",
]);

const ATOMIC_BUILTINS = new Set([
    "atomicAdd", "atomicSub", "atomicMax", "atomicMin", "atomicAnd",
    "atomicOr", "atomicXor", "atomicExchange", "atomicCompareExchangeWeak",
    "atomicStore", "atomicLoad",
]);

const BARRIER_BUILTINS = new Set([
    "workgroupBarrier", "storageBarrier", "textureBarrier",
]);

// Per-builtin cost, excluding its arguments. Anything not listed and not
// recognized above falls back to DEFAULT_BUILTIN_COST.
const BUILTIN_COST = new Map<string, CostVec>([
    // Transcendentals: typically an SFU op, sometimes a pair of them.
    ["pow", { alu: 1, sfu: 2, texture: 0, memory: 0 }],
    ["exp", { alu: 0, sfu: 1, texture: 0, memory: 0 }],
    ["exp2", { alu: 0, sfu: 1, texture: 0, memory: 0 }],
    ["log", { alu: 1, sfu: 1, texture: 0, memory: 0 }],
    ["log2", { alu: 0, sfu: 1, texture: 0, memory: 0 }],
    ["sin", { alu: 1, sfu: 1, texture: 0, memory: 0 }],
    ["cos", { alu: 1, sfu: 1, texture: 0, memory: 0 }],
    ["tan", { alu: 1, sfu: 2, texture: 0, memory: 0 }],
    ["asin", { alu: 2, sfu: 2, texture: 0, memory: 0 }],
    ["acos", { alu: 2, sfu: 2, texture: 0, memory: 0 }],
    ["atan", { alu: 2, sfu: 2, texture: 0, memory: 0 }],
    ["atan2", { alu: 3, sfu: 2, texture: 0, memory: 0 }],
    ["sinh", { alu: 2, sfu: 2, texture: 0, memory: 0 }],
    ["cosh", { alu: 2, sfu: 2, texture: 0, memory: 0 }],
    ["tanh", { alu: 3, sfu: 2, texture: 0, memory: 0 }],
    ["asinh", { alu: 3, sfu: 2, texture: 0, memory: 0 }],
    ["acosh", { alu: 3, sfu: 2, texture: 0, memory: 0 }],
    ["atanh", { alu: 3, sfu: 2, texture: 0, memory: 0 }],
    // sqrt / reciprocal class: one SFU op.
    ["sqrt", { alu: 0, sfu: 1, texture: 0, memory: 0 }],
    ["inverseSqrt", { alu: 0, sfu: 1, texture: 0, memory: 0 }],
    ["ldexp", { alu: 0, sfu: 1, texture: 0, memory: 0 }],
    ["frexp", { alu: 2, sfu: 1, texture: 0, memory: 0 }],
    ["modf", { alu: 2, sfu: 0, texture: 0, memory: 0 }],
    // Vector ops built on a reciprocal-sqrt plus a dot product.
    ["normalize", { alu: 4, sfu: 1, texture: 0, memory: 0 }],
    ["length", { alu: 3, sfu: 1, texture: 0, memory: 0 }],
    ["distance", { alu: 4, sfu: 1, texture: 0, memory: 0 }],
    ["determinant", { alu: 9, sfu: 0, texture: 0, memory: 0 }],
    ["transpose", { alu: 4, sfu: 0, texture: 0, memory: 0 }],
    // A handful of ALU ops each.
    ["cross", { alu: 6, sfu: 0, texture: 0, memory: 0 }],
    ["reflect", { alu: 6, sfu: 0, texture: 0, memory: 0 }],
    ["refract", { alu: 10, sfu: 1, texture: 0, memory: 0 }],
    ["faceForward", { alu: 5, sfu: 0, texture: 0, memory: 0 }],
    ["smoothstep", { alu: 5, sfu: 0, texture: 0, memory: 0 }],
    ["mix", { alu: 2, sfu: 0, texture: 0, memory: 0 }],
    ["clamp", { alu: 2, sfu: 0, texture: 0, memory: 0 }],
    ["dot", { alu: 3, sfu: 0, texture: 0, memory: 0 }],
    ["fma", { alu: 1, sfu: 0, texture: 0, memory: 0 }],
    ["select", { alu: 1, sfu: 0, texture: 0, memory: 0 }],
    // Derivatives are cheap but force quad-wide execution.
    ["dpdx", { alu: 2, sfu: 0, texture: 0, memory: 0 }],
    ["dpdy", { alu: 2, sfu: 0, texture: 0, memory: 0 }],
    ["fwidth", { alu: 3, sfu: 0, texture: 0, memory: 0 }],
]);

const DEFAULT_BUILTIN_COST: CostVec = { alu: 1, sfu: 0, texture: 0, memory: 0 };
const TEXTURE_SAMPLE_COST: CostVec = { alu: 2, sfu: 0, texture: 1, memory: 0 };
const TEXTURE_QUERY_COST: CostVec = { alu: 1, sfu: 0, texture: 0, memory: 0 };
const ATOMIC_COST: CostVec = { alu: 1, sfu: 0, texture: 0, memory: 1 };
const BARRIER_COST: CostVec = { alu: 4, sfu: 0, texture: 0, memory: 0 };

// Binary operators whose cost differs from a single ALU op.
const OPERATOR_COST = new Map<string, CostVec>([
    ["/", { alu: 0, sfu: 1, texture: 0, memory: 0 }],
    ["%", { alu: 1, sfu: 1, texture: 0, memory: 0 }],
]);

const DEFAULT_OPERATOR_COST: CostVec = { alu: 1, sfu: 0, texture: 0, memory: 0 };

// One access to a buffer-backed variable.
const BUFFER_ACCESS_COST: CostVec = { alu: 0, sfu: 0, texture: 0, memory: 1 };
// Workgroup memory is on-chip: much cheaper than a buffer, not free.
const WORKGROUP_ACCESS_COST: CostVec = { alu: 1, sfu: 0, texture: 0, memory: 0 };

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

export type CostNodeKind =
    | "entry"       // a shader entry point (root of a tree)
    | "function"    // a call to a user-defined function
    | "loop"        // for / while / loop
    | "branch"      // if / else-if / else arm
    | "switch"      // switch statement
    | "case"        // one switch arm
    | "statement"   // a leaf statement
    | "recursive";  // a call cycle, not expanded

export interface CostNode {
    kind: CostNodeKind;
    /** Display label, e.g. `fragmentMain`, `for i < 64`, `textureSample(...)`. */
    name: string;
    /** 1-based source line this node starts on. */
    line: number;
    /** 1-based source line this node ends on (== line for most statements). */
    endLine: number;
    /** Source character range, or -1 when the parser didn't span this node. */
    start: number;
    end: number;
    /** Cost of this node's own operations, excluding children, already scaled
     *  by how many times it runs per shader invocation. */
    self: CostVec;
    /** self + sum of children's total. */
    total: CostVec;
    /** `self` and `total` collapsed through the weights, for flame widths. */
    selfCost: number;
    totalCost: number;
    /** How many times this node's body runs per entry to it (loop trip count,
     *  or the branch probability for a branch arm). 1 for plain statements. */
    iterations: number;
    /** False when `iterations` is an assumption rather than derived from the
     *  source (an unbounded loop, a data-dependent bound). */
    iterationsKnown: boolean;
    /** True when this node or anything under it relied on an assumption. */
    estimated: boolean;
    children: CostNode[];
}

export interface EntryCost {
    name: string;
    stage: "vertex" | "fragment" | "compute";
    /** Compute only: the @workgroup_size, defaulting to [1,1,1]. */
    workgroupSize: [number, number, number] | null;
    /** Root of the flame tree. */
    root: CostNode;
    /** Weighted cost of one invocation of this entry point. */
    costPerInvocation: number;
    /** Per-dimension cost of one invocation. */
    cost: CostVec;
}

export interface CostModelResult {
    entries: EntryCost[];
    /** Non-fatal notes about assumptions made (unbounded loops, cut-off
     *  recursion, node budget exhausted). Surface these next to the graph. */
    warnings: string[];
    weights: CostVec;
}

export interface CostModelOptions {
    /** Override the per-dimension weights. */
    weights?: Partial<CostVec>;
    /** Trip count assumed for a loop whose bounds can't be derived. Default 8. */
    defaultTripCount?: number;
    /** Upper clamp on a derived trip count, so `for i < 1000000` doesn't swamp
     *  everything else in the graph. Default 4096. */
    maxTripCount?: number;
    /** How to cost an if/else. "average" splits evenly between the arms (the
     *  expected cost of a uniform branch); "worstCase" charges both arms in
     *  full (what a divergent warp actually pays). Default "average". */
    branchModel?: "average" | "worstCase";
    /** Maximum user-function call depth to inline. Default 12. */
    maxCallDepth?: number;
    /** Cap on nodes per entry tree, to keep the UI responsive. Default 20000. */
    maxNodes?: number;
}

// -----------------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------------

/**
 * Build per-entry-point cost trees for a WGSL shader.
 * @param codeOrAst shader source, or an already-parsed AST
 */
export function buildShaderCostTree(
    codeOrAst: string | AST.Statement[],
    options?: CostModelOptions,
): CostModelResult {
    const weights = { ...DefaultCostWeights, ...(options?.weights ?? {}) };

    let ast: AST.Statement[];
    if (typeof codeOrAst === "string") {
        try {
            ast = new WgslParser().parse(codeOrAst);
        } catch (e) {
            return { entries: [], warnings: [`Parse failed: ${e}`], weights };
        }
    } else {
        ast = codeOrAst;
    }

    const builder = new CostTreeBuilder(ast, weights, options ?? {});
    return builder.run();
}

// -----------------------------------------------------------------------------
// Builder
// -----------------------------------------------------------------------------

// How a module-scope name is stored, which decides what an access to it costs.
type VarClass = "buffer" | "workgroup" | "handle" | "private";

// What an expression walk accumulated: a flat cost, plus any user-function
// calls it made, which become child nodes of the enclosing statement.
interface ExprResult {
    cost: CostVec;
    calls: AST.CallExpr[] | null;
}

class CostTreeBuilder {
    private _ast: AST.Statement[];
    private _weights: CostVec;
    private _defaultTripCount: number;
    private _maxTripCount: number;
    private _branchModel: "average" | "worstCase";
    private _maxCallDepth: number;
    private _maxNodes: number;

    private _functions = new Map<string, AST.Function>();
    private _moduleVars = new Map<string, VarClass>();
    private _moduleConsts = new Map<string, number>();
    private _warnings: string[] = [];
    private _warned = new Set<string>();

    // Per-entry walk state.
    private _callStack: string[] = [];
    private _nodeCount = 0;
    private _budgetWarned = false;

    constructor(ast: AST.Statement[], weights: CostVec, options: CostModelOptions) {
        this._ast = ast;
        this._weights = weights;
        this._defaultTripCount = options.defaultTripCount ?? 8;
        this._maxTripCount = options.maxTripCount ?? 4096;
        this._branchModel = options.branchModel ?? "average";
        this._maxCallDepth = options.maxCallDepth ?? 12;
        this._maxNodes = options.maxNodes ?? 20000;
    }

    run(): CostModelResult {
        this._collectModuleScope();

        const entries: EntryCost[] = [];
        for (const statement of this._ast) {
            if (!(statement instanceof AST.Function)) {
                continue;
            }
            const stage = stageOf(statement);
            if (stage === null) {
                continue;
            }
            this._callStack = [statement.name];
            this._nodeCount = 0;
            this._budgetWarned = false;

            const root = this._makeNode("entry", statement.name, statement);
            root.endLine = statement.endLine;
            this._buildBlock(statement.body, root, 1);
            this._finish(root);

            entries.push({
                name: statement.name,
                stage,
                workgroupSize: stage === "compute" ? workgroupSizeOf(statement, this._moduleConsts) : null,
                root,
                costPerInvocation: root.totalCost,
                cost: root.total,
            });
        }

        return { entries, warnings: this._warnings, weights: this._weights };
    }

    // ---------------------------------------------------------------------
    // Module scope
    // ---------------------------------------------------------------------

    private _collectModuleScope(): void {
        for (const statement of this._ast) {
            if (statement instanceof AST.Function) {
                this._functions.set(statement.name, statement);
            } else if (statement instanceof AST.Var) {
                this._moduleVars.set(statement.name, classifyStorage(statement.storage, statement.type));
            } else if (statement instanceof AST.Const || statement instanceof AST.Override) {
                const v = this._constValue(statement.value);
                if (v !== null) {
                    this._moduleConsts.set(statement.name, v);
                }
            }
        }
    }

    // ---------------------------------------------------------------------
    // Tree construction
    // ---------------------------------------------------------------------

    private _makeNode(kind: CostNodeKind, name: string, source: AST.Node | null): CostNode {
        this._nodeCount++;
        return {
            kind,
            name,
            line: source?.line ?? 0,
            endLine: source?.line ?? 0,
            start: source?.start ?? -1,
            end: source?.end ?? -1,
            self: emptyCost(),
            total: emptyCost(),
            selfCost: 0,
            totalCost: 0,
            iterations: 1,
            iterationsKnown: true,
            estimated: false,
            children: [],
        };
    }

    private _overBudget(): boolean {
        if (this._nodeCount < this._maxNodes) {
            return false;
        }
        if (!this._budgetWarned) {
            this._budgetWarned = true;
            this._warn(`Cost tree truncated at ${this._maxNodes} nodes; deep call/loop nesting is not fully expanded.`);
        }
        return true;
    }

    /** Roll children up into `node`, computing totals and the weighted scalars. */
    private _finish(node: CostNode): CostNode {
        const total = emptyCost();
        addCost(total, node.self);
        for (const child of node.children) {
            addCost(total, child.total);
            if (child.estimated) {
                node.estimated = true;
            }
        }
        node.total = total;
        node.selfCost = weighCost(node.self, this._weights);
        node.totalCost = weighCost(total, this._weights);
        return node;
    }

    /**
     * Walk a statement block, appending child nodes to `parent`.
     * @param multiplier how many times this block runs per entry invocation
     */
    private _buildBlock(block: AST.Statement[] | null, parent: CostNode, multiplier: number): void {
        if (!block) {
            return;
        }
        for (const statement of block) {
            this._buildStatement(statement, parent, multiplier);
        }
    }

    private _buildStatement(statement: AST.Statement, parent: CostNode, multiplier: number): void {
        if (this._overBudget()) {
            return;
        }

        if (statement instanceof AST.For) {
            this._buildFor(statement, parent, multiplier);
        } else if (statement instanceof AST.While) {
            this._buildWhile(statement, parent, multiplier);
        } else if (statement instanceof AST.Loop) {
            this._buildLoop(statement, parent, multiplier);
        } else if (statement instanceof AST.If) {
            this._buildIf(statement, parent, multiplier);
        } else if (statement instanceof AST.Switch) {
            this._buildSwitch(statement, parent, multiplier);
        } else if (statement instanceof AST.Continuing) {
            // The continuing block runs with its loop; the enclosing Loop node
            // already applied the trip count to `multiplier`.
            this._buildBlock(statement.body, parent, multiplier);
        } else {
            this._buildLeaf(statement, parent, multiplier);
        }
    }

    // --- loops -----------------------------------------------------------

    private _buildFor(statement: AST.For, parent: CostNode, multiplier: number): void {
        const trip = this._tripCount(statement);
        const node = this._makeNode("loop", `for (${trip.count}${trip.known ? "" : "?"} iterations)`, statement);
        node.iterations = trip.count;
        node.iterationsKnown = trip.known;
        node.estimated = !trip.known;
        if (!trip.known) {
            this._warn(`Loop at line ${statement.line} has no derivable trip count; assuming ${this._defaultTripCount} iterations.`);
        }

        // The init runs once per entry to the loop; the condition is evaluated
        // once per iteration plus once to fail, and the increment once per
        // iteration. Charging both `trip` times is close enough.
        const inner = multiplier * trip.count;
        addCost(node.self, this._statementCost(statement.init, node, multiplier).cost, multiplier);
        addCost(node.self, this._exprCost(statement.condition, node, inner).cost, inner);
        addCost(node.self, this._statementCost(statement.increment, node, inner).cost, inner);

        this._buildBlock(statement.body, node, inner);
        this._attach(parent, node, statement);
    }

    private _buildWhile(statement: AST.While, parent: CostNode, multiplier: number): void {
        const count = this._defaultTripCount;
        const node = this._makeNode("loop", `while (${count}? iterations)`, statement);
        node.iterations = count;
        node.iterationsKnown = false;
        node.estimated = true;
        this._warn(`while loop at line ${statement.line} has no derivable trip count; assuming ${count} iterations.`);

        const inner = multiplier * count;
        addCost(node.self, this._exprCost(statement.condition, node, inner).cost, inner);
        this._buildBlock(statement.body, node, inner);
        this._attach(parent, node, statement);
    }

    private _buildLoop(statement: AST.Loop, parent: CostNode, multiplier: number): void {
        const count = this._defaultTripCount;
        const node = this._makeNode("loop", `loop (${count}? iterations)`, statement);
        node.iterations = count;
        node.iterationsKnown = false;
        node.estimated = true;
        this._warn(`loop at line ${statement.line} has no derivable trip count; assuming ${count} iterations.`);

        const inner = multiplier * count;
        this._buildBlock(statement.body, node, inner);
        if (statement.continuing) {
            this._buildBlock(statement.continuing.body, node, inner);
        }
        this._attach(parent, node, statement);
    }

    // --- control flow ----------------------------------------------------

    private _buildIf(statement: AST.If, parent: CostNode, multiplier: number): void {
        // Count the arms so "average" can split evenly across all of them,
        // including the implicit empty else when there isn't one.
        const armCount = 1 + (statement.elseif?.length ?? 0) + 1;
        const share = this._branchModel === "average" ? 1 / armCount : 1;

        // The condition itself is always evaluated, so it belongs to the parent
        // rather than to any one arm.
        addCost(parent.self, this._exprCost(statement.condition, parent, multiplier).cost, multiplier);

        this._buildArm(statement, "if", statement.body, parent, multiplier * share, share);

        for (const elseif of statement.elseif ?? []) {
            addCost(parent.self, this._exprCost(elseif.condition, parent, multiplier).cost, multiplier);
            this._buildArm(elseif, "else if", elseif.body, parent, multiplier * share, share);
        }

        if (statement.else) {
            this._buildArm(statement, "else", statement.else, parent, multiplier * share, share);
        }
    }

    private _buildArm(
        source: AST.Node,
        label: string,
        body: AST.Statement[] | null,
        parent: CostNode,
        multiplier: number,
        share: number,
    ): void {
        if (!body || body.length === 0) {
            return;
        }
        const node = this._makeNode("branch", share === 1 ? label : `${label} (${(share * 100).toFixed(0)}%)`, source);
        // Span the arm's body rather than the whole if/else, so `if` and `else`
        // frames highlight different source.
        const first = body[0];
        const last = body[body.length - 1];
        node.line = first.line;
        node.endLine = last.line;
        if (first.hasSpan && last.hasSpan) {
            node.start = first.start;
            node.end = last.end;
        }
        node.iterations = share;
        node.iterationsKnown = false;
        node.estimated = true;
        this._buildBlock(body, node, multiplier);
        this._attach(parent, node, null);
    }

    private _buildSwitch(statement: AST.Switch, parent: CostNode, multiplier: number): void {
        const node = this._makeNode("switch", "switch", statement);
        addCost(node.self, this._exprCost(statement.condition, node, multiplier).cost, multiplier);

        const cases = statement.cases ?? [];
        const share = this._branchModel === "average" && cases.length > 0 ? 1 / cases.length : 1;
        node.estimated = share !== 1;

        for (const c of cases) {
            const isDefault = c instanceof AST.Default;
            const body = (c as unknown as { body: AST.Statement[] | null }).body;
            if (!body || body.length === 0) {
                continue;
            }
            const caseNode = this._makeNode("case", isDefault ? "default" : "case", c);
            caseNode.iterations = share;
            caseNode.iterationsKnown = share === 1;
            caseNode.estimated = share !== 1;
            this._buildBlock(body, caseNode, multiplier * share);
            this._attach(node, caseNode, c);
        }

        this._attach(parent, node, statement);
    }

    // --- leaves ----------------------------------------------------------

    private _buildLeaf(statement: AST.Statement, parent: CostNode, multiplier: number): void {
        const node = this._makeNode("statement", statementLabel(statement), statement);
        const result = this._statementCost(statement, node, multiplier);
        addCost(node.self, result.cost, multiplier);

        // Calls found in this statement's expressions become child frames, so
        // the flame graph shows the callee under the calling line.
        for (const call of result.calls ?? []) {
            this._buildCall(call, node, multiplier);
        }

        // A statement with no cost and no calls (a `break`, a plain declaration
        // of a literal) is noise in a flame graph.
        this._finish(node);
        if (node.totalCost <= 0 && node.children.length === 0) {
            this._nodeCount--;
            return;
        }
        parent.children.push(node);
    }

    private _buildCall(call: AST.CallExpr, parent: CostNode, multiplier: number): void {
        if (this._overBudget()) {
            return;
        }
        const fn = this._functions.get(call.name);
        if (!fn) {
            return;
        }

        if (this._callStack.includes(call.name)) {
            // WGSL forbids recursion, but a malformed or unresolved shader can
            // still produce a cycle; stop rather than recursing forever.
            const node = this._makeNode("recursive", `${call.name}() [recursive]`, call);
            this._attach(parent, node, call);
            this._warn(`Call cycle through ${call.name}() not expanded.`);
            return;
        }
        if (this._callStack.length >= this._maxCallDepth) {
            const node = this._makeNode("recursive", `${call.name}() [depth limit]`, call);
            this._attach(parent, node, call);
            this._warn(`Call depth limit (${this._maxCallDepth}) reached at ${call.name}(); deeper calls are not expanded.`);
            return;
        }

        const node = this._makeNode("function", `${call.name}()`, fn);
        node.endLine = fn.endLine;
        this._callStack.push(call.name);
        this._buildBlock(fn.body, node, multiplier);
        this._callStack.pop();
        this._attach(parent, node, fn);
    }

    private _attach(parent: CostNode, node: CostNode, source: AST.Node | null): void {
        this._finish(node);
        // A container that costs nothing and expanded to nothing (an `if` whose
        // only statement is a `break`) is pure noise in a flame graph.
        if (node.totalCost <= 0 && node.children.length === 0 && node.kind !== "recursive") {
            this._nodeCount--;
            return;
        }
        if (node.endLine < node.line) {
            node.endLine = node.line;
        }
        // Widen the range to cover the children, so clicking a frame highlights
        // the whole construct even for nodes the parser only gave a start line.
        for (const child of node.children) {
            if (child.endLine > node.endLine) {
                node.endLine = child.endLine;
            }
        }
        if (source && source.hasSpan) {
            node.start = source.start;
            node.end = source.end;
        }
        parent.children.push(node);
    }

    // ---------------------------------------------------------------------
    // Costing
    // ---------------------------------------------------------------------

    /** Cost of a non-control-flow statement, plus the calls it contains. */
    private _statementCost(statement: AST.Statement | null, owner: CostNode, multiplier: number): ExprResult {
        const cost = emptyCost();
        let calls: AST.CallExpr[] | null = null;

        const merge = (r: ExprResult) => {
            addCost(cost, r.cost);
            if (r.calls) {
                calls = calls ? calls.concat(r.calls) : r.calls;
            }
        };

        if (statement === null) {
            return { cost, calls };
        }

        if (statement instanceof AST.Assign) {
            merge(this._exprCost(statement.value, owner, multiplier));
            merge(this._lvalueCost(statement.variable, owner, multiplier));
            // Compound assignment (`+=`, `*=`) does the arithmetic too.
            if (statement.operator && statement.operator !== "=") {
                addCost(cost, OPERATOR_COST.get(statement.operator[0]) ?? DEFAULT_OPERATOR_COST);
            }
        } else if (statement instanceof AST.Var || statement instanceof AST.Let || statement instanceof AST.Const) {
            merge(this._exprCost(statement.value, owner, multiplier));
        } else if (statement instanceof AST.Increment) {
            merge(this._lvalueCost(statement.variable, owner, multiplier));
            addCost(cost, DEFAULT_OPERATOR_COST);
        } else if (statement instanceof AST.Return) {
            merge(this._exprCost(statement.value, owner, multiplier));
        } else if (statement instanceof AST.Call) {
            // A bare `foo(...)` statement.
            for (const arg of statement.args ?? []) {
                merge(this._exprCost(arg, owner, multiplier));
            }
            addCost(cost, this._builtinCost(statement.name));
            const fn = this._functions.get(statement.name);
            if (fn) {
                const synthetic = new AST.CallExpr(statement.name, statement.args ?? []);
                synthetic.line = statement.line;
                synthetic.start = statement.start;
                synthetic.end = statement.end;
                calls = calls ? calls.concat([synthetic]) : [synthetic];
            }
        } else if (statement instanceof AST.Break) {
            merge(this._exprCost(statement.condition, owner, multiplier));
        } else if (statement instanceof AST.Discard) {
            addCost(cost, DEFAULT_OPERATOR_COST);
        }

        return { cost, calls };
    }

    /** Cost of writing to an lvalue: the store itself plus any index math. */
    private _lvalueCost(expr: AST.Expression | null, owner: CostNode, multiplier: number): ExprResult {
        const cost = emptyCost();
        let calls: AST.CallExpr[] | null = null;
        if (!expr) {
            return { cost, calls };
        }
        const root = rootName(expr);
        if (root !== null) {
            addCost(cost, this._accessCost(root));
        }
        // The index expressions still have to be evaluated.
        const postfix = this._postfixCost(expr, owner, multiplier);
        addCost(cost, postfix.cost);
        calls = postfix.calls;
        return { cost, calls };
    }

    /** Recursively cost an expression tree. */
    private _exprCost(expr: AST.Expression | null, owner: CostNode, multiplier: number): ExprResult {
        const cost = emptyCost();
        let calls: AST.CallExpr[] | null = null;

        const merge = (r: ExprResult) => {
            addCost(cost, r.cost);
            if (r.calls) {
                calls = calls ? calls.concat(r.calls) : r.calls;
            }
        };

        if (!expr) {
            return { cost, calls };
        }

        if (expr instanceof AST.BinaryOperator) {
            addCost(cost, OPERATOR_COST.get(expr.operator) ?? DEFAULT_OPERATOR_COST);
            merge(this._exprCost(expr.left, owner, multiplier));
            merge(this._exprCost(expr.right, owner, multiplier));
        } else if (expr instanceof AST.UnaryOperator) {
            addCost(cost, DEFAULT_OPERATOR_COST);
            merge(this._exprCost(expr.right, owner, multiplier));
        } else if (expr instanceof AST.CallExpr) {
            for (const arg of expr.args ?? []) {
                merge(this._exprCost(arg, owner, multiplier));
            }
            if (this._functions.has(expr.name)) {
                // Costed as a child frame, not inline.
                calls = calls ? calls.concat([expr]) : [expr];
            } else {
                addCost(cost, this._builtinCost(expr.name));
            }
        } else if (expr instanceof AST.CreateExpr) {
            // Constructors and casts are free; their arguments are not.
            for (const arg of expr.args ?? []) {
                merge(this._exprCost(arg, owner, multiplier));
            }
        } else if (expr instanceof AST.BitcastExpr) {
            merge(this._exprCost(expr.value, owner, multiplier));
        } else if (expr instanceof AST.VariableExpr) {
            addCost(cost, this._accessCost(expr.name));
        } else if (expr instanceof AST.ArrayIndex) {
            merge(this._exprCost(expr.index, owner, multiplier));
        }
        // LiteralExpr / ConstExpr / StringExpr cost nothing.

        merge(this._postfixCost(expr, owner, multiplier));
        return { cost, calls };
    }

    /** Cost the `.member` / `[index]` chain hanging off an expression. */
    private _postfixCost(expr: AST.Expression, owner: CostNode, multiplier: number): ExprResult {
        const cost = emptyCost();
        let calls: AST.CallExpr[] | null = null;
        let p = expr.postfix;
        while (p) {
            if (p instanceof AST.ArrayIndex) {
                const r = this._exprCost(p.index, owner, multiplier);
                addCost(cost, r.cost);
                if (r.calls) {
                    calls = calls ? calls.concat(r.calls) : r.calls;
                }
                // Address computation for the indexed access.
                addCost(cost, DEFAULT_OPERATOR_COST);
            }
            // Member access (`.xyz`, `.field`) is free — swizzles and struct
            // offsets are folded into the addressing.
            p = p.postfix;
        }
        return { cost, calls };
    }

    private _builtinCost(name: string): CostVec {
        if (TEXTURE_BUILTINS.has(name)) {
            return TEXTURE_SAMPLE_COST;
        }
        if (TEXTURE_QUERY_BUILTINS.has(name)) {
            return TEXTURE_QUERY_COST;
        }
        if (ATOMIC_BUILTINS.has(name)) {
            return ATOMIC_COST;
        }
        if (BARRIER_BUILTINS.has(name)) {
            return BARRIER_COST;
        }
        return BUILTIN_COST.get(name) ?? DEFAULT_BUILTIN_COST;
    }

    /** Cost of touching a name, based on where it lives. */
    private _accessCost(name: string): CostVec {
        const cls = this._moduleVars.get(name);
        if (cls === "buffer") {
            return BUFFER_ACCESS_COST;
        }
        if (cls === "workgroup") {
            return WORKGROUP_ACCESS_COST;
        }
        // Locals live in registers; textures and samplers cost nothing until
        // they're actually sampled.
        return emptyCost();
    }

    // ---------------------------------------------------------------------
    // Loop trip counts
    // ---------------------------------------------------------------------

    /**
     * Derive the iteration count of a `for` loop from its init/condition/
     * increment, in the common `for (var i = A; i < B; i += S)` shape. Anything
     * else falls back to the configured assumption.
     */
    private _tripCount(statement: AST.For): { count: number; known: boolean } {
        const fallback = { count: this._defaultTripCount, known: false };

        const init = statement.init;
        let name: string | null = null;
        let start: number | null = null;
        if (init instanceof AST.Var || init instanceof AST.Let || init instanceof AST.Const) {
            name = init.name;
            start = this._constValue(init.value);
        } else if (init instanceof AST.Assign) {
            name = rootName(init.variable);
            start = this._constValue(init.value);
        }
        if (name === null || start === null) {
            return fallback;
        }

        const cond = statement.condition;
        if (!(cond instanceof AST.BinaryOperator)) {
            return fallback;
        }
        // Accept the counter on either side, flipping the comparison if needed.
        let op = cond.operator;
        let limitExpr: AST.Expression | null = null;
        if (cond.left instanceof AST.VariableExpr && cond.left.name === name && !cond.left.postfix) {
            limitExpr = cond.right;
        } else if (cond.right instanceof AST.VariableExpr && cond.right.name === name && !cond.right.postfix) {
            limitExpr = cond.left;
            op = flipComparison(op);
        } else {
            return fallback;
        }
        const limit = this._constValue(limitExpr);
        if (limit === null) {
            return fallback;
        }

        const step = this._stepOf(statement.increment, name);
        if (step === null || step === 0) {
            return fallback;
        }

        let span: number;
        if (op === "<" || op === "<=") {
            if (step < 0) {
                return fallback;
            }
            span = limit - start + (op === "<=" ? 1 : 0);
        } else if (op === ">" || op === ">=") {
            if (step > 0) {
                return fallback;
            }
            span = start - limit + (op === ">=" ? 1 : 0);
        } else if (op === "!=") {
            span = Math.abs(limit - start);
        } else {
            return fallback;
        }

        if (span <= 0) {
            return { count: 0, known: true };
        }
        const count = Math.ceil(span / Math.abs(step));
        if (count > this._maxTripCount) {
            this._warn(`Loop at line ${statement.line} runs ${count} times; clamped to ${this._maxTripCount} in the cost model.`);
            return { count: this._maxTripCount, known: false };
        }
        return { count, known: true };
    }

    /** The per-iteration delta applied to `name` by a loop increment. */
    private _stepOf(increment: AST.Statement | null, name: string): number | null {
        if (increment instanceof AST.Increment) {
            if (rootName(increment.variable) !== name) {
                return null;
            }
            return String(increment.operator).startsWith("--") ? -1 : 1;
        }
        if (increment instanceof AST.Assign) {
            if (rootName(increment.variable) !== name) {
                return null;
            }
            const op = String(increment.operator);
            if (op === "+=" || op === "-=") {
                const delta = this._constValue(increment.value);
                if (delta === null) {
                    return null;
                }
                return op === "+=" ? delta : -delta;
            }
            if (op === "=") {
                // The long form: `i = i + 1`, `i = 1 + i`, `i = i - 1`.
                return this._selfRelativeStep(increment.value, name);
            }
            return null;
        }
        return null;
    }

    /** For `i + k` / `k + i` / `i - k`, the constant delta applied to `i`. */
    private _selfRelativeStep(expr: AST.Expression | null, name: string): number | null {
        if (!(expr instanceof AST.BinaryOperator)) {
            return null;
        }
        const leftIsCounter = expr.left instanceof AST.VariableExpr
            && expr.left.name === name && !expr.left.postfix;
        const rightIsCounter = expr.right instanceof AST.VariableExpr
            && expr.right.name === name && !expr.right.postfix;

        if (expr.operator === "+") {
            if (leftIsCounter) {
                return this._constValue(expr.right);
            }
            if (rightIsCounter) {
                return this._constValue(expr.left);
            }
        } else if (expr.operator === "-" && leftIsCounter) {
            const delta = this._constValue(expr.right);
            return delta === null ? null : -delta;
        }
        return null;
    }

    /**
     * Evaluate an expression to a number, if it's built only from literals and
     * module-scope constants. Deliberately small: this exists to resolve loop
     * bounds like `COUNT` or `N * 2`, not to be a general const evaluator.
     */
    private _constValue(expr: AST.Expression | null): number | null {
        if (!expr) {
            return null;
        }
        if (expr instanceof AST.LiteralExpr) {
            return literalValue(expr);
        }
        if (expr instanceof AST.ConstExpr) {
            return this._constValue(expr.initializer);
        }
        if (expr instanceof AST.VariableExpr) {
            if (expr.postfix) {
                return null;
            }
            return this._moduleConsts.get(expr.name) ?? null;
        }
        if (expr instanceof AST.CreateExpr) {
            // `i32(4)` / `u32(N)` — a cast around a constant.
            const args = expr.args ?? [];
            return args.length === 1 ? this._constValue(args[0]) : null;
        }
        if (expr instanceof AST.UnaryOperator) {
            const v = this._constValue(expr.right);
            if (v === null) {
                return null;
            }
            return expr.operator === "-" ? -v : expr.operator === "+" ? v : null;
        }
        if (expr instanceof AST.BinaryOperator) {
            const a = this._constValue(expr.left);
            const b = this._constValue(expr.right);
            if (a === null || b === null) {
                return null;
            }
            switch (expr.operator) {
                case "+": return a + b;
                case "-": return a - b;
                case "*": return a * b;
                case "/": return b === 0 ? null : a / b;
                case "%": return b === 0 ? null : a % b;
                case "<<": return a << b;
                case ">>": return a >> b;
                default: return null;
            }
        }
        return null;
    }

    private _warn(message: string): void {
        if (this._warned.has(message)) {
            return;
        }
        this._warned.add(message);
        this._warnings.push(message);
    }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function stageOf(fn: AST.Function): "vertex" | "fragment" | "compute" | null {
    for (const attr of fn.attributes ?? []) {
        if (attr.name === "vertex" || attr.name === "fragment" || attr.name === "compute") {
            return attr.name;
        }
    }
    return null;
}

function workgroupSizeOf(fn: AST.Function, consts: Map<string, number>): [number, number, number] {
    for (const attr of fn.attributes ?? []) {
        if (attr.name !== "workgroup_size") {
            continue;
        }
        const value = attr.value;
        const parts = Array.isArray(value) ? value : [value];
        const dims: number[] = [1, 1, 1];
        for (let i = 0; i < 3 && i < parts.length; ++i) {
            const raw = parts[i];
            const n = Number(raw);
            dims[i] = Number.isFinite(n) ? n : (consts.get(String(raw)) ?? 1);
        }
        return [dims[0], dims[1], dims[2]];
    }
    return [1, 1, 1];
}

function classifyStorage(storage: string | null, type: AST.Type | null): VarClass {
    if (storage === "storage" || storage === "uniform") {
        return "buffer";
    }
    if (storage === "workgroup") {
        return "workgroup";
    }
    // No address space means a resource handle (texture/sampler) at module
    // scope; those cost nothing until sampled.
    if (storage === null && type !== null) {
        return "handle";
    }
    return "private";
}

/** The base variable name an lvalue or access chain starts from. */
function rootName(expr: AST.Expression | null): string | null {
    if (expr instanceof AST.VariableExpr) {
        return expr.name;
    }
    if (expr instanceof AST.ArrayIndex) {
        return null;
    }
    return null;
}

function literalValue(expr: AST.LiteralExpr): number | null {
    const data = expr.value as unknown as { data?: ArrayLike<number>; value?: number };
    if (data?.data && data.data.length > 0) {
        return Number(data.data[0]);
    }
    if (typeof data?.value === "number") {
        return data.value;
    }
    return null;
}

function flipComparison(op: string): string {
    switch (op) {
        case "<": return ">";
        case "<=": return ">=";
        case ">": return "<";
        case ">=": return "<=";
        default: return op;
    }
}

/** Short human label for a leaf statement, used as the flame frame's text. */
function statementLabel(statement: AST.Statement): string {
    if (statement instanceof AST.Assign) {
        const name = rootName(statement.variable);
        return name ? `${name} ${statement.operator}` : String(statement.operator);
    }
    if (statement instanceof AST.Var) {
        return `var ${statement.name}`;
    }
    if (statement instanceof AST.Let) {
        return `let ${statement.name}`;
    }
    if (statement instanceof AST.Const) {
        return `const ${statement.name}`;
    }
    if (statement instanceof AST.Increment) {
        const name = rootName(statement.variable);
        return name ? `${name}${statement.operator}` : String(statement.operator);
    }
    if (statement instanceof AST.Return) {
        return "return";
    }
    if (statement instanceof AST.Call) {
        return `${statement.name}()`;
    }
    if (statement instanceof AST.Discard) {
        return "discard";
    }
    if (statement instanceof AST.Break) {
        return "break";
    }
    if (statement instanceof AST.Continue) {
        return "continue";
    }
    return statement.astNodeType || "statement";
}

// -----------------------------------------------------------------------------
// Tree utilities, for consumers building UI on top of the model
// -----------------------------------------------------------------------------

/** Depth-first walk. Return false from `callback` to skip a node's children. */
export function walkCostTree(node: CostNode, callback: (node: CostNode, depth: number) => boolean | void, depth = 0): void {
    if (callback(node, depth) === false) {
        return;
    }
    for (const child of node.children) {
        walkCostTree(child, callback, depth + 1);
    }
}

/**
 * Flatten a tree into per-source-line self costs, for gutter heat marks in a
 * source view. Only `self` is attributed, so a line isn't credited with the
 * cost of everything it calls.
 */
export function costByLine(root: CostNode): Map<number, CostVec> {
    const lines = new Map<number, CostVec>();
    walkCostTree(root, (node) => {
        if (node.selfCost <= 0 || node.line <= 0) {
            return;
        }
        let entry = lines.get(node.line);
        if (!entry) {
            entry = emptyCost();
            lines.set(node.line, entry);
        }
        addCost(entry, node.self);
    });
    return lines;
}

/**
 * Merge sibling frames that refer to the same thing (e.g. the same function
 * called from several statements), producing the aggregated view a flame graph
 * usually wants. Children are merged recursively.
 */
export function mergeCostTree(node: CostNode, weights: CostVec = DefaultCostWeights): CostNode {
    const merged: CostNode = {
        ...node,
        self: { ...node.self },
        total: { ...node.total },
        children: [],
    };

    const groups = new Map<string, CostNode[]>();
    const order: string[] = [];
    for (const child of node.children) {
        const key = `${child.kind}:${child.name}:${child.line}`;
        let group = groups.get(key);
        if (!group) {
            group = [];
            groups.set(key, group);
            order.push(key);
        }
        group.push(child);
    }

    for (const key of order) {
        const group = groups.get(key)!;
        if (group.length === 1) {
            merged.children.push(mergeCostTree(group[0], weights));
            continue;
        }
        const combined: CostNode = {
            ...group[0],
            name: `${group[0].name} x${group.length}`,
            self: emptyCost(),
            total: emptyCost(),
            children: [],
        };
        for (const g of group) {
            addCost(combined.self, g.self);
            combined.children.push(...g.children);
            combined.estimated = combined.estimated || g.estimated;
            if (g.endLine > combined.endLine) {
                combined.endLine = g.endLine;
            }
        }
        // Merging changes the child set, so the span no longer describes a
        // single contiguous region of source.
        combined.start = -1;
        combined.end = -1;
        const remerged = mergeCostTree(combined, weights);
        const total = emptyCost();
        addCost(total, remerged.self);
        for (const child of remerged.children) {
            addCost(total, child.total);
        }
        remerged.total = total;
        remerged.selfCost = weighCost(remerged.self, weights);
        remerged.totalCost = weighCost(total, weights);
        merged.children.push(remerged);
    }

    merged.children.sort((a, b) => b.totalCost - a.totalCost);
    return merged;
}

/**
 * Rescale a tree so the root's total equals `targetTotal`, and return a copy.
 * Used to express a modeled tree in measured units: pass a pass's real GPU
 * milliseconds and the whole tree reads in ms instead of abstract ops.
 */
export function rescaleCostTree(root: CostNode, targetTotal: number): CostNode {
    const factor = root.totalCost > 0 ? targetTotal / root.totalCost : 0;
    const rescale = (node: CostNode): CostNode => ({
        ...node,
        self: scaleCost(node.self, factor),
        total: scaleCost(node.total, factor),
        selfCost: node.selfCost * factor,
        totalCost: node.totalCost * factor,
        children: node.children.map(rescale),
    });
    return rescale(root);
}
