/**
 * @author Brendan Duncan / https://github.com/brendan-duncan
 */
import { WgslScanner, TokenType, TokenTypes } from "./wgsl_scanner.js";
import * as AST from "./wgsl_ast.js";
/// Parse a sequence of tokens from the WgslScanner into an Abstract Syntax Tree (AST).
export class WgslParser {
    constructor() {
        this._tokens = [];
        this._current = 0;
        this._context = new AST.ParseContext();
        this._deferArrayCountEval = [];
    }
    parse(tokensOrCode) {
        this._initialize(tokensOrCode);
        this._deferArrayCountEval.length = 0;
        const statements = [];
        while (!this._isAtEnd()) {
            const statement = this._global_decl_or_directive();
            if (!statement) {
                break;
            }
            statements.push(statement);
        }
        // Since constants can be declared after they are used, and
        // constants can be used to size arrays, defer calculating the
        // size until after the shader has finished parsing.
        if (this._deferArrayCountEval.length > 0) {
            for (const arrayDecl of this._deferArrayCountEval) {
                const arrayType = arrayDecl["arrayType"];
                const countNode = arrayDecl["countNode"];
                if (countNode instanceof AST.VariableExpr) {
                    const variable = countNode;
                    const name = variable.name;
                    const constant = this._context.constants.get(name);
                    if (constant) {
                        try {
                            const count = constant.evaluate(this._context);
                            arrayType.count = count;
                        }
                        catch (e) {
                        }
                    }
                }
            }
            this._deferArrayCountEval.length = 0;
        }
        return statements;
    }
    _initialize(tokensOrCode) {
        if (tokensOrCode) {
            if (typeof tokensOrCode == "string") {
                const scanner = new WgslScanner(tokensOrCode);
                this._tokens = scanner.scanTokens();
            }
            else {
                this._tokens = tokensOrCode;
            }
        }
        else {
            this._tokens = [];
        }
        this._current = 0;
    }
    _error(token, message) {
        //console.error(token, message);
        return {
            token,
            message,
            toString: function () {
                return `${message}`;
            },
        };
    }
    _isAtEnd() {
        return (this._current >= this._tokens.length ||
            this._peek().type == TokenTypes.eof);
    }
    _match(types) {
        if (types instanceof TokenType) {
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
        if (this._check(types)) {
            return this._advance();
        }
        throw this._error(this._peek(), message);
    }
    _check(types) {
        if (this._isAtEnd()) {
            return false;
        }
        const tk = this._peek();
        if (types instanceof Array) {
            const t = tk.type;
            const index = types.indexOf(t);
            return index != -1;
        }
        return tk.type == types;
    }
    _advance() {
        if (!this._isAtEnd()) {
            this._current++;
        }
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
        // struct_decl
        // function_decl
        // enable_directive
        // Ignore any stand-alone semicolons
        while (this._match(TokenTypes.tokens.semicolon) && !this._isAtEnd())
            ;
        if (this._match(TokenTypes.keywords.alias)) {
            const type = this._type_alias();
            this._consume(TokenTypes.tokens.semicolon, "Expected ';'");
            return type;
        }
        if (this._match(TokenTypes.keywords.diagnostic)) {
            const directive = this._diagnostic();
            this._consume(TokenTypes.tokens.semicolon, "Expected ';'");
            return directive;
        }
        if (this._match(TokenTypes.keywords.enable)) {
            const enable = this._enable_directive();
            this._consume(TokenTypes.tokens.semicolon, "Expected ';'");
            return enable;
        }
        // The following statements have an optional attribute*
        const attrs = this._attribute();
        if (this._check(TokenTypes.keywords.var)) {
            const _var = this._global_variable_decl();
            if (_var != null) {
                _var.attributes = attrs;
            }
            this._consume(TokenTypes.tokens.semicolon, "Expected ';'.");
            return _var;
        }
        if (this._check(TokenTypes.keywords.override)) {
            const _override = this._override_variable_decl();
            if (_override != null) {
                _override.attributes = attrs;
            }
            this._consume(TokenTypes.tokens.semicolon, "Expected ';'.");
            return _override;
        }
        if (this._check(TokenTypes.keywords.let)) {
            const _let = this._global_let_decl();
            if (_let != null) {
                _let.attributes = attrs;
            }
            this._consume(TokenTypes.tokens.semicolon, "Expected ';'.");
            return _let;
        }
        if (this._check(TokenTypes.keywords.const)) {
            const _const = this._global_const_decl();
            if (_const != null) {
                _const.attributes = attrs;
            }
            this._consume(TokenTypes.tokens.semicolon, "Expected ';'.");
            return _const;
        }
        if (this._check(TokenTypes.keywords.struct)) {
            const _struct = this._struct_decl();
            if (_struct != null)
                _struct.attributes = attrs;
            return _struct;
        }
        if (this._check(TokenTypes.keywords.fn)) {
            const _fn = this._function_decl();
            if (_fn != null)
                _fn.attributes = attrs;
            return _fn;
        }
        return null;
    }
    _function_decl() {
        // attribute* function_header compound_statement
        // function_header: fn ident paren_left param_list? paren_right (arrow attribute* type_decl)?
        if (!this._match(TokenTypes.keywords.fn))
            return null;
        const name = this._consume(TokenTypes.tokens.ident, "Expected function name.").toString();
        this._consume(TokenTypes.tokens.paren_left, "Expected '(' for function arguments.");
        const args = [];
        if (!this._check(TokenTypes.tokens.paren_right)) {
            do {
                if (this._check(TokenTypes.tokens.paren_right)) {
                    break;
                }
                const argAttrs = this._attribute();
                const name = this._consume(TokenTypes.tokens.ident, "Expected argument name.").toString();
                this._consume(TokenTypes.tokens.colon, "Expected ':' for argument type.");
                const typeAttrs = this._attribute();
                const type = this._type_decl();
                if (type != null) {
                    type.attributes = typeAttrs;
                    args.push(new AST.Argument(name, type, argAttrs));
                }
            } while (this._match(TokenTypes.tokens.comma));
        }
        this._consume(TokenTypes.tokens.paren_right, "Expected ')' after function arguments.");
        let _return = null;
        if (this._match(TokenTypes.tokens.arrow)) {
            const attrs = this._attribute();
            _return = this._type_decl();
            if (_return != null) {
                _return.attributes = attrs;
            }
        }
        const body = this._compound_statement();
        return new AST.Function(name, args, _return, body);
    }
    _compound_statement() {
        // brace_left statement* brace_right
        const statements = [];
        this._consume(TokenTypes.tokens.brace_left, "Expected '{' for block.");
        while (!this._check(TokenTypes.tokens.brace_right)) {
            const statement = this._statement();
            if (statement !== null) {
                statements.push(statement);
            }
        }
        this._consume(TokenTypes.tokens.brace_right, "Expected '}' for block.");
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
        // continuing_statement compound_statement
        // discard semicolon
        // assignment_statement semicolon
        // compound_statement
        // increment_statement semicolon
        // decrement_statement semicolon
        // static_assert_statement semicolon
        // Ignore any stand-alone semicolons
        while (this._match(TokenTypes.tokens.semicolon) && !this._isAtEnd())
            ;
        if (this._check(TokenTypes.keywords.if)) {
            return this._if_statement();
        }
        if (this._check(TokenTypes.keywords.switch)) {
            return this._switch_statement();
        }
        if (this._check(TokenTypes.keywords.loop)) {
            return this._loop_statement();
        }
        if (this._check(TokenTypes.keywords.for)) {
            return this._for_statement();
        }
        if (this._check(TokenTypes.keywords.while)) {
            return this._while_statement();
        }
        if (this._check(TokenTypes.keywords.continuing)) {
            return this._continuing_statement();
        }
        if (this._check(TokenTypes.keywords.static_assert)) {
            return this._static_assert_statement();
        }
        if (this._check(TokenTypes.tokens.brace_left)) {
            return this._compound_statement();
        }
        let result = null;
        if (this._check(TokenTypes.keywords.return)) {
            result = this._return_statement();
        }
        else if (this._check([
            TokenTypes.keywords.var,
            TokenTypes.keywords.let,
            TokenTypes.keywords.const,
        ])) {
            result = this._variable_statement();
        }
        else if (this._match(TokenTypes.keywords.discard)) {
            result = new AST.Discard();
        }
        else if (this._match(TokenTypes.keywords.break)) {
            result = new AST.Break();
        }
        else if (this._match(TokenTypes.keywords.continue)) {
            result = new AST.Continue();
        }
        else {
            result =
                this._increment_decrement_statement() ||
                    this._func_call_statement() ||
                    this._assignment_statement();
        }
        if (result != null) {
            this._consume(TokenTypes.tokens.semicolon, "Expected ';' after statement.");
        }
        return result;
    }
    _static_assert_statement() {
        if (!this._match(TokenTypes.keywords.static_assert)) {
            return null;
        }
        const expression = this._optional_paren_expression();
        return new AST.StaticAssert(expression);
    }
    _while_statement() {
        if (!this._match(TokenTypes.keywords.while)) {
            return null;
        }
        const condition = this._optional_paren_expression();
        const block = this._compound_statement();
        return new AST.While(condition, block);
    }
    _continuing_statement() {
        if (!this._match(TokenTypes.keywords.continuing)) {
            return null;
        }
        const block = this._compound_statement();
        return new AST.Continuing(block);
    }
    _for_statement() {
        // for paren_left for_header paren_right compound_statement
        if (!this._match(TokenTypes.keywords.for)) {
            return null;
        }
        this._consume(TokenTypes.tokens.paren_left, "Expected '('.");
        // for_header: (variable_statement assignment_statement func_call_statement)? semicolon short_circuit_or_expression? semicolon (assignment_statement func_call_statement)?
        const init = !this._check(TokenTypes.tokens.semicolon)
            ? this._for_init()
            : null;
        this._consume(TokenTypes.tokens.semicolon, "Expected ';'.");
        const condition = !this._check(TokenTypes.tokens.semicolon)
            ? this._short_circuit_or_expression()
            : null;
        this._consume(TokenTypes.tokens.semicolon, "Expected ';'.");
        const increment = !this._check(TokenTypes.tokens.paren_right)
            ? this._for_increment()
            : null;
        this._consume(TokenTypes.tokens.paren_right, "Expected ')'.");
        const body = this._compound_statement();
        return new AST.For(init, condition, increment, body);
    }
    _for_init() {
        // (variable_statement assignment_statement func_call_statement)?
        return (this._variable_statement() ||
            this._func_call_statement() ||
            this._assignment_statement());
    }
    _for_increment() {
        // (assignment_statement func_call_statement increment_statement)?
        return (this._func_call_statement() ||
            this._increment_decrement_statement() ||
            this._assignment_statement());
    }
    _variable_statement() {
        // variable_decl
        // variable_decl equal short_circuit_or_expression
        // let (ident variable_ident_decl) equal short_circuit_or_expression
        // const (ident variable_ident_decl) equal short_circuit_or_expression
        if (this._check(TokenTypes.keywords.var)) {
            const _var = this._variable_decl();
            if (_var === null) {
                throw this._error(this._peek(), "Variable declaration expected.");
            }
            let value = null;
            if (this._match(TokenTypes.tokens.equal)) {
                value = this._short_circuit_or_expression();
            }
            return new AST.Var(_var.name, _var.type, _var.storage, _var.access, value);
        }
        if (this._match(TokenTypes.keywords.let)) {
            const name = this._consume(TokenTypes.tokens.ident, "Expected name for let.").toString();
            let type = null;
            if (this._match(TokenTypes.tokens.colon)) {
                const typeAttrs = this._attribute();
                type = this._type_decl();
                if (type != null) {
                    type.attributes = typeAttrs;
                }
            }
            this._consume(TokenTypes.tokens.equal, "Expected '=' for let.");
            const value = this._short_circuit_or_expression();
            return new AST.Let(name, type, null, null, value);
        }
        if (this._match(TokenTypes.keywords.const)) {
            const name = this._consume(TokenTypes.tokens.ident, "Expected name for const.").toString();
            let type = null;
            if (this._match(TokenTypes.tokens.colon)) {
                const typeAttrs = this._attribute();
                type = this._type_decl();
                if (type != null) {
                    type.attributes = typeAttrs;
                }
            }
            this._consume(TokenTypes.tokens.equal, "Expected '=' for const.");
            const value = this._short_circuit_or_expression();
            return new AST.Const(name, type, null, null, value);
        }
        return null;
    }
    _increment_decrement_statement() {
        const savedPos = this._current;
        const _var = this._unary_expression();
        if (_var == null) {
            return null;
        }
        if (!this._check(TokenTypes.increment_operators)) {
            this._current = savedPos;
            return null;
        }
        const token = this._consume(TokenTypes.increment_operators, "Expected increment operator");
        return new AST.Increment(token.type === TokenTypes.tokens.plus_plus
            ? AST.IncrementOperator.increment
            : AST.IncrementOperator.decrement, _var);
    }
    _assignment_statement() {
        // (unary_expression underscore) equal short_circuit_or_expression
        let _var = null;
        if (this._check(TokenTypes.tokens.brace_right)) {
            return null;
        }
        let isUnderscore = this._match(TokenTypes.tokens.underscore);
        if (!isUnderscore) {
            _var = this._unary_expression();
        }
        if (!isUnderscore && _var == null) {
            return null;
        }
        const type = this._consume(TokenTypes.assignment_operators, "Expected assignment operator.");
        const value = this._short_circuit_or_expression();
        return new AST.Assign(AST.AssignOperator.parse(type.lexeme), _var, value);
    }
    _func_call_statement() {
        // ident argument_expression_list
        if (!this._check(TokenTypes.tokens.ident)) {
            return null;
        }
        const savedPos = this._current;
        const name = this._consume(TokenTypes.tokens.ident, "Expected function name.");
        const args = this._argument_expression_list();
        if (args === null) {
            this._current = savedPos;
            return null;
        }
        return new AST.Call(name.lexeme, args);
    }
    _loop_statement() {
        // loop brace_left statement* continuing_statement? brace_right
        if (!this._match(TokenTypes.keywords.loop)) {
            return null;
        }
        this._consume(TokenTypes.tokens.brace_left, "Expected '{' for loop.");
        // statement*
        const statements = [];
        let statement = this._statement();
        while (statement !== null) {
            if (Array.isArray(statement)) {
                for (let s of statement) {
                    statements.push(s);
                }
            }
            else {
                statements.push(statement);
            }
            statement = this._statement();
        }
        // continuing_statement: continuing compound_statement
        let continuing = null;
        if (this._match(TokenTypes.keywords.continuing)) {
            continuing = this._compound_statement();
        }
        this._consume(TokenTypes.tokens.brace_right, "Expected '}' for loop.");
        return new AST.Loop(statements, continuing);
    }
    _switch_statement() {
        // switch optional_paren_expression brace_left switch_body+ brace_right
        if (!this._match(TokenTypes.keywords.switch)) {
            return null;
        }
        const condition = this._optional_paren_expression();
        this._consume(TokenTypes.tokens.brace_left, "Expected '{' for switch.");
        const body = this._switch_body();
        if (body == null || body.length == 0) {
            throw this._error(this._previous(), "Expected 'case' or 'default'.");
        }
        this._consume(TokenTypes.tokens.brace_right, "Expected '}' for switch.");
        return new AST.Switch(condition, body);
    }
    _switch_body() {
        // case case_selectors colon brace_left case_body? brace_right
        // default colon brace_left case_body? brace_right
        const cases = [];
        if (this._match(TokenTypes.keywords.case)) {
            const selector = this._case_selectors();
            this._match(TokenTypes.tokens.colon); // colon is optional
            this._consume(TokenTypes.tokens.brace_left, "Exected '{' for switch case.");
            const body = this._case_body();
            this._consume(TokenTypes.tokens.brace_right, "Exected '}' for switch case.");
            cases.push(new AST.Case(selector, body));
        }
        if (this._match(TokenTypes.keywords.default)) {
            this._match(TokenTypes.tokens.colon); // colon is optional
            this._consume(TokenTypes.tokens.brace_left, "Exected '{' for switch default.");
            const body = this._case_body();
            this._consume(TokenTypes.tokens.brace_right, "Exected '}' for switch default.");
            cases.push(new AST.Default(body));
        }
        if (this._check([TokenTypes.keywords.default, TokenTypes.keywords.case])) {
            const _cases = this._switch_body();
            cases.push(_cases[0]);
        }
        return cases;
    }
    _case_selectors() {
        // const_literal (comma const_literal)* comma?
        const selectors = [
            this._shift_expression(), //?.evaluate(this._context).toString() ?? "",
        ];
        while (this._match(TokenTypes.tokens.comma)) {
            selectors.push(this._shift_expression());
        }
        return selectors;
    }
    _case_body() {
        // statement case_body?
        // fallthrough semicolon
        if (this._match(TokenTypes.keywords.fallthrough)) {
            this._consume(TokenTypes.tokens.semicolon, "Expected ';'");
            return [];
        }
        let statement = this._statement();
        if (statement == null) {
            return [];
        }
        if (!(statement instanceof Array)) {
            statement = [statement];
        }
        const nextStatement = this._case_body();
        if (nextStatement.length == 0) {
            return statement;
        }
        return [...statement, nextStatement[0]];
    }
    _if_statement() {
        // if optional_paren_expression compound_statement elseif_statement? else_statement?
        if (!this._match(TokenTypes.keywords.if)) {
            return null;
        }
        const condition = this._optional_paren_expression();
        const block = this._compound_statement();
        let elseif = [];
        if (this._match_elseif()) {
            elseif = this._elseif_statement(elseif);
        }
        let _else = null;
        if (this._match(TokenTypes.keywords.else)) {
            _else = this._compound_statement();
        }
        return new AST.If(condition, block, elseif, _else);
    }
    _match_elseif() {
        if (this._tokens[this._current].type === TokenTypes.keywords.else &&
            this._tokens[this._current + 1].type === TokenTypes.keywords.if) {
            this._advance();
            this._advance();
            return true;
        }
        return false;
    }
    _elseif_statement(elseif = []) {
        // else_if optional_paren_expression compound_statement elseif_statement?
        const condition = this._optional_paren_expression();
        const block = this._compound_statement();
        elseif.push(new AST.ElseIf(condition, block));
        if (this._match_elseif()) {
            this._elseif_statement(elseif);
        }
        return elseif;
    }
    _return_statement() {
        // return short_circuit_or_expression?
        if (!this._match(TokenTypes.keywords.return)) {
            return null;
        }
        const value = this._short_circuit_or_expression();
        return new AST.Return(value);
    }
    _short_circuit_or_expression() {
        // short_circuit_and_expression
        // short_circuit_or_expression or_or short_circuit_and_expression
        let expr = this._short_circuit_and_expr();
        while (this._match(TokenTypes.tokens.or_or)) {
            expr = new AST.BinaryOperator(this._previous().toString(), expr, this._short_circuit_and_expr());
        }
        return expr;
    }
    _short_circuit_and_expr() {
        // inclusive_or_expression
        // short_circuit_and_expression and_and inclusive_or_expression
        let expr = this._inclusive_or_expression();
        while (this._match(TokenTypes.tokens.and_and)) {
            expr = new AST.BinaryOperator(this._previous().toString(), expr, this._inclusive_or_expression());
        }
        return expr;
    }
    _inclusive_or_expression() {
        // exclusive_or_expression
        // inclusive_or_expression or exclusive_or_expression
        let expr = this._exclusive_or_expression();
        while (this._match(TokenTypes.tokens.or)) {
            expr = new AST.BinaryOperator(this._previous().toString(), expr, this._exclusive_or_expression());
        }
        return expr;
    }
    _exclusive_or_expression() {
        // and_expression
        // exclusive_or_expression xor and_expression
        let expr = this._and_expression();
        while (this._match(TokenTypes.tokens.xor)) {
            expr = new AST.BinaryOperator(this._previous().toString(), expr, this._and_expression());
        }
        return expr;
    }
    _and_expression() {
        // equality_expression
        // and_expression and equality_expression
        let expr = this._equality_expression();
        while (this._match(TokenTypes.tokens.and)) {
            expr = new AST.BinaryOperator(this._previous().toString(), expr, this._equality_expression());
        }
        return expr;
    }
    _equality_expression() {
        // relational_expression
        // relational_expression equal_equal relational_expression
        // relational_expression not_equal relational_expression
        const expr = this._relational_expression();
        if (this._match([TokenTypes.tokens.equal_equal, TokenTypes.tokens.not_equal])) {
            return new AST.BinaryOperator(this._previous().toString(), expr, this._relational_expression());
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
        while (this._match([
            TokenTypes.tokens.less_than,
            TokenTypes.tokens.greater_than,
            TokenTypes.tokens.less_than_equal,
            TokenTypes.tokens.greater_than_equal,
        ])) {
            expr = new AST.BinaryOperator(this._previous().toString(), expr, this._shift_expression());
        }
        return expr;
    }
    _shift_expression() {
        // additive_expression
        // shift_expression shift_left additive_expression
        // shift_expression shift_right additive_expression
        let expr = this._additive_expression();
        while (this._match([TokenTypes.tokens.shift_left, TokenTypes.tokens.shift_right])) {
            expr = new AST.BinaryOperator(this._previous().toString(), expr, this._additive_expression());
        }
        return expr;
    }
    _additive_expression() {
        // multiplicative_expression
        // additive_expression plus multiplicative_expression
        // additive_expression minus multiplicative_expression
        let expr = this._multiplicative_expression();
        while (this._match([TokenTypes.tokens.plus, TokenTypes.tokens.minus])) {
            expr = new AST.BinaryOperator(this._previous().toString(), expr, this._multiplicative_expression());
        }
        return expr;
    }
    _multiplicative_expression() {
        // unary_expression
        // multiplicative_expression star unary_expression
        // multiplicative_expression forward_slash unary_expression
        // multiplicative_expression modulo unary_expression
        let expr = this._unary_expression();
        while (this._match([
            TokenTypes.tokens.star,
            TokenTypes.tokens.forward_slash,
            TokenTypes.tokens.modulo,
        ])) {
            expr = new AST.BinaryOperator(this._previous().toString(), expr, this._unary_expression());
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
        if (this._match([
            TokenTypes.tokens.minus,
            TokenTypes.tokens.bang,
            TokenTypes.tokens.tilde,
            TokenTypes.tokens.star,
            TokenTypes.tokens.and,
        ])) {
            return new AST.UnaryOperator(this._previous().toString(), this._unary_expression());
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
        if (this._match(TokenTypes.tokens.bracket_left)) {
            const expr = this._short_circuit_or_expression();
            this._consume(TokenTypes.tokens.bracket_right, "Expected ']'.");
            const p = this._postfix_expression();
            if (p)
                expr.postfix = p;
            return expr;
        }
        // period ident postfix_expression?
        if (this._match(TokenTypes.tokens.period)) {
            const name = this._consume(TokenTypes.tokens.ident, "Expected member name.");
            const p = this._postfix_expression();
            const expr = new AST.StringExpr(name.lexeme);
            if (p)
                expr.postfix = p;
            return expr;
        }
        return null;
    }
    _getStruct(name) {
        if (this._context.aliases.has(name)) {
            const alias = this._context.aliases.get(name).type;
            return alias;
        }
        if (this._context.structs.has(name)) {
            const struct = this._context.structs.get(name);
            return struct;
        }
        return null;
    }
    _primary_expression() {
        // ident argument_expression_list?
        if (this._match(TokenTypes.tokens.ident)) {
            const name = this._previous().toString();
            if (this._check(TokenTypes.tokens.paren_left)) {
                const args = this._argument_expression_list();
                const struct = this._getStruct(name);
                if (struct != null) {
                    return new AST.CreateExpr(struct, args);
                }
                return new AST.CallExpr(name, args);
            }
            if (this._context.constants.has(name)) {
                const c = this._context.constants.get(name);
                return new AST.ConstExpr(name, c.value);
            }
            return new AST.VariableExpr(name);
        }
        // const_literal
        if (this._match(TokenTypes.const_literal)) {
            return new AST.LiteralExpr(parseFloat(this._previous().toString()));
        }
        // paren_expression
        if (this._check(TokenTypes.tokens.paren_left)) {
            return this._paren_expression();
        }
        // bitcast less_than type_decl greater_than paren_expression
        if (this._match(TokenTypes.keywords.bitcast)) {
            this._consume(TokenTypes.tokens.less_than, "Expected '<'.");
            const type = this._type_decl();
            this._consume(TokenTypes.tokens.greater_than, "Expected '>'.");
            const value = this._paren_expression();
            return new AST.BitcastExpr(type, value);
        }
        // type_decl argument_expression_list
        const type = this._type_decl();
        const args = this._argument_expression_list();
        return new AST.TypecastExpr(type, args);
    }
    _argument_expression_list() {
        // paren_left ((short_circuit_or_expression comma)* short_circuit_or_expression comma?)? paren_right
        if (!this._match(TokenTypes.tokens.paren_left)) {
            return null;
        }
        const args = [];
        do {
            if (this._check(TokenTypes.tokens.paren_right)) {
                break;
            }
            const arg = this._short_circuit_or_expression();
            args.push(arg);
        } while (this._match(TokenTypes.tokens.comma));
        this._consume(TokenTypes.tokens.paren_right, "Expected ')' for agument list");
        return args;
    }
    _optional_paren_expression() {
        // [paren_left] short_circuit_or_expression [paren_right]
        this._match(TokenTypes.tokens.paren_left);
        const expr = this._short_circuit_or_expression();
        this._match(TokenTypes.tokens.paren_right);
        return new AST.GroupingExpr([expr]);
    }
    _paren_expression() {
        // paren_left short_circuit_or_expression paren_right
        this._consume(TokenTypes.tokens.paren_left, "Expected '('.");
        const expr = this._short_circuit_or_expression();
        this._consume(TokenTypes.tokens.paren_right, "Expected ')'.");
        return new AST.GroupingExpr([expr]);
    }
    _struct_decl() {
        // attribute* struct ident struct_body_decl
        if (!this._match(TokenTypes.keywords.struct)) {
            return null;
        }
        const name = this._consume(TokenTypes.tokens.ident, "Expected name for struct.").toString();
        // struct_body_decl: brace_left (struct_member comma)* struct_member comma? brace_right
        this._consume(TokenTypes.tokens.brace_left, "Expected '{' for struct body.");
        const members = [];
        while (!this._check(TokenTypes.tokens.brace_right)) {
            // struct_member: attribute* variable_ident_decl
            const memberAttrs = this._attribute();
            const memberName = this._consume(TokenTypes.tokens.ident, "Expected variable name.").toString();
            this._consume(TokenTypes.tokens.colon, "Expected ':' for struct member type.");
            const typeAttrs = this._attribute();
            const memberType = this._type_decl();
            if (memberType != null) {
                memberType.attributes = typeAttrs;
            }
            if (!this._check(TokenTypes.tokens.brace_right))
                this._consume(TokenTypes.tokens.comma, "Expected ',' for struct member.");
            else
                this._match(TokenTypes.tokens.comma); // trailing comma optional.
            members.push(new AST.Member(memberName, memberType, memberAttrs));
        }
        this._consume(TokenTypes.tokens.brace_right, "Expected '}' after struct body.");
        const structNode = new AST.Struct(name, members);
        this._context.structs.set(name, structNode);
        return structNode;
    }
    _global_variable_decl() {
        // attribute* variable_decl (equal const_expression)?
        const _var = this._variable_decl();
        if (_var && this._match(TokenTypes.tokens.equal)) {
            _var.value = this._const_expression();
        }
        return _var;
    }
    _override_variable_decl() {
        // attribute* override_decl (equal const_expression)?
        const _override = this._override_decl();
        if (_override && this._match(TokenTypes.tokens.equal)) {
            _override.value = this._const_expression();
        }
        return _override;
    }
    _global_const_decl() {
        // attribute* const (ident variable_ident_decl) global_const_initializer?
        if (!this._match(TokenTypes.keywords.const)) {
            return null;
        }
        const name = this._consume(TokenTypes.tokens.ident, "Expected variable name");
        let type = null;
        if (this._match(TokenTypes.tokens.colon)) {
            const attrs = this._attribute();
            type = this._type_decl();
            if (type != null) {
                type.attributes = attrs;
            }
        }
        let value = null;
        if (this._match(TokenTypes.tokens.equal)) {
            const valueExpr = this._short_circuit_or_expression();
            if (valueExpr instanceof AST.CreateExpr) {
                value = valueExpr;
            }
            else if (valueExpr instanceof AST.ConstExpr &&
                valueExpr.initializer instanceof AST.CreateExpr) {
                value = valueExpr.initializer;
            }
            else {
                try {
                    const constValue = valueExpr.evaluate(this._context);
                    value = new AST.LiteralExpr(constValue);
                }
                catch (_a) {
                    value = valueExpr;
                }
            }
        }
        const c = new AST.Const(name.toString(), type, "", "", value);
        this._context.constants.set(c.name, c);
        return c;
    }
    _global_let_decl() {
        // attribute* let (ident variable_ident_decl) global_const_initializer?
        if (!this._match(TokenTypes.keywords.let)) {
            return null;
        }
        const name = this._consume(TokenTypes.tokens.ident, "Expected variable name");
        let type = null;
        if (this._match(TokenTypes.tokens.colon)) {
            const attrs = this._attribute();
            type = this._type_decl();
            if (type != null) {
                type.attributes = attrs;
            }
        }
        let value = null;
        if (this._match(TokenTypes.tokens.equal)) {
            value = this._const_expression();
        }
        return new AST.Let(name.toString(), type, "", "", value);
    }
    _const_expression() {
        // type_decl paren_left ((const_expression comma)* const_expression comma?)? paren_right
        // const_literal
        if (this._match(TokenTypes.const_literal)) {
            return new AST.StringExpr(this._previous().toString());
        }
        const type = this._type_decl();
        this._consume(TokenTypes.tokens.paren_left, "Expected '('.");
        let args = [];
        while (!this._check(TokenTypes.tokens.paren_right)) {
            args.push(this._const_expression());
            if (!this._check(TokenTypes.tokens.comma)) {
                break;
            }
            this._advance();
        }
        this._consume(TokenTypes.tokens.paren_right, "Expected ')'.");
        return new AST.CreateExpr(type, args);
    }
    _variable_decl() {
        // var variable_qualifier? (ident variable_ident_decl)
        if (!this._match(TokenTypes.keywords.var)) {
            return null;
        }
        // variable_qualifier: less_than storage_class (comma access_mode)? greater_than
        let storage = "";
        let access = "";
        if (this._match(TokenTypes.tokens.less_than)) {
            storage = this._consume(TokenTypes.storage_class, "Expected storage_class.").toString();
            if (this._match(TokenTypes.tokens.comma))
                access = this._consume(TokenTypes.access_mode, "Expected access_mode.").toString();
            this._consume(TokenTypes.tokens.greater_than, "Expected '>'.");
        }
        const name = this._consume(TokenTypes.tokens.ident, "Expected variable name");
        let type = null;
        if (this._match(TokenTypes.tokens.colon)) {
            const attrs = this._attribute();
            type = this._type_decl();
            if (type != null) {
                type.attributes = attrs;
            }
        }
        return new AST.Var(name.toString(), type, storage, access, null);
    }
    _override_decl() {
        // override (ident variable_ident_decl)
        if (!this._match(TokenTypes.keywords.override)) {
            return null;
        }
        const name = this._consume(TokenTypes.tokens.ident, "Expected variable name");
        let type = null;
        if (this._match(TokenTypes.tokens.colon)) {
            const attrs = this._attribute();
            type = this._type_decl();
            if (type != null) {
                type.attributes = attrs;
            }
        }
        return new AST.Override(name.toString(), type, null);
    }
    _diagnostic() {
        // diagnostic(severity_control_name, diagnostic_rule_name)
        this._consume(TokenTypes.tokens.paren_left, "Expected '('");
        const severity = this._consume(TokenTypes.tokens.ident, "Expected severity control name.");
        this._consume(TokenTypes.tokens.comma, "Expected ','");
        const rule = this._consume(TokenTypes.tokens.ident, "Expected diagnostic rule name.");
        this._consume(TokenTypes.tokens.paren_right, "Expected ')'");
        return new AST.Diagnostic(severity.toString(), rule.toString());
    }
    _enable_directive() {
        // enable ident semicolon
        const name = this._consume(TokenTypes.tokens.ident, "identity expected.");
        return new AST.Enable(name.toString());
    }
    _type_alias() {
        // type ident equal type_decl
        const name = this._consume(TokenTypes.tokens.ident, "identity expected.");
        this._consume(TokenTypes.tokens.equal, "Expected '=' for type alias.");
        let aliasType = this._type_decl();
        if (aliasType === null) {
            throw this._error(this._peek(), "Expected Type for Alias.");
        }
        if (this._context.aliases.has(aliasType.name)) {
            aliasType = this._context.aliases.get(aliasType.name).type;
        }
        const aliasNode = new AST.Alias(name.toString(), aliasType);
        this._context.aliases.set(aliasNode.name, aliasNode);
        return aliasNode;
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
        if (this._check([
            TokenTypes.tokens.ident,
            ...TokenTypes.texel_format,
            TokenTypes.keywords.bool,
            TokenTypes.keywords.f32,
            TokenTypes.keywords.i32,
            TokenTypes.keywords.u32,
        ])) {
            const type = this._advance();
            const typeName = type.toString();
            if (this._context.structs.has(typeName)) {
                return this._context.structs.get(typeName);
            }
            if (this._context.aliases.has(typeName)) {
                return this._context.aliases.get(typeName).type;
            }
            return new AST.Type(type.toString());
        }
        // texture_sampler_types
        let type = this._texture_sampler_types();
        if (type) {
            return type;
        }
        if (this._check(TokenTypes.template_types)) {
            let type = this._advance().toString();
            let format = null;
            let access = null;
            if (this._match(TokenTypes.tokens.less_than)) {
                format = this._type_decl();
                access = null;
                if (this._match(TokenTypes.tokens.comma)) {
                    access = this._consume(TokenTypes.access_mode, "Expected access_mode for pointer").toString();
                }
                this._consume(TokenTypes.tokens.greater_than, "Expected '>' for type.");
            }
            return new AST.TemplateType(type, format, access);
        }
        // pointer less_than storage_class comma type_decl (comma access_mode)? greater_than
        if (this._match(TokenTypes.keywords.ptr)) {
            let pointer = this._previous().toString();
            this._consume(TokenTypes.tokens.less_than, "Expected '<' for pointer.");
            const storage = this._consume(TokenTypes.storage_class, "Expected storage_class for pointer");
            this._consume(TokenTypes.tokens.comma, "Expected ',' for pointer.");
            const decl = this._type_decl();
            let access = null;
            if (this._match(TokenTypes.tokens.comma)) {
                access = this._consume(TokenTypes.access_mode, "Expected access_mode for pointer").toString();
            }
            this._consume(TokenTypes.tokens.greater_than, "Expected '>' for pointer.");
            return new AST.PointerType(pointer, storage.toString(), decl, access);
        }
        // The following type_decl's have an optional attribyte_list*
        const attrs = this._attribute();
        // attribute* array
        // attribute* array less_than type_decl (comma element_count_expression)? greater_than
        if (this._match(TokenTypes.keywords.array)) {
            let format = null;
            let countInt = -1;
            const array = this._previous();
            let countNode = null;
            if (this._match(TokenTypes.tokens.less_than)) {
                format = this._type_decl();
                if (this._context.aliases.has(format.name)) {
                    format = this._context.aliases.get(format.name).type;
                }
                let count = "";
                if (this._match(TokenTypes.tokens.comma)) {
                    countNode = this._shift_expression();
                    // If we can't evaluate the node, defer evaluating it until after the shader has
                    // finished being parsed, because const statements can be declared **after** they
                    // are used.
                    try {
                        count = countNode.evaluate(this._context).toString();
                        countNode = null;
                    }
                    catch (e) {
                        count = "1";
                    }
                }
                this._consume(TokenTypes.tokens.greater_than, "Expected '>' for array.");
                countInt = count ? parseInt(count) : 0;
            }
            const arrayType = new AST.ArrayType(array.toString(), attrs, format, countInt);
            if (countNode) {
                this._deferArrayCountEval.push({ arrayType, countNode });
            }
            return arrayType;
        }
        return null;
    }
    _texture_sampler_types() {
        // sampler_type
        if (this._match(TokenTypes.sampler_type)) {
            return new AST.SamplerType(this._previous().toString(), null, null);
        }
        // depth_texture_type
        if (this._match(TokenTypes.depth_texture_type)) {
            return new AST.SamplerType(this._previous().toString(), null, null);
        }
        // sampled_texture_type less_than type_decl greater_than
        // multisampled_texture_type less_than type_decl greater_than
        if (this._match(TokenTypes.sampled_texture_type) ||
            this._match(TokenTypes.multisampled_texture_type)) {
            const sampler = this._previous();
            this._consume(TokenTypes.tokens.less_than, "Expected '<' for sampler type.");
            const format = this._type_decl();
            this._consume(TokenTypes.tokens.greater_than, "Expected '>' for sampler type.");
            return new AST.SamplerType(sampler.toString(), format, null);
        }
        // storage_texture_type less_than texel_format comma access_mode greater_than
        if (this._match(TokenTypes.storage_texture_type)) {
            const sampler = this._previous();
            this._consume(TokenTypes.tokens.less_than, "Expected '<' for sampler type.");
            const format = this._consume(TokenTypes.texel_format, "Invalid texel format.").toString();
            this._consume(TokenTypes.tokens.comma, "Expected ',' after texel format.");
            const access = this._consume(TokenTypes.access_mode, "Expected access mode for storage texture type.").toString();
            this._consume(TokenTypes.tokens.greater_than, "Expected '>' for sampler type.");
            return new AST.SamplerType(sampler.toString(), format, access);
        }
        return null;
    }
    _attribute() {
        // attr ident paren_left (literal_or_ident comma)* literal_or_ident paren_right
        // attr ident
        let attributes = [];
        while (this._match(TokenTypes.tokens.attr)) {
            const name = this._consume(TokenTypes.attribute_name, "Expected attribute name");
            const attr = new AST.Attribute(name.toString(), null);
            if (this._match(TokenTypes.tokens.paren_left)) {
                // literal_or_ident
                attr.value = this._consume(TokenTypes.literal_or_ident, "Expected attribute value").toString();
                if (this._check(TokenTypes.tokens.comma)) {
                    this._advance();
                    do {
                        const v = this._consume(TokenTypes.literal_or_ident, "Expected attribute value").toString();
                        if (!(attr.value instanceof Array)) {
                            attr.value = [attr.value];
                        }
                        attr.value.push(v);
                    } while (this._match(TokenTypes.tokens.comma));
                }
                this._consume(TokenTypes.tokens.paren_right, "Expected ')'");
            }
            attributes.push(attr);
        }
        // Deprecated:
        // attr_left (attribute comma)* attribute attr_right
        while (this._match(TokenTypes.tokens.attr_left)) {
            if (!this._check(TokenTypes.tokens.attr_right)) {
                do {
                    const name = this._consume(TokenTypes.attribute_name, "Expected attribute name");
                    const attr = new AST.Attribute(name.toString(), null);
                    if (this._match(TokenTypes.tokens.paren_left)) {
                        // literal_or_ident
                        attr.value = [
                            this._consume(TokenTypes.literal_or_ident, "Expected attribute value").toString(),
                        ];
                        if (this._check(TokenTypes.tokens.comma)) {
                            this._advance();
                            do {
                                const v = this._consume(TokenTypes.literal_or_ident, "Expected attribute value").toString();
                                attr.value.push(v);
                            } while (this._match(TokenTypes.tokens.comma));
                        }
                        this._consume(TokenTypes.tokens.paren_right, "Expected ')'");
                    }
                    attributes.push(attr);
                } while (this._match(TokenTypes.tokens.comma));
            }
            // Consume ]]
            this._consume(TokenTypes.tokens.attr_right, "Expected ']]' after attribute declarations");
        }
        if (attributes.length == 0) {
            return null;
        }
        return attributes;
    }
}
//# sourceMappingURL=wgsl_parser.js.map