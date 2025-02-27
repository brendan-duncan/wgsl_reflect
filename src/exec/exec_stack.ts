import { StackFrame } from "./stack_frame.js";

export class ExecStack {
    states: StackFrame[] = [];

    get isEmpty(): boolean { return this.states.length == 0; }

    get last(): StackFrame | null { return this.states[this.states.length - 1] ?? null; }

    pop(): void {
        this.states.pop();
    }
}
