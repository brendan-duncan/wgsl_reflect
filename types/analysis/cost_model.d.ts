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
export interface CostVec {
    alu: number;
    sfu: number;
    texture: number;
    memory: number;
}
export type CostDimension = keyof CostVec;
export declare const CostDimensions: CostDimension[];
/**
 * Relative cost of one op in each dimension, in "alu-equivalents". Defaults are
 * a rough consensus across desktop and mobile GPUs: an SFU op is a handful of
 * ALU slots, a buffer access costs bandwidth and latency, and a filtered texture
 * sample is the most expensive thing a fragment shader typically does.
 */
export declare const DefaultCostWeights: CostVec;
export declare function emptyCost(): CostVec;
export declare function addCost(dst: CostVec, src: CostVec, scale?: number): CostVec;
export declare function scaleCost(c: CostVec, scale: number): CostVec;
export declare function weighCost(c: CostVec, w?: CostVec): number;
/** The dimension contributing the most weighted cost, for coloring/summaries. */
export declare function dominantDimension(c: CostVec, w?: CostVec): CostDimension;
export type CostNodeKind = "entry" | "function" | "loop" | "branch" | "switch" | "case" | "statement" | "recursive";
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
/**
 * Build per-entry-point cost trees for a WGSL shader.
 * @param codeOrAst shader source, or an already-parsed AST
 */
export declare function buildShaderCostTree(codeOrAst: string | AST.Statement[], options?: CostModelOptions): CostModelResult;
/** Depth-first walk. Return false from `callback` to skip a node's children. */
export declare function walkCostTree(node: CostNode, callback: (node: CostNode, depth: number) => boolean | void, depth?: number): void;
/**
 * Flatten a tree into per-source-line self costs, for gutter heat marks in a
 * source view. Only `self` is attributed, so a line isn't credited with the
 * cost of everything it calls.
 */
export declare function costByLine(root: CostNode): Map<number, CostVec>;
/**
 * Merge sibling frames that refer to the same thing (e.g. the same function
 * called from several statements), producing the aggregated view a flame graph
 * usually wants. Children are merged recursively.
 */
export declare function mergeCostTree(node: CostNode, weights?: CostVec): CostNode;
/**
 * Rescale a tree so the root's total equals `targetTotal`, and return a copy.
 * Used to express a modeled tree in measured units: pass a pass's real GPU
 * milliseconds and the whole tree reads in ms instead of abstract ops.
 */
export declare function rescaleCostTree(root: CostNode, targetTotal: number): CostNode;
