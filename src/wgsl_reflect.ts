/**
 * @author Brendan Duncan / https://github.com/brendan-duncan
 */
import { WgslParser } from "./wgsl_parser.js";
import { TokenTypes } from "./wgsl_scanner.js";
import * as AST from "./wgsl_ast.js";

export class TypeInfo {
  name: string;
  attributes: Array<AST.Attribute> | null;
  size: number;

  constructor(name: string, attributes: Array<AST.Attribute> | null) {
    this.name = name;
    this.attributes = attributes;
    this.size = 0;
  }

  get isArray(): boolean {
    return false;
  }

  get isStruct(): boolean {
    return false;
  }
}

export class MemberInfo {
  name: string;
  type: TypeInfo;
  attributes: Array<AST.Attribute> | null;
  offset: number;
  size: number;

  constructor(
    name: string,
    type: TypeInfo,
    attributes: Array<AST.Attribute> | null
  ) {
    this.name = name;
    this.type = type;
    this.attributes = attributes;
    this.offset = 0;
    this.size = 0;
  }
}

export class StructInfo extends TypeInfo {
  members: Array<MemberInfo>;
  align: number;

  constructor(name: string, attributes: Array<AST.Attribute> | null) {
    super(name, attributes);
    this.members = [];
    this.align = 0;
  }

  get isStruct(): boolean {
    return true;
  }
}

export class ArrayInfo extends TypeInfo {
  format: TypeInfo;
  count: number;
  stride: number;

  constructor(name: string, attributes: Array<AST.Attribute> | null) {
    super(name, attributes);
    this.count = 0;
    this.stride = 0;
  }

  get isArray(): boolean {
    return true;
  }
}

export enum ResourceType {
  Uniform,
  Storage,
  Texture,
  Sampler,
}

export class VariableInfo {
  attributes: Array<AST.Attribute> | null;
  name: string;
  type: TypeInfo;
  group: number;
  binding: number;
  resourceType: ResourceType;

  constructor(
    name: string,
    type: TypeInfo,
    group: number,
    binding: number,
    attributes: Array<AST.Attribute> | null,
    resourceType: ResourceType
  ) {
    this.name = name;
    this.type = type;
    this.group = group;
    this.binding = binding;
    this.attributes = attributes;
    this.resourceType = resourceType;
  }
}

export class AliasInfo {
  name: string;
  type: TypeInfo;

  constructor(name: string, type: TypeInfo) {
    this.name = name;
    this.type = type;
  }
}

class _TypeSize {
  align: number;
  size: number;

  constructor(align: number, size: number) {
    this.align = align;
    this.size = size;
  }
}

export class InputInfo {
  name: string;
  type: TypeInfo | null;
  locationType: string;
  location: number | string;
  interpolation: string | null;

  constructor(
    name: string,
    type: TypeInfo | null,
    locationType: string,
    location: number | string
  ) {
    this.name = name;
    this.type = type;
    this.locationType = locationType;
    this.location = location;
    this.interpolation = null;
  }
}

export class OutputInfo {
  name: string;
  type: TypeInfo | null;
  locationType: string;
  location: number | string;

  constructor(
    name: string,
    type: TypeInfo | null,
    locationType: string,
    location: number | string
  ) {
    this.name = name;
    this.type = type;
    this.locationType = locationType;
    this.location = location;
  }
}

export class FunctionInfo {
  name: string;
  stage: string | null = null;
  inputs: Array<InputInfo> = [];
  outputs: Array<OutputInfo> = [];

  constructor(name: string, stage: string | null = null) {
    this.name = name;
    this.stage = stage;
  }
}

export class EntryFunctions {
  vertex: Array<FunctionInfo> = [];
  fragment: Array<FunctionInfo> = [];
  compute: Array<FunctionInfo> = [];
}

export class BindGropEntry {
  type: string;
  resource: VariableInfo;

  constructor(type: string, resource: VariableInfo) {
    this.type = type;
    this.resource = resource;
  }
}

export class WgslReflect {
  /// All top-level uniform vars in the shader.
  uniforms: Array<VariableInfo> = [];
  /// All top-level storage vars in the shader.
  storage: Array<VariableInfo> = [];
  /// All top-level texture vars in the shader;
  textures: Array<VariableInfo> = [];
  // All top-level sampler vars in the shader.
  samplers: Array<VariableInfo> = [];
  /// All top-level type aliases in the shader.
  aliases: Array<AliasInfo> = [];
  /// All top-level structs in the shader.
  structs: Array<StructInfo> = [];
  /// All entry functions in the shader: vertex, fragment, and/or compute.
  entryPoints: EntryFunctions = new EntryFunctions();

  _types: Map<AST.Type, TypeInfo> = new Map();

  constructor(code: string | undefined) {
    if (code) {
      this.update(code);
    }
  }

  update(code: string) {
    const parser = new WgslParser();
    const ast = parser.parse(code);

    for (const node of ast) {
      if (node.astNodeType == "struct") {
        const info = this._getTypeInfo(node as AST.Struct, null);
        if (info instanceof StructInfo) {
          this.structs.push(info as StructInfo);
        }
      }

      if (node.astNodeType == "alias") {
        this.aliases.push(this._getAliasInfo(node as AST.Alias));
      }

      if (this._isUniformVar(node)) {
        const v = node as AST.Var;
        const g = this._getAttributeNum(v.attributes, "group", 0);
        const b = this._getAttributeNum(v.attributes, "binding", 0);
        const type = this._getTypeInfo(v.type!, v.attributes);
        const varInfo = new VariableInfo(
          v.name,
          type,
          g,
          b,
          v.attributes,
          ResourceType.Uniform
        );
        this.uniforms.push(varInfo);
      }

      if (this._isStorageVar(node)) {
        const v = node as AST.Var;
        const g = this._getAttributeNum(v.attributes, "group", 0);
        const b = this._getAttributeNum(v.attributes, "binding", 0);
        const type = this._getTypeInfo(v.type!, v.attributes);
        const varInfo = new VariableInfo(
          v.name,
          type,
          g,
          b,
          v.attributes,
          ResourceType.Storage
        );
        this.storage.push(varInfo);
      }

      if (this._isTextureVar(node)) {
        const v = node as AST.Var;
        const g = this._getAttributeNum(v.attributes, "group", 0);
        const b = this._getAttributeNum(v.attributes, "binding", 0);
        const type = this._getTypeInfo(v.type!, v.attributes);
        const varInfo = new VariableInfo(
          v.name,
          type,
          g,
          b,
          v.attributes,
          ResourceType.Texture
        );
        this.textures.push(varInfo);
      }

      if (this._isSamplerVar(node)) {
        const v = node as AST.Var;
        const g = this._getAttributeNum(v.attributes, "group", 0);
        const b = this._getAttributeNum(v.attributes, "binding", 0);
        const type = this._getTypeInfo(v.type!, v.attributes);
        const varInfo = new VariableInfo(
          v.name,
          type,
          g,
          b,
          v.attributes,
          ResourceType.Sampler
        );
        this.samplers.push(varInfo);
      }

      if (node instanceof AST.Function) {
        const vertexStage = this._getAttribute(node, "vertex");
        const fragmentStage = this._getAttribute(node, "fragment");
        const computeStage = this._getAttribute(node, "compute");
        const stage = vertexStage || fragmentStage || computeStage;

        if (stage) {
          const fn = new FunctionInfo(node.name, stage.name);
          fn.inputs = this._getInputs(node.args);
          fn.outputs = this._getOutputs(node.returnType);
          this.entryPoints[stage.name].push(fn);
        }
      }
    }
  }

  getBindGroups(): Array<Array<BindGropEntry>> {
    const groups: Array<Array<BindGropEntry>> = [];

    function _makeRoom(group: number, binding: number) {
      if (group >= groups.length) groups.length = group + 1;

      if (groups[group] === undefined) groups[group] = [];

      if (binding >= groups[group].length) groups[group].length = binding + 1;
    }

    for (const u of this.uniforms) {
      _makeRoom(u.group, u.binding);
      const group = groups[u.group];
      group[u.binding] = new BindGropEntry("uniform", u);
    }

    for (const u of this.storage) {
      _makeRoom(u.group, u.binding);
      const group = groups[u.group];
      group[u.binding] = new BindGropEntry("storage", u);
    }

    for (const t of this.textures) {
      _makeRoom(t.group, t.binding);
      const group = groups[t.group];
      group[t.binding] = new BindGropEntry("texture", t);
    }

    for (const t of this.samplers) {
      _makeRoom(t.group, t.binding);
      const group = groups[t.group];
      group[t.binding] = new BindGropEntry("sampler", t);
    }

    return groups;
  }

  _getOutputs(
    type: AST.Type,
    outputs: Array<OutputInfo> | undefined = undefined
  ): Array<OutputInfo> {
    if (outputs === undefined) outputs = [];

    if (type instanceof AST.Struct) {
      this._getStructOutputs(type, outputs);
    } else {
      const output = this._getOutputInfo(type);
      if (output !== null) outputs.push(output);
    }

    return outputs;
  }

  _getStructOutputs(struct: AST.Struct, outputs: Array<OutputInfo>) {
    for (const m of struct.members) {
      if (m.type instanceof AST.Struct) {
        this._getStructOutputs(m.type, outputs);
      } else {
        const location =
          this._getAttribute(m, "location") || this._getAttribute(m, "builtin");
        if (location !== null) {
          const typeInfo = this._getTypeInfo(m.type, m.type.attributes);
          const locationValue = this._parseInt(location.value);
          const info = new OutputInfo(
            m.name,
            typeInfo,
            location.name,
            locationValue
          );
          outputs.push(info);
        }
      }
    }
  }

  _getOutputInfo(type: AST.Type): OutputInfo | null {
    const location =
      this._getAttribute(type, "location") ||
      this._getAttribute(type, "builtin");
    if (location !== null) {
      const typeInfo = this._getTypeInfo(type, type.attributes);
      const locationValue = this._parseInt(location.value);
      const info = new OutputInfo("", typeInfo, location.name, locationValue);
      return info;
    }
    return null;
  }

  _getInputs(
    args: Array<AST.Argument>,
    inputs: Array<InputInfo> | undefined = undefined
  ): Array<InputInfo> {
    if (inputs === undefined) inputs = [];

    for (const arg of args) {
      if (arg.type instanceof AST.Struct) {
        this._getStructInputs(arg.type, inputs);
      } else {
        const input = this._getInputInfo(arg);
        if (input !== null) inputs.push(input);
      }
    }

    return inputs;
  }

  _getStructInputs(struct: AST.Struct, inputs: Array<InputInfo>) {
    for (const m of struct.members) {
      if (m.type instanceof AST.Struct) {
        this._getStructInputs(m.type, inputs);
      } else {
        const input = this._getInputInfo(m);
        if (input !== null) inputs.push(input);
      }
    }
  }

  _getInputInfo(node: AST.Member | AST.Argument): InputInfo | null {
    const location =
      this._getAttribute(node, "location") ||
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

  _parseString(s: string | string[]): string {
    if (s instanceof Array) {
      s = s[0];
    }
    return s;
  }

  _parseInt(s: string | string[]): number | string {
    if (s instanceof Array) {
      s = s[0];
    }
    const n = parseInt(s);
    return isNaN(n) ? s : n;
  }

  _getAlias(name: string): TypeInfo | null {
    for (const a of this.aliases) {
      if (a.name == name) return a.type;
    }
    return null;
  }

  _getAliasInfo(node: AST.Alias): AliasInfo {
    return new AliasInfo(node.name, this._getTypeInfo(node.type!, null));
  }

  _getTypeInfo(
    type: AST.Type,
    attributes: Array<AST.Attribute> | null
  ): TypeInfo {
    if (this._types.has(type)) {
      return this._types.get(type)!;
    }

    if (type instanceof AST.ArrayType) {
      const a = type as AST.ArrayType;
      const t = this._getTypeInfo(a.format!, a.attributes);
      const info = new ArrayInfo(a.name, attributes);
      info.format = t;
      info.count = a.count;
      this._types.set(type, info);
      this._updateTypeInfo(info);
      return info;
    }

    if (type instanceof AST.Struct) {
      const s = type as AST.Struct;
      const info = new StructInfo(s.name, attributes);
      for (const m of s.members) {
        const t = this._getTypeInfo(m.type!, m.attributes);
        info.members.push(new MemberInfo(m.name, t, m.attributes));
      }
      this._types.set(type, info);
      this._updateTypeInfo(info);
      return info;
    }

    const info = new TypeInfo(type.name, attributes);
    this._types.set(type, info);
    this._updateTypeInfo(info);
    return info;
  }

  _updateTypeInfo(type: TypeInfo) {
    const typeSize = this._getTypeSize(type);
    type.size = typeSize?.size ?? 0;

    if (type instanceof ArrayInfo) {
      const formatInfo = this._getTypeSize(type["format"]);
      type.stride = formatInfo?.size ?? 0;
      this._updateTypeInfo(type["format"]);
    }

    if (type instanceof StructInfo) {
      this._updateStructInfo(type);
    }
  }

  _updateStructInfo(struct: StructInfo) {
    let offset = 0;
    let lastSize = 0;
    let lastOffset = 0;
    let structAlign = 0;

    for (let mi = 0, ml = struct.members.length; mi < ml; ++mi) {
      const member = struct.members[mi];

      const sizeInfo = this._getTypeSize(member);
      if (!sizeInfo) continue;

      const type = this._getAlias(member.type.name) ?? member.type;
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

  _getTypeSize(
    type: TypeInfo | MemberInfo | null | undefined
  ): _TypeSize | null {
    if (type === null || type === undefined) return null;

    const explicitSize = this._getAttributeNum(type.attributes, "size", 0);
    const explicitAlign = this._getAttributeNum(type.attributes, "align", 0);

    if (type instanceof MemberInfo) type = type.type;

    if (type instanceof TypeInfo) {
      const alias = this._getAlias(type.name);
      if (alias !== null) {
        type = alias;
      }
    }

    {
      const info = WgslReflect._typeInfo[type.name];
      if (info !== undefined) {
        const divisor = type["format"] === "f16" ? 2 : 1;
        return new _TypeSize(
          Math.max(explicitAlign, info.align / divisor),
          Math.max(explicitSize, info.size / divisor)
        );
      }
    }

    {
      const info =
        WgslReflect._typeInfo[type.name.substring(0, type.name.length - 1)];
      if (info) {
        const divisor = type.name[type.name.length - 1] === "h" ? 2 : 1;
        return new _TypeSize(
          Math.max(explicitAlign, info.align / divisor),
          Math.max(explicitSize, info.size / divisor)
        );
      }
    }

    if (type instanceof ArrayInfo) {
      let arrayType = type as ArrayInfo;
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

      const stride = this._getAttributeNum(
        type?.attributes ?? null,
        "stride",
        this._roundUp(align, size)
      );
      size = N * stride;

      if (explicitSize) size = explicitSize;

      return new _TypeSize(
        Math.max(explicitAlign, align),
        Math.max(explicitSize, size)
      );
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

      return new _TypeSize(
        Math.max(explicitAlign, align),
        Math.max(explicitSize, size)
      );
    }

    return null;
  }

  _isUniformVar(node: AST.Node): boolean {
    return node instanceof AST.Var && node.storage == "uniform";
  }

  _isStorageVar(node: AST.Node): boolean {
    return node instanceof AST.Var && node.storage == "storage";
  }

  _isTextureVar(node: AST.Node): boolean {
    return (
      node instanceof AST.Var &&
      node.type !== null &&
      WgslReflect._textureTypes.indexOf(node.type.name) != -1
    );
  }

  _isSamplerVar(node: AST.Node): boolean {
    return (
      node instanceof AST.Var &&
      node.type !== null &&
      WgslReflect._samplerTypes.indexOf(node.type.name) != -1
    );
  }

  _getAttribute(node: AST.Node, name: string): AST.Attribute | null {
    const obj = node as Object;
    if (!obj || !obj["attributes"]) return null;
    const attrs = obj["attributes"];
    for (let a of attrs) {
      if (a.name == name) return a;
    }
    return null;
  }

  _getAttributeNum(
    attributes: Array<AST.Attribute> | null,
    name: string,
    defaultValue: number
  ): number {
    if (attributes === null) return defaultValue;
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

  _roundUp(k: number, n: number): number {
    return Math.ceil(n / k) * k;
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
  static readonly _typeInfo = {
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

  static readonly _textureTypes = TokenTypes.any_texture_type.map((t) => {
    return t.name;
  });
  static readonly _samplerTypes = TokenTypes.sampler_type.map((t) => {
    return t.name;
  });
}
