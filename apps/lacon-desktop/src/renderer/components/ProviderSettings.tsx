/**
 * Provider settings UI — renders inside the left sidebar panel.
 * Tailwind-only — no external CSS file.
 */

import { ArrowLeft, Check, ChevronDown, Eye, EyeOff, Key, Loader2, Plus, Trash2, Unplug, X, Zap } from 'lucide-react'
import React, { useEffect, useState } from 'react'

import type { OpenRouterModelInfo, ProviderConfig, ProviderHealth, ProviderType } from '../../shared/provider-types'
import { cn } from '../lib/utils'
import { OpenRouterModelBrowser } from './OpenRouterModelBrowser'
import { OpenRouterSetupGuide } from './OpenRouterSetupGuide'

interface ProviderSettingsProps {
  onClose: () => void
  documentId?: string
}

/* ────────────────────────────────────────────── */
/*  Main Component                                */
/* ────────────────────────────────────────────── */

export const ProviderSettings: React.FC<ProviderSettingsProps> = ({ onClose, documentId }) => {
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [healthStatus, setHealthStatus] = useState<ProviderHealth[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [testingProvider, setTestingProvider] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<
    Record<string, { status: string; latencyMs?: number; error?: string }>
  >({})
  const [activeTab, setActiveTab] = useState<'providers' | 'model' | 'about'>('providers')
  const [projectModel, setProjectModel] = useState<{ providerId: string; modelId: string } | null>(null)
  const [appInfo, setAppInfo] = useState<any>(null)

  const loadProviders = React.useCallback(async () => {
    try { setProviders(await window.electron.provider.list()) } catch (e) { console.error(e) }
  }, [])

  const checkHealth = React.useCallback(async () => {
    try { setHealthStatus(await window.electron.provider.checkAllHealth()) } catch (e) { console.error(e) }
  }, [])

  const loadProjectModel = React.useCallback(async () => {
    if (!documentId) return
    try { const r = await window.electron.pricing.getProjectModel(documentId); if (r?.success) setProjectModel(r.data) } catch (e) { console.error(e) }
  }, [documentId])

  const loadAppInfo = React.useCallback(async () => {
    try { const r = await window.electron.update.getInfo(); if (r?.success) setAppInfo(r.data) } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { loadProviders(); checkHealth(); loadProjectModel(); loadAppInfo() }, [loadProviders, checkHealth, loadProjectModel, loadAppInfo])

  const handleRemoveProvider = async (id: string) => {
    if (!confirm('Remove this provider and its API key? This cannot be undone.')) return
    try { await window.electron.provider.deleteProvider(id); await loadProviders() } catch { alert('Failed to remove') }
  }

  const handleTestConnection = async (providerId: string) => {
    setTestingProvider(providerId)
    try {
      const r = await window.electron.pricing.testConnection(providerId)
      if (r?.success) setTestResults(p => ({ ...p, [providerId]: r.data }))
    } catch (error) {
      setTestResults(p => ({ ...p, [providerId]: { status: 'unavailable', error: error instanceof Error ? error.message : 'Failed' } }))
    } finally { setTestingProvider(null) }
  }

  const handleSetProjectModel = async (providerId: string, modelId: string) => {
    if (!documentId) return
    try { await window.electron.pricing.setProjectModel(documentId, providerId, modelId); setProjectModel({ providerId, modelId }) } catch (e) { console.error(e) }
  }

  const getHealth = (id: string) => healthStatus.find(h => h.providerId === id)

  const tabs = [
    { id: 'providers' as const, label: 'Providers', icon: <Key className="h-3.5 w-3.5" /> },
    { id: 'model' as const, label: 'Model', icon: <Zap className="h-3.5 w-3.5" /> },
    { id: 'about' as const, label: 'About', icon: <Unplug className="h-3.5 w-3.5" /> },
  ]

  return (
    <div className="flex flex-col h-full bg-card text-foreground animate-fade-in" id="provider-settings">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 h-[var(--lacon-header-height)] border-b border-border flex-shrink-0">
        <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Back to files">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold tracking-tight">Settings</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 px-2 py-1.5 border-b border-border flex-shrink-0">
        {tabs.map(t => (
          <button key={t.id} className={cn('flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-all', activeTab === t.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted')} onClick={() => { setActiveTab(t.id); setShowAddForm(false) }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'providers' && (
          <div className="p-3">
            {showAddForm ? (
              <AddProviderForm
                onSuccess={() => { setShowAddForm(false); loadProviders(); checkHealth() }}
                onCancel={() => setShowAddForm(false)}
              />
            ) : (
              <>
                <button onClick={() => setShowAddForm(true)} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 mb-3 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Add Provider
                </button>

                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10 text-[11px] text-muted-foreground mb-3">
                  <Key className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                  <span>API keys are encrypted in your OS keystore. Keys never leave this device.</span>
                </div>

                {providers.length === 0 ? (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    <Unplug className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No providers yet</p>
                    <p className="text-xs mt-1">Add a provider to start using AI.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {providers.map(provider => {
                      const health = getHealth(provider.id)
                      const testResult = testResults[provider.id]
                      const isTesting = testingProvider === provider.id
                      const statusColor = health?.status === 'healthy' ? 'bg-emerald-500' : health?.status === 'degraded' ? 'bg-amber-500' : 'bg-zinc-400'

                      return (
                        <div key={provider.id} className="rounded-lg border border-border p-3 hover:border-border/80 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={cn('w-2 h-2 rounded-full flex-shrink-0', statusColor)} />
                              <span className="text-sm font-semibold truncate">{provider.name}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium flex-shrink-0">{provider.type}</span>
                            </div>
                          </div>
                          {provider.defaultModel && (
                            <div className="text-[11px] text-muted-foreground mb-2">Model: <span className="text-foreground font-medium">{provider.defaultModel}</span></div>
                          )}
                          <div className="flex gap-1.5">
                            <button onClick={() => handleTestConnection(provider.id)} disabled={isTesting} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium rounded-md bg-secondary text-secondary-foreground border border-border hover:bg-muted transition-colors disabled:opacity-50">
                              {isTesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unplug className="h-3 w-3" />}
                              {isTesting ? 'Testing...' : 'Test'}
                            </button>
                            <button onClick={() => handleRemoveProvider(provider.id)} className="px-2 py-1.5 text-[11px] font-medium rounded-md text-destructive hover:bg-destructive/10 transition-colors">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                          {testResult && (
                            <div className={cn('mt-2 px-2.5 py-2 rounded-md text-[11px] flex items-center gap-2', testResult.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-destructive/10 text-destructive')}>
                              {testResult.status === 'healthy' ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                              <div>
                                <span className="font-medium">{testResult.status === 'healthy' ? 'Connected' : 'Failed'}</span>
                                {testResult.latencyMs && <span className="ml-1.5 opacity-70">{testResult.latencyMs}ms</span>}
                                {testResult.error && <span className="block mt-0.5 opacity-80">{testResult.error}</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'model' && (
          <div className="p-3">
            <h3 className="text-xs font-semibold mb-2 uppercase tracking-wider text-muted-foreground">Project Model</h3>
            {!documentId ? (
              <div className="text-center py-8 text-sm text-muted-foreground">Open a document first.</div>
            ) : providers.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">Add a provider first.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* OpenRouter providers get the full model browser */}
                {providers.filter(p => p.type === 'openrouter').map(p => (
                  <div key={p.id}>
                    <p className="text-[11px] font-medium text-muted-foreground mb-1.5">{p.name}</p>
                    <OpenRouterModelBrowser
                      selectedModelId={projectModel?.providerId === p.id ? projectModel.modelId : undefined}
                      onSelectModel={(model) => handleSetProjectModel(p.id, model.id)}
                      providerId={p.id}
                    />
                  </div>
                ))}
                {/* Non-OpenRouter providers: show default model buttons */}
                {providers.filter(p => p.type !== 'openrouter' && p.defaultModel).map(p => (
                  <button key={p.id} onClick={() => handleSetProjectModel(p.id, p.defaultModel!)}
                    className={cn('w-full text-left px-3 py-2.5 rounded-lg border transition-all text-sm', projectModel?.providerId === p.id && projectModel?.modelId === p.defaultModel ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border hover:bg-muted')}>
                    <div className="font-medium">{p.defaultModel}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{p.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'about' && (
          <div className="p-3">
            <h3 className="text-xs font-semibold mb-3 uppercase tracking-wider text-muted-foreground">About LACON</h3>
            {appInfo && (
              <div className="space-y-1 text-xs mb-4">
                <div><span className="text-muted-foreground">Version: </span><span className="font-medium">{appInfo.currentVersion}</span></div>
                <div><span className="text-muted-foreground">Platform: </span><span className="font-medium">{appInfo.platform} ({appInfo.arch})</span></div>
              </div>
            )}
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>✅ No telemetry — fully local</p>
              <p>✅ API keys encrypted in OS keystore</p>
              <p>✅ No data leaves your machine</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────── */
/*  Add Provider Form (inline, not modal)         */
/* ────────────────────────────────────────────── */

interface AddProviderFormProps { onSuccess: () => void; onCancel: () => void }

function AddProviderForm({ onSuccess, onCancel }: AddProviderFormProps) {
  const [providerType, setProviderType] = useState<ProviderType>('openai')
  const [name, setName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [defaultModel, setDefaultModel] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [useCodingPlan, setUseCodingPlan] = useState(false)
  const [selectedORModel, setSelectedORModel] = useState<OpenRouterModelInfo | null>(null)

  // Validation state
  const [phase, setPhase] = useState<'form' | 'validating' | 'success' | 'error'>('form')
  const [validationMsg, setValidationMsg] = useState('')
  const [validationLatency, setValidationLatency] = useState<number | null>(null)

  const providerTypes: Array<{ value: ProviderType; label: string; hint: string }> = [
    { value: 'openai', label: 'OpenAI', hint: 'sk-...' },
    { value: 'anthropic', label: 'Anthropic', hint: 'sk-ant-...' },
    { value: 'gemini', label: 'Google Gemini', hint: 'AIza...' },
    { value: 'openrouter', label: 'OpenRouter', hint: 'sk-or-...' },
    { value: 'zai', label: 'Z.AI (GLM)', hint: 'Your Z.AI key' },
    { value: 'local', label: 'Local Model', hint: 'Optional' },
    { value: 'custom-openai-compatible', label: 'Custom Endpoint', hint: 'API key' },
  ]

  const isLocal = providerType === 'local'
  const isOpenRouter = providerType === 'openrouter'
  const isZai = providerType === 'zai'
  const currentHint = providerTypes.find(p => p.value === providerType)?.hint || 'API key'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPhase('validating')
    setValidationMsg('Registering provider...')
    setValidationLatency(null)

    try {
      const providerId = `${providerType}-${Date.now()}`
      let resolvedBaseUrl = baseUrl || undefined
      if (isZai) {
        resolvedBaseUrl = useCodingPlan ? 'https://api.z.ai/api/coding/paas/v4' : 'https://api.z.ai/api/paas/v4'
      }

      const keyId = await window.electron.provider.createKey(providerId, providerType, `${name || providerType} API Key`, apiKey)
      const config: ProviderConfig = { id: providerId, type: providerType, name: name || providerType, apiKeyId: keyId, baseUrl: resolvedBaseUrl, defaultModel: defaultModel || undefined, enabled: true, createdAt: Date.now(), updatedAt: Date.now() }
      await window.electron.provider.register(config)

      // Now validate the API key by testing the connection
      setValidationMsg('Verifying API key...')
      const result = await window.electron.pricing.testConnection(providerId)

      if (result?.success && result.data?.status === 'healthy') {
        setValidationLatency(result.data.latencyMs || null)
        setPhase('success')
        setValidationMsg('API key is valid — connected successfully!')
        setTimeout(() => onSuccess(), 1500)
      } else {
        const errMsg = result?.data?.error || 'Could not verify connection'
        setPhase('error')
        setValidationMsg(`Provider saved but verification failed: ${errMsg}. You can still use it or remove and re-add.`)
        // Still call onSuccess after delay since the provider is registered
        setTimeout(() => onSuccess(), 3000)
      }
    } catch (err) {
      setPhase('error')
      setValidationMsg(err instanceof Error ? err.message : 'Failed to add provider')
    }
  }

  const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"

  // Show validation result screen
  if (phase === 'validating' || phase === 'success' || phase === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center animate-fade-in">
        {phase === 'validating' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Loader2 className="h-7 w-7 text-primary animate-spin" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Validating</p>
            <p className="text-xs text-muted-foreground">{validationMsg}</p>
          </>
        )}
        {phase === 'success' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
              <Check className="h-7 w-7 text-emerald-500" />
            </div>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Connected!</p>
            <p className="text-xs text-muted-foreground">{validationMsg}</p>
            {validationLatency && <p className="text-[11px] text-muted-foreground mt-1">Latency: {validationLatency}ms</p>}
          </>
        )}
        {phase === 'error' && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
              <X className="h-7 w-7 text-destructive" />
            </div>
            <p className="text-sm font-semibold text-destructive mb-1">Verification Issue</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{validationMsg}</p>
            <button onClick={onCancel} className="mt-4 px-4 py-1.5 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Dismiss</button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-3">
        <button onClick={onCancel} className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-semibold">Add Provider</h3>
      </div>

      {isOpenRouter && <OpenRouterSetupGuide />}

      {isLocal && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10 text-[11px] text-amber-600 dark:text-amber-400 mb-3">
          ⚠️ Local models run on your hardware. Quality depends on your setup.
        </div>
      )}

      {isZai && (
        <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10 text-[11px] mb-3">
          <span className="font-medium text-primary">Z.AI — GLM Coding Plan</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={useCodingPlan} onChange={e => setUseCodingPlan(e.target.checked)} className="rounded" />
            <span className="text-foreground">Use Coding Plan endpoint</span>
          </label>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground mb-1">Provider Type</label>
          <div className="relative">
            <select value={providerType} onChange={e => setProviderType(e.target.value as ProviderType)} required className={cn(inputCls, 'appearance-none pr-8')}>
              {providerTypes.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-muted-foreground mb-1">Display Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={`My ${providerType}`} className={inputCls} />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
            API Key <span className="text-emerald-500 ml-1">🔐 encrypted</span>
          </label>
          <div className="relative">
            <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={currentHint} required={!isLocal} className={cn(inputCls, 'pr-9')} />
            <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {(providerType === 'local' || providerType === 'custom-openai-compatible') && (
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1">Base URL</label>
            <input type="url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="http://localhost:11434/v1" required className={inputCls} />
          </div>
        )}

        {isOpenRouter ? (
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1">Select Model</label>
            <OpenRouterModelBrowser
              selectedModelId={selectedORModel?.id || defaultModel}
              onSelectModel={(model) => { setSelectedORModel(model); setDefaultModel(model.id) }}
              compact
            />
          </div>
        ) : (
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1">Default Model</label>
            <input type="text" value={defaultModel} onChange={e => setDefaultModel(e.target.value)} placeholder={isLocal ? 'llama3.1' : isZai ? 'glm-5.1' : 'gpt-4o'} className={inputCls} />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel} className="flex-1 px-3 py-2 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-border">Cancel</button>
          <button type="submit" className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Add & Verify</button>
        </div>
      </form>
    </div>
  )
}
