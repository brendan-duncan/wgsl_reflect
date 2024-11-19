import { test, group } from "../test.js";
import { WgslParser } from "../../../wgsl_reflect.debug.js";

group("Parser", function () {
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
        value: { value: 1.61803398875 },
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

  test("continuing", function (test) {
    const parser = new WgslParser();
    const t = parser.parse(`fn test() {
        var i: i32 = 0;
        loop {
          if i >= 4 { break; }
          if i % 2 == 0 { continue; } // <3>
        
          let step: i32 = 2;
        
          continuing {
            i = i + step;
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
            count: 5,
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
});
