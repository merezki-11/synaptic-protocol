# Synaptic

> **Verifiable Agent-to-Agent Synthetic Data Marketplace Protocol**  
> Built as a flagship project for the **Sui Overflow 2026 Hackathon** (Deadline: June 20/21, 2026).  
> **Target Tracks:** The Agentic Web · DeFi & Payments · Special — Walrus

[Live Testnet Explorer](https://suiscan.xyz/testnet/object/0xb1d698752c2df89dec49dee977032ebabcf2f07cce6b75b6f1a97895bc2ab0a5) · [Sui Package ID](https://suiscan.xyz/testnet/object/0xb1d698752c2df89dec49dee977032ebabcf2f07cce6b75b6f1a97895bc2ab0a5) · [Marketplace Config ID](https://suiscan.xyz/testnet/object/0x4be077463ffb5dfcd9ff35af96a1d15900b853d3977e870fc5c7624c8d954f64)

---

Synaptic is a highly sophisticated, verifiable agent-to-agent synthetic data marketplace protocol designed for autonomous agent swarms. It enables high-fidelity oracle and sentiment data providers to encrypt and store datasets on Walrus decentralized storage, register their cryptographic identities on-chain, and list access licenses on the Sui blockchain. Buyers can query active listings, source flash loan liquidity from Scallop to buy licenses, retrieve and decrypt the dataset from Walrus, and execute automated arbitrage trades on the DeepBook V3 CLOB based on decrypted indicators.

---

## Screenshots

### Welcome Dashboard Telemetry
![Welcome Dashboard](images/Screenshot%202026-06-16%20121431.png)

### Active Swarm & Decryption Sandbox
![Active Swarm & Decryption Sandbox](images/Screenshot%202026-06-16%20121658.png)

---

## How It Works

The system utilizes a 100% atomic, multi-protocol Programmable Transaction Block (PTB) pipeline to execute borrows, purchases, trades, and repayments in a single transaction block.

```
       [ Oracle-Alpha Agent (Seller) ]
                     │
         1. Aggregates & Encrypts Data
           (AES-256-GCM + SHA-256)
                     │
                     ▼
         2. Uploads encrypted blob
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
   [ Walrus Storage ]   [ Sui Blockchain ]
   (Decentralized Blob) (Listing Published)
                                │
                      3. Announce WebSocket
                                │
                                ▼
                   [ Arb-Bot Agent (Buyer) ]
                                │
                     4. Triggers Swarm Cycle
                                │
                                ▼
                     ┌──────────────────┐
                     │  Atomic PTB Loop │
                     └─────────┬────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
     [ Scallop Pool ]    [ Sui Contract ]   [ DeepBook V3 ]
     - Flash Loans SUI   - Purchase Data    - Place Market Buy
     - Repays with fee   - License Minted   - Execute Arbitrage
```

---

## Features

* **Generic Multi-Token Payments** — Fully upgraded smart contracts supporting generic coin types (`Listing<phantom COIN>`, `Escrow<phantom COIN>`), allowing SUI and USDC listings to coexist and settle on-chain seamlessly.
* **Audit-Hardened Escrow Module** — Created a secure dynamic escrow holding seller revenue and protocol fees with dedicated dispute opening and admin arbitration flows.
* **Wash-Trading / Self-Purchase Prevention** — Actively checks and blocks publishers from purchasing their own data listings to inflate agent performance metrics.
* **AES-256-GCM Encrypted Walrus Portal** — Pre-shared 32-byte authenticated symmetric encryption executing off-chain prior to decentralized blob storage uploads.
* **Atomic Multi-Protocol PTB Pipeline** — Composes flash loans, license acquisitions, order matching, and obligation settlement across Sui, Walrus, Scallop, and DeepBook V3 in a single transaction.
* **Premium Cyberpunk Visualization Dashboard** — Full-stack real-time telemetry displaying live agents, logs, and sandbox.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Smart Contracts** | Sui Move (Edition 2024.beta) |
| **Agent Engine** | TypeScript / Node.js (ESM-Native) |
| **Web App** | React 19, Vite 8, TypeScript |
| **Styling** | Vanilla CSS (HSL variables, glassmorphism, keyframes) |
| **Storage Gateway** | Walrus Protocol Testnet API |
| **DeFi Liquidity** | DeepBook V3, Scallop Protocols |
| **RPC Provider** | Sui Testnet JSON-RPC (`SuiJsonRpcClient`) |

---

## Core Components

### 1. Programmable Transaction Block (Sui Move Entry)
```move
public fun purchase_data<COIN>(
    listing: &mut Listing<COIN>,
    agent: &mut Agent,
    config: &mut MarketplaceConfig,
    mut payment: Coin<COIN>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(listing.is_active, EListingNotActive);
    let buyer = ctx.sender();
    assert!(buyer != listing.publisher_address, ESelfPurchaseBlocked);
    assert!(coin.value(&payment) >= listing.price, EInsufficientPayment);

    // Dynamic fee calculations and coin splitting...
}
```

### 2. Off-Chain Atomic PTB Composer (TypeScript SDK)
```typescript
buildAtomicArbitragePTB(
  listingId: string,
  agentId: string,
  price: number,
  tradeDirection: 'BUY' | 'SELL',
  tradeQuantity: number,
  coinType: string = '0x2::sui::SUI'
): Transaction {
  const tx = new Transaction();

  // 1. Scallop Flash Borrow
  const { borrowedCoin, receipt } = this.addScallopFlashBorrow(tx, totalBorrow);

  // 2. Synaptic Purchase Data
  const [paymentCoin] = tx.splitCoins(borrowedCoin, [price]);
  tx.moveCall({
    target: `${config.synapticPackageId}::marketplace::purchase_data`,
    typeArguments: [coinType],
    arguments: [listingId, agentId, config.marketplaceConfigId, paymentCoin, '0x6'],
  });

  // 3. DeepBook V3 Order Matching
  this.addDeepBookMarketOrder(tx, tradeDirection, tradeQuantity);

  // 4. Scallop Flash Repay
  const [repaymentCoin] = tx.splitCoins(tx.gas, [totalRepayment]);
  this.addScallopFlashRepay(tx, repaymentCoin, receipt);

  return tx;
}
```

---

## Move API Specification

### Error Codes
| Code | Constant | Description |
|---|---|---|
| `0` | `ENotAgentOwner` | Caller's AgentCap does not match the listing's publisher. |
| `1` | `EListingNotActive` | Listing has been deactivated. |
| `2` | `EInsufficientPayment` | Payment coin value is below the listing price. |
| `6` | `EDisputeAlreadyResolved` | Dispute has already been resolved or paid. |
| `8` | `ESelfPurchaseBlocked` | Publisher is attempting to purchase their own data listing. |
| `10` | `EDisputeAlreadyOpened` | Dispute has already been opened for this escrow. |

---

## Running Locally

Follow these quick setup instructions to build, compile, and run the entire Synaptic stack locally.

### Prerequisites
* Node.js (v18+)
* npm or pnpm
* Sui CLI (`v1.72.5` or higher)

### 1. Compile & Verify Smart Contracts (Sui Move)
```bash
cd synaptic_protocol

# Run compilation
sui move build

# Run unit tests (All 22 tests passing green)
sui move test
```

### 2. Configure & Execute the Off-Chain Agent Loop
The agent engine runs in an autonomous cycle. When a mock environment is configured, it falls back to simulated transactions and REST requests, allowing developers to test the full lifecycle immediately without requiring active faucet balances.
```bash
cd agents

# Create configuration
cp .env.example .env

# Install dependencies
npm install

# Compile TypeScript
npm run build

# Start the Seller and Buyer agent daemons
npm start
```

### 3. Spin Up the Premium Web Dashboard
```bash
cd dashboard

# Install dependencies
npm install --legacy-peer-deps

# Start Vite local development server
npm run dev
```
Open **[http://localhost:5173/](http://localhost:5173/)** in your browser.

---

## Project Structure

```
SUI/
├── synaptic_protocol/            # Layer 1: Sui Move Smart Contracts
│   ├── sources/                  # Move source modules
│   │   ├── agent_registry.move   # Agent registrations & reputation
│   │   └── marketplace.move      # Dynamic listings, escrows, and fees
│   └── tests/                    # Hardened contract integration suites
│
├── agents/                       # Layer 2: TS Off-Chain Daemon Swarm
│   └── src/
│       ├── buyer/                # Arb-Bot strategies & Scallop borrows
│       ├── seller/               # Oracle-Alpha price collection & Walrus upload
│       └── common/               # Sui client, cryptos, and configurations
│
└── dashboard/                    # Layer 3: Cyberpunk Dashboard UI
    └── src/
        ├── components/           # Telemetry maps, ledgers, and sandboxes
        └── App.tsx               # Swarm cycle and manual purchase controls
```

---

## Author

**merezki-11**  
* GitHub: [@merezki-11](https://github.com/merezki-11)

---

## License

This project is licensed under the **MIT License**.
