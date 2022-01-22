/**
 * @author Brendan Duncan / https://github.com/brendan-duncan
 */
import { WgslScanner, Token, Keyword } from "./wgsl_scanner.js";

export class AST {
    constructor(type, options) {
        this._type = type;
        if (options) {
            for (let option in options) {
                this[option] = options[option];
            }
        }
    }
}

export class WgslParser {
    constructor() {
        this._tokens = [];
        this._current = 0;
    }

    parse(tokensOrCode) {
        this._initialize(tokensOrCode);

        let statements = [];
        while (!this._isAtEnd()) {
            const statement = this._global_decl_or_directive();
            if (!statement)
                break;
            statements.push(statement);
        }
        return statements;
    }

    _initialize(tokensOrCode) {
        if (tokensOrCode) {
            if (typeof(tokensOrCode) == "string") {
                const scanner = new WgslScanner(tokensOrCode);
                this._tokens = scanner.scanTokens();
            } else {
                this._tokens = tokensOrCode;
            }
        } else {
            this._tokens = [];
        }
        this._current = 0;
    }

    _error(token, message) {
        console.error(token, message);
        return { token, message, toString: function() { return `${message}`; } };
    }

    _isAtEnd() { return this._current >= this._tokens.length || this._peek()._type == Token.EOF; }

    _match(types) {
        if (types.length === undefined) {
            if (this._check(types)) {
                this._advance();
                return true;
            }
            return false;
        }

        for (let i = 0, l = types.length; i < l; ++i) {
            const type = types[i];
            if (this._check(type)) {
                this._advance();
                return true;
            }
        }

        return false;
    }

    _consume(types, message) {
        if (this._check(types)) return this._advance();
        throw this._error(this._peek(), message);
    }

    _check(types) {
        if (this._isAtEnd()) return false;
        if (types.length !== undefined) {
            let t = this._peek()._type;
            return types.indexOf(t) != -1;
        }
        return this._peek()._type == types;
    }

    _advance() {
        if (!this._isAtEnd()) this._current++;
        return this._previous();
    }

    _peek() {
        return this._tokens[this._current];
    }

    _previous() {
        return this._tokens[this._current - 1];
    }

    _global_decl_or_directive() {
        // semicolon
        // global_variable_decl semicolon
        // global_constant_decl semicolon
        // type_alias semicolon
        // struct_decl semicolon
        // function_decl
        // enable_directive

        // Ignore any stand-alone semicolons
        while (this._match(Token.semicolon) && !this._isAtEnd());

        if (this._match(Keyword.type)) {
            const type = this._type_alias();
            this._consume(Token.semicolon, "Expected ';'");
            return type;
        }

        if (this._match(Keyword.enable)) {
            const enable = this._enable_directive();
            this._consume(Token.semicolon, "Expected ';'");
            return enable;
        }

        // The following statements have an optional attribute*
        const attrs = this._attribute();

        if (this._check(Keyword.var)) {
            const _var = this._global_variable_decl();
            _var.attributes = attrs;
            this._consume(Token.semicolon, "Expected ';'.");
            return _var;
        }

        if (this._check(Keyword.let)) {
            const _let = this._global_constant_decl();
            _let.attributes = attrs;
            this._consume(Token.semicolon, "Expected ';'.");
            return _let;
        }

        if (this._check(Keyword.struct)) {
            const _struct = this._struct_decl();
            _struct.attributes = attrs;
            this._consume(Token.semicolon, "Expected ';'.");
            return _struct;
        }

        if (this._check(Keyword.fn)) {
            const _fn = this._function_decl();
            _fn.attributes = attrs;
            return _fn;
        }
        
        return null;
    }

    _function_decl() {
        // attribute* function_header compound_statement
        // function_header: fn ident paren_left param_list? paren_right (arrow attribute* type_decl)?
        if (!this._match(Keyword.fn))
            return null;

        const name = this._consume(Token.ident, "Expected function name.").toString();

        this._consume(Token.paren_left, "Expected '(' for function arguments.");

        const args = [];
        if (!this._check(Token.paren_right)) {
            do {
                const argAttrs = this._attribute();

                const name = this._consume(Token.ident, "Expected argument name.").toString();

                this._consume(Token.colon, "Expected ':' for argument type.");
                
                const typeAttrs = this._attribute();
                const type = this._type_decl();
                type.attributes = typeAttrs;

                args.push(new AST("arg", { name, attributes: argAttrs, type }));
            } while (this._match(Token.comma));
        }

        this._consume(Token.paren_right, "Expected ')' after function arguments.");

        let _return = null;
        if (this._match(Token.arrow)) {
            const attrs = this._attribute();
            _return = this._type_decl();
            _return.attributes = attrs;
        }

        const body = this._compound_statement();

        return new AST("function", { name, args, return: _return, body });
    }

    _compound_statement() {
        // brace_left statement* brace_right
        const statements = [];
        this._consume(Token.brace_left, "Expected '{' for block.");
        while (!this._check(Token.brace_right)) {
            const statement = this._statement();
            if (statement)
                statements.push(statement);
        }
        this._consume(Token.brace_right, "Expected '}' for block.");

        return statements;
    }

    _statement() {
        // semicolon
        // return_statement semicolon
        // if_statement
        // switch_statement
        // loop_statement
        // for_statement
        // func_call_statement semicolon
        // variable_statement semicolon
        // break_statement semicolon
        // continue_statement semicolon
        // discard semicolon
        // assignment_statement semicolon
        // compound_statement

        // Ignore any stand-alone semicolons
        while (this._match(Token.semicolon) && !this._isAtEnd());

        if (this._check(Keyword.if))
            return this._if_statement();

        if (this._check(Keyword.switch))
            return this._switch_statement();

        if (this._check(Keyword.loop))
            return this._loop_statement();

        if (this._check(Keyword.for))
            return this._for_statement();

        if (this._check(Token.brace_left))
            return this._compound_statement();

        let result = null;
        if (this._check(Keyword.return))
            result = this._return_statement();
        else if (this._check([Keyword.var, Keyword.let]))
            result = this._variable_statement();
        else if (this._match(Keyword.discard))
            result = new AST("discard");
        else if (this._match(Keyword.break))
            result = new AST("break");
        else if (this._match(Keyword.continue))
            result = new AST("continue");
        else 
            result = this._func_call_statement() || this._assignment_statement();

        this._consume(Token.semicolon, "Expected ';' after statement.");

        return result;
    }

    _for_statement() {
        // for paren_left for_header paren_right compound_statement
        if (!this._match(Keyword.for))
            return null;

        this._consume(Token.paren_left, "Expected '(' for for loop.");

        // for_header: (variable_statement assignment_statement func_call_statement)? semicolon short_circuit_or_expression? semicolon (assignment_statement func_call_statement)?
        const init = !this._check(Token.semicolon) ? this._for_init() : null;
        this._consume(Token.semicolon, "Expected ';'.");
        const condition = !this._check(Token.semicolon) ? this._short_circuit_or_expression() : null;
        this._consume(Token.semicolon, "Expected ';'.");
        const increment = !this._check(Token.paren_right) ? this._for_increment() : null;

        this._consume(Token.paren_right, "Expected ')' for for loop.");

        const body = this._compound_statement();

        return new AST("for", { init, condition, increment, body });
    }

    _for_init() {
        // (variable_statement assignment_statement func_call_statement)?
        return this._variable_statement() || this._func_call_statement() || this._assignment_statement();
    }

    _for_increment() {
        // (assignment_statement func_call_statement)?
        return this._func_call_statement() || this._assignment_statement();
    }

    _variable_statement() {
        // variable_decl
        // variable_decl equal short_circuit_or_expression
        // let (ident variable_ident_decl) equal short_circuit_or_expression
        if (this._check(Keyword.var)) {
            const _var = this._variable_decl();
            let value = null;
            if (this._match(Token.equal))
                value = this._short_circuit_or_expression();

            return new AST("var", { var: _var, value });
        }

        if (this._match(Keyword.let)) {
            const name = this._consume(Token.ident, "Expected name for let.").toString();
            let type = null;
            if (this._match(Token.colon)) {
                const typeAttrs = this._attribute();
                type = this._type_decl();
                type.attributes = typeAttrs;
            }
            this._consume(Token.equal, "Expected '=' for let.");
            const value = this._short_circuit_or_expression();
            return new AST("let", { name, type, value });
        }

        return null;
    }

    _assignment_statement() {
        // (unary_expression underscore) equal short_circuit_or_expression
        let _var = null;
        if (!this._match(Token.underscore))
            _var = this._unary_expression();

        this._consume(Token.equal, "Expected '='.");

        const value = this._short_circuit_or_expression();

        return new AST("assign", { var: _var, value });
    }

    _func_call_statement() {
        // ident argument_expression_list
        if (!this._check(Token.ident))
            return null;

        const savedPos = this._current;
        const name = this._consume(Token.ident, "Expected function name.");
        const args = this._argument_expression_list();

        if (args === null) {
            this._current = savedPos;
            return null;
        }

        return new AST("call", { name, args });
    }

    _loop_statement() {
        // loop brace_left statement* continuing_statement? brace_right
        if (!this._match(Keyword.loop))
            return null;

        this._consume(Token.brace_left, "Expected '{' for loop.");

        // statement*
        const statements = [];
        let statement = this._statement();
        while (statement !== null) {
            statements.push(statement);
            statement = this._statement();
        }

        // continuing_statement: continuing compound_statement
        let continuing = null;
        if (this._match(Keyword.continuing))
            continuing = this._compound_statement();

        this._consume(Token.brace_right, "Expected '}' for loop.");

        return new AST("loop", { statements, continuing });
    }

    _switch_statement() {
        // switch paren_expression brace_left switch_body+ brace_right
        if (!this._match(Keyword.switch))
            return null;

        const condition = this._paren_expression();
        this._consume(Token.brace_left);
        const body = this._switch_body();
        if (body == null || body.length == 0)
            throw this._error(this._previous(), "Expected 'case' or 'default'.");
        this._consume(Token.brace_right);
        return new AST("switch", { condition, body });
    }

    _switch_body() {
        // case case_selectors colon brace_left case_body? brace_right
        // default colon brace_left case_body? brace_right
        const cases = [];
        if (this._match(Token.case)) {
            this._consume(Token.case);
            const selector = this._case_selectors();
            this._consume(Token.colon);
            this._consume(Token.brace_left);
            const body = this._case_body();
            this._consume(Token.brace_right);
            cases.push(new AST("case", { selector, body }));
        }

        if (this._match(Token.default)) {
            this._consume(Token.colon);
            this._consume(Token.brace_left);
            const body = this._case_body();
            this._consume(Token.brace_right);
            cases.push(new AST("default", { body }));
        }

        if (this._check([Token.default, Token.case])) {
            const _cases = this._switch_body();
            cases.push(_cases[0]);
        }

        return cases;
    }

    _case_selectors() {
        // const_literal (comma const_literal)* comma?
        const selectors = [this._consume(Token.const_literal, "Expected constant literal").toString()];
        while (this._match(Token.comma)) {
            selectors.push(this._consume(Token.const_literal, "Expected constant literal").toString());
        }
        return selectors;
    }

    _case_body() {
        // statement case_body?
        // fallthrough semicolon
        if (this._match(Keyword.fallthrough)) {
            this._consume(Token.semicolon);
            return [];
        }

        const statement = this._statement();
        if (statement == null)
            return [];

        const nextStatement = this._case_body();
        if (nextStatement.length == 0)
            return [statement];

        return [statement, nextStatement[0]];
    }

    _if_statement() {
        // if paren_expression compound_statement elseif_statement? else_statement?
        if (!this._match(Keyword.if))
            return null;

        const condition = this._paren_expression();
        const block = this._compound_statement();

        let elseif = null;
        if (this._match(Keyword.elseif))
            elseif = this._elseif_statement();

        let _else = null;
        if (this._match(Keyword.else))
            _else = this._compound_statement();

        return new AST("if", { condition, block, elseif, else: _else });
    }

    _elseif_statement() {
        // else_if paren_expression compound_statement elseif_statement?
        const elseif = [];
        const condition = this._paren_expression();
        const block = this._compound_statement();
        elseif.push(new AST("elseif", { condition, block }));
        if (this._match(Keyword.elseif))
            elseif.push(this._elseif_statement()[0]);
        return elseif;
    }

    _return_statement() {
        // return short_circuit_or_expression?
        if (!this._match(Keyword.return))
            return null;
        const value = this._short_circuit_or_expression();
        return new AST("return", { value: value });
    }

    _short_circuit_or_expression() {
        // short_circuit_and_expression
        // short_circuit_or_expression or_or short_circuit_and_expression
        let expr = this._short_circuit_and_expr();
        while (this._match(Token.or_or)) {
            expr = new AST("compareOp", {
                operator: this._previous().toString(),
                left: expr,
                right: this._short_circuit_and_expr()
            });
        }
        return expr;
    }

    _short_circuit_and_expr() {
        // inclusive_or_expression
        // short_circuit_and_expression and_and inclusive_or_expression
        let expr = this._inclusive_or_expression();
        while (this._match(Token.and_and)) {
            expr = new AST("compareOp", {
                operator: this._previous().toString(),
                left: expr,
                right: this._inclusive_or_expression()
            });
        }
        return expr;
    }

    _inclusive_or_expression() {
        // exclusive_or_expression
        // inclusive_or_expression or exclusive_or_expression
        let expr = this._exclusive_or_expression();
        while (this._match(Token.or)) {
            expr = new AST("binaryOp", {
                operator: this._previous().toString(),
                left: expr,
                right: this._exclusive_or_expression()
            });
        }
        return expr;
    }

    _exclusive_or_expression() {
        // and_expression
        // exclusive_or_expression xor and_expression
        let expr = this._and_expression();
        while (this._match(Token.xor)) {
            expr = new AST("binaryOp", {
                operator: this._previous().toString(),
                left: expr,
                right: this._and_expression()
            });
        }
        return expr;
    }

    _and_expression() {
        // equality_expression
        // and_expression and equality_expression
        let expr = this._equality_expression();
        while (this._match(Token.and)) {
            expr = new AST("binaryOp", {
                operator: this._previous().toString(),
                left: expr,
                right: this._equality_expression()
            });
        }
        return expr;
    }
    
    _equality_expression() {
        // relational_expression
        // relational_expression equal_equal relational_expression
        // relational_expression not_equal relational_expression
        const expr = this._relational_expression();
        if (this._match([Token.equal_equal, Token.not_equal])) {
            return new AST("compareOp", {
                operator: this._previous().toString(),
                left: expr,
                right: this._relational_expression()
            });
        }
        return expr;
    }

    _relational_expression() {
        // shift_expression
        // relational_expression less_than shift_expression
        // relational_expression greater_than shift_expression
        // relational_expression less_than_equal shift_expression
        // relational_expression greater_than_equal shift_expression
        let expr = this._shift_expression();
        while (this._match([Token.less_than, Token.greater_than, Token.less_than_equal,
                            Token.greater_than_equal])) {
            expr = new AST("compareOp", {
                operator: this._previous().toString(),
                left: expr,
                right: this._shift_expression()
            });
        }
        return expr;
    }

    _shift_expression() {
        // additive_expression
        // shift_expression shift_left additive_expression
        // shift_expression shift_right additive_expression
        let expr = this._additive_expression();
        while (this._match([Token.shift_left, Token.shift_right])) {
            expr = new AST("binaryOp", {
                operator: this._previous().toString(),
                left: expr,
                right: this._additive_expression()
            });
        }
        return expr;
    }

    _additive_expression() {
        // multiplicative_expression
        // additive_expression plus multiplicative_expression
        // additive_expression minus multiplicative_expression
        let expr = this._multiplicative_expression();
        while (this._match([Token.plus, Token.minus])) {
            expr = new AST("binaryOp", {
                operator: this._previous().toString(),
                left: expr,
                right: this._multiplicative_expression()
            });
        }
        return expr;
    }

    _multiplicative_expression() {
        // unary_expression
        // multiplicative_expression star unary_expression
        // multiplicative_expression forward_slash unary_expression
        // multiplicative_expression modulo unary_expression
        let expr = this._unary_expression();
        while (this._match([Token.star, Token.forward_slash, Token.modulo])) {
            expr = new AST("binaryOp", {
                operator: this._previous().toString(),
                left: expr,
                right: this._unary_expression()
            });
        }
        return expr;
    }

    _unary_expression() {
        // singular_expression
        // minus unary_expression
        // bang unary_expression
        // tilde unary_expression
        // star unary_expression
        // and unary_expression
        if (this._match([Token.minus, Token.bang, Token.tilde, Token.star, Token.and])) {
            return new AST("unaryOp", {
                operator: this._previous().toString(), right: this._unary_expression() });
        }
        return this._singular_expression();
    }

    _singular_expression() {
        // primary_expression postfix_expression ?
        const expr = this._primary_expression();
        const p = this._postfix_expression();
        if (p)
            expr.postfix = p;
        return expr;
    }

    _postfix_expression() {
        // bracket_left short_circuit_or_expression bracket_right postfix_expression?
        if (this._match(Token.bracket_left)) {
            const expr = this._short_circuit_or_expression();
            this._consume(Token.bracket_right, "Expected ']'.");
            const p = this._postfix_expression();
            if (p)
                expr.postfix = p;
            return expr;
        }

        // period ident postfix_expression?
        if (this._match(Token.period)) {
            const name = this._consume(Token.ident, "Expected member name.");
            const p = this._postfix_expression();
            if (p)
                name.postfix = p;
            return name;
        }

        return null;
    }

    _primary_expression() {
        // ident argument_expression_list?
        if (this._match(Token.ident)) {
            const name = this._previous().toString();
            if (this._check(Token.paren_left)) {
                const args = this._argument_expression_list();
                return new AST("call_expr", { name, args });
            }
            return new AST("variable_expr", { name });
        }

        // const_literal
        if (this._match(Token.const_literal)) {
            return new AST("literal_expr", { value: this._previous().toString() });
        }

        // paren_expression
        if (this._check(Token.paren_left)) {
            return this._paren_expression();
        }

        // bitcast less_than type_decl greater_than paren_expression
        if (this._match(Keyword.bitcast)) {
            this._consume(Token.less_than, "Expected '<'.");
            const type = this._type_decl();
            this._consume(Token.greater_than, "Expected '>'.");
            const value = this._paren_expression();
            return new AST("bitcast_expr", { type, value });
        }

        // type_decl argument_expression_list
        const type = this._type_decl();
        const args = this._argument_expression_list();
        return new AST("typecast_expr", { type, args });
    }

    _argument_expression_list() {
        // paren_left ((short_circuit_or_expression comma)* short_circuit_or_expression comma?)? paren_right
        if (!this._match(Token.paren_left))
            return null;

        const args = [];
        do {
            if (this._check(Token.paren_right))
                break;
            const arg = this._short_circuit_or_expression();
            args.push(arg);
        } while (this._match(Token.comma));
        this._consume(Token.paren_right, "Expected ')' for agument list");

        return args;
    }

    _paren_expression() {
        // paren_left short_circuit_or_expression paren_right
        this._consume(Token.paren_left, "Expected '('.");
        const expr = this._short_circuit_or_expression();
        this._consume(Token.paren_right, "Expected ')'.");
        return new AST("grouping_expr", { contents: expr });
    }

    _struct_decl() {
        // attribute* struct ident struct_body_decl
        if (!this._match(Keyword.struct))
            return null;

        const name = this._consume(Token.ident, "Expected name for struct.").toString();

        this._consume(Token.brace_left, "Expected '{' for struct body.");
        const members = [];
        while (!this._check(Token.brace_right)) {
            // struct_member: attribute* variable_ident_decl semicolon
            const memberAttrs = this._attribute();

            const memberName = this._consume(Token.ident, "Expected variable name.").toString();
            //member.attributes = attrs;

            this._consume(Token.colon, "Expected ':' for struct member type.");

            const typeAttrs = this._attribute();
            const memberType = this._type_decl();
            memberType.attributes = typeAttrs;

            this._consume(Token.semicolon, "Expected ';' after struct member.");

            members.push(new AST("member", {
                name: memberName,
                attributes: memberAttrs,
                type: memberType
            }));
        }

        this._consume(Token.brace_right, "Expected '}' after struct body.");

        return new AST("struct", { name, members });
    }

    _global_variable_decl() {
        // attribute* variable_decl (equal const_expression)?
        const _var = this._variable_decl();
        if (this._match(Token.equal))
            _var.value = this._const_expression();
        return _var;
    }

    _global_constant_decl() {
        // attribute* let (ident variable_ident_decl) global_const_initializer?
        if (!this._match(Keyword.let))
            return null;

        const name = this._consume(Token.ident, "Expected variable name");
        let type = null;
        if (this._match(Token.colon)) {
            const attrs = this._attribute();
            type = this._type_decl();
            type.attributes = attrs;
        }
        let value = null;
        if (this._match(Token.equal)) {
            value = this._const_expression();
        }
        return new AST("let", { name: name.toString(), type, value });
    }

    _const_expression() {
        // type_decl paren_left ((const_expression comma)* const_expression comma?)? paren_right
        // const_literal
        if (this._match(Token.const_literal))
            return this._previous().toString();
        
        const type = this._type_decl();

        this._consume(Token.paren_left, "Expected '('.");

        let args = [];
        while (!this._check(Token.paren_right)) {
            args.push(this._const_expression());
            if (!this._check(Token.comma))
                break;
            this._advance();
        }

        this._consume(Token.paren_right, "Expected ')'.");

        return new AST("create", { type, args });
    }

    _variable_decl() {
        // var variable_qualifier? (ident variable_ident_decl)
        if (!this._match(Keyword.var))
            return null;

        // variable_qualifier: less_than storage_class (comma access_mode)? greater_than
        let storage = null;
        let access = null;
        if (this._match(Token.less_than)) {
            storage = this._consume(Token.storage_class, "Expected storage_class.").toString();
            if (this._match(Token.comma))
                access = this._consume(Token.access_mode, "Expected access_mode.").toString();
            this._consume(Token.greater_than, "Expected '>'.");
        }

        const name = this._consume(Token.ident, "Expected variable name");
        let type = null;
        if (this._match(Token.colon)) {
            const attrs = this._attribute();
            type = this._type_decl();
            type.attributes = attrs;
        }

        return new AST("var", { name: name.toString(), type, storage, access });
    }

    _enable_directive() {
        // enable ident semicolon
        const name = this._consume(Token.ident, "identity expected.");
        return new AST("enable", { name: name.toString() });
    }

    _type_alias() {
        // type ident equal type_decl
        const name = this._consume(Token.ident, "identity expected.");
        this._consume(Token.equal, "Expected '=' for type alias.");
        const alias = this._type_decl();
        return new AST("alias", { name: name.toString(), alias });
    }

    _type_decl() {
        // ident
        // bool
        // float32
        // int32
        // uint32
        // vec2 less_than type_decl greater_than
        // vec3 less_than type_decl greater_than
        // vec4 less_than type_decl greater_than
        // mat2x2 less_than type_decl greater_than
        // mat2x3 less_than type_decl greater_than
        // mat2x4 less_than type_decl greater_than
        // mat3x2 less_than type_decl greater_than
        // mat3x3 less_than type_decl greater_than
        // mat3x4 less_than type_decl greater_than
        // mat4x2 less_than type_decl greater_than
        // mat4x3 less_than type_decl greater_than
        // mat4x4 less_than type_decl greater_than
        // atomic less_than type_decl greater_than
        // pointer less_than storage_class comma type_decl (comma access_mode)? greater_than
        // array_type_decl
        // texture_sampler_types

        if (this._check([Token.ident, Keyword.bool, Keyword.float32, Keyword.int32, Keyword.uint32])) {
            const type = this._advance();
            return new AST("type", { name: type.toString() });
        }
        
        if (this._check(Token.template_types)) {
            let type = this._advance().toString();
            this._consume(Token.less_than, "Expected '<' for type.");
            const format = this._type_decl();
            this._consume(Token.greater_than, "Expected '>' for type.");
            return new AST(type, { name: type, format });
        }

        // pointer less_than storage_class comma type_decl (comma access_mode)? greater_than
        if (this._match(Keyword.pointer)) {
            let pointer = this._previous().toString();
            this._consume(Token.less_than, "Expected '<' for pointer.");
            const storage = this._consume(Token.storage_class, "Expected storage_class for pointer");
            this._consume(Token.comma, "Expected ',' for pointer.");
            const decl = this._type_decl();
            let access = null;
            if (this._match(Token.comma))
                access = this._consume(Token.access_mode, "Expected access_mode for pointer").toString();
            this._consume(Token.greater_than, "Expected '>' for pointer.");
            return new AST("pointer", { name: pointer, storage: storage.toString(), decl, access });
        }

        // texture_sampler_types
        let type = this._texture_sampler_types();
        if (type)
            return type;

        // The following type_decl's have an optional attribyte_list*
        const attrs = this._attribute();

        // attribute* array less_than type_decl (comma element_count_expression)? greater_than
        if (this._match(Keyword.array)) {
            const array = this._previous();
            this._consume(Token.less_than, "Expected '<' for array type.");
            const format = this._type_decl();
            let count = null;
            if (this._match(Token.comma))
                count = this._consume(Token.element_count_expression, "Expected element_count for array.").toString();
            this._consume(Token.greater_than, "Expected '>' for array.");

            return new AST("array", { name: array.toString(), attributes: attrs, format, count });
        }

        return null;
    }

    _texture_sampler_types() {
        // sampler_type
        if (this._match(Token.sampler_type))
            return new AST("sampler", { name: this._previous().toString() });

        // depth_texture_type
        if (this._match(Token.depth_texture_type))
            return new AST("sampler", { name: this._previous().toString() });

        // sampled_texture_type less_than type_decl greater_than
        // multisampled_texture_type less_than type_decl greater_than
        if (this._match(Token.sampled_texture_type) || 
            this._match(Token.multisampled_texture_type)) {
            const sampler = this._previous();
            this._consume(Token.less_than, "Expected '<' for sampler type.");
            const format = this._type_decl();
            this._consume(Token.greater_than, "Expected '>' for sampler type.");
            return new AST("sampler", { name: sampler.toString(), format });
        }

        // storage_texture_type less_than texel_format comma access_mode greater_than
        if (this._match(Token.storage_texture_type)) {
            const sampler = this._previous();
            this._consume(Token.less_than, "Expected '<' for sampler type.");
            const format = this._consume(Token.texel_format, "Invalid texel format.").toString();
            this._consume(Token.comma, "Expected ',' after texel format.");
            const access = this._consume(Token.access_mode, "Expected access mode for storage texture type.").toString();
            this._consume(Token.greater_than, "Expected '>' for sampler type.");
            return new AST("sampler", { name: sampler.toString(), format, access });
        }

        return null;
    }

    _attribute() {
        // attr ident paren_left (literal_or_ident comma)* literal_or_ident paren_right
        // attr ident

        let attributes = [];

        while (this._match(Token.attr))
        {
            const name = this._consume(Token.attribute_name, "Expected attribute name");
            const attr = new AST("attribute", { name: name.toString() });
            if (this._match(Token.paren_left)) {
                // literal_or_ident
                attr.value = this._consume(Token.literal_or_ident, "Expected attribute value").toString();
                if (this._check(Token.comma)) {
                    this._advance();
                    attr.value = [attr.value];
                    do {
                        const v = this._consume(Token.literal_or_ident, "Expected attribute value").toString();
                        attr.value.push(v);
                    } while (this._match(Token.comma));
                }
                this._consume(Token.paren_right, "Expected ')'");
            }
            attributes.push(attr);
        }

        // Deprecated:
        // attr_left (attribute comma)* attribute attr_right
        while (this._match(Token.attr_left)) {
            if (!this._check(Token.attr_right)) {
                do {
                    const name = this._consume(Token.attribute_name, "Expected attribute name");
                    const attr = new AST("attribute", { name: name.toString() });
                    if (this._match(Token.paren_left)) {
                        // literal_or_ident
                        attr.value = this._consume(Token.literal_or_ident, "Expected attribute value").toString();
                        if (this._check(Token.comma)) {
                            this._advance();
                            attr.value = [attr.value];
                            do {
                                const v = this._consume(Token.literal_or_ident, "Expected attribute value").toString();
                                attr.value.push(v);
                            } while (this._match(Token.comma));
                        }
                        this._consume(Token.paren_right, "Expected ')'");
                    }
                    attributes.push(attr);
                } while (this._match(Token.comma));

            }
            // Consume ]]
            this._consume(Token.attr_right, "Expected ']]' after attribute declarations");
        }

        if (attributes.length == 0)
            return null;

        return attributes;
    }
}
