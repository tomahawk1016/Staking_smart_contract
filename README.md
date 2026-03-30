# Staking Smart Contract Project

This project implements a decentralized **Staking Protocol** that allows users to deposit tokens to earn rewards over time. The system is designed to be secure, gas-efficient, and transparent.

### Architecture

The protocol utilizes a single-vault architecture where users interact with a main staking contract. It follows the **Pull-Payment** and **State-Update** patterns to ensure security and scalability.

- **Staking Token**: The ERC-20 asset users lock into the contract (e.g., LP tokens or Governance tokens).
- **Reward Token**: The ERC-20 asset distributed as incentives.
- **Accounting Logic**: The contract tracks "Reward Per Token" globally and updates individual user "Reward Debts" whenever they interact with the contract (stake, withdraw, or claim).

**Core Functions:**
- `stake(uint256 amount)`: Transfers tokens from the user to the contract and updates their rewards.
- `withdraw(uint256 amount)`: Returns the user's principal.
- `getReward()`: Transfers accrued rewards to the user's wallet without unstaking.
- `exit()`: A shortcut to withdraw all staked tokens and claim all rewards in one transaction.

### Reward Formula

The contract uses a **time-weighted distribution** mechanism to handle reward calculations in $O(1)$ gas complexity, ensuring gas costs don't increase with the number of participants.

**Mathematical Model:**

1. **Global Reward Per Token ($S$):**
   Registers how many rewards have been earned by each staked token since the start of the program.
   \[ S_{now} = S_{old} + \frac{R \times (T_{now} - T_{last})}{L} \]
   *Where $R$ is the Reward Rate, $T$ is time, and $L$ is the Total Supply Staked.*

2. **User Earned Rewards:**
   Calculated by checking the difference between the current global reward index and the index when the user last updated their position.
   \[ Reward_{user} = (Balance_{user} \times (S_{now} - Index_{user})) + Rewards_{pending} \]

### Key Assumptions

- **Decimals**: The contract assumes both Staking and Reward tokens use **18 decimals**. 
- **Fixed Reward Rate**: Rewards are distributed linearly over a set `duration` defined by the owner.
- **Trust Minimized**: The owner can set the reward amount but **cannot** access users' staked principal.
- **No Slashing**: There are no penalties or lock-up periods applied to the principal (unless configured in the constructor).
- **Reentrancy**: All state-changing functions utilize the `nonReentrant` modifier or follow the Checks-Effects-Interactions pattern.

### How to Deploy

The project uses **Hardhat** for deployment.

1. **Initialize Environment**:
   ```bash
   cp .env.example .env
   # Add your PRIVATE_KEY and RPC_URL

2. **Install Dependencies**:
    ```bash
    npm install

3. **Deploy**:
    ```bash
    npx hardhat run scripts/deploy.ts --network <network_name>

### How to Test

A robust suite of tests is included to verify rewards math and edge cases.

1. **Run Unit Tests**:
    ```bash
    npx hardhat test

2. **Gas Reporting**: 

    To see the gas cost of each operation.
    
    ```bash
    REPORT_GAS=true npx hardhat test

3. **Coverage Analysis:**:
    ```bash
    npx hardhat coverage

