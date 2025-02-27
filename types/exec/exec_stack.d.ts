import { StackFrame } from "./stack_frame.js";
export declare class ExecStack {
    states: StackFrame[];
    get isEmpty(): boolean;
    get last(): StackFrame | null;
    pop(): void;
}
