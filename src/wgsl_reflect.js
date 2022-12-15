/**
 * @author Brendan Duncan / https://github.com/brendan-duncan
 */
import { WgslParser } from "./wgsl_parser.js";
import { Token } from "./wgsl_scanner.js";

export class WgslReflect {
    constructor(code) {
        if (code)
            this.initialize(code);
    }

    initialize(code) {
        const parser = new WgslParser();
        this.ast = parser.parse(code);

        // All top-level structs in the shader.
        this.structs = [];
        // All top-level uniform vars in the shader.
        this.uniforms = [];
        // All top-level storage vars in the shader.
        this.storage = [];
        // All top-level texture vars in the shader;
        this.textures = [];
        // All top-level sampler vars in the shader.
        this.samplers = [];
        // All top-level functions in the shader.
        this.functions = [];
        // All top-level type aliases in the shader.
        this.aliases = [];
        // All entry functions in the shader: vertex, fragment, and/or compute.
        this.entry = {
            vertex: [],
            fragment: [],
            compute: []
        };

        for (const node of this.ast) {
            if (node.astNodeType == "struct")
                this.structs.push(node);

            if (node.astNodeType == "alias")
                this.aliases.push(node);

            if (this.isUniformVar(node)) {
                const group = this.getAttribute(node, "group");
                node.group = group && group.value ? parseInt(group.value) : 0;
                const binding = this.getAttribute(node, "binding");
                node.binding = binding && binding.value ? parseInt(binding.value) : 0;
                this.uniforms.push(node);
            }

            if (this.isStorageVar(node)) {
                const group = this.getAttribute(node, "group");
                node.group = group && group.value ? parseInt(group.value) : 0;
                const binding = this.getAttribute(node, "binding");
                node.binding = binding && binding.value ? parseInt(binding.value) : 0;
                this.storage.push(node);
            }

            if (this.isTextureVar(node)) {
                const group = this.getAttribute(node, "group");
                node.group = group && group.value ? parseInt(group.value) : 0;
                const binding = this.getAttribute(node, "binding");
                node.binding = binding && binding.value ? parseInt(binding.value) : 0;
                this.textures.push(node);
            }

            if (this.isSamplerVar(node)) {
                const group = this.getAttribute(node, "group");
                node.group = group && group.value ? parseInt(group.value) : 0;
                const binding = this.getAttribute(node, "binding");
                node.binding = binding && binding.value ? parseInt(binding.value) : 0;
                this.samplers.push(node);
            }

            if (node.astNodeType == "function") {
                this.functions.push(node);
                const vertexStage = this.getAttribute(node, "vertex");
                const fragmentStage = this.getAttribute(node, "fragment");
                const computeStage = this.getAttribute(node, "compute");
                const stage = vertexStage || fragmentStage || computeStage;
                if (stage) {
                    node.inputs = this._getInputs(node);
                    if (this.entry[stage.name])
                        this.entry[stage.name].push(node);
                    else
                        this.entry[stage.name] = [node];
                }
            }
        }
    }

    isTextureVar(node) {
        return node.astNodeType == "var" && WgslReflect.TextureTypes.indexOf(node.type.name) != -1;
    }

    isSamplerVar(node) {
        return node.astNodeType == "var" && WgslReflect.SamplerTypes.indexOf(node.type.name) != -1;
    }

    isUniformVar(node) {
        return node && node.astNodeType == "var" && node.storage == "uniform";
    }

    isStorageVar(node) {
        return node && node.astNodeType == "var" && node.storage == "storage";
    }

    _getInputs(args, inputs) {
        if (args.astNodeType == "function")
            args = args.args;
        if (!inputs)
            inputs = [];

        for (const arg of args) {
            const input = this._getInputInfo(arg);
            if (input)
                inputs.push(input);
            const struct = this.getStruct(arg.type);
            if (struct)
                this._getInputs(struct.members, inputs);
        }

        return inputs;
    }

    _getInputInfo(node) {
        const location = this.getAttribute(node, "location") || this.getAttribute(node, "builtin");
        if (location) {
            let input = {
                name: node.name,
                type: node.type,
                input: node,
                locationType: location.name,
                location: this._parseInt(location.value)
            };
            const interpolation = this.getAttribute(node, "interpolation");
            if (interpolation)
                input.interpolation = interpolation.value;
            return input;
        }
        return null;
    }

    _parseInt(s) {
        const n = parseInt(s);
        return isNaN(n) ? s : n;
    }

    getAlias(name) {
        if (!name) return null;
        if (name.isAstNode) {
            if (name.astNodeType != "type")
                return null;
            name = name.name;
        }
        for (const u of this.aliases) {
            if (u.name == name)
                return u.type;
        }
        return null;
    }

    getStruct(name) {
        if (!name) return null;
        if (name.isAstNode) {
            if (name.astNodeType === "struct")
                return name;
            if (name.astNodeType !== "type")
                return null;
            name = name.name;
        }
        for (const u of this.structs) {
            if (u.name == name)
                return u;
        }
        return null;
    }

    getAttribute(node, name) {
        if (!node || !node.attributes) return null;
        for (let a of node.attributes) {
            if (a.name == name)
                return a;
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
            group[u.binding] = { type: 'buffer', resource: this.getUniformBufferInfo(u) };
        }
        
        for (const u of this.storage) {
            _makeRoom(u.group, u.binding);
            const group = groups[u.group];
            group[u.binding] = { type: 'storage', resource: this.getStorageBufferInfo(u) };
        }

        for (const t of this.textures) {
            _makeRoom(t.group, t.binding);
            const group = groups[t.group];
            group[t.binding] = { type: 'texture', resource: t };
        }

        for (const t of this.samplers) {
            _makeRoom(t.group, t.binding);
            const group = groups[t.group];
            group[t.binding] = { type: 'sampler', resource: t };
        }

        return groups;
    }

    getStorageBufferInfo(node) {
        if (!this.isStorageVar(node))
            return null;

        let group = this.getAttribute(node, "group");
        let binding = this.getAttribute(node, "binding");

        group = group && group.value ? parseInt(group.value) : 0;
        binding = binding && binding.value ? parseInt(binding.value) : 0;

        let info = this._getUniformInfo(node);

        return {
            ...info,
            group,
            binding,
        }
    }

    /// Returns information about a struct type, null if the type is not a struct.
    /// {
    ///     name: String,
    ///     type: Object,
    ///     align: Int,
    ///     size: Int,
    ///     members: Array,
    ///     isArray: Bool
    ///     isStruct: Bool
    /// }
    getStructInfo(node) {
        if (!node)
            return null;

        const struct = node.astNodeType === 'struct' ? node : this.getStruct(node.type);
        if (!struct)
            return null;

        let offset = 0;
        let lastSize = 0;
        let lastOffset = 0;
        let structAlign = 0;
        let buffer = { name: node.name, type: node.type, align: 0, size: 0, members: [] };

        for (let mi = 0, ml = struct.members.length; mi < ml; ++mi) {
            let member = struct.members[mi];
            let name = member.name;

            let info = this.getTypeInfo(member);
            if (!info)
                continue;

            let type = member.type;
            let align = info.align;
            let size = info.size;
            offset = this._roundUp(align, offset + lastSize);
            lastSize = size;
            lastOffset = offset;
            structAlign = Math.max(structAlign, align);
            let isArray = member.type.astNodeType === "array";
            let s = this.getStruct(type) || (isArray ? this.getStruct(member.type.format.name) : null)
            let isStruct = !!s;
            let si = isStruct ? this.getStructInfo(s) : undefined;
            let arrayStride = si?.size ?? isArray ? this.getTypeInfo(member.type.format)?.size : this.getTypeInfo(member.type)?.size;
            
            let arrayCount = member.type.count ?? 0;
            let members = isStruct ? si?.members : undefined;

            let u = { name, offset, size, type, member, isArray, arrayCount, arrayStride, isStruct, members };
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
        let info = this.getStructInfo(node);
        if (info)
            return info;

        info = this.getTypeInfo(node.type);
        if (!info)
            return info;

        let s = this.getStruct(node.type.format?.name);
        let si = s ? this.getStructInfo(s) : undefined;

        info.isArray = node.type.astNodeType === "array";
        info.isStruct = !!s;
                
        info.members = info.isStruct ? si?.members : undefined;
        info.name = node.name;
        info.type = node.type;
        info.arrayStride = si?.size ?? info.isArray ?
            this.getTypeInfo(node.type.format)?.size :
            this.getTypeInfo(node.type)?.size;
        info.arrayCount = parseInt(node.type.count ?? 0);
        return info;
    }

    getUniformBufferInfo(node) {
        if (!this.isUniformVar(node))
            return null;

        let group = this.getAttribute(node, "group");
        let binding = this.getAttribute(node, "binding");

        group = group && group.value ? parseInt(group.value) : 0;
        binding = binding && binding.value ? parseInt(binding.value) : 0;

        let info = this._getUniformInfo(node);

        return {
            ...info,
            group,
            binding,
        }
    }

    getTypeInfo(type) {
        if (!type)
            return undefined;

        let explicitSize = 0;
        const sizeAttr = this.getAttribute(type, "size");
        if (sizeAttr)
            explicitSize = parseInt(sizeAttr.value);

        let explicitAlign = 0;
        const alignAttr = this.getAttribute(type, "align");
        if (alignAttr)
            explicitAlign = parseInt(alignAttr.value);

        if (type.astNodeType == "member")
            type = type.type;

        if (type.astNodeType == "type") {
            const alias = this.getAlias(type.name);
            if (alias) {
                type = alias;
            } else {
                const struct = this.getStruct(type.name);
                if (struct)
                    type = struct;
            }
        }

        {
            const info = WgslReflect.TypeInfo[type.name];
            if (info) {
                const divisor = type.format === 'f16' ? 2 : 1
                return {
                    align: Math.max(explicitAlign, info.align / divisor),
                    size: Math.max(explicitSize, info.size / divisor)
                };
            }
        }

        {
            const info = WgslReflect.TypeInfo[type.name.substring(0, type.name.length - 1)]
            if (info) {
                const divisor = type.name[name.length - 1] === 'h' ? 2 : 1
                return {
                    align: Math.max(explicitAlign, info.align / divisor),
                    size: Math.max(explicitSize, info.size / divisor)
                };
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
            const E = this.getTypeInfo(type.format);
            if (E) {
                size = E.size;
                align = E.align;
            }

            const N = parseInt(type.count || 1);

            const stride = this.getAttribute(type, "stride");
            if (stride)
                size = N * parseInt(stride.value);
            else
                size = N * this._roundUp(align, size);

            if (explicitSize)
                size = explicitSize;

            return {
                align: Math.max(explicitAlign, align),
                size: Math.max(explicitSize, size)
            };
        }

        if (type.astNodeType == "struct") {
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

            return {
                align: Math.max(explicitAlign, align),
                size: Math.max(explicitSize, size)
            };
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
WgslReflect.TypeInfo = {
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

WgslReflect.TextureTypes = Token.any_texture_type.map((t) => { return t.name; });
WgslReflect.SamplerTypes = Token.sampler_type.map((t) => { return t.name; });
