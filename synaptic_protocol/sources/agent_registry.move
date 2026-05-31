/// Module: synaptic_protocol::agent_registry
/// 
/// Manages AI agent registration and reputation on-chain.
/// Each agent is a shared object with an associated ownership capability (`AgentCap`).
/// The `AgentCap` proves ownership and is required for privileged mutations
/// such as reputation updates and sale recording.
module synaptic_protocol::agent_registry;

use std::string::String;
use sui::clock::{Self, Clock};
use sui::event;
use sui::dynamic_field;

// ══════════════════════════════════════════════════════════════════════════════
// Error Constants
// ══════════════════════════════════════════════════════════════════════════════

/// Caller does not hold the `AgentCap` that matches this agent.
const ENotAgentOwner: u64 = 0;

// ══════════════════════════════════════════════════════════════════════════════
// Structs
// ══════════════════════════════════════════════════════════════════════════════

/// On-chain representation of an AI agent.
/// Shared object — anyone can read, but mutations require the matching `AgentCap`.
/// `key` only (no `store`) so it cannot be wrapped or transferred after sharing.
public struct Agent has key {
    id: UID,
    /// The address that originally registered this agent.
    owner: address,
    /// The agent's cryptographic model hash verifying its identity / integrity.
    model_hash: vector<u8>,
    /// Human-readable display name.
    name: String,
    /// Cumulative reputation score (monotonically increasing).
    reputation: u64,
    /// Tags describing the agent's data domain (e.g., "DeFi", "NFT", "Oracle").
    categories: vector<String>,
    /// Cumulative SUI volume (in MIST) from marketplace sales.
    total_volume: u64,
    /// Number of individual sales completed.
    total_sales: u64,
    /// Epoch-millisecond timestamp when the agent was registered.
    created_at: u64,
}

/// Capability object proving ownership of a specific `Agent`.
/// `key + store` so it can be freely transferred between addresses.
public struct AgentCap has key, store {
    id: UID,
    /// The `ID` of the `Agent` this cap controls.
    agent_id: ID,
}

// ══════════════════════════════════════════════════════════════════════════════
// Events
// ══════════════════════════════════════════════════════════════════════════════

/// Emitted when a new agent is registered.
public struct AgentRegistered has copy, drop {
    agent_id: ID,
    owner: address,
    name: String,
}

/// Emitted when an agent's reputation is updated.
public struct ReputationUpdated has copy, drop {
    agent_id: ID,
    new_reputation: u64,
}

// ══════════════════════════════════════════════════════════════════════════════
// Public Entry Functions
// ══════════════════════════════════════════════════════════════════════════════

/// Register a new AI agent.
///
/// Creates a shared `Agent` object and transfers the corresponding `AgentCap`
/// to the transaction sender, establishing ownership.
#[allow(lint(self_transfer))]
public fun register_agent(
    name: String,
    model_hash: vector<u8>,
    categories: vector<String>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let sender = ctx.sender();

    let agent = Agent {
        id: object::new(ctx),
        owner: sender,
        model_hash,
        name,
        reputation: 0,
        categories,
        total_volume: 0,
        total_sales: 0,
        created_at: clock::timestamp_ms(clock),
    };

    let agent_id = object::id(&agent);

    let cap = AgentCap {
        id: object::new(ctx),
        agent_id,
    };

    // Emit registration event.
    event::emit(AgentRegistered {
        agent_id,
        owner: sender,
        name: agent.name,
    });

    // Share the agent so anyone can reference it; transfer cap to owner.
    transfer::share_object(agent);
    transfer::public_transfer(cap, sender);
}

/// Increment an agent's reputation score.
///
/// Only the holder of the matching `AgentCap` may call this.
public fun update_reputation(
    agent: &mut Agent,
    cap: &AgentCap,
    delta: u64,
) {
    assert!(cap.agent_id == object::id(agent), ENotAgentOwner);

    agent.reputation = agent.reputation + delta;

    event::emit(ReputationUpdated {
        agent_id: cap.agent_id,
        new_reputation: agent.reputation,
    });
}

/// Record a completed sale against this agent's stats.
///
/// Called internally by the marketplace module after a successful purchase.
/// Record a completed sale against this agent's stats.
///
/// Restrained to package level to prevent arbitrary score inflation by Cap holders.
public(package) fun record_sale(
    agent: &mut Agent,
    cap: &AgentCap,
    amount: u64,
) {
    assert!(cap.agent_id == object::id(agent), ENotAgentOwner);

    agent.total_volume = agent.total_volume + amount;
    agent.total_sales = agent.total_sales + 1;
}

/// Decrement an agent's reputation score (e.g., as penalty).
///
/// Only the holder of the matching `AgentCap` may call this.
public fun decrement_reputation(
    agent: &mut Agent,
    cap: &AgentCap,
    delta: u64,
) {
    assert!(cap.agent_id == object::id(agent), ENotAgentOwner);

    if (agent.reputation >= delta) {
        agent.reputation = agent.reputation - delta;
    } else {
        agent.reputation = 0;
    };

    event::emit(ReputationUpdated {
        agent_id: cap.agent_id,
        new_reputation: agent.reputation,
    });
}

/// Deregister/deactivate an agent.
///
/// Consumes and destroys the ownership capability, and marks the agent
/// as deactivated via a dynamic field so it can be filtered out.
public fun deregister_agent(
    agent: &mut Agent,
    cap: AgentCap,
) {
    assert!(cap.agent_id == object::id(agent), ENotAgentOwner);

    // Destroy the AgentCap.
    let AgentCap { id, agent_id: _ } = cap;
    object::delete(id);

    // Add dynamic field to mark it deactivated.
    dynamic_field::add(&mut agent.id, std::string::utf8(b"deactivated"), true);
}

/// Check whether an agent is active.
public fun is_agent_active(agent: &Agent): bool {
    !dynamic_field::exists_with_type<String, bool>(&agent.id, std::string::utf8(b"deactivated"))
}

/// Record a completed marketplace sale against this agent's stats.
///
/// Called internally by the marketplace module within the same package.
public(package) fun record_marketplace_sale(
    agent: &mut Agent,
    amount: u64,
) {
    agent.total_volume = agent.total_volume + amount;
    agent.total_sales = agent.total_sales + 1;
}

/// Add custom dynamic metadata to an Agent.
/// Requires the matching AgentCap.
public fun add_metadata<T: store + copy + drop>(
    agent: &mut Agent,
    cap: &AgentCap,
    name: String,
    value: T,
) {
    assert!(cap.agent_id == object::id(agent), ENotAgentOwner);
    dynamic_field::add(&mut agent.id, name, value);
}

/// Update custom dynamic metadata on an Agent.
/// Requires the matching AgentCap.
public fun update_metadata<T: store + copy + drop>(
    agent: &mut Agent,
    cap: &AgentCap,
    name: String,
    value: T,
) {
    assert!(cap.agent_id == object::id(agent), ENotAgentOwner);
    if (dynamic_field::exists(&agent.id, name)) {
        let field_ref = dynamic_field::borrow_mut(&mut agent.id, name);
        *field_ref = value;
    } else {
        dynamic_field::add(&mut agent.id, name, value);
    };
}

/// Remove custom dynamic metadata from an Agent and return it.
/// Requires the matching AgentCap.
public fun remove_metadata<T: store + copy + drop>(
    agent: &mut Agent,
    cap: &AgentCap,
    name: String,
): T {
    assert!(cap.agent_id == object::id(agent), ENotAgentOwner);
    dynamic_field::remove(&mut agent.id, name)
}

/// Query whether a specific metadata field exists on an Agent.
public fun has_metadata(agent: &Agent, name: String): bool {
    dynamic_field::exists(&agent.id, name)
}

// ══════════════════════════════════════════════════════════════════════════════
// Getter Functions
// ══════════════════════════════════════════════════════════════════════════════

/// Returns the `ID` of the agent controlled by this capability.
public fun agent_id(cap: &AgentCap): ID {
    cap.agent_id
}

/// Returns the owner address of the agent.
public fun owner(agent: &Agent): address {
    agent.owner
}

/// Returns the agent's model hash.
public fun model_hash(agent: &Agent): &vector<u8> {
    &agent.model_hash
}

/// Returns the agent's display name.
public fun name(agent: &Agent): &String {
    &agent.name
}

/// Returns the agent's current reputation score.
public fun reputation(agent: &Agent): u64 {
    agent.reputation
}

/// Returns the agent's categories.
public fun categories(agent: &Agent): &vector<String> {
    &agent.categories
}

/// Returns the agent's cumulative trade volume (in MIST).
public fun total_volume(agent: &Agent): u64 {
    agent.total_volume
}

/// Returns the number of sales the agent has completed.
public fun total_sales(agent: &Agent): u64 {
    agent.total_sales
}

/// Returns the epoch-millisecond timestamp of agent creation.
public fun created_at(agent: &Agent): u64 {
    agent.created_at
}
