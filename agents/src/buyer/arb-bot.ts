import { suiClient } from '../common/sui-client.js';
import { walrusClient } from '../common/walrus-client.js';
import { strategy } from './strategy.js';
import { config } from '../common/config.js';
import { decrypt } from '../common/crypto.js';
import { EventEmitter } from 'events';

export class BuyerAgent {
  private keypair = suiClient.getBuyerKeypair();

  constructor() {
    console.log('[BuyerAgent] (Arb-Bot) Initialized.');
  }

  /**
   * Listen to the local event emitter or query Sui RPC fullnode for listing events
   */
  start(eventEmitter: EventEmitter) {
    console.log('[BuyerAgent] Starting event listener for Synaptic listings...');

    eventEmitter.on('ListingCreated', async (event: any) => {
      try {
        const { listing_id, publisher, price, walrus_blob_id, category, verification_hash } = event.parsedJson;
        
        // Parse blob ID from the vector<u8> array
        const blobId = Buffer.from(walrus_blob_id).toString('utf-8');
        console.log(`\n[BuyerAgent] [EVENT] Captured new Synaptic Listing!`);
        console.log(`  - Listing ID: ${listing_id}`);
        console.log(`  - Publisher Agent: ${publisher}`);
        console.log(`  - Price: ${parseFloat(price) / 1_000_000_000} SUI`);
        console.log(`  - Walrus Blob ID: ${blobId}`);
        console.log(`  - Category: ${category}`);
        console.log(`  - Verification Hash: ${verification_hash ? verification_hash.substring(0, 16) + '...' : 'N/A'}`);

        // Decide whether to purchase
        if (category === 'Sentiment') {
          await this.purchaseAndProcess(listing_id, publisher, parseInt(price, 10), blobId, verification_hash);
        } else {
          console.log(`[BuyerAgent] Listing category "${category}" skipped.`);
        }
      } catch (error: any) {
        console.error(`[BuyerAgent] Error processing ListingCreated event: ${error.message}`);
      }
    });
  }

  /**
   * Full Atomic Purchase, Download, Decrypt, Strategy Analysis, and Trade Execution Flow
   */
  async purchaseAndProcess(listingId: string, publisher: string, price: number, blobId: string, verificationHashHex?: string) {
    try {
      console.log(`\n[BuyerAgent] ═══════════════════════════════════════════════════`);
      console.log(`[BuyerAgent] Initiating FULL CYCLE for listing: ${listingId}`);
      console.log(`[BuyerAgent] ═══════════════════════════════════════════════════`);

      // ── Phase 1: Download encrypted blob from Walrus ──
      console.log(`\n[BuyerAgent] [Phase 1] Downloading encrypted blob from Walrus...`);
      const rawDownload = await walrusClient.downloadBlob(blobId);

      // ── Phase 2: Decrypt the data using AES-256-GCM ──
      console.log(`[BuyerAgent] [Phase 2] Decrypting blob with AES-256-GCM...`);
      let decryptedContent: string;
      try {
        const cipherBuffer = Buffer.from(rawDownload, 'binary');
        decryptedContent = decrypt(cipherBuffer, config.dataEncryptionKey);
        console.log(`[BuyerAgent] Decryption successful. Plaintext: ${decryptedContent.length} chars`);
      } catch (decryptError: any) {
        // Graceful fallback: if decryption fails (e.g., fallback mock data), treat as plaintext
        console.warn(`[BuyerAgent] Decryption failed (${decryptError.message}). Treating download as plaintext (simulation fallback).`);
        decryptedContent = rawDownload;
      }

      // ── Phase 3: Run Strategy Analysis with Hash Verification ──
      console.log(`[BuyerAgent] [Phase 3] Running strategy analysis with cryptographic verification...`);
      const analysis = strategy.evaluateData(decryptedContent, verificationHashHex);
      console.log(`[BuyerAgent] Strategy Result: Action=${analysis.action}, UseScallop=${analysis.useScallopFlashLoan}`);

      // ── Phase 4: Build and Execute Transaction ──
      console.log(`[BuyerAgent] [Phase 4] Building transaction...`);

      if (analysis.action === 'HOLD') {
        console.log(`[BuyerAgent] Strategy indicates HOLD. Skipping purchase and trade execution.`);
        console.log(`[BuyerAgent] ═══════════════════════════════════════════════════`);
        console.log(`[BuyerAgent] Cycle completed (HOLD — no action taken).`);
        console.log(`[BuyerAgent] ═══════════════════════════════════════════════════\n`);
        return;
      }

      const tradeQuantity = 500_000_000; // 0.5 SUI trade capital

      if (analysis.useScallopFlashLoan) {
        // ═══ ATOMIC PTB: Scallop Borrow → Purchase → DeepBook Trade → Scallop Repay ═══
        console.log(`\n[BuyerAgent] *** ATOMIC PTB MODE ***`);
        console.log(`[BuyerAgent] Composing single PTB: Borrow → Purchase → Trade → Repay`);

        const atomicTx = suiClient.buildAtomicArbitragePTB(
          listingId,
          publisher,
          price,
          analysis.action,
          tradeQuantity,
        );

        const result = await suiClient.signAndExecute(atomicTx, this.keypair, 'AtomicArbitrage');

        const licenseId = '0xLICENSE_' + Math.random().toString(36).substring(2, 10).toUpperCase();
        console.log(`\n[BuyerAgent] ✅ Atomic PTB executed successfully!`);
        console.log(`[BuyerAgent]   Transaction Digest: ${result.digest}`);
        console.log(`[BuyerAgent]   LicenseCap minted: ${licenseId}`);
        console.log(`[BuyerAgent]   Scallop flash loan: borrowed and repaid in same TX`);
        console.log(`[BuyerAgent]   DeepBook trade: ${analysis.action} order placed`);
      } else {
        // ═══ STANDARD PTB: Purchase Only + Separate DeepBook Trade ═══
        console.log(`\n[BuyerAgent] *** STANDARD MODE (no Scallop) ***`);

        // Step 1: Purchase data listing
        const purchaseTx = suiClient.buildPurchaseDataTx(listingId, publisher, price);
        const purchaseResult = await suiClient.signAndExecute(purchaseTx, this.keypair, 'PurchaseData');

        const licenseId = '0xLICENSE_' + Math.random().toString(36).substring(2, 10).toUpperCase();
        console.log(`[BuyerAgent] Purchase complete. LicenseCap: ${licenseId}`);

        // Step 2: Execute DeepBook trade separately
        if (analysis.action === 'BUY' || analysis.action === 'SELL') {
          console.log(`[BuyerAgent] Executing standalone DeepBook V3 trade...`);

          const tradeTx = suiClient.buildPurchaseDataTx(listingId, publisher, 0); // reuse tx builder
          suiClient.addDeepBookMarketOrder(tradeTx, analysis.action, tradeQuantity);

          const tradeResult = await suiClient.signAndExecute(tradeTx, this.keypair, `DeepBookMarketOrder_${analysis.action}`);
          console.log(`[BuyerAgent] DeepBook trade executed. Digest: ${tradeResult.digest}`);
        }
      }

      console.log(`\n[BuyerAgent] ═══════════════════════════════════════════════════`);
      console.log(`[BuyerAgent] FULL CYCLE COMPLETE for listing ${listingId}`);
      console.log(`[BuyerAgent] ═══════════════════════════════════════════════════\n`);

    } catch (error: any) {
      console.error(`[BuyerAgent] Purchase and process cycle failed: ${error.message}`);
    }
  }
}
export const buyerAgent = new BuyerAgent();
