/**
 * @author Brendan Duncan / https://github.com/brendan-duncan
 */
import { WgslScanner, Token, TokenType, TokenTypes } from "./wgsl_scanner.js";
import * as AST from "./wgsl_ast.js";
import { WgslExec } from "./wgsl_exec.js";
import { TemplateInfo } from "./reflect/info.js";

/// Parse a sequence of tokens from the WgslScanner into an Abstract Syntax Tree (AST).
export class WgslParser {
  _tokens: Token[] = [];
  _current: number = 0;
  _currentLine: number = 0;
  _deferArrayCountEval: Object[] = [];
  _currentLoop: AST.Statement[] = [];
  _context = new AST.ParseContext();
  _exec = new WgslExec();

  parse(tokensOrCode: Token[] | string): AST.Statement[] {
    this._initialize(tokensOrCode);

    this._deferArrayCountEval.length = 0;

    const statements: AST.Statement[] = [];
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
          const variable = countNode as AST.VariableExpr;
          const name = variable.name;
          //const constant = this._exec.getVariableValue(name);
          //arrayType.count = constant as number;
          const constant = this._context.constants.get(name);
          if (constant) {
            try {
              const count = constant.constEvaluate(this._exec);
              arrayType.count = count;
            } catch (e) {
            }
          }
        }
      }
      this._deferArrayCountEval.length = 0;
    }

    return statements;
  }

  _initialize(tokensOrCode: Token[] | string) {
    if (tokensOrCode) {
      if (typeof tokensOrCode == "string") {
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

  _updateNode<T extends AST.Node>(n: T, l?: number): T {
    n.line = l ?? this._currentLine;
    return n;
  }

  _error(token: Token, message: string | null): Object {
    return {
      token,
      message,
      toString: function () {
        return `${message}`;
      },
    };
  }

  _isAtEnd(): boolean {
    return (
      this._current >= this._tokens.length ||
      this._peek().type == TokenTypes.eof
    );
  }

  _match(types: TokenType | TokenType[]): boolean {
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

  _consume(types: TokenType | TokenType[], message: string | null): Token {
    if (this._check(types)) {
      return this._advance();
    }
    throw this._error(this._peek(), `${message}. Line:${this._currentLine}`);
  }

  _check(types: TokenType | TokenType[]): boolean {
    if (this._isAtEnd()) {
      return false;
    }
    const tk = this._peek();
    if (types instanceof Array) {
      const t = tk.type;
      let hasNameType = false;
      for (const type of types) {
        if (t === type) {
          return true;
        }
        if (type === TokenTypes.tokens.name) {
          hasNameType =  true;
        }
      }
      if (hasNameType) {
        // ident can include any of the other keywords, so special case it.
        const match = (TokenTypes.tokens.name.rule as RegExp).exec(tk.lexeme);
        if (match && match.index == 0 && match[0] == tk.lexeme) {
          return true;
        }
      }
      return false;
    }

    if (tk.type === types) {
      return true;
    }

    // ident can include any of the other keywords, so special case it.
    if (types === TokenTypes.tokens.name) {
      const match = (TokenTypes.tokens.name.rule as RegExp).exec(tk.lexeme);
      return match && match.index == 0 && match[0] == tk.lexeme;
    }

    return false;
  }

  _advance(): Token {
    this._currentLine = this._peek()?.line ?? -1;
    if (!this._isAtEnd()) {
      this._current++;
    }
    return this._previous();
  }

  _peek(): Token {
    return this._tokens[this._current];
  }

  _previous(): Token {
    return this._tokens[this._current - 1];
  }

  _global_decl_or_directive(): AST.Statement | null {
    // semicolon
    // global_variable_decl semicolon
    // global_constant_decl semicolon
    // type_alias semicolon
    // struct_decl
    // function_decl
    // enable_directive

    // Ignore any stand-alone semicolons
    while (this._match(TokenTypes.tokens.semicolon) && !this._isAtEnd());

    if (this._match(TokenTypes.keywords.alias)) {
      const type = this._type_alias();
      this._consume(TokenTypes.tokens.semicolon, "Expected ';'");
      this._exec.reflection.updateAST([type]);
      return type;
    }

    if (this._match(TokenTypes.keywords.diagnostic)) {
      const directive = this._diagnostic();
      this._consume(TokenTypes.tokens.semicolon, "Expected ';'");
      this._exec.reflection.updateAST([directive]);
      return directive;
    }

    if (this._match(TokenTypes.keywords.requires)) {
      const requires = this._requires_directive();
      this._consume(TokenTypes.tokens.semicolon, "Expected ';'");
      this._exec.reflection.updateAST([requires]);
      return requires;
    }

    if (this._match(TokenTypes.keywords.enable)) {
      const enable = this._enable_directive();
      this._consume(TokenTypes.tokens.semicolon, "Expected ';'");
      this._exec.reflection.updateAST([enable]);
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
      this._exec.reflection.updateAST([_var]);
      return _var;
    }

    if (this._check(TokenTypes.keywords.override)) {
      const _override = this._override_variable_decl();
      if (_override != null) {
        _override.attributes = attrs;
      }
      this._consume(TokenTypes.tokens.semicolon, "Expected ';'.");
      this._exec.reflection.updateAST([_override]);
      return _override;
    }

    if (this._check(TokenTypes.keywords.let)) {
      const _let = this._global_let_decl();
      if (_let != null) {
        _let.attributes = attrs;
      }
      this._consume(TokenTypes.tokens.semicolon, "Expected ';'.");
      this._exec.reflection.updateAST([_let]);
      return _let;
    }

    if (this._check(TokenTypes.keywords.const)) {
      const _const = this._global_const_decl();
      if (_const != null) {
        _const.attributes = attrs;
      }
      this._consume(TokenTypes.tokens.semicolon, "Expected ';'.");
      this._exec.reflection.updateAST([_const]);
      return _const;
    }

    if (this._check(TokenTypes.keywords.struct)) {
      const _struct = this._struct_decl();
      if (_struct != null) {
        _struct.attributes = attrs;
      }
      this._exec.reflection.updateAST([_struct]);
      return _struct;
    }

    if (this._check(TokenTypes.keywords.fn)) {
      const _fn = this._function_decl();
      if (_fn != null) {
        _fn.attributes = attrs;
      }
      this._exec.reflection.updateAST([_fn]);
      return _fn;
    }

    return null;
  }

  _function_decl(): AST.Function | null {
    // attribute* function_header compound_statement
    // function_header: fn ident paren_left param_list? paren_right (arrow attribute* type_decl)?
    if (!this._match(TokenTypes.keywords.fn)) {
      return null;
    }

    const startLine = this._currentLine;

    const name = this._consume(
      TokenTypes.tokens.ident,
      "Expected function name."
    ).toString();

    this._consume(
      TokenTypes.tokens.paren_left,
      "Expected '(' for function arguments."
    );

    const args: AST.Argument[] = [];
    if (!this._check(TokenTypes.tokens.paren_right)) {
      do {
        if (this._check(TokenTypes.tokens.paren_right)) {
          break;
        }
        const argAttrs = this._attribute();

        const name = this._consume(
          TokenTypes.tokens.name,
          "Expected argument name."
        ).toString();

        this._consume(
          TokenTypes.tokens.colon,
          "Expected ':' for argument type."
        );

        const typeAttrs = this._attribute();
        const type = this._type_decl();
        if (type != null) {
          type.attributes = typeAttrs;

          args.push(this._updateNode(new AST.Argument(name, type, argAttrs)));
        }
      } while (this._match(TokenTypes.tokens.comma));
    }

    this._consume(
      TokenTypes.tokens.paren_right,
      "Expected ')' after function arguments."
    );

    let _return: AST.Type | null = null;
    if (this._match(TokenTypes.tokens.arrow)) {
      const attrs = this._attribute();
      _return = this._type_decl();
      if (_return != null) {
        _return.attributes = attrs;
      }
    }

    const body = this._compound_statement();

    const endLine = this._currentLine;

    return this._updateNode(new AST.Function(name, args, _return, body, startLine, endLine), startLine);
  }

  _compound_statement(): AST.Statement[] {
    // brace_left statement* brace_right
    const statements: AST.Statement[] = [];

    this._consume(TokenTypes.tokens.brace_left, "Expected '{' for block.");
    while (!this._check(TokenTypes.tokens.brace_right)) {
      const statement = this._statement();
      if (statement !== null) {
        statements.push(statement as AST.Statement);
      }
    }
    this._consume(TokenTypes.tokens.brace_right, "Expected '}' for block.");

    return statements;
  }

  _statement(): AST.Statement | AST.Statement[] | null {
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
    while (this._match(TokenTypes.tokens.semicolon) && !this._isAtEnd());

    let attributes = null;
    if (this._check(TokenTypes.tokens.attr)) {
      attributes = this._attribute();
    }

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

    let result: AST.Statement | null = null;
    if (this._check(TokenTypes.keywords.return)) {
      result = this._return_statement();
    } else if (
      this._check([
        TokenTypes.keywords.var,
        TokenTypes.keywords.let,
        TokenTypes.keywords.const,
      ])
    ) {
      result = this._variable_statement();
    } else if (this._match(TokenTypes.keywords.discard)) {
      result = this._updateNode(new AST.Discard());
    } else if (this._match(TokenTypes.keywords.break)) {
      const breakStmt = this._updateNode(new AST.Break());
      if (this._currentLoop.length > 0) {
        const loop = this._currentLoop[this._currentLoop.length - 1];
        breakStmt.loopId = loop.id;
      } else {
        // This break statement is not inside a loop.
        //throw this._error(this._peek(), `Break statement must be inside a loop. Line: ${breakStmt.line}`);
      }
      result = breakStmt;
      if (this._check(TokenTypes.keywords.if)) {
        // break-if
        this._advance();
        breakStmt.condition = this._optional_paren_expression();
        if (breakStmt.condition instanceof AST.GroupingExpr && breakStmt.condition.contents.length === 1) {
          breakStmt.condition = breakStmt.condition.contents[0];
        }
      }
    } else if (this._match(TokenTypes.keywords.continue)) {
      const continueStmt = this._updateNode(new AST.Continue());
      if (this._currentLoop.length > 0) {
        const loop = this._currentLoop[this._currentLoop.length - 1];
        continueStmt.loopId = loop.id;
      } else {
        // This continue statement is not inside a loop.
        throw this._error(this._peek(), `Continue statement must be inside a loop. Line: ${continueStmt.line}`);
      }
      result = continueStmt;
    } else {
      result =
        this._increment_decrement_statement() ||
        this._func_call_statement() ||
        this._assignment_statement();
    }

    if (result != null) {
      this._consume(
        TokenTypes.tokens.semicolon,
        "Expected ';' after statement."
      );
    }

    return result;
  }

  _static_assert_statement(): AST.StaticAssert | null {
    if (!this._match(TokenTypes.keywords.static_assert)) {
      return null;
    }
    const expression = this._optional_paren_expression();
    return this._updateNode(new AST.StaticAssert(expression));
  }

  _while_statement(): AST.While | null {
    if (!this._match(TokenTypes.keywords.while)) {
      return null;
    }

    const whileLoop = this._updateNode(new AST.While(null, null));
    this._currentLoop.push(whileLoop);

    whileLoop.condition = this._optional_paren_expression();

    let attributes = null;
    if (this._check(TokenTypes.tokens.attr)) {
      attributes = this._attribute();
    }

    whileLoop.body = this._compound_statement();

    this._currentLoop.pop();

    return whileLoop;
  }

  _continuing_statement(): AST.Continuing | null {
    if (!this._match(TokenTypes.keywords.continuing)) {
      return null;
    }
    const block = this._compound_statement();
    return this._updateNode(new AST.Continuing(block));
  }

  _for_statement(): AST.For | null {
    // for paren_left for_header paren_right compound_statement
    if (!this._match(TokenTypes.keywords.for)) {
      return null;
    }

    this._consume(TokenTypes.tokens.paren_left, "Expected '('.");

    const forLoop = this._updateNode(new AST.For(null, null, null, null));

    this._currentLoop.push(forLoop);

    // for_header: (variable_statement assignment_statement func_call_statement)? semicolon short_circuit_or_expression? semicolon (assignment_statement func_call_statement)?
    forLoop.init = !this._check(TokenTypes.tokens.semicolon)
      ? this._for_init()
      : null;
    this._consume(TokenTypes.tokens.semicolon, "Expected ';'.");
    forLoop.condition = !this._check(TokenTypes.tokens.semicolon)
      ? this._short_circuit_or_expression()
      : null;
    this._consume(TokenTypes.tokens.semicolon, "Expected ';'.");
    forLoop.increment = !this._check(TokenTypes.tokens.paren_right)
      ? this._for_increment()
      : null;

    this._consume(TokenTypes.tokens.paren_right, "Expected ')'.");

    let attributes = null;
    if (this._check(TokenTypes.tokens.attr)) {
      attributes = this._attribute();
    }

    forLoop.body = this._compound_statement();

    this._currentLoop.pop();

    return forLoop;
  }

  _for_init(): AST.Statement | null {
    // (variable_statement assignment_statement func_call_statement)?
    return (
      this._variable_statement() ||
      this._func_call_statement() ||
      this._assignment_statement()
    );
  }

  _for_increment(): AST.Statement | null {
    // (assignment_statement func_call_statement increment_statement)?
    return (
      this._func_call_statement() ||
      this._increment_decrement_statement() ||
      this._assignment_statement()
    );
  }

  _variable_statement(): AST.Var | AST.Let | AST.Const | null {
    // variable_decl
    // variable_decl equal short_circuit_or_expression
    // let (ident variable_ident_decl) equal short_circuit_or_expression
    // const (ident variable_ident_decl) equal short_circuit_or_expression
    if (this._check(TokenTypes.keywords.var)) {
      const _var = this._variable_decl();
      if (_var === null) {
        throw this._error(this._peek(), "Variable declaration expected.");
      }
      let value: AST.Expression | null = null;
      if (this._match(TokenTypes.tokens.equal)) {
        value = this._short_circuit_or_expression();
      }

      return this._updateNode(new AST.Var(
        _var.name,
        _var.type,
        _var.storage,
        _var.access,
        value
      ));
    }

    if (this._match(TokenTypes.keywords.let)) {
      const name = this._consume(
        TokenTypes.tokens.name,
        "Expected name for let."
      ).toString();
      let type: AST.Type | null = null;
      if (this._match(TokenTypes.tokens.colon)) {
        const typeAttrs = this._attribute();
        type = this._type_decl();
        if (type != null) {
          type.attributes = typeAttrs;
        }
      }
      this._consume(TokenTypes.tokens.equal, "Expected '=' for let.");
      const value = this._short_circuit_or_expression();
      return this._updateNode(new AST.Let(name, type, null, null, value));
    }

    if (this._match(TokenTypes.keywords.const)) {
      const name = this._consume(
        TokenTypes.tokens.name,
        "Expected name for const."
      ).toString();
      let type: AST.Type | null = null;
      if (this._match(TokenTypes.tokens.colon)) {
        const typeAttrs = this._attribute();
        type = this._type_decl();
        if (type != null) {
          type.attributes = typeAttrs;
        }
      }
      this._consume(TokenTypes.tokens.equal, "Expected '=' for const.");
      const value = this._short_circuit_or_expression();
      if (type === null && value instanceof AST.LiteralExpr) {
        type = value.type;
      }
      return this._updateNode(new AST.Const(name, type, null, null, value));
    }

    return null;
  }

  _increment_decrement_statement(): AST.Statement | null {
    const savedPos = this._current;

    const _var = this._unary_expression();
    if (_var == null) {
      return null;
    }

    if (!this._check(TokenTypes.increment_operators)) {
      this._current = savedPos;
      return null;
    }

    const token = this._consume(
      TokenTypes.increment_operators,
      "Expected increment operator"
    );

    return this._updateNode(new AST.Increment(
      token.type === TokenTypes.tokens.plus_plus
        ? AST.IncrementOperator.increment
        : AST.IncrementOperator.decrement,
      _var
    ));
  }

  _assignment_statement(): AST.Assign | null {
    // (unary_expression underscore) equal short_circuit_or_expression
    let _var: AST.Expression | null = null;

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

    const type = this._consume(
      TokenTypes.assignment_operators,
      "Expected assignment operator."
    );

    const value = this._short_circuit_or_expression();

    return this._updateNode(new AST.Assign(
      AST.AssignOperator.parse(type.lexeme),
      _var as AST.Expression,
      value
    ));
  }

  _func_call_statement(): AST.Call | null {
    // ident argument_expression_list
    if (!this._check(TokenTypes.tokens.ident)) {
      return null;
    }

    const savedPos = this._current;
    const name = this._consume(
      TokenTypes.tokens.ident,
      "Expected function name."
    );
    const args = this._argument_expression_list();

    if (args === null) {
      this._current = savedPos;
      return null;
    }

    return this._updateNode(new AST.Call(name.lexeme, args));
  }

  _loop_statement(): AST.Loop | null {
    // loop brace_left statement* continuing_statement? brace_right
    if (!this._match(TokenTypes.keywords.loop)) {
      return null;
    }

    let attributes = null;
    if (this._check(TokenTypes.tokens.attr)) {
      attributes = this._attribute();
    }

    this._consume(TokenTypes.tokens.brace_left, "Expected '{' for loop.");

    const loop = this._updateNode(new AST.Loop([], null));
    this._currentLoop.push(loop);

    // statement*
    let statement = this._statement();
    while (statement !== null) {
      if (Array.isArray(statement)) {
        for (let s of statement) {
          loop.body.push(s);
        }
      } else {
        loop.body.push(statement);
      }
      // Keep continuing in the loop body statements so it can be
      // executed in the stackframe of the body statements.
      if (statement instanceof AST.Continuing) {
        loop.continuing = statement;
        // Continuing should be the last statement in the loop.
        break;
      }
      statement = this._statement();
    }

    this._currentLoop.pop();

    this._consume(TokenTypes.tokens.brace_right, "Expected '}' for loop.");

    return loop;
  }

  _switch_statement(): AST.Switch | null {
    // switch optional_paren_expression brace_left switch_body+ brace_right
    if (!this._match(TokenTypes.keywords.switch)) {
      return null;
    }

    const switchStmt = this._updateNode(new AST.Switch(null, []));

    this._currentLoop.push(switchStmt);

    switchStmt.condition = this._optional_paren_expression();

    let attributes = null;
    if (this._check(TokenTypes.tokens.attr)) {
      attributes = this._attribute();
    }

    this._consume(TokenTypes.tokens.brace_left, "Expected '{' for switch.");
    switchStmt.body = this._switch_body();
    if (switchStmt.body == null || switchStmt.body.length == 0) {
      throw this._error(this._previous(), "Expected 'case' or 'default'.");
    }
    this._consume(TokenTypes.tokens.brace_right, "Expected '}' for switch.");

    this._currentLoop.pop();

    return switchStmt;
  }

  _switch_body(): AST.Statement[] {
    // case case_selectors optional_colon brace_left case_body? brace_right
    // default optional_colon brace_left case_body? brace_right
    const cases: AST.Statement[] = [];
    
    let hasDefault = false;
    while (this._check([TokenTypes.keywords.default, TokenTypes.keywords.case])) {
      if (this._match(TokenTypes.keywords.case)) {
        const selectors = this._case_selectors();
        for (const selector of selectors) {
          if (selector instanceof AST.DefaultSelector) {
            if (hasDefault) {
              throw this._error(this._previous(), "Multiple default cases in switch statement.");
            }
            hasDefault = true;
            break;
          }
        }

        this._match(TokenTypes.tokens.colon); // colon is optional

        let attributes = null;
        if (this._check(TokenTypes.tokens.attr)) {
          attributes = this._attribute();
        }

        this._consume(
          TokenTypes.tokens.brace_left,
          "Exected '{' for switch case."
        );

        const body = this._case_body();

        this._consume(
          TokenTypes.tokens.brace_right,
          "Exected '}' for switch case."
        );

        cases.push(this._updateNode(new AST.Case(selectors, body)));
      }

      if (this._match(TokenTypes.keywords.default)) {
        if (hasDefault) {
          throw this._error(this._previous(), "Multiple default cases in switch statement.");
        }
        this._match(TokenTypes.tokens.colon); // colon is optional

        let attributes = null;
        if (this._check(TokenTypes.tokens.attr)) {
          attributes = this._attribute();
        }

        this._consume(
          TokenTypes.tokens.brace_left,
          "Exected '{' for switch default."
        );

        const body = this._case_body();

        this._consume(
          TokenTypes.tokens.brace_right,
          "Exected '}' for switch default."
        );

        cases.push(this._updateNode(new AST.Default(body)));
      }
    }

    return cases;
  }

  _case_selectors(): AST.Expression[] {
    // case_selector (comma case_selector)* comma?
    // case_selector: expression | default
    const selectors = [];

    if (this._match(TokenTypes.keywords.default)) {
      selectors.push(this._updateNode(new AST.DefaultSelector()));
    } else {
      selectors.push(this._shift_expression());
    }

    while (this._match(TokenTypes.tokens.comma)) {
      if (this._match(TokenTypes.keywords.default)) {
        selectors.push(this._updateNode(new AST.DefaultSelector()));
      } else {
        selectors.push(this._shift_expression());
      }
    }

    return selectors;
  }

  _case_body(): AST.Statement[] {
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

  _if_statement(): AST.If | null {
    // if optional_paren_expression compound_statement elseif_statement? else_statement?
    if (!this._match(TokenTypes.keywords.if)) {
      return null;
    }

    const line = this._currentLine;

    const condition = this._optional_paren_expression();

    let attributes = null;
    if (this._check(TokenTypes.tokens.attr)) {
      attributes = this._attribute();
    }

    const block = this._compound_statement();

    let elseif: AST.ElseIf[] | null = [];
    if (this._match_elseif()) {
      let attributes = null;
      if (this._check(TokenTypes.tokens.attr)) {
        attributes = this._attribute();
      }
      elseif = this._elseif_statement(elseif);
    }

    let _else: AST.Statement[] | null = null;
    if (this._match(TokenTypes.keywords.else)) {
      let attributes = null;
      if (this._check(TokenTypes.tokens.attr)) {
        attributes = this._attribute();
      }
      _else = this._compound_statement();
    }

    return this._updateNode(new AST.If(condition, block, elseif, _else), line);
  }

  _match_elseif(): boolean {
    if (
      this._tokens[this._current].type === TokenTypes.keywords.else &&
      this._tokens[this._current + 1].type === TokenTypes.keywords.if
    ) {
      this._advance();
      this._advance();

      return true;
    }

    return false;
  }

  _elseif_statement(elseif: AST.ElseIf[] = []): AST.ElseIf[] {
    // else_if optional_paren_expression compound_statement elseif_statement?
    const condition = this._optional_paren_expression();
    const block = this._compound_statement();
    elseif.push(this._updateNode(new AST.ElseIf(condition, block)));
    if (this._match_elseif()) {
      let attributes = null;
      if (this._check(TokenTypes.tokens.attr)) {
        attributes = this._attribute();
      }
      this._elseif_statement(elseif);
    }
    return elseif;
  }

  _return_statement(): AST.Return | null {
    // return short_circuit_or_expression?
    if (!this._match(TokenTypes.keywords.return)) {
      return null;
    }
    const value = this._short_circuit_or_expression();
    return this._updateNode(new AST.Return(value));
  }

  _short_circuit_or_expression(): AST.Expression {
    // short_circuit_and_expression
    // short_circuit_or_expression or_or short_circuit_and_expression
    let expr = this._short_circuit_and_expr();
    while (this._match(TokenTypes.tokens.or_or)) {
      expr = this._updateNode(new AST.BinaryOperator(
        this._previous().toString(),
        expr,
        this._short_circuit_and_expr()
      ));
    }
    return expr;
  }

  _short_circuit_and_expr(): AST.Expression {
    // inclusive_or_expression
    // short_circuit_and_expression and_and inclusive_or_expression
    let expr = this._inclusive_or_expression();
    while (this._match(TokenTypes.tokens.and_and)) {
      expr = this._updateNode(new AST.BinaryOperator(
        this._previous().toString(),
        expr,
        this._inclusive_or_expression()
      ));
    }
    return expr;
  }

  _inclusive_or_expression(): AST.Expression {
    // exclusive_or_expression
    // inclusive_or_expression or exclusive_or_expression
    let expr = this._exclusive_or_expression();
    while (this._match(TokenTypes.tokens.or)) {
      expr = this._updateNode(new AST.BinaryOperator(
        this._previous().toString(),
        expr,
        this._exclusive_or_expression()
      ));
    }
    return expr;
  }

  _exclusive_or_expression(): AST.Expression {
    // and_expression
    // exclusive_or_expression xor and_expression
    let expr = this._and_expression();
    while (this._match(TokenTypes.tokens.xor)) {
      expr = this._updateNode(new AST.BinaryOperator(
        this._previous().toString(),
        expr,
        this._and_expression()
      ));
    }
    return expr;
  }

  _and_expression(): AST.Expression {
    // equality_expression
    // and_expression and equality_expression
    let expr = this._equality_expression();
    while (this._match(TokenTypes.tokens.and)) {
      expr = this._updateNode(new AST.BinaryOperator(
        this._previous().toString(),
        expr,
        this._equality_expression()
      ));
    }
    return expr;
  }

  _equality_expression(): AST.Expression {
    // relational_expression
    // relational_expression equal_equal relational_expression
    // relational_expression not_equal relational_expression
    const expr = this._relational_expression();
    if (
      this._match([TokenTypes.tokens.equal_equal, TokenTypes.tokens.not_equal])
    ) {
      return this._updateNode(new AST.BinaryOperator(
        this._previous().toString(),
        expr,
        this._relational_expression()
      ));
    }
    return expr;
  }

  _relational_expression(): AST.Expression {
    // shift_expression
    // relational_expression less_than shift_expression
    // relational_expression greater_than shift_expression
    // relational_expression less_than_equal shift_expression
    // relational_expression greater_than_equal shift_expression
    let expr = this._shift_expression();
    while (
      this._match([
        TokenTypes.tokens.less_than,
        TokenTypes.tokens.greater_than,
        TokenTypes.tokens.less_than_equal,
        TokenTypes.tokens.greater_than_equal,
      ])
    ) {
      expr = this._updateNode(new AST.BinaryOperator(
        this._previous().toString(),
        expr,
        this._shift_expression()
      ));
    }
    return expr;
  }

  _shift_expression(): AST.Expression {
    // additive_expression
    // shift_expression shift_left additive_expression
    // shift_expression shift_right additive_expression
    let expr = this._additive_expression();
    while (
      this._match([TokenTypes.tokens.shift_left, TokenTypes.tokens.shift_right])
    ) {
      expr = this._updateNode(new AST.BinaryOperator(
        this._previous().toString(),
        expr,
        this._additive_expression()
      ));
    }
    return expr;
  }

  _additive_expression(): AST.Expression {
    // multiplicative_expression
    // additive_expression plus multiplicative_expression
    // additive_expression minus multiplicative_expression
    let expr = this._multiplicative_expression();
    while (this._match([TokenTypes.tokens.plus, TokenTypes.tokens.minus])) {
      expr = this._updateNode(new AST.BinaryOperator(
        this._previous().toString(),
        expr,
        this._multiplicative_expression()
      ));
    }
    return expr;
  }

  _multiplicative_expression(): AST.Expression {
    // unary_expression
    // multiplicative_expression star unary_expression
    // multiplicative_expression forward_slash unary_expression
    // multiplicative_expression modulo unary_expression
    let expr = this._unary_expression();
    while (
      this._match([
        TokenTypes.tokens.star,
        TokenTypes.tokens.forward_slash,
        TokenTypes.tokens.modulo,
      ])
    ) {
      expr = this._updateNode(new AST.BinaryOperator(
        this._previous().toString(),
        expr,
        this._unary_expression()
      ));
    }
    return expr;
  }

  _unary_expression(): AST.Expression {
    // singular_expression
    // minus unary_expression
    // bang unary_expression
    // tilde unary_expression
    // star unary_expression
    // and unary_expression
    if (
      this._match([
        TokenTypes.tokens.minus,
        TokenTypes.tokens.bang,
        TokenTypes.tokens.tilde,
        TokenTypes.tokens.star,
        TokenTypes.tokens.and,
      ])
    ) {
      return this._updateNode(new AST.UnaryOperator(
        this._previous().toString(),
        this._unary_expression()
      ));
    }
    return this._singular_expression();
  }

  _singular_expression(): AST.Expression {
    // primary_expression postfix_expression ?
    const expr = this._primary_expression();
    const p = this._postfix_expression();
    if (p) {
      expr.postfix = p;
    }
    return expr;
  }

  _postfix_expression(): AST.Expression | null {
    // bracket_left short_circuit_or_expression bracket_right postfix_expression?
    if (this._match(TokenTypes.tokens.bracket_left)) {
      const expr = this._short_circuit_or_expression();
      this._consume(TokenTypes.tokens.bracket_right, "Expected ']'.");
      const arrayIndex = this._updateNode(new AST.ArrayIndex(expr));
      const p = this._postfix_expression();
      if (p) {
        arrayIndex.postfix = p;
      }
      return arrayIndex;
    }

    // period ident postfix_expression?
    if (this._match(TokenTypes.tokens.period)) {
      const name = this._consume(
        TokenTypes.tokens.name,
        "Expected member name."
      );
      const p = this._postfix_expression();
      const expr = this._updateNode(new AST.StringExpr(name.lexeme));
      if (p) {
        expr.postfix = p;
      }
      return expr;
    }

    return null;
  }

  _getStruct(name: string): AST.Type | null {
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

  _getType(name: string): AST.Type {
    const struct = this._getStruct(name);
    if (struct !== null) {
      return struct;
    }
    switch (name) {
      case "bool":
        return AST.Type.bool;
      case "i32":
        return AST.Type.i32;
      case "u32":
        return AST.Type.u32;
      case "f32":
        return AST.Type.f32;
      case "f16":
        return AST.Type.f16;
      case "vec2f":
        return AST.TemplateType.vec2f;
      case "vec3f":
        return AST.TemplateType.vec3f;
      case "vec4f":
        return AST.TemplateType.vec4f;
      case "vec2i":
        return AST.TemplateType.vec2i;
      case "vec3i":
        return AST.TemplateType.vec3i;
      case "vec4i":
        return AST.TemplateType.vec4i;
      case "vec2u":
        return AST.TemplateType.vec2u;
      case "vec3u":
        return AST.TemplateType.vec3u;
      case "vec4u":
        return AST.TemplateType.vec4u;
      case "vec2h":
        return AST.TemplateType.vec2h;
      case "vec3h":
        return AST.TemplateType.vec3h;
      case "vec4h":
        return AST.TemplateType.vec4h;
      case "mat2x2f":
        return AST.TemplateType.mat2x2f;
      case "mat2x3f":
        return AST.TemplateType.mat2x3f;
      case "mat2x4f":
        return AST.TemplateType.mat2x4f;
      case "mat3x2f":
        return AST.TemplateType.mat3x2f;
      case "mat3x3f":
        return AST.TemplateType.mat3x3f;
      case "mat3x4f":
        return AST.TemplateType.mat3x4f;
      case "mat4x2f":
        return AST.TemplateType.mat4x2f;
      case "mat4x3f":
        return AST.TemplateType.mat4x3f;
      case "mat4x4f":
        return AST.TemplateType.mat4x4f;
      case "mat2x2h":
        return AST.TemplateType.mat2x2h;
      case "mat2x3h":
        return AST.TemplateType.mat2x3h;
      case "mat2x4h":
        return AST.TemplateType.mat2x4h;
      case "mat3x2h":
        return AST.TemplateType.mat3x2h;
      case "mat3x3h":
        return AST.TemplateType.mat3x3h;
      case "mat3x4h":
        return AST.TemplateType.mat3x4h;
      case "mat4x2h":
        return AST.TemplateType.mat4x2h;
      case "mat4x3h":
        return AST.TemplateType.mat4x3h;
      case "mat4x4h":
        return AST.TemplateType.mat4x4h;
    }
    return null;
  }

  _validateTypeRange(value: number, type: AST.Type) {
    if (type.name === "i32") {
      if (value < -2147483648 || value > 2147483647) {
        throw this._error(this._previous(), `Value out of range for i32: ${value}. Line: ${this._currentLine}.`);
      }
    } else if (type.name === "u32") {
      if (value < 0 || value > 4294967295) {
        throw this._error(this._previous(), `Value out of range for u32: ${value}. Line: ${this._currentLine}.`);
      }
    }
  }

  _primary_expression(): AST.Expression {
    // ident argument_expression_list?
    if (this._match(TokenTypes.tokens.ident)) {
      const name = this._previous().toString();
      if (this._check(TokenTypes.tokens.paren_left)) {
        const args = this._argument_expression_list();
        const type = this._getType(name);
        if (type !== null) {
          return this._updateNode(new AST.CreateExpr(type, args));
        }
        return this._updateNode(new AST.CallExpr(name, args));
      }
      if (this._context.constants.has(name)) {
        const c = this._context.constants.get(name);
        return this._updateNode(new AST.ConstExpr(name, c.value));
      }
      return this._updateNode(new AST.VariableExpr(name));
    }

    // const_literal
    if (this._match(TokenTypes.tokens.int_literal)) {
      const s = this._previous().toString();
      let type = s.endsWith("i") || s.endsWith("i") ? AST.Type.i32 :
          s.endsWith("u") || s.endsWith("U") ? AST.Type.u32 : AST.Type.x32;
      const i = parseInt(s);
      this._validateTypeRange(i, type);
      return this._updateNode(new AST.LiteralExpr(new AST.ScalarData(i, this._exec.getTypeInfo(type)), type));
    } else if (this._match(TokenTypes.tokens.uint_literal)) {
      const u = parseInt(this._previous().toString());
      this._validateTypeRange(u, AST.Type.u32);
      return this._updateNode(new AST.LiteralExpr(new AST.ScalarData(u, this._exec.getTypeInfo(AST.Type.u32)), AST.Type.u32));
    } else if (this._match([TokenTypes.tokens.decimal_float_literal, TokenTypes.tokens.hex_float_literal])) {
      let fs = this._previous().toString();
      let isF16 = fs.endsWith("h");
      if (isF16) {
        fs = fs.substring(0, fs.length - 1);
      }
      const f = parseFloat(fs);
      this._validateTypeRange(f, isF16 ? AST.Type.f16 : AST.Type.f32);
      const type = isF16 ? AST.Type.f16 : AST.Type.f32;
      return this._updateNode(new AST.LiteralExpr(new AST.ScalarData(f, this._exec.getTypeInfo(type)), type));
    } else if (this._match([TokenTypes.keywords.true, TokenTypes.keywords.false])) {
      let b = this._previous().toString() === TokenTypes.keywords.true.rule;
      return this._updateNode(new AST.LiteralExpr(new AST.ScalarData(b ? 1 : 0, this._exec.getTypeInfo(AST.Type.bool)), AST.Type.bool));
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
      return this._updateNode(new AST.BitcastExpr(type, value));
    }

    // type_decl argument_expression_list
    const type = this._type_decl();
    const args = this._argument_expression_list();
    return this._updateNode(new AST.CreateExpr(type, args));
  }

  _argument_expression_list(): AST.Expression[] | null {
    // paren_left ((short_circuit_or_expression comma)* short_circuit_or_expression comma?)? paren_right
    if (!this._match(TokenTypes.tokens.paren_left)) {
      return null;
    }

    const args: AST.Expression[] = [];
    do {
      if (this._check(TokenTypes.tokens.paren_right)) {
        break;
      }
      const arg = this._short_circuit_or_expression();
      args.push(arg);
    } while (this._match(TokenTypes.tokens.comma));
    this._consume(
      TokenTypes.tokens.paren_right,
      "Expected ')' for agument list"
    );

    return args;
  }

  _optional_paren_expression(): AST.GroupingExpr {
    // [paren_left] short_circuit_or_expression [paren_right]
    this._match(TokenTypes.tokens.paren_left);
    const expr = this._short_circuit_or_expression();
    this._match(TokenTypes.tokens.paren_right);
    return this._updateNode(new AST.GroupingExpr([expr]));
  }

  _paren_expression(): AST.GroupingExpr {
    // paren_left short_circuit_or_expression paren_right
    this._consume(TokenTypes.tokens.paren_left, "Expected '('.");
    const expr = this._short_circuit_or_expression();
    this._consume(TokenTypes.tokens.paren_right, "Expected ')'.");
    return this._updateNode(new AST.GroupingExpr([expr]));
  }

  _struct_decl(): AST.Struct | null {
    // attribute* struct ident struct_body_decl
    if (!this._match(TokenTypes.keywords.struct)) {
      return null;
    }

    const startLine = this._currentLine;

    const name = this._consume(
      TokenTypes.tokens.ident,
      "Expected name for struct."
    ).toString();

    // struct_body_decl: brace_left (struct_member comma)* struct_member comma? brace_right
    this._consume(
      TokenTypes.tokens.brace_left,
      "Expected '{' for struct body."
    );
    const members: AST.Member[] = [];
    while (!this._check(TokenTypes.tokens.brace_right)) {
      // struct_member: attribute* variable_ident_decl
      const memberAttrs = this._attribute();

      const memberName = this._consume(
        TokenTypes.tokens.name,
        "Expected variable name."
      ).toString();

      this._consume(
        TokenTypes.tokens.colon,
        "Expected ':' for struct member type."
      );

      const typeAttrs = this._attribute();
      const memberType = this._type_decl();
      if (memberType != null) {
        memberType.attributes = typeAttrs;
      }

      if (!this._check(TokenTypes.tokens.brace_right)) {
        this._consume(
          TokenTypes.tokens.comma,
          "Expected ',' for struct member."
        );
      } else {
        this._match(TokenTypes.tokens.comma); // trailing comma optional.
      }

      members.push(this._updateNode(new AST.Member(memberName, memberType, memberAttrs)));
    }

    this._consume(
      TokenTypes.tokens.brace_right,
      "Expected '}' after struct body."
    );

    const endLine = this._currentLine;

    const structNode = this._updateNode(new AST.Struct(name, members, startLine, endLine), startLine);
    this._context.structs.set(name, structNode);
    return structNode;
  }

  _global_variable_decl(): AST.Var | null {
    // attribute* variable_decl (equal const_expression)?
    const _var = this._variable_decl();
    if (!_var) {
      return null;
    }

    if (this._match(TokenTypes.tokens.equal)) {
      const expr = this._const_expression();
      const type = [AST.Type.f32];
      try {
        const value = expr.constEvaluate(this._exec, type);
        _var.value = new AST.LiteralExpr(value, type[0]);
        this._exec.context.setVariable(_var.name, value);
      } catch (_) {
        _var.value = expr;
      }
    } else {
      // Default constructor
      const createExpr = new AST.CreateExpr(_var.type, null);
      const value = this._exec.evalExpression(createExpr, this._exec.context);
      if (value !== null) {
        _var.value = new AST.LiteralExpr(value, _var.type);
        this._exec.context.setVariable(_var.name, value);
      }
    }

    if (_var.type !== null && _var.value instanceof AST.LiteralExpr) {
      if (_var.value.type.name !== "x32") {
        const t1 = this._exec.getTypeName(_var.type);
        const t2 = this._exec.getTypeName(_var.value.type);
        if (t1 !== t2) {
          throw this._error(this._peek(), `Invalid cast from ${_var.value.type.name} to ${_var.type.name}. Line:${this._currentLine}`);
        }
      }
      if (_var.value.isScalar) {
        this._validateTypeRange(_var.value.scalarValue, _var.type);
      }
      _var.value.type = _var.type;
    } else if (_var.type === null && _var.value instanceof AST.LiteralExpr) {
      _var.type = _var.value.type.name === "x32" ? AST.Type.i32 : _var.value.type;
      if (_var.value.isScalar) {
        this._validateTypeRange(_var.value.scalarValue, _var.type);
      }
    }
    return _var;
  }

  _override_variable_decl(): AST.Override | null {
    // attribute* override_decl (equal const_expression)?
    const _override = this._override_decl();
    if (_override && this._match(TokenTypes.tokens.equal)) {
      _override.value = this._const_expression();
    }

    return _override;
  }

  _global_const_decl(): AST.Const | null {
    // attribute* const (ident variable_ident_decl) global_const_initializer?
    if (!this._match(TokenTypes.keywords.const)) {
      return null;
    }

    const name = this._consume(
      TokenTypes.tokens.name,
      "Expected variable name"
    );
    let type: AST.Type | null = null;
    if (this._match(TokenTypes.tokens.colon)) {
      const attrs = this._attribute();
      type = this._type_decl();
      if (type != null) {
        type.attributes = attrs;
      }
    }
    let value: AST.Expression | null = null;

    this._consume(TokenTypes.tokens.equal, "const declarations require an assignment")

    const valueExpr = this._short_circuit_or_expression();
    try {
      let type = [AST.Type.f32];
      const constValue = valueExpr.constEvaluate(this._exec, type);
      if (constValue instanceof AST.ScalarData) {
        this._validateTypeRange(constValue.value, type[0]);
      }
      if (type[0] instanceof AST.TemplateType && type[0].format === null &&
        constValue.typeInfo instanceof TemplateInfo && constValue.typeInfo.format !== null) {
        if (constValue.typeInfo.format.name === "f16") {
          type[0].format = AST.Type.f16;
        } else if (constValue.typeInfo.format.name === "f32") {
          type[0].format = AST.Type.f32;
        } else if (constValue.typeInfo.format.name === "i32") {
          type[0].format = AST.Type.i32;
        } else if (constValue.typeInfo.format.name === "u32") {
          type[0].format = AST.Type.u32;
        } else if (constValue.typeInfo.format.name === "bool") {
          type[0].format = AST.Type.bool;
        } else {
          console.error(`TODO: impelement template format type ${constValue.typeInfo.format.name}`);
        }
      }
      value = this._updateNode(new AST.LiteralExpr(constValue, type[0]));
      this._exec.context.setVariable(name.toString(), constValue);
    } catch {
      value = valueExpr;
    }

    if (type !== null && value instanceof AST.LiteralExpr) {
      if (value.type.name !== "x32") {
        const t1 = this._exec.getTypeName(type);
        const t2 = this._exec.getTypeName(value.type);
        if (t1 !== t2) {
          throw this._error(this._peek(), `Invalid cast from ${value.type.name} to ${type.name}. Line:${this._currentLine}`);
        }
      }
      value.type = type;
      this._validateTypeRange(value.scalarValue, value.type);
    } else if (type === null && value instanceof AST.LiteralExpr) {
      type = value?.type ?? AST.Type.f32;
      if (type === AST.Type.x32) {
        type = AST.Type.i32;
      }
    }

    const c = this._updateNode(new AST.Const(name.toString(), type, "", "", value));
    this._context.constants.set(c.name, c);
    return c;
  }

  _global_let_decl(): AST.Let | null {
    // attribute* let (ident variable_ident_decl) global_const_initializer?
    if (!this._match(TokenTypes.keywords.let)) {
      return null;
    }

    const name = this._consume(
      TokenTypes.tokens.name,
      "Expected variable name"
    );
    let type: AST.Type | null = null;
    if (this._match(TokenTypes.tokens.colon)) {
      const attrs = this._attribute();
      type = this._type_decl();
      if (type != null) {
        type.attributes = attrs;
      }
    }
    let value: AST.Expression | null = null;
    if (this._match(TokenTypes.tokens.equal)) {
      value = this._const_expression();
      const type = [AST.Type.f32];
      try {
        const v = value!.constEvaluate(this._exec, type);
        if (v !== null) {
          value = new AST.LiteralExpr(v, type[0]);
        }
      } catch (_) {
      }
    }
    if (type !== null && value instanceof AST.LiteralExpr) {
      if (value.type.name !== "x32") {
        const t1 = this._exec.getTypeName(type);
        const t2 = this._exec.getTypeName(value.type);
        if (t1 !== t2) {
          throw this._error(this._peek(), `Invalid cast from ${value.type.name} to ${type.name}. Line:${this._currentLine}`);
        }
      }
      value.type = type;
    } else if (type === null && value instanceof AST.LiteralExpr) {
      type = value.type.name === "x32" ? AST.Type.i32 : value.type;
    }
    if (value instanceof AST.LiteralExpr) {
      if (value.isScalar) {
        this._validateTypeRange(value.scalarValue, type);
      }
    }
    return this._updateNode(new AST.Let(name.toString(), type, "", "", value));
  }

  _const_expression(): AST.Expression {
    // type_decl paren_left ((const_expression comma)* const_expression comma?)? paren_right
    // const_literal
    return this._short_circuit_or_expression();
  }

  _variable_decl(): AST.Var | null {
    // var variable_qualifier? (ident variable_ident_decl)
    if (!this._match(TokenTypes.keywords.var)) {
      return null;
    }

    // variable_qualifier: less_than storage_class (comma access_mode)? greater_than
    let storage: string = "";
    let access: string = "";
    if (this._match(TokenTypes.tokens.less_than)) {
      storage = this._consume(
        TokenTypes.storage_class,
        "Expected storage_class."
      ).toString();
      if (this._match(TokenTypes.tokens.comma))
        access = this._consume(
          TokenTypes.access_mode,
          "Expected access_mode."
        ).toString();
      this._consume(TokenTypes.tokens.greater_than, "Expected '>'.");
    }

    const name = this._consume(
      TokenTypes.tokens.name,
      "Expected variable name"
    );
    let type: AST.Type | null = null;
    if (this._match(TokenTypes.tokens.colon)) {
      const attrs = this._attribute();
      type = this._type_decl();
      if (type != null) {
        type.attributes = attrs;
      }
    }

    return this._updateNode(new AST.Var(name.toString(), type, storage, access, null));
  }

  _override_decl(): AST.Override | null {
    // override (ident variable_ident_decl)
    if (!this._match(TokenTypes.keywords.override)) {
      return null;
    }

    const name = this._consume(
      TokenTypes.tokens.name,
      "Expected variable name"
    );
    let type: AST.Type | null = null;
    if (this._match(TokenTypes.tokens.colon)) {
      const attrs = this._attribute();
      type = this._type_decl();
      if (type != null) {
        type.attributes = attrs;
      }
    }

    return this._updateNode(new AST.Override(name.toString(), type, null));
  }

  _diagnostic(): AST.Diagnostic | null {
    // diagnostic(severity_control_name, diagnostic_rule_name)
    this._consume(TokenTypes.tokens.paren_left, "Expected '('");
    const severity = this._consume(
      TokenTypes.tokens.ident,
      "Expected severity control name."
    );
    this._consume(TokenTypes.tokens.comma, "Expected ','");
    const rule = this._consume(
      TokenTypes.tokens.ident,
      "Expected diagnostic rule name."
    );
    let ruleMessage = rule.toString();
    if (this._match(TokenTypes.tokens.period)) {
      const message = this._consume(
        TokenTypes.tokens.ident,
        "Expected diagnostic message."
      );
      ruleMessage += `.${message.toString()}`;
    }

    this._consume(TokenTypes.tokens.paren_right, "Expected ')'");
    return this._updateNode(new AST.Diagnostic(severity.toString(), ruleMessage));
  }

  _enable_directive(): AST.Enable {
    // enable ident semicolon
    const name = this._consume(TokenTypes.tokens.ident, "identity expected.");
    return this._updateNode(new AST.Enable(name.toString()));
  }

  _requires_directive(): AST.Requires {
    // requires extension [, extension]* semicolon
    const extensions: string[] = [this._consume(TokenTypes.tokens.ident, "identity expected.").toString()];
    while (this._match(TokenTypes.tokens.comma)) {
      const name = this._consume(TokenTypes.tokens.ident, "identity expected.");
      extensions.push(name.toString());
    }
    return this._updateNode(new AST.Requires(extensions));
  }

  _type_alias(): AST.Alias {
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

    const aliasNode = this._updateNode(new AST.Alias(name.toString(), aliasType));
    this._context.aliases.set(aliasNode.name, aliasNode);

    return aliasNode;
  }

  _type_decl(): AST.Type | null {
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

    if (
      this._check([
        TokenTypes.tokens.ident,
        ...TokenTypes.texel_format,
        TokenTypes.keywords.bool,
        TokenTypes.keywords.f32,
        TokenTypes.keywords.i32,
        TokenTypes.keywords.u32,
      ])
    ) {
      const type = this._advance();
      const typeName = type.toString();
      if (this._context.structs.has(typeName)) {
        return this._context.structs.get(typeName);
      }
      if (this._context.aliases.has(typeName)) {
        return this._context.aliases.get(typeName).type;
      }
      return this._updateNode(new AST.Type(type.toString()));
    }

    // texture_sampler_types
    let type = this._texture_sampler_types();
    if (type) {
      return type;
    }

    if (this._check(TokenTypes.template_types)) {
      let type = this._advance().toString();
      let format: AST.Type | null = null;
      let access: string | null = null;
      if (this._match(TokenTypes.tokens.less_than)) {
        format = this._type_decl();
        access = null;
        if (this._match(TokenTypes.tokens.comma)) {
          access = this._consume(
            TokenTypes.access_mode,
            "Expected access_mode for pointer"
          ).toString();
        }
        this._consume(TokenTypes.tokens.greater_than, "Expected '>' for type.");
      }
      return this._updateNode(new AST.TemplateType(type, format, access));
    }

    // pointer less_than storage_class comma type_decl (comma access_mode)? greater_than
    if (this._match(TokenTypes.keywords.ptr)) {
      let pointer = this._previous().toString();
      this._consume(TokenTypes.tokens.less_than, "Expected '<' for pointer.");
      const storage = this._consume(
        TokenTypes.storage_class,
        "Expected storage_class for pointer"
      );
      this._consume(TokenTypes.tokens.comma, "Expected ',' for pointer.");
      const decl = this._type_decl();
      let access: string | null = null;
      if (this._match(TokenTypes.tokens.comma)) {
        access = this._consume(
          TokenTypes.access_mode,
          "Expected access_mode for pointer"
        ).toString();
      }
      this._consume(
        TokenTypes.tokens.greater_than,
        "Expected '>' for pointer."
      );
      return this._updateNode(new AST.PointerType(pointer, storage.toString(), decl, access));
    }

    // The following type_decl's have an optional attribyte_list*
    const attrs = this._attribute();

    // attribute* array
    // attribute* array less_than type_decl (comma element_count_expression)? greater_than
    if (this._match(TokenTypes.keywords.array)) {
      let format = null;
      let countInt = -1;
      const array = this._previous();
      let countNode: AST.Expression | null = null;
      if (this._match(TokenTypes.tokens.less_than)) {
        format = this._type_decl();
        if (this._context.aliases.has(format.name)) {
          format = this._context.aliases.get(format.name).type;
        }
        let count: string = "";
        if (this._match(TokenTypes.tokens.comma)) {
          countNode = this._shift_expression();
          // If we can't evaluate the node, defer evaluating it until after the shader has
          // finished being parsed, because const statements can be declared **after** they
          // are used.
          try {
            count = countNode.constEvaluate(this._exec).toString();
            countNode = null;
          } catch (e) {
            count = "1";
          }
        }
        this._consume(
          TokenTypes.tokens.greater_than,
          "Expected '>' for array."
        );
        countInt = count ? parseInt(count) : 0;
      }
      const arrayType = this._updateNode(new AST.ArrayType(array.toString(), attrs, format, countInt));
      if (countNode) {
        this._deferArrayCountEval.push({ arrayType, countNode });
      }
      return arrayType;
    }

    return null;
  }

  _texture_sampler_types(): AST.SamplerType | null {
    // sampler_type
    if (this._match(TokenTypes.sampler_type)) {
      return this._updateNode(new AST.SamplerType(this._previous().toString(), null, null));
    }

    // depth_texture_type
    if (this._match(TokenTypes.depth_texture_type)) {
      return this._updateNode(new AST.SamplerType(this._previous().toString(), null, null));
    }

    // sampled_texture_type less_than type_decl greater_than
    // multisampled_texture_type less_than type_decl greater_than
    if (
      this._match(TokenTypes.sampled_texture_type) ||
      this._match(TokenTypes.multisampled_texture_type)
    ) {
      const sampler = this._previous();
      this._consume(
        TokenTypes.tokens.less_than,
        "Expected '<' for sampler type."
      );
      const format = this._type_decl();
      this._consume(
        TokenTypes.tokens.greater_than,
        "Expected '>' for sampler type."
      );
      return this._updateNode(new AST.SamplerType(sampler.toString(), format, null));
    }

    // storage_texture_type less_than texel_format comma access_mode greater_than
    if (this._match(TokenTypes.storage_texture_type)) {
      const sampler = this._previous();
      this._consume(
        TokenTypes.tokens.less_than,
        "Expected '<' for sampler type."
      );
      const format = this._consume(
        TokenTypes.texel_format,
        "Invalid texel format."
      ).toString();
      this._consume(
        TokenTypes.tokens.comma,
        "Expected ',' after texel format."
      );
      const access = this._consume(
        TokenTypes.access_mode,
        "Expected access mode for storage texture type."
      ).toString();
      this._consume(
        TokenTypes.tokens.greater_than,
        "Expected '>' for sampler type."
      );
      return this._updateNode(new AST.SamplerType(sampler.toString(), format, access));
    }

    return null;
  }

  _attribute(): AST.Attribute[] | null {
    // attr ident paren_left (literal_or_ident comma)* literal_or_ident paren_right
    // attr ident

    let attributes: AST.Attribute[] = [];

    while (this._match(TokenTypes.tokens.attr)) {
      const name = this._consume(
        TokenTypes.attribute_name,
        "Expected attribute name"
      );
      const attr = this._updateNode(new AST.Attribute(name.toString(), null));
      if (this._match(TokenTypes.tokens.paren_left)) {
        // literal_or_ident
        attr.value = this._consume(
          TokenTypes.literal_or_ident,
          "Expected attribute value"
        ).toString();
        if (this._check(TokenTypes.tokens.comma)) {
          this._advance();
          do {
            const v = this._consume(
              TokenTypes.literal_or_ident,
              "Expected attribute value"
            ).toString();
            if (!(attr.value instanceof Array)) {
              attr.value = [attr.value as string];
            }
            attr.value.push(v);
          } while (this._match(TokenTypes.tokens.comma));
        }
        this._consume(TokenTypes.tokens.paren_right, "Expected ')'");
      }
      attributes.push(attr);
    }

    if (attributes.length == 0) {
      return null;
    }

    return attributes;
  }
}
