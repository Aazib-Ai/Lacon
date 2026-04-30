/**
 * IPC handlers for provider operations (Phase 7)
 */

import { BrowserWindow, ipcMain } from 'electron'

import { IPC_CHANNELS } from '../../shared/ipc-schema'
import type { ChatCompletionRequest, StreamChunk } from '../../shared/provider-types'
import { OpenRouterAdapter } from '../providers/openrouter-adapter'
import { getProviderManager } from '../providers/provider-manager'
import { getKeyStore } from '../security/keystore'

export function registerProviderHandlers(): void {
  const providerManager = getProviderManager()

  // Register a provider
  ipcMain.handle(IPC_CHANNELS.PROVIDER_REGISTER, async (_, config: ProviderConfig): Promise<void> => {
    await providerManager.registerProvider(config)
  })

  // Unregister a provider (keeps API key in keystore)
  ipcMain.handle(IPC_CHANNELS.PROVIDER_UNREGISTER, async (_, providerId: string): Promise<void> => {
    providerManager.unregisterProvider(providerId)
  })

  // Delete a provider AND its API key from the keystore
  ipcMain.handle(IPC_CHANNELS.PROVIDER_DELETE, async (_, providerId: string): Promise<boolean> => {
    return providerManager.deleteProvider(providerId)
  })

  // List all providers
  ipcMain.handle(IPC_CHANNELS.PROVIDER_LIST, async (): Promise<ProviderConfig[]> => {
    return providerManager.listProviders()
  })

  // Get available models for a provider
  ipcMain.handle(IPC_CHANNELS.PROVIDER_GET_MODELS, async (_, providerId: string): Promise<any[]> => {
    return providerManager.getAvailableModels(providerId)
  })

  // Check health of a provider
  ipcMain.handle(IPC_CHANNELS.PROVIDER_CHECK_HEALTH, async (_, providerId: string): Promise<any> => {
    return providerManager.checkHealth(providerId)
  })

  // Check health of all providers
  ipcMain.handle(IPC_CHANNELS.PROVIDER_CHECK_ALL_HEALTH, async (): Promise<any[]> => {
    return providerManager.checkAllHealth()
  })

  // Set fallback chain
  ipcMain.handle(IPC_CHANNELS.PROVIDER_SET_FALLBACK, async (_, primary: string, fallbacks: string[]): Promise<void> => {
    providerManager.setFallbackChain(primary, fallbacks)
  })

  // Get usage records
  ipcMain.handle(
    IPC_CHANNELS.PROVIDER_GET_USAGE,
    async (_, filter?: { providerId?: string; feature?: string; since?: number }): Promise<any[]> => {
      return providerManager.getUsageRecords(filter)
    },
  )

  // Get usage summary
  ipcMain.handle(IPC_CHANNELS.PROVIDER_GET_USAGE_SUMMARY, async (_, providerId?: string): Promise<any> => {
    return providerManager.getUsageSummary(providerId)
  })

  // Chat completion (non-streaming)
  ipcMain.handle(
    IPC_CHANNELS.PROVIDER_CHAT_COMPLETION,
    async (_, providerId: string, request: ChatCompletionRequest, feature: string): Promise<any> => {
      return providerManager.chatCompletion(providerId, request, feature)
    },
  )

  // Start streaming chat completion
  ipcMain.handle(
    IPC_CHANNELS.PROVIDER_STREAM_START,
    async (event, providerId: string, request: ChatCompletionRequest, feature: string): Promise<string> => {
      const streamId = crypto.randomUUID()
      const window = BrowserWindow.fromWebContents(event.sender)

      if (!window) {
        throw new Error('Window not found')
      }

      await providerManager.streamChatCompletion(
        providerId,
        request,
        feature,
        (chunk: StreamChunk) => {
          window.webContents.send(IPC_CHANNELS.PROVIDER_STREAM_CHUNK, streamId, chunk)
        },
        usage => {
          window.webContents.send(IPC_CHANNELS.PROVIDER_STREAM_COMPLETE, streamId, usage)
        },
        error => {
          window.webContents.send(IPC_CHANNELS.PROVIDER_STREAM_ERROR, streamId, error.message)
        },
      )

      return streamId
    },
  )

  // Provider key management helpers
  ipcMain.handle(
    'provider:createKey',
    async (_, providerId: string, providerType: string, label: string, apiKey: string): Promise<string> => {
      const keyStore = getKeyStore()
      const keyId = `provider-${providerId}-${Date.now()}`
      await keyStore.setKey(keyId, providerType, label, apiKey)
      return keyId
    },
  )

  // Fetch OpenRouter models dynamically from the API
  ipcMain.handle(
    IPC_CHANNELS.PROVIDER_FETCH_OPENROUTER_MODELS,
    async (_, providerId?: string): Promise<any> => {
      try {
        // If a providerId is given, use its registered adapter
        if (providerId) {
          const adapter = providerManager.getProvider(providerId)
          if (adapter && adapter instanceof OpenRouterAdapter) {
            const models = await adapter.fetchOpenRouterModels()
            return { success: true, data: models }
          }
        }

        // Otherwise try to find any registered OpenRouter provider
        const providers = providerManager.listProviders()
        const orProvider = providers.find(p => p.type === 'openrouter')
        if (orProvider) {
          const adapter = providerManager.getProvider(orProvider.id)
          if (adapter && adapter instanceof OpenRouterAdapter) {
            const models = await adapter.fetchOpenRouterModels()
            return { success: true, data: models }
          }
        }

        // No registered provider — use a temporary adapter with no key
        // (OpenRouter /models is publicly accessible)
        const tempAdapter = new OpenRouterAdapter()
        await tempAdapter.initialize(
          { id: 'temp', type: 'openrouter', name: 'temp', enabled: true, createdAt: 0, updatedAt: 0 },
          'anon',
        )
        const models = await tempAdapter.fetchOpenRouterModels()
        return { success: true, data: models }
      } catch (error) {
        return {
          success: false,
          error: { code: 'OPENROUTER_MODELS_ERROR', message: error instanceof Error ? error.message : String(error) },
        }
      }
    },
  )
}

