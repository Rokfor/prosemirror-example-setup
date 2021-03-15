import {wrapIn, setBlockType, chainCommands, toggleMark, exitCode,
        joinUp, joinDown, lift, selectParentNode} from "prosemirror-commands"
import {wrapInList, splitListItem, liftListItem, sinkListItem} from "prosemirror-schema-list"
import {undo, redo} from "prosemirror-history"
import {undoInputRule} from "prosemirror-inputrules"
import {canSplit} from "prosemirror-transform"


const mac = typeof navigator != "undefined" ? /Mac/.test(navigator.platform) : false

const splitToDefaultListItem = function(itemType) {
  return function (state, dispatch) {
    const { $from, $to, node } = state.selection
    console.log($from, $to, node);
    if ((node && node.isBlock) || $from.depth < 2 || !$from.sameParent($to)) return false
    const grandParent = $from.node(-1)
    console.log('grandParent', grandParent, grandParent.type, itemType);

    if (grandParent.name == 'description_list' && dispatch) {

      let wrap = Fragment.empty;
      wrap = wrap.append(Fragment.from(grandParent.createAndFill()))
      const tr = state.tr.replace($from.before(null), $from.after(-3), new Slice(wrap, 3, 2))
      tr.setSelection(state.selection.constructor.near(tr.doc.resolve($from.pos + (keepItem ? 3 : 2))))
      dispatch(tr.scrollIntoView())


    }
/*

    //if (grandParent.type != itemType) return false
    if ($from.parent.content.size == 0) {
      // In an empty block. If this is a nested list, the wrapping
      // list item should be split. Otherwise, bail out and let next
      // command handle lifting.
      if ($from.depth == 2 || $from.node(-3).type != itemType
          || $from.index(-2) != $from.node(-2).childCount - 1) return false

      if (dispatch) {
        let wrap = Fragment.empty; const keepItem = $from.index(-1) > 0
        // Build a fragment containing empty versions of the structure
        // from the outer list item to the parent node of the cursor
        for (let d = $from.depth - (keepItem ? 1 : 2); d >= $from.depth - 3; d--) wrap = Fragment.from($from.node(d).copy(wrap))
        // Add a second list item with an empty default start node
        wrap = wrap.append(Fragment.from(itemType.createAndFill()))
        const tr = state.tr.replace($from.before(keepItem ? null : -1), $from.after(-3), new Slice(wrap, keepItem ? 3 : 2, 2))
        tr.setSelection(state.selection.constructor.near(tr.doc.resolve($from.pos + (keepItem ? 3 : 2))))
        dispatch(tr.scrollIntoView())
      }
      return true
    }
    const nextType = $to.pos == $from.end() ? grandParent.contentMatchAt($from.indexAfter(-1)).defaultType : null
    const tr = state.tr.delete($from.pos, $to.pos)

    // let types = nextType && [null, {type: nextType}]
    let types = nextType && [{ type: itemType }, { type: nextType }]
    if (!types) types = [{ type: itemType }, null]

    //if (!canSplit(tr.doc, $from.pos, 2, types)) return false
    if (dispatch) dispatch(tr.split($from.pos, 2, types).scrollIntoView())
    return true*/
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


  bind("Mod-z", undo)
  bind("Shift-Mod-z", redo)
  bind("Backspace", undoInputRule)
  if (!mac) bind("Mod-y", redo)

  bind("Alt-ArrowUp", joinUp)
  bind("Alt-ArrowDown", joinDown)
  bind("Mod-BracketLeft", lift)
  bind("Escape", selectParentNode)

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
    bind("Enter", splitListItem(type))
    bind("Mod-[", liftListItem(type))
    bind("Mod-]", sinkListItem(type))
  }

  if (type = schema.nodes.description_value)
    bind("Enter", splitToDefaultListItem(type))

  if (type = schema.nodes.description_term)
    bind("Enter", splitToDefaultListItem(type))    

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
