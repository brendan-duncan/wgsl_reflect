import * as AST from "../wgsl_ast.js";
export declare class TypeInfo {
    name: string;
    attributes: AST.Attribute[] | null;
    size: number;
    constructor(name: string, attributes: AST.Attribute[] | null);
    get isArray(): boolean;
    get isStruct(): boolean;
    get isTemplate(): boolean;
}
export declare class MemberInfo {
    name: string;
    type: TypeInfo;
    attributes: AST.Attribute[] | null;
    offset: number;
    size: number;
    constructor(name: string, type: TypeInfo, attributes: AST.Attribute[] | null);
    get isArray(): boolean;
    get isStruct(): boolean;
    get isTemplate(): boolean;
    get align(): number;
    get members(): MemberInfo[] | null;
    get format(): TypeInfo | null;
    get count(): number;
    get stride(): number;
}
export declare class StructInfo extends TypeInfo {
    members: MemberInfo[];
    align: number;
    startLine: number;
    endLine: number;
    inUse: boolean;
    constructor(name: string, attributes: AST.Attribute[] | null);
    get isStruct(): boolean;
}
export declare class ArrayInfo extends TypeInfo {
    format: TypeInfo;
    count: number;
    stride: number;
    constructor(name: string, attributes: AST.Attribute[] | null);
    get isArray(): boolean;
}
export declare class TemplateInfo extends TypeInfo {
    format: TypeInfo | null;
    access: string;
    constructor(name: string, format: TypeInfo | null, attributes: AST.Attribute[] | null, access: string);
    get isTemplate(): boolean;
}
export declare enum ResourceType {
    Uniform = 0,
    Storage = 1,
    Texture = 2,
    Sampler = 3,
    StorageTexture = 4
}
export declare class VariableInfo {
    attributes: AST.Attribute[] | null;
    name: string;
    type: TypeInfo;
    group: number;
    binding: number;
    resourceType: ResourceType;
    access: string;
    constructor(name: string, type: TypeInfo, group: number, binding: number, attributes: AST.Attribute[] | null, resourceType: ResourceType, access: string);
    get isArray(): boolean;
    get isStruct(): boolean;
    get isTemplate(): boolean;
    get size(): number;
    get align(): number;
    get members(): MemberInfo[] | null;
    get format(): TypeInfo | null;
    get count(): number;
    get stride(): number;
}
export declare class AliasInfo {
    name: string;
    type: TypeInfo;
    constructor(name: string, type: TypeInfo);
}
export declare class InputInfo {
    name: string;
    type: TypeInfo | null;
    locationType: string;
    location: number | string;
    interpolation: string | null;
    constructor(name: string, type: TypeInfo | null, locationType: string, location: number | string);
}
export declare class OutputInfo {
    name: string;
    type: TypeInfo | null;
    locationType: string;
    location: number | string;
    constructor(name: string, type: TypeInfo | null, locationType: string, location: number | string);
}
export declare class OverrideInfo {
    name: string;
    type: TypeInfo | null;
    attributes: AST.Attribute[] | null;
    id: number;
    constructor(name: string, type: TypeInfo | null, attributes: AST.Attribute[] | null, id: number);
}
export declare class ArgumentInfo {
    name: string;
    type: TypeInfo;
    attributes: AST.Attribute[] | null;
    constructor(name: string, type: TypeInfo, attributes: AST.Attribute[] | null);
}
export declare class FunctionInfo {
    name: string;
    stage: string | null;
    inputs: InputInfo[];
    outputs: OutputInfo[];
    arguments: ArgumentInfo[];
    returnType: TypeInfo | null;
    resources: VariableInfo[];
    overrides: OverrideInfo[];
    attributes: AST.Attribute[] | null;
    startLine: number;
    endLine: number;
    inUse: boolean;
    calls: Set<FunctionInfo>;
    constructor(name: string, stage: string | null, attributes: AST.Attribute[] | null);
}
export declare class EntryFunctions {
    vertex: FunctionInfo[];
    fragment: FunctionInfo[];
    compute: FunctionInfo[];
}
