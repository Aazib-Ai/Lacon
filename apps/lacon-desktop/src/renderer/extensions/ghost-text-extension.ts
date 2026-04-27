/**
 * Ghost Text TipTap Extension — Phase 0 Prototype
 *
 * Renders AI-generated suggestions as translucent "ghost" text appended
 * at the current cursor position.  The user accepts with Tab and rejects
 * with Escape.
 *
 * This is a TipTap Decoration plugin — it does NOT insert real content
 * into the ProseMirror document until the user accepts.
 */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

// ── Public plugin key so other code can read the current ghost state ──
export const ghostTextPluginKey = new PluginKey('ghostText')

export interface GhostTextState {
  /** Position (ProseMirror absolute pos) where the ghost starts */
  pos: number | null
  /** The suggested text to show as ghost */
  text: string | null
  /** Whether the ghost is currently visible */
  active: boolean
}

const INITIAL_STATE: GhostTextState = {
  pos: null,
  text: null,
  active: false,
}

/**
 * TipTap extension that manages ghost text decorations.
 *
 * Usage:
 * ```ts
 * import { GhostText } from './ghost-text-extension'
 *
 * const editor = useEditor({
 *   extensions: [StarterKit, GhostText],
 * })
 *
 * // Show a suggestion
 * editor.commands.showGhostText('suggested continuation here')
 *
 * // Accept (also bound to Tab)
 * editor.commands.acceptGhostText()
 *
 * // Reject (also bound to Escape)
 * editor.commands.rejectGhostText()
 * ```
 */
export const GhostText = Extension.create({
  name: 'ghostText',

  addCommands() {
    return {
      showGhostText:
        (text: string) =>
        ({ tr, dispatch }) => {
          if (!dispatch) return false
          const pos = tr.selection.from
          dispatch(
            tr.setMeta(ghostTextPluginKey, {
              type: 'show',
              pos,
              text,
            }),
          )
          return true
        },

      acceptGhostText:
        () =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return false
          const pluginState: GhostTextState =
            ghostTextPluginKey.getState(state) ?? INITIAL_STATE
          if (!pluginState.active || pluginState.pos == null || !pluginState.text) {
            return false
          }
          // Insert the ghost text as real content
          dispatch(
            tr
              .insertText(pluginState.text, pluginState.pos)
              .setMeta(ghostTextPluginKey, { type: 'clear' }),
          )
          return true
        },

      rejectGhostText:
        () =>
        ({ tr, dispatch }) => {
          if (!dispatch) return false
          dispatch(tr.setMeta(ghostTextPluginKey, { type: 'clear' }))
          return true
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => editor.commands.acceptGhostText(),
      Escape: ({ editor }) => editor.commands.rejectGhostText(),
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: ghostTextPluginKey,

        state: {
          init(): GhostTextState {
            return { ...INITIAL_STATE }
          },

          apply(tr, prev): GhostTextState {
            const meta = tr.getMeta(ghostTextPluginKey)
            if (meta) {
              if (meta.type === 'show') {
                return { pos: meta.pos, text: meta.text, active: true }
              }
              if (meta.type === 'clear') {
                return { ...INITIAL_STATE }
              }
            }
            // If the document changed (user typed), dismiss the ghost
            if (tr.docChanged) {
              return { ...INITIAL_STATE }
            }
            return prev
          },
        },

        props: {
          decorations(state) {
            const pluginState: GhostTextState =
              ghostTextPluginKey.getState(state) ?? INITIAL_STATE

            if (!pluginState.active || pluginState.pos == null || !pluginState.text) {
              return DecorationSet.empty
            }

            const widget = Decoration.widget(
              pluginState.pos,
              () => {
                const span = document.createElement('span')
                span.className = 'ghost-text-suggestion'
                span.textContent = pluginState.text!
                span.setAttribute('data-ghost', 'true')
                return span
              },
              { side: 1 },
            )

            return DecorationSet.create(state.doc, [widget])
          },
        },
      }),
    ]
  },
})

export default GhostText
