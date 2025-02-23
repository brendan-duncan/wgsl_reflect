/**
 * @author Brendan Duncan / https://github.com/brendan-duncan
 */
import { TokenTypes } from "../wgsl_scanner.js";
import { Type, Struct, Alias, Override, Var, Node, Function, VariableExpr, CreateExpr,
    Let, CallExpr, Call, Argument, Member, Attribute, ArrayType, SamplerType, TemplateType,
    _BlockStart, _BlockEnd } from "../wgsl_ast.js";
import { FunctionInfo, VariableInfo, AliasInfo, OverrideInfo,
  StructInfo, TypeInfo, MemberInfo, ArrayInfo, TemplateInfo, OutputInfo,
  InputInfo, ArgumentInfo, ResourceType, EntryFunctions } from "./info.js";
import { isArray } from "../utils/cast.js";
 
class _FunctionResources {
  node: Function;
  resources: VariableInfo[] | null = null;
  inUse: boolean = false;
  info: FunctionInfo | null = null;
  constructor(node: Function) {
    this.node = node;
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

export class Reflect {
  /// All top-level uniform vars in the shader.
  uniforms: VariableInfo[] = [];
  /// All top-level storage vars in the shader.
  storage: VariableInfo[] = [];
  /// All top-level texture vars in the shader;
  textures: VariableInfo[] = [];
  // All top-level sampler vars in the shader.
  samplers: VariableInfo[] = [];
  /// All top-level type aliases in the shader.
  aliases: AliasInfo[] = [];
  /// All top-level overrides in the shader.
  overrides: OverrideInfo[] = [];
  /// All top-level structs in the shader.
  structs: StructInfo[] = [];
  /// All entry functions in the shader: vertex, fragment, and/or compute.
  entry: EntryFunctions = new EntryFunctions();
  /// All functions in the shader, including entry functions.
  functions: FunctionInfo[] = [];

  _types: Map<Type, TypeInfo> = new Map();
  _functions: Map<string, _FunctionResources> = new Map();

  _isStorageTexture(type: TypeInfo): boolean {
    return (
      type.name == "texture_storage_1d" ||
      type.name == "texture_storage_2d" ||
      type.name == "texture_storage_2d_array" ||
      type.name == "texture_storage_3d"
    );
  }

  updateAST(ast: Node[]): void {
    for (const node of ast) {
      if (node instanceof Function) {
        this._functions.set(node.name, new _FunctionResources(node as Function));
      }
    }

    for (const node of ast) {
      if (node instanceof Struct) {
        const info = this.getTypeInfo(node as Struct, null);
        if (info instanceof StructInfo) {
          this.structs.push(info as StructInfo);
        }
      }
    }

    for (const node of ast) {
      if (node instanceof Alias) {
        this.aliases.push(this._getAliasInfo(node as Alias));
        continue;
      }

      if (node instanceof Override) {
        const v = node as Override;
        const id = this._getAttributeNum(v.attributes, "id", 0);
        const type = v.type != null ? this.getTypeInfo(v.type, v.attributes) : null;
        this.overrides.push(new OverrideInfo(v.name, type, v.attributes, id));
        continue;
      }

      if (this._isUniformVar(node)) {
        const v = node as Var;
        const g = this._getAttributeNum(v.attributes, "group", 0);
        const b = this._getAttributeNum(v.attributes, "binding", 0);
        const type = this.getTypeInfo(v.type!, v.attributes);
        const varInfo = new VariableInfo(v.name, type, g, b, v.attributes, ResourceType.Uniform, v.access);
        this.uniforms.push(varInfo);
        continue;
      }

      if (this._isStorageVar(node)) {
        const v = node as Var;
        const g = this._getAttributeNum(v.attributes, "group", 0);
        const b = this._getAttributeNum(v.attributes, "binding", 0);
        const type = this.getTypeInfo(v.type!, v.attributes);
        const isStorageTexture = this._isStorageTexture(type);
        const varInfo = new VariableInfo(v.name, type, g, b, v.attributes, isStorageTexture ? ResourceType.StorageTexture : ResourceType.Storage, v.access);
        this.storage.push(varInfo);
        continue;
      }

      if (this._isTextureVar(node)) {
        const v = node as Var;
        const g = this._getAttributeNum(v.attributes, "group", 0);
        const b = this._getAttributeNum(v.attributes, "binding", 0);
        const type = this.getTypeInfo(v.type!, v.attributes);
        const isStorageTexture = this._isStorageTexture(type);
        const varInfo = new VariableInfo(
          v.name,
          type,
          g,
          b,
          v.attributes,
          isStorageTexture ? ResourceType.StorageTexture : ResourceType.Texture,
          v.access
        );
        if (isStorageTexture) {
          this.storage.push(varInfo);
        } else {
          this.textures.push(varInfo);
        }
        continue;
      }

      if (this._isSamplerVar(node)) {
        const v = node as Var;
        const g = this._getAttributeNum(v.attributes, "group", 0);
        const b = this._getAttributeNum(v.attributes, "binding", 0);
        const type = this.getTypeInfo(v.type!, v.attributes);
        const varInfo = new VariableInfo(v.name, type, g, b, v.attributes, ResourceType.Sampler, v.access);
        this.samplers.push(varInfo);
        continue;
      }

      if (node instanceof Function) {
        const vertexStage = this._getAttribute(node, "vertex");
        const fragmentStage = this._getAttribute(node, "fragment");
        const computeStage = this._getAttribute(node, "compute");
        const stage = vertexStage || fragmentStage || computeStage;

        const fn = new FunctionInfo(node.name, stage?.name, node.attributes);
        fn.attributes = node.attributes;
        fn.startLine = node.startLine;
        fn.endLine = node.endLine;
        this.functions.push(fn);
        this._functions.get(node.name)!.info = fn;

        if (stage) {
          this._functions.get(node.name)!.inUse = true;
          fn.inUse = true;
          fn.resources = this._findResources(node, !!stage);
          fn.inputs = this._getInputs(node.args);
          fn.outputs = this._getOutputs(node.returnType);
          this.entry[stage.name].push(fn);
        }

        fn.arguments = node.args.map(
          (arg) => new ArgumentInfo(arg.name, this.getTypeInfo(arg.type, arg.attributes), arg.attributes)
        );

        fn.returnType = node.returnType ? this.getTypeInfo(node.returnType, node.attributes) : null;

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
        if (node instanceof Attribute) {
          if (node.value) {
            if (isArray(node.value)) {
              for (const value of node.value) {
                for (const override of this.overrides) {
                  if (value === override.name) {
                    fn.info?.overrides.push(override);
                  }
                }
              }
            } else {
              for (const override of this.overrides) {
                if (node.value === override.name) {
                  fn.info?.overrides.push(override);
                }
              }
            }
          }
        } else if (node instanceof VariableExpr) {
          for (const override of this.overrides) {
            if (node.name === override.name) {
              fn.info?.overrides.push(override);
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

  getStructInfo(name: string): StructInfo | null {
    for (const s of this.structs) {
      if (s.name == name) {
        return s;
      }
    }
    return null;
  }

  getOverrideInfo(name: string): OverrideInfo | null {
    for (const o of this.overrides) {
      if (o.name == name) {
        return o;
      }
    }
    return null;
  }

  _markStructsInUse(type: TypeInfo) {
    if (!type) {
      return;
    }
    if (type.isStruct) {
      (type as StructInfo).inUse = true;
      if ((type as StructInfo).members) {
        for (const m of (type as StructInfo).members) {
          this._markStructsInUse(m.type);
        }
      }
    } else if (type.isArray) {
      this._markStructsInUse((type as ArrayInfo).format);
    } else if (type.isTemplate) {
      if ((type as TemplateInfo).format) {
        this._markStructsInUse((type as TemplateInfo).format!);
      }
    } else {
      const alias = this._getAlias(type.name);
      if (alias) {
        this._markStructsInUse(alias);
      }
    }
  }

  _addCalls(fn: Function, calls: Set<FunctionInfo>, ) {
    for (const call of fn.calls) {
      const info = this._functions.get(call.name)?.info;
      if (info) {
        calls.add(info);
      }
    }
  }

  /// Find a resource by its group and binding.
  findResource(group: number, binding: number) {
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

  _findResource(name: string): VariableInfo | null {
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
  
  _markStructsFromAST(type: Type) {
    const info = this.getTypeInfo(type, null);
    this._markStructsInUse(info);
  }

  _findResources(fn: Node, isEntry: boolean): VariableInfo[] {
    const resources: any[] = [];
    const self = this;
    const varStack: any[] = [];
    fn.search((node) => {
      if (node instanceof _BlockStart) {
        varStack.push({});
      } else if (node instanceof _BlockEnd) {
        varStack.pop();
      } else if (node instanceof Var) {
        const v = node as Var;
        if (isEntry && v.type !== null) {
          this._markStructsFromAST(v.type);
        }
        if (varStack.length > 0) {
          varStack[varStack.length - 1][v.name] = v;
        }
      } else if (node instanceof CreateExpr) {
        const c = node as CreateExpr;
        if (isEntry && c.type !== null) {
          this._markStructsFromAST(c.type);
        }
      } else if (node instanceof Let) {
        const v = node as Let;
        if (isEntry && v.type !== null) {
          this._markStructsFromAST(v.type);
        }
        if (varStack.length > 0) {
          varStack[varStack.length - 1][v.name] = v;
        }
      } else if (node instanceof VariableExpr) {
        const v = node as VariableExpr;
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
      } else if (node instanceof CallExpr) {
        const c = node as CallExpr;
        const callFn = self._functions.get(c.name);
        if (callFn) {
          if (isEntry) {
            callFn.inUse = true;
          }
          (fn as Function).calls.add(callFn.node);
          if (callFn.resources === null) {
            callFn.resources = self._findResources(callFn.node, isEntry);
          }
          resources.push(...callFn.resources);
        }
      } else if (node instanceof Call) {
        const c = node as Call;
        const callFn = self._functions.get(c.name);
        if (callFn) {
          if (isEntry) {
            callFn.inUse = true;
          }
          (fn as Function).calls.add(callFn.node);
          if (callFn.resources === null) {
            callFn.resources = self._findResources(callFn.node, isEntry);
          }
          resources.push(...callFn.resources);
        }
      }
    });
    return [...new Map(resources.map(r => [r.name, r])).values()];
  }

  getBindGroups(): Array<VariableInfo[]> {
    const groups: Array<VariableInfo[]> = [];

    function _makeRoom(group: number, binding: number) {
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

  _getOutputs(
    type: Type,
    outputs: OutputInfo[] | undefined = undefined
  ): OutputInfo[] {
    if (outputs === undefined) {
      outputs = [];
    }

    if (type instanceof Struct) {
      this._getStructOutputs(type, outputs);
    } else {
      const output = this._getOutputInfo(type);
      if (output !== null) {
        outputs.push(output);
      }
    }

    return outputs;
  }

  _getStructOutputs(struct: Struct, outputs: OutputInfo[]) {
    for (const m of struct.members) {
      if (m.type instanceof Struct) {
        this._getStructOutputs(m.type, outputs);
      } else {
        const location =
          this._getAttribute(m, "location") || this._getAttribute(m, "builtin");
        if (location !== null) {
          const typeInfo = this.getTypeInfo(m.type, m.type.attributes);
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

  _getOutputInfo(type: Type): OutputInfo | null {
    const location =
      this._getAttribute(type, "location") ||
      this._getAttribute(type, "builtin");
    if (location !== null) {
      const typeInfo = this.getTypeInfo(type, type.attributes);
      const locationValue = this._parseInt(location.value);
      const info = new OutputInfo("", typeInfo, location.name, locationValue);
      return info;
    }
    return null;
  }

  _getInputs(
    args: Argument[],
    inputs: InputInfo[] | undefined = undefined
  ): InputInfo[] {
    if (inputs === undefined) {
      inputs = [];
    }

    for (const arg of args) {
      if (arg.type instanceof Struct) {
        this._getStructInputs(arg.type, inputs);
      } else {
        const input = this._getInputInfo(arg);
        if (input !== null) {
          inputs.push(input);
        }
      }
    }

    return inputs;
  }

  _getStructInputs(struct: Struct, inputs: InputInfo[]) {
    for (const m of struct.members) {
      if (m.type instanceof Struct) {
        this._getStructInputs(m.type, inputs);
      } else {
        const input = this._getInputInfo(m);
        if (input !== null) {
          inputs.push(input);
        }
      }
    }
  }

  _getInputInfo(node: Member | Argument): InputInfo | null {
    const location =
      this._getAttribute(node, "location") ||
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
      if (a.name == name) {
        return a.type;
      }
    }
    return null;
  }

  _getAliasInfo(node: Alias): AliasInfo {
    return new AliasInfo(node.name, this.getTypeInfo(node.type!, null));
  }

  getTypeInfo(
    type: Type,
    attributes: Attribute[] | null = null
  ): TypeInfo {
    if (this._types.has(type)) {
      return this._types.get(type)!;
    }

    if (type instanceof ArrayType) {
      const a = type as ArrayType;
      const t = a.format ? this.getTypeInfo(a.format!, a.attributes) : null;
      const info = new ArrayInfo(a.name, attributes);
      info.format = t;
      info.count = a.count;
      this._types.set(type, info);
      this._updateTypeInfo(info);
      return info;
    }

    if (type instanceof Struct) {
      const s = type as Struct;
      const info = new StructInfo(s.name, attributes);
      info.startLine = s.startLine;
      info.endLine = s.endLine;
      for (const m of s.members) {
        const t = this.getTypeInfo(m.type!, m.attributes);
        info.members.push(new MemberInfo(m.name, t, m.attributes));
      }
      this._types.set(type, info);
      this._updateTypeInfo(info);
      return info;
    }

    if (type instanceof SamplerType) {
      const s = type as SamplerType;
      const formatIsType = s.format instanceof Type;
      const format = s.format
        ? formatIsType
          ? this.getTypeInfo(s.format! as Type, null)
          : new TypeInfo(s.format! as string, null)
        : null;
      const info = new TemplateInfo(s.name, format, attributes, s.access);
      this._types.set(type, info);
      this._updateTypeInfo(info);
      return info;
    }

    if (type instanceof TemplateType) {
      const t = type as TemplateType;
      const format = t.format ? this.getTypeInfo(t.format!, null) : null;
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

  _updateTypeInfo(type: TypeInfo) {
    const typeSize = this._getTypeSize(type);
    type.size = typeSize?.size ?? 0;

    if (type instanceof ArrayInfo) {
      if (type["format"]) {
        const formatInfo = this._getTypeSize(type["format"]);
        // Array stride is the maximum of the format size and alignment.
        // In the case of a vec3f, the size is 12 bytes, but the alignment is 16 bytes.
        // Buffer alignment is therefore 16 bytes.
        type.stride = Math.max(formatInfo?.size ?? 0, formatInfo?.align ?? 0);
        this._updateTypeInfo(type["format"]);
      }
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
      if (!sizeInfo) {
        continue;
      }

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
      const info = Reflect._typeInfo[type.name];
      if (info !== undefined) {
        const divisor = type["format"]?.name === "f16" ? 2 : 1;
        return new _TypeSize(
          Math.max(explicitAlign, info.align / divisor),
          Math.max(explicitSize, info.size / divisor)
        );
      }
    }

    {
      const info =
        Reflect._typeInfo[type.name.substring(0, type.name.length - 1)];
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

      if (explicitSize) {
        size = explicitSize;
      }

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

  _isUniformVar(node: Node): boolean {
    return node instanceof Var && node.storage == "uniform";
  }

  _isStorageVar(node: Node): boolean {
    return node instanceof Var && node.storage == "storage";
  }

  _isTextureVar(node: Node): boolean {
    return (
      node instanceof Var &&
      node.type !== null &&
      Reflect._textureTypes.indexOf(node.type.name) != -1
    );
  }

  _isSamplerVar(node: Node): boolean {
    return (
      node instanceof Var &&
      node.type !== null &&
      Reflect._samplerTypes.indexOf(node.type.name) != -1
    );
  }

  _getAttribute(node: Node, name: string): Attribute | null {
    const obj = node as Object;
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

  _getAttributeNum(
    attributes: Attribute[] | null,
    name: string,
    defaultValue: number
  ): number {
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
