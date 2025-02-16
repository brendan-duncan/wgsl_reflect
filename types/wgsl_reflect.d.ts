import { Reflect } from "./reflect/reflect.js";
export * from "./reflect/info.js";
export declare class WgslReflect extends Reflect {
    constructor(code?: string);
    update(code: string): void;
}
