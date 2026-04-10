/**
 * Provider settings UI for Phase 7
 */

import React, { useEffect, useState } from 'react'

import type { ProviderConfig, ProviderHealth, ProviderType } from '../../shared/provider-types'

interface ProviderSettingsProps {
  onClose: () => void
}

export const ProviderSettings: React.FC<ProviderSettingsProps> = ({ onClose }) => {
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [healthStatus, setHealthStatus] = useState<ProviderHealth[]>([])
  const [showAddForm, setShowAddForm] = useState(false)

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

  useEffect(() => {
    loadProviders()
    checkHealth()
  }, [loadProviders, checkHealth])

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

  const getHealthForProvider = (providerId: string): ProviderHealth | undefined => {
    return healthStatus.find(h => h.providerId === providerId)
  }

  return (
    <div className="provider-settings">
      <div className="provider-settings-header">
        <h2>AI Provider Settings</h2>
        <button onClick={onClose} className="close-button">
          ×
        </button>
      </div>

      <div className="provider-settings-content">
        <div className="provider-list">
          <div className="provider-list-header">
            <h3>Configured Providers</h3>
            <button onClick={() => setShowAddForm(true)} className="add-button">
              + Add Provider
            </button>
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
                return (
                  <div key={provider.id} className="provider-card">
                    <div className="provider-card-header">
                      <div className="provider-info">
                        <h4>{provider.name}</h4>
                        <span className="provider-type">{provider.type}</span>
                      </div>
                      <button onClick={() => handleRemoveProvider(provider.id)} className="remove-button">
                        Remove
                      </button>
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

  const providerTypes: Array<{ value: ProviderType; label: string }> = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'gemini', label: 'Google Gemini' },
    { value: 'openrouter', label: 'OpenRouter' },
    { value: 'local', label: 'Local Model' },
    { value: 'custom-openai-compatible', label: 'Custom Endpoint' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const providerId = `${providerType}-${Date.now()}`

      // Create API key in keystore
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
            <label htmlFor="api-key">API Key</label>
            <input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-..."
              required
            />
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
              placeholder="gpt-4-turbo-preview"
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
