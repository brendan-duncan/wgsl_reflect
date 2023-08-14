export class ParseContext {
    constructor() {
        this.constants = new Map();
        this.aliases = new Map();
        this.structs = new Map();
    }
}
/**
 * @class Node
 * @category AST
 * Base class for AST nodes parsed from a WGSL shader.
 */
export class Node {
    constructor() { }
    get isAstNode() {
        return true;
    }
    get astNodeType() {
        return "";
    }
    evaluate(context) {
        throw new Error("Cannot evaluate node");
    }
    evaluateString(context) {
        return this.evaluate(context).toString();
    }
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
    constructor(name, args, returnType, body) {
        super();
        this.name = name;
        this.args = args;
        this.returnType = returnType;
        this.body = body;
    }
    get astNodeType() {
        return "function";
    }
}
/**
 * @class StaticAssert
 * @extends Statement
 * @category AST
 */
export class StaticAssert extends Statement {
    constructor(expression) {
        super();
        this.expression = expression;
    }
    get astNodeType() {
        return "staticAssert";
    }
}
/**
 * @class While
 * @extends Statement
 * @category AST
 */
export class While extends Statement {
    constructor(condition, body) {
        super();
        this.condition = condition;
        this.body = body;
    }
    get astNodeType() {
        return "while";
    }
}
/**
 * @class For
 * @extends Statement
 * @category AST
 */
export class For extends Statement {
    constructor(init, condition, increment, body) {
        super();
        this.init = init;
        this.condition = condition;
        this.increment = increment;
        this.body = body;
    }
    get astNodeType() {
        return "for";
    }
}
/**
 * @class Var
 * @extends Statement
 * @category AST
 */
export class Var extends Statement {
    constructor(name, type, storage, access, value) {
        super();
        this.name = name;
        this.type = type;
        this.storage = storage;
        this.access = access;
        this.value = value;
    }
    get astNodeType() {
        return "var";
    }
}
/**
 * @class Override
 * @extends Statement
 * @category AST
 */
export class Override extends Statement {
    constructor(name, type, value) {
        super();
        this.name = name;
        this.type = type;
        this.value = value;
    }
    get astNodeType() {
        return "override";
    }
}
/**
 * @class Let
 * @extends Statement
 * @category AST
 */
export class Let extends Statement {
    constructor(name, type, storage, access, value) {
        super();
        this.name = name;
        this.type = type;
        this.storage = storage;
        this.access = access;
        this.value = value;
    }
    get astNodeType() {
        return "let";
    }
}
/**
 * @class Const
 * @extends Statement
 * @category AST
 */
export class Const extends Statement {
    constructor(name, type, storage, access, value) {
        super();
        this.name = name;
        this.type = type;
        this.storage = storage;
        this.access = access;
        this.value = value;
    }
    get astNodeType() {
        return "const";
    }
    evaluate(context) {
        return this.value.evaluate(context);
    }
}
export var IncrementOperator;
(function (IncrementOperator) {
    IncrementOperator["increment"] = "++";
    IncrementOperator["decrement"] = "--";
})(IncrementOperator || (IncrementOperator = {}));
(function (IncrementOperator) {
    function parse(val) {
        const key = val;
        if (key == "parse")
            throw new Error("Invalid value for IncrementOperator");
        return IncrementOperator[key];
    }
    IncrementOperator.parse = parse;
})(IncrementOperator || (IncrementOperator = {}));
/**
 * @class Increment
 * @extends Statement
 * @category AST
 */
export class Increment extends Statement {
    constructor(operator, variable) {
        super();
        this.operator = operator;
        this.variable = variable;
    }
    get astNodeType() {
        return "increment";
    }
}
export var AssignOperator;
(function (AssignOperator) {
    AssignOperator["assign"] = "=";
    AssignOperator["addAssign"] = "+=";
    AssignOperator["subtractAssin"] = "-=";
    AssignOperator["multiplyAssign"] = "*=";
    AssignOperator["divideAssign"] = "/=";
    AssignOperator["moduloAssign"] = "%=";
    AssignOperator["andAssign"] = "&=";
    AssignOperator["orAssign"] = "|=";
    AssignOperator["xorAssign"] = "^=";
    AssignOperator["shiftLeftAssign"] = "<<=";
    AssignOperator["shiftRightAssign"] = ">>=";
})(AssignOperator || (AssignOperator = {}));
(function (AssignOperator) {
    function parse(val) {
        const key = val;
        if (key == "parse")
            throw new Error("Invalid value for AssignOperator");
        return AssignOperator[key];
    }
    AssignOperator.parse = parse;
})(AssignOperator || (AssignOperator = {}));
/**
 * @class Assign
 * @extends Statement
 * @category AST
 */
export class Assign extends Statement {
    constructor(operator, variable, value) {
        super();
        this.operator = operator;
        this.variable = variable;
        this.value = value;
    }
    get astNodeType() {
        return "assign";
    }
}
/**
 * @class Call
 * @extends Statement
 * @category AST
 */
export class Call extends Statement {
    constructor(name, args) {
        super();
        this.name = name;
        this.args = args;
    }
    get astNodeType() {
        return "call";
    }
}
/**
 * @class Loop
 * @extends Statement
 * @category AST
 */
export class Loop extends Statement {
    constructor(body, continuing) {
        super();
        this.body = body;
        this.continuing = continuing;
    }
    get astNodeType() {
        return "loop";
    }
}
/**
 * @class Switch
 * @extends Statement
 * @category AST
 */
export class Switch extends Statement {
    constructor(condition, body) {
        super();
        this.condition = condition;
        this.body = body;
    }
    get astNodeType() {
        return "body";
    }
}
/**
 * @class If
 * @extends Statement
 * @category AST
 */
export class If extends Statement {
    constructor(condition, body, elseif, _else) {
        super();
        this.condition = condition;
        this.body = body;
        this.elseif = elseif;
        this.else = _else;
    }
    get astNodeType() {
        return "if";
    }
}
/**
 * @class Return
 * @extends Statement
 * @category AST
 */
export class Return extends Statement {
    constructor(value) {
        super();
        this.value = value;
    }
    get astNodeType() {
        return "return";
    }
}
/**
 * @class Struct
 * @extends Statement
 * @category AST
 */
export class Struct extends Statement {
    constructor(name, members) {
        super();
        this.name = name;
        this.members = members;
    }
    get astNodeType() {
        return "struct";
    }
    /// Return the index of the member with the given name, or -1 if not found.
    getMemberIndex(name) {
        for (let i = 0; i < this.members.length; i++) {
            if (this.members[i].name == name)
                return i;
        }
        return -1;
    }
}
/**
 * @class Enable
 * @extends Statement
 * @category AST
 */
export class Enable extends Statement {
    constructor(name) {
        super();
        this.name = name;
    }
    get astNodeType() {
        return "enable";
    }
}
/**
 * @class Alias
 * @extends Statement
 * @category AST
 */
export class Alias extends Statement {
    constructor(name, type) {
        super();
        this.name = name;
        this.type = type;
    }
    get astNodeType() {
        return "alias";
    }
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
    get astNodeType() {
        return "discard";
    }
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
    get astNodeType() {
        return "break";
    }
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
    get astNodeType() {
        return "continue";
    }
}
/**
 * @class Type
 * @extends Node
 * @category AST
 */
export class Type extends Node {
    constructor(name) {
        super();
        this.name = name;
    }
    get astNodeType() {
        return "type";
    }
}
/**
 * @class TemplateType
 * @extends Type
 * @category AST
 */
export class TemplateType extends Type {
    constructor(name, format, access) {
        super(name);
        this.format = format;
        this.access = access;
    }
    get astNodeType() {
        return "template";
    }
}
/**
 * @class PointerType
 * @extends Type
 * @category AST
 */
export class PointerType extends Type {
    constructor(name, storage, type, access) {
        super(name);
        this.storage = storage;
        this.type = type;
        this.access = access;
    }
    get astNodeType() {
        return "pointer";
    }
}
/**
 * @class ArrayType
 * @extends Type
 * @category AST
 */
export class ArrayType extends Type {
    constructor(name, attributes, format, count) {
        super(name);
        this.attributes = attributes;
        this.format = format;
        this.count = count;
    }
    get astNodeType() {
        return "array";
    }
}
/**
 * @class SamplerType
 * @extends Type
 * @category AST
 */
export class SamplerType extends Type {
    constructor(name, format, access) {
        super(name);
        this.format = format;
        this.access = access;
    }
    get astNodeType() {
        return "sampler";
    }
}
/**
 * @class Expression
 * @extends Node
 * @category AST
 */
export class Expression extends Node {
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
    constructor(value) {
        super();
        this.value = value;
    }
    get astNodeType() {
        return "stringExpr";
    }
    toString() {
        return this.value;
    }
    evaluateString() {
        return this.value;
    }
}
/**
 * @class CreateExpr
 * @extends Expression
 * @category AST
 */
export class CreateExpr extends Expression {
    constructor(type, args) {
        super();
        this.type = type;
        this.args = args;
    }
    get astNodeType() {
        return "createExpr";
    }
}
/**
 * @class CallExpr
 * @extends Expression
 * @category AST
 */
export class CallExpr extends Expression {
    constructor(name, args) {
        super();
        this.name = name;
        this.args = args;
    }
    get astNodeType() {
        return "callExpr";
    }
    evaluate(context) {
        switch (this.name) {
            case "abs":
                return Math.abs(this.args[0].evaluate(context));
            case "acos":
                return Math.acos(this.args[0].evaluate(context));
            case "acosh":
                return Math.acosh(this.args[0].evaluate(context));
            case "asin":
                return Math.asin(this.args[0].evaluate(context));
            case "asinh":
                return Math.asinh(this.args[0].evaluate(context));
            case "atan":
                return Math.atan(this.args[0].evaluate(context));
            case "atan2":
                return Math.atan2(this.args[0].evaluate(context), this.args[1].evaluate(context));
            case "atanh":
                return Math.atanh(this.args[0].evaluate(context));
            case "ceil":
                return Math.ceil(this.args[0].evaluate(context));
            case "clamp":
                return Math.min(Math.max(this.args[0].evaluate(context), this.args[1].evaluate(context)), this.args[2].evaluate(context));
            case "cos":
                return Math.cos(this.args[0].evaluate(context));
            //case "cross":
            //TODO: (x[i] * y[j] - x[j] * y[i])
            case "degrees":
                return (this.args[0].evaluate(context) * 180) / Math.PI;
            //case "determinant":
            //TODO implement
            case "distance":
                return Math.sqrt(Math.pow(this.args[0].evaluate(context) - this.args[1].evaluate(context), 2));
            case "dot":
            //TODO: (x[i] * y[i])
            case "exp":
                return Math.exp(this.args[0].evaluate(context));
            case "exp2":
                return Math.pow(2, this.args[0].evaluate(context));
            //case "extractBits":
            //TODO: implement
            //case "firstLeadingBit":
            //TODO: implement
            case "floor":
                return Math.floor(this.args[0].evaluate(context));
            case "fma":
                return (this.args[0].evaluate(context) * this.args[1].evaluate(context) +
                    this.args[2].evaluate(context));
            case "fract":
                return (this.args[0].evaluate(context) -
                    Math.floor(this.args[0].evaluate(context)));
            //case "frexp":
            //TODO: implement
            case "inverseSqrt":
                return 1 / Math.sqrt(this.args[0].evaluate(context));
            //case "length":
            //TODO: implement
            case "log":
                return Math.log(this.args[0].evaluate(context));
            case "log2":
                return Math.log2(this.args[0].evaluate(context));
            case "max":
                return Math.max(this.args[0].evaluate(context), this.args[1].evaluate(context));
            case "min":
                return Math.min(this.args[0].evaluate(context), this.args[1].evaluate(context));
            case "mix":
                return (this.args[0].evaluate(context) *
                    (1 - this.args[2].evaluate(context)) +
                    this.args[1].evaluate(context) * this.args[2].evaluate(context));
            case "modf":
                return (this.args[0].evaluate(context) -
                    Math.floor(this.args[0].evaluate(context)));
            case "pow":
                return Math.pow(this.args[0].evaluate(context), this.args[1].evaluate(context));
            case "radians":
                return (this.args[0].evaluate(context) * Math.PI) / 180;
            case "round":
                return Math.round(this.args[0].evaluate(context));
            case "sign":
                return Math.sign(this.args[0].evaluate(context));
            case "sin":
                return Math.sin(this.args[0].evaluate(context));
            case "sinh":
                return Math.sinh(this.args[0].evaluate(context));
            case "saturate":
                return Math.min(Math.max(this.args[0].evaluate(context), 0), 1);
            case "smoothstep":
                return (this.args[0].evaluate(context) *
                    this.args[0].evaluate(context) *
                    (3 - 2 * this.args[0].evaluate(context)));
            case "sqrt":
                return Math.sqrt(this.args[0].evaluate(context));
            case "step":
                return this.args[0].evaluate(context) < this.args[1].evaluate(context)
                    ? 0
                    : 1;
            case "tan":
                return Math.tan(this.args[0].evaluate(context));
            case "tanh":
                return Math.tanh(this.args[0].evaluate(context));
            case "trunc":
                return Math.trunc(this.args[0].evaluate(context));
            default:
                throw new Error("Non const function: " + this.name);
        }
    }
}
/**
 * @class VariableExpr
 * @extends Expression
 * @category AST
 */
export class VariableExpr extends Expression {
    constructor(name) {
        super();
        this.name = name;
    }
    get astNodeType() {
        return "varExpr";
    }
}
/**
 * @class ConstExpr
 * @extends Expression
 * @category AST
 */
export class ConstExpr extends Expression {
    constructor(name, initializer) {
        super();
        this.name = name;
        this.initializer = initializer;
    }
    get astNodeType() {
        return "constExpr";
    }
    evaluate(context) {
        var _a, _b;
        if (this.initializer instanceof CreateExpr) {
            // This is a struct constant
            const property = (_a = this.postfix) === null || _a === void 0 ? void 0 : _a.evaluateString(context);
            const type = (_b = this.initializer.type) === null || _b === void 0 ? void 0 : _b.name;
            const struct = context.structs.get(type);
            const memberIndex = struct === null || struct === void 0 ? void 0 : struct.getMemberIndex(property);
            if (memberIndex != -1) {
                const value = this.initializer.args[memberIndex].evaluate(context);
                return value;
            }
            console.log(memberIndex);
        }
        return this.initializer.evaluate(context);
    }
}
/**
 * @class LiteralExpr
 * @extends Expression
 * @category AST
 */
export class LiteralExpr extends Expression {
    constructor(value) {
        super();
        this.value = value;
    }
    get astNodeType() {
        return "literalExpr";
    }
    evaluate() {
        return this.value;
    }
}
/**
 * @class BitcastExpr
 * @extends Expression
 * @category AST
 */
export class BitcastExpr extends Expression {
    constructor(type, value) {
        super();
        this.type = type;
        this.value = value;
    }
    get astNodeType() {
        return "bitcastExpr";
    }
}
/**
 * @class TypecastExpr
 * @extends Expression
 * @category AST
 */
export class TypecastExpr extends Expression {
    constructor(type, args) {
        super();
        this.type = type;
        this.args = args;
    }
    get astNodeType() {
        return "typecastExpr";
    }
    evaluate(context) {
        return this.args[0].evaluate(context);
    }
}
/**
 * @class GroupingExpr
 * @extends Expression
 * @category AST
 */
export class GroupingExpr extends Expression {
    constructor(contents) {
        super();
        this.contents = contents;
    }
    get astNodeType() {
        return "groupExpr";
    }
    evaluate(context) {
        return this.contents[0].evaluate(context);
    }
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
 * @property {string} operator +, -, !, ~
 */
export class UnaryOperator extends Operator {
    constructor(operator, right) {
        super();
        this.operator = operator;
        this.right = right;
    }
    get astNodeType() {
        return "unaryOp";
    }
    evaluate(context) {
        switch (this.operator) {
            case "+":
                return this.right.evaluate(context);
            case "-":
                return -this.right.evaluate(context);
            case "!":
                return this.right.evaluate(context) ? 0 : 1;
            case "~":
                return ~this.right.evaluate(context);
            default:
                throw new Error("Unknown unary operator: " + this.operator);
        }
    }
}
/**
 * @class BinaryOperator
 * @extends Operator
 * @category AST
 * @property {string} operator +, -, *, /, %, ==, !=, <, >, <=, >=, &&, ||
 */
export class BinaryOperator extends Operator {
    constructor(operator, left, right) {
        super();
        this.operator = operator;
        this.left = left;
        this.right = right;
    }
    get astNodeType() {
        return "binaryOp";
    }
    evaluate(context) {
        switch (this.operator) {
            case "+":
                return this.left.evaluate(context) + this.right.evaluate(context);
            case "-":
                return this.left.evaluate(context) - this.right.evaluate(context);
            case "*":
                return this.left.evaluate(context) * this.right.evaluate(context);
            case "/":
                return this.left.evaluate(context) / this.right.evaluate(context);
            case "%":
                return this.left.evaluate(context) % this.right.evaluate(context);
            case "==":
                return this.left.evaluate(context) == this.right.evaluate(context)
                    ? 1
                    : 0;
            case "!=":
                return this.left.evaluate(context) != this.right.evaluate(context)
                    ? 1
                    : 0;
            case "<":
                return this.left.evaluate(context) < this.right.evaluate(context)
                    ? 1
                    : 0;
            case ">":
                return this.left.evaluate(context) > this.right.evaluate(context)
                    ? 1
                    : 0;
            case "<=":
                return this.left.evaluate(context) <= this.right.evaluate(context)
                    ? 1
                    : 0;
            case ">=":
                return this.left.evaluate(context) >= this.right.evaluate(context)
                    ? 1
                    : 0;
            case "&&":
                return this.left.evaluate(context) && this.right.evaluate(context)
                    ? 1
                    : 0;
            case "||":
                return this.left.evaluate(context) || this.right.evaluate(context)
                    ? 1
                    : 0;
            default:
                throw new Error(`Unknown operator ${this.operator}`);
        }
    }
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
    constructor(selector, body) {
        super();
        this.selector = selector;
        this.body = body;
    }
    get astNodeType() {
        return "case";
    }
}
/**
 * @class Default
 * @extends SwitchCase
 * @category AST
 */
export class Default extends SwitchCase {
    constructor(body) {
        super();
        this.body = body;
    }
    get astNodeType() {
        return "default";
    }
}
/**
 * @class Argument
 * @extends Node
 * @category AST
 */
export class Argument extends Node {
    constructor(name, type, attributes) {
        super();
        this.name = name;
        this.type = type;
        this.attributes = attributes;
    }
    get astNodeType() {
        return "argument";
    }
}
/**
 * @class ElseIf
 * @extends Node
 * @category AST
 */
export class ElseIf extends Node {
    constructor(condition, body) {
        super();
        this.condition = condition;
        this.body = body;
    }
    get astNodeType() {
        return "elseif";
    }
}
/**
 * @class Member
 * @extends Node
 * @category AST
 */
export class Member extends Node {
    constructor(name, type, attributes) {
        super();
        this.name = name;
        this.type = type;
        this.attributes = attributes;
    }
    get astNodeType() {
        return "member";
    }
}
/**
 * @class Attribute
 * @extends Node
 * @category AST
 */
export class Attribute extends Node {
    constructor(name, value) {
        super();
        this.name = name;
        this.value = value;
    }
    get astNodeType() {
        return "attribute";
    }
}
//# sourceMappingURL=wgsl_ast.js.map