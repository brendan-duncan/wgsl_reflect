import { ExecContext } from "./exec_context.js";
import { ExecInterface } from "./exec_interface.js";
import { TypeInfo } from "../reflect/info.js";
import { IExpression } from "../ast/iexpression.js";
export declare class Data {
    typeInfo: TypeInfo;
    constructor(typeInfo: TypeInfo);
    setDataValue(exec: ExecInterface, value: Data, postfix: IExpression | null, context: ExecContext): void;
    getDataValue(exec: ExecInterface, postfix: IExpression | null, context: ExecContext): Data | null;
    toString(): string;
}
export declare class VoidData extends Data {
    constructor();
    static void: VoidData;
    toString(): string;
}
export declare class ScalarData extends Data {
    value: number;
    constructor(value: number, typeInfo: TypeInfo);
    setDataValue(exec: ExecInterface, value: Data, postfix: IExpression | null, context: ExecContext): void;
    getDataValue(exec: ExecInterface, postfix: IExpression | null, context: ExecContext): Data | null;
    toString(): string;
}
export declare class VectorData extends Data {
    value: number[];
    constructor(value: number[] | Float32Array | Uint32Array | Int32Array, typeInfo: TypeInfo);
    setDataValue(exec: ExecInterface, value: Data, postfix: IExpression | null, context: ExecContext): void;
    getDataValue(exec: ExecInterface, postfix: IExpression | null, context: ExecContext): Data | null;
    toString(): string;
}
export declare class MatrixData extends Data {
    value: number[];
    constructor(value: number[], typeInfo: TypeInfo);
    setDataValue(exec: ExecInterface, value: Data, postfix: IExpression | null, context: ExecContext): void;
    getDataValue(exec: ExecInterface, postfix: IExpression | null, context: ExecContext): Data | null;
    toString(): string;
}
export declare class TypedData extends Data {
    buffer: ArrayBuffer;
    offset: number;
    textureSize: number[];
    constructor(data: ArrayBuffer | Float32Array | Uint32Array | Int32Array | Uint8Array | Int8Array, typeInfo: TypeInfo, offset?: number, textureSize?: number[]);
    setDataValue(exec: ExecInterface, value: Data, postfix: IExpression | null, context: ExecContext): void;
    setData(exec: ExecInterface, value: Data, typeInfo: TypeInfo, offset: number, context: ExecContext): void;
    getDataValue(exec: ExecInterface, postfix: IExpression | null, context: ExecContext): Data | null;
    toString(): string;
}
