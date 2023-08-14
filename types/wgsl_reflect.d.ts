import * as AST from "./wgsl_ast.js";
export declare class VariableInfo {
    node: AST.Var;
    group: number;
    binding: number;
    constructor(node: AST.Var, group: number, binding: number);
    get name(): string;
    get type(): AST.Type | null;
    get attributes(): Array<AST.Attribute> | null;
}
export declare class OverrideInfo {
    node: AST.Override;
    id: number;
    constructor(node: AST.Override, id: number);
    get name(): string;
    get type(): AST.Type | null;
    get attributes(): Array<AST.Attribute> | null;
    get declaration(): AST.Expression | null;
}
export declare class FunctionInfo {
    node: AST.Function;
    inputs: Array<InputInfo>;
    constructor(node: AST.Function);
    get name(): string;
    get returnType(): AST.Type | null;
    get args(): Array<AST.Argument>;
    get attributes(): Array<AST.Attribute> | null;
}
export declare class InputInfo {
    name: string;
    type: AST.Type | null;
    input: AST.Node;
    locationType: string;
    location: number | string;
    interpolation: string | null;
    constructor(name: string, type: AST.Type | null, input: AST.Node, locationType: string, location: number | string);
}
export declare class MemberInfo {
    node: AST.Member;
    name: string;
    offset: number;
    size: number;
    type: AST.Type;
    isArray: boolean;
    arrayCount: number;
    arrayStride: number;
    isStruct: boolean;
    members: Array<MemberInfo>;
}
export declare class StructInfo {
    node: AST.Struct;
    name: String;
    type: Object;
    align: number;
    size: number;
    members: Array<MemberInfo>;
    isArray: boolean;
    isStruct: boolean;
}
export declare class TypeInfo {
    align: number;
    size: number;
    constructor(align: number, size: number);
}
export declare class BufferInfo extends TypeInfo {
    name: string;
    isArray: boolean;
    isStruct: boolean;
    members: Array<MemberInfo> | null;
    type: AST.Type | null;
    arrayStride: number;
    arrayCount: number;
    group: number;
    binding: number;
    constructor(name: string, type: AST.Type | null);
}
export declare class BindGropEntry {
    type: string;
    resource: any;
    constructor(type: string, resource: any);
}
export declare class EntryFunctions {
    vertex: Array<FunctionInfo>;
    fragment: Array<FunctionInfo>;
    compute: Array<FunctionInfo>;
}
export declare class WgslReflect {
    ast: Array<AST.Statement> | null;
    structs: Array<AST.Struct>;
    overrides: Array<OverrideInfo>;
    uniforms: Array<VariableInfo>;
    storage: Array<VariableInfo>;
    textures: Array<VariableInfo>;
    samplers: Array<VariableInfo>;
    functions: Array<FunctionInfo>;
    aliases: Array<AST.Alias>;
    entry: EntryFunctions;
    constructor(code: string | undefined);
    initialize(code: string): void;
    isTextureVar(node: AST.Node): boolean;
    isSamplerVar(node: AST.Node): boolean;
    isUniformVar(node: AST.Node): boolean;
    isOverride(node: AST.Node): boolean;
    isStorageVar(node: AST.Node): boolean;
    getAttributeNum(node: AST.Node, name: string, defaultValue: number): number;
    getAttribute(node: AST.Node, name: string): AST.Attribute | null;
    _getInputs(args: Array<AST.Argument>, inputs?: Array<InputInfo> | undefined): Array<InputInfo>;
    _getInputInfo(node: AST.Member): InputInfo | null;
    _parseString(s: string | string[]): string;
    _parseInt(s: string | string[]): number | string;
    getStruct(name: string | AST.Type | null): AST.Struct | null;
    getAlias(type: string | AST.Node | null): AST.Type | null;
    getBindGroups(): Array<Array<BindGropEntry>>;
    getStorageBufferInfo(node: VariableInfo | AST.Struct | AST.Var): BufferInfo | null;
    getStructInfo(node: AST.Struct | AST.Var | null): BufferInfo | null;
    _getUniformInfo(node: AST.Var | AST.Struct): BufferInfo | null;
    getUniformBufferInfo(uniform: VariableInfo): BufferInfo | null;
    getTypeInfo(type: AST.Type | null | undefined): TypeInfo | null;
    _roundUp(k: number, n: number): number;
    static readonly typeInfo: {
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
    static readonly textureTypes: string[];
    static readonly samplerTypes: string[];
}
