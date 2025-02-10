export class ParseContext {
  constants: Map<string, Const> = new Map();
  aliases: Map<string, Alias> = new Map();
  structs: Map<string, Struct> = new Map();
}

/**
 * @class Node
 * @category AST
 * Base class for AST nodes parsed from a WGSL shader.
 */
export class Node {
  line: number;

  constructor() {
    this.line = 0;
  }

  get isAstNode(): boolean {
    return true;
  }

  get astNodeType(): string {
    return "";
  }

  constEvaluate(context: ParseContext, type?: Array<Type>): number | Array<number> {
    throw new Error("Cannot evaluate node");
  }

  constEvaluateString(context: ParseContext): string {
    return this.constEvaluate(context).toString();
  }

  search(callback: (node: Node) => void) {}

  searchBlock(block: Array<Node> | null, callback: (node: Node) => void) {
    if (block) {
      callback(_BlockStart.instance);
      for (const node of block) {
        if (node instanceof Array) {
          this.searchBlock(node as Array<Node>, callback);
        } else {
          node.search(callback);
        }
      }
      callback(_BlockEnd.instance);
    }
  }
}

// For internal use only
export class _BlockStart extends Node {
  static instance = new _BlockStart();
}

 // For internal use only
export class _BlockEnd extends Node { 
  static instance = new _BlockEnd();
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
  returnType: Type | null;
  body: Array<Statement>;
  attributes: Array<Attribute> | null;
  startLine: number;
  endLine: number;
  calls: Set<Function> = new Set();

  constructor(
    name: string,
    args: Array<Argument>,
    returnType: Type | null,
    body: Array<Statement>,
    startLine: number,
    endLine: number
  ) {
    super();
    this.name = name;
    this.args = args;
    this.returnType = returnType;
    this.body = body;
    this.startLine = startLine;
    this.endLine = endLine;
  }

  get astNodeType(): string {
    return "function";
  }

  search(callback: (node: Node) => void) {
    this.searchBlock(this.body, callback);
  }
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

  get astNodeType() {
    return "staticAssert";
  }

  search(callback: (node: Node) => void) {
    this.expression.search(callback);
  }
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

  get astNodeType() {
    return "while";
  }

  search(callback: (node: Node) => void) {
    this.condition.search(callback);
    this.searchBlock(this.body, callback);
  }
}

/**
 * @class Continuing
 * @extends Statement
 * @category AST
 */
export class Continuing extends Statement {
  body: Array<Statement>;

  constructor(body: Array<Statement>) {
    super();
    this.body = body;
  }

  get astNodeType() {
    return "continuing";
  }

  search(callback: (node: Node) => void) {
    this.searchBlock(this.body, callback);
  }
}

/**
 * @class For
 * @extends Statement
 * @category AST
 */
export class For extends Statement {
  init: Statement | null;
  condition: Expression | null;
  increment: Statement | null;
  body: Array<Statement>;

  constructor(
    init: Statement | null,
    condition: Expression | null,
    increment: Statement | null,
    body: Array<Statement>
  ) {
    super();
    this.init = init;
    this.condition = condition;
    this.increment = increment;
    this.body = body;
  }

  get astNodeType() {
    return "for";
  }

  search(callback: (node: Node) => void) {
    this.init?.search(callback);
    this.condition?.search(callback);
    this.increment?.search(callback);
    this.searchBlock(this.body, callback);
  }
}

/**
 * @class Var
 * @extends Statement
 * @category AST
 */
export class Var extends Statement {
  name: string;
  type: Type | null;
  storage: string | null;
  access: string | null;
  value: Expression | null;
  attributes: Array<Attribute> | null;

  constructor(
    name: string,
    type: Type | null,
    storage: string | null,
    access: string | null,
    value: Expression | null
  ) {
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

  search(callback: (node: Node) => void) {
    callback(this);
    this.value?.search(callback);
  }
}

/**
 * @class Override
 * @extends Statement
 * @category AST
 */
export class Override extends Statement {
  name: string;
  type: Type | null;
  value: Expression | null;
  attributes: Array<Attribute> | null;

  constructor(name: string, type: Type | null, value: Expression | null) {
    super();
    this.name = name;
    this.type = type;
    this.value = value;
  }

  get astNodeType() {
    return "override";
  }

  search(callback: (node: Node) => void) {
    this.value?.search(callback);
  }
}

/**
 * @class Let
 * @extends Statement
 * @category AST
 */
export class Let extends Statement {
  name: string;
  type: Type | null;
  storage: string | null;
  access: string | null;
  value: Expression | null;
  attributes: Array<Attribute> | null;

  constructor(
    name: string,
    type: Type | null,
    storage: string | null,
    access: string | null,
    value: Expression | null
  ) {
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

  search(callback: (node: Node) => void) {
    callback(this);
    this.value?.search(callback);
  }
}

/**
 * @class Const
 * @extends Statement
 * @category AST
 */
export class Const extends Statement {
  name: string;
  type: Type | null;
  storage: string | null;
  access: string | null;
  value: Expression;
  attributes: Array<Attribute> | null;

  constructor(
    name: string,
    type: Type | null,
    storage: string | null,
    access: string | null,
    value: Expression
  ) {
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

  constEvaluate(context: ParseContext, type?: Array<Type>): number | Array<number> {
    return this.value.constEvaluate(context, type);
  }

  search(callback: (node: Node) => void) {
    callback(this);
    this.value?.search(callback);
  }
}

export enum IncrementOperator {
  increment = "++",
  decrement = "--",
}

export namespace IncrementOperator {
  export function parse(val: string): IncrementOperator {
    const key = val as keyof typeof IncrementOperator;
    if (key == "parse") throw new Error("Invalid value for IncrementOperator");
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

  get astNodeType() {
    return "increment";
  }

  search(callback: (node: Node) => void) {
    this.variable.search(callback);
  }
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
  shiftRightAssign = ">>=",
}

export namespace AssignOperator {
  export function parse(val: string): AssignOperator {
    const key = val as keyof typeof AssignOperator;
    if (key == "parse") {
      throw new Error("Invalid value for AssignOperator");
    }
    //return AssignOperator[key];
    return key as AssignOperator;
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

  constructor(
    operator: AssignOperator,
    variable: Expression,
    value: Expression
  ) {
    super();
    this.operator = operator;
    this.variable = variable;
    this.value = value;
  }

  get astNodeType() {
    return "assign";
  }

  search(callback: (node: Node) => void): void {
    this.variable.search(callback);
    this.value.search(callback);
  }
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

  get astNodeType() {
    return "call";
  }

  search(callback: (node: Node) => void) {
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
export class Loop extends Statement {
  body: Array<Statement>;
  continuing: Array<Statement> | null;

  constructor(body: Array<Statement>, continuing: Array<Statement> | null) {
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
  condition: Expression;
  body: Array<Statement>;

  constructor(condition: Expression, body: Array<Statement>) {
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
  condition: Expression;
  body: Array<Statement>;
  elseif: Array<ElseIf> | null;
  else: Array<Statement> | null;

  constructor(
    condition: Expression,
    body: Array<Statement>,
    elseif: Array<ElseIf> | null,
    _else: Array<Statement> | null
  ) {
    super();
    this.condition = condition;
    this.body = body;
    this.elseif = elseif;
    this.else = _else;
  }

  get astNodeType() {
    return "if";
  }

  search(callback: (node: Node) => void) {
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
export class Return extends Statement {
  value: Expression;

  constructor(value: Expression) {
    super();
    this.value = value;
  }

  get astNodeType() {
    return "return";
  }

  search(callback: (node: Node) => void) {
    this.value?.search(callback);
  }
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

  get astNodeType() {
    return "enable";
  }
}

/**
 * @class Requires
 * @extends Statement
 * @category AST
 */
export class Requires extends Statement {
  extensions: string[];

  constructor(extensions: string[]) {
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
export class Diagnostic extends Statement {
  severity: string;
  rule: string;

  constructor(severity: string, rule: string) {
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
export class Alias extends Statement {
  name: string;
  type: Type;

  constructor(name: string, type: Type) {
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
  condition: Expression | null;

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
 * @extends Statement
 * @category AST
 */
export class Type extends Statement {
  name: string;
  attributes: Array<Attribute> | null;

  constructor(name: string) {
    super();
    this.name = name;
  }

  get astNodeType() {
    return "type";
  }

  get isStruct(): boolean {
    return false;
  }

  get isArray(): boolean {
    return false;
  }

  static x32 = new Type("x32");
  static f32 = new Type("f32");
  static i32 = new Type("i32");
  static u32 = new Type("u32");
  static f16 = new Type("f16");
  static bool = new Type("bool");
}

/**
 * @class StructType
 * @extends Type
 * @category AST
 */
export class Struct extends Type {
  members: Array<Member>;
  startLine: number;
  endLine: number;

  constructor(name: string, members: Array<Member>, startLine: number, endLine: number) {
    super(name);
    this.members = members;
    this.startLine = startLine;
    this.endLine = endLine;
  }

  get astNodeType() {
    return "struct";
  }

  get isStruct(): boolean {
    return true;
  }

  /// Return the index of the member with the given name, or -1 if not found.
  getMemberIndex(name: string): number {
    for (let i = 0; i < this.members.length; i++) {
      if (this.members[i].name == name) return i;
    }
    return -1;
  }
}

/**
 * @class TemplateType
 * @extends Type
 * @category AST
 */
export class TemplateType extends Type {
  format: Type | null;
  access: string | null;

  constructor(name: string, format: Type | null, access: string | null) {
    super(name);
    this.format = format;
    this.access = access;
  }

  get astNodeType() {
    return "template";
  }

  static vec2f = new TemplateType("vec2", Type.f32, null);
  static vec3f = new TemplateType("vec3", Type.f32, null);
  static vec4f = new TemplateType("vec4", Type.f32, null);
  static vec2i = new TemplateType("vec2", Type.i32, null);
  static vec3i = new TemplateType("vec3", Type.i32, null);
  static vec4i = new TemplateType("vec4", Type.i32, null);
  static vec2u = new TemplateType("vec2", Type.u32, null);
  static vec3u = new TemplateType("vec3", Type.u32, null);
  static vec4u = new TemplateType("vec4", Type.u32, null);
  static vec2h = new TemplateType("vec2", Type.f16, null);
  static vec3h = new TemplateType("vec3", Type.f16, null);
  static vec4h = new TemplateType("vec4", Type.f16, null);

  static mat2x2f = new TemplateType("mat2x2", Type.f32, null);
  static mat2x3f = new TemplateType("mat2x3", Type.f32, null);
  static mat2x4f = new TemplateType("mat2x4", Type.f32, null);
  static mat3x2f = new TemplateType("mat3x2", Type.f32, null);
  static mat3x3f = new TemplateType("mat3x3", Type.f32, null);
  static mat3x4f = new TemplateType("mat3x4", Type.f32, null);
  static mat4x2f = new TemplateType("mat4x2", Type.f32, null);
  static mat4x3f = new TemplateType("mat4x3", Type.f32, null);
  static mat4x4f = new TemplateType("mat4x4", Type.f32, null);

  static mat2x2h = new TemplateType("mat2x2", Type.f16, null);
  static mat2x3h = new TemplateType("mat2x3", Type.f16, null);
  static mat2x4h = new TemplateType("mat2x4", Type.f16, null);
  static mat3x2h = new TemplateType("mat3x2", Type.f16, null);
  static mat3x3h = new TemplateType("mat3x3", Type.f16, null);
  static mat3x4h = new TemplateType("mat3x4", Type.f16, null);
  static mat4x2h = new TemplateType("mat4x2", Type.f16, null);
  static mat4x3h = new TemplateType("mat4x3", Type.f16, null);
  static mat4x4h = new TemplateType("mat4x4", Type.f16, null);
}

/**
 * @class PointerType
 * @extends Type
 * @category AST
 */
export class PointerType extends Type {
  storage: string;
  type: Type | null;
  access: string | null;

  constructor(
    name: string,
    storage: string,
    type: Type | null,
    access: string | null
  ) {
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
  attributes: Array<Attribute> | null;
  format: Type | null;
  count: number;

  constructor(
    name: string,
    attributes: Array<Attribute> | null,
    format: Type | null,
    count: number
  ) {
    super(name);
    this.attributes = attributes;
    this.format = format;
    this.count = count;
  }

  get astNodeType() {
    return "array";
  }

  get isArray(): boolean {
    return true;
  }
}

/**
 * @class SamplerType
 * @extends Type
 * @category AST
 */
export class SamplerType extends Type {
  format: Type | string | null;
  access: string | null;

  constructor(
    name: string,
    format: Type | string | null,
    access: string | null
  ) {
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
  postfix: Expression | null;

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

  get astNodeType() {
    return "stringExpr";
  }

  toString(): string {
    return this.value;
  }

  constEvaluateString(): string {
    return this.value;
  }
}

/**
 * @class CreateExpr
 * @extends Expression
 * @category AST
 */
export class CreateExpr extends Expression {
  type: Type | null;
  args: Array<Expression> | null;

  constructor(type: Type | null, args: Array<Expression> | null) {
    super();
    this.type = type;
    this.args = args;
  }

  get astNodeType() {
    return "createExpr";
  }

  search(callback: (node: Node) => void) {
    callback(this);
    if (this.args) {
      for (const node of this.args) {
        node.search(callback);
      }
    }
  }

  _maxFormatType(x: Type[]) {
    const priority = {
      "f32": 0,
      "f16": 1,
      "u32": 2,
      "i32": 3,
      "x32": 3
    };

    let t = x[0];
    if (t.name === "f32") {
      return t;
    }
    for (let i = 1; i < x.length; ++i) {
      const tv = priority[t.name];
      const xv = priority[x[i].name];
      if (xv < tv) {
        t = x[i];
      }
    }

    if (t.name === "x32") {
      return Type.i32;
    }

    return t;
  }

  constEvaluate(context: ParseContext, type?: Array<Type>): number | Array<number> {
    const t = this.type;
    if (t.name === "f32" || t.name === "f16" || t.name === "i32" || t.name === "u32") {
      return this.args[0].constEvaluate(context, type);
    }

    if (t.name === "vec2" || t.name === "vec2f" || t.name === "vec2h" || t.name === "vec2i" || t.name === "vec2u") {
      const tx = [Type.f32];
      const ty = [Type.f32];
      const v = [this.args[0].constEvaluate(context, tx) as number,
                this.args[1].constEvaluate(context, ty) as number];
      if (type) {
        type[0] = t;
        if (t instanceof TemplateType && t.format === null) {
          t.format = this._maxFormatType([tx[0], ty[0]]);
        }
      }
      return v;
    }
  
    if (t.name === "vec3" || t.name === "vec3f" || t.name === "vec3h" || t.name === "vec3i" || t.name === "vec3u") {
      const tx = [Type.f32];
      const ty = [Type.f32];
      const tz = [Type.f32];
      const v = [this.args[0].constEvaluate(context, tx) as number,
                this.args[1].constEvaluate(context, ty) as number,
                this.args[2].constEvaluate(context, tz) as number];
      if (type) {
        type[0] = t;
        if (t instanceof TemplateType && t.format === null) {
          t.format = this._maxFormatType([tx[0], ty[0], tz[0]]);
        }
      }
      return v;
    }
    
    if (t.name === "vec4" || t.name === "vec4f" || t.name === "vec4h" || t.name === "vec4i" || t.name === "vec4u") {
      const tx = [Type.f32];
      const ty = [Type.f32];
      const tz = [Type.f32];
      const tw = [Type.f32];
      const v = [this.args[0].constEvaluate(context, tx) as number,
                this.args[1].constEvaluate(context, ty) as number,
                this.args[2].constEvaluate(context, tz) as number,
                this.args[3].constEvaluate(context, tw) as number];
      if (type) {
        type[0] = t;
        if (t instanceof TemplateType && t.format === null) {
          t.format = this._maxFormatType([tx[0], ty[0], tz[0], tw[0]]);
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
      } else if (this.args.length === 2) {
        // mat2x2(v1: vec2, v2: vec2)
        const e1 = [Type.f32];
        const e2 = [Type.f32];
        const v1 = this.args[0].constEvaluate(context, e1);
        const v2 = this.args[1].constEvaluate(context, e2);
        if ((e1[0].name !== "vec2" && e1[0].name !== "vec2f" && e1[0].name !== "vec2h") ||
            (e2[0].name !== "vec2" && e2[0].name !== "vec2f" && e2[0].name !== "vec2h")) {
          throw "Invalid arguments for mat2x2";
        }
        const v = [v1[0], v1[1], v2[0], v2[1]];
        if (type) {
          type[0] = t;
          if (t instanceof TemplateType && t.format === null) {
            if (e1[0].name === "vec2f") {
              t.format = Type.f32;
            } else if (e1[0].name === "vec2h") {
              t.format = Type.f16;
            } else if (e1[0] instanceof TemplateType) {
              t.format = e1[0].format;
            }
          }
        }
        return v;
      } else if (this.args.length === 4) {
        // mat2x2(e1, e2, e3, e4)
        const e1 = [Type.f32];
        const e2 = [Type.f32];
        const e3 = [Type.f32];
        const e4 = [Type.f32];
        const v = [this.args[0].constEvaluate(context, e1) as number,
                  this.args[1].constEvaluate(context, e2) as number,
                  this.args[2].constEvaluate(context, e3) as number,
                  this.args[3].constEvaluate(context, e4) as number];
        if (type) {
          type[0] = t;
          if (t instanceof TemplateType && t.format === null) {
            t.format = this._maxFormatType([e1[0], e2[0], e3[0], e4[0]]);
          }
        }

        return v;
      } else {
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
      } else if (this.args.length === 2) {
        // mat2x3(v1: vec3, v2: vec3)
        const e1 = [Type.f32];
        const e2 = [Type.f32];
        const v1 = this.args[0].constEvaluate(context, e1);
        const v2 = this.args[1].constEvaluate(context, e2);
        if ((e1[0].name !== "vec3" && e1[0].name !== "vec3f" && e1[0].name !== "vec3h") ||
            (e2[0].name !== "vec3" && e2[0].name !== "vec3f" && e2[0].name !== "vec3h")) {
          throw "Invalid arguments for mat2x3";
        }
        const v = [v1[0], v1[1], v1[2], v2[0], v2[1], v2[2]];
        if (type) {
          type[0] = t;
          if (t instanceof TemplateType && t.format === null) {
            if (e1[0].name === "vec3f") {
              t.format = Type.f32;
            } else if (e1[0].name === "vec3h") {
              t.format = Type.f16;
            } else if (e1[0] instanceof TemplateType) {
              t.format = e1[0].format;
            }
          }
        }
        return v;
      } else if (this.args.length === 6) {
        // mat2x3(e1, e2, e3, e4, e5, e6)
        const e1 = [Type.f32];
        const e2 = [Type.f32];
        const e3 = [Type.f32];
        const e4 = [Type.f32];
        const e5 = [Type.f32];
        const e6 = [Type.f32];
        const v = [this.args[0].constEvaluate(context, e1) as number,
                  this.args[1].constEvaluate(context, e2) as number,
                  this.args[2].constEvaluate(context, e3) as number,
                  this.args[3].constEvaluate(context, e4) as number,
                  this.args[4].constEvaluate(context, e5) as number,
                  this.args[5].constEvaluate(context, e6) as number];
        if (type) {
          type[0] = t;
          if (t instanceof TemplateType && t.format === null) {
            t.format = this._maxFormatType([e1[0], e2[0], e3[0], e4[0], e5[0], e6[0]]);
          }
        }

        return v;
      } else {
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
      } else if (this.args.length === 2) {
        // mat2x4(v1: vec4, v2: vec4)
        const e1 = [Type.f32];
        const e2 = [Type.f32];
        const v1 = this.args[0].constEvaluate(context, e1);
        const v2 = this.args[1].constEvaluate(context, e2);
        if ((e1[0].name !== "vec4" && e1[0].name !== "vec4f" && e1[0].name !== "vec4h") ||
            (e2[0].name !== "vec4" && e2[0].name !== "vec4f" && e2[0].name !== "vec4h")) {
          throw "Invalid arguments for mat2x4";
        }
        const v = [v1[0], v1[1], v1[2], v1[3], v2[0], v2[1], v2[2], v2[3]];
        if (type) {
          type[0] = t;
          if (t instanceof TemplateType && t.format === null) {
            if (e1[0].name === "vec4f") {
              t.format = Type.f32;
            } else if (e1[0].name === "vec4h") {
              t.format = Type.f16;
            } else if (e1[0] instanceof TemplateType) {
              t.format = e1[0].format;
            }
          }
        }
        return v;
      } else if (this.args.length === 8) {
        // mat2x4(e1, e2, e3, e4, e5, e6, e7, e8)
        const e1 = [Type.f32];
        const e2 = [Type.f32];
        const e3 = [Type.f32];
        const e4 = [Type.f32];
        const e5 = [Type.f32];
        const e6 = [Type.f32];
        const e7 = [Type.f32];
        const e8 = [Type.f32];
        const v = [this.args[0].constEvaluate(context, e1) as number,
                  this.args[1].constEvaluate(context, e2) as number,
                  this.args[2].constEvaluate(context, e3) as number,
                  this.args[3].constEvaluate(context, e4) as number,
                  this.args[4].constEvaluate(context, e5) as number,
                  this.args[5].constEvaluate(context, e6) as number,
                  this.args[6].constEvaluate(context, e7) as number,
                  this.args[7].constEvaluate(context, e8) as number];
        if (type) {
          type[0] = t;
          if (t instanceof TemplateType && t.format === null) {
            t.format = this._maxFormatType([e1[0], e2[0], e3[0], e4[0], e5[0], e6[0], e7[0], e8[0]]);
          }
        }

        return v;
      } else {
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
      } else if (this.args.length === 3) {
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
        const v = [v1[0], v1[1], v2[0], v2[1], v3[0], v3[1]];
        if (type) {
          type[0] = t;
          if (t instanceof TemplateType && t.format === null) {
            if (e1[0].name === "vec2f") {
              t.format = Type.f32;
            } else if (e1[0].name === "vec2h") {
              t.format = Type.f16;
            } else if (e1[0] instanceof TemplateType) {
              t.format = e1[0].format;
            }
          }
        }
        return v;
      } else if (this.args.length === 6) {
        // mat3x2(e1, e2, e3, e4, e5, e6)
        const e1 = [Type.f32];
        const e2 = [Type.f32];
        const e3 = [Type.f32];
        const e4 = [Type.f32];
        const e5 = [Type.f32];
        const e6 = [Type.f32];
        const v = [this.args[0].constEvaluate(context, e1) as number,
                  this.args[1].constEvaluate(context, e2) as number,
                  this.args[2].constEvaluate(context, e3) as number,
                  this.args[3].constEvaluate(context, e4) as number,
                  this.args[4].constEvaluate(context, e5) as number,
                  this.args[5].constEvaluate(context, e6) as number];
        if (type) {
          type[0] = t;
          if (t instanceof TemplateType && t.format === null) {
            t.format = this._maxFormatType([e1[0], e2[0], e3[0], e4[0], e5[0], e6[0]]);
          }
        }

        return v;
      } else {
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
      } else if (this.args.length === 3) {
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
        const v = [v1[0], v1[1], v1[2], v2[0], v2[1], v2[2], v3[0], v3[1], v3[2]];
        if (type) {
          type[0] = t;
          if (t instanceof TemplateType && t.format === null) {
            if (e1[0].name === "vec3f") {
              t.format = Type.f32;
            } else if (e1[0].name === "vec3h") {
              t.format = Type.f16;
            } else if (e1[0] instanceof TemplateType) {
              t.format = e1[0].format;
            }
          }
        }
        return v;
      } else if (this.args.length === 9) {
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
        const v = [this.args[0].constEvaluate(context, e1) as number,
                  this.args[1].constEvaluate(context, e2) as number,
                  this.args[2].constEvaluate(context, e3) as number,
                  this.args[3].constEvaluate(context, e4) as number,
                  this.args[4].constEvaluate(context, e5) as number,
                  this.args[5].constEvaluate(context, e6) as number,
                  this.args[6].constEvaluate(context, e7) as number,
                  this.args[7].constEvaluate(context, e8) as number,
                  this.args[8].constEvaluate(context, e9) as number];
        if (type) {
          type[0] = t;
          if (t instanceof TemplateType && t.format === null) {
            t.format = this._maxFormatType([e1[0], e2[0], e3[0], e4[0], e5[0], e6[0], e7[0], e8[0], e9[0]]);
          }
        }

        return v;
      } else {
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
      } else if (this.args.length === 3) {
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
        const v = [v1[0], v1[1], v1[2], v1[3], v2[0], v2[1], v2[2], v2[3], v3[0], v3[1], v3[2], v3[3]];
        if (type) {
          type[0] = t;
          if (t instanceof TemplateType && t.format === null) {
            if (e1[0].name === "vec4f") {
              t.format = Type.f32;
            } else if (e1[0].name === "vec4h") {
              t.format = Type.f16;
            } else if (e1[0] instanceof TemplateType) {
              t.format = e1[0].format;
            }
          }
        }
        return v;
      } else if (this.args.length === 9) {
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
        const v = [this.args[0].constEvaluate(context, e1) as number,
                  this.args[1].constEvaluate(context, e2) as number,
                  this.args[2].constEvaluate(context, e3) as number,
                  this.args[3].constEvaluate(context, e4) as number,
                  this.args[4].constEvaluate(context, e5) as number,
                  this.args[5].constEvaluate(context, e6) as number,
                  this.args[6].constEvaluate(context, e7) as number,
                  this.args[7].constEvaluate(context, e8) as number,
                  this.args[8].constEvaluate(context, e9) as number,
                  this.args[9].constEvaluate(context, e10) as number,
                  this.args[10].constEvaluate(context, e11) as number,
                  this.args[11].constEvaluate(context, e12) as number];
        if (type) {
          type[0] = t;
          if (t instanceof TemplateType && t.format === null) {
            t.format = this._maxFormatType([e1[0], e2[0], e3[0], e4[0], e5[0], e6[0], e7[0],
                  e8[0], e9[0], e10[0], e11[0]]);
          }
        }

        return v;
      } else {
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
      } else if (this.args.length === 4) {
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
        const v = [v1[0], v1[1], v2[0], v2[1], v3[0], v3[1], v4[0], v4[1]];
        if (type) {
          type[0] = t;
          if (t instanceof TemplateType && t.format === null) {
            if (e1[0].name === "vec2f") {
              t.format = Type.f32;
            } else if (e1[0].name === "vec2h") {
              t.format = Type.f16;
            } else if (e1[0] instanceof TemplateType) {
              t.format = e1[0].format;
            }
          }
        }
        return v;
      } else if (this.args.length === 8) {
        // mat4x2(e1, e2, e3, e4, e5, e6, e7, e8)
        const e1 = [Type.f32];
        const e2 = [Type.f32];
        const e3 = [Type.f32];
        const e4 = [Type.f32];
        const e5 = [Type.f32];
        const e6 = [Type.f32];
        const e7 = [Type.f32];
        const e8 = [Type.f32];
        const v = [this.args[0].constEvaluate(context, e1) as number,
                  this.args[1].constEvaluate(context, e2) as number,
                  this.args[2].constEvaluate(context, e3) as number,
                  this.args[3].constEvaluate(context, e4) as number,
                  this.args[4].constEvaluate(context, e5) as number,
                  this.args[5].constEvaluate(context, e6) as number,
                  this.args[6].constEvaluate(context, e7) as number,
                  this.args[7].constEvaluate(context, e8) as number];
        if (type) {
          type[0] = t;
          if (t instanceof TemplateType && t.format === null) {
            t.format = this._maxFormatType([e1[0], e2[0], e3[0], e4[0], e5[0], e6[0], e7[0], e8[0]]);
          }
        }

        return v;
      } else {
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
      } else if (this.args.length === 4) {
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
        const v = [v1[0], v1[1], v1[2], v2[0], v2[1], v2[2], v3[0], v3[1], v3[2], v4[0], v4[1], v4[2]];
        if (type) {
          type[0] = t;
          if (t instanceof TemplateType && t.format === null) {
            if (e1[0].name === "vec3f") {
              t.format = Type.f32;
            } else if (e1[0].name === "vec3h") {
              t.format = Type.f16;
            } else if (e1[0] instanceof TemplateType) {
              t.format = e1[0].format;
            }
          }
        }
        return v;
      } else if (this.args.length === 9) {
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
        const v = [this.args[0].constEvaluate(context, e1) as number,
                  this.args[1].constEvaluate(context, e2) as number,
                  this.args[2].constEvaluate(context, e3) as number,
                  this.args[3].constEvaluate(context, e4) as number,
                  this.args[4].constEvaluate(context, e5) as number,
                  this.args[5].constEvaluate(context, e6) as number,
                  this.args[6].constEvaluate(context, e7) as number,
                  this.args[7].constEvaluate(context, e8) as number,
                  this.args[8].constEvaluate(context, e9) as number,
                  this.args[9].constEvaluate(context, e10) as number,
                  this.args[10].constEvaluate(context, e11) as number,
                  this.args[11].constEvaluate(context, e12) as number];
        if (type) {
          type[0] = t;
          if (t instanceof TemplateType && t.format === null) {
            t.format = this._maxFormatType([e1[0], e2[0], e3[0], e4[0], e5[0], e6[0], e7[0], e8[0],
                  e9[0], e10[0], e11[0], e12[0]]);
          }
        }

        return v;
      } else {
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
      } else if (this.args.length === 4) {
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
        const v = [v1[0], v1[1], v1[2], v1[3],
            v2[0], v2[1], v2[2], v2[3],
            v3[0], v3[1], v3[2], v3[3],
            v4[0], v4[1], v4[2], v4[3]];
        if (type) {
          type[0] = t;
          if (t instanceof TemplateType && t.format === null) {
            if (e1[0].name === "vec4f") {
              t.format = Type.f32;
            } else if (e1[0].name === "vec4h") {
              t.format = Type.f16;
            } else if (e1[0] instanceof TemplateType) {
              t.format = e1[0].format;
            }
          }
        }
        return v;
      } else if (this.args.length === 9) {
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
        const v = [this.args[0].constEvaluate(context, e1) as number,
                  this.args[1].constEvaluate(context, e2) as number,
                  this.args[2].constEvaluate(context, e3) as number,
                  this.args[3].constEvaluate(context, e4) as number,
                  this.args[4].constEvaluate(context, e5) as number,
                  this.args[5].constEvaluate(context, e6) as number,
                  this.args[6].constEvaluate(context, e7) as number,
                  this.args[7].constEvaluate(context, e8) as number,
                  this.args[8].constEvaluate(context, e9) as number,
                  this.args[9].constEvaluate(context, e10) as number,
                  this.args[10].constEvaluate(context, e11) as number,
                  this.args[11].constEvaluate(context, e12) as number,
                  this.args[12].constEvaluate(context, e13) as number,
                  this.args[13].constEvaluate(context, e14) as number,
                  this.args[14].constEvaluate(context, e15) as number,
                  this.args[15].constEvaluate(context, e16) as number];
        if (type) {
          type[0] = t;
          if (t instanceof TemplateType && t.format === null) {
            t.format = this._maxFormatType([e1[0], e2[0], e3[0], e4[0], e5[0], e6[0], e7[0], e8[0],
              e9[0], e10[0], e11[0], e12[0], e13[0], e14[0], e15[0]]);
          }
        }

        return v;
      } else {
        throw "Invalid arguments for mat4x4";
      }
    }

    if (t.name === "array") {
      const v = [];
      const ta = t as ArrayType;
      for (const arg of this.args) {
        const te = [Type.f32];
        const e = arg.constEvaluate(context, te);
        v.push(e);

        if (ta.format === null) {
          ta.format = te[0];
        } else {
          ta.format = this._maxFormatType([ta.format, te[0]]);
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
export class CallExpr extends Expression {
  name: string;
  args: Array<Expression> | null;
  cachedReturnValue: any = null;

  constructor(name: string, args: Array<Expression> | null) {
    super();
    this.name = name;
    this.args = args;
  }

  get astNodeType() {
    return "callExpr";
  }

  setCachedReturnValue(value: any) {
    this.cachedReturnValue = value;
  }

  static builtinFunctionNames = new Set([
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

  get isBuiltin(): boolean {
    return CallExpr.builtinFunctionNames.has(this.name);
  }

  constEvaluate(context: ParseContext, type?: Array<Type>): number | Array<number> {
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
        return Math.atan2(value as number, value2 as number);
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
        const a = this.args[1].constEvaluate(context, type) as number;
        const b = this.args[2].constEvaluate(context, type) as number;
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
          const result = [
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
        if (Array.isArray(a)) {
          let d2 = 0;
          for (let i = 0; i < a.length; i++) {
            d2 += (a[i] - b[i]) * (a[i] - b[i]);
          }
          return Math.sqrt(d2);
        }
        const bn = b as number;
        return Math.sqrt((bn - a) * (bn - a));
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
        return (a as number) * (b as number);
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
        return (a as number) * (b as number) + (c as number);
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
        return Math.max(a as number, b as number);
      }
      case "min": {
        const a = this.args[0].constEvaluate(context, type);
        const b = this.args[0].constEvaluate(context, type);
        if (Array.isArray(value) && Array.isArray(b)) {
          return value.map((v, i) => Math.min(v, b[i]));
        }
        return Math.min(a as number, b as number);
      }
      case "mix": {
        const a = this.args[0].constEvaluate(context, type);
        const b = this.args[1].constEvaluate(context, type);
        const c = this.args[2].constEvaluate(context, type);
        if (Array.isArray(a) && Array.isArray(b) && Array.isArray(c)) {
          return a.map((v, i) => v * (1 - c[i]) + b[i] * c[i]);
        }
        return (a as number) * (1 - (c as number)) + (b as number) * (c as number);
      }
      case "modf":
        throw new Error("TODO Modf is not implemented");
      case "pow": {
        const a = this.args[0].constEvaluate(context, type);
        const b = this.args[1].constEvaluate(context, type);
        if (Array.isArray(a) && Array.isArray(b)) {
          return a.map((v, i) => Math.pow(v, b[i]));
        }
        return Math.pow(a as number, b as number);
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
        const _x = x as number;
        const _edge0 = edge0 as number;
        const _edge1 = edge1 as number;
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

  search(callback: (node: Node) => void) {
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
export class VariableExpr extends Expression {
  name: string;

  constructor(name: string) {
    super();
    this.name = name;
  }

  get astNodeType() {
    return "varExpr";
  }

  search(callback: (node: Node) => void) {
    callback(this);
    if (this.postfix) {
      this.postfix.search(callback);
    }
  }

  constEvaluate(context: ParseContext, type?: Array<Type>): number | Array<number> {
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
export class ConstExpr extends Expression {
  name: string;
  initializer: Expression;

  constructor(name: string, initializer: Expression) {
    super();
    this.name = name;
    this.initializer = initializer;
  }

  get astNodeType() {
    return "constExpr";
  }

  constEvaluate(context: ParseContext, type?: Array<Type>): number | Array<number> {
    if (this.initializer instanceof CreateExpr) {
      // This is a struct constant
      const property = this.postfix?.constEvaluateString(context);
      const t = this.initializer.type?.name;
      const struct = context.structs.get(t);
      const memberIndex = struct?.getMemberIndex(property);
      if (memberIndex !== undefined && memberIndex != -1) {
        const value = this.initializer.args[memberIndex].constEvaluate(context, type);
        return value;
      } else {
        return this.initializer.constEvaluate(context, type);
      }
      console.log(memberIndex);
    }

    return this.initializer.constEvaluate(context, type);
  }

  search(callback: (node: Node) => void) {
    this.initializer.search(callback);
  }
}

/**
 * @class LiteralExpr
 * @extends Expression
 * @category AST
 */
export class LiteralExpr extends Expression {
  value: number;
  type: Type;

  constructor(value: number, type: Type) {
    super();
    this.value = value;
    this.type = type;
  }

  get astNodeType() {
    return "literalExpr";
  }

  constEvaluate(context: ParseContext, type?: Array<Type>): number | Array<number> {
    if (type !== undefined) {
      type[0] = this.type;
    }
    return this.value;
  }
}

/**
 * @class BitcastExpr
 * @extends Expression
 * @category AST
 */
export class BitcastExpr extends Expression {
  type: Type | null;
  value: Expression;

  constructor(type: Type | null, value: Expression) {
    super();
    this.type = type;
    this.value = value;
  }

  get astNodeType() {
    return "bitcastExpr";
  }

  search(callback: (node: Node) => void): void {
    this.value.search(callback);
  }
}

/**
 * @class TypecastExpr
 * @extends Expression
 * @category AST
 */
export class TypecastExpr extends Expression {
  type: Type | null;
  args: Array<Expression> | null;

  constructor(type: Type | null, args: Array<Expression> | null) {
    super();
    this.type = type;
    this.args = args;
  }

  get astNodeType() {
    return "typecastExpr";
  }

  constEvaluate(context: ParseContext, type?: Array<Type>): number | Array<number> {
    if (type !== undefined) {
      type[0] = this.type;
    }
    return this.args[0].constEvaluate(context);
  }

  search(callback: (node: Node) => void) {
    this.searchBlock(this.args, callback);
  }
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

  get astNodeType() {
    return "groupExpr";
  }

  constEvaluate(context: ParseContext, type?: Array<Type>): number | Array<number> {
    return this.contents[0].constEvaluate(context, type);
  }

  search(callback: (node: Node) => void): void {
    this.searchBlock(this.contents, callback);
  }
}

/**
 * @class ArrayIndex
 * @extends Expression
 * @category AST
 */
export class ArrayIndex extends Expression {
  index: Expression;
  constructor(index: Expression) {
    super();
    this.index = index;
  }

  search(callback: (node: Node) => void): void {
    this.index.search(callback);
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
  operator: string;
  right: Expression;

  constructor(operator: string, right: Expression) {
    super();
    this.operator = operator;
    this.right = right;
  }

  get astNodeType() {
    return "unaryOp";
  }

  constEvaluate(context: ParseContext, type?: Array<Type>): number | Array<number> {
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

  search(callback: (node: Node) => void): void {
    this.right.search(callback);
  }
}

/**
 * @class BinaryOperator
 * @extends Operator
 * @category AST
 * @property {string} operator +, -, *, /, %, ==, !=, <, >, <=, >=, &&, ||
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

  get astNodeType() {
    return "binaryOp";
  }

  _getPromotedType(t1: Type, t2: Type) {
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

  constEvaluate(context: ParseContext, type?: Array<Type>): number | Array<number> {
    const t1 = [Type.i32];
    const t2 = [Type.i32];
    switch (this.operator) {
      case "+": {
        const v1 = this.left.constEvaluate(context, t1);
        const v2 = this.right.constEvaluate(context, t2);
        if (Array.isArray(v1) && Array.isArray(v2)) {
          return v1.map((v, i) => v + v2[i]);
        }

        const value = (v1 as number) + (v2 as number);
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

        const value = (v1 as number) - (v2 as number);
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

        const value = (v1 as number) * (v2 as number);
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

        const value = (v1 as number) / (v2 as number);
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

        const value = (v1 as number) % (v2 as number);
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

  search(callback: (node: Node) => void) {
    this.left.search(callback);
    this.right.search(callback);
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
  selector: Array<Expression>;
  body: Array<Statement>;

  constructor(selector: Array<Expression>, body: Array<Statement>) {
    super();
    this.selector = selector;
    this.body = body;
  }

  get astNodeType() {
    return "case";
  }

  search(callback: (node: Node) => void): void {
    this.searchBlock(this.body, callback);
  }
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

  get astNodeType() {
    return "default";
  }

  search(callback: (node: Node) => void): void {
    this.searchBlock(this.body, callback);
  }
}

/**
 * @class Argument
 * @extends Node
 * @category AST
 */
export class Argument extends Node {
  name: string;
  type: Type;
  attributes: Array<Attribute> | null;

  constructor(name: string, type: Type, attributes: Array<Attribute> | null) {
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
  condition: Expression;
  body: Array<Statement>;

  constructor(condition: Expression, body: Array<Statement>) {
    super();
    this.condition = condition;
    this.body = body;
  }

  get astNodeType() {
    return "elseif";
  }

  search(callback: (node: Node) => void): void {
    this.condition.search(callback);
    this.searchBlock(this.body, callback);
  }
}

/**
 * @class Member
 * @extends Node
 * @category AST
 */
export class Member extends Node {
  name: string;
  type: Type | null;
  attributes: Array<Attribute> | null;

  constructor(
    name: string,
    type: Type | null,
    attributes: Array<Attribute> | null
  ) {
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
  name: string;
  value: string | Array<string> | null;

  constructor(name: string, value: string | Array<string> | null) {
    super();
    this.name = name;
    this.value = value;
  }

  get astNodeType() {
    return "attribute";
  }
}
