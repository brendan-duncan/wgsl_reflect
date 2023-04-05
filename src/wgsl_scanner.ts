export enum TokenClass {
  token,
  keyword,
  reserved,
}

export class TokenType {
  name: string;
  type: TokenClass;
  rule: RegExp | string;

  constructor(name: string, type: TokenClass, rule: RegExp | string) {
    this.name = name;
    this.type = type;
    this.rule = rule;
  }

  toString(): string {
    return this.name;
  }
}

/// Catalog of defined token types, keywords, and reserved words.
export class TokenTypes {
  static readonly none = new TokenType("", TokenClass.reserved, "");
  static readonly eof = new TokenType("EOF", TokenClass.token, "");

  static readonly reserved = {
    asm: new TokenType("asm", TokenClass.reserved, "asm"),
    bf16: new TokenType("bf16", TokenClass.reserved, "bf16"),
    do: new TokenType("do", TokenClass.reserved, "do"),
    enum: new TokenType("enum", TokenClass.reserved, "enum"),
    f16: new TokenType("f16", TokenClass.reserved, "f16"),
    f64: new TokenType("f64", TokenClass.reserved, "f64"),
    handle: new TokenType("handle", TokenClass.reserved, "handle"),
    i8: new TokenType("i8", TokenClass.reserved, "i8"),
    i16: new TokenType("i16", TokenClass.reserved, "i16"),
    i64: new TokenType("i64", TokenClass.reserved, "i64"),
    mat: new TokenType("mat", TokenClass.reserved, "mat"),
    premerge: new TokenType("premerge", TokenClass.reserved, "premerge"),
    regardless: new TokenType("regardless", TokenClass.reserved, "regardless"),
    typedef: new TokenType("typedef", TokenClass.reserved, "typedef"),
    u8: new TokenType("u8", TokenClass.reserved, "u8"),
    u16: new TokenType("u16", TokenClass.reserved, "u16"),
    u64: new TokenType("u64", TokenClass.reserved, "u64"),
    unless: new TokenType("unless", TokenClass.reserved, "unless"),
    using: new TokenType("using", TokenClass.reserved, "using"),
    vec: new TokenType("vec", TokenClass.reserved, "vec"),
    void: new TokenType("void", TokenClass.reserved, "void"),
  };

  static readonly keywords = {
    array: new TokenType("array", TokenClass.keyword, "array"),
    atomic: new TokenType("atomic", TokenClass.keyword, "atomic"),
    bool: new TokenType("bool", TokenClass.keyword, "bool"),
    f32: new TokenType("f32", TokenClass.keyword, "f32"),
    i32: new TokenType("i32", TokenClass.keyword, "i32"),
    mat2x2: new TokenType("mat2x2", TokenClass.keyword, "mat2x2"),
    mat2x3: new TokenType("mat2x3", TokenClass.keyword, "mat2x3"),
    mat2x4: new TokenType("mat2x4", TokenClass.keyword, "mat2x4"),
    mat3x2: new TokenType("mat3x2", TokenClass.keyword, "mat3x2"),
    mat3x3: new TokenType("mat3x3", TokenClass.keyword, "mat3x3"),
    mat3x4: new TokenType("mat3x4", TokenClass.keyword, "mat3x4"),
    mat4x2: new TokenType("mat4x2", TokenClass.keyword, "mat4x2"),
    mat4x3: new TokenType("mat4x3", TokenClass.keyword, "mat4x3"),
    mat4x4: new TokenType("mat4x4", TokenClass.keyword, "mat4x4"),
    ptr: new TokenType("ptr", TokenClass.keyword, "ptr"),
    sampler: new TokenType("sampler", TokenClass.keyword, "sampler"),
    sampler_comparison: new TokenType(
      "sampler_comparison",
      TokenClass.keyword,
      "sampler_comparison"
    ),
    struct: new TokenType("struct", TokenClass.keyword, "struct"),
    texture_1d: new TokenType("texture_1d", TokenClass.keyword, "texture_1d"),
    texture_2d: new TokenType("texture_2d", TokenClass.keyword, "texture_2d"),
    texture_2d_array: new TokenType(
      "texture_2d_array",
      TokenClass.keyword,
      "texture_2d_array"
    ),
    texture_3d: new TokenType("texture_3d", TokenClass.keyword, "texture_3d"),
    texture_cube: new TokenType(
      "texture_cube",
      TokenClass.keyword,
      "texture_cube"
    ),
    texture_cube_array: new TokenType(
      "texture_cube_array",
      TokenClass.keyword,
      "texture_cube_array"
    ),
    texture_multisampled_2d: new TokenType(
      "texture_multisampled_2d",
      TokenClass.keyword,
      "texture_multisampled_2d"
    ),
    texture_storage_1d: new TokenType(
      "texture_storage_1d",
      TokenClass.keyword,
      "texture_storage_1d"
    ),
    texture_storage_2d: new TokenType(
      "texture_storage_2d",
      TokenClass.keyword,
      "texture_storage_2d"
    ),
    texture_storage_2d_array: new TokenType(
      "texture_storage_2d_array",
      TokenClass.keyword,
      "texture_storage_2d_array"
    ),
    texture_storage_3d: new TokenType(
      "texture_storage_3d",
      TokenClass.keyword,
      "texture_storage_3d"
    ),
    texture_depth_2d: new TokenType(
      "texture_depth_2d",
      TokenClass.keyword,
      "texture_depth_2d"
    ),
    texture_depth_2d_array: new TokenType(
      "texture_depth_2d_array",
      TokenClass.keyword,
      "texture_depth_2d_array"
    ),
    texture_depth_cube: new TokenType(
      "texture_depth_cube",
      TokenClass.keyword,
      "texture_depth_cube"
    ),
    texture_depth_cube_array: new TokenType(
      "texture_depth_cube_array",
      TokenClass.keyword,
      "texture_depth_cube_array"
    ),
    texture_depth_multisampled_2d: new TokenType(
      "texture_depth_multisampled_2d",
      TokenClass.keyword,
      "texture_depth_multisampled_2d"
    ),
    u32: new TokenType("u32", TokenClass.keyword, "u32"),
    vec2: new TokenType("vec2", TokenClass.keyword, "vec2"),
    vec3: new TokenType("vec3", TokenClass.keyword, "vec3"),
    vec4: new TokenType("vec4", TokenClass.keyword, "vec4"),
    bitcast: new TokenType("bitcast", TokenClass.keyword, "bitcast"),
    block: new TokenType("block", TokenClass.keyword, "block"),
    break: new TokenType("break", TokenClass.keyword, "break"),
    case: new TokenType("case", TokenClass.keyword, "case"),
    continue: new TokenType("continue", TokenClass.keyword, "continue"),
    continuing: new TokenType("continuing", TokenClass.keyword, "continuing"),
    default: new TokenType("default", TokenClass.keyword, "default"),
    discard: new TokenType("discard", TokenClass.keyword, "discard"),
    else: new TokenType("else", TokenClass.keyword, "else"),
    elseif: new TokenType("elseif", TokenClass.keyword, "elseif"),
    enable: new TokenType("enable", TokenClass.keyword, "enable"),
    fallthrough: new TokenType(
      "fallthrough",
      TokenClass.keyword,
      "fallthrough"
    ),
    false: new TokenType("false", TokenClass.keyword, "false"),
    fn: new TokenType("fn", TokenClass.keyword, "fn"),
    for: new TokenType("for", TokenClass.keyword, "for"),
    function: new TokenType("function", TokenClass.keyword, "function"),
    if: new TokenType("if", TokenClass.keyword, "if"),
    let: new TokenType("let", TokenClass.keyword, "let"),
    const: new TokenType("const", TokenClass.keyword, "const"),
    loop: new TokenType("loop", TokenClass.keyword, "loop"),
    while: new TokenType("while", TokenClass.keyword, "while"),
    private: new TokenType("private", TokenClass.keyword, "private"),
    read: new TokenType("read", TokenClass.keyword, "read"),
    read_write: new TokenType("read_write", TokenClass.keyword, "read_write"),
    return: new TokenType("return", TokenClass.keyword, "return"),
    storage: new TokenType("storage", TokenClass.keyword, "storage"),
    switch: new TokenType("switch", TokenClass.keyword, "switch"),
    true: new TokenType("true", TokenClass.keyword, "true"),
    alias: new TokenType("alias", TokenClass.keyword, "alias"),
    type: new TokenType("type", TokenClass.keyword, "type"),
    uniform: new TokenType("uniform", TokenClass.keyword, "uniform"),
    var: new TokenType("var", TokenClass.keyword, "var"),
    workgroup: new TokenType("workgroup", TokenClass.keyword, "workgroup"),
    write: new TokenType("write", TokenClass.keyword, "write"),
    r8unorm: new TokenType("r8unorm", TokenClass.keyword, "r8unorm"),
    r8snorm: new TokenType("r8snorm", TokenClass.keyword, "r8snorm"),
    r8uint: new TokenType("r8uint", TokenClass.keyword, "r8uint"),
    r8sint: new TokenType("r8sint", TokenClass.keyword, "r8sint"),
    r16uint: new TokenType("r16uint", TokenClass.keyword, "r16uint"),
    r16sint: new TokenType("r16sint", TokenClass.keyword, "r16sint"),
    r16float: new TokenType("r16float", TokenClass.keyword, "r16float"),
    rg8unorm: new TokenType("rg8unorm", TokenClass.keyword, "rg8unorm"),
    rg8snorm: new TokenType("rg8snorm", TokenClass.keyword, "rg8snorm"),
    rg8uint: new TokenType("rg8uint", TokenClass.keyword, "rg8uint"),
    rg8sint: new TokenType("rg8sint", TokenClass.keyword, "rg8sint"),
    r32uint: new TokenType("r32uint", TokenClass.keyword, "r32uint"),
    r32sint: new TokenType("r32sint", TokenClass.keyword, "r32sint"),
    r32float: new TokenType("r32float", TokenClass.keyword, "r32float"),
    rg16uint: new TokenType("rg16uint", TokenClass.keyword, "rg16uint"),
    rg16sint: new TokenType("rg16sint", TokenClass.keyword, "rg16sint"),
    rg16float: new TokenType("rg16float", TokenClass.keyword, "rg16float"),
    rgba8unorm: new TokenType("rgba8unorm", TokenClass.keyword, "rgba8unorm"),
    rgba8unorm_srgb: new TokenType(
      "rgba8unorm_srgb",
      TokenClass.keyword,
      "rgba8unorm_srgb"
    ),
    rgba8snorm: new TokenType("rgba8snorm", TokenClass.keyword, "rgba8snorm"),
    rgba8uint: new TokenType("rgba8uint", TokenClass.keyword, "rgba8uint"),
    rgba8sint: new TokenType("rgba8sint", TokenClass.keyword, "rgba8sint"),
    bgra8unorm: new TokenType("bgra8unorm", TokenClass.keyword, "bgra8unorm"),
    bgra8unorm_srgb: new TokenType(
      "bgra8unorm_srgb",
      TokenClass.keyword,
      "bgra8unorm_srgb"
    ),
    rgb10a2unorm: new TokenType(
      "rgb10a2unorm",
      TokenClass.keyword,
      "rgb10a2unorm"
    ),
    rg11b10float: new TokenType(
      "rg11b10float",
      TokenClass.keyword,
      "rg11b10float"
    ),
    rg32uint: new TokenType("rg32uint", TokenClass.keyword, "rg32uint"),
    rg32sint: new TokenType("rg32sint", TokenClass.keyword, "rg32sint"),
    rg32float: new TokenType("rg32float", TokenClass.keyword, "rg32float"),
    rgba16uint: new TokenType("rgba16uint", TokenClass.keyword, "rgba16uint"),
    rgba16sint: new TokenType("rgba16sint", TokenClass.keyword, "rgba16sint"),
    rgba16float: new TokenType(
      "rgba16float",
      TokenClass.keyword,
      "rgba16float"
    ),
    rgba32uint: new TokenType("rgba32uint", TokenClass.keyword, "rgba32uint"),
    rgba32sint: new TokenType("rgba32sint", TokenClass.keyword, "rgba32sint"),
    rgba32float: new TokenType(
      "rgba32float",
      TokenClass.keyword,
      "rgba32float"
    ),
    static_assert: new TokenType(
      "static_assert",
      TokenClass.keyword,
      "static_assert"
    ),

    // WGSL grammar has a few keywords that have different token names than the strings they
    // represent. Aliasing them here.
    /*int32: new TokenType("i32", TokenClass.keyword, "i32"),
        uint32: new TokenType("u32", TokenClass.keyword, "u32"),
        float32: new TokenType("f32", TokenClass.keyword, "f32"),
        pointer: new TokenType("ptr", TokenClass.keyword, "ptr"),*/
  };

  static readonly tokens = {
    decimal_float_literal: new TokenType(
      "decimal_float_literal",
      TokenClass.token,
      /((-?[0-9]*\.[0-9]+|-?[0-9]+\.[0-9]*)((e|E)(\+|-)?[0-9]+)?f?)|(-?[0-9]+(e|E)(\+|-)?[0-9]+f?)/
    ),
    hex_float_literal: new TokenType(
      "hex_float_literal",
      TokenClass.token,
      /-?0x((([0-9a-fA-F]*\.[0-9a-fA-F]+|[0-9a-fA-F]+\.[0-9a-fA-F]*)((p|P)(\+|-)?[0-9]+f?)?)|([0-9a-fA-F]+(p|P)(\+|-)?[0-9]+f?))/
    ),
    int_literal: new TokenType(
      "int_literal",
      TokenClass.token,
      /-?0x[0-9a-fA-F]+|0|-?[1-9][0-9]*/
    ),
    uint_literal: new TokenType(
      "uint_literal",
      TokenClass.token,
      /0x[0-9a-fA-F]+u|0u|[1-9][0-9]*u/
    ),
    ident: new TokenType("ident", TokenClass.token, /[a-zA-Z][0-9a-zA-Z_]*/),
    and: new TokenType("and", TokenClass.token, "&"),
    and_and: new TokenType("and_and", TokenClass.token, "&&"),
    arrow: new TokenType("arrow ", TokenClass.token, "->"),
    attr: new TokenType("attr", TokenClass.token, "@"),
    attr_left: new TokenType("attr_left", TokenClass.token, "[["),
    attr_right: new TokenType("attr_right", TokenClass.token, "]]"),
    forward_slash: new TokenType("forward_slash", TokenClass.token, "/"),
    bang: new TokenType("bang", TokenClass.token, "!"),
    bracket_left: new TokenType("bracket_left", TokenClass.token, "["),
    bracket_right: new TokenType("bracket_right", TokenClass.token, "]"),
    brace_left: new TokenType("brace_left", TokenClass.token, "{"),
    brace_right: new TokenType("brace_right", TokenClass.token, "}"),
    colon: new TokenType("colon", TokenClass.token, ":"),
    comma: new TokenType("comma", TokenClass.token, ","),
    equal: new TokenType("equal", TokenClass.token, "="),
    equal_equal: new TokenType("equal_equal", TokenClass.token, "=="),
    not_equal: new TokenType("not_equal", TokenClass.token, "!="),
    greater_than: new TokenType("greater_than", TokenClass.token, ">"),
    greater_than_equal: new TokenType(
      "greater_than_equal",
      TokenClass.token,
      ">="
    ),
    shift_right: new TokenType("shift_right", TokenClass.token, ">>"),
    less_than: new TokenType("less_than", TokenClass.token, "<"),
    less_than_equal: new TokenType("less_than_equal", TokenClass.token, "<="),
    shift_left: new TokenType("shift_left", TokenClass.token, "<<"),
    modulo: new TokenType("modulo", TokenClass.token, "%"),
    minus: new TokenType("minus", TokenClass.token, "-"),
    minus_minus: new TokenType("minus_minus", TokenClass.token, "--"),
    period: new TokenType("period", TokenClass.token, "."),
    plus: new TokenType("plus", TokenClass.token, "+"),
    plus_plus: new TokenType("plus_plus", TokenClass.token, "++"),
    or: new TokenType("or", TokenClass.token, "|"),
    or_or: new TokenType("or_or", TokenClass.token, "||"),
    paren_left: new TokenType("paren_left", TokenClass.token, "("),
    paren_right: new TokenType("paren_right", TokenClass.token, ")"),
    semicolon: new TokenType("semicolon", TokenClass.token, ";"),
    star: new TokenType("star", TokenClass.token, "*"),
    tilde: new TokenType("tilde", TokenClass.token, "~"),
    underscore: new TokenType("underscore", TokenClass.token, "_"),
    xor: new TokenType("xor", TokenClass.token, "^"),
    plus_equal: new TokenType("plus_equal", TokenClass.token, "+="),
    minus_equal: new TokenType("minus_equal", TokenClass.token, "-="),
    times_equal: new TokenType("times_equal", TokenClass.token, "*="),
    division_equal: new TokenType("division_equal", TokenClass.token, "/="),
    modulo_equal: new TokenType("modulo_equal", TokenClass.token, "%="),
    and_equal: new TokenType("and_equal", TokenClass.token, "&="),
    or_equal: new TokenType("or_equal", TokenClass.token, "|="),
    xor_equal: new TokenType("xor_equal", TokenClass.token, "^="),
    shift_right_equal: new TokenType(
      "shift_right_equal",
      TokenClass.token,
      ">>="
    ),
    shift_left_equal: new TokenType(
      "shift_left_equal",
      TokenClass.token,
      "<<="
    ),
  };

  static readonly storage_class = [
    this.keywords.function,
    this.keywords.private,
    this.keywords.workgroup,
    this.keywords.uniform,
    this.keywords.storage,
  ];

  static readonly access_mode = [
    this.keywords.read,
    this.keywords.write,
    this.keywords.read_write,
  ];

  static readonly sampler_type = [
    this.keywords.sampler,
    this.keywords.sampler_comparison,
  ];

  static readonly sampled_texture_type = [
    this.keywords.texture_1d,
    this.keywords.texture_2d,
    this.keywords.texture_2d_array,
    this.keywords.texture_3d,
    this.keywords.texture_cube,
    this.keywords.texture_cube_array,
  ];

  static readonly multisampled_texture_type = [
    this.keywords.texture_multisampled_2d,
  ];

  static readonly storage_texture_type = [
    this.keywords.texture_storage_1d,
    this.keywords.texture_storage_2d,
    this.keywords.texture_storage_2d_array,
    this.keywords.texture_storage_3d,
  ];

  static readonly depth_texture_type = [
    this.keywords.texture_depth_2d,
    this.keywords.texture_depth_2d_array,
    this.keywords.texture_depth_cube,
    this.keywords.texture_depth_cube_array,
    this.keywords.texture_depth_multisampled_2d,
  ];

  static readonly any_texture_type = [
    ...this.sampled_texture_type,
    ...this.multisampled_texture_type,
    ...this.storage_texture_type,
    ...this.depth_texture_type,
  ];

  static readonly texel_format = [
    this.keywords.r8unorm,
    this.keywords.r8snorm,
    this.keywords.r8uint,
    this.keywords.r8sint,
    this.keywords.r16uint,
    this.keywords.r16sint,
    this.keywords.r16float,
    this.keywords.rg8unorm,
    this.keywords.rg8snorm,
    this.keywords.rg8uint,
    this.keywords.rg8sint,
    this.keywords.r32uint,
    this.keywords.r32sint,
    this.keywords.r32float,
    this.keywords.rg16uint,
    this.keywords.rg16sint,
    this.keywords.rg16float,
    this.keywords.rgba8unorm,
    this.keywords.rgba8unorm_srgb,
    this.keywords.rgba8snorm,
    this.keywords.rgba8uint,
    this.keywords.rgba8sint,
    this.keywords.bgra8unorm,
    this.keywords.bgra8unorm_srgb,
    this.keywords.rgb10a2unorm,
    this.keywords.rg11b10float,
    this.keywords.rg32uint,
    this.keywords.rg32sint,
    this.keywords.rg32float,
    this.keywords.rgba16uint,
    this.keywords.rgba16sint,
    this.keywords.rgba16float,
    this.keywords.rgba32uint,
    this.keywords.rgba32sint,
    this.keywords.rgba32float,
  ];

  static readonly const_literal = [
    this.tokens.int_literal,
    this.tokens.uint_literal,
    this.tokens.decimal_float_literal,
    this.tokens.hex_float_literal,
    this.keywords.true,
    this.keywords.false,
  ];

  static readonly literal_or_ident = [
    this.tokens.ident,
    this.tokens.int_literal,
    this.tokens.uint_literal,
    this.tokens.decimal_float_literal,
    this.tokens.hex_float_literal,
  ];

  static readonly element_count_expression = [
    this.tokens.int_literal,
    this.tokens.uint_literal,
    this.tokens.ident,
  ];

  static readonly template_types = [
    this.keywords.vec2,
    this.keywords.vec3,
    this.keywords.vec4,
    this.keywords.mat2x2,
    this.keywords.mat2x3,
    this.keywords.mat2x4,
    this.keywords.mat3x2,
    this.keywords.mat3x3,
    this.keywords.mat3x4,
    this.keywords.mat4x2,
    this.keywords.mat4x3,
    this.keywords.mat4x4,
    this.keywords.atomic,
    this.keywords.bitcast,
    ...this.any_texture_type,
  ];

  // The grammar calls out 'block', but attribute grammar is defined to use a 'ident'.
  // The attribute grammar should be ident | block.
  static readonly attribute_name = [this.tokens.ident, this.keywords.block];

  static readonly assignment_operators = [
    this.tokens.equal,
    this.tokens.plus_equal,
    this.tokens.minus_equal,
    this.tokens.times_equal,
    this.tokens.division_equal,
    this.tokens.modulo_equal,
    this.tokens.and_equal,
    this.tokens.or_equal,
    this.tokens.xor_equal,
    this.tokens.shift_right_equal,
    this.tokens.shift_left_equal,
  ];

  static readonly increment_operators = [
    this.tokens.plus_plus,
    this.tokens.minus_minus,
  ];
}

/// A token parsed by the WgslScanner.
export class Token {
  readonly type: TokenType;
  readonly lexeme: string;
  readonly line: number;

  constructor(type: TokenType, lexeme: string, line: number) {
    this.type = type;
    this.lexeme = lexeme;
    this.line = line;
  }

  toString(): string {
    return this.lexeme;
  }
}

/// Lexical scanner for the WGSL language. This takes an input source text and generates a list
/// of Token objects, which can then be fed into the WgslParser to generate an AST.
export class WgslScanner {
  private _source: string;
  private _tokens: Array<Token> = [];
  private _start = 0;
  private _current = 0;
  private _line = 1;

  constructor(source?: string) {
    this._source = source ?? "";
  }

  /// Scan all tokens from the source.
  scanTokens(): Array<Token> {
    while (!this._isAtEnd()) {
      this._start = this._current;
      if (!this.scanToken()) throw `Invalid syntax at line ${this._line}`;
    }

    this._tokens.push(new Token(TokenTypes.eof, "", this._line));
    return this._tokens;
  }

  /// Scan a single token from the source.
  scanToken(): boolean {
    // Find the longest consecutive set of characters that match a rule.
    let lexeme = this._advance();

    // Skip line-feed, adding to the line counter.
    if (lexeme == "\n") {
      this._line++;
      return true;
    }

    // Skip whitespace
    if (this._isWhitespace(lexeme)) {
      return true;
    }

    if (lexeme == "/") {
      // If it's a // comment, skip everything until the next line-feed.
      if (this._peekAhead() == "/") {
        while (lexeme != "\n") {
          if (this._isAtEnd()) return true;
          lexeme = this._advance();
        }
        // skip the linefeed
        this._line++;
        return true;
      } else if (this._peekAhead() == "*") {
        // If it's a / * block comment, skip everything until the matching * /,
        // allowing for nested block comments.
        this._advance();
        let commentLevel = 1;
        while (commentLevel > 0) {
          if (this._isAtEnd()) return true;
          lexeme = this._advance();
          if (lexeme == "\n") {
            this._line++;
          } else if (lexeme == "*") {
            if (this._peekAhead() == "/") {
              this._advance();
              commentLevel--;
              if (commentLevel == 0) {
                return true;
              }
            }
          } else if (lexeme == "/") {
            if (this._peekAhead() == "*") {
              this._advance();
              commentLevel++;
            }
          }
        }
        return true;
      }
    }

    let matchType = TokenTypes.none;

    for (;;) {
      let matchedType = this._findType(lexeme);

      // The exception to "longest lexeme" rule is '>>'. In the case of 1>>2, it's a
      // shift_right.
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
          if (this._tokens[ti].type === TokenTypes.tokens.less_than) {
            if (
              ti > 0 &&
              TokenTypes.template_types.indexOf(this._tokens[ti - 1].type) != -1
            ) {
              foundLessThan = true;
            }
            break;
          }
        }
        // If there was a less_than in the recent token history, then this is probably a
        // greater_than.
        if (foundLessThan) {
          this._addToken(matchedType);
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
      if (matchedType === TokenTypes.none) {
        let lookAheadLexeme = lexeme;
        let lookAhead = 0;
        const maxLookAhead = 2;
        for (let li = 0; li < maxLookAhead; ++li) {
          lookAheadLexeme += this._peekAhead(li);
          matchedType = this._findType(lookAheadLexeme);
          if (matchedType !== TokenTypes.none) {
            lookAhead = li;
            break;
          }
        }

        if (matchedType === TokenTypes.none) {
          if (matchType === TokenTypes.none) return false;
          this._current--;
          this._addToken(matchType);
          return true;
        }

        lexeme = lookAheadLexeme;
        this._current += lookAhead + 1;
      }

      matchType = matchedType;

      if (this._isAtEnd()) break;

      lexeme += this._advance();
    }

    // We got to the end of the input stream. Then the token we've ready so far is it.
    if (matchType === TokenTypes.none) return false;

    this._addToken(matchType);
    return true;
  }

  _findType(lexeme: string): TokenType {
    for (const name in TokenTypes.keywords) {
      const type = TokenTypes.keywords[name];
      if (this._match(lexeme, type.rule)) {
        return type;
      }
    }
    for (const name in TokenTypes.tokens) {
      const type = TokenTypes.tokens[name];
      if (this._match(lexeme, type.rule)) {
        return type;
      }
    }
    return TokenTypes.none;
  }

  _match(lexeme: string, rule: string | RegExp): boolean {
    if (typeof rule === "string") {
      if (rule == lexeme) {
        return true;
      }
    } else {
      // regex
      const match = rule.exec(lexeme);
      if (match && match.index == 0 && match[0] == lexeme) return true;
    }
    return false;
  }

  _isAtEnd(): boolean {
    return this._current >= this._source.length;
  }

  _isWhitespace(c: string): boolean {
    return c == " " || c == "\t" || c == "\r";
  }

  _advance(amount: number = 0): string {
    let c = this._source[this._current];
    amount = amount || 0;
    amount++;
    this._current += amount;
    return c;
  }

  _peekAhead(offset: number = 0): string {
    offset = offset || 0;
    if (this._current + offset >= this._source.length) return "\0";
    return this._source[this._current + offset];
  }

  _addToken(type: TokenType) {
    const text = this._source.substring(this._start, this._current);
    this._tokens.push(new Token(type, text, this._line));
  }
}
