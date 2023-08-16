import { test, group } from "../test.js";
import { WgslParser } from "../../js/wgsl_parser.js";

group("Parser", function () {
  const parser = new WgslParser();

  test("empty", function (test) {
    test.equals(parser.parse().length, 0);
    test.equals(parser.parse("").length, 0);
    test.equals(parser.parse([]).length, 0);
  });

  test(";;;;", function (test) {
    test.equals(parser.parse(";;;;").length, 0);
  });

  // enable:
  test("enable foo;", function (test) {
    const t = parser.parse("enable foo;");
    test.validateObject(t, [
      {
        astNodeType: "enable",
        name: "foo",
      },
    ]);
  });

  // alias:
  test("alias", function (test) {
    const t = parser.parse("alias foo = i32;");
    test.validateObject(t, [
      {
        astNodeType: "alias",
        name: "foo",
        type: { name: "i32" },
      },
    ]);
  });

  test("alias foo = vec3<f32>;", function (test) {
    const t = parser.parse("alias foo = vec3<f32>;");
    test.validateObject(t, [
      {
        astNodeType: "alias",
        name: "foo",
        type: {
          name: "vec3",
          format: {
            name: "f32",
          },
        },
      },
    ]);
  });

  test("alias foo = array<f32, 5>;", function (test) {
    const t = parser.parse("alias foo = array<f32, 5>;");
    test.validateObject(t, [
      {
        astNodeType: "alias",
        name: "foo",
        type: {
          name: "array",
          format: {
            name: "f32",
          },
          count: 5,
        },
      },
    ]);
  });

  test("alias foo = @stride(16) array<vec4<f32>>;", function (test) {
    const t = parser.parse("alias foo = @stride(16) array<vec4<f32>>;");
    test.equals(t.length, 1);
  });

  // var
  test("var<private> decibels: f32;", function (test) {
    const t = parser.parse("var<private> decibels: f32;");
    test.equals(t.length, 1);
  });

  test("var<workgroup> worklist: array<i32,10>;", function (test) {
    const t = parser.parse("var<workgroup> worklist: array<i32,10>;");
    test.equals(t.length, 1);
  });

  test("@group(0) @binding(2) var<uniform> param: Params;", function (test) {
    const t = parser.parse("@group(0) @binding(2) var<uniform> param: Params;");
    test.equals(t.length, 1);
  });

  test("@group(0) binding(0) var<storage,read_write> pbuf: PositionsBuffer;", function (test) {
    const t = parser.parse(
      "@group(0) @binding(0) var<storage,read_write> pbuf: PositionsBuffer;"
    );
    test.validateObject(t, [
      {
        astNodeType: "var",
        name: "pbuf",
        attributes: [
          {
            name: "group",
            value: "0",
          },
          {
            name: "binding",
            value: "0",
          },
        ],
      },
    ]);
  });

  // let
  test("let golden: f32 = 1.61803398875;", function (test) {
    const t = parser.parse("let golden: f32 = 1.61803398875;");
    test.validateObject(t, [
      {
        astNodeType: "let",
        name: "golden",
        type: {
          name: "f32",
        },
        value: "1.61803398875",
      },
    ]);
  });

  test("let e2 = vec3<i32>(0,1,0);", function (test) {
    const t = parser.parse("let e2 = vec3<i32>(0,1,0);");
    test.validateObject(t, [
      {
        astNodeType: "let",
        name: "e2",
        value: {
          astNodeType: "createExpr",
          type: {
            name: "vec3",
            format: {
              name: "i32",
            },
          },
        },
      },
    ]);
  });

  // struct

  test("struct", function (test) {
    const code = `
struct S {
    @offset(0) a: f32,
    b: f32,
    data: RTArr,
}`;
    const t = parser.parse(code);
    test.equals(t.length, 1);
  });

  // let
  test("let x : i32 = 42;", function (test) {
    const t = parser.parse("let x : i32 = 42;");
    test.validateObject(t, [
      {
        astNodeType: "let",
        name: "x",
      },
    ]);
  });

  // function
  test("fn test() { let x : i32 = 42; }", function (test) {
    const t = parser.parse("fn test() { let x : i32 = 42; }");
    test.equals(t.length, 1);
  });

  test("@vertex fn vert_main() -> @builtin(position) vec4<f32> {}", function (test) {
    const t = parser.parse(
      "@vertex fn vert_main() -> @builtin(position) vec4<f32> {}"
    );
    test.equals(t.length, 1);
  });

  test("var W_out_origX0X : texture_storage_2d<rgba16float, write>;", function (test) {
    const t = parser.parse(
      "var W_out_origX0X : texture_storage_2d<rgba16float, write>;"
    );
    test.equals(t.length, 1);
  });

  test("if (foo) { }", function (test) {
    const t = parser.parse("fn test() { if (foo) { } }");
    test.equals(t.length, 1);
  });

  test("if foo { }", function (test) {
    const t = parser.parse("fn test() { if foo { } }");
    test.equals(t.length, 1);
  });

  test("switch foo { case 0: {} default: {} }", function (test) {
    const t = parser.parse(
      "fn test() { switch foo { case 0: {} default: {} } }"
    );
    test.equals(t.length, 1);
  });

  test("switch foo { }", function (test) {
    const t = parser.parse("fn test() { switch foo { default: { } } }");
    test.equals(t.length, 1);
  });

  test("trailing_comma", function (test) {
    const t = parser.parse("fn foo (a:i32,) {}");
    test.equals(t.length, 1);
  });

  test("operators", function (test) {
    const t = parser.parse(`fn foo() {
            var b = 1;
            b+=1;
            b-=1;
            b*=1;
            b/=1;
            b&=1;
            b|=1;
            b^=1;
            b>>=1;
            b<<=1;
            b++;
            b--;
        }`);
    test.equals(t[0].body.length, 12);
  });

  test("static_assert", function (test) {
    const t = parser.parse(`fn foo() {
            const x = 1;
            const y = 2;
            static_assert x < y; // valid at module-scope.
            static_assert(y != 0); // parentheses are optional.
        }`);
  });

  test("for incrementer", function (test) {
    const t = parser.parse(`fn foo() {
            for (var i = 0; i < 10; i++) {
            }

            for (var i = 0; i < 10; i += 5) {
            }

            for (var i = 0; i < 10; i = 20) {
            }

            for (var i = 0; i < 10; f(i)) {
            }
        }`);

    test.equals(t[0].body.length, 4);
    test.equals(t[0].body[0].increment.astNodeType, "increment");
    test.equals(t[0].body[1].increment.astNodeType, "assign");
    test.equals(t[0].body[2].increment.astNodeType, "assign");
    test.equals(t[0].body[3].increment.astNodeType, "call");
  });

  test("inferred type arrays", function (test) {
    const t = parser.parse(`
      @vertex fn vs(@builtin(vertex_index) vertexIndex : u32) -> @builtin(position) vec4f {
      let pos = array(
        vec2f( 0.0,  0.5),  // top center
        vec2f(-0.5, -0.5),  // bottom left
        vec2f( 0.5, -0.5)   // bottom right
      );
  
      return vec4f(pos[vertexIndex], 0.0, 1.0);
    }`);

    test.equals(t[0].body.length, 2);
  });

  test('if (foo < 0.33333) { } else if foo < 0.66667 {} else {}', function (test)
  {
      const t = parser.parse('fn test() { if (foo < 0.33333) { } else if foo < 0.66667 {} else {} }');

      test.equals(t[0].body[0].elseif.length, 1);

      const t1 = parser.parse('fn test() { if (foo < 0.33333) { } else if foo < 0.66667 {}  else if (foo < 0.86667) {} else {} }');

      test.equals(t1[0].body[0].elseif.length, 2);
  });
  
});
