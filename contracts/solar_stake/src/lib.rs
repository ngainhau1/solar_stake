#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    Address, Env, symbol_short,
};

// ============================================================
// CONSTANTS — TTL management (from soroban-bootcamp best practices)
// ============================================================

const DAY_IN_LEDGERS: u32 = 17280;
const INSTANCE_TTL: u32 = 7 * DAY_IN_LEDGERS;
const INSTANCE_THRESHOLD: u32 = 6 * DAY_IN_LEDGERS;
const PERSISTENT_TTL: u32 = 30 * DAY_IN_LEDGERS;
const PERSISTENT_THRESHOLD: u32 = 29 * DAY_IN_LEDGERS;

// ============================================================
// DATA TYPES — Storage keys and custom structs
// ============================================================

#[contracttype]
pub enum DataKey {
    Admin,
    Project(u32),
    Investor(u32, Address),
}

/// Represents a tokenized solar panel system
#[contracttype]
#[derive(Clone, Debug)]
pub struct SolarProject {
    pub owner: Address,
    pub capacity_kw: u32,
    pub total_shares: u32,
    pub shares_sold: u32,
    pub price_per_share: i128,
    pub total_yield: i128,
}

/// Tracks an investor's shares and claimed yield
#[contracttype]
#[derive(Clone, Debug)]
pub struct InvestorRecord {
    pub shares_owned: u32,
    pub yield_claimed: i128,
}

/// Typed error enum (best practice from soroban-bootcamp)
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ContractError {
    AlreadyExists = 1,
    NotFound = 2,
    NotAuthorized = 3,
    InsufficientShares = 4,
    InvalidInput = 5,
    NoYieldAvailable = 6,
}

// ============================================================
// CONTRACT
// ============================================================

#[contract]
pub struct SolarStakeContract;

#[contractimpl]
impl SolarStakeContract {
    /// Register a new solar panel project on-chain.
    /// Only the owner can call this. Creates a fractional ownership record.
    pub fn register_solar(
        env: Env,
        owner: Address,
        project_id: u32,
        capacity_kw: u32,
        total_shares: u32,
        price_per_share: i128,
    ) -> Result<(), ContractError> {
        // Auth: owner must sign this transaction
        owner.require_auth();

        // Validate input
        if total_shares == 0 || price_per_share <= 0 {
            return Err(ContractError::InvalidInput);
        }

        let key = DataKey::Project(project_id);

        // Prevent overwriting existing project
        if env.storage().persistent().has(&key) {
            return Err(ContractError::AlreadyExists);
        }

        let project = SolarProject {
            owner: owner.clone(),
            capacity_kw,
            total_shares,
            shares_sold: 0,
            price_per_share,
            total_yield: 0,
        };

        // Save to persistent storage + extend TTL
        env.storage().persistent().set(&key, &project);
        env.storage().persistent().extend_ttl(&key, PERSISTENT_THRESHOLD, PERSISTENT_TTL);

        // Emit event for transparency
        env.events().publish((symbol_short!("register"), owner), project_id);

        Ok(())
    }

    /// Buy shares in a solar project.
    /// Investor must sign. Records fractional ownership on-chain.
    pub fn buy_shares(
        env: Env,
        investor: Address,
        project_id: u32,
        num_shares: u32,
    ) -> Result<(), ContractError> {
        // Auth: investor must sign
        investor.require_auth();

        if num_shares == 0 {
            return Err(ContractError::InvalidInput);
        }

        let proj_key = DataKey::Project(project_id);
        let mut project: SolarProject = env
            .storage()
            .persistent()
            .get(&proj_key)
            .ok_or(ContractError::NotFound)?;

        // Check available shares
        if project.shares_sold + num_shares > project.total_shares {
            return Err(ContractError::InsufficientShares);
        }

        // Update project
        project.shares_sold += num_shares;
        env.storage().persistent().set(&proj_key, &project);
        env.storage().persistent().extend_ttl(&proj_key, PERSISTENT_THRESHOLD, PERSISTENT_TTL);

        // Update investor record
        let inv_key = DataKey::Investor(project_id, investor.clone());
        let mut record: InvestorRecord = env
            .storage()
            .persistent()
            .get(&inv_key)
            .unwrap_or(InvestorRecord {
                shares_owned: 0,
                yield_claimed: 0,
            });

        record.shares_owned += num_shares;
        env.storage().persistent().set(&inv_key, &record);
        env.storage().persistent().extend_ttl(&inv_key, PERSISTENT_THRESHOLD, PERSISTENT_TTL);

        // Emit event
        env.events().publish((symbol_short!("buy"), investor), num_shares);

        Ok(())
    }

    /// Owner distributes monthly electricity yield to the pool.
    /// Only the project owner can call this.
    pub fn distribute_yield(
        env: Env,
        owner: Address,
        project_id: u32,
        yield_amount: i128,
    ) -> Result<(), ContractError> {
        owner.require_auth();

        if yield_amount <= 0 {
            return Err(ContractError::InvalidInput);
        }

        let proj_key = DataKey::Project(project_id);
        let mut project: SolarProject = env
            .storage()
            .persistent()
            .get(&proj_key)
            .ok_or(ContractError::NotFound)?;

        // Security: only project owner can distribute
        if project.owner != owner {
            return Err(ContractError::NotAuthorized);
        }

        project.total_yield += yield_amount;
        env.storage().persistent().set(&proj_key, &project);
        env.storage().persistent().extend_ttl(&proj_key, PERSISTENT_THRESHOLD, PERSISTENT_TTL);

        // Emit event
        env.events().publish((symbol_short!("yield"), owner), yield_amount);

        Ok(())
    }

    /// Investor claims their proportional share of accumulated yield.
    pub fn claim_yield(
        env: Env,
        investor: Address,
        project_id: u32,
    ) -> Result<i128, ContractError> {
        investor.require_auth();

        let proj_key = DataKey::Project(project_id);
        let project: SolarProject = env
            .storage()
            .persistent()
            .get(&proj_key)
            .ok_or(ContractError::NotFound)?;

        let inv_key = DataKey::Investor(project_id, investor.clone());
        let mut record: InvestorRecord = env
            .storage()
            .persistent()
            .get(&inv_key)
            .ok_or(ContractError::NotFound)?;

        if record.shares_owned == 0 {
            return Err(ContractError::NotFound);
        }

        // Calculate: (total_yield * shares_owned) / total_shares
        let total_eligible = (project.total_yield * (record.shares_owned as i128))
            / (project.total_shares as i128);
        let claimable = total_eligible - record.yield_claimed;

        if claimable <= 0 {
            return Err(ContractError::NoYieldAvailable);
        }

        // Update claimed amount
        record.yield_claimed += claimable;
        env.storage().persistent().set(&inv_key, &record);
        env.storage().persistent().extend_ttl(&inv_key, PERSISTENT_THRESHOLD, PERSISTENT_TTL);

        // Emit event
        env.events().publish((symbol_short!("claim"), investor), claimable);

        Ok(claimable)
    }

    /// Read-only: get project details (anyone can call)
    pub fn get_project(env: Env, project_id: u32) -> Result<SolarProject, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Project(project_id))
            .ok_or(ContractError::NotFound)
    }

    /// Read-only: get investor record (anyone can call)
    pub fn get_investor(
        env: Env,
        project_id: u32,
        investor: Address,
    ) -> Result<InvestorRecord, ContractError> {
        env.storage()
            .persistent()
            .get(&DataKey::Investor(project_id, investor))
            .ok_or(ContractError::NotFound)
    }
}

// ============================================================
// TESTS — Run with: cargo test
// ============================================================

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_full_flow() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(SolarStakeContract, ());
        let client = SolarStakeContractClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let investor = Address::generate(&env);

        // 1. Register a solar project: 50kW, 100 shares, 1_000_000 stroops each
        client.register_solar(&owner, &1u32, &50u32, &100u32, &1_000_000i128);

        // 2. Verify project exists
        let project = client.get_project(&1u32);
        assert_eq!(project.capacity_kw, 50);
        assert_eq!(project.total_shares, 100);
        assert_eq!(project.shares_sold, 0);

        // 3. Investor buys 10 shares
        client.buy_shares(&investor, &1u32, &10u32);
        let project = client.get_project(&1u32);
        assert_eq!(project.shares_sold, 10);

        let record = client.get_investor(&1u32, &investor);
        assert_eq!(record.shares_owned, 10);

        // 4. Owner distributes 500_000 yield
        client.distribute_yield(&owner, &1u32, &500_000i128);
        let project = client.get_project(&1u32);
        assert_eq!(project.total_yield, 500_000);

        // 5. Investor claims yield: 500_000 * 10 / 100 = 50_000
        let claimed = client.claim_yield(&investor, &1u32);
        assert_eq!(claimed, 50_000);

        let record = client.get_investor(&1u32, &investor);
        assert_eq!(record.yield_claimed, 50_000);
    }

    #[test]
    fn test_insufficient_shares() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(SolarStakeContract, ());
        let client = SolarStakeContractClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let investor = Address::generate(&env);

        client.register_solar(&owner, &1u32, &50u32, &10u32, &1_000_000i128);

        // Try to buy more shares than available — should fail
        let result = client.try_buy_shares(&investor, &1u32, &20u32);
        assert!(result.is_err());
    }
}
