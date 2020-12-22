import {wrapItem, blockTypeItem, Dropdown, DropdownSubmenu, joinUpItem, liftItem,
       selectParentNodeItem, undoItem, redoItem, icons, MenuItem} from "prosemirror-menu"
import {NodeSelection} from "prosemirror-state"
import {toggleMark} from "prosemirror-commands"
import {wrapInList} from "prosemirror-schema-list"
import {TextField, SelectField, openPrompt} from "./prompt"

// Helpers to create specific types of items

function canInsert(state, nodeType) {
  let $from = state.selection.$from
  for (let d = $from.depth; d >= 0; d--) {
    let index = $from.index(d)
    if ($from.node(d).canReplaceWith(index, index, nodeType)) return true
  }
  return false
}

function insertImageItem(nodeType) {
  return new MenuItem({
    title: "Insert image",
    label: "Image",
    enable(state) { return canInsert(state, nodeType) },
    run(state, _, view) {
      let {from, to} = state.selection, attrs = null
      if (state.selection instanceof NodeSelection && state.selection.node.type == nodeType)
        attrs = state.selection.node.attrs
      openPrompt({
        title: "Insert image",
        fields: {
          src: new TextField({label: "Location", required: true, value: attrs && attrs.src}),
          title: new TextField({label: "Title", value: attrs && attrs.title}),
          alt: new TextField({label: "Description",
                              value: attrs ? attrs.alt : state.doc.textBetween(from, to, " ")})
        },
        callback(attrs) {
          view.dispatch(view.state.tr.replaceSelectionWith(nodeType.createAndFill(attrs)))
          view.focus()
        }
      })
    }
  })
}

function cmdItem(cmd, options) {
  let passedOptions = {
    label: options.title,
    run: cmd
  }
  for (let prop in options) passedOptions[prop] = options[prop]
  if ((!options.enable || options.enable === true) && !options.select)
    passedOptions[options.enable ? "enable" : "select"] = state => cmd(state)

  return new MenuItem(passedOptions)
}

function markActive(state, type) {
  let {from, $from, to, empty} = state.selection
  if (empty) return type.isInSet(state.storedMarks || $from.marks())
  else return state.doc.rangeHasMark(from, to, type)
}

function markItem(markType, options) {
  let passedOptions = {
    active(state) { return markActive(state, markType) },
    enable: true
  }
  for (let prop in options) passedOptions[prop] = options[prop]
  return cmdItem(toggleMark(markType), passedOptions)
}

function linkItem(markType) {
  return new MenuItem({
    title: "Add or remove link",
    icon: icons.link,
    active(state) { return markActive(state, markType) },
    enable(state) { return !state.selection.empty },
    run(state, dispatch, view) {
      if (markActive(state, markType)) {
        toggleMark(markType)(state, dispatch)
        return true
      }
      openPrompt({
        title: "Create a link",
        fields: {
          href: new TextField({
            label: "Link target",
            required: true
          }),
          title: new TextField({label: "Title"})
        },
        callback(attrs) {
          toggleMark(markType, attrs)(view.state, view.dispatch)
          view.focus()
        }
      })
    }
  })
}

function languageItem(nodeType) {
  return new MenuItem({
    title: "Language",
    label: "Set Language",
    icon: icons.language,
    enable(state) { return canInsert(state, nodeType) },
    run(state, _, view) {
      let {from, to} = state.selection, attrs = null
      if (state.selection instanceof NodeSelection && state.selection.node.type == nodeType)
        attrs = state.selection.node.attrs
      openPrompt({
        title: "Change the language for the rest of this document. This affects hyphenation and language specific typesetting.",
        fields: {
          language: new SelectField({
            options: [
              {value: 'ngerman',  label: 'Deutsch'},
              {value: 'french',   label: 'Français'},
              {value: 'italian',  label: 'Italiano'},
              {value: 'arabic',   label: 'Arabic'},
              {value: 'english',  label: 'English'}
            ]}
          )
        },
        callback(attrs) {
          view.dispatch(view.state.tr.replaceSelectionWith(nodeType.createAndFill(attrs)))
          view.focus()
        }
      })
    }
  })
}


function addMarker(markType) {

  
  return new MenuItem({
    title: "Mark",
    label: "Add Marker",
    icon: icons.mark,
    active(state) { return markActive(state, markType) },
    run(state, dispatch, view) {
      if (markActive(state, markType)) {
        toggleMark(markType)(state, dispatch)
        return true
      }
      openPrompt({
        title: "Add a marker for cross references.",
        fields: {
          src: new TextField({label: "Name", required: true}),
        },
        callback(attrs) {
          toggleMark(markType, attrs)(view.state, view.dispatch)
          const tr = view.state.tr.replaceSelectionWith(view.state.schema.text(attrs.src)) 
          view.dispatch(tr)
          view.focus()
        }
      })
    }
  })
}


function wrapListItem(nodeType, options) {
  return cmdItem(wrapInList(nodeType, options.attrs), options)
}

// :: (Schema) → Object
// Given a schema, look for default mark and node types in it and
// return an object with relevant menu items relating to those marks:
//
// **`toggleStrong`**`: MenuItem`
//   : A menu item to toggle the [strong mark](#schema-basic.StrongMark).
//
// **`toggleEm`**`: MenuItem`
//   : A menu item to toggle the [emphasis mark](#schema-basic.EmMark).
//
// **`toggleCode`**`: MenuItem`
//   : A menu item to toggle the [code font mark](#schema-basic.CodeMark).
//
// **`toggleLink`**`: MenuItem`
//   : A menu item to toggle the [link mark](#schema-basic.LinkMark).
//
// **`insertImage`**`: MenuItem`
//   : A menu item to insert an [image](#schema-basic.Image).
//
// **`wrapBulletList`**`: MenuItem`
//   : A menu item to wrap the selection in a [bullet list](#schema-list.BulletList).
//
// **`wrapOrderedList`**`: MenuItem`
//   : A menu item to wrap the selection in an [ordered list](#schema-list.OrderedList).
//
// **`wrapBlockQuote`**`: MenuItem`
//   : A menu item to wrap the selection in a [block quote](#schema-basic.BlockQuote).
//
// **`makeParagraph`**`: MenuItem`
//   : A menu item to set the current textblock to be a normal
//     [paragraph](#schema-basic.Paragraph).
//
// **`makeCodeBlock`**`: MenuItem`
//   : A menu item to set the current textblock to be a
//     [code block](#schema-basic.CodeBlock).
//
// **`makeHead[N]`**`: MenuItem`
//   : Where _N_ is 1 to 6. Menu items to set the current textblock to
//     be a [heading](#schema-basic.Heading) of level _N_.
//
// **`insertHorizontalRule`**`: MenuItem`
//   : A menu item to insert a horizontal rule.
//
// The return value also contains some prefabricated menu elements and
// menus, that you can use instead of composing your own menu from
// scratch:
//
// **`insertMenu`**`: Dropdown`
//   : A dropdown containing the `insertImage` and
//     `insertHorizontalRule` items.
//
// **`typeMenu`**`: Dropdown`
//   : A dropdown containing the items for making the current
//     textblock a paragraph, code block, or heading.
//
// **`writerMenu`**`: Dropdown`
//   : A dropdown containing the items special to rokfor writer
//     marks, references and other containers
//
// **`fullMenu`**`: [[MenuElement]]`
//   : An array of arrays of menu elements for use as the full menu
//     for, for example the [menu bar](https://github.com/prosemirror/prosemirror-menu#user-content-menubar).
export function buildMenuItems(schema) {
  let r = {}, type
  if (type = schema.marks.strong)
    r.toggleStrong = markItem(type, {title: "Toggle strong style", icon: icons.strong})
  if (type = schema.marks.em)
    r.toggleEm = markItem(type, {title: "Toggle emphasis", icon: icons.em})
  if (type = schema.marks.code)
    r.toggleCode = markItem(type, {title: "Toggle code font", icon: icons.code})
  if (type = schema.marks.link)
    r.toggleLink = linkItem(type)

  if (type = schema.nodes.image)
    r.insertImage = insertImageItem(type)
  if (type = schema.nodes.bullet_list)
    r.wrapBulletList = wrapListItem(type, {
      title: "Wrap in bullet list",
      icon: icons.bulletList
    })
  if (type = schema.nodes.ordered_list)
    r.wrapOrderedList = wrapListItem(type, {
      title: "Wrap in ordered list",
      icon: icons.orderedList
    })
  if (type = schema.nodes.blockquote)
    r.wrapBlockQuote = wrapItem(type, {
      title: "Wrap in block quote",
      icon: icons.blockquote
    })
  if (type = schema.nodes.paragraph)
    r.makeParagraph = blockTypeItem(type, {
      title: "Change to paragraph",
      label: "Plain"
    })
  if (type = schema.nodes.code_block)
    r.makeCodeBlock = blockTypeItem(type, {
      title: "Change to monospaced block",
      label: "Monospaced"
    })
  if (type = schema.nodes.heading)
    for (let i = 1; i <= 10; i++)
      r["makeHead" + i] = blockTypeItem(type, {
        title: "Change to heading " + i,
        label: "Level " + i,
        attrs: {level: i}
      })
  if (type = schema.nodes.horizontal_rule) {
    let hr = type
    r.insertHorizontalRule = new MenuItem({
      title: "Insert Page Break",
      label: "Page Break",
      enable(state) { return canInsert(state, hr) },
      run(state, dispatch) { dispatch(state.tr.replaceSelectionWith(hr.create())) }
    })
  }

  if (type = schema.nodes.footnote)
    r.makeFootnote = wrapItem(type, {
      title: "Insert Footnote",
      label: "Footnote"
    })
  
  /*if (type = schema.nodes.footnote) {
    let fn = type
    r.makeFootnote = new MenuItem({
      title: "Insert Footnote",
      label: "Footnote",
      enable(state) { return canInsert(state, fn) },
      run(state, dispatch) {
        let {from, to} = state.selection
        let attrs = state.doc.textBetween(from, to, " ");
        dispatch(state.tr.replaceSelectionWith(fn.createAndFill(attrs)))
      }
    })
  }*/



  if (type = schema.nodes.latex)
    r.makeLaTex = wrapItem(type, {
      title: "Insert LaTex Source",
      label: "LaTex"
    })
  if (type = schema.nodes.comment)
    r.makeComment = wrapItem(type, {
      title: "Insert Comment",
      label: "Comment"
    })
  if (type = schema.nodes.paragraphalternate)
    r.makeAlternateParagraph = wrapItem(type, {
      title: "Insert alternate Style",
      label: "Alternate Style"
    })

  if (type = schema.nodes.language)
    r.toggleLanguage = languageItem(type)

  if (type = schema.marks.index)
    r.toggleIndex = markItem(type, {title: "Index", icon: icons.index})
  if (type = schema.marks.mark)
    r.toggleMark = addMarker(type)
  if (type = schema.marks.reference)
    r.toggleReference = markItem(type, {title: "Reference", icon: icons.reference})
  if (type = schema.marks.fn)
    r.toggleFn = markItem(type, {title: "Inline Footnote", icon: icons.fn})





  let cut = arr => arr.filter(x => x)
  
  r.insertMenu = new Dropdown(
    cut([r.insertImage, r.insertHorizontalRule]), 
    {label: "Insert"}
  )
  
  r.typeMenu = new Dropdown(
    cut([r.makeParagraph, r.makeCodeBlock, r.makeHead1 && new DropdownSubmenu(cut([
    r.makeHead1, r.makeHead2, r.makeHead3, r.makeHead4, r.makeHead5, r.makeHead6
    ]), 
    {label: "Heading"})]), 
    {label: "Type..."}
  )

  r.writerMenu = new Dropdown(cut([
    r.makeFootnote, 
    r.makeLaTex,
    r.makeComment,
    r.makeAlternateParagraph,
    r.toggleIndex,
    r.toggleMark,
    r.toggleReference,
    r.toggleFn,
    r.toggleLanguage 
  ]), {label: "Special"})


  r.inlineMenu = [cut([r.toggleStrong, r.toggleEm, r.toggleCode, r.toggleLink])]
  r.blockMenu = [cut([r.wrapBulletList, r.wrapOrderedList, r.wrapBlockQuote, joinUpItem,
                      liftItem, selectParentNodeItem])]
  r.fullMenu = r.inlineMenu.concat([[r.insertMenu, r.typeMenu, r.writerMenu]], [[undoItem, redoItem]], r.blockMenu)
  return r
}
