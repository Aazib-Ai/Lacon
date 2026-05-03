/**
 * SelectionPersist — TipTap extension that visually preserves the text
 * selection highlight when the editor loses focus.
 *
 * Problem: When the user clicks the FloatingAIBar (or any external UI),
 * the browser moves focus and the native `::selection` highlight disappears.
 * ProseMirror still tracks the selection internally, but visually it's gone.
 *
 * Solution: On blur, apply an inline Decoration over the selected range with
 * a CSS class that mimics the selection color. On focus, remove it so the
 * native selection takes over again.
 */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const selectionPersistKey = new PluginKey('selectionPersist')

export const SelectionPersist = Extension.create({
  name: 'selectionPersist',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: selectionPersistKey,

        state: {
          init() {
            return { blurred: false }
          },
          apply(tr, value) {
            const meta = tr.getMeta(selectionPersistKey)
            if (meta !== undefined) {
              return { blurred: meta.blurred }
            }
            return value
          },
        },

        props: {
          decorations(state) {
            const pluginState = selectionPersistKey.getState(state)
            if (!pluginState?.blurred) return DecorationSet.empty

            const { from, to } = state.selection
            if (from === to) return DecorationSet.empty

            return DecorationSet.create(state.doc, [
              Decoration.inline(from, to, {
                class: 'selection-persist',
              }),
            ])
          },

          handleDOMEvents: {
            blur(view) {
              // Small delay to let any mousedown preventDefault take effect
              requestAnimationFrame(() => {
                if (!view.hasFocus()) {
                  view.dispatch(
                    view.state.tr.setMeta(selectionPersistKey, { blurred: true }),
                  )
                }
              })
              return false
            },
            focus(view) {
              view.dispatch(
                view.state.tr.setMeta(selectionPersistKey, { blurred: false }),
              )
              return false
            },
          },
        },
      }),
    ]
  },
})
