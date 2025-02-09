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

  evaluate(context: ParseContext, type?: Array<Type>): number {
    throw new Error("Cannot evaluate node");
  }

  evaluateString(context: ParseContext): string {
    return this.evaluate(context).toString();
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

  evaluate(context: ParseContext, type?: Array<Type>): number {
    return this.value.evaluate(context, type);
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

  evaluateString(): string {
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

  evaluate(context: ParseContext, type?: Array<Type>): number {
    const t = this.type;
    if (t.name === "f32" || t.name === "f16" || t.name === "i32" || t.name === "u32") {
      return this.args[0].evaluate(context, type);
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

  evaluate(context: ParseContext, type?: Array<Type>): number {
    switch (this.name) {
      case "abs":
        return Math.abs(this.args[0].evaluate(context, type));
      case "acos":
        return Math.acos(this.args[0].evaluate(context, type));
      case "acosh":
        return Math.acosh(this.args[0].evaluate(context, type));
      case "asin":
        return Math.asin(this.args[0].evaluate(context, type));
      case "asinh":
        return Math.asinh(this.args[0].evaluate(context, type));
      case "atan":
        return Math.atan(this.args[0].evaluate(context, type));
      case "atan2":
        return Math.atan2(
          this.args[0].evaluate(context, type),
          this.args[1].evaluate(context, type)
        );
      case "atanh":
        return Math.atanh(this.args[0].evaluate(context, type));
      case "ceil":
        return Math.ceil(this.args[0].evaluate(context, type));
      case "clamp":
        return Math.min(
          Math.max(
            this.args[0].evaluate(context, type),
            this.args[1].evaluate(context, type)
          ),
          this.args[2].evaluate(context, type)
        );
      case "cos":
        return Math.cos(this.args[0].evaluate(context, type));
      //case "cross":
      //TODO: (x[i] * y[j] - x[j] * y[i])
      case "degrees":
        return (this.args[0].evaluate(context) * 180) / Math.PI;
      //case "determinant":
      //TODO implement
      case "distance":
        return Math.sqrt(
          Math.pow(
            this.args[0].evaluate(context, type) - this.args[1].evaluate(context, type),
            2
          )
        );
      case "dot":
      //TODO: (x[i] * y[i])
      case "exp":
        return Math.exp(this.args[0].evaluate(context, type));
      case "exp2":
        return Math.pow(2, this.args[0].evaluate(context, type));
      //case "extractBits":
      //TODO: implement
      //case "firstLeadingBit":
      //TODO: implement
      case "floor":
        return Math.floor(this.args[0].evaluate(context, type));
      case "fma":
        return (
          this.args[0].evaluate(context, type) * this.args[1].evaluate(context, type) +
          this.args[2].evaluate(context, type)
        );
      case "fract":
        return (
          this.args[0].evaluate(context, type) -
          Math.floor(this.args[0].evaluate(context, type))
        );
      //case "frexp":
      //TODO: implement
      case "inverseSqrt":
        return 1 / Math.sqrt(this.args[0].evaluate(context, type));
      //case "length":
      //TODO: implement
      case "log":
        return Math.log(this.args[0].evaluate(context, type));
      case "log2":
        return Math.log2(this.args[0].evaluate(context, type));
      case "max":
        return Math.max(
          this.args[0].evaluate(context, type),
          this.args[1].evaluate(context, type)
        );
      case "min":
        return Math.min(
          this.args[0].evaluate(context, type),
          this.args[1].evaluate(context, type)
        );
      case "mix":
        return (
          this.args[0].evaluate(context, type) *
            (1 - this.args[2].evaluate(context, type)) +
          this.args[1].evaluate(context, type) * this.args[2].evaluate(context, type)
        );
      case "modf":
        return (
          this.args[0].evaluate(context, type) -
          Math.floor(this.args[0].evaluate(context, type))
        );
      case "pow":
        return Math.pow(
          this.args[0].evaluate(context, type),
          this.args[1].evaluate(context, type)
        );
      case "radians":
        return (this.args[0].evaluate(context, type) * Math.PI) / 180;
      case "round":
        return Math.round(this.args[0].evaluate(context, type));
      case "sign":
        return Math.sign(this.args[0].evaluate(context, type));
      case "sin":
        return Math.sin(this.args[0].evaluate(context, type));
      case "sinh":
        return Math.sinh(this.args[0].evaluate(context, type));
      case "saturate":
        return Math.min(Math.max(this.args[0].evaluate(context, type), 0), 1);
      case "smoothstep":
        return (
          this.args[0].evaluate(context, type) *
          this.args[0].evaluate(context, type) *
          (3 - 2 * this.args[0].evaluate(context, type))
        );
      case "sqrt":
        return Math.sqrt(this.args[0].evaluate(context, type));
      case "step":
        if (type !== undefined) {
          type[0] = Type.bool;
        }
        return this.args[0].evaluate(context) < this.args[1].evaluate(context)
          ? 0
          : 1;
      case "tan":
        return Math.tan(this.args[0].evaluate(context, type));
      case "tanh":
        return Math.tanh(this.args[0].evaluate(context, type));
      case "trunc":
        return Math.trunc(this.args[0].evaluate(context, type));
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

  evaluate(context: ParseContext, type?: Array<Type>): number {
    const constant = context.constants.get(this.name);
    if (!constant) {
      throw new Error("Cannot evaluate node");
    }
    return constant.evaluate(context, type);
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

  evaluate(context: ParseContext, type?: Array<Type>): number {
    if (this.initializer instanceof CreateExpr) {
      // This is a struct constant
      const property = this.postfix?.evaluateString(context);
      const t = this.initializer.type?.name;
      const struct = context.structs.get(t);
      const memberIndex = struct?.getMemberIndex(property);
      if (memberIndex !== undefined && memberIndex != -1) {
        const value = this.initializer.args[memberIndex].evaluate(context, type);
        return value;
      } else {
        return this.initializer.evaluate(context, type);
      }
      console.log(memberIndex);
    }

    return this.initializer.evaluate(context, type);
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

  evaluate(context: ParseContext, type?: Array<Type>): number {
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

  evaluate(context: ParseContext, type?: Array<Type>): number {
    if (type !== undefined) {
      type[0] = this.type;
    }
    return this.args[0].evaluate(context);
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

  evaluate(context: ParseContext, type?: Array<Type>): number {
    return this.contents[0].evaluate(context, type);
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

  evaluate(context: ParseContext, type?: Array<Type>): number {
    switch (this.operator) {
      case "+":
        return this.right.evaluate(context, type);
      case "-":
        return -this.right.evaluate(context, type);
      case "!":
        if (type !== undefined) {
          type[0] = Type.bool;
        }
        return this.right.evaluate(context) ? 0 : 1;
      case "~":
        return ~this.right.evaluate(context, type);
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

  evaluate(context: ParseContext, type?: Array<Type>): number {
    const t1 = [Type.i32];
    const t2 = [Type.i32];
    switch (this.operator) {
      case "+": {
        const value = this.left.evaluate(context, t1) + this.right.evaluate(context, t2);
        if (type !== undefined) {
          type[0] = this._getPromotedType(t1[0], t2[0]);
          if (type[0] === Type.i32 || type[0] === Type.u32) {
            return Math.floor(value);
          }
        }
        return value;
      }
      case "-": {
        const value = this.left.evaluate(context, t1) - this.right.evaluate(context, t2);
        if (type !== undefined) {
          type[0] = this._getPromotedType(t1[0], t2[0]);
          if (type[0] === Type.i32 || type[0] === Type.u32) {
            return Math.floor(value);
          }
        }
        return value;
      }
      case "*": {
        const value = this.left.evaluate(context, type) * this.right.evaluate(context, type);
        if (type !== undefined) {
          type[0] = this._getPromotedType(t1[0], t2[0]);
          if (type[0] === Type.i32 || type[0] === Type.u32) {
            return Math.floor(value);
          }
        }
        return value;
      }
      case "/": {
        const value = this.left.evaluate(context, type) / this.right.evaluate(context, type);
        if (type !== undefined) {
          type[0] = this._getPromotedType(t1[0], t2[0]);
          if (type[0] === Type.i32 || type[0] === Type.u32) {
            return Math.floor(value);
          }
        }
        return value;
      }
      case "%": {
        const value = this.left.evaluate(context, type) % this.right.evaluate(context, type);
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
        return this.left.evaluate(context) < this.right.evaluate(context)
          ? 1
          : 0;
      case ">":
        if (type !== undefined) {
          type[0] = Type.bool;
        }
        return this.left.evaluate(context) > this.right.evaluate(context)
          ? 1
          : 0;
      case "==":
        if (type !== undefined) {
          type[0] = Type.bool;
        }
        return this.left.evaluate(context) == this.right.evaluate(context)
            ? 1
            : 0;
      case "!=":
        if (type !== undefined) {
          type[0] = Type.bool;
        }
        return this.left.evaluate(context) != this.right.evaluate(context)
            ? 1
            : 0;
      case "<=":
        if (type !== undefined) {
          type[0] = Type.bool;
        }
        return this.left.evaluate(context) <= this.right.evaluate(context)
          ? 1
          : 0;
      case ">=":
        if (type !== undefined) {
          type[0] = Type.bool;
        }
        return this.left.evaluate(context) >= this.right.evaluate(context)
          ? 1
          : 0;
      case "&&":
        if (type !== undefined) {
          type[0] = Type.bool;
        }
        return this.left.evaluate(context) && this.right.evaluate(context)
          ? 1
          : 0;
      case "||":
        if (type !== undefined) {
          type[0] = Type.bool;
        }
        return this.left.evaluate(context) || this.right.evaluate(context)
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
