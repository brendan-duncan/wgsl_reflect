/**
 * @author Brendan Duncan / https://github.com/brendan-duncan
 */
import { AST, WgslParser } from "./wgsl_parser.js";
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
        // All top-level texture vars in the shader;
        this.textures = [];
        // All top-level sampler vars in the shader.
        this.samplers = [];
        // All top-level functions in the shader.
        this.functions = [];
        // All entry functions in the shader: vertex, fragment, and/or compute.
        this.entry = {
            vertex: [],
            fragment: [],
            compute: []
        };

        for (const node of this.ast) {
            if (node._type == "struct") {
                this.structs.push(node);
            }

            if (this.isUniformVar(node)) {
                const group = this.getAttribute(node, "group");
                node.group = group && group.value ? parseInt(group.value) : 0;
                const binding = this.getAttribute(node, "binding");
                node.binding = binding && binding.value ? parseInt(binding.value) : 0;
                this.uniforms.push(node);
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

            if (node._type == "function") {
                this.functions.push(node);
                const stage = this.getAttribute(node, "stage");
                if (stage) {
                    node.inputs = this._getInputs(node);

                    // TODO give error about non-standard stages.
                    if (this.entry[stage.value])
                        this.entry[stage.value].push(node);
                    else
                        this.entry[stage.value] = [node];
                }
            }
        }
    }

    isTextureVar(node) {
        return node._type == "var" && WgslReflect.TextureTypes.indexOf(node.type.name) != -1;
    }

    isSamplerVar(node) {
        return node._type == "var" && WgslReflect.SamplerTypes.indexOf(node.type.name) != -1;
    }

    isUniformVar(node) {
        return node && node._type == "var" && node.storage == "uniform";
    }

    _getInputs(args, inputs) {
        if (args._type == "function")
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

    getStruct(name) {
        if (!name) return null;
        if (name.constructor === AST) {
            if (name._type == "struct")
                return name;
            if (name._type != "type")
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

    getUniformBufferInfo(node) {
        if (!this.isUniformVar(node))
            return null;

        let group = this.getAttribute(node, "group");
        let binding = this.getAttribute(node, "binding");

        group = group && group.value ? parseInt(group.value) : 0;
        binding = binding && binding.value ? parseInt(binding.value) : 0;

        const struct = this.getStruct(node.type);

        let offset = 0;
        let lastSize = 0;
        let lastOffset = 0;
        let structAlign = 0;
        let buffer = { name: node.name, type: 'uniform', align: 0, size: 0, members: [], group, binding };

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

            let u = { name, offset, size, type, member };
            buffer.members.push(u);
        }

        buffer.size = this._roundUp(structAlign, lastOffset + lastSize);
        buffer.align = structAlign;

        return buffer;
    }

    getTypeInfo(type) {
        let explicitSize = 0;
        const sizeAttr = this.getAttribute(type, "size");
        if (sizeAttr)
            explicitSize = parseInt(sizeAttr.value);

        let explicitAlign = 0;
        const alignAttr = this.getAttribute(type, "align");
        if (alignAttr)
            explicitAlign = parseInt(alignAttr.value);

        if (type._type == "member")
            type = type.type;

        let info = WgslReflect.TypeInfo[type.name];
        if (info) {
            return {
                align: Math.max(explicitAlign, info.align),
                size: Math.max(explicitSize, info.size)
            };
        }
        
        if (type.name == "array") {
            let align = 8;
            let size = 8;
            // Type                 AlignOf(T)          Sizeof(T)
            // array<E, N>          AlignOf(E)          N * roundUp(AlignOf(E), SizeOf(E))
            // array<E>             AlignOf(E)          N * roundUp(AlignOf(E), SizeOf(E))  (N determined at runtime)
            //
            // [[stride(Q)]] 
            // array<E, N>          AlignOf(E)          N * Q
            //
            // [[stride(Q)]]
            // array<E>             AlignOf(E)          Nruntime * Q
            //const E = type.format.name;
            const E = this.getTypeInfo(type.format);
            if (E) {
                size = E.size;
                align = E.align;
            }

            const N = parseInt(type.count || 1);

            const stride = this.getAttribute(type, "stride");
            if (stride) {
                size = N * parseInt(stride.value);
            } else {
                size = N * this._roundUp(align, size);
            }

            if (explicitSize)
                size = explicitSize;

            return {
                align: Math.max(explicitAlign, align),
                size: Math.max(explicitSize, size)
            };
        }

        if (type._type == "type") {
            const struct = this.getStruct(type.name);
            if (struct)
                type = struct;
        }

        if (type._type == "struct") {
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
