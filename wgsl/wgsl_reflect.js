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

        this.structs = [];
        this.blocks = [];
        this.uniforms = [];
        this.textures = [];
        this.samplers = [];

        for (var node of this.ast) {
            if (node._type == "struct") {
                this.structs.push(node);
                if (this.getAttribute(node, "block")) {
                    this.blocks.push(node);
                }
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

    getBlock(name) {
        if (!name) return null;
        if (name.constructor === AST) {
            if (name._type == "struct") {
                if (this.getAttribute("block"))
                    return name;
            }
            if (name._type != "type")
                return null;
            name = name.name;
        }
        for (const u of this.blocks) {
            if (u.name == name)
                return u;
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

        const struct = this.getBlock(node.type);

        let offset = 0;
        let lastSize = 0;
        let lastOffset = 0;
        let structAlign = 0;
        let buffer = { name: node.name, type: 'uniform', size: 0, members: [], group, binding };

        for (let mi = 0, ml = struct.members.length; mi < ml; ++mi) {
            let member = struct.members[mi];
            let name = member.name;

            let info = this.getTypeInfo(member.type);
            if (!info)
                continue;

            let type = member.type;
            let align = info.align;
            let size = info.size;
            offset = this._roundUp(align, offset + lastSize);
            lastSize = size;
            lastOffset = offset;
            structAlign += align;

            let u = { name, offset, size, type, member };
            buffer.members.push(u);
        }

        buffer.size = this._roundUp(structAlign, lastOffset + lastSize);
        return buffer;
    }

    getTypeSize(type) {
        const info = this.getTypeInfo(type);
        if (!type)
            return 0;
        return info.size;
    }

    getTypeInfo(type) {
        return WgslReflect.TypeInfo[type.name];
    }

    _roundUp(k, n) {
        return Math.ceil(n / k) * k;
    }
}

WgslReflect.TypeInfo = {
    "i32": { align: 4, size: 4 },
    "u32": { align: 4, size: 4 },
    "f32": { align: 4, size: 4 },
    "vec2": { align: 8, size: 4 * 2 },
    "vec3": { align: 16, size: 4 * 3 },
    "vec4": { align: 16, size: 4 * 4 },
    "mat2x2": { align: 8, size: 4 * 2 * 2 },
    "mat3x2": { align: 8, size: 4 * 3 * 2 },
    "mat4x2": { align: 8, size: 4 * 4 * 2 },
    "mat2x3": { align: 16, size: 4 * 2 * 3 },
    "mat3x3": { align: 16, size: 4 * 3 * 3 },
    "mat4x3": { align: 16, size: 4 * 4 * 3 },
    "mat2x4": { align: 16, size: 4 * 2 * 4 },
    "mat3x4": { align: 16, size: 4 * 3 * 4 },
    "mat4x4": { align: 16, size: 4 * 4 * 4 },
};

WgslReflect.TextureTypes = Token.any_texture_type.map((t) => { return t.name; });
WgslReflect.SamplerTypes = Token.sampler_type.map((t) => { return t.name; });
