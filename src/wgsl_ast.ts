import { WgslExec } from "./wgsl_exec.js";
import { TypeInfo, ArrayInfo, StructInfo, TemplateInfo } from "./reflect/info.js";
import { ExecInterface } from "./exec/exec_interface.js";
import { ExecContext } from "./exec/exec_context.js";

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
  static _id = 0;

  id: number;
  line: number;

  constructor() {
    this.id = Node._id++;
    this.line = 0;
  }

  get isAstNode(): boolean {
    return true;
  }

  get astNodeType(): string {
    return "";
  }

  constEvaluate(context: WgslExec, type?: Type[]): Data | null {
    throw new Error("Cannot evaluate node");
  }

  constEvaluateString(context: WgslExec): string {
    return this.constEvaluate(context).toString();
  }

  search(callback: (node: Node) => void): void {}

  searchBlock(block: Node[] | null, callback: (node: Node) => void): void {
    if (block) {
      callback(_BlockStart.instance);
      for (const node of block) {
        if (node instanceof Array) {
          this.searchBlock(node as Node[], callback);
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
  args: Argument[];
  returnType: Type | null;
  body: Statement[];
  attributes: Attribute[] | null;
  startLine: number;
  endLine: number;
  calls: Set<Function> = new Set();

  constructor(
    name: string,
    args: Argument[],
    returnType: Type | null,
    body: Statement[],
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

  search(callback: (node: Node) => void): void {
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

  get astNodeType(): string {
    return "staticAssert";
  }

  search(callback: (node: Node) => void): void {
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
  body: Statement[];

  constructor(condition: Expression, body: Statement[]) {
    super();
    this.condition = condition;
    this.body = body;
  }

  get astNodeType(): string {
    return "while";
  }

  search(callback: (node: Node) => void): void {
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
  body: Statement[];

  constructor(body: Statement[]) {
    super();
    this.body = body;
  }

  get astNodeType(): string {
    return "continuing";
  }

  search(callback: (node: Node) => void): void {
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
  body: Statement[];

  constructor(
    init: Statement | null,
    condition: Expression | null,
    increment: Statement | null,
    body: Statement[]
  ) {
    super();
    this.init = init;
    this.condition = condition;
    this.increment = increment;
    this.body = body;
  }

  get astNodeType(): string {
    return "for";
  }

  search(callback: (node: Node) => void): void {
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
  attributes: Attribute[] | null = null;

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

  get astNodeType(): string {
    return "var";
  }

  search(callback: (node: Node) => void): void {
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
  attributes: Attribute[] | null = null;

  constructor(name: string, type: Type | null, value: Expression | null) {
    super();
    this.name = name;
    this.type = type;
    this.value = value;
  }

  get astNodeType(): string {
    return "override";
  }

  search(callback: (node: Node) => void): void {
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
  attributes: Attribute[] | null = null;

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

  get astNodeType(): string {
    return "let";
  }

  search(callback: (node: Node) => void): void {
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
  attributes: Attribute[] | null = null;

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

  get astNodeType(): string {
    return "const";
  }

  constEvaluate(context: WgslExec, type?: Type[]): Data | null {
    return this.value.constEvaluate(context, type);
  }

  search(callback: (node: Node) => void): void {
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

  get astNodeType(): string {
    return "increment";
  }

  search(callback: (node: Node) => void): void {
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

  get astNodeType(): string {
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
  args: Expression[];

  constructor(name: string, args: Expression[]) {
    super();
    this.name = name;
    this.args = args;
  }

  get astNodeType(): string {
    return "call";
  }

  search(callback: (node: Node) => void): void {
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
  body: Statement[];
  continuing: Continuing | null;

  constructor(body: Statement[], continuing: Continuing | null) {
    super();
    this.body = body;
    this.continuing = continuing;
  }

  get astNodeType(): string {
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
  body: Statement[];

  constructor(condition: Expression, body: Statement[]) {
    super();
    this.condition = condition;
    this.body = body;
  }

  get astNodeType(): string {
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
  body: Statement[];
  elseif: ElseIf[] | null;
  else: Statement[] | null;

  constructor(
    condition: Expression,
    body: Statement[],
    elseif: ElseIf[] | null,
    _else: Statement[] | null
  ) {
    super();
    this.condition = condition;
    this.body = body;
    this.elseif = elseif;
    this.else = _else;
  }

  get astNodeType(): string {
    return "if";
  }

  search(callback: (node: Node) => void): void {
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

  get astNodeType(): string {
    return "return";
  }

  search(callback: (node: Node) => void): void {
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

  get astNodeType(): string {
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

  get astNodeType(): string {
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

  get astNodeType(): string {
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

  get astNodeType(): string {
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

  get astNodeType(): string {
    return "discard";
  }
}

/**
 * @class Break
 * @extends Statement
 * @category AST
 */
export class Break extends Statement {
  condition: Expression | null = null;
  loopId: number = -1;

  constructor() {
    super();
  }

  get astNodeType(): string {
    return "break";
  }
}

/**
 * @class Continue
 * @extends Statement
 * @category AST
 */
export class Continue extends Statement {
  loopId: number = -1;

  constructor() {
    super();
  }

  get astNodeType(): string {
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
  attributes: Attribute[] | null = null;

  constructor(name: string) {
    super();
    this.name = name;
  }

  get astNodeType(): string {
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

  static _priority = new Map<string, number>([["f32", 0], ["f16", 1], ["u32", 2], ["i32", 3], ["x32", 3]]);

  static maxFormatType(x: Type[]): Type {
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

/**
 * @class StructType
 * @extends Type
 * @category AST
 */
export class Struct extends Type {
  members: Member[];
  startLine: number;
  endLine: number;

  constructor(name: string, members: Member[], startLine: number, endLine: number) {
    super(name);
    this.members = members;
    this.startLine = startLine;
    this.endLine = endLine;
  }

  get astNodeType(): string {
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

  get astNodeType(): string {
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
  static vec2b = new TemplateType("vec2", Type.bool, null);
  static vec3b = new TemplateType("vec3", Type.bool, null);
  static vec4b = new TemplateType("vec4", Type.bool, null);

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

  get astNodeType(): string {
    return "pointer";
  }
}

/**
 * @class ArrayType
 * @extends Type
 * @category AST
 */
export class ArrayType extends Type {
  attributes: Attribute[] | null;
  format: Type | null;
  count: number;

  constructor(
    name: string,
    attributes: Attribute[] | null,
    format: Type | null,
    count: number
  ) {
    super(name);
    this.attributes = attributes;
    this.format = format;
    this.count = count;
  }

  get astNodeType(): string {
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

  get astNodeType(): string {
    return "sampler";
  }
}

/**
 * @class Expression
 * @extends Node
 * @category AST
 */
export class Expression extends Node {
  postfix: Expression | null = null;

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

  get astNodeType(): string {
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
  args: Expression[] | null;

  constructor(type: Type | null, args: Expression[] | null) {
    super();
    this.type = type;
    this.args = args;
  }

  get astNodeType(): string {
    return "createExpr";
  }

  search(callback: (node: Node) => void): void {
    callback(this);
    if (this.args) {
      for (const node of this.args) {
        node.search(callback);
      }
    }
  }

  constEvaluate(context: WgslExec, type?: Type[]): Data | null {
    if (type) {
      type[0] = this.type;
    }
    return context.evalExpression(this, context.context);
  }
}

/**
 * @class CallExpr
 * @extends Expression
 * @category AST
 */
export class CallExpr extends Expression {
  name: string;
  args: Expression[] | null;
  cachedReturnValue: any = null;

  constructor(name: string, args: Expression[] | null) {
    super();
    this.name = name;
    this.args = args;
  }

  get astNodeType(): string {
    return "callExpr";
  }

  setCachedReturnValue(value: any): void {
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

  constEvaluate(context: WgslExec, type?: Type[]): Data {
    return context.evalExpression(this, context.context);
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

  get astNodeType(): string {
    return "varExpr";
  }

  search(callback: (node: Node) => void) {
    callback(this);
    if (this.postfix) {
      this.postfix.search(callback);
    }
  }

  constEvaluate(context: WgslExec, type?: Type[]): Data {
    return context.evalExpression(this, context.context);
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

  get astNodeType(): string {
    return "constExpr";
  }

  constEvaluate(context: WgslExec, type?: Type[]): Data | null {
    if (this.initializer) {
      const data = context.evalExpression(this.initializer, context.context);
      if (data !== null && this.postfix) {
        return data.getDataValue(context, this.postfix, context.context);
      }
      return data;
    }
    return null;
  }

  search(callback: (node: Node) => void): void {
    this.initializer.search(callback);
  }
}

/**
 * @class LiteralExpr
 * @extends Expression
 * @category AST
 */
export class LiteralExpr extends Expression {
  value: Data
  type: Type;

  constructor(value: Data, type: Type) {
    super();
    this.value = value;
    this.type = type;
  }

  get astNodeType(): string {
    return "literalExpr";
  }

  constEvaluate(context: WgslExec, type?: Type[]): Data | null {
    if (type !== undefined) {
      type[0] = this.type;
    }
    return this.value;
  }

  get isScalar(): boolean {
    return this.value instanceof ScalarData;
  }

  get isVector(): boolean {
    return this.value instanceof VectorData || this.value instanceof MatrixData;
  }

  get scalarValue(): number {
    if (this.value instanceof ScalarData) {
      return this.value.value;
    }
    console.error("Value is not scalar.");
    return 0.0;
  }

  get vectorValue(): number[] {
    if (this.value instanceof VectorData) {
      return this.value.value;
    }
    if (this.value instanceof MatrixData) {
      return this.value.value;
    }
    console.error("Value is not a vector or matrix.");
    return [];
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

  get astNodeType(): string {
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
  args: Expression[] | null;

  constructor(type: Type | null, args: Expression[] | null) {
    super();
    this.type = type;
    this.args = args;
  }

  get astNodeType(): string {
    return "typecastExpr";
  }

  constEvaluate(context: WgslExec, type?: Type[]): Data | null {
    return context.evalExpression(this, context.context);
  }

  search(callback: (node: Node) => void): void {
    this.searchBlock(this.args, callback);
  }
}

/**
 * @class GroupingExpr
 * @extends Expression
 * @category AST
 */
export class GroupingExpr extends Expression {
  contents: Expression[];

  constructor(contents: Expression[]) {
    super();
    this.contents = contents;
  }

  get astNodeType(): string {
    return "groupExpr";
  }

  constEvaluate(context: WgslExec, type?: Type[]): Data | null {
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

  get astNodeType(): string {
    return "unaryOp";
  }

  constEvaluate(context: WgslExec, type?: Type[]): Data | null {
    return context.evalExpression(this, context.context);
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

  get astNodeType(): string {
    return "binaryOp";
  }

  _getPromotedType(t1: Type, t2: Type): Type {
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

  constEvaluate(context: WgslExec, type?: Type[]): Data | null {
    return context.evalExpression(this, context.context);
  }

  search(callback: (node: Node) => void): void {
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
  selector: Expression[];
  body: Statement[];

  constructor(selector: Expression[], body: Statement[]) {
    super();
    this.selector = selector;
    this.body = body;
  }

  get astNodeType(): string {
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
  body: Statement[];

  constructor(body: Statement[]) {
    super();
    this.body = body;
  }

  get astNodeType(): string {
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
  attributes: Attribute[] | null;

  constructor(name: string, type: Type, attributes: Attribute[] | null) {
    super();
    this.name = name;
    this.type = type;
    this.attributes = attributes;
  }

  get astNodeType(): string {
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
  body: Statement[];

  constructor(condition: Expression, body: Statement[]) {
    super();
    this.condition = condition;
    this.body = body;
  }

  get astNodeType(): string {
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
  attributes: Attribute[] | null;

  constructor(
    name: string,
    type: Type | null,
    attributes: Attribute[] | null
  ) {
    super();
    this.name = name;
    this.type = type;
    this.attributes = attributes;
  }

  get astNodeType(): string {
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
  value: string | string[] | null;

  constructor(name: string, value: string | string[] | null) {
    super();
    this.name = name;
    this.value = value;
  }

  get astNodeType(): string {
    return "attribute";
  }
}

export class Data {
  typeInfo: TypeInfo;

  constructor(typeInfo: TypeInfo) {
      this.typeInfo = typeInfo;
  }

  setDataValue(exec: ExecInterface, value: Data, postfix: Expression | null, context: ExecContext): void {
      console.error(`SetDataValue: Not implemented`, value, postfix);
  }

  getDataValue(exec: ExecInterface, postfix: Expression | null, context: ExecContext): Data | null {
      console.error(`GetDataValue: Not implemented`, postfix);
      return null;
  }

  toString(): string {
      return `<${this.typeInfo.name}>`;
  }
}

export class VoidData extends Data {
  constructor() {
      super(new TypeInfo("void", null));
  }

  static void = new VoidData();

  toString(): string {
      return "void";
  }
}

// Used to store scalar data
export class ScalarData extends Data {
  value: number;

  constructor(value: number, typeInfo: TypeInfo) {
      super(typeInfo);
      if (this.typeInfo.name === "i32" || this.typeInfo.name === "u32") {
          value = Math.floor(value);
      } else if (this.typeInfo.name === "bool") {
          value = value ? 1 : 0;
      }
      this.value = value;
  }

  setDataValue(exec: ExecInterface, value: Data, postfix: Expression | null, context: ExecContext): void {
      if (postfix) {
          console.error(`SetDataValue: Scalar data does not support postfix`, postfix);
          return;
      }

      if (!(value instanceof ScalarData)) {
          console.error(`SetDataValue: Invalid value`, value);
          return;
      }

      let v = value.value;

      if (this.typeInfo.name === "i32" || this.typeInfo.name === "u32") {
          v = Math.floor(v);
      } else if (this.typeInfo.name === "bool") {
          v = v ? 1 : 0;
      }

      this.value = value.value;
  }

  getDataValue(exec: ExecInterface, postfix: Expression | null, context: ExecContext): Data | null {
      if (postfix) {
          console.error(`GetDataValue: Scalar data does not support postfix`, postfix);
          return null;
      }

      return this;
  }

  toString(): string {
      return `${this.value}`;
  }
}

function _getVectorData(exec: ExecInterface, values: number[], formatName: string): VectorData | null {
  const size = values.length;
  if (size === 2) {
      if (formatName === "f32") {
          return new VectorData(values, exec.getTypeInfo("vec2f"));
      } else if (formatName === "i32") {
          return new VectorData(values, exec.getTypeInfo("vec2i"));
      } else if (formatName === "u32") {
          return new VectorData(values, exec.getTypeInfo("vec2u"));
      } else if (formatName === "f16") {
          return new VectorData(values, exec.getTypeInfo("vec2h"));
      } else {
          console.error(`GetDataValue: Unknown format ${formatName}`);
      }
      return null;
  }

  if (size === 3) {
      if (formatName === "f32") {
          return new VectorData(values, exec.getTypeInfo("vec3f"));
      } else if (formatName === "i32") {
          return new VectorData(values, exec.getTypeInfo("vec3i"));
      } else if (formatName === "u32") {
          return new VectorData(values, exec.getTypeInfo("vec3u"));
      } else if (formatName === "f16") {
          return new VectorData(values, exec.getTypeInfo("vec3h"));
      } else {
          console.error(`GetDataValue: Unknown format ${formatName}`);
      }
      return null;
  }

  if (size === 4) {
      if (formatName === "f32") {
          return new VectorData(values, exec.getTypeInfo("vec4f"));
      } else if (formatName === "i32") {
          return new VectorData(values, exec.getTypeInfo("vec4i"));
      } else if (formatName === "u32") {
          return new VectorData(values, exec.getTypeInfo("vec4u"));
      } else if (formatName === "f16") {
          return new VectorData(values, exec.getTypeInfo("vec4h"));
      }
      console.error(`GetDataValue: Unknown format ${formatName}`);
      return null;
  }

  console.error(`GetDataValue: Invalid vector size ${values.length}`);
  return null;
}

export class VectorData extends Data {
  value: number[];

  constructor(value: number[] | Float32Array | Uint32Array | Int32Array, typeInfo: TypeInfo) {
      super(typeInfo);
      if (Array.isArray(value)) {
          this.value = value;
      } else {
          this.value = Array.from(value);
      }
  }

  setDataValue(exec: ExecInterface, value: Data, postfix: Expression | null, context: ExecContext): void {
      if (postfix instanceof StringExpr) {
          console.error("TODO: Set vector postfix");
          return;
      }

      if (!(value instanceof VectorData)) {
          console.error(`SetDataValue: Invalid value`, value);
          return
      }

      this.value = value.value;
  }

  getDataValue(exec: ExecInterface, postfix: Expression | null, context: ExecContext): Data | null {
      let format = exec.getTypeInfo("f32");
      if (this.typeInfo instanceof TemplateInfo) {
          format = this.typeInfo.format;
      } else {
          const typeName = this.typeInfo.name;
          if (typeName === "vec2f" || typeName === "vec3f" || typeName === "vec4f") {
              format = exec.getTypeInfo("f32");
          } else if (typeName === "vec2i" || typeName === "vec3i" || typeName === "vec4i") {
              format = exec.getTypeInfo("i32");
          } else if (typeName === "vec2u" || typeName === "vec3u" || typeName === "vec4u") {
              format = exec.getTypeInfo("u32");
          } else if ( typeName === "vec2h" || typeName === "vec3h" || typeName === "vec4h") {
              format = exec.getTypeInfo("f16");
          } else {
              console.error(`GetDataValue: Unknown type ${typeName}`);
          }
      }

      if (postfix instanceof ArrayIndex) {
          const idx = postfix.index;
          let i = -1;
          if (idx instanceof LiteralExpr) {
              if (idx.value instanceof ScalarData) {
                  i = idx.value.value;
              } else {
                  console.error(`GetValueData: Invalid array index ${idx.value}`);
                  return null;
              }
          } else {
              const d = exec.evalExpression(idx, context);
              if (d instanceof ScalarData) {
                  i = d.value;
              } else {
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
              } else if (m === "y" || m === "g") {
                  values.push(this.value[1]);
              } else if (m === "z" || m === "b") {
                  values.push(this.value[2]);
              } else if (m === "w" || m === "a") {
                  values.push(this.value[3]);
              } else {
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

  toString(): string {
      let s = `${this.value[0]}`;
      for (let i = 1; i < this.value.length; ++i) {
          s += `, ${this.value[i]}`;
      }
      return s;
  }
}

export class MatrixData extends Data {
  value: number[];

  constructor(value: number[], typeInfo: TypeInfo) {
      super(typeInfo);
      this.value = value;
  }

  setDataValue(exec: ExecInterface, value: Data, postfix: Expression | null, context: ExecContext): void {
      if (postfix instanceof StringExpr) {
          console.error("TODO: Set matrix postfix");
          return;
      }

      if (!(value instanceof MatrixData)) {
          console.error(`SetDataValue: Invalid value`, value);
          return
      }

      this.value = value.value;
  }

  getDataValue(exec: ExecInterface, postfix: Expression | null, context: ExecContext): Data | null {
      const typeName = this.typeInfo.name;
      let format = exec.getTypeInfo("f32");
      if (this.typeInfo instanceof TemplateInfo) {
          format = this.typeInfo.format;
      } else {
          if (typeName.endsWith("f")) {
              format = exec.getTypeInfo("f32");
          } else if (typeName.endsWith("i")) {
              format = exec.getTypeInfo("i32");
          } else if (typeName.endsWith("u")) {
              format = exec.getTypeInfo("u32");
          } else if ( typeName.endsWith("h")) {
              format = exec.getTypeInfo("f16");
          } else {
              console.error(`GetDataValue: Unknown type ${typeName}`);
              return null;
          }
      }

      if (postfix instanceof ArrayIndex) {
          const idx = postfix.index;
          let i = -1;
          if (idx instanceof LiteralExpr) {
              if (idx.value instanceof ScalarData) {
                  i = idx.value.value;
              } else {
                  console.error(`GetDataValue: Invalid array index ${idx.value}`);
                  return null;
              }
          } else {
              const d = exec.evalExpression(idx, context);
              if (d instanceof ScalarData) {
                  i = d.value;
              } else {
                  console.error(`GetDataValue: Unknown index type`, idx);
                  return null;
              }
          }
          if (i < 0 || i >= this.value.length) {
              console.error(`GetDataValue: Index out of range`, i);
              return null;
          }

          let values: number[];
          if (typeName === "mat2x2" || typeName === "mat2x2f" || typeName === "mat2x2h") {
              values = this.value.slice(i * 2, i * 2 + 2);
          } else if (typeName === "mat2x3" || typeName === "mat2x3f" || typeName === "mat2x3h") {
              values = this.value.slice(i * 3, i * 3 + 3);
          } else if (typeName === "mat2x4" || typeName === "mat2x4f" || typeName === "mat2x4h") {
              values = this.value.slice(i * 4, i * 4 + 4);
          } else if (typeName === "mat3x2" || typeName === "mat3x2f" || typeName === "mat3x2h") {
              values = this.value.slice(i * 2, i * 2 + 2);
          } else if (typeName === "mat3x3" || typeName === "mat3x3f" || typeName === "mat3x3h") {
              values = this.value.slice(i * 3, i * 3 + 3);
          } else if (typeName === "mat3x4" || typeName === "mat3x4f" || typeName === "mat3x4h") {
              values = this.value.slice(i * 4, i * 4 + 4);
          } else if (typeName === "mat4x2" || typeName === "mat4x2f" || typeName === "mat4x2h") {
              values = this.value.slice(i * 2, i * 2 + 2);
          } else if (typeName === "mat4x3" || typeName === "mat4x3f" || typeName === "mat4x3h") {
              values = this.value.slice(i * 3, i * 3 + 3);
          } else if (typeName === "mat4x4" || typeName === "mat4x4f" || typeName === "mat4x4h") {
              values = this.value.slice(i * 4, i * 4 + 4);
          } else {
              console.error(`GetDataValue: Unknown type ${typeName}`);
              return null;
          }

          const vecData = _getVectorData(exec, values, format.name);
          if (postfix.postfix) {
              return vecData.getDataValue(exec, postfix.postfix, context);
          }
      }

      return this;
  }

  toString(): string {
      let s = `${this.value[0]}`;
      for (let i = 1; i < this.value.length; ++i) {
          s += `, ${this.value[i]}`;
      }
      return s;
  }
}

// Used to store array and struct data
export class TypedData extends Data {
  buffer: ArrayBuffer;
  offset: number;
  textureSize: number[] = [0, 0, 0];

  constructor(data: ArrayBuffer | Float32Array | Uint32Array | Int32Array | Uint8Array | Int8Array,
      typeInfo: TypeInfo, offset: number = 0, textureSize?: number[]) {
      super(typeInfo);
      this.buffer = data instanceof ArrayBuffer ? data : data.buffer;
      this.offset = offset;
      if (textureSize !== undefined) {
          this.textureSize = textureSize;
      }
  }

  setDataValue(exec: ExecInterface, value: Data, postfix: Expression | null, context: ExecContext): void {
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
                      if (idx.value instanceof ScalarData) {
                          offset += idx.value.value * typeInfo.stride;
                      } else {
                          console.error(`SetDataValue: Invalid index type ${idx.value}`);
                          return;
                      }
                  } else {
                      const i = exec.evalExpression(idx, context);
                      if (i instanceof ScalarData) {
                          offset += i.value * typeInfo.stride;
                      } else {
                          console.error(`SetDataValue: Unknown index type`, idx);
                          return;
                      }
                  }
                  typeInfo = typeInfo.format;
              } else {
                  console.error(`SetDataValue: Type ${exec.getTypeName(typeInfo)} is not an array`);
              }
          } else if (postfix instanceof StringExpr) {
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
              } else if (typeInfo instanceof TypeInfo) {
                  const typeName = exec.getTypeName(typeInfo);
                  let element = 0;
                  if (member === "x" || member === "r") {
                      element = 0;
                  } else if (member === "y" || member === "g") {
                      element = 1;
                  } else if (member === "z" || member === "b") {
                      element = 2;
                  } else if (member === "w" || member === "a") {
                      element = 3;
                  } else {
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
                  } else if (typeName === "vec3f") {
                      new Float32Array(this.buffer, offset, 3)[element] = v;
                      return;
                  } else if (typeName === "vec4f") {
                      new Float32Array(this.buffer, offset, 4)[element] = v;
                      return;
                  } else if (typeName === "vec2i") {
                      new Int32Array(this.buffer, offset, 2)[element] = v;
                      return;
                  } else if (typeName === "vec3i") {
                      new Int32Array(this.buffer, offset, 3)[element] = v;
                      return;
                  } else if (typeName === "vec4i") {
                      new Int32Array(this.buffer, offset, 4)[element] = v;
                      return;
                  } else if (typeName === "vec2u") {
                      new Uint32Array(this.buffer, offset, 2)[element] = v;
                      return;
                  } else if (typeName === "vec3u") {
                      new Uint32Array(this.buffer, offset, 3)[element] = v;
                      return;
                  } else if (typeName === "vec4u") {
                      new Uint32Array(this.buffer, offset, 4)[element] = v;
                      return;
                  }
                  console.error(`SetDataValue: Type ${typeName} is not a struct`);
                  return;
              }
          } else {
              console.error(`SetDataValue: Unknown postfix type`, postfix);
              return;
          }
          postfix = postfix.postfix;
      }

      this.setData(exec, value, typeInfo, offset, context);
  }

  setData(exec: ExecInterface, value: Data, typeInfo: TypeInfo, offset: number, context: ExecContext): void {
      const typeName = exec.getTypeName(typeInfo);

      if (typeName === "f32" || typeName === "f16") {
          if (value instanceof ScalarData) {
              new Float32Array(this.buffer, offset, 1)[0] = value.value;
          }
          return;
      } else if (typeName === "i32" || typeName === "atomic<i32>" || typeName === "x32") {
          if (value instanceof ScalarData) {
              new Int32Array(this.buffer, offset, 1)[0] = value.value;
          }
          return;
      } else if (typeName === "u32" || typeName === "atomic<u32>") {
          if (value instanceof ScalarData) {
              new Uint32Array(this.buffer, offset, 1)[0] = value.value;
          }
          return;
      } else if (typeName === "bool") {
          if (value instanceof ScalarData) {
              new Int32Array(this.buffer, offset, 1)[0] = value.value;
          }
          return;
      } else if (typeName === "vec2f" || typeName === "vec2h") {
          const x = new Float32Array(this.buffer, offset, 2);
          if (value instanceof VectorData) {
              x[0] = value.value[0];
              x[1] = value.value[1];
          } else {
              x[0] = value[0];
              x[1] = value[1];
          }
          return;
      } else if (typeName === "vec3f" || typeName === "vec3h") {
          const x = new Float32Array(this.buffer, offset, 3);
          if (value instanceof VectorData) {
              x[0] = value.value[0];
              x[1] = value.value[1];
              x[2] = value.value[2];
          } else {
              x[0] = value[0];
              x[1] = value[1];
              x[2] = value[2];
          }
          return;
      } else if (typeName === "vec4f" || typeName === "vec4h") {
          const x = new Float32Array(this.buffer, offset, 4);
          if (value instanceof VectorData) {
              x[0] = value.value[0];
              x[1] = value.value[1];
              x[2] = value.value[2];
              x[3] = value.value[3];
          } else {
              x[0] = value[0];
              x[1] = value[1];
              x[2] = value[2];
              x[3] = value[3];
          }
          return;
      } else if (typeName === "vec2i") {
          const x = new Int32Array(this.buffer, offset, 2);
          if (value instanceof VectorData) {
              x[0] = value.value[0];
              x[1] = value.value[1];
          } else {
              x[0] = value[0];
              x[1] = value[1];
          }
          return;
      } else if (typeName === "vec3i") {
          const x = new Int32Array(this.buffer, offset, 3);
          if (value instanceof VectorData) {
              x[0] = value.value[0];
              x[1] = value.value[1];
              x[2] = value.value[2];
          } else {
              x[0] = value[0];
              x[1] = value[1];
              x[2] = value[2];
          }
          return;
      } else if (typeName === "vec4i") {
          const x = new Int32Array(this.buffer, offset, 4);
          if (value instanceof VectorData) {
              x[0] = value.value[0];
              x[1] = value.value[1];
              x[2] = value.value[2];
              x[3] = value.value[3];
          } else {
              x[0] = value[0];
              x[1] = value[1];
              x[2] = value[2];
              x[3] = value[3];
          }
          return;
      } else if (typeName === "vec2u") {
          const x = new Uint32Array(this.buffer, offset, 2);
          if (value instanceof VectorData) {
              x[0] = value.value[0];
              x[1] = value.value[1];
          } else {
              x[0] = value[0];
              x[1] = value[1];
          }
          return;
      } else if (typeName === "vec3u") {
          const x = new Uint32Array(this.buffer, offset, 3);
          if (value instanceof VectorData) {
              x[0] = value.value[0];
              x[1] = value.value[1];
              x[2] = value.value[2];
          } else {
              x[0] = value[0];
              x[1] = value[1];
              x[2] = value[2];
          }
          return;
      } else if (typeName === "vec4u") {
          const x = new Uint32Array(this.buffer, offset, 4);
          if (value instanceof VectorData) {
              x[0] = value.value[0];
              x[1] = value.value[1];
              x[2] = value.value[2];
              x[3] = value.value[3];
          } else {
              x[0] = value[0];
              x[1] = value[1];
              x[2] = value[2];
              x[3] = value[3];
          }
          return;
      } else if (typeName === "vec2b") {
          const x = new Uint32Array(this.buffer, offset, 2);
          if (value instanceof VectorData) {
              x[0] = value.value[0];
              x[1] = value.value[1];
          } else {
              x[0] = value[0];
              x[1] = value[1];
          }
          return;
      } else if (typeName === "vec3b") {
          const x = new Uint32Array(this.buffer, offset, 3);
          if (value instanceof VectorData) {
              x[0] = value.value[0];
              x[1] = value.value[1];
              x[2] = value.value[2];
          } else {
              x[0] = value[0];
              x[1] = value[1];
              x[2] = value[2];
          }
          return;
      } else if (typeName === "vec4b") {
          const x = new Uint32Array(this.buffer, offset, 4);
          if (value instanceof VectorData) {
              x[0] = value.value[0];
              x[1] = value.value[1];
              x[2] = value.value[2];
              x[3] = value.value[3];
          } else {
              x[0] = value[0];
              x[1] = value[1];
              x[2] = value[2];
              x[3] = value[3];
          }
          return;
      } else if (typeName === "mat2x2f" || typeName === "mat2x2h") {
          const x = new Float32Array(this.buffer, offset, 4);
          if (value instanceof MatrixData) {
              x[0] = value.value[0];
              x[1] = value.value[1];
              x[2] = value.value[2];
              x[3] = value.value[3];
          } else {
              x[0] = value[0];
              x[1] = value[1];
              x[2] = value[2];
              x[3] = value[3];
          }
          return;
      } else if (typeName === "mat2x3f" || typeName === "mat2x3h") {
          const x = new Float32Array(this.buffer, offset, 6);
          if (value instanceof MatrixData) {
              x[0] = value.value[0];
              x[1] = value.value[1];
              x[2] = value.value[2];
              x[3] = value.value[3];
              x[4] = value.value[4];
              x[5] = value.value[5];
          } else {
              x[0] = value[0];
              x[1] = value[1];
              x[2] = value[2];
              x[3] = value[3];
              x[4] = value[4];
              x[5] = value[5];
          }
          return;
      } else if (typeName === "mat2x4f" || typeName === "mat2x4h") {
          const x = new Float32Array(this.buffer, offset, 8);
          if (value instanceof MatrixData) {
              x[0] = value.value[0];
              x[1] = value.value[1];
              x[2] = value.value[2];
              x[3] = value.value[3];
              x[4] = value.value[4];
              x[5] = value.value[5];
              x[6] = value.value[6];
              x[7] = value.value[7];
          } else {
              x[0] = value[0];
              x[1] = value[1];
              x[2] = value[2];
              x[3] = value[3];
              x[4] = value[4];
              x[5] = value[5];
              x[6] = value[6];
              x[7] = value[7];
          }
          return;
      } else if (typeName === "mat3x2f" || typeName === "mat3x2h") {
          const x = new Float32Array(this.buffer, offset, 6);
          if (value instanceof MatrixData) {
              x[0] = value.value[0];
              x[1] = value.value[1];
              x[2] = value.value[2];
              x[3] = value.value[3];
              x[4] = value.value[4];
              x[5] = value.value[5];
          } else {
              x[0] = value[0];
              x[1] = value[1];
              x[2] = value[2];
              x[3] = value[3];
              x[4] = value[4];
              x[5] = value[5];
          }
          return;
      } else if (typeName === "mat3x3f" || typeName === "mat3x3h") {
          const x = new Float32Array(this.buffer, offset, 9);
          if (value instanceof MatrixData) {
              x[0] = value.value[0];
              x[1] = value.value[1];
              x[2] = value.value[2];
              x[3] = value.value[3];
              x[4] = value.value[4];
              x[5] = value.value[5];
              x[6] = value.value[6];
              x[7] = value.value[7];
              x[8] = value.value[8];
          } else {
              x[0] = value[0];
              x[1] = value[1];
              x[2] = value[2];
              x[3] = value[3];
              x[4] = value[4];
              x[5] = value[5];
              x[6] = value[6];
              x[7] = value[7];
              x[8] = value[8];
          }
          return;
      } else if (typeName === "mat3x4f" || typeName === "mat3x4h") {
          const x = new Float32Array(this.buffer, offset, 12);
          if (value instanceof MatrixData) {
              x[0] = value.value[0];
              x[1] = value.value[1];
              x[2] = value.value[2];
              x[3] = value.value[3];
              x[4] = value.value[4];
              x[5] = value.value[5];
              x[6] = value.value[6];
              x[7] = value.value[7];
              x[8] = value.value[8];
              x[9] = value.value[9];
              x[10] = value.value[10];
              x[11] = value.value[11];
          } else {
              x[0] = value[0];
              x[1] = value[1];
              x[2] = value[2];
              x[3] = value[3];
              x[4] = value[4];
              x[5] = value[5];
              x[6] = value[6];
              x[7] = value[7];
              x[8] = value[8];
              x[9] = value[9];
              x[10] = value[10];
              x[11] = value[11];
          }
          return;
      } else if (typeName === "mat4x2f" || typeName === "mat4x2h") {
          const x = new Float32Array(this.buffer, offset, 8);
          if (value instanceof MatrixData) {
              x[0] = value.value[0];
              x[1] = value.value[1];
              x[2] = value.value[2];
              x[3] = value.value[3];
              x[4] = value.value[4];
              x[5] = value.value[5];
              x[6] = value.value[6];
              x[7] = value.value[7];
          } else {
              x[0] = value[0];
              x[1] = value[1];
              x[2] = value[2];
              x[3] = value[3];
              x[4] = value[4];
              x[5] = value[5];
              x[6] = value[6];
              x[7] = value[7];
          }
          return;
      } else if (typeName === "mat4x3f" || typeName === "mat4x3h") {
          const x = new Float32Array(this.buffer, offset, 12);
          if (value instanceof MatrixData) {
              x[0] = value.value[0];
              x[1] = value.value[1];
              x[2] = value.value[2];
              x[3] = value.value[3];
              x[4] = value.value[4];
              x[5] = value.value[5];
              x[6] = value.value[6];
              x[7] = value.value[7];
              x[8] = value.value[8];
              x[9] = value.value[9];
              x[10] = value.value[10];
              x[11] = value.value[11];
          } else {
              x[0] = value[0];
              x[1] = value[1];
              x[2] = value[2];
              x[3] = value[3];
              x[4] = value[4];
              x[5] = value[5];
              x[6] = value[6];
              x[7] = value[7];
              x[8] = value[8];
              x[9] = value[9];
              x[10] = value[10];
              x[11] = value[11];
          }
          return;
      } else if (typeName === "mat4x4f" || typeName === "mat4x4h") {
          const x = new Float32Array(this.buffer, offset, 16);
          if (value instanceof MatrixData) {
              x[0] = value.value[0];
              x[1] = value.value[1];
              x[2] = value.value[2];
              x[3] = value.value[3];
              x[4] = value.value[4];
              x[5] = value.value[5];
              x[6] = value.value[6];
              x[7] = value.value[7];
              x[8] = value.value[8];
              x[9] = value.value[9];
              x[10] = value.value[10];
              x[11] = value.value[11];
              x[12] = value.value[12];
              x[13] = value.value[13];
              x[14] = value.value[14];
              x[15] = value.value[15];
          } else {
              x[0] = value[0];
              x[1] = value[1];
              x[2] = value[2];
              x[3] = value[3];
              x[4] = value[4];
              x[5] = value[5];
              x[6] = value[6];
              x[7] = value[7];
              x[8] = value[8];
              x[9] = value[9];
              x[10] = value[10];
              x[11] = value[11];
              x[12] = value[12];
              x[13] = value[13];
              x[14] = value[14];
              x[15] = value[15];
          }
          return;
      }

      if (value instanceof TypedData) {
          if (typeInfo === value.typeInfo) {
              const x = new Uint8Array(this.buffer, offset, value.buffer.byteLength);
              x.set(new Uint8Array(value.buffer));
              return;
          } else {
              console.error(`SetDataValue: Type mismatch`, typeName, exec.getTypeName(value.typeInfo));
              return;
          }
      }

      console.error(`SetData: Unknown type ${typeName}`);
  }

  getDataValue(exec: ExecInterface, postfix: Expression | null, context: ExecContext): Data | null {
      let offset = this.offset;
      let typeInfo = this.typeInfo;
      while (postfix) {
          if (postfix instanceof ArrayIndex) {
            const idx = postfix.index;
            const _i = exec.evalExpression(idx, context);
            let i = 0;
            if (_i instanceof ScalarData) {
                i = _i.value;
            } else {
                console.error(`GetDataValue: Invalid index type`, idx);
            }
            if (typeInfo instanceof ArrayInfo) {
                offset += i * typeInfo.stride;
                typeInfo = typeInfo.format;
            } else {
                const typeName = exec.getTypeName(typeInfo);
                if (typeName === "mat4x4" || typeName === "mat4x4f" || typeName === "mat4x4h") {
                  offset += i * 16;
                  typeInfo = exec.getTypeInfo("vec4f");
                } else {
                    console.error(`getDataValue: Type ${exec.getTypeName(typeInfo)} is not an array`);
                }
            }
          } else if (postfix instanceof StringExpr) {
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
              } else if (typeInfo instanceof TypeInfo) {
                  const typeName = exec.getTypeName(typeInfo);
                  if (typeName === "vec2f" || typeName === "vec3f" || typeName === "vec4f" ||
                      typeName === "vec2i" || typeName === "vec3i" || typeName === "vec4i" ||
                      typeName === "vec2u" || typeName === "vec3u" || typeName === "vec4u" ||
                      typeName === "vec2b" || typeName === "vec3b" || typeName === "vec4b" ||
                      typeName === "vec2h" || typeName === "vec3h" || typeName === "vec4h" ||
                      typeName === "vec2" || typeName === "vec3" || typeName === "vec4") {

                      if (member.length > 0 && member.length < 5) {
                          let formatName = "f32";
                          let formatSuffix = "f";
                          const value = [];
                          for (let i = 0; i < member.length; ++i) {
                              const m = member[i].toLocaleLowerCase();
                              let element = 0;
                              if (m === "x" || m === "r") {
                                  element = 0;
                              } else if (m === "y" || m === "g") {
                                  element = 1;
                              } else if (m === "z" || m === "b") {
                                  element = 2;
                              } else if (m === "w" || m === "a") {
                                  element = 3;
                              } else {
                                  console.error(`Unknown member ${member}`);
                                  return null;
                              }
                              if (typeName === "vec2f") {
                                  value.push(new Float32Array(this.buffer, offset, 2)[element]);
                              } else if (typeName === "vec3f") {
                                  if ((offset + 12) >= this.buffer.byteLength) {
                                      console.log("Insufficient buffer data");
                                      return null;
                                  }
                                  const fa = new Float32Array(this.buffer, offset, 3);
                                  value.push(fa[element]);
                              } else if (typeName === "vec4f") {
                                  value.push(new Float32Array(this.buffer, offset, 4)[element]);
                              } else if (typeName === "vec2i") {
                                  formatName = "i32";
                                  formatSuffix = "i";
                                  value.push(new Int32Array(this.buffer, offset, 2)[element]);
                              } else if (typeName === "vec3i") {
                                  formatName = "i32";
                                  formatSuffix = "i";
                                  value.push(new Int32Array(this.buffer, offset, 3)[element]);
                              } else if (typeName === "vec4i") {
                                  formatName = "i32";
                                  formatSuffix = "i";
                                  value.push(new Int32Array(this.buffer, offset, 4)[element]);
                              } else if (typeName === "vec2u") {
                                  formatName = "u32";
                                  formatSuffix = "u";
                                  const ua = new Uint32Array(this.buffer, offset, 2);
                                  value.push(ua[element]);
                              } else if (typeName === "vec3u") {
                                  formatName = "u32";
                                  formatSuffix = "u";
                                  value.push(new Uint32Array(this.buffer, offset, 3)[element]);
                              } else if (typeName === "vec4u") {
                                  formatName = "u32";
                                  formatSuffix = "u";
                                  value.push(new Uint32Array(this.buffer, offset, 4)[element]);
                              }
                          }

                          if (value.length === 1) {
                              return new ScalarData(value[0], exec.getTypeInfo(formatName));
                          }

                          if (value.length === 2) {
                            typeInfo = exec.getTypeInfo(`vec2${formatSuffix}`);
                          } else if (value.length === 3) {
                            typeInfo = exec.getTypeInfo(`vec3${formatSuffix}`);
                          } else if (value.length === 4) {
                            typeInfo = exec.getTypeInfo(`vec4${formatSuffix}`);
                          } else {
                            console.error(`GetDataValue: Invalid vector length ${value.length}`);
                          }

                          return new VectorData(value, typeInfo);
                      } else {
                          console.error(`GetDataValue: Unknown member ${member}`);
                          return null;
                      }
                  }

                  console.error(`GetDataValue: Type ${typeName} is not a struct`);
                  return null;
              }
          } else {
              console.error(`GetDataValue: Unknown postfix type`, postfix);
              return null;
          }
          postfix = postfix.postfix;
      }

      const typeName = exec.getTypeName(typeInfo);

      if (typeName === "f32") {
          return new ScalarData(new Float32Array(this.buffer, offset, 1)[0], typeInfo);
      } else if (typeName === "i32") {
          return new ScalarData(new Int32Array(this.buffer, offset, 1)[0], typeInfo);
      } else if (typeName === "u32") {
          return new ScalarData(new Uint32Array(this.buffer, offset, 1)[0], typeInfo);
      } else if (typeName === "vec2f") {
          return new VectorData(new Float32Array(this.buffer, offset, 2), typeInfo);
      } else if (typeName === "vec3f") {
          return new VectorData(new Float32Array(this.buffer, offset, 3), typeInfo);
      } else if (typeName === "vec4f") {
          return new VectorData(new Float32Array(this.buffer, offset, 4), typeInfo);
      } else if (typeName === "vec2i") {
          return new VectorData(new Int32Array(this.buffer, offset, 2), typeInfo);
      } else if (typeName === "vec3i") {
          return new VectorData(new Int32Array(this.buffer, offset, 3), typeInfo);
      } else if (typeName === "vec4i") {
          return new VectorData(new Int32Array(this.buffer, offset, 4), typeInfo);
      } else if (typeName === "vec2u") {
          return new VectorData(new Uint32Array(this.buffer, offset, 2), typeInfo);
      } else if (typeName === "vec3u") {
          return new VectorData(new Uint32Array(this.buffer, offset, 3), typeInfo);
      } else if (typeName === "vec4u") {
          return new VectorData(new Uint32Array(this.buffer, offset, 4), typeInfo);
      }

      if (typeInfo instanceof TemplateInfo && typeInfo.name === "atomic") {
          if (typeInfo.format.name === "u32") {
              return new ScalarData(new Uint32Array(this.buffer, offset, 1)[0], typeInfo.format);
          } else if (typeInfo.format.name === "i32") {
              return new ScalarData(new Int32Array(this.buffer, offset, 1)[0], typeInfo.format);
          } else {
              console.error(`GetDataValue: Invalid atomic format ${typeInfo.format.name}`);
              return null;
          }
      }

      return new TypedData(this.buffer, typeInfo, offset);
  }

  toString(): string {
      let s = "";
      if (this.typeInfo instanceof ArrayInfo) {
          if (this.typeInfo.format.name === "f32") {
              const fa = new Float32Array(this.buffer, this.offset);
              s = `[${fa[0]}`;
              for (let i = 1; i < fa.length; ++i) {
                  s += `, ${fa[i]}`;
              }
          } else if (this.typeInfo.format.name === "i32") {
              const fa = new Int32Array(this.buffer, this.offset);
              s = `[${fa[0]}`;
              for (let i = 1; i < fa.length; ++i) {
                  s += `, ${fa[i]}`;
              }
          } else if (this.typeInfo.format.name === "u32") {
              const fa = new Uint32Array(this.buffer, this.offset);
              s = `[${fa[0]}`;
              for (let i = 1; i < fa.length; ++i) {
                  s += `, ${fa[i]}`;
              }
          } else if (this.typeInfo.format.name === "vec2f") {
              const fa = new Float32Array(this.buffer, this.offset);
              s = `[${fa[0]}, ${fa[1]}]`;
              for (let i = 1; i < fa.length / 2; ++i) {
                  s += `, [${fa[i * 2]}, ${fa[i * 2 + 1]}]`;
              }
          } else if (this.typeInfo.format.name === "vec3f") {
              const fa = new Float32Array(this.buffer, this.offset);
              s = `[${fa[0]}, ${fa[1]}, ${fa[2]}]`;
              for (let i = 4; i < fa.length; i += 4) {
                  s += `, [${fa[i]}, ${fa[i + 1]}, ${fa[i + 2]}]`;
              }
          } else if (this.typeInfo.format.name === "vec4f") {
              const fa = new Float32Array(this.buffer, this.offset);
              s = `[${fa[0]}, ${fa[1]}, ${fa[2]}, ${fa[3]}]`;
              for (let i = 4; i < fa.length; i += 4) {
                  s += `, [${fa[i]}, ${fa[i + 1]}, ${fa[i + 2]}, ${fa[i + 3]}]`;
              }
          } else {
              s = `[...]`;
          }
      } else if (this.typeInfo instanceof StructInfo) {
          s += `{...}`;
      } else {
          s = `[...]`;
      }
      return s;
  }
}
