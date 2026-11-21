import { Data } from "../wgsl_ast.js";
import { TypeInfo } from "../reflect/info.js";
export declare function makeResourceValue(typeInfo: TypeInfo | null, entry: any): Data | null;
export declare function makeBufferValue(typeInfo: TypeInfo, entry: any): Data;
export declare function resourceMatchesType(entry: any, typeInfo: TypeInfo): boolean;
export declare function makeDefaultResource(typeInfo: TypeInfo): Data;
