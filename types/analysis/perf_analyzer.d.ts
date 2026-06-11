export type PerfSeverity = "info" | "low" | "medium" | "high";
export type PerfConfidence = "high" | "medium" | "low";
export declare enum PerfRuleId {
    ExpensiveBuiltinInLoop = 1,
    CostlyArithmeticInLoop = 2,
    LoopInvariantExpression = 3,
    AtomicInLoop = 4,
    BarrierInLoop = 5
}
export declare const PerfRuleNames: Record<PerfRuleId, string>;
export interface PerfFinding {
    id: PerfRuleId;
    rule: string;
    message: string;
    line: number;
    function: string;
    stage: string | null;
    loopDepth: number;
    severity: PerfSeverity;
    confidence: PerfConfidence;
    score: number;
}
export interface PerfAnalysisResult {
    findings: PerfFinding[];
}
export interface PerfFilter {
    ids?: PerfRuleId[];
    severities?: PerfSeverity[];
    confidences?: PerfConfidence[];
}
export interface PerfAnalysisOptions {
    include?: PerfFilter;
    exclude?: PerfFilter;
}
export declare function analyzePerformance(code: string, options?: PerfAnalysisOptions): PerfAnalysisResult;
