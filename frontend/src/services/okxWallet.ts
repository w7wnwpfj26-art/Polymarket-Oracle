/**
 * OKX钱包集成服务
 * 实现一键授权，满足用户"授权一次即可"的需求
 */

import { ref } from 'vue';

interface WalletState {
  connected: boolean;
  address: string | null;
  chainId: number | null;
  authorized: boolean;
  lastAuthorization: Date | null;
}

class OKXWalletService {
  private state = ref<WalletState>({
    connected: false,
    address: null,
    chainId: null,
    authorized: false,
    lastAuthorization: null
  });

  private provider: any = null;
  private autoReconnect = true;
  private authorizationTimeout = 30 * 60 * 1000; // 30分钟授权有效期

  constructor() {
    this.initProvider();
  }

  /**
   * 初始化钱包提供者
   */
  private initProvider() {
    if (typeof window !== 'undefined' && (window as any).okxwallet) {
      this.provider = (window as any).okxwallet;
      console.log('[OKX Wallet] Provider detected');
      
      // 监听钱包事件
      this.setupEventListeners();
      
      // 尝试自动连接
      if (this.autoReconnect) {
        this.autoConnect();
      }
    } else {
      console.log('[OKX Wallet] Provider not found');
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners() {
    if (!this.provider) return;

    // 账户变化
    this.provider.on('accountsChanged', (accounts: string[]) => {
      console.log('[OKX Wallet] Accounts changed:', accounts);
      if (accounts.length > 0) {
        this.state.value.address = accounts[0];
        this.state.value.connected = true;
      } else {
        this.disconnect();
      }
    });

    // 链接变化
    this.provider.on('chainChanged', (chainId: string) => {
      console.log('[OKX Wallet] Chain changed:', chainId);
      this.state.value.chainId = parseInt(chainId, 16);
    });

    // 连接断开
    this.provider.on('disconnect', () => {
      console.log('[OKX Wallet] Disconnected');
      this.disconnect();
    });
  }

  /**
   * 自动连接（检查是否有已保存的授权）
   */
  private async autoConnect() {
    try {
      // 检查本地存储的授权状态
      const savedAuth = localStorage.getItem('okx_wallet_auth');
      const savedAddress = localStorage.getItem('okx_wallet_address');
      
      if (savedAuth && savedAddress) {
        const authData = JSON.parse(savedAuth);
        const now = Date.now();
        
        // 检查授权是否仍在有效期内
        if (now - authData.timestamp < this.authorizationTimeout) {
          console.log('[OKX Wallet] Restoring previous authorization');
          
          // 尝试静默连接
          const accounts = await this.provider.request({ 
            method: 'eth_accounts' 
          });
          
          if (accounts && accounts.length > 0) {
            this.state.value.connected = true;
            this.state.value.address = accounts[0];
            this.state.value.authorized = true;
            this.state.value.lastAuthorization = new Date(authData.timestamp);
            
            // 获取链ID
            const chainId = await this.provider.request({ method: 'eth_chainId' });
            this.state.value.chainId = parseInt(chainId, 16);
            
            console.log('[OKX Wallet] Auto-connected successfully');
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error('[OKX Wallet] Auto-connect failed:', error);
      return false;
    }
  }

  /**
   * 连接钱包并授权
   */
  async connect(): Promise<boolean> {
    try {
      if (!this.provider) {
        throw new Error('OKX Wallet not installed');
      }

      // 请求账户访问权限
      const accounts = await this.provider.request({
        method: 'eth_requestAccounts'
      });

      if (accounts && accounts.length > 0) {
        // 获取链ID
        const chainId = await this.provider.request({ method: 'eth_chainId' });
        
        // 更新状态
        this.state.value.connected = true;
        this.state.value.address = accounts[0];
        this.state.value.chainId = parseInt(chainId, 16);
        this.state.value.authorized = true;
        this.state.value.lastAuthorization = new Date();
        
        // 保存授权状态（本地存储）
        this.saveAuthorization();
        
        console.log('[OKX Wallet] Connected and authorized');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[OKX Wallet] Connection failed:', error);
      throw error;
    }
  }

  /**
   * 断开连接
   */
  disconnect() {
    this.state.value.connected = false;
    this.state.value.address = null;
    this.state.value.chainId = null;
    this.state.value.authorized = false;
    this.state.value.lastAuthorization = null;
    
    // 清除本地存储
    localStorage.removeItem('okx_wallet_auth');
    localStorage.removeItem('okx_wallet_address');
    
    console.log('[OKX Wallet] Disconnected');
  }

  /**
   * 保存授权状态到本地存储
   */
  private saveAuthorization() {
    if (this.state.value.address) {
      const authData = {
        timestamp: Date.now(),
        address: this.state.value.address
      };
      
      localStorage.setItem('okx_wallet_auth', JSON.stringify(authData));
      localStorage.setItem('okx_wallet_address', this.state.value.address);
    }
  }

  /**
   * 检查授权是否仍然有效
   */
  isAuthorized(): boolean {
    if (!this.state.value.authorized || !this.state.value.lastAuthorization) {
      return false;
    }

    const now = Date.now();
    const timeDiff = now - this.state.value.lastAuthorization.getTime();
    
    return timeDiff < this.authorizationTimeout;
  }

  /**
   * 获取签名（无需用户再次确认，如果在授权期内）
   */
  async signMessage(message: string): Promise<string> {
    if (!this.state.value.connected || !this.state.value.address) {
      throw new Error('Wallet not connected');
    }

    try {
      const signature = await this.provider.request({
        method: 'personal_sign',
        params: [message, this.state.value.address]
      });
      
      return signature;
    } catch (error) {
      console.error('[OKX Wallet] Sign message failed:', error);
      throw error;
    }
  }

  /**
   * 发送交易（预授权模式）
   */
  async sendTransaction(transaction: any): Promise<string> {
    if (!this.state.value.connected || !this.state.value.address) {
      throw new Error('Wallet not connected');
    }

    try {
      // 检查是否需要重新授权
      if (!this.isAuthorized()) {
        console.log('[OKX Wallet] Authorization expired, requesting new authorization');
        await this.reauthorize();
      }

      const txHash = await this.provider.request({
        method: 'eth_sendTransaction',
        params: [transaction]
      });
      
      return txHash;
    } catch (error) {
      console.error('[OKX Wallet] Send transaction failed:', error);
      throw error;
    }
  }

  /**
   * 重新授权（当授权过期时）
   */
  private async reauthorize(): Promise<void> {
    console.log('[OKX Wallet] Reauthorizing...');
    
    // 重新连接以刷新授权
    await this.connect();
  }

  /**
   * 获取当前状态
   */
  getState() {
    return this.state;
  }

  /**
   * 获取钱包余额
   */
  async getBalance(): Promise<string> {
    if (!this.state.value.address) {
      throw new Error('Wallet not connected');
    }

    try {
      const balance = await this.provider.request({
        method: 'eth_getBalance',
        params: [this.state.value.address, 'latest']
      });
      
      // 转换为ETH单位
      return (parseInt(balance, 16) / 1e18).toFixed(6);
    } catch (error) {
      console.error('[OKX Wallet] Get balance failed:', error);
      throw error;
    }
  }
}

// 创建单例实例
export const okxWalletService = new OKXWalletService();

// Vue composable
export function useOKXWallet() {
  const connectWallet = async () => {
    try {
      const success = await okxWalletService.connect();
      if (success) {
        console.log('✅ 钱包连接并授权成功');
      }
      return success;
    } catch (error) {
      console.error('❌ 钱包连接失败:', error);
      throw error;
    }
  };

  const disconnectWallet = () => {
    okxWalletService.disconnect();
  };

  const signMessage = async (message: string) => {
    return await okxWalletService.signMessage(message);
  };

  const sendTransaction = async (transaction: any) => {
    return await okxWalletService.sendTransaction(transaction);
  };

  const getBalance = async () => {
    return await okxWalletService.getBalance();
  };

  return {
    state: okxWalletService.getState(),
    connect: connectWallet,
    disconnect: disconnectWallet,
    signMessage,
    sendTransaction,
    getBalance,
    isAuthorized: okxWalletService.isAuthorized()
  };
}