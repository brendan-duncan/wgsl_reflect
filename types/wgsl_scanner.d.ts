export declare enum TokenClass {
    token = 0,
    keyword = 1,
    reserved = 2
}
export declare class TokenType {
    name: string;
    type: TokenClass;
    rule: RegExp | string;
    constructor(name: string, type: TokenClass, rule: RegExp | string);
    toString(): string;
}
export declare class TokenTypes {
    static readonly none: TokenType;
    static readonly eof: TokenType;
    static readonly reserved: {
        asm: TokenType;
        bf16: TokenType;
        do: TokenType;
        enum: TokenType;
        f16: TokenType;
        f64: TokenType;
        handle: TokenType;
        i8: TokenType;
        i16: TokenType;
        i64: TokenType;
        mat: TokenType;
        premerge: TokenType;
        regardless: TokenType;
        typedef: TokenType;
        u8: TokenType;
        u16: TokenType;
        u64: TokenType;
        unless: TokenType;
        using: TokenType;
        vec: TokenType;
        void: TokenType;
    };
    static readonly keywords: {
        array: TokenType;
        atomic: TokenType;
        bool: TokenType;
        f32: TokenType;
        i32: TokenType;
        mat2x2: TokenType;
        mat2x3: TokenType;
        mat2x4: TokenType;
        mat3x2: TokenType;
        mat3x3: TokenType;
        mat3x4: TokenType;
        mat4x2: TokenType;
        mat4x3: TokenType;
        mat4x4: TokenType;
        ptr: TokenType;
        sampler: TokenType;
        sampler_comparison: TokenType;
        struct: TokenType;
        texture_1d: TokenType;
        texture_2d: TokenType;
        texture_2d_array: TokenType;
        texture_3d: TokenType;
        texture_cube: TokenType;
        texture_cube_array: TokenType;
        texture_multisampled_2d: TokenType;
        texture_storage_1d: TokenType;
        texture_storage_2d: TokenType;
        texture_storage_2d_array: TokenType;
        texture_storage_3d: TokenType;
        texture_depth_2d: TokenType;
        texture_depth_2d_array: TokenType;
        texture_depth_cube: TokenType;
        texture_depth_cube_array: TokenType;
        texture_depth_multisampled_2d: TokenType;
        texture_external: TokenType;
        u32: TokenType;
        vec2: TokenType;
        vec3: TokenType;
        vec4: TokenType;
        bitcast: TokenType;
        block: TokenType;
        break: TokenType;
        case: TokenType;
        continue: TokenType;
        continuing: TokenType;
        default: TokenType;
        diagnostic: TokenType;
        discard: TokenType;
        else: TokenType;
        enable: TokenType;
        fallthrough: TokenType;
        false: TokenType;
        fn: TokenType;
        for: TokenType;
        function: TokenType;
        if: TokenType;
        let: TokenType;
        const: TokenType;
        loop: TokenType;
        while: TokenType;
        private: TokenType;
        read: TokenType;
        read_write: TokenType;
        return: TokenType;
        requires: TokenType;
        storage: TokenType;
        switch: TokenType;
        true: TokenType;
        alias: TokenType;
        type: TokenType;
        uniform: TokenType;
        var: TokenType;
        override: TokenType;
        workgroup: TokenType;
        write: TokenType;
        r8unorm: TokenType;
        r8snorm: TokenType;
        r8uint: TokenType;
        r8sint: TokenType;
        r16uint: TokenType;
        r16sint: TokenType;
        r16float: TokenType;
        rg8unorm: TokenType;
        rg8snorm: TokenType;
        rg8uint: TokenType;
        rg8sint: TokenType;
        r32uint: TokenType;
        r32sint: TokenType;
        r32float: TokenType;
        rg16uint: TokenType;
        rg16sint: TokenType;
        rg16float: TokenType;
        rgba8unorm: TokenType;
        rgba8unorm_srgb: TokenType;
        rgba8snorm: TokenType;
        rgba8uint: TokenType;
        rgba8sint: TokenType;
        bgra8unorm: TokenType;
        bgra8unorm_srgb: TokenType;
        rgb10a2unorm: TokenType;
        rg11b10float: TokenType;
        rg32uint: TokenType;
        rg32sint: TokenType;
        rg32float: TokenType;
        rgba16uint: TokenType;
        rgba16sint: TokenType;
        rgba16float: TokenType;
        rgba32uint: TokenType;
        rgba32sint: TokenType;
        rgba32float: TokenType;
        static_assert: TokenType;
    };
    static readonly tokens: {
        decimal_float_literal: TokenType;
        hex_float_literal: TokenType;
        int_literal: TokenType;
        uint_literal: TokenType;
        name: TokenType;
        ident: TokenType;
        and: TokenType;
        and_and: TokenType;
        arrow: TokenType;
        attr: TokenType;
        forward_slash: TokenType;
        bang: TokenType;
        bracket_left: TokenType;
        bracket_right: TokenType;
        brace_left: TokenType;
        brace_right: TokenType;
        colon: TokenType;
        comma: TokenType;
        equal: TokenType;
        equal_equal: TokenType;
        not_equal: TokenType;
        greater_than: TokenType;
        greater_than_equal: TokenType;
        shift_right: TokenType;
        less_than: TokenType;
        less_than_equal: TokenType;
        shift_left: TokenType;
        modulo: TokenType;
        minus: TokenType;
        minus_minus: TokenType;
        period: TokenType;
        plus: TokenType;
        plus_plus: TokenType;
        or: TokenType;
        or_or: TokenType;
        paren_left: TokenType;
        paren_right: TokenType;
        semicolon: TokenType;
        star: TokenType;
        tilde: TokenType;
        underscore: TokenType;
        xor: TokenType;
        plus_equal: TokenType;
        minus_equal: TokenType;
        times_equal: TokenType;
        division_equal: TokenType;
        modulo_equal: TokenType;
        and_equal: TokenType;
        or_equal: TokenType;
        xor_equal: TokenType;
        shift_right_equal: TokenType;
        shift_left_equal: TokenType;
    };
    static readonly simpleTokens: {
        "@": TokenType;
        "{": TokenType;
        "}": TokenType;
        ":": TokenType;
        ",": TokenType;
        "(": TokenType;
        ")": TokenType;
        ";": TokenType;
    };
    static readonly literalTokens: {
        "&": TokenType;
        "&&": TokenType;
        "->": TokenType;
        "/": TokenType;
        "!": TokenType;
        "[": TokenType;
        "]": TokenType;
        "=": TokenType;
        "==": TokenType;
        "!=": TokenType;
        ">": TokenType;
        ">=": TokenType;
        ">>": TokenType;
        "<": TokenType;
        "<=": TokenType;
        "<<": TokenType;
        "%": TokenType;
        "-": TokenType;
        "--": TokenType;
        ".": TokenType;
        "+": TokenType;
        "++": TokenType;
        "|": TokenType;
        "||": TokenType;
        "*": TokenType;
        "~": TokenType;
        _: TokenType;
        "^": TokenType;
        "+=": TokenType;
        "-=": TokenType;
        "*=": TokenType;
        "/=": TokenType;
        "%=": TokenType;
        "&=": TokenType;
        "|=": TokenType;
        "^=": TokenType;
        ">>=": TokenType;
        "<<=": TokenType;
    };
    static readonly regexTokens: {
        decimal_float_literal: TokenType;
        hex_float_literal: TokenType;
        int_literal: TokenType;
        uint_literal: TokenType;
        ident: TokenType;
    };
    static readonly storage_class: TokenType[];
    static readonly access_mode: TokenType[];
    static readonly sampler_type: TokenType[];
    static readonly sampled_texture_type: TokenType[];
    static readonly multisampled_texture_type: TokenType[];
    static readonly storage_texture_type: TokenType[];
    static readonly depth_texture_type: TokenType[];
    static readonly texture_external_type: TokenType[];
    static readonly any_texture_type: TokenType[];
    static readonly texel_format: TokenType[];
    static readonly const_literal: TokenType[];
    static readonly literal_or_ident: TokenType[];
    static readonly element_count_expression: TokenType[];
    static readonly template_types: TokenType[];
    static readonly attribute_name: TokenType[];
    static readonly assignment_operators: TokenType[];
    static readonly increment_operators: TokenType[];
}
export declare class Token {
    readonly type: TokenType;
    readonly lexeme: string;
    readonly line: number;
    constructor(type: TokenType, lexeme: string, line: number);
    toString(): string;
    isTemplateType(): boolean;
    isArrayType(): boolean;
    isArrayOrTemplateType(): boolean;
}
export declare class WgslScanner {
    private _source;
    private _tokens;
    private _start;
    private _current;
    private _line;
    constructor(source?: string);
    scanTokens(): Token[];
    scanToken(): boolean;
    _findType(lexeme: string): TokenType;
    _match(lexeme: string, rule: RegExp): boolean;
    _isAtEnd(): boolean;
    _isAlpha(c: string): boolean;
    _isNumeric(c: string): boolean;
    _isAlphaNumeric(c: string): boolean;
    _isWhitespace(c: string): boolean;
    _advance(amount?: number): string;
    _peekAhead(offset?: number): string;
    _addToken(type: TokenType): void;
}
