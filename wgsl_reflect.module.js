class ParseContext {
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
class Node {
    constructor() {
        this.line = 0;
    }
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
    search(callback) { }
    searchBlock(block, callback) {
        if (block) {
            callback(_BlockStart.instance);
            for (const node of block) {
                if (node instanceof Array) {
                    this.searchBlock(node, callback);
                }
                else {
                    node.search(callback);
                }
            }
            callback(_BlockEnd.instance);
        }
    }
}
// For internal use only
class _BlockStart extends Node {
}
_BlockStart.instance = new _BlockStart();
// For internal use only
class _BlockEnd extends Node {
}
_BlockEnd.instance = new _BlockEnd();
/**
 * @class Statement
 * @extends Node
 * @category AST
 */
class Statement extends Node {
    constructor() {
        super();
    }
}
/**
 * @class Function
 * @extends Statement
 * @category AST
 */
class Function$1 extends Statement {
    constructor(name, args, returnType, body, startLine, endLine) {
        super();
        this.calls = new Set();
        this.name = name;
        this.args = args;
        this.returnType = returnType;
        this.body = body;
        this.startLine = startLine;
        this.endLine = endLine;
    }
    get astNodeType() {
        return "function";
    }
    search(callback) {
        this.searchBlock(this.body, callback);
    }
}
/**
 * @class StaticAssert
 * @extends Statement
 * @category AST
 */
class StaticAssert extends Statement {
    constructor(expression) {
        super();
        this.expression = expression;
    }
    get astNodeType() {
        return "staticAssert";
    }
    search(callback) {
        this.expression.search(callback);
    }
}
/**
 * @class While
 * @extends Statement
 * @category AST
 */
class While extends Statement {
    constructor(condition, body) {
        super();
        this.condition = condition;
        this.body = body;
    }
    get astNodeType() {
        return "while";
    }
    search(callback) {
        this.condition.search(callback);
        this.searchBlock(this.body, callback);
    }
}
/**
 * @class Continuing
 * @extends Statement
 * @category AST
 */
class Continuing extends Statement {
    constructor(body) {
        super();
        this.body = body;
    }
    get astNodeType() {
        return "continuing";
    }
    search(callback) {
        this.searchBlock(this.body, callback);
    }
}
/**
 * @class For
 * @extends Statement
 * @category AST
 */
class For extends Statement {
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
    search(callback) {
        var _a, _b, _c;
        (_a = this.init) === null || _a === void 0 ? void 0 : _a.search(callback);
        (_b = this.condition) === null || _b === void 0 ? void 0 : _b.search(callback);
        (_c = this.increment) === null || _c === void 0 ? void 0 : _c.search(callback);
        this.searchBlock(this.body, callback);
    }
}
/**
 * @class Var
 * @extends Statement
 * @category AST
 */
class Var$1 extends Statement {
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
    search(callback) {
        var _a;
        callback(this);
        (_a = this.value) === null || _a === void 0 ? void 0 : _a.search(callback);
    }
}
/**
 * @class Override
 * @extends Statement
 * @category AST
 */
class Override extends Statement {
    constructor(name, type, value) {
        super();
        this.name = name;
        this.type = type;
        this.value = value;
    }
    get astNodeType() {
        return "override";
    }
    search(callback) {
        var _a;
        (_a = this.value) === null || _a === void 0 ? void 0 : _a.search(callback);
    }
}
/**
 * @class Let
 * @extends Statement
 * @category AST
 */
class Let extends Statement {
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
    search(callback) {
        var _a;
        callback(this);
        (_a = this.value) === null || _a === void 0 ? void 0 : _a.search(callback);
    }
}
/**
 * @class Const
 * @extends Statement
 * @category AST
 */
class Const extends Statement {
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
    search(callback) {
        var _a;
        callback(this);
        (_a = this.value) === null || _a === void 0 ? void 0 : _a.search(callback);
    }
}
var IncrementOperator;
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
class Increment extends Statement {
    constructor(operator, variable) {
        super();
        this.operator = operator;
        this.variable = variable;
    }
    get astNodeType() {
        return "increment";
    }
    search(callback) {
        this.variable.search(callback);
    }
}
var AssignOperator;
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
        if (key == "parse") {
            throw new Error("Invalid value for AssignOperator");
        }
        //return AssignOperator[key];
        return key;
    }
    AssignOperator.parse = parse;
})(AssignOperator || (AssignOperator = {}));
/**
 * @class Assign
 * @extends Statement
 * @category AST
 */
class Assign extends Statement {
    constructor(operator, variable, value) {
        super();
        this.operator = operator;
        this.variable = variable;
        this.value = value;
    }
    get astNodeType() {
        return "assign";
    }
    search(callback) {
        this.variable.search(callback);
        this.value.search(callback);
    }
}
/**
 * @class Call
 * @extends Statement
 * @category AST
 */
class Call extends Statement {
    constructor(name, args) {
        super();
        this.name = name;
        this.args = args;
    }
    get astNodeType() {
        return "call";
    }
    search(callback) {
        for (const node of this.args) {
            node.search(callback);
        }
        callback(this);
    }
}
/**
 * @class Loop
 * @extends Statement
 * @category AST
 */
class Loop extends Statement {
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
class Switch extends Statement {
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
class If extends Statement {
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
    search(callback) {
        this.condition.search(callback);
        this.searchBlock(this.body, callback);
        this.searchBlock(this.elseif, callback);
        this.searchBlock(this.else, callback);
    }
}
/**
 * @class Return
 * @extends Statement
 * @category AST
 */
class Return extends Statement {
    constructor(value) {
        super();
        this.value = value;
    }
    get astNodeType() {
        return "return";
    }
    search(callback) {
        var _a;
        (_a = this.value) === null || _a === void 0 ? void 0 : _a.search(callback);
    }
}
/**
 * @class Enable
 * @extends Statement
 * @category AST
 */
class Enable extends Statement {
    constructor(name) {
        super();
        this.name = name;
    }
    get astNodeType() {
        return "enable";
    }
}
/**
 * @class Requires
 * @extends Statement
 * @category AST
 */
class Requires extends Statement {
    constructor(extensions) {
        super();
        this.extensions = extensions;
    }
    get astNodeType() {
        return "requires";
    }
}
/**
 * @class Diagnostic
 * @extends Statement
 * @category AST
 */
class Diagnostic extends Statement {
    constructor(severity, rule) {
        super();
        this.severity = severity;
        this.rule = rule;
    }
    get astNodeType() {
        return "diagnostic";
    }
}
/**
 * @class Alias
 * @extends Statement
 * @category AST
 */
class Alias extends Statement {
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
class Discard extends Statement {
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
class Break extends Statement {
    constructor() {
        super();
        this.condition = null;
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
class Continue extends Statement {
    constructor() {
        super();
    }
    get astNodeType() {
        return "continue";
    }
}
/**
 * @class Type
 * @extends Statement
 * @category AST
 */
class Type extends Statement {
    constructor(name) {
        super();
        this.name = name;
    }
    get astNodeType() {
        return "type";
    }
    get isStruct() {
        return false;
    }
    get isArray() {
        return false;
    }
}
Type.f32 = new Type("f32");
Type.i32 = new Type("i32");
Type.u32 = new Type("u32");
Type.f16 = new Type("f16");
Type.bool = new Type("bool");
/**
 * @class StructType
 * @extends Type
 * @category AST
 */
class Struct extends Type {
    constructor(name, members, startLine, endLine) {
        super(name);
        this.members = members;
        this.startLine = startLine;
        this.endLine = endLine;
    }
    get astNodeType() {
        return "struct";
    }
    get isStruct() {
        return true;
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
 * @class TemplateType
 * @extends Type
 * @category AST
 */
class TemplateType extends Type {
    constructor(name, format, access) {
        super(name);
        this.format = format;
        this.access = access;
    }
    get astNodeType() {
        return "template";
    }
}
TemplateType.vec2f = new TemplateType("vec2", Type.f32, null);
TemplateType.vec3f = new TemplateType("vec3", Type.f32, null);
TemplateType.vec4f = new TemplateType("vec4", Type.f32, null);
TemplateType.vec2i = new TemplateType("vec2", Type.i32, null);
TemplateType.vec3i = new TemplateType("vec3", Type.i32, null);
TemplateType.vec4i = new TemplateType("vec4", Type.i32, null);
TemplateType.vec2u = new TemplateType("vec2", Type.u32, null);
TemplateType.vec3u = new TemplateType("vec3", Type.u32, null);
TemplateType.vec4u = new TemplateType("vec4", Type.u32, null);
TemplateType.vec2h = new TemplateType("vec2", Type.f16, null);
TemplateType.vec3h = new TemplateType("vec3", Type.f16, null);
TemplateType.vec4h = new TemplateType("vec4", Type.f16, null);
TemplateType.mat2x2f = new TemplateType("mat2x2", Type.f32, null);
TemplateType.mat2x3f = new TemplateType("mat2x3", Type.f32, null);
TemplateType.mat2x4f = new TemplateType("mat2x4", Type.f32, null);
TemplateType.mat3x2f = new TemplateType("mat3x2", Type.f32, null);
TemplateType.mat3x3f = new TemplateType("mat3x3", Type.f32, null);
TemplateType.mat3x4f = new TemplateType("mat3x4", Type.f32, null);
TemplateType.mat4x2f = new TemplateType("mat4x2", Type.f32, null);
TemplateType.mat4x3f = new TemplateType("mat4x3", Type.f32, null);
TemplateType.mat4x4f = new TemplateType("mat4x4", Type.f32, null);
TemplateType.mat2x2h = new TemplateType("mat2x2", Type.f16, null);
TemplateType.mat2x3h = new TemplateType("mat2x3", Type.f16, null);
TemplateType.mat2x4h = new TemplateType("mat2x4", Type.f16, null);
TemplateType.mat3x2h = new TemplateType("mat3x2", Type.f16, null);
TemplateType.mat3x3h = new TemplateType("mat3x3", Type.f16, null);
TemplateType.mat3x4h = new TemplateType("mat3x4", Type.f16, null);
TemplateType.mat4x2h = new TemplateType("mat4x2", Type.f16, null);
TemplateType.mat4x3h = new TemplateType("mat4x3", Type.f16, null);
TemplateType.mat4x4h = new TemplateType("mat4x4", Type.f16, null);
/**
 * @class PointerType
 * @extends Type
 * @category AST
 */
class PointerType extends Type {
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
class ArrayType extends Type {
    constructor(name, attributes, format, count) {
        super(name);
        this.attributes = attributes;
        this.format = format;
        this.count = count;
    }
    get astNodeType() {
        return "array";
    }
    get isArray() {
        return true;
    }
}
/**
 * @class SamplerType
 * @extends Type
 * @category AST
 */
class SamplerType extends Type {
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
class Expression extends Node {
    constructor() {
        super();
    }
}
/**
 * @class StringExpr
 * @extends Expression
 * @category AST
 */
class StringExpr extends Expression {
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
class CreateExpr extends Expression {
    constructor(type, args) {
        super();
        this.type = type;
        this.args = args;
    }
    get astNodeType() {
        return "createExpr";
    }
    search(callback) {
        callback(this);
        if (this.args) {
            for (const node of this.args) {
                node.search(callback);
            }
        }
    }
    evaluate(context) {
        return this.args[0].evaluate(context);
    }
}
/**
 * @class CallExpr
 * @extends Expression
 * @category AST
 */
class CallExpr extends Expression {
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
    search(callback) {
        for (const node of this.args) {
            node.search(callback);
        }
        callback(this);
    }
}
/**
 * @class VariableExpr
 * @extends Expression
 * @category AST
 */
class VariableExpr extends Expression {
    constructor(name) {
        super();
        this.name = name;
    }
    get astNodeType() {
        return "varExpr";
    }
    search(callback) {
        callback(this);
        if (this.postfix) {
            this.postfix.search(callback);
        }
    }
    evaluate(context) {
        const constant = context.constants.get(this.name);
        if (!constant) {
            throw new Error("Cannot evaluate node");
        }
        return constant.evaluate(context);
    }
}
/**
 * @class ConstExpr
 * @extends Expression
 * @category AST
 */
class ConstExpr extends Expression {
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
            if (memberIndex !== undefined && memberIndex != -1) {
                const value = this.initializer.args[memberIndex].evaluate(context);
                return value;
            }
            else {
                return this.initializer.evaluate(context);
            }
        }
        return this.initializer.evaluate(context);
    }
    search(callback) {
        this.initializer.search(callback);
    }
}
/**
 * @class LiteralExpr
 * @extends Expression
 * @category AST
 */
class LiteralExpr extends Expression {
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
class BitcastExpr extends Expression {
    constructor(type, value) {
        super();
        this.type = type;
        this.value = value;
    }
    get astNodeType() {
        return "bitcastExpr";
    }
    search(callback) {
        this.value.search(callback);
    }
}
/**
 * @class TypecastExpr
 * @extends Expression
 * @category AST
 */
class TypecastExpr extends Expression {
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
    search(callback) {
        this.searchBlock(this.args, callback);
    }
}
/**
 * @class GroupingExpr
 * @extends Expression
 * @category AST
 */
class GroupingExpr extends Expression {
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
    search(callback) {
        this.searchBlock(this.contents, callback);
    }
}
/**
 * @class ArrayIndex
 * @extends Expression
 * @category AST
 */
class ArrayIndex extends Expression {
    constructor(index) {
        super();
        this.index = index;
    }
    search(callback) {
        this.index.search(callback);
    }
}
/**
 * @class Operator
 * @extends Expression
 * @category AST
 */
class Operator extends Expression {
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
class UnaryOperator extends Operator {
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
    search(callback) {
        this.right.search(callback);
    }
}
/**
 * @class BinaryOperator
 * @extends Operator
 * @category AST
 * @property {string} operator +, -, *, /, %, ==, !=, <, >, <=, >=, &&, ||
 */
class BinaryOperator extends Operator {
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
            case "<":
                return this.left.evaluate(context) < this.right.evaluate(context)
                    ? 1
                    : 0;
            case ">":
                return this.left.evaluate(context) > this.right.evaluate(context)
                    ? 1
                    : 0;
            case "==":
                return this.left.evaluate(context) == this.right.evaluate(context)
                    ? 1
                    : 0;
            case "!=":
                return this.left.evaluate(context) != this.right.evaluate(context)
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
    search(callback) {
        this.left.search(callback);
        this.right.search(callback);
    }
}
/**
 * @class SwitchCase
 * @extends Node
 * @category AST
 */
class SwitchCase extends Node {
    constructor() {
        super();
    }
}
/**
 * @class Case
 * @extends SwitchCase
 * @category AST
 */
class Case extends SwitchCase {
    constructor(selector, body) {
        super();
        this.selector = selector;
        this.body = body;
    }
    get astNodeType() {
        return "case";
    }
    search(callback) {
        this.searchBlock(this.body, callback);
    }
}
/**
 * @class Default
 * @extends SwitchCase
 * @category AST
 */
class Default extends SwitchCase {
    constructor(body) {
        super();
        this.body = body;
    }
    get astNodeType() {
        return "default";
    }
    search(callback) {
        this.searchBlock(this.body, callback);
    }
}
/**
 * @class Argument
 * @extends Node
 * @category AST
 */
class Argument extends Node {
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
class ElseIf extends Node {
    constructor(condition, body) {
        super();
        this.condition = condition;
        this.body = body;
    }
    get astNodeType() {
        return "elseif";
    }
    search(callback) {
        this.condition.search(callback);
        this.searchBlock(this.body, callback);
    }
}
/**
 * @class Member
 * @extends Node
 * @category AST
 */
class Member extends Node {
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
class Attribute extends Node {
    constructor(name, value) {
        super();
        this.name = name;
        this.value = value;
    }
    get astNodeType() {
        return "attribute";
    }
}

var _a;
var TokenClass;
(function (TokenClass) {
    TokenClass[TokenClass["token"] = 0] = "token";
    TokenClass[TokenClass["keyword"] = 1] = "keyword";
    TokenClass[TokenClass["reserved"] = 2] = "reserved";
})(TokenClass || (TokenClass = {}));
class TokenType {
    constructor(name, type, rule) {
        this.name = name;
        this.type = type;
        this.rule = rule;
    }
    toString() {
        return this.name;
    }
}
/// Catalog of defined token types, keywords, and reserved words.
class TokenTypes {
}
_a = TokenTypes;
TokenTypes.none = new TokenType("", TokenClass.reserved, "");
TokenTypes.eof = new TokenType("EOF", TokenClass.token, "");
TokenTypes.reserved = {
    asm: new TokenType("asm", TokenClass.reserved, "asm"),
    bf16: new TokenType("bf16", TokenClass.reserved, "bf16"),
    do: new TokenType("do", TokenClass.reserved, "do"),
    enum: new TokenType("enum", TokenClass.reserved, "enum"),
    f16: new TokenType("f16", TokenClass.reserved, "f16"),
    f64: new TokenType("f64", TokenClass.reserved, "f64"),
    handle: new TokenType("handle", TokenClass.reserved, "handle"),
    i8: new TokenType("i8", TokenClass.reserved, "i8"),
    i16: new TokenType("i16", TokenClass.reserved, "i16"),
    i64: new TokenType("i64", TokenClass.reserved, "i64"),
    mat: new TokenType("mat", TokenClass.reserved, "mat"),
    premerge: new TokenType("premerge", TokenClass.reserved, "premerge"),
    regardless: new TokenType("regardless", TokenClass.reserved, "regardless"),
    typedef: new TokenType("typedef", TokenClass.reserved, "typedef"),
    u8: new TokenType("u8", TokenClass.reserved, "u8"),
    u16: new TokenType("u16", TokenClass.reserved, "u16"),
    u64: new TokenType("u64", TokenClass.reserved, "u64"),
    unless: new TokenType("unless", TokenClass.reserved, "unless"),
    using: new TokenType("using", TokenClass.reserved, "using"),
    vec: new TokenType("vec", TokenClass.reserved, "vec"),
    void: new TokenType("void", TokenClass.reserved, "void"),
};
TokenTypes.keywords = {
    array: new TokenType("array", TokenClass.keyword, "array"),
    atomic: new TokenType("atomic", TokenClass.keyword, "atomic"),
    bool: new TokenType("bool", TokenClass.keyword, "bool"),
    f32: new TokenType("f32", TokenClass.keyword, "f32"),
    i32: new TokenType("i32", TokenClass.keyword, "i32"),
    mat2x2: new TokenType("mat2x2", TokenClass.keyword, "mat2x2"),
    mat2x3: new TokenType("mat2x3", TokenClass.keyword, "mat2x3"),
    mat2x4: new TokenType("mat2x4", TokenClass.keyword, "mat2x4"),
    mat3x2: new TokenType("mat3x2", TokenClass.keyword, "mat3x2"),
    mat3x3: new TokenType("mat3x3", TokenClass.keyword, "mat3x3"),
    mat3x4: new TokenType("mat3x4", TokenClass.keyword, "mat3x4"),
    mat4x2: new TokenType("mat4x2", TokenClass.keyword, "mat4x2"),
    mat4x3: new TokenType("mat4x3", TokenClass.keyword, "mat4x3"),
    mat4x4: new TokenType("mat4x4", TokenClass.keyword, "mat4x4"),
    ptr: new TokenType("ptr", TokenClass.keyword, "ptr"),
    sampler: new TokenType("sampler", TokenClass.keyword, "sampler"),
    sampler_comparison: new TokenType("sampler_comparison", TokenClass.keyword, "sampler_comparison"),
    struct: new TokenType("struct", TokenClass.keyword, "struct"),
    texture_1d: new TokenType("texture_1d", TokenClass.keyword, "texture_1d"),
    texture_2d: new TokenType("texture_2d", TokenClass.keyword, "texture_2d"),
    texture_2d_array: new TokenType("texture_2d_array", TokenClass.keyword, "texture_2d_array"),
    texture_3d: new TokenType("texture_3d", TokenClass.keyword, "texture_3d"),
    texture_cube: new TokenType("texture_cube", TokenClass.keyword, "texture_cube"),
    texture_cube_array: new TokenType("texture_cube_array", TokenClass.keyword, "texture_cube_array"),
    texture_multisampled_2d: new TokenType("texture_multisampled_2d", TokenClass.keyword, "texture_multisampled_2d"),
    texture_storage_1d: new TokenType("texture_storage_1d", TokenClass.keyword, "texture_storage_1d"),
    texture_storage_2d: new TokenType("texture_storage_2d", TokenClass.keyword, "texture_storage_2d"),
    texture_storage_2d_array: new TokenType("texture_storage_2d_array", TokenClass.keyword, "texture_storage_2d_array"),
    texture_storage_3d: new TokenType("texture_storage_3d", TokenClass.keyword, "texture_storage_3d"),
    texture_depth_2d: new TokenType("texture_depth_2d", TokenClass.keyword, "texture_depth_2d"),
    texture_depth_2d_array: new TokenType("texture_depth_2d_array", TokenClass.keyword, "texture_depth_2d_array"),
    texture_depth_cube: new TokenType("texture_depth_cube", TokenClass.keyword, "texture_depth_cube"),
    texture_depth_cube_array: new TokenType("texture_depth_cube_array", TokenClass.keyword, "texture_depth_cube_array"),
    texture_depth_multisampled_2d: new TokenType("texture_depth_multisampled_2d", TokenClass.keyword, "texture_depth_multisampled_2d"),
    texture_external: new TokenType("texture_external", TokenClass.keyword, "texture_external"),
    u32: new TokenType("u32", TokenClass.keyword, "u32"),
    vec2: new TokenType("vec2", TokenClass.keyword, "vec2"),
    vec3: new TokenType("vec3", TokenClass.keyword, "vec3"),
    vec4: new TokenType("vec4", TokenClass.keyword, "vec4"),
    bitcast: new TokenType("bitcast", TokenClass.keyword, "bitcast"),
    block: new TokenType("block", TokenClass.keyword, "block"),
    break: new TokenType("break", TokenClass.keyword, "break"),
    case: new TokenType("case", TokenClass.keyword, "case"),
    continue: new TokenType("continue", TokenClass.keyword, "continue"),
    continuing: new TokenType("continuing", TokenClass.keyword, "continuing"),
    default: new TokenType("default", TokenClass.keyword, "default"),
    diagnostic: new TokenType("diagnostic", TokenClass.keyword, "diagnostic"),
    discard: new TokenType("discard", TokenClass.keyword, "discard"),
    else: new TokenType("else", TokenClass.keyword, "else"),
    enable: new TokenType("enable", TokenClass.keyword, "enable"),
    fallthrough: new TokenType("fallthrough", TokenClass.keyword, "fallthrough"),
    false: new TokenType("false", TokenClass.keyword, "false"),
    fn: new TokenType("fn", TokenClass.keyword, "fn"),
    for: new TokenType("for", TokenClass.keyword, "for"),
    function: new TokenType("function", TokenClass.keyword, "function"),
    if: new TokenType("if", TokenClass.keyword, "if"),
    let: new TokenType("let", TokenClass.keyword, "let"),
    const: new TokenType("const", TokenClass.keyword, "const"),
    loop: new TokenType("loop", TokenClass.keyword, "loop"),
    while: new TokenType("while", TokenClass.keyword, "while"),
    private: new TokenType("private", TokenClass.keyword, "private"),
    read: new TokenType("read", TokenClass.keyword, "read"),
    read_write: new TokenType("read_write", TokenClass.keyword, "read_write"),
    return: new TokenType("return", TokenClass.keyword, "return"),
    requires: new TokenType("requires", TokenClass.keyword, "requires"),
    storage: new TokenType("storage", TokenClass.keyword, "storage"),
    switch: new TokenType("switch", TokenClass.keyword, "switch"),
    true: new TokenType("true", TokenClass.keyword, "true"),
    alias: new TokenType("alias", TokenClass.keyword, "alias"),
    type: new TokenType("type", TokenClass.keyword, "type"),
    uniform: new TokenType("uniform", TokenClass.keyword, "uniform"),
    var: new TokenType("var", TokenClass.keyword, "var"),
    override: new TokenType("override", TokenClass.keyword, "override"),
    workgroup: new TokenType("workgroup", TokenClass.keyword, "workgroup"),
    write: new TokenType("write", TokenClass.keyword, "write"),
    r8unorm: new TokenType("r8unorm", TokenClass.keyword, "r8unorm"),
    r8snorm: new TokenType("r8snorm", TokenClass.keyword, "r8snorm"),
    r8uint: new TokenType("r8uint", TokenClass.keyword, "r8uint"),
    r8sint: new TokenType("r8sint", TokenClass.keyword, "r8sint"),
    r16uint: new TokenType("r16uint", TokenClass.keyword, "r16uint"),
    r16sint: new TokenType("r16sint", TokenClass.keyword, "r16sint"),
    r16float: new TokenType("r16float", TokenClass.keyword, "r16float"),
    rg8unorm: new TokenType("rg8unorm", TokenClass.keyword, "rg8unorm"),
    rg8snorm: new TokenType("rg8snorm", TokenClass.keyword, "rg8snorm"),
    rg8uint: new TokenType("rg8uint", TokenClass.keyword, "rg8uint"),
    rg8sint: new TokenType("rg8sint", TokenClass.keyword, "rg8sint"),
    r32uint: new TokenType("r32uint", TokenClass.keyword, "r32uint"),
    r32sint: new TokenType("r32sint", TokenClass.keyword, "r32sint"),
    r32float: new TokenType("r32float", TokenClass.keyword, "r32float"),
    rg16uint: new TokenType("rg16uint", TokenClass.keyword, "rg16uint"),
    rg16sint: new TokenType("rg16sint", TokenClass.keyword, "rg16sint"),
    rg16float: new TokenType("rg16float", TokenClass.keyword, "rg16float"),
    rgba8unorm: new TokenType("rgba8unorm", TokenClass.keyword, "rgba8unorm"),
    rgba8unorm_srgb: new TokenType("rgba8unorm_srgb", TokenClass.keyword, "rgba8unorm_srgb"),
    rgba8snorm: new TokenType("rgba8snorm", TokenClass.keyword, "rgba8snorm"),
    rgba8uint: new TokenType("rgba8uint", TokenClass.keyword, "rgba8uint"),
    rgba8sint: new TokenType("rgba8sint", TokenClass.keyword, "rgba8sint"),
    bgra8unorm: new TokenType("bgra8unorm", TokenClass.keyword, "bgra8unorm"),
    bgra8unorm_srgb: new TokenType("bgra8unorm_srgb", TokenClass.keyword, "bgra8unorm_srgb"),
    rgb10a2unorm: new TokenType("rgb10a2unorm", TokenClass.keyword, "rgb10a2unorm"),
    rg11b10float: new TokenType("rg11b10float", TokenClass.keyword, "rg11b10float"),
    rg32uint: new TokenType("rg32uint", TokenClass.keyword, "rg32uint"),
    rg32sint: new TokenType("rg32sint", TokenClass.keyword, "rg32sint"),
    rg32float: new TokenType("rg32float", TokenClass.keyword, "rg32float"),
    rgba16uint: new TokenType("rgba16uint", TokenClass.keyword, "rgba16uint"),
    rgba16sint: new TokenType("rgba16sint", TokenClass.keyword, "rgba16sint"),
    rgba16float: new TokenType("rgba16float", TokenClass.keyword, "rgba16float"),
    rgba32uint: new TokenType("rgba32uint", TokenClass.keyword, "rgba32uint"),
    rgba32sint: new TokenType("rgba32sint", TokenClass.keyword, "rgba32sint"),
    rgba32float: new TokenType("rgba32float", TokenClass.keyword, "rgba32float"),
    static_assert: new TokenType("static_assert", TokenClass.keyword, "static_assert"),
    // WGSL grammar has a few keywords that have different token names than the strings they
    // represent. Aliasing them here.
    /*int32: new TokenType("i32", TokenClass.keyword, "i32"),
        uint32: new TokenType("u32", TokenClass.keyword, "u32"),
        float32: new TokenType("f32", TokenClass.keyword, "f32"),
        pointer: new TokenType("ptr", TokenClass.keyword, "ptr"),*/
};
TokenTypes.tokens = {
    decimal_float_literal: new TokenType("decimal_float_literal", TokenClass.token, /((-?[0-9]*\.[0-9]+|-?[0-9]+\.[0-9]*)((e|E)(\+|-)?[0-9]+)?f?)|(-?[0-9]+(e|E)(\+|-)?[0-9]+f?)|([0-9]+f)/),
    hex_float_literal: new TokenType("hex_float_literal", TokenClass.token, /-?0x((([0-9a-fA-F]*\.[0-9a-fA-F]+|[0-9a-fA-F]+\.[0-9a-fA-F]*)((p|P)(\+|-)?[0-9]+f?)?)|([0-9a-fA-F]+(p|P)(\+|-)?[0-9]+f?))/),
    int_literal: new TokenType("int_literal", TokenClass.token, /-?0x[0-9a-fA-F]+|0i?|-?[1-9][0-9]*i?/),
    uint_literal: new TokenType("uint_literal", TokenClass.token, /0x[0-9a-fA-F]+u|0u|[1-9][0-9]*u/),
    ident: new TokenType("ident", TokenClass.token, /[_a-zA-Z][0-9a-zA-Z_]*/),
    and: new TokenType("and", TokenClass.token, "&"),
    and_and: new TokenType("and_and", TokenClass.token, "&&"),
    arrow: new TokenType("arrow ", TokenClass.token, "->"),
    attr: new TokenType("attr", TokenClass.token, "@"),
    forward_slash: new TokenType("forward_slash", TokenClass.token, "/"),
    bang: new TokenType("bang", TokenClass.token, "!"),
    bracket_left: new TokenType("bracket_left", TokenClass.token, "["),
    bracket_right: new TokenType("bracket_right", TokenClass.token, "]"),
    brace_left: new TokenType("brace_left", TokenClass.token, "{"),
    brace_right: new TokenType("brace_right", TokenClass.token, "}"),
    colon: new TokenType("colon", TokenClass.token, ":"),
    comma: new TokenType("comma", TokenClass.token, ","),
    equal: new TokenType("equal", TokenClass.token, "="),
    equal_equal: new TokenType("equal_equal", TokenClass.token, "=="),
    not_equal: new TokenType("not_equal", TokenClass.token, "!="),
    greater_than: new TokenType("greater_than", TokenClass.token, ">"),
    greater_than_equal: new TokenType("greater_than_equal", TokenClass.token, ">="),
    shift_right: new TokenType("shift_right", TokenClass.token, ">>"),
    less_than: new TokenType("less_than", TokenClass.token, "<"),
    less_than_equal: new TokenType("less_than_equal", TokenClass.token, "<="),
    shift_left: new TokenType("shift_left", TokenClass.token, "<<"),
    modulo: new TokenType("modulo", TokenClass.token, "%"),
    minus: new TokenType("minus", TokenClass.token, "-"),
    minus_minus: new TokenType("minus_minus", TokenClass.token, "--"),
    period: new TokenType("period", TokenClass.token, "."),
    plus: new TokenType("plus", TokenClass.token, "+"),
    plus_plus: new TokenType("plus_plus", TokenClass.token, "++"),
    or: new TokenType("or", TokenClass.token, "|"),
    or_or: new TokenType("or_or", TokenClass.token, "||"),
    paren_left: new TokenType("paren_left", TokenClass.token, "("),
    paren_right: new TokenType("paren_right", TokenClass.token, ")"),
    semicolon: new TokenType("semicolon", TokenClass.token, ";"),
    star: new TokenType("star", TokenClass.token, "*"),
    tilde: new TokenType("tilde", TokenClass.token, "~"),
    underscore: new TokenType("underscore", TokenClass.token, "_"),
    xor: new TokenType("xor", TokenClass.token, "^"),
    plus_equal: new TokenType("plus_equal", TokenClass.token, "+="),
    minus_equal: new TokenType("minus_equal", TokenClass.token, "-="),
    times_equal: new TokenType("times_equal", TokenClass.token, "*="),
    division_equal: new TokenType("division_equal", TokenClass.token, "/="),
    modulo_equal: new TokenType("modulo_equal", TokenClass.token, "%="),
    and_equal: new TokenType("and_equal", TokenClass.token, "&="),
    or_equal: new TokenType("or_equal", TokenClass.token, "|="),
    xor_equal: new TokenType("xor_equal", TokenClass.token, "^="),
    shift_right_equal: new TokenType("shift_right_equal", TokenClass.token, ">>="),
    shift_left_equal: new TokenType("shift_left_equal", TokenClass.token, "<<="),
};
TokenTypes.simpleTokens = {
    "@": _a.tokens.attr,
    "{": _a.tokens.brace_left,
    "}": _a.tokens.brace_right,
    ":": _a.tokens.colon,
    ",": _a.tokens.comma,
    "(": _a.tokens.paren_left,
    ")": _a.tokens.paren_right,
    ";": _a.tokens.semicolon,
};
TokenTypes.literalTokens = {
    "&": _a.tokens.and,
    "&&": _a.tokens.and_and,
    "->": _a.tokens.arrow,
    "/": _a.tokens.forward_slash,
    "!": _a.tokens.bang,
    "[": _a.tokens.bracket_left,
    "]": _a.tokens.bracket_right,
    "=": _a.tokens.equal,
    "==": _a.tokens.equal_equal,
    "!=": _a.tokens.not_equal,
    ">": _a.tokens.greater_than,
    ">=": _a.tokens.greater_than_equal,
    ">>": _a.tokens.shift_right,
    "<": _a.tokens.less_than,
    "<=": _a.tokens.less_than_equal,
    "<<": _a.tokens.shift_left,
    "%": _a.tokens.modulo,
    "-": _a.tokens.minus,
    "--": _a.tokens.minus_minus,
    ".": _a.tokens.period,
    "+": _a.tokens.plus,
    "++": _a.tokens.plus_plus,
    "|": _a.tokens.or,
    "||": _a.tokens.or_or,
    "*": _a.tokens.star,
    "~": _a.tokens.tilde,
    "_": _a.tokens.underscore,
    "^": _a.tokens.xor,
    "+=": _a.tokens.plus_equal,
    "-=": _a.tokens.minus_equal,
    "*=": _a.tokens.times_equal,
    "/=": _a.tokens.division_equal,
    "%=": _a.tokens.modulo_equal,
    "&=": _a.tokens.and_equal,
    "|=": _a.tokens.or_equal,
    "^=": _a.tokens.xor_equal,
    ">>=": _a.tokens.shift_right_equal,
    "<<=": _a.tokens.shift_left_equal,
};
TokenTypes.regexTokens = {
    decimal_float_literal: _a.tokens.decimal_float_literal,
    hex_float_literal: _a.tokens.hex_float_literal,
    int_literal: _a.tokens.int_literal,
    uint_literal: _a.tokens.uint_literal,
    ident: _a.tokens.ident,
};
TokenTypes.storage_class = [
    _a.keywords.function,
    _a.keywords.private,
    _a.keywords.workgroup,
    _a.keywords.uniform,
    _a.keywords.storage,
];
TokenTypes.access_mode = [
    _a.keywords.read,
    _a.keywords.write,
    _a.keywords.read_write,
];
TokenTypes.sampler_type = [
    _a.keywords.sampler,
    _a.keywords.sampler_comparison,
];
TokenTypes.sampled_texture_type = [
    _a.keywords.texture_1d,
    _a.keywords.texture_2d,
    _a.keywords.texture_2d_array,
    _a.keywords.texture_3d,
    _a.keywords.texture_cube,
    _a.keywords.texture_cube_array,
];
TokenTypes.multisampled_texture_type = [
    _a.keywords.texture_multisampled_2d,
];
TokenTypes.storage_texture_type = [
    _a.keywords.texture_storage_1d,
    _a.keywords.texture_storage_2d,
    _a.keywords.texture_storage_2d_array,
    _a.keywords.texture_storage_3d,
];
TokenTypes.depth_texture_type = [
    _a.keywords.texture_depth_2d,
    _a.keywords.texture_depth_2d_array,
    _a.keywords.texture_depth_cube,
    _a.keywords.texture_depth_cube_array,
    _a.keywords.texture_depth_multisampled_2d,
];
TokenTypes.texture_external_type = [_a.keywords.texture_external];
TokenTypes.any_texture_type = [
    ..._a.sampled_texture_type,
    ..._a.multisampled_texture_type,
    ..._a.storage_texture_type,
    ..._a.depth_texture_type,
    ..._a.texture_external_type,
];
TokenTypes.texel_format = [
    _a.keywords.r8unorm,
    _a.keywords.r8snorm,
    _a.keywords.r8uint,
    _a.keywords.r8sint,
    _a.keywords.r16uint,
    _a.keywords.r16sint,
    _a.keywords.r16float,
    _a.keywords.rg8unorm,
    _a.keywords.rg8snorm,
    _a.keywords.rg8uint,
    _a.keywords.rg8sint,
    _a.keywords.r32uint,
    _a.keywords.r32sint,
    _a.keywords.r32float,
    _a.keywords.rg16uint,
    _a.keywords.rg16sint,
    _a.keywords.rg16float,
    _a.keywords.rgba8unorm,
    _a.keywords.rgba8unorm_srgb,
    _a.keywords.rgba8snorm,
    _a.keywords.rgba8uint,
    _a.keywords.rgba8sint,
    _a.keywords.bgra8unorm,
    _a.keywords.bgra8unorm_srgb,
    _a.keywords.rgb10a2unorm,
    _a.keywords.rg11b10float,
    _a.keywords.rg32uint,
    _a.keywords.rg32sint,
    _a.keywords.rg32float,
    _a.keywords.rgba16uint,
    _a.keywords.rgba16sint,
    _a.keywords.rgba16float,
    _a.keywords.rgba32uint,
    _a.keywords.rgba32sint,
    _a.keywords.rgba32float,
];
TokenTypes.const_literal = [
    _a.tokens.int_literal,
    _a.tokens.uint_literal,
    _a.tokens.decimal_float_literal,
    _a.tokens.hex_float_literal,
    _a.keywords.true,
    _a.keywords.false,
];
TokenTypes.literal_or_ident = [
    _a.tokens.ident,
    _a.tokens.int_literal,
    _a.tokens.uint_literal,
    _a.tokens.decimal_float_literal,
    _a.tokens.hex_float_literal,
];
TokenTypes.element_count_expression = [
    _a.tokens.int_literal,
    _a.tokens.uint_literal,
    _a.tokens.ident,
];
TokenTypes.template_types = [
    _a.keywords.vec2,
    _a.keywords.vec3,
    _a.keywords.vec4,
    _a.keywords.mat2x2,
    _a.keywords.mat2x3,
    _a.keywords.mat2x4,
    _a.keywords.mat3x2,
    _a.keywords.mat3x3,
    _a.keywords.mat3x4,
    _a.keywords.mat4x2,
    _a.keywords.mat4x3,
    _a.keywords.mat4x4,
    _a.keywords.atomic,
    _a.keywords.bitcast,
    ..._a.any_texture_type,
];
// The grammar calls out 'block', but attribute grammar is defined to use a 'ident'.
// The attribute grammar should be ident | block.
TokenTypes.attribute_name = [_a.tokens.ident, _a.keywords.block, _a.keywords.diagnostic];
TokenTypes.assignment_operators = [
    _a.tokens.equal,
    _a.tokens.plus_equal,
    _a.tokens.minus_equal,
    _a.tokens.times_equal,
    _a.tokens.division_equal,
    _a.tokens.modulo_equal,
    _a.tokens.and_equal,
    _a.tokens.or_equal,
    _a.tokens.xor_equal,
    _a.tokens.shift_right_equal,
    _a.tokens.shift_left_equal,
];
TokenTypes.increment_operators = [
    _a.tokens.plus_plus,
    _a.tokens.minus_minus,
];
/// A token parsed by the WgslScanner.
class Token {
    constructor(type, lexeme, line) {
        this.type = type;
        this.lexeme = lexeme;
        this.line = line;
    }
    toString() {
        return this.lexeme;
    }
    isTemplateType() {
        return TokenTypes.template_types.indexOf(this.type) != -1;
    }
    isArrayType() {
        return this.type == TokenTypes.keywords.array;
    }
    isArrayOrTemplateType() {
        return this.isArrayType() || this.isTemplateType();
    }
}
/// Lexical scanner for the WGSL language. This takes an input source text and generates a list
/// of Token objects, which can then be fed into the WgslParser to generate an AST.
class WgslScanner {
    constructor(source) {
        this._tokens = [];
        this._start = 0;
        this._current = 0;
        this._line = 1;
        this._source = source !== null && source !== void 0 ? source : "";
    }
    /// Scan all tokens from the source.
    scanTokens() {
        while (!this._isAtEnd()) {
            this._start = this._current;
            if (!this.scanToken()) {
                throw `Invalid syntax at line ${this._line}`;
            }
        }
        this._tokens.push(new Token(TokenTypes.eof, "", this._line));
        return this._tokens;
    }
    /// Scan a single token from the source.
    scanToken() {
        // Find the longest consecutive set of characters that match a rule.
        let lexeme = this._advance();
        // Skip line-feed, adding to the line counter.
        if (lexeme == "\n") {
            this._line++;
            return true;
        }
        // Skip whitespace
        if (this._isWhitespace(lexeme)) {
            return true;
        }
        if (lexeme == "/") {
            // If it's a // comment, skip everything until the next line-feed.
            if (this._peekAhead() == "/") {
                while (lexeme != "\n") {
                    if (this._isAtEnd()) {
                        return true;
                    }
                    lexeme = this._advance();
                }
                // skip the linefeed
                this._line++;
                return true;
            }
            else if (this._peekAhead() == "*") {
                // If it's a / * block comment, skip everything until the matching * /,
                // allowing for nested block comments.
                this._advance();
                let commentLevel = 1;
                while (commentLevel > 0) {
                    if (this._isAtEnd()) {
                        return true;
                    }
                    lexeme = this._advance();
                    if (lexeme == "\n") {
                        this._line++;
                    }
                    else if (lexeme == "*") {
                        if (this._peekAhead() == "/") {
                            this._advance();
                            commentLevel--;
                            if (commentLevel == 0) {
                                return true;
                            }
                        }
                    }
                    else if (lexeme == "/") {
                        if (this._peekAhead() == "*") {
                            this._advance();
                            commentLevel++;
                        }
                    }
                }
                return true;
            }
        }
        // Shortcut single character tokens
        const simpleToken = TokenTypes.simpleTokens[lexeme];
        if (simpleToken) {
            this._addToken(simpleToken);
            return true;
        }
        // Shortcut keywords and identifiers
        let matchType = TokenTypes.none;
        const isAlpha = this._isAlpha(lexeme);
        const isUnderscore = lexeme === "_";
        if (this._isAlphaNumeric(lexeme)) {
            let nextChar = this._peekAhead();
            while (this._isAlphaNumeric(nextChar)) {
                lexeme += this._advance();
                nextChar = this._peekAhead();
            }
        }
        if (isAlpha) {
            const matchedType = TokenTypes.keywords[lexeme];
            if (matchedType) {
                this._addToken(matchedType);
                return true;
            }
        }
        if (isAlpha || isUnderscore) {
            this._addToken(TokenTypes.tokens.ident);
            return true;
        }
        // Scan for the next valid token type
        for (;;) {
            let matchedType = this._findType(lexeme);
            // An exception to "longest lexeme" rule is '>>'. In the case of 1>>2, it's a
            // shift_right.
            // In the case of array<vec4<f32>>, it's two greater_than's (one to close the vec4,
            // and one to close the array).
            // Another ambiguity is '>='. In the case of vec2<i32>=vec2(1,2),
            // it's a greather_than and an equal, not a greater_than_equal.
            // Another ambiguity is '-'. In the case of a-2, it's a minus; in the case of a*-2, it's a -2;
            // in the case of foo()->int, it's a ->; in the case of foo-- or --foo, it's a -- decrement.
            // WGSL requires context sensitive parsing to resolve these ambiguities. Both of these cases
            // are predicated on it the > either closing a template, or being part of an operator.
            // The solution here is to check if there was a less_than up to some number of tokens
            // previously, and the token prior to that is a keyword that requires a '<', then it will be
            // split into two operators; otherwise it's a single operator.
            const nextLexeme = this._peekAhead();
            if (lexeme == "-" && this._tokens.length > 0) {
                if (nextLexeme == "=") {
                    this._current++;
                    lexeme += nextLexeme;
                    this._addToken(TokenTypes.tokens.minus_equal);
                    return true;
                }
                if (nextLexeme == "-") {
                    this._current++;
                    lexeme += nextLexeme;
                    this._addToken(TokenTypes.tokens.minus_minus);
                    return true;
                }
                const ti = this._tokens.length - 1;
                const isIdentOrLiteral = TokenTypes.literal_or_ident.indexOf(this._tokens[ti].type) != -1;
                if ((isIdentOrLiteral || this._tokens[ti].type == TokenTypes.tokens.paren_right) && nextLexeme != ">") {
                    this._addToken(matchedType);
                    return true;
                }
            }
            if (lexeme == ">" && (nextLexeme == ">" || nextLexeme == "=")) {
                let foundLessThan = false;
                let ti = this._tokens.length - 1;
                for (let count = 0; count < 5 && ti >= 0; ++count, --ti) {
                    if (TokenTypes.assignment_operators.indexOf(this._tokens[ti].type) !== -1) {
                        break;
                    }
                    if (this._tokens[ti].type === TokenTypes.tokens.less_than) {
                        if (ti > 0 && this._tokens[ti - 1].isArrayOrTemplateType()) {
                            foundLessThan = true;
                        }
                        break;
                    }
                }
                // If there was a less_than in the recent token history, then this is probably a
                // greater_than.
                if (foundLessThan) {
                    this._addToken(matchedType);
                    return true;
                }
            }
            // The current lexeme may not match any rule, but some token types may be invalid for
            // part of the string but valid after a few more characters.
            // For example, 0x.5 is a hex_float_literal. But as it's being scanned,
            // "0" is a int_literal, then "0x" is invalid. If we stopped there, it would return
            // the int_literal "0", but that's incorrect. So if we look forward a few characters,
            // we'd get "0x.", which is still invalid, followed by "0x.5" which is the correct
            // hex_float_literal. So that means if we hit an non-matching string, we should look
            // ahead up to two characters to see if the string starts matching a valid rule again.
            if (matchedType === TokenTypes.none) {
                let lookAheadLexeme = lexeme;
                let lookAhead = 0;
                const maxLookAhead = 2;
                for (let li = 0; li < maxLookAhead; ++li) {
                    lookAheadLexeme += this._peekAhead(li);
                    matchedType = this._findType(lookAheadLexeme);
                    if (matchedType !== TokenTypes.none) {
                        lookAhead = li;
                        break;
                    }
                }
                if (matchedType === TokenTypes.none) {
                    if (matchType === TokenTypes.none) {
                        return false;
                    }
                    this._current--;
                    this._addToken(matchType);
                    return true;
                }
                lexeme = lookAheadLexeme;
                this._current += lookAhead + 1;
            }
            matchType = matchedType;
            if (this._isAtEnd()) {
                break;
            }
            lexeme += this._advance();
        }
        // We got to the end of the input stream. Then the token we've ready so far is it.
        if (matchType === TokenTypes.none) {
            return false;
        }
        this._addToken(matchType);
        return true;
    }
    _findType(lexeme) {
        for (const name in TokenTypes.regexTokens) {
            const type = TokenTypes.regexTokens[name];
            if (this._match(lexeme, type.rule)) {
                return type;
            }
        }
        const type = TokenTypes.literalTokens[lexeme];
        if (type) {
            return type;
        }
        return TokenTypes.none;
    }
    _match(lexeme, rule) {
        const match = rule.exec(lexeme);
        return match && match.index == 0 && match[0] == lexeme;
    }
    _isAtEnd() {
        return this._current >= this._source.length;
    }
    _isAlpha(c) {
        return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
    }
    _isAlphaNumeric(c) {
        return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c == "_" || (c >= "0" && c <= "9");
    }
    _isWhitespace(c) {
        return c == " " || c == "\t" || c == "\r";
    }
    _advance(amount = 0) {
        let c = this._source[this._current];
        amount = amount || 0;
        amount++;
        this._current += amount;
        return c;
    }
    _peekAhead(offset = 0) {
        offset = offset || 0;
        if (this._current + offset >= this._source.length) {
            return "\0";
        }
        return this._source[this._current + offset];
    }
    _addToken(type) {
        const text = this._source.substring(this._start, this._current);
        this._tokens.push(new Token(type, text, this._line));
    }
}

/**
 * @author Brendan Duncan / https://github.com/brendan-duncan
 */
/// Parse a sequence of tokens from the WgslScanner into an Abstract Syntax Tree (AST).
class WgslParser {
    constructor() {
        this._tokens = [];
        this._current = 0;
        this._currentLine = 0;
        this._context = new ParseContext();
        this._deferArrayCountEval = [];
    }
    parse(tokensOrCode) {
        this._initialize(tokensOrCode);
        this._deferArrayCountEval.length = 0;
        const statements = [];
        while (!this._isAtEnd()) {
            const statement = this._global_decl_or_directive();
            if (!statement) {
                break;
            }
            statements.push(statement);
        }
        // Since constants can be declared after they are used, and
        // constants can be used to size arrays, defer calculating the
        // size until after the shader has finished parsing.
        if (this._deferArrayCountEval.length > 0) {
            for (const arrayDecl of this._deferArrayCountEval) {
                const arrayType = arrayDecl["arrayType"];
                const countNode = arrayDecl["countNode"];
                if (countNode instanceof VariableExpr) {
                    const variable = countNode;
                    const name = variable.name;
                    const constant = this._context.constants.get(name);
                    if (constant) {
                        try {
                            const count = constant.evaluate(this._context);
                            arrayType.count = count;
                        }
                        catch (e) {
                        }
                    }
                }
            }
            this._deferArrayCountEval.length = 0;
        }
        return statements;
    }
    _initialize(tokensOrCode) {
        if (tokensOrCode) {
            if (typeof tokensOrCode == "string") {
                const scanner = new WgslScanner(tokensOrCode);
                this._tokens = scanner.scanTokens();
            }
            else {
                this._tokens = tokensOrCode;
            }
        }
        else {
            this._tokens = [];
        }
        this._current = 0;
    }
    _updateNode(n, l) {
        n.line = l !== null && l !== void 0 ? l : this._currentLine;
        return n;
    }
    _error(token, message) {
        return {
            token,
            message,
            toString: function () {
                return `${message}`;
            },
        };
    }
    _isAtEnd() {
        return (this._current >= this._tokens.length ||
            this._peek().type == TokenTypes.eof);
    }
    _match(types) {
        if (types instanceof TokenType) {
            if (this._check(types)) {
                this._advance();
                return true;
            }
            return false;
        }
        for (let i = 0, l = types.length; i < l; ++i) {
            const type = types[i];
            if (this._check(type)) {
                this._advance();
                return true;
            }
        }
        return false;
    }
    _consume(types, message) {
        if (this._check(types)) {
            return this._advance();
        }
        throw this._error(this._peek(), message);
    }
    _check(types) {
        if (this._isAtEnd()) {
            return false;
        }
        const tk = this._peek();
        if (types instanceof Array) {
            const t = tk.type;
            const index = types.indexOf(t);
            return index != -1;
        }
        return tk.type == types;
    }
    _advance() {
        var _a, _b;
        this._currentLine = (_b = (_a = this._peek()) === null || _a === void 0 ? void 0 : _a.line) !== null && _b !== void 0 ? _b : -1;
        if (!this._isAtEnd()) {
            this._current++;
        }
        return this._previous();
    }
    _peek() {
        return this._tokens[this._current];
    }
    _previous() {
        return this._tokens[this._current - 1];
    }
    _global_decl_or_directive() {
        // semicolon
        // global_variable_decl semicolon
        // global_constant_decl semicolon
        // type_alias semicolon
        // struct_decl
        // function_decl
        // enable_directive
        // Ignore any stand-alone semicolons
        while (this._match(TokenTypes.tokens.semicolon) && !this._isAtEnd())
            ;
        if (this._match(TokenTypes.keywords.alias)) {
            const type = this._type_alias();
            this._consume(TokenTypes.tokens.semicolon, "Expected ';'");
            return type;
        }
        if (this._match(TokenTypes.keywords.diagnostic)) {
            const directive = this._diagnostic();
            this._consume(TokenTypes.tokens.semicolon, "Expected ';'");
            return directive;
        }
        if (this._match(TokenTypes.keywords.requires)) {
            const requires = this._requires_directive();
            this._consume(TokenTypes.tokens.semicolon, "Expected ';'");
            return requires;
        }
        if (this._match(TokenTypes.keywords.enable)) {
            const enable = this._enable_directive();
            this._consume(TokenTypes.tokens.semicolon, "Expected ';'");
            return enable;
        }
        // The following statements have an optional attribute*
        const attrs = this._attribute();
        if (this._check(TokenTypes.keywords.var)) {
            const _var = this._global_variable_decl();
            if (_var != null) {
                _var.attributes = attrs;
            }
            this._consume(TokenTypes.tokens.semicolon, "Expected ';'.");
            return _var;
        }
        if (this._check(TokenTypes.keywords.override)) {
            const _override = this._override_variable_decl();
            if (_override != null) {
                _override.attributes = attrs;
            }
            this._consume(TokenTypes.tokens.semicolon, "Expected ';'.");
            return _override;
        }
        if (this._check(TokenTypes.keywords.let)) {
            const _let = this._global_let_decl();
            if (_let != null) {
                _let.attributes = attrs;
            }
            this._consume(TokenTypes.tokens.semicolon, "Expected ';'.");
            return _let;
        }
        if (this._check(TokenTypes.keywords.const)) {
            const _const = this._global_const_decl();
            if (_const != null) {
                _const.attributes = attrs;
            }
            this._consume(TokenTypes.tokens.semicolon, "Expected ';'.");
            return _const;
        }
        if (this._check(TokenTypes.keywords.struct)) {
            const _struct = this._struct_decl();
            if (_struct != null) {
                _struct.attributes = attrs;
            }
            return _struct;
        }
        if (this._check(TokenTypes.keywords.fn)) {
            const _fn = this._function_decl();
            if (_fn != null) {
                _fn.attributes = attrs;
            }
            return _fn;
        }
        return null;
    }
    _function_decl() {
        // attribute* function_header compound_statement
        // function_header: fn ident paren_left param_list? paren_right (arrow attribute* type_decl)?
        if (!this._match(TokenTypes.keywords.fn)) {
            return null;
        }
        const startLine = this._currentLine;
        const name = this._consume(TokenTypes.tokens.ident, "Expected function name.").toString();
        this._consume(TokenTypes.tokens.paren_left, "Expected '(' for function arguments.");
        const args = [];
        if (!this._check(TokenTypes.tokens.paren_right)) {
            do {
                if (this._check(TokenTypes.tokens.paren_right)) {
                    break;
                }
                const argAttrs = this._attribute();
                const name = this._consume(TokenTypes.tokens.ident, "Expected argument name.").toString();
                this._consume(TokenTypes.tokens.colon, "Expected ':' for argument type.");
                const typeAttrs = this._attribute();
                const type = this._type_decl();
                if (type != null) {
                    type.attributes = typeAttrs;
                    args.push(this._updateNode(new Argument(name, type, argAttrs)));
                }
            } while (this._match(TokenTypes.tokens.comma));
        }
        this._consume(TokenTypes.tokens.paren_right, "Expected ')' after function arguments.");
        let _return = null;
        if (this._match(TokenTypes.tokens.arrow)) {
            const attrs = this._attribute();
            _return = this._type_decl();
            if (_return != null) {
                _return.attributes = attrs;
            }
        }
        const body = this._compound_statement();
        const endLine = this._currentLine;
        return this._updateNode(new Function$1(name, args, _return, body, startLine, endLine), startLine);
    }
    _compound_statement() {
        // brace_left statement* brace_right
        const statements = [];
        this._consume(TokenTypes.tokens.brace_left, "Expected '{' for block.");
        while (!this._check(TokenTypes.tokens.brace_right)) {
            const statement = this._statement();
            if (statement !== null) {
                statements.push(statement);
            }
        }
        this._consume(TokenTypes.tokens.brace_right, "Expected '}' for block.");
        return statements;
    }
    _statement() {
        // semicolon
        // return_statement semicolon
        // if_statement
        // switch_statement
        // loop_statement
        // for_statement
        // func_call_statement semicolon
        // variable_statement semicolon
        // break_statement semicolon
        // continue_statement semicolon
        // continuing_statement compound_statement
        // discard semicolon
        // assignment_statement semicolon
        // compound_statement
        // increment_statement semicolon
        // decrement_statement semicolon
        // static_assert_statement semicolon
        // Ignore any stand-alone semicolons
        while (this._match(TokenTypes.tokens.semicolon) && !this._isAtEnd())
            ;
        if (this._check(TokenTypes.tokens.attr)) {
            this._attribute();
        }
        if (this._check(TokenTypes.keywords.if)) {
            return this._if_statement();
        }
        if (this._check(TokenTypes.keywords.switch)) {
            return this._switch_statement();
        }
        if (this._check(TokenTypes.keywords.loop)) {
            return this._loop_statement();
        }
        if (this._check(TokenTypes.keywords.for)) {
            return this._for_statement();
        }
        if (this._check(TokenTypes.keywords.while)) {
            return this._while_statement();
        }
        if (this._check(TokenTypes.keywords.continuing)) {
            return this._continuing_statement();
        }
        if (this._check(TokenTypes.keywords.static_assert)) {
            return this._static_assert_statement();
        }
        if (this._check(TokenTypes.tokens.brace_left)) {
            return this._compound_statement();
        }
        let result = null;
        if (this._check(TokenTypes.keywords.return)) {
            result = this._return_statement();
        }
        else if (this._check([
            TokenTypes.keywords.var,
            TokenTypes.keywords.let,
            TokenTypes.keywords.const,
        ])) {
            result = this._variable_statement();
        }
        else if (this._match(TokenTypes.keywords.discard)) {
            result = this._updateNode(new Discard());
        }
        else if (this._match(TokenTypes.keywords.break)) {
            const breakStmt = this._updateNode(new Break());
            result = breakStmt;
            if (this._check(TokenTypes.keywords.if)) {
                // break-if
                this._advance();
                breakStmt.condition = this._optional_paren_expression();
                if (breakStmt.condition instanceof GroupingExpr && breakStmt.condition.contents.length === 1) {
                    breakStmt.condition = breakStmt.condition.contents[0];
                }
            }
        }
        else if (this._match(TokenTypes.keywords.continue)) {
            result = this._updateNode(new Continue());
        }
        else {
            result =
                this._increment_decrement_statement() ||
                    this._func_call_statement() ||
                    this._assignment_statement();
        }
        if (result != null) {
            this._consume(TokenTypes.tokens.semicolon, "Expected ';' after statement.");
        }
        return result;
    }
    _static_assert_statement() {
        if (!this._match(TokenTypes.keywords.static_assert)) {
            return null;
        }
        const expression = this._optional_paren_expression();
        return this._updateNode(new StaticAssert(expression));
    }
    _while_statement() {
        if (!this._match(TokenTypes.keywords.while)) {
            return null;
        }
        const condition = this._optional_paren_expression();
        if (this._check(TokenTypes.tokens.attr)) {
            this._attribute();
        }
        const block = this._compound_statement();
        return this._updateNode(new While(condition, block));
    }
    _continuing_statement() {
        if (!this._match(TokenTypes.keywords.continuing)) {
            return null;
        }
        const block = this._compound_statement();
        return this._updateNode(new Continuing(block));
    }
    _for_statement() {
        // for paren_left for_header paren_right compound_statement
        if (!this._match(TokenTypes.keywords.for)) {
            return null;
        }
        this._consume(TokenTypes.tokens.paren_left, "Expected '('.");
        // for_header: (variable_statement assignment_statement func_call_statement)? semicolon short_circuit_or_expression? semicolon (assignment_statement func_call_statement)?
        const init = !this._check(TokenTypes.tokens.semicolon)
            ? this._for_init()
            : null;
        this._consume(TokenTypes.tokens.semicolon, "Expected ';'.");
        const condition = !this._check(TokenTypes.tokens.semicolon)
            ? this._short_circuit_or_expression()
            : null;
        this._consume(TokenTypes.tokens.semicolon, "Expected ';'.");
        const increment = !this._check(TokenTypes.tokens.paren_right)
            ? this._for_increment()
            : null;
        this._consume(TokenTypes.tokens.paren_right, "Expected ')'.");
        if (this._check(TokenTypes.tokens.attr)) {
            this._attribute();
        }
        const body = this._compound_statement();
        return this._updateNode(new For(init, condition, increment, body));
    }
    _for_init() {
        // (variable_statement assignment_statement func_call_statement)?
        return (this._variable_statement() ||
            this._func_call_statement() ||
            this._assignment_statement());
    }
    _for_increment() {
        // (assignment_statement func_call_statement increment_statement)?
        return (this._func_call_statement() ||
            this._increment_decrement_statement() ||
            this._assignment_statement());
    }
    _variable_statement() {
        // variable_decl
        // variable_decl equal short_circuit_or_expression
        // let (ident variable_ident_decl) equal short_circuit_or_expression
        // const (ident variable_ident_decl) equal short_circuit_or_expression
        if (this._check(TokenTypes.keywords.var)) {
            const _var = this._variable_decl();
            if (_var === null) {
                throw this._error(this._peek(), "Variable declaration expected.");
            }
            let value = null;
            if (this._match(TokenTypes.tokens.equal)) {
                value = this._short_circuit_or_expression();
            }
            return this._updateNode(new Var$1(_var.name, _var.type, _var.storage, _var.access, value));
        }
        if (this._match(TokenTypes.keywords.let)) {
            const name = this._consume(TokenTypes.tokens.ident, "Expected name for let.").toString();
            let type = null;
            if (this._match(TokenTypes.tokens.colon)) {
                const typeAttrs = this._attribute();
                type = this._type_decl();
                if (type != null) {
                    type.attributes = typeAttrs;
                }
            }
            this._consume(TokenTypes.tokens.equal, "Expected '=' for let.");
            const value = this._short_circuit_or_expression();
            return this._updateNode(new Let(name, type, null, null, value));
        }
        if (this._match(TokenTypes.keywords.const)) {
            const name = this._consume(TokenTypes.tokens.ident, "Expected name for const.").toString();
            let type = null;
            if (this._match(TokenTypes.tokens.colon)) {
                const typeAttrs = this._attribute();
                type = this._type_decl();
                if (type != null) {
                    type.attributes = typeAttrs;
                }
            }
            this._consume(TokenTypes.tokens.equal, "Expected '=' for const.");
            const value = this._short_circuit_or_expression();
            return this._updateNode(new Const(name, type, null, null, value));
        }
        return null;
    }
    _increment_decrement_statement() {
        const savedPos = this._current;
        const _var = this._unary_expression();
        if (_var == null) {
            return null;
        }
        if (!this._check(TokenTypes.increment_operators)) {
            this._current = savedPos;
            return null;
        }
        const token = this._consume(TokenTypes.increment_operators, "Expected increment operator");
        return this._updateNode(new Increment(token.type === TokenTypes.tokens.plus_plus
            ? IncrementOperator.increment
            : IncrementOperator.decrement, _var));
    }
    _assignment_statement() {
        // (unary_expression underscore) equal short_circuit_or_expression
        let _var = null;
        if (this._check(TokenTypes.tokens.brace_right)) {
            return null;
        }
        let isUnderscore = this._match(TokenTypes.tokens.underscore);
        if (!isUnderscore) {
            _var = this._unary_expression();
        }
        if (!isUnderscore && _var == null) {
            return null;
        }
        const type = this._consume(TokenTypes.assignment_operators, "Expected assignment operator.");
        const value = this._short_circuit_or_expression();
        return this._updateNode(new Assign(AssignOperator.parse(type.lexeme), _var, value));
    }
    _func_call_statement() {
        // ident argument_expression_list
        if (!this._check(TokenTypes.tokens.ident)) {
            return null;
        }
        const savedPos = this._current;
        const name = this._consume(TokenTypes.tokens.ident, "Expected function name.");
        const args = this._argument_expression_list();
        if (args === null) {
            this._current = savedPos;
            return null;
        }
        return this._updateNode(new Call(name.lexeme, args));
    }
    _loop_statement() {
        // loop brace_left statement* continuing_statement? brace_right
        if (!this._match(TokenTypes.keywords.loop)) {
            return null;
        }
        if (this._check(TokenTypes.tokens.attr)) {
            this._attribute();
        }
        this._consume(TokenTypes.tokens.brace_left, "Expected '{' for loop.");
        // statement*
        const statements = [];
        let statement = this._statement();
        while (statement !== null) {
            if (Array.isArray(statement)) {
                for (let s of statement) {
                    statements.push(s);
                }
            }
            else {
                statements.push(statement);
            }
            statement = this._statement();
        }
        // continuing_statement: continuing compound_statement
        let continuing = null;
        if (this._match(TokenTypes.keywords.continuing)) {
            continuing = this._compound_statement();
        }
        this._consume(TokenTypes.tokens.brace_right, "Expected '}' for loop.");
        return this._updateNode(new Loop(statements, continuing));
    }
    _switch_statement() {
        // switch optional_paren_expression brace_left switch_body+ brace_right
        if (!this._match(TokenTypes.keywords.switch)) {
            return null;
        }
        const condition = this._optional_paren_expression();
        if (this._check(TokenTypes.tokens.attr)) {
            this._attribute();
        }
        this._consume(TokenTypes.tokens.brace_left, "Expected '{' for switch.");
        const body = this._switch_body();
        if (body == null || body.length == 0) {
            throw this._error(this._previous(), "Expected 'case' or 'default'.");
        }
        this._consume(TokenTypes.tokens.brace_right, "Expected '}' for switch.");
        return this._updateNode(new Switch(condition, body));
    }
    _switch_body() {
        // case case_selectors colon brace_left case_body? brace_right
        // default colon brace_left case_body? brace_right
        const cases = [];
        if (this._match(TokenTypes.keywords.case)) {
            const selector = this._case_selectors();
            this._match(TokenTypes.tokens.colon); // colon is optional
            if (this._check(TokenTypes.tokens.attr)) {
                this._attribute();
            }
            this._consume(TokenTypes.tokens.brace_left, "Exected '{' for switch case.");
            const body = this._case_body();
            this._consume(TokenTypes.tokens.brace_right, "Exected '}' for switch case.");
            cases.push(this._updateNode(new Case(selector, body)));
        }
        if (this._match(TokenTypes.keywords.default)) {
            this._match(TokenTypes.tokens.colon); // colon is optional
            if (this._check(TokenTypes.tokens.attr)) {
                this._attribute();
            }
            this._consume(TokenTypes.tokens.brace_left, "Exected '{' for switch default.");
            const body = this._case_body();
            this._consume(TokenTypes.tokens.brace_right, "Exected '}' for switch default.");
            cases.push(this._updateNode(new Default(body)));
        }
        if (this._check([TokenTypes.keywords.default, TokenTypes.keywords.case])) {
            const _cases = this._switch_body();
            cases.push(_cases[0]);
        }
        return cases;
    }
    _case_selectors() {
        // const_literal (comma const_literal)* comma?
        const selectors = [
            this._shift_expression(), //?.evaluate(this._context).toString() ?? "",
        ];
        while (this._match(TokenTypes.tokens.comma)) {
            selectors.push(this._shift_expression());
        }
        return selectors;
    }
    _case_body() {
        // statement case_body?
        // fallthrough semicolon
        if (this._match(TokenTypes.keywords.fallthrough)) {
            this._consume(TokenTypes.tokens.semicolon, "Expected ';'");
            return [];
        }
        let statement = this._statement();
        if (statement == null) {
            return [];
        }
        if (!(statement instanceof Array)) {
            statement = [statement];
        }
        const nextStatement = this._case_body();
        if (nextStatement.length == 0) {
            return statement;
        }
        return [...statement, nextStatement[0]];
    }
    _if_statement() {
        // if optional_paren_expression compound_statement elseif_statement? else_statement?
        if (!this._match(TokenTypes.keywords.if)) {
            return null;
        }
        const condition = this._optional_paren_expression();
        if (this._check(TokenTypes.tokens.attr)) {
            this._attribute();
        }
        const block = this._compound_statement();
        let elseif = [];
        if (this._match_elseif()) {
            if (this._check(TokenTypes.tokens.attr)) {
                this._attribute();
            }
            elseif = this._elseif_statement(elseif);
        }
        let _else = null;
        if (this._match(TokenTypes.keywords.else)) {
            if (this._check(TokenTypes.tokens.attr)) {
                this._attribute();
            }
            _else = this._compound_statement();
        }
        return this._updateNode(new If(condition, block, elseif, _else));
    }
    _match_elseif() {
        if (this._tokens[this._current].type === TokenTypes.keywords.else &&
            this._tokens[this._current + 1].type === TokenTypes.keywords.if) {
            this._advance();
            this._advance();
            return true;
        }
        return false;
    }
    _elseif_statement(elseif = []) {
        // else_if optional_paren_expression compound_statement elseif_statement?
        const condition = this._optional_paren_expression();
        const block = this._compound_statement();
        elseif.push(this._updateNode(new ElseIf(condition, block)));
        if (this._match_elseif()) {
            if (this._check(TokenTypes.tokens.attr)) {
                this._attribute();
            }
            this._elseif_statement(elseif);
        }
        return elseif;
    }
    _return_statement() {
        // return short_circuit_or_expression?
        if (!this._match(TokenTypes.keywords.return)) {
            return null;
        }
        const value = this._short_circuit_or_expression();
        return this._updateNode(new Return(value));
    }
    _short_circuit_or_expression() {
        // short_circuit_and_expression
        // short_circuit_or_expression or_or short_circuit_and_expression
        let expr = this._short_circuit_and_expr();
        while (this._match(TokenTypes.tokens.or_or)) {
            expr = this._updateNode(new BinaryOperator(this._previous().toString(), expr, this._short_circuit_and_expr()));
        }
        return expr;
    }
    _short_circuit_and_expr() {
        // inclusive_or_expression
        // short_circuit_and_expression and_and inclusive_or_expression
        let expr = this._inclusive_or_expression();
        while (this._match(TokenTypes.tokens.and_and)) {
            expr = this._updateNode(new BinaryOperator(this._previous().toString(), expr, this._inclusive_or_expression()));
        }
        return expr;
    }
    _inclusive_or_expression() {
        // exclusive_or_expression
        // inclusive_or_expression or exclusive_or_expression
        let expr = this._exclusive_or_expression();
        while (this._match(TokenTypes.tokens.or)) {
            expr = this._updateNode(new BinaryOperator(this._previous().toString(), expr, this._exclusive_or_expression()));
        }
        return expr;
    }
    _exclusive_or_expression() {
        // and_expression
        // exclusive_or_expression xor and_expression
        let expr = this._and_expression();
        while (this._match(TokenTypes.tokens.xor)) {
            expr = this._updateNode(new BinaryOperator(this._previous().toString(), expr, this._and_expression()));
        }
        return expr;
    }
    _and_expression() {
        // equality_expression
        // and_expression and equality_expression
        let expr = this._equality_expression();
        while (this._match(TokenTypes.tokens.and)) {
            expr = this._updateNode(new BinaryOperator(this._previous().toString(), expr, this._equality_expression()));
        }
        return expr;
    }
    _equality_expression() {
        // relational_expression
        // relational_expression equal_equal relational_expression
        // relational_expression not_equal relational_expression
        const expr = this._relational_expression();
        if (this._match([TokenTypes.tokens.equal_equal, TokenTypes.tokens.not_equal])) {
            return this._updateNode(new BinaryOperator(this._previous().toString(), expr, this._relational_expression()));
        }
        return expr;
    }
    _relational_expression() {
        // shift_expression
        // relational_expression less_than shift_expression
        // relational_expression greater_than shift_expression
        // relational_expression less_than_equal shift_expression
        // relational_expression greater_than_equal shift_expression
        let expr = this._shift_expression();
        while (this._match([
            TokenTypes.tokens.less_than,
            TokenTypes.tokens.greater_than,
            TokenTypes.tokens.less_than_equal,
            TokenTypes.tokens.greater_than_equal,
        ])) {
            expr = this._updateNode(new BinaryOperator(this._previous().toString(), expr, this._shift_expression()));
        }
        return expr;
    }
    _shift_expression() {
        // additive_expression
        // shift_expression shift_left additive_expression
        // shift_expression shift_right additive_expression
        let expr = this._additive_expression();
        while (this._match([TokenTypes.tokens.shift_left, TokenTypes.tokens.shift_right])) {
            expr = this._updateNode(new BinaryOperator(this._previous().toString(), expr, this._additive_expression()));
        }
        return expr;
    }
    _additive_expression() {
        // multiplicative_expression
        // additive_expression plus multiplicative_expression
        // additive_expression minus multiplicative_expression
        let expr = this._multiplicative_expression();
        while (this._match([TokenTypes.tokens.plus, TokenTypes.tokens.minus])) {
            expr = this._updateNode(new BinaryOperator(this._previous().toString(), expr, this._multiplicative_expression()));
        }
        return expr;
    }
    _multiplicative_expression() {
        // unary_expression
        // multiplicative_expression star unary_expression
        // multiplicative_expression forward_slash unary_expression
        // multiplicative_expression modulo unary_expression
        let expr = this._unary_expression();
        while (this._match([
            TokenTypes.tokens.star,
            TokenTypes.tokens.forward_slash,
            TokenTypes.tokens.modulo,
        ])) {
            expr = this._updateNode(new BinaryOperator(this._previous().toString(), expr, this._unary_expression()));
        }
        return expr;
    }
    _unary_expression() {
        // singular_expression
        // minus unary_expression
        // bang unary_expression
        // tilde unary_expression
        // star unary_expression
        // and unary_expression
        if (this._match([
            TokenTypes.tokens.minus,
            TokenTypes.tokens.bang,
            TokenTypes.tokens.tilde,
            TokenTypes.tokens.star,
            TokenTypes.tokens.and,
        ])) {
            return this._updateNode(new UnaryOperator(this._previous().toString(), this._unary_expression()));
        }
        return this._singular_expression();
    }
    _singular_expression() {
        // primary_expression postfix_expression ?
        const expr = this._primary_expression();
        const p = this._postfix_expression();
        if (p) {
            expr.postfix = p;
        }
        return expr;
    }
    _postfix_expression() {
        // bracket_left short_circuit_or_expression bracket_right postfix_expression?
        if (this._match(TokenTypes.tokens.bracket_left)) {
            const expr = this._short_circuit_or_expression();
            this._consume(TokenTypes.tokens.bracket_right, "Expected ']'.");
            const arrayIndex = this._updateNode(new ArrayIndex(expr));
            const p = this._postfix_expression();
            if (p) {
                arrayIndex.postfix = p;
            }
            return arrayIndex;
        }
        // period ident postfix_expression?
        if (this._match(TokenTypes.tokens.period)) {
            const name = this._consume(TokenTypes.tokens.ident, "Expected member name.");
            const p = this._postfix_expression();
            const expr = this._updateNode(new StringExpr(name.lexeme));
            if (p) {
                expr.postfix = p;
            }
            return expr;
        }
        return null;
    }
    _getStruct(name) {
        if (this._context.aliases.has(name)) {
            const alias = this._context.aliases.get(name).type;
            return alias;
        }
        if (this._context.structs.has(name)) {
            const struct = this._context.structs.get(name);
            return struct;
        }
        return null;
    }
    _getType(name) {
        const struct = this._getStruct(name);
        if (struct !== null) {
            return struct;
        }
        switch (name) {
            case "bool":
                return Type.bool;
            case "i32":
                return Type.i32;
            case "u32":
                return Type.u32;
            case "f32":
                return Type.f32;
            case "f16":
                return Type.f16;
            case "vec2f":
                return TemplateType.vec2f;
            case "vec3f":
                return TemplateType.vec3f;
            case "vec4f":
                return TemplateType.vec4f;
            case "vec2i":
                return TemplateType.vec2i;
            case "vec3i":
                return TemplateType.vec3i;
            case "vec4i":
                return TemplateType.vec4i;
            case "vec2u":
                return TemplateType.vec2u;
            case "vec3u":
                return TemplateType.vec3u;
            case "vec4u":
                return TemplateType.vec4u;
            case "vec2h":
                return TemplateType.vec2h;
            case "vec3h":
                return TemplateType.vec3h;
            case "vec4h":
                return TemplateType.vec4h;
            case "mat2x2f":
                return TemplateType.mat2x2f;
            case "mat2x3f":
                return TemplateType.mat2x3f;
            case "mat2x4f":
                return TemplateType.mat2x4f;
            case "mat3x2f":
                return TemplateType.mat3x2f;
            case "mat3x3f":
                return TemplateType.mat3x3f;
            case "mat3x4f":
                return TemplateType.mat3x4f;
            case "mat4x2f":
                return TemplateType.mat4x2f;
            case "mat4x3f":
                return TemplateType.mat4x3f;
            case "mat4x4f":
                return TemplateType.mat4x4f;
            case "mat2x2h":
                return TemplateType.mat2x2h;
            case "mat2x3h":
                return TemplateType.mat2x3h;
            case "mat2x4h":
                return TemplateType.mat2x4h;
            case "mat3x2h":
                return TemplateType.mat3x2h;
            case "mat3x3h":
                return TemplateType.mat3x3h;
            case "mat3x4h":
                return TemplateType.mat3x4h;
            case "mat4x2h":
                return TemplateType.mat4x2h;
            case "mat4x3h":
                return TemplateType.mat4x3h;
            case "mat4x4h":
                return TemplateType.mat4x4h;
        }
        return null;
    }
    _primary_expression() {
        // ident argument_expression_list?
        if (this._match(TokenTypes.tokens.ident)) {
            const name = this._previous().toString();
            if (this._check(TokenTypes.tokens.paren_left)) {
                const args = this._argument_expression_list();
                const type = this._getType(name);
                if (type !== null) {
                    return this._updateNode(new CreateExpr(type, args));
                }
                return this._updateNode(new CallExpr(name, args));
            }
            if (this._context.constants.has(name)) {
                const c = this._context.constants.get(name);
                return this._updateNode(new ConstExpr(name, c.value));
            }
            return this._updateNode(new VariableExpr(name));
        }
        // const_literal
        if (this._match(TokenTypes.const_literal)) {
            return this._updateNode(new LiteralExpr(parseFloat(this._previous().toString())));
        }
        // paren_expression
        if (this._check(TokenTypes.tokens.paren_left)) {
            return this._paren_expression();
        }
        // bitcast less_than type_decl greater_than paren_expression
        if (this._match(TokenTypes.keywords.bitcast)) {
            this._consume(TokenTypes.tokens.less_than, "Expected '<'.");
            const type = this._type_decl();
            this._consume(TokenTypes.tokens.greater_than, "Expected '>'.");
            const value = this._paren_expression();
            return this._updateNode(new BitcastExpr(type, value));
        }
        // type_decl argument_expression_list
        const type = this._type_decl();
        const args = this._argument_expression_list();
        return this._updateNode(new CreateExpr(type, args));
    }
    _argument_expression_list() {
        // paren_left ((short_circuit_or_expression comma)* short_circuit_or_expression comma?)? paren_right
        if (!this._match(TokenTypes.tokens.paren_left)) {
            return null;
        }
        const args = [];
        do {
            if (this._check(TokenTypes.tokens.paren_right)) {
                break;
            }
            const arg = this._short_circuit_or_expression();
            args.push(arg);
        } while (this._match(TokenTypes.tokens.comma));
        this._consume(TokenTypes.tokens.paren_right, "Expected ')' for agument list");
        return args;
    }
    _optional_paren_expression() {
        // [paren_left] short_circuit_or_expression [paren_right]
        this._match(TokenTypes.tokens.paren_left);
        const expr = this._short_circuit_or_expression();
        this._match(TokenTypes.tokens.paren_right);
        return this._updateNode(new GroupingExpr([expr]));
    }
    _paren_expression() {
        // paren_left short_circuit_or_expression paren_right
        this._consume(TokenTypes.tokens.paren_left, "Expected '('.");
        const expr = this._short_circuit_or_expression();
        this._consume(TokenTypes.tokens.paren_right, "Expected ')'.");
        return this._updateNode(new GroupingExpr([expr]));
    }
    _struct_decl() {
        // attribute* struct ident struct_body_decl
        if (!this._match(TokenTypes.keywords.struct)) {
            return null;
        }
        const startLine = this._currentLine;
        const name = this._consume(TokenTypes.tokens.ident, "Expected name for struct.").toString();
        // struct_body_decl: brace_left (struct_member comma)* struct_member comma? brace_right
        this._consume(TokenTypes.tokens.brace_left, "Expected '{' for struct body.");
        const members = [];
        while (!this._check(TokenTypes.tokens.brace_right)) {
            // struct_member: attribute* variable_ident_decl
            const memberAttrs = this._attribute();
            const memberName = this._consume(TokenTypes.tokens.ident, "Expected variable name.").toString();
            this._consume(TokenTypes.tokens.colon, "Expected ':' for struct member type.");
            const typeAttrs = this._attribute();
            const memberType = this._type_decl();
            if (memberType != null) {
                memberType.attributes = typeAttrs;
            }
            if (!this._check(TokenTypes.tokens.brace_right)) {
                this._consume(TokenTypes.tokens.comma, "Expected ',' for struct member.");
            }
            else {
                this._match(TokenTypes.tokens.comma); // trailing comma optional.
            }
            members.push(this._updateNode(new Member(memberName, memberType, memberAttrs)));
        }
        this._consume(TokenTypes.tokens.brace_right, "Expected '}' after struct body.");
        const endLine = this._currentLine;
        const structNode = this._updateNode(new Struct(name, members, startLine, endLine), startLine);
        this._context.structs.set(name, structNode);
        return structNode;
    }
    _global_variable_decl() {
        // attribute* variable_decl (equal const_expression)?
        const _var = this._variable_decl();
        if (_var && this._match(TokenTypes.tokens.equal)) {
            _var.value = this._const_expression();
        }
        return _var;
    }
    _override_variable_decl() {
        // attribute* override_decl (equal const_expression)?
        const _override = this._override_decl();
        if (_override && this._match(TokenTypes.tokens.equal)) {
            _override.value = this._const_expression();
        }
        return _override;
    }
    _global_const_decl() {
        // attribute* const (ident variable_ident_decl) global_const_initializer?
        if (!this._match(TokenTypes.keywords.const)) {
            return null;
        }
        const name = this._consume(TokenTypes.tokens.ident, "Expected variable name");
        let type = null;
        if (this._match(TokenTypes.tokens.colon)) {
            const attrs = this._attribute();
            type = this._type_decl();
            if (type != null) {
                type.attributes = attrs;
            }
        }
        let value = null;
        if (this._match(TokenTypes.tokens.equal)) {
            const valueExpr = this._short_circuit_or_expression();
            if (valueExpr instanceof CreateExpr) {
                value = valueExpr;
            }
            else if (valueExpr instanceof ConstExpr &&
                valueExpr.initializer instanceof CreateExpr) {
                value = valueExpr.initializer;
            }
            else {
                try {
                    const constValue = valueExpr.evaluate(this._context);
                    value = this._updateNode(new LiteralExpr(constValue));
                }
                catch (_a) {
                    value = valueExpr;
                }
            }
        }
        const c = this._updateNode(new Const(name.toString(), type, "", "", value));
        this._context.constants.set(c.name, c);
        return c;
    }
    _global_let_decl() {
        // attribute* let (ident variable_ident_decl) global_const_initializer?
        if (!this._match(TokenTypes.keywords.let)) {
            return null;
        }
        const name = this._consume(TokenTypes.tokens.ident, "Expected variable name");
        let type = null;
        if (this._match(TokenTypes.tokens.colon)) {
            const attrs = this._attribute();
            type = this._type_decl();
            if (type != null) {
                type.attributes = attrs;
            }
        }
        let value = null;
        if (this._match(TokenTypes.tokens.equal)) {
            value = this._const_expression();
        }
        return this._updateNode(new Let(name.toString(), type, "", "", value));
    }
    _const_expression() {
        // type_decl paren_left ((const_expression comma)* const_expression comma?)? paren_right
        // const_literal
        return this._short_circuit_or_expression();
    }
    _variable_decl() {
        // var variable_qualifier? (ident variable_ident_decl)
        if (!this._match(TokenTypes.keywords.var)) {
            return null;
        }
        // variable_qualifier: less_than storage_class (comma access_mode)? greater_than
        let storage = "";
        let access = "";
        if (this._match(TokenTypes.tokens.less_than)) {
            storage = this._consume(TokenTypes.storage_class, "Expected storage_class.").toString();
            if (this._match(TokenTypes.tokens.comma))
                access = this._consume(TokenTypes.access_mode, "Expected access_mode.").toString();
            this._consume(TokenTypes.tokens.greater_than, "Expected '>'.");
        }
        const name = this._consume(TokenTypes.tokens.ident, "Expected variable name");
        let type = null;
        if (this._match(TokenTypes.tokens.colon)) {
            const attrs = this._attribute();
            type = this._type_decl();
            if (type != null) {
                type.attributes = attrs;
            }
        }
        return this._updateNode(new Var$1(name.toString(), type, storage, access, null));
    }
    _override_decl() {
        // override (ident variable_ident_decl)
        if (!this._match(TokenTypes.keywords.override)) {
            return null;
        }
        const name = this._consume(TokenTypes.tokens.ident, "Expected variable name");
        let type = null;
        if (this._match(TokenTypes.tokens.colon)) {
            const attrs = this._attribute();
            type = this._type_decl();
            if (type != null) {
                type.attributes = attrs;
            }
        }
        return this._updateNode(new Override(name.toString(), type, null));
    }
    _diagnostic() {
        // diagnostic(severity_control_name, diagnostic_rule_name)
        this._consume(TokenTypes.tokens.paren_left, "Expected '('");
        const severity = this._consume(TokenTypes.tokens.ident, "Expected severity control name.");
        this._consume(TokenTypes.tokens.comma, "Expected ','");
        const rule = this._consume(TokenTypes.tokens.ident, "Expected diagnostic rule name.");
        this._consume(TokenTypes.tokens.paren_right, "Expected ')'");
        return this._updateNode(new Diagnostic(severity.toString(), rule.toString()));
    }
    _enable_directive() {
        // enable ident semicolon
        const name = this._consume(TokenTypes.tokens.ident, "identity expected.");
        return this._updateNode(new Enable(name.toString()));
    }
    _requires_directive() {
        // requires extension [, extension]* semicolon
        const extensions = [this._consume(TokenTypes.tokens.ident, "identity expected.").toString()];
        while (this._match(TokenTypes.tokens.comma)) {
            const name = this._consume(TokenTypes.tokens.ident, "identity expected.");
            extensions.push(name.toString());
        }
        return this._updateNode(new Requires(extensions));
    }
    _type_alias() {
        // type ident equal type_decl
        const name = this._consume(TokenTypes.tokens.ident, "identity expected.");
        this._consume(TokenTypes.tokens.equal, "Expected '=' for type alias.");
        let aliasType = this._type_decl();
        if (aliasType === null) {
            throw this._error(this._peek(), "Expected Type for Alias.");
        }
        if (this._context.aliases.has(aliasType.name)) {
            aliasType = this._context.aliases.get(aliasType.name).type;
        }
        const aliasNode = this._updateNode(new Alias(name.toString(), aliasType));
        this._context.aliases.set(aliasNode.name, aliasNode);
        return aliasNode;
    }
    _type_decl() {
        // ident
        // bool
        // float32
        // int32
        // uint32
        // vec2 less_than type_decl greater_than
        // vec3 less_than type_decl greater_than
        // vec4 less_than type_decl greater_than
        // mat2x2 less_than type_decl greater_than
        // mat2x3 less_than type_decl greater_than
        // mat2x4 less_than type_decl greater_than
        // mat3x2 less_than type_decl greater_than
        // mat3x3 less_than type_decl greater_than
        // mat3x4 less_than type_decl greater_than
        // mat4x2 less_than type_decl greater_than
        // mat4x3 less_than type_decl greater_than
        // mat4x4 less_than type_decl greater_than
        // atomic less_than type_decl greater_than
        // pointer less_than storage_class comma type_decl (comma access_mode)? greater_than
        // array_type_decl
        // texture_sampler_types
        if (this._check([
            TokenTypes.tokens.ident,
            ...TokenTypes.texel_format,
            TokenTypes.keywords.bool,
            TokenTypes.keywords.f32,
            TokenTypes.keywords.i32,
            TokenTypes.keywords.u32,
        ])) {
            const type = this._advance();
            const typeName = type.toString();
            if (this._context.structs.has(typeName)) {
                return this._context.structs.get(typeName);
            }
            if (this._context.aliases.has(typeName)) {
                return this._context.aliases.get(typeName).type;
            }
            return this._updateNode(new Type(type.toString()));
        }
        // texture_sampler_types
        let type = this._texture_sampler_types();
        if (type) {
            return type;
        }
        if (this._check(TokenTypes.template_types)) {
            let type = this._advance().toString();
            let format = null;
            let access = null;
            if (this._match(TokenTypes.tokens.less_than)) {
                format = this._type_decl();
                access = null;
                if (this._match(TokenTypes.tokens.comma)) {
                    access = this._consume(TokenTypes.access_mode, "Expected access_mode for pointer").toString();
                }
                this._consume(TokenTypes.tokens.greater_than, "Expected '>' for type.");
            }
            return this._updateNode(new TemplateType(type, format, access));
        }
        // pointer less_than storage_class comma type_decl (comma access_mode)? greater_than
        if (this._match(TokenTypes.keywords.ptr)) {
            let pointer = this._previous().toString();
            this._consume(TokenTypes.tokens.less_than, "Expected '<' for pointer.");
            const storage = this._consume(TokenTypes.storage_class, "Expected storage_class for pointer");
            this._consume(TokenTypes.tokens.comma, "Expected ',' for pointer.");
            const decl = this._type_decl();
            let access = null;
            if (this._match(TokenTypes.tokens.comma)) {
                access = this._consume(TokenTypes.access_mode, "Expected access_mode for pointer").toString();
            }
            this._consume(TokenTypes.tokens.greater_than, "Expected '>' for pointer.");
            return this._updateNode(new PointerType(pointer, storage.toString(), decl, access));
        }
        // The following type_decl's have an optional attribyte_list*
        const attrs = this._attribute();
        // attribute* array
        // attribute* array less_than type_decl (comma element_count_expression)? greater_than
        if (this._match(TokenTypes.keywords.array)) {
            let format = null;
            let countInt = -1;
            const array = this._previous();
            let countNode = null;
            if (this._match(TokenTypes.tokens.less_than)) {
                format = this._type_decl();
                if (this._context.aliases.has(format.name)) {
                    format = this._context.aliases.get(format.name).type;
                }
                let count = "";
                if (this._match(TokenTypes.tokens.comma)) {
                    countNode = this._shift_expression();
                    // If we can't evaluate the node, defer evaluating it until after the shader has
                    // finished being parsed, because const statements can be declared **after** they
                    // are used.
                    try {
                        count = countNode.evaluate(this._context).toString();
                        countNode = null;
                    }
                    catch (e) {
                        count = "1";
                    }
                }
                this._consume(TokenTypes.tokens.greater_than, "Expected '>' for array.");
                countInt = count ? parseInt(count) : 0;
            }
            const arrayType = this._updateNode(new ArrayType(array.toString(), attrs, format, countInt));
            if (countNode) {
                this._deferArrayCountEval.push({ arrayType, countNode });
            }
            return arrayType;
        }
        return null;
    }
    _texture_sampler_types() {
        // sampler_type
        if (this._match(TokenTypes.sampler_type)) {
            return this._updateNode(new SamplerType(this._previous().toString(), null, null));
        }
        // depth_texture_type
        if (this._match(TokenTypes.depth_texture_type)) {
            return this._updateNode(new SamplerType(this._previous().toString(), null, null));
        }
        // sampled_texture_type less_than type_decl greater_than
        // multisampled_texture_type less_than type_decl greater_than
        if (this._match(TokenTypes.sampled_texture_type) ||
            this._match(TokenTypes.multisampled_texture_type)) {
            const sampler = this._previous();
            this._consume(TokenTypes.tokens.less_than, "Expected '<' for sampler type.");
            const format = this._type_decl();
            this._consume(TokenTypes.tokens.greater_than, "Expected '>' for sampler type.");
            return this._updateNode(new SamplerType(sampler.toString(), format, null));
        }
        // storage_texture_type less_than texel_format comma access_mode greater_than
        if (this._match(TokenTypes.storage_texture_type)) {
            const sampler = this._previous();
            this._consume(TokenTypes.tokens.less_than, "Expected '<' for sampler type.");
            const format = this._consume(TokenTypes.texel_format, "Invalid texel format.").toString();
            this._consume(TokenTypes.tokens.comma, "Expected ',' after texel format.");
            const access = this._consume(TokenTypes.access_mode, "Expected access mode for storage texture type.").toString();
            this._consume(TokenTypes.tokens.greater_than, "Expected '>' for sampler type.");
            return this._updateNode(new SamplerType(sampler.toString(), format, access));
        }
        return null;
    }
    _attribute() {
        // attr ident paren_left (literal_or_ident comma)* literal_or_ident paren_right
        // attr ident
        let attributes = [];
        while (this._match(TokenTypes.tokens.attr)) {
            const name = this._consume(TokenTypes.attribute_name, "Expected attribute name");
            const attr = this._updateNode(new Attribute(name.toString(), null));
            if (this._match(TokenTypes.tokens.paren_left)) {
                // literal_or_ident
                attr.value = this._consume(TokenTypes.literal_or_ident, "Expected attribute value").toString();
                if (this._check(TokenTypes.tokens.comma)) {
                    this._advance();
                    do {
                        const v = this._consume(TokenTypes.literal_or_ident, "Expected attribute value").toString();
                        if (!(attr.value instanceof Array)) {
                            attr.value = [attr.value];
                        }
                        attr.value.push(v);
                    } while (this._match(TokenTypes.tokens.comma));
                }
                this._consume(TokenTypes.tokens.paren_right, "Expected ')'");
            }
            attributes.push(attr);
        }
        if (attributes.length == 0) {
            return null;
        }
        return attributes;
    }
}

/**
 * @author Brendan Duncan / https://github.com/brendan-duncan
 */
class TypeInfo {
    constructor(name, attributes) {
        this.name = name;
        this.attributes = attributes;
        this.size = 0;
    }
    get isArray() {
        return false;
    }
    get isStruct() {
        return false;
    }
    get isTemplate() {
        return false;
    }
}
class MemberInfo {
    constructor(name, type, attributes) {
        this.name = name;
        this.type = type;
        this.attributes = attributes;
        this.offset = 0;
        this.size = 0;
    }
    get isArray() {
        return this.type.isArray;
    }
    get isStruct() {
        return this.type.isStruct;
    }
    get isTemplate() {
        return this.type.isTemplate;
    }
    get align() {
        return this.type.isStruct ? this.type.align : 0;
    }
    get members() {
        return this.type.isStruct ? this.type.members : null;
    }
    get format() {
        return this.type.isArray
            ? this.type.format
            : this.type.isTemplate
                ? this.type.format
                : null;
    }
    get count() {
        return this.type.isArray ? this.type.count : 0;
    }
    get stride() {
        return this.type.isArray ? this.type.stride : this.size;
    }
}
class StructInfo extends TypeInfo {
    constructor(name, attributes) {
        super(name, attributes);
        this.members = [];
        this.align = 0;
        this.startLine = -1;
        this.endLine = -1;
        this.inUse = false;
    }
    get isStruct() {
        return true;
    }
}
class ArrayInfo extends TypeInfo {
    constructor(name, attributes) {
        super(name, attributes);
        this.count = 0;
        this.stride = 0;
    }
    get isArray() {
        return true;
    }
}
class TemplateInfo extends TypeInfo {
    constructor(name, format, attributes, access) {
        super(name, attributes);
        this.format = format;
        this.access = access;
    }
    get isTemplate() {
        return true;
    }
}
var ResourceType;
(function (ResourceType) {
    ResourceType[ResourceType["Uniform"] = 0] = "Uniform";
    ResourceType[ResourceType["Storage"] = 1] = "Storage";
    ResourceType[ResourceType["Texture"] = 2] = "Texture";
    ResourceType[ResourceType["Sampler"] = 3] = "Sampler";
    ResourceType[ResourceType["StorageTexture"] = 4] = "StorageTexture";
})(ResourceType || (ResourceType = {}));
class VariableInfo {
    constructor(name, type, group, binding, attributes, resourceType, access) {
        this.name = name;
        this.type = type;
        this.group = group;
        this.binding = binding;
        this.attributes = attributes;
        this.resourceType = resourceType;
        this.access = access;
    }
    get isArray() {
        return this.type.isArray;
    }
    get isStruct() {
        return this.type.isStruct;
    }
    get isTemplate() {
        return this.type.isTemplate;
    }
    get size() {
        return this.type.size;
    }
    get align() {
        return this.type.isStruct ? this.type.align : 0;
    }
    get members() {
        return this.type.isStruct ? this.type.members : null;
    }
    get format() {
        return this.type.isArray
            ? this.type.format
            : this.type.isTemplate
                ? this.type.format
                : null;
    }
    get count() {
        return this.type.isArray ? this.type.count : 0;
    }
    get stride() {
        return this.type.isArray ? this.type.stride : this.size;
    }
}
class AliasInfo {
    constructor(name, type) {
        this.name = name;
        this.type = type;
    }
}
class _TypeSize {
    constructor(align, size) {
        this.align = align;
        this.size = size;
    }
}
class InputInfo {
    constructor(name, type, locationType, location) {
        this.name = name;
        this.type = type;
        this.locationType = locationType;
        this.location = location;
        this.interpolation = null;
    }
}
class OutputInfo {
    constructor(name, type, locationType, location) {
        this.name = name;
        this.type = type;
        this.locationType = locationType;
        this.location = location;
    }
}
class OverrideInfo {
    constructor(name, type, attributes, id) {
        this.name = name;
        this.type = type;
        this.attributes = attributes;
        this.id = id;
    }
}
class ArgumentInfo {
    constructor(name, type) {
        this.name = name;
        this.type = type;
    }
}
class FunctionInfo {
    constructor(name, stage = null) {
        this.stage = null;
        this.inputs = [];
        this.outputs = [];
        this.arguments = [];
        this.returnType = null;
        this.resources = [];
        this.overrides = [];
        this.startLine = -1;
        this.endLine = -1;
        this.inUse = false;
        this.calls = new Set();
        this.name = name;
        this.stage = stage;
    }
}
class EntryFunctions {
    constructor() {
        this.vertex = [];
        this.fragment = [];
        this.compute = [];
    }
}
class _FunctionResources {
    constructor(node) {
        this.resources = null;
        this.inUse = false;
        this.info = null;
        this.node = node;
    }
}
class WgslReflect {
    constructor(code) {
        /// All top-level uniform vars in the shader.
        this.uniforms = [];
        /// All top-level storage vars in the shader.
        this.storage = [];
        /// All top-level texture vars in the shader;
        this.textures = [];
        // All top-level sampler vars in the shader.
        this.samplers = [];
        /// All top-level type aliases in the shader.
        this.aliases = [];
        /// All top-level overrides in the shader.
        this.overrides = [];
        /// All top-level structs in the shader.
        this.structs = [];
        /// All entry functions in the shader: vertex, fragment, and/or compute.
        this.entry = new EntryFunctions();
        /// All functions in the shader, including entry functions.
        this.functions = [];
        this._types = new Map();
        this._functions = new Map();
        if (code) {
            this.update(code);
        }
    }
    _isStorageTexture(type) {
        return (type.name == "texture_storage_1d" ||
            type.name == "texture_storage_2d" ||
            type.name == "texture_storage_2d_array" ||
            type.name == "texture_storage_3d");
    }
    update(code) {
        const parser = new WgslParser();
        const ast = parser.parse(code);
        this.updateAST(ast);
    }
    updateAST(ast) {
        for (const node of ast) {
            if (node instanceof Function$1) {
                this._functions.set(node.name, new _FunctionResources(node));
            }
        }
        for (const node of ast) {
            if (node instanceof Struct) {
                const info = this._getTypeInfo(node, null);
                if (info instanceof StructInfo) {
                    this.structs.push(info);
                }
            }
        }
        for (const node of ast) {
            if (node instanceof Alias) {
                this.aliases.push(this._getAliasInfo(node));
                continue;
            }
            if (node instanceof Override) {
                const v = node;
                const id = this._getAttributeNum(v.attributes, "id", 0);
                const type = v.type != null ? this._getTypeInfo(v.type, v.attributes) : null;
                this.overrides.push(new OverrideInfo(v.name, type, v.attributes, id));
                continue;
            }
            if (this._isUniformVar(node)) {
                const v = node;
                const g = this._getAttributeNum(v.attributes, "group", 0);
                const b = this._getAttributeNum(v.attributes, "binding", 0);
                const type = this._getTypeInfo(v.type, v.attributes);
                const varInfo = new VariableInfo(v.name, type, g, b, v.attributes, ResourceType.Uniform, v.access);
                this.uniforms.push(varInfo);
                continue;
            }
            if (this._isStorageVar(node)) {
                const v = node;
                const g = this._getAttributeNum(v.attributes, "group", 0);
                const b = this._getAttributeNum(v.attributes, "binding", 0);
                const type = this._getTypeInfo(v.type, v.attributes);
                const isStorageTexture = this._isStorageTexture(type);
                const varInfo = new VariableInfo(v.name, type, g, b, v.attributes, isStorageTexture ? ResourceType.StorageTexture : ResourceType.Storage, v.access);
                this.storage.push(varInfo);
                continue;
            }
            if (this._isTextureVar(node)) {
                const v = node;
                const g = this._getAttributeNum(v.attributes, "group", 0);
                const b = this._getAttributeNum(v.attributes, "binding", 0);
                const type = this._getTypeInfo(v.type, v.attributes);
                const isStorageTexture = this._isStorageTexture(type);
                const varInfo = new VariableInfo(v.name, type, g, b, v.attributes, isStorageTexture ? ResourceType.StorageTexture : ResourceType.Texture, v.access);
                if (isStorageTexture) {
                    this.storage.push(varInfo);
                }
                else {
                    this.textures.push(varInfo);
                }
                continue;
            }
            if (this._isSamplerVar(node)) {
                const v = node;
                const g = this._getAttributeNum(v.attributes, "group", 0);
                const b = this._getAttributeNum(v.attributes, "binding", 0);
                const type = this._getTypeInfo(v.type, v.attributes);
                const varInfo = new VariableInfo(v.name, type, g, b, v.attributes, ResourceType.Sampler, v.access);
                this.samplers.push(varInfo);
                continue;
            }
            if (node instanceof Function$1) {
                const vertexStage = this._getAttribute(node, "vertex");
                const fragmentStage = this._getAttribute(node, "fragment");
                const computeStage = this._getAttribute(node, "compute");
                const stage = vertexStage || fragmentStage || computeStage;
                const fn = new FunctionInfo(node.name, stage === null || stage === void 0 ? void 0 : stage.name);
                fn.startLine = node.startLine;
                fn.endLine = node.endLine;
                this.functions.push(fn);
                this._functions.get(node.name).info = fn;
                if (stage) {
                    this._functions.get(node.name).inUse = true;
                    fn.inUse = true;
                    fn.resources = this._findResources(node, !!stage);
                    fn.inputs = this._getInputs(node.args);
                    fn.outputs = this._getOutputs(node.returnType);
                    this.entry[stage.name].push(fn);
                }
                fn.arguments = node.args.map((arg) => new ArgumentInfo(arg.name, this._getTypeInfo(arg.type, arg.attributes)));
                fn.returnType = node.returnType
                    ? this._getTypeInfo(node.returnType, node.attributes)
                    : null;
                continue;
            }
        }
        for (const fn of this._functions.values()) {
            if (fn.info) {
                fn.info.inUse = fn.inUse;
                this._addCalls(fn.node, fn.info.calls);
            }
        }
        for (const fn of this._functions.values()) {
            fn.node.search((node) => {
                var _a;
                if (node.astNodeType === "varExpr") {
                    const v = node;
                    for (const override of this.overrides) {
                        if (v.name == override.name) {
                            (_a = fn.info) === null || _a === void 0 ? void 0 : _a.overrides.push(override);
                        }
                    }
                }
            });
        }
        for (const u of this.uniforms) {
            this._markStructsInUse(u.type);
        }
        for (const s of this.storage) {
            this._markStructsInUse(s.type);
        }
    }
    getStructInfo(name) {
        for (const s of this.structs) {
            if (s.name == name) {
                return s;
            }
        }
        return null;
    }
    _markStructsInUse(type) {
        if (!type) {
            return;
        }
        if (type.isStruct) {
            type.inUse = true;
            if (type.members) {
                for (const m of type.members) {
                    this._markStructsInUse(m.type);
                }
            }
        }
        else if (type.isArray) {
            this._markStructsInUse(type.format);
        }
        else if (type.isTemplate) {
            if (type.format) {
                this._markStructsInUse(type.format);
            }
        }
        else {
            const alias = this._getAlias(type.name);
            if (alias) {
                this._markStructsInUse(alias);
            }
        }
    }
    _addCalls(fn, calls) {
        var _a;
        for (const call of fn.calls) {
            const info = (_a = this._functions.get(call.name)) === null || _a === void 0 ? void 0 : _a.info;
            if (info) {
                calls.add(info);
            }
        }
    }
    /// Find a resource by its group and binding.
    findResource(group, binding) {
        for (const u of this.uniforms) {
            if (u.group == group && u.binding == binding) {
                return u;
            }
        }
        for (const s of this.storage) {
            if (s.group == group && s.binding == binding) {
                return s;
            }
        }
        for (const t of this.textures) {
            if (t.group == group && t.binding == binding) {
                return t;
            }
        }
        for (const s of this.samplers) {
            if (s.group == group && s.binding == binding) {
                return s;
            }
        }
        return null;
    }
    _findResource(name) {
        for (const u of this.uniforms) {
            if (u.name == name) {
                return u;
            }
        }
        for (const s of this.storage) {
            if (s.name == name) {
                return s;
            }
        }
        for (const t of this.textures) {
            if (t.name == name) {
                return t;
            }
        }
        for (const s of this.samplers) {
            if (s.name == name) {
                return s;
            }
        }
        return null;
    }
    _markStructsFromAST(type) {
        const info = this._getTypeInfo(type, null);
        this._markStructsInUse(info);
    }
    _findResources(fn, isEntry) {
        const resources = [];
        const self = this;
        const varStack = [];
        fn.search((node) => {
            if (node instanceof _BlockStart) {
                varStack.push({});
            }
            else if (node instanceof _BlockEnd) {
                varStack.pop();
            }
            else if (node instanceof Var$1) {
                const v = node;
                if (isEntry && v.type !== null) {
                    this._markStructsFromAST(v.type);
                }
                if (varStack.length > 0) {
                    varStack[varStack.length - 1][v.name] = v;
                }
            }
            else if (node instanceof CreateExpr) {
                const c = node;
                if (isEntry && c.type !== null) {
                    this._markStructsFromAST(c.type);
                }
            }
            else if (node instanceof Let) {
                const v = node;
                if (isEntry && v.type !== null) {
                    this._markStructsFromAST(v.type);
                }
                if (varStack.length > 0) {
                    varStack[varStack.length - 1][v.name] = v;
                }
            }
            else if (node instanceof VariableExpr) {
                const v = node;
                // Check to see if the variable is a local variable before checking to see if it's
                // a resource.
                if (varStack.length > 0) {
                    const varInfo = varStack[varStack.length - 1][v.name];
                    if (varInfo) {
                        return;
                    }
                }
                const varInfo = self._findResource(v.name);
                if (varInfo) {
                    resources.push(varInfo);
                }
            }
            else if (node instanceof CallExpr) {
                const c = node;
                const callFn = self._functions.get(c.name);
                if (callFn) {
                    if (isEntry) {
                        callFn.inUse = true;
                    }
                    fn.calls.add(callFn.node);
                    if (callFn.resources === null) {
                        callFn.resources = self._findResources(callFn.node, isEntry);
                    }
                    resources.push(...callFn.resources);
                }
            }
            else if (node instanceof Call) {
                const c = node;
                const callFn = self._functions.get(c.name);
                if (callFn) {
                    if (isEntry) {
                        callFn.inUse = true;
                    }
                    fn.calls.add(callFn.node);
                    if (callFn.resources === null) {
                        callFn.resources = self._findResources(callFn.node, isEntry);
                    }
                    resources.push(...callFn.resources);
                }
            }
        });
        return [...new Map(resources.map(r => [r.name, r])).values()];
    }
    getBindGroups() {
        const groups = [];
        function _makeRoom(group, binding) {
            if (group >= groups.length) {
                groups.length = group + 1;
            }
            if (groups[group] === undefined) {
                groups[group] = [];
            }
            if (binding >= groups[group].length) {
                groups[group].length = binding + 1;
            }
        }
        for (const u of this.uniforms) {
            _makeRoom(u.group, u.binding);
            const group = groups[u.group];
            group[u.binding] = u;
        }
        for (const u of this.storage) {
            _makeRoom(u.group, u.binding);
            const group = groups[u.group];
            group[u.binding] = u;
        }
        for (const t of this.textures) {
            _makeRoom(t.group, t.binding);
            const group = groups[t.group];
            group[t.binding] = t;
        }
        for (const t of this.samplers) {
            _makeRoom(t.group, t.binding);
            const group = groups[t.group];
            group[t.binding] = t;
        }
        return groups;
    }
    _getOutputs(type, outputs = undefined) {
        if (outputs === undefined) {
            outputs = [];
        }
        if (type instanceof Struct) {
            this._getStructOutputs(type, outputs);
        }
        else {
            const output = this._getOutputInfo(type);
            if (output !== null) {
                outputs.push(output);
            }
        }
        return outputs;
    }
    _getStructOutputs(struct, outputs) {
        for (const m of struct.members) {
            if (m.type instanceof Struct) {
                this._getStructOutputs(m.type, outputs);
            }
            else {
                const location = this._getAttribute(m, "location") || this._getAttribute(m, "builtin");
                if (location !== null) {
                    const typeInfo = this._getTypeInfo(m.type, m.type.attributes);
                    const locationValue = this._parseInt(location.value);
                    const info = new OutputInfo(m.name, typeInfo, location.name, locationValue);
                    outputs.push(info);
                }
            }
        }
    }
    _getOutputInfo(type) {
        const location = this._getAttribute(type, "location") ||
            this._getAttribute(type, "builtin");
        if (location !== null) {
            const typeInfo = this._getTypeInfo(type, type.attributes);
            const locationValue = this._parseInt(location.value);
            const info = new OutputInfo("", typeInfo, location.name, locationValue);
            return info;
        }
        return null;
    }
    _getInputs(args, inputs = undefined) {
        if (inputs === undefined) {
            inputs = [];
        }
        for (const arg of args) {
            if (arg.type instanceof Struct) {
                this._getStructInputs(arg.type, inputs);
            }
            else {
                const input = this._getInputInfo(arg);
                if (input !== null) {
                    inputs.push(input);
                }
            }
        }
        return inputs;
    }
    _getStructInputs(struct, inputs) {
        for (const m of struct.members) {
            if (m.type instanceof Struct) {
                this._getStructInputs(m.type, inputs);
            }
            else {
                const input = this._getInputInfo(m);
                if (input !== null) {
                    inputs.push(input);
                }
            }
        }
    }
    _getInputInfo(node) {
        const location = this._getAttribute(node, "location") ||
            this._getAttribute(node, "builtin");
        if (location !== null) {
            const interpolation = this._getAttribute(node, "interpolation");
            const type = this._getTypeInfo(node.type, node.attributes);
            const locationValue = this._parseInt(location.value);
            const info = new InputInfo(node.name, type, location.name, locationValue);
            if (interpolation !== null) {
                info.interpolation = this._parseString(interpolation.value);
            }
            return info;
        }
        return null;
    }
    _parseString(s) {
        if (s instanceof Array) {
            s = s[0];
        }
        return s;
    }
    _parseInt(s) {
        if (s instanceof Array) {
            s = s[0];
        }
        const n = parseInt(s);
        return isNaN(n) ? s : n;
    }
    _getAlias(name) {
        for (const a of this.aliases) {
            if (a.name == name) {
                return a.type;
            }
        }
        return null;
    }
    _getAliasInfo(node) {
        return new AliasInfo(node.name, this._getTypeInfo(node.type, null));
    }
    _getTypeInfo(type, attributes) {
        if (this._types.has(type)) {
            return this._types.get(type);
        }
        if (type instanceof ArrayType) {
            const a = type;
            const t = a.format ? this._getTypeInfo(a.format, a.attributes) : null;
            const info = new ArrayInfo(a.name, attributes);
            info.format = t;
            info.count = a.count;
            this._types.set(type, info);
            this._updateTypeInfo(info);
            return info;
        }
        if (type instanceof Struct) {
            const s = type;
            const info = new StructInfo(s.name, attributes);
            info.startLine = s.startLine;
            info.endLine = s.endLine;
            for (const m of s.members) {
                const t = this._getTypeInfo(m.type, m.attributes);
                info.members.push(new MemberInfo(m.name, t, m.attributes));
            }
            this._types.set(type, info);
            this._updateTypeInfo(info);
            return info;
        }
        if (type instanceof SamplerType) {
            const s = type;
            const formatIsType = s.format instanceof Type;
            const format = s.format
                ? formatIsType
                    ? this._getTypeInfo(s.format, null)
                    : new TypeInfo(s.format, null)
                : null;
            const info = new TemplateInfo(s.name, format, attributes, s.access);
            this._types.set(type, info);
            this._updateTypeInfo(info);
            return info;
        }
        if (type instanceof TemplateType) {
            const t = type;
            const format = t.format ? this._getTypeInfo(t.format, null) : null;
            const info = new TemplateInfo(t.name, format, attributes, t.access);
            this._types.set(type, info);
            this._updateTypeInfo(info);
            return info;
        }
        const info = new TypeInfo(type.name, attributes);
        this._types.set(type, info);
        this._updateTypeInfo(info);
        return info;
    }
    _updateTypeInfo(type) {
        var _a, _b, _c;
        const typeSize = this._getTypeSize(type);
        type.size = (_a = typeSize === null || typeSize === void 0 ? void 0 : typeSize.size) !== null && _a !== void 0 ? _a : 0;
        if (type instanceof ArrayInfo) {
            if (type["format"]) {
                const formatInfo = this._getTypeSize(type["format"]);
                // Array stride is the maximum of the format size and alignment.
                // In the case of a vec3f, the size is 12 bytes, but the alignment is 16 bytes.
                // Buffer alignment is therefore 16 bytes.
                type.stride = Math.max((_b = formatInfo === null || formatInfo === void 0 ? void 0 : formatInfo.size) !== null && _b !== void 0 ? _b : 0, (_c = formatInfo === null || formatInfo === void 0 ? void 0 : formatInfo.align) !== null && _c !== void 0 ? _c : 0);
                this._updateTypeInfo(type["format"]);
            }
        }
        if (type instanceof StructInfo) {
            this._updateStructInfo(type);
        }
    }
    _updateStructInfo(struct) {
        var _a;
        let offset = 0;
        let lastSize = 0;
        let lastOffset = 0;
        let structAlign = 0;
        for (let mi = 0, ml = struct.members.length; mi < ml; ++mi) {
            const member = struct.members[mi];
            const sizeInfo = this._getTypeSize(member);
            if (!sizeInfo) {
                continue;
            }
            (_a = this._getAlias(member.type.name)) !== null && _a !== void 0 ? _a : member.type;
            const align = sizeInfo.align;
            const size = sizeInfo.size;
            offset = this._roundUp(align, offset + lastSize);
            lastSize = size;
            lastOffset = offset;
            structAlign = Math.max(structAlign, align);
            member.offset = offset;
            member.size = size;
            this._updateTypeInfo(member.type);
        }
        struct.size = this._roundUp(structAlign, lastOffset + lastSize);
        struct.align = structAlign;
    }
    _getTypeSize(type) {
        var _a, _b;
        if (type === null || type === undefined) {
            return null;
        }
        const explicitSize = this._getAttributeNum(type.attributes, "size", 0);
        const explicitAlign = this._getAttributeNum(type.attributes, "align", 0);
        if (type instanceof MemberInfo) {
            type = type.type;
        }
        if (type instanceof TypeInfo) {
            const alias = this._getAlias(type.name);
            if (alias !== null) {
                type = alias;
            }
        }
        {
            const info = WgslReflect._typeInfo[type.name];
            if (info !== undefined) {
                const divisor = ((_a = type["format"]) === null || _a === void 0 ? void 0 : _a.name) === "f16" ? 2 : 1;
                return new _TypeSize(Math.max(explicitAlign, info.align / divisor), Math.max(explicitSize, info.size / divisor));
            }
        }
        {
            const info = WgslReflect._typeInfo[type.name.substring(0, type.name.length - 1)];
            if (info) {
                const divisor = type.name[type.name.length - 1] === "h" ? 2 : 1;
                return new _TypeSize(Math.max(explicitAlign, info.align / divisor), Math.max(explicitSize, info.size / divisor));
            }
        }
        if (type instanceof ArrayInfo) {
            let arrayType = type;
            let align = 8;
            let size = 8;
            // Type                 AlignOf(T)          Sizeof(T)
            // array<E, N>          AlignOf(E)          N * roundUp(AlignOf(E), SizeOf(E))
            // array<E>             AlignOf(E)          N * roundUp(AlignOf(E), SizeOf(E))  (N determined at runtime)
            //
            // @stride(Q)
            // array<E, N>          AlignOf(E)          N * Q
            //
            // @stride(Q)
            // array<E>             AlignOf(E)          Nruntime * Q
            //const E = type.format.name;
            const E = this._getTypeSize(arrayType.format);
            if (E !== null) {
                size = E.size;
                align = E.align;
            }
            const N = arrayType.count;
            const stride = this._getAttributeNum((_b = type === null || type === void 0 ? void 0 : type.attributes) !== null && _b !== void 0 ? _b : null, "stride", this._roundUp(align, size));
            size = N * stride;
            if (explicitSize) {
                size = explicitSize;
            }
            return new _TypeSize(Math.max(explicitAlign, align), Math.max(explicitSize, size));
        }
        if (type instanceof StructInfo) {
            let align = 0;
            let size = 0;
            // struct S     AlignOf:    max(AlignOfMember(S, M1), ... , AlignOfMember(S, MN))
            //              SizeOf:     roundUp(AlignOf(S), OffsetOfMember(S, L) + SizeOfMember(S, L))
            //                          Where L is the last member of the structure
            let offset = 0;
            let lastSize = 0;
            let lastOffset = 0;
            for (const m of type.members) {
                const mi = this._getTypeSize(m.type);
                if (mi !== null) {
                    align = Math.max(mi.align, align);
                    offset = this._roundUp(mi.align, offset + lastSize);
                    lastSize = mi.size;
                    lastOffset = offset;
                }
            }
            size = this._roundUp(align, lastOffset + lastSize);
            return new _TypeSize(Math.max(explicitAlign, align), Math.max(explicitSize, size));
        }
        return null;
    }
    _isUniformVar(node) {
        return node instanceof Var$1 && node.storage == "uniform";
    }
    _isStorageVar(node) {
        return node instanceof Var$1 && node.storage == "storage";
    }
    _isTextureVar(node) {
        return (node instanceof Var$1 &&
            node.type !== null &&
            WgslReflect._textureTypes.indexOf(node.type.name) != -1);
    }
    _isSamplerVar(node) {
        return (node instanceof Var$1 &&
            node.type !== null &&
            WgslReflect._samplerTypes.indexOf(node.type.name) != -1);
    }
    _getAttribute(node, name) {
        const obj = node;
        if (!obj || !obj["attributes"]) {
            return null;
        }
        const attrs = obj["attributes"];
        for (let a of attrs) {
            if (a.name == name) {
                return a;
            }
        }
        return null;
    }
    _getAttributeNum(attributes, name, defaultValue) {
        if (attributes === null) {
            return defaultValue;
        }
        for (let a of attributes) {
            if (a.name == name) {
                let v = a !== null && a.value !== null ? a.value : defaultValue;
                if (v instanceof Array) {
                    v = v[0];
                }
                if (typeof v === "number") {
                    return v;
                }
                if (typeof v === "string") {
                    return parseInt(v);
                }
                return defaultValue;
            }
        }
        return defaultValue;
    }
    _roundUp(k, n) {
        return Math.ceil(n / k) * k;
    }
}
// Type                 AlignOf(T)          Sizeof(T)
// i32, u32, or f32     4                   4
// atomic<T>            4                   4
// vec2<T>              8                   8
// vec3<T>              16                  12
// vec4<T>              16                  16
// mat2x2<f32>          8                   16
// mat3x2<f32>          8                   24
// mat4x2<f32>          8                   32
// mat2x3<f32>          16                  32
// mat3x3<f32>          16                  48
// mat4x3<f32>          16                  64
// mat2x4<f32>          16                  32
// mat3x4<f32>          16                  48
// mat4x4<f32>          16                  64
WgslReflect._typeInfo = {
    f16: { align: 2, size: 2 },
    i32: { align: 4, size: 4 },
    u32: { align: 4, size: 4 },
    f32: { align: 4, size: 4 },
    atomic: { align: 4, size: 4 },
    vec2: { align: 8, size: 8 },
    vec3: { align: 16, size: 12 },
    vec4: { align: 16, size: 16 },
    mat2x2: { align: 8, size: 16 },
    mat3x2: { align: 8, size: 24 },
    mat4x2: { align: 8, size: 32 },
    mat2x3: { align: 16, size: 32 },
    mat3x3: { align: 16, size: 48 },
    mat4x3: { align: 16, size: 64 },
    mat2x4: { align: 16, size: 32 },
    mat3x4: { align: 16, size: 48 },
    mat4x4: { align: 16, size: 64 },
};
WgslReflect._textureTypes = TokenTypes.any_texture_type.map((t) => {
    return t.name;
});
WgslReflect._samplerTypes = TokenTypes.sampler_type.map((t) => {
    return t.name;
});

class Data {
    constructor(data, typeInfo, offset = 0, textureSize) {
        this.textureSize = [0, 0, 0];
        this.buffer = data instanceof ArrayBuffer ? data : data.buffer;
        this.typeInfo = typeInfo;
        this.offset = offset;
        if (textureSize !== undefined) {
            this.textureSize = textureSize;
        }
    }
}
class Var {
    constructor(n, v, node) {
        this.name = n;
        this.value = v;
        this.node = node;
    }
    clone() {
        return new Var(this.name, this.value, this.node);
    }
    getValue() {
        return this.value;
    }
}
class Function {
    constructor(node) {
        this.name = node.name;
        this.node = node;
    }
    clone() {
        return new Function(this.node);
    }
}
class ExecContext {
    constructor(parent) {
        this.parent = null;
        this.variables = new Map();
        this.functions = new Map();
        if (parent) {
            this.parent = parent;
        }
    }
    getVariable(name) {
        if (this.variables.has(name)) {
            return this.variables.get(name);
        }
        if (this.parent) {
            return this.parent.getVariable(name);
        }
        return null;
    }
    getFunction(name) {
        if (this.functions.has(name)) {
            return this.functions.get(name);
        }
        if (this.parent) {
            return this.parent.getFunction(name);
        }
        return null;
    }
    createVariable(name, value, node) {
        this.variables.set(name, new Var(name, value, node !== null && node !== void 0 ? node : null));
    }
    setVariable(name, value, node) {
        const v = this.getVariable(name);
        if (v !== null) {
            v.value = value;
        }
        else {
            this.createVariable(name, value, node);
        }
    }
    getVariableValue(name) {
        var _a;
        const v = this.getVariable(name);
        return (_a = v === null || v === void 0 ? void 0 : v.value) !== null && _a !== void 0 ? _a : null;
    }
    clone() {
        return new ExecContext(this);
    }
}
class WgslExec {
    constructor(code, context) {
        var _a;
        const parser = new WgslParser();
        this.ast = parser.parse(code);
        this.reflection = new WgslReflect();
        this.reflection.updateAST(this.ast);
        this.context = (_a = context === null || context === void 0 ? void 0 : context.clone()) !== null && _a !== void 0 ? _a : new ExecContext();
    }
    getVariableValue(name) {
        return this.context.getVariableValue(name);
    }
    execute(config) {
        config = config !== null && config !== void 0 ? config : {};
        if (config["constants"]) {
            for (const k in config["constants"]) {
                const v = config["constants"][k];
                this.context.setVariable(k, v);
            }
        }
        this._execStatements(this.ast, this.context);
    }
    dispatchWorkgroups(kernel, dispatchCount, bindGroups, config) {
        const context = this.context.clone();
        config = config !== null && config !== void 0 ? config : {};
        if (config["constants"]) {
            for (const k in config["constants"]) {
                const v = config["constants"][k];
                context.setVariable(k, v);
            }
        }
        this._execStatements(this.ast, context);
        const f = context.functions.get(kernel);
        if (!f) {
            console.error(`Function ${kernel} not found`);
            return;
        }
        if (typeof dispatchCount === "number") {
            dispatchCount = [dispatchCount, 1, 1];
        }
        else if (dispatchCount.length === 0) {
            console.error(`Invalid dispatch count`);
            return;
        }
        else if (dispatchCount.length === 1) {
            dispatchCount = [dispatchCount[0], 1, 1];
        }
        else if (dispatchCount.length === 2) {
            dispatchCount = [dispatchCount[0], dispatchCount[1], 1];
        }
        else if (dispatchCount.length > 3) {
            dispatchCount = [dispatchCount[0], dispatchCount[1], dispatchCount[2]];
        }
        const depth = dispatchCount[2];
        const height = dispatchCount[1];
        const width = dispatchCount[0];
        context.setVariable("@num_workgroups", dispatchCount);
        for (const set in bindGroups) {
            for (const binding in bindGroups[set]) {
                const entry = bindGroups[set][binding];
                context.variables.forEach((v) => {
                    const node = v.node;
                    if (node === null || node === void 0 ? void 0 : node.attributes) {
                        let b = null;
                        let s = null;
                        for (const attr of node.attributes) {
                            if (attr.name === "binding") {
                                b = attr.value;
                            }
                            else if (attr.name === "group") {
                                s = attr.value;
                            }
                        }
                        if (binding == b && set == s) {
                            if (entry.texture !== undefined && entry.size !== undefined) {
                                // Texture
                                v.value = new Data(entry.texture, this._getTypeInfo(node.type), 0, entry.size);
                            }
                            else if (entry.uniform !== undefined) {
                                // Uniform buffer
                                v.value = new Data(entry.uniform, this._getTypeInfo(node.type));
                            }
                            else {
                                // Storage buffer
                                v.value = new Data(entry, this._getTypeInfo(node.type));
                            }
                        }
                    }
                });
            }
        }
        for (let z = 0; z < depth; ++z) {
            for (let y = 0; y < height; ++y) {
                for (let x = 0; x < width; ++x) {
                    context.setVariable("@workgroup_id", [x, y, z]);
                    this._dispatchWorkgroup(f, [x, y, z], context);
                }
            }
        }
    }
    _dispatchWorkgroup(f, workgroup_id, context) {
        const workgroupSize = [1, 1, 1];
        for (const attr of f.node.attributes) {
            if (attr.name === "workgroup_size") {
                if (attr.value.length > 0) {
                    // The value could be an override constant
                    const v = context.getVariableValue(attr.value[0]);
                    if (v !== null) {
                        workgroupSize[0] = v;
                    }
                    else {
                        workgroupSize[0] = parseInt(attr.value[0]);
                    }
                }
                if (attr.value.length > 1) {
                    const v = context.getVariableValue(attr.value[1]);
                    if (v !== null) {
                        workgroupSize[1] = v;
                    }
                    else {
                        workgroupSize[1] = parseInt(attr.value[1]);
                    }
                }
                if (attr.value.length > 2) {
                    const v = context.getVariableValue(attr.value[2]);
                    if (v !== null) {
                        workgroupSize[2] = v;
                    }
                    else {
                        workgroupSize[2] = parseInt(attr.value[2]);
                    }
                }
            }
        }
        context.setVariable("@workgroup_size", workgroupSize);
        const width = workgroupSize[0];
        const height = workgroupSize[1];
        const depth = workgroupSize[2];
        for (let z = 0, li = 0; z < depth; ++z) {
            for (let y = 0; y < height; ++y) {
                for (let x = 0; x < width; ++x, ++li) {
                    const local_invocation_id = [x, y, z];
                    const global_invocation_id = [
                        x + workgroup_id[0] * workgroupSize[0],
                        y + workgroup_id[1] * workgroupSize[1],
                        z + workgroup_id[2] * workgroupSize[2]
                    ];
                    context.setVariable("@local_invocation_id", local_invocation_id);
                    context.setVariable("@global_invocation_id", global_invocation_id);
                    context.setVariable("@local_invocation_index", li);
                    this._dispatchExec(f, context);
                }
            }
        }
    }
    _dispatchExec(f, context) {
        // Update any built-in input args.
        // TODO: handle input structs.
        for (const arg of f.node.args) {
            for (const attr of arg.attributes) {
                if (attr.name === "builtin") {
                    const globalName = `@${attr.value}`;
                    const globalVar = context.getVariable(globalName);
                    if (globalVar !== undefined) {
                        context.variables.set(arg.name, globalVar);
                    }
                }
            }
        }
        this._execStatements(f.node.body, context);
    }
    _getTypeInfo(type) {
        return this.reflection._types.get(type);
    }
    _getTypeName(type) {
        if (type instanceof Type) {
            type = this._getTypeInfo(type);
        }
        let name = type.name;
        if (type instanceof TemplateInfo) {
            if (type.format !== null) {
                if (name === "vec2" || name === "vec3" || name === "vec4" ||
                    name === "mat2x2" || name === "mat2x3" || name === "mat2x4" ||
                    name === "mat3x2" || name === "mat3x3" || name === "mat3x4" ||
                    name === "mat4x2" || name === "mat4x3" || name === "mat4x4") {
                    if (type.format.name === "f32") {
                        name += "f";
                        return name;
                    }
                    else if (type.format.name === "i32") {
                        name += "i";
                        return name;
                    }
                    else if (type.format.name === "u32") {
                        name += "u";
                        return name;
                    }
                }
                name += `<${type.format.name}>`;
            }
            else {
                console.log("Template format is null.");
            }
        }
        return name;
    }
    _setDataValue(data, value, postfix, context) {
        if (value === null) {
            console.log("_setDataValue: NULL data");
            return;
        }
        let offset = data.offset;
        let typeInfo = data.typeInfo;
        while (postfix) {
            if (postfix instanceof ArrayIndex) {
                if (typeInfo instanceof ArrayInfo) {
                    const idx = postfix.index;
                    if (idx instanceof LiteralExpr) {
                        offset += idx.value * typeInfo.stride;
                    }
                    else {
                        const i = this._evalExpression(idx, context);
                        if (i !== null) {
                            offset += i * typeInfo.stride;
                        }
                        else {
                            console.error(`SetDataValue: Unknown index type`, idx);
                            return;
                        }
                    }
                    typeInfo = typeInfo.format;
                }
                else {
                    console.error(`SetDataValue: Type ${this._getTypeName(typeInfo)} is not an array`);
                }
            }
            else if (postfix instanceof StringExpr) {
                const member = postfix.value;
                if (typeInfo instanceof StructInfo) {
                    let found = false;
                    for (const m of typeInfo.members) {
                        if (m.name === member) {
                            offset += m.offset;
                            typeInfo = m.type;
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        console.error(`SetDataValue: Member ${member} not found`);
                        return;
                    }
                }
                else if (typeInfo instanceof TypeInfo) {
                    const typeName = this._getTypeName(typeInfo);
                    let element = 0;
                    if (member === "x" || member === "r") {
                        element = 0;
                    }
                    else if (member === "y" || member === "g") {
                        element = 1;
                    }
                    else if (member === "z" || member === "b") {
                        element = 2;
                    }
                    else if (member === "w" || member === "a") {
                        element = 3;
                    }
                    else {
                        console.error(`SetDataValue: Unknown member ${member}`);
                        return;
                    }
                    if (typeName === "vec2f") {
                        new Float32Array(data.buffer, offset, 2)[element] = value;
                        return;
                    }
                    else if (typeName === "vec3f") {
                        new Float32Array(data.buffer, offset, 3)[element] = value;
                        return;
                    }
                    else if (typeName === "vec4f") {
                        new Float32Array(data.buffer, offset, 4)[element] = value;
                        return;
                    }
                    else if (typeName === "vec2i") {
                        new Int32Array(data.buffer, offset, 2)[element] = value;
                        return;
                    }
                    else if (typeName === "vec3i") {
                        new Int32Array(data.buffer, offset, 3)[element] = value;
                        return;
                    }
                    else if (typeName === "vec4i") {
                        new Int32Array(data.buffer, offset, 4)[element] = value;
                        return;
                    }
                    else if (typeName === "vec2u") {
                        new Uint32Array(data.buffer, offset, 2)[element] = value;
                        return;
                    }
                    else if (typeName === "vec3u") {
                        new Uint32Array(data.buffer, offset, 3)[element] = value;
                        return;
                    }
                    else if (typeName === "vec4u") {
                        new Uint32Array(data.buffer, offset, 4)[element] = value;
                        return;
                    }
                    console.error(`SetDataValue: Type ${typeName} is not a struct`);
                    return;
                }
            }
            else {
                console.error(`SetDataValue: Unknown postfix type`, postfix);
                return;
            }
            postfix = postfix.postfix;
        }
        this._setData(data, value, typeInfo, offset, context);
    }
    _setData(data, value, typeInfo, offset, context) {
        const typeName = this._getTypeName(typeInfo);
        if (typeName === "f32") {
            new Float32Array(data.buffer, offset, 1)[0] = value;
            return;
        }
        else if (typeName === "i32") {
            new Int32Array(data.buffer, offset, 1)[0] = value;
            return;
        }
        else if (typeName === "u32") {
            new Uint32Array(data.buffer, offset, 1)[0] = value;
            return;
        }
        else if (typeName === "vec2f") {
            const x = new Float32Array(data.buffer, offset, 2);
            x[0] = value[0];
            x[1] = value[1];
            return;
        }
        else if (typeName === "vec3f") {
            const x = new Float32Array(data.buffer, offset, 3);
            x[0] = value[0];
            x[1] = value[1];
            x[2] = value[2];
            return;
        }
        else if (typeName === "vec4f") {
            const x = new Float32Array(data.buffer, offset, 4);
            x[0] = value[0];
            x[1] = value[1];
            x[2] = value[2];
            x[3] = value[3];
            return;
        }
        else if (typeName === "vec2i") {
            const x = new Int32Array(data.buffer, offset, 2);
            x[0] = value[0];
            x[1] = value[1];
            return;
        }
        else if (typeName === "vec3i") {
            const x = new Int32Array(data.buffer, offset, 3);
            x[0] = value[0];
            x[1] = value[1];
            x[2] = value[2];
            return;
        }
        else if (typeName === "vec4i") {
            const x = new Int32Array(data.buffer, offset, 4);
            x[0] = value[0];
            x[1] = value[1];
            x[2] = value[2];
            x[3] = value[3];
            return;
        }
        else if (typeName === "vec2u") {
            const x = new Uint32Array(data.buffer, offset, 2);
            x[0] = value[0];
            x[1] = value[1];
            return;
        }
        else if (typeName === "vec3u") {
            const x = new Uint32Array(data.buffer, offset, 3);
            x[0] = value[0];
            x[1] = value[1];
            x[2] = value[2];
            return;
        }
        else if (typeName === "vec4u") {
            const x = new Uint32Array(data.buffer, offset, 4);
            x[0] = value[0];
            x[1] = value[1];
            x[2] = value[2];
            x[3] = value[3];
            return;
        }
        if (value instanceof Data) {
            if (typeInfo === value.typeInfo) {
                const x = new Uint8Array(data.buffer, offset, value.buffer.byteLength);
                x.set(new Uint8Array(value.buffer));
                return;
            }
            else {
                console.error(`SetDataValue: Type mismatch`, typeName, this._getTypeName(value.typeInfo));
                return;
            }
        }
        console.error(`SetDataValue: Unknown type ${typeName}`);
    }
    _getDataValue(data, postfix, context) {
        let offset = data.offset;
        let typeInfo = data.typeInfo;
        while (postfix) {
            if (postfix instanceof ArrayIndex) {
                if (typeInfo instanceof ArrayInfo) {
                    const idx = postfix.index;
                    if (idx instanceof LiteralExpr) {
                        offset += idx.value * typeInfo.stride;
                    }
                    else {
                        const i = this._evalExpression(idx, context);
                        if (i !== null) {
                            offset += i * typeInfo.stride;
                        }
                        else {
                            console.error(`GetDataValue: Unknown index type`, idx);
                            return null;
                        }
                    }
                    typeInfo = typeInfo.format;
                }
                else {
                    console.error(`Type ${this._getTypeName(typeInfo)} is not an array`);
                }
            }
            else if (postfix instanceof StringExpr) {
                const member = postfix.value;
                if (typeInfo instanceof StructInfo) {
                    let found = false;
                    for (const m of typeInfo.members) {
                        if (m.name === member) {
                            offset += m.offset;
                            typeInfo = m.type;
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        console.error(`GetDataValue: Member ${member} not found`);
                        return null;
                    }
                }
                else if (typeInfo instanceof TypeInfo) {
                    const typeName = this._getTypeName(typeInfo);
                    let element = 0;
                    if (member === "x" || member === "r") {
                        element = 0;
                    }
                    else if (member === "y" || member === "g") {
                        element = 1;
                    }
                    else if (member === "z" || member === "b") {
                        element = 2;
                    }
                    else if (member === "w" || member === "a") {
                        element = 3;
                    }
                    else {
                        console.error(`Unknown member ${member}`);
                        return null;
                    }
                    if (typeName === "vec2f") {
                        return new Float32Array(data.buffer, offset, 2)[element];
                    }
                    else if (typeName === "vec3f") {
                        if ((offset + 12) >= data.buffer.byteLength) {
                            console.log("Insufficient buffer data");
                            return null;
                        }
                        const fa = new Float32Array(data.buffer, offset, 3);
                        return fa[element];
                    }
                    else if (typeName === "vec4f") {
                        return new Float32Array(data.buffer, offset, 4)[element];
                    }
                    else if (typeName === "vec2i") {
                        return new Int32Array(data.buffer, offset, 2)[element];
                    }
                    else if (typeName === "vec3i") {
                        return new Int32Array(data.buffer, offset, 3)[element];
                    }
                    else if (typeName === "vec4i") {
                        return new Int32Array(data.buffer, offset, 4)[element];
                    }
                    else if (typeName === "vec2u") {
                        const ua = new Uint32Array(data.buffer, offset, 2);
                        return ua[element];
                    }
                    else if (typeName === "vec3u") {
                        return new Uint32Array(data.buffer, offset, 3)[element];
                    }
                    else if (typeName === "vec4u") {
                        return new Uint32Array(data.buffer, offset, 4)[element];
                    }
                    console.error(`GetDataValue: Type ${typeName} is not a struct`);
                    return null;
                }
            }
            else {
                console.error(`GetDataValue: Unknown postfix type`, postfix);
                return null;
            }
            postfix = postfix.postfix;
        }
        const typeName = this._getTypeName(typeInfo);
        if (typeName === "f32") {
            return new Float32Array(data.buffer, offset, 1)[0];
        }
        else if (typeName === "i32") {
            return new Int32Array(data.buffer, offset, 1)[0];
        }
        else if (typeName === "u32") {
            return new Uint32Array(data.buffer, offset, 1)[0];
        }
        else if (typeName === "vec2f") {
            return new Float32Array(data.buffer, offset, 2);
        }
        else if (typeName === "vec3f") {
            return new Float32Array(data.buffer, offset, 3);
        }
        else if (typeName === "vec4f") {
            return new Float32Array(data.buffer, offset, 4);
        }
        else if (typeName === "vec2i") {
            return new Int32Array(data.buffer, offset, 2);
        }
        else if (typeName === "vec3i") {
            return new Int32Array(data.buffer, offset, 3);
        }
        else if (typeName === "vec4i") {
            return new Int32Array(data.buffer, offset, 4);
        }
        else if (typeName === "vec2u") {
            return new Uint32Array(data.buffer, offset, 2);
        }
        else if (typeName === "vec3u") {
            return new Uint32Array(data.buffer, offset, 3);
        }
        else if (typeName === "vec4u") {
            return new Uint32Array(data.buffer, offset, 4);
        }
        const newData = new Data(data.buffer, typeInfo, offset);
        return newData;
    }
    _getVariableName(node, context) {
        if (node instanceof VariableExpr) {
            return node.name;
        }
        else {
            console.error(`Unknown variable type`, node, 'Line', node.line);
        }
        return null;
    }
    _execStatements(statements, context) {
        for (const stmt of statements) {
            // Block statements are declared as arrays of statements.
            if (stmt instanceof Array) {
                const subContext = context.clone();
                const res = this._execStatements(stmt, subContext);
                if (res) {
                    return res;
                }
                continue;
            }
            const res = this._execStatement(stmt, context);
            if (res) {
                return res;
            }
        }
        return null;
    }
    _execStatement(stmt, context) {
        if (stmt instanceof Return) {
            return this._evalExpression(stmt.value, context);
        }
        else if (stmt instanceof Break) {
            return stmt;
        }
        else if (stmt instanceof Continue) {
            return stmt;
        }
        else if (stmt instanceof Let) {
            this._let(stmt, context);
        }
        else if (stmt instanceof Var$1) {
            this._var(stmt, context);
        }
        else if (stmt instanceof Const) {
            this._const(stmt, context);
        }
        else if (stmt instanceof Function$1) {
            this._function(stmt, context);
        }
        else if (stmt instanceof If) {
            return this._if(stmt, context);
        }
        else if (stmt instanceof For) {
            return this._for(stmt, context);
        }
        else if (stmt instanceof While) {
            return this._while(stmt, context);
        }
        else if (stmt instanceof Assign) {
            return this._assign(stmt, context);
        }
        else if (stmt instanceof Increment) {
            this._increment(stmt, context);
        }
        else if (stmt instanceof Struct) {
            return null;
        }
        else if (stmt instanceof Override) {
            const name = stmt.name;
            if (context.getVariable(name) === null) {
                console.error(`Override constant ${name} not found. Line ${stmt.line}`);
                return null;
            }
        }
        else {
            console.error(`Unknown statement type.`, stmt, `Line ${stmt.line}`);
        }
        return null;
    }
    _increment(node, context) {
        const name = this._getVariableName(node.variable, context);
        const v = context.getVariable(name);
        if (!v) {
            console.error(`Variable ${name} not found. Line ${node.line}`);
            return;
        }
        if (node.operator === "++") {
            v.value++;
        }
        else if (node.operator === "--") {
            v.value--;
        }
        return v.value;
    }
    _assign(node, context) {
        const name = this._getVariableName(node.variable, context);
        const v = context.getVariable(name);
        if (!v) {
            console.error(`Variable ${name} not found. Line ${node.line}`);
            return;
        }
        let value = this._evalExpression(node.value, context);
        if (node.operator !== "=") {
            const currentValue = this._getDataValue(v.value, node.variable.postfix, context);
            if (currentValue.length !== undefined && value.length !== undefined) {
                if (currentValue.length !== value.length) {
                    console.error(`Vector length mismatch. Line ${node.line}`);
                    return;
                }
                if (node.operator === "+=") {
                    for (let i = 0; i < currentValue.length; ++i) {
                        value[i] = currentValue[i] + value[i];
                    }
                }
                else if (node.operator === "-=") {
                    for (let i = 0; i < currentValue.length; ++i) {
                        value[i] = currentValue[i] - value[i];
                    }
                }
                else if (node.operator === "*=") {
                    for (let i = 0; i < currentValue.length; ++i) {
                        value[i] = currentValue[i] * value[i];
                    }
                }
                else if (node.operator === "/=") {
                    for (let i = 0; i < currentValue.length; ++i) {
                        value[i] = currentValue[i] / value[i];
                    }
                }
                else if (node.operator === "%=") {
                    for (let i = 0; i < currentValue.length; ++i) {
                        value[i] = currentValue[i] % value[i];
                    }
                }
                else if (node.operator === "&=") {
                    for (let i = 0; i < currentValue.length; ++i) {
                        value[i] = currentValue[i] & value[i];
                    }
                }
                else if (node.operator === "|=") {
                    for (let i = 0; i < currentValue.length; ++i) {
                        value[i] = currentValue[i] | value[i];
                    }
                }
                else if (node.operator === "^=") {
                    for (let i = 0; i < currentValue.length; ++i) {
                        value[i] = currentValue[i] ^ value[i];
                    }
                }
                else if (node.operator === "<<=") {
                    for (let i = 0; i < currentValue.length; ++i) {
                        value[i] = currentValue[i] << value[i];
                    }
                }
                else if (node.operator === ">>=") {
                    for (let i = 0; i < currentValue.length; ++i) {
                        value[i] = currentValue[i] >> value[i];
                    }
                }
            }
            else {
                if (node.operator === "+=") {
                    value = currentValue + value;
                }
                else if (node.operator === "-=") {
                    value = currentValue - value;
                }
                else if (node.operator === "*=") {
                    value = currentValue * value;
                }
                else if (node.operator === "/=") {
                    value = currentValue / value;
                }
                else if (node.operator === "%=") {
                    value = currentValue % value;
                }
                else if (node.operator === "&=") {
                    value = currentValue & value;
                }
                else if (node.operator === "|=") {
                    value = currentValue | value;
                }
                else if (node.operator === "^=") {
                    value = currentValue - value;
                }
                else if (node.operator === "<<=") {
                    value = currentValue << value;
                }
                else if (node.operator === ">>=") {
                    value = currentValue >> value;
                }
            }
        }
        if (v.value instanceof Data) {
            this._setDataValue(v.value, value, node.variable.postfix, context);
        }
        else if (node.variable.postfix) {
            if (node.variable.postfix instanceof ArrayIndex) {
                const idx = this._evalExpression(node.variable.postfix.index, context);
                // TODO: use array format to determine how to set the value
                if (v.value.length !== undefined) {
                    if (v.node.type.isArray) {
                        const arrayType = v.node.type;
                        if (arrayType.format.name === "vec3" ||
                            arrayType.format.name === "vec3u" ||
                            arrayType.format.name === "vec3i" ||
                            arrayType.format.name === "vec3f") {
                            v.value[idx * 3 + 0] = value[0];
                            v.value[idx * 3 + 1] = value[1];
                            v.value[idx * 3 + 2] = value[2];
                        }
                        else if (arrayType.format.name === "vec4" ||
                            arrayType.format.name === "vec4u" ||
                            arrayType.format.name === "vec4i" ||
                            arrayType.format.name === "vec4f") {
                            v.value[idx * 4 + 0] = value[0];
                            v.value[idx * 4 + 1] = value[1];
                            v.value[idx * 4 + 2] = value[2];
                            v.value[idx * 4 + 3] = value[3];
                        }
                        else {
                            v.value[idx] = value;
                        }
                    }
                    else {
                        v.value[idx] = value;
                    }
                }
                else {
                    console.error(`Variable ${v.name} is not an array. Line ${node.line}`);
                }
            }
            else if (node.variable.postfix instanceof StringExpr) {
                console.error(`TODO Struct member. Line ${node.line}`);
            }
        }
        else {
            v.value = value;
        }
    }
    _function(node, context) {
        const f = new Function(node);
        context.functions.set(node.name, f);
    }
    _const(node, context) {
        let value = null;
        if (node.value != null) {
            value = this._evalExpression(node.value, context);
        }
        context.createVariable(node.name, value, node);
    }
    _let(node, context) {
        let value = null;
        if (node.value != null) {
            value = this._evalExpression(node.value, context);
        }
        context.createVariable(node.name, value, node);
    }
    _var(node, context) {
        let value = null;
        if (node.value != null) {
            value = this._evalExpression(node.value, context);
        }
        context.createVariable(node.name, value, node);
    }
    _if(node, context) {
        context = context.clone();
        const condition = this._evalExpression(node.condition, context);
        if (condition) {
            return this._execStatements(node.body, context);
        }
        for (const e of node.elseif) {
            const condition = this._evalExpression(e.condition, context);
            if (condition) {
                return this._execStatements(e.body, context);
            }
        }
        if (node.else) {
            return this._execStatements(node.else, context);
        }
        return null;
    }
    _for(node, context) {
        context = context.clone();
        this._execStatement(node.init, context);
        while (this._evalExpression(node.condition, context)) {
            const res = this._execStatements(node.body, context);
            if (res) {
                return res;
            }
            this._execStatement(node.increment, context);
        }
        return null;
    }
    _while(node, context) {
        context = context.clone();
        let condition = this._evalExpression(node.condition, context);
        while (condition) {
            const res = this._execStatements(node.body, context);
            if (res instanceof Break) {
                break;
            }
            else if (res instanceof Continue) {
                continue;
            }
            else if (res !== null) {
                return res;
            }
            condition = this._evalExpression(node.condition, context);
        }
        return null;
    }
    _evalExpression(node, context) {
        if (node instanceof GroupingExpr) {
            const grp = node;
            return this._evalExpression(grp.contents[0], context);
        }
        else if (node instanceof BinaryOperator) {
            return this._evalBinaryOp(node, context);
        }
        else if (node instanceof LiteralExpr) {
            return this._evalLiteral(node, context);
        }
        else if (node instanceof StringExpr) {
            return node.value;
        }
        else if (node instanceof VariableExpr) {
            return this._evalVariable(node, context);
        }
        else if (node instanceof CallExpr) {
            return this._evalCall(node, context);
        }
        else if (node instanceof CreateExpr) {
            return this._evalCreate(node, context);
        }
        else if (node instanceof ConstExpr) {
            return this._evalConst(node, context);
        }
        console.error(`Unknown expression type`, node, `Line ${node.line}`);
        return null;
    }
    _evalConst(node, context) {
        const v = context.getVariableValue(node.name);
        return v;
    }
    _evalCreate(node, context) {
        const typeName = this._getTypeName(node.type);
        switch (typeName) {
            // Constructor Built-in Functions
            // Value Constructor Built-in Functions
            case "bool":
                this._callConstructorValue(node, context) ? 1 : 0;
            case "i32":
            case "u32":
                return Math.floor(this._callConstructorValue(node, context));
            case "f32":
            case "f16":
                this._callConstructorValue(node, context);
            case "vec2":
            case "vec3":
            case "vec4":
            case "vec2f":
            case "vec3f":
            case "vec4f":
            case "vec2i":
            case "vec3i":
            case "vec4i":
            case "vec2u":
            case "vec3u":
            case "vec4u":
                return this._callConstructorVec(node, context);
            case "mat2x2":
            case "mat2x2i":
            case "mat2x2u":
            case "mat2x2f":
            case "mat2x3":
            case "mat2x3i":
            case "mat2x3u":
            case "mat2x3f":
            case "mat2x4":
            case "mat2x4i":
            case "mat2x4u":
            case "mat2x4f":
            case "mat3x2":
            case "mat3x2i":
            case "mat3x2u":
            case "mat3x2f":
            case "mat3x3":
            case "mat3x3i":
            case "mat3x3u":
            case "mat3x3f":
            case "mat3x4":
            case "mat3x4i":
            case "mat3x4u":
            case "mat3x4f":
            case "mat4x2":
            case "mat4x2i":
            case "mat4x2u":
            case "mat4x2f":
            case "mat4x3":
            case "mat4x3i":
            case "mat4x3u":
            case "mat4x3f":
            case "mat4x4":
            case "mat4x4i":
            case "mat4x4u":
            case "mat4x4f":
                return this._callConstructorMatrix(node, context);
            case "array":
                return this._callConstructorArray(node, context);
        }
        const typeInfo = this._getTypeInfo(node.type);
        if (typeInfo === null) {
            console.error(`Unknown type ${typeName}. Line ${node.line}`);
            return null;
        }
        const data = new Data(new ArrayBuffer(typeInfo.size), typeInfo, 0);
        // Assign the values in node.args to the data.
        if (typeInfo instanceof StructInfo) {
            for (let i = 0; i < node.args.length; ++i) {
                const memberInfo = typeInfo.members[i];
                const arg = node.args[i];
                const value = this._evalExpression(arg, context);
                this._setData(data, value, memberInfo.type, memberInfo.offset, context);
            }
        }
        else {
            console.error(`Unknown type "${typeName}". Line ${node.line}`);
        }
        return data;
    }
    _evalLiteral(node, context) {
        return node.value;
    }
    _getArraySwizzle(value, member) {
        const swizzleIndex = { "x": 0, "y": 1, "z": 2, "w": 3, "r": 0, "g": 1, "b": 2, "a": 3 };
        const m = member.toLocaleLowerCase();
        if (member.length === 1) {
            const idx = swizzleIndex[m];
            if (idx !== undefined) {
                return value[idx];
            }
        }
        else if (member.length === 2) {
            const idx0 = swizzleIndex[m[0]];
            const idx1 = swizzleIndex[m[1]];
            if (idx0 !== undefined && idx1 !== undefined) {
                return [value[idx0], value[idx1]];
            }
        }
        else if (member.length === 3) {
            const idx0 = swizzleIndex[m[0]];
            const idx1 = swizzleIndex[m[1]];
            const idx2 = swizzleIndex[m[2]];
            if (idx0 !== undefined && idx1 !== undefined && idx2 !== undefined) {
                return [value[idx0], value[idx1], value[idx2]];
            }
        }
        else if (member.length === 4) {
            const idx0 = swizzleIndex[m[0]];
            const idx1 = swizzleIndex[m[1]];
            const idx2 = swizzleIndex[m[2]];
            const idx3 = swizzleIndex[m[3]];
            if (idx0 !== undefined && idx1 !== undefined && idx2 !== undefined && idx3 !== undefined) {
                return [value[idx0], value[idx1], value[idx2], value[idx3]];
            }
        }
        console.error(`Unknown member ${member}`);
        return null;
    }
    _evalVariable(node, context) {
        var _a;
        const value = context.getVariableValue(node.name);
        if (value instanceof Data) {
            return this._getDataValue(value, node.postfix, context);
        }
        if (node.postfix) {
            if (node.postfix instanceof ArrayIndex) {
                const idx = this._evalExpression(node.postfix.index, context);
                if ((value === null || value === void 0 ? void 0 : value.length) !== undefined) {
                    return value[idx];
                }
                else {
                    console.error(`Variable ${node.name} is not an array. Line ${node.line}`);
                }
            }
            else if (node.postfix instanceof StringExpr) {
                const member = node.postfix.value;
                if (value instanceof Array) {
                    return this._getArraySwizzle(value, member);
                }
                else {
                    const variable = context.getVariable(node.name);
                    if (variable) {
                        if ((_a = variable.node.type) === null || _a === void 0 ? void 0 : _a.isStruct) {
                            const structInfo = this.reflection.getStructInfo(variable.node.type.name);
                            for (const m of structInfo.members) {
                                if (m.name === member) {
                                    const v = new Float32Array(variable.value.buffer, m.offset);
                                    if (node.postfix.postfix) {
                                        const postfix = this._evalExpression(node.postfix.postfix, context);
                                        return this._getArraySwizzle(value, postfix);
                                    }
                                    return v;
                                }
                            }
                            console.log(structInfo);
                        }
                    }
                    console.error(`Unknown variable postfix`, node.postfix, `. Line ${node.line}`);
                }
            }
        }
        return value;
    }
    _evalBinaryOp(node, context) {
        const l = this._evalExpression(node.left, context);
        const r = this._evalExpression(node.right, context);
        switch (node.operator) {
            case "+":
                return l + r;
            case "-":
                return l - r;
            case "*":
                return l * r;
            case "%":
                return l % r;
            case "/":
                return l / r;
            case ">":
                if (l.length !== undefined && r.length !== undefined) {
                    if (l.length !== r.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    return l.map((x, i) => x > r[i]);
                }
                return l > r;
            case "<":
                if (l.length !== undefined && r.length !== undefined) {
                    if (l.length !== r.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    return l.map((x, i) => x < r[i]);
                }
                return l < r;
            case "==":
                return l === r;
            case "!=":
                return l !== r;
            case ">=":
                return l >= r;
            case "<=":
                return l <= r;
            case "&&":
                return l && r;
            case "||":
                return l || r;
        }
        console.error(`Unknown operator ${node.operator}. Line ${node.line}`);
        return null;
    }
    _evalCall(node, context) {
        const f = context.functions.get(node.name);
        if (!f) {
            return this._callFunction(node, context);
        }
        const subContext = context.clone();
        for (let ai = 0; ai < f.node.args.length; ++ai) {
            const arg = f.node.args[ai];
            const value = this._evalExpression(node.args[ai], subContext);
            subContext.setVariable(arg.name, value, arg);
        }
        return this._execStatements(f.node.body, subContext);
    }
    _callFunction(node, context) {
        switch (node.name) {
            // Logical Built-in Functions
            case "all":
                return this._callAll(node, context);
            case "any":
                return this._callAny(node, context);
            case "select":
                return this._callSelect(node, context);
            // Array Built-in Functions
            case "arrayLength":
                return this._callArrayLength(node, context);
            // Numeric Built-in Functions
            case "abs":
                return this._callAbs(node, context);
            case "acos":
                return this._callAcos(node, context);
            case "acosh":
                return this._callAcosh(node, context);
            case "asin":
                return this._callAsin(node, context);
            case "asinh":
                return this._callAsinh(node, context);
            case "atan":
                return this._callAtan(node, context);
            case "atanh":
                return this._callAtanh(node, context);
            case "atan2":
                return this._callAtan2(node, context);
            case "ceil":
                return this._callCeil(node, context);
            case "clamp":
                return this._callClamp(node, context);
            case "cos":
                return this._callCos(node, context);
            case "cosh":
                return this._callCosh(node, context);
            case "countLeadingZeros":
                return this._callCountLeadingZeros(node, context);
            case "countOneBits":
                return this._callCountOneBits(node, context);
            case "countTrailingZeros":
                return this._callCountTrailingZeros(node, context);
            case "cross":
                return this._callCross(node, context);
            case "degrees":
                return this._callDegrees(node, context);
            case "determinant":
                return this._callDeterminant(node, context);
            case "distance":
                return this._callDistance(node, context);
            case "dot":
                return this._callDot(node, context);
            case "dot4U8Packed":
                return this._callDot4U8Packed(node, context);
            case "dot4I8Packed":
                return this._callDot4I8Packed(node, context);
            case "exp":
                return this._callExp(node, context);
            case "exp2":
                return this._callExp2(node, context);
            case "extractBits":
                return this._callExtractBits(node, context);
            case "faceForward":
                return this._callFaceForward(node, context);
            case "firstLeadingBit":
                return this._callFirstLeadingBit(node, context);
            case "firstTrailingBit":
                return this._callFirstTrailingBit(node, context);
            case "floor":
                return this._callFloor(node, context);
            case "fma":
                return this._callFma(node, context);
            case "fract":
                return this._callFract(node, context);
            case "frexp":
                return this._callFrexp(node, context);
            case "insertBits":
                return this._callInsertBits(node, context);
            case "inverseSqrt":
                return this._callInverseSqrt(node, context);
            case "ldexp":
                return this._callLdexp(node, context);
            case "length":
                return this._callLength(node, context);
            case "log":
                return this._callLog(node, context);
            case "log2":
                return this._callLog2(node, context);
            case "max":
                return this._callMax(node, context);
            case "min":
                return this._callMin(node, context);
            case "mix":
                return this._callMix(node, context);
            case "modf":
                return this._callModf(node, context);
            case "normalize":
                return this._callNormalize(node, context);
            case "pow":
                return this._callPow(node, context);
            case "quantizeToF16":
                return this._callQuantizeToF16(node, context);
            case "radians":
                return this._callRadians(node, context);
            case "reflect":
                return this._callReflect(node, context);
            case "refract":
                return this._callRefract(node, context);
            case "reverseBits":
                return this._callReverseBits(node, context);
            case "round":
                return this._callRound(node, context);
            case "saturate":
                return this._callSaturate(node, context);
            case "sign":
                return this._callSign(node, context);
            case "sin":
                return this._callSin(node, context);
            case "sinh":
                return this._callSinh(node, context);
            case "smoothStep":
                return this._callSmoothStep(node, context);
            case "sqrt":
                return this._callSqrt(node, context);
            case "step":
                return this._callStep(node, context);
            case "tan":
                return this._callTan(node, context);
            case "tanh":
                return this._callTanh(node, context);
            case "transpose":
                return this._callTranspose(node, context);
            case "trunc":
                return this._callTrunc(node, context);
            // Derivative Built-in Functions
            case "dpdx":
                return this._callDpdx(node, context);
            case "dpdxCoarse":
                return this._callDpdxCoarse(node, context);
            case "dpdxFine":
                return this._callDpdxFine(node, context);
            case "dpdy":
                return this._callDpdy(node, context);
            case "dpdyCoarse":
                return this._callDpdyCoarse(node, context);
            case "dpdyFine":
                return this._callDpdyFine(node, context);
            case "fwidth":
                return this._callFwidth(node, context);
            case "fwidthCoarse":
                return this._callFwidthCoarse(node, context);
            case "fwidthFine":
                return this._callFwidthFine(node, context);
            // Texture Built-in Functions
            case "textureDimensions":
                return this._callTextureDimensions(node, context);
            case "textureGather":
                return this._callTextureGather(node, context);
            case "textureGatherCompare":
                return this._callTextureGatherCompare(node, context);
            case "textureLoad":
                return this._callTextureLoad(node, context);
            case "textureNumLayers":
                return this._callTextureNumLayers(node, context);
            case "textureNumLevels":
                return this._callTextureNumLevels(node, context);
            case "textureNumSamples":
                return this._callTextureNumSamples(node, context);
            case "textureSample":
                return this._callTextureSample(node, context);
            case "textureSampleBias":
                return this._callTextureSampleBias(node, context);
            case "textureSampleCompare":
                return this._callTextureSampleCompare(node, context);
            case "textureSampleCompareLevel":
                return this._callTextureSampleCompareLevel(node, context);
            case "textureSampleGrad":
                return this._callTextureSampleGrad(node, context);
            case "textureSampleLevel":
                return this._callTextureSampleLevel(node, context);
            case "textureSampleBaseClampToEdge":
                return this._callTextureSampleBaseClampToEdge(node, context);
            case "textureStore":
                return this._callTextureStore(node, context);
            // Atomic Built-in Functions
            case "atomicLoad":
                return this._callAtomicLoad(node, context);
            case "atomicStore":
                return this._callAtomicStore(node, context);
            case "atomicAdd":
                return this._callAtomicAdd(node, context);
            case "atomicSub":
                return this._callAtomicSub(node, context);
            case "atomicMax":
                return this._callAtomicMax(node, context);
            case "atomicMin":
                return this._callAtomicMin(node, context);
            case "atomicAnd":
                return this._callAtomicAnd(node, context);
            case "atomicOr":
                return this._callAtomicOr(node, context);
            case "atomicXor":
                return this._callAtomicXor(node, context);
            case "atomicExchange":
                return this._callAtomicExchange(node, context);
            case "atomicCompareExchangeWeak":
                return this._callAtomicCompareExchangeWeak(node, context);
            // Data Packing Built-in Functions
            case "pack4x8snorm":
                return this._callPack4x8snorm(node, context);
            case "pack4x8unorm":
                return this._callPack4x8unorm(node, context);
            case "pack4xI8":
                return this._callPack4xI8(node, context);
            case "pack4xU8":
                return this._callPack4xU8(node, context);
            case "pack4x8Clamp":
                return this._callPack4x8Clamp(node, context);
            case "pack4xU8Clamp":
                return this._callPack4xU8Clamp(node, context);
            case "pack2x16snorm":
                return this._callPack2x16snorm(node, context);
            case "pack2x16unorm":
                return this._callPack2x16unorm(node, context);
            case "pack2x16float":
                return this._callPack2x16float(node, context);
            // Data Unpacking Built-in Functions
            case "unpack4x8snorm":
                return this._callUnpack4x8snorm(node, context);
            case "unpack4x8unorm":
                return this._callUnpack4x8unorm(node, context);
            case "unpack4xI8":
                return this._callUnpack4xI8(node, context);
            case "unpack4xU8":
                return this._callUnpack4xU8(node, context);
            case "unpack2x16snorm":
                return this._callUnpack2x16snorm(node, context);
            case "unpack2x16unorm":
                return this._callUnpack2x16unorm(node, context);
            case "unpack2x16float":
                return this._callUnpack2x16float(node, context);
            // Synchronization Built-in Functions
            case "storageBarrier":
                return this._callStorageBarrier(node, context);
            case "textureBarrier":
                return this._callTextureBarrier(node, context);
            case "workgroupBarrier":
                return this._callWorkgroupBarrier(node, context);
            case "workgroupUniformLoad":
                return this._callWorkgroupUniformLoad(node, context);
            // Subgroup Built-in Functions
            case "subgroupAdd":
                return this._callSubgroupAdd(node, context);
            case "subgroupExclusiveAdd":
                return this._callSubgroupExclusiveAdd(node, context);
            case "subgroupInclusiveAdd":
                return this._callSubgroupInclusiveAdd(node, context);
            case "subgroupAll":
                return this._callSubgroupAll(node, context);
            case "subgroupAnd":
                return this._callSubgroupAnd(node, context);
            case "subgroupAny":
                return this._callSubgroupAny(node, context);
            case "subgroupBallot":
                return this._callSubgroupBallot(node, context);
            case "subgroupBroadcast":
                return this._callSubgroupBroadcast(node, context);
            case "subgroupBroadcastFirst":
                return this._callSubgroupBroadcastFirst(node, context);
            case "subgroupElect":
                return this._callSubgroupElect(node, context);
            case "subgroupMax":
                return this._callSubgroupMax(node, context);
            case "subgroupMin":
                return this._callSubgroupMin(node, context);
            case "subgroupMul":
                return this._callSubgroupMul(node, context);
            case "subgroupExclusiveMul":
                return this._callSubgroupExclusiveMul(node, context);
            case "subgroupInclusiveMul":
                return this._callSubgroupInclusiveMul(node, context);
            case "subgroupOr":
                return this._callSubgroupOr(node, context);
            case "subgroupShuffle":
                return this._callSubgroupShuffle(node, context);
            case "subgroupShuffleDown":
                return this._callSubgroupShuffleDown(node, context);
            case "subgroupShuffleUp":
                return this._callSubgroupShuffleUp(node, context);
            case "subgroupShuffleXor":
                return this._callSubgroupShuffleXor(node, context);
            case "subgroupXor":
                return this._callSubgroupXor(node, context);
            // Quad Operations
            case "quadBroadcast":
                return this._callQuadBroadcast(node, context);
            case "quadSwapDiagonal":
                return this._callQuadSwapDiagonal(node, context);
            case "quadSwapX":
                return this._callQuadSwapX(node, context);
            case "quadSwapY":
                return this._callQuadSwapY(node, context);
        }
        const f = context.getFunction(node.name);
        if (f) {
            const subContext = context.clone();
            for (let ai = 0; ai < f.node.args.length; ++ai) {
                const arg = f.node.args[ai];
                const value = this._evalExpression(node.args[ai], subContext);
                subContext.setVariable(arg.name, value, arg);
            }
            return this._execStatements(f.node.body, subContext);
        }
        console.error(`Function ${node.name} not found. Line ${node.line}`);
        return null;
    }
    _callConstructorValue(node, context) {
        if (node.args.length === 0) {
            return 0;
        }
        return this._evalExpression(node.args[0], context);
    }
    _callConstructorArray(node, context) {
        if (node.args.length === 0) {
            if (node.type instanceof ArrayType) {
                if (node.type.count) {
                    const format = node.type.format.name;
                    if (format === "bool" || format === "i32" || format === "u32" || format === "f32" || format === "f16") {
                        return new Array(node.type.count).fill(0);
                    }
                    else if (format === "vec2" || format === "vec2u" || format === "vec2i" || format === "vec2f") {
                        return new Array(node.type.count).fill([0, 0]);
                    }
                    else if (format === "vec3" || format === "vec3u" || format === "vec3i" || format === "vec3f") {
                        return new Array(node.type.count).fill([0, 0, 0]);
                    }
                    else if (format === "vec4" || format === "vec4u" || format === "vec4i" || format === "vec4f") {
                        return new Array(node.type.count).fill([0, 0, 0, 0]);
                    }
                    else if (format === "mat2x2") {
                        return new Array(node.type.count).fill([0, 0, 0, 0]);
                    }
                    else if (format === "mat2x3") {
                        return new Array(node.type.count).fill([0, 0, 0, 0, 0, 0]);
                    }
                    else if (format === "mat2x4") {
                        return new Array(node.type.count).fill([0, 0, 0, 0, 0, 0, 0, 0]);
                    }
                    else if (format === "mat3x2") {
                        return new Array(node.type.count).fill([0, 0, 0, 0, 0, 0]);
                    }
                    else if (format === "mat3x3") {
                        return new Array(node.type.count).fill([0, 0, 0, 0, 0, 0, 0, 0, 0]);
                    }
                    else if (format === "mat3x4") {
                        return new Array(node.type.count).fill([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
                    }
                    else if (format === "mat4x2") {
                        return new Array(node.type.count).fill([0, 0, 0, 0, 0, 0, 0, 0]);
                    }
                    else if (format === "mat4x3") {
                        return new Array(node.type.count).fill([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
                    }
                    else if (format === "mat4x4") {
                        return new Array(node.type.count).fill([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
                    }
                    else {
                        console.error(`TODO: support array format ${format}. Line ${node.line}`);
                        return null;
                    }
                }
            }
            return [];
        }
        const values = [];
        for (const arg of node.args) {
            values.push(this._evalExpression(arg, context));
        }
        return values;
    }
    _callConstructorVec(node, context) {
        const typeName = node instanceof CallExpr ? node.name : this._getTypeName(node.type);
        if (node.args.length === 0) {
            if (typeName === "vec2" || typeName === "vec2f" || typeName === "vec2i" || typeName === "vec2u") {
                return [0, 0];
            }
            else if (typeName === "vec3" || typeName === "vec3f" || typeName === "vec3i" || typeName === "vec3u") {
                return [0, 0, 0];
            }
            else if (typeName === "vec4" || typeName === "vec4f" || typeName === "vec4i" || typeName === "vec4u") {
                return [0, 0, 0, 0];
            }
            console.error(`Invalid vec constructor ${typeName}. Line ${node.line}`);
            return null;
        }
        const isInt = typeName.endsWith("i") || typeName.endsWith("u");
        const values = [];
        // TODO: make sure the number of args matches the vector length.
        for (const arg of node.args) {
            let v = this._evalExpression(arg, context);
            if (isInt) {
                v = Math.floor(v);
            }
            values.push(v);
        }
        if (typeName == "f32" || typeName == "f16" || typeName == "i32" || typeName == "u32") {
            return values[0];
        }
        return values;
    }
    _callConstructorMatrix(node, context) {
        const typeName = node instanceof CallExpr ? node.name : this._getTypeName(node.type);
        if (node.args.length === 0) {
            if (typeName === "mat2x2" || typeName === "mat2x2f" || typeName === "mat2x2i" || typeName === "mat2x2u") {
                return [0, 0, 0, 0];
            }
            else if (typeName === "mat2x3" || typeName === "mat2x3f" || typeName === "mat2x3i" || typeName === "mat2x3u") {
                return [0, 0, 0, 0, 0, 0];
            }
            else if (typeName === "mat2x4" || typeName === "mat2x4f" || typeName === "mat2x4i" || typeName === "mat2x4u") {
                return [0, 0, 0, 0, 0, 0, 0, 0];
            }
            else if (typeName === "mat3x2" || typeName === "mat3x2f" || typeName === "mat3x2i" || typeName === "mat3x2u") {
                return [0, 0, 0, 0, 0, 0];
            }
            else if (typeName === "mat3x3" || typeName === "mat3x3f" || typeName === "mat3x3i" || typeName === "mat3x3u") {
                return [0, 0, 0, 0, 0, 0, 0, 0, 0];
            }
            else if (typeName === "mat3x4" || typeName === "mat3x4f" || typeName === "mat3x4i" || typeName === "mat3x4u") {
                return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            }
            else if (typeName === "mat4x2" || typeName === "mat4x2f" || typeName === "mat4x2i" || typeName === "mat4x2u") {
                return [0, 0, 0, 0, 0, 0, 0, 0];
            }
            else if (typeName === "mat4x3" || typeName === "mat4x3f" || typeName === "mat4x3i" || typeName === "mat4x3u") {
                return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            }
            else if (typeName === "mat4x4" || typeName === "mat4x4f" || typeName === "mat4x4i" || typeName === "mat4x4u") {
                return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            }
            console.error(`Invalid matrix constructor ${typeName}. Line ${node.line}`);
            return null;
        }
        const isInt = typeName.endsWith("i") || typeName.endsWith("u");
        const values = [];
        // TODO: make sure the number of args matches the matrix size.
        for (const arg of node.args) {
            let v = this._evalExpression(arg, context);
            if (isInt) {
                v = Math.floor(v);
            }
            values.push(v);
        }
        return values;
    }
    // Logical Built-in Functions
    _callAll(node, context) {
        const value = this._evalExpression(node.args[0], context);
        let isTrue = true;
        value.forEach((x) => { if (!x)
            isTrue = false; });
        return isTrue;
    }
    _callAny(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return value.some((v) => v);
    }
    _callSelect(node, context) {
        const condition = this._evalExpression(node.args[2], context);
        if (condition) {
            return this._evalExpression(node.args[0], context);
        }
        else {
            return this._evalExpression(node.args[1], context);
        }
    }
    // Array Built-in Functions
    _callArrayLength(node, context) {
        let arrayArg = node.args[0];
        // TODO: handle "&" operator
        if (arrayArg instanceof UnaryOperator) {
            arrayArg = arrayArg.right;
        }
        const arrayData = this._evalExpression(arrayArg, context);
        if (arrayData.typeInfo.size === 0) {
            const count = arrayData.buffer.byteLength / arrayData.typeInfo.stride;
            return count;
        }
        return arrayData.typeInfo.size;
    }
    // Numeric Built-in Functions
    _callAbs(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return Math.abs(value);
    }
    _callAcos(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return Math.acos(value);
    }
    _callAcosh(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return Math.acosh(value);
    }
    _callAsin(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return Math.asin(value);
    }
    _callAsinh(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return Math.asinh(value);
    }
    _callAtan(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return Math.atan(value);
    }
    _callAtanh(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return Math.atanh(value);
    }
    _callAtan2(node, context) {
        const y = this._evalExpression(node.args[0], context);
        const x = this._evalExpression(node.args[1], context);
        return Math.atan2(y, x);
    }
    _callCeil(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return Math.ceil(value);
    }
    _callClamp(node, context) {
        const value = this._evalExpression(node.args[0], context);
        const min = this._evalExpression(node.args[1], context);
        const max = this._evalExpression(node.args[2], context);
        return Math.min(Math.max(value, min), max);
    }
    _callCos(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return Math.cos(value);
    }
    _callCosh(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return Math.cosh(value);
    }
    _callCountLeadingZeros(node, context) {
        // TODO: vecN support
        const value = this._evalExpression(node.args[0], context);
        return Math.clz32(value);
    }
    _callCountOneBits(node, context) {
        // TODO: vecN support
        let x = this._evalExpression(node.args[0], context);
        let count = 0;
        while (x !== 0) {
            if (x & 1) {
                count++;
            }
            x >>= 1;
        }
        return count;
    }
    _callCountTrailingZeros(node, context) {
        // TODO: vecN support
        let x = this._evalExpression(node.args[0], context);
        if (x === 0) {
            return 32; // Special case for 0
        }
        let count = 0;
        while ((x & 1) === 0) {
            x >>= 1;
            count++;
        }
        return count;
    }
    _callCross(node, context) {
        const l = this._evalExpression(node.args[0], context);
        const r = this._evalExpression(node.args[1], context);
        return [
            l[1] * r[2] - r[1] * l[2],
            l[2] * r[0] - r[2] * l[0],
            l[0] * r[1] - r[0] * l[1],
        ];
    }
    _callDegrees(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return value * 180 / Math.PI;
    }
    _callDeterminant(node, context) {
        const m = this._evalExpression(node.args[0], context);
        // TODO: get the dimensions of the matrix
        if (m.length === 4) {
            return m[0] * m[3] - m[1] * m[2];
        }
        console.error(`TODO: determinant for matrix. Line ${node.line}`);
        return null;
    }
    _callDistance(node, context) {
        const l = this._evalExpression(node.args[0], context);
        const r = this._evalExpression(node.args[1], context);
        let sum = 0;
        for (let i = 0; i < l.length; ++i) {
            sum += (l[i] - r[i]) * (l[i] - r[i]);
        }
        return Math.sqrt(sum);
    }
    _callDot(node, context) {
        const l = this._evalExpression(node.args[0], context);
        const r = this._evalExpression(node.args[1], context);
        let sum = 0;
        for (let i = 0; i < l.length; ++i) {
            sum += l[i] * r[i];
        }
        return sum;
    }
    _callDot4U8Packed(node, context) {
        console.error("TODO: dot4U8Packed");
        return null;
    }
    _callDot4I8Packed(node, context) {
        console.error("TODO: dot4I8Packed");
        return null;
    }
    _callExp(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return Math.exp(value);
    }
    _callExp2(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return Math.pow(2, value);
    }
    _callExtractBits(node, context) {
        const value = this._evalExpression(node.args[0], context);
        const offset = this._evalExpression(node.args[1], context);
        const count = this._evalExpression(node.args[2], context);
        return (value >> offset) & ((1 << count) - 1);
    }
    _callFaceForward(node, context) {
        console.error("TODO: faceForward");
        return null;
    }
    _callFirstLeadingBit(node, context) {
        console.error("TODO: firstLeadingBit");
        return null;
    }
    _callFirstTrailingBit(node, context) {
        console.error("TODO: firstTrailingBit");
        return null;
    }
    _callFloor(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return Math.floor(value);
    }
    _callFma(node, context) {
        const a = this._evalExpression(node.args[0], context);
        const b = this._evalExpression(node.args[1], context);
        const c = this._evalExpression(node.args[2], context);
        return a * b + c;
    }
    _callFract(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return value - Math.floor(value);
    }
    _callFrexp(node, context) {
        console.error("TODO: frexp");
        return null;
    }
    _callInsertBits(node, context) {
        const value = this._evalExpression(node.args[0], context);
        const insert = this._evalExpression(node.args[1], context);
        const offset = this._evalExpression(node.args[2], context);
        const count = this._evalExpression(node.args[3], context);
        const mask = ((1 << count) - 1) << offset;
        return (value & ~mask) | ((insert << offset) & mask);
    }
    _callInverseSqrt(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return 1 / Math.sqrt(value);
    }
    _callLdexp(node, context) {
        console.error("TODO: ldexp");
        return null;
    }
    _callLength(node, context) {
        const value = this._evalExpression(node.args[0], context);
        let sum = 0;
        for (let i = 0; i < value.length; ++i) {
            sum += value[i] * value[i];
        }
        return Math.sqrt(sum);
    }
    _callLog(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return Math.log(value);
    }
    _callLog2(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return Math.log2(value);
    }
    _callMax(node, context) {
        const l = this._evalExpression(node.args[0], context);
        const r = this._evalExpression(node.args[1], context);
        return Math.max(l, r);
    }
    _callMin(node, context) {
        const l = this._evalExpression(node.args[0], context);
        const r = this._evalExpression(node.args[1], context);
        return Math.min(l, r);
    }
    _callMix(node, context) {
        const x = this._evalExpression(node.args[0], context);
        const y = this._evalExpression(node.args[1], context);
        const a = this._evalExpression(node.args[2], context);
        return x * (1 - a) + y * a;
    }
    _callModf(node, context) {
        console.error("TODO: modf");
        return null;
    }
    _callNormalize(node, context) {
        const value = this._evalExpression(node.args[0], context);
        const length = this._callLength(node, context);
        return value.map((v) => v / length);
    }
    _callPow(node, context) {
        const x = this._evalExpression(node.args[0], context);
        const y = this._evalExpression(node.args[1], context);
        return Math.pow(x, y);
    }
    _callQuantizeToF16(node, context) {
        console.error("TODO: quantizeToF16");
        return null;
    }
    _callRadians(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return value * Math.PI / 180;
    }
    _callReflect(node, context) {
        console.error("TODO: reflect");
        return null;
    }
    _callRefract(node, context) {
        console.error("TODO: refract");
        return null;
    }
    _callReverseBits(node, context) {
        console.error("TODO: reverseBits");
        return null;
    }
    _callRound(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return Math.round(value);
    }
    _callSaturate(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return Math.min(Math.max(value, 0), 1);
    }
    _callSign(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return Math.sign(value);
    }
    _callSin(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return Math.sin(value);
    }
    _callSinh(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return Math.sinh(value);
    }
    _callSmoothStep(node, context) {
        const edge0 = this._evalExpression(node.args[0], context);
        const edge1 = this._evalExpression(node.args[1], context);
        const x = this._evalExpression(node.args[2], context);
        const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
        return t * t * (3 - 2 * t);
    }
    _callSqrt(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return Math.sqrt(value);
    }
    _callStep(node, context) {
        const edge = this._evalExpression(node.args[0], context);
        const x = this._evalExpression(node.args[1], context);
        return x < edge ? 0 : 1;
    }
    _callTan(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return Math.tan(value);
    }
    _callTanh(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return Math.tanh(value);
    }
    _callTranspose(node, context) {
        console.error("TODO: transpose");
        return null;
    }
    _callTrunc(node, context) {
        const value = this._evalExpression(node.args[0], context);
        return Math.trunc(value);
    }
    // Derivative Built-in Functions
    _callDpdx(node, context) {
        console.error("TODO: dpdx");
        return null;
    }
    _callDpdxCoarse(node, context) {
        console.error("TODO: dpdxCoarse");
        return null;
    }
    _callDpdxFine(node, context) {
        console.error("TODO: dpdxFine");
        return null;
    }
    _callDpdy(node, context) {
        console.error("TODO: dpdy");
        return null;
    }
    _callDpdyCoarse(node, context) {
        console.error("TODO: dpdyCoarse");
        return null;
    }
    _callDpdyFine(node, context) {
        console.error("TODO: dpdyFine");
        return null;
    }
    _callFwidth(node, context) {
        console.error("TODO: fwidth");
        return null;
    }
    _callFwidthCoarse(node, context) {
        console.error("TODO: fwidthCoarse");
        return null;
    }
    _callFwidthFine(node, context) {
        console.error("TODO: fwidthFine");
        return null;
    }
    // Texture Built-in Functions
    _callTextureDimensions(node, context) {
        const textureArg = node.args[0];
        node.args.length > 1 ? this._evalExpression(node.args[1], context) : 0;
        if (textureArg instanceof VariableExpr) {
            const textureName = textureArg.name;
            const texture = context.getVariableValue(textureName);
            if (texture instanceof Data) {
                return texture.textureSize;
            }
            else {
                console.error(`Texture ${textureName} not found. Line ${node.line}`);
                return null;
            }
        }
        console.error(`Invalid texture argument for textureDimensions. Line ${node.line}`);
        return null;
    }
    _callTextureGather(node, context) {
        console.error("TODO: textureGather");
        return null;
    }
    _callTextureGatherCompare(node, context) {
        console.error("TODO: textureGatherCompare");
        return null;
    }
    _callTextureLoad(node, context) {
        const textureArg = node.args[0];
        const uv = this._evalExpression(node.args[1], context);
        node.args.length > 2 ? this._evalExpression(node.args[2], context) : 0;
        if (textureArg instanceof VariableExpr) {
            const textureName = textureArg.name;
            const texture = context.getVariableValue(textureName);
            if (texture instanceof Data) {
                const textureSize = texture.textureSize;
                const x = Math.floor(uv[0]);
                const y = Math.floor(uv[1]);
                // TODO non RGBA8 textures
                const offset = (y * textureSize[0] + x) * 4;
                const texel = new Uint8Array(texture.buffer, offset, 4);
                // TODO: non-f32 textures
                return [texel[0] / 255, texel[1] / 255, texel[2] / 255, texel[3] / 255];
            }
            else {
                console.error(`Texture ${textureName} not found. Line ${node.line}`);
                return null;
            }
        }
        return null;
    }
    _callTextureNumLayers(node, context) {
        console.error("TODO: textureNumLayers");
        return null;
    }
    _callTextureNumLevels(node, context) {
        console.error("TODO: textureNumLevels");
        return null;
    }
    _callTextureNumSamples(node, context) {
        console.error("TODO: textureNumSamples");
        return null;
    }
    _callTextureSample(node, context) {
        console.error("TODO: textureSample");
        return null;
    }
    _callTextureSampleBias(node, context) {
        console.error("TODO: textureSampleBias");
        return null;
    }
    _callTextureSampleCompare(node, context) {
        console.error("TODO: textureSampleCompare");
        return null;
    }
    _callTextureSampleCompareLevel(node, context) {
        console.error("TODO: textureSampleCompareLevel");
        return null;
    }
    _callTextureSampleGrad(node, context) {
        console.error("TODO: textureSampleGrad");
        return null;
    }
    _callTextureSampleLevel(node, context) {
        console.error("TODO: textureSampleLevel");
        return null;
    }
    _callTextureSampleBaseClampToEdge(node, context) {
        console.error("TODO: textureSampleBaseClampToEdge");
        return null;
    }
    _callTextureStore(node, context) {
        console.error("TODO: textureStore");
        return null;
    }
    // Atomic Built-in Functions
    _callAtomicLoad(node, context) {
        console.error("TODO: atomicLoad");
        return null;
    }
    _callAtomicStore(node, context) {
        console.error("TODO: atomicStore");
        return null;
    }
    _callAtomicAdd(node, context) {
        console.error("TODO: atomicAdd");
        return null;
    }
    _callAtomicSub(node, context) {
        console.error("TODO: atomicSub");
        return null;
    }
    _callAtomicMax(node, context) {
        console.error("TODO: atomicMax");
        return null;
    }
    _callAtomicMin(node, context) {
        console.error("TODO: atomicMin");
        return null;
    }
    _callAtomicAnd(node, context) {
        console.error("TODO: atomicAnd");
        return null;
    }
    _callAtomicOr(node, context) {
        console.error("TODO: atomicOr");
        return null;
    }
    _callAtomicXor(node, context) {
        console.error("TODO: atomicXor");
        return null;
    }
    _callAtomicExchange(node, context) {
        console.error("TODO: atomicExchange");
        return null;
    }
    _callAtomicCompareExchangeWeak(node, context) {
        console.error("TODO: atomicCompareExchangeWeak");
        return null;
    }
    // Data Packing Built-in Functions
    _callPack4x8snorm(node, context) {
        console.error("TODO: pack4x8snorm");
        return null;
    }
    _callPack4x8unorm(node, context) {
        console.error("TODO: pack4x8unorm");
        return null;
    }
    _callPack4xI8(node, context) {
        console.error("TODO: pack4xI8");
        return null;
    }
    _callPack4xU8(node, context) {
        console.error("TODO: pack4xU8");
        return null;
    }
    _callPack4x8Clamp(node, context) {
        console.error("TODO: pack4x8Clamp");
        return null;
    }
    _callPack4xU8Clamp(node, context) {
        console.error("TODO: pack4xU8Clamp");
        return null;
    }
    _callPack2x16snorm(node, context) {
        console.error("TODO: pack2x16snorm");
        return null;
    }
    _callPack2x16unorm(node, context) {
        console.error("TODO: pack2x16unorm");
        return null;
    }
    _callPack2x16float(node, context) {
        console.error("TODO: pack2x16float");
        return null;
    }
    // Data Unpacking Built-in Functions
    _callUnpack4x8snorm(node, context) {
        console.error("TODO: unpack4x8snorm");
        return null;
    }
    _callUnpack4x8unorm(node, context) {
        console.error("TODO: unpack4x8unorm");
        return null;
    }
    _callUnpack4xI8(node, context) {
        console.error("TODO: unpack4xI8");
        return null;
    }
    _callUnpack4xU8(node, context) {
        console.error("TODO: unpack4xU8");
        return null;
    }
    _callUnpack2x16snorm(node, context) {
        console.error("TODO: unpack2x16snorm");
        return null;
    }
    _callUnpack2x16unorm(node, context) {
        console.error("TODO: unpack2x16unorm");
        return null;
    }
    _callUnpack2x16float(node, context) {
        console.error("TODO: unpack2x16float");
        return null;
    }
    // Synchronization Functions
    _callStorageBarrier(node, context) {
        // Execution is single threaded, barriers not necessary.
        return null;
    }
    _callTextureBarrier(node, context) {
        // Execution is single threaded, barriers not necessary.
        return null;
    }
    _callWorkgroupBarrier(node, context) {
        // Execution is single threaded, barriers not necessary.
        return null;
    }
    _callWorkgroupUniformLoad(node, context) {
        // Execution is single threaded, barriers not necessary.
        return null;
    }
    // Subgroup Functions
    _callSubgroupAdd(node, context) {
        console.error("TODO: subgroupAdd");
        return null;
    }
    _callSubgroupExclusiveAdd(node, context) {
        console.error("TODO: subgroupExclusiveAdd");
        return null;
    }
    _callSubgroupInclusiveAdd(node, context) {
        console.error("TODO: subgroupInclusiveAdd");
        return null;
    }
    _callSubgroupAll(node, context) {
        console.error("TODO: subgroupAll");
        return null;
    }
    _callSubgroupAnd(node, context) {
        console.error("TODO: subgroupAnd");
        return null;
    }
    _callSubgroupAny(node, context) {
        console.error("TODO: subgroupAny");
        return null;
    }
    _callSubgroupBallot(node, context) {
        console.error("TODO: subgroupBallot");
        return null;
    }
    _callSubgroupBroadcast(node, context) {
        console.error("TODO: subgroupBroadcast");
        return null;
    }
    _callSubgroupBroadcastFirst(node, context) {
        console.error("TODO: subgroupBroadcastFirst");
        return null;
    }
    _callSubgroupElect(node, context) {
        console.error("TODO: subgroupElect");
        return null;
    }
    _callSubgroupMax(node, context) {
        console.error("TODO: subgroupMax");
        return null;
    }
    _callSubgroupMin(node, context) {
        console.error("TODO: subgroupMin");
        return null;
    }
    _callSubgroupMul(node, context) {
        console.error("TODO: subgroupMul");
        return null;
    }
    _callSubgroupExclusiveMul(node, context) {
        console.error("TODO: subgroupExclusiveMul");
        return null;
    }
    _callSubgroupInclusiveMul(node, context) {
        console.error("TODO: subgroupInclusiveMul");
        return null;
    }
    _callSubgroupOr(node, context) {
        console.error("TODO: subgroupOr");
        return null;
    }
    _callSubgroupShuffle(node, context) {
        console.error("TODO: subgroupShuffle");
        return null;
    }
    _callSubgroupShuffleDown(node, context) {
        console.error("TODO: subgroupShuffleDown");
        return null;
    }
    _callSubgroupShuffleUp(node, context) {
        console.error("TODO: subgroupShuffleUp");
        return null;
    }
    _callSubgroupShuffleXor(node, context) {
        console.error("TODO: subgroupShuffleXor");
        return null;
    }
    _callSubgroupXor(node, context) {
        console.error("TODO: subgroupXor");
        return null;
    }
    // Quad Functions
    _callQuadBroadcast(node, context) {
        console.error("TODO: quadBroadcast");
        return null;
    }
    _callQuadSwapDiagonal(node, context) {
        console.error("TODO: quadSwapDiagonal");
        return null;
    }
    _callQuadSwapX(node, context) {
        console.error("TODO: quadSwapX");
        return null;
    }
    _callQuadSwapY(node, context) {
        console.error("TODO: quadSwapY");
        return null;
    }
}

export { Alias, AliasInfo, Argument, ArgumentInfo, ArrayIndex, ArrayInfo, ArrayType, Assign, AssignOperator, Attribute, BinaryOperator, BitcastExpr, Break, Call, CallExpr, Case, Const, ConstExpr, Continue, Continuing, CreateExpr, Default, Diagnostic, Discard, ElseIf, Enable, EntryFunctions, Expression, For, Function$1 as Function, FunctionInfo, GroupingExpr, If, Increment, IncrementOperator, InputInfo, Let, LiteralExpr, Loop, Member, MemberInfo, Node, Operator, OutputInfo, Override, OverrideInfo, ParseContext, PointerType, Requires, ResourceType, Return, SamplerType, Statement, StaticAssert, StringExpr, Struct, StructInfo, Switch, SwitchCase, TemplateInfo, TemplateType, Token, TokenClass, TokenType, TokenTypes, Type, TypeInfo, TypecastExpr, UnaryOperator, Var$1 as Var, VariableExpr, VariableInfo, WgslExec, WgslParser, WgslReflect, WgslScanner, While, _BlockEnd, _BlockStart };
//# sourceMappingURL=wgsl_reflect.module.js.map
