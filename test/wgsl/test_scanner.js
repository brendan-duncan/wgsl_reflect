import { test, group } from "../test.js";
import { WgslScanner, Token, Keyword } from "../../wgsl/wgsl_scanner.js";

group("Scanner", function() {
    test("default", function(test) {
        const scanner = new WgslScanner();
        const tokens = scanner.scanTokens();
        test.equals(tokens.length, 1);
        test.equals(tokens[0]._type, Token.EOF);
    });

    test("empty", function(test) {
        const scanner = new WgslScanner("");
        const tokens = scanner.scanTokens();
        test.equals(tokens.length, 1);
        test.equals(tokens[0]._type, Token.EOF);
    });

    test("newline", function(test) {
        const scanner = new WgslScanner("\n");
        const tokens = scanner.scanTokens();
        test.equals(tokens.length, 1);
        test.equals(tokens[0]._type, Token.EOF);
    });

    test("comment", function(test) {
        const scanner = new WgslScanner("\n// this is a comment\n");
        const tokens = scanner.scanTokens();
        test.equals(tokens.length, 1);
        test.equals(tokens[0]._type, Token.EOF);
    });

    test("identifier", function(test) {
        const scanner = new WgslScanner("abc123");
        const tokens = scanner.scanTokens();
        test.equals(tokens.length, 2);
        test.equals(tokens[0]._type, Token.ident);
    });

    test("123", function(test) {
        const scanner = new WgslScanner("123");
        const tokens = scanner.scanTokens();
        test.equals(tokens.length, 2);
        test.equals(tokens[0]._type, Token.int_literal);
    });

    test("123.456", function(test) {
        const scanner = new WgslScanner("123.456");
        const tokens = scanner.scanTokens();
        test.equals(tokens.length, 2);
        test.equals(tokens[0]._type, Token.decimal_float_literal);
    });

    test(".456", function(test) {
        const scanner = new WgslScanner(".456");
        const tokens = scanner.scanTokens();
        test.equals(tokens.length, 2);
        test.equals(tokens[0]._type, Token.decimal_float_literal);
    });

    test("123.", function(test) {
        const scanner = new WgslScanner("123.");
        const tokens = scanner.scanTokens();
        test.equals(tokens.length, 2);
        test.equals(tokens[0]._type, Token.decimal_float_literal);
    });

    test("-123", function(test) {
        const scanner = new WgslScanner("-123");
        const tokens = scanner.scanTokens();
        test.equals(tokens.length, 2);
        test.equals(tokens[0]._type, Token.int_literal);
        test.equals(tokens[0]._lexeme, "-123");
    });

    test("-.123", function(test) {
        const scanner = new WgslScanner("-.123");
        const tokens = scanner.scanTokens();
        test.equals(tokens.length, 2);
        test.equals(tokens[0]._type, Token.decimal_float_literal);
        test.equals(tokens[0]._lexeme, "-.123");
    });

    test("123u", function(test) {
        const scanner = new WgslScanner("123u");
        const tokens = scanner.scanTokens();
        test.equals(tokens.length, 2);
        test.equals(tokens[0]._type, Token.uint_literal);
        test.equals(tokens[0]._lexeme, "123u");
    });

    test("0x123u", function(test) {
        const scanner = new WgslScanner("0x123u");
        const tokens = scanner.scanTokens();
        test.equals(tokens.length, 2);
        test.equals(tokens[0]._type, Token.uint_literal);
        test.equals(tokens[0]._lexeme, "0x123u");
    });

    test("0x.5", function(test) {
        const scanner = new WgslScanner("0x.5");
        const tokens = scanner.scanTokens();
        test.equals(tokens.length, 2);
        test.equals(tokens[0]._type, Token.hex_float_literal);
        test.equals(tokens[0]._lexeme, "0x.5");
    });

    test("a.b", function(test) {
        const scanner = new WgslScanner("a.b");
        const tokens = scanner.scanTokens();
        test.equals(tokens.length, 4);
        test.equals(tokens[0]._type, Token.ident);
        test.equals(tokens[0]._lexeme, "a");
        test.equals(tokens[1]._type, Token.period);
        test.equals(tokens[2]._type, Token.ident);
        test.equals(tokens[2]._lexeme, "b");
    });

    test("1>>2", function(test) {
        const scanner = new WgslScanner("1>>2");
        const tokens = scanner.scanTokens();
        test.equals(tokens.length, 4);
        test.equals(tokens[1]._type, Token.shift_right);
    });

    test("1<2||a>>2==0", function(test) {
        // Syntatical ambiguity case for > vs >>. Here, >> should be a shift_right.
        const scanner = new WgslScanner("a<2||a>>2==0");
        const tokens = scanner.scanTokens();
        test.equals(tokens.length, 10);
        test.equals(tokens[5]._type, Token.shift_right);
    });

    test("array<vec4<f32>>", function(test) {
        // Syntatical ambiguity case for > vs >>. Here, >> should be two greater_than tokens.
        const scanner = new WgslScanner("array<vec4<f32>>");
        const tokens = scanner.scanTokens();
        test.equals(tokens.length, 8);
        test.equals(tokens[6]._type, Token.greater_than);
    });

    test("fn foo(a, b) -> d { return; }", function(test) {
        const scanner = new WgslScanner(`fn foo(a, b) -> d {
            // skip this comment
            return;
        }`);
        const tokens = scanner.scanTokens();
        const expected = [ Keyword.fn, Token.ident, Token.paren_left, Token.ident,
            Token.comma, Token.ident, Token.paren_right, Token.arrow, Token.ident,
            Token.brace_left, Keyword.return, Token.semicolon, Token.brace_right, Token.EOF ];
        test.equals(tokens.length, expected.length);
        for (let i = 0; i < tokens.length; ++i)
            test.equals(tokens[i]._type, expected[i]);
    });
});
