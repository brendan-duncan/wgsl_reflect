export declare type SizeAlign = {
  size: number;
  align: number;
};

// opaque type
export declare interface AST {
};

export declare type Member = {
  name: string;
  offset: number;
  size: number;
  type: AST;
  member: AST;
};

export declare type StructInfo = {
  name: string;
  type: string;
  align: number;
  size: number;
  members: Member[];
};

export declare type UniformBufferInfo = StructInfo & {
  group: number;
  binding: number;
};

export declare type Binding = {
  type: "buffer" | ,
  resource: AST | StructInfo | UniformBufferInfo;
};

export declare class WgslReflect {
  structs: AST[];
  uniforms: AST[];
  storage: AST[];
  textures: AST[];
  samplers: AST[];
  functions: AST[];
  aliases: AST[];
  entry: {
    vertex: AST[];
    fragment: AST[];
    compute: AST[];
  };

  constructor(code: string);
  initialize(code: string): void;

  isTextureVar(node: AST);
  isSamplerVar(node: AST);
  isUniformVar(node: AST);
  isStorageVar(node: AST);

  getBindGroups();
  getAttribute(node: AST, name: string);
  getStruct(name: string | AST);
  getAlias(name: string | AST);
  getStorageBufferInfo(node: AST)
  getStructInfo(node: AST);
  getUniformBufferInfo(node: AST)
  getTypeInfo(type: AST): SizeAlign;
}
