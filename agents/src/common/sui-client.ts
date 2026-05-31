import { SuiJsonRpcClient as SuiClient } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { config } from './config.js';

// SUI type tag constant
const SUI_TYPE = '0x2::sui::SUI';

export class SuiClientWrapper {
  public client: SuiClient;

  constructor() {
    this.client = new SuiClient({
      url: config.suiRpcUrl,
      network: 'testnet',
    });
  }

  /**
   * Parse a private key (hex or bech32) to generate an Ed25519Keypair
   */
  getKeypair(privateKeyStr: string): Ed25519Keypair {
    try {
      let cleanedKey = privateKeyStr;
      if (cleanedKey.startsWith('0x')) {
        cleanedKey = cleanedKey.substring(2);
      }

      if (/^[0-9a-fA-F]+$/.test(cleanedKey)) {
        const bytes = Uint8Array.from(Buffer.from(cleanedKey, 'hex'));
        const keyLength = bytes.length;
        if (keyLength === 32 || keyLength === 64) {
          return Ed25519Keypair.fromSecretKey(bytes.slice(0, 32));
        }
      }

      return Ed25519Keypair.fromSecretKey(cleanedKey);
    } catch (error: any) {
      console.warn(`[SuiClient] Private key parsing failed: ${error.message}. Using fallback keypair.`);
      return new Ed25519Keypair();
    }
  }

  getSellerKeypair(): Ed25519Keypair {
    return this.getKeypair(config.sellerPrivateKey);
  }

  getBuyerKeypair(): Ed25519Keypair {
    return this.getKeypair(config.buyerPrivateKey);
  }

  /**
   * Helper to sign and execute a transaction block.
   * If config package ID is '0x0', it runs a simulated transaction.
   */
  async signAndExecute(tx: Transaction, signer: Ed25519Keypair, actionName: string): Promise<{ digest: string; events?: any[]; rawResult?: any }> {
    const isMock = config.synapticPackageId === '0x0' || config.synapticPackageId === '0x0000000000000000000000000000000000000000000000000000000000000000';
    const signerAddress = signer.getPublicKey().toSuiAddress();
    
    console.log(`[SuiClient] [${actionName}] Preparing PTB signed by ${signerAddress}...`);

    if (isMock) {
      console.log(`[SuiClient] [${actionName}] (SIMULATION ACTIVE) Deployed package is "0x0". Bypassing node call.`);
      const dummyDigest = 'MOCK_TX_' + Math.random().toString(36).substring(2, 15).toUpperCase();
      console.log(`[SuiClient] [${actionName}] Transaction Simulated. Digest: ${dummyDigest}`);
      return { digest: dummyDigest, events: [] };
    }

    try {
      tx.setSender(signerAddress);
      const result: any = await this.client.signAndExecuteTransaction({
        transaction: tx,
        signer: signer,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      if (result.$kind === 'FailedTransaction') {
        throw new Error(`Transaction execution failed on-chain: ${result.FailedTransaction.status.error?.message || 'Unknown abort'}`);
      }

      const txDigest = result.digest || (result.Transaction && result.Transaction.digest) || '';
      const txEvents = result.events || (result.Transaction && result.Transaction.events) || [];

      console.log(`[SuiClient] [${actionName}] Executed successfully! Transaction Digest: ${txDigest}`);
      return { digest: txDigest, events: txEvents, rawResult: result };
    } catch (error: any) {
      console.error(`[SuiClient] [${actionName}] Transaction execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Parse the created shared object ID from transaction effects
   */
  parseCreatedSharedObjectId(rawResult: any): string | null {
    if (!rawResult) return null;
    const effects = rawResult.effects || (rawResult.Transaction && rawResult.Transaction.effects);
    if (!effects || !effects.created) return null;

    for (const obj of effects.created) {
      const owner = obj.owner;
      if (owner === 'Shared' || (owner && typeof owner === 'object' && ('Shared' in owner || 'Shared' in owner.toString()))) {
        return obj.reference?.objectId || obj.objectId;
      }
    }
    return null;
  }

  /**
   * Parse the created owned object ID (e.g. AgentCap) from transaction effects
   */
  parseCreatedOwnedObjectId(rawResult: any, ownerAddress: string): string | null {
    if (!rawResult) return null;
    const effects = rawResult.effects || (rawResult.Transaction && rawResult.Transaction.effects);
    if (!effects || !effects.created) return null;

    for (const obj of effects.created) {
      const owner = obj.owner;
      if (owner && typeof owner === 'object' && owner.AddressOwner === ownerAddress) {
        return obj.reference?.objectId || obj.objectId;
      }
    }
    return null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PTB Builders — Core Synaptic
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * PTB Builder: Register an Agent
   */
  buildRegisterAgentTx(name: string, modelHash: Uint8Array, categories: string[]): Transaction {
    const tx = new Transaction();
    const SYSTEM_CLOCK_ID = '0x6';

    tx.moveCall({
      target: `${config.synapticPackageId}::agent_registry::register_agent`,
      arguments: [
        tx.pure.string(name),
        tx.pure.vector('u8', modelHash),
        tx.pure.vector('string', categories),
        tx.object(SYSTEM_CLOCK_ID),
      ],
    });

    return tx;
  }

  /**
   * PTB Builder: Create a Listing, generic over the payment token (COIN)
   */
  buildCreateListingTx(
    agentId: string,
    agentCapId: string,
    price: number,
    blobId: string,
    verificationHash: Uint8Array,
    category: string,
    coinType: string = '0x2::sui::SUI'
  ): Transaction {
    const tx = new Transaction();
    const SYSTEM_CLOCK_ID = '0x6';

    tx.moveCall({
      target: `${config.synapticPackageId}::marketplace::create_listing`,
      typeArguments: [coinType],
      arguments: [
        tx.object(agentId),
        tx.object(agentCapId),
        tx.object(config.marketplaceConfigId),
        tx.pure.u64(price),
        tx.pure.vector('u8', Array.from(Buffer.from(blobId))),
        tx.pure.vector('u8', verificationHash),
        tx.pure.string(category),
        tx.object(SYSTEM_CLOCK_ID),
      ],
    });

    return tx;
  }

  /**
   * PTB Builder: Purchase Data Listing (standalone), generic over the payment token (COIN)
   */
  buildPurchaseDataTx(listingId: string, agentId: string, price: number, coinType: string = '0x2::sui::SUI'): Transaction {
    const tx = new Transaction();
    const SYSTEM_CLOCK_ID = '0x6';

    const [paymentCoin] = tx.splitCoins(tx.gas, [price]);

    tx.moveCall({
      target: `${config.synapticPackageId}::marketplace::purchase_data`,
      typeArguments: [coinType],
      arguments: [
        tx.object(listingId),
        tx.object(agentId),
        tx.object(config.marketplaceConfigId),
        paymentCoin,
        tx.object(SYSTEM_CLOCK_ID),
      ],
    });

    return tx;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PTB Builders — DeepBook V3 Integration
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Build a DeepBook V3 place_market_order MoveCall within an existing Transaction.
   * Returns the Transaction for chaining.
   */
  addDeepBookMarketOrder(
    tx: Transaction,
    direction: 'BUY' | 'SELL',
    quantity: number,
  ): Transaction {
    const isBid = direction === 'BUY';

    console.log(`[SuiClient] Injecting DeepBook V3 MoveCall: place_market_order (${direction}, qty: ${quantity / 1e9} SUI)`);
    console.log(`[SuiClient]   Pool: ${config.deepbookPoolId}`);
    console.log(`[SuiClient]   BalanceManager: ${config.deepbookBalanceManagerId}`);

    // DeepBook V3 place_market_order MoveCall
    // Target: deepbook_v3::pool::place_market_order<BaseAsset, QuoteAsset>
    tx.moveCall({
      target: `${config.deepbookPackageId}::pool::place_market_order`,
      typeArguments: [SUI_TYPE, '0x2::usdc::USDC'],
      arguments: [
        tx.object(config.deepbookPoolId),           // Pool shared object
        tx.object(config.deepbookBalanceManagerId),  // BalanceManager owned object
        tx.pure.u64(quantity),                       // Quantity in base asset units
        tx.pure.bool(isBid),                         // true = buy, false = sell
        tx.object('0x6'),                            // Clock
      ],
    });

    console.log(`[SuiClient] DeepBook MoveCall injected into PTB successfully.`);
    return tx;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PTB Builders — Scallop Flash Loan Integration
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Inject Scallop flash_borrow MoveCall into a Transaction.
   * Returns the [borrowedCoin, flashLoanReceipt] results for later use.
   */
  addScallopFlashBorrow(
    tx: Transaction,
    amount: number,
  ): { borrowedCoin: any; receipt: any } {
    console.log(`[SuiClient] Injecting Scallop MoveCall: flash_borrow (${amount / 1e9} SUI)`);
    console.log(`[SuiClient]   Market: ${config.scallopMarketId}`);
    console.log(`[SuiClient]   Version: ${config.scallopVersionId}`);

    // Scallop flash_borrow returns (Coin<SUI>, FlashLoanReceipt<SUI>)
    const [borrowedCoin, receipt] = tx.moveCall({
      target: `${config.scallopPackageId}::flash_loan::borrow_flash_loan`,
      typeArguments: [SUI_TYPE],
      arguments: [
        tx.object(config.scallopVersionId),  // Protocol version object
        tx.object(config.scallopMarketId),   // Market/pool object
        tx.pure.u64(amount),                 // Amount to borrow in MIST
      ],
    });

    console.log(`[SuiClient] Scallop flash_borrow MoveCall injected successfully.`);
    return { borrowedCoin, receipt };
  }

  /**
   * Inject Scallop flash_repay MoveCall into a Transaction.
   * Consumes the flash loan receipt (hot potato) and repayment coin.
   */
  addScallopFlashRepay(
    tx: Transaction,
    repaymentCoin: any,
    receipt: any,
  ): void {
    console.log(`[SuiClient] Injecting Scallop MoveCall: repay_flash_loan`);

    tx.moveCall({
      target: `${config.scallopPackageId}::flash_loan::repay_flash_loan`,
      typeArguments: [SUI_TYPE],
      arguments: [
        tx.object(config.scallopVersionId),  // Protocol version object
        tx.object(config.scallopMarketId),   // Market/pool object
        repaymentCoin,                       // Coin<SUI> for repayment (principal + fee)
        receipt,                             // FlashLoanReceipt<SUI> (hot potato)
      ],
    });

    console.log(`[SuiClient] Scallop flash_repay MoveCall injected successfully.`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PTB Builder — Atomic Arbitrage PTB (Centerpiece)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Build the atomic arbitrage PTB: a single Transaction composing:
   *   1. Scallop flash_borrow → get borrowed SUI + receipt
   *   2. marketplace::purchase_data → buy listing with borrowed funds
   *   3. DeepBook place_market_order → execute arbitrage trade
   *   4. Scallop flash_repay → return receipt + repayment
   *
   * This is the blueprint's centerpiece feature — one atomic PTB.
   */
  buildAtomicArbitragePTB(
    listingId: string,
    agentId: string,
    price: number,
    tradeDirection: 'BUY' | 'SELL',
    tradeQuantity: number,
    coinType: string = '0x2::sui::SUI'
  ): Transaction {
    const tx = new Transaction();
    const SYSTEM_CLOCK_ID = '0x6';

    console.log(`[SuiClient] ═══════════════════════════════════════════════════`);
    console.log(`[SuiClient] Building ATOMIC ARBITRAGE PTB`);
    console.log(`[SuiClient] Steps: Scallop Borrow → Purchase Data → DeepBook Trade → Scallop Repay`);
    console.log(`[SuiClient] ═══════════════════════════════════════════════════`);

    // Calculate total borrow: listing price + estimated trade capital + Scallop fee (0.1%)
    const scallopFeeBps = 10; // 0.1% = 10 bps
    const totalBorrow = price + tradeQuantity;
    const scallopFee = Math.ceil(totalBorrow * scallopFeeBps / 10000);
    const totalRepayment = totalBorrow + scallopFee;

    console.log(`[SuiClient] [Step 0] Calculated borrow requirements:`);
    console.log(`[SuiClient]   Listing price: ${price / 1e9} SUI`);
    console.log(`[SuiClient]   Trade capital: ${tradeQuantity / 1e9} SUI`);
    console.log(`[SuiClient]   Scallop fee (0.1%): ${scallopFee / 1e9} SUI`);
    console.log(`[SuiClient]   Total borrow: ${totalBorrow / 1e9} SUI`);

    // ── Step 1: Scallop Flash Borrow ──
    console.log(`[SuiClient] [Step 1/4] Scallop flash_borrow...`);
    const { borrowedCoin, receipt } = this.addScallopFlashBorrow(tx, totalBorrow);

    // ── Step 2: Synaptic Purchase Data ──
    console.log(`[SuiClient] [Step 2/4] marketplace::purchase_data...`);
    const [paymentCoin] = tx.splitCoins(borrowedCoin, [price]);

    tx.moveCall({
      target: `${config.synapticPackageId}::marketplace::purchase_data`,
      typeArguments: [coinType],
      arguments: [
        tx.object(listingId),
        tx.object(agentId),
        tx.object(config.marketplaceConfigId),
        paymentCoin,
        tx.object(SYSTEM_CLOCK_ID),
      ],
    });

    // ── Step 3: DeepBook V3 Market Order ──
    console.log(`[SuiClient] [Step 3/4] DeepBook place_market_order (${tradeDirection})...`);
    this.addDeepBookMarketOrder(tx, tradeDirection, tradeQuantity);

    // ── Step 4: Scallop Flash Repay ──
    console.log(`[SuiClient] [Step 4/4] Scallop flash_repay...`);
    // Split repayment amount from gas to cover the flash loan + fee
    const [repaymentCoin] = tx.splitCoins(tx.gas, [totalRepayment]);
    this.addScallopFlashRepay(tx, repaymentCoin, receipt);

    console.log(`[SuiClient] ═══════════════════════════════════════════════════`);
    console.log(`[SuiClient] ATOMIC PTB ASSEMBLED: 4 MoveCalls in 1 Transaction`);
    console.log(`[SuiClient] ═══════════════════════════════════════════════════`);

    return tx;
  }
}

export const suiClient = new SuiClientWrapper();
