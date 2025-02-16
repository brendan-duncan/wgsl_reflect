import { Node, CallExpr, Continue, Expression, Break } from "../wgsl_ast.js";

export class Command {
    get line(): number { return -1; }
}

export class StatementCommand extends Command {
    node: Node;

    constructor(node: Node) {
        super();
        this.node = node;
    }

    get line(): number { return this.node.line; }
}

export class CallExprCommand extends Command {
    node: CallExpr;
    statement: Node;

    constructor(node: CallExpr, statement: Node) {
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
    node: Continue;

    constructor(id: number, node: Continue) {
        super();
        this.id = id;
        this.node = node;
    }

    get line(): number { return this.node.line; }
}

export class BreakCommand extends Command {
    id: number;
    condition: Expression | null;
    node: Break;

    constructor(id: number, condition: Expression | null, node: Break) {
        super();
        this.id = id;
        this.condition = condition;
        this.node = node;
    }

    get line(): number { return this.node.line; }
}


export class GotoCommand extends Command {
    condition: Node | null;
    position: number;
    lineNo: number = -1;

    constructor(condition: Node | null, position: number, line: number) {
        super();
        this.condition = condition;
        this.position = position;
        this.lineNo = line;
    }

    get line(): number {
        return this.condition?.line ?? this.lineNo;
    }
}

export class BlockCommand extends Command {
    statements: Array<Node> = [];

    constructor(statements: Array<Node>) {
      super();
      this.statements = statements;
    }

    get line(): number {
      return this.statements.length > 0 ? this.statements[0].line : -1;
    }
}
