import { suiClient } from '../common/sui-client.js';
import { walrusClient } from '../common/walrus-client.js';
import { dataSources, MarketPayload } from './data-sources.js';
import { config } from '../common/config.js';
import { encrypt } from '../common/crypto.js';
import * as crypto from 'crypto';

export class SellerAgent {
  private agentId: string | null = null;
  private agentCapId: string | null = null;
  private currentListingId: string | null = null;
  private keypair = suiClient.getSellerKeypair();

  constructor() {
    console.log('[SellerAgent] (Oracle-Alpha) Initialized.');
  }

  /**
   * Ensure that the Seller Agent is registered on-chain
   */
  async ensureRegistered() {
    if (this.agentId && this.agentCapId) return;

    console.log('[SellerAgent] Verifying registration on-chain...');

    // If it's a simulated execution (SYNAPTIC_PACKAGE_ID = '0x0'), we mock IDs
    if (config.synapticPackageId === '0x0' || config.synapticPackageId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      this.agentId = '0xSELLER_AGENT_' + Math.random().toString(36).substring(2, 10).toUpperCase();
      this.agentCapId = '0xSELLER_CAP_' + Math.random().toString(36).substring(2, 10).toUpperCase();
      console.log(`[SellerAgent] (SIMULATION) Registered mock Agent: ${this.agentId}, Cap: ${this.agentCapId}`);
      return;
    }

    try {
      const modelHash = this.keypair.getPublicKey().toRawBytes();
      const tx = suiClient.buildRegisterAgentTx(
        'Oracle-Alpha',
        modelHash,
        ['DeFi', 'Oracle', 'Sentiment']
      );

      const result = await suiClient.signAndExecute(tx, this.keypair, 'RegisterAgent');
      
      const sellerAddress = this.keypair.getPublicKey().toSuiAddress();
      const parsedAgentId = suiClient.parseCreatedSharedObjectId(result.rawResult);
      const parsedAgentCapId = suiClient.parseCreatedOwnedObjectId(result.rawResult, sellerAddress);

      this.agentId = parsedAgentId || '0xDEPO_SELLER_AGENT_ID';
      this.agentCapId = parsedAgentCapId || '0xDEPO_SELLER_CAP_ID';
      console.log(`[SellerAgent] Successfully registered Agent: ${this.agentId}, Cap: ${this.agentCapId}`);
    } catch (error: any) {
      console.error(`[SellerAgent] Registration failed: ${error.message}`);
    }
  }

  /**
   * Single iteration loop: Scrape → Encrypt → Upload → List
   */
  async runIteration() {
    try {
      await this.ensureRegistered();

      // 1. Fetch market dataset via DeepBook V3 RPC (or simulation fallback)
      const dataset: MarketPayload = await dataSources.getDeepBookStats('SUI/USDC');
      const serialized = JSON.stringify(dataset);
      console.log(`[SellerAgent] Aggregated high-value market sentiment data. Plaintext bytes: ${serialized.length}`);

      // 2. Generate verification hash on PLAINTEXT (so buyer can verify after decryption)
      const verificationHash = crypto.createHash('sha256').update(serialized).digest();
      const verificationHashHex = verificationHash.toString('hex');
      console.log(`[SellerAgent] SHA-256 verification hash: ${verificationHashHex.substring(0, 16)}...`);

      // 3. Encrypt the dataset using AES-256-GCM before uploading to Walrus
      console.log(`[SellerAgent] Encrypting dataset with AES-256-GCM before Walrus upload...`);
      const encryptedPayload = encrypt(serialized, config.dataEncryptionKey);
      console.log(`[SellerAgent] Encrypted payload size: ${encryptedPayload.length} bytes`);

      // 4. Upload ENCRYPTED data to Walrus Protocol
      const blobId = await walrusClient.uploadBlob(encryptedPayload);

      // 5. Publish listing on-chain via Programmable Transaction Block
      if (this.agentId && this.agentCapId) {
        const priceMist = 1_000_000_000; // 1 SUI = 10^9 MIST
        const category = 'Sentiment';

        const tx = suiClient.buildCreateListingTx(
          this.agentId,
          this.agentCapId,
          priceMist,
          blobId,
          new Uint8Array(verificationHash),
          category
        );

        const result = await suiClient.signAndExecute(tx, this.keypair, 'CreateListing');
        
        const parsedListingId = suiClient.parseCreatedSharedObjectId(result.rawResult);
        const listingId = parsedListingId || ('0xLISTING_' + blobId.substring(0, 16).toUpperCase());
        this.currentListingId = listingId;
        console.log(`[SellerAgent] Data Listing published successfully on-chain! Listing ID: ${listingId}`);

        // Broadcast event/log for the Buyer to capture
        this.emitListingEvent(listingId, blobId, priceMist, category, verificationHashHex);
      }
    } catch (error: any) {
      console.error(`[SellerAgent] Iteration error: ${error.message}`);
    }
  }

  /**
   * Simulated listings announcer (triggers local buyers in index.ts)
   */
  private emitListingEvent(listingId: string, blobId: string, price: number, category: string, verificationHashHex: string) {
    const event = {
      type: `${config.synapticPackageId}::marketplace::ListingCreated`,
      parsedJson: {
        listing_id: listingId,
        publisher: this.agentId,
        price: price.toString(),
        walrus_blob_id: Array.from(Buffer.from(blobId)),
        category,
        verification_hash: verificationHashHex,
      },
      timestampMs: Date.now()
    };
    
    // Dispatch to global event handler
    (global as any).synapticEventsEmitter?.emit('ListingCreated', event);
  }

  /**
   * Run daemon loop
   */
  start() {
    console.log('[SellerAgent] Starting seller loop...');
    this.runIteration();
    setInterval(() => this.runIteration(), config.sellerIntervalMs);
  }
}
export const sellerAgent = new SellerAgent();
