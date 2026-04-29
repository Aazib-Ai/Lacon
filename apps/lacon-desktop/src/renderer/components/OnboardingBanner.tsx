/**
 * OnboardingBanner — First-run welcome with setup steps
 */

import { ArrowRight,Key, PenLine, Sparkles, X } from 'lucide-react'
import React from 'react'

import { Button } from './ui/Button'

interface OnboardingBannerProps {
  onDismiss: () => void
  onOpenSettings: () => void
}

export function OnboardingBanner({ onDismiss, onOpenSettings }: OnboardingBannerProps) {
  return (
    <div
      className="mx-4 mt-3 p-4 rounded-xl border border-border bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 animate-slide-in-up"
      role="region"
      aria-label="Welcome onboarding"
      data-testid="onboarding-banner"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center shadow-sm">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Welcome to LACON</h3>
              <p className="text-xs text-muted-foreground">Your AI writing harness — let's get you set up</p>
            </div>
          </div>

          {/* Steps */}
          <div className="flex items-center gap-6 mt-3">
            {/* Step 1 */}
            <button onClick={onOpenSettings} className="flex items-center gap-2 text-left group cursor-pointer">
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                1
              </div>
              <div>
                <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                  <Key className="h-3 w-3" /> Add API key
                </span>
              </div>
            </button>

            <ArrowRight className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />

            {/* Step 2 */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-secondary text-muted-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                2
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Pick skills
                </span>
              </div>
            </div>

            <ArrowRight className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />

            {/* Step 3 */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-secondary text-muted-foreground flex items-center justify-center text-xs font-bold flex-shrink-0">
                3
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <PenLine className="h-3 w-3" /> Start writing
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Dismiss */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          className="h-7 w-7 text-muted-foreground hover:text-foreground flex-shrink-0"
          aria-label="Dismiss onboarding"
          data-testid="dismiss-onboarding"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
