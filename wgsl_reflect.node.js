'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

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
    constEvaluate(context, type) {
        throw new Error("Cannot evaluate node");
    }
    constEvaluateString(context) {
        return this.constEvaluate(context).toString();
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
    constEvaluate(context, type) {
        return this.value.constEvaluate(context, type);
    }
    search(callback) {
        var _a;
        callback(this);
        (_a = this.value) === null || _a === void 0 ? void 0 : _a.search(callback);
    }
}
exports.IncrementOperator = void 0;
(function (IncrementOperator) {
    IncrementOperator["increment"] = "++";
    IncrementOperator["decrement"] = "--";
})(exports.IncrementOperator || (exports.IncrementOperator = {}));
(function (IncrementOperator) {
    function parse(val) {
        const key = val;
        if (key == "parse")
            throw new Error("Invalid value for IncrementOperator");
        return IncrementOperator[key];
    }
    IncrementOperator.parse = parse;
})(exports.IncrementOperator || (exports.IncrementOperator = {}));
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
exports.AssignOperator = void 0;
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
})(exports.AssignOperator || (exports.AssignOperator = {}));
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
})(exports.AssignOperator || (exports.AssignOperator = {}));
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
    static maxFormatType(x) {
        let t = x[0];
        if (t.name === "f32") {
            return t;
        }
        for (let i = 1; i < x.length; ++i) {
            const tv = Type._priority.get(t.name);
            const xv = Type._priority.get(x[i].name);
            if (xv < tv) {
                t = x[i];
            }
        }
        if (t.name === "x32") {
            return Type.i32;
        }
        return t;
    }
}
Type.x32 = new Type("x32");
Type.f32 = new Type("f32");
Type.i32 = new Type("i32");
Type.u32 = new Type("u32");
Type.f16 = new Type("f16");
Type.bool = new Type("bool");
Type._priority = new Map([["f32", 0], ["f16", 1], ["u32", 2], ["i32", 3], ["x32", 3]]);
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
    constEvaluateString() {
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
    constEvaluate(context, type) {
        const t = this.type;
        if (t.name === "f32" || t.name === "f16" || t.name === "i32" || t.name === "u32") {
            return this.args[0].constEvaluate(context, type);
        }
        if (t.name === "vec2" || t.name === "vec2f" || t.name === "vec2h" || t.name === "vec2i" || t.name === "vec2u") {
            const tx = [Type.f32];
            const ty = [Type.f32];
            const v = [this.args[0].constEvaluate(context, tx),
                this.args[1].constEvaluate(context, ty)];
            if (type) {
                type[0] = t;
                if (t instanceof TemplateType && t.format === null) {
                    t.format = Type.maxFormatType([tx[0], ty[0]]);
                }
            }
            return v;
        }
        if (t.name === "vec3" || t.name === "vec3f" || t.name === "vec3h" || t.name === "vec3i" || t.name === "vec3u") {
            const tx = [Type.f32];
            const ty = [Type.f32];
            const tz = [Type.f32];
            const v = [this.args[0].constEvaluate(context, tx),
                this.args[1].constEvaluate(context, ty),
                this.args[2].constEvaluate(context, tz)];
            if (type) {
                type[0] = t;
                if (t instanceof TemplateType && t.format === null) {
                    t.format = Type.maxFormatType([tx[0], ty[0], tz[0]]);
                }
            }
            return v;
        }
        if (t.name === "vec4" || t.name === "vec4f" || t.name === "vec4h" || t.name === "vec4i" || t.name === "vec4u") {
            const tx = [Type.f32];
            const ty = [Type.f32];
            const tz = [Type.f32];
            const tw = [Type.f32];
            const v = [this.args[0].constEvaluate(context, tx),
                this.args[1].constEvaluate(context, ty),
                this.args[2].constEvaluate(context, tz),
                this.args[3].constEvaluate(context, tw)];
            if (type) {
                type[0] = t;
                if (t instanceof TemplateType && t.format === null) {
                    t.format = Type.maxFormatType([tx[0], ty[0], tz[0], tw[0]]);
                }
            }
            return v;
        }
        if (t.name === "mat2x2") {
            if (this.args.length === 1) {
                // mat2x2(other: mat2x2)
                const e1 = [Type.f32];
                const v = this.args[0].constEvaluate(context, e1);
                if (e1[0].name !== "mat2x2" && e1[0].name !== "mat2x2f" && e1[0].name != "mat2x2h") {
                    throw "Invalid argument for mat2x2";
                }
                if (type) {
                    type[0] = e1[0];
                }
                return v;
            }
            else if (this.args.length === 2) {
                // mat2x2(v1: vec2, v2: vec2)
                const e1 = [Type.f32];
                const e2 = [Type.f32];
                const v1 = this.args[0].constEvaluate(context, e1);
                const v2 = this.args[1].constEvaluate(context, e2);
                if ((e1[0].name !== "vec2" && e1[0].name !== "vec2f" && e1[0].name !== "vec2h") ||
                    (e2[0].name !== "vec2" && e2[0].name !== "vec2f" && e2[0].name !== "vec2h")) {
                    throw "Invalid arguments for mat2x2";
                }
                const v1a = v1;
                const v2a = v2;
                const v = [v1a[0], v1a[1], v2a[0], v2a[1]];
                if (type) {
                    type[0] = t;
                    if (t instanceof TemplateType && t.format === null) {
                        if (e1[0].name === "vec2f") {
                            t.format = Type.f32;
                        }
                        else if (e1[0].name === "vec2h") {
                            t.format = Type.f16;
                        }
                        else if (e1[0] instanceof TemplateType) {
                            t.format = e1[0].format;
                        }
                    }
                }
                return v;
            }
            else if (this.args.length === 4) {
                // mat2x2(e1, e2, e3, e4)
                const e1 = [Type.f32];
                const e2 = [Type.f32];
                const e3 = [Type.f32];
                const e4 = [Type.f32];
                const v = [this.args[0].constEvaluate(context, e1),
                    this.args[1].constEvaluate(context, e2),
                    this.args[2].constEvaluate(context, e3),
                    this.args[3].constEvaluate(context, e4)];
                if (type) {
                    type[0] = t;
                    if (t instanceof TemplateType && t.format === null) {
                        t.format = Type.maxFormatType([e1[0], e2[0], e3[0], e4[0]]);
                    }
                }
                return v;
            }
            else {
                throw "Invalid arguments for mat2x2";
            }
        }
        if (t.name === "mat2x3") {
            if (this.args.length === 1) {
                // mat2x3(other: mat2x3)
                const e1 = [Type.f32];
                const v = this.args[0].constEvaluate(context, e1);
                if (e1[0].name !== "mat232" && e1[0].name !== "mat2x3f" && e1[0].name != "mat2x3h") {
                    throw "Invalid argument for mat2x3";
                }
                if (type) {
                    type[0] = e1[0];
                }
                return v;
            }
            else if (this.args.length === 2) {
                // mat2x3(v1: vec3, v2: vec3)
                const e1 = [Type.f32];
                const e2 = [Type.f32];
                const v1 = this.args[0].constEvaluate(context, e1);
                const v2 = this.args[1].constEvaluate(context, e2);
                if ((e1[0].name !== "vec3" && e1[0].name !== "vec3f" && e1[0].name !== "vec3h") ||
                    (e2[0].name !== "vec3" && e2[0].name !== "vec3f" && e2[0].name !== "vec3h")) {
                    throw "Invalid arguments for mat2x3";
                }
                const v1a = v1;
                const v2a = v2;
                const v = [v1a[0], v1a[1], v1a[2], v2a[0], v2a[1], v2a[2]];
                if (type) {
                    type[0] = t;
                    if (t instanceof TemplateType && t.format === null) {
                        if (e1[0].name === "vec3f") {
                            t.format = Type.f32;
                        }
                        else if (e1[0].name === "vec3h") {
                            t.format = Type.f16;
                        }
                        else if (e1[0] instanceof TemplateType) {
                            t.format = e1[0].format;
                        }
                    }
                }
                return v;
            }
            else if (this.args.length === 6) {
                // mat2x3(e1, e2, e3, e4, e5, e6)
                const e1 = [Type.f32];
                const e2 = [Type.f32];
                const e3 = [Type.f32];
                const e4 = [Type.f32];
                const e5 = [Type.f32];
                const e6 = [Type.f32];
                const v = [this.args[0].constEvaluate(context, e1),
                    this.args[1].constEvaluate(context, e2),
                    this.args[2].constEvaluate(context, e3),
                    this.args[3].constEvaluate(context, e4),
                    this.args[4].constEvaluate(context, e5),
                    this.args[5].constEvaluate(context, e6)];
                if (type) {
                    type[0] = t;
                    if (t instanceof TemplateType && t.format === null) {
                        t.format = Type.maxFormatType([e1[0], e2[0], e3[0], e4[0], e5[0], e6[0]]);
                    }
                }
                return v;
            }
            else {
                throw "Invalid arguments for mat2x3";
            }
        }
        if (t.name === "mat2x4") {
            if (this.args.length === 1) {
                // mat2x4(other: mat2x4)
                const e1 = [Type.f32];
                const v = this.args[0].constEvaluate(context, e1);
                if (e1[0].name !== "mat2x4" && e1[0].name !== "mat2x4f" && e1[0].name != "mat2x4h") {
                    throw "Invalid argument for mat2x4";
                }
                if (type) {
                    type[0] = e1[0];
                }
                return v;
            }
            else if (this.args.length === 2) {
                // mat2x4(v1: vec4, v2: vec4)
                const e1 = [Type.f32];
                const e2 = [Type.f32];
                const v1 = this.args[0].constEvaluate(context, e1);
                const v2 = this.args[1].constEvaluate(context, e2);
                if ((e1[0].name !== "vec4" && e1[0].name !== "vec4f" && e1[0].name !== "vec4h") ||
                    (e2[0].name !== "vec4" && e2[0].name !== "vec4f" && e2[0].name !== "vec4h")) {
                    throw "Invalid arguments for mat2x4";
                }
                const v1a = v1;
                const v2a = v2;
                const v = [v1a[0], v1a[1], v1a[2], v1a[3], v2a[0], v2a[1], v2a[2], v2a[3]];
                if (type) {
                    type[0] = t;
                    if (t instanceof TemplateType && t.format === null) {
                        if (e1[0].name === "vec4f") {
                            t.format = Type.f32;
                        }
                        else if (e1[0].name === "vec4h") {
                            t.format = Type.f16;
                        }
                        else if (e1[0] instanceof TemplateType) {
                            t.format = e1[0].format;
                        }
                    }
                }
                return v;
            }
            else if (this.args.length === 8) {
                // mat2x4(e1, e2, e3, e4, e5, e6, e7, e8)
                const e1 = [Type.f32];
                const e2 = [Type.f32];
                const e3 = [Type.f32];
                const e4 = [Type.f32];
                const e5 = [Type.f32];
                const e6 = [Type.f32];
                const e7 = [Type.f32];
                const e8 = [Type.f32];
                const v = [this.args[0].constEvaluate(context, e1),
                    this.args[1].constEvaluate(context, e2),
                    this.args[2].constEvaluate(context, e3),
                    this.args[3].constEvaluate(context, e4),
                    this.args[4].constEvaluate(context, e5),
                    this.args[5].constEvaluate(context, e6),
                    this.args[6].constEvaluate(context, e7),
                    this.args[7].constEvaluate(context, e8)];
                if (type) {
                    type[0] = t;
                    if (t instanceof TemplateType && t.format === null) {
                        t.format = Type.maxFormatType([e1[0], e2[0], e3[0], e4[0], e5[0], e6[0], e7[0], e8[0]]);
                    }
                }
                return v;
            }
            else {
                throw "Invalid arguments for mat2x4";
            }
        }
        if (t.name === "mat3x2") {
            if (this.args.length === 1) {
                // mat3x2(other: mat3x2)
                const e1 = [Type.f32];
                const v = this.args[0].constEvaluate(context, e1);
                if (e1[0].name !== "mat3x2" && e1[0].name !== "mat3x2f" && e1[0].name != "mat3x2h") {
                    throw "Invalid argument for mat3x2";
                }
                if (type) {
                    type[0] = e1[0];
                }
                return v;
            }
            else if (this.args.length === 3) {
                // mat3x2(v1: vec2, v2: vec2, v3: vec2)
                const e1 = [Type.f32];
                const e2 = [Type.f32];
                const e3 = [Type.f32];
                const v1 = this.args[0].constEvaluate(context, e1);
                const v2 = this.args[1].constEvaluate(context, e2);
                const v3 = this.args[1].constEvaluate(context, e3);
                if ((e1[0].name !== "vec2" && e1[0].name !== "vec2f" && e1[0].name !== "vec2h") ||
                    (e2[0].name !== "vec2" && e2[0].name !== "vec2f" && e2[0].name !== "vec2h") ||
                    (e3[0].name !== "vec2" && e3[0].name !== "vec2f" && e3[0].name !== "vec2h")) {
                    throw "Invalid arguments for mat3x2";
                }
                const v1a = v1;
                const v2a = v2;
                const v3a = v3;
                const v = [v1a[0], v1a[1], v2a[0], v2a[1], v3a[0], v3a[1]];
                if (type) {
                    type[0] = t;
                    if (t instanceof TemplateType && t.format === null) {
                        if (e1[0].name === "vec2f") {
                            t.format = Type.f32;
                        }
                        else if (e1[0].name === "vec2h") {
                            t.format = Type.f16;
                        }
                        else if (e1[0] instanceof TemplateType) {
                            t.format = e1[0].format;
                        }
                    }
                }
                return v;
            }
            else if (this.args.length === 6) {
                // mat3x2(e1, e2, e3, e4, e5, e6)
                const e1 = [Type.f32];
                const e2 = [Type.f32];
                const e3 = [Type.f32];
                const e4 = [Type.f32];
                const e5 = [Type.f32];
                const e6 = [Type.f32];
                const v = [this.args[0].constEvaluate(context, e1),
                    this.args[1].constEvaluate(context, e2),
                    this.args[2].constEvaluate(context, e3),
                    this.args[3].constEvaluate(context, e4),
                    this.args[4].constEvaluate(context, e5),
                    this.args[5].constEvaluate(context, e6)];
                if (type) {
                    type[0] = t;
                    if (t instanceof TemplateType && t.format === null) {
                        t.format = Type.maxFormatType([e1[0], e2[0], e3[0], e4[0], e5[0], e6[0]]);
                    }
                }
                return v;
            }
            else {
                throw "Invalid arguments for mat3x2";
            }
        }
        if (t.name === "mat3x3") {
            if (this.args.length === 1) {
                // mat3x3(other: mat3x3)
                const e1 = [Type.f32];
                const v = this.args[0].constEvaluate(context, e1);
                if (e1[0].name !== "mat3x3" && e1[0].name !== "mat3x3f" && e1[0].name != "mat3x3h") {
                    throw "Invalid argument for mat3x3";
                }
                if (type) {
                    type[0] = e1[0];
                }
                return v;
            }
            else if (this.args.length === 3) {
                // mat3x3(v1: vec3, v2: vec3, v3: vec3)
                const e1 = [Type.f32];
                const e2 = [Type.f32];
                const e3 = [Type.f32];
                const v1 = this.args[0].constEvaluate(context, e1);
                const v2 = this.args[1].constEvaluate(context, e2);
                const v3 = this.args[1].constEvaluate(context, e3);
                if ((e1[0].name !== "vec3" && e1[0].name !== "vec3f" && e1[0].name !== "vec3h") ||
                    (e2[0].name !== "vec3" && e2[0].name !== "vec3f" && e2[0].name !== "vec3h") ||
                    (e3[0].name !== "vec3" && e3[0].name !== "vec3f" && e3[0].name !== "vec3h")) {
                    throw "Invalid arguments for mat3x3";
                }
                const v1a = v1;
                const v2a = v2;
                const v3a = v3;
                const v = [v1a[0], v1a[1], v1a[2], v2a[0], v2a[1], v2a[2], v3a[0], v3a[1], v3a[2]];
                if (type) {
                    type[0] = t;
                    if (t instanceof TemplateType && t.format === null) {
                        if (e1[0].name === "vec3f") {
                            t.format = Type.f32;
                        }
                        else if (e1[0].name === "vec3h") {
                            t.format = Type.f16;
                        }
                        else if (e1[0] instanceof TemplateType) {
                            t.format = e1[0].format;
                        }
                    }
                }
                return v;
            }
            else if (this.args.length === 9) {
                // mat2x4(e1, e2, e3, e4, e5, e6, e7, e8, e9)
                const e1 = [Type.f32];
                const e2 = [Type.f32];
                const e3 = [Type.f32];
                const e4 = [Type.f32];
                const e5 = [Type.f32];
                const e6 = [Type.f32];
                const e7 = [Type.f32];
                const e8 = [Type.f32];
                const e9 = [Type.f32];
                const v = [this.args[0].constEvaluate(context, e1),
                    this.args[1].constEvaluate(context, e2),
                    this.args[2].constEvaluate(context, e3),
                    this.args[3].constEvaluate(context, e4),
                    this.args[4].constEvaluate(context, e5),
                    this.args[5].constEvaluate(context, e6),
                    this.args[6].constEvaluate(context, e7),
                    this.args[7].constEvaluate(context, e8),
                    this.args[8].constEvaluate(context, e9)];
                if (type) {
                    type[0] = t;
                    if (t instanceof TemplateType && t.format === null) {
                        t.format = Type.maxFormatType([e1[0], e2[0], e3[0], e4[0], e5[0], e6[0], e7[0], e8[0], e9[0]]);
                    }
                }
                return v;
            }
            else {
                throw "Invalid arguments for mat3x3";
            }
        }
        if (t.name === "mat3x4") {
            if (this.args.length === 1) {
                // mat3x4(other: mat3x4)
                const e1 = [Type.f32];
                const v = this.args[0].constEvaluate(context, e1);
                if (e1[0].name !== "mat3x4" && e1[0].name !== "mat3x4f" && e1[0].name != "mat3x4h") {
                    throw "Invalid argument for mat3x4";
                }
                if (type) {
                    type[0] = e1[0];
                }
                return v;
            }
            else if (this.args.length === 3) {
                // mat3x4(v1: vec4, v2: vec4, v3: vec4)
                const e1 = [Type.f32];
                const e2 = [Type.f32];
                const e3 = [Type.f32];
                const v1 = this.args[0].constEvaluate(context, e1);
                const v2 = this.args[1].constEvaluate(context, e2);
                const v3 = this.args[1].constEvaluate(context, e3);
                if ((e1[0].name !== "vec4" && e1[0].name !== "vec4f" && e1[0].name !== "vec4h") ||
                    (e2[0].name !== "vec4" && e2[0].name !== "vec4f" && e2[0].name !== "vec4h") ||
                    (e3[0].name !== "vec4" && e3[0].name !== "vec4f" && e3[0].name !== "vec4h")) {
                    throw "Invalid arguments for mat3x4";
                }
                const v1a = v1;
                const v2a = v2;
                const v3a = v3;
                const v = [v1a[0], v1a[1], v1a[2], v1a[3], v2a[0], v2a[1], v2a[2], v2a[3], v3a[0], v3a[1], v3a[2], v3a[3]];
                if (type) {
                    type[0] = t;
                    if (t instanceof TemplateType && t.format === null) {
                        if (e1[0].name === "vec4f") {
                            t.format = Type.f32;
                        }
                        else if (e1[0].name === "vec4h") {
                            t.format = Type.f16;
                        }
                        else if (e1[0] instanceof TemplateType) {
                            t.format = e1[0].format;
                        }
                    }
                }
                return v;
            }
            else if (this.args.length === 9) {
                // mat3x4(e1, e2, e3, e4, e5, e6, e7, e8, e9, e10, e11, e12)
                const e1 = [Type.f32];
                const e2 = [Type.f32];
                const e3 = [Type.f32];
                const e4 = [Type.f32];
                const e5 = [Type.f32];
                const e6 = [Type.f32];
                const e7 = [Type.f32];
                const e8 = [Type.f32];
                const e9 = [Type.f32];
                const e10 = [Type.f32];
                const e11 = [Type.f32];
                const e12 = [Type.f32];
                const v = [this.args[0].constEvaluate(context, e1),
                    this.args[1].constEvaluate(context, e2),
                    this.args[2].constEvaluate(context, e3),
                    this.args[3].constEvaluate(context, e4),
                    this.args[4].constEvaluate(context, e5),
                    this.args[5].constEvaluate(context, e6),
                    this.args[6].constEvaluate(context, e7),
                    this.args[7].constEvaluate(context, e8),
                    this.args[8].constEvaluate(context, e9),
                    this.args[9].constEvaluate(context, e10),
                    this.args[10].constEvaluate(context, e11),
                    this.args[11].constEvaluate(context, e12)];
                if (type) {
                    type[0] = t;
                    if (t instanceof TemplateType && t.format === null) {
                        t.format = Type.maxFormatType([e1[0], e2[0], e3[0], e4[0], e5[0], e6[0], e7[0],
                            e8[0], e9[0], e10[0], e11[0]]);
                    }
                }
                return v;
            }
            else {
                throw "Invalid arguments for mat3x4";
            }
        }
        if (t.name === "mat4x2") {
            if (this.args.length === 1) {
                // mat4x2(other: mat4x2)
                const e1 = [Type.f32];
                const v = this.args[0].constEvaluate(context, e1);
                if (e1[0].name !== "mat4x2" && e1[0].name !== "mat4x2f" && e1[0].name != "mat4x2h") {
                    throw "Invalid argument for mat4x2";
                }
                if (type) {
                    type[0] = e1[0];
                }
                return v;
            }
            else if (this.args.length === 4) {
                // mat4x2(v1: vec2, v2: vec2, v3: vec2, v4: vec2)
                const e1 = [Type.f32];
                const e2 = [Type.f32];
                const e3 = [Type.f32];
                const e4 = [Type.f32];
                const v1 = this.args[0].constEvaluate(context, e1);
                const v2 = this.args[1].constEvaluate(context, e2);
                const v3 = this.args[1].constEvaluate(context, e3);
                const v4 = this.args[1].constEvaluate(context, e4);
                if ((e1[0].name !== "vec2" && e1[0].name !== "vec2f" && e1[0].name !== "vec2h") ||
                    (e2[0].name !== "vec2" && e2[0].name !== "vec2f" && e2[0].name !== "vec2h") ||
                    (e3[0].name !== "vec2" && e3[0].name !== "vec2f" && e3[0].name !== "vec2h") ||
                    (e4[0].name !== "vec2" && e4[0].name !== "vec2f" && e4[0].name !== "vec2h")) {
                    throw "Invalid arguments for mat4x2";
                }
                const v1a = v1;
                const v2a = v2;
                const v3a = v3;
                const v4a = v4;
                const v = [v1a[0], v1a[1], v2a[0], v2a[1], v3a[0], v3a[1], v4a[0], v4a[1]];
                if (type) {
                    type[0] = t;
                    if (t instanceof TemplateType && t.format === null) {
                        if (e1[0].name === "vec2f") {
                            t.format = Type.f32;
                        }
                        else if (e1[0].name === "vec2h") {
                            t.format = Type.f16;
                        }
                        else if (e1[0] instanceof TemplateType) {
                            t.format = e1[0].format;
                        }
                    }
                }
                return v;
            }
            else if (this.args.length === 8) {
                // mat4x2(e1, e2, e3, e4, e5, e6, e7, e8)
                const e1 = [Type.f32];
                const e2 = [Type.f32];
                const e3 = [Type.f32];
                const e4 = [Type.f32];
                const e5 = [Type.f32];
                const e6 = [Type.f32];
                const e7 = [Type.f32];
                const e8 = [Type.f32];
                const v = [this.args[0].constEvaluate(context, e1),
                    this.args[1].constEvaluate(context, e2),
                    this.args[2].constEvaluate(context, e3),
                    this.args[3].constEvaluate(context, e4),
                    this.args[4].constEvaluate(context, e5),
                    this.args[5].constEvaluate(context, e6),
                    this.args[6].constEvaluate(context, e7),
                    this.args[7].constEvaluate(context, e8)];
                if (type) {
                    type[0] = t;
                    if (t instanceof TemplateType && t.format === null) {
                        t.format = Type.maxFormatType([e1[0], e2[0], e3[0], e4[0], e5[0], e6[0], e7[0], e8[0]]);
                    }
                }
                return v;
            }
            else {
                throw "Invalid arguments for mat4x2";
            }
        }
        if (t.name === "mat4x3") {
            if (this.args.length === 1) {
                // mat4x3(other: mat4x3)
                const e1 = [Type.f32];
                const v = this.args[0].constEvaluate(context, e1);
                if (e1[0].name !== "mat4x3" && e1[0].name !== "mat4x3f" && e1[0].name != "mat4x3h") {
                    throw "Invalid argument for mat4x3";
                }
                if (type) {
                    type[0] = e1[0];
                }
                return v;
            }
            else if (this.args.length === 4) {
                // mat4x3(v1: vec3, v2: vec3, v3: vec3, v4: vec3)
                const e1 = [Type.f32];
                const e2 = [Type.f32];
                const e3 = [Type.f32];
                const e4 = [Type.f32];
                const v1 = this.args[0].constEvaluate(context, e1);
                const v2 = this.args[1].constEvaluate(context, e2);
                const v3 = this.args[1].constEvaluate(context, e3);
                const v4 = this.args[1].constEvaluate(context, e4);
                if ((e1[0].name !== "vec3" && e1[0].name !== "vec3f" && e1[0].name !== "vec3h") ||
                    (e2[0].name !== "vec3" && e2[0].name !== "vec3f" && e2[0].name !== "vec3h") ||
                    (e3[0].name !== "vec3" && e3[0].name !== "vec3f" && e3[0].name !== "vec3h") ||
                    (e4[0].name !== "vec3" && e4[0].name !== "vec3f" && e4[0].name !== "vec3h")) {
                    throw "Invalid arguments for mat4x3";
                }
                const v1a = v1;
                const v2a = v2;
                const v3a = v3;
                const v4a = v4;
                const v = [v1a[0], v1a[1], v1a[2], v2a[0], v2a[1], v2a[2], v3a[0], v3a[1], v3a[2], v4a[0], v4a[1], v4a[2]];
                if (type) {
                    type[0] = t;
                    if (t instanceof TemplateType && t.format === null) {
                        if (e1[0].name === "vec3f") {
                            t.format = Type.f32;
                        }
                        else if (e1[0].name === "vec3h") {
                            t.format = Type.f16;
                        }
                        else if (e1[0] instanceof TemplateType) {
                            t.format = e1[0].format;
                        }
                    }
                }
                return v;
            }
            else if (this.args.length === 9) {
                // mat4x3(e1, e2, e3, e4, e5, e6, e7, e8, e9, e10, e11, e12)
                const e1 = [Type.f32];
                const e2 = [Type.f32];
                const e3 = [Type.f32];
                const e4 = [Type.f32];
                const e5 = [Type.f32];
                const e6 = [Type.f32];
                const e7 = [Type.f32];
                const e8 = [Type.f32];
                const e9 = [Type.f32];
                const e10 = [Type.f32];
                const e11 = [Type.f32];
                const e12 = [Type.f32];
                const v = [this.args[0].constEvaluate(context, e1),
                    this.args[1].constEvaluate(context, e2),
                    this.args[2].constEvaluate(context, e3),
                    this.args[3].constEvaluate(context, e4),
                    this.args[4].constEvaluate(context, e5),
                    this.args[5].constEvaluate(context, e6),
                    this.args[6].constEvaluate(context, e7),
                    this.args[7].constEvaluate(context, e8),
                    this.args[8].constEvaluate(context, e9),
                    this.args[9].constEvaluate(context, e10),
                    this.args[10].constEvaluate(context, e11),
                    this.args[11].constEvaluate(context, e12)];
                if (type) {
                    type[0] = t;
                    if (t instanceof TemplateType && t.format === null) {
                        t.format = Type.maxFormatType([e1[0], e2[0], e3[0], e4[0], e5[0], e6[0], e7[0], e8[0],
                            e9[0], e10[0], e11[0], e12[0]]);
                    }
                }
                return v;
            }
            else {
                throw "Invalid arguments for mat4x3";
            }
        }
        if (t.name === "mat4x4") {
            if (this.args.length === 1) {
                // mat4x4(other: mat4x4)
                const e1 = [Type.f32];
                const v = this.args[0].constEvaluate(context, e1);
                if (e1[0].name !== "mat4x4" && e1[0].name !== "mat4x4f" && e1[0].name != "mat4x4h") {
                    throw "Invalid argument for mat4x4";
                }
                if (type) {
                    type[0] = e1[0];
                }
                return v;
            }
            else if (this.args.length === 4) {
                // mat4x4(v1: vec4, v2: vec4, v3: vec4, v4: vec4)
                // mat4x3(v1: vec3, v2: vec3, v3: vec3, v4: vec3)
                const e1 = [Type.f32];
                const e2 = [Type.f32];
                const e3 = [Type.f32];
                const e4 = [Type.f32];
                const v1 = this.args[0].constEvaluate(context, e1);
                const v2 = this.args[1].constEvaluate(context, e2);
                const v3 = this.args[1].constEvaluate(context, e3);
                const v4 = this.args[1].constEvaluate(context, e4);
                if ((e1[0].name !== "vec4" && e1[0].name !== "vec4f" && e1[0].name !== "vec4h") ||
                    (e2[0].name !== "vec4" && e2[0].name !== "vec4f" && e2[0].name !== "vec4h") ||
                    (e3[0].name !== "vec4" && e3[0].name !== "vec4f" && e3[0].name !== "vec4h") ||
                    (e4[0].name !== "vec4" && e4[0].name !== "vec4f" && e4[0].name !== "vec4h")) {
                    throw "Invalid arguments for mat4x4";
                }
                const v1a = v1;
                const v2a = v2;
                const v3a = v3;
                const v4a = v4;
                const v = [v1a[0], v1a[1], v1a[2], v1a[3],
                    v2a[0], v2a[1], v2a[2], v2a[3],
                    v3a[0], v3a[1], v3a[2], v3a[3],
                    v4a[0], v4a[1], v4a[2], v4a[3]];
                if (type) {
                    type[0] = t;
                    if (t instanceof TemplateType && t.format === null) {
                        if (e1[0].name === "vec4f") {
                            t.format = Type.f32;
                        }
                        else if (e1[0].name === "vec4h") {
                            t.format = Type.f16;
                        }
                        else if (e1[0] instanceof TemplateType) {
                            t.format = e1[0].format;
                        }
                    }
                }
                return v;
            }
            else if (this.args.length === 9) {
                // mat4x4(e1, e2, e3, e4, e5, e6, e7, e8, e9, e10, e11, e12, e13, e14, e15, e16)
                const e1 = [Type.f32];
                const e2 = [Type.f32];
                const e3 = [Type.f32];
                const e4 = [Type.f32];
                const e5 = [Type.f32];
                const e6 = [Type.f32];
                const e7 = [Type.f32];
                const e8 = [Type.f32];
                const e9 = [Type.f32];
                const e10 = [Type.f32];
                const e11 = [Type.f32];
                const e12 = [Type.f32];
                const e13 = [Type.f32];
                const e14 = [Type.f32];
                const e15 = [Type.f32];
                const e16 = [Type.f32];
                const v = [this.args[0].constEvaluate(context, e1),
                    this.args[1].constEvaluate(context, e2),
                    this.args[2].constEvaluate(context, e3),
                    this.args[3].constEvaluate(context, e4),
                    this.args[4].constEvaluate(context, e5),
                    this.args[5].constEvaluate(context, e6),
                    this.args[6].constEvaluate(context, e7),
                    this.args[7].constEvaluate(context, e8),
                    this.args[8].constEvaluate(context, e9),
                    this.args[9].constEvaluate(context, e10),
                    this.args[10].constEvaluate(context, e11),
                    this.args[11].constEvaluate(context, e12),
                    this.args[12].constEvaluate(context, e13),
                    this.args[13].constEvaluate(context, e14),
                    this.args[14].constEvaluate(context, e15),
                    this.args[15].constEvaluate(context, e16)];
                if (type) {
                    type[0] = t;
                    if (t instanceof TemplateType && t.format === null) {
                        t.format = Type.maxFormatType([e1[0], e2[0], e3[0], e4[0], e5[0], e6[0], e7[0], e8[0],
                            e9[0], e10[0], e11[0], e12[0], e13[0], e14[0], e15[0]]);
                    }
                }
                return v;
            }
            else {
                throw "Invalid arguments for mat4x4";
            }
        }
        if (t.name === "array") {
            const v = [];
            const ta = t;
            for (const arg of this.args) {
                const te = [Type.f32];
                const e = arg.constEvaluate(context, te);
                v.push(e);
                if (ta.format === null) {
                    ta.format = te[0];
                }
                else {
                    ta.format = Type.maxFormatType([ta.format, te[0]]);
                }
            }
            if (type) {
                type[0] = ta;
            }
            return v;
        }
        throw new Error(`Cannot evaluate node ${this.constructor.name}`);
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
        this.cachedReturnValue = null;
        this.name = name;
        this.args = args;
    }
    get astNodeType() {
        return "callExpr";
    }
    setCachedReturnValue(value) {
        this.cachedReturnValue = value;
    }
    get isBuiltin() {
        return CallExpr.builtinFunctionNames.has(this.name);
    }
    constEvaluate(context, type) {
        switch (this.name) {
            case "abs": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => Math.abs(v));
                }
                return Math.abs(value);
            }
            case "acos": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => Math.acos(v));
                }
                return Math.acos(value);
            }
            case "acosh": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => Math.acosh(v));
                }
                return Math.acosh(value);
            }
            case "asin": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => Math.asin(v));
                }
                return Math.asin(value);
            }
            case "asinh": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => Math.asinh(v));
                }
                return Math.asinh(value);
            }
            case "atan": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => Math.atan(v));
                }
                return Math.atan(value);
            }
            case "atan2":
                const value = this.args[0].constEvaluate(context, type);
                const value2 = this.args[1].constEvaluate(context, type);
                if (Array.isArray(value) && Array.isArray(value2)) {
                    return value.map((v, i) => Math.atan2(v, value2[i]));
                }
                return Math.atan2(value, value2);
            case "atanh": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => Math.atanh(v));
                }
                return Math.atanh(value);
            }
            case "ceil": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => Math.ceil(v));
                }
                return Math.ceil(value);
            }
            case "clamp": {
                const value = this.args[0].constEvaluate(context, type);
                const a = this.args[1].constEvaluate(context, type);
                const b = this.args[2].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => Math.min(Math.max(v, a), b));
                }
                return Math.min(Math.max(value, a), b);
            }
            case "cos": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => Math.cos(v));
                }
                return Math.cos(value);
            }
            case "cross": {
                const x = this.args[0].constEvaluate(context, type);
                const y = this.args[1].constEvaluate(context, type);
                if (Array.isArray(x) && Array.isArray(y) && x.length === y.length && x.length === 3) {
                    [
                        x[1] * y[2] - x[2] * y[1],
                        x[2] * y[0] - x[0] * y[2],
                        x[0] * y[1] - x[1] * y[0]
                    ];
                }
                throw new Error("Cross product is only supported for vec3");
            }
            case "degrees": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => v * 180 / Math.PI);
                }
                return value * 180 / Math.PI;
            }
            case "determinant":
                throw new Error("TODO Determinant is not implemented");
            case "distance": {
                const a = this.args[0].constEvaluate(context, type);
                const b = this.args[1].constEvaluate(context, type);
                if (Array.isArray(a) && Array.isArray(b)) {
                    let d2 = 0;
                    for (let i = 0; i < a.length; i++) {
                        d2 += (a[i] - b[i]) * (a[i] - b[i]);
                    }
                    return Math.sqrt(d2);
                }
                const an = a;
                const bn = b;
                return Math.sqrt((bn - an) * (bn - an));
            }
            case "dot": {
                const a = this.args[0].constEvaluate(context, type);
                const b = this.args[1].constEvaluate(context, type);
                if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
                    let d = 0;
                    for (let i = 0; i < a.length; i++) {
                        d += a[i] * b[i];
                    }
                    return d;
                }
                return a * b;
            }
            case "exp": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => Math.exp(v));
                }
                return Math.exp(value);
            }
            case "exp2": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => Math.pow(2, v));
                }
                return Math.pow(2, value);
            }
            //case "extractBits":
            //TODO: implement
            //case "firstLeadingBit":
            //TODO: implement
            case "floor": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => Math.floor(v));
                }
                return Math.floor(value);
            }
            case "fma": {
                const a = this.args[0].constEvaluate(context, type);
                const b = this.args[1].constEvaluate(context, type);
                const c = this.args[2].constEvaluate(context, type);
                if (Array.isArray(a) && Array.isArray(b) && Array.isArray(c)) {
                    return a.map((v, i) => v * b[i] + c[i]);
                }
                return a * b + c;
            }
            case "fract": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => v - Math.floor(v));
                }
                return value - Math.floor(value);
            }
            //case "frexp":
            //TODO: implement
            case "inverseSqrt": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => 1 / Math.sqrt(v));
                }
                return 1 / Math.sqrt(value);
            }
            case "length": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    let d2 = 0;
                    for (let i = 0; i < value.length; i++) {
                        d2 += value[i] * value[i];
                    }
                    return Math.sqrt(d2);
                }
                return Math.abs(value);
            }
            case "log": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => Math.log(v));
                }
                return Math.log(value);
            }
            case "log2": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => Math.log2(v));
                }
                return Math.log2(value);
            }
            case "max": {
                const a = this.args[0].constEvaluate(context, type);
                const b = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value) && Array.isArray(b)) {
                    return value.map((v, i) => Math.max(v, b[i]));
                }
                return Math.max(a, b);
            }
            case "min": {
                const a = this.args[0].constEvaluate(context, type);
                const b = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value) && Array.isArray(b)) {
                    return value.map((v, i) => Math.min(v, b[i]));
                }
                return Math.min(a, b);
            }
            case "mix": {
                const a = this.args[0].constEvaluate(context, type);
                const b = this.args[1].constEvaluate(context, type);
                const c = this.args[2].constEvaluate(context, type);
                if (Array.isArray(a) && Array.isArray(b) && Array.isArray(c)) {
                    return a.map((v, i) => v * (1 - c[i]) + b[i] * c[i]);
                }
                return a * (1 - c) + b * c;
            }
            case "modf":
                throw new Error("TODO Modf is not implemented");
            case "pow": {
                const a = this.args[0].constEvaluate(context, type);
                const b = this.args[1].constEvaluate(context, type);
                if (Array.isArray(a) && Array.isArray(b)) {
                    return a.map((v, i) => Math.pow(v, b[i]));
                }
                return Math.pow(a, b);
            }
            case "radians": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => (v * Math.PI) / 180);
                }
                return (value * Math.PI) / 180;
            }
            case "round": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => Math.round(v));
                }
                return Math.round(value);
            }
            case "sign": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => Math.sign(v));
                }
                return Math.sign(value);
            }
            case "sin": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => Math.sin(v));
                }
                return Math.sin(value);
            }
            case "sinh": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => Math.sinh(v));
                }
                return Math.sinh(value);
            }
            case "saturate": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => Math.min(Math.max(v, 0), 1));
                }
                return Math.min(Math.max(value, 0), 1);
            }
            case "smoothstep": {
                const edge0 = this.args[0].constEvaluate(context, type);
                const edge1 = this.args[1].constEvaluate(context, type);
                const x = this.args[2].constEvaluate(context, type);
                if (Array.isArray(edge0) && Array.isArray(edge1) && Array.isArray(x)) {
                    return x.map((v, i) => {
                        const t = Math.min(Math.max((v - edge0[i]) / (edge1[i] - edge0[i]), 0), 1);
                        return t * t * (3 - 2 * t);
                    });
                }
                const _x = x;
                const _edge0 = edge0;
                const _edge1 = edge1;
                const t = Math.min(Math.max((_x - _edge0) / (_edge1 - _edge0), 0), 1);
                return t * t * (3 - 2 * t);
            }
            case "sqrt": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => Math.sqrt(v));
                }
                return Math.sqrt(value);
            }
            case "step": {
                if (type !== undefined) {
                    type[0] = Type.bool;
                }
                const edge = this.args[0].constEvaluate(context, type);
                const x = this.args[1].constEvaluate(context, type);
                if (Array.isArray(edge) && Array.isArray(x)) {
                    return edge.map((v, i) => x[i] < v ? 0 : 1);
                }
                return x < edge ? 0 : 1;
            }
            case "tan": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => Math.tan(v));
                }
                return Math.tan(value);
            }
            case "tanh": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => Math.tanh(v));
                }
                return Math.tanh(value);
            }
            case "trunc": {
                const value = this.args[0].constEvaluate(context, type);
                if (Array.isArray(value)) {
                    return value.map((v) => Math.trunc(v));
                }
                return Math.trunc(value);
            }
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
CallExpr.builtinFunctionNames = new Set([
    "all",
    "all",
    "any",
    "select",
    "arrayLength",
    "abs",
    "acos",
    "acosh",
    "asin",
    "asinh",
    "atan",
    "atanh",
    "atan2",
    "ceil",
    "clamp",
    "cos",
    "cosh",
    "countLeadingZeros",
    "countOneBits",
    "countTrailingZeros",
    "cross",
    "degrees",
    "determinant",
    "distance",
    "dot",
    "dot4U8Packed",
    "dot4I8Packed",
    "exp",
    "exp2",
    "extractBits",
    "faceForward",
    "firstLeadingBit",
    "firstTrailingBit",
    "floor",
    "fma",
    "fract",
    "frexp",
    "insertBits",
    "inverseSqrt",
    "ldexp",
    "length",
    "log",
    "log2",
    "max",
    "min",
    "mix",
    "modf",
    "normalize",
    "pow",
    "quantizeToF16",
    "radians",
    "reflect",
    "refract",
    "reverseBits",
    "round",
    "saturate",
    "sign",
    "sin",
    "sinh",
    "smoothStep",
    "sqrt",
    "step",
    "tan",
    "tanh",
    "transpose",
    "trunc",
    "dpdx",
    "dpdxCoarse",
    "dpdxFine",
    "dpdy",
    "dpdyCoarse",
    "dpdyFine",
    "fwidth",
    "fwidthCoarse",
    "fwidthFine",
    "textureDimensions",
    "textureGather",
    "textureGatherCompare",
    "textureLoad",
    "textureNumLayers",
    "textureNumLevels",
    "textureNumSamples",
    "textureSample",
    "textureSampleBias",
    "textureSampleCompare",
    "textureSampleCompareLevel",
    "textureSampleGrad",
    "textureSampleLevel",
    "textureSampleBaseClampToEdge",
    "textureStore",
    "atomicLoad",
    "atomicStore",
    "atomicAdd",
    "atomicSub",
    "atomicMax",
    "atomicMin",
    "atomicAnd",
    "atomicOr",
    "atomicXor",
    "atomicExchange",
    "atomicCompareExchangeWeak",
    "pack4x8snorm",
    "pack4x8unorm",
    "pack4xI8",
    "pack4xU8",
    "pack4x8Clamp",
    "pack4xU8Clamp",
    "pack2x16snorm",
    "pack2x16unorm",
    "pack2x16float",
    "unpack4x8snorm",
    "unpack4x8unorm",
    "unpack4xI8",
    "unpack4xU8",
    "unpack2x16snorm",
    "unpack2x16unorm",
    "unpack2x16float",
    "storageBarrier",
    "textureBarrier",
    "workgroupBarrier",
    "workgroupUniformLoad",
    "subgroupAdd",
    "subgroupExclusiveAdd",
    "subgroupInclusiveAdd",
    "subgroupAll",
    "subgroupAnd",
    "subgroupAny",
    "subgroupBallot",
    "subgroupBroadcast",
    "subgroupBroadcastFirst",
    "subgroupElect",
    "subgroupMax",
    "subgroupMin",
    "subgroupMul",
    "subgroupExclusiveMul",
    "subgroupInclusiveMul",
    "subgroupOr",
    "subgroupShuffle",
    "subgroupShuffleDown",
    "subgroupShuffleUp",
    "subgroupShuffleXor",
    "subgroupXor",
    "quadBroadcast",
    "quadSwapDiagonal",
    "quadSwapX",
    "quadSwapY",
]);
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
    constEvaluate(context, type) {
        const constant = context.constants.get(this.name);
        if (!constant) {
            throw new Error("Cannot evaluate node");
        }
        return constant.constEvaluate(context, type);
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
    constEvaluate(context, type) {
        var _a, _b;
        if (this.initializer instanceof CreateExpr) {
            // This is a struct constant
            const property = (_a = this.postfix) === null || _a === void 0 ? void 0 : _a.constEvaluateString(context);
            const t = (_b = this.initializer.type) === null || _b === void 0 ? void 0 : _b.name;
            const struct = context.structs.get(t);
            const memberIndex = struct === null || struct === void 0 ? void 0 : struct.getMemberIndex(property);
            if (memberIndex !== undefined && memberIndex != -1) {
                const value = this.initializer.args[memberIndex].constEvaluate(context, type);
                return value;
            }
            else {
                return this.initializer.constEvaluate(context, type);
            }
        }
        return this.initializer.constEvaluate(context, type);
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
    constructor(value, type) {
        super();
        this.value = value;
        this.type = type;
    }
    get astNodeType() {
        return "literalExpr";
    }
    constEvaluate(context, type) {
        if (type !== undefined) {
            type[0] = this.type;
        }
        return this.value;
    }
    get scalarValue() { return this.value; }
    get vectorValue() { return this.value; }
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
    constEvaluate(context, type) {
        if (type !== undefined) {
            type[0] = this.type;
        }
        return this.args[0].constEvaluate(context);
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
    constEvaluate(context, type) {
        return this.contents[0].constEvaluate(context, type);
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
    constEvaluate(context, type) {
        switch (this.operator) {
            case "+":
                return this.right.constEvaluate(context, type);
            case "-":
                return -this.right.constEvaluate(context, type);
            case "!":
                if (type !== undefined) {
                    type[0] = Type.bool;
                }
                return this.right.constEvaluate(context) ? 0 : 1;
            case "~":
                return ~this.right.constEvaluate(context, type);
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
    _getPromotedType(t1, t2) {
        if (t1.name === t2.name) {
            return t1;
        }
        if (t1.name === "f32" || t2.name === "f32") {
            return Type.f32;
        }
        if (t1.name === "u32" || t2.name === "u32") {
            return Type.u32;
        }
        return Type.i32;
    }
    constEvaluate(context, type) {
        const t1 = [Type.i32];
        const t2 = [Type.i32];
        switch (this.operator) {
            case "+": {
                const v1 = this.left.constEvaluate(context, t1);
                const v2 = this.right.constEvaluate(context, t2);
                if (Array.isArray(v1) && Array.isArray(v2)) {
                    return v1.map((v, i) => v + v2[i]);
                }
                const value = v1 + v2;
                if (type !== undefined) {
                    type[0] = this._getPromotedType(t1[0], t2[0]);
                    if (type[0] === Type.i32 || type[0] === Type.u32) {
                        return Math.floor(value);
                    }
                }
                return value;
            }
            case "-": {
                const v1 = this.left.constEvaluate(context, t1);
                const v2 = this.right.constEvaluate(context, t2);
                if (Array.isArray(v1) && Array.isArray(v2)) {
                    return v1.map((v, i) => v - v2[i]);
                }
                const value = v1 - v2;
                if (type !== undefined) {
                    type[0] = this._getPromotedType(t1[0], t2[0]);
                    if (type[0] === Type.i32 || type[0] === Type.u32) {
                        return Math.floor(value);
                    }
                }
                return value;
            }
            case "*": {
                const v1 = this.left.constEvaluate(context, t1);
                const v2 = this.right.constEvaluate(context, t2);
                if (Array.isArray(v1) && Array.isArray(v2)) {
                    return v1.map((v, i) => v * v2[i]);
                }
                const value = v1 * v2;
                if (type !== undefined) {
                    type[0] = this._getPromotedType(t1[0], t2[0]);
                    if (type[0] === Type.i32 || type[0] === Type.u32) {
                        return Math.floor(value);
                    }
                }
                return value;
            }
            case "/": {
                const v1 = this.left.constEvaluate(context, t1);
                const v2 = this.right.constEvaluate(context, t2);
                if (Array.isArray(v1) && Array.isArray(v2)) {
                    return v1.map((v, i) => v / v2[i]);
                }
                const value = v1 / v2;
                if (type !== undefined) {
                    type[0] = this._getPromotedType(t1[0], t2[0]);
                    if (type[0] === Type.i32 || type[0] === Type.u32) {
                        return Math.floor(value);
                    }
                }
                return value;
            }
            case "%": {
                const v1 = this.left.constEvaluate(context, t1);
                const v2 = this.right.constEvaluate(context, t2);
                if (Array.isArray(v1) && Array.isArray(v2)) {
                    return v1.map((v, i) => v % v2[i]);
                }
                const value = v1 % v2;
                if (type !== undefined) {
                    type[0] = this._getPromotedType(t1[0], t2[0]);
                    if (type[0] === Type.i32 || type[0] === Type.u32) {
                        return Math.floor(value);
                    }
                }
                return value;
            }
            case "<":
                if (type !== undefined) {
                    type[0] = Type.bool;
                }
                return this.left.constEvaluate(context) < this.right.constEvaluate(context)
                    ? 1
                    : 0;
            case ">":
                if (type !== undefined) {
                    type[0] = Type.bool;
                }
                return this.left.constEvaluate(context) > this.right.constEvaluate(context)
                    ? 1
                    : 0;
            case "==":
                if (type !== undefined) {
                    type[0] = Type.bool;
                }
                return this.left.constEvaluate(context) == this.right.constEvaluate(context)
                    ? 1
                    : 0;
            case "!=":
                if (type !== undefined) {
                    type[0] = Type.bool;
                }
                return this.left.constEvaluate(context) != this.right.constEvaluate(context)
                    ? 1
                    : 0;
            case "<=":
                if (type !== undefined) {
                    type[0] = Type.bool;
                }
                return this.left.constEvaluate(context) <= this.right.constEvaluate(context)
                    ? 1
                    : 0;
            case ">=":
                if (type !== undefined) {
                    type[0] = Type.bool;
                }
                return this.left.constEvaluate(context) >= this.right.constEvaluate(context)
                    ? 1
                    : 0;
            case "&&":
                if (type !== undefined) {
                    type[0] = Type.bool;
                }
                return this.left.constEvaluate(context) && this.right.constEvaluate(context)
                    ? 1
                    : 0;
            case "||":
                if (type !== undefined) {
                    type[0] = Type.bool;
                }
                return this.left.constEvaluate(context) || this.right.constEvaluate(context)
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
exports.TokenClass = void 0;
(function (TokenClass) {
    TokenClass[TokenClass["token"] = 0] = "token";
    TokenClass[TokenClass["keyword"] = 1] = "keyword";
    TokenClass[TokenClass["reserved"] = 2] = "reserved";
})(exports.TokenClass || (exports.TokenClass = {}));
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
TokenTypes.none = new TokenType("", exports.TokenClass.reserved, "");
TokenTypes.eof = new TokenType("EOF", exports.TokenClass.token, "");
TokenTypes.reserved = {
    asm: new TokenType("asm", exports.TokenClass.reserved, "asm"),
    bf16: new TokenType("bf16", exports.TokenClass.reserved, "bf16"),
    do: new TokenType("do", exports.TokenClass.reserved, "do"),
    enum: new TokenType("enum", exports.TokenClass.reserved, "enum"),
    f16: new TokenType("f16", exports.TokenClass.reserved, "f16"),
    f64: new TokenType("f64", exports.TokenClass.reserved, "f64"),
    handle: new TokenType("handle", exports.TokenClass.reserved, "handle"),
    i8: new TokenType("i8", exports.TokenClass.reserved, "i8"),
    i16: new TokenType("i16", exports.TokenClass.reserved, "i16"),
    i64: new TokenType("i64", exports.TokenClass.reserved, "i64"),
    mat: new TokenType("mat", exports.TokenClass.reserved, "mat"),
    premerge: new TokenType("premerge", exports.TokenClass.reserved, "premerge"),
    regardless: new TokenType("regardless", exports.TokenClass.reserved, "regardless"),
    typedef: new TokenType("typedef", exports.TokenClass.reserved, "typedef"),
    u8: new TokenType("u8", exports.TokenClass.reserved, "u8"),
    u16: new TokenType("u16", exports.TokenClass.reserved, "u16"),
    u64: new TokenType("u64", exports.TokenClass.reserved, "u64"),
    unless: new TokenType("unless", exports.TokenClass.reserved, "unless"),
    using: new TokenType("using", exports.TokenClass.reserved, "using"),
    vec: new TokenType("vec", exports.TokenClass.reserved, "vec"),
    void: new TokenType("void", exports.TokenClass.reserved, "void"),
};
TokenTypes.keywords = {
    array: new TokenType("array", exports.TokenClass.keyword, "array"),
    atomic: new TokenType("atomic", exports.TokenClass.keyword, "atomic"),
    bool: new TokenType("bool", exports.TokenClass.keyword, "bool"),
    f32: new TokenType("f32", exports.TokenClass.keyword, "f32"),
    i32: new TokenType("i32", exports.TokenClass.keyword, "i32"),
    mat2x2: new TokenType("mat2x2", exports.TokenClass.keyword, "mat2x2"),
    mat2x3: new TokenType("mat2x3", exports.TokenClass.keyword, "mat2x3"),
    mat2x4: new TokenType("mat2x4", exports.TokenClass.keyword, "mat2x4"),
    mat3x2: new TokenType("mat3x2", exports.TokenClass.keyword, "mat3x2"),
    mat3x3: new TokenType("mat3x3", exports.TokenClass.keyword, "mat3x3"),
    mat3x4: new TokenType("mat3x4", exports.TokenClass.keyword, "mat3x4"),
    mat4x2: new TokenType("mat4x2", exports.TokenClass.keyword, "mat4x2"),
    mat4x3: new TokenType("mat4x3", exports.TokenClass.keyword, "mat4x3"),
    mat4x4: new TokenType("mat4x4", exports.TokenClass.keyword, "mat4x4"),
    ptr: new TokenType("ptr", exports.TokenClass.keyword, "ptr"),
    sampler: new TokenType("sampler", exports.TokenClass.keyword, "sampler"),
    sampler_comparison: new TokenType("sampler_comparison", exports.TokenClass.keyword, "sampler_comparison"),
    struct: new TokenType("struct", exports.TokenClass.keyword, "struct"),
    texture_1d: new TokenType("texture_1d", exports.TokenClass.keyword, "texture_1d"),
    texture_2d: new TokenType("texture_2d", exports.TokenClass.keyword, "texture_2d"),
    texture_2d_array: new TokenType("texture_2d_array", exports.TokenClass.keyword, "texture_2d_array"),
    texture_3d: new TokenType("texture_3d", exports.TokenClass.keyword, "texture_3d"),
    texture_cube: new TokenType("texture_cube", exports.TokenClass.keyword, "texture_cube"),
    texture_cube_array: new TokenType("texture_cube_array", exports.TokenClass.keyword, "texture_cube_array"),
    texture_multisampled_2d: new TokenType("texture_multisampled_2d", exports.TokenClass.keyword, "texture_multisampled_2d"),
    texture_storage_1d: new TokenType("texture_storage_1d", exports.TokenClass.keyword, "texture_storage_1d"),
    texture_storage_2d: new TokenType("texture_storage_2d", exports.TokenClass.keyword, "texture_storage_2d"),
    texture_storage_2d_array: new TokenType("texture_storage_2d_array", exports.TokenClass.keyword, "texture_storage_2d_array"),
    texture_storage_3d: new TokenType("texture_storage_3d", exports.TokenClass.keyword, "texture_storage_3d"),
    texture_depth_2d: new TokenType("texture_depth_2d", exports.TokenClass.keyword, "texture_depth_2d"),
    texture_depth_2d_array: new TokenType("texture_depth_2d_array", exports.TokenClass.keyword, "texture_depth_2d_array"),
    texture_depth_cube: new TokenType("texture_depth_cube", exports.TokenClass.keyword, "texture_depth_cube"),
    texture_depth_cube_array: new TokenType("texture_depth_cube_array", exports.TokenClass.keyword, "texture_depth_cube_array"),
    texture_depth_multisampled_2d: new TokenType("texture_depth_multisampled_2d", exports.TokenClass.keyword, "texture_depth_multisampled_2d"),
    texture_external: new TokenType("texture_external", exports.TokenClass.keyword, "texture_external"),
    u32: new TokenType("u32", exports.TokenClass.keyword, "u32"),
    vec2: new TokenType("vec2", exports.TokenClass.keyword, "vec2"),
    vec3: new TokenType("vec3", exports.TokenClass.keyword, "vec3"),
    vec4: new TokenType("vec4", exports.TokenClass.keyword, "vec4"),
    bitcast: new TokenType("bitcast", exports.TokenClass.keyword, "bitcast"),
    block: new TokenType("block", exports.TokenClass.keyword, "block"),
    break: new TokenType("break", exports.TokenClass.keyword, "break"),
    case: new TokenType("case", exports.TokenClass.keyword, "case"),
    continue: new TokenType("continue", exports.TokenClass.keyword, "continue"),
    continuing: new TokenType("continuing", exports.TokenClass.keyword, "continuing"),
    default: new TokenType("default", exports.TokenClass.keyword, "default"),
    diagnostic: new TokenType("diagnostic", exports.TokenClass.keyword, "diagnostic"),
    discard: new TokenType("discard", exports.TokenClass.keyword, "discard"),
    else: new TokenType("else", exports.TokenClass.keyword, "else"),
    enable: new TokenType("enable", exports.TokenClass.keyword, "enable"),
    fallthrough: new TokenType("fallthrough", exports.TokenClass.keyword, "fallthrough"),
    false: new TokenType("false", exports.TokenClass.keyword, "false"),
    fn: new TokenType("fn", exports.TokenClass.keyword, "fn"),
    for: new TokenType("for", exports.TokenClass.keyword, "for"),
    function: new TokenType("function", exports.TokenClass.keyword, "function"),
    if: new TokenType("if", exports.TokenClass.keyword, "if"),
    let: new TokenType("let", exports.TokenClass.keyword, "let"),
    const: new TokenType("const", exports.TokenClass.keyword, "const"),
    loop: new TokenType("loop", exports.TokenClass.keyword, "loop"),
    while: new TokenType("while", exports.TokenClass.keyword, "while"),
    private: new TokenType("private", exports.TokenClass.keyword, "private"),
    read: new TokenType("read", exports.TokenClass.keyword, "read"),
    read_write: new TokenType("read_write", exports.TokenClass.keyword, "read_write"),
    return: new TokenType("return", exports.TokenClass.keyword, "return"),
    requires: new TokenType("requires", exports.TokenClass.keyword, "requires"),
    storage: new TokenType("storage", exports.TokenClass.keyword, "storage"),
    switch: new TokenType("switch", exports.TokenClass.keyword, "switch"),
    true: new TokenType("true", exports.TokenClass.keyword, "true"),
    alias: new TokenType("alias", exports.TokenClass.keyword, "alias"),
    type: new TokenType("type", exports.TokenClass.keyword, "type"),
    uniform: new TokenType("uniform", exports.TokenClass.keyword, "uniform"),
    var: new TokenType("var", exports.TokenClass.keyword, "var"),
    override: new TokenType("override", exports.TokenClass.keyword, "override"),
    workgroup: new TokenType("workgroup", exports.TokenClass.keyword, "workgroup"),
    write: new TokenType("write", exports.TokenClass.keyword, "write"),
    r8unorm: new TokenType("r8unorm", exports.TokenClass.keyword, "r8unorm"),
    r8snorm: new TokenType("r8snorm", exports.TokenClass.keyword, "r8snorm"),
    r8uint: new TokenType("r8uint", exports.TokenClass.keyword, "r8uint"),
    r8sint: new TokenType("r8sint", exports.TokenClass.keyword, "r8sint"),
    r16uint: new TokenType("r16uint", exports.TokenClass.keyword, "r16uint"),
    r16sint: new TokenType("r16sint", exports.TokenClass.keyword, "r16sint"),
    r16float: new TokenType("r16float", exports.TokenClass.keyword, "r16float"),
    rg8unorm: new TokenType("rg8unorm", exports.TokenClass.keyword, "rg8unorm"),
    rg8snorm: new TokenType("rg8snorm", exports.TokenClass.keyword, "rg8snorm"),
    rg8uint: new TokenType("rg8uint", exports.TokenClass.keyword, "rg8uint"),
    rg8sint: new TokenType("rg8sint", exports.TokenClass.keyword, "rg8sint"),
    r32uint: new TokenType("r32uint", exports.TokenClass.keyword, "r32uint"),
    r32sint: new TokenType("r32sint", exports.TokenClass.keyword, "r32sint"),
    r32float: new TokenType("r32float", exports.TokenClass.keyword, "r32float"),
    rg16uint: new TokenType("rg16uint", exports.TokenClass.keyword, "rg16uint"),
    rg16sint: new TokenType("rg16sint", exports.TokenClass.keyword, "rg16sint"),
    rg16float: new TokenType("rg16float", exports.TokenClass.keyword, "rg16float"),
    rgba8unorm: new TokenType("rgba8unorm", exports.TokenClass.keyword, "rgba8unorm"),
    rgba8unorm_srgb: new TokenType("rgba8unorm_srgb", exports.TokenClass.keyword, "rgba8unorm_srgb"),
    rgba8snorm: new TokenType("rgba8snorm", exports.TokenClass.keyword, "rgba8snorm"),
    rgba8uint: new TokenType("rgba8uint", exports.TokenClass.keyword, "rgba8uint"),
    rgba8sint: new TokenType("rgba8sint", exports.TokenClass.keyword, "rgba8sint"),
    bgra8unorm: new TokenType("bgra8unorm", exports.TokenClass.keyword, "bgra8unorm"),
    bgra8unorm_srgb: new TokenType("bgra8unorm_srgb", exports.TokenClass.keyword, "bgra8unorm_srgb"),
    rgb10a2unorm: new TokenType("rgb10a2unorm", exports.TokenClass.keyword, "rgb10a2unorm"),
    rg11b10float: new TokenType("rg11b10float", exports.TokenClass.keyword, "rg11b10float"),
    rg32uint: new TokenType("rg32uint", exports.TokenClass.keyword, "rg32uint"),
    rg32sint: new TokenType("rg32sint", exports.TokenClass.keyword, "rg32sint"),
    rg32float: new TokenType("rg32float", exports.TokenClass.keyword, "rg32float"),
    rgba16uint: new TokenType("rgba16uint", exports.TokenClass.keyword, "rgba16uint"),
    rgba16sint: new TokenType("rgba16sint", exports.TokenClass.keyword, "rgba16sint"),
    rgba16float: new TokenType("rgba16float", exports.TokenClass.keyword, "rgba16float"),
    rgba32uint: new TokenType("rgba32uint", exports.TokenClass.keyword, "rgba32uint"),
    rgba32sint: new TokenType("rgba32sint", exports.TokenClass.keyword, "rgba32sint"),
    rgba32float: new TokenType("rgba32float", exports.TokenClass.keyword, "rgba32float"),
    static_assert: new TokenType("static_assert", exports.TokenClass.keyword, "static_assert"),
    // WGSL grammar has a few keywords that have different token names than the strings they
    // represent. Aliasing them here.
    /*int32: new TokenType("i32", TokenClass.keyword, "i32"),
        uint32: new TokenType("u32", TokenClass.keyword, "u32"),
        float32: new TokenType("f32", TokenClass.keyword, "f32"),
        pointer: new TokenType("ptr", TokenClass.keyword, "ptr"),*/
};
TokenTypes.tokens = {
    decimal_float_literal: new TokenType("decimal_float_literal", exports.TokenClass.token, /((-?[0-9]*\.[0-9]+|-?[0-9]+\.[0-9]*)((e|E)(\+|-)?[0-9]+)?[fh]?)|(-?[0-9]+(e|E)(\+|-)?[0-9]+[fh]?)|(-?[0-9]+[fh])/),
    hex_float_literal: new TokenType("hex_float_literal", exports.TokenClass.token, /-?0x((([0-9a-fA-F]*\.[0-9a-fA-F]+|[0-9a-fA-F]+\.[0-9a-fA-F]*)((p|P)(\+|-)?[0-9]+[fh]?)?)|([0-9a-fA-F]+(p|P)(\+|-)?[0-9]+[fh]?))/),
    int_literal: new TokenType("int_literal", exports.TokenClass.token, /-?0x[0-9a-fA-F]+|0i?|-?[1-9][0-9]*i?/),
    uint_literal: new TokenType("uint_literal", exports.TokenClass.token, /0x[0-9a-fA-F]+u|0u|[1-9][0-9]*u/),
    ident: new TokenType("ident", exports.TokenClass.token, /[_a-zA-Z][0-9a-zA-Z_]*/),
    and: new TokenType("and", exports.TokenClass.token, "&"),
    and_and: new TokenType("and_and", exports.TokenClass.token, "&&"),
    arrow: new TokenType("arrow ", exports.TokenClass.token, "->"),
    attr: new TokenType("attr", exports.TokenClass.token, "@"),
    forward_slash: new TokenType("forward_slash", exports.TokenClass.token, "/"),
    bang: new TokenType("bang", exports.TokenClass.token, "!"),
    bracket_left: new TokenType("bracket_left", exports.TokenClass.token, "["),
    bracket_right: new TokenType("bracket_right", exports.TokenClass.token, "]"),
    brace_left: new TokenType("brace_left", exports.TokenClass.token, "{"),
    brace_right: new TokenType("brace_right", exports.TokenClass.token, "}"),
    colon: new TokenType("colon", exports.TokenClass.token, ":"),
    comma: new TokenType("comma", exports.TokenClass.token, ","),
    equal: new TokenType("equal", exports.TokenClass.token, "="),
    equal_equal: new TokenType("equal_equal", exports.TokenClass.token, "=="),
    not_equal: new TokenType("not_equal", exports.TokenClass.token, "!="),
    greater_than: new TokenType("greater_than", exports.TokenClass.token, ">"),
    greater_than_equal: new TokenType("greater_than_equal", exports.TokenClass.token, ">="),
    shift_right: new TokenType("shift_right", exports.TokenClass.token, ">>"),
    less_than: new TokenType("less_than", exports.TokenClass.token, "<"),
    less_than_equal: new TokenType("less_than_equal", exports.TokenClass.token, "<="),
    shift_left: new TokenType("shift_left", exports.TokenClass.token, "<<"),
    modulo: new TokenType("modulo", exports.TokenClass.token, "%"),
    minus: new TokenType("minus", exports.TokenClass.token, "-"),
    minus_minus: new TokenType("minus_minus", exports.TokenClass.token, "--"),
    period: new TokenType("period", exports.TokenClass.token, "."),
    plus: new TokenType("plus", exports.TokenClass.token, "+"),
    plus_plus: new TokenType("plus_plus", exports.TokenClass.token, "++"),
    or: new TokenType("or", exports.TokenClass.token, "|"),
    or_or: new TokenType("or_or", exports.TokenClass.token, "||"),
    paren_left: new TokenType("paren_left", exports.TokenClass.token, "("),
    paren_right: new TokenType("paren_right", exports.TokenClass.token, ")"),
    semicolon: new TokenType("semicolon", exports.TokenClass.token, ";"),
    star: new TokenType("star", exports.TokenClass.token, "*"),
    tilde: new TokenType("tilde", exports.TokenClass.token, "~"),
    underscore: new TokenType("underscore", exports.TokenClass.token, "_"),
    xor: new TokenType("xor", exports.TokenClass.token, "^"),
    plus_equal: new TokenType("plus_equal", exports.TokenClass.token, "+="),
    minus_equal: new TokenType("minus_equal", exports.TokenClass.token, "-="),
    times_equal: new TokenType("times_equal", exports.TokenClass.token, "*="),
    division_equal: new TokenType("division_equal", exports.TokenClass.token, "/="),
    modulo_equal: new TokenType("modulo_equal", exports.TokenClass.token, "%="),
    and_equal: new TokenType("and_equal", exports.TokenClass.token, "&="),
    or_equal: new TokenType("or_equal", exports.TokenClass.token, "|="),
    xor_equal: new TokenType("xor_equal", exports.TokenClass.token, "^="),
    shift_right_equal: new TokenType("shift_right_equal", exports.TokenClass.token, ">>="),
    shift_left_equal: new TokenType("shift_left_equal", exports.TokenClass.token, "<<="),
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
                            const count = constant.constEvaluate(this._context);
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
        throw this._error(this._peek(), `${message}. Line:${this._currentLine}`);
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
            if (type === null && value instanceof LiteralExpr) {
                type = value.type;
            }
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
            ? exports.IncrementOperator.increment
            : exports.IncrementOperator.decrement, _var));
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
        return this._updateNode(new Assign(exports.AssignOperator.parse(type.lexeme), _var, value));
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
            this._shift_expression(), //?.constEvaluate(this._context).toString() ?? "",
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
        const line = this._currentLine;
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
        return this._updateNode(new If(condition, block, elseif, _else), line);
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
    _validateTypeRange(value, type) {
        if (type.name === "i32") {
            if (value < -2147483648 || value > 2147483647) {
                throw this._error(this._previous(), `Value out of range for i32: ${value}. Line: ${this._currentLine}.`);
            }
        }
        else if (type.name === "u32") {
            if (value < 0 || value > 4294967295) {
                throw this._error(this._previous(), `Value out of range for u32: ${value}. Line: ${this._currentLine}.`);
            }
        }
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
        if (this._match(TokenTypes.tokens.int_literal)) {
            const s = this._previous().toString();
            let type = s.endsWith("i") || s.endsWith("i") ? Type.i32 :
                s.endsWith("u") || s.endsWith("U") ? Type.u32 : Type.x32;
            const i = parseInt(s);
            this._validateTypeRange(i, type);
            return this._updateNode(new LiteralExpr(i, type));
        }
        else if (this._match(TokenTypes.tokens.uint_literal)) {
            const u = parseInt(this._previous().toString());
            this._validateTypeRange(u, Type.u32);
            return this._updateNode(new LiteralExpr(u, Type.u32));
        }
        else if (this._match([TokenTypes.tokens.decimal_float_literal, TokenTypes.tokens.hex_float_literal])) {
            let fs = this._previous().toString();
            let isF16 = fs.endsWith("h");
            if (isF16) {
                fs = fs.substring(0, fs.length - 1);
            }
            const f = parseFloat(fs);
            this._validateTypeRange(f, isF16 ? Type.f16 : Type.f32);
            return this._updateNode(new LiteralExpr(f, isF16 ? Type.f16 : Type.f32));
        }
        else if (this._match([TokenTypes.keywords.true, TokenTypes.keywords.false])) {
            let b = this._previous().toString() === TokenTypes.keywords.true.rule;
            return this._updateNode(new LiteralExpr(b ? 1 : 0, Type.bool));
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
            const expr = this._const_expression();
            const type = [Type.f32];
            try {
                const value = expr.constEvaluate(this._context, type);
                _var.value = new LiteralExpr(value, type[0]);
            }
            catch (_) {
                _var.value = expr;
            }
        }
        if (_var.type !== null && _var.value instanceof LiteralExpr) {
            if (_var.value.type.name !== "x32") {
                if (_var.type.name !== _var.value.type.name) {
                    throw this._error(this._peek(), `Invalid cast from ${_var.value.type.name} to ${_var.type.name}. Line:${this._currentLine}`);
                }
            }
            this._validateTypeRange(_var.value.scalarValue, _var.type);
            _var.value.type = _var.type;
        }
        else if (_var.type === null && _var.value instanceof LiteralExpr) {
            _var.type = _var.value.type.name === "x32" ? Type.i32 : _var.value.type;
            this._validateTypeRange(_var.value.scalarValue, _var.type);
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
        var _a;
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
        this._consume(TokenTypes.tokens.equal, "const declarations require an assignment");
        const valueExpr = this._short_circuit_or_expression();
        /*if (valueExpr instanceof AST.CreateExpr) {
          value = valueExpr;
        } else if (valueExpr instanceof AST.ConstExpr &&
                   valueExpr.initializer instanceof AST.CreateExpr) {
          value = valueExpr.initializer;
        } else*/ {
            try {
                let type = [Type.f32];
                const constValue = valueExpr.constEvaluate(this._context, type);
                this._validateTypeRange(constValue, type[0]);
                value = this._updateNode(new LiteralExpr(constValue, type[0]));
            }
            catch (_b) {
                value = valueExpr;
            }
        }
        if (type !== null && value instanceof LiteralExpr) {
            if (value.type.name !== "x32") {
                if (type.name !== value.type.name) {
                    throw this._error(this._peek(), `Invalid cast from ${value.type.name} to ${type.name}. Line:${this._currentLine}`);
                }
            }
            value.type = type;
            this._validateTypeRange(value.scalarValue, value.type);
        }
        else if (type === null && value instanceof LiteralExpr) {
            type = (_a = value === null || value === void 0 ? void 0 : value.type) !== null && _a !== void 0 ? _a : Type.f32;
            if (type === Type.x32) {
                type = Type.i32;
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
            const type = [Type.f32];
            try {
                const v = value.constEvaluate(this._context, type);
                value = new LiteralExpr(v, type[0]);
            }
            catch (_) {
            }
        }
        if (type !== null && value instanceof LiteralExpr) {
            if (value.type.name !== "x32") {
                if (type.name !== value.type.name) {
                    throw this._error(this._peek(), `Invalid cast from ${value.type.name} to ${type.name}. Line:${this._currentLine}`);
                }
            }
            value.type = type;
        }
        else if (type === null && value instanceof LiteralExpr) {
            type = value.type.name === "x32" ? Type.i32 : value.type;
        }
        if (value instanceof LiteralExpr) {
            this._validateTypeRange(value.scalarValue, type);
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
                        count = countNode.constEvaluate(this._context).toString();
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
exports.ResourceType = void 0;
(function (ResourceType) {
    ResourceType[ResourceType["Uniform"] = 0] = "Uniform";
    ResourceType[ResourceType["Storage"] = 1] = "Storage";
    ResourceType[ResourceType["Texture"] = 2] = "Texture";
    ResourceType[ResourceType["Sampler"] = 3] = "Sampler";
    ResourceType[ResourceType["StorageTexture"] = 4] = "StorageTexture";
})(exports.ResourceType || (exports.ResourceType = {}));
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
    constructor(name, type, attributes) {
        this.name = name;
        this.type = type;
        this.attributes = attributes;
    }
}
class FunctionInfo {
    constructor(name, stage = null, attributes) {
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
        this.attributes = attributes;
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
                const info = this.getTypeInfo(node, null);
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
                const type = v.type != null ? this.getTypeInfo(v.type, v.attributes) : null;
                this.overrides.push(new OverrideInfo(v.name, type, v.attributes, id));
                continue;
            }
            if (this._isUniformVar(node)) {
                const v = node;
                const g = this._getAttributeNum(v.attributes, "group", 0);
                const b = this._getAttributeNum(v.attributes, "binding", 0);
                const type = this.getTypeInfo(v.type, v.attributes);
                const varInfo = new VariableInfo(v.name, type, g, b, v.attributes, exports.ResourceType.Uniform, v.access);
                this.uniforms.push(varInfo);
                continue;
            }
            if (this._isStorageVar(node)) {
                const v = node;
                const g = this._getAttributeNum(v.attributes, "group", 0);
                const b = this._getAttributeNum(v.attributes, "binding", 0);
                const type = this.getTypeInfo(v.type, v.attributes);
                const isStorageTexture = this._isStorageTexture(type);
                const varInfo = new VariableInfo(v.name, type, g, b, v.attributes, isStorageTexture ? exports.ResourceType.StorageTexture : exports.ResourceType.Storage, v.access);
                this.storage.push(varInfo);
                continue;
            }
            if (this._isTextureVar(node)) {
                const v = node;
                const g = this._getAttributeNum(v.attributes, "group", 0);
                const b = this._getAttributeNum(v.attributes, "binding", 0);
                const type = this.getTypeInfo(v.type, v.attributes);
                const isStorageTexture = this._isStorageTexture(type);
                const varInfo = new VariableInfo(v.name, type, g, b, v.attributes, isStorageTexture ? exports.ResourceType.StorageTexture : exports.ResourceType.Texture, v.access);
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
                const type = this.getTypeInfo(v.type, v.attributes);
                const varInfo = new VariableInfo(v.name, type, g, b, v.attributes, exports.ResourceType.Sampler, v.access);
                this.samplers.push(varInfo);
                continue;
            }
            if (node instanceof Function$1) {
                const vertexStage = this._getAttribute(node, "vertex");
                const fragmentStage = this._getAttribute(node, "fragment");
                const computeStage = this._getAttribute(node, "compute");
                const stage = vertexStage || fragmentStage || computeStage;
                const fn = new FunctionInfo(node.name, stage === null || stage === void 0 ? void 0 : stage.name, node.attributes);
                fn.attributes = node.attributes;
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
                fn.arguments = node.args.map((arg) => new ArgumentInfo(arg.name, this.getTypeInfo(arg.type, arg.attributes), arg.attributes));
                fn.returnType = node.returnType
                    ? this.getTypeInfo(node.returnType, node.attributes)
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
    getOverrideInfo(name) {
        for (const o of this.overrides) {
            if (o.name == name) {
                return o;
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
        const info = this.getTypeInfo(type, null);
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
                    const typeInfo = this.getTypeInfo(m.type, m.type.attributes);
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
            const typeInfo = this.getTypeInfo(type, type.attributes);
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
            const type = this.getTypeInfo(node.type, node.attributes);
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
        return new AliasInfo(node.name, this.getTypeInfo(node.type, null));
    }
    getTypeInfo(type, attributes = null) {
        if (this._types.has(type)) {
            return this._types.get(type);
        }
        if (type instanceof ArrayType) {
            const a = type;
            const t = a.format ? this.getTypeInfo(a.format, a.attributes) : null;
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
                const t = this.getTypeInfo(m.type, m.attributes);
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
                    ? this.getTypeInfo(s.format, null)
                    : new TypeInfo(s.format, null)
                : null;
            const info = new TemplateInfo(s.name, format, attributes, s.access);
            this._types.set(type, info);
            this._updateTypeInfo(info);
            return info;
        }
        if (type instanceof TemplateType) {
            const t = type;
            const format = t.format ? this.getTypeInfo(t.format, null) : null;
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

class Var {
    constructor(n, v, node) {
        this.name = n;
        this.value = v;
        this.node = node;
    }
    clone() {
        return new Var(this.name, this.value, this.node);
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
        this.currentFunctionName = "";
        if (parent) {
            this.parent = parent;
            this.currentFunctionName = parent.currentFunctionName;
        }
    }
    getVariable(name) {
        var _a;
        if (this.variables.has(name)) {
            return (_a = this.variables.get(name)) !== null && _a !== void 0 ? _a : null;
        }
        if (this.parent) {
            return this.parent.getVariable(name);
        }
        return null;
    }
    getFunction(name) {
        var _a;
        if (this.functions.has(name)) {
            return (_a = this.functions.get(name)) !== null && _a !== void 0 ? _a : null;
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

class ExecInterface {
    evalExpression(node, context) {
        return null;
    }
    getTypeName(type) {
        return "";
    }
    getTypeInfo(type) {
        return null;
    }
    _getVariableName(node, context) {
        return "";
    }
}

class Data {
    constructor(typeInfo) {
        this.typeInfo = typeInfo;
    }
    setDataValue(exec, value, postfix, context) {
        console.error(`SetDataValue: Not implemented`, value, postfix);
    }
    getDataValue(exec, postfix, context) {
        console.error(`GetDataValue: Not implemented`, postfix);
        return null;
    }
}
class VoidData extends Data {
    constructor() {
        super(new TypeInfo("void", null));
    }
}
VoidData.void = new VoidData();
// Used to store scalar data
class ScalarData extends Data {
    constructor(value, typeInfo) {
        super(typeInfo);
        if (this.typeInfo.name === "i32" || this.typeInfo.name === "u32") {
            value = Math.floor(value);
        }
        else if (this.typeInfo.name === "bool") {
            value = value ? 1 : 0;
        }
        this.value = value;
    }
    setDataValue(exec, value, postfix, context) {
        if (postfix) {
            console.error(`SetDataValue: Scalar data does not support postfix`, postfix);
            return;
        }
        if (!(value instanceof ScalarData)) {
            console.error(`SetDataValue: Invalid value`, value);
            return;
        }
        value.value;
        if (this.typeInfo.name === "i32" || this.typeInfo.name === "u32") ;
        else if (this.typeInfo.name === "bool") ;
        this.value = value.value;
    }
    getDataValue(exec, postfix, context) {
        if (postfix) {
            console.error(`GetDataValue: Scalar data does not support postfix`, postfix);
            return null;
        }
        return this;
    }
}
function _getVectorData(exec, values, formatName) {
    const size = values.length;
    if (size === 2) {
        if (formatName === "f32") {
            return new VectorData(values, exec.getTypeInfo("vec2f"));
        }
        else if (formatName === "i32") {
            return new VectorData(values, exec.getTypeInfo("vec2i"));
        }
        else if (formatName === "u32") {
            return new VectorData(values, exec.getTypeInfo("vec2u"));
        }
        else if (formatName === "f16") {
            return new VectorData(values, exec.getTypeInfo("vec2h"));
        }
        else {
            console.error(`GetDataValue: Unknown format ${formatName}`);
        }
        return null;
    }
    if (size === 3) {
        if (formatName === "f32") {
            return new VectorData(values, exec.getTypeInfo("vec3f"));
        }
        else if (formatName === "i32") {
            return new VectorData(values, exec.getTypeInfo("vec3i"));
        }
        else if (formatName === "u32") {
            return new VectorData(values, exec.getTypeInfo("vec3u"));
        }
        else if (formatName === "f16") {
            return new VectorData(values, exec.getTypeInfo("vec3h"));
        }
        else {
            console.error(`GetDataValue: Unknown format ${formatName}`);
        }
        return null;
    }
    if (size === 4) {
        if (formatName === "f32") {
            return new VectorData(values, exec.getTypeInfo("vec4f"));
        }
        else if (formatName === "i32") {
            return new VectorData(values, exec.getTypeInfo("vec4i"));
        }
        else if (formatName === "u32") {
            return new VectorData(values, exec.getTypeInfo("vec4u"));
        }
        else if (formatName === "f16") {
            return new VectorData(values, exec.getTypeInfo("vec4h"));
        }
        console.error(`GetDataValue: Unknown format ${formatName}`);
        return null;
    }
    console.error(`GetDataValue: Invalid vector size ${values.length}`);
    return null;
}
class VectorData extends Data {
    constructor(value, typeInfo) {
        super(typeInfo);
        if (Array.isArray(value)) {
            this.value = value;
        }
        else {
            this.value = Array.from(value);
        }
    }
    setDataValue(exec, value, postfix, context) {
        if (postfix instanceof StringExpr) {
            console.error("TODO: Set vector postfix");
            return;
        }
        if (!(value instanceof VectorData)) {
            console.error(`SetDataValue: Invalid value`, value);
            return;
        }
        this.value = value.value;
    }
    getDataValue(exec, postfix, context) {
        let format = exec.getTypeInfo("f32");
        if (this.typeInfo instanceof TemplateInfo) {
            format = this.typeInfo.format;
        }
        else {
            const typeName = this.typeInfo.name;
            if (typeName === "vec2f" || typeName === "vec3f" || typeName === "vec4f") {
                format = exec.getTypeInfo("f32");
            }
            else if (typeName === "vec2i" || typeName === "vec3i" || typeName === "vec4i") {
                format = exec.getTypeInfo("i32");
            }
            else if (typeName === "vec2u" || typeName === "vec3u" || typeName === "vec4u") {
                format = exec.getTypeInfo("u32");
            }
            else if (typeName === "vec2h" || typeName === "vec3h" || typeName === "vec4h") {
                format = exec.getTypeInfo("f16");
            }
            else {
                console.error(`GetDataValue: Unknown type ${typeName}`);
            }
        }
        if (postfix instanceof ArrayIndex) {
            const idx = postfix.index;
            let i = -1;
            if (idx instanceof LiteralExpr) {
                i = idx.value;
            }
            else {
                const d = exec.evalExpression(idx, context);
                if (d instanceof ScalarData) {
                    i = d.value;
                }
                else {
                    console.error(`GetDataValue: Unknown index type`, idx);
                    return null;
                }
            }
            if (i < 0 || i >= this.value.length) {
                console.error(`GetDataValue: Index out of range`, i);
                return null;
            }
            return new ScalarData(this.value[i], format);
        }
        if (postfix instanceof StringExpr) {
            const member = postfix.value;
            const values = [];
            for (const m of member) {
                if (m === "x" || m === "r") {
                    values.push(this.value[0]);
                }
                else if (m === "y" || m === "g") {
                    values.push(this.value[1]);
                }
                else if (m === "z" || m === "b") {
                    values.push(this.value[2]);
                }
                else if (m === "w" || m === "a") {
                    values.push(this.value[3]);
                }
                else {
                    console.error(`GetDataValue: Unknown member ${m}`);
                }
            }
            if (values.length === 1) {
                return new ScalarData(values[0], format);
            }
            return _getVectorData(exec, values, format.name);
        }
        return this;
    }
}
class MatrixData extends Data {
    constructor(value, typeInfo) {
        super(typeInfo);
        this.value = value;
    }
    setDataValue(exec, value, postfix, context) {
        if (postfix instanceof StringExpr) {
            console.error("TODO: Set matrix postfix");
            return;
        }
        if (!(value instanceof MatrixData)) {
            console.error(`SetDataValue: Invalid value`, value);
            return;
        }
        this.value = value.value;
    }
    getDataValue(exec, postfix, context) {
        const typeName = this.typeInfo.name;
        let format = exec.getTypeInfo("f32");
        if (this.typeInfo instanceof TemplateInfo) {
            format = this.typeInfo.format;
        }
        else {
            if (typeName.endsWith("f")) {
                format = exec.getTypeInfo("f32");
            }
            else if (typeName.endsWith("i")) {
                format = exec.getTypeInfo("i32");
            }
            else if (typeName.endsWith("u")) {
                format = exec.getTypeInfo("u32");
            }
            else if (typeName.endsWith("h")) {
                format = exec.getTypeInfo("f16");
            }
            else {
                console.error(`GetDataValue: Unknown type ${typeName}`);
            }
        }
        if (postfix instanceof ArrayIndex) {
            const idx = postfix.index;
            let i = -1;
            if (idx instanceof LiteralExpr) {
                i = idx.value;
            }
            else {
                const d = exec.evalExpression(idx, context);
                if (d instanceof ScalarData) {
                    i = d.value;
                }
                else {
                    console.error(`GetDataValue: Unknown index type`, idx);
                    return null;
                }
            }
            if (i < 0 || i >= this.value.length) {
                console.error(`GetDataValue: Index out of range`, i);
                return null;
            }
            let values;
            if (typeName === "mat2x2" || typeName === "mat2x2f" || typeName === "mat2x2h") {
                values = this.value.slice(i * 2, i * 2 + 2);
            }
            else if (typeName === "mat2x3" || typeName === "mat2x3f" || typeName === "mat2x3h") {
                values = this.value.slice(i * 3, i * 3 + 3);
            }
            else if (typeName === "mat2x4" || typeName === "mat2x4f" || typeName === "mat2x4h") {
                values = this.value.slice(i * 4, i * 4 + 4);
            }
            else if (typeName === "mat3x2" || typeName === "mat3x2f" || typeName === "mat3x2h") {
                values = this.value.slice(i * 2, i * 2 + 2);
            }
            else if (typeName === "mat3x3" || typeName === "mat3x3f" || typeName === "mat3x3h") {
                values = this.value.slice(i * 3, i * 3 + 3);
            }
            else if (typeName === "mat3x4" || typeName === "mat3x4f" || typeName === "mat3x4h") {
                values = this.value.slice(i * 4, i * 4 + 4);
            }
            else if (typeName === "mat4x2" || typeName === "mat4x2f" || typeName === "mat4x2h") {
                values = this.value.slice(i * 2, i * 2 + 2);
            }
            else if (typeName === "mat4x3" || typeName === "mat4x3f" || typeName === "mat4x3h") {
                values = this.value.slice(i * 3, i * 3 + 3);
            }
            else if (typeName === "mat4x4" || typeName === "mat4x4f" || typeName === "mat4x4h") {
                values = this.value.slice(i * 4, i * 4 + 4);
            }
            else {
                console.error(`GetDataValue: Unknown type ${typeName}`);
                return null;
            }
            return _getVectorData(exec, values, format.name);
        }
        return this;
    }
}
// Used to store array and struct data
class TypedData extends Data {
    constructor(data, typeInfo, offset = 0, textureSize) {
        super(typeInfo);
        this.textureSize = [0, 0, 0];
        this.buffer = data instanceof ArrayBuffer ? data : data.buffer;
        this.offset = offset;
        if (textureSize !== undefined) {
            this.textureSize = textureSize;
        }
    }
    setDataValue(exec, value, postfix, context) {
        if (value === null) {
            console.log(`setDataValue: NULL data.`);
            return;
        }
        let offset = this.offset;
        let typeInfo = this.typeInfo;
        while (postfix) {
            if (postfix instanceof ArrayIndex) {
                if (typeInfo instanceof ArrayInfo) {
                    const idx = postfix.index;
                    if (idx instanceof LiteralExpr) {
                        offset += idx.value * typeInfo.stride;
                    }
                    else {
                        const i = exec.evalExpression(idx, context);
                        if (i instanceof ScalarData) {
                            offset += i.value * typeInfo.stride;
                        }
                        else {
                            console.error(`SetDataValue: Unknown index type`, idx);
                            return;
                        }
                    }
                    typeInfo = typeInfo.format;
                }
                else {
                    console.error(`SetDataValue: Type ${exec.getTypeName(typeInfo)} is not an array`);
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
                    const typeName = exec.getTypeName(typeInfo);
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
                    if (!(value instanceof ScalarData)) {
                        console.error(`SetDataValue: Invalid value`, value);
                        return;
                    }
                    const v = value.value;
                    if (typeName === "vec2f") {
                        new Float32Array(this.buffer, offset, 2)[element] = v;
                        return;
                    }
                    else if (typeName === "vec3f") {
                        new Float32Array(this.buffer, offset, 3)[element] = v;
                        return;
                    }
                    else if (typeName === "vec4f") {
                        new Float32Array(this.buffer, offset, 4)[element] = v;
                        return;
                    }
                    else if (typeName === "vec2i") {
                        new Int32Array(this.buffer, offset, 2)[element] = v;
                        return;
                    }
                    else if (typeName === "vec3i") {
                        new Int32Array(this.buffer, offset, 3)[element] = v;
                        return;
                    }
                    else if (typeName === "vec4i") {
                        new Int32Array(this.buffer, offset, 4)[element] = v;
                        return;
                    }
                    else if (typeName === "vec2u") {
                        new Uint32Array(this.buffer, offset, 2)[element] = v;
                        return;
                    }
                    else if (typeName === "vec3u") {
                        new Uint32Array(this.buffer, offset, 3)[element] = v;
                        return;
                    }
                    else if (typeName === "vec4u") {
                        new Uint32Array(this.buffer, offset, 4)[element] = v;
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
        this.setData(exec, value, typeInfo, offset, context);
    }
    setData(exec, value, typeInfo, offset, context) {
        const typeName = exec.getTypeName(typeInfo);
        if (typeName === "f32") {
            if (value instanceof ScalarData) {
                new Float32Array(this.buffer, offset, 1)[0] = value.value;
            }
            return;
        }
        else if (typeName === "i32" || typeName === "atomic<i32>") {
            if (value instanceof ScalarData) {
                new Int32Array(this.buffer, offset, 1)[0] = value.value;
            }
            return;
        }
        else if (typeName === "u32" || typeName === "atomic<u32>") {
            if (value instanceof ScalarData) {
                new Uint32Array(this.buffer, offset, 1)[0] = value.value;
            }
            return;
        }
        else if (typeName === "vec2f") {
            const x = new Float32Array(this.buffer, offset, 2);
            if (value instanceof VectorData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
            }
            else {
                x[0] = value[0];
                x[1] = value[1];
            }
            return;
        }
        else if (typeName === "vec3f") {
            const x = new Float32Array(this.buffer, offset, 3);
            if (value instanceof VectorData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
                x[2] = value.value[2];
            }
            else {
                x[0] = value[0];
                x[1] = value[1];
                x[2] = value[2];
            }
            return;
        }
        else if (typeName === "vec4f") {
            const x = new Float32Array(this.buffer, offset, 4);
            if (value instanceof VectorData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
                x[2] = value.value[2];
                x[3] = value.value[3];
            }
            else {
                x[0] = value[0];
                x[1] = value[1];
                x[2] = value[2];
                x[3] = value[3];
            }
            return;
        }
        else if (typeName === "vec2i") {
            const x = new Int32Array(this.buffer, offset, 2);
            if (value instanceof VectorData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
            }
            else {
                x[0] = value[0];
                x[1] = value[1];
            }
            return;
        }
        else if (typeName === "vec3i") {
            const x = new Int32Array(this.buffer, offset, 3);
            if (value instanceof VectorData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
                x[2] = value.value[2];
            }
            else {
                x[0] = value[0];
                x[1] = value[1];
                x[2] = value[2];
            }
            return;
        }
        else if (typeName === "vec4i") {
            const x = new Int32Array(this.buffer, offset, 4);
            if (value instanceof VectorData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
                x[2] = value.value[2];
                x[3] = value.value[3];
            }
            else {
                x[0] = value[0];
                x[1] = value[1];
                x[2] = value[2];
                x[3] = value[3];
            }
            return;
        }
        else if (typeName === "vec2u") {
            const x = new Uint32Array(this.buffer, offset, 2);
            if (value instanceof VectorData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
            }
            else {
                x[0] = value[0];
                x[1] = value[1];
            }
            return;
        }
        else if (typeName === "vec3u") {
            const x = new Uint32Array(this.buffer, offset, 3);
            if (value instanceof VectorData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
                x[2] = value.value[2];
            }
            else {
                x[0] = value[0];
                x[1] = value[1];
                x[2] = value[2];
            }
            return;
        }
        else if (typeName === "vec4u") {
            const x = new Uint32Array(this.buffer, offset, 4);
            if (value instanceof VectorData) {
                x[0] = value.value[0];
                x[1] = value.value[1];
                x[2] = value.value[2];
                x[3] = value.value[3];
            }
            else {
                x[0] = value[0];
                x[1] = value[1];
                x[2] = value[2];
                x[3] = value[3];
            }
            return;
        }
        if (value instanceof TypedData) {
            if (typeInfo === value.typeInfo) {
                const x = new Uint8Array(this.buffer, offset, value.buffer.byteLength);
                x.set(new Uint8Array(value.buffer));
                return;
            }
            else {
                console.error(`SetDataValue: Type mismatch`, typeName, exec.getTypeName(value.typeInfo));
                return;
            }
        }
        console.error(`SetData: Unknown type ${typeName}`);
    }
    getDataValue(exec, postfix, context) {
        let offset = this.offset;
        let typeInfo = this.typeInfo;
        while (postfix) {
            if (postfix instanceof ArrayIndex) {
                if (typeInfo instanceof ArrayInfo) {
                    const idx = postfix.index;
                    if (idx instanceof LiteralExpr) {
                        offset += idx.value * typeInfo.stride;
                    }
                    else {
                        const i = exec.evalExpression(idx, context);
                        if (i instanceof ScalarData) {
                            offset += i.value * typeInfo.stride;
                        }
                        else {
                            console.error(`GetDataValue: Unknown index type`, idx);
                            return null;
                        }
                    }
                    typeInfo = typeInfo.format;
                }
                else {
                    console.error(`Type ${exec.getTypeName(typeInfo)} is not an array`);
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
                    const typeName = exec.getTypeName(typeInfo);
                    if (typeName === "vec2f" || typeName === "vec3f" || typeName === "vec4f" ||
                        typeName === "vec2i" || typeName === "vec3i" || typeName === "vec4i" ||
                        typeName === "vec2u" || typeName === "vec3u" || typeName === "vec4u" ||
                        typeName === "vec2b" || typeName === "vec3b" || typeName === "vec4b" ||
                        typeName === "vec2h" || typeName === "vec3h" || typeName === "vec4h" ||
                        typeName === "vec2" || typeName === "vec3" || typeName === "vec4") {
                        if (member.length > 0 && member.length < 5) {
                            let formatName = "f32";
                            const value = [];
                            for (let i = 0; i < member.length; ++i) {
                                const m = member[i].toLocaleLowerCase();
                                let element = 0;
                                if (m === "x" || m === "r") {
                                    element = 0;
                                }
                                else if (m === "y" || m === "g") {
                                    element = 1;
                                }
                                else if (m === "z" || m === "b") {
                                    element = 2;
                                }
                                else if (m === "w" || m === "a") {
                                    element = 3;
                                }
                                else {
                                    console.error(`Unknown member ${member}`);
                                    return null;
                                }
                                if (typeName === "vec2f") {
                                    value.push(new Float32Array(this.buffer, offset, 2)[element]);
                                }
                                else if (typeName === "vec3f") {
                                    if ((offset + 12) >= this.buffer.byteLength) {
                                        console.log("Insufficient buffer data");
                                        return null;
                                    }
                                    const fa = new Float32Array(this.buffer, offset, 3);
                                    value.push(fa[element]);
                                }
                                else if (typeName === "vec4f") {
                                    value.push(new Float32Array(this.buffer, offset, 4)[element]);
                                }
                                else if (typeName === "vec2i") {
                                    formatName = "i32";
                                    value.push(new Int32Array(this.buffer, offset, 2)[element]);
                                }
                                else if (typeName === "vec3i") {
                                    formatName = "i32";
                                    value.push(new Int32Array(this.buffer, offset, 3)[element]);
                                }
                                else if (typeName === "vec4i") {
                                    formatName = "i32";
                                    value.push(new Int32Array(this.buffer, offset, 4)[element]);
                                }
                                else if (typeName === "vec2u") {
                                    formatName = "u32";
                                    const ua = new Uint32Array(this.buffer, offset, 2);
                                    value.push(ua[element]);
                                }
                                else if (typeName === "vec3u") {
                                    formatName = "u32";
                                    value.push(new Uint32Array(this.buffer, offset, 3)[element]);
                                }
                                else if (typeName === "vec4u") {
                                    formatName = "u32";
                                    value.push(new Uint32Array(this.buffer, offset, 4)[element]);
                                }
                            }
                            if (value.length === 1) {
                                return new ScalarData(value[0], exec.getTypeInfo(formatName));
                            }
                            return new VectorData(value, typeInfo);
                        }
                        else {
                            console.error(`GetDataValue: Unknown member ${member}`);
                            return null;
                        }
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
        const typeName = exec.getTypeName(typeInfo);
        if (typeName === "f32") {
            return new ScalarData(new Float32Array(this.buffer, offset, 1)[0], typeInfo);
        }
        else if (typeName === "i32") {
            return new ScalarData(new Int32Array(this.buffer, offset, 1)[0], typeInfo);
        }
        else if (typeName === "u32") {
            return new ScalarData(new Uint32Array(this.buffer, offset, 1)[0], typeInfo);
        }
        else if (typeName === "vec2f") {
            return new VectorData(new Float32Array(this.buffer, offset, 2), typeInfo);
        }
        else if (typeName === "vec3f") {
            return new VectorData(new Float32Array(this.buffer, offset, 3), typeInfo);
        }
        else if (typeName === "vec4f") {
            return new VectorData(new Float32Array(this.buffer, offset, 4), typeInfo);
        }
        else if (typeName === "vec2i") {
            return new VectorData(new Int32Array(this.buffer, offset, 2), typeInfo);
        }
        else if (typeName === "vec3i") {
            return new VectorData(new Int32Array(this.buffer, offset, 3), typeInfo);
        }
        else if (typeName === "vec4i") {
            return new VectorData(new Int32Array(this.buffer, offset, 4), typeInfo);
        }
        else if (typeName === "vec2u") {
            return new VectorData(new Uint32Array(this.buffer, offset, 2), typeInfo);
        }
        else if (typeName === "vec3u") {
            return new VectorData(new Uint32Array(this.buffer, offset, 3), typeInfo);
        }
        else if (typeName === "vec4u") {
            return new VectorData(new Uint32Array(this.buffer, offset, 4), typeInfo);
        }
        if (typeInfo instanceof TemplateInfo && typeInfo.name === "atomic") {
            if (typeInfo.format.name === "u32") {
                return new ScalarData(new Uint32Array(this.buffer, offset, 1)[0], typeInfo.format);
            }
            else if (typeInfo.format.name === "i32") {
                return new ScalarData(new Int32Array(this.buffer, offset, 1)[0], typeInfo.format);
            }
            else {
                console.error(`GetDataValue: Invalid atomic format ${typeInfo.format.name}`);
                return null;
            }
        }
        return new TypedData(this.buffer, typeInfo, offset);
    }
}

class BuiltinFunctions {
    constructor(exec) {
        this.exec = exec;
    }
    getTypeInfo(type) {
        return this.exec.getTypeInfo(type);
    }
    // Logical Built-in Functions
    All(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        let isTrue = true;
        if (value instanceof VectorData) {
            value.value.forEach((x) => { if (!x)
                isTrue = false; });
            return new ScalarData(isTrue ? 1 : 0, this.getTypeInfo("bool"));
        }
        throw new Error(`All() expects a vector argument. Line ${node.line}`);
    }
    Any(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            const res = value.value.some((v) => v);
            return new ScalarData(res ? 1 : 0, this.getTypeInfo("bool"));
        }
        throw new Error(`Any() expects a vector argument. Line ${node.line}`);
    }
    Select(node, context) {
        const condition = this.exec.evalExpression(node.args[2], context);
        if (!(condition instanceof ScalarData)) {
            throw new Error(`Select() expects a bool condition. Line ${node.line}`);
        }
        if (condition.value) {
            return this.exec.evalExpression(node.args[0], context);
        }
        else {
            return this.exec.evalExpression(node.args[1], context);
        }
    }
    // Array Built-in Functions
    ArrayLength(node, context) {
        let arrayArg = node.args[0];
        // TODO: handle "&" operator
        if (arrayArg instanceof UnaryOperator) {
            arrayArg = arrayArg.right;
        }
        const arrayData = this.exec.evalExpression(arrayArg, context);
        if (arrayData instanceof TypedData && arrayData.typeInfo.size === 0) {
            const ta = arrayData.typeInfo;
            const count = arrayData.buffer.byteLength / ta.stride;
            return new ScalarData(count, this.getTypeInfo("u32"));
        }
        return new ScalarData(arrayData.typeInfo.size, this.getTypeInfo("u32"));
    }
    // Numeric Built-in Functions
    Abs(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.abs(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.abs(s.value), s.typeInfo);
    }
    Acos(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.acos(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.acos(s.value), value.typeInfo);
    }
    Acosh(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.acosh(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.acosh(s.value), value.typeInfo);
    }
    Asin(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.asin(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.asin(s.value), value.typeInfo);
    }
    Asinh(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.asinh(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.asinh(s.value), value.typeInfo);
    }
    Atan(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.atan(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.atan(s.value), value.typeInfo);
    }
    Atanh(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.atanh(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.atanh(s.value), value.typeInfo);
    }
    Atan2(node, context) {
        const y = this.exec.evalExpression(node.args[0], context);
        const x = this.exec.evalExpression(node.args[1], context);
        if (y instanceof VectorData && x instanceof VectorData) {
            return new VectorData(y.value.map((v, i) => Math.atan2(v, x.value[i])), y.typeInfo);
        }
        const ys = y;
        const xs = x;
        return new ScalarData(Math.atan2(ys.value, xs.value), y.typeInfo);
    }
    Ceil(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.ceil(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.ceil(s.value), value.typeInfo);
    }
    _clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
    Clamp(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        const min = this.exec.evalExpression(node.args[1], context);
        const max = this.exec.evalExpression(node.args[2], context);
        if (value instanceof VectorData && min instanceof VectorData && max instanceof VectorData) {
            return new VectorData(value.value.map((v, i) => this._clamp(v, min.value[i], max.value[i])), value.typeInfo);
        }
        const s = value;
        const minS = min;
        const maxS = max;
        return new ScalarData(this._clamp(s.value, minS.value, maxS.value), value.typeInfo);
    }
    Cos(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.cos(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.cos(s.value), value.typeInfo);
    }
    Cosh(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.cosh(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.cos(s.value), value.typeInfo);
    }
    CountLeadingZeros(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.clz32(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.clz32(s.value), value.typeInfo);
    }
    _countOneBits(value) {
        let count = 0;
        while (value !== 0) {
            if (value & 1) {
                count++;
            }
            value >>= 1;
        }
        return count;
    }
    CountOneBits(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => this._countOneBits(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(this._countOneBits(s.value), value.typeInfo);
    }
    _countTrailingZeros(value) {
        if (value === 0) {
            return 32; // Special case for 0
        }
        let count = 0;
        while ((value & 1) === 0) {
            value >>= 1;
            count++;
        }
        return count;
    }
    CountTrailingZeros(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => this._countTrailingZeros(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(this._countTrailingZeros(s.value), value.typeInfo);
    }
    Cross(node, context) {
        const l = this.exec.evalExpression(node.args[0], context);
        const r = this.exec.evalExpression(node.args[1], context);
        if (l instanceof VectorData && r instanceof VectorData) {
            if (l.value.length !== 3 || r.value.length !== 3) {
                console.error(`Cross() expects 3D vectors. Line ${node.line}`);
                return null;
            }
            const lv = l.value;
            const rv = r.value;
            return new VectorData([
                lv[1] * rv[2] - rv[1] * lv[2],
                lv[2] * rv[0] - rv[2] * lv[0],
                lv[0] * rv[1] - rv[0] * lv[1],
            ], l.typeInfo);
        }
        console.error(`Cross() expects vector arguments. Line ${node.line}`);
        return null;
    }
    Degrees(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        const radToDeg = 180.0 / Math.PI;
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => v * radToDeg), value.typeInfo);
        }
        const s = value;
        return new ScalarData(s.value * radToDeg, value.typeInfo);
    }
    Determinant(node, context) {
        const m = this.exec.evalExpression(node.args[0], context);
        if (m instanceof MatrixData) {
            const mv = m.value;
            const mt = this.exec.getTypeName(m.typeInfo);
            const isHalf = mt.endsWith("h");
            const formatType = isHalf ? this.getTypeInfo("f16") : this.getTypeInfo("f32");
            if (mt === "mat2x2" || mt === "mat2x2f" || mt === "mat2x2h") {
                return new ScalarData(mv[0] * mv[3] - mv[1] * mv[2], formatType);
            }
            else if (mt === "mat2x3" || mt === "mat2x3f" || mt === "mat2x3h") {
                return new ScalarData(mv[0] * (mv[4] * mv[8] - mv[5] * mv[7]) -
                    mv[1] * (mv[3] * mv[8] - mv[5] * mv[6]) + mv[2] * (mv[3] * mv[7] - mv[4] * mv[6]), formatType);
            }
            else if (mt === "mat2x4" || mt === "mat2x4f" || mt === "mat2x4h") {
                console.error(`TODO: Determinant for ${mt}`);
            }
            else if (mt === "mat3x2" || mt === "mat3x2f" || mt === "mat3x2h") {
                console.error(`TODO: Determinant for ${mt}`);
            }
            else if (mt === "mat3x3" || mt === "mat3x3f" || mt === "mat3x3h") {
                return new ScalarData(mv[0] * (mv[4] * mv[8] - mv[5] * mv[7]) -
                    mv[1] * (mv[3] * mv[8] - mv[5] * mv[6]) + mv[2] * (mv[3] * mv[7] - mv[4] * mv[6]), formatType);
            }
            else if (mt === "mat3x4" || mt === "mat3x4f" || mt === "mat3x4h") {
                console.error(`TODO: Determinant for ${mt}`);
            }
            else if (mt === "mat4x2" || mt === "mat4x2f" || mt === "mat4x2h") {
                console.error(`TODO: Determinant for ${mt}`);
            }
            else if (mt === "mat4x3" || mt === "mat4x3f" || mt === "mat4x3h") {
                console.error(`TODO: Determinant for ${mt}`);
            }
            else if (mt === "mat4x4" || mt === "mat4x4f" || mt === "mat4x4h") {
                console.error(`TODO: Determinant for ${mt}`);
            }
        }
        console.error(`Determinant expects a matrix argument. Line ${node.line}`);
        return null;
    }
    Distance(node, context) {
        const l = this.exec.evalExpression(node.args[0], context);
        const r = this.exec.evalExpression(node.args[1], context);
        if (l instanceof VectorData && r instanceof VectorData) {
            let sum = 0;
            for (let i = 0; i < l.value.length; ++i) {
                sum += (l.value[i] - r.value[i]) * (l.value[i] - r.value[i]);
            }
            return new ScalarData(Math.sqrt(sum), this.getTypeInfo("f32"));
        }
        const ls = l;
        const rs = r;
        return new ScalarData(Math.abs(ls.value - rs.value), l.typeInfo);
    }
    _dot(e1, e2) {
        let dot = 0;
        for (let i = 0; i < e1.length; ++i) {
            dot += e2[i] * e1[i];
        }
        return dot;
    }
    Dot(node, context) {
        const l = this.exec.evalExpression(node.args[0], context);
        const r = this.exec.evalExpression(node.args[1], context);
        if (l instanceof VectorData && r instanceof VectorData) {
            return new ScalarData(this._dot(l.value, r.value), this.getTypeInfo("f32"));
        }
        console.error(`Dot() expects vector arguments. Line ${node.line}`);
        return null;
    }
    Dot4U8Packed(node, context) {
        console.error(`TODO: dot4U8Packed. Line ${node.line}`);
        return null;
    }
    Dot4I8Packed(node, context) {
        console.error(`TODO: dot4I8Packed. Line ${node.line}`);
        return null;
    }
    Exp(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.exp(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.exp(s.value), value.typeInfo);
    }
    Exp2(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.pow(2, v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.pow(2, s.value), value.typeInfo);
    }
    ExtractBits(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        const offset = this.exec.evalExpression(node.args[1], context);
        const count = this.exec.evalExpression(node.args[2], context);
        if (offset.typeInfo.name !== "u32" && offset.typeInfo.name !== "x32") {
            console.error(`ExtractBits() expects an i32 offset argument. Line ${node.line}`);
            return null;
        }
        if (count.typeInfo.name !== "u32" && count.typeInfo.name !== "x32") {
            console.error(`ExtractBits() expects an i32 count argument. Line ${node.line}`);
            return null;
        }
        const o = offset.value;
        const c = count.value;
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => (v >> o) & ((1 << c) - 1)), value.typeInfo);
        }
        if (value.typeInfo.name !== "i32" && value.typeInfo.name !== "x32") {
            console.error(`ExtractBits() expects an i32 argument. Line ${node.line}`);
            return null;
        }
        const v = value.value;
        return new ScalarData((v >> o) & ((1 << c) - 1), this.getTypeInfo("i32"));
    }
    FaceForward(node, context) {
        console.error(`TODO: faceForward. Line ${node.line}`);
        return null;
    }
    FirstLeadingBit(node, context) {
        console.error(`TODO: firstLeadingBit. Line ${node.line}`);
        return null;
    }
    FirstTrailingBit(node, context) {
        console.error(`TODO: firstTrailingBit. Line ${node.line}`);
        return null;
    }
    Floor(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.floor(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.floor(s.value), value.typeInfo);
    }
    Fma(node, context) {
        const a = this.exec.evalExpression(node.args[0], context);
        const b = this.exec.evalExpression(node.args[1], context);
        const c = this.exec.evalExpression(node.args[2], context);
        if (a instanceof VectorData && b instanceof VectorData && c instanceof VectorData) {
            if (a.value.length !== b.value.length || a.value.length !== c.value.length) {
                console.error(`Fma() expects vectors of the same length. Line ${node.line}`);
                return null;
            }
            return new VectorData(a.value.map((v, i) => v * b.value[i] + c.value[i]), a.typeInfo);
        }
        const av = a;
        const bv = b;
        const cv = c;
        return new ScalarData(av.value * bv.value + cv.value, av.typeInfo);
    }
    Fract(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => v - Math.floor(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(s.value - Math.floor(s.value), value.typeInfo);
    }
    Frexp(node, context) {
        console.error(`TODO: frexp. Line ${node.line}`);
        return null;
    }
    InsertBits(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        const insert = this.exec.evalExpression(node.args[1], context);
        const offset = this.exec.evalExpression(node.args[2], context);
        const count = this.exec.evalExpression(node.args[3], context);
        if (offset.typeInfo.name !== "u32" && offset.typeInfo.name !== "x32") {
            console.error(`InsertBits() expects an i32 offset argument. Line ${node.line}`);
            return null;
        }
        const o = offset.value;
        const c = count.value;
        const mask = ((1 << c) - 1) << o;
        const invMask = ~mask;
        if (value instanceof VectorData && insert instanceof VectorData) {
            return new VectorData(value.value.map((v, i) => {
                return (v & invMask) | ((insert.value[i] << o) & mask);
            }), value.typeInfo);
        }
        const v = value.value;
        const i = insert.value;
        return new ScalarData((v & invMask) | ((i << o) & mask), value.typeInfo);
    }
    InverseSqrt(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => 1 / Math.sqrt(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(1 / Math.sqrt(s.value), value.typeInfo);
    }
    Ldexp(node, context) {
        console.error(`TODO: ldexp. Line ${node.line}`);
        return null;
    }
    Length(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            let sum = 0;
            value.value.forEach((v) => { sum += v * v; });
            return new ScalarData(Math.sqrt(sum), this.getTypeInfo("f32"));
        }
        const s = value;
        return new ScalarData(Math.abs(s.value), value.typeInfo);
    }
    Log(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.log(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.log(s.value), value.typeInfo);
    }
    Log2(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.log2(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.log2(s.value), value.typeInfo);
    }
    Max(node, context) {
        const l = this.exec.evalExpression(node.args[0], context);
        const r = this.exec.evalExpression(node.args[1], context);
        if (l instanceof VectorData && r instanceof VectorData) {
            return new VectorData(l.value.map((v, i) => Math.max(v, r.value[i])), l.typeInfo);
        }
        const ls = l;
        const rs = r;
        return new ScalarData(Math.max(ls.value, rs.value), l.typeInfo);
    }
    Min(node, context) {
        const l = this.exec.evalExpression(node.args[0], context);
        const r = this.exec.evalExpression(node.args[1], context);
        if (l instanceof VectorData && r instanceof VectorData) {
            return new VectorData(l.value.map((v, i) => Math.min(v, r.value[i])), l.typeInfo);
        }
        const ls = l;
        const rs = r;
        return new ScalarData(Math.min(ls.value, rs.value), l.typeInfo);
    }
    Mix(node, context) {
        const x = this.exec.evalExpression(node.args[0], context);
        const y = this.exec.evalExpression(node.args[1], context);
        const a = this.exec.evalExpression(node.args[2], context);
        if (x instanceof VectorData && y instanceof VectorData && a instanceof VectorData) {
            return new VectorData(x.value.map((v, i) => x.value[i] * (1 - a.value[i]) + y.value[i] * a.value[i]), x.typeInfo);
        }
        const xs = x;
        const ys = y;
        const as = a;
        return new ScalarData(xs.value * (1 - as.value) + ys.value * as.value, x.typeInfo);
    }
    Modf(node, context) {
        const x = this.exec.evalExpression(node.args[0], context);
        const y = this.exec.evalExpression(node.args[1], context);
        if (x instanceof VectorData && y instanceof VectorData) {
            return new VectorData(x.value.map((v, i) => v % y.value[i]), x.typeInfo);
        }
        const xs = x;
        const ys = y;
        return new ScalarData(xs.value % ys.value, x.typeInfo);
    }
    Normalize(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            const length = this.Length(node, context).value;
            return new VectorData(value.value.map((v) => v / length), value.typeInfo);
        }
        console.error(`Normalize() expects a vector argument. Line ${node.line}`);
        return null;
    }
    Pow(node, context) {
        const x = this.exec.evalExpression(node.args[0], context);
        const y = this.exec.evalExpression(node.args[1], context);
        if (x instanceof VectorData && y instanceof VectorData) {
            return new VectorData(x.value.map((v, i) => Math.pow(v, y.value[i])), x.typeInfo);
        }
        const xs = x;
        const ys = y;
        return new ScalarData(Math.pow(xs.value, ys.value), x.typeInfo);
    }
    QuantizeToF16(node, context) {
        console.error(`TODO: quantizeToF16. Line ${node.line}`);
        return null;
    }
    Radians(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => v * Math.PI / 180), value.typeInfo);
        }
        const s = value;
        return new ScalarData(s.value * Math.PI / 180, value.typeInfo);
    }
    Reflect(node, context) {
        // e1 - 2 * dot(e2, e1) * e2
        let e1 = this.exec.evalExpression(node.args[0], context);
        let e2 = this.exec.evalExpression(node.args[1], context);
        if (e1 instanceof VectorData && e2 instanceof VectorData) {
            const dot = this._dot(e1.value, e2.value);
            return new VectorData(e1.value.map((v, i) => v - 2 * dot * e2.value[i]), e1.typeInfo);
        }
        console.error(`Reflect() expects vector arguments. Line ${node.line}`);
        return null;
    }
    Refract(node, context) {
        let e1 = this.exec.evalExpression(node.args[0], context);
        let e2 = this.exec.evalExpression(node.args[1], context);
        let e3 = this.exec.evalExpression(node.args[2], context);
        if (e1 instanceof VectorData && e2 instanceof VectorData && e3 instanceof ScalarData) {
            const dot = this._dot(e2.value, e1.value);
            return new VectorData(e1.value.map((v, i) => {
                const k = 1.0 - e3.value * e3.value * (1.0 - dot * dot);
                if (k < 0) {
                    return 0;
                }
                const sqrtK = Math.sqrt(k);
                return e3.value * v - (e3.value * dot + sqrtK) * e2.value[i];
            }), e1.typeInfo);
        }
        console.error(`Refract() expects vector arguments and a scalar argument. Line ${node.line}`);
        return null;
    }
    ReverseBits(node, context) {
        console.error(`TODO: reverseBits. Line ${node.line}`);
        return null;
    }
    Round(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.round(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.round(s.value), value.typeInfo);
    }
    Saturate(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.min(Math.max(v, 0), 1)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.min(Math.max(s.value, 0), 1), value.typeInfo);
    }
    Sign(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.sign(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.sign(s.value), value.typeInfo);
    }
    Sin(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.sin(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.sin(s.value), value.typeInfo);
    }
    Sinh(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.sinh(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.sinh(s.value), value.typeInfo);
    }
    _smoothstep(edge0, edge1, x) {
        const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
        return t * t * (3 - 2 * t);
    }
    SmoothStep(node, context) {
        const edge0 = this.exec.evalExpression(node.args[0], context);
        const edge1 = this.exec.evalExpression(node.args[1], context);
        const x = this.exec.evalExpression(node.args[2], context);
        if (x instanceof VectorData && edge0 instanceof VectorData && edge1 instanceof VectorData) {
            return new VectorData(x.value.map((v, i) => this._smoothstep(edge0.value[i], edge1.value[i], v)), x.typeInfo);
        }
        const e0 = edge0;
        const e1 = edge1;
        const xS = x;
        return new ScalarData(this._smoothstep(e0.value, e1.value, xS.value), x.typeInfo);
    }
    Sqrt(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.sqrt(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.sqrt(s.value), value.typeInfo);
    }
    Step(node, context) {
        const edge = this.exec.evalExpression(node.args[0], context);
        const x = this.exec.evalExpression(node.args[1], context);
        if (x instanceof VectorData && edge instanceof VectorData) {
            return new VectorData(x.value.map((v, i) => v < edge.value[i] ? 0 : 1), x.typeInfo);
        }
        const e = edge;
        const s = x;
        return new ScalarData(s.value < e.value ? 0 : 1, e.typeInfo);
    }
    Tan(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.tan(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.tan(s.value), value.typeInfo);
    }
    Tanh(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.tanh(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.tanh(s.value), value.typeInfo);
    }
    Transpose(node, context) {
        console.error(`TODO: transpose. Line ${node.line}`);
        return null;
    }
    Trunc(node, context) {
        const value = this.exec.evalExpression(node.args[0], context);
        if (value instanceof VectorData) {
            return new VectorData(value.value.map((v) => Math.trunc(v)), value.typeInfo);
        }
        const s = value;
        return new ScalarData(Math.trunc(s.value), value.typeInfo);
    }
    // Derivative Built-in Functions
    Dpdx(node, context) {
        console.error(`TODO: dpdx. Line ${node.line}`);
        return null;
    }
    DpdxCoarse(node, context) {
        console.error(`TODO: dpdxCoarse. Line ${node.line}`);
        return null;
    }
    DpdxFine(node, context) {
        console.error("TODO: dpdxFine");
        return null;
    }
    Dpdy(node, context) {
        console.error("TODO: dpdy");
        return null;
    }
    DpdyCoarse(node, context) {
        console.error("TODO: dpdyCoarse");
        return null;
    }
    DpdyFine(node, context) {
        console.error("TODO: dpdyFine");
        return null;
    }
    Fwidth(node, context) {
        console.error("TODO: fwidth");
        return null;
    }
    FwidthCoarse(node, context) {
        console.error("TODO: fwidthCoarse");
        return null;
    }
    FwidthFine(node, context) {
        console.error("TODO: fwidthFine");
        return null;
    }
    // Texture Built-in Functions
    TextureDimensions(node, context) {
        const textureArg = node.args[0];
        const level = node.args.length > 1 ? this.exec.evalExpression(node.args[1], context).value : 0;
        if (level > 0) {
            console.error(`TODO: Mip levels. Line ${node.line}`);
            return null;
        }
        if (textureArg instanceof VariableExpr) {
            const textureName = textureArg.name;
            const texture = context.getVariableValue(textureName);
            if (texture instanceof TypedData) {
                return new VectorData(texture.textureSize, this.getTypeInfo("vec2u"));
            }
            else {
                console.error(`Texture ${textureName} not found. Line ${node.line}`);
                return null;
            }
        }
        console.error(`Invalid texture argument for textureDimensions. Line ${node.line}`);
        return null;
    }
    TextureGather(node, context) {
        console.error("TODO: textureGather");
        return null;
    }
    TextureGatherCompare(node, context) {
        console.error("TODO: textureGatherCompare");
        return null;
    }
    TextureLoad(node, context) {
        const textureArg = node.args[0];
        const uv = this.exec.evalExpression(node.args[1], context);
        const level = node.args.length > 2 ? this.exec.evalExpression(node.args[2], context).value : 0;
        if (level > 0) {
            console.error(`TODO: Mip levels. Line ${node.line}`);
            return null;
        }
        // TODO: non-vec2 UVs, for non-2D textures
        if (!(uv instanceof VectorData) || uv.value.length !== 2) {
            console.error(`Invalid UV argument for textureLoad. Line ${node.line}`);
            return null;
        }
        if (textureArg instanceof VariableExpr) {
            const textureName = textureArg.name;
            const texture = context.getVariableValue(textureName);
            if (texture instanceof TypedData) {
                const textureSize = texture.textureSize;
                const x = Math.floor(uv.value[0]);
                const y = Math.floor(uv.value[1]);
                if (x < 0 || x >= textureSize[0] || y < 0 || y >= textureSize[1]) {
                    console.error(`Texture ${textureName} out of bounds. Line ${node.line}`);
                    return null;
                }
                // TODO non RGBA8 textures
                const offset = (y * textureSize[0] + x) * 4;
                const texel = new Uint8Array(texture.buffer, offset, 4);
                // TODO: non-f32 textures
                return new VectorData([texel[0] / 255, texel[1] / 255, texel[2] / 255, texel[3] / 255], this.getTypeInfo("vec4f"));
            }
            else {
                console.error(`Texture ${textureName} not found. Line ${node.line}`);
                return null;
            }
        }
        console.error(`Invalid texture argument for textureLoad. Line ${node.line}`);
        return null;
    }
    TextureNumLayers(node, context) {
        console.error("TODO: textureNumLayers");
        return null;
    }
    TextureNumLevels(node, context) {
        console.error("TODO: textureNumLevels");
        return null;
    }
    TextureNumSamples(node, context) {
        console.error("TODO: textureNumSamples");
        return null;
    }
    TextureSample(node, context) {
        console.error("TODO: textureSample");
        return null;
    }
    TextureSampleBias(node, context) {
        console.error("TODO: textureSampleBias");
        return null;
    }
    TextureSampleCompare(node, context) {
        console.error("TODO: textureSampleCompare");
        return null;
    }
    TextureSampleCompareLevel(node, context) {
        console.error("TODO: textureSampleCompareLevel");
        return null;
    }
    TextureSampleGrad(node, context) {
        console.error("TODO: textureSampleGrad");
        return null;
    }
    TextureSampleLevel(node, context) {
        console.error("TODO: textureSampleLevel");
        return null;
    }
    TextureSampleBaseClampToEdge(node, context) {
        console.error("TODO: textureSampleBaseClampToEdge");
        return null;
    }
    TextureStore(node, context) {
        console.error("TODO: textureStore");
        return null;
    }
    // Atomic Built-in Functions
    AtomicLoad(node, context) {
        let l = node.args[0];
        if (l instanceof UnaryOperator) {
            // TODO: handle & operator
            l = l.right;
        }
        const name = this.exec._getVariableName(l, context);
        const v = context.getVariable(name);
        const currentValue = v.value.getDataValue(this.exec, l.postfix, context);
        return currentValue;
    }
    AtomicStore(node, context) {
        let l = node.args[0];
        if (l instanceof UnaryOperator) {
            // TODO: handle & operator
            l = l.right;
        }
        const name = this.exec._getVariableName(l, context);
        const v = context.getVariable(name);
        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);
        const currentValue = v.value.getDataValue(this.exec, l.postfix, context);
        if (currentValue instanceof ScalarData && value instanceof ScalarData) {
            currentValue.value = value.value;
        }
        if (v.value instanceof TypedData) {
            v.value.setDataValue(this.exec, currentValue, l.postfix, context);
        }
        return null;
    }
    AtomicAdd(node, context) {
        let l = node.args[0];
        if (l instanceof UnaryOperator) {
            // TODO: handle & operator
            l = l.right;
        }
        const name = this.exec._getVariableName(l, context);
        const v = context.getVariable(name);
        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);
        const currentValue = v.value.getDataValue(this.exec, l.postfix, context);
        if (currentValue instanceof ScalarData && value instanceof ScalarData) {
            currentValue.value += value.value;
        }
        if (v.value instanceof TypedData) {
            v.value.setDataValue(this.exec, currentValue, l.postfix, context);
        }
        return null;
    }
    AtomicSub(node, context) {
        let l = node.args[0];
        if (l instanceof UnaryOperator) {
            // TODO: handle & operator
            l = l.right;
        }
        const name = this.exec._getVariableName(l, context);
        const v = context.getVariable(name);
        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);
        const currentValue = v.value.getDataValue(this.exec, l.postfix, context);
        if (currentValue instanceof ScalarData && value instanceof ScalarData) {
            currentValue.value -= value.value;
        }
        if (v.value instanceof TypedData) {
            v.value.setDataValue(this.exec, currentValue, l.postfix, context);
        }
        return null;
    }
    AtomicMax(node, context) {
        let l = node.args[0];
        if (l instanceof UnaryOperator) {
            // TODO: handle & operator
            l = l.right;
        }
        const name = this.exec._getVariableName(l, context);
        const v = context.getVariable(name);
        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);
        const currentValue = v.value.getDataValue(this.exec, l.postfix, context);
        const originalValue = new ScalarData(currentValue.value, currentValue.typeInfo);
        if (currentValue instanceof ScalarData && value instanceof ScalarData) {
            currentValue.value = Math.max(currentValue.value, value.value);
        }
        if (v.value instanceof TypedData) {
            v.value.setDataValue(this.exec, currentValue, l.postfix, context);
        }
        return originalValue;
    }
    AtomicMin(node, context) {
        let l = node.args[0];
        if (l instanceof UnaryOperator) {
            // TODO: handle & operator
            l = l.right;
        }
        const name = this.exec._getVariableName(l, context);
        const v = context.getVariable(name);
        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);
        const currentValue = v.value.getDataValue(this.exec, l.postfix, context);
        const originalValue = new ScalarData(currentValue.value, currentValue.typeInfo);
        if (currentValue instanceof ScalarData && value instanceof ScalarData) {
            currentValue.value = Math.min(currentValue.value, value.value);
        }
        if (v.value instanceof TypedData) {
            v.value.setDataValue(this.exec, currentValue, l.postfix, context);
        }
        return originalValue;
    }
    AtomicAnd(node, context) {
        let l = node.args[0];
        if (l instanceof UnaryOperator) {
            // TODO: handle & operator
            l = l.right;
        }
        const name = this.exec._getVariableName(l, context);
        const v = context.getVariable(name);
        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);
        const currentValue = v.value.getDataValue(this.exec, l.postfix, context);
        const originalValue = new ScalarData(currentValue.value, currentValue.typeInfo);
        if (currentValue instanceof ScalarData && value instanceof ScalarData) {
            currentValue.value = currentValue.value & value.value;
        }
        if (v.value instanceof TypedData) {
            v.value.setDataValue(this.exec, currentValue, l.postfix, context);
        }
        return originalValue;
    }
    AtomicOr(node, context) {
        let l = node.args[0];
        if (l instanceof UnaryOperator) {
            // TODO: handle & operator
            l = l.right;
        }
        const name = this.exec._getVariableName(l, context);
        const v = context.getVariable(name);
        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);
        const currentValue = v.value.getDataValue(this.exec, l.postfix, context);
        const originalValue = new ScalarData(currentValue.value, currentValue.typeInfo);
        if (currentValue instanceof ScalarData && value instanceof ScalarData) {
            currentValue.value = currentValue.value | value.value;
        }
        if (v.value instanceof TypedData) {
            v.value.setDataValue(this.exec, currentValue, l.postfix, context);
        }
        return originalValue;
    }
    AtomicXor(node, context) {
        let l = node.args[0];
        if (l instanceof UnaryOperator) {
            // TODO: handle & operator
            l = l.right;
        }
        const name = this.exec._getVariableName(l, context);
        const v = context.getVariable(name);
        let r = node.args[1];
        const value = this.exec.evalExpression(r, context);
        const currentValue = v.value.getDataValue(this.exec, l.postfix, context);
        const originalValue = new ScalarData(currentValue.value, currentValue.typeInfo);
        if (currentValue instanceof ScalarData && value instanceof ScalarData) {
            currentValue.value = currentValue.value ^ value.value;
        }
        if (v.value instanceof TypedData) {
            v.value.setDataValue(this.exec, currentValue, l.postfix, context);
        }
        return originalValue;
    }
    AtomicExchange(node, context) {
        console.error("TODO: atomicExchange");
        return null;
    }
    AtomicCompareExchangeWeak(node, context) {
        console.error("TODO: atomicCompareExchangeWeak");
        return null;
    }
    // Data Packing Built-in Functions
    Pack4x8snorm(node, context) {
        console.error("TODO: pack4x8snorm");
        return null;
    }
    Pack4x8unorm(node, context) {
        console.error("TODO: pack4x8unorm");
        return null;
    }
    Pack4xI8(node, context) {
        console.error("TODO: pack4xI8");
        return null;
    }
    Pack4xU8(node, context) {
        console.error("TODO: pack4xU8");
        return null;
    }
    Pack4x8Clamp(node, context) {
        console.error("TODO: pack4x8Clamp");
        return null;
    }
    Pack4xU8Clamp(node, context) {
        console.error("TODO: pack4xU8Clamp");
        return null;
    }
    Pack2x16snorm(node, context) {
        console.error("TODO: pack2x16snorm");
        return null;
    }
    Pack2x16unorm(node, context) {
        console.error("TODO: pack2x16unorm");
        return null;
    }
    Pack2x16float(node, context) {
        console.error("TODO: pack2x16float");
        return null;
    }
    // Data Unpacking Built-in Functions
    Unpack4x8snorm(node, context) {
        console.error("TODO: unpack4x8snorm");
        return null;
    }
    Unpack4x8unorm(node, context) {
        console.error("TODO: unpack4x8unorm");
        return null;
    }
    Unpack4xI8(node, context) {
        console.error("TODO: unpack4xI8");
        return null;
    }
    Unpack4xU8(node, context) {
        console.error("TODO: unpack4xU8");
        return null;
    }
    Unpack2x16snorm(node, context) {
        console.error("TODO: unpack2x16snorm");
        return null;
    }
    Unpack2x16unorm(node, context) {
        console.error("TODO: unpack2x16unorm");
        return null;
    }
    Unpack2x16float(node, context) {
        console.error("TODO: unpack2x16float");
        return null;
    }
    // Synchronization Functions
    StorageBarrier(node, context) {
        // Execution is single threaded, barriers not necessary.
        return null;
    }
    TextureBarrier(node, context) {
        // Execution is single threaded, barriers not necessary.
        return null;
    }
    WorkgroupBarrier(node, context) {
        // Execution is single threaded, barriers not necessary.
        return null;
    }
    WorkgroupUniformLoad(node, context) {
        // Execution is single threaded, barriers not necessary.
        return null;
    }
    // Subgroup Functions
    SubgroupAdd(node, context) {
        console.error("TODO: subgroupAdd");
        return null;
    }
    SubgroupExclusiveAdd(node, context) {
        console.error("TODO: subgroupExclusiveAdd");
        return null;
    }
    SubgroupInclusiveAdd(node, context) {
        console.error("TODO: subgroupInclusiveAdd");
        return null;
    }
    SubgroupAll(node, context) {
        console.error("TODO: subgroupAll");
        return null;
    }
    SubgroupAnd(node, context) {
        console.error("TODO: subgroupAnd");
        return null;
    }
    SubgroupAny(node, context) {
        console.error("TODO: subgroupAny");
        return null;
    }
    SubgroupBallot(node, context) {
        console.error("TODO: subgroupBallot");
        return null;
    }
    SubgroupBroadcast(node, context) {
        console.error("TODO: subgroupBroadcast");
        return null;
    }
    SubgroupBroadcastFirst(node, context) {
        console.error("TODO: subgroupBroadcastFirst");
        return null;
    }
    SubgroupElect(node, context) {
        console.error("TODO: subgroupElect");
        return null;
    }
    SubgroupMax(node, context) {
        console.error("TODO: subgroupMax");
        return null;
    }
    SubgroupMin(node, context) {
        console.error("TODO: subgroupMin");
        return null;
    }
    SubgroupMul(node, context) {
        console.error("TODO: subgroupMul");
        return null;
    }
    SubgroupExclusiveMul(node, context) {
        console.error("TODO: subgroupExclusiveMul");
        return null;
    }
    SubgroupInclusiveMul(node, context) {
        console.error("TODO: subgroupInclusiveMul");
        return null;
    }
    SubgroupOr(node, context) {
        console.error("TODO: subgroupOr");
        return null;
    }
    SubgroupShuffle(node, context) {
        console.error("TODO: subgroupShuffle");
        return null;
    }
    SubgroupShuffleDown(node, context) {
        console.error("TODO: subgroupShuffleDown");
        return null;
    }
    SubgroupShuffleUp(node, context) {
        console.error("TODO: subgroupShuffleUp");
        return null;
    }
    SubgroupShuffleXor(node, context) {
        console.error("TODO: subgroupShuffleXor");
        return null;
    }
    SubgroupXor(node, context) {
        console.error("TODO: subgroupXor");
        return null;
    }
    // Quad Functions
    QuadBroadcast(node, context) {
        console.error("TODO: quadBroadcast");
        return null;
    }
    QuadSwapDiagonal(node, context) {
        console.error("TODO: quadSwapDiagonal");
        return null;
    }
    QuadSwapX(node, context) {
        console.error("TODO: quadSwapX");
        return null;
    }
    QuadSwapY(node, context) {
        console.error("TODO: quadSwapY");
        return null;
    }
}

function isArray(value) {
    return Array.isArray(value) || (value === null || value === void 0 ? void 0 : value.buffer) instanceof ArrayBuffer;
}

class WgslExec extends ExecInterface {
    constructor(code, context) {
        var _a;
        super();
        const parser = new WgslParser();
        this.ast = parser.parse(code);
        this.reflection = new WgslReflect();
        this.reflection.updateAST(this.ast);
        this.context = (_a = context === null || context === void 0 ? void 0 : context.clone()) !== null && _a !== void 0 ? _a : new ExecContext();
        this.builtins = new BuiltinFunctions(this);
        this.typeInfo = {
            "bool": this.getTypeInfo(Type.bool),
            "i32": this.getTypeInfo(Type.i32),
            "u32": this.getTypeInfo(Type.u32),
            "f32": this.getTypeInfo(Type.f32),
            "f16": this.getTypeInfo(Type.f16),
            "vec2f": this.getTypeInfo(TemplateType.vec2f),
            "vec2u": this.getTypeInfo(TemplateType.vec2u),
            "vec2i": this.getTypeInfo(TemplateType.vec2i),
            "vec2h": this.getTypeInfo(TemplateType.vec2h),
            "vec3f": this.getTypeInfo(TemplateType.vec3f),
            "vec3u": this.getTypeInfo(TemplateType.vec3u),
            "vec3i": this.getTypeInfo(TemplateType.vec3i),
            "vec3h": this.getTypeInfo(TemplateType.vec3h),
            "vec4f": this.getTypeInfo(TemplateType.vec4f),
            "vec4u": this.getTypeInfo(TemplateType.vec4u),
            "vec4i": this.getTypeInfo(TemplateType.vec4i),
            "vec4h": this.getTypeInfo(TemplateType.vec4h),
            "mat2x2f": this.getTypeInfo(TemplateType.mat2x2f),
            "mat2x3f": this.getTypeInfo(TemplateType.mat2x3f),
            "mat2x4f": this.getTypeInfo(TemplateType.mat2x4f),
            "mat3x2f": this.getTypeInfo(TemplateType.mat3x2f),
            "mat3x3f": this.getTypeInfo(TemplateType.mat3x3f),
            "mat3x4f": this.getTypeInfo(TemplateType.mat3x4f),
            "mat4x2f": this.getTypeInfo(TemplateType.mat4x2f),
            "mat4x3f": this.getTypeInfo(TemplateType.mat4x3f),
            "mat4x4f": this.getTypeInfo(TemplateType.mat4x4f),
        };
    }
    getVariableValue(name) {
        var _a, _b;
        const v = (_b = (_a = this.context.getVariable(name)) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : null;
        if (v === null) {
            return null;
        }
        if (v instanceof ScalarData) {
            return v.value;
        }
        if (v instanceof VectorData) {
            return v.value;
        }
        if (v instanceof MatrixData) {
            return v.value;
        }
        console.error(`Unsupported return variable type ${v.typeInfo.name}`);
        return null;
    }
    execute(config) {
        config = config !== null && config !== void 0 ? config : {};
        if (config["constants"]) {
            this._setOverrides(config["constants"], this.context);
        }
        this._execStatements(this.ast, this.context);
    }
    dispatchWorkgroups(kernel, dispatchCount, bindGroups, config) {
        const context = this.context.clone();
        config = config !== null && config !== void 0 ? config : {};
        if (config["constants"]) {
            this._setOverrides(config["constants"], context);
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
        const width = dispatchCount[0];
        const height = dispatchCount[1];
        const depth = dispatchCount[2];
        const vec3u = this.getTypeInfo("vec3u");
        context.setVariable("@num_workgroups", new VectorData(dispatchCount, vec3u));
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
                                v.value = new TypedData(entry.texture, this.getTypeInfo(node.type), 0, entry.size);
                            }
                            else if (entry.uniform !== undefined) {
                                // Uniform buffer
                                v.value = new TypedData(entry.uniform, this.getTypeInfo(node.type));
                            }
                            else {
                                // Storage buffer
                                v.value = new TypedData(entry, this.getTypeInfo(node.type));
                            }
                        }
                    }
                });
            }
        }
        for (let z = 0; z < depth; ++z) {
            for (let y = 0; y < height; ++y) {
                for (let x = 0; x < width; ++x) {
                    context.setVariable("@workgroup_id", new VectorData([x, y, z], this.getTypeInfo("vec3u")));
                    this._dispatchWorkgroup(f, [x, y, z], context);
                }
            }
        }
    }
    execStatement(stmt, context) {
        if (stmt instanceof Return) {
            return this.evalExpression(stmt.value, context);
        }
        else if (stmt instanceof Break) {
            return null;
        }
        else if (stmt instanceof Continue) {
            return null;
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
            this._assign(stmt, context);
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
            }
        }
        else if (stmt instanceof Call) {
            this._call(stmt, context);
        }
        else {
            console.error(`Invalid statement type.`, stmt, `Line ${stmt.line}`);
        }
        return null;
    }
    evalExpression(node, context) {
        while (node instanceof GroupingExpr) {
            node = node.contents[0];
        }
        if (node instanceof BinaryOperator) {
            return this._evalBinaryOp(node, context);
        }
        else if (node instanceof LiteralExpr) {
            return this._evalLiteral(node, context);
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
        console.error(`Invalid expression type`, node, `Line ${node.line}`);
        return null;
    }
    getTypeInfo(type) {
        var _a;
        if (type instanceof Type) {
            const t = this.reflection.getTypeInfo(type);
            if (t !== null) {
                return t;
            }
        }
        const t = (_a = this.typeInfo[type]) !== null && _a !== void 0 ? _a : null;
        if (t !== null) {
            return t;
        }
        return null;
    }
    getTypeName(type) {
        /*if (type instanceof AST.Type) {
            type = this.getTypeInfo(type);
        }*/
        if (type === null) {
            console.error(`Type is null.`);
            return "unknown";
        }
        let name = type.name;
        if (type instanceof TemplateInfo || type instanceof TemplateType) {
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
                if (name === "vec2" || name === "vec3" || name === "vec4") {
                    return name;
                }
                console.error("Template format is null.");
            }
        }
        return name;
    }
    _setOverrides(constants, context) {
        for (const k in constants) {
            const v = constants[k];
            const override = this.reflection.getOverrideInfo(k);
            if (override !== null) {
                if (override.type.name === "u32" || override.type.name === "i32" || override.type.name === "f32" || override.type.name === "f16") {
                    context.setVariable(k, new ScalarData(v, override.type));
                }
                else if (override.type.name === "bool") {
                    context.setVariable(k, new ScalarData(v ? 1 : 0, override.type));
                }
                else if (override.type.name === "vec2" || override.type.name === "vec3" || override.type.name === "vec4" ||
                    override.type.name === "vec2f" || override.type.name === "vec3f" || override.type.name === "vec4f" ||
                    override.type.name === "vec2i" || override.type.name === "vec3i" || override.type.name === "vec4i" ||
                    override.type.name === "vec2u" || override.type.name === "vec3u" || override.type.name === "vec4u") {
                    context.setVariable(k, new VectorData(v, override.type));
                }
                else {
                    console.error(`Invalid constant type for ${k}`);
                }
            }
            else {
                console.error(`Override ${k} does not exist in the shader.`);
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
                    if (v instanceof ScalarData) {
                        workgroupSize[0] = v.value;
                    }
                    else {
                        workgroupSize[0] = parseInt(attr.value[0]);
                    }
                }
                if (attr.value.length > 1) {
                    const v = context.getVariableValue(attr.value[1]);
                    if (v instanceof ScalarData) {
                        workgroupSize[1] = v.value;
                    }
                    else {
                        workgroupSize[1] = parseInt(attr.value[1]);
                    }
                }
                if (attr.value.length > 2) {
                    const v = context.getVariableValue(attr.value[2]);
                    if (v instanceof ScalarData) {
                        workgroupSize[2] = v.value;
                    }
                    else {
                        workgroupSize[2] = parseInt(attr.value[2]);
                    }
                }
            }
        }
        const vec3u = this.getTypeInfo("vec3u");
        const u32 = this.getTypeInfo("u32");
        context.setVariable("@workgroup_size", new VectorData(workgroupSize, vec3u));
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
                    context.setVariable("@local_invocation_id", new VectorData(local_invocation_id, vec3u));
                    context.setVariable("@global_invocation_id", new VectorData(global_invocation_id, vec3u));
                    context.setVariable("@local_invocation_index", new ScalarData(li, u32));
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
            const res = this.execStatement(stmt, context);
            if (res) {
                return res;
            }
        }
        return null;
    }
    _call(node, context) {
        const subContext = context.clone();
        subContext.currentFunctionName = node.name;
        const f = context.functions.get(node.name);
        if (!f) {
            this._callBuiltinFunction(node, subContext);
            return;
        }
        for (let ai = 0; ai < f.node.args.length; ++ai) {
            const arg = f.node.args[ai];
            const value = this.evalExpression(node.args[ai], subContext);
            subContext.setVariable(arg.name, value, arg);
        }
        this._execStatements(f.node.body, subContext);
    }
    _increment(node, context) {
        const name = this._getVariableName(node.variable, context);
        const v = context.getVariable(name);
        if (!v) {
            console.error(`Variable ${name} not found. Line ${node.line}`);
            return;
        }
        if (node.operator === "++") {
            if (v.value instanceof ScalarData) {
                v.value.value++;
            }
            else {
                console.error(`Variable ${name} is not a scalar. Line ${node.line}`);
            }
        }
        else if (node.operator === "--") {
            if (v.value instanceof ScalarData) {
                v.value.value--;
            }
            else {
                console.error(`Variable ${name} is not a scalar. Line ${node.line}`);
            }
        }
        else {
            console.error(`Unknown increment operator ${node.operator}. Line ${node.line}`);
        }
    }
    _assign(node, context) {
        const name = this._getVariableName(node.variable, context);
        const v = context.getVariable(name);
        if (v === null) {
            console.error(`Variable ${name} not found. Line ${node.line}`);
            return;
        }
        const value = this.evalExpression(node.value, context);
        const op = node.operator;
        if (op !== "=") {
            const currentValue = v.value.getDataValue(this, node.variable.postfix, context);
            if (currentValue instanceof VectorData && value instanceof ScalarData) {
                const cv = currentValue.value;
                const v = value.value;
                if (op === "+=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] += v;
                    }
                }
                else if (op === "-=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] -= v;
                    }
                }
                else if (op === "*=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] *= v;
                    }
                }
                else if (op === "/=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] /= v;
                    }
                }
                else if (op === "%=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] %= v;
                    }
                }
                else if (op === "&=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] &= v;
                    }
                }
                else if (op === "|=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] |= v;
                    }
                }
                else if (op === "^=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] ^= v;
                    }
                }
                else if (op === "<<=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] <<= v;
                    }
                }
                else if (op === ">>=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] >>= v;
                    }
                }
                else {
                    console.error(`Invalid operator ${op}. Line ${node.line}`);
                }
            }
            else if (currentValue instanceof VectorData && value instanceof VectorData) {
                const cv = currentValue.value;
                const v = value.value;
                if (cv.length !== v.length) {
                    console.error(`Vector length mismatch. Line ${node.line}`);
                    return;
                }
                if (op === "+=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] += v[i];
                    }
                }
                else if (op === "-=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] -= v[i];
                    }
                }
                else if (op === "*=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] *= v[i];
                    }
                }
                else if (op === "/=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] /= v[i];
                    }
                }
                else if (op === "%=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] %= v[i];
                    }
                }
                else if (op === "&=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] &= v[i];
                    }
                }
                else if (op === "|=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] |= v[i];
                    }
                }
                else if (op === "^=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] ^= v[i];
                    }
                }
                else if (op === "<<=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] <<= v[i];
                    }
                }
                else if (op === ">>=") {
                    for (let i = 0; i < cv.length; ++i) {
                        cv[i] >>= v[i];
                    }
                }
                else {
                    console.error(`Invalid operator ${op}. Line ${node.line}`);
                }
            }
            else if (currentValue instanceof ScalarData && value instanceof ScalarData) {
                if (op === "+=") {
                    currentValue.value += value.value;
                }
                else if (op === "-=") {
                    currentValue.value -= value.value;
                }
                else if (op === "*=") {
                    currentValue.value *= value.value;
                }
                else if (op === "/=") {
                    currentValue.value /= value.value;
                }
                else if (op === "%=") {
                    currentValue.value %= value.value;
                }
                else if (op === "&=") {
                    currentValue.value &= value.value;
                }
                else if (op === "|=") {
                    currentValue.value |= value.value;
                }
                else if (op === "^=") {
                    currentValue.value ^= value.value;
                }
                else if (op === "<<=") {
                    currentValue.value <<= value.value;
                }
                else if (op === ">>=") {
                    currentValue.value >>= value.value;
                }
                else {
                    console.error(`Invalid operator ${op}. Line ${node.line}`);
                }
            }
            else {
                console.error(`Invalid type for ${node.operator} operator. Line ${node.line}`);
                return;
            }
            // If the variable is a TypedData, as in a struct or array, and we're assigning a
            // sub portion of it, set the data in the original buffer.
            if (v.value instanceof TypedData) {
                v.value.setDataValue(this, currentValue, node.variable.postfix, context);
            }
            return;
        }
        if (v.value instanceof TypedData) {
            v.value.setDataValue(this, value, node.variable.postfix, context);
        }
        else if (node.variable.postfix) {
            if (node.variable.postfix instanceof ArrayIndex) {
                this.evalExpression(node.variable.postfix.index, context).value;
                // TODO: use array format to determine how to set the value
                /*if (v.value instanceof VectorData || v.value instanceof MatrixData) {
                    if (v.node.type.isArray) {
                        const arrayType = v.node.type as AST.ArrayType;
                        if (arrayType.format.name === "vec3" ||
                            arrayType.format.name === "vec3u" ||
                            arrayType.format.name === "vec3i" ||
                            arrayType.format.name === "vec3f") {
                            v.value[idx * 3 + 0] = value[0];
                            v.value[idx * 3 + 1] = value[1];
                            v.value[idx * 3 + 2] = value[2];
                        } else if (arrayType.format.name === "vec4" ||
                            arrayType.format.name === "vec4u" ||
                            arrayType.format.name === "vec4i" ||
                            arrayType.format.name === "vec4f") {
                            v.value[idx * 4 + 0] = value[0];
                            v.value[idx * 4 + 1] = value[1];
                            v.value[idx * 4 + 2] = value[2];
                            v.value[idx * 4 + 3] = value[3];
                        } else {
                            v.value[idx] = value;
                        }
                    } else {
                        v.value[idx] = value;
                    }
                } else {
                    console.error(`Variable ${v.name} is not an array. Line ${node.line}`);
                }*/
                console.error(`TODO Array index. Line ${node.line}`);
            }
            else if (node.variable.postfix instanceof StringExpr) {
                console.error(`TODO Struct member. Line ${node.line}`);
            }
        }
        else {
            v.value = value;
        }
        return;
    }
    _function(node, context) {
        const f = new Function(node);
        context.functions.set(node.name, f);
    }
    _const(node, context) {
        let value = null;
        if (node.value != null) {
            value = this.evalExpression(node.value, context);
        }
        context.createVariable(node.name, value, node);
    }
    _let(node, context) {
        let value = null;
        if (node.value != null) {
            value = this.evalExpression(node.value, context);
        }
        context.createVariable(node.name, value, node);
    }
    _var(node, context) {
        let value = null;
        if (node.value != null) {
            value = this.evalExpression(node.value, context);
        }
        context.createVariable(node.name, value, node);
    }
    _if(node, context) {
        context = context.clone();
        const condition = this.evalExpression(node.condition, context);
        if (!(condition instanceof ScalarData)) {
            console.error(`Invalid if condition. Line ${node.line}`);
            return null;
        }
        if (condition.value) {
            return this._execStatements(node.body, context);
        }
        for (const e of node.elseif) {
            const condition = this.evalExpression(e.condition, context);
            if (!(condition instanceof ScalarData)) {
                console.error(`Invalid if condition. Line ${node.line}`);
                return null;
            }
            if (condition.value) {
                return this._execStatements(e.body, context);
            }
        }
        if (node.else) {
            return this._execStatements(node.else, context);
        }
        return null;
    }
    _getScalarValue(v) {
        if (v instanceof ScalarData) {
            return v.value;
        }
        console.error(`Expected scalar value.`, v);
        return 0;
    }
    _for(node, context) {
        context = context.clone();
        this.execStatement(node.init, context);
        while (this._getScalarValue(this.evalExpression(node.condition, context))) {
            const res = this._execStatements(node.body, context);
            if (res !== null) {
                return res;
            }
            this.execStatement(node.increment, context);
        }
        return null;
    }
    _while(node, context) {
        context = context.clone();
        while (this._getScalarValue(this.evalExpression(node.condition, context))) {
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
        }
        return null;
    }
    _evalConst(node, context) {
        return context.getVariableValue(node.name);
    }
    _evalCreate(node, context) {
        if (node.type === null) {
            return VoidData.void;
        }
        const typeName = this.getTypeName(node.type);
        switch (typeName) {
            // Constructor Built-in Functions
            // Value Constructor Built-in Functions
            case "bool":
            case "i32":
            case "u32":
            case "f32":
            case "f16":
                return this._callConstructorValue(node, context);
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
            //case "array":
            //return this._callConstructorArray(node, context);
        }
        const typeInfo = this.getTypeInfo(node.type);
        if (typeInfo === null) {
            console.error(`Unknown type ${typeName}. Line ${node.line}`);
            return null;
        }
        const data = new TypedData(new ArrayBuffer(typeInfo.size), typeInfo, 0);
        // Assign the values in node.args to the data.
        if (typeInfo instanceof StructInfo) {
            for (let i = 0; i < node.args.length; ++i) {
                const memberInfo = typeInfo.members[i];
                const arg = node.args[i];
                const value = this.evalExpression(arg, context);
                data.setData(this, value, memberInfo.type, memberInfo.offset, context);
            }
        }
        else if (typeInfo instanceof ArrayInfo) {
            let offset = 0;
            for (let i = 0; i < node.args.length; ++i) {
                const arg = node.args[i];
                const value = this.evalExpression(arg, context);
                data.setData(this, value, typeInfo.format, offset, context);
                offset += typeInfo.stride;
            }
        }
        else {
            console.error(`Unknown type "${typeName}". Line ${node.line}`);
        }
        return data;
    }
    _evalLiteral(node, context) {
        const typeInfo = this.getTypeInfo(node.type);
        const typeName = typeInfo.name;
        if (typeName === "x32" || typeName === "u32" || typeName === "f32" || typeName === "f16" ||
            typeName === "i32") {
            const data = new ScalarData(node.scalarValue, typeInfo);
            return data;
        }
        if (typeName === "vec2" || typeName === "vec3" || typeName === "vec4" ||
            typeName === "vec2f" || typeName === "vec3f" || typeName === "vec4f" ||
            typeName === "vec2h" || typeName === "vec3h" || typeName === "vec4h" ||
            typeName === "vec2i" || typeName === "vec3i" || typeName === "vec4i" ||
            typeName === "vec2u" || typeName === "vec3u" || typeName === "vec4u") {
            const data = new VectorData(node.vectorValue, typeInfo);
            return data;
        }
        if (typeName === "mat2x2" || typeName === "mat2x3" || typeName === "mat2x4" ||
            typeName === "mat3x2" || typeName === "mat3x3" || typeName === "mat3x4" ||
            typeName === "mat4x2" || typeName === "mat4x3" || typeName === "mat4x4" ||
            typeName === "mat2x2f" || typeName === "mat2x3f" || typeName === "mat2x4f" ||
            typeName === "mat3x2f" || typeName === "mat3x3f" || typeName === "mat3x4f" ||
            typeName === "mat4x2f" || typeName === "mat4x3f" || typeName === "mat4x4f" ||
            typeName === "mat2x2h" || typeName === "mat2x3h" || typeName === "mat2x4h" ||
            typeName === "mat3x2h" || typeName === "mat3x3h" || typeName === "mat3x4h" ||
            typeName === "mat4x2h" || typeName === "mat4x3h" || typeName === "mat4x4h") {
            const data = new MatrixData(node.vectorValue, typeInfo);
            return data;
        }
        console.error(`Unknown literal type`, typeName, `Line ${node.line}`);
        return null;
    }
    _evalVariable(node, context) {
        const value = context.getVariableValue(node.name);
        if (node === null || node === void 0 ? void 0 : node.postfix) {
            return value.getDataValue(this, node.postfix, context);
        }
        return value;
    }
    _maxFormatTypeInfo(x) {
        let t = x[0];
        if (t.name === "f32") {
            return t;
        }
        for (let i = 1; i < x.length; ++i) {
            const tv = WgslExec._priority.get(t.name);
            const xv = WgslExec._priority.get(x[i].name);
            if (xv < tv) {
                t = x[i];
            }
        }
        if (t.name === "x32") {
            return this.getTypeInfo("i32");
        }
        return t;
    }
    _evalBinaryOp(node, context) {
        const _l = this.evalExpression(node.left, context);
        const _r = this.evalExpression(node.right, context);
        const l = _l instanceof ScalarData ? _l.value :
            _l instanceof VectorData ? _l.value : null;
        const r = _r instanceof ScalarData ? _r.value :
            _r instanceof VectorData ? _r.value : null;
        switch (node.operator) {
            case "+": {
                if (isArray(l) && isArray(r)) {
                    const la = l;
                    const ra = r;
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x, i) => x + ra[i]);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(l)) {
                    const la = l;
                    const rn = r;
                    const result = la.map((x, i) => x + rn);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(r)) {
                    const ln = l;
                    const ra = r;
                    const result = ra.map((x, i) => ln + x);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l;
                const rn = r;
                const t = this._maxFormatTypeInfo([_l.typeInfo, _r.typeInfo]);
                return new ScalarData(ln + rn, t);
            }
            case "-": {
                if (isArray(l) && isArray(r)) {
                    const la = l;
                    const ra = r;
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x, i) => x - ra[i]);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(l)) {
                    const la = l;
                    const rn = r;
                    const result = la.map((x, i) => x - rn);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(r)) {
                    const ln = l;
                    const ra = r;
                    const result = ra.map((x, i) => ln - x);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l;
                const rn = r;
                const t = this._maxFormatTypeInfo([_l.typeInfo, _r.typeInfo]);
                return new ScalarData(ln - rn, t);
            }
            case "*": {
                if (isArray(l) && isArray(r)) {
                    const la = l;
                    const ra = r;
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x, i) => x * ra[i]);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(l)) {
                    const la = l;
                    const rn = r;
                    const result = la.map((x, i) => x * rn);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(r)) {
                    const ln = l;
                    const ra = r;
                    const result = ra.map((x, i) => ln * x);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l;
                const rn = r;
                const t = this._maxFormatTypeInfo([_l.typeInfo, _r.typeInfo]);
                return new ScalarData(ln * rn, t);
            }
            case "%": {
                if (isArray(l) && isArray(r)) {
                    const la = l;
                    const ra = r;
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x, i) => x % ra[i]);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(l)) {
                    const la = l;
                    const rn = r;
                    const result = la.map((x, i) => x % rn);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(r)) {
                    const ln = l;
                    const ra = r;
                    const result = ra.map((x, i) => ln % x);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l;
                const rn = r;
                const t = this._maxFormatTypeInfo([_l.typeInfo, _r.typeInfo]);
                return new ScalarData(ln % rn, t);
            }
            case "/": {
                if (isArray(l) && isArray(r)) {
                    const la = l;
                    const ra = r;
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x, i) => x / ra[i]);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(l)) {
                    const la = l;
                    const rn = r;
                    const result = la.map((x, i) => x / rn);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(r)) {
                    const ln = l;
                    const ra = r;
                    const result = ra.map((x, i) => ln / x);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l;
                const rn = r;
                const t = this._maxFormatTypeInfo([_l.typeInfo, _r.typeInfo]);
                return new ScalarData(ln / rn, t);
            }
            case ">": {
                if (isArray(l) && isArray(r)) {
                    const la = l;
                    const ra = r;
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x, i) => x > ra[i] ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(l)) {
                    const la = l;
                    const rn = r;
                    const result = la.map((x, i) => x > rn ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(r)) {
                    const ln = l;
                    const ra = r;
                    const result = ra.map((x, i) => ln > x ? 1 : 0);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l;
                const rn = r;
                return new ScalarData(ln > rn ? 1 : 0, this.getTypeInfo("bool"));
            }
            case "<":
                if (isArray(l) && isArray(r)) {
                    const la = l;
                    const ra = r;
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x, i) => x < ra[i] ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(l)) {
                    const la = l;
                    const rn = r;
                    const result = la.map((x, i) => x < rn ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(r)) {
                    const ln = l;
                    const ra = r;
                    const result = ra.map((x, i) => ln < x ? 1 : 0);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l;
                const rn = r;
                return new ScalarData(ln < rn ? 1 : 0, this.getTypeInfo("bool"));
            case "==": {
                if (isArray(l) && isArray(r)) {
                    const la = l;
                    const ra = r;
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x, i) => x === ra[i] ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(l)) {
                    const la = l;
                    const rn = r;
                    const result = la.map((x, i) => x == rn ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(r)) {
                    const ln = l;
                    const ra = r;
                    const result = ra.map((x, i) => ln == x ? 1 : 0);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l;
                const rn = r;
                return new ScalarData(ln === rn ? 1 : 0, this.getTypeInfo("bool"));
            }
            case "!=": {
                if (isArray(l) && isArray(r)) {
                    const la = l;
                    const ra = r;
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x, i) => x !== ra[i] ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(l)) {
                    const la = l;
                    const rn = r;
                    const result = la.map((x, i) => x !== rn ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(r)) {
                    const ln = l;
                    const ra = r;
                    const result = ra.map((x, i) => ln !== x ? 1 : 0);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l;
                const rn = r;
                return new ScalarData(ln !== rn ? 1 : 0, this.getTypeInfo("bool"));
            }
            case ">=": {
                if (isArray(l) && isArray(r)) {
                    const la = l;
                    const ra = r;
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x, i) => x >= ra[i] ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(l)) {
                    const la = l;
                    const rn = r;
                    const result = la.map((x, i) => x >= rn ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(r)) {
                    const ln = l;
                    const ra = r;
                    const result = ra.map((x, i) => ln >= x ? 1 : 0);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l;
                const rn = r;
                return new ScalarData(ln >= rn ? 1 : 0, this.getTypeInfo("bool"));
            }
            case "<=": {
                if (isArray(l) && isArray(r)) {
                    const la = l;
                    const ra = r;
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x, i) => x <= ra[i] ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(l)) {
                    const la = l;
                    const rn = r;
                    const result = la.map((x, i) => x <= rn ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(r)) {
                    const ln = l;
                    const ra = r;
                    const result = ra.map((x, i) => ln <= x ? 1 : 0);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l;
                const rn = r;
                return new ScalarData(ln <= rn ? 1 : 0, this.getTypeInfo("bool"));
            }
            case "&&": {
                if (isArray(l) && isArray(r)) {
                    const la = l;
                    const ra = r;
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x, i) => x && ra[i] ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(l)) {
                    const la = l;
                    const rn = r;
                    const result = la.map((x, i) => x && rn ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(r)) {
                    const ln = l;
                    const ra = r;
                    const result = ra.map((x, i) => ln && x ? 1 : 0);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l;
                const rn = r;
                return new ScalarData(ln && rn ? 1 : 0, this.getTypeInfo("bool"));
            }
            case "||": {
                if (isArray(l) && isArray(r)) {
                    const la = l;
                    const ra = r;
                    if (la.length !== ra.length) {
                        console.error(`Vector length mismatch. Line ${node.line}.`);
                        return null;
                    }
                    const result = la.map((x, i) => x || ra[i] ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(l)) {
                    const la = l;
                    const rn = r;
                    const result = la.map((x, i) => x || rn ? 1 : 0);
                    return new VectorData(result, _l.typeInfo);
                }
                else if (isArray(r)) {
                    const ln = l;
                    const ra = r;
                    const result = ra.map((x, i) => ln || x ? 1 : 0);
                    return new VectorData(result, _r.typeInfo);
                }
                const ln = l;
                const rn = r;
                return new ScalarData(ln || rn ? 1 : 0, this.getTypeInfo("bool"));
            }
        }
        console.error(`Unknown operator ${node.operator}. Line ${node.line}`);
        return null;
    }
    _evalCall(node, context) {
        if (node.cachedReturnValue !== null) {
            return node.cachedReturnValue;
        }
        const subContext = context.clone();
        subContext.currentFunctionName = node.name;
        const f = context.functions.get(node.name);
        if (!f) {
            return this._callBuiltinFunction(node, subContext);
        }
        for (let ai = 0; ai < f.node.args.length; ++ai) {
            const arg = f.node.args[ai];
            const value = this.evalExpression(node.args[ai], subContext);
            subContext.setVariable(arg.name, value, arg);
        }
        return this._execStatements(f.node.body, subContext);
    }
    _callBuiltinFunction(node, context) {
        switch (node.name) {
            // Logical Built-in Functions
            case "all":
                return this.builtins.All(node, context);
            case "any":
                return this.builtins.Any(node, context);
            case "select":
                return this.builtins.Select(node, context);
            // Array Built-in Functions
            case "arrayLength":
                return this.builtins.ArrayLength(node, context);
            // Numeric Built-in Functions
            case "abs":
                return this.builtins.Abs(node, context);
            case "acos":
                return this.builtins.Acos(node, context);
            case "acosh":
                return this.builtins.Acosh(node, context);
            case "asin":
                return this.builtins.Asin(node, context);
            case "asinh":
                return this.builtins.Asinh(node, context);
            case "atan":
                return this.builtins.Atan(node, context);
            case "atanh":
                return this.builtins.Atanh(node, context);
            case "atan2":
                return this.builtins.Atan2(node, context);
            case "ceil":
                return this.builtins.Ceil(node, context);
            case "clamp":
                return this.builtins.Clamp(node, context);
            case "cos":
                return this.builtins.Cos(node, context);
            case "cosh":
                return this.builtins.Cosh(node, context);
            case "countLeadingZeros":
                return this.builtins.CountLeadingZeros(node, context);
            case "countOneBits":
                return this.builtins.CountOneBits(node, context);
            case "countTrailingZeros":
                return this.builtins.CountTrailingZeros(node, context);
            case "cross":
                return this.builtins.Cross(node, context);
            case "degrees":
                return this.builtins.Degrees(node, context);
            case "determinant":
                return this.builtins.Determinant(node, context);
            case "distance":
                return this.builtins.Distance(node, context);
            case "dot":
                return this.builtins.Dot(node, context);
            case "dot4U8Packed":
                return this.builtins.Dot4U8Packed(node, context);
            case "dot4I8Packed":
                return this.builtins.Dot4I8Packed(node, context);
            case "exp":
                return this.builtins.Exp(node, context);
            case "exp2":
                return this.builtins.Exp2(node, context);
            case "extractBits":
                return this.builtins.ExtractBits(node, context);
            case "faceForward":
                return this.builtins.FaceForward(node, context);
            case "firstLeadingBit":
                return this.builtins.FirstLeadingBit(node, context);
            case "firstTrailingBit":
                return this.builtins.FirstTrailingBit(node, context);
            case "floor":
                return this.builtins.Floor(node, context);
            case "fma":
                return this.builtins.Fma(node, context);
            case "fract":
                return this.builtins.Fract(node, context);
            case "frexp":
                return this.builtins.Frexp(node, context);
            case "insertBits":
                return this.builtins.InsertBits(node, context);
            case "inverseSqrt":
                return this.builtins.InverseSqrt(node, context);
            case "ldexp":
                return this.builtins.Ldexp(node, context);
            case "length":
                return this.builtins.Length(node, context);
            case "log":
                return this.builtins.Log(node, context);
            case "log2":
                return this.builtins.Log2(node, context);
            case "max":
                return this.builtins.Max(node, context);
            case "min":
                return this.builtins.Min(node, context);
            case "mix":
                return this.builtins.Mix(node, context);
            case "modf":
                return this.builtins.Modf(node, context);
            case "normalize":
                return this.builtins.Normalize(node, context);
            case "pow":
                return this.builtins.Pow(node, context);
            case "quantizeToF16":
                return this.builtins.QuantizeToF16(node, context);
            case "radians":
                return this.builtins.Radians(node, context);
            case "reflect":
                return this.builtins.Reflect(node, context);
            case "refract":
                return this.builtins.Refract(node, context);
            case "reverseBits":
                return this.builtins.ReverseBits(node, context);
            case "round":
                return this.builtins.Round(node, context);
            case "saturate":
                return this.builtins.Saturate(node, context);
            case "sign":
                return this.builtins.Sign(node, context);
            case "sin":
                return this.builtins.Sin(node, context);
            case "sinh":
                return this.builtins.Sinh(node, context);
            case "smoothStep":
                return this.builtins.SmoothStep(node, context);
            case "sqrt":
                return this.builtins.Sqrt(node, context);
            case "step":
                return this.builtins.Step(node, context);
            case "tan":
                return this.builtins.Tan(node, context);
            case "tanh":
                return this.builtins.Tanh(node, context);
            case "transpose":
                return this.builtins.Transpose(node, context);
            case "trunc":
                return this.builtins.Trunc(node, context);
            // Derivative Built-in Functions
            case "dpdx":
                return this.builtins.Dpdx(node, context);
            case "dpdxCoarse":
                return this.builtins.DpdxCoarse(node, context);
            case "dpdxFine":
                return this.builtins.DpdxFine(node, context);
            case "dpdy":
                return this.builtins.Dpdy(node, context);
            case "dpdyCoarse":
                return this.builtins.DpdyCoarse(node, context);
            case "dpdyFine":
                return this.builtins.DpdyFine(node, context);
            case "fwidth":
                return this.builtins.Fwidth(node, context);
            case "fwidthCoarse":
                return this.builtins.FwidthCoarse(node, context);
            case "fwidthFine":
                return this.builtins.FwidthFine(node, context);
            // Texture Built-in Functions
            case "textureDimensions":
                return this.builtins.TextureDimensions(node, context);
            case "textureGather":
                return this.builtins.TextureGather(node, context);
            case "textureGatherCompare":
                return this.builtins.TextureGatherCompare(node, context);
            case "textureLoad":
                return this.builtins.TextureLoad(node, context);
            case "textureNumLayers":
                return this.builtins.TextureNumLayers(node, context);
            case "textureNumLevels":
                return this.builtins.TextureNumLevels(node, context);
            case "textureNumSamples":
                return this.builtins.TextureNumSamples(node, context);
            case "textureSample":
                return this.builtins.TextureSample(node, context);
            case "textureSampleBias":
                return this.builtins.TextureSampleBias(node, context);
            case "textureSampleCompare":
                return this.builtins.TextureSampleCompare(node, context);
            case "textureSampleCompareLevel":
                return this.builtins.TextureSampleCompareLevel(node, context);
            case "textureSampleGrad":
                return this.builtins.TextureSampleGrad(node, context);
            case "textureSampleLevel":
                return this.builtins.TextureSampleLevel(node, context);
            case "textureSampleBaseClampToEdge":
                return this.builtins.TextureSampleBaseClampToEdge(node, context);
            case "textureStore":
                return this.builtins.TextureStore(node, context);
            // Atomic Built-in Functions
            case "atomicLoad":
                return this.builtins.AtomicLoad(node, context);
            case "atomicStore":
                return this.builtins.AtomicStore(node, context);
            case "atomicAdd":
                return this.builtins.AtomicAdd(node, context);
            case "atomicSub":
                return this.builtins.AtomicSub(node, context);
            case "atomicMax":
                return this.builtins.AtomicMax(node, context);
            case "atomicMin":
                return this.builtins.AtomicMin(node, context);
            case "atomicAnd":
                return this.builtins.AtomicAnd(node, context);
            case "atomicOr":
                return this.builtins.AtomicOr(node, context);
            case "atomicXor":
                return this.builtins.AtomicXor(node, context);
            case "atomicExchange":
                return this.builtins.AtomicExchange(node, context);
            case "atomicCompareExchangeWeak":
                return this.builtins.AtomicCompareExchangeWeak(node, context);
            // Data Packing Built-in Functions
            case "pack4x8snorm":
                return this.builtins.Pack4x8snorm(node, context);
            case "pack4x8unorm":
                return this.builtins.Pack4x8unorm(node, context);
            case "pack4xI8":
                return this.builtins.Pack4xI8(node, context);
            case "pack4xU8":
                return this.builtins.Pack4xU8(node, context);
            case "pack4x8Clamp":
                return this.builtins.Pack4x8Clamp(node, context);
            case "pack4xU8Clamp":
                return this.builtins.Pack4xU8Clamp(node, context);
            case "pack2x16snorm":
                return this.builtins.Pack2x16snorm(node, context);
            case "pack2x16unorm":
                return this.builtins.Pack2x16unorm(node, context);
            case "pack2x16float":
                return this.builtins.Pack2x16float(node, context);
            // Data Unpacking Built-in Functions
            case "unpack4x8snorm":
                return this.builtins.Unpack4x8snorm(node, context);
            case "unpack4x8unorm":
                return this.builtins.Unpack4x8unorm(node, context);
            case "unpack4xI8":
                return this.builtins.Unpack4xI8(node, context);
            case "unpack4xU8":
                return this.builtins.Unpack4xU8(node, context);
            case "unpack2x16snorm":
                return this.builtins.Unpack2x16snorm(node, context);
            case "unpack2x16unorm":
                return this.builtins.Unpack2x16unorm(node, context);
            case "unpack2x16float":
                return this.builtins.Unpack2x16float(node, context);
            // Synchronization Built-in Functions
            case "storageBarrier":
                return this.builtins.StorageBarrier(node, context);
            case "textureBarrier":
                return this.builtins.TextureBarrier(node, context);
            case "workgroupBarrier":
                return this.builtins.WorkgroupBarrier(node, context);
            case "workgroupUniformLoad":
                return this.builtins.WorkgroupUniformLoad(node, context);
            // Subgroup Built-in Functions
            case "subgroupAdd":
                return this.builtins.SubgroupAdd(node, context);
            case "subgroupExclusiveAdd":
                return this.builtins.SubgroupExclusiveAdd(node, context);
            case "subgroupInclusiveAdd":
                return this.builtins.SubgroupInclusiveAdd(node, context);
            case "subgroupAll":
                return this.builtins.SubgroupAll(node, context);
            case "subgroupAnd":
                return this.builtins.SubgroupAnd(node, context);
            case "subgroupAny":
                return this.builtins.SubgroupAny(node, context);
            case "subgroupBallot":
                return this.builtins.SubgroupBallot(node, context);
            case "subgroupBroadcast":
                return this.builtins.SubgroupBroadcast(node, context);
            case "subgroupBroadcastFirst":
                return this.builtins.SubgroupBroadcastFirst(node, context);
            case "subgroupElect":
                return this.builtins.SubgroupElect(node, context);
            case "subgroupMax":
                return this.builtins.SubgroupMax(node, context);
            case "subgroupMin":
                return this.builtins.SubgroupMin(node, context);
            case "subgroupMul":
                return this.builtins.SubgroupMul(node, context);
            case "subgroupExclusiveMul":
                return this.builtins.SubgroupExclusiveMul(node, context);
            case "subgroupInclusiveMul":
                return this.builtins.SubgroupInclusiveMul(node, context);
            case "subgroupOr":
                return this.builtins.SubgroupOr(node, context);
            case "subgroupShuffle":
                return this.builtins.SubgroupShuffle(node, context);
            case "subgroupShuffleDown":
                return this.builtins.SubgroupShuffleDown(node, context);
            case "subgroupShuffleUp":
                return this.builtins.SubgroupShuffleUp(node, context);
            case "subgroupShuffleXor":
                return this.builtins.SubgroupShuffleXor(node, context);
            case "subgroupXor":
                return this.builtins.SubgroupXor(node, context);
            // Quad Operations
            case "quadBroadcast":
                return this.builtins.QuadBroadcast(node, context);
            case "quadSwapDiagonal":
                return this.builtins.QuadSwapDiagonal(node, context);
            case "quadSwapX":
                return this.builtins.QuadSwapX(node, context);
            case "quadSwapY":
                return this.builtins.QuadSwapY(node, context);
        }
        const f = context.getFunction(node.name);
        if (f) {
            const subContext = context.clone();
            for (let ai = 0; ai < f.node.args.length; ++ai) {
                const arg = f.node.args[ai];
                const value = this.evalExpression(node.args[ai], subContext);
                subContext.setVariable(arg.name, value, arg);
            }
            return this._execStatements(f.node.body, subContext);
        }
        console.error(`Function ${node.name} not found. Line ${node.line}`);
        return null;
    }
    _callConstructorValue(node, context) {
        if (node.args.length === 0) {
            return new ScalarData(0, this.getTypeInfo(node.type));
        }
        const v = this.evalExpression(node.args[0], context);
        v.typeInfo = this.getTypeInfo(node.type);
        return v;
    }
    _callConstructorArray(node, context) {
        console.error("TODO: implement array constructor");
        return null;
        /*const typeInfo = this.getTypeInfo(node.type);
        if (node.args.length === 0) {
            if (node.type instanceof AST.ArrayType) {
                if (node.type.count) {
                    const format = node.type.format.name;
                    if (format === "bool" || format === "i32" || format === "u32" || format === "f32" || format === "f16") {
                        return new Array(node.type.count).fill(0);
                    } else if (format === "vec2" || format === "vec2u" || format === "vec2i" || format === "vec2f") {
                        return new Array(node.type.count).fill([0, 0]);
                    } else if (format === "vec3" || format === "vec3u" || format === "vec3i" || format === "vec3f") {
                        return new Array(node.type.count).fill([0, 0, 0]);
                    } else if (format === "vec4" || format === "vec4u" || format === "vec4i" || format === "vec4f") {
                        return new Array(node.type.count).fill([0, 0, 0, 0]);
                    } else if (format === "mat2x2") {
                        return new Array(node.type.count).fill([0, 0, 0, 0]);
                    } else if (format === "mat2x3") {
                        return new Array(node.type.count).fill([0, 0, 0, 0, 0, 0]);
                    } else if (format === "mat2x4") {
                        return new Array(node.type.count).fill([0, 0, 0, 0, 0, 0, 0, 0]);
                    } else if (format === "mat3x2") {
                        return new Array(node.type.count).fill([0, 0, 0, 0, 0, 0]);
                    } else if (format === "mat3x3") {
                        return new Array(node.type.count).fill([0, 0, 0, 0, 0, 0, 0, 0, 0]);
                    } else if (format === "mat3x4") {
                        return new Array(node.type.count).fill([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
                    } else if (format === "mat4x2") {
                        return new Array(node.type.count).fill([0, 0, 0, 0, 0, 0, 0, 0]);
                    } else if (format === "mat4x3") {
                        return new Array(node.type.count).fill([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
                    } else if (format === "mat4x4") {
                        return new Array(node.type.count).fill([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
                    } else {
                        console.error(`TODO: support array format ${format}. Line ${node.line}`);
                        return null;
                    }
                }
            }
            return [];
        }
        const values = [];
        for (const arg of node.args) {
            values.push(this.evalExpression(arg, context));
        }
        return values;*/
    }
    _callConstructorVec(node, context) {
        const typeInfo = this.getTypeInfo(node.type);
        const typeName = this.getTypeName(node.type);
        if (node.args.length === 0) {
            if (typeName === "vec2" || typeName === "vec2f" || typeName === "vec2i" || typeName === "vec2u") {
                return new VectorData([0, 0], typeInfo);
            }
            else if (typeName === "vec3" || typeName === "vec3f" || typeName === "vec3i" || typeName === "vec3u") {
                return new VectorData([0, 0, 0], typeInfo);
            }
            else if (typeName === "vec4" || typeName === "vec4f" || typeName === "vec4i" || typeName === "vec4u") {
                return new VectorData([0, 0, 0, 0], typeInfo);
            }
            console.error(`Invalid vec constructor ${typeName}. Line ${node.line}`);
            return null;
        }
        if (node.type instanceof TemplateType && node.type.format === null) {
            node.type.format = TemplateType.f32; // TODO: get the format from the type of the arg.
        }
        const isInt = typeName.endsWith("i") || typeName.endsWith("u");
        const values = [];
        // TODO: make sure the number of args matches the vector length.
        for (const arg of node.args) {
            let v = this.evalExpression(arg, context).value;
            if (isInt) {
                v = Math.floor(v);
            }
            values.push(v);
        }
        if (typeName === "vec2" || typeName === "vec2f" || typeName === "vec2i" || typeName === "vec2u") {
            if (values.length === 1) {
                values.push(values[0]);
            }
        }
        else if (typeName === "vec3" || typeName === "vec3f" || typeName === "vec3i" || typeName === "vec3u") {
            if (values.length === 1) {
                values.push(values[0], values[0]);
            }
            else if (values.length === 2) {
                console.error(`Invalid vec3 constructor. Line ${node.line}`);
            }
        }
        else if (typeName === "vec4" || typeName === "vec4f" || typeName === "vec4i" || typeName === "vec4u") {
            if (values.length === 1) {
                values.push(values[0], values[0], values[0]);
            }
            else if (values.length < 4) {
                console.error(`Invalid vec3 constructor. Line ${node.line}`);
            }
        }
        return new VectorData(values, typeInfo);
    }
    _callConstructorMatrix(node, context) {
        const typeInfo = this.getTypeInfo(node.type);
        const typeName = this.getTypeName(node.type);
        if (node.args.length === 0) {
            if (typeName === "mat2x2" || typeName === "mat2x2f" || typeName === "mat2x2i" || typeName === "mat2x2u") {
                return new MatrixData([0, 0, 0, 0], typeInfo);
            }
            else if (typeName === "mat2x3" || typeName === "mat2x3f" || typeName === "mat2x3i" || typeName === "mat2x3u") {
                return new MatrixData([0, 0, 0, 0, 0, 0], typeInfo);
            }
            else if (typeName === "mat2x4" || typeName === "mat2x4f" || typeName === "mat2x4i" || typeName === "mat2x4u") {
                return new MatrixData([0, 0, 0, 0, 0, 0, 0, 0], typeInfo);
            }
            else if (typeName === "mat3x2" || typeName === "mat3x2f" || typeName === "mat3x2i" || typeName === "mat3x2u") {
                return new MatrixData([0, 0, 0, 0, 0, 0], typeInfo);
            }
            else if (typeName === "mat3x3" || typeName === "mat3x3f" || typeName === "mat3x3i" || typeName === "mat3x3u") {
                return new MatrixData([0, 0, 0, 0, 0, 0, 0, 0, 0], typeInfo);
            }
            else if (typeName === "mat3x4" || typeName === "mat3x4f" || typeName === "mat3x4i" || typeName === "mat3x4u") {
                return new MatrixData([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], typeInfo);
            }
            else if (typeName === "mat4x2" || typeName === "mat4x2f" || typeName === "mat4x2i" || typeName === "mat4x2u") {
                return new MatrixData([0, 0, 0, 0, 0, 0, 0, 0], typeInfo);
            }
            else if (typeName === "mat4x3" || typeName === "mat4x3f" || typeName === "mat4x3i" || typeName === "mat4x3u") {
                return new MatrixData([0, 0, 0, 0, 0, 0, 0, 0, 0, 0], typeInfo);
            }
            else if (typeName === "mat4x4" || typeName === "mat4x4f" || typeName === "mat4x4i" || typeName === "mat4x4u") {
                return new MatrixData([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], typeInfo);
            }
            console.error(`Invalid matrix constructor ${typeName}. Line ${node.line}`);
            return null;
        }
        typeName.endsWith("i") || typeName.endsWith("u");
        const values = [];
        if (node.args.length === 1) {
            const value = this.evalExpression(node.args[0], context);
            if (!(value instanceof MatrixData) || this.getTypeName(value.typeInfo) !== typeName) {
                console.error(`Invalid matrix constructor. Line ${node.line}`);
                return null;
            }
            values.push(...value.value);
        }
        else {
            if (typeName === "mat2x2" || typeName === "mat2x2f" || typeName === "mat2x2h" ||
                typeName === "mat2x3" || typeName === "mat2x3f" || typeName === "mat2x3h" ||
                typeName === "mat2x4" || typeName === "mat2x4f" || typeName === "mat2x4h") {
                if (node.args.length === 2) {
                    const v1 = this.evalExpression(node.args[0], context);
                    const v2 = this.evalExpression(node.args[1], context);
                    if (v1 instanceof VectorData && v2 instanceof VectorData) {
                        values.push(...v1.value, ...v2.value);
                    }
                    else {
                        console.error(`Invalid matrix constructor. Line ${node.line}`);
                        return null;
                    }
                }
                else {
                    if (typeName === "mat2x2" || typeName === "mat2x2f" || typeName === "mat2x2h") {
                        if (node.args.length === 4) {
                            values.push(...node.args.map(a => this.evalExpression(a, context).value));
                        }
                        else {
                            console.error(`Invalid matrix constructor. Line ${node.line}`);
                            return null;
                        }
                    }
                    else if (typeName === "mat2x3" || typeName === "mat2x3f" || typeName === "mat2x3h") {
                        if (node.args.length === 6) {
                            values.push(...node.args.map(a => this.evalExpression(a, context).value));
                        }
                        else {
                            console.error(`Invalid matrix constructor. Line ${node.line}`);
                            return null;
                        }
                    }
                    else if (typeName === "mat2x4" || typeName === "mat2x4f" || typeName === "mat2x4h") {
                        if (node.args.length === 8) {
                            values.push(...node.args.map(a => this.evalExpression(a, context).value));
                        }
                        else {
                            console.error(`Invalid matrix constructor. Line ${node.line}`);
                            return null;
                        }
                    }
                }
            }
            else if (typeName === "mat3x2" || typeName === "mat3x2f" || typeName === "mat3x2h" ||
                typeName === "mat3x3" || typeName === "mat3x3f" || typeName === "mat3x3h" ||
                typeName === "mat3x4" || typeName === "mat3x4f" || typeName === "mat3x4h") {
                if (node.args.length === 3) {
                    const v1 = this.evalExpression(node.args[0], context);
                    const v2 = this.evalExpression(node.args[1], context);
                    const v3 = this.evalExpression(node.args[2], context);
                    if (v1 instanceof VectorData && v2 instanceof VectorData && v3 instanceof VectorData) {
                        values.push(...v1.value, ...v2.value, ...v3.value);
                    }
                    else {
                        console.error(`Invalid matrix constructor. Line ${node.line}`);
                        return null;
                    }
                }
                else {
                    if (typeName === "mat3x2" || typeName === "mat3x2f" || typeName === "mat3x2h") {
                        if (node.args.length === 6) {
                            values.push(...node.args.map(a => this.evalExpression(a, context).value));
                        }
                        else {
                            console.error(`Invalid matrix constructor. Line ${node.line}`);
                            return null;
                        }
                    }
                    else if (typeName === "mat3x3" || typeName === "mat3x3f" || typeName === "mat3x3h") {
                        if (node.args.length === 9) {
                            values.push(...node.args.map(a => this.evalExpression(a, context).value));
                        }
                        else {
                            console.error(`Invalid matrix constructor. Line ${node.line}`);
                            return null;
                        }
                    }
                    else if (typeName === "mat3x4" || typeName === "mat3x4f" || typeName === "mat3x4h") {
                        if (node.args.length === 12) {
                            values.push(...node.args.map(a => this.evalExpression(a, context).value));
                        }
                        else {
                            console.error(`Invalid matrix constructor. Line ${node.line}`);
                            return null;
                        }
                    }
                }
            }
            else if (typeName === "mat4x2" || typeName === "mat4x2f" || typeName === "mat4x2h" ||
                typeName === "mat4x3" || typeName === "mat4x3f" || typeName === "mat4x3h" ||
                typeName === "mat4x4" || typeName === "mat4x4f" || typeName === "mat4x4h") {
                if (node.args.length === 4) {
                    const v1 = this.evalExpression(node.args[0], context);
                    const v2 = this.evalExpression(node.args[1], context);
                    const v3 = this.evalExpression(node.args[2], context);
                    const v4 = this.evalExpression(node.args[3], context);
                    if (v1 instanceof VectorData && v2 instanceof VectorData && v3 instanceof VectorData && v4 instanceof VectorData) {
                        values.push(...v1.value, ...v2.value, ...v3.value, ...v4.value);
                    }
                    else {
                        console.error(`Invalid matrix constructor. Line ${node.line}`);
                        return null;
                    }
                }
                else {
                    if (typeName === "mat4x2" || typeName === "mat4x2f" || typeName === "mat4x2h") {
                        if (node.args.length === 8) {
                            values.push(...node.args.map(a => this.evalExpression(a, context).value));
                        }
                        else {
                            console.error(`Invalid matrix constructor. Line ${node.line}`);
                            return null;
                        }
                    }
                    else if (typeName === "mat4x3" || typeName === "mat4x3f" || typeName === "mat4x3h") {
                        if (node.args.length === 12) {
                            values.push(...node.args.map(a => this.evalExpression(a, context).value));
                        }
                        else {
                            console.error(`Invalid matrix constructor. Line ${node.line}`);
                            return null;
                        }
                    }
                    else if (typeName === "mat4x4" || typeName === "mat4x4f" || typeName === "mat4x4h") {
                        if (node.args.length === 16) {
                            values.push(...node.args.map(a => this.evalExpression(a, context).value));
                        }
                        else {
                            console.error(`Invalid matrix constructor. Line ${node.line}`);
                            return null;
                        }
                    }
                }
            }
        }
        return new MatrixData(values, typeInfo);
    }
}
WgslExec._priority = new Map([["f32", 0], ["f16", 1], ["u32", 2], ["i32", 3], ["x32", 3]]);

class Command {
    get line() { return -1; }
}
class StatementCommand extends Command {
    constructor(node) {
        super();
        this.node = node;
    }
    get line() { return this.node.line; }
}
class CallExprCommand extends Command {
    constructor(node, statement) {
        super();
        this.node = node;
        this.statement = statement;
    }
    get line() { return this.statement.line; }
}
class GotoCommand extends Command {
    constructor(condition, position) {
        super();
        this.condition = condition;
        this.position = position;
    }
    get line() {
        var _a, _b;
        return (_b = (_a = this.condition) === null || _a === void 0 ? void 0 : _a.line) !== null && _b !== void 0 ? _b : -1;
    }
}
GotoCommand.kContinueTarget = -1;
GotoCommand.kBreakTarget = -2;
GotoCommand.kContinue = -3;
GotoCommand.kBreak = -4;
class BlockCommand extends Command {
    constructor(statements) {
        super();
        this.statements = [];
        this.statements = statements;
    }
    get line() {
        return this.statements.length > 0 ? this.statements[0].line : -1;
    }
}
class StackFrame {
    constructor(context, parent) {
        this.parent = null;
        this.commands = [];
        this.current = 0;
        this.parentCallExpr = null;
        this.context = context;
        this.parent = parent !== null && parent !== void 0 ? parent : null;
    }
    get isAtEnd() { return this.current >= this.commands.length; }
    getNextCommand() {
        if (this.current >= this.commands.length) {
            return null;
        }
        const command = this.commands[this.current];
        this.current++;
        return command;
    }
    getCurrentCommand() {
        if (this.current >= this.commands.length) {
            return null;
        }
        return this.commands[this.current];
    }
}
class ExecStack {
    constructor() {
        this.states = [];
    }
    get isEmpty() { return this.states.length == 0; }
    get last() { var _a; return (_a = this.states[this.states.length - 1]) !== null && _a !== void 0 ? _a : null; }
    pop() {
        this.states.pop();
    }
}
class WgslDebug {
    constructor(code, runStateCallback) {
        this._runTimer = null;
        this.breakpoints = new Set();
        this.runStateCallback = null;
        this._code = code;
        this._exec = new WgslExec(code);
        this.runStateCallback = runStateCallback !== null && runStateCallback !== void 0 ? runStateCallback : null;
    }
    getVariableValue(name) {
        var _a, _b;
        const v = (_b = (_a = this._exec.context.getVariable(name)) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : null;
        if (v === null) {
            return null;
        }
        if (v instanceof ScalarData) {
            return v.value;
        }
        if (v instanceof VectorData) {
            return v.value;
        }
        if (v instanceof MatrixData) {
            return v.value;
        }
        console.error(`Unsupported return variable type ${v.typeInfo.name}`);
        return null;
    }
    reset() {
        this._exec = new WgslExec(this._code);
        this._execStack = new ExecStack();
        const state = this._createState(this._exec.ast, this._exec.context);
        this._execStack.states.push(state);
    }
    startDebug() {
        this._execStack = new ExecStack();
        const state = this._createState(this._exec.ast, this._exec.context);
        this._execStack.states.push(state);
    }
    get context() {
        return this._exec.context;
    }
    get currentState() {
        while (true) {
            if (this._execStack.isEmpty) {
                return null;
            }
            let state = this._execStack.last;
            if (state === null) {
                return null;
            }
            if (state.isAtEnd) {
                this._execStack.pop();
                if (this._execStack.isEmpty) {
                    return null;
                }
                state = this._execStack.last;
            }
            return state;
        }
    }
    get currentCommand() {
        while (true) {
            if (this._execStack.isEmpty) {
                return null;
            }
            let state = this._execStack.last;
            if (state === null) {
                return null;
            }
            if (state.isAtEnd) {
                this._execStack.pop();
                if (this._execStack.isEmpty) {
                    return null;
                }
                state = this._execStack.last;
            }
            const command = state.getCurrentCommand();
            if (command === null) {
                continue;
            }
            return command;
        }
    }
    toggleBreakpoint(line) {
        if (this.breakpoints.has(line)) {
            this.breakpoints.delete(line);
        }
        else {
            this.breakpoints.add(line);
        }
    }
    clearBreakpoints() {
        this.breakpoints.clear();
    }
    get isRunning() {
        return this._runTimer !== null;
    }
    run() {
        if (this.isRunning) {
            return;
        }
        this._runTimer = setInterval(() => {
            const command = this.currentCommand;
            if (command) {
                if (this.breakpoints.has(command.line)) {
                    clearInterval(this._runTimer);
                    this._runTimer = null;
                    if (this.runStateCallback !== null) {
                        this.runStateCallback();
                    }
                    return;
                }
            }
            if (!this.stepNext(true)) {
                clearInterval(this._runTimer);
                this._runTimer = null;
                if (this.runStateCallback !== null) {
                    this.runStateCallback();
                }
            }
        }, 0);
        if (this.runStateCallback !== null) {
            this.runStateCallback();
        }
    }
    pause() {
        if (this._runTimer !== null) {
            clearInterval(this._runTimer);
            this._runTimer = null;
            if (this.runStateCallback !== null) {
                this.runStateCallback();
            }
        }
    }
    debugWorkgroup(kernel, dispatchId, dispatchCount, bindGroups, config) {
        this._execStack = new ExecStack();
        const context = this._exec.context;
        context.currentFunctionName = kernel;
        this._dispatchId = dispatchId;
        config = config !== null && config !== void 0 ? config : {};
        if (config["constants"]) {
            for (const k in config["constants"]) {
                const v = config["constants"][k];
                context.setVariable(k, v);
            }
        }
        // Use this to debug the top level statements, otherwise call _execStatements.
        /*const state = new _ExecState(this._exec.context);
        this._execStack.states.push(state);
        for (const statement of this._exec.ast) {
            state.commands.push(new Command(CommandType.Statement, statement));
        }*/
        this._exec._execStatements(this._exec.ast, context);
        const f = context.functions.get(kernel);
        if (!f) {
            console.error(`Function ${kernel} not found`);
            return false;
        }
        if (typeof dispatchCount === "number") {
            dispatchCount = [dispatchCount, 1, 1];
        }
        else if (dispatchCount.length === 0) {
            console.error(`Invalid dispatch count`);
            return false;
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
        const vec3u = this._exec.typeInfo["vec3u"];
        context.setVariable("@num_workgroups", new VectorData(dispatchCount, vec3u));
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
                                v.value = new TypedData(entry.texture, this._exec.getTypeInfo(node.type), 0, entry.size);
                            }
                            else if (entry.uniform !== undefined) {
                                // Uniform buffer
                                v.value = new TypedData(entry.uniform, this._exec.getTypeInfo(node.type));
                            }
                            else {
                                // Storage buffer
                                v.value = new TypedData(entry, this._exec.getTypeInfo(node.type));
                            }
                        }
                    }
                });
            }
        }
        let found = false;
        for (let z = 0; z < depth && !found; ++z) {
            for (let y = 0; y < height && !found; ++y) {
                for (let x = 0; x < width && !found; ++x) {
                    context.setVariable("@workgroup_id", new VectorData([x, y, z], vec3u));
                    if (this._dispatchWorkgroup(f, [x, y, z], context)) {
                        found = true;
                        break;
                    }
                }
            }
        }
        return found;
    }
    _shouldExecuteNectCommand() {
        const command = this.currentCommand;
        if (command === null) {
            return false;
        }
        if (command instanceof GotoCommand) {
            if (command.condition === null) {
                return true;
            }
        }
        return false;
    }
    stepInto() {
        if (this.isRunning) {
            return;
        }
        this.stepNext(true);
    }
    stepOver() {
        if (this.isRunning) {
            return;
        }
        this.stepNext(false);
    }
    stepOut() {
        const state = this.currentState;
        if (state === null) {
            return;
        }
        const parentState = state.parent;
        if (this.isRunning) {
            clearInterval(this._runTimer);
            this._runTimer = null;
        }
        this._runTimer = setInterval(() => {
            const command = this.currentCommand;
            if (command) {
                if (this.breakpoints.has(command.line)) {
                    clearInterval(this._runTimer);
                    this._runTimer = null;
                    if (this.runStateCallback !== null) {
                        this.runStateCallback();
                    }
                    return;
                }
            }
            if (!this.stepNext(true)) {
                clearInterval(this._runTimer);
                this._runTimer = null;
                if (this.runStateCallback !== null) {
                    this.runStateCallback();
                }
            }
            const state = this.currentState;
            if (state === parentState) {
                clearInterval(this._runTimer);
                this._runTimer = null;
                if (this.runStateCallback !== null) {
                    this.runStateCallback();
                }
            }
        }, 0);
        if (this.runStateCallback !== null) {
            this.runStateCallback();
        }
    }
    // Returns true if execution is not finished, false if execution is complete.
    stepNext(stepInto = true) {
        if (!this._execStack) {
            this._execStack = new ExecStack();
            const state = this._createState(this._exec.ast, this._exec.context);
            this._execStack.states.push(state);
        }
        while (true) {
            if (this._execStack.isEmpty) {
                return false;
            }
            let state = this._execStack.last;
            if (state === null) {
                return false;
            }
            if (state.isAtEnd) {
                this._execStack.pop();
                if (this._execStack.isEmpty) {
                    return false;
                }
                state = this._execStack.last;
            }
            const command = state.getNextCommand();
            if (command === null) {
                continue;
            }
            if (stepInto && command instanceof CallExprCommand) {
                const node = command.node;
                const fn = state.context.functions.get(node.name);
                if (!fn) {
                    continue; // it's not a custom function, step over it
                }
                const fnState = this._createState(fn.node.body, state.context.clone(), state);
                for (let ai = 0; ai < fn.node.args.length; ++ai) {
                    const arg = fn.node.args[ai];
                    const value = this._exec.evalExpression(node.args[ai], fnState.context);
                    fnState.context.setVariable(arg.name, value, arg);
                }
                fnState.parentCallExpr = node;
                this._execStack.states.push(fnState);
                fnState.context.currentFunctionName = fn.name;
                if (this._shouldExecuteNectCommand()) {
                    continue;
                }
                return true;
            }
            else if (command instanceof StatementCommand) {
                const res = this._exec.execStatement(command.node, state.context);
                if (res !== null && res !== undefined) {
                    let s = state;
                    // Find the CallExpr to store the return value in.
                    while (s) {
                        if (s.parentCallExpr) {
                            s.parentCallExpr.setCachedReturnValue(res);
                            break;
                        }
                        s = s.parent;
                    }
                    if (s === null) {
                        console.error("Could not find CallExpr to store return value in");
                    }
                    if (this._shouldExecuteNectCommand()) {
                        continue;
                    }
                    return true;
                }
            }
            else if (command instanceof GotoCommand) {
                // kContinueTarget is used as a marker for continue statements, and
                // kBreakTarget is used as a marker for break statements. Skip them.
                if (command.position === GotoCommand.kContinueTarget ||
                    command.position === GotoCommand.kBreakTarget) {
                    continue; // continue to the next command
                }
                // kContinue is used as a marker for continue statements. If we encounter it,
                // then we need to find the nearest proceding GotoCommand with a kContinueTarget.
                if (command.position === GotoCommand.kContinue) {
                    while (!this._execStack.isEmpty) {
                        state = this._execStack.last;
                        for (let i = state.current; i >= 0; --i) {
                            const cmd = state.commands[i];
                            if (cmd instanceof GotoCommand &&
                                cmd.position === GotoCommand.kContinueTarget) {
                                state.current = i + 1;
                                return true;
                            }
                        }
                        // No Goto -1 found (loop), pop the current state and continue searching.
                        this._execStack.pop();
                    }
                    // If we got here, we've reached the end of the stack and didn't find a -1.
                    // That means a continue was used outside of a loop, so we're done.
                    console.error("Continue statement used outside of a loop");
                    return false;
                }
                // kBreak is used as a marker for break statements. If we encounter it,
                // then we need to find the nearest subsequent GotoCommand with a kBreakTarget.
                if (command.position === GotoCommand.kBreak) {
                    while (!this._execStack.isEmpty) {
                        state = this._execStack.last;
                        for (let i = state.current; i < state.commands.length; ++i) {
                            const cmd = state.commands[i];
                            if (cmd instanceof GotoCommand &&
                                cmd.position === GotoCommand.kBreakTarget) {
                                state.current = i + 1;
                                return true;
                            }
                        }
                        // No Goto -2 found (loop), pop the current state and continue searching.
                        this._execStack.pop();
                    }
                    // If we got here, we've reached the end of the stack and didn't find a -2.
                    // That means a break was used outside of a loop, so we're done.
                    console.error("Break statement used outside of a loop");
                    return false;
                }
                if (command.condition) {
                    const res = this._exec.evalExpression(command.condition, state.context);
                    if (!(res instanceof ScalarData)) {
                        console.error("Condition must be a scalar");
                        return false;
                    }
                    // If the GOTO condition value is true, then continue to the next command.
                    // Otherwise, jump to the specified position.
                    if (res.value) {
                        if (this._shouldExecuteNectCommand()) {
                            continue;
                        }
                        return true;
                    }
                }
                state.current = command.position;
                if (this._shouldExecuteNectCommand()) {
                    continue;
                }
                return true;
            }
            else if (command instanceof BlockCommand) {
                const blockState = this._createState(command.statements, state.context.clone(), state);
                this._execStack.states.push(blockState);
                continue; // step into the first statement of the block
            }
            if (state.isAtEnd) {
                this._execStack.pop();
                if (this._execStack.isEmpty) {
                    return false;
                }
            }
            if (this._shouldExecuteNectCommand()) {
                continue;
            }
            return true;
        }
    }
    _dispatchWorkgroup(f, workgroup_id, context) {
        const workgroupSize = [1, 1, 1];
        for (const attr of f.node.attributes) {
            if (attr.name === "workgroup_size") {
                if (Array.isArray(attr.value)) {
                    if (attr.value.length > 0) {
                        // The value could be an override constant
                        const v = context.getVariableValue(attr.value[0]);
                        if (v instanceof ScalarData) {
                            workgroupSize[0] = v.value;
                        }
                        else {
                            workgroupSize[0] = parseInt(attr.value[0]);
                        }
                    }
                    if (attr.value.length > 1) {
                        const v = context.getVariableValue(attr.value[1]);
                        if (v instanceof ScalarData) {
                            workgroupSize[1] = v.value;
                        }
                        else {
                            workgroupSize[1] = parseInt(attr.value[1]);
                        }
                    }
                    if (attr.value.length > 2) {
                        const v = context.getVariableValue(attr.value[2]);
                        if (v instanceof ScalarData) {
                            workgroupSize[2] = v.value;
                        }
                        else {
                            workgroupSize[2] = parseInt(attr.value[2]);
                        }
                    }
                }
                else {
                    workgroupSize[0] = parseInt(attr.value);
                }
            }
        }
        const vec3u = this._exec.typeInfo["vec3u"];
        const u32 = this._exec.typeInfo["u32"];
        context.setVariable("@workgroup_size", new VectorData(workgroupSize, vec3u));
        const width = workgroupSize[0];
        const height = workgroupSize[1];
        const depth = workgroupSize[2];
        let found = false;
        for (let z = 0, li = 0; z < depth && !found; ++z) {
            for (let y = 0; y < height && !found; ++y) {
                for (let x = 0; x < width && !found; ++x, ++li) {
                    const local_invocation_id = [x, y, z];
                    const global_invocation_id = [
                        x + workgroup_id[0] * workgroupSize[0],
                        y + workgroup_id[1] * workgroupSize[1],
                        z + workgroup_id[2] * workgroupSize[2]
                    ];
                    context.setVariable("@local_invocation_id", new VectorData(local_invocation_id, vec3u));
                    context.setVariable("@global_invocation_id", new VectorData(global_invocation_id, vec3u));
                    context.setVariable("@local_invocation_index", new ScalarData(li, u32));
                    if (global_invocation_id[0] === this._dispatchId[0] &&
                        global_invocation_id[1] === this._dispatchId[1] &&
                        global_invocation_id[2] === this._dispatchId[2]) {
                        found = true;
                        break;
                    }
                }
            }
        }
        if (found) {
            this._dispatchExec(f, context);
        }
        return found;
    }
    _dispatchExec(f, context) {
        // Update any built-in input args.
        // TODO: handle input structs.
        for (const arg of f.node.args) {
            for (const attr of arg.attributes) {
                if (attr.name === "builtin") {
                    const globalName = `@${attr.value}`;
                    const globalVar = context.getVariable(globalName);
                    if (globalVar !== null) {
                        context.variables.set(arg.name, globalVar);
                    }
                }
            }
        }
        const state = this._createState(f.node.body, context);
        this._execStack.states.push(state);
    }
    _createState(ast, context, parent) {
        const state = new StackFrame(context, parent !== null && parent !== void 0 ? parent : null);
        for (const statement of ast) {
            // A statement may have expressions that include function calls.
            // Gather all of the internal function calls from the statement.
            // We can then include them as commands to step through, storing their
            // values with the call node so that when it is evaluated, it uses that
            // already computed value. This allows us to step into the function
            if (statement instanceof Let ||
                statement instanceof Var$1 ||
                statement instanceof Assign) {
                const functionCalls = [];
                this._collectFunctionCalls(statement.value, functionCalls);
                for (const call of functionCalls) {
                    state.commands.push(new CallExprCommand(call, statement));
                }
                state.commands.push(new StatementCommand(statement));
            }
            else if (statement instanceof Call) {
                const functionCalls = [];
                for (const arg of statement.args) {
                    this._collectFunctionCalls(arg, functionCalls);
                }
                for (const call of functionCalls) {
                    state.commands.push(new CallExprCommand(call, statement));
                }
                state.commands.push(new StatementCommand(statement));
            }
            else if (statement instanceof Return) {
                const functionCalls = [];
                this._collectFunctionCalls(statement.value, functionCalls);
                for (const call of functionCalls) {
                    state.commands.push(new CallExprCommand(call, statement));
                }
                state.commands.push(new StatementCommand(statement));
            }
            else if (statement instanceof Increment) {
                state.commands.push(new StatementCommand(statement));
            }
            else if (statement instanceof Function$1) {
                const f = new Function(statement);
                state.context.functions.set(statement.name, f);
                continue;
            }
            else if (statement instanceof While) {
                const functionCalls = [];
                state.commands.push(new GotoCommand(null, GotoCommand.kContinueTarget));
                this._collectFunctionCalls(statement.condition, functionCalls);
                for (const call of functionCalls) {
                    state.commands.push(new CallExprCommand(call, statement));
                }
                const conditionCmd = new GotoCommand(statement.condition, 0);
                state.commands.push(conditionCmd);
                state.commands.push(new BlockCommand(statement.body));
                state.commands.push(new GotoCommand(statement.condition, 0));
                state.commands.push(new GotoCommand(null, GotoCommand.kBreakTarget));
                conditionCmd.position = state.commands.length;
            }
            else if (statement instanceof If) {
                const functionCalls = [];
                this._collectFunctionCalls(statement.condition, functionCalls);
                for (const call of functionCalls) {
                    state.commands.push(new CallExprCommand(call, statement));
                }
                let conditionCmd = new GotoCommand(statement.condition, 0);
                state.commands.push(conditionCmd);
                state.commands.push(new BlockCommand(statement.body));
                const gotoEnd = new GotoCommand(null, 0);
                state.commands.push(gotoEnd);
                for (const elseIf of statement.elseif) {
                    conditionCmd.position = state.commands.length;
                    const functionCalls = [];
                    this._collectFunctionCalls(elseIf.condition, functionCalls);
                    for (const call of functionCalls) {
                        state.commands.push(new CallExprCommand(call, statement));
                    }
                    conditionCmd = new GotoCommand(elseIf.condition, 0);
                    state.commands.push(conditionCmd);
                    state.commands.push(new BlockCommand(elseIf.body));
                    state.commands.push(gotoEnd);
                }
                conditionCmd.position = state.commands.length;
                if (statement.else) {
                    state.commands.push(new BlockCommand(statement.else));
                }
                gotoEnd.position = state.commands.length;
            }
            else if (statement instanceof For) {
                if (statement.init) {
                    state.commands.push(new StatementCommand(statement.init));
                }
                let conditionPos = state.commands.length;
                if (statement.increment === null) {
                    state.commands.push(new GotoCommand(null, GotoCommand.kContinueTarget));
                }
                let conditionCmd = null;
                if (statement.condition) {
                    const functionCalls = [];
                    this._collectFunctionCalls(statement.condition, functionCalls);
                    for (const call of functionCalls) {
                        state.commands.push(new CallExprCommand(call, statement));
                    }
                    conditionCmd = new GotoCommand(statement.condition, 0);
                    state.commands.push(conditionCmd);
                }
                state.commands.push(new BlockCommand(statement.body));
                if (statement.increment) {
                    state.commands.push(new GotoCommand(null, GotoCommand.kContinueTarget));
                    state.commands.push(new StatementCommand(statement.increment));
                }
                state.commands.push(new GotoCommand(null, conditionPos));
                state.commands.push(new GotoCommand(null, GotoCommand.kBreakTarget));
                conditionCmd.position = state.commands.length;
            }
            else if (statement instanceof Continue) {
                state.commands.push(new GotoCommand(null, GotoCommand.kContinue));
            }
            else if (statement instanceof Break) {
                state.commands.push(new GotoCommand(null, GotoCommand.kBreak));
            }
            else {
                console.error(`TODO: statement type ${statement.constructor.name}`);
            }
        }
        return state;
    }
    _collectFunctionCalls(node, functionCalls) {
        if (node instanceof CallExpr) {
            for (const arg of node.args) {
                this._collectFunctionCalls(arg, functionCalls);
            }
            // Only collect custom function calls, not built-in functions.
            if (!node.isBuiltin) {
                functionCalls.push(node);
            }
        }
        else if (node instanceof BinaryOperator) {
            this._collectFunctionCalls(node.left, functionCalls);
            this._collectFunctionCalls(node.right, functionCalls);
        }
        else if (node instanceof UnaryOperator) {
            this._collectFunctionCalls(node.right, functionCalls);
        }
        else if (node instanceof GroupingExpr) {
            for (const n of node.contents) {
                this._collectFunctionCalls(n, functionCalls);
            }
        }
        else if (node instanceof CreateExpr) {
            for (const arg of node.args) {
                this._collectFunctionCalls(arg, functionCalls);
            }
        }
        else if (node instanceof BitcastExpr) {
            this._collectFunctionCalls(node.value, functionCalls);
        }
        else if (node instanceof ArrayIndex) {
            this._collectFunctionCalls(node.index, functionCalls);
        }
        else if (LiteralExpr) ;
        else {
            console.error(`TODO: expression type ${node.constructor.name}`);
        }
    }
}

exports.Alias = Alias;
exports.AliasInfo = AliasInfo;
exports.Argument = Argument;
exports.ArgumentInfo = ArgumentInfo;
exports.ArrayIndex = ArrayIndex;
exports.ArrayInfo = ArrayInfo;
exports.ArrayType = ArrayType;
exports.Assign = Assign;
exports.Attribute = Attribute;
exports.BinaryOperator = BinaryOperator;
exports.BitcastExpr = BitcastExpr;
exports.Break = Break;
exports.Call = Call;
exports.CallExpr = CallExpr;
exports.Case = Case;
exports.Const = Const;
exports.ConstExpr = ConstExpr;
exports.Continue = Continue;
exports.Continuing = Continuing;
exports.CreateExpr = CreateExpr;
exports.Default = Default;
exports.Diagnostic = Diagnostic;
exports.Discard = Discard;
exports.ElseIf = ElseIf;
exports.Enable = Enable;
exports.EntryFunctions = EntryFunctions;
exports.Expression = Expression;
exports.For = For;
exports.Function = Function$1;
exports.FunctionInfo = FunctionInfo;
exports.GroupingExpr = GroupingExpr;
exports.If = If;
exports.Increment = Increment;
exports.InputInfo = InputInfo;
exports.Let = Let;
exports.LiteralExpr = LiteralExpr;
exports.Loop = Loop;
exports.Member = Member;
exports.MemberInfo = MemberInfo;
exports.Node = Node;
exports.Operator = Operator;
exports.OutputInfo = OutputInfo;
exports.Override = Override;
exports.OverrideInfo = OverrideInfo;
exports.ParseContext = ParseContext;
exports.PointerType = PointerType;
exports.Requires = Requires;
exports.Return = Return;
exports.SamplerType = SamplerType;
exports.StackFrame = StackFrame;
exports.Statement = Statement;
exports.StaticAssert = StaticAssert;
exports.StringExpr = StringExpr;
exports.Struct = Struct;
exports.StructInfo = StructInfo;
exports.Switch = Switch;
exports.SwitchCase = SwitchCase;
exports.TemplateInfo = TemplateInfo;
exports.TemplateType = TemplateType;
exports.Token = Token;
exports.TokenType = TokenType;
exports.TokenTypes = TokenTypes;
exports.Type = Type;
exports.TypeInfo = TypeInfo;
exports.TypecastExpr = TypecastExpr;
exports.UnaryOperator = UnaryOperator;
exports.Var = Var$1;
exports.VariableExpr = VariableExpr;
exports.VariableInfo = VariableInfo;
exports.WgslDebug = WgslDebug;
exports.WgslExec = WgslExec;
exports.WgslParser = WgslParser;
exports.WgslReflect = WgslReflect;
exports.WgslScanner = WgslScanner;
exports.While = While;
exports._BlockEnd = _BlockEnd;
exports._BlockStart = _BlockStart;
//# sourceMappingURL=wgsl_reflect.node.js.map
