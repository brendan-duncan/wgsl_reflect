/**
 * @class Node
 * @category AST
 * Base class for AST nodes parsed from a WGSL shader.
 */
export class Node {
    constructor() {}

    get isAstNode(): boolean { return true; }

    get astNodeType(): string { return ""; }
}

/**
 * @class Statement
 * @extends Node
 * @category AST
 */
export class Statement extends Node {
    constructor() {
        super();
    }
}

/**
 * @class Function
 * @extends Statement
 * @category AST
 */
export class Function extends Statement {
    name: string;
    args: Array<Argument>;
    returnType: Type|null;
    body: Array<Statement>;
    attributes: Array<Attribute>|null;

    constructor(name: string, args: Array<Argument>, returnType: Type|null,
            body: Array<Statement>) {
        super();
        this.name = name;
        this.args = args;
        this.returnType = returnType;
        this.body = body;
    }

    get astNodeType(): string { return "function"; }
}

/**
 * @class StaticAssert
 * @extends Statement
 * @category AST
 */
export class StaticAssert extends Statement {
    expression: Expression;

    constructor(expression: Expression) {
        super();
        this.expression = expression;
    }

    get astNodeType() { return "staticAssert"; }
}

/**
 * @class While
 * @extends Statement
 * @category AST
 */
export class While extends Statement {
    condition: Expression;
    body: Array<Statement>;

    constructor(condition: Expression, body: Array<Statement>) {
        super();
        this.condition = condition;
        this.body = body;
    }

    get astNodeType() { return "while"; }
}

/**
 * @class For
 * @extends Statement
 * @category AST
 */
export class For extends Statement {
    init: Statement|null;
    condition: Expression|null;
    increment: Statement|null;
    body: Array<Statement>;

    constructor(init: Statement|null, condition: Expression|null, increment: Statement|null,
            body: Array<Statement>) {
        super();
        this.init = init;
        this.condition = condition;
        this.increment = increment;
        this.body = body;
    }

    get astNodeType() { return "for"; }
}

/**
 * @class Var
 * @extends Statement
 * @category AST
 */
export class Var extends Statement {
    name: string;
    type: Type|null;
    storage: string|null;
    access: string|null;
    value: Expression|null;
    attributes: Array<Attribute>|null;

    constructor(name: string, type: Type|null, storage: string|null, access: string|null,
            value: Expression|null) {
        super();
        this.name = name;
        this.type = type;
        this.storage = storage;
        this.access = access;
        this.value = value;
    }

    get astNodeType() { return "var"; }
}

/**
 * @class Let
 * @extends Statement
 * @category AST
 */
export class Let extends Statement {
    name: string;
    type: Type|null;
    storage: string|null;
    access: string|null;
    value: Expression|null;
    attributes: Array<Attribute>|null;

    constructor(name: string, type: Type|null, storage: string|null, access: string|null,
            value: Expression|null) {
        super();
        this.name = name;
        this.type = type;
        this.storage = storage;
        this.access = access;
        this.value = value;
    }

    get astNodeType() { return "let"; }
}

/**
 * @class Const
 * @extends Statement
 * @category AST
 */
export class Const extends Statement {
    name: string;
    type: Type|null;
    storage: string|null;
    access: string|null;
    value: Expression;
    attributes: Array<Attribute>|null;

    constructor(name: string, type: Type|null, storage: string|null, access: string|null,
            value: Expression) {
        super();
        this.name = name;
        this.type = type;
        this.storage = storage;
        this.access = access;
        this.value = value;
    }

    get astNodeType() { return "const"; }
}

export enum IncrementOperator {
    increment = "++",
    decrement = "--"
}

export namespace IncrementOperator {
    export function parse(val: string): IncrementOperator {
        const key = val as keyof typeof IncrementOperator;
        if (key == 'parse')
            throw new Error('Invalid value for IncrementOperator');
        return IncrementOperator[key];
    }
}

/**
 * @class Increment
 * @extends Statement
 * @category AST
 */
export class Increment extends Statement {
    operator: IncrementOperator;
    variable: Expression;

    constructor(operator: IncrementOperator, variable: Expression) {
        super();
        this.operator = operator;
        this.variable = variable;
    }

    get astNodeType() { return "increment"; }
}

export enum AssignOperator {
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
};

export namespace AssignOperator {
    export function parse(val: string): AssignOperator {
        const key = val as keyof typeof AssignOperator;
        if (key == 'parse')
            throw new Error('Invalid value for AssignOperator');
        return AssignOperator[key];
    }
}

/**
 * @class Assign
 * @extends Statement
 * @category AST
 */
export class Assign extends Statement {
    operator: AssignOperator;
    variable: Expression;
    value: Expression;

    constructor(operator: AssignOperator, variable: Expression, value: Expression) {
        super();
        this.operator = operator;
        this.variable = variable;
        this.value = value;
    }

    get astNodeType() { return "assign"; }
}

/**
 * @class Call
 * @extends Statement
 * @category AST
 */
export class Call extends Statement {
    name: string;
    args: Array<Expression>;

    constructor(name: string, args: Array<Expression>) {
        super();
        this.name = name;
        this.args = args;
    }

    get astNodeType() { return "call"; }
}

/**
 * @class Loop
 * @extends Statement
 * @category AST
 */
export class Loop extends Statement {
    body: Array<Statement>;
    continuing: Array<Statement>|null;

    constructor(body: Array<Statement>, continuing: Array<Statement>|null) {
        super();
        this.body = body;
        this.continuing = continuing;
    }

    get astNodeType() { return "loop"; }
}

/**
 * @class Switch
 * @extends Statement
 * @category AST
 */
export class Switch extends Statement {
    condition: Expression;
    body: Array<Statement>;

    constructor(condition: Expression, body: Array<Statement>) {
        super();
        this.condition = condition;
        this.body = body;
    }

    get astNodeType() { return "body"; }
}

/**
 * @class If
 * @extends Statement
 * @category AST
 */
export class If extends Statement {
    condition: Expression;
    body: Array<Statement>;
    elseif: Array<ElseIf>|null;
    else: Array<Statement>|null;

    constructor(condition: Expression, body: Array<Statement>, elseif: Array<ElseIf>|null,
            _else: Array<Statement>|null) {
        super();
        this.condition = condition;
        this.body = body;
        this.elseif = elseif;
        this.else = _else;
    }

    get astNodeType() { return "if"; }
}

/**
 * @class Return
 * @extends Statement
 * @category AST
 */
export class Return extends Statement {
    value: Expression;

    constructor(value: Expression) {
        super();
        this.value = value;
    }

    get astNodeType() { return "return"; }
}

/**
 * @class Struct
 * @extends Statement
 * @category AST
 */
export class Struct extends Statement {
    name: string;
    members: Array<Member>;
    attributes: Array<Attribute>|null;

    constructor(name: string, members: Array<Member>) {
        super();
        this.name = name;
        this.members = members;
    }

    get astNodeType() { return "struct"; }
}

/**
 * @class Enable
 * @extends Statement
 * @category AST
 */
export class Enable extends Statement {
    name: string;

    constructor(name: string) {
        super();
        this.name = name;
    }

    get astNodeType() { return "enable"; }
}

/**
 * @class Alias
 * @extends Statement
 * @category AST
 */
export class Alias extends Statement {
    name: string;
    type: Type;

    constructor(name: string, type: Type) {
        super();
        this.name = name;
        this.type = type;
    }

    get astNodeType() { return "alias"; }
}

/**
 * @class Discard
 * @extends Statement
 * @category AST
 */
export class Discard extends Statement {
    constructor() {
        super();
    }

    get astNodeType() { return "discard"; }
}

/**
 * @class Break
 * @extends Statement
 * @category AST
 */
export class Break extends Statement {
    constructor() {
        super();
    }

    get astNodeType() { return "break"; }
}

/**
 * @class Continue
 * @extends Statement
 * @category AST
 */
export class Continue extends Statement {
    constructor() {
        super();
    }

    get astNodeType() { return "continue"; }
}

/**
 * @class Type
 * @extends Node
 * @category AST
 */
export class Type extends Node {
    name: string;
    attributes: Array<Attribute>|null;

    constructor(name: string) {
        super();
        this.name = name;
    }

    get astNodeType() { return "type"; }
}

/**
 * @class TemplateType
 * @extends Type
 * @category AST
 */
export class TemplateType extends Type {
    format: Type|null;
    access: string|null;

    constructor(name: string, format: Type|null, access: string|null) {
        super(name);
        this.format = format;
        this.access = access;
    }

    get astNodeType() { return "template"; }
}

/**
 * @class PointerType
 * @extends Type
 * @category AST
 */
export class PointerType extends Type {
    storage: string;
    type: Type|null;
    access: string|null;

    constructor(name: string, storage: string, type: Type|null, access: string|null) {
        super(name);
        this.storage = storage;
        this.type = type;
        this.access = access;
    }

    get astNodeType() { return "pointer"; }
}

/**
 * @class ArrayType
 * @extends Type
 * @category AST
 */
export class ArrayType extends Type {
    name: string;
    attributes: Array<Attribute>|null;
    format: Type|null;
    count: number

    constructor(name: string, attributes: Array<Attribute>|null, format: Type|null, count: number) {
        super(name);
        this.attributes = attributes;
        this.format = format;
        this.count = count;
    }

    get astNodeType() { return "array"; }
}

/**
 * @class SamplerType
 * @extends Type
 * @category AST
 */
export class SamplerType extends Type {
    format: Type|string|null;
    access: string|null;

    constructor(name: string, format: Type|string|null, access: string|null) {
        super(name);
        this.format = format;
        this.access = access;
    }

    get astNodeType() { return "sampler"; }
}

/**
 * @class Expression
 * @extends Node
 * @category AST
 */
export class Expression extends Node {
    postfix: Expression|null;

    constructor() {
        super();
    }
}

/**
 * @class StringExpr
 * @extends Expression
 * @category AST
 */
export class StringExpr extends Expression {
    value: string;

    constructor(value: string) {
        super();
        this.value = value;
    }

    get astNodeType() { return "stringExpr"; }

    toString(): string { return this.value; }
}

/**
 * @class CreateExpr
 * @extends Expression
 * @category AST
 */
export class CreateExpr extends Expression {
    type: Type|null;
    args: Array<Expression>|null;

    constructor(type: Type|null, args: Array<Expression>|null) {
        super();
        this.type = type;
        this.args = args;
    }

    get astNodeType() { return "createExpr"; }
}

/**
 * @class CallExpr
 * @extends Expression
 * @category AST
 */
export class CallExpr extends Expression {
    name: string;
    args: Array<Expression>|null;

    constructor(name: string, args: Array<Expression>|null) {
        super();
        this.name = name;
        this.args = args;
    }

    get astNodeType() { return "callExpr"; }
}

/**
 * @class VariableExpr
 * @extends Expression
 * @category AST
 */
export class VariableExpr extends Expression {
    name: string;

    constructor(name: string) {
        super();
        this.name = name;
    }

    get astNodeType() { return "varExpr"; }
}

/**
 * @class LiteralExpr
 * @extends Expression
 * @category AST
 */
export class LiteralExpr extends Expression {
    value: string;

    constructor(value: string) {
        super();
        this.value = value;
    }

    get astNodeType() { return "literalExpr"; }
}

/**
 * @class BitcastExpr
 * @extends Expression
 * @category AST
 */
export class BitcastExpr extends Expression {
    type: Type|null;
    value: Expression;

    constructor(type: Type|null, value: Expression) {
        super();
        this.type = type;
        this.value = value;
    }

    get astNodeType() { return "bitcastExpr"; }
}

/**
 * @class TypecastExpr
 * @extends Expression
 * @category AST
 */
export class TypecastExpr extends Expression {
    type: Type|null;
    args: Array<Expression>|null;

    constructor(type: Type|null, args: Array<Expression>|null) {
        super();
        this.type = type;
        this.args = args;
    }

    get astNodeType() { return "typecastExpr"; }
}

/**
 * @class GroupingExpr
 * @extends Expression
 * @category AST
 */
export class GroupingExpr extends Expression {
    contents: Array<Expression>;

    constructor(contents: Array<Expression>) {
        super();
        this.contents = contents;
    }

    get astNodeType() { return "groupExpr"; }
}

/**
 * @class Operator
 * @extends Expression
 * @category AST
 */
export class Operator extends Expression {
    constructor() {
        super();
    }
}

/**
 * @class UnaryOperator
 * @extends Operator
 * @category AST
 */
export class UnaryOperator extends Operator {
    operator: string;
    right: Expression;

    constructor(operator: string, right: Expression) {
        super();
        this.operator = operator;
        this.right = right;
    }

    get astNodeType() { return "unaryOp"; }
}

/**
 * @class BinaryOperator
 * @extends Operator
 * @category AST
 */
export class BinaryOperator extends Operator {
    operator: string;
    left: Expression;
    right: Expression;

    constructor(operator: string, left: Expression, right: Expression) {
        super();
        this.operator = operator;
        this.left = left;
        this.right = right;
    }

    get astNodeType() { return "binaryOp"; }
}

/**
 * @class SwitchCase
 * @extends Node
 * @category AST
 */
export class SwitchCase extends Node {
    constructor() {
        super();
    }
}

/**
 * @class Case
 * @extends SwitchCase
 * @category AST
 */
export class Case extends SwitchCase {
    selector: Array<string>;
    body: Array<Statement>;

    constructor(selector: Array<string>, body: Array<Statement>) {
        super();
        this.selector = selector;
        this.body = body;
    }

    get astNodeType() { return "case"; }
}

/**
 * @class Default
 * @extends SwitchCase
 * @category AST
 */
export class Default extends SwitchCase {
    body: Array<Statement>;

    constructor(body: Array<Statement>) {
        super();
        this.body = body;
    }

    get astNodeType() { return "default"; }
}

/**
 * @class Argument
 * @extends Node
 * @category AST
 */
export class Argument extends Node {
    name: string;
    type: Type;
    attributes: Array<Attribute>|null;

    constructor(name: string, type: Type, attributes: Array<Attribute>|null) {
        super();
        this.name = name;
        this.type = type;
        this.attributes = attributes;
    }

    get astNodeType() { return "argument"; }
}

/**
 * @class ElseIf
 * @extends Node
 * @category AST
 */
export class ElseIf extends Node {
    condition: Expression;
    body: Array<Statement>;

    constructor(condition: Expression, body: Array<Statement>) {
        super();
        this.condition = condition;
        this.body = body;
    }
   
    get astNodeType() { return "elseif"; }
}

/**
 * @class Member
 * @extends Node
 * @category AST
 */
export class Member extends Node {
    name: string;
    type: Type|null;
    attributes: Array<Attribute>|null;

    constructor(name: string, type: Type|null, attributes: Array<Attribute>|null) {
        super();
        this.name = name;
        this.type = type;
        this.attributes = attributes;
    }

    get astNodeType() { return "member"; }
}

/**
 * @class Attribute
 * @extends Node
 * @category AST
 */
export class Attribute extends Node {
    name: string;
    value: string|Array<string>|null;

    constructor(name: string, value: string|Array<string>|null) {
        super();
        this.name = name;
        this.value = value;
    }

    get astNodeType() { return "attribute"; }
}
