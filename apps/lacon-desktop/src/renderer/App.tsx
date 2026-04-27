import React, { useEffect, useState } from 'react'

import { AppShell } from './components/AppShell'
import { Editor } from './components/Editor'
import { ModernEditorDemo } from './components/ModernEditorDemo'
import { ThemeProvider } from './contexts/ThemeContext'
import { useDocument } from './hooks/useDocument'
import { usePhase12 } from './hooks/usePhase12'

function App() {
  // Toggle between old and new editor
  const [useModernEditor, setUseModernEditor] = useState(true)

  return (
    <ThemeProvider>
      {useModernEditor ? (
        <ModernEditorDemo />
      ) : (
        <AppContent />
      )}
    </ThemeProvider>
  )
}

function AppContent() {
  const { currentDocument, isDirty, error, createDocument, updateContent, markDirty } = useDocument()
  const { state: phase12State, summary, bootstrapDocument, pushPresence, queueSyncChange } = usePhase12()

  // Mock documents list for sidebar (will be replaced with real data)
  const [documents] = useState([
    {
      id: '1',
      title: 'Welcome to LACON',
      updatedAt: new Date(),
    },
  ])

  // Mock messages for assistant panel (will be replaced with real data)
  const [messages] = useState([
    {
      id: '1',
      role: 'assistant' as const,
      content: "Hello! I'm your AI assistant. How can I help you today?",
      timestamp: new Date(),
    },
  ])

  const [wordCount, setWordCount] = useState(0)

  // Calculate word count from editor content
  useEffect(() => {
    if (currentDocument?.content) {
      const text = extractTextFromContent(currentDocument.content)
      const words = text
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 0)
      setWordCount(words.length)
    }
  }, [currentDocument?.content])

  useEffect(() => {
    if (!currentDocument) {
      return
    }

    bootstrapDocument(currentDocument.metadata.id)
  }, [bootstrapDocument, currentDocument])

  const handleNew = async () => {
    if (isDirty) {
      const confirm = window.confirm('You have unsaved changes. Create new document anyway?')
      if (!confirm) {
        return
      }
    }
    try {
      await createDocument('Untitled')
    } catch (err) {
      console.error('Create failed:', err)
    }
  }

  const handleSendMessage = (content: string) => {
    console.log('Send message:', content)
    // Will be implemented in Phase 6
  }

  if (!currentDocument) {
    return (
      <AppShell documents={documents} onNewDocument={handleNew} messages={messages} onSendMessage={handleSendMessage}>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Loading...</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      documents={documents}
      currentDocumentId={currentDocument.metadata.id}
      onDocumentSelect={id => console.log('Select document:', id)}
      onNewDocument={handleNew}
      messages={messages}
      onSendMessage={handleSendMessage}
      statusBarProps={{
        wordCount,
        speakingDuration: Math.floor((wordCount / 150) * 60), // ~150 words per minute
        providerStatus: 'idle' as const,
      }}
    >
      {error && (
        <div
          style={{
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            backgroundColor: 'var(--color-errorBg)',
            color: 'var(--color-error)',
            borderRadius: '4px',
          }}
          role="alert"
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        <button
          type="button"
          onClick={() =>
            pushPresence({
              documentId: currentDocument.metadata.id,
              userId: 'owner-session',
              cursorPos: 0,
            })
          }
        >
          Presence: {summary.collaborators}
        </button>
        <button
          type="button"
          onClick={() => queueSyncChange({ documentId: currentDocument.metadata.id, plainPayload: 'update' })}
        >
          Sync Queue: {summary.queuedSync}
        </button>
        <div>Sync Rev: {summary.latestSyncRevision}</div>
        <div>SOC2 Controls: {summary.complianceControls}</div>
      </div>

      {phase12State.error && (
        <div
          style={{
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            backgroundColor: 'var(--color-warningBg, #fff8e1)',
            color: 'var(--color-warningText, #7a5a00)',
            borderRadius: '4px',
          }}
          role="alert"
        >
          {phase12State.error}
        </div>
      )}

      <Editor content={currentDocument.content} onChange={updateContent} onDirty={markDirty} />
    </AppShell>
  )
}

// Helper to extract text from TipTap JSON content
function extractTextFromContent(content: any): string {
  if (!content) {
    return ''
  }

  if (typeof content === 'string') {
    return content
  }

  if (content.text) {
    return content.text
  }

  if (content.content && Array.isArray(content.content)) {
    return content.content.map(extractTextFromContent).join(' ')
  }

  return ''
}

export default App
