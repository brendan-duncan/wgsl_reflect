/**
 * @author Brendan Duncan / https://github.com/brendan-duncan
 */
import { WgslParser } from "./wgsl_parser.js";
import { TokenTypes } from "./wgsl_scanner.js";
import * as AST from "./wgsl_ast.js";
export class TypeInfo {
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
export class MemberInfo {
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
export class StructInfo extends TypeInfo {
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
export class ArrayInfo extends TypeInfo {
    constructor(name, attributes) {
        super(name, attributes);
        this.count = 0;
        this.stride = 0;
    }
    get isArray() {
        return true;
    }
}
export class TemplateInfo extends TypeInfo {
    constructor(name, format, attributes, access) {
        super(name, attributes);
        this.format = format;
        this.access = access;
    }
    get isTemplate() {
        return true;
    }
}
export var ResourceType;
(function (ResourceType) {
    ResourceType[ResourceType["Uniform"] = 0] = "Uniform";
    ResourceType[ResourceType["Storage"] = 1] = "Storage";
    ResourceType[ResourceType["Texture"] = 2] = "Texture";
    ResourceType[ResourceType["Sampler"] = 3] = "Sampler";
    ResourceType[ResourceType["StorageTexture"] = 4] = "StorageTexture";
})(ResourceType || (ResourceType = {}));
export class VariableInfo {
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
export class AliasInfo {
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
export class InputInfo {
    constructor(name, type, locationType, location) {
        this.name = name;
        this.type = type;
        this.locationType = locationType;
        this.location = location;
        this.interpolation = null;
    }
}
export class OutputInfo {
    constructor(name, type, locationType, location) {
        this.name = name;
        this.type = type;
        this.locationType = locationType;
        this.location = location;
    }
}
export class OverrideInfo {
    constructor(name, type, attributes, id) {
        this.name = name;
        this.type = type;
        this.attributes = attributes;
        this.id = id;
    }
}
export class ArgumentInfo {
    constructor(name, type) {
        this.name = name;
        this.type = type;
    }
}
export class FunctionInfo {
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
export class EntryFunctions {
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
export class WgslReflect {
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
        for (const node of ast) {
            if (node instanceof AST.Function) {
                this._functions.set(node.name, new _FunctionResources(node));
            }
        }
        for (const node of ast) {
            if (node instanceof AST.Struct) {
                const info = this._getTypeInfo(node, null);
                if (info instanceof StructInfo) {
                    this.structs.push(info);
                }
            }
        }
        for (const node of ast) {
            if (node instanceof AST.Alias) {
                this.aliases.push(this._getAliasInfo(node));
                continue;
            }
            if (node instanceof AST.Override) {
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
            if (node instanceof AST.Function) {
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
            if (node instanceof AST._BlockStart) {
                varStack.push({});
            }
            else if (node instanceof AST._BlockEnd) {
                varStack.pop();
            }
            else if (node instanceof AST.Var) {
                const v = node;
                if (isEntry && v.type !== null) {
                    this._markStructsFromAST(v.type);
                }
                if (varStack.length > 0) {
                    varStack[varStack.length - 1][v.name] = v;
                }
            }
            else if (node instanceof AST.CreateExpr) {
                const c = node;
                if (isEntry && c.type !== null) {
                    this._markStructsFromAST(c.type);
                }
            }
            else if (node instanceof AST.Let) {
                const v = node;
                if (isEntry && v.type !== null) {
                    this._markStructsFromAST(v.type);
                }
                if (varStack.length > 0) {
                    varStack[varStack.length - 1][v.name] = v;
                }
            }
            else if (node instanceof AST.VariableExpr) {
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
            else if (node instanceof AST.CallExpr) {
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
            else if (node instanceof AST.Call) {
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
        if (type instanceof AST.Struct) {
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
            if (m.type instanceof AST.Struct) {
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
            if (arg.type instanceof AST.Struct) {
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
            if (m.type instanceof AST.Struct) {
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
        if (type instanceof AST.ArrayType) {
            const a = type;
            const t = a.format ? this._getTypeInfo(a.format, a.attributes) : null;
            const info = new ArrayInfo(a.name, attributes);
            info.format = t;
            info.count = a.count;
            this._types.set(type, info);
            this._updateTypeInfo(info);
            return info;
        }
        if (type instanceof AST.Struct) {
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
        if (type instanceof AST.SamplerType) {
            const s = type;
            const formatIsType = s.format instanceof AST.Type;
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
        if (type instanceof AST.TemplateType) {
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
        var _a, _b;
        const typeSize = this._getTypeSize(type);
        type.size = (_a = typeSize === null || typeSize === void 0 ? void 0 : typeSize.size) !== null && _a !== void 0 ? _a : 0;
        if (type instanceof ArrayInfo) {
            if (type["format"]) {
                const formatInfo = this._getTypeSize(type["format"]);
                type.stride = (_b = formatInfo === null || formatInfo === void 0 ? void 0 : formatInfo.size) !== null && _b !== void 0 ? _b : 0;
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
            const type = (_a = this._getAlias(member.type.name)) !== null && _a !== void 0 ? _a : member.type;
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
        return node instanceof AST.Var && node.storage == "uniform";
    }
    _isStorageVar(node) {
        return node instanceof AST.Var && node.storage == "storage";
    }
    _isTextureVar(node) {
        return (node instanceof AST.Var &&
            node.type !== null &&
            WgslReflect._textureTypes.indexOf(node.type.name) != -1);
    }
    _isSamplerVar(node) {
        return (node instanceof AST.Var &&
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
