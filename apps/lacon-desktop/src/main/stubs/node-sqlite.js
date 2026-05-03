// Stub for node:sqlite which is not available in Electron.
// This is only referenced by undici's SqliteCacheStore (never used in our app).
module.exports = new Proxy(
  {},
  {
    get(_, prop) {
      if (prop === '__esModule') {return false}
      if (prop === 'default') {return module.exports}
      throw new Error(`node:sqlite is not available in Electron (tried to access .${String(prop)})`)
    },
  },
)
