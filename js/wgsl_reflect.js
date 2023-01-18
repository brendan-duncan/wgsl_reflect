/**
 * @author Brendan Duncan / https://github.com/brendan-duncan
 */
import { WgslParser } from "./wgsl_parser.js";
import { TokenTypes } from "./wgsl_scanner.js";
import * as AST from "./wgsl_ast.js";
export class VariableInfo {
    constructor(node, group, binding) {
        this.group = group;
        this.binding = binding;
        this.node = node;
    }
    get name() { return this.node.name; }
    get type() { return this.node.type; }
    get attributes() { return this.node.attributes; }
}
export class FunctionInfo {
    constructor(node) {
        this.inputs = [];
        this.node = node;
    }
    get name() { return this.node.name; }
    get returnType() { return this.node.returnType; }
    get args() { return this.node.args; }
    get attributes() { return this.node.attributes; }
}
export class InputInfo {
    constructor(name, type, input, locationType, location) {
        this.name = name;
        this.type = type;
        this.input = input;
        this.locationType = locationType;
        this.location = location;
        this.interpolation = this.interpolation;
    }
}
export class MemberInfo {
}
export class StructInfo {
}
export class TypeInfo {
    constructor(align, size) {
        this.align = align;
        this.size = size;
    }
}
export class BufferInfo extends TypeInfo {
    constructor(name, type) {
        super(0, 0);
        this.name = name;
        this.type = type;
    }
}
export class BindGropEntry {
    constructor(type, resource) {
        this.type = type;
        this.resource = resource;
    }
}
export class EntryFunctions {
    constructor() {
        this.vertex = [];
        this.fragment = [];
        this.compute = [];
    }
}
export class WgslReflect {
    constructor(code) {
        /// All top-level structs in the shader.
        this.structs = [];
        /// All top-level uniform vars in the shader.
        this.uniforms = [];
        /// All top-level storage vars in the shader.
        this.storage = [];
        /// All top-level texture vars in the shader;
        this.textures = [];
        // All top-level sampler vars in the shader.
        this.samplers = [];
        /// All top-level functions in the shader.
        this.functions = [];
        /// All top-level type aliases in the shader.
        this.aliases = [];
        if (code)
            this.initialize(code);
    }
    initialize(code) {
        const parser = new WgslParser();
        this.ast = parser.parse(code);
        this.entry = new EntryFunctions();
        for (const node of this.ast) {
            if (node.astNodeType == "struct")
                this.structs.push(node);
            if (node.astNodeType == "alias")
                this.aliases.push(node);
            if (this.isUniformVar(node)) {
                const v = node;
                const g = this.getAttributeNum(node, "group", 0);
                const b = this.getAttributeNum(node, "binding", 0);
                this.uniforms.push(new VariableInfo(v, g, b));
            }
            if (this.isStorageVar(node)) {
                const v = node;
                const g = this.getAttributeNum(node, "group", 0);
                const b = this.getAttributeNum(node, "binding", 0);
                this.storage.push(new VariableInfo(v, g, b));
            }
            if (this.isTextureVar(node)) {
                const v = node;
                const g = this.getAttributeNum(node, "group", 0);
                const b = this.getAttributeNum(node, "binding", 0);
                this.textures.push(new VariableInfo(v, g, b));
            }
            if (this.isSamplerVar(node)) {
                const v = node;
                const g = this.getAttributeNum(node, "group", 0);
                const b = this.getAttributeNum(node, "binding", 0);
                this.samplers.push(new VariableInfo(v, g, b));
            }
            if (node instanceof AST.Function) {
                const fn = new FunctionInfo(node);
                fn.inputs = this._getInputs(node.args);
                this.functions.push(fn);
                const vertexStage = this.getAttribute(node, "vertex");
                const fragmentStage = this.getAttribute(node, "fragment");
                const computeStage = this.getAttribute(node, "compute");
                const stage = vertexStage || fragmentStage || computeStage;
                if (stage) {
                    this.entry[stage.name].push(fn);
                }
            }
        }
    }
    isTextureVar(node) {
        return node instanceof AST.Var && node.type !== null &&
            WgslReflect.textureTypes.indexOf(node.type.name) != -1;
    }
    isSamplerVar(node) {
        return node instanceof AST.Var && node.type !== null &&
            WgslReflect.samplerTypes.indexOf(node.type.name) != -1;
    }
    isUniformVar(node) {
        return node instanceof AST.Var && node.storage == "uniform";
    }
    isStorageVar(node) {
        return node instanceof AST.Var && node.storage == "storage";
    }
    getAttributeNum(node, name, defaultValue) {
        const a = this.getAttribute(node, name);
        if (a == null) {
            return defaultValue;
        }
        let v = a !== null && a.value !== null ? a.value : defaultValue;
        if (v instanceof Array) {
            v = v[0];
        }
        if (typeof (v) === "number") {
            return v;
        }
        if (typeof (v) === "string") {
            return parseInt(v);
        }
        return defaultValue;
    }
    getAttribute(node, name) {
        const obj = node;
        if (!obj || !obj['attributes'])
            return null;
        const attrs = obj['attributes'];
        for (let a of attrs) {
            if (a.name == name)
                return a;
        }
        return null;
    }
    _getInputs(args, inputs = undefined) {
        if (inputs === undefined)
            inputs = [];
        for (const arg of args) {
            const input = this._getInputInfo(arg);
            if (input !== null)
                inputs.push(input);
            const struct = this.getStruct(arg.type);
            if (struct)
                this._getInputs(struct.members, inputs);
        }
        return inputs;
    }
    _getInputInfo(node) {
        const location = this.getAttribute(node, "location") || this.getAttribute(node, "builtin");
        if (location !== null) {
            const interpolation = this.getAttribute(node, "interpolation");
            const info = new InputInfo(node.name, node.type, node, location.name, this._parseInt(location.value));
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
    getStruct(name) {
        if (name === null)
            return null;
        if (name instanceof AST.Struct)
            return name;
        if (name instanceof AST.Type) {
            name = name.name;
        }
        for (const u of this.structs) {
            if (u.name == name)
                return u;
        }
        return null;
    }
    getAlias(type) {
        if (type === null)
            return null;
        if (type instanceof AST.Node) {
            if (!(type instanceof AST.Type)) {
                return null;
            }
            type = type.name;
        }
        for (const u of this.aliases) {
            if (u.name == type)
                return u.type;
        }
        return null;
    }
    getBindGroups() {
        const groups = [];
        function _makeRoom(group, binding) {
            if (group >= groups.length)
                groups.length = group + 1;
            if (groups[group] === undefined)
                groups[group] = [];
            if (binding >= groups[group].length)
                groups[group].length = binding + 1;
        }
        for (const u of this.uniforms) {
            _makeRoom(u.group, u.binding);
            const group = groups[u.group];
            group[u.binding] = new BindGropEntry('buffer', this.getUniformBufferInfo(u));
        }
        for (const u of this.storage) {
            _makeRoom(u.group, u.binding);
            const group = groups[u.group];
            group[u.binding] = new BindGropEntry('storage', this.getStorageBufferInfo(u));
        }
        for (const t of this.textures) {
            _makeRoom(t.group, t.binding);
            const group = groups[t.group];
            group[t.binding] = new BindGropEntry('texture', t);
        }
        for (const t of this.samplers) {
            _makeRoom(t.group, t.binding);
            const group = groups[t.group];
            group[t.binding] = new BindGropEntry('sampler', t);
        }
        return groups;
    }
    getStorageBufferInfo(node) {
        if (node instanceof VariableInfo) {
            node = node.node;
        }
        if (!this.isStorageVar(node))
            return null;
        const group = this.getAttributeNum(node, "group", 0);
        const binding = this.getAttributeNum(node, "binding", 0);
        const info = this._getUniformInfo(node);
        info.group = group;
        info.binding = binding;
        return info;
    }
    /// Returns information about a struct type, null if the type is not a struct.
    getStructInfo(node) {
        var _a, _b, _c, _d, _e;
        if (node === null)
            return null;
        const struct = node instanceof AST.Struct ? node : this.getStruct(node.type);
        if (!struct)
            return null;
        let offset = 0;
        let lastSize = 0;
        let lastOffset = 0;
        let structAlign = 0;
        let buffer = new BufferInfo(node.name, (node instanceof AST.Var) ? node.type : null);
        buffer.members = [];
        for (let mi = 0, ml = struct.members.length; mi < ml; ++mi) {
            const member = struct.members[mi];
            const name = member.name;
            const info = this.getTypeInfo(member);
            if (!info)
                continue;
            const type = member.type;
            const align = info.align;
            const size = info.size;
            offset = this._roundUp(align, offset + lastSize);
            lastSize = size;
            lastOffset = offset;
            structAlign = Math.max(structAlign, align);
            const isArray = member.type.astNodeType === "array";
            const s = this.getStruct(type) || (isArray ? this.getStruct((_a = type['format']) === null || _a === void 0 ? void 0 : _a.name)
                : null);
            const isStruct = !!s;
            const si = isStruct ? this.getStructInfo(s) : undefined;
            const arrayStride = ((_b = si === null || si === void 0 ? void 0 : si.size) !== null && _b !== void 0 ? _b : isArray) ? (_c = this.getTypeInfo(type['format'])) === null || _c === void 0 ? void 0 : _c.size
                : (_d = this.getTypeInfo(member.type)) === null || _d === void 0 ? void 0 : _d.size;
            const arrayCount = (_e = member.type['count']) !== null && _e !== void 0 ? _e : 0;
            const members = isStruct ? si === null || si === void 0 ? void 0 : si.members : undefined;
            const u = new MemberInfo();
            u.node = member;
            u.name = name;
            u.offset = offset;
            u.size = size;
            u.type = type;
            u.isArray = isArray;
            u.arrayCount = arrayCount;
            u.arrayStride = arrayStride;
            u.isStruct = isStruct;
            u.members = members;
            buffer.members.push(u);
        }
        buffer.size = this._roundUp(structAlign, lastOffset + lastSize);
        buffer.align = structAlign;
        buffer.isArray = false;
        buffer.isStruct = true;
        buffer.arrayCount = 0;
        return buffer;
    }
    _getUniformInfo(node) {
        var _a, _b, _c, _d, _e;
        const structInfo = this.getStructInfo(node);
        if (structInfo !== null)
            return structInfo;
        var n = node;
        const typeInfo = this.getTypeInfo(n.type);
        if (typeInfo === null)
            return null;
        const info = new BufferInfo(node.name, n.type);
        info.align = typeInfo.align;
        info.size = typeInfo.size;
        let s = this.getStruct((_a = n.type['format']) === null || _a === void 0 ? void 0 : _a.name);
        let si = s ? this.getStructInfo(s) : undefined;
        info.isArray = n.type.astNodeType === "array";
        info.isStruct = !!s;
        info.members = info.isStruct ? si === null || si === void 0 ? void 0 : si.members : undefined;
        info.name = n.name;
        info.type = n.type;
        info.arrayStride = ((_b = si === null || si === void 0 ? void 0 : si.size) !== null && _b !== void 0 ? _b : info.isArray) ?
            (_c = this.getTypeInfo(n.type['format'])) === null || _c === void 0 ? void 0 : _c.size :
            (_d = this.getTypeInfo(n.type)) === null || _d === void 0 ? void 0 : _d.size;
        info.arrayCount = parseInt((_e = n.type['count']) !== null && _e !== void 0 ? _e : 0);
        return info;
    }
    getUniformBufferInfo(uniform) {
        if (!this.isUniformVar(uniform.node))
            return null;
        const info = this._getUniformInfo(uniform.node);
        info.group = uniform.group;
        info.binding = uniform.binding;
        return info;
    }
    getTypeInfo(type) {
        var _a;
        if (type === null || type === undefined)
            return null;
        const explicitSize = this.getAttributeNum(type, "size", 0);
        const explicitAlign = this.getAttributeNum(type, "align", 0);
        if (type instanceof AST.Member)
            type = type.type;
        if (type instanceof AST.Type) {
            const alias = this.getAlias(type.name);
            if (alias !== null) {
                type = alias;
            }
            else {
                const struct = this.getStruct(type.name);
                if (struct !== null)
                    type = struct;
            }
        }
        {
            const info = WgslReflect.typeInfo[type.name];
            if (info !== undefined) {
                const divisor = type['format'] === 'f16' ? 2 : 1;
                return new TypeInfo(Math.max(explicitAlign, info.align / divisor), Math.max(explicitSize, info.size / divisor));
            }
        }
        {
            const info = WgslReflect.typeInfo[type.name.substring(0, type.name.length - 1)];
            if (info) {
                const divisor = type.name[type.name.length - 1] === 'h' ? 2 : 1;
                return new TypeInfo(Math.max(explicitAlign, info.align / divisor), Math.max(explicitSize, info.size / divisor));
            }
        }
        if (type.name == "array") {
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
            const E = this.getTypeInfo(type['format']);
            if (E !== null) {
                size = E.size;
                align = E.align;
            }
            const N = parseInt((_a = type['count']) !== null && _a !== void 0 ? _a : 1);
            const stride = this.getAttributeNum(type, "stride", this._roundUp(align, size));
            size = N * stride;
            if (explicitSize)
                size = explicitSize;
            return new TypeInfo(Math.max(explicitAlign, align), Math.max(explicitSize, size));
        }
        if (type instanceof AST.Struct) {
            let align = 0;
            let size = 0;
            // struct S     AlignOf:    max(AlignOfMember(S, M1), ... , AlignOfMember(S, MN))
            //              SizeOf:     roundUp(AlignOf(S), OffsetOfMember(S, L) + SizeOfMember(S, L))
            //                          Where L is the last member of the structure
            let offset = 0;
            let lastSize = 0;
            let lastOffset = 0;
            for (const m of type.members) {
                const mi = this.getTypeInfo(m);
                align = Math.max(mi.align, align);
                offset = this._roundUp(mi.align, offset + lastSize);
                lastSize = mi.size;
                lastOffset = offset;
            }
            size = this._roundUp(align, lastOffset + lastSize);
            return new TypeInfo(Math.max(explicitAlign, align), Math.max(explicitSize, size));
        }
        return null;
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
WgslReflect.typeInfo = {
    "f16": { align: 2, size: 2 },
    "i32": { align: 4, size: 4 },
    "u32": { align: 4, size: 4 },
    "f32": { align: 4, size: 4 },
    "atomic": { align: 4, size: 4 },
    "vec2": { align: 8, size: 8 },
    "vec3": { align: 16, size: 12 },
    "vec4": { align: 16, size: 16 },
    "mat2x2": { align: 8, size: 16 },
    "mat3x2": { align: 8, size: 24 },
    "mat4x2": { align: 8, size: 32 },
    "mat2x3": { align: 16, size: 32 },
    "mat3x3": { align: 16, size: 48 },
    "mat4x3": { align: 16, size: 64 },
    "mat2x4": { align: 16, size: 32 },
    "mat3x4": { align: 16, size: 48 },
    "mat4x4": { align: 16, size: 64 },
};
WgslReflect.textureTypes = TokenTypes.any_texture_type.map((t) => { return t.name; });
WgslReflect.samplerTypes = TokenTypes.sampler_type.map((t) => { return t.name; });
//# sourceMappingURL=wgsl_reflect.js.map