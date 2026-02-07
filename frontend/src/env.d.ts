/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  electronAPI?: {
    getBackendStatus: () => Promise<any>
    onBackendStatus: (callback: (data: any) => void) => void
    getUpdateStatus: () => Promise<any>
    checkForUpdates: () => Promise<void>
    downloadUpdate: () => Promise<void>
    installUpdate: () => Promise<void>
    onAutoUpdaterStatus: (callback: (data: any) => void) => void
    data: {
      getApiKeys: () => Promise<any>
      saveApiKey: (platform: string, apiKey: string) => Promise<void>
      getWalletConfig: () => Promise<any>
      saveWalletConfig: (address: string, privateKey: string) => Promise<void>
      getArbitrageConfig: () => Promise<any>
      saveArbitrageConfig: (config: any) => Promise<void>
      getCopyTradingConfig: () => Promise<any>
      saveCopyTradingConfig: (config: any) => Promise<void>
      getTradeHistory: (limit: number) => Promise<any[]>
      addTradeRecord: (trade: any) => Promise<void>
      getArbitrageHistory: (limit: number) => Promise<any[]>
      getProfitHistory: () => Promise<any[]>
      getStats: () => Promise<any>
    }
    theme: {
      get: () => Promise<string>
      set: (theme: string) => Promise<void>
    }
    openExternal: (url: string) => Promise<void>
    showItemInFolder: (path: string) => Promise<void>
    versions: {
      node: () => string
      chrome: () => string
      electron: () => string
    }
  }
}
