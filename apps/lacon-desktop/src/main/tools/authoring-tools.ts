/**
 * In-Editor Authoring Tools
 * Phase 8: Epic P8-E1
 */

import type { ToolContract } from '../../shared/agent-types'
import type { AuthoringToolInput, AuthoringToolOutput, AuthoringToolType } from '../../shared/tool-types'

/**
 * P8-T1.1: Rewrite selected text
 */
export function createRewriteTool(
  executeTransform: (text: string, instruction: string) => Promise<string>,
): ToolContract<AuthoringToolInput, AuthoringToolOutput> {
  return {
    name: 'rewrite-text',
    description: 'Rewrite selected text with optional instruction',
    riskLevel: 'low',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        instruction: { type: 'string' },
        insertionMode: { type: 'string', enum: ['replace', 'insert-below', 'preview'] },
      },
      required: ['text', 'insertionMode'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        originalText: { type: 'string' },
        transformedText: { type: 'string' },
        insertionMode: { type: 'string' },
        metadata: { type: 'object' },
      },
    },
    errorSchema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    async execute(input: AuthoringToolInput): Promise<AuthoringToolOutput> {
      const instruction = input.instruction || 'Rewrite this text to improve clarity and readability'
      const transformedText = await executeTransform(input.text, instruction)

      return {
        originalText: input.text,
        transformedText,
        insertionMode: input.insertionMode,
        metadata: {
          originalLength: input.text.length,
          transformedLength: transformedText.length,
          transformationType: 'rewrite' as AuthoringToolType,
        },
      }
    },
    timeout: 30000,
  }
}

/**
 * P8-T1.1: Shorten selected text
 */
export function createShortenTool(
  executeTransform: (text: string, instruction: string) => Promise<string>,
): ToolContract<AuthoringToolInput, AuthoringToolOutput> {
  return {
    name: 'shorten-text',
    description: 'Shorten selected text while preserving key information',
    riskLevel: 'low',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        targetLength: { type: 'number' },
        insertionMode: { type: 'string', enum: ['replace', 'insert-below', 'preview'] },
      },
      required: ['text', 'insertionMode'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        originalText: { type: 'string' },
        transformedText: { type: 'string' },
        insertionMode: { type: 'string' },
        metadata: { type: 'object' },
      },
    },
    errorSchema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    async execute(input: AuthoringToolInput): Promise<AuthoringToolOutput> {
      const targetLength = input.targetLength || Math.floor(input.text.length * 0.7)
      const instruction = `Shorten this text to approximately ${targetLength} characters while preserving key information`
      const transformedText = await executeTransform(input.text, instruction)

      return {
        originalText: input.text,
        transformedText,
        insertionMode: input.insertionMode,
        metadata: {
          originalLength: input.text.length,
          transformedLength: transformedText.length,
          transformationType: 'shorten' as AuthoringToolType,
        },
      }
    },
    timeout: 30000,
  }
}

/**
 * P8-T1.1: Expand selected text
 */
export function createExpandTool(
  executeTransform: (text: string, instruction: string) => Promise<string>,
): ToolContract<AuthoringToolInput, AuthoringToolOutput> {
  return {
    name: 'expand-text',
    description: 'Expand selected text with more detail and examples',
    riskLevel: 'low',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        targetLength: { type: 'number' },
        insertionMode: { type: 'string', enum: ['replace', 'insert-below', 'preview'] },
      },
      required: ['text', 'insertionMode'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        originalText: { type: 'string' },
        transformedText: { type: 'string' },
        insertionMode: { type: 'string' },
        metadata: { type: 'object' },
      },
    },
    errorSchema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    async execute(input: AuthoringToolInput): Promise<AuthoringToolOutput> {
      const targetLength = input.targetLength || Math.floor(input.text.length * 1.5)
      const instruction = `Expand this text to approximately ${targetLength} characters with more detail, examples, and elaboration`
      const transformedText = await executeTransform(input.text, instruction)

      return {
        originalText: input.text,
        transformedText,
        insertionMode: input.insertionMode,
        metadata: {
          originalLength: input.text.length,
          transformedLength: transformedText.length,
          transformationType: 'expand' as AuthoringToolType,
        },
      }
    },
    timeout: 30000,
  }
}

/**
 * P8-T1.1: Polish selected text
 */
export function createPolishTool(
  executeTransform: (text: string, instruction: string) => Promise<string>,
): ToolContract<AuthoringToolInput, AuthoringToolOutput> {
  return {
    name: 'polish-text',
    description: 'Polish selected text for grammar, style, and clarity',
    riskLevel: 'low',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        tone: { type: 'string', enum: ['professional', 'casual', 'friendly', 'formal', 'creative'] },
        insertionMode: { type: 'string', enum: ['replace', 'insert-below', 'preview'] },
      },
      required: ['text', 'insertionMode'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        originalText: { type: 'string' },
        transformedText: { type: 'string' },
        insertionMode: { type: 'string' },
        metadata: { type: 'object' },
      },
    },
    errorSchema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    async execute(input: AuthoringToolInput): Promise<AuthoringToolOutput> {
      const tone = input.tone || 'professional'
      const instruction = `Polish this text for grammar, style, and clarity with a ${tone} tone`
      const transformedText = await executeTransform(input.text, instruction)

      return {
        originalText: input.text,
        transformedText,
        insertionMode: input.insertionMode,
        metadata: {
          originalLength: input.text.length,
          transformedLength: transformedText.length,
          transformationType: 'polish' as AuthoringToolType,
        },
      }
    },
    timeout: 30000,
  }
}

/**
 * P8-T1.4: Tone-adjust selected text
 */
export function createToneAdjustTool(
  executeTransform: (text: string, instruction: string) => Promise<string>,
): ToolContract<AuthoringToolInput, AuthoringToolOutput> {
  return {
    name: 'tone-adjust',
    description: 'Adjust the tone of selected text',
    riskLevel: 'low',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        tone: { type: 'string', enum: ['professional', 'casual', 'friendly', 'formal', 'creative'] },
        insertionMode: { type: 'string', enum: ['replace', 'insert-below', 'preview'] },
      },
      required: ['text', 'tone', 'insertionMode'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        originalText: { type: 'string' },
        transformedText: { type: 'string' },
        insertionMode: { type: 'string' },
        metadata: { type: 'object' },
      },
    },
    errorSchema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
    async execute(input: AuthoringToolInput): Promise<AuthoringToolOutput> {
      const instruction = `Adjust the tone of this text to be ${input.tone} while preserving the core message`
      const transformedText = await executeTransform(input.text, instruction)

      return {
        originalText: input.text,
        transformedText,
        insertionMode: input.insertionMode,
        metadata: {
          originalLength: input.text.length,
          transformedLength: transformedText.length,
          transformationType: 'tone-adjust' as AuthoringToolType,
        },
      }
    },
    timeout: 30000,
  }
}
