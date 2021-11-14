import { AST, WgslParser } from "./wgsl_parser.js";

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

        for (var node of this.ast) {
            if (node._type == "struct") {
                this.structs.push(node);
                if (this.getAttribute(node, "block")) {
                    this.blocks.push(node);
                }
            }
            if (this.isUniformVar(node))
                this.uniforms.push(node);
        }
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

    isUniformVar(node) {
        return node && node._type == "var" && node.storage == "uniform";
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
        let buffer = { type: 'uniform', size: 0, uniforms: [], group, binding };

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
            buffer.uniforms.push(u);
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
        const typeInfo = {
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

        return typeInfo[type.name];
    }

    _roundUp(k, n) {
        return Math.ceil(n / k) * k;
    }
}


