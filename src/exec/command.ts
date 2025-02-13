import * as AST from "../wgsl_ast.js";

export class Command {
    get line(): number { return -1; }
}

export class StatementCommand extends Command {
    node: AST.Node;

    constructor(node: AST.Node) {
        super();
        this.node = node;
    }

    get line(): number { return this.node.line; }
}

export class CallExprCommand extends Command {
    node: AST.CallExpr;
    statement: AST.Node;

    constructor(node: AST.CallExpr, statement: AST.Node) {
        super();
        this.node = node;
        this.statement = statement;
    }

    get line(): number { return this.statement.line; }
}

export class ContinueTargetCommand extends Command {
    id: number;

    constructor(id: number) {
        super();
        this.id = id;
    }
}

export class BreakTargetCommand extends Command {
    id: number;

    constructor(id: number) {
        super();
        this.id = id;
    }
}

export class ContinueCommand extends Command {
    id: number;
    node: AST.Continue;

    constructor(id: number, node: AST.Continue) {
        super();
        this.id = id;
        this.node = node;
    }

    get line(): number { return this.node.line; }
}

export class BreakCommand extends Command {
    id: number;
    condition: AST.Expression | null;
    node: AST.Break;

    constructor(id: number, condition: AST.Expression | null, node: AST.Break) {
        super();
        this.id = id;
        this.condition = condition;
        this.node = node;
    }

    get line(): number { return this.node.line; }
}


export class GotoCommand extends Command {
    //static kContinueTarget = -1000;
    //static kBreakTarget = -2000;
    //static kContinue = -3000;
    //static kBreak = -4000;

    condition: AST.Node | null;
    position: number;

    constructor(condition: AST.Node | null, position: number) {
        super();
        this.condition = condition;
        this.position = position;
    }

    get line(): number {
        return this.condition?.line ?? -1;
    }
}

export class BlockCommand extends Command {
    statements: Array<AST.Node> = [];

    constructor(statements: Array<AST.Node>) {
      super();
      this.statements = statements;
    }

    get line(): number {
      return this.statements.length > 0 ? this.statements[0].line : -1;
    }
}
