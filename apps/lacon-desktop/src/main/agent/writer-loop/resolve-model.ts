/**
 * Writer Loop — Model Resolution
 *
 * Resolves the correct provider ID and model ID for LLM calls.
 * Priority: session.modelConfig > first enabled provider's defaultModel.
 *
 * This ensures that when a user changes the model in the UI,
 * the writer loop immediately uses the new model without needing
 * an app restart.
 */

import { getProviderManager } from '../../providers/provider-manager'
import type { WriterStateMachine } from './writer-state-machine'

/**
 * Resolve the provider ID and model ID to use for LLM calls.
 *
 * Checks the session's modelConfig first. If it specifies a valid
 * provider+model pair, use that. Otherwise falls back to the first
 * enabled provider's defaultModel.
 *
 * Returns null if no provider is available at all.
 */
export function resolveProviderAndModel(
  stateMachine: WriterStateMachine,
): { providerId: string; modelId: string } | null {
  const pm = getProviderManager()
  const providers = pm.listProviders()

  // 1. Check session's modelConfig (set by user via project:setModel)
  try {
    const session = stateMachine.getSession()
    if (session.modelConfig?.providerId && session.modelConfig?.modelId) {
      // Verify the provider actually exists and is registered
      const provider = providers.find(p => p.id === session.modelConfig.providerId)
      if (provider) {
        console.log(
          `[ResolveModel] Using session model config: provider=${session.modelConfig.providerId}, model=${session.modelConfig.modelId}`,
        )
        return {
          providerId: session.modelConfig.providerId,
          modelId: session.modelConfig.modelId,
        }
      }
      // Provider from session config no longer exists — fall through
      console.warn(
        `[ResolveModel] Session modelConfig references missing provider "${session.modelConfig.providerId}" — falling back`,
      )
    }
  } catch (err) {
    // Session read failed — fall through to default
    console.warn('[ResolveModel] Could not read session modelConfig:', err)
  }

  // 2. Fall back to first enabled provider's defaultModel
  const enabledProvider = providers.find(p => p.enabled)
  if (enabledProvider) {
    const modelId = enabledProvider.defaultModel || 'gpt-4o-mini'
    console.log(
      `[ResolveModel] Using default provider: provider=${enabledProvider.id}, model=${modelId}`,
    )
    return {
      providerId: enabledProvider.id,
      modelId,
    }
  }

  // 3. No provider available
  console.warn('[ResolveModel] No provider available')
  return null
}
