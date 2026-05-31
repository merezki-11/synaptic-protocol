import { useEffect, useState } from 'react';
import { Database, TrendingUp, Cpu, Server } from 'lucide-react';

interface SwarmMapProps {
  isSellerActive: boolean;
  isBuyerActive: boolean;
  sellerStatus: string;
  buyerStatus: string;
  packetFlowing: boolean;
}

export const SwarmMap: React.FC<SwarmMapProps> = ({
  isSellerActive,
  isBuyerActive,
  sellerStatus,
  buyerStatus,
  packetFlowing
}) => {
  const [packets, setPackets] = useState<{ id: number; left: number; top: number }[]>([]);

  useEffect(() => {
    if (packetFlowing) {
      // Flow packets from Seller (left: 20%) to Buyer (left: 80%)
      const id = Date.now();
      const newPacket = { id, left: 20, top: 40 };
      
      const timer = setTimeout(() => {
        setPackets((prev) => [...prev, newPacket]);
      }, 0);

      // Move packet across and remove it
      const interval = setInterval(() => {
        setPackets((prev) =>
          prev
            .map((p) => (p.id === id ? { ...p, left: p.left + 5 } : p))
            .filter((p) => p.left < 80)
        );
      }, 80);

      return () => {
        clearTimeout(timer);
        clearInterval(interval);
      };
    }
  }, [packetFlowing]);

  return (
    <div className="glass-panel" style={{ flex: 1 }}>
      <div className="section-title">
        <Server size={18} />
        <span>Autonomous Agent Network Swarm</span>
        {packetFlowing && <span className="badge-demo" style={{ background: 'hsla(190, 100%, 50%, 0.2)', border: '1px solid hsl(190, 100%, 50%)' }}>Data Syncing</span>}
      </div>

      <div className="swarm-container">
        <div className="swarm-grid-bg"></div>

        {/* --- Node 1: Seller Agent (Oracle-Alpha) --- */}
        <div className="agent-node" style={{ left: '15%', top: '35%' }}>
          <div className={`agent-avatar ${isSellerActive ? 'active' : ''}`}>
            {isSellerActive && <div className="agent-ping"></div>}
            <Cpu size={24} color="hsl(265, 90% 64%)" />
          </div>
          <span className="agent-node-name">Oracle-Alpha (Seller)</span>
          <span style={{ fontSize: '0.7rem', color: 'hsla(var(--text-muted), 0.7)' }}>{sellerStatus}</span>
        </div>

        {/* --- Dynamic Data Packets Flowing --- */}
        {packets.map((p) => (
          <div
            key={p.id}
            className="data-packet"
            style={{ left: `${p.left}%`, top: `${p.top}%` }}
          />
        ))}

        {/* Connection line */}
        <div
          className="swarm-connection-line"
          style={{
            left: '25%',
            top: '43%',
            width: '50%',
          }}
        />

        {/* --- Node 2: Walrus Protocol Gateway --- */}
        <div className="agent-node" style={{ left: '50%', top: '65%' }}>
          <div className="agent-avatar" style={{ borderColor: '#f59e0b', boxShadow: '0 0 15px rgba(245, 158, 11, 0.4)' }}>
            <Database size={24} color="#f59e0b" />
          </div>
          <span className="agent-node-name">Walrus Storage</span>
          <span style={{ fontSize: '0.7rem', color: 'hsla(var(--text-muted), 0.7)' }}>Aggregator & Publisher</span>
        </div>

        {/* --- Node 3: Buyer Agent (Arb-Bot) --- */}
        <div className="agent-node" style={{ left: '75%', top: '35%' }}>
          <div className={`agent-avatar buyer ${isBuyerActive ? 'active' : ''}`}>
            {isBuyerActive && <div className="agent-ping"></div>}
            <TrendingUp size={24} color="hsl(190, 100%, 50%)" />
          </div>
          <span className="agent-node-name">Arb-Bot (Buyer)</span>
          <span style={{ fontSize: '0.7rem', color: 'hsla(var(--text-muted), 0.7)' }}>{buyerStatus}</span>
        </div>
      </div>
    </div>
  );
};
