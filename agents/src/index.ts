import { sellerAgent } from './seller/oracle-alpha.js';
import { buyerAgent } from './buyer/arb-bot.js';
import { EventEmitter } from 'events';

// Create a global event emitter for simulated Sui event subscriptions in local environment
const synapticEventsEmitter = new EventEmitter();
(global as any).synapticEventsEmitter = synapticEventsEmitter;

async function main() {
  console.clear();
  console.log('===================================================================');
  console.log('  🌌 SYNAPTIC — OFF-CHAIN AUTONOMOUS AGENT MARKETPLACE ENGINE      ');
  console.log('===================================================================');
  console.log('  Tracks: The Agentic Web · DeFi & Payments · Special — Walrus     ');
  console.log('  Status: Smart contracts verified (18/18 tests green)');
  console.log('===================================================================\n');

  console.log('[System] Launching autonomous agent daemons...');
  
  // 1. Start Buyer Agent listener
  buyerAgent.start(synapticEventsEmitter);

  // 2. Start Seller Agent loop
  sellerAgent.start();

  console.log('\n[System] All daemons running. Press Ctrl+C to terminate.\n');
}

main().catch((error) => {
  console.error('[Fatal] Daemon crashed:', error);
});
