import { contextBridge, ipcRenderer } from 'electron'

import type { IpcAPI } from '@/shared/types'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const api: IpcAPI = {
  // Placeholder for IPC methods - will be implemented in Phase 2
  invoke: async (channel: string, ...args: any[]) => {
    // Validate allowed channels here
    return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel: string, listener: (...args: any[]) => void) => {
    // Validate allowed channels here
    ipcRenderer.on(channel, (event, ...args) => listener(...args))
  },
  removeListener: (channel: string, listener: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, listener)
  },
}

contextBridge.exposeInMainWorld('api', api)
