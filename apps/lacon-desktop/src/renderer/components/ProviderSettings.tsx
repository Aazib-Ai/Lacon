/**
 * Provider settings UI for Phase 7
 * Extended with: encrypted key UX, test connection, per-project model selection,
 * local model disclaimer, session cost display, and manual update link.
 */

import React, { useEffect, useState } from 'react'

import type { ProviderConfig, ProviderHealth, ProviderType } from '../../shared/provider-types'

interface ProviderSettingsProps {
  onClose: () => void
  documentId?: string
}

export const ProviderSettings: React.FC<ProviderSettingsProps> = ({ onClose, documentId }) => {
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [healthStatus, setHealthStatus] = useState<ProviderHealth[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [testingProvider, setTestingProvider] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<
    Record<string, { status: string; latencyMs?: number; error?: string }>
  >({})
  const [sessionCost, setSessionCost] = useState<any>(null)
  const [projectModel, setProjectModel] = useState<{ providerId: string; modelId: string } | null>(null)
  const [appInfo, setAppInfo] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'providers' | 'model' | 'cost' | 'about'>('providers')

  const loadProviders = React.useCallback(async () => {
    try {
      const list = await window.electron.provider.list()
      setProviders(list)
    } catch (error) {
      console.error('Failed to load providers:', error)
    }
  }, [])

  const checkHealth = React.useCallback(async () => {
    try {
      const health = await window.electron.provider.checkAllHealth()
      setHealthStatus(health)
    } catch (error) {
      console.error('Failed to check health:', error)
    }
  }, [])

  const loadSessionCost = React.useCallback(async () => {
    if (!documentId) {return}
    try {
      const result = await window.electron.pricing.getSessionCost(documentId)
      if (result?.success) {
        setSessionCost(result.data)
      }
    } catch (error) {
      console.error('Failed to load session cost:', error)
    }
  }, [documentId])

  const loadProjectModel = React.useCallback(async () => {
    if (!documentId) {return}
    try {
      const result = await window.electron.pricing.getProjectModel(documentId)
      if (result?.success) {
        setProjectModel(result.data)
      }
    } catch (error) {
      console.error('Failed to load project model:', error)
    }
  }, [documentId])

  const loadAppInfo = React.useCallback(async () => {
    try {
      const result = await window.electron.update.getInfo()
      if (result?.success) {
        setAppInfo(result.data)
      }
    } catch (error) {
      console.error('Failed to load app info:', error)
    }
  }, [])

  useEffect(() => {
    loadProviders()
    checkHealth()
    loadSessionCost()
    loadProjectModel()
    loadAppInfo()
  }, [loadProviders, checkHealth, loadSessionCost, loadProjectModel, loadAppInfo])

  const handleRemoveProvider = async (providerId: string) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm('Are you sure you want to remove this provider?')) {
      return
    }

    try {
      await window.electron.provider.unregister(providerId)
      await loadProviders()
    } catch (error) {
      console.error('Failed to remove provider:', error)
      alert('Failed to remove provider')
    }
  }

  const handleTestConnection = async (providerId: string) => {
    setTestingProvider(providerId)
    try {
      const result = await window.electron.pricing.testConnection(providerId)
      if (result?.success) {
        setTestResults(prev => ({
          ...prev,
          [providerId]: result.data,
        }))
      }
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [providerId]: {
          status: 'unavailable',
          error: error instanceof Error ? error.message : 'Connection failed',
        },
      }))
    } finally {
      setTestingProvider(null)
    }
  }

  const handleSetProjectModel = async (providerId: string, modelId: string) => {
    if (!documentId) {return}
    try {
      await window.electron.pricing.setProjectModel(documentId, providerId, modelId)
      setProjectModel({ providerId, modelId })
    } catch (error) {
      console.error('Failed to set project model:', error)
    }
  }

  const handleCheckUpdates = async () => {
    try {
      await window.electron.update.check()
    } catch (error) {
      console.error('Failed to check updates:', error)
    }
  }

  const getHealthForProvider = (providerId: string): ProviderHealth | undefined => {
    return healthStatus.find(h => h.providerId === providerId)
  }

  const formatCost = (costUsd: number): string => {
    if (costUsd === 0) {return '$0.00'}
    if (costUsd < 0.001) {return `$${costUsd.toFixed(6)}`}
    if (costUsd < 0.01) {return `$${costUsd.toFixed(4)}`}
    return `$${costUsd.toFixed(4)}`
  }

  return (
    <div className="provider-settings">
      <div className="provider-settings-header">
        <h2>Settings</h2>
        <button onClick={onClose} className="close-button">
          ×
        </button>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === 'providers' ? 'active' : ''}`}
          onClick={() => setActiveTab('providers')}
        >
          🔑 Providers
        </button>
        <button
          className={`settings-tab ${activeTab === 'model' ? 'active' : ''}`}
          onClick={() => setActiveTab('model')}
        >
          🤖 Model
        </button>
        <button className={`settings-tab ${activeTab === 'cost' ? 'active' : ''}`} onClick={() => setActiveTab('cost')}>
          💰 Cost
        </button>
        <button
          className={`settings-tab ${activeTab === 'about' ? 'active' : ''}`}
          onClick={() => setActiveTab('about')}
        >
          ℹ️ About
        </button>
      </div>

      <div className="provider-settings-content">
        {/* ── Providers Tab ── */}
        {activeTab === 'providers' && (
          <div className="provider-list">
            <div className="provider-list-header">
              <h3>Configured Providers</h3>
              <button onClick={() => setShowAddForm(true)} className="add-button">
                + Add Provider
              </button>
            </div>

            {/* Encrypted Key Notice */}
            <div className="security-notice">
              <span className="security-icon">🔐</span>
              <span>
                All API keys are encrypted using your operating system's secure storage (Keychain / DPAPI / libsecret).
                Keys never leave this device.
              </span>
            </div>

            {providers.length === 0 ? (
              <div className="empty-state">
                <p>No providers configured yet.</p>
                <p>Add a provider to start using AI features.</p>
              </div>
            ) : (
              <div className="provider-cards">
                {providers.map(provider => {
                  const health = getHealthForProvider(provider.id)
                  const testResult = testResults[provider.id]
                  const isTesting = testingProvider === provider.id
                  const isLocal = provider.type === 'local'

                  return (
                    <div key={provider.id} className="provider-card">
                      <div className="provider-card-header">
                        <div className="provider-info">
                          <h4>{provider.name}</h4>
                          <span className="provider-type">{provider.type}</span>
                          {isLocal && <span className="local-badge">LOCAL</span>}
                        </div>
                        <div className="provider-actions-row">
                          <button
                            onClick={() => handleTestConnection(provider.id)}
                            className="test-button"
                            disabled={isTesting}
                          >
                            {isTesting ? '⏳ Testing...' : '🔌 Test'}
                          </button>
                          <button onClick={() => handleRemoveProvider(provider.id)} className="remove-button">
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="provider-card-body">
                        <div className="provider-status">
                          <span className={`status-indicator status-${health?.status || 'unknown'}`} />
                          <span className="status-text">
                            {health?.status || 'Unknown'}
                            {health?.latencyMs && ` (${health.latencyMs}ms)`}
                          </span>
                        </div>

                        {provider.defaultModel && (
                          <div className="provider-model">
                            <span className="label">Default Model:</span>
                            <span className="value">{provider.defaultModel}</span>
                          </div>
                        )}

                        {/* Encrypted key indicator */}
                        <div className="provider-key-status">
                          <span className="label">API Key:</span>
                          <span className="encrypted-badge">🔐 Encrypted in OS keystore</span>
                        </div>

                        {/* Test Connection Result */}
                        {testResult && (
                          <div className={`test-result test-result-${testResult.status}`}>
                            <span className="test-label">
                              {testResult.status === 'healthy' && '✅'}
                              {testResult.status === 'degraded' && '⚠️'}
                              {testResult.status !== 'healthy' && testResult.status !== 'degraded' && '❌'} Test:{' '}
                              {testResult.status}
                            </span>
                            {testResult.latencyMs && <span className="test-latency">{testResult.latencyMs}ms</span>}
                            {testResult.error && <span className="test-error">{testResult.error}</span>}
                          </div>
                        )}

                        {/* Local model disclaimer */}
                        {isLocal && (
                          <div className="local-disclaimer">
                            <span className="disclaimer-icon">⚠️</span>
                            <span>
                              Local models run entirely on your machine. Performance depends on your hardware. LACON
                              provides no warranty on output quality for local models. Ensure your local endpoint is
                              running before using.
                            </span>
                          </div>
                        )}

                        {health?.error && (
                          <div className="provider-error">
                            <span className="error-icon">⚠</span>
                            <span className="error-text">{health.error}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Model Selection Tab ── */}
        {activeTab === 'model' && (
          <div className="model-selection">
            <h3>Per-Project Model Selection</h3>
            {!documentId ? (
              <div className="empty-state">
                <p>Open a document to configure its model.</p>
              </div>
            ) : (
              <>
                <p className="model-description">
                  Each project can use a different AI model. Select a provider and model below. This setting is isolated
                  to the current project.
                </p>

                {projectModel && (
                  <div className="current-model">
                    <span className="label">Current:</span>
                    <span className="value">
                      {projectModel.providerId || 'Not set'} / {projectModel.modelId || 'Not set'}
                    </span>
                  </div>
                )}

                {providers.length === 0 ? (
                  <div className="empty-state">
                    <p>Configure a provider first in the Providers tab.</p>
                  </div>
                ) : (
                  <div className="model-picker">
                    {providers.map(provider => (
                      <div key={provider.id} className="model-provider-group">
                        <h4>
                          {provider.name} ({provider.type})
                        </h4>
                        {provider.type === 'local' && (
                          <div className="local-disclaimer compact">
                            ⚠️ Local model — quality depends on your hardware and model choice.
                          </div>
                        )}
                        <div className="model-options">
                          {provider.defaultModel && (
                            <button
                              className={`model-option ${
                                projectModel?.providerId === provider.id &&
                                projectModel?.modelId === provider.defaultModel
                                  ? 'selected'
                                  : ''
                              }`}
                              onClick={() => handleSetProjectModel(provider.id, provider.defaultModel!)}
                            >
                              {provider.defaultModel}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Cost Tab ── */}
        {activeTab === 'cost' && !documentId && (
          <div className="cost-display">
            <h3>Session Cost</h3>
            <div className="empty-state">
              <p>Open a document to view its session cost.</p>
            </div>
          </div>
        )}
        {activeTab === 'cost' && documentId && sessionCost && (
          <div className="cost-display">
            <h3>Session Cost</h3>
            <div className="cost-summary">
              <div className="cost-metric">
                <span className="cost-label">Session Total</span>
                <span className="cost-value cost-total">{formatCost(sessionCost.totalCost)}</span>
              </div>
              <div className="cost-metric">
                <span className="cost-label">Input Tokens</span>
                <span className="cost-value">{sessionCost.totalInputTokens.toLocaleString()}</span>
              </div>
              <div className="cost-metric">
                <span className="cost-label">Output Tokens</span>
                <span className="cost-value">{sessionCost.totalOutputTokens.toLocaleString()}</span>
              </div>
              <div className="cost-metric">
                <span className="cost-label">Actions</span>
                <span className="cost-value">{sessionCost.entries?.length || 0}</span>
              </div>
            </div>

            {sessionCost.entries && sessionCost.entries.length > 0 && (
              <div className="cost-entries">
                <h4>Per-Action Breakdown</h4>
                <div className="cost-table">
                  <div className="cost-table-header">
                    <span>Action</span>
                    <span>In Tokens</span>
                    <span>Out Tokens</span>
                    <span>Cost</span>
                    <span>Time</span>
                  </div>
                  {sessionCost.entries
                    .slice()
                    .reverse()
                    .map((entry: any) => (
                      <div key={entry.id} className="cost-table-row">
                        <span className="action-label">{entry.action}</span>
                        <span>{entry.cost.inputTokens.toLocaleString()}</span>
                        <span>{entry.cost.outputTokens.toLocaleString()}</span>
                        <span className="cost-cell">{formatCost(entry.cost.totalCost)}</span>
                        <span className="time-cell">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'cost' && documentId && !sessionCost && (
          <div className="cost-display">
            <h3>Session Cost</h3>
            <div className="empty-state">
              <p>No cost data yet. Use AI features to see cost tracking.</p>
            </div>
          </div>
        )}

        {/* ── About Tab ── */}
        {activeTab === 'about' && (
          <div className="about-section">
            <h3>About LACON</h3>
            {appInfo && (
              <div className="about-info">
                <div className="about-row">
                  <span className="label">Version:</span>
                  <span className="value">{appInfo.currentVersion}</span>
                </div>
                <div className="about-row">
                  <span className="label">Platform:</span>
                  <span className="value">
                    {appInfo.platform} ({appInfo.arch})
                  </span>
                </div>
                <div className="about-row">
                  <span className="label">Build:</span>
                  <span className="value">{appInfo.isPackaged ? 'Production' : 'Development'}</span>
                </div>
              </div>
            )}

            <div className="privacy-section">
              <h4>🛡️ Privacy Guarantees</h4>
              <ul className="privacy-list">
                <li>✅ No telemetry or analytics — ever.</li>
                <li>✅ No LACON cloud backend — fully local.</li>
                <li>✅ API keys encrypted in OS keystore.</li>
                <li>✅ No data leaves your machine except API calls you initiate.</li>
                <li>✅ Direct download, no account required.</li>
              </ul>
            </div>

            <div className="update-section">
              <h4>Updates</h4>
              <p>LACON uses manual updates. Check for new versions on the download page.</p>
              <button onClick={handleCheckUpdates} className="update-button">
                🔗 Check for Updates
              </button>
            </div>
          </div>
        )}

        {showAddForm && (
          <AddProviderForm
            onSuccess={() => {
              setShowAddForm(false)
              loadProviders()
              checkHealth()
            }}
            onCancel={() => setShowAddForm(false)}
          />
        )}
      </div>
    </div>
  )
}

interface AddProviderFormProps {
  onSuccess: () => void
  onCancel: () => void
}

function AddProviderForm({ onSuccess, onCancel }: AddProviderFormProps) {
  const [providerType, setProviderType] = useState<ProviderType>('openai')
  const [name, setName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [defaultModel, setDefaultModel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)

  const providerTypes: Array<{ value: ProviderType; label: string }> = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'gemini', label: 'Google Gemini' },
    { value: 'openrouter', label: 'OpenRouter' },
    { value: 'local', label: 'Local Model' },
    { value: 'custom-openai-compatible', label: 'Custom Endpoint' },
  ]

  const isLocal = providerType === 'local'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const providerId = `${providerType}-${Date.now()}`

      // Create API key in keystore (encrypted via OS keychain)
      const keyId = await window.electron.provider.createKey(providerId, providerType, `${name} API Key`, apiKey)

      // Register provider
      const config: ProviderConfig = {
        id: providerId,
        type: providerType,
        name: name || providerType,
        apiKeyId: keyId,
        baseUrl: baseUrl || undefined,
        defaultModel: defaultModel || undefined,
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      await window.electron.provider.register(config)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add provider')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="add-provider-form-overlay">
      <div className="add-provider-form">
        <h3>Add AI Provider</h3>

        {/* Local Model Disclaimer */}
        {isLocal && (
          <div className="local-disclaimer form-disclaimer">
            <span className="disclaimer-icon">⚠️</span>
            <div>
              <strong>Local Model Notice</strong>
              <p>
                Local models run entirely on your hardware. LACON connects to your local endpoint (e.g., Ollama, LM
                Studio) and makes no guarantees about output quality, speed, or compatibility. Ensure your local server
                is running before adding.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="provider-type">Provider Type</label>
            <select
              id="provider-type"
              value={providerType}
              onChange={e => setProviderType(e.target.value as ProviderType)}
              required
            >
              {providerTypes.map(pt => (
                <option key={pt.value} value={pt.value}>
                  {pt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="provider-name">Name (optional)</label>
            <input
              id="provider-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={`My ${providerType} Provider`}
            />
          </div>

          <div className="form-group">
            <label htmlFor="api-key">
              API Key
              <span className="key-security-hint">🔐 Stored encrypted in OS keystore</span>
            </label>
            <div className="key-input-wrapper">
              <input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={isLocal ? 'Optional for local models' : 'sk-...'}
                required={!isLocal}
              />
              <button
                type="button"
                className="toggle-key-visibility"
                onClick={() => setShowKey(!showKey)}
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {(providerType === 'local' || providerType === 'custom-openai-compatible') && (
            <div className="form-group">
              <label htmlFor="base-url">Base URL</label>
              <input
                id="base-url"
                type="url"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="http://localhost:11434/v1"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="default-model">Default Model (optional)</label>
            <input
              id="default-model"
              type="text"
              value={defaultModel}
              onChange={e => setDefaultModel(e.target.value)}
              placeholder={isLocal ? 'llama3.1' : 'gpt-4o'}
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <button type="button" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
            <button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Provider'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
