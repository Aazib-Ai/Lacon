/**
 * Script Workflow Helpers - Phase 5
 * Quick-insert templates and formatting macros for script writing
 */

import type { Editor } from '@tiptap/core'

export interface ScriptTemplate {
  id: string
  name: string
  description: string
  content: string
}

/**
 * Common script templates
 */
export const scriptTemplates: ScriptTemplate[] = [
  {
    id: 'scene-heading',
    name: 'Scene Heading',
    description: 'INT./EXT. location - time',
    content: 'INT. LOCATION - DAY\n\n',
  },
  {
    id: 'action',
    name: 'Action',
    description: 'Scene description',
    content: '\n\n',
  },
  {
    id: 'character',
    name: 'Character',
    description: 'Character name',
    content: 'CHARACTER\n',
  },
  {
    id: 'dialogue',
    name: 'Dialogue',
    description: 'Character dialogue',
    content: 'CHARACTER\nDialogue text here.\n\n',
  },
  {
    id: 'parenthetical',
    name: 'Parenthetical',
    description: 'Action within dialogue',
    content: '(action)\n',
  },
  {
    id: 'transition',
    name: 'Transition',
    description: 'Scene transition',
    content: 'CUT TO:\n\n',
  },
  {
    id: 'shot',
    name: 'Shot',
    description: 'Camera shot description',
    content: 'CLOSE ON:\n\n',
  },
]

/**
 * YouTube script templates
 */
export const youtubeTemplates: ScriptTemplate[] = [
  {
    id: 'intro',
    name: 'Intro',
    description: 'Video introduction',
    content: '## INTRO\n\nHook: \n\nIntroduction: \n\n',
  },
  {
    id: 'main-point',
    name: 'Main Point',
    description: 'Key content section',
    content: '## MAIN POINT\n\nPoint: \n\nExplanation: \n\nExample: \n\n',
  },
  {
    id: 'b-roll-note',
    name: 'B-Roll Note',
    description: 'Visual cue marker',
    content: '[B-ROLL: description]\n\n',
  },
  {
    id: 'cta',
    name: 'Call to Action',
    description: 'Engagement prompt',
    content: '## CALL TO ACTION\n\nLike and subscribe\nComment below\nCheck description\n\n',
  },
  {
    id: 'outro',
    name: 'Outro',
    description: 'Video conclusion',
    content: '## OUTRO\n\nSummary: \n\nNext video teaser: \n\nSign-off: \n\n',
  },
]

/**
 * Insert script template at cursor
 */
export function insertScriptTemplate(editor: Editor, template: ScriptTemplate): void {
  editor.chain().focus().insertContent(template.content).run()
}

/**
 * Insert heading with specific level
 */
export function insertHeading(editor: Editor, level: 1 | 2 | 3 | 4 | 5 | 6, text?: string): void {
  if (text) {
    editor.chain().focus().insertContent(`<h${level}>${text}</h${level}>`).run()
  } else {
    ;(editor.chain().focus() as any).toggleHeading({ level }).run()
  }
}

/**
 * Insert scene marker
 */
export function insertSceneMarker(editor: Editor, sceneNumber: number, title?: string): void {
  const content = title ? `## Scene ${sceneNumber}: ${title}\n\n` : `## Scene ${sceneNumber}\n\n`
  editor.chain().focus().insertContent(content).run()
}

/**
 * Insert timestamp marker
 */
export function insertTimestamp(editor: Editor, timestamp?: string): void {
  const time = timestamp || new Date().toLocaleTimeString()
  editor.chain().focus().insertContent(`[${time}] `).run()
}

/**
 * Insert note/comment
 */
export function insertNote(editor: Editor, noteText?: string): void {
  const content = noteText ? `**Note:** ${noteText}\n\n` : `**Note:** \n\n`
  editor.chain().focus().insertContent(content).run()
}

/**
 * Format selection as uppercase (for character names)
 */
export function formatAsCharacterName(editor: Editor): void {
  const { from, to } = editor.state.selection
  const text = editor.state.doc.textBetween(from, to)
  if (text) {
    editor.chain().focus().deleteRange({ from, to }).insertContent(text.toUpperCase()).run()
  }
}

/**
 * Quick formatting macros
 */
export const formattingMacros = {
  /**
   * Convert line to scene heading
   */
  toSceneHeading: (editor: Editor) => {
    const { from } = editor.state.selection
    const $pos = editor.state.doc.resolve(from)
    const line = $pos.parent.textContent
    const formatted = line.toUpperCase()
    editor.chain().focus().deleteRange({ from: $pos.start(), to: $pos.end() }).insertContent(formatted).run()
  },

  /**
   * Convert line to character name
   */
  toCharacterName: (editor: Editor) => {
    formatAsCharacterName(editor)
  },

  /**
   * Wrap selection in parentheses
   */
  toParenthetical: (editor: Editor) => {
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to)
    if (text) {
      editor.chain().focus().deleteRange({ from, to }).insertContent(`(${text})`).run()
    }
  },

  /**
   * Insert horizontal rule as scene break
   */
  insertSceneBreak: (editor: Editor) => {
    ;(editor.chain().focus() as any).setHorizontalRule().run()
  },
}
