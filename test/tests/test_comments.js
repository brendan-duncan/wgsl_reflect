import { test, group } from "../test.js";
import { WgslScanner, WgslParser, WgslReflect } from "../../wgsl_reflect.module.js";

function texts(comments) {
  return comments ? comments.map((c) => c.text) : null;
}

export async function run() {
  await group("Comments", async function () {
    await test("scanner collects comments", async function (test) {
      const scanner = new WgslScanner(`// a
        /* b /* nested */ */ let x = 1; // c`);
      const tokens = scanner.scanTokens();
      test.equals(texts(scanner.comments), ["// a", "/* b /* nested */ */", "// c"]);
      test.equals(texts(tokens[0].leadingComments), ["// a", "/* b /* nested */ */"]);
      test.equals(scanner.comments[0].kind, "line");
      test.equals(scanner.comments[1].kind, "block");
      // The trailing comment belongs to the eof token.
      test.equals(texts(tokens[tokens.length - 1].leadingComments), ["// c"]);
    });

    await test("comment line numbers", async function (test) {
      const scanner = new WgslScanner(`// a\r\n/* b\n c */\nlet x = 1;`);
      const tokens = scanner.scanTokens();
      const [a, b] = scanner.comments;
      test.equals(a.text, "// a");
      test.equals([a.line, a.endLine], [1, 1]);
      test.equals([b.line, b.endLine], [2, 3]);
      test.equals(tokens[0].line, 4);
    });

    await test("comment content", async function (test) {
      const scanner = new WgslScanner(`/// doc
        /**
         * Line one.
         * Line two.
         */
        // plain
        let x = 1;`);
      scanner.scanTokens();
      const c = scanner.comments.map((c) => c.content);
      test.equals(c, ["doc", "Line one.\nLine two.", "plain"]);
    });

    await test("leading comment before attributes", async function (test) {
      const parser = new WgslParser();
      const ast = parser.parse(`
        // doc for foo
        @compute @workgroup_size(1)
        fn foo() {}`);
      test.equals(texts(ast[0].leadingComments), ["// doc for foo"]);
    });

    await test("comment between attributes and declaration", async function (test) {
      const parser = new WgslParser();
      const ast = parser.parse(`
        @compute @workgroup_size(1)
        // doc for foo
        fn foo() {}`);
      test.equals(texts(ast[0].leadingComments), ["// doc for foo"]);
    });

    await test("blank line detaches a comment", async function (test) {
      const parser = new WgslParser();
      const ast = parser.parse(`
        /* lonely comment */

        // doc for foo
        fn foo() {}`);
      test.equals(texts(ast[0].leadingComments), ["// doc for foo"]);
      // Detached comments are still available from the parser.
      test.equals(texts(parser.comments), ["/* lonely comment */", "// doc for foo"]);
    });

    await test("trailing comment", async function (test) {
      const parser = new WgslParser();
      const ast = parser.parse(`
        const a = 1; // about a
        // about b
        const b = 2;`);
      test.equals(texts(ast[0].trailingComments), ["// about a"]);
      test.isNull(ast[0].leadingComments);
      test.equals(texts(ast[1].leadingComments), ["// about b"]);
      test.isNull(ast[1].trailingComments);
    });

    await test("struct member comments", async function (test) {
      const parser = new WgslParser();
      const ast = parser.parse(`
        // A light.
        struct Light {
          // Position in world space.
          position: vec3f,
          color: vec3f, // Linear RGB.
          @align(16)
          // Intensity in lux.
          intensity: f32 /* last */
        }`);
      const s = ast[0];
      test.equals(texts(s.leadingComments), ["// A light."]);
      test.equals(texts(s.members[0].leadingComments), ["// Position in world space."]);
      test.isNull(s.members[0].trailingComments);
      test.isNull(s.members[1].leadingComments);
      test.equals(texts(s.members[1].trailingComments), ["// Linear RGB."]);
      test.equals(texts(s.members[2].leadingComments), ["// Intensity in lux."]);
      test.equals(texts(s.members[2].trailingComments), ["/* last */"]);
    });

    await test("function argument comments", async function (test) {
      const parser = new WgslParser();
      const ast = parser.parse(`
        fn foo(
          // The first.
          a: f32,
          b: f32, // The second.
        ) {}`);
      const args = ast[0].args;
      test.equals(texts(args[0].leadingComments), ["// The first."]);
      test.equals(texts(args[1].trailingComments), ["// The second."]);
    });

    await test("statement comments", async function (test) {
      const parser = new WgslParser();
      const ast = parser.parse(`
        fn foo() { // opening
          // about x
          var x = 1;
          x = 2; // set x

          // end of block
        }`);
      const body = ast[0].body;
      test.equals(texts(body[0].leadingComments), ["// opening", "// about x"]);
      test.equals(texts(body[1].trailingComments), ["// set x"]);
      test.equals(parser.comments.length, 4);
    });

    await test("comments in expressions are not attached", async function (test) {
      const parser = new WgslParser();
      const ast = parser.parse(`const a = max(1, /* b */ 2);`);
      test.isNull(ast[0].leadingComments);
      test.isNull(ast[0].trailingComments);
      test.equals(texts(parser.comments), ["/* b */"]);
    });

    await test("parse from tokens keeps comments", async function (test) {
      const tokens = new WgslScanner(`// doc\nconst a = 1;`).scanTokens();
      const ast = new WgslParser().parse(tokens);
      test.equals(texts(ast[0].leadingComments), ["// doc"]);
    });

    await test("reflection comments", async function (test) {
      const reflect = new WgslReflect(`
        /// Scene lights.
        struct Light {
          /// Position in world space.
          position: vec3f,
          color: vec3f, // Linear RGB.
        }

        // The lights.
        @group(0) @binding(0) var<uniform> light: Light;

        /**
         * Entry point.
         */
        @fragment
        fn main(
          // Interpolated color.
          @location(0) c: vec4f
        ) -> @location(0) vec4f {
          return c;
        }`);
      const s = reflect.structs[0];
      test.equals(s.comment, "Scene lights.");
      test.equals(s.members[0].comment, "Position in world space.");
      test.equals(s.members[1].comment, "Linear RGB.");
      test.equals(reflect.uniforms[0].comment, "The lights.");
      const fn = reflect.functions[0];
      test.equals(fn.comment, "Entry point.");
      test.equals(fn.arguments[0].comment, "Interpolated color.");
    });
  });
}
