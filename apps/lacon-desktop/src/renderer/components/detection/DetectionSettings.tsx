/**
 * DetectionSettings — API key management panel for external AI detection providers.
 *
 * Follows the AddProviderForm pattern from ProviderSettings.tsx.
 * Supports Sapling.ai and Winston AI with BYOK (Bring Your Own Key).
 */

import {
  ArrowLeft,
  Check,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Plus,
  Shield,
  Trash2,
  X,
} from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'

import type { DetectionApiProvider } from '../../../shared/detection-types'
import { cn } from '../../lib/utils'

interface ApiKeyMeta {
  exists: boolean
  label?: string
  provider: DetectionApiProvider
  createdAt?: number
}

interface DetectionSettingsProps {
  onClose: () => void
  onKeysChanged: () => void
}

const PROVIDERS: Array<{
  value: DetectionApiProvider
  label: string
  hint: string
  signupUrl: string
  freeCredits: string
}> = [
  {
    value: 'sapling',
    label: 'Sapling.ai',
    hint: 'Your Sapling API key',
    signupUrl: 'https://sapling.ai/signup',
    freeCredits: '50K chars/day free',
  },
  {
    value: 'winston',
    label: 'Winston AI',
    hint: 'Your Winston API key',
    signupUrl: 'https://gowinston.ai/signup',
    freeCredits: '2,500 free credits on signup',
  },
]

export function DetectionSettings({ onClose, onKeysChanged }: DetectionSettingsProps) {
  const [keys, setKeys] = useState<Record<DetectionApiProvider, ApiKeyMeta | null>>({
    sapling: null,
    winston: null,
  })
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadKeys = useCallback(async () => {
    setLoading(true)
    try {
      const [sapRes, winRes] = await Promise.all([
        (window as any).electron.detection.getApiKey({ provider: 'sapling' }),
        (window as any).electron.detection.getApiKey({ provider: 'winston' }),
      ])
      setKeys({
        sapling: sapRes?.success ? sapRes.data : null,
        winston: winRes?.success ? winRes.data : null,
      })
    } catch (err) {
      console.error('Failed to load detection keys:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadKeys()
  }, [loadKeys])

  const handleDelete = async (provider: DetectionApiProvider) => {
    if (!confirm(`Remove your ${provider === 'sapling' ? 'Sapling' : 'Winston AI'} API key?`)) return
    try {
      await (window as any).electron.detection.deleteApiKey({ provider })
      await loadKeys()
      onKeysChanged()
    } catch {
      alert('Failed to delete key')
    }
  }

  const configuredProviders = PROVIDERS.filter(p => keys[p.value]?.exists)
  const unconfiguredProviders = PROVIDERS.filter(p => !keys[p.value]?.exists)

  return (
    <div className="flex flex-col h-full animate-fade-in" id="detection-settings">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border flex-shrink-0">
        <button
          onClick={onClose}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Shield className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold tracking-tight">Detection API Keys</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : showAddForm ? (
          <AddKeyForm
            availableProviders={unconfiguredProviders.map(p => p.value)}
            onSuccess={() => {
              setShowAddForm(false)
              loadKeys()
              onKeysChanged()
            }}
            onCancel={() => setShowAddForm(false)}
          />
        ) : (
          <>
            {/* Info banner */}
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10 text-[11px] text-muted-foreground">
              <Key className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
              <span>
                Add an AI detection API key for professional-grade accuracy.
                Keys are encrypted in your OS keystore and never leave this device.
              </span>
            </div>

            {/* Configured keys */}
            {configuredProviders.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  Configured
                </span>
                {configuredProviders.map(p => {
                  const meta = keys[p.value]
                  return (
                    <div
                      key={p.value}
                      className="rounded-lg border border-border p-3 hover:border-border/80 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                          <span className="text-sm font-semibold">{p.label}</span>
                        </div>
                        <button
                          onClick={() => handleDelete(p.value)}
                          className="px-2 py-1 text-[11px] font-medium rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                          title="Remove key"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {meta?.label || 'API key configured'}
                      </div>
                      {meta?.createdAt && (
                        <div className="text-[10px] text-muted-foreground/50 mt-0.5">
                          Added {new Date(meta.createdAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add button */}
            {unconfiguredProviders.length > 0 && (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Detection Provider
              </button>
            )}

            {/* No providers state */}
            {configuredProviders.length === 0 && (
              <div className="text-center py-6">
                <Shield className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground mb-1">No detection API configured</p>
                <p className="text-xs text-muted-foreground/70 max-w-[220px] mx-auto leading-relaxed">
                  Add a Sapling or Winston AI key for 99%+ accurate AI text detection.
                </p>
              </div>
            )}

            {/* Free credits info */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                Free Credits
              </span>
              {PROVIDERS.map(p => (
                <div
                  key={p.value}
                  className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-muted/50 text-[11px]"
                >
                  <div>
                    <span className="font-medium text-foreground">{p.label}</span>
                    <span className="text-muted-foreground ml-1.5">— {p.freeCredits}</span>
                  </div>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      ;(window as any).electron?.shell?.openExternal?.(p.signupUrl)
                        || window.open(p.signupUrl, '_blank')
                    }}
                    className="flex items-center gap-1 text-primary hover:underline font-medium"
                  >
                    Sign up <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────── */
/*  Add Key Form (inline)                         */
/* ────────────────────────────────────────────── */

interface AddKeyFormProps {
  availableProviders: DetectionApiProvider[]
  onSuccess: () => void
  onCancel: () => void
}

function AddKeyForm({ availableProviders, onSuccess, onCancel }: AddKeyFormProps) {
  const [provider, setProvider] = useState<DetectionApiProvider>(availableProviders[0] || 'sapling')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [phase, setPhase] = useState<'form' | 'testing' | 'success' | 'error'>('form')
  const [message, setMessage] = useState('')
  const [latency, setLatency] = useState<number | null>(null)

  const providerInfo = PROVIDERS.find(p => p.value === provider)!

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPhase('testing')
    setMessage('Testing API key...')
    setLatency(null)

    try {
      // Test the key first
      const testResult = await (window as any).electron.detection.testApiKey({
        provider,
        apiKey,
      })

      if (testResult?.success && testResult.data?.success) {
        setLatency(testResult.data.latencyMs)

        // Key works — save it
        setMessage('Saving key...')
        await (window as any).electron.detection.setApiKey({
          provider,
          apiKey,
          label: `${providerInfo.label} API Key`,
        })

        setPhase('success')
        setMessage(`Connected to ${providerInfo.label}!`)
        setTimeout(() => onSuccess(), 1500)
      } else {
        const errMsg = testResult?.data?.error || 'Could not verify API key'
        setPhase('error')
        setMessage(errMsg)
      }
    } catch (err) {
      setPhase('error')
      setMessage(err instanceof Error ? err.message : 'Failed to test key')
    }
  }

  const inputCls =
    'w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all'

  // Validation result screen
  if (phase === 'testing' || phase === 'success' || phase === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center animate-fade-in">
        {phase === 'testing' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Loader2 className="h-7 w-7 text-primary animate-spin" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Validating</p>
            <p className="text-xs text-muted-foreground">{message}</p>
          </>
        )}
        {phase === 'success' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
              <Check className="h-7 w-7 text-emerald-500" />
            </div>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Connected!</p>
            <p className="text-xs text-muted-foreground">{message}</p>
            {latency && (
              <p className="text-[11px] text-muted-foreground mt-1">Latency: {latency}ms</p>
            )}
          </>
        )}
        {phase === 'error' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
              <X className="h-7 w-7 text-destructive" />
            </div>
            <p className="text-sm font-semibold text-destructive mb-1">Verification Failed</p>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-[240px]">{message}</p>
            <button
              onClick={() => setPhase('form')}
              className="mt-4 px-4 py-1.5 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Try Again
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={onCancel}
          className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-semibold">Add Detection Provider</h3>
      </div>

      {/* Provider-specific signup link */}
      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-[11px] text-emerald-700 dark:text-emerald-400 mb-3">
        <Shield className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium mb-0.5">{providerInfo.freeCredits}</p>
          <p className="text-muted-foreground">
            Sign up at{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                ;(window as any).electron?.shell?.openExternal?.(providerInfo.signupUrl)
                  || window.open(providerInfo.signupUrl, '_blank')
              }}
              className="text-primary hover:underline font-medium"
            >
              {providerInfo.label}
            </a>
            {' '}to get your free API key.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Provider selector */}
        {availableProviders.length > 1 && (
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1">
              Provider
            </label>
            <div className="relative">
              <select
                value={provider}
                onChange={e => setProvider(e.target.value as DetectionApiProvider)}
                className={cn(inputCls, 'appearance-none pr-8')}
              >
                {availableProviders.map(v => {
                  const p = PROVIDERS.find(pr => pr.value === v)!
                  return (
                    <option key={v} value={v}>
                      {p.label}
                    </option>
                  )
                })}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        )}

        {/* API key input */}
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
            API Key <span className="text-emerald-500 ml-1">🔐 encrypted</span>
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={providerInfo.hint}
              required
              className={cn(inputCls, 'pr-9')}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showKey ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-3 py-2 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!apiKey.trim()}
            className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save & Test
          </button>
        </div>
      </form>
    </div>
  )
}
