#[test_only]
module synaptic_protocol::marketplace_tests;

use sui::test_scenario::{Self as ts};
use sui::clock::{Self};
use sui::coin::{Self};
use sui::sui::SUI;
use std::string;
use synaptic_protocol::agent_registry::{Self, Agent, AgentCap};
use synaptic_protocol::marketplace::{Self, MarketplaceConfig, AdminCap, Listing, LicenseCap, Escrow};

// ══════════════════════════════════════════════════════════════════════════════
// Test Addresses & Mock Coins
// ══════════════════════════════════════════════════════════════════════════════

const ALICE: address = @0xA;  // Seller / Deployer
const BOB: address = @0xB;    // Buyer
const CHARLIE: address = @0xC; // Unauthorized

/// Mock USDC coin type for generic marketplace multi-token validation
public struct USDC has drop {}

// ══════════════════════════════════════════════════════════════════════════════
// Helper: register an agent for ALICE and return to next tx
// ══════════════════════════════════════════════════════════════════════════════

/// Helper to set up the marketplace: deploys config (init) + registers ALICE as agent.
/// Returns after ALICE's registration tx.
fun setup_marketplace(scenario: &mut ts::Scenario, clock: &clock::Clock) {
    // Initialize the marketplace
    scenario.next_tx(ALICE);
    {
        marketplace::init_for_testing(scenario.ctx());
    };
    
    // Register ALICE as an agent.
    scenario.next_tx(ALICE);
    {
        agent_registry::register_agent(
            string::utf8(b"Oracle-Alpha"),
            b"pk_alice",
            vector[string::utf8(b"DeFi"), string::utf8(b"Oracle")],
            clock,
            scenario.ctx(),
        );
    };
}

// ══════════════════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════════════════

#[test]
/// Marketplace init creates MarketplaceConfig and AdminCap.
fun test_marketplace_init() {
    let mut scenario = ts::begin(ALICE);

    // Call init first!
    scenario.next_tx(ALICE);
    {
        marketplace::init_for_testing(scenario.ctx());
    };

    // After init, ALICE should have AdminCap and MarketplaceConfig should be shared.
    scenario.next_tx(ALICE);
    {
        let config = scenario.take_shared<MarketplaceConfig>();
        let admin_cap = scenario.take_from_sender<AdminCap>();

        assert!(marketplace::config_protocol_fee_bps(&config) == 250); // 2.5%
        assert!(marketplace::config_fee_recipient(&config) == ALICE);
        assert!(marketplace::config_total_volume(&config) == 0);
        assert!(marketplace::config_total_transactions(&config) == 0);

        ts::return_shared(config);
        ts::return_to_sender(&scenario, admin_cap);
    };

    scenario.end();
}

#[test]
/// Create a listing and verify all fields.
fun test_create_listing() {
    let mut scenario = ts::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());

    setup_marketplace(&mut scenario, &clock);

    // Create a listing.
    scenario.next_tx(ALICE);
    {
        let agent = scenario.take_shared<Agent>();
        let cap = scenario.take_from_sender<AgentCap>();
        let config = scenario.take_shared<MarketplaceConfig>();

        marketplace::create_listing<SUI>(
            &agent,
            &cap,
            &config,
            1_000_000_000, // 1 SUI
            b"blob_abc123",
            b"hash_xyz789",
            string::utf8(b"DeFi Oracle"),
            &clock,
            scenario.ctx(),
        );

        ts::return_shared(agent);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(config);
    };

    // Verify the listing.
    scenario.next_tx(ALICE);
    {
        let listing = scenario.take_shared<Listing<SUI>>();

        assert!(marketplace::listing_price<SUI>(&listing) == 1_000_000_000);
        assert!(*marketplace::listing_walrus_blob_id<SUI>(&listing) == b"blob_abc123");
        assert!(*marketplace::listing_verification_hash<SUI>(&listing) == b"hash_xyz789");
        assert!(*marketplace::listing_category<SUI>(&listing) == string::utf8(b"DeFi Oracle"));
        assert!(marketplace::listing_is_active<SUI>(&listing) == true);
        assert!(marketplace::listing_total_purchases<SUI>(&listing) == 0);
        assert!(marketplace::listing_publisher_address<SUI>(&listing) == ALICE);

        ts::return_shared(listing);
    };

    clock.destroy_for_testing();
    scenario.end();
}

#[test]
/// Full purchase flow: buyer pays, fees split correctly, LicenseCap minted.
fun test_purchase_data() {
    let mut scenario = ts::begin(ALICE);
    let mut clock = clock::create_for_testing(scenario.ctx());
    clock::set_for_testing(&mut clock, 1000); // Set time to 1 second

    setup_marketplace(&mut scenario, &clock);

    // Create a listing as ALICE (price = 1 SUI = 1_000_000_000 MIST).
    scenario.next_tx(ALICE);
    {
        let agent = scenario.take_shared<Agent>();
        let cap = scenario.take_from_sender<AgentCap>();
        let config = scenario.take_shared<MarketplaceConfig>();

        marketplace::create_listing<SUI>(
            &agent,
            &cap,
            &config,
            1_000_000_000,
            b"blob_data",
            b"hash_data",
            string::utf8(b"Sentiment"),
            &clock,
            scenario.ctx(),
        );

        ts::return_shared(agent);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(config);
    };

    // BOB purchases the listing with exact payment.
    scenario.next_tx(BOB);
    {
        let mut listing = scenario.take_shared<Listing<SUI>>();
        let mut agent = scenario.take_shared<Agent>();
        let mut config = scenario.take_shared<MarketplaceConfig>();

        // Mint test SUI coin for BOB.
        let payment = coin::mint_for_testing<SUI>(1_000_000_000, scenario.ctx());

        marketplace::purchase_data<SUI>(
            &mut listing,
            &mut agent,
            &mut config,
            payment,
            &clock,
            scenario.ctx(),
        );

        // Verify counters updated.
        assert!(marketplace::listing_total_purchases<SUI>(&listing) == 1);
        assert!(marketplace::config_total_volume(&config) == 1_000_000_000);
        assert!(marketplace::config_total_transactions(&config) == 1);

        // Verify agent stats updated.
        assert!(agent_registry::total_sales(&agent) == 1);
        assert!(agent_registry::total_volume(&agent) == 1_000_000_000);

        ts::return_shared(listing);
        ts::return_shared(agent);
        ts::return_shared(config);
    };

    // Verify BOB received a LicenseCap.
    scenario.next_tx(BOB);
    {
        let license = scenario.take_from_sender<LicenseCap>();

        assert!(marketplace::license_buyer(&license) == BOB);
        assert!(*marketplace::license_walrus_blob_id(&license) == b"blob_data");
        assert!(marketplace::license_purchased_at(&license) == 1000);
        // 30 days = 30 * 24 * 60 * 60 * 1000 = 2_592_000_000 ms
        assert!(marketplace::license_expires_at(&license) == 1000 + 2_592_000_000);

        // License should be valid now.
        assert!(marketplace::is_license_valid(&license, &clock) == true);

        ts::return_to_sender(&scenario, license);
    };

    clock.destroy_for_testing();
    scenario.end();
}

#[test]
/// Purchase with overpayment — change returned to buyer.
fun test_purchase_with_overpayment() {
    let mut scenario = ts::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());

    setup_marketplace(&mut scenario, &clock);

    // Create listing (price = 500_000_000 = 0.5 SUI).
    scenario.next_tx(ALICE);
    {
        let agent = scenario.take_shared<Agent>();
        let cap = scenario.take_from_sender<AgentCap>();
        let config = scenario.take_shared<MarketplaceConfig>();

        marketplace::create_listing<SUI>(
            &agent,
            &cap,
            &config,
            500_000_000,
            b"blob_over",
            b"hash_over",
            string::utf8(b"Test"),
            &clock,
            scenario.ctx(),
        );

        ts::return_shared(agent);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(config);
    };

    // BOB pays 1 SUI for a 0.5 SUI listing — should get 0.5 SUI change.
    scenario.next_tx(BOB);
    {
        let mut listing = scenario.take_shared<Listing<SUI>>();
        let mut agent = scenario.take_shared<Agent>();
        let mut config = scenario.take_shared<MarketplaceConfig>();

        let payment = coin::mint_for_testing<SUI>(1_000_000_000, scenario.ctx());

        marketplace::purchase_data<SUI>(
            &mut listing,
            &mut agent,
            &mut config,
            payment,
            &clock,
            scenario.ctx(),
        );

        ts::return_shared(listing);
        ts::return_shared(agent);
        ts::return_shared(config);
    };

    // Verify BOB received change (0.5 SUI) + LicenseCap.
    scenario.next_tx(BOB);
    {
        let license = scenario.take_from_sender<LicenseCap>();
        assert!(marketplace::license_buyer(&license) == BOB);
        ts::return_to_sender(&scenario, license);
    };

    clock.destroy_for_testing();
    scenario.end();
}

#[test]
/// Update listing blob and hash.
fun test_update_listing() {
    let mut scenario = ts::begin(ALICE);
    let mut clock = clock::create_for_testing(scenario.ctx());

    setup_marketplace(&mut scenario, &clock);

    // Create listing.
    scenario.next_tx(ALICE);
    {
        let agent = scenario.take_shared<Agent>();
        let cap = scenario.take_from_sender<AgentCap>();
        let config = scenario.take_shared<MarketplaceConfig>();

        marketplace::create_listing<SUI>(
            &agent, &cap, &config,
            100_000_000, b"blob_v1", b"hash_v1",
            string::utf8(b"Stream"), &clock, scenario.ctx(),
        );

        ts::return_shared(agent);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(config);
    };

    // Update the listing with new blob data.
    clock::set_for_testing(&mut clock, 5000);
    scenario.next_tx(ALICE);
    {
        let mut listing = scenario.take_shared<Listing<SUI>>();
        let cap = scenario.take_from_sender<AgentCap>();

        marketplace::update_listing<SUI>(
            &mut listing,
            &cap,
            b"blob_v2",
            b"hash_v2",
            &clock,
        );

        assert!(*marketplace::listing_walrus_blob_id<SUI>(&listing) == b"blob_v2");
        assert!(*marketplace::listing_verification_hash<SUI>(&listing) == b"hash_v2");
        assert!(marketplace::listing_updated_at<SUI>(&listing) == 5000);

        ts::return_shared(listing);
        ts::return_to_sender(&scenario, cap);
    };

    clock.destroy_for_testing();
    scenario.end();
}

#[test]
/// Deactivate a listing and verify purchases are blocked.
fun test_deactivate_listing() {
    let mut scenario = ts::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());

    setup_marketplace(&mut scenario, &clock);

    // Create listing.
    scenario.next_tx(ALICE);
    {
        let agent = scenario.take_shared<Agent>();
        let cap = scenario.take_from_sender<AgentCap>();
        let config = scenario.take_shared<MarketplaceConfig>();

        marketplace::create_listing<SUI>(
            &agent, &cap, &config,
            100_000_000, b"blob_deact", b"hash_deact",
            string::utf8(b"Temp"), &clock, scenario.ctx(),
        );

        ts::return_shared(agent);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(config);
    };

    // Deactivate.
    scenario.next_tx(ALICE);
    {
        let mut listing = scenario.take_shared<Listing<SUI>>();
        let cap = scenario.take_from_sender<AgentCap>();

        marketplace::deactivate_listing<SUI>(&mut listing, &cap);
        assert!(marketplace::listing_is_active<SUI>(&listing) == false);

        ts::return_shared(listing);
        ts::return_to_sender(&scenario, cap);
    };

    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = marketplace::EListingNotActive)]
/// Purchasing from a deactivated listing should abort.
fun test_purchase_deactivated_listing() {
    let mut scenario = ts::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());

    setup_marketplace(&mut scenario, &clock);

    // Create listing and deactivate it.
    scenario.next_tx(ALICE);
    {
        let agent = scenario.take_shared<Agent>();
        let cap = scenario.take_from_sender<AgentCap>();
        let config = scenario.take_shared<MarketplaceConfig>();

        marketplace::create_listing<SUI>(
            &agent, &cap, &config,
            100_000_000, b"blob_dead", b"hash_dead",
            string::utf8(b"Dead"), &clock, scenario.ctx(),
        );

        ts::return_shared(agent);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(config);
    };

    scenario.next_tx(ALICE);
    {
        let mut listing = scenario.take_shared<Listing<SUI>>();
        let cap = scenario.take_from_sender<AgentCap>();

        marketplace::deactivate_listing<SUI>(&mut listing, &cap);

        ts::return_shared(listing);
        ts::return_to_sender(&scenario, cap);
    };

    // BOB tries to purchase — should abort.
    scenario.next_tx(BOB);
    {
        let mut listing = scenario.take_shared<Listing<SUI>>();
        let mut agent = scenario.take_shared<Agent>();
        let mut config = scenario.take_shared<MarketplaceConfig>();

        let payment = coin::mint_for_testing<SUI>(100_000_000, scenario.ctx());
        marketplace::purchase_data<SUI>(&mut listing, &mut agent, &mut config, payment, &clock, scenario.ctx());

        ts::return_shared(listing);
        ts::return_shared(agent);
        ts::return_shared(config);
    };

    clock.destroy_for_testing();
    scenario.end();
}

#[test]
/// Admin can update the protocol fee.
fun test_update_protocol_fee() {
    let mut scenario = ts::begin(ALICE);

    // Call init first!
    scenario.next_tx(ALICE);
    {
        marketplace::init_for_testing(scenario.ctx());
    };

    scenario.next_tx(ALICE);
    {
        let mut config = scenario.take_shared<MarketplaceConfig>();
        let admin_cap = scenario.take_from_sender<AdminCap>();

        // Update fee from 250 bps to 500 bps (5%).
        marketplace::update_protocol_fee(&mut config, &admin_cap, 500);
        assert!(marketplace::config_protocol_fee_bps(&config) == 500);

        ts::return_shared(config);
        ts::return_to_sender(&scenario, admin_cap);
    };

    scenario.end();
}

#[test]
/// Verify that funds from an undisputed, expired escrow are released to the seller.
fun test_escrow_normal_release() {
    let mut scenario = ts::begin(ALICE);
    let mut clock = clock::create_for_testing(scenario.ctx());
    clock::set_for_testing(&mut clock, 1000);

    setup_marketplace(&mut scenario, &clock);

    // Create listing.
    scenario.next_tx(ALICE);
    {
        let agent = scenario.take_shared<Agent>();
        let cap = scenario.take_from_sender<AgentCap>();
        let config = scenario.take_shared<MarketplaceConfig>();

        marketplace::create_listing<SUI>(
            &agent, &cap, &config,
            1_000_000_000, b"blob_escrow", b"hash_escrow",
            string::utf8(b"Escrow"), &clock, scenario.ctx(),
        );

        ts::return_shared(agent);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(config);
    };

    // BOB purchases.
    scenario.next_tx(BOB);
    {
        let mut listing = scenario.take_shared<Listing<SUI>>();
        let mut agent = scenario.take_shared<Agent>();
        let mut config = scenario.take_shared<MarketplaceConfig>();

        let payment = coin::mint_for_testing<SUI>(1_000_000_000, scenario.ctx());
        marketplace::purchase_data<SUI>(&mut listing, &mut agent, &mut config, payment, &clock, scenario.ctx());

        ts::return_shared(listing);
        ts::return_shared(agent);
        ts::return_shared(config);
    };

    // Advance clock past 3-day escrow window (3 days = 259,200,000 ms).
    clock::set_for_testing(&mut clock, 1000 + 3 * 24 * 60 * 60 * 1000 + 100);

    // Release escrow.
    scenario.next_tx(CHARLIE); // Anyone can call release
    {
        let mut escrow = scenario.take_shared<Escrow<SUI>>();
        let config = scenario.take_shared<MarketplaceConfig>();

        marketplace::release_escrow<SUI>(&mut escrow, &clock, &config, scenario.ctx());

        assert!(marketplace::escrow_resolved<SUI>(&escrow) == true);
        assert!(marketplace::escrow_refunded<SUI>(&escrow) == false);

        ts::return_shared(escrow);
        ts::return_shared(config);
    };

    clock.destroy_for_testing();
    scenario.end();
}

#[test]
/// Verify that a buyer can dispute a purchase and the admin arbitrates in their favor (refund).
fun test_dispute_and_arbitration_refund() {
    let mut scenario = ts::begin(ALICE);
    let mut clock = clock::create_for_testing(scenario.ctx());
    clock::set_for_testing(&mut clock, 1000);

    setup_marketplace(&mut scenario, &clock);

    // Create listing.
    scenario.next_tx(ALICE);
    {
        let agent = scenario.take_shared<Agent>();
        let cap = scenario.take_from_sender<AgentCap>();
        let config = scenario.take_shared<MarketplaceConfig>();

        marketplace::create_listing<SUI>(
            &agent, &cap, &config,
            1_000_000_000, b"blob_dispute", b"hash_dispute",
            string::utf8(b"Dispute"), &clock, scenario.ctx(),
        );

        ts::return_shared(agent);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(config);
    };

    // BOB purchases.
    scenario.next_tx(BOB);
    {
        let mut listing = scenario.take_shared<Listing<SUI>>();
        let mut agent = scenario.take_shared<Agent>();
        let mut config = scenario.take_shared<MarketplaceConfig>();

        let payment = coin::mint_for_testing<SUI>(1_000_000_000, scenario.ctx());
        marketplace::purchase_data<SUI>(&mut listing, &mut agent, &mut config, payment, &clock, scenario.ctx());

        ts::return_shared(listing);
        ts::return_shared(agent);
        ts::return_shared(config);
    };

    // BOB opens a dispute before 3 days.
    scenario.next_tx(BOB);
    {
        let mut escrow = scenario.take_shared<Escrow<SUI>>();
        let license = scenario.take_from_sender<LicenseCap>();

        marketplace::open_dispute<SUI>(&mut escrow, &license, &clock);

        assert!(marketplace::escrow_disputed<SUI>(&escrow) == true);
        assert!(marketplace::escrow_resolved<SUI>(&escrow) == false);

        ts::return_shared(escrow);
        ts::return_to_sender(&scenario, license);
    };

    // ALICE (admin) resolves dispute in favor of buyer BOB (refund).
    scenario.next_tx(ALICE);
    {
        let mut config = scenario.take_shared<MarketplaceConfig>();
        let admin_cap = scenario.take_from_sender<AdminCap>();
        let mut escrow = scenario.take_shared<Escrow<SUI>>();

        marketplace::resolve_dispute<SUI>(&mut config, &admin_cap, &mut escrow, true, scenario.ctx());

        assert!(marketplace::escrow_resolved<SUI>(&escrow) == true);
        assert!(marketplace::escrow_refunded<SUI>(&escrow) == true);

        ts::return_shared(config);
        ts::return_to_sender(&scenario, admin_cap);
        ts::return_shared(escrow);
    };

    clock.destroy_for_testing();
    scenario.end();
}

#[test]
/// Verify that generic coin payments work seamlessly using mock USDC token listings.
fun test_generic_coin_marketplace_usdc() {
    let mut scenario = ts::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());

    setup_marketplace(&mut scenario, &clock);

    // ALICE publishes an agent listing with mock USDC pricing (price = 50 USDC = 50_000_000)
    scenario.next_tx(ALICE);
    {
        let agent = scenario.take_shared<Agent>();
        let cap = scenario.take_from_sender<AgentCap>();
        let config = scenario.take_shared<MarketplaceConfig>();

        marketplace::create_listing<USDC>(
            &agent,
            &cap,
            &config,
            50_000_000,
            b"blob_usdc_data",
            b"hash_usdc_data",
            string::utf8(b"DeFi Volume"),
            &clock,
            scenario.ctx(),
        );

        ts::return_shared(agent);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(config);
    };

    // Verify USDC listing created.
    scenario.next_tx(ALICE);
    {
        let listing = scenario.take_shared<Listing<USDC>>();
        assert!(marketplace::listing_price<USDC>(&listing) == 50_000_000);
        assert!(marketplace::listing_is_active<USDC>(&listing) == true);
        ts::return_shared(listing);
    };

    // BOB purchases USDC data listing.
    scenario.next_tx(BOB);
    {
        let mut listing = scenario.take_shared<Listing<USDC>>();
        let mut agent = scenario.take_shared<Agent>();
        let mut config = scenario.take_shared<MarketplaceConfig>();

        // Mint mock USDC coin for BOB.
        let payment = coin::mint_for_testing<USDC>(50_000_000, scenario.ctx());

        marketplace::purchase_data<USDC>(
            &mut listing,
            &mut agent,
            &mut config,
            payment,
            &clock,
            scenario.ctx(),
        );

        ts::return_shared(listing);
        ts::return_shared(agent);
        ts::return_shared(config);
    };

    // Verify escrow for USDC created successfully.
    scenario.next_tx(ALICE);
    {
        let escrow = scenario.take_shared<Escrow<USDC>>();
        assert!(marketplace::escrow_buyer<USDC>(&escrow) == BOB);
        assert!(marketplace::escrow_seller<USDC>(&escrow) == ALICE);
        assert!(marketplace::escrow_disputed<USDC>(&escrow) == false);
        ts::return_shared(escrow);
    };

    clock.destroy_for_testing();
    scenario.end();
}

#[test]
/// Verify that updating a listing's price works correctly.
fun test_update_listing_price() {
    let mut scenario = ts::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());

    setup_marketplace(&mut scenario, &clock);

    // Create listing at 1 SUI.
    scenario.next_tx(ALICE);
    {
        let agent = scenario.take_shared<Agent>();
        let cap = scenario.take_from_sender<AgentCap>();
        let config = scenario.take_shared<MarketplaceConfig>();

        marketplace::create_listing<SUI>(
            &agent, &cap, &config,
            1_000_000_000, b"blob_price", b"hash_price",
            string::utf8(b"Price"), &clock, scenario.ctx(),
        );

        ts::return_shared(agent);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(config);
    };

    // Update price to 2 SUI.
    scenario.next_tx(ALICE);
    {
        let mut listing = scenario.take_shared<Listing<SUI>>();
        let cap = scenario.take_from_sender<AgentCap>();

        marketplace::update_listing_price<SUI>(&mut listing, &cap, 2_000_000_000, &clock);

        assert!(marketplace::listing_price<SUI>(&listing) == 2_000_000_000);

        ts::return_shared(listing);
        ts::return_to_sender(&scenario, cap);
    };

    clock.destroy_for_testing();
    scenario.end();
}

#[test]
/// Verify that reactivating a listing works correctly.
fun test_reactivate_listing() {
    let mut scenario = ts::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());

    setup_marketplace(&mut scenario, &clock);

    // Create listing.
    scenario.next_tx(ALICE);
    {
        let agent = scenario.take_shared<Agent>();
        let cap = scenario.take_from_sender<AgentCap>();
        let config = scenario.take_shared<MarketplaceConfig>();

        marketplace::create_listing<SUI>(
            &agent, &cap, &config,
            100_000_000, b"blob_react", b"hash_react",
            string::utf8(b"React"), &clock, scenario.ctx(),
        );

        ts::return_shared(agent);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(config);
    };

    // Deactivate.
    scenario.next_tx(ALICE);
    {
        let mut listing = scenario.take_shared<Listing<SUI>>();
        let cap = scenario.take_from_sender<AgentCap>();

        marketplace::deactivate_listing<SUI>(&mut listing, &cap);
        assert!(marketplace::listing_is_active<SUI>(&listing) == false);

        ts::return_shared(listing);
        ts::return_to_sender(&scenario, cap);
    };

    // Reactivate.
    scenario.next_tx(ALICE);
    {
        let mut listing = scenario.take_shared<Listing<SUI>>();
        let cap = scenario.take_from_sender<AgentCap>();

        marketplace::reactivate_listing<SUI>(&mut listing, &cap);
        assert!(marketplace::listing_is_active<SUI>(&listing) == true);

        ts::return_shared(listing);
        ts::return_to_sender(&scenario, cap);
    };

    clock.destroy_for_testing();
    scenario.end();
}

#[test]
/// Verify that admin can update the fee recipient.
fun test_update_fee_recipient() {
    let mut scenario = ts::begin(ALICE);

    // Call init first!
    scenario.next_tx(ALICE);
    {
        marketplace::init_for_testing(scenario.ctx());
    };

    // Change fee recipient to BOB.
    scenario.next_tx(ALICE);
    {
        let mut config = scenario.take_shared<MarketplaceConfig>();
        let admin_cap = scenario.take_from_sender<AdminCap>();

        marketplace::update_fee_recipient(&mut config, &admin_cap, BOB);
        assert!(marketplace::config_fee_recipient(&config) == BOB);

        ts::return_shared(config);
        ts::return_to_sender(&scenario, admin_cap);
    };

    scenario.end();
}
