import * as AST from "../wgsl_ast.js";
import { FunctionInfo, VariableInfo, AliasInfo, OverrideInfo, StructInfo, TypeInfo, MemberInfo, OutputInfo, InputInfo, EntryFunctions } from "./info.js";
declare class _FunctionResources {
    node: AST.Function;
    resources: VariableInfo[] | null;
    inUse: boolean;
    info: FunctionInfo | null;
    constructor(node: AST.Function);
}
declare class _TypeSize {
    align: number;
    size: number;
    constructor(align: number, size: number);
}
export declare class Reflect {
    uniforms: VariableInfo[];
    storage: VariableInfo[];
    textures: VariableInfo[];
    samplers: VariableInfo[];
    aliases: AliasInfo[];
    overrides: OverrideInfo[];
    structs: StructInfo[];
    entry: EntryFunctions;
    functions: FunctionInfo[];
    _types: Map<AST.Type, TypeInfo>;
    _functions: Map<string, _FunctionResources>;
    _isStorageTexture(type: TypeInfo): boolean;
    updateAST(ast: AST.Node[]): void;
    getStructInfo(name: string): StructInfo | null;
    getOverrideInfo(name: string): OverrideInfo | null;
    _markStructsInUse(type: TypeInfo): void;
    _addCalls(fn: AST.Function, calls: Set<FunctionInfo>): void;
    findResource(group: number, binding: number): VariableInfo;
    _findResource(name: string): VariableInfo | null;
    _markStructsFromAST(type: AST.Type): void;
    _findResources(fn: AST.Node, isEntry: boolean): VariableInfo[];
    getBindGroups(): Array<VariableInfo[]>;
    _getOutputs(type: AST.Type, outputs?: OutputInfo[] | undefined): OutputInfo[];
    _getStructOutputs(struct: AST.Struct, outputs: OutputInfo[]): void;
    _getOutputInfo(type: AST.Type): OutputInfo | null;
    _getInputs(args: AST.Argument[], inputs?: InputInfo[] | undefined): InputInfo[];
    _getStructInputs(struct: AST.Struct, inputs: InputInfo[]): void;
    _getInputInfo(node: AST.Member | AST.Argument): InputInfo | null;
    _parseString(s: string | string[]): string;
    _parseInt(s: string | string[]): number | string;
    _getAlias(name: string): TypeInfo | null;
    _getAliasInfo(node: AST.Alias): AliasInfo;
    getTypeInfo(type: AST.Type, attributes?: AST.Attribute[] | null): TypeInfo;
    _updateTypeInfo(type: TypeInfo): void;
    _updateStructInfo(struct: StructInfo): void;
    _getTypeSize(type: TypeInfo | MemberInfo | null | undefined): _TypeSize | null;
    _isUniformVar(node: AST.Node): boolean;
    _isStorageVar(node: AST.Node): boolean;
    _isTextureVar(node: AST.Node): boolean;
    _isSamplerVar(node: AST.Node): boolean;
    _getAttribute(node: AST.Node, name: string): AST.Attribute | null;
    _getAttributeNum(attributes: AST.Attribute[] | null, name: string, defaultValue: number): number;
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
