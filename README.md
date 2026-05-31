# 🌌 Synaptic

> **Verifiable Agent-to-Agent Synthetic Data Marketplace Protocol**  
> Built as a flagship project for the **Sui Overflow 2026 Hackathon** (Deadline: June 20/21, 2026).  
> **Target Tracks:** The Agentic Web · DeFi & Payments · Special — Walrus

Synaptic is a highly sophisticated, verifiable agent-to-agent synthetic data marketplace protocol designed for autonomous agent swarms. It enables high-fidelity oracle and sentiment data providers to encrypt and store datasets on Walrus decentralized storage, register their cryptographic identities on-chain, and list access licenses on the Sui blockchain. Buyers can query active listings, source flash loan liquidity from Scallop to buy licenses, retrieve and decrypt the dataset from Walrus, and execute automated arbitrage trades on the DeepBook V3 CLOB based on decrypted indicators.

---

## 🏗️ Architecture & Sponsor Integrations

Synaptic leverages a multi-layered decentralized stack:

1. **Sui Move Smart Contracts (`/synaptic_protocol`)**:
   - **`agent_registry.move`**: Handles agent registration, profile metadata, and reputation tracking. privileged mutations are securely guarded by the owner's `AgentCap`.
   - **`marketplace.move`**: Manages data listings, prices, and soul-bound `LicenseCap` proofs of purchase. Integrates an exact-splitting payment mechanism that divides fees between the protocol treasury and the seller address while returning any SUI overpayment (change) back to the buyer automatically.
2. **ESM-Native TypeScript Agent Engine (`/agents`)**:
   - **Seller Agent (Oracle-Alpha)**: Scrapes trading stats (simulating real-time order book spreads), encrypts the data feed, uploads it to **Walrus Protocol** via its HTTP Publisher REST API, and publishes the listing on Sui.
   - **Buyer Agent (Arb-Bot)**: Listens for listings via Sui event logs, flash-borrows SUI from **Scallop Protocol** to fund the purchase, splits the payment to buy the license, downloads the blob from **Walrus** via its HTTP Aggregator, evaluates trade indicators, and places market orders on the **DeepBook V3 CLOB** via its `BalanceManager`.
3. **Premium Cyberpunk Dashboard (`/dashboard`)**:
   - Built with React, TypeScript, and Vite.
   - Visually represents the active nodes (Seller, Buyer, Walrus) and maps real-time data packets flowing between them.
   - Displays active listings, simulates manual purchases (with `canvas-confetti` fireworks!), and features a cryptographic jumbling sandbox decrypting the downloaded datasets.

---

## 🚦 Getting Started & Operational Testing

Follow these quick setup instructions to build, compile, and run the entire Synaptic stack locally.

### Prerequisites
- Node.js (v18+)
- npm or pnpm
- Sui CLI (`v1.73.0` or higher)

---

### 1. Compile & Verify Smart Contracts (Sui Move)

```bash
cd synaptic_protocol

# Run compilation
sui move build

# Run unit tests (All 18 tests passing green)
sui move test
```

### 2. Configure & Execute the Off-Chain Agent Loop

The agent engine runs in an autonomous cycle. When a mock environment is configured, it falls back to elegant simulated transactions and REST requests, allowing developers to test the full lifecycle immediately without requiring active faucet balances.

```bash
cd agents

# Install dependencies
npm install

# Compile TypeScript
npm run build

# Start the Seller and Buyer agent daemons
npm start
```
*You will immediately see the Seller agent registering, uploading simulated price spreads to Walrus, listing the blob ID on-chain, and the Buyer agent capturing the listing, initiating a Scallop borrow, purchasing the license, downloading the data, and completing a DeepBook arbitrage trade!*

### 3. Spin Up the Premium Web Dashboard

```bash
cd dashboard

# Install dependencies (utilizing legacy peer deps for React 19 compatibility)
npm install --legacy-peer-deps

# Start Vite local development server
npm run dev
```

Open **[http://localhost:5173/](http://localhost:5173/)** in your browser. 
- Click **"Trigger Autonomous Swarm Cycle"** to watch the Seller and Buyer nodes communicate, see the matrix event logs scroll in real-time, and view the decrypted dataset.
- Click **"Purchase"** on any active listing to trigger the manual license purchase flow with confetti effects!

---

## 🔒 Security & Best Practices
- **Verifiable Access Control**: All publisher mutations (listings, updates, deactivations) require the matching, owned `AgentCap`.
- **Soul-Bound Licenses**: The minted `LicenseCap` holds the `key` ability only (no `store`), making it strictly non-transferable and tied to the buyer address.
- **Dust-Free Coin Splitting**: The marketplace uses precise coin splitting to prevent SUI dust accumulation, returning excess gas immediately to the transaction sender.
- **Strict Linter Compliance**: Suppresses necessary self-transfers (`#[allow(lint(self_transfer))]`) to support convenient cap delivery and payment change distributions, leaving the rest of the codebase warning-free.
