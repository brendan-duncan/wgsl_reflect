export declare class ParseContext {
    constants: Map<string, Const>;
    aliases: Map<string, Alias>;
    structs: Map<string, Struct>;
}
/**
 * @class Node
 * @category AST
 * Base class for AST nodes parsed from a WGSL shader.
 */
export declare class Node {
    constructor();
    get isAstNode(): boolean;
    get astNodeType(): string;
    evaluate(context: ParseContext): number;
    evaluateString(context: ParseContext): string;
    search(callback: (node: Node) => void): void;
    searchBlock(block: Array<Node> | null, callback: (node: Node) => void): void;
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
    args: Array<Argument>;
    returnType: Type | null;
    body: Array<Statement>;
    attributes: Array<Attribute> | null;
    startLine: number;
    endLine: number;
    calls: Set<Function>;
    constructor(name: string, args: Array<Argument>, returnType: Type | null, body: Array<Statement>, startLine: number, endLine: number);
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
    body: Array<Statement>;
    constructor(condition: Expression, body: Array<Statement>);
    get astNodeType(): string;
    search(callback: (node: Node) => void): void;
}
/**
 * @class Continuing
 * @extends Statement
 * @category AST
 */
export declare class Continuing extends Statement {
    body: Array<Statement>;
    constructor(body: Array<Statement>);
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
    body: Array<Statement>;
    constructor(init: Statement | null, condition: Expression | null, increment: Statement | null, body: Array<Statement>);
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
    attributes: Array<Attribute> | null;
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
    attributes: Array<Attribute> | null;
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
    attributes: Array<Attribute> | null;
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
    attributes: Array<Attribute> | null;
    constructor(name: string, type: Type | null, storage: string | null, access: string | null, value: Expression);
    get astNodeType(): string;
    evaluate(context: ParseContext): number;
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
    args: Array<Expression>;
    constructor(name: string, args: Array<Expression>);
    get astNodeType(): string;
    search(callback: (node: Node) => void): void;
}
/**
 * @class Loop
 * @extends Statement
 * @category AST
 */
export declare class Loop extends Statement {
    body: Array<Statement>;
    continuing: Array<Statement> | null;
    constructor(body: Array<Statement>, continuing: Array<Statement> | null);
    get astNodeType(): string;
}
/**
 * @class Switch
 * @extends Statement
 * @category AST
 */
export declare class Switch extends Statement {
    condition: Expression;
    body: Array<Statement>;
    constructor(condition: Expression, body: Array<Statement>);
    get astNodeType(): string;
}
/**
 * @class If
 * @extends Statement
 * @category AST
 */
export declare class If extends Statement {
    condition: Expression;
    body: Array<Statement>;
    elseif: Array<ElseIf> | null;
    else: Array<Statement> | null;
    constructor(condition: Expression, body: Array<Statement>, elseif: Array<ElseIf> | null, _else: Array<Statement> | null);
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
    constructor();
    get astNodeType(): string;
}
/**
 * @class Continue
 * @extends Statement
 * @category AST
 */
export declare class Continue extends Statement {
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
    attributes: Array<Attribute> | null;
    constructor(name: string);
    get astNodeType(): string;
    get isStruct(): boolean;
    get isArray(): boolean;
}
/**
 * @class StructType
 * @extends Type
 * @category AST
 */
export declare class Struct extends Type {
    members: Array<Member>;
    startLine: number;
    endLine: number;
    constructor(name: string, members: Array<Member>, startLine: number, endLine: number);
    get astNodeType(): string;
    get isStruct(): boolean;
    getMemberIndex(name: string): number;
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
    attributes: Array<Attribute> | null;
    format: Type | null;
    count: number;
    constructor(name: string, attributes: Array<Attribute> | null, format: Type | null, count: number);
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
    evaluateString(): string;
}
/**
 * @class CreateExpr
 * @extends Expression
 * @category AST
 */
export declare class CreateExpr extends Expression {
    type: Type | null;
    args: Array<Expression> | null;
    constructor(type: Type | null, args: Array<Expression> | null);
    get astNodeType(): string;
    search(callback: (node: Node) => void): void;
    evaluate(context: ParseContext): number;
}
/**
 * @class CallExpr
 * @extends Expression
 * @category AST
 */
export declare class CallExpr extends Expression {
    name: string;
    args: Array<Expression> | null;
    constructor(name: string, args: Array<Expression> | null);
    get astNodeType(): string;
    evaluate(context: ParseContext): number;
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
    evaluate(context: ParseContext): number;
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
    evaluate(context: ParseContext): number;
    search(callback: (node: Node) => void): void;
}
/**
 * @class LiteralExpr
 * @extends Expression
 * @category AST
 */
export declare class LiteralExpr extends Expression {
    value: number;
    constructor(value: number);
    get astNodeType(): string;
    evaluate(): number;
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
    args: Array<Expression> | null;
    constructor(type: Type | null, args: Array<Expression> | null);
    get astNodeType(): string;
    evaluate(context: ParseContext): number;
    search(callback: (node: Node) => void): void;
}
/**
 * @class GroupingExpr
 * @extends Expression
 * @category AST
 */
export declare class GroupingExpr extends Expression {
    contents: Array<Expression>;
    constructor(contents: Array<Expression>);
    get astNodeType(): string;
    evaluate(context: ParseContext): number;
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
    evaluate(context: ParseContext): number;
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
    evaluate(context: ParseContext): number;
    search(callback: (node: Node) => void): void;
}
/**
 * @class SwitchCase
 * @extends Node
 * @category AST
 */
export declare class SwitchCase extends Node {
    constructor();
}
/**
 * @class Case
 * @extends SwitchCase
 * @category AST
 */
export declare class Case extends SwitchCase {
    selector: Array<Expression>;
    body: Array<Statement>;
    constructor(selector: Array<Expression>, body: Array<Statement>);
    get astNodeType(): string;
    search(callback: (node: Node) => void): void;
}
/**
 * @class Default
 * @extends SwitchCase
 * @category AST
 */
export declare class Default extends SwitchCase {
    body: Array<Statement>;
    constructor(body: Array<Statement>);
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
    attributes: Array<Attribute> | null;
    constructor(name: string, type: Type, attributes: Array<Attribute> | null);
    get astNodeType(): string;
}
/**
 * @class ElseIf
 * @extends Node
 * @category AST
 */
export declare class ElseIf extends Node {
    condition: Expression;
    body: Array<Statement>;
    constructor(condition: Expression, body: Array<Statement>);
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
    attributes: Array<Attribute> | null;
    constructor(name: string, type: Type | null, attributes: Array<Attribute> | null);
    get astNodeType(): string;
}
/**
 * @class Attribute
 * @extends Node
 * @category AST
 */
export declare class Attribute extends Node {
    name: string;
    value: string | Array<string> | null;
    constructor(name: string, value: string | Array<string> | null);
    get astNodeType(): string;
}
