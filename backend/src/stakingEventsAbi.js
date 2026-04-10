/** Minimal ABI for decoding Staking stake / claim / unstake logs (matches contracts/Staking.sol). */
export const stakingEventsAbi = [
  {
    type: "event",
    name: "Staked",
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "positionIndex", type: "uint256" },
      { indexed: true, name: "planId", type: "uint256" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "RewardClaimed",
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "positionIndex", type: "uint256" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "Unstaked",
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: true, name: "positionIndex", type: "uint256" },
      { indexed: false, name: "principal", type: "uint256" },
      { indexed: false, name: "rewardPaid", type: "uint256" },
      { indexed: false, name: "early", type: "bool" },
      { indexed: false, name: "penaltyAppliedOnRewards", type: "uint256" },
    ],
  },
];
