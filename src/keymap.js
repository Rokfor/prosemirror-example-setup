import {wrapIn, setBlockType, chainCommands, toggleMark, exitCode,
        joinUp, joinDown, lift, selectParentNode} from "prosemirror-commands"
import {wrapInList, splitListItem, liftListItem, sinkListItem} from "prosemirror-schema-list"
import {undo, redo} from "prosemirror-history"
import {undoInputRule} from "prosemirror-inputrules"
import {canSplit} from "prosemirror-transform"
import {TextSelection} from "prosemirror-state"
import {TextField, SelectField, openPrompt} from "./prompt"

const mac = typeof navigator != "undefined" ? /Mac/.test(navigator.platform) : false


function addBibliography(markType, attrs) {
  return function (state, dispatch) {
    openPrompt({
      title: "Add literature reference",
      fields: {
        reference: new SelectField({options: document.bibTex, value: attrs && attrs.reference}),
        pre: new TextField({label: "Pre-Text", value: attrs && attrs.pre}),
        post: new TextField({label: "Post-Text", value: attrs && attrs.post}),
      },
      callback(attrs) {
        let tr = state.tr;
        tr = tr.addStoredMark(markType.create(attrs))          
        tr = tr.replaceSelectionWith(state.schema.text(`${attrs.reference} ${attrs.pre} ${attrs.post}`), true) 
        dispatch(tr)
        return true
      }
    })
  }
}

function splitDefinitionList(itemType, nodes) {
  return function (state, dispatch) {

    const { $from, $to, node } = state.selection
    //console.log($from, $to, node);
    if ((node && node.isBlock) || $from.depth < 2 || !$from.sameParent($to)) return false
    const grandParent = $from.node(-1)
    //console.log('grandParent', grandParent, grandParent.type, itemType);

    if (grandParent.type.name == 'dl' && dispatch) {
      try {
        //let _sibling = $from.node().childBefore($from.pos - 2);
        console.log($from.parentOffset)
        if (grandParent.firstChild == $from.parent && $from.parentOffset == 0) {
          let tr = state.tr.insert($from.pos - 2, state.schema.nodes.paragraph.createAndFill())
          if (dispatch) dispatch(tr.setSelection(new TextSelection(tr.doc.resolve($from.pos - 2))).scrollIntoView())          
          return true;
        }
      } catch (error) {
        
      }
      //console.log('dl', $from.parentOffset, )
    }
    if (grandParent.type.name == 'dd' && dispatch) {
      console.log('dd', $from, node, grandParent)
      if ($from.parent.content.size == 0) {
        
        console.log($from, $to, $from.node(-2), $from.node(-3))
        
        //let tr = state.tr.delete($from.pos, $to.pos)
        let tr = state.tr.insert($to.pos + 2, state.schema.nodes.paragraph.createAndFill())
        if (dispatch) dispatch(tr.setSelection(new TextSelection(tr.doc.resolve($to.pos + 3))).scrollIntoView())
        return true
        


      }
      else {
        dispatch(state.tr.replaceSelectionWith(grandParent.type.createAndFill()).scrollIntoView())
        joinUp(state, dispatch);
      }
      return true
    }

    return false;
  }
}

// :: (Schema, ?Object) → Object
// Inspect the given schema looking for marks and nodes from the
// basic schema, and if found, add key bindings related to them.
// This will add:
//
// * **Mod-b** for toggling [strong](#schema-basic.StrongMark)
// * **Mod-i** for toggling [emphasis](#schema-basic.EmMark)
// * **Mod-`** for toggling [code font](#schema-basic.CodeMark)
// * **Ctrl-Shift-0** for making the current textblock a paragraph
// * **Ctrl-Shift-1** to **Ctrl-Shift-Digit6** for making the current
//   textblock a heading of the corresponding level
// * **Ctrl-Shift-Backslash** to make the current textblock a code block
// * **Ctrl-Shift-8** to wrap the selection in an ordered list
// * **Ctrl-Shift-9** to wrap the selection in a bullet list
// * **Ctrl->** to wrap the selection in a block quote
// * **Enter** to split a non-empty textblock in a list item while at
//   the same time splitting the list item
// * **Mod-Enter** to insert a hard break
// * **Mod-_** to insert a horizontal rule
// * **Backspace** to undo an input rule
// * **Alt-ArrowUp** to `joinUp`
// * **Alt-ArrowDown** to `joinDown`
// * **Mod-BracketLeft** to `lift`
// * **Escape** to `selectParentNode`
//
// You can suppress or map these bindings by passing a `mapKeys`
// argument, which maps key names (say `"Mod-B"` to either `false`, to
// remove the binding, or a new key name string.
export function buildKeymap(schema, mapKeys) {
  let keys = {}, type
  function bind(key, cmd) {
    if (mapKeys) {
      let mapped = mapKeys[key]
      if (mapped === false) return
      if (mapped) key = mapped
    }
    keys[key] = cmd
  }

  console.log('type', schema);

  bind("Mod-z", undo)
  bind("Shift-Mod-z", redo)
  bind("Backspace", undoInputRule)
  if (!mac) bind("Mod-y", redo)

  bind("Alt-ArrowUp", joinUp)
  bind("Alt-ArrowDown", joinDown)
  bind("Mod-BracketLeft", lift)
  bind("Escape", selectParentNode)

  if (type = schema.marks.bibliography) {
    bind("Shift-Mod-e", addBibliography(type))
    bind("Shift-Mod-E", addBibliography(type))
  }

  if (type = schema.marks.fn) {
    bind("Shift-Mod-F", toggleMark(type))
    bind("Shift-Mod-f", toggleMark(type))
  }

  if (type = schema.marks.strong) {
    bind("Mod-b", toggleMark(type))
    bind("Mod-B", toggleMark(type))
  }
  if (type = schema.marks.em) {
    bind("Mod-i", toggleMark(type))
    bind("Mod-I", toggleMark(type))
  }
  if (type = schema.marks.code)
    bind("Mod-`", toggleMark(type))

  if (type = schema.nodes.bullet_list)
    bind("Shift-Ctrl-8", wrapInList(type))
  if (type = schema.nodes.ordered_list)
    bind("Shift-Ctrl-9", wrapInList(type))
  if (type = schema.nodes.blockquote)
    bind("Ctrl->", wrapIn(type))
  if (type = schema.nodes.hard_break) {
    let br = type, cmd = chainCommands(exitCode, (state, dispatch) => {
      dispatch(state.tr.replaceSelectionWith(br.create()).scrollIntoView())
      return true
    })
    bind("Mod-Enter", cmd)
    bind("Shift-Enter", cmd)
    if (mac) bind("Ctrl-Enter", cmd)
  }

  if (type = schema.nodes.list_item) {
    bind("Mod-[", liftListItem(type))
    bind("Mod-]", sinkListItem(type))
  }

  bind("Enter", 
    chainCommands(
      splitDefinitionList(schema.nodes.dd, schema.nodes), 
      splitDefinitionList(schema.nodes.dt, schema.nodes), 
      splitListItem(schema.nodes.list_item)
    )
  )

  if (type = schema.nodes.paragraph)
    bind("Shift-Ctrl-0", setBlockType(type))
  if (type = schema.nodes.code_block)
    bind("Shift-Ctrl-\\", setBlockType(type))
  if (type = schema.nodes.heading)
    for (let i = 1; i <= 6; i++) bind("Shift-Ctrl-" + i, setBlockType(type, {level: i}))
  if (type = schema.nodes.horizontal_rule) {
    let hr = type
    bind("Mod-_", (state, dispatch) => {
      dispatch(state.tr.replaceSelectionWith(hr.create()).scrollIntoView())
      return true
    })
  }

  return keys
}
