import * as AST from "./wgsl_ast.js";
export declare class TypeInfo {
    name: string;
    attributes: Array<AST.Attribute> | null;
    size: number;
    constructor(name: string, attributes: Array<AST.Attribute> | null);
    get isArray(): boolean;
    get isStruct(): boolean;
    get isTemplate(): boolean;
}
export declare class MemberInfo {
    name: string;
    type: TypeInfo;
    attributes: Array<AST.Attribute> | null;
    offset: number;
    size: number;
    constructor(name: string, type: TypeInfo, attributes: Array<AST.Attribute> | null);
    get isArray(): boolean;
    get isStruct(): boolean;
    get isTemplate(): boolean;
    get align(): number;
    get members(): Array<MemberInfo> | null;
    get format(): TypeInfo | null;
    get count(): number;
    get stride(): number;
}
export declare class StructInfo extends TypeInfo {
    members: Array<MemberInfo>;
    align: number;
    startLine: number;
    endLine: number;
    inUse: boolean;
    constructor(name: string, attributes: Array<AST.Attribute> | null);
    get isStruct(): boolean;
}
export declare class ArrayInfo extends TypeInfo {
    format: TypeInfo;
    count: number;
    stride: number;
    constructor(name: string, attributes: Array<AST.Attribute> | null);
    get isArray(): boolean;
}
export declare class TemplateInfo extends TypeInfo {
    format: TypeInfo | null;
    access: string;
    constructor(name: string, format: TypeInfo | null, attributes: Array<AST.Attribute> | null, access: string);
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
    attributes: Array<AST.Attribute> | null;
    name: string;
    type: TypeInfo;
    group: number;
    binding: number;
    resourceType: ResourceType;
    access: string;
    constructor(name: string, type: TypeInfo, group: number, binding: number, attributes: Array<AST.Attribute> | null, resourceType: ResourceType, access: string);
    get isArray(): boolean;
    get isStruct(): boolean;
    get isTemplate(): boolean;
    get size(): number;
    get align(): number;
    get members(): Array<MemberInfo> | null;
    get format(): TypeInfo | null;
    get count(): number;
    get stride(): number;
}
export declare class AliasInfo {
    name: string;
    type: TypeInfo;
    constructor(name: string, type: TypeInfo);
}
declare class _TypeSize {
    align: number;
    size: number;
    constructor(align: number, size: number);
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
    attributes: Array<AST.Attribute> | null;
    id: number;
    constructor(name: string, type: TypeInfo | null, attributes: Array<AST.Attribute> | null, id: number);
}
export declare class ArgumentInfo {
    name: string;
    type: TypeInfo;
    constructor(name: string, type: TypeInfo);
}
export declare class FunctionInfo {
    name: string;
    stage: string | null;
    inputs: Array<InputInfo>;
    outputs: Array<OutputInfo>;
    arguments: Array<ArgumentInfo>;
    returnType: TypeInfo | null;
    resources: Array<VariableInfo>;
    overrides: Array<OverrideInfo>;
    startLine: number;
    endLine: number;
    inUse: boolean;
    calls: Set<FunctionInfo>;
    constructor(name: string, stage?: string | null);
}
export declare class EntryFunctions {
    vertex: Array<FunctionInfo>;
    fragment: Array<FunctionInfo>;
    compute: Array<FunctionInfo>;
}
declare class _FunctionResources {
    node: AST.Function;
    resources: Array<VariableInfo> | null;
    inUse: boolean;
    info: FunctionInfo | null;
    constructor(node: AST.Function);
}
export declare class WgslReflect {
    uniforms: Array<VariableInfo>;
    storage: Array<VariableInfo>;
    textures: Array<VariableInfo>;
    samplers: Array<VariableInfo>;
    aliases: Array<AliasInfo>;
    overrides: Array<OverrideInfo>;
    structs: Array<StructInfo>;
    entry: EntryFunctions;
    functions: Array<FunctionInfo>;
    _types: Map<AST.Type, TypeInfo>;
    _functions: Map<string, _FunctionResources>;
    constructor(code: string | undefined);
    _isStorageTexture(type: TypeInfo): boolean;
    update(code: string): void;
    _markStructsInUse(type: TypeInfo): void;
    _addCalls(fn: AST.Function, calls: Set<FunctionInfo>): void;
    findResource(group: number, binding: number): VariableInfo;
    _findResource(name: string): VariableInfo | null;
    _markStructsFromAST(type: AST.Type): void;
    _findResources(fn: AST.Node, isEntry: boolean): Array<VariableInfo>;
    getBindGroups(): Array<Array<VariableInfo>>;
    _getOutputs(type: AST.Type, outputs?: Array<OutputInfo> | undefined): Array<OutputInfo>;
    _getStructOutputs(struct: AST.Struct, outputs: Array<OutputInfo>): void;
    _getOutputInfo(type: AST.Type): OutputInfo | null;
    _getInputs(args: Array<AST.Argument>, inputs?: Array<InputInfo> | undefined): Array<InputInfo>;
    _getStructInputs(struct: AST.Struct, inputs: Array<InputInfo>): void;
    _getInputInfo(node: AST.Member | AST.Argument): InputInfo | null;
    _parseString(s: string | string[]): string;
    _parseInt(s: string | string[]): number | string;
    _getAlias(name: string): TypeInfo | null;
    _getAliasInfo(node: AST.Alias): AliasInfo;
    _getTypeInfo(type: AST.Type, attributes: Array<AST.Attribute> | null): TypeInfo;
    _updateTypeInfo(type: TypeInfo): void;
    _updateStructInfo(struct: StructInfo): void;
    _getTypeSize(type: TypeInfo | MemberInfo | null | undefined): _TypeSize | null;
    _isUniformVar(node: AST.Node): boolean;
    _isStorageVar(node: AST.Node): boolean;
    _isTextureVar(node: AST.Node): boolean;
    _isSamplerVar(node: AST.Node): boolean;
    _getAttribute(node: AST.Node, name: string): AST.Attribute | null;
    _getAttributeNum(attributes: Array<AST.Attribute> | null, name: string, defaultValue: number): number;
    _roundUp(k: number, n: number): number;
    static readonly _typeInfo: {
        f16: {
            align: number;
            size: number;
        };
        i32: {
            align: number;
            size: number;
        };
        u32: {
            align: number;
            size: number;
        };
        f32: {
            align: number;
            size: number;
        };
        atomic: {
            align: number;
            size: number;
        };
        vec2: {
            align: number;
            size: number;
        };
        vec3: {
            align: number;
            size: number;
        };
        vec4: {
            align: number;
            size: number;
        };
        mat2x2: {
            align: number;
            size: number;
        };
        mat3x2: {
            align: number;
            size: number;
        };
        mat4x2: {
            align: number;
            size: number;
        };
        mat2x3: {
            align: number;
            size: number;
        };
        mat3x3: {
            align: number;
            size: number;
        };
        mat4x3: {
            align: number;
            size: number;
        };
        mat2x4: {
            align: number;
            size: number;
        };
        mat3x4: {
            align: number;
            size: number;
        };
        mat4x4: {
            align: number;
            size: number;
        };
    };
    static readonly _textureTypes: string[];
    static readonly _samplerTypes: string[];
}
export {};
