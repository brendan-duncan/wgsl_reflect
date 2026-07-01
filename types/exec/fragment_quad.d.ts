import { CallExpr } from "../wgsl_ast.js";
import { WgslDebug } from "../wgsl_debug.js";
import { WgslExec } from "../wgsl_exec.js";
import { ExecContext } from "./exec_context.js";
import { ExecStack } from "./exec_stack.js";
import { StackFrame } from "./stack_frame.js";
export type QuadInputs = Record<string, number | number[] | Float32Array | Uint32Array | Int32Array>;
export interface FragmentQuadResult {
    outputs: (number | number[] | Record<string, unknown> | null)[];
    discarded: boolean[];
    errors: string[];
}
declare enum LaneState {
    Running = 0,
    AtRendezvous = 1,
    Done = 2
}
declare class Lane {
    readonly index: number;
    readonly stack: ExecStack;
    state: LaneState;
    node: CallExpr | null;
    frame: StackFrame | null;
    output: (number | number[] | Record<string, unknown> | null);
    discarded: boolean;
    constructor(index: number, stack: ExecStack);
}
export declare class QuadScheduler {
    private _debug;
    private _exec;
    private _lanes;
    readonly errors: string[];
    stepBudget: number;
    targetLane: number;
    readonly breakpoints: Set<number>;
    constructor(debug: WgslDebug, exec: WgslExec, lanes: Lane[]);
    run(): void;
    private _captureDone;
    private _loop;
    private _rendezvous;
    private _rendezvousDerivative;
    private _rendezvousSample;
    private _release;
    private get _target();
    get targetLine(): number;
    get targetContext(): ExecContext | null;
    get isDone(): boolean;
    get targetOutput(): number | number[] | Record<string, unknown> | null;
    get targetDiscarded(): boolean;
    private _depth;
    stepTarget(stepInto?: boolean): boolean;
    stepOutTarget(): boolean;
    runTarget(): void;
    private _stepTargetOnce;
    private _serviceRendezvous;
}
export declare function debugFragmentQuad(code: string, entry: string, quadInputs: QuadInputs[], bindGroups: Record<string, Record<string, unknown>>, config?: Record<string, unknown>): FragmentQuadResult;
export declare function createFragmentQuadDebugger(code: string, entry: string, quadInputs: QuadInputs[], bindGroups: Record<string, Record<string, unknown>>, targetLane?: number, config?: Record<string, unknown>): {
    scheduler: QuadScheduler | null;
    errors: string[];
};
export {};
