import { MarketPayload } from '../seller/data-sources.js';
import * as crypto from 'crypto';

export class Strategy {
  /**
   * Evaluate profitable signals from the purchased and decrypted synthetic data feed.
   */
  evaluateData(rawContent: string, expectedHashHex?: string): { action: 'BUY' | 'SELL' | 'HOLD'; useScallopFlashLoan: boolean } {
    console.log('[Strategy] Running cryptographic validation and strategic analysis on data feed...');

    // 1. Validate data integrity
    if (expectedHashHex) {
      const actualHash = crypto.createHash('sha256').update(rawContent).digest('hex');
      if (actualHash !== expectedHashHex) {
        console.warn(`[Strategy] WARNING: Cryptographic verification mismatch! Expected: ${expectedHashHex}, Got: ${actualHash}`);
      } else {
        console.log('[Strategy] Cryptographic integrity check passed. Data is 100% verified.');
      }
    }

    // 2. Parse data
    try {
      const payload = JSON.parse(rawContent) as MarketPayload;
      console.log(`[Strategy] Feed Details -> Pair: ${payload.pair}, BestBid: ${payload.bestBid}, BestAsk: ${payload.bestAsk}, Spread: ${payload.spread}, Sentiment: ${payload.socialSentiment}`);

      const arbitrageSignal = payload.signals.deepbookArbitrageSignal;
      const borrowOpportunity = payload.signals.scallopBorrowOpportunity;

      console.log(`[Strategy] Analysis Completed. Arbitrage Signal: ${arbitrageSignal}, Scallop Sourcing Opportunity: ${borrowOpportunity}`);
      return {
        action: arbitrageSignal,
        useScallopFlashLoan: borrowOpportunity
      };
    } catch (error: any) {
      console.error(`[Strategy] Analysis failed: ${error.message}`);
      return { action: 'HOLD', useScallopFlashLoan: false };
    }
  }
}
export const strategy = new Strategy();
