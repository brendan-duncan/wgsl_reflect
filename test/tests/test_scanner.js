import { test, group } from "../test.js";
import { WgslScanner, TokenTypes } from "../../../wgsl_reflect.module.js";

export async function run() {
  await group("Scanner", async function () {
    await test("(1+2)-3;", function (test) {
      const scanner = new WgslScanner("(1+2)-3;");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 9);
      test.equals(tokens[5].type, TokenTypes.tokens.minus);
    });
    await test("bar--;", function (test) {
      const scanner = new WgslScanner("bar--;");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 4);
      test.equals(tokens[1].type, TokenTypes.tokens.minus_minus);
    });
    await test("b-=1;", function (test) {
      const scanner = new WgslScanner("b-=1;");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 5);
      test.equals(tokens[1].type, TokenTypes.tokens.minus_equal);
    });
    await test("foo=bar--", function (test) {
      const scanner = new WgslScanner("foo=bar--");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 5);
      test.equals(tokens[3].type, TokenTypes.tokens.minus_minus);
    });
    await test("foo=-2", function (test) {
      const scanner = new WgslScanner("foo=-1;");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 5);
      test.equals(tokens[2].type, TokenTypes.tokens.int_literal);
    });

    await test("1-2", function (test) {
      const scanner = new WgslScanner("let foo=bar*2-1;");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 10);
      test.equals(tokens[6].type, TokenTypes.tokens.minus);
    }); 

    await test("default", function (test) {
      const scanner = new WgslScanner();
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 1);
      test.equals(tokens[0].type, TokenTypes.eof);
    });

    await test("empty", function (test) {
      const scanner = new WgslScanner("");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 1);
      test.equals(tokens[0].type, TokenTypes.eof);
    });

    await test("newline", function (test) {
      const scanner = new WgslScanner("\n");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 1);
      test.equals(tokens[0].type, TokenTypes.eof);
    });

    await test("comment", function (test) {
      const scanner = new WgslScanner("\n// this is a comment\n");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 1);
      test.equals(tokens[0].type, TokenTypes.eof);
    });

    await test("block comment", function (test) {
      const scanner = new WgslScanner("\n/* this is\n a comment*/\n");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 1);
      test.equals(tokens[0].type, TokenTypes.eof);
    });

    await test("nested block comment", function (test) {
      const scanner = new WgslScanner("\nfoo/* this /*is\n a*/ comment*/\n");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 2);
      test.equals(tokens[0].type, TokenTypes.tokens.ident);
      test.equals(tokens[1].type, TokenTypes.eof);
    });

    await test("identifier", function (test) {
      const scanner = new WgslScanner("abc123");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 2);
      test.equals(tokens[0].type, TokenTypes.tokens.ident);
    });

    await test("123", function (test) {
      const scanner = new WgslScanner("123");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 2);
      test.equals(tokens[0].type, TokenTypes.tokens.int_literal);
    });

    await test("123.456", function (test) {
      const scanner = new WgslScanner("123.456");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 2);
      test.equals(tokens[0].type, TokenTypes.tokens.decimal_float_literal);
    });

    await test(".456f", function (test) {
      const scanner = new WgslScanner(".456f");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 2);
      test.equals(tokens[0].type, TokenTypes.tokens.decimal_float_literal);
    });

    await test("123.", function (test) {
      const scanner = new WgslScanner("123.");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 2);
      test.equals(tokens[0].type, TokenTypes.tokens.decimal_float_literal);
    });

    await test("-123", function (test) {
      const scanner = new WgslScanner("-123");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 2);
      test.equals(tokens[0].type, TokenTypes.tokens.int_literal);
      test.equals(tokens[0].lexeme, "-123");
    });

    await test("-.123", function (test) {
      const scanner = new WgslScanner("-.123");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 2);
      test.equals(tokens[0].type, TokenTypes.tokens.decimal_float_literal);
      test.equals(tokens[0].lexeme, "-.123");
    });

    await test("123u", function (test) {
      const scanner = new WgslScanner("123u");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 2);
      test.equals(tokens[0].type, TokenTypes.tokens.uint_literal);
      test.equals(tokens[0].lexeme, "123u");
    });

    await test("0i", function (test) {
      const scanner = new WgslScanner("0i");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 2);
      test.equals(tokens[0].type, TokenTypes.tokens.int_literal);
      test.equals(tokens[0].lexeme, "0i");
    });

    await test("0u", function (test) {
      const scanner = new WgslScanner("0u");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 2);
      test.equals(tokens[0].type, TokenTypes.tokens.uint_literal);
      test.equals(tokens[0].lexeme, "0u");
    });

    await test("0f", function (test) {
      const scanner = new WgslScanner("0f");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 2);
      test.equals(tokens[0].type, TokenTypes.tokens.decimal_float_literal);
      test.equals(tokens[0].lexeme, "0f");
    });

    await test("123i", function (test) {
      const scanner = new WgslScanner("123i");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 2);
      test.equals(tokens[0].type, TokenTypes.tokens.int_literal);
      test.equals(tokens[0].lexeme, "123i");
    });

    await test("123f", function (test) {
      const scanner = new WgslScanner("123f");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 2);
      test.equals(tokens[0].type, TokenTypes.tokens.decimal_float_literal);
      test.equals(tokens[0].lexeme, "123f");
    });

    await test("0x123u", function (test) {
      const scanner = new WgslScanner("0x123u");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 2);
      test.equals(tokens[0].type, TokenTypes.tokens.uint_literal);
      test.equals(tokens[0].lexeme, "0x123u");
    });

    await test("0x.5", function (test) {
      const scanner = new WgslScanner("0x.5");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 2);
      test.equals(tokens[0].type, TokenTypes.tokens.hex_float_literal);
      test.equals(tokens[0].lexeme, "0x.5");
    });

    await test("a.b", function (test) {
      const scanner = new WgslScanner("a.b");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 4);
      test.equals(tokens[0].type, TokenTypes.tokens.ident);
      test.equals(tokens[0].lexeme, "a");
      test.equals(tokens[1].type, TokenTypes.tokens.period);
      test.equals(tokens[2].type, TokenTypes.tokens.ident);
      test.equals(tokens[2].lexeme, "b");
    });

    await test("1>>2", function (test) {
      const scanner = new WgslScanner("1>>2");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 4);
      test.equals(tokens[1].type, TokenTypes.tokens.shift_right);
    });

    await test("1<2||a>>2==0", function (test) {
      // Syntatical ambiguity case for > vs >>. Here, >> should be a shift_right.
      const scanner = new WgslScanner("a<2||a>>2==0");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 10);
      test.equals(tokens[5].type, TokenTypes.tokens.shift_right);
    });

    await test("array<f32, 5>", function (test) {
      const scanner = new WgslScanner("array<f32, 5>");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 7);
      test.equals(tokens[5].type, TokenTypes.tokens.greater_than);
    });

    await test("array<vec4<f32>>", function (test) {
      // Syntatical ambiguity case for > vs >>. Here, >> should be two greater_than tokens.
      const scanner = new WgslScanner("array<vec4<f32>>");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 8);
      test.equals(tokens[6].type, TokenTypes.tokens.greater_than);
    });

    await test("array<array<vec4f, 20>>", function (test) {
      // Syntatical ambiguity case for > vs >>. Here, >> should be two greater_than tokens.
      const scanner = new WgslScanner("array<array<vec4f, 20>>");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 10);
      test.equals(tokens[7].type, TokenTypes.tokens.greater_than);
    });

    await test("let v: vec2<i32>= vec2(1,2);", function (test) {
      // Syntatical ambiguity case for <vec2<i32>=. Here, >= should be a greater_than and an equal.
      const scanner = new WgslScanner("let v: vec2<i32>= vec2(1,2);");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 16);
      test.equals(tokens[6].type, TokenTypes.tokens.greater_than);
      test.equals(tokens[7].type, TokenTypes.tokens.equal);
    });

    await test("nested array", function (test) {
      const scanner = new WgslScanner("foo[bar[0]]");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 8);
      test.equals(tokens[6].type, TokenTypes.tokens.bracket_right);
    });

    await test("fn foo(a, b) -> d { return; }", function (test) {
      const scanner = new WgslScanner(`fn foo(a, b) -> d {
              // skip this comment
              return;
          }`);
      const tokens = scanner.scanTokens();
      const expected = [
        TokenTypes.keywords.fn,
        TokenTypes.tokens.ident,
        TokenTypes.tokens.paren_left,
        TokenTypes.tokens.ident,
        TokenTypes.tokens.comma,
        TokenTypes.tokens.ident,
        TokenTypes.tokens.paren_right,
        TokenTypes.tokens.arrow,
        TokenTypes.tokens.ident,
        TokenTypes.tokens.brace_left,
        TokenTypes.keywords.return,
        TokenTypes.tokens.semicolon,
        TokenTypes.tokens.brace_right,
        TokenTypes.eof,
      ];
      test.equals(tokens.length, expected.length);
      for (let i = 0; i < tokens.length; ++i)
        test.equals(tokens[i].type, expected[i]);
    });

    await test("operators", function (test) {
      const scanner = new WgslScanner(`fn foo() {
              var b = 1;
              b+=1;
              b++;
          }`);
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 19);
    });

    await test('fn foo(value_1 : ptr<function, vec4<f32>>) {}', (test) =>
    {
        const scanner = new WgslScanner(`fn foo(value_1 : ptr<function, vec4<f32>>) {}`);
        const tokens = scanner.scanTokens();
        test.equals(tokens.length, 18);
    });

    await test('fn foo(p : ptr<function, array<vec2<f32>, 4u>>) {}', (test) =>
    {
        const scanner = new WgslScanner(`fn foo(p : ptr<function, array<vec2<f32>, 4u>>) {}`);
        const tokens = scanner.scanTokens();
        test.equals(tokens.length, 23);
        test.equals(tokens[17].lexeme, '>');
        test.equals(tokens[18].lexeme, '>');
    });

    await test(">=", function (test) {
      const scanner = new WgslScanner("vec3<bool>=a>=b");
      const tokens = scanner.scanTokens();
      test.equals(tokens.length, 9);
      test.equals(tokens[6].type, TokenTypes.tokens.greater_than_equal);
    });
  });
}
