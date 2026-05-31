/// Module: synaptic_protocol::marketplace
///
/// Decentralised data marketplace for AI agents.
/// Agents publish `Listing` objects that reference off-chain data stored on Walrus.
/// Buyers pay in SUI and receive a non-transferable `LicenseCap` proving purchase,
/// which expires after 30 days.
///
/// Revenue is split between the publisher and the protocol treasury based on a
/// configurable fee (default 2.5 %, max 10 %).
module synaptic_protocol::marketplace;

use std::string::String;
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::clock::{Self, Clock};
use sui::event;
use sui::balance::{Self, Balance};
use synaptic_protocol::agent_registry::{Self, Agent, AgentCap};

// ══════════════════════════════════════════════════════════════════════════════
// Error Constants
// ══════════════════════════════════════════════════════════════════════════════

/// Caller's `AgentCap` does not match the listing's publisher.
const ENotAgentOwner: u64 = 0;
/// Listing has been deactivated and cannot be purchased.
const EListingNotActive: u64 = 1;
/// Payment coin value is below the listing price.
const EInsufficientPayment: u64 = 2;
/// Proposed protocol fee exceeds the 10 % ceiling (1000 bps).
const EFeeTooHigh: u64 = 3;
/// Escrow has already expired.
const EEscrowExpired: u64 = 4;
/// Escrow has not expired yet.
const EEscrowNotExpired: u64 = 5;
/// Dispute has already been resolved or paid.
const EDisputeAlreadyResolved: u64 = 6;
/// Dispute has not been resolved yet.
const EDisputeNotResolved: u64 = 7;
/// Publisher is attempting to purchase their own data listing.
const ESelfPurchaseBlocked: u64 = 8;
/// Price must be greater than zero.
const EInvalidPrice: u64 = 9;
/// Dispute has already been opened for this escrow.
const EDisputeAlreadyOpened: u64 = 10;

// ══════════════════════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════════════════════

/// Default protocol fee: 250 basis points = 2.5 %.
const DEFAULT_FEE_BPS: u64 = 250;
/// Maximum allowed fee: 1000 basis points = 10 %.
const MAX_FEE_BPS: u64 = 1000;
/// License validity period: 30 days in milliseconds.
const LICENSE_DURATION_MS: u64 = 30 * 24 * 60 * 60 * 1000;
/// Escrow release window: 3 days in milliseconds.
const ESCROW_DURATION_MS: u64 = 3 * 24 * 60 * 60 * 1000;

// ══════════════════════════════════════════════════════════════════════════════
// Structs
// ══════════════════════════════════════════════════════════════════════════════

/// Global marketplace configuration.
/// Singleton owned by the deployer; stores fee parameters and aggregate stats.
public struct MarketplaceConfig has key {
    id: UID,
    /// Fee charged on every purchase, in basis points (1 bp = 0.01 %).
    protocol_fee_bps: u64,
    /// Address that receives protocol fees.
    fee_recipient: address,
    /// Cumulative volume (in MIST/equivalent) across all purchases.
    total_volume: u64,
    /// Total number of purchase transactions.
    total_transactions: u64,
}

/// Admin capability for privileged marketplace operations (e.g., fee updates).
public struct AdminCap has key, store {
    id: UID,
}

/// A data listing published by an AI agent, generic over any payment token (COIN).
/// Shared object so buyers can reference it in purchase transactions.
public struct Listing<phantom COIN> has key {
    id: UID,
    /// The `ID` of the `Agent` that published this listing.
    publisher: ID,
    /// The address of the publisher (for payment escrow).
    publisher_address: address,
    /// Price in the dynamic COIN that buyers must pay.
    price: u64,
    /// Walrus blob identifier pointing to the off-chain data.
    walrus_blob_id: vector<u8>,
    /// Hash of the data for integrity verification.
    verification_hash: vector<u8>,
    /// Data category tag.
    category: String,
    /// Whether this listing accepts new purchases.
    is_active: bool,
    /// Number of times this listing has been purchased.
    total_purchases: u64,
    /// Epoch-millisecond timestamp of creation.
    created_at: u64,
    /// Epoch-millisecond timestamp of the last update.
    updated_at: u64,
}

/// Proof-of-purchase capability.
/// `key` only (no `store`) — intentionally non-transferable so licenses
/// are soul-bound to the buyer.
public struct LicenseCap has key {
    id: UID,
    /// The listing this license was purchased from.
    listing_id: ID,
    /// The address that purchased the license.
    buyer: address,
    /// Walrus blob identifier at time of purchase.
    walrus_blob_id: vector<u8>,
    /// Epoch-millisecond timestamp of purchase.
    purchased_at: u64,
    /// Epoch-millisecond timestamp when the license expires.
    expires_at: u64,
}

/// A secure escrow object for marketplace purchases, generic over any payment token (COIN).
/// Created on purchase; releases funds to the seller after 3 days.
/// If a dispute is raised, funds are locked until the admin arbitrates.
public struct Escrow<phantom COIN> has key {
    id: UID,
    /// The ID of the LicenseCap generated by this purchase.
    license_id: ID,
    /// The listing that was purchased.
    listing_id: ID,
    /// Address of the buyer.
    buyer: address,
    /// Address of the seller (publisher).
    seller: address,
    /// The balance held for the seller.
    seller_funds: Balance<COIN>,
    /// The balance held for the protocol fee.
    protocol_fee_funds: Balance<COIN>,
    /// Whether a dispute has been opened.
    disputed: bool,
    /// Whether the dispute/escrow is resolved.
    resolved: bool,
    /// Whether the buyer was refunded.
    refunded: bool,
    /// Expiration timestamp in epoch milliseconds.
    expires_at: u64,
}

// ══════════════════════════════════════════════════════════════════════════════
// Events
// ══════════════════════════════════════════════════════════════════════════════

/// Emitted when a new listing is created.
public struct ListingCreated has copy, drop {
    listing_id: ID,
    publisher: ID,
    price: u64,
    category: String,
}

/// Emitted when a listing's data pointer is updated.
public struct ListingUpdated has copy, drop {
    listing_id: ID,
    new_blob_id: vector<u8>,
}

/// Emitted when a buyer completes a purchase.
public struct DataPurchased has copy, drop {
    listing_id: ID,
    buyer: address,
    price: u64,
    license_id: ID,
}

/// Emitted when a listing is deactivated.
public struct ListingDeactivated has copy, drop {
    listing_id: ID,
}

/// Emitted when a dispute is opened.
public struct DisputeOpened has copy, drop {
    escrow_id: ID,
    listing_id: ID,
    buyer: address,
}

/// Emitted when a dispute is resolved by an admin.
public struct DisputeResolved has copy, drop {
    escrow_id: ID,
    resolved_in_favor_of_buyer: bool,
}

/// Emitted when escrow funds are released to the seller.
public struct EscrowReleased has copy, drop {
    escrow_id: ID,
    seller: address,
}

// ══════════════════════════════════════════════════════════════════════════════
// Module Initializer
// ══════════════════════════════════════════════════════════════════════════════

/// Called once at module publish.
/// Creates the singleton `MarketplaceConfig` and the `AdminCap`, both
/// transferred to the deployer.
fun init(ctx: &mut TxContext) {
    let sender = ctx.sender();

    let config = MarketplaceConfig {
        id: object::new(ctx),
        protocol_fee_bps: DEFAULT_FEE_BPS,
        fee_recipient: sender,
        total_volume: 0,
        total_transactions: 0,
    };

    let admin_cap = AdminCap {
        id: object::new(ctx),
    };

    transfer::share_object(config);
    transfer::public_transfer(admin_cap, sender);
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}

// ══════════════════════════════════════════════════════════════════════════════
// Public Entry Functions
// ══════════════════════════════════════════════════════════════════════════════

/// Publish a new data listing.
///
/// The caller must hold the `AgentCap` matching the supplied `Agent`.
/// Generic over `<COIN>` to specify listing payment token.
public fun create_listing<COIN>(
    agent: &Agent,
    cap: &AgentCap,
    _config: &MarketplaceConfig,
    price: u64,
    walrus_blob_id: vector<u8>,
    verification_hash: vector<u8>,
    category: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Verify the caller owns this agent.
    assert!(agent_registry::agent_id(cap) == object::id(agent), ENotAgentOwner);
    // Enforce minimum price.
    assert!(price > 0, EInvalidPrice);

    let now = clock::timestamp_ms(clock);

    let listing = Listing<COIN> {
        id: object::new(ctx),
        publisher: object::id(agent),
        publisher_address: ctx.sender(),
        price,
        walrus_blob_id,
        verification_hash,
        category,
        is_active: true,
        total_purchases: 0,
        created_at: now,
        updated_at: now,
    };

    let listing_id = object::id(&listing);

    event::emit(ListingCreated {
        listing_id,
        publisher: object::id(agent),
        price,
        category: listing.category,
    });

    transfer::share_object(listing);
}

/// Update the data pointer of an existing listing (e.g., for oracle streams).
///
/// Only the publisher (via their `AgentCap`) may call this.
public fun update_listing<COIN>(
    listing: &mut Listing<COIN>,
    cap: &AgentCap,
    new_walrus_blob_id: vector<u8>,
    new_verification_hash: vector<u8>,
    clock: &Clock,
) {
    // Verify the caller's cap matches the listing publisher.
    assert!(agent_registry::agent_id(cap) == listing.publisher, ENotAgentOwner);

    listing.walrus_blob_id = new_walrus_blob_id;
    listing.verification_hash = new_verification_hash;
    listing.updated_at = clock::timestamp_ms(clock);

    event::emit(ListingUpdated {
        listing_id: object::id(listing),
        new_blob_id: listing.walrus_blob_id,
    });
}

/// Update the price of an existing listing.
///
/// Only the publisher (via their `AgentCap`) may call this.
public fun update_listing_price<COIN>(
    listing: &mut Listing<COIN>,
    cap: &AgentCap,
    new_price: u64,
    clock: &Clock,
) {
    // Verify the caller's cap matches the listing publisher.
    assert!(agent_registry::agent_id(cap) == listing.publisher, ENotAgentOwner);
    // Enforce minimum price.
    assert!(new_price > 0, EInvalidPrice);

    listing.price = new_price;
    listing.updated_at = clock::timestamp_ms(clock);
}

/// Reactivate a deactivated listing.
///
/// Only the publisher (via their `AgentCap`) may call this.
public fun reactivate_listing<COIN>(
    listing: &mut Listing<COIN>,
    cap: &AgentCap,
) {
    // Verify the caller's cap matches the listing publisher.
    assert!(agent_registry::agent_id(cap) == listing.publisher, ENotAgentOwner);

    listing.is_active = true;
}

/// Purchase data from a listing.
///
/// Splits the payment into a protocol fee and a seller payment.
/// Both amounts are wrapped into a shared `Escrow` object.
/// Any overpayment is returned immediately to the buyer.
/// A non-transferable `LicenseCap` is minted to the buyer, valid for 30 days.
#[allow(lint(self_transfer))]
public fun purchase_data<COIN>(
    listing: &mut Listing<COIN>,
    agent: &mut Agent,
    config: &mut MarketplaceConfig,
    mut payment: Coin<COIN>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // --- Validation ---
    assert!(listing.is_active, EListingNotActive);
    assert!(object::id(agent) == listing.publisher, ENotAgentOwner);
    
    let buyer = ctx.sender();
    // Prevent self-purchases.
    assert!(buyer != listing.publisher_address, ESelfPurchaseBlocked);

    let payment_value = coin::value(&payment);
    assert!(payment_value >= listing.price, EInsufficientPayment);

    let now = clock::timestamp_ms(clock);

    // --- Fee calculation (overflow-safe via u128) ---
    let protocol_fee = (((listing.price as u128) * (config.protocol_fee_bps as u128)) / 10000 as u64);
    let seller_amount = listing.price - protocol_fee;

    // --- Split funds & store in Escrow ---
    // 1. Extract the protocol fee balance.
    let fee_coin = coin::split(&mut payment, protocol_fee, ctx);
    let fee_balance = coin::into_balance(fee_coin);

    // 2. Extract the seller's share balance.
    let seller_coin = coin::split(&mut payment, seller_amount, ctx);
    let seller_balance = coin::into_balance(seller_coin);

    // 3. Return any overpayment (change) to the buyer.
    if (coin::value(&payment) > 0) {
        transfer::public_transfer(payment, buyer);
    } else {
        coin::destroy_zero(payment);
    };

    // --- Mint license ---
    let expires_at = now + LICENSE_DURATION_MS;
    let license = LicenseCap {
        id: object::new(ctx),
        listing_id: object::id(listing),
        buyer,
        walrus_blob_id: listing.walrus_blob_id,
        purchased_at: now,
        expires_at,
    };

    let license_id = object::id(&license);

    // `transfer::transfer` because LicenseCap has `key` only (soul-bound).
    transfer::transfer(license, buyer);

    // --- Create and share Escrow object ---
    let escrow = Escrow<COIN> {
        id: object::new(ctx),
        license_id,
        listing_id: object::id(listing),
        buyer,
        seller: listing.publisher_address,
        seller_funds: seller_balance,
        protocol_fee_funds: fee_balance,
        disputed: false,
        resolved: false,
        refunded: false,
        expires_at: now + ESCROW_DURATION_MS,
    };

    transfer::share_object(escrow);

    // --- Update counters ---
    listing.total_purchases = listing.total_purchases + 1;
    config.total_volume = config.total_volume + listing.price;
    config.total_transactions = config.total_transactions + 1;

    // --- Update agent stats ---
    agent_registry::record_marketplace_sale(agent, listing.price);

    // --- Emit event ---
    event::emit(DataPurchased {
        listing_id: object::id(listing),
        buyer,
        price: listing.price,
        license_id,
    });
}

/// Deactivate a listing so it no longer accepts purchases.
///
/// Only the publisher (via their `AgentCap`) may call this.
public fun deactivate_listing<COIN>(
    listing: &mut Listing<COIN>,
    cap: &AgentCap,
) {
    assert!(agent_registry::agent_id(cap) == listing.publisher, ENotAgentOwner);

    listing.is_active = false;

    event::emit(ListingDeactivated {
        listing_id: object::id(listing),
    });
}

/// Update the protocol fee. Admin-only.
///
/// `new_fee_bps` must be ≤ 1000 (10 %).
public fun update_protocol_fee(
    config: &mut MarketplaceConfig,
    _admin: &AdminCap,
    new_fee_bps: u64,
) {
    assert!(new_fee_bps <= MAX_FEE_BPS, EFeeTooHigh);
    config.protocol_fee_bps = new_fee_bps;
}

/// Update the fee recipient address. Admin-only.
public fun update_fee_recipient(
    config: &mut MarketplaceConfig,
    _admin: &AdminCap,
    new_recipient: address,
) {
    config.fee_recipient = new_recipient;
}

// ══════════════════════════════════════════════════════════════════════════════
// Escrow & Dispute Resolution Functions
// ══════════════════════════════════════════════════════════════════════════════

/// Open a dispute against a specific purchase escrow.
///
/// Must be called by the buyer holding the valid matching `LicenseCap` before the escrow expires.
public fun open_dispute<COIN>(
    escrow: &mut Escrow<COIN>,
    license: &LicenseCap,
    clock: &Clock,
) {
    assert!(!escrow.resolved, EDisputeAlreadyResolved);
    assert!(!escrow.disputed, EDisputeAlreadyOpened);
    assert!(license.listing_id == escrow.listing_id, ENotAgentOwner);
    assert!(license.buyer == escrow.buyer, ENotAgentOwner);
    assert!(clock::timestamp_ms(clock) < escrow.expires_at, EEscrowExpired);

    escrow.disputed = true;

    event::emit(DisputeOpened {
        escrow_id: object::id(escrow),
        listing_id: escrow.listing_id,
        buyer: escrow.buyer,
    });
}

/// Resolve a dispute. Admin-only.
///
/// Can either refund the buyer completely or pay the seller and protocol fee recipient.
#[allow(lint(self_transfer))]
public fun resolve_dispute<COIN>(
    config: &mut MarketplaceConfig,
    _admin: &AdminCap,
    escrow: &mut Escrow<COIN>,
    resolve_in_favor_of_buyer: bool,
    ctx: &mut TxContext,
) {
    assert!(!escrow.resolved, EDisputeAlreadyResolved);
    assert!(escrow.disputed, EDisputeNotResolved);

    escrow.resolved = true;

    if (resolve_in_favor_of_buyer) {
        escrow.refunded = true;
        let seller_coin = coin::from_balance(balance::withdraw_all(&mut escrow.seller_funds), ctx);
        let fee_coin = coin::from_balance(balance::withdraw_all(&mut escrow.protocol_fee_funds), ctx);
        transfer::public_transfer(seller_coin, escrow.buyer);
        transfer::public_transfer(fee_coin, escrow.buyer);
    } else {
        let seller_coin = coin::from_balance(balance::withdraw_all(&mut escrow.seller_funds), ctx);
        let fee_coin = coin::from_balance(balance::withdraw_all(&mut escrow.protocol_fee_funds), ctx);
        transfer::public_transfer(seller_coin, escrow.seller);
        transfer::public_transfer(fee_coin, config.fee_recipient);
    };

    event::emit(DisputeResolved {
        escrow_id: object::id(escrow),
        resolved_in_favor_of_buyer: resolve_in_favor_of_buyer,
    });
}

/// Release funds from an expired, undisputed escrow.
///
/// Can be triggered by anyone after the 3-day release window.
#[allow(lint(self_transfer))]
public fun release_escrow<COIN>(
    escrow: &mut Escrow<COIN>,
    clock: &Clock,
    config: &MarketplaceConfig,
    ctx: &mut TxContext,
) {
    assert!(!escrow.resolved, EDisputeAlreadyResolved);
    assert!(!escrow.disputed, EDisputeAlreadyOpened);
    assert!(clock::timestamp_ms(clock) >= escrow.expires_at, EEscrowNotExpired);

    escrow.resolved = true;

    let seller_coin = coin::from_balance(balance::withdraw_all(&mut escrow.seller_funds), ctx);
    let fee_coin = coin::from_balance(balance::withdraw_all(&mut escrow.protocol_fee_funds), ctx);

    transfer::public_transfer(seller_coin, escrow.seller);
    transfer::public_transfer(fee_coin, config.fee_recipient);

    event::emit(EscrowReleased {
        escrow_id: object::id(escrow),
        seller: escrow.seller,
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// Getter Functions — Listing
// ══════════════════════════════════════════════════════════════════════════════

/// Returns the `ID` of the agent that published this listing.
public fun listing_publisher<COIN>(listing: &Listing<COIN>): ID {
    listing.publisher
}

/// Returns the publisher's payment address.
public fun listing_publisher_address<COIN>(listing: &Listing<COIN>): address {
    listing.publisher_address
}

/// Returns the listing price in dynamic coin.
public fun listing_price<COIN>(listing: &Listing<COIN>): u64 {
    listing.price
}

/// Returns the Walrus blob identifier.
public fun listing_walrus_blob_id<COIN>(listing: &Listing<COIN>): &vector<u8> {
    &listing.walrus_blob_id
}

/// Returns the data verification hash.
public fun listing_verification_hash<COIN>(listing: &Listing<COIN>): &vector<u8> {
    &listing.verification_hash
}

/// Returns the listing's category tag.
public fun listing_category<COIN>(listing: &Listing<COIN>): &String {
    &listing.category
}

/// Returns whether the listing is currently active.
public fun listing_is_active<COIN>(listing: &Listing<COIN>): bool {
    listing.is_active
}

/// Returns the number of purchases for this listing.
public fun listing_total_purchases<COIN>(listing: &Listing<COIN>): u64 {
    listing.total_purchases
}

/// Returns the creation timestamp.
public fun listing_created_at<COIN>(listing: &Listing<COIN>): u64 {
    listing.created_at
}

/// Returns the last-updated timestamp.
public fun listing_updated_at<COIN>(listing: &Listing<COIN>): u64 {
    listing.updated_at
}

// ══════════════════════════════════════════════════════════════════════════════
// Getter Functions — LicenseCap
// ══════════════════════════════════════════════════════════════════════════════

/// Returns the listing ID this license was purchased from.
public fun license_listing_id(license: &LicenseCap): ID {
    license.listing_id
}

/// Returns the buyer address.
public fun license_buyer(license: &LicenseCap): address {
    license.buyer
}

/// Returns the Walrus blob ID captured at purchase time.
public fun license_walrus_blob_id(license: &LicenseCap): &vector<u8> {
    &license.walrus_blob_id
}

/// Returns the purchase timestamp.
public fun license_purchased_at(license: &LicenseCap): u64 {
    license.purchased_at
}

/// Returns the expiration timestamp.
public fun license_expires_at(license: &LicenseCap): u64 {
    license.expires_at
}

/// Check whether a license is still valid (not expired).
public fun is_license_valid(license: &LicenseCap, clock: &Clock): bool {
    clock::timestamp_ms(clock) <= license.expires_at
}

// ══════════════════════════════════════════════════════════════════════════════
// Getter Functions — MarketplaceConfig
// ══════════════════════════════════════════════════════════════════════════════

/// Returns the current protocol fee in basis points.
public fun config_protocol_fee_bps(config: &MarketplaceConfig): u64 {
    config.protocol_fee_bps
}

/// Returns the fee recipient address.
public fun config_fee_recipient(config: &MarketplaceConfig): address {
    config.fee_recipient
}

/// Returns the total volume traded through the marketplace.
public fun config_total_volume(config: &MarketplaceConfig): u64 {
    config.total_volume
}

/// Returns the total number of purchase transactions.
public fun config_total_transactions(config: &MarketplaceConfig): u64 {
    config.total_transactions
}

// ══════════════════════════════════════════════════════════════════════════════
// Getter Functions — Escrow
// ══════════════════════════════════════════════════════════════════════════════

public fun escrow_license_id<COIN>(escrow: &Escrow<COIN>): ID {
    escrow.license_id
}

public fun escrow_listing_id<COIN>(escrow: &Escrow<COIN>): ID {
    escrow.listing_id
}

public fun escrow_buyer<COIN>(escrow: &Escrow<COIN>): address {
    escrow.buyer
}

public fun escrow_seller<COIN>(escrow: &Escrow<COIN>): address {
    escrow.seller
}

public fun escrow_disputed<COIN>(escrow: &Escrow<COIN>): bool {
    escrow.disputed
}

public fun escrow_resolved<COIN>(escrow: &Escrow<COIN>): bool {
    escrow.resolved
}

public fun escrow_refunded<COIN>(escrow: &Escrow<COIN>): bool {
    escrow.refunded
}

public fun escrow_expires_at<COIN>(escrow: &Escrow<COIN>): u64 {
    escrow.expires_at
}
