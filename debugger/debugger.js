import { EditorView, keymap, highlightSpecialChars, dropCursor, gutter, GutterMarker,
    crosshairCursor, lineNumbers, highlightActiveLineGutter, Decoration } from "@codemirror/view";
import { EditorState, StateField, StateEffect, RangeSet } from "@codemirror/state";
import { defaultHighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching,
    foldGutter, foldKeymap } from "@codemirror/language";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { searchKeymap } from "@codemirror/search";
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { lintKeymap } from "@codemirror/lint";
import { wgsl } from "./thirdparty/codemirror_lang_wgsl.js";
import { cobalt } from 'thememirror';
import { WgslDebug } from "../wgsl_reflect.module.js";

class BreakpointState {
  pos = 0;
  on = false;
}
const breakpointEffect = StateEffect.define<BreakpointState>({
  map: (val, mapping) => ({ pos: mapping.mapPos(val.pos), on: val.on })
});

const breakpointState = StateField.define<RangeSet<GutterMarker>>({
  create() { return RangeSet.empty; },
  update(set, transaction) {
    set = set.map(transaction.changes);
    for (let e of transaction.effects) {
      if (e.is(breakpointEffect)) {
        if (e.value.on) {
          set = set.update({add: [breakpointMarker.range(e.value.pos)]});
        } else {
          set = set.update({filter: from => from != e.value.pos});
        }
      }
    }
    return set;
  }
});

function toggleBreakpoint(view, pos) {
  let breakpoints = view.state.field(breakpointState);
  let hasBreakpoint = false;
  breakpoints.between(pos, pos, () => {hasBreakpoint = true});
  view.dispatch({
    effects: breakpointEffect.of({pos, on: !hasBreakpoint})
  });
}

const breakpointMarker = new class extends GutterMarker {
  toDOM() { return document.createTextNode("🔴") }
}

const breakpointGutter = [
  breakpointState,
  gutter({
    class: "cm-breakpoint-gutter",
    markers: v => v.state.field(breakpointState),
    initialSpacer: () => breakpointMarker,
    domEventHandlers: {
      mousedown(view, line) {
        toggleBreakpoint(view, line.from)
        return true
      }
    }
  }),

  EditorView.baseTheme({
    ".cm-breakpoint-gutter .cm-gutterElement": {
      color: "red",
      paddingLeft: "5px",
      cursor: "default"
    }
  })
];

/*class HighlightLineState {
  lineNo = 0;
}
const addLineHighlight = StateEffect.define<HighlightLineState>({
  map: (val, mapping) => ({ lineNo: mapping.mapPos(val.lineNo) })
});

const lineHighlightField = StateField.define({
  create() {
    return Decoration.none;
  },
  update(lines, tr) {
    lines = lines.map(tr.changes);
    for (let e of tr.effects) {
      if (e.is(addLineHighlight)) {
        lines = Decoration.none;
        if (e.value.lineNo > 0) {
          lines = lines.update({ add: [lineHighlightMark.range(e.value.lineNo)] });
        }
      }
    }
    return lines;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const lineHighlightMark = Decoration.line({
  attributes: {style: 'background-color:rgb(64, 73, 14)'},
});*/

const shaderEditorSetup = (() => [
  breakpointGutter,
  //lineHighlightField,
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  foldGutter(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, {fallback: true}),
  bracketMatching(),
  closeBrackets(),
  autocompletion(),
  crosshairCursor(),
  cobalt,
  wgsl(),
  keymap.of([
    indentWithTab,
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    ...lintKeymap
  ])
])();

export class Debugger {
  constructor(code, parent, watch) {
    this.code = code;
    this.watch = watch;

    const self = this;
    const stepOverButton = document.getElementById("step-over");
    stepOverButton.addEventListener("click", () => {
      self.stepOver();
    });
    const stepIntoButton = document.getElementById("step-into");
    stepIntoButton.addEventListener("click", () => {
      self.stepInto();
    });

    this.editorView = new EditorView({
      doc: code,
      extensions: [
        shaderEditorSetup,
      ],
      parent
    });

    this.debugger = new WgslDebug(code);
    this.debugger.startDebug();

    this.updateHighlightLine();
  }

  updateHighlightLine() {
    const cmd = this.debugger.currentCommand;
    if (cmd !== null) {
      const line = cmd.line;
      if (line > -1) {
        this._highlightLine(cmd.line);
      } else {
        this._highlightLine(0);   
      }
    } else {
      this._highlightLine(0);   
    }

    while (this.watch.childElementCount > 0) {
        this.watch.removeChild(this.watch.children[0]);
    }

    let state = this.debugger.currentState;
    if (state === null) {
        const context = this.debugger.context;
        const currentFunctionName = context.currentFunctionName;
        const div = document.createElement("div");
        div.innerText = currentFunctionName || "<shader>";
        this.watch.appendChild(div);

        context.variables.forEach((v) => {
            const div = document.createElement("div");
            div.innerText = `${v.name || "<var>"} : ${v.value}`;
            this.watch.appendChild(div);
        });
    } else {
        while (state !== null) {
            const context = state.context;
            const currentFunctionName = context.currentFunctionName;
            const div = document.createElement("div");
            div.innerText = currentFunctionName || "<shader>";
            this.watch.appendChild(div);

            context.variables.forEach((v) => {
                const div = document.createElement("div");
                div.innerText = `${v.name || "<var>"} : ${v.value}`;
                this.watch.appendChild(div);
            });

            state = state.parent;
        }
    }
  }

  stepOver() {
    this.debugger.stepNext(false);
    this.updateHighlightLine();
  }

  stepInto() {
    this.debugger.stepNext(true);
    this.updateHighlightLine();
  }

  _highlightLine(lineNo) {
    /*if (lineNo < 0) {
      return;
    }
    if (lineNo > 0) {
        const docPosition = this.editorView.state.doc.line(lineNo).from;
        this.editorView.dispatch({ effects: addLineHighlight.of({ lineNo: docPosition }) });
    } else {
        this.editorView.dispatch({ effects: addLineHighlight.of({ lineNo: 0 }) });
    }*/
  }
}

function main() {
  const code = `
fn foo(a: i32, b: i32) -> i32 {
  if b > 0 {
    return a / b;
  } else {
    return a * b;
  }
}
let bar = foo(3, 4);
let bar2 = foo(5, -2);`;
  const parent = document.getElementById("debugger");
  const watch = document.getElementById("watch");
  new Debugger(code, parent, watch);
}

main();
