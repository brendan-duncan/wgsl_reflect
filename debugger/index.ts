import { EditorView } from "codemirror";
import { keymap, highlightSpecialChars, drawSelection, dropCursor,
    crosshairCursor, lineNumbers, highlightActiveLineGutter } from "@codemirror/view";
import { EditorState, StateField, StateEffect, RangeSet } from "@codemirror/state";
import { defaultHighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching,
foldGutter, foldKeymap } from "@codemirror/language";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { searchKeymap } from "@codemirror/search";
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { lintKeymap } from "@codemirror/lint";
import { wgsl } from "./thirdparty/codemirror_lang_wgsl.js";
import { cobalt } from 'thememirror';
import { gutter, GutterMarker } from '@codemirror/view';

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

const shaderEditorSetup = (() => [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    //drawSelection(),
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
    constructor(code: string, parent: HTMLElement) {
        const text = code;

        const startButton = document.getElementById("start");
        startButton!.addEventListener("click", () => {
            console.log("Start");
        });
        const stepOverButton = document.getElementById("step-over");
        stepOverButton!.addEventListener("click", () => {
            console.log("Step over");
        });
        const stepIntoButton = document.getElementById("step-into");
        stepIntoButton!.addEventListener("click", () => {
            console.log("Step in");
        });

        const editor = new EditorView({
            doc: text,
            extensions: [
                breakpointGutter,
                shaderEditorSetup,
            ],
            parent
        });
    }
}


function main() {
    const code = `
fn foo(a: int, b: int) -> int {
    if (b != 0) {
        return a / b;
    } else {
        return a * b;
    }
}
let bar = foo(3, 4);`;
    const parent = document.getElementById("debugger");
    new Debugger(code, parent!);
}

main();
