# StakeMaster (Local)

This frontend is wired to your **local Hardhat node** and your deployed addresses:

- **MockERC20 (STK)**: `0x71A8e20013E341B30AA60F60146Da4692319B23a`
- **Staking Proxy (use this)**: `0x0A651822fe1e678fBAA3a5c8b50AAcA285C6A6df`
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

