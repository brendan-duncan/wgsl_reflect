import { test, group } from "../test.js";
import { Parser } from "../../wgsl/wgsl_parser.js";

group("Parser", function() {
    const parser = new Parser();

    test("empty", function(test) {
        test.equals(parser.parse().length, 0);
        test.equals(parser.parse("").length, 0);
        test.equals(parser.parse([]).length, 0);
    });

    test(";;;;", function(test) {
        test.equals(parser.parse(";;;;").length, 0);
    });

    // enable:
    test("enable foo;", function(test) {
        const t = parser.parse("enable foo;");
        test.validateObject(t, [{
            _type: "enable",
            name: "foo"
        }]);
    });

    // type:
    test("type", function(test) {
        const t = parser.parse("type foo = i32;");
        test.validateObject(t, [{
            _type: "alias",
            name: "foo",
            alias: { name: "i32" }
        }]);
    });

    test("type foo = vec3<f32>;", function(test) {
        const t = parser.parse("type foo = vec3<f32>;");
        test.validateObject(t, [{
            _type: "alias",
            name: "foo",
            alias: {
                name: "vec3",
                format: {
                    name: "f32"
                }
            }
        }]);
    });

    test("type foo = array<f32, 5>;", function(test) {
        const t = parser.parse("type foo = array<f32, 5>;");
        test.validateObject(t, [{
            _type: "alias",
            name: "foo",
            alias: {
                name: "array",
                format: {
                    name: "f32"
                },
                count: "5"
            }
        }]);
    });

    test("type foo = [[stride(16)]] array<vec4<f32>>;", function(test) {
        const t = parser.parse("type foo = [[stride(16)]] array<vec4<f32>>;");
        test.equals(t.length, 1);
    });

    // var
    test("var<private> decibels: f32;", function(test) {
        const t = parser.parse("var<private> decibels: f32;");
        test.equals(t.length, 1);
    });

    test("var<workgroup> worklist: array<i32,10>;", function(test) {
        const t = parser.parse("var<workgroup> worklist: array<i32,10>;");
        test.equals(t.length, 1);
    });

    test("[[group(0), binding(2)]] var<uniform> param: Params;", function(test) {
        const t = parser.parse("[[group(0), binding(2)]] var<uniform> param: Params;");
        test.equals(t.length, 1);
    });

    test("[[group(0), binding(0)]] var<storage,read_write> pbuf: PositionsBuffer;", function(test) {
        const t = parser.parse("[[group(0), binding(0)]] var<storage,read_write> pbuf: PositionsBuffer;");
        test.validateObject(t, [{
            _type: "var",
            name: "pbuf",
            attributes: [
                {
                    name: "group",
                    value: "0"
                },
                {
                    name: "binding",
                    value: "0"
                }
            ]
        }]);
    });

    // let
    test("let golden: f32 = 1.61803398875;", function(test) {
        const t = parser.parse("let golden: f32 = 1.61803398875;");
        test.validateObject(t, [{
            _type: "let",
            name: "golden",
            type: {
                name: "f32"
            },
            value:"1.61803398875"
        }]);
    });

    test("let e2 = vec3<i32>(0,1,0);", function(test) {
        const t = parser.parse("let e2 = vec3<i32>(0,1,0);");
        test.validateObject(t, [{
            _type: "let",
            name: "e2",
            value: {
                _type: "create",
                type: {
                    name: "vec3",
                    format: {
                        name: "i32"
                    }
                }
            }
        }]);
    });

    test("[[override(0)]] let has_point_light: bool = true;", function(test) {
        const t = parser.parse("[[override(0)]] let has_point_light: bool = true;");
        test.validateObject(t, [{
            _type: "let",
            name: "has_point_light",
            type: {
                name: "bool"
            },
            value: "true"
        }]);
    });

    // struct

    test("struct", function(test) {
        const code = `
[[block]] struct S {
    [[offset(0)]] a: f32;
    b: f32;
    data: RTArr;
};`;
        const t = parser.parse(code);
        test.equals(t.length, 1);
    });

    // let 
    test("let x : i32 = 42;", function(test) {
        const t = parser.parse("let x : i32 = 42;");
        test.validateObject(t, [{
            _type: "let",
            name: "x"
        }]);
    });

    // function
    test("fn test() { let x : i32 = 42; }", function(test) {
        const t = parser.parse("fn test() { let x : i32 = 42; }");
        test.equals(t.length, 1);
    });

    test("[[stage(vertex)]] fn vert_main() -> [[builtin(position)]] vec4<f32> {}", function(test) {
        const t = parser.parse("[[stage(vertex)]] fn vert_main() -> [[builtin(position)]] vec4<f32> {}");
        test.equals(t.length, 1);
    });
});
