/**
 * Stream Accumulator
 * Phase 6: Epic P6-E3, Task P6-T7
 */

/**
 * P6-T7.2: Stream accumulator for partial outputs
 */
export class StreamAccumulator {
  private tokens: string[] = []
  private runId: string
  private taskId: string

  constructor(runId: string, taskId: string) {
    this.runId = runId
    this.taskId = taskId
  }

  addToken(token: string): void {
    this.tokens.push(token)
  }

  getAccumulated(): string {
    return this.tokens.join('')
  }

  getTokenCount(): number {
    return this.tokens.length
  }

  clear(): void {
    this.tokens = []
  }
}
