# StakeMaster (Local)

This frontend is wired to your **local Hardhat node** and your deployed addresses:

- **MockERC20 (STK)**: `0x5FC8d32690cc91D4c39d9d3abcBD16989F875707`
- **Staking Proxy (use this)**: `0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6`
- **Chain**: Hardhat `31337` (RPC: `http://127.0.0.1:8545`)

## Run

In one terminal (repo root):

```bash
npm run node
```

In another terminal (repo root):

```bash
npm run deploy
```

Then run the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open Vite at `http://localhost:5173`.

## Notes

- MetaMask will prompt you to **choose the wallet account** when you connect.
- If your connected account has **0 STK**, transfer STK from the Hardhat deployer account to your wallet (the mock token has fixed supply minted to deployer in the deploy script).

