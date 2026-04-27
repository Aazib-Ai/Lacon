/**
 * Paragraph Identity Extension — Phase 0 Prototype
 *
 * Assigns a stable unique ID to every block-level node (paragraph, heading)
 * in the TipTap/ProseMirror document.  These IDs are used for:
 *
 * 1. Surgical paragraph-level AI edits — "fix paragraph X" targets by ID.
 * 2. Snapshot restore — re-map old snapshot content to current paragraphs.
 * 3. Research citation linkage — tie a citation to a specific paragraph.
 *
 * IDs are stored as node attributes and persist through serialisation.
 */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export const paragraphIdPluginKey = new PluginKey('paragraphId')

let counter = 0

function generateParagraphId(): string {
  counter += 1
  return `p-${Date.now().toString(36)}-${counter.toString(36)}`
}

/**
 * Extracts an ordered list of { id, text, type } from a TipTap JSON doc,
 * giving each block-level node a stable identity.
 */
export interface ParagraphIdentity {
  id: string
  type: string
  text: string
  pos: number
}

export function extractParagraphIdentities(doc: any): ParagraphIdentity[] {
  const result: ParagraphIdentity[] = []
  if (!doc || !doc.content) return result

  let pos = 1 // ProseMirror positions start at 1 for the first child

  for (const node of doc.content) {
    const id = node.attrs?.paragraphId || generateParagraphId()
    const text = extractText(node)
    result.push({ id, type: node.type, text, pos })
    // advance pos past this node (nodeSize approximation for planning)
    pos += textLength(node) + 2 // +2 for open/close tokens
  }

  return result
}

/**
 * Creates a snapshot of paragraph identities that can be compared against
 * a later version of the document to detect drift.
 */
export interface ParagraphSnapshot {
  timestamp: number
  paragraphs: ParagraphIdentity[]
}

export function createParagraphSnapshot(doc: any): ParagraphSnapshot {
  return {
    timestamp: Date.now(),
    paragraphs: extractParagraphIdentities(doc),
  }
}

/**
 * Given an old snapshot and the current document, returns a mapping of
 * old paragraph IDs to current paragraph IDs.  Used for snapshot restore.
 */
export function mapSnapshotToCurrent(
  snapshot: ParagraphSnapshot,
  currentDoc: any,
): Map<string, string> {
  const currentIds = extractParagraphIdentities(currentDoc)
  const mapping = new Map<string, string>()

  for (let i = 0; i < snapshot.paragraphs.length; i++) {
    const snapshotP = snapshot.paragraphs[i]
    // Try exact ID match first
    const exactMatch = currentIds.find((c) => c.id === snapshotP.id)
    if (exactMatch) {
      mapping.set(snapshotP.id, exactMatch.id)
      continue
    }
    // Fallback: position-based match (same index)
    if (i < currentIds.length) {
      mapping.set(snapshotP.id, currentIds[i].id)
    }
  }

  return mapping
}

// ── Helpers ──

function extractText(node: any): string {
  if (!node) return ''
  if (node.text) return node.text
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractText).join('')
  }
  return ''
}

function textLength(node: any): number {
  return extractText(node).length
}

// ── TipTap Extension ──

export const ParagraphId = Extension.create({
  name: 'paragraphId',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'blockquote', 'codeBlock'],
        attributes: {
          paragraphId: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              element.getAttribute('data-paragraph-id'),
            renderHTML: (attributes: Record<string, any>) => {
              if (!attributes.paragraphId) return {}
              return { 'data-paragraph-id': attributes.paragraphId }
            },
          },
        },
      },
    ]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: paragraphIdPluginKey,

        appendTransaction(_transactions, _oldState, newState) {
          let modified = false
          const tr = newState.tr

          newState.doc.descendants((node, pos) => {
            if (
              node.isBlock &&
              node.type.spec.attrs?.paragraphId !== undefined &&
              !node.attrs.paragraphId
            ) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                paragraphId: generateParagraphId(),
              })
              modified = true
            }
          })

          return modified ? tr : null
        },
      }),
    ]
  },
})

export default ParagraphId
