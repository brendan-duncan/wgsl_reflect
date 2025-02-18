import { test, group } from "../test.js";
import { WgslParser } from "../../../wgsl_reflect.module.js";

export async function run() {
  await group("Parser", function () {
    test("override reserved name", function (test) {
      const shader = `override read = 123; @compute @workgroup_size(read) fn cs() { }`
      const parser = new WgslParser();
      const t = parser.parse(shader);
      test.equals(t.length, 2);
    });

    test("const", function (test) {
      const shader = `
      const a = 4; // i32 -- 4
      const b : i32 = 4; // i32 -- 4
      const c : u32 = 4; // u32 -- 4
      const d : f32 = 4; // f32 -- 4
      const e = vec3(a, a, a); // vec3<i32> -- [4, 4, 4]
      const f = 2.0; // f32 -- 2
      const g = mat2x2(a, f, a, f); // mat2x2<f32> -- [4, 2, 4, 2]
      const h = array(a, f, a, f); // array<f32> -- [4, 2, 4, 2]
      const i = mat2x2(g); // mat2x2<f32> -- [4, 2, 4, 2]
      const j = vec3(a, f, a); // vec3<f32> -- [4, 2, 4]
      const k = mat2x3(j, j); // mat3x2<f32> -- [4, 2, 4, 4, 2, 4]`;
      const parser = new WgslParser();
      const t = parser.parse(shader);
      test.equals(t.length, 11);

      test.equals(t[0].type.name, "i32", "a.type");
      test.equals(t[0].value.value, 4, "a.value");
      test.equals(t[1].type.name, "i32", "b.type");
      test.equals(t[1].value.value, 4), "b.value";
      test.equals(t[2].type.name, "u32", "c.type");
      test.equals(t[2].value.value, 4, "c.value");
      test.equals(t[3].type.name, "f32", "d.type");
      test.equals(t[3].value.value, 4, "d.value");
      test.equals(t[4].type?.name, "vec3", "e.type");
      test.equals(t[5].type.name, "f32", "f.type");
      test.equals(t[5].value.value, 2, "f.value");
      test.equals(t[6].type?.name, "mat2x2", "g.type");
      test.equals(t[6].type?.format?.name, "f32", "g.format");
      test.equals(t[7].type?.name, "array", "h.type");
      test.equals(t[8].type?.name, "mat2x2", "i.type");
      test.equals(t[8].type?.format?.name, "f32", "i.format");
      test.equals(t[9].type?.name, "vec3", "j.type");
      test.equals(t[10].type?.name, "mat2x3", "k.type");
    });

    test("diagnostic", function (test) {
      const shader = `diagnostic(off, chromium.unreachable_code);`;
      const parser = new WgslParser();
      const t = parser.parse(shader);
      test.equals(t.length, 1);
    });

    test("vec2 var", function (test) {
      const shader = `var a = vec2<f32>(1.0, 2.0);`;
      const parser = new WgslParser();
      const t = parser.parse(shader);
      test.equals(t.length, 1);
      test.notNull(t[0].value);
    });

    test("type inference", function (test) {
      const shader = `
var u32_1 = 1u; // u32 - 0
var i32_1 = 1i; // i32 - 1
var f32_1 = 1f; // f32 - 2
let some_i32 = 1; // i32 - 3
var i32_from_type : i32 = 1; // i32 - 4
var u32_from_type : u32 = 1; // u32 - 5
var f32_promotion : f32 = 1; // f32 - 6
let u32_large : u32 = 2147483649; // u32 - 7
let i32_min = -2147483648;  // i32 - 8
var u32_expr1 = (1 + (1 + (1 + (1 + 1)))) + 1u; // u32 - 9
var u32_expr2 = 1u + (1 + (1 + (1 + (1 + 1)))); // u32 - 10
var u32_expr3 = (1 + (1 + (1 + (1u + 1)))) + 1; // u32 - 11
var u32_expr4 = 1 + (1 + (1 + (1 + (1u + 1)))); // u32 - 12
let i32_clamp = clamp(1, -5, 5); // i32 - 13
let f32_promotion1 = 1.0 + 2 + 3 + 4; // f32 - 14
let f32_promotion2 = 2 + 1.0 + 3 + 4; // f32 - 15
let f32_promotion3 = 1f + ((2 + 3) + 4); // f32 - 16
let f32_promotion4 = ((2 + (3 + 1f)) + 4); // f32 - 17
let some_i32 = 1; // i32 - 18
let out_and_in_again = (0x1ffffffff / 8); // i32 - 19
let out_of_range = (0x1ffffffff / 8u); // u32 - 20
let ambiguous_clamp = clamp(1u, 0, 1i); // invalid, ambiguous types 
let some_f32 : f32 = some_i32; // Type error: i32 cannot be assigned to f32
let overflow_u32 = (1 -2) + 1u; // u32, invalid, -1 is out of range of u32
//var u32_neg = -1u; // invalid: unary minus does not support u32
//var i32_demotion : i32 = 1.0; // Invalid
//var u32_from_expr = 1 + u32_1; // u32 (at runtime)
//var i32_from_expr = 1 + i32_1; // i32 (at runtime)
//let u32_clamp = clamp(5, 0, u32_from_expr); // u32 (at runtime)
//let f32_clamp = clamp(0, f32_1, 1); // f32 (at runtime)
//let mismatch : u32 = 1.0; // invalid, mismatched types`;
      const parser = new WgslParser();
      const t = parser.parse(shader);
      test.equals(t[0].type.name, "u32");
      test.equals(t[1].type.name, "i32");
      test.equals(t[2].type.name, "f32");
      test.equals(t[3].type.name, "i32");
      test.equals(t[4].type.name, "i32");
      test.equals(t[5].type.name, "u32");
      test.equals(t[6].type.name, "f32");
      test.equals(t[7].type.name, "u32");

      //test.equals(t[20].type.name, "u32");
      //test.equals(t[21].type?.name, "i32");
      //test.equals(t[24].type?.name, "f32");
      //test.equals(t[7].type.name, "u32");
      //test.equals(t[8].type.name, "i32");
    });

    test("const2", function (test) {
      const shader = `const FOO = radians(90);
      const BAR = sin(FOO);
      const NUM_COLORS = u32(BAR + 3); // result 4
      @group(0) @binding(0) var<uniform> uni: array<vec4f, NUM_COLORS>;`;
      const parser = new WgslParser();
      const t = parser.parse(shader);
      test.equals(t.length, 4);
    });

    test("override", function (test) {
      const parser = new WgslParser();
      const t = parser.parse("const AP_DISTANCE_PER_SLICE = 4.0; override AP_INV_DISTANCE_PER_SLICE = 1.0 / AP_DISTANCE_PER_SLICE;");
      test.equals(t.length, 2);
      //const v = t[1].evaluate(parser._context);
    });

    test("bar--;", function (test) {
      const parser = new WgslParser();
      const t = parser.parse("fn foo() { bar--; }");
      test.equals(t[0].body.length, 1);
    });

    test(">=", function(test) {
      const parser = new WgslParser();
      const t = parser.parse(`fn foo() {
        var cEdgeBool : vec3<bool> = c3 >= vec3<f32>(1.0);
      }`);
      test.equals(t.length, 1);
    });

    test("requires", function(test) {
      const parser = new WgslParser();
      const t = parser.parse(`requires readonly_and_readwrite_storage_textures;`);
      test.equals(t.length, 1);
    });

    test("diagnostic if", function () {
      const parser = new WgslParser();
      const t = parser.parse(`fn helper() -> vec4<f32> {
        if (d < 0.5) @diagnostic(off,derivative_uniformity) {
          return textureSample(t,s,vec2(0,0));
        }
        return vec4(0.0);
      }`);
    });

    test("diagnostic block", function () {
      const parser = new WgslParser();
      const t = parser.parse(`fn helper() -> vec4<f32> {
        // The derivative_uniformity diagnostic is set to 'warning' severity.
        @diagnostic(warning,derivative_uniformity) {
          return textureSample(t,s,vec2(0,0));
        }
      }`);
    });

    test("_", function (test) {
      const parser = new WgslParser();
      const t = parser.parse("fn foo(_point : vec3<f32>) {}");
      test.equals(t.length, 1);
    });

    test("empty", function (test) {
      const parser = new WgslParser();
      test.equals(parser.parse().length, 0);
      test.equals(parser.parse("").length, 0);
      test.equals(parser.parse([]).length, 0);
    });

    test(";;;;", function (test) {
      const parser = new WgslParser();
      test.equals(parser.parse(";;;;").length, 0);
    });

    // enable:
    test("enable foo;", function (test) {
      const parser = new WgslParser();
      const t = parser.parse("enable foo;");
      test.validateObject(t, [
        {
          astNodeType: "enable",
          name: "foo",
        },
      ]);
    });

    // enable:
    test("diagnostic", function (test) {
      const parser = new WgslParser();
      const t = parser.parse("diagnostic(off, derivative_uniformity);");
      test.validateObject(t, [
        {
          astNodeType: "diagnostic",
          severity: "off",
          rule: "derivative_uniformity",
        },
      ]);
    });

    // alias:
    test("alias", function (test) {
      const parser = new WgslParser();
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
      const parser = new WgslParser();
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
      const parser = new WgslParser();
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
      const parser = new WgslParser();
      const t = parser.parse("alias foo = @stride(16) array<vec4<f32>>;");
      test.equals(t.length, 1);
    });

    // var
    test("var<private> decibels: f32;", function (test) {
      const parser = new WgslParser();
      const t = parser.parse("var<private> decibels: f32;");
      test.equals(t.length, 1);
    });

    test("var<workgroup> worklist: array<i32,10>;", function (test) {
      const parser = new WgslParser();
      const t = parser.parse("var<workgroup> worklist: array<i32,10>;");
      test.equals(t.length, 1);
    });

    test("@group(0) @binding(2) var<uniform> param: Params;", function (test) {
      const parser = new WgslParser();
      const t = parser.parse("@group(0) @binding(2) var<uniform> param: Params;");
      test.equals(t.length, 1);
    });

    test("@group(0) binding(0) var<storage,read_write> pbuf: PositionsBuffer;", function (test) {
      const parser = new WgslParser();
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
      const parser = new WgslParser();
      const t = parser.parse("let golden: f32 = 1.61803398875;");
      test.validateObject(t, [
        {
          astNodeType: "let",
          name: "golden",
          type: {
            name: "f32",
          },
          value: { value: { value: 1.61803398875 } },
        },
      ]);
    });

    test("let e2 = vec3<i32>(0,1,0);", function (test) {
      const parser = new WgslParser();
      const t = parser.parse("let e2 = vec3<i32>(0,1,0);");
      test.validateObject(t, [
        {
          astNodeType: "let",
          name: "e2",
          value: {
            astNodeType: "literalExpr",
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
      const parser = new WgslParser();
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
      const parser = new WgslParser();
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
      const parser = new WgslParser();
      const t = parser.parse("fn test() { let x : i32 = 42; }");
      test.equals(t.length, 1);
    });

    test("@vertex fn vert_main() -> @builtin(position) vec4<f32> {}", function (test) {
      const parser = new WgslParser();
      const t = parser.parse(
        "@vertex fn vert_main() -> @builtin(position) vec4<f32> {}"
      );
      test.equals(t.length, 1);
    });

    test("var W_out_origX0X : texture_storage_2d<rgba16float, write>;", function (test) {
      const parser = new WgslParser();
      const t = parser.parse(
        "var W_out_origX0X : texture_storage_2d<rgba16float, write>;"
      );
      test.equals(t.length, 1);
    });

    test("if (foo) { }", function (test) {
      const parser = new WgslParser();
      const t = parser.parse("fn test() { if (foo) { } }");
      test.equals(t.length, 1);
    });

    test("if foo { }", function (test) {
      const parser = new WgslParser();
      const t = parser.parse("fn test() { if foo { } }");
      test.equals(t.length, 1);
    });

    test("switch foo { case 0: {} default: {} }", function (test) {
      const parser = new WgslParser();
      const t = parser.parse(
        "fn test() { switch foo { case 0: {} default: {} } }"
      );
      test.equals(t.length, 1);
    });

    test("switch foo { }", function (test) {
      const parser = new WgslParser();
      const t = parser.parse("fn test() { switch foo { default: { } } }");
      test.equals(t.length, 1);
    });

    test("trailing_comma", function (test) {
      const parser = new WgslParser();
      const t = parser.parse("fn foo (a:i32,) {}");
      test.equals(t.length, 1);
    });

    test("operators", function (test) {
      const parser = new WgslParser();
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
      const parser = new WgslParser();
      const t = parser.parse(`fn foo() {
              const x = 1;
              const y = 2;
              static_assert x < y; // valid at module-scope.
              static_assert(y != 0); // parentheses are optional.
          }`);
    });

    test("for incrementer", function (test) {
      const parser = new WgslParser();
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
      const parser = new WgslParser();
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

    test("if (foo < 0.33333) { } else if foo < 0.66667 {} else {}", function (test) {
      const parser = new WgslParser();
      const t = parser.parse(
        "fn test() { if (foo < 0.33333) { } else if foo < 0.66667 {} else {} }"
      );

      test.equals(t[0].body[0].elseif.length, 1);

      const t1 = parser.parse(
        "fn test() { if (foo < 0.33333) { } else if foo < 0.66667 {}  else if (foo < 0.86667) {} else {} }"
      );

      test.equals(t1[0].body[0].elseif.length, 2);
    });

    test("loop", function (test) {
      const parser = new WgslParser();
      const t = parser.parse(`fn test() {
          var i: i32 = 0;
          loop {
            if i >= 4 { break; }
            if i % 2 == 0 { continue; } // <3>
            let step: i32 = 2;
            continuing {
              i = i + step;
              break if i >= 4;
            }
          }
        }`);
      test.equals(t[0].body[1].body[3].astNodeType, "continuing");
    });

    test("module scope value constructor", function (test) {
      const parser = new WgslParser();
      const t = parser.parse(`const v2 = vec2f(0.0f, 0.0f);
        const v3 = vec3f(0.0f, 0.0f, 0.0f);
        const v4 = vec4f(0.0f, 0.0f, 0.0f, 0.0f);
        
        const M3 = mat3x3f(v3, v3, v3);
        const M4 = mat4x4f(v4, v4, v4, v4);
        
        fn fv2(outVar : ptr<function, vec2f>) {
          *(outputValue) = v2;
          return;
        }
        
        fn fv3(outVar : ptr<function, vec3f>) {
          *(outputValue) = v3;
          return;
        }
        
        fn fv4(outVar : ptr<function, vec4f>) {
          *(outVar ) = v4;
          return;
        }
        
        fn fM3(outVar : ptr<function, mat3x3<f32>>) {
          *(outVar) = M3;
          return;
        }
        
        fn fM4(outVar : ptr<function, mat4x4<f32>>) {
          *(outVar) = M4;
          return;
        }`);
      //console.log(t);
    });

    test("const switch", function (test) {
      const parser = new WgslParser();
      const t = parser.parse(`alias material_type = u32;
        const MATERIAL_TYPE_LAMBERTIAN : material_type = 0;
        fn scatter(ty: material_type) -> bool {
            switch (ty) {
                case MATERIAL_TYPE_LAMBERTIAN {
                    return true;
                }
            }
        }`);
      //console.log(t);
    });

    test("storage texture", function (test) {
      const parser = new WgslParser();
      const t = parser.parse(
        `var<storage> tex: texture_storage_2d<rgba8unorm, read_write>;`
      );
      test.equals(t[0].name, "tex");
      test.equals(t[0].type.name, "texture_storage_2d");
      test.equals(t[0].type.format, "rgba8unorm");
      test.equals(t[0].type.access, "read_write");
    });

    test("post const array count", function (test) {
      const parser = new WgslParser();
      const t = parser.parse(`alias Arr = array<f32, SIZE>;
        const SIZE = 3u + FOO;
        const FOO = 2u;`);
        test.validateObject(t, [
          {
            astNodeType: "alias",
            name: "Arr",
            type: {
              name: "array",
              format: {
                name: "f32",
              },
              count: { value: 5 },
            },
          },
          {
            astNodeType: "const",
          },
          {
            astNodeType: "const",
          }
        ]);
    });

    test("create vs call [1]", function (test) {
      const shader = `let a = vec2f(1.0, 2.0);
      let b = vec2<f32>(1.0, 2.0);`;
      const parser = new WgslParser();
      const t = parser.parse(shader);
      test.equals(t[0].value.astNodeType, "literalExpr");
      test.equals(t[1].value.astNodeType, "literalExpr");
    });
  });
}
