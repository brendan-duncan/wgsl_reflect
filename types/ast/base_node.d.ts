export declare class BaseNode {
    static _id: number;
    id: number;
    line: number;
    constructor();
    get isAstNode(): boolean;
    get astNodeType(): string;
    search(callback: (node: BaseNode) => void): void;
    searchBlock(block: BaseNode[] | null, callback: (node: BaseNode) => void): void;
}
export declare class _BlockStart extends BaseNode {
    static instance: _BlockStart;
}
export declare class _BlockEnd extends BaseNode {
    static instance: _BlockEnd;
}
