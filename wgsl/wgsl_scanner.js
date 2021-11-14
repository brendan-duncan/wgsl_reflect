export class Token {
    constructor(type, lexeme, line) {
        this._type = type;
        this._lexeme = lexeme;
        this._line = line;
    }

    toString() {
        return `${this._lexeme}`;
    }
}

Token.EOF = { name: "EOF", type: "token", rule: -1 };

export let Keyword = {};

export class WgslScanner {
    constructor(source) {
        this._source = source || "";
        this._tokens = [];
        this._start = 0;
        this._current = 0;
        this._line = 1;
    }

    scanTokens() {
        while (!this._isAtEnd()) {
            this._start = this._current;
            if (!this.scanToken())
                throw `Invalid syntax at line ${this._line}`;
        }

        this._tokens.push(new Token(Token.EOF, "", this._line));
        return this._tokens;
    }

    scanToken() {
        // Find the longest consecutive set of characters that match a rule.
        let lexeme = this._advance();
        let matchToken = null;

        for (;;) {
            // Skip whitespace
            if (this._isWhitespace(lexeme)) {
                lexeme = this._advance();
                this._start++;
                continue;
            }

            // Skip line-feed, adding to the line counter.
            if (lexeme == "\n") {
                this._line++;
                lexeme = this._advance();
                this._start++;
                continue;
            }

            // If it's a // comment, skip everything until the next line-feed
            if (lexeme == "/") {
                if (this._peekAhead() == "/") {
                    while (lexeme != "\n") {
                        lexeme = this._advance();
                        this._start++;
                        if (this._isAtEnd()) {
                            return true;
                        }
                    }
                    // skip the linefeed
                    lexeme = this._advance();
                    this._line++;
                    continue;
                }
            }

            let matchedToken = this._findToken(lexeme);

            // The exception to "longest lexeme" rule is '>>'. In the case of 1>>2, it's a shift_right.
            // In the case of array<vec4<f32>>, it's two greater_than's (one to close the vec4,
            // and one to close the array).
            // I don't know of a great way to resolve this, so '>>' is special-cased and if
            // there was a less_than up to some number of tokens previously, and the token prior to
            // that is a keyword that requires a '<', then it will be split into two greater_than's;
            // otherwise it's a shift_right.
            if (lexeme == ">" && this._peekAhead() == ">") {
                let foundLessThan = false;
                let ti = this._tokens.length - 1;
                for (let count = 0; count < 4 && ti >= 0; ++count, --ti) {
                    if (this._tokens[ti]._type == Token.less_than) {
                        if (ti > 0 && Token.template_types.indexOf(this._tokens[ti - 1]._type) != -1) {
                            foundLessThan = true;
                        }
                        break;
                    }
                }
                // If there was a less_than in the recent token history, then this is probably a
                // greater_than.
                if (foundLessThan) {
                    this._addToken(matchedToken);
                    return true;
                }
            }

            // The current lexeme may not match any rule, but some token types may be invalid for
            // part of the string but valid after a few more characters.
            // For example, 0x.5 is a hex_float_literal. But as it's being scanned,
            // "0" is a int_literal, then "0x" is invalid. If we stopped there, it would return
            // the int_literal "0", but that's incorrect. So if we look forward a few characters,
            // we'd get "0x.", which is still invalid, followed by "0x.5" which is the correct
            // hex_float_literal. So that means if we hit an non-matching string, we should look
            // ahead up to two characters to see if the string starts matching a valid rule again.
            if (!matchedToken) {
                let lookAheadLexeme = lexeme;
                let lookAhead = 0;
                const maxLookAhead = 2;
                for (let li = 0; li < maxLookAhead; ++li) {
                    lookAheadLexeme += this._peekAhead(li);
                    matchedToken = this._findToken(lookAheadLexeme);
                    if (matchedToken) {
                        lookAhead = li;
                        break;
                    }
                }

                if (!matchedToken) {
                    if (!matchToken)
                        return false;
                    this._current--;
                    this._addToken(matchToken);
                    return true;
                }

                lexeme = lookAheadLexeme;
                this._current += lookAhead + 1;
            }

            matchToken = matchedToken;

            if (this._isAtEnd())
                break;

            lexeme += this._advance();
        }

        // We got to the end of the input stream. Then the token we've ready so far is it.
        if (matchToken == null)
            return false;

        this._addToken(matchToken);
        return true;
    }

    _findToken(lexeme) {
        for (const name in Keyword) {
            const token = Keyword[name];
            if (this._match(lexeme, token.rule)) {
                return token;
            }
        }
        for (const name in Token.Tokens) {
            const token = Token.Tokens[name];
            if (this._match(lexeme, token.rule)) {
                return token;
            }
        }
        return null;
    }

    _match(lexeme, rule) {
        if (typeof(rule) == "string") {
            if (rule == lexeme) {
                return true;
            }
        } else {
            // regex
            const match = rule.exec(lexeme);
            if (match && match.index == 0 && match[0] == lexeme)
                return true;
        }
        return false;
    }

    _isAtEnd() {
        return this._current >= this._source.length;
    }

    _isWhitespace(c) {
        return c == " " || c == "\t" || c == "\r";
    }

    _advance(amount) {
        let c = this._source[this._current];
        amount = amount || 0;
        amount++;
        this._current += amount;
        return c;
    }

    _peekAhead(offset) {
        offset = offset || 0;
        if (this._current + offset >= this._source.length) return "\0";
        return this._source[this._current + offset];
    }

    _addToken(type) {
        const text = this._source.substring(this._start, this._current);
        this._tokens.push(new Token(type, text, this._line));
    }
}

Token.WgslTokens = {
    decimal_float_literal:
        /((-?[0-9]*\.[0-9]+|-?[0-9]+\.[0-9]*)((e|E)(\+|-)?[0-9]+)?)|(-?[0-9]+(e|E)(\+|-)?[0-9]+)/,
    hex_float_literal:
        /-?0x((([0-9a-fA-F]*\.[0-9a-fA-F]+|[0-9a-fA-F]+\.[0-9a-fA-F]*)((p|P)(\+|-)?[0-9]+)?)|([0-9a-fA-F]+(p|P)(\+|-)?[0-9]+))/,
    int_literal:
        /-?0x[0-9a-fA-F]+|0|-?[1-9][0-9]*/,
    uint_literal:
        /0x[0-9a-fA-F]+u|0u|[1-9][0-9]*u/,
    ident:
        /[a-zA-Z][0-9a-zA-Z_]*/,
    and:
        '&',
    and_and:
        '&&',
    arrow :
        '->',
    attr_left:
        '[[',
    attr_right:
        ']]',
    forward_slash:
        '/',
    bang:
        '!',
    bracket_left:
        '[',
    bracket_right:
        ']',
    brace_left:
        '{',
    brace_right:
        '}',
    colon:
        ':',
    comma:
        ',',
    equal:
        '=',
    equal_equal:
        '==',
    not_equal:
        '!=',
    greater_than:
        '>',
    greater_than_equal:
        '>=',
    shift_right:
        '>>',
    less_than:
        '<',
    less_than_equal:
        '<=',
    shift_left:
        '<<',
    modulo:
        '%',
    minus:
        '-',
    minus_minus:
        '--',
    period:
        '.',
    plus:
        '+',
    plus_plus:
        '++',
    or:
        '|',
    or_or:
        '||',
    paren_left:
        '(',
    paren_right:
        ')',
    semicolon:
        ';',
    star:
        '*',
    tilde:
        '~',
    underscore:
        '_',
    xor:
        '^',
};

Token.WgslKeywords = [
    "array",
    "atomic",
    "bool",
    "f32",
    "i32",
    "mat2x2",
    "mat2x3",
    "mat2x4",
    "mat3x2",
    "mat3x3",
    "mat3x4",
    "mat4x2",
    "mat4x3",
    "mat4x4",
    "ptr",
    "sampler",
    "sampler_comparison",
    "struct",
    "texture_1d",
    "texture_2d",
    "texture_2d_array",
    "texture_3d",
    "texture_cube",
    "texture_cube_array",
    "texture_multisampled_2d",
    "texture_storage_1d",
    "texture_storage_2d",
    "texture_storage_2d_array",
    "texture_storage_3d",
    "texture_depth_2d",
    "texture_depth_2d_array",
    "texture_depth_cube",
    "texture_depth_cube_array",
    "texture_depth_multisampled_2d",
    "u32",
    "vec2",
    "vec3",
    "vec4",
    "bitcast",
    "block",
    "break",
    "case",
    "continue",
    "continuing",
    "default",
    "discard",
    "else",
    "elseif",
    "enable",
    "fallthrough",
    "false",
    "fn",
    "for",
    "function",
    "if",
    "let",
    "loop",
    "private",
    "read",
    "read_write",
    "return",
    "storage",
    "switch",
    "true",
    "type",
    "uniform",
    "var",
    "workgroup",
    "write",
    "r8unorm",
    "r8snorm",
    "r8uint",
    "r8sint",
    "r16uint",
    "r16sint",
    "r16float",
    "rg8unorm",
    "rg8snorm",
    "rg8uint",
    "rg8sint",
    "r32uint",
    "r32sint",
    "r32float",
    "rg16uint",
    "rg16sint",
    "rg16float",
    "rgba8unorm",
    "rgba8unorm_srgb",
    "rgba8snorm",
    "rgba8uint",
    "rgba8sint",
    "bgra8unorm",
    "bgra8unorm_srgb",
    "rgb10a2unorm",
    "rg11b10float",
    "rg32uint",
    "rg32sint",
    "rg32float",
    "rgba16uint",
    "rgba16sint",
    "rgba16float",
    "rgba32uint",
    "rgba32sint",
    "rgba32float"
];

Token.WgslReserved = [
    "asm",
    "bf16",
    "const",
    "do",
    "enum",
    "f16",
    "f64",
    "handle",
    "i8",
    "i16",
    "i64",
    "mat",
    "premerge",
    "regardless",
    "typedef",
    "u8",
    "u16",
    "u64",
    "unless",
    "using",
    "vec",
    "void",
    "while"
];

function _InitTokens() {
    Token.Tokens = {};
    for (let token in Token.WgslTokens) {
        Token.Tokens[token] = {
            name: token,
            type: "token",
            rule: Token.WgslTokens[token],
            toString: function() { return token; }
        };
        Token[token] = Token.Tokens[token];
    }

    for (let i = 0, l = Token.WgslKeywords.length; i < l; ++i) {
        Keyword[Token.WgslKeywords[i]] = {
            name: Token.WgslKeywords[i],
            type: "keyword",
            rule: Token.WgslKeywords[i],
            toString: function() { return Token.WgslKeywords[i]; }
        };
    }

    for (let i = 0, l = Token.WgslReserved.length; i < l; ++i) {
        Keyword[Token.WgslReserved[i]] = {
            name: Token.WgslReserved[i], 
            type: "reserved",
            rule: Token.WgslReserved[i],
            toString: function() { return Token.WgslReserved[i]; }
        };
    }

    // WGSL grammar has a few keywords that have different token names than the strings they
    // represent. Aliasing them here.

    Keyword.int32 = Keyword.i32;
    Keyword.uint32 = Keyword.u32;
    Keyword.float32 = Keyword.f32;
    Keyword.pointer = Keyword.ptr;

    // The grammar has a few rules where the rule can match to any one of a given set of keywords
    // or tokens. Defining those here.

    Token.storage_class = [
        Keyword.function,
        Keyword.private,
        Keyword.workgroup,
        Keyword.uniform,
        Keyword.storage
    ];
    
    Token.access_mode = [
        Keyword.read,
        Keyword.write,
        Keyword.read_write
    ];
    
    Token.sampler_type = [
        Keyword.sampler,
        Keyword.sampler_comparison
    ];
    
    Token.sampled_texture_type = [
        Keyword.texture_1d,
        Keyword.texture_2d,
        Keyword.texture_2d_array,
        Keyword.texture_3d,
        Keyword.texture_cube,
        Keyword.texture_cube_array
    ];
    
    Token.multisampled_texture_type = [
        Keyword.texture_multisampled_2d
    ];
    
    Token.storage_texture_type = [
        Keyword.texture_storage_1d,
        Keyword.texture_storage_2d,
        Keyword.texture_storage_2d_array,
        Keyword.texture_storage_3d
    ];
    
    Token.depth_texture_type = [
        Keyword.texture_depth_2d,
        Keyword.texture_depth_2d_array,
        Keyword.texture_depth_cube,
        Keyword.texture_depth_cube_array,
        Keyword.texture_depth_multisampled_2d
    ];

    Token.texel_format = [
        Keyword.r8unorm,
        Keyword.r8snorm,
        Keyword.r8uint,
        Keyword.r8sint,
        Keyword.r16uint,
        Keyword.r16sint,
        Keyword.r16float,
        Keyword.rg8unorm,
        Keyword.rg8snorm,
        Keyword.rg8uint,
        Keyword.rg8sint,
        Keyword.r32uint,
        Keyword.r32sint,
        Keyword.r32float,
        Keyword.rg16uint,
        Keyword.rg16sint,
        Keyword.rg16float,
        Keyword.rgba8unorm,
        Keyword.rgba8unorm_srgb,
        Keyword.rgba8snorm,
        Keyword.rgba8uint,
        Keyword.rgba8sint,
        Keyword.bgra8unorm,
        Keyword.bgra8unorm_srgb,
        Keyword.rgb10a2unorm,
        Keyword.rg11b10float,
        Keyword.rg32uint,
        Keyword.rg32sint,
        Keyword.rg32float,
        Keyword.rgba16uint,
        Keyword.rgba16sint,
        Keyword.rgba16float,
        Keyword.rgba32uint,
        Keyword.rgba32sint,
        Keyword.rgba32float
    ];

    Token.const_literal = [
        Token.int_literal,
        Token.uint_literal,
        Token.decimal_float_literal,
        Token.hex_float_literal,
        Keyword.true,
        Keyword.false
    ];

    Token.literal_or_ident = [
        Token.ident,
        Token.int_literal,
        Token.uint_literal,
        Token.decimal_float_literal,
        Token.hex_float_literal,
    ];

    Token.element_count_expression = [
        Token.int_literal,
        Token.uint_literal,
        Token.ident
    ];

    Token.template_types = [
        Keyword.vec2,
        Keyword.vec3,
        Keyword.vec4,
        Keyword.mat2x2,
        Keyword.mat2x3,
        Keyword.mat2x4,
        Keyword.mat3x2,
        Keyword.mat3x3,
        Keyword.mat3x4,
        Keyword.mat4x2,
        Keyword.mat4x3,
        Keyword.mat4x4,
        Keyword.atomic
    ];

    // The grammar calls out 'block', but attribute grammar is defined to use a 'ident'.
    // The attribute grammar should be ident | block.
    Token.attribute_name = [
        Token.ident,
        Keyword.block,
    ];
}
_InitTokens();
