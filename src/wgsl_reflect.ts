/**
 * @author Brendan Duncan / https://github.com/brendan-duncan
 */
import { WgslParser } from "./wgsl_parser.js";
import { Reflect } from "./reflect/reflect.js";

export * from "./reflect/info.js";

export class WgslReflect extends Reflect {
  constructor(code?: string) {
    super();
    if (code) {
      this.update(code);
    }
  }

  update(code: string): void {
    const parser = new WgslParser();
    const ast = parser.parse(code);
    this.updateAST(ast);
  }
}
