import assert from 'node:assert';
import { encrypt, decrypt } from './crypto.js';
import { strategy } from '../buyer/strategy.js';
import { config } from './config.js';
import * as crypto from 'crypto';

console.log('════════════════════════════════════════════════════════════════');
console.log('🧪 Starting Synaptic Agent Engine Suite...');
console.log('════════════════════════════════════════════════════════════════');

let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    testsPassed++;
  } catch (error: any) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(error);
    testsFailed++;
  }
}

// 1. Cryptography Unit Tests
test('Cryptography - Encryption & Decryption End-to-End', () => {
  const secretKey = 'test-passphrase-must-be-long-and-secure';
  const originalMessage = 'Hello, Synaptic Protocol!';

  const cipherTextBuffer = encrypt(originalMessage, secretKey);
  assert.ok(cipherTextBuffer.length > 28, 'Ciphertext buffer must be longer than IV + AuthTag');

  const decryptedMessage = decrypt(cipherTextBuffer, secretKey);
  assert.strictEqual(decryptedMessage, originalMessage, 'Decrypted message must match original message');
});

test('Cryptography - Tampered Ciphertext Throws Error', () => {
  const secretKey = 'test-passphrase-must-be-long-and-secure';
  const cipherTextBuffer = encrypt('Test Payload', secretKey);

  // Alter the ciphertext buffer
  cipherTextBuffer[cipherTextBuffer.length - 1] ^= 0xFF;

  assert.throws(() => {
    decrypt(cipherTextBuffer, secretKey);
  }, /unsupported|auth tag mismatch/i, 'Tampered ciphertext must throw authentication mismatch error');
});

test('Cryptography - Wrong Decryption Key Throws Error', () => {
  const cipherTextBuffer = encrypt('Secure Content', 'correct-key');

  assert.throws(() => {
    decrypt(cipherTextBuffer, 'wrong-key');
  }, 'Decrypting with incorrect key must fail auth check');
});

// 2. Strategy Unit Tests
test('Strategy - Valid Data Evaluation', () => {
  const payload = {
    pair: 'SUI/USDC',
    bestBid: 1.25,
    bestAsk: 1.26,
    spread: 0.01,
    socialSentiment: 0.85,
    signals: {
      deepbookArbitrageSignal: 'BUY' as const,
      scallopBorrowOpportunity: true
    },
    timestamp: Date.now()
  };

  const rawContent = JSON.stringify(payload);
  const expectedHash = crypto.createHash('sha256').update(rawContent).digest('hex');

  const analysis = strategy.evaluateData(rawContent, expectedHash);
  assert.strictEqual(analysis.action, 'BUY');
  assert.strictEqual(analysis.useScallopFlashLoan, true);
});

test('Strategy - Invalid Data fallback to HOLD', () => {
  const analysis = strategy.evaluateData('invalid-json');
  assert.strictEqual(analysis.action, 'HOLD');
  assert.strictEqual(analysis.useScallopFlashLoan, false);
});

// 3. Configuration Unit Tests
test('Configuration - Types & Defaults Verified', () => {
  assert.strictEqual(typeof config.suiRpcUrl, 'string');
  assert.strictEqual(typeof config.sellerIntervalMs, 'number');
  assert.strictEqual(typeof config.dataEncryptionKey, 'string');
  assert.ok(config.sellerIntervalMs > 0, 'Seller interval must be positive integer');
});

console.log('════════════════════════════════════════════════════════════════');
console.log(`📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);
console.log('════════════════════════════════════════════════════════════════');

if (testsFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
