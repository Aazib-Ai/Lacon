import { contextBridge, ipcRenderer } from 'electron'

import { type IpcChannel, IPC_CHANNELS, isValidChannel } from '@/shared/ipc-schema'
import type { IpcAPI } from '@/shared/types'

// Whitelist of allowed IPC channels
const ALLOWED_CHANNELS = new Set(Object.values(IPC_CHANNELS))

/**
 * Validate that a channel is allowed
 */
function validateChannel(channel: string): void {
  if (!isValidChannel(channel) || !ALLOWED_CHANNELS.has(channel as IpcChannel)) {
    throw new Error(`IPC channel not allowed: ${channel}`)
  }
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const api: IpcAPI = {
  invoke: async (channel: string, payload?: any) => {
    validateChannel(channel)
    return ipcRenderer.invoke(channel, payload)
  },
  on: (channel: string, listener: (...args: any[]) => void) => {
    validateChannel(channel)
    ipcRenderer.on(channel, (event, ...args) => listener(...args))
  },
  removeListener: (channel: string, listener: (...args: any[]) => void) => {
    validateChannel(channel)
    ipcRenderer.removeListener(channel, listener)
  },
}

contextBridge.exposeInMainWorld('api', api)
