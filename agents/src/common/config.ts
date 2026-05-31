import * as dotenv from 'dotenv';

// Load .env from current working directory
dotenv.config();

export const config = {
  // --- Core Sui ---
  suiRpcUrl: process.env.SUI_RPC_URL || 'https://fullnode.devnet.sui.io:443',
  synapticPackageId: process.env.SYNAPTIC_PACKAGE_ID || '0x0',
  marketplaceConfigId: process.env.MARKETPLACE_CONFIG_ID || '0x0',

  // --- Walrus ---
  walrusPublisherUrl: process.env.WALRUS_PUBLISHER_URL || 'https://publisher.walrus-testnet.wal.software',
  walrusAggregatorUrl: process.env.WALRUS_AGGREGATOR_URL || 'https://aggregator.walrus-testnet.wal.software',

  // --- Agent Credentials ---
  sellerPrivateKey: process.env.SELLER_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001',
  buyerPrivateKey: process.env.BUYER_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000002',
  sellerIntervalMs: parseInt(process.env.SELLER_INTERVAL_MS || '30000', 10),

  // --- Encryption ---
  dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY || 'synaptic-default-aes256-key-for-hackathon-demo-2026',

  // --- DeepBook V3 ---
  deepbookPackageId: process.env.DEEPBOOK_PACKAGE_ID || '0x0',
  deepbookPoolId: process.env.DEEPBOOK_POOL_ID || '0x0',
  deepbookBalanceManagerId: process.env.DEEPBOOK_BALANCE_MANAGER_ID || '0x0',

  // --- Scallop ---
  scallopPackageId: process.env.SCALLOP_PACKAGE_ID || '0x0',
  scallopMarketId: process.env.SCALLOP_MARKET_ID || '0x0',
  scallopVersionId: process.env.SCALLOP_VERSION_ID || '0x0',
};

console.log('[Config] Environment variables loaded successfully.');
console.log(`[Config] Synaptic Package: ${config.synapticPackageId}`);
console.log(`[Config] DeepBook Pool: ${config.deepbookPoolId === '0x0' ? '(simulation)' : config.deepbookPoolId}`);
console.log(`[Config] Scallop Market: ${config.scallopMarketId === '0x0' ? '(simulation)' : config.scallopMarketId}`);
console.log(`[Config] Encryption: AES-256-GCM active`);
