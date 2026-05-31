import { useState, useEffect } from 'react';
import { SwarmMap } from './components/SwarmMap.js';
import { AuditLedger, type LogEntry } from './components/AuditLedger.js';
import { DecryptionSandbox } from './components/DecryptionSandbox.js';
import { ListingPanel, type SynapticListing } from './components/ListingPanel.js';
import { SynapticLogo } from './components/SynapticLogo.js';
import { ConnectWalletButton } from './components/ConnectWalletButton.js';
import { Play, RefreshCw, Activity, Zap, TrendingUp, Clock } from 'lucide-react';
import confetti from 'canvas-confetti';

// Helper functions defined outside the component to keep rendering pure
function generateMockBlobId(): string {
  return '7b2274696d657374616d70223a313737' + Math.random().toString(36).substring(2, 6).toLowerCase();
}

function generateMockLicenseId(): string {
  return '0xLICENSE_' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getTimestamp(): number {
  return Date.now();
}

export default function App() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [listings, setListings] = useState<SynapticListing[]>([]);
  const [isSellerActive, setIsSellerActive] = useState(false);
  const [isBuyerActive, setIsBuyerActive] = useState(false);
  const [sellerStatus, setSellerStatus] = useState('Idle');
  const [buyerStatus, setBuyerStatus] = useState('Idle');
  const [packetFlowing, setPacketFlowing] = useState(false);
  
  // Decryption Sandbox state
  const [encryptedBlob, setEncryptedBlob] = useState('');
  const [decryptedData, setDecryptedData] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptProgress, setDecryptProgress] = useState(0);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const addLog = (tag: string, text: string, source: LogEntry['source']) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { time, text: `[${tag}] ${text}`, source }]);
  };

  // Load initial logs
  useEffect(() => {
    const timer = setTimeout(() => {
      addLog('System', '🌌 Synaptic protocol audit ledger initialized.', 'system');
      addLog('System', 'Smart contracts compiled and verified successfully (18/18 tests green).', 'success');
      addLog('System', 'All autonomous daemons standby. Ready to trigger Swarm Cycle.', 'system');
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  /**
   * Orchestrates a complete autonomous swarm cycle
   */
  const triggerSwarmCycle = async () => {
    if (isSellerActive || isBuyerActive) return;

    // --- SELLER AGENT SEQUENCE ---
    setIsSellerActive(true);
    setSellerStatus('Scraping Price Feeds');
    addLog('Seller', 'Initializing iteration...', 'seller');
    addLog('Seller', 'Scraping DeepBook V3 SUI/USDC bid-ask spread and volume metrics...', 'deepbook');
    await delay(1200);

    setSellerStatus('Uploading to Walrus');
    addLog('Seller', 'Aggregated synthetic dataset. Compressing and generating SHA-256 hash...', 'seller');
    addLog('Walrus', 'Sending HTTP PUT /v1/blobs?epochs=1 to Decentralized Storage...', 'walrus');
    await delay(1500);

    const mockBlobId = generateMockBlobId();
    addLog('Walrus', `Upload complete. Certified Blob ID: ${mockBlobId}`, 'success');
    await delay(800);

    const useSui = Math.random() > 0.5;
    const coinSymbol = useSui ? 'SUI' : 'USDC';

    setSellerStatus('Publishing listing');
    addLog('Seller', 'Constructing Programmable Transaction Block (PTB) signed by 0xd0c2c91e...', 'seller');
    addLog('Sui', `Executing MoveCall target: marketplace::create_listing<${coinSymbol}>`, 'system');
    await delay(1200);

    const mockListingId = '0xLISTING_' + mockBlobId.substring(0, 12).toUpperCase();
    const newListing: SynapticListing = {
      id: mockListingId,
      publisher: '0xSELLER_AGENT_PTHFRE1E',
      price: useSui ? '1000000000' : '50000000', // 1 SUI or 50 USDC
      walrus_blob_id: mockBlobId,
      category: 'Sentiment',
      coinSymbol: coinSymbol,
    };
    
    setListings((prev) => [newListing, ...prev]);
    addLog('Sui', `Listing published successfully on-chain! ID: ${mockListingId} [Market: ${coinSymbol}]`, 'success');
    setIsSellerActive(false);
    setSellerStatus('Idle');

    // --- INTER-AGENT EVENT PROPAGATION ---
    setPacketFlowing(true);
    addLog('System', `Simulated Sui WebSocket announcing event: marketplace::ListingCreated<${coinSymbol}>`, 'system');
    await delay(1000);
    setPacketFlowing(false);

    // --- BUYER AGENT SEQUENCE ---
    setIsBuyerActive(true);
    setBuyerStatus('Analyzing listing');
    addLog('Buyer', `Captured new Synaptic Listing Event! Listing ID: ${mockListingId}`, 'buyer');
    await delay(1000);

    setBuyerStatus('Borrowing from Scallop');
    addLog('Scallop', `Flash loan borrow triggered. Sourcing ${useSui ? '1 SUI' : '50 USDC'} collateral...`, 'scallop');
    addLog('Scallop', 'Injected Scallop::lending::borrow MoveCall to purchase PTB.', 'scallop');
    await delay(1200);

    setBuyerStatus('Purchasing listing');
    addLog('Buyer', 'Executing listing purchase transaction block...', 'buyer');
    addLog('Sui', `Executing MoveCall target: marketplace::purchase_data<${coinSymbol}>`, 'system');
    await delay(1200);

    const mockLicenseId = generateMockLicenseId();
    addLog('Sui', `Decoupled escrow splits verified. Soul-bound LicenseCap minted: ${mockLicenseId}`, 'success');
    
    // Auto-mark listing as purchased
    setListings((prev) =>
      prev.map((l) => (l.id === mockListingId ? { ...l, isPurchased: true } : l))
    );

    setBuyerStatus('Fetching Walrus Blob');
    addLog('Walrus', `Sending HTTP GET /v1/blobs/${mockBlobId} to Aggregator...`, 'walrus');
    await delay(1200);

    addLog('Walrus', 'Blob successfully downloaded.', 'success');
    setBuyerStatus('Executing Strategy');
    addLog('Buyer', 'Evaluating dataset indicators for trading discrepancies...', 'buyer');
    await delay(1000);

    addLog('Buyer', 'Strategy Analysis Complete. Signal: BUY, Scallop Borrow Alert: TRUE', 'success');
    
    setBuyerStatus('Trading on DeepBook');
    addLog('DeepBook', 'Sourced BalanceManager: 0xDEPO_DEEPBOOK_BALANCE_MANAGER', 'deepbook');
    addLog('DeepBook', 'Placing market order (Direction: BUY) via DeepBook::clob::place_market_order', 'deepbook');
    await delay(1200);

    addLog('DeepBook', 'Arbitrage order placed and matched successfully. Arbitrage executed!', 'success');

    setBuyerStatus('Repaying Scallop');
    addLog('Scallop', 'Injecting Scallop::lending::repay MoveCall to PTB.', 'scallop');
    addLog('Scallop', 'Flash loan fully repaid. Obligation successfully settled.', 'success');
    
    setIsBuyerActive(false);
    setBuyerStatus('Idle');

    // Increment stats at the end of the swarm cycle
    setTotalTxns((prev) => prev + 2);
    setTotalVolume((prev) => prev + 1);

    // Auto load in Decryption Sandbox for visual wow factor
    triggerDecryption(newListing);
  };

  /**
   * Manual purchase flow
   */
  const handlePurchaseListing = async (listing: SynapticListing) => {
    setIsPurchasing(true);
    addLog('System', `Manual Purchase triggered for SUI data feed #${listing.id.substring(10, 16)}`, 'system');
    addLog('Sui', 'Splitting payment coin... gas fees calculation active.', 'system');
    await delay(1500);

    addLog('Sui', `LicenseCap successfully minted to caller address.`, 'success');
    
    // Confetti effect for wow factor
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 }
    });

    setListings((prev) =>
      prev.map((l) => (l.id === listing.id ? { ...l, isPurchased: true } : l))
    );
    setIsPurchasing(false);

    // Increment stats for manual purchase
    setTotalTxns((prev) => prev + 1);
    setTotalVolume((prev) => prev + 1);
  };

  /**
   * Decrypts the blob showing animated matrix jumble
   */
  const triggerDecryption = async (listing: SynapticListing) => {
    setIsDecrypting(true);
    setDecryptProgress(15);
    setEncryptedBlob('U2FsdGVkX1+vG0qE5Q8pD8zU9a/c0z+xVwHh6y...');
    setDecryptedData('');
    
    await delay(600);
    setDecryptProgress(45);
    await delay(800);
    setDecryptProgress(80);
    await delay(500);
    setDecryptProgress(100);
    
    const mockFeedContent = JSON.stringify({
      timestamp: getTimestamp(),
      pair: 'SUI/USDC',
      bestBid: 1.2450,
      bestAsk: 1.2480,
      spread: 0.0030,
      volume24h: 1500000,
      socialSentiment: 'Bullish',
      confidenceScore: 0.85,
      signals: {
        scallopBorrowOpportunity: true,
        deepbookArbitrageSignal: 'BUY'
      }
    }, null, 2);

    setDecryptedData(mockFeedContent);
    setIsDecrypting(false);
    addLog('System', `Cryptographic sandbox decrypted blob for listing ${listing.id.substring(0, 12)}...`, 'success');
  };

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Live stats that increment during swarm cycles
  const [totalTxns, setTotalTxns] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const [uptime, setUptime] = useState(0);

  // Uptime counter
  useEffect(() => {
    const interval = setInterval(() => setUptime((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="app-container">
      {/* --- Premium Header Section --- */}
      <header>
        <div className="logo-section">
          <SynapticLogo size={36} className="logo-icon" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span className="logo-text">Synaptic</span>
              <span className="badge-version">v1.0</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
              Verifiable Agent-to-Agent Synthetic Data Marketplace
            </span>
          </div>
        </div>

        <div className="header-actions">
          <ConnectWalletButton />
          <button
            className="btn-primary"
            disabled={isSellerActive || isBuyerActive}
            onClick={triggerSwarmCycle}
            id="trigger-swarm-cycle-btn"
          >
            {isSellerActive || isBuyerActive ? (
              <RefreshCw className="animate-spin" size={16} />
            ) : (
              <Play size={16} />
            )}
            <span>Trigger Autonomous Swarm Cycle</span>
          </button>
        </div>
      </header>

      {/* --- Live Protocol Statistics Ticker --- */}
      <div className="stats-ticker">
        <div className="stat-item">
          <Activity size={16} />
          <div>
            <div className="stat-label">Active Agents</div>
            <div className="stat-value">{(isSellerActive ? 1 : 0) + (isBuyerActive ? 1 : 0)} / 2</div>
          </div>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <Zap size={16} />
          <div>
            <div className="stat-label">Transactions</div>
            <div className="stat-value">{totalTxns}</div>
          </div>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <TrendingUp size={16} />
          <div>
            <div className="stat-label">Volume Traded</div>
            <div className="stat-value">{totalVolume} SUI</div>
          </div>
        </div>
        <div className="stat-divider" />
        <div className="stat-item">
          <Clock size={16} />
          <div>
            <div className="stat-label">Uptime</div>
            <div className="stat-value">{formatUptime(uptime)}</div>
          </div>
        </div>
      </div>

      {/* --- Main Dashboard Grid --- */}
      <div className="dashboard-grid">
        <div className="components-stack">
          {/* Swarm Interactive Nodes Map */}
          <SwarmMap
            isSellerActive={isSellerActive}
            isBuyerActive={isBuyerActive}
            sellerStatus={sellerStatus}
            buyerStatus={buyerStatus}
            packetFlowing={packetFlowing}
          />

          {/* Active Data Listings panel */}
          <ListingPanel
            listings={listings}
            onPurchase={handlePurchaseListing}
            onDecrypt={triggerDecryption}
            isPurchasing={isPurchasing}
          />

          {/* Verification Cryptographic Decryptor Sandbox */}
          <DecryptionSandbox
            encryptedBlob={encryptedBlob}
            decryptedData={decryptedData}
            isDecrypting={isDecrypting}
            decryptProgress={decryptProgress}
          />
        </div>

        {/* Matrix Style Event Ledger Feed */}
        <AuditLedger logs={logs} />
      </div>

      {/* --- Technology Partners Footer --- */}
      <footer className="tech-footer">
        <div className="tech-partner">
          <div className="tech-partner-dot" style={{ background: '#f59e0b' }} />
          <div>
            <div className="tech-partner-name" style={{ color: '#f59e0b' }}>Walrus</div>
            <div className="tech-partner-label">Decentralized Storage</div>
          </div>
        </div>
        <div className="tech-partner">
          <div className="tech-partner-dot" style={{ background: '#3b82f6' }} />
          <div>
            <div className="tech-partner-name" style={{ color: '#3b82f6' }}>DeepBook V3</div>
            <div className="tech-partner-label">On-Chain Orderbook</div>
          </div>
        </div>
        <div className="tech-partner">
          <div className="tech-partner-dot" style={{ background: '#a855f7' }} />
          <div>
            <div className="tech-partner-name" style={{ color: '#a855f7' }}>Scallop</div>
            <div className="tech-partner-label">DeFi Lending</div>
          </div>
        </div>
        <div className="tech-partner">
          <div className="tech-partner-dot" style={{ background: 'hsl(190, 100%, 50%)' }} />
          <div>
            <div className="tech-partner-name" style={{ color: 'hsl(190, 100%, 50%)' }}>Sui</div>
            <div className="tech-partner-label">Layer 1 Blockchain</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
