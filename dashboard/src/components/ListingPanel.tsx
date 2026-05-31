import { ShoppingBag, Eye, Award, CheckCircle } from 'lucide-react';

export interface SynapticListing {
  id: string;
  publisher: string;
  price: string;
  walrus_blob_id: string;
  category: string;
  isPurchased?: boolean;
  coinSymbol?: string;
}

interface ListingPanelProps {
  listings: SynapticListing[];
  onPurchase: (listing: SynapticListing) => void;
  onDecrypt: (listing: SynapticListing) => void;
  isPurchasing: boolean;
}

export const ListingPanel: React.FC<ListingPanelProps> = ({
  listings,
  onPurchase,
  onDecrypt,
  isPurchasing
}) => {
  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="section-title">
        <ShoppingBag size={18} />
        <span>Active Synthetic Data Listings</span>
      </div>

      <div className="listings-grid">
        {listings.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'hsla(var(--text-muted), 0.5)' }}>
            No active listings published on the marketplace yet. Trigger a Swarm Cycle to list data.
          </div>
        ) : (
          listings.map((l) => (
            <div key={l.id} className="listing-card animate-fade-in">
              <div className="listing-meta-icon">
                <Award size={22} />
              </div>

              <div className="listing-info">
                <div className="listing-title">Synthetic Feed #{l.id.substring(10, 16)}</div>
                <div className="listing-details">
                  <span>Publisher: {l.publisher.substring(0, 12)}...</span>
                  <span>Category: {l.category}</span>
                  <span>Blob: {l.walrus_blob_id.substring(0, 16)}...</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className="listing-price-tag">
                  {parseFloat(l.price) / (l.coinSymbol === 'USDC' ? 1_000_000 : 1_000_000_000)} {l.coinSymbol || 'SUI'}
                </div>

                {l.isPurchased ? (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span className="license-expires-tag">
                      <CheckCircle size={12} style={{ display: 'inline', marginRight: '0.2rem', verticalAlign: 'middle' }} />
                      License Active
                    </span>
                    <button
                      className="btn-primary"
                      onClick={() => onDecrypt(l)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.8rem',
                        background: 'linear-gradient(135deg, hsl(190, 100%, 50%) 0%, hsla(190, 100%, 50%, 0.8) 100%)',
                        boxShadow: '0 4px 15px hsla(190, 100%, 50%, 0.3)'
                      }}
                    >
                      <Eye size={14} />
                      Decrypt
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn-primary"
                    disabled={isPurchasing}
                    onClick={() => onPurchase(l)}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                  >
                    <ShoppingBag size={14} />
                    Purchase
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
