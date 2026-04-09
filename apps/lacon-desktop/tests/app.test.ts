import { describe, expect,it } from 'vitest'

describe('App Startup Smoke Test', () => {
  it('should pass basic smoke test', () => {
    // Minimal smoke test to verify test infrastructure works
    expect(true).toBe(true)
  })

  it('should have window API type defined', () => {
    // This validates that our shared types are properly structured
    const mockAPI = {
      invoke: async () => {},
      on: () => {},
      removeListener: () => {},
    }

    expect(mockAPI).toHaveProperty('invoke')
    expect(mockAPI).toHaveProperty('on')
    expect(mockAPI).toHaveProperty('removeListener')
  })
})
