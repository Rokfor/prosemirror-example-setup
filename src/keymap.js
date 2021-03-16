import {wrapIn, setBlockType, chainCommands, toggleMark, exitCode,
        joinUp, joinDown, lift, selectParentNode} from "prosemirror-commands"
import {wrapInList, splitListItem, liftListItem, sinkListItem} from "prosemirror-schema-list"
import {undo, redo} from "prosemirror-history"
import {undoInputRule} from "prosemirror-inputrules"
import {ReplaceAroundStep} from "prosemirror-transform"

import {Slice, Fragment} from "prosemirror-model"

const mac = typeof navigator != "undefined" ? /Mac/.test(navigator.platform) : false

function splitDefinitionList(itemType, nodes) {
  return function (state, dispatch) {

    const { $from, $to, node } = state.selection
    //console.log($from, $to, node);
    if ((node && node.isBlock) || $from.depth < 2 || !$from.sameParent($to)) return false
    const grandParent = $from.node(-1)
    //console.log('grandParent', grandParent, grandParent.type, itemType);

    if (grandParent.type.name == 'dl' && dispatch) {
      console.log('dl', $from, node, grandParent)
    }
    if (grandParent.type.name == 'dd' && dispatch) {
      console.log('dd', $from, node, grandParent)
      if ($from.parent.content.size == 0) {
//        dispatch(state.tr.replaceSelectionWith(nodes.paragraph.createAndFill()).scrollIntoView())

        /*let tr = state.tr.delete($from.pos, $to.pos)
        let types = nodes.paragraph && [null, {type: nodes.paragraph}]
        if (!canSplit(tr.doc, $from.pos, 2, types)) return false
        if (dispatch) dispatch(tr.insert($from.pos, 2,nodes.paragraph).scrollIntoView())
*/
        let range = $from.blockRange($to)
        let $start = tr.doc.resolve(range.start), item = $start.nodeAfter
        item.content.append(Fragment.empty);

        /*

        let tr = state.tr, list = range.parent
        // Merge the list items into a single big item
        for (let pos = range.end, i = range.endIndex - 1, e = range.startIndex; i > e; i--) {
          pos -= list.child(i).nodeSize
          tr.delete(pos - 1, pos + 1)
        }
        let $start = tr.doc.resolve(range.start), item = $start.nodeAfter
        let atStart = range.startIndex == 0, atEnd = range.endIndex == list.childCount
        let parent = $start.node(-1), indexBefore = $start.index(-1)
        if (!parent.canReplace(indexBefore + (atStart ? 0 : 1), indexBefore + 1,
                               item.content.append(atEnd ? Fragment.empty : Fragment.from(list))))
          return false
        let start = $start.pos, end = start + item.nodeSize
        // Strip off the surrounding list. At the sides where we're not at
        // the end of the list, the existing list is closed. At sides where
        // this is the end, it is overwritten to its end.
        tr.step(new ReplaceAroundStep(start - (atStart ? 1 : 0), end + (atEnd ? 1 : 0), start + 1, end - 1,
                                      new Slice((atStart ? Fragment.empty : Fragment.from(list.copy(Fragment.empty)))
                                                .append(atEnd ? Fragment.empty : Fragment.from(list.copy(Fragment.empty))),
                                                atStart ? 0 : 1, atEnd ? 0 : 1), atStart ? 0 : 1))
        */
        dispatch(tr.scrollIntoView())
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
