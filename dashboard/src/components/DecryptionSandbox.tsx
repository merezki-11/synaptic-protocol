import { useEffect, useState } from 'react';
import { Lock, Unlock, Eye, Sparkles } from 'lucide-react';

interface DecryptionSandboxProps {
  encryptedBlob: string;
  decryptedData: string;
  isDecrypting: boolean;
  decryptProgress: number;
}

export const DecryptionSandbox: React.FC<DecryptionSandboxProps> = ({
  encryptedBlob,
  decryptedData,
  isDecrypting,
  decryptProgress
}) => {
  const [jumbledText, setJumbledText] = useState('');

  // Jumble effect while decrypting
  useEffect(() => {
    if (!isDecrypting) return;

    const chars = 'ABCDEF1234567890!@#$%^&*()_+{}|:<>?';
    const interval = setInterval(() => {
      let text = '';
      for (let i = 0; i < 200; i++) {
        text += chars[Math.floor(Math.random() * chars.length)];
      }
      setJumbledText(text);
    }, 50);

    return () => {
      clearInterval(interval);
      setJumbledText('');
    };
  }, [isDecrypting]);

  return (
    <div className="glass-panel">
      <div className="sandbox-header">
        <div className="section-title" style={{ margin: 0 }}>
          <Sparkles size={18} />
          <span>Decryption & Verification Sandbox</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {isDecrypting ? (
            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Lock size={14} className="animate-spin" /> Verifying...
            </span>
          ) : decryptedData ? (
            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--success))', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Unlock size={14} /> Unlocked
            </span>
          ) : (
            <span style={{ fontSize: '0.8rem', color: 'hsla(var(--text-muted), 0.7)' }}>Idle</span>
          )}
        </div>
      </div>

      <div className="sandbox-loader-bar">
        <div
          className="sandbox-loader-progress"
          style={{ width: `${decryptProgress}%` }}
        />
      </div>

      <div className="sandbox-grid">
        {/* --- Raw Encrypted Blob Pane --- */}
        <div>
          <div className="sandbox-pane-title">
            <Lock size={12} />
            <span>Encrypted Blob (Walrus Storage)</span>
          </div>
          <div className="sandbox-pane crypt-jumbled">
            {isDecrypting ? jumbledText : encryptedBlob || '// Waiting for active listing download...'}
          </div>
        </div>

        {/* --- Decrypted Verified Pane --- */}
        <div>
          <div className="sandbox-pane-title">
            <Eye size={12} style={{ color: decryptedData ? 'hsl(var(--success))' : 'inherit' }} />
            <span>Decrypted Data Feed (Verified)</span>
          </div>
          <div className="sandbox-pane" style={{ color: decryptedData ? 'hsl(var(--text-main))' : 'hsla(var(--text-muted), 0.5)' }}>
            {decryptedData ? (
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{decryptedData}</pre>
            ) : (
              '// Click a listing to purchase or decrypt...'
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
