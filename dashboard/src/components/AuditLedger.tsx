import { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';

export interface LogEntry {
  time: string;
  text: string;
  source: 'system' | 'seller' | 'buyer' | 'success' | 'walrus' | 'deepbook' | 'scallop';
}

interface AuditLedgerProps {
  logs: LogEntry[];
}

export const AuditLedger: React.FC<AuditLedgerProps> = ({ logs }) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom whenever logs update
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="section-title" style={{ marginBottom: '1rem' }}>
        <Terminal size={18} />
        <span>Sui Ledger & Event Feed Audit</span>
      </div>

      <div className="terminal-container">
        <div className="terminal-header">
          <div className="terminal-dots">
            <span className="terminal-dot red"></span>
            <span className="terminal-dot yellow"></span>
            <span className="terminal-dot green"></span>
          </div>
          <span>synaptic_audit_ledger.log — bash</span>
          <span style={{ color: 'hsl(var(--success))', textShadow: '0 0 4px hsla(var(--success), 0.5)' }}>● LIVE</span>
        </div>

        <div className="terminal-body">
          {logs.map((log, index) => (
            <div key={index} className="log-line">
              <span className="log-time">[{log.time}]</span>
              <span className={`log-text ${log.source}`}>{log.text}</span>
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
};
