/**
 * OpenRouter setup guide — inline instructions for getting an API key.
 */

import { ExternalLink, Globe, Key, Sparkles } from 'lucide-react'
import React from 'react'

export const OpenRouterSetupGuide: React.FC = () => {
  return (
    <div className="rounded-lg border border-primary/15 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 p-3 mb-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Globe className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-foreground">OpenRouter</h4>
          <p className="text-[10px] text-muted-foreground">Access 100+ AI models with one API key</p>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        <p className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
          <Key className="h-3 w-3 text-primary" /> How to get your API key:
        </p>
        <ol className="space-y-1.5 text-[11px] text-muted-foreground pl-1">
          <li className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
            <span>Go to <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">openrouter.ai/keys <ExternalLink className="h-2.5 w-2.5" /></a></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
            <span>Create an account or sign in</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
            <span>Click <strong className="text-foreground">"Create Key"</strong> and copy it</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
            <span>Paste below — your key starts with <code className="px-1 py-0.5 rounded bg-muted text-foreground font-mono text-[10px]">sk-or-...</code></span>
          </li>
        </ol>
      </div>

      {/* Benefits */}
      <div className="flex flex-wrap gap-1.5">
        {['GPT-4o', 'Claude Sonnet', 'Gemini Pro', 'Llama 4', 'DeepSeek'].map(m => (
          <span key={m} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[9px] text-muted-foreground">
            <Sparkles className="h-2.5 w-2.5" />{m}
          </span>
        ))}
        <span className="text-[9px] text-muted-foreground self-center">+100 more</span>
      </div>
    </div>
  )
}
