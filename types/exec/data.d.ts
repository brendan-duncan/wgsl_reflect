import { TypeInfo } from "../reflect/info.js";
import { ExecContext } from "./exec_context.js";
import { ExecInterface } from "./exec_interface.js";
import { BaseNode } from "../ast/base_node.js";
export declare class Data {
    static _id: number;
    typeInfo: TypeInfo;
    parent: Data | null;
    id: number;
    constructor(typeInfo: TypeInfo, parent: Data | null);
    clone(): Data;
    setDataValue(exec: ExecInterface, value: Data, postfix: BaseNode | null, context: ExecContext): void;
    getSubData(exec: ExecInterface, postfix: BaseNode | null, context: ExecContext): Data | null;
    toString(): string;
}
