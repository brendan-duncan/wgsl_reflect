/**
 * @author Brendan Duncan / https://github.com/brendan-duncan
 */
import { Token, TokenType } from "./wgsl_scanner.js";
import * as AST from "./wgsl_ast.js";
import { WgslExec } from "./wgsl_exec.js";
export declare class WgslParser {
    _tokens: Token[];
    _current: number;
    _currentLine: number;
    _deferArrayCountEval: Object[];
    _currentLoop: AST.Statement[];
    _context: AST.ParseContext;
    _exec: WgslExec;
    parse(tokensOrCode: Token[] | string): AST.Statement[];
    _initialize(tokensOrCode: Token[] | string): void;
    _updateNode<T extends AST.Node>(n: T, l?: number): T;
    _error(token: Token, message: string | null): Object;
    _isAtEnd(): boolean;
    _match(types: TokenType | TokenType[]): boolean;
    _consume(types: TokenType | TokenType[], message: string | null): Token;
    _check(types: TokenType | TokenType[]): boolean;
    _advance(): Token;
    _peek(): Token;
    _previous(): Token;
    _global_decl_or_directive(): AST.Statement | null;
    _function_decl(): AST.Function | null;
    _compound_statement(): AST.Statement[];
    _statement(): AST.Statement | AST.Statement[] | null;
    _static_assert_statement(): AST.StaticAssert | null;
    _while_statement(): AST.While | null;
    _continuing_statement(): AST.Continuing | null;
    _for_statement(): AST.For | null;
    _for_init(): AST.Statement | null;
    _for_increment(): AST.Statement | null;
    _variable_statement(): AST.Var | AST.Let | AST.Const | null;
    _increment_decrement_statement(): AST.Statement | null;
    _assignment_statement(): AST.Assign | null;
    _func_call_statement(): AST.Call | null;
    _loop_statement(): AST.Loop | null;
    _switch_statement(): AST.Switch | null;
    _switch_body(): AST.Statement[];
    _case_selectors(): AST.Expression[];
    _case_body(): AST.Statement[];
    _if_statement(): AST.If | null;
    _match_elseif(): boolean;
    _elseif_statement(elseif?: AST.ElseIf[]): AST.ElseIf[];
    _return_statement(): AST.Return | null;
    _short_circuit_or_expression(): AST.Expression;
    _short_circuit_and_expr(): AST.Expression;
    _inclusive_or_expression(): AST.Expression;
    _exclusive_or_expression(): AST.Expression;
    _and_expression(): AST.Expression;
    _equality_expression(): AST.Expression;
    _relational_expression(): AST.Expression;
    _shift_expression(): AST.Expression;
    _additive_expression(): AST.Expression;
    _multiplicative_expression(): AST.Expression;
    _unary_expression(): AST.Expression;
    _singular_expression(): AST.Expression;
    _postfix_expression(): AST.Expression | null;
    _getStruct(name: string): AST.Type | null;
    _getType(name: string): AST.Type;
    _validateTypeRange(value: number, type: AST.Type): void;
    _primary_expression(): AST.Expression;
    _argument_expression_list(): AST.Expression[] | null;
    _optional_paren_expression(): AST.GroupingExpr;
    _paren_expression(): AST.GroupingExpr;
    _struct_decl(): AST.Struct | null;
    _global_variable_decl(): AST.Var | null;
    _override_variable_decl(): AST.Override | null;
    _global_const_decl(): AST.Const | null;
    _global_let_decl(): AST.Let | null;
    _const_expression(): AST.Expression;
    _variable_decl(): AST.Var | null;
    _override_decl(): AST.Override | null;
    _diagnostic(): AST.Diagnostic | null;
    _enable_directive(): AST.Enable;
    _requires_directive(): AST.Requires;
    _type_alias(): AST.Alias;
    _type_decl(): AST.Type | null;
    _texture_sampler_types(): AST.SamplerType | null;
    _attribute(): AST.Attribute[] | null;
}
