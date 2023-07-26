import { assert, describe, expect, it } from 'vitest';
const { ok, equal, deepEqual, strictEqual, isNotNull } = assert;

import { WgslScanner, TokenTypes } from '../src';

describe('Scanner', () =>
{
    it('default', () =>
    {
        const scanner = new WgslScanner();
        const tokens = scanner.scanTokens();
        equal(tokens.length, 1);
        equal(tokens[0].type, TokenTypes.eof);
    });

    it('empty', () =>
    {
        const scanner = new WgslScanner('');
        const tokens = scanner.scanTokens();
        equal(tokens.length, 1);
        equal(tokens[0].type, TokenTypes.eof);
    });

    it('newline', () =>
    {
        const scanner = new WgslScanner('\n');
        const tokens = scanner.scanTokens();
        equal(tokens.length, 1);
        equal(tokens[0].type, TokenTypes.eof);
    });

    it('comment', () =>
    {
        const scanner = new WgslScanner('\n// this is a comment\n');
        const tokens = scanner.scanTokens();
        equal(tokens.length, 1);
        equal(tokens[0].type, TokenTypes.eof);
    });

    it('block comment', () =>
    {
        const scanner = new WgslScanner('\n/* this is\n a comment*/\n');
        const tokens = scanner.scanTokens();
        equal(tokens.length, 1);
        equal(tokens[0].type, TokenTypes.eof);
    });

    it('nested block comment', () =>
    {
        const scanner = new WgslScanner('\nfoo/* this /*is\n a*/ comment*/\n');
        const tokens = scanner.scanTokens();
        equal(tokens.length, 2);
        equal(tokens[0].type, TokenTypes.tokens.ident);
        equal(tokens[1].type, TokenTypes.eof);
    });

    it('identifier', () =>
    {
        const scanner = new WgslScanner('abc123');
        const tokens = scanner.scanTokens();
        equal(tokens.length, 2);
        equal(tokens[0].type, TokenTypes.tokens.ident);
    });

    it('123', () =>
    {
        const scanner = new WgslScanner('123');
        const tokens = scanner.scanTokens();
        equal(tokens.length, 2);
        equal(tokens[0].type, TokenTypes.tokens.int_literal);
    });

    it('123.456', () =>
    {
        const scanner = new WgslScanner('123.456');
        const tokens = scanner.scanTokens();
        equal(tokens.length, 2);
        equal(tokens[0].type, TokenTypes.tokens.decimal_float_literal);
    });

    it('.456f', () =>
    {
        const scanner = new WgslScanner('.456f');
        const tokens = scanner.scanTokens();
        equal(tokens.length, 2);
        equal(tokens[0].type, TokenTypes.tokens.decimal_float_literal);
    });

    it('123.', () =>
    {
        const scanner = new WgslScanner('123.');
        const tokens = scanner.scanTokens();
        equal(tokens.length, 2);
        equal(tokens[0].type, TokenTypes.tokens.decimal_float_literal);
    });

    it('-123', () =>
    {
        const scanner = new WgslScanner('-123');
        const tokens = scanner.scanTokens();
        equal(tokens.length, 2);
        equal(tokens[0].type, TokenTypes.tokens.int_literal);
        equal(tokens[0].lexeme, '-123');
    });

    it('-.123', () =>
    {
        const scanner = new WgslScanner('-.123');
        const tokens = scanner.scanTokens();
        equal(tokens.length, 2);
        equal(tokens[0].type, TokenTypes.tokens.decimal_float_literal);
        equal(tokens[0].lexeme, '-.123');
    });

    it('123u', () =>
    {
        const scanner = new WgslScanner('123u');
        const tokens = scanner.scanTokens();
        equal(tokens.length, 2);
        equal(tokens[0].type, TokenTypes.tokens.uint_literal);
        equal(tokens[0].lexeme, '123u');
    });

    it('0x123u', () =>
    {
        const scanner = new WgslScanner('0x123u');
        const tokens = scanner.scanTokens();
        equal(tokens.length, 2);
        equal(tokens[0].type, TokenTypes.tokens.uint_literal);
        equal(tokens[0].lexeme, '0x123u');
    });

    it('0x.5', () =>
    {
        const scanner = new WgslScanner('0x.5');
        const tokens = scanner.scanTokens();
        equal(tokens.length, 2);
        equal(tokens[0].type, TokenTypes.tokens.hex_float_literal);
        equal(tokens[0].lexeme, '0x.5');
    });

    it('a.b', () =>
    {
        const scanner = new WgslScanner('a.b');
        const tokens = scanner.scanTokens();
        equal(tokens.length, 4);
        equal(tokens[0].type, TokenTypes.tokens.ident);
        equal(tokens[0].lexeme, 'a');
        equal(tokens[1].type, TokenTypes.tokens.period);
        equal(tokens[2].type, TokenTypes.tokens.ident);
        equal(tokens[2].lexeme, 'b');
    });

    it('1>>2', () =>
    {
        const scanner = new WgslScanner('1>>2');
        const tokens = scanner.scanTokens();
        equal(tokens.length, 4);
        equal(tokens[1].type, TokenTypes.tokens.shift_right);
    });

    it('1<2||a>>2==0', () =>
    {
        // Syntatical ambiguity case for > vs >>. Here, >> should be a shift_right.
        const scanner = new WgslScanner('a<2||a>>2==0');
        const tokens = scanner.scanTokens();
        equal(tokens.length, 10);
        equal(tokens[5].type, TokenTypes.tokens.shift_right);
    });

    it('array<vec4<f32>>', () =>
    {
        // Syntatical ambiguity case for > vs >>. Here, >> should be two greater_than tokens.
        const scanner = new WgslScanner('array<vec4<f32>>');
        const tokens = scanner.scanTokens();
        equal(tokens.length, 8);
        equal(tokens[6].type, TokenTypes.tokens.greater_than);
    });

    it('fn foo(a, b) -> d { return; }', () =>
    {
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
            TokenTypes.eof];
        equal(tokens.length, expected.length);
        for (let i = 0; i < tokens.length; ++i)
        { equal(tokens[i].type, expected[i]); }
    });

    it('operators', () =>
    {
        const scanner = new WgslScanner(`fn foo() {
            var b = 1;
            b+=1;
            b++;
        }`);
        const tokens = scanner.scanTokens();
        equal(tokens.length, 19);
    });
});
