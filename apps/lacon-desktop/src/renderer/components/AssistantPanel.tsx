/**
 * Assistant Panel Component - Phase 4
 * Right panel for AI conversation and tool outputs
 */

import React, { useEffect, useRef, useState } from 'react'

import { useTheme } from '../contexts/ThemeContext'
import { borderRadius, spacing, typography } from '../design-system/tokens'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  toolOutputs?: ToolOutput[]
}

interface ToolOutput {
  toolName: string
  status: 'pending' | 'success' | 'error'
  output?: string
  error?: string
}

interface AssistantPanelProps {
  messages: Message[]
  onSendMessage: (content: string) => void
  isStreaming?: boolean
  onApproveAction?: (messageId: string) => void
  onRejectAction?: (messageId: string) => void
}

export function AssistantPanel({
  messages,
  onSendMessage,
  isStreaming = false,
  onApproveAction,
  onRejectAction,
}: AssistantPanelProps) {
  const { theme } = useTheme()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && !isStreaming) {
      onSendMessage(input.trim())
      setInput('')
    }
  }

  return (
    <aside
      style={{
        width: '400px',
        height: '100%',
        backgroundColor: theme.colors.bgSecondary,
        borderLeft: `1px solid ${theme.colors.borderPrimary}`,
        display: 'flex',
        flexDirection: 'column',
      }}
      role="complementary"
      aria-label="AI Assistant"
    >
      {/* Header */}
      <div
        style={{
          padding: spacing[4],
          borderBottom: `1px solid ${theme.colors.borderPrimary}`,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: typography.fontSize.lg,
            fontWeight: typography.fontWeight.semibold,
            color: theme.colors.textPrimary,
          }}
        >
          AI Assistant
        </h2>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: spacing[4],
          display: 'flex',
          flexDirection: 'column',
          gap: spacing[4],
        }}
        role="log"
        aria-live="polite"
        aria-label="Conversation"
      >
        {messages.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: theme.colors.textSecondary,
              fontSize: typography.fontSize.sm,
              padding: spacing[8],
            }}
          >
            Start a conversation with the AI assistant
          </div>
        ) : (
          messages.map(message => (
            <MessageBubble
              key={message.id}
              message={message}
              theme={theme}
              onApprove={onApproveAction}
              onReject={onRejectAction}
            />
          ))
        )}
        {isStreaming && (
          <div
            style={{
              padding: spacing[3],
              color: theme.colors.textSecondary,
              fontSize: typography.fontSize.sm,
            }}
          >
            <span className="streaming-indicator">●</span> Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        style={{
          padding: spacing[4],
          borderTop: `1px solid ${theme.colors.borderPrimary}`,
        }}
      >
        <div style={{ display: 'flex', gap: spacing[2] }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask the assistant..."
            disabled={isStreaming}
            style={{
              flex: 1,
              padding: `${spacing[2]} ${spacing[3]}`,
              backgroundColor: theme.colors.bgPrimary,
              color: theme.colors.textPrimary,
              border: `1px solid ${theme.colors.borderPrimary}`,
              borderRadius: borderRadius.md,
              fontSize: typography.fontSize.sm,
              outline: 'none',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = theme.colors.borderFocus
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = theme.colors.borderPrimary
            }}
            aria-label="Message input"
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            style={{
              padding: `${spacing[2]} ${spacing[4]}`,
              backgroundColor: theme.colors.primary,
              color: theme.colors.textInverse,
              border: 'none',
              borderRadius: borderRadius.md,
              fontSize: typography.fontSize.sm,
              fontWeight: typography.fontWeight.medium,
              cursor: input.trim() && !isStreaming ? 'pointer' : 'not-allowed',
              opacity: input.trim() && !isStreaming ? 1 : 0.6,
              transition: 'background-color 200ms',
            }}
            onMouseEnter={e => {
              if (input.trim() && !isStreaming) {
                e.currentTarget.style.backgroundColor = theme.colors.primaryHover
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = theme.colors.primary
            }}
            aria-label="Send message"
          >
            Send
          </button>
        </div>
      </form>
    </aside>
  )
}

interface MessageBubbleProps {
  message: Message
  theme: any
  onApprove?: (messageId: string) => void
  onReject?: (messageId: string) => void
}

function MessageBubble({ message, theme, onApprove, onReject }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        style={{
          maxWidth: '85%',
          padding: spacing[3],
          backgroundColor: isUser ? theme.colors.primary : theme.colors.bgPrimary,
          color: isUser ? theme.colors.textInverse : theme.colors.textPrimary,
          borderRadius: borderRadius.lg,
          fontSize: typography.fontSize.sm,
          lineHeight: typography.lineHeight.normal,
          wordWrap: 'break-word',
        }}
      >
        {message.content}
      </div>

      {/* Tool outputs */}
      {message.toolOutputs && message.toolOutputs.length > 0 && (
        <div
          style={{
            marginTop: spacing[2],
            display: 'flex',
            flexDirection: 'column',
            gap: spacing[2],
            width: '100%',
          }}
        >
          {message.toolOutputs.map((tool, idx) => (
            <ToolOutputCard key={idx} tool={tool} theme={theme} />
          ))}
        </div>
      )}

      {/* Action buttons for assistant messages requiring approval */}
      {!isUser && onApprove && onReject && (
        <div style={{ marginTop: spacing[2], display: 'flex', gap: spacing[2] }}>
          <button
            onClick={() => onApprove(message.id)}
            style={{
              padding: `${spacing[1]} ${spacing[3]}`,
              backgroundColor: theme.colors.success,
              color: theme.colors.textInverse,
              border: 'none',
              borderRadius: borderRadius.md,
              fontSize: typography.fontSize.xs,
              cursor: 'pointer',
            }}
          >
            Approve
          </button>
          <button
            onClick={() => onReject(message.id)}
            style={{
              padding: `${spacing[1]} ${spacing[3]}`,
              backgroundColor: theme.colors.error,
              color: theme.colors.textInverse,
              border: 'none',
              borderRadius: borderRadius.md,
              fontSize: typography.fontSize.xs,
              cursor: 'pointer',
            }}
          >
            Reject
          </button>
        </div>
      )}

      <div
        style={{
          marginTop: spacing[1],
          fontSize: typography.fontSize.xs,
          color: theme.colors.textTertiary,
        }}
      >
        {new Date(message.timestamp).toLocaleTimeString()}
      </div>
    </div>
  )
}

interface ToolOutputCardProps {
  tool: ToolOutput
  theme: any
}

function ToolOutputCard({ tool, theme }: ToolOutputCardProps) {
  const statusColors = {
    pending: theme.colors.info,
    success: theme.colors.success,
    error: theme.colors.error,
  }

  return (
    <div
      style={{
        padding: spacing[3],
        backgroundColor: theme.colors.bgPrimary,
        border: `1px solid ${theme.colors.borderPrimary}`,
        borderRadius: borderRadius.md,
        fontSize: typography.fontSize.xs,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing[2],
          marginBottom: spacing[2],
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: statusColors[tool.status],
          }}
          aria-label={`Status: ${tool.status}`}
        />
        <span
          style={{
            fontWeight: typography.fontWeight.semibold,
            color: theme.colors.textPrimary,
          }}
        >
          {tool.toolName}
        </span>
      </div>
      {tool.output && (
        <pre
          style={{
            margin: 0,
            fontSize: typography.fontSize.xs,
            color: theme.colors.textSecondary,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}
        >
          {tool.output}
        </pre>
      )}
      {tool.error && <div style={{ color: theme.colors.error, marginTop: spacing[1] }}>{tool.error}</div>}
    </div>
  )
}
