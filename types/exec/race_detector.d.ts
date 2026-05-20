import * as AST from "../wgsl_ast.js";
import { TypedData, Data, Expression } from "../wgsl_ast.js";
import { TypeInfo } from "../wgsl_reflect.js";
import { WgslDebug } from "../wgsl_debug.js";
import { ExecContext } from "./exec_context.js";
import { ExecInterface } from "./exec_interface.js";
import { ExecStack } from "./exec_stack.js";
type AccessKind = "read" | "write";
interface MemoryAccess {
    bufferId: string;
    offset: number;
    size: number;
    kind: AccessKind;
    atomic: boolean;
    invocation: number;
    line: number;
}
export interface RaceReport {
    bufferId: string;
    byte: number;
    a: MemoryAccess;
    b: MemoryAccess;
    message: string;
}
export declare class MemoryTracker {
    private _phase;
    currentInvocation: number;
    currentLine: number;
    readonly races: RaceReport[];
    record(bufferId: string, offset: number, size: number, kind: AccessKind, atomic: boolean): void;
    endPhase(): void;
    private _checkPhase;
}
export declare class TrackedTypedData extends TypedData {
    private _tracker;
    private _bufferId;
    constructor(data: ArrayBuffer, typeInfo: TypeInfo, tracker: MemoryTracker, bufferId: string);
    setDataValue(exec: ExecInterface, value: Data, postfix: Expression | null, context: ExecContext): void;
    getSubData(exec: ExecInterface, postfix: Expression | null, context: ExecContext): Data | null;
    private _range;
    private _evalIndex;
}
declare enum InvState {
    Running = 0,
    AtBarrier = 1,
    Done = 2
}
declare class Invocation {
    readonly index: number;
    readonly stack: ExecStack;
    state: InvState;
    barrierNode: AST.Call | null;
    constructor(index: number, stack: ExecStack);
}
export declare class WorkgroupScheduler {
    private _debug;
    private _tracker;
    private _invocations;
    readonly errors: string[];
    stepBudget: number;
    constructor(debug: WgslDebug, tracker: MemoryTracker, invocations: Invocation[]);
    run(): void;
    private _syncBarrier;
    private _peek;
    private _asBarrier;
}
export interface RaceDetectionResult {
    races: RaceReport[];
    errors: string[];
}
export declare function detectRaces(code: string, kernel: string, dispatchCount: number[], bindGroups: Record<string, Record<string, any>>, config?: Record<string, unknown>): RaceDetectionResult;
export {};
