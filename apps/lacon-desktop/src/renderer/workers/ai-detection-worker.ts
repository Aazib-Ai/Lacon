/**
 * AI Detection Web Worker — Layer 3 (Transformers.js ML)
 *
 * Runs RoBERTa-based AI text classifier in an isolated Web Worker
 * to avoid blocking the UI. Communicates via postMessage.
 *
 * Messages IN:  { type: 'init' } | { type: 'classify', sentences: string[] }
 * Messages OUT: { type: 'ready' } | { type: 'result', data, inferenceTimeMs } | { type: 'error', error } | { type: 'progress', message, percent }
 */

let classifier: any = null

self.onmessage = async (event: MessageEvent) => {
  const { type } = event.data

  if (type === 'init') {
    try {
      self.postMessage({ type: 'progress', message: 'Loading AI model...', percent: 10 })

      // Dynamic import to avoid bundling issues
      const { pipeline } = await import('@huggingface/transformers')

      self.postMessage({ type: 'progress', message: 'Initializing classifier...', percent: 50 })

      classifier = await pipeline(
        'text-classification',
        'onnx-community/roberta-base-openai-detector-ONNX',
        { dtype: 'q8' } as any,
      )

      self.postMessage({ type: 'progress', message: 'Model ready', percent: 100 })
      self.postMessage({ type: 'ready' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      self.postMessage({ type: 'error', error: `Failed to load ML model: ${message}` })
    }
    return
  }

  if (type === 'classify') {
    if (!classifier) {
      self.postMessage({ type: 'error', error: 'Model not initialized. Send "init" first.' })
      return
    }

    const { sentences } = event.data as { sentences: string[] }
    const startTime = performance.now()

    try {
      const results: any[] = []

      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i]
        // Skip very short sentences
        if (sentence.trim().length < 10) {
          results.push({ text: sentence, aiProbability: 0, label: 'LABEL_0' })
          continue
        }

        // Truncate long sentences to model max length (~512 tokens ≈ 2000 chars)
        const truncated = sentence.slice(0, 2000)
        const output = await classifier(truncated)

        if (output && output.length > 0) {
          const result = output[0]
          // LABEL_0 = Human, LABEL_1 = AI (Fake)
          const aiProb = result.label === 'LABEL_1' || result.label === 'Fake'
            ? result.score
            : 1 - result.score
          results.push({
            text: sentence.slice(0, 100),
            aiProbability: Math.round(aiProb * 100),
            label: result.label,
          })
        } else {
          results.push({ text: sentence.slice(0, 100), aiProbability: 0, label: 'unknown' })
        }

        // Send progress
        self.postMessage({
          type: 'progress',
          message: `Classifying sentence ${i + 1}/${sentences.length}`,
          percent: Math.round(((i + 1) / sentences.length) * 100),
        })
      }

      const inferenceTimeMs = Math.round(performance.now() - startTime)
      self.postMessage({ type: 'result', data: results, inferenceTimeMs })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      self.postMessage({ type: 'error', error: `Classification failed: ${message}` })
    }
    return
  }
}
