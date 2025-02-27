import { Const, Alias, Struct } from "../wgsl_ast.js";
export declare class ParseContext {
    constants: Map<string, Const>;
    aliases: Map<string, Alias>;
    structs: Map<string, Struct>;
}
