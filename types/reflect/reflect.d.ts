import { Type, Struct, Alias, Node, Function, Argument, Member, Attribute } from "../wgsl_ast.js";
import { FunctionInfo, VariableInfo, AliasInfo, OverrideInfo, StructInfo, TypeInfo, MemberInfo, OutputInfo, InputInfo, EntryFunctions } from "./info.js";
declare class _FunctionResources {
    node: Function;
    resources: VariableInfo[] | null;
    inUse: boolean;
    info: FunctionInfo | null;
    constructor(node: Function);
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
    _types: Map<Type, TypeInfo>;
    _functions: Map<string, _FunctionResources>;
    _isStorageTexture(type: TypeInfo): boolean;
    updateAST(ast: Node[]): void;
    getFunctionInfo(name: string): FunctionInfo | null;
    getStructInfo(name: string): StructInfo | null;
    getOverrideInfo(name: string): OverrideInfo | null;
    _markStructsInUse(type: TypeInfo): void;
    _addCalls(fn: Function, calls: Set<FunctionInfo>): void;
    findResource(group: number, binding: number, entry?: string): VariableInfo;
    _findResource(name: string): VariableInfo | null;
    _markStructsFromAST(type: Type): void;
    _findResources(fn: Node, isEntry: boolean): VariableInfo[];
    getBindGroups(): Array<VariableInfo[]>;
    _getOutputs(type: Type, outputs?: OutputInfo[] | undefined): OutputInfo[];
    _getStructOutputs(struct: Struct, outputs: OutputInfo[]): void;
    _getOutputInfo(type: Type): OutputInfo | null;
    _getInputs(args: Argument[], inputs?: InputInfo[] | undefined): InputInfo[];
    _getStructInputs(struct: Struct, inputs: InputInfo[]): void;
    _getInputInfo(node: Member | Argument): InputInfo | null;
    _parseString(s: string | string[]): string;
    _parseInt(s: string | string[]): number | string;
    _getAlias(name: string): TypeInfo | null;
    _getAliasInfo(node: Alias): AliasInfo;
    getTypeInfoByName(name: string): TypeInfo | null;
    getTypeInfo(type: Type, attributes?: Attribute[] | null): TypeInfo;
    _updateTypeInfo(type: TypeInfo): void;
    _updateStructInfo(struct: StructInfo): void;
    _getTypeSize(type: TypeInfo | MemberInfo | null | undefined): _TypeSize | null;
    _isUniformVar(node: Node): boolean;
    _isStorageVar(node: Node): boolean;
    _isTextureVar(node: Node): boolean;
    _isSamplerVar(node: Node): boolean;
    _getAttribute(node: Node, name: string): Attribute | null;
    _getAttributeNum(attributes: Attribute[] | null, name: string, defaultValue: number): number;
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
