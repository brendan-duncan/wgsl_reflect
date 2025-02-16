import { Attribute } from "../wgsl_ast.js";

export class TypeInfo {
  name: string;
  attributes: Attribute[] | null;
  size: number;

  constructor(name: string, attributes: Attribute[] | null) {
    this.name = name;
    this.attributes = attributes;
    this.size = 0;
  }

  get isArray(): boolean {
    return false;
  }

  get isStruct(): boolean {
    return false;
  }

  get isTemplate(): boolean {
    return false;
  }
}

export class MemberInfo {
  name: string;
  type: TypeInfo;
  attributes: Attribute[] | null;
  offset: number;
  size: number;

  constructor(
    name: string,
    type: TypeInfo,
    attributes: Attribute[] | null
  ) {
    this.name = name;
    this.type = type;
    this.attributes = attributes;
    this.offset = 0;
    this.size = 0;
  }

  get isArray(): boolean {
    return this.type.isArray;
  }

  get isStruct(): boolean {
    return this.type.isStruct;
  }

  get isTemplate(): boolean {
    return this.type.isTemplate;
  }

  get align(): number {
    return this.type.isStruct ? (this.type as StructInfo).align : 0;
  }

  get members(): MemberInfo[] | null {
    return this.type.isStruct ? (this.type as StructInfo).members : null;
  }

  get format(): TypeInfo | null {
    return this.type.isArray
      ? (this.type as ArrayInfo).format
      : this.type.isTemplate
      ? (this.type as TemplateInfo).format
      : null;
  }

  get count(): number {
    return this.type.isArray ? (this.type as ArrayInfo).count : 0;
  }

  get stride(): number {
    return this.type.isArray ? (this.type as ArrayInfo).stride : this.size;
  }
}

export class StructInfo extends TypeInfo {
  members: MemberInfo[] = [];
  align: number = 0;
  startLine: number = -1;
  endLine: number = -1;
  inUse: boolean = false;

  constructor(name: string, attributes: Attribute[] | null) {
    super(name, attributes);
  }

  get isStruct(): boolean {
    return true;
  }
}

export class ArrayInfo extends TypeInfo {
  format: TypeInfo;
  count: number;
  stride: number;

  constructor(name: string, attributes: Attribute[] | null) {
    super(name, attributes);
    this.count = 0;
    this.stride = 0;
  }

  get isArray(): boolean {
    return true;
  }
}

export class TemplateInfo extends TypeInfo {
  format: TypeInfo | null;
  access: string;
  constructor(
    name: string,
    format: TypeInfo | null,
    attributes: Attribute[] | null,
    access: string
  ) {
    super(name, attributes);
    this.format = format;
    this.access = access;
  }

  get isTemplate(): boolean {
    return true;
  }
}

export enum ResourceType {
  Uniform,
  Storage,
  Texture,
  Sampler,
  StorageTexture,
}

export class VariableInfo {
  attributes: Attribute[] | null;
  name: string;
  type: TypeInfo;
  group: number;
  binding: number;
  resourceType: ResourceType;
  access: string;

  constructor(
    name: string,
    type: TypeInfo,
    group: number,
    binding: number,
    attributes: Attribute[] | null,
    resourceType: ResourceType,
    access: string
  ) {
    this.name = name;
    this.type = type;
    this.group = group;
    this.binding = binding;
    this.attributes = attributes;
    this.resourceType = resourceType;
    this.access = access;
  }

  get isArray(): boolean {
    return this.type.isArray;
  }

  get isStruct(): boolean {
    return this.type.isStruct;
  }

  get isTemplate(): boolean {
    return this.type.isTemplate;
  }

  get size(): number {
    return this.type.size;
  }

  get align(): number {
    return this.type.isStruct ? (this.type as StructInfo).align : 0;
  }

  get members(): MemberInfo[] | null {
    return this.type.isStruct ? (this.type as StructInfo).members : null;
  }

  get format(): TypeInfo | null {
    return this.type.isArray
      ? (this.type as ArrayInfo).format
      : this.type.isTemplate
      ? (this.type as TemplateInfo).format
      : null;
  }

  get count(): number {
    return this.type.isArray ? (this.type as ArrayInfo).count : 0;
  }

  get stride(): number {
    return this.type.isArray ? (this.type as ArrayInfo).stride : this.size;
  }
}

export class AliasInfo {
  name: string;
  type: TypeInfo;

  constructor(name: string, type: TypeInfo) {
    this.name = name;
    this.type = type;
  }
}

export class InputInfo {
  name: string;
  type: TypeInfo | null;
  locationType: string;
  location: number | string;
  interpolation: string | null;

  constructor(
    name: string,
    type: TypeInfo | null,
    locationType: string,
    location: number | string
  ) {
    this.name = name;
    this.type = type;
    this.locationType = locationType;
    this.location = location;
    this.interpolation = null;
  }
}

export class OutputInfo {
  name: string;
  type: TypeInfo | null;
  locationType: string;
  location: number | string;

  constructor(
    name: string,
    type: TypeInfo | null,
    locationType: string,
    location: number | string
  ) {
    this.name = name;
    this.type = type;
    this.locationType = locationType;
    this.location = location;
  }
}

export class OverrideInfo {
  name: string;
  type: TypeInfo | null;
  attributes: Attribute[] | null;
  id: number;

  constructor(
    name: string,
    type: TypeInfo | null,
    attributes: Attribute[] | null,
    id: number
  ) {
    this.name = name;
    this.type = type;
    this.attributes = attributes;
    this.id = id;
  }
}

export class ArgumentInfo {
  name: string;
  type: TypeInfo;
  attributes: Attribute[] | null;

  constructor(
    name: string,
    type: TypeInfo,
    attributes: Attribute[] | null
  ) {
    this.name = name;
    this.type = type;
    this.attributes = attributes;
  }
}

export class FunctionInfo {
  name: string;
  stage: string | null = null;
  inputs: InputInfo[] = [];
  outputs: OutputInfo[] = [];
  arguments: ArgumentInfo[] = [];
  returnType: TypeInfo | null = null;
  resources: VariableInfo[] = [];
  overrides: OverrideInfo[] = [];
  attributes: Attribute[] | null;
  startLine: number = -1;
  endLine: number = -1;
  inUse: boolean = false;
  calls: Set<FunctionInfo> = new Set();

  constructor(name: string, stage: string | null = null, attributes: Attribute[] | null) {
    this.name = name;
    this.stage = stage;
    this.attributes = attributes;
  }
}

export class EntryFunctions {
  vertex: FunctionInfo[] = [];
  fragment: FunctionInfo[] = [];
  compute: FunctionInfo[] = [];
}
