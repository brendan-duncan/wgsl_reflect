import { TypedData } from "../wgsl_ast.js";
import { SubgroupMatrixInfo } from "../reflect/info.js";
export declare function toSubgroupMatrixElement(type: string, v: number): number;
export declare function loadSubgroupMatrix(data: TypedData, info: SubgroupMatrixInfo, offset: number, columnMajor: boolean, stride: number): number[];
export declare function storeSubgroupMatrix(data: TypedData, info: SubgroupMatrixInfo, values: number[], offset: number, columnMajor: boolean, stride: number): void;
export declare function multiplySubgroupMatrices(left: number[], leftInfo: SubgroupMatrixInfo, right: number[], rightInfo: SubgroupMatrixInfo, resultInfo: SubgroupMatrixInfo, accumulator: number[] | null): number[];
