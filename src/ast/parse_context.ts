import { Const, Alias, Struct } from "../wgsl_ast.js";

export class ParseContext {
  constants: Map<string, Const> = new Map();
  aliases: Map<string, Alias> = new Map();
  structs: Map<string, Struct> = new Map();
}
