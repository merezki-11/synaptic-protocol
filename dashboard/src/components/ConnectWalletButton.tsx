import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { Wallet, Copy, Check } from 'lucide-react';
import { useState, useCallback } from 'react';

/**
 * Premium Connect Wallet button with zkLogin support.
 * Shows a custom-styled connect trigger when disconnected,
 * and displays the connected address when authenticated.
 */
export function ConnectWalletButton() {
  const currentAccount = useCurrentAccount();
  const [copied, setCopied] = useState(false);

  const copyAddress = useCallback(() => {
    if (currentAccount?.address) {
      navigator.clipboard.writeText(currentAccount.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [currentAccount]);

  if (currentAccount) {
    const addr = currentAccount.address;
    const shortAddr = `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

    return (
      <div className="wallet-connected" id="wallet-connected-badge">
        <div className="wallet-status-dot" />
        <Wallet size={14} />
        <span className="wallet-address">{shortAddr}</span>
        <button
          className="wallet-copy-btn"
          onClick={copyAddress}
          title="Copy address"
          id="copy-address-btn"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
    );
  }

  return (
    <div className="connect-wallet-wrapper" id="connect-wallet-section">
      <ConnectButton
        connectText="Connect with zkLogin"
      />
    </div>
  );
}
