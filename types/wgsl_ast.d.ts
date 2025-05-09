import { WgslExec } from "./wgsl_exec.js";
import { TypeInfo } from "./reflect/info.js";
import { ExecContext } from "./exec/exec_context.js";
import { ExecInterface } from "./exec/exec_interface.js";
/**
 * @class Node
 * @category AST
 * Base class for AST nodes parsed from a WGSL shader.
 */
export declare class Node {
    static _id: number;
    id: number;
    line: number;
    constructor();
    get isAstNode(): boolean;
    get astNodeType(): string;
    search(callback: (node: Node) => void): void;
    searchBlock(block: Node[] | null, callback: (node: Node) => void): void;
    constEvaluate(context: WgslExec, type?: Type[]): Data | null;
    constEvaluateString(context: WgslExec): string;
}
export declare class _BlockStart extends Node {
    static instance: _BlockStart;
}
export declare class _BlockEnd extends Node {
    static instance: _BlockEnd;
}
/**
 * @class Statement
 * @extends Node
 * @category AST
 */
export declare class Statement extends Node {
    constructor();
}
/**
 * @class Function
 * @extends Statement
 * @category AST
 */
export declare class Function extends Statement {
    name: string;
    args: Argument[];
    returnType: Type | null;
    body: Statement[];
    attributes: Attribute[] | null;
    startLine: number;
    endLine: number;
    calls: Set<Function>;
    constructor(name: string, args: Argument[], returnType: Type | null, body: Statement[], startLine: number, endLine: number);
    get astNodeType(): string;
    search(callback: (node: Node) => void): void;
}
/**
 * @class StaticAssert
 * @extends Statement
 * @category AST
 */
export declare class StaticAssert extends Statement {
    expression: Expression;
    constructor(expression: Expression);
    get astNodeType(): string;
    search(callback: (node: Node) => void): void;
}
/**
 * @class While
 * @extends Statement
 * @category AST
 */
export declare class While extends Statement {
    condition: Expression;
    body: Statement[];
    constructor(condition: Expression, body: Statement[]);
    get astNodeType(): string;
    search(callback: (node: Node) => void): void;
}
/**
 * @class Continuing
 * @extends Statement
 * @category AST
 */
export declare class Continuing extends Statement {
    body: Statement[];
    loopId: number;
    constructor(body: Statement[], loopId: number);
    get astNodeType(): string;
    search(callback: (node: Node) => void): void;
}
/**
 * @class For
 * @extends Statement
 * @category AST
 */
export declare class For extends Statement {
    init: Statement | null;
    condition: Expression | null;
    increment: Statement | null;
    body: Statement[];
    constructor(init: Statement | null, condition: Expression | null, increment: Statement | null, body: Statement[]);
    get astNodeType(): string;
    search(callback: (node: Node) => void): void;
}
/**
 * @class Var
 * @extends Statement
 * @category AST
 */
export declare class Var extends Statement {
    name: string;
    type: Type | null;
    storage: string | null;
    access: string | null;
    value: Expression | null;
    attributes: Attribute[] | null;
    constructor(name: string, type: Type | null, storage: string | null, access: string | null, value: Expression | null);
    get astNodeType(): string;
    search(callback: (node: Node) => void): void;
}
/**
 * @class Override
 * @extends Statement
 * @category AST
 */
export declare class Override extends Statement {
    name: string;
    type: Type | null;
    value: Expression | null;
    attributes: Attribute[] | null;
    constructor(name: string, type: Type | null, value: Expression | null);
    get astNodeType(): string;
    search(callback: (node: Node) => void): void;
}
/**
 * @class Let
 * @extends Statement
 * @category AST
 */
export declare class Let extends Statement {
    name: string;
    type: Type | null;
    storage: string | null;
    access: string | null;
    value: Expression | null;
    attributes: Attribute[] | null;
    constructor(name: string, type: Type | null, storage: string | null, access: string | null, value: Expression | null);
    get astNodeType(): string;
    search(callback: (node: Node) => void): void;
}
/**
 * @class Const
 * @extends Statement
 * @category AST
 */
export declare class Const extends Statement {
    name: string;
    type: Type | null;
    storage: string | null;
    access: string | null;
    value: Expression;
    attributes: Attribute[] | null;
    constructor(name: string, type: Type | null, storage: string | null, access: string | null, value: Expression);
    get astNodeType(): string;
    constEvaluate(context: WgslExec, type?: Type[]): Data | null;
    search(callback: (node: Node) => void): void;
}
export declare enum IncrementOperator {
    increment = "++",
    decrement = "--"
}
export declare namespace IncrementOperator {
    function parse(val: string): IncrementOperator;
}
/**
 * @class Increment
 * @extends Statement
 * @category AST
 */
export declare class Increment extends Statement {
    operator: IncrementOperator;
    variable: Expression;
    constructor(operator: IncrementOperator, variable: Expression);
    get astNodeType(): string;
    search(callback: (node: Node) => void): void;
}
export declare enum AssignOperator {
    assign = "=",
    addAssign = "+=",
    subtractAssin = "-=",
    multiplyAssign = "*=",
    divideAssign = "/=",
    moduloAssign = "%=",
    andAssign = "&=",
    orAssign = "|=",
    xorAssign = "^=",
    shiftLeftAssign = "<<=",
    shiftRightAssign = ">>="
}
export declare namespace AssignOperator {
    function parse(val: string): AssignOperator;
}
/**
 * @class Assign
 * @extends Statement
 * @category AST
 */
export declare class Assign extends Statement {
    operator: AssignOperator;
    variable: Expression;
    value: Expression;
    constructor(operator: AssignOperator, variable: Expression, value: Expression);
    get astNodeType(): string;
    search(callback: (node: Node) => void): void;
}
/**
 * @class Call
 * @extends Statement
 * @category AST
 */
export declare class Call extends Statement {
    name: string;
    args: Expression[];
    constructor(name: string, args: Expression[]);
    get astNodeType(): string;
    isBuiltin(): boolean;
    search(callback: (node: Node) => void): void;
}
/**
 * @class Loop
 * @extends Statement
 * @category AST
 */
export declare class Loop extends Statement {
    body: Statement[];
    continuing: Continuing | null;
    constructor(body: Statement[], continuing: Continuing | null);
    get astNodeType(): string;
}
/**
 * @class Switch
 * @extends Statement
 * @category AST
 */
export declare class Switch extends Statement {
    condition: Expression;
    cases: SwitchCase[];
    constructor(condition: Expression, cases: SwitchCase[]);
    get astNodeType(): string;
    search(callback: (node: Node) => void): void;
}
/**
 * @class If
 * @extends Statement
 * @category AST
 */
export declare class If extends Statement {
    condition: Expression;
    body: Statement[];
    elseif: ElseIf[] | null;
    else: Statement[] | null;
    constructor(condition: Expression, body: Statement[], elseif: ElseIf[] | null, _else: Statement[] | null);
    get astNodeType(): string;
    search(callback: (node: Node) => void): void;
}
/**
 * @class Return
 * @extends Statement
 * @category AST
 */
export declare class Return extends Statement {
    value: Expression;
    constructor(value: Expression);
    get astNodeType(): string;
    search(callback: (node: Node) => void): void;
}
/**
 * @class Enable
 * @extends Statement
 * @category AST
 */
export declare class Enable extends Statement {
    name: string;
    constructor(name: string);
    get astNodeType(): string;
}
/**
 * @class Requires
 * @extends Statement
 * @category AST
 */
export declare class Requires extends Statement {
    extensions: string[];
    constructor(extensions: string[]);
    get astNodeType(): string;
}
/**
 * @class Diagnostic
 * @extends Statement
 * @category AST
 */
export declare class Diagnostic extends Statement {
    severity: string;
    rule: string;
    constructor(severity: string, rule: string);
    get astNodeType(): string;
}
/**
 * @class Alias
 * @extends Statement
 * @category AST
 */
export declare class Alias extends Statement {
    name: string;
    type: Type;
    constructor(name: string, type: Type);
    get astNodeType(): string;
}
/**
 * @class Discard
 * @extends Statement
 * @category AST
 */
export declare class Discard extends Statement {
    constructor();
    get astNodeType(): string;
}
/**
 * @class Break
 * @extends Statement
 * @category AST
 */
export declare class Break extends Statement {
    condition: Expression | null;
    loopId: number;
    constructor();
    get astNodeType(): string;
}
/**
 * @class Continue
 * @extends Statement
 * @category AST
 */
export declare class Continue extends Statement {
    loopId: number;
    constructor();
    get astNodeType(): string;
}
/**
 * @class Type
 * @extends Statement
 * @category AST
 */
export declare class Type extends Statement {
    name: string;
    attributes: Attribute[] | null;
    constructor(name: string);
    get astNodeType(): string;
    get isStruct(): boolean;
    get isArray(): boolean;
    static x32: Type;
    static f32: Type;
    static i32: Type;
    static u32: Type;
    static f16: Type;
    static bool: Type;
    static void: Type;
    static _priority: Map<string, number>;
    static maxFormatType(x: Type[]): Type;
    getTypeName(): string;
}
/**
 * @class ForwardType
 * @extends Type
 * @category AST
 * Internal type used as a placeholder for a type being used before it has been defined.
 */
export declare class ForwardType extends Type {
    constructor(name: string);
}
/**
 * @class StructType
 * @extends Type
 * @category AST
 */
export declare class Struct extends Type {
    members: Member[];
    startLine: number;
    endLine: number;
    constructor(name: string, members: Member[], startLine: number, endLine: number);
    get astNodeType(): string;
    get isStruct(): boolean;
    getMemberIndex(name: string): number;
    search(callback: (node: Node) => void): void;
}
/**
 * @class TemplateType
 * @extends Type
 * @category AST
 */
export declare class TemplateType extends Type {
    format: Type | null;
    access: string | null;
    constructor(name: string, format: Type | null, access: string | null);
    get astNodeType(): string;
    getTypeName(): string;
    static vec2f: TemplateType;
    static vec3f: TemplateType;
    static vec4f: TemplateType;
    static vec2i: TemplateType;
    static vec3i: TemplateType;
    static vec4i: TemplateType;
    static vec2u: TemplateType;
    static vec3u: TemplateType;
    static vec4u: TemplateType;
    static vec2h: TemplateType;
    static vec3h: TemplateType;
    static vec4h: TemplateType;
    static vec2b: TemplateType;
    static vec3b: TemplateType;
    static vec4b: TemplateType;
    static mat2x2f: TemplateType;
    static mat2x3f: TemplateType;
    static mat2x4f: TemplateType;
    static mat3x2f: TemplateType;
    static mat3x3f: TemplateType;
    static mat3x4f: TemplateType;
    static mat4x2f: TemplateType;
    static mat4x3f: TemplateType;
    static mat4x4f: TemplateType;
    static mat2x2h: TemplateType;
    static mat2x3h: TemplateType;
    static mat2x4h: TemplateType;
    static mat3x2h: TemplateType;
    static mat3x3h: TemplateType;
    static mat3x4h: TemplateType;
    static mat4x2h: TemplateType;
    static mat4x3h: TemplateType;
    static mat4x4h: TemplateType;
    static mat2x2i: TemplateType;
    static mat2x3i: TemplateType;
    static mat2x4i: TemplateType;
    static mat3x2i: TemplateType;
    static mat3x3i: TemplateType;
    static mat3x4i: TemplateType;
    static mat4x2i: TemplateType;
    static mat4x3i: TemplateType;
    static mat4x4i: TemplateType;
    static mat2x2u: TemplateType;
    static mat2x3u: TemplateType;
    static mat2x4u: TemplateType;
    static mat3x2u: TemplateType;
    static mat3x3u: TemplateType;
    static mat3x4u: TemplateType;
    static mat4x2u: TemplateType;
    static mat4x3u: TemplateType;
    static mat4x4u: TemplateType;
}
/**
 * @class PointerType
 * @extends Type
 * @category AST
 */
export declare class PointerType extends Type {
    storage: string;
    type: Type | null;
    access: string | null;
    constructor(name: string, storage: string, type: Type | null, access: string | null);
    get astNodeType(): string;
}
/**
 * @class ArrayType
 * @extends Type
 * @category AST
 */
export declare class ArrayType extends Type {
    attributes: Attribute[] | null;
    format: Type | null;
    count: number;
    constructor(name: string, attributes: Attribute[] | null, format: Type | null, count: number);
    get astNodeType(): string;
    get isArray(): boolean;
}
/**
 * @class SamplerType
 * @extends Type
 * @category AST
 */
export declare class SamplerType extends Type {
    format: Type | string | null;
    access: string | null;
    constructor(name: string, format: Type | string | null, access: string | null);
    get astNodeType(): string;
}
/**
 * @class Expression
 * @extends Node
 * @category AST
 */
export declare class Expression extends Node {
    postfix: Expression | null;
    constructor();
}
/**
 * @class StringExpr
 * @extends Expression
 * @category AST
 */
export declare class StringExpr extends Expression {
    value: string;
    constructor(value: string);
    get astNodeType(): string;
    toString(): string;
    constEvaluateString(): string;
}
/**
 * @class CreateExpr
 * @extends Expression
 * @category AST
 */
export declare class CreateExpr extends Expression {
    type: Type | null;
    args: Expression[] | null;
    constructor(type: Type | null, args: Expression[] | null);
    get astNodeType(): string;
    search(callback: (node: Node) => void): void;
    constEvaluate(context: WgslExec, type?: Type[]): Data | null;
}
/**
 * @class CallExpr
 * @extends Expression
 * @category AST
 */
export declare class CallExpr extends Expression {
    name: string;
    args: Expression[] | null;
    cachedReturnValue: any;
    constructor(name: string, args: Expression[] | null);
    get astNodeType(): string;
    setCachedReturnValue(value: any): void;
    get isBuiltin(): boolean;
    constEvaluate(context: WgslExec, type?: Type[]): Data;
    search(callback: (node: Node) => void): void;
}
/**
 * @class VariableExpr
 * @extends Expression
 * @category AST
 */
export declare class VariableExpr extends Expression {
    name: string;
    constructor(name: string);
    get astNodeType(): string;
    search(callback: (node: Node) => void): void;
    constEvaluate(context: WgslExec, type?: Type[]): Data;
}
/**
 * @class ConstExpr
 * @extends Expression
 * @category AST
 */
export declare class ConstExpr extends Expression {
    name: string;
    initializer: Expression;
    constructor(name: string, initializer: Expression);
    get astNodeType(): string;
    constEvaluate(context: WgslExec, type?: Type[]): Data | null;
    search(callback: (node: Node) => void): void;
}
/**
 * @class LiteralExpr
 * @extends Expression
 * @category AST
 */
export declare class LiteralExpr extends Expression {
    value: Data;
    type: Type;
    constructor(value: Data, type: Type);
    get astNodeType(): string;
    constEvaluate(context: WgslExec, type?: Type[]): Data | null;
    get isScalar(): boolean;
    get isVector(): boolean;
    get scalarValue(): number;
    get vectorValue(): Float32Array | Int32Array | Uint32Array;
}
/**
 * @class BitcastExpr
 * @extends Expression
 * @category AST
 */
export declare class BitcastExpr extends Expression {
    type: Type | null;
    value: Expression;
    constructor(type: Type | null, value: Expression);
    get astNodeType(): string;
    search(callback: (node: Node) => void): void;
}
/**
 * @class TypecastExpr
 * @extends Expression
 * @category AST
 */
export declare class TypecastExpr extends Expression {
    type: Type | null;
    args: Expression[] | null;
    constructor(type: Type | null, args: Expression[] | null);
    get astNodeType(): string;
    constEvaluate(context: WgslExec, type?: Type[]): Data | null;
    search(callback: (node: Node) => void): void;
}
/**
 * @class ArrayIndex
 * @extends Expression
 * @category AST
 */
export declare class ArrayIndex extends Expression {
    index: Expression;
    constructor(index: Expression);
    search(callback: (node: Node) => void): void;
}
/**
 * @class Operator
 * @extends Expression
 * @category AST
 */
export declare class Operator extends Expression {
    constructor();
}
/**
 * @class UnaryOperator
 * @extends Operator
 * @category AST
 * @property {string} operator +, -, !, ~
 */
export declare class UnaryOperator extends Operator {
    operator: string;
    right: Expression;
    constructor(operator: string, right: Expression);
    get astNodeType(): string;
    constEvaluate(context: WgslExec, type?: Type[]): Data | null;
    search(callback: (node: Node) => void): void;
}
/**
 * @class BinaryOperator
 * @extends Operator
 * @category AST
 * @property {string} operator +, -, *, /, %, ==, !=, <, >, <=, >=, &&, ||
 */
export declare class BinaryOperator extends Operator {
    operator: string;
    left: Expression;
    right: Expression;
    constructor(operator: string, left: Expression, right: Expression);
    get astNodeType(): string;
    _getPromotedType(t1: Type, t2: Type): Type;
    constEvaluate(context: WgslExec, type?: Type[]): Data | null;
    search(callback: (node: Node) => void): void;
}
/**
 * @class SwitchCase
 * @extends Node
 * @category AST
 */
export declare class SwitchCase extends Node {
    body: Statement[];
    constructor(body: Statement[]);
    search(callback: (node: Node) => void): void;
}
export declare class DefaultSelector extends Expression {
    constructor();
    get astNodeType(): string;
}
/**
 * @class Case
 * @extends SwitchCase
 * @category AST
 */
export declare class Case extends SwitchCase {
    selectors: Expression[];
    constructor(selectors: Expression[], body: Statement[]);
    get astNodeType(): string;
    search(callback: (node: Node) => void): void;
}
/**
 * @class Default
 * @extends SwitchCase
 * @category AST
 */
export declare class Default extends SwitchCase {
    constructor(body: Statement[]);
    get astNodeType(): string;
    search(callback: (node: Node) => void): void;
}
/**
 * @class Argument
 * @extends Node
 * @category AST
 */
export declare class Argument extends Node {
    name: string;
    type: Type;
    attributes: Attribute[] | null;
    constructor(name: string, type: Type, attributes: Attribute[] | null);
    get astNodeType(): string;
}
/**
 * @class ElseIf
 * @extends Node
 * @category AST
 */
export declare class ElseIf extends Node {
    condition: Expression;
    body: Statement[];
    constructor(condition: Expression, body: Statement[]);
    get astNodeType(): string;
    search(callback: (node: Node) => void): void;
}
/**
 * @class Member
 * @extends Node
 * @category AST
 */
export declare class Member extends Node {
    name: string;
    type: Type | null;
    attributes: Attribute[] | null;
    constructor(name: string, type: Type | null, attributes: Attribute[] | null);
    get astNodeType(): string;
}
/**
 * @class Attribute
 * @extends Node
 * @category AST
 */
export declare class Attribute extends Node {
    name: string;
    value: string | string[] | null;
    constructor(name: string, value: string | string[] | null);
    get astNodeType(): string;
}
export declare class Data {
    static _id: number;
    typeInfo: TypeInfo;
    parent: Data | null;
    id: number;
    constructor(typeInfo: TypeInfo, parent: Data | null);
    clone(): Data;
    setDataValue(exec: ExecInterface, value: Data, postfix: Expression | null, context: ExecContext): void;
    getSubData(exec: ExecInterface, postfix: Expression | null, context: ExecContext): Data | null;
    toString(): string;
}
export declare class VoidData extends Data {
    constructor();
    static void: VoidData;
    toString(): string;
}
export declare class PointerData extends Data {
    reference: Data;
    constructor(reference: Data);
    clone(): Data;
    setDataValue(exec: ExecInterface, value: Data, postfix: Expression | null, context: ExecContext): void;
    getSubData(exec: ExecInterface, postfix: Expression | null, context: ExecContext): Data | null;
    toString(): string;
}
export declare class ScalarData extends Data {
    data: Int32Array | Uint32Array | Float32Array;
    constructor(value: number | Int32Array | Uint32Array | Float32Array, typeInfo: TypeInfo, parent?: Data | null);
    clone(): Data;
    get value(): number;
    set value(v: number);
    setDataValue(exec: ExecInterface, value: Data, postfix: Expression | null, context: ExecContext): void;
    getSubData(exec: ExecInterface, postfix: Expression | null, context: ExecContext): Data | null;
    toString(): string;
}
export declare class VectorData extends Data {
    data: Int32Array | Uint32Array | Float32Array;
    constructor(value: number[] | Float32Array | Uint32Array | Int32Array, typeInfo: TypeInfo, parent?: Data | null);
    clone(): Data;
    setDataValue(exec: ExecInterface, value: Data, postfix: Expression | null, context: ExecContext): void;
    getSubData(exec: ExecInterface, postfix: Expression | null, context: ExecContext): Data | null;
    toString(): string;
}
export declare class MatrixData extends Data {
    data: Float32Array;
    constructor(value: number[] | Float32Array, typeInfo: TypeInfo, parent?: Data | null);
    clone(): Data;
    setDataValue(exec: ExecInterface, value: Data, postfix: Expression | null, context: ExecContext): void;
    getSubData(exec: ExecInterface, postfix: Expression | null, context: ExecContext): Data | null;
    toString(): string;
}
export declare class TypedData extends Data {
    buffer: ArrayBuffer;
    offset: number;
    constructor(data: ArrayBuffer | Float32Array | Uint32Array | Int32Array | Uint8Array | Int8Array, typeInfo: TypeInfo, offset?: number, parent?: Data | null);
    clone(): Data;
    setDataValue(exec: ExecInterface, value: Data, postfix: Expression | null, context: ExecContext): void;
    setData(exec: ExecInterface, value: Data, typeInfo: TypeInfo, offset: number, context: ExecContext): void;
    getSubData(exec: ExecInterface, postfix: Expression | null, context: ExecContext): Data | null;
    toString(): string;
}
export declare class TextureData extends Data {
    data: Array<ArrayBuffer>;
    descriptor: Object;
    view: Object | null;
    constructor(data: Array<ArrayBuffer | Float32Array | Uint32Array | Int32Array | Uint8Array | Int8Array>, typeInfo: TypeInfo, descriptor: Object, view: Object | null);
    clone(): Data;
    get width(): number;
    get height(): number;
    get depthOrArrayLayers(): number;
    get format(): string;
    get sampleCount(): number;
    get mipLevelCount(): number;
    get dimension(): string;
    getMipLevelSize(level: number): number[];
    get texelByteSize(): number;
    get bytesPerRow(): number;
    get isDepthStencil(): boolean;
    getGpuSize(): number;
    getPixel(x: number, y: number, z?: number, mipLevel?: number): number[] | null;
    setPixel(x: number, y: number, z: number, mipLevel: number, value: number[]): void;
}
