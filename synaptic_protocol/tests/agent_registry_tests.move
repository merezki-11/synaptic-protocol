#[test_only]
module synaptic_protocol::agent_registry_tests;

use sui::test_scenario::{Self as ts};
use sui::clock;
use std::string;
use synaptic_protocol::agent_registry::{Self, Agent, AgentCap};

// ══════════════════════════════════════════════════════════════════════════════
// Test Addresses
// ══════════════════════════════════════════════════════════════════════════════

const ALICE: address = @0xA;
const BOB: address = @0xB;

// ══════════════════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════════════════

#[test]
/// Register an agent and verify all fields are initialized correctly.
fun test_register_agent() {
    let mut scenario = ts::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());

    // Register an agent as ALICE.
    scenario.next_tx(ALICE);
    {
        agent_registry::register_agent(
            string::utf8(b"Oracle-Alpha"),
            b"pk_alice_01",
            vector[string::utf8(b"DeFi"), string::utf8(b"Oracle")],
            &clock,
            scenario.ctx(),
        );
    };

    // Verify Agent shared object and AgentCap owned object were created.
    scenario.next_tx(ALICE);
    {
        let agent = scenario.take_shared<Agent>();
        let cap = scenario.take_from_sender<AgentCap>();

        // Verify agent fields.
        assert!(agent_registry::owner(&agent) == ALICE);
        assert!(*agent_registry::name(&agent) == string::utf8(b"Oracle-Alpha"));
        assert!(*agent_registry::model_hash(&agent) == b"pk_alice_01");
        assert!(agent_registry::reputation(&agent) == 0);
        assert!(agent_registry::total_volume(&agent) == 0);
        assert!(agent_registry::total_sales(&agent) == 0);

        // Verify categories.
        let cats = agent_registry::categories(&agent);
        assert!(cats.length() == 2);

        // Verify cap links to agent.
        assert!(agent_registry::agent_id(&cap) == object::id(&agent));

        ts::return_shared(agent);
        ts::return_to_sender(&scenario, cap);
    };

    clock.destroy_for_testing();
    scenario.end();
}

#[test]
/// Update reputation using the correct AgentCap.
fun test_update_reputation() {
    let mut scenario = ts::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());

    // Register.
    scenario.next_tx(ALICE);
    {
        agent_registry::register_agent(
            string::utf8(b"Test Agent"),
            b"pk_test",
            vector[],
            &clock,
            scenario.ctx(),
        );
    };

    // Update reputation.
    scenario.next_tx(ALICE);
    {
        let mut agent = scenario.take_shared<Agent>();
        let cap = scenario.take_from_sender<AgentCap>();

        agent_registry::update_reputation(&mut agent, &cap, 100);
        assert!(agent_registry::reputation(&agent) == 100);

        agent_registry::update_reputation(&mut agent, &cap, 50);
        assert!(agent_registry::reputation(&agent) == 150);

        ts::return_shared(agent);
        ts::return_to_sender(&scenario, cap);
    };

    clock.destroy_for_testing();
    scenario.end();
}

#[test]
/// Record sales and verify volume/sales counters increment correctly.
fun test_record_sale() {
    let mut scenario = ts::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());

    // Register.
    scenario.next_tx(ALICE);
    {
        agent_registry::register_agent(
            string::utf8(b"Seller Agent"),
            b"pk_seller",
            vector[string::utf8(b"Oracle")],
            &clock,
            scenario.ctx(),
        );
    };

    // Record sales.
    scenario.next_tx(ALICE);
    {
        let mut agent = scenario.take_shared<Agent>();
        let cap = scenario.take_from_sender<AgentCap>();

        agent_registry::record_sale(&mut agent, &cap, 1_000_000_000); // 1 SUI
        assert!(agent_registry::total_volume(&agent) == 1_000_000_000);
        assert!(agent_registry::total_sales(&agent) == 1);

        agent_registry::record_sale(&mut agent, &cap, 500_000_000); // 0.5 SUI
        assert!(agent_registry::total_volume(&agent) == 1_500_000_000);
        assert!(agent_registry::total_sales(&agent) == 2);

        ts::return_shared(agent);
        ts::return_to_sender(&scenario, cap);
    };

    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = agent_registry::ENotAgentOwner)]
/// Attempting to update reputation with a wrong AgentCap should abort.
fun test_update_reputation_wrong_cap() {
    let mut scenario = ts::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());

    // ALICE registers an agent.
    scenario.next_tx(ALICE);
    {
        agent_registry::register_agent(
            string::utf8(b"Alice Agent"),
            b"pk_alice",
            vector[],
            &clock,
            scenario.ctx(),
        );
    };

    // Get ALICE's agent ID.
    scenario.next_tx(ALICE);
    let alice_agent_id = {
        let agent = scenario.take_shared<Agent>();
        let id = object::id(&agent);
        ts::return_shared(agent);
        id
    };

    // BOB registers a different agent.
    scenario.next_tx(BOB);
    {
        agent_registry::register_agent(
            string::utf8(b"Bob Agent"),
            b"pk_bob",
            vector[],
            &clock,
            scenario.ctx(),
        );
    };

    // BOB tries to update ALICE's agent reputation with BOB's cap — should fail.
    scenario.next_tx(BOB);
    {
        let mut alice_agent = scenario.take_shared_by_id<Agent>(alice_agent_id);
        let bob_cap = scenario.take_from_sender<AgentCap>();

        // This should abort with ENotAgentOwner.
        agent_registry::update_reputation(&mut alice_agent, &bob_cap, 999);

        ts::return_shared(alice_agent);
        ts::return_to_sender(&scenario, bob_cap);
    };

    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = agent_registry::ENotAgentOwner)]
/// Attempting to record a sale with a wrong AgentCap should abort.
fun test_record_sale_wrong_cap() {
    let mut scenario = ts::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());

    // ALICE registers an agent.
    scenario.next_tx(ALICE);
    {
        agent_registry::register_agent(
            string::utf8(b"Alice Agent"),
            b"pk_alice",
            vector[],
            &clock,
            scenario.ctx(),
        );
    };

    // Get ALICE's agent ID.
    scenario.next_tx(ALICE);
    let alice_agent_id = {
        let agent = scenario.take_shared<Agent>();
        let id = object::id(&agent);
        ts::return_shared(agent);
        id
    };

    // BOB registers a different agent.
    scenario.next_tx(BOB);
    {
        agent_registry::register_agent(
            string::utf8(b"Bob Agent"),
            b"pk_bob",
            vector[],
            &clock,
            scenario.ctx(),
        );
    };

    // BOB tries to record a sale on ALICE's agent — should fail.
    scenario.next_tx(BOB);
    {
        let mut alice_agent = scenario.take_shared_by_id<Agent>(alice_agent_id);
        let bob_cap = scenario.take_from_sender<AgentCap>();

        agent_registry::record_sale(&mut alice_agent, &bob_cap, 1_000_000);

        ts::return_shared(alice_agent);
        ts::return_to_sender(&scenario, bob_cap);
    };

    clock.destroy_for_testing();
    scenario.end();
}

#[test]
/// Verify adding, updating, querying, and removing dynamic metadata on an Agent.
fun test_agent_dynamic_metadata() {
    let mut scenario = ts::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());

    // Register an agent.
    scenario.next_tx(ALICE);
    {
        agent_registry::register_agent(
            string::utf8(b"Meta-Agent"),
            b"model_abc",
            vector[],
            &clock,
            scenario.ctx(),
        );
    };

    // Add and update metadata.
    scenario.next_tx(ALICE);
    {
        let mut agent = scenario.take_shared<Agent>();
        let cap = scenario.take_from_sender<AgentCap>();

        // Assert no metadata exists yet.
        assert!(!agent_registry::has_metadata(&agent, string::utf8(b"version")), 0);

        // Add metadata.
        agent_registry::add_metadata(&mut agent, &cap, string::utf8(b"version"), 100u64);
        assert!(agent_registry::has_metadata(&agent, string::utf8(b"version")), 1);

        // Update metadata.
        agent_registry::update_metadata(&mut agent, &cap, string::utf8(b"version"), 200u64);
        
        // Remove metadata and verify returned value.
        let val: u64 = agent_registry::remove_metadata(&mut agent, &cap, string::utf8(b"version"));
        assert!(val == 200, 2);
        assert!(!agent_registry::has_metadata(&agent, string::utf8(b"version")), 3);

        ts::return_shared(agent);
        ts::return_to_sender(&scenario, cap);
    };

    clock.destroy_for_testing();
    scenario.end();
}

#[test]
/// Verify reputation decrement works correctly.
fun test_decrement_reputation() {
    let mut scenario = ts::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());

    // Register an agent.
    scenario.next_tx(ALICE);
    {
        agent_registry::register_agent(
            string::utf8(b"Rep-Agent"),
            b"model_rep",
            vector[],
            &clock,
            scenario.ctx(),
        );
    };

    // Increment and then decrement reputation.
    scenario.next_tx(ALICE);
    {
        let mut agent = scenario.take_shared<Agent>();
        let cap = scenario.take_from_sender<AgentCap>();

        agent_registry::update_reputation(&mut agent, &cap, 100);
        assert!(agent_registry::reputation(&agent) == 100);

        agent_registry::decrement_reputation(&mut agent, &cap, 30);
        assert!(agent_registry::reputation(&agent) == 70);

        // Lower reputation past zero - should floor at zero.
        agent_registry::decrement_reputation(&mut agent, &cap, 150);
        assert!(agent_registry::reputation(&agent) == 0);

        ts::return_shared(agent);
        ts::return_to_sender(&scenario, cap);
    };

    clock.destroy_for_testing();
    scenario.end();
}

#[test]
/// Verify deregistering an agent destroys AgentCap and deactivates agent.
fun test_deregister_agent() {
    let mut scenario = ts::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());

    // Register.
    scenario.next_tx(ALICE);
    {
        agent_registry::register_agent(
            string::utf8(b"Lifecycle-Agent"),
            b"model_lifecycle",
            vector[],
            &clock,
            scenario.ctx(),
        );
    };

    // Verify it is active first.
    scenario.next_tx(ALICE);
    {
        let agent = scenario.take_shared<Agent>();
        assert!(agent_registry::is_agent_active(&agent) == true);
        ts::return_shared(agent);
    };

    // Deregister.
    scenario.next_tx(ALICE);
    {
        let mut agent = scenario.take_shared<Agent>();
        let cap = scenario.take_from_sender<AgentCap>();

        agent_registry::deregister_agent(&mut agent, cap);
        assert!(agent_registry::is_agent_active(&agent) == false);

        ts::return_shared(agent);
    };

    // Verify AgentCap is completely gone.
    scenario.next_tx(ALICE);
    {
        assert!(!scenario.has_most_recent_for_sender<AgentCap>());
    };

    clock.destroy_for_testing();
    scenario.end();
}
