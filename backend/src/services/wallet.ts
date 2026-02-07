/**
 * Wallet Service - Ethereum wallet integration using ethers.js
 * Handles signing and sending transactions for Polymarket
 */

import { ethers, Wallet, JsonRpcProvider, parseEther, formatEther } from 'ethers';
import { getConfig } from '../api/config';
import logger from '../utils/logger';

// Polygon network configuration
const POLYGON_RPC = 'https://polygon-rpc.com';
const POLYGON_CHAIN_ID = 137;

// Polymarket contract addresses (Polygon Mainnet)
const CONTRACTS = {
  USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',  // USDC on Polygon
  CTF_EXCHANGE: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E', // Conditional Token Framework
  NEG_RISK_CTF_EXCHANGE: '0xC5d563A36AE78145C45a50134d48A1215220f80a',
};

// ERC20 ABI (minimal)
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

interface WalletInfo {
  address: string;
  balance: {
    matic: string;
    usdc: string;
  };
  chainId: number;
  connected: boolean;
}

interface TransactionResult {
  success: boolean;
  txHash?: string;
  error?: string;
  gasUsed?: string;
}

class WalletService {
  private provider: JsonRpcProvider | null = null;
  private wallet: Wallet | null = null;
  private usdcContract: ethers.Contract | null = null;

  /**
   * Initialize wallet from private key
   */
  async connect(): Promise<WalletInfo | null> {
    const config = getConfig();
    const privateKey = config.dataSources?.polymarket?.privateKey;

    if (!privateKey) {
      logger.trade.warn('No private key configured');
      return null;
    }

    try {
      this.provider = new JsonRpcProvider(POLYGON_RPC);
      this.wallet = new Wallet(privateKey, this.provider);
      
      // Initialize USDC contract
      this.usdcContract = new ethers.Contract(CONTRACTS.USDC, ERC20_ABI, this.wallet);

      const info = await this.getWalletInfo();
      logger.trade.info('Wallet connected', { address: info.address });
      
      return info;
    } catch (error) {
      logger.trade.error('Failed to connect wallet', { error: (error as Error).message });
      return null;
    }
  }

  /**
   * Get wallet info
   */
  async getWalletInfo(): Promise<WalletInfo> {
    if (!this.wallet || !this.provider || !this.usdcContract) {
      return {
        address: '',
        balance: { matic: '0', usdc: '0' },
        chainId: 0,
        connected: false,
      };
    }

    try {
      const [maticBalance, usdcBalance, network] = await Promise.all([
        this.provider.getBalance(this.wallet.address),
        this.usdcContract.balanceOf(this.wallet.address),
        this.provider.getNetwork(),
      ]);

      return {
        address: this.wallet.address,
        balance: {
          matic: formatEther(maticBalance),
          usdc: (Number(usdcBalance) / 1e6).toFixed(2), // USDC has 6 decimals
        },
        chainId: Number(network.chainId),
        connected: true,
      };
    } catch (error) {
      logger.trade.error('Failed to get wallet info', { error: (error as Error).message });
      return {
        address: this.wallet?.address || '',
        balance: { matic: '0', usdc: '0' },
        chainId: POLYGON_CHAIN_ID,
        connected: false,
      };
    }
  }

  /**
   * Check if wallet is connected
   */
  isConnected(): boolean {
    return this.wallet !== null;
  }

  /**
   * Get wallet address
   */
  getAddress(): string | null {
    return this.wallet?.address || null;
  }

  /**
   * Approve USDC spending for Polymarket
   */
  async approveUSDC(amount: number): Promise<TransactionResult> {
    if (!this.wallet || !this.usdcContract) {
      return { success: false, error: 'Wallet not connected' };
    }

    try {
      const amountWei = BigInt(Math.floor(amount * 1e6)); // USDC has 6 decimals
      const tx = await this.usdcContract.approve(CONTRACTS.CTF_EXCHANGE, amountWei);
      const receipt = await tx.wait();

      logger.trade.info('USDC approved', { amount, txHash: receipt.hash });

      return {
        success: true,
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (error) {
      logger.trade.error('Failed to approve USDC', { error: (error as Error).message });
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Sign a message (for Polymarket API authentication)
   */
  async signMessage(message: string): Promise<string | null> {
    if (!this.wallet) {
      logger.trade.error('Cannot sign: wallet not connected');
      return null;
    }

    try {
      return await this.wallet.signMessage(message);
    } catch (error) {
      logger.trade.error('Failed to sign message', { error: (error as Error).message });
      return null;
    }
  }

  /**
   * Sign typed data (EIP-712) for Polymarket orders
   */
  async signTypedData(domain: any, types: any, value: any): Promise<string | null> {
    if (!this.wallet) {
      logger.trade.error('Cannot sign: wallet not connected');
      return null;
    }

    try {
      return await this.wallet.signTypedData(domain, types, value);
    } catch (error) {
      logger.trade.error('Failed to sign typed data', { error: (error as Error).message });
      return null;
    }
  }

  /**
   * Create Polymarket order signature
   * This is used for the CLOB API
   */
  async signPolymarketOrder(order: {
    tokenId: string;
    side: 'BUY' | 'SELL';
    price: number;
    size: number;
    nonce?: number;
    expiration?: number;
  }): Promise<{ signature: string; order: any } | null> {
    if (!this.wallet) {
      logger.trade.error('Cannot sign order: wallet not connected');
      return null;
    }

    try {
      const nonce = order.nonce || Date.now();
      const expiration = order.expiration || Math.floor(Date.now() / 1000) + 3600; // 1 hour

      // Polymarket EIP-712 domain
      const domain = {
        name: 'Polymarket CTF Exchange',
        version: '1',
        chainId: POLYGON_CHAIN_ID,
        verifyingContract: CONTRACTS.CTF_EXCHANGE,
      };

      // Order types
      const types = {
        Order: [
          { name: 'salt', type: 'uint256' },
          { name: 'maker', type: 'address' },
          { name: 'signer', type: 'address' },
          { name: 'taker', type: 'address' },
          { name: 'tokenId', type: 'uint256' },
          { name: 'makerAmount', type: 'uint256' },
          { name: 'takerAmount', type: 'uint256' },
          { name: 'expiration', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'feeRateBps', type: 'uint256' },
          { name: 'side', type: 'uint8' },
          { name: 'signatureType', type: 'uint8' },
        ],
      };

      // Calculate amounts
      const makerAmount = Math.floor(order.size * 1e6); // USDC decimals
      const takerAmount = Math.floor(order.size * order.price * 1e6);

      const orderData = {
        salt: nonce,
        maker: this.wallet.address,
        signer: this.wallet.address,
        taker: ethers.ZeroAddress,
        tokenId: order.tokenId,
        makerAmount: makerAmount,
        takerAmount: takerAmount,
        expiration: expiration,
        nonce: nonce,
        feeRateBps: 0,
        side: order.side === 'BUY' ? 0 : 1,
        signatureType: 0,
      };

      const signature = await this.wallet.signTypedData(domain, types, orderData);

      logger.trade.info('Order signed', { 
        tokenId: order.tokenId, 
        side: order.side, 
        price: order.price, 
        size: order.size 
      });

      return { signature, order: orderData };
    } catch (error) {
      logger.trade.error('Failed to sign order', { error: (error as Error).message });
      return null;
    }
  }

  /**
   * Disconnect wallet
   */
  disconnect() {
    this.wallet = null;
    this.provider = null;
    this.usdcContract = null;
    logger.trade.info('Wallet disconnected');
  }
}

// Export singleton
export const walletService = new WalletService();
export default walletService;
