export const stakingAbi = [
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "stakingToken", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "pause", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "unpause", stateMutability: "nonpayable", inputs: [], outputs: [] },

  { type: "function", name: "planCount", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  {
    type: "function",
    name: "getPlan",
    stateMutability: "view",
    inputs: [{ name: "planId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "lockDuration", type: "uint256" },
          { name: "aprBps", type: "uint256" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  { type: "function", name: "isPlanActive", stateMutability: "view", inputs: [{ name: "planId", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },

  { type: "function", name: "getUserPositionCount", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  {
    type: "function",
    name: "getUserPosition",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "positionIndex", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "amount", type: "uint256" },
          { name: "stakeStart", type: "uint256" },
          { name: "claimedRewards", type: "uint256" },
          { name: "lockDuration", type: "uint256" },
          { name: "aprBps", type: "uint256" },
          { name: "closed", type: "bool" },
        ],
      },
    ],
  },

  { type: "function", name: "pendingRewards", stateMutability: "view", inputs: [{ name: "user", type: "address" }, { name: "positionIndex", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "previewClaimableRewards", stateMutability: "view", inputs: [{ name: "user", type: "address" }, { name: "positionIndex", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  {
    type: "function",
    name: "previewUnstakeReward",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }, { name: "positionIndex", type: "uint256" }],
    outputs: [{ name: "rewardPaid", type: "uint256" }, { name: "early", type: "bool" }],
  },

  { type: "function", name: "positionLockEnd", stateMutability: "view", inputs: [{ name: "user", type: "address" }, { name: "positionIndex", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "secondsUntilUnlock", stateMutability: "view", inputs: [{ name: "user", type: "address" }, { name: "positionIndex", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "isPositionLocked", stateMutability: "view", inputs: [{ name: "user", type: "address" }, { name: "positionIndex", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "isPositionClosed", stateMutability: "view", inputs: [{ name: "user", type: "address" }, { name: "positionIndex", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },

  { type: "function", name: "earlyUnstakePenaltyBps", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "contractTokenBalance", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "totalOpenPrincipal", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ name: "sum", type: "uint256" }] },

  { type: "function", name: "stake", stateMutability: "nonpayable", inputs: [{ name: "planId", type: "uint256" }, { name: "amount", type: "uint256" }], outputs: [{ name: "positionIndex", type: "uint256" }] },
  { type: "function", name: "claimRewards", stateMutability: "nonpayable", inputs: [{ name: "positionIndex", type: "uint256" }], outputs: [] },
  { type: "function", name: "unstake", stateMutability: "nonpayable", inputs: [{ name: "positionIndex", type: "uint256" }], outputs: [] },

  { type: "function", name: "addedPlan", stateMutability: "nonpayable", inputs: [{ name: "lockDuration", type: "uint256" }, { name: "aprBps", type: "uint256" }], outputs: [{ name: "planId", type: "uint256" }] },
  { type: "function", name: "updatedPlan", stateMutability: "nonpayable", inputs: [{ name: "planId", type: "uint256" }, { name: "lockDuration", type: "uint256" }, { name: "aprBps", type: "uint256" }], outputs: [] },
  { type: "function", name: "activedPlan", stateMutability: "nonpayable", inputs: [{ name: "planId", type: "uint256" }, { name: "active", type: "bool" }], outputs: [] },
  { type: "function", name: "setEarlyUnstakePenaltyBps", stateMutability: "nonpayable", inputs: [{ name: "penaltyBps", type: "uint256" }], outputs: [] },

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
  { type: "event", name: "RewardClaimed", anonymous: false, inputs: [{ indexed: true, name: "user", type: "address" }, { indexed: true, name: "positionIndex", type: "uint256" }, { indexed: false, name: "amount", type: "uint256" }] },
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
  { type: "event", name: "AddedPlan", anonymous: false, inputs: [{ indexed: true, name: "planId", type: "uint256" }, { indexed: false, name: "lockDuration", type: "uint256" }, { indexed: false, name: "aprBps", type: "uint256" }] },
  { type: "event", name: "UpdatedPlan", anonymous: false, inputs: [{ indexed: true, name: "planId", type: "uint256" }, { indexed: false, name: "lockDuration", type: "uint256" }, { indexed: false, name: "aprBps", type: "uint256" }] },
  { type: "event", name: "ActivedPlan", anonymous: false, inputs: [{ indexed: true, name: "planId", type: "uint256" }, { indexed: false, name: "active", type: "bool" }] },
  { type: "event", name: "EarlyUnstakePenaltyUpdated", anonymous: false, inputs: [{ indexed: false, name: "penaltyBps", type: "uint256" }] },
  { type: "event", name: "Paused", anonymous: false, inputs: [{ indexed: false, name: "account", type: "address" }] },
  { type: "event", name: "Unpaused", anonymous: false, inputs: [{ indexed: false, name: "account", type: "address" }] },
  { type: "event", name: "OwnershipTransferred", anonymous: false, inputs: [{ indexed: true, name: "previousOwner", type: "address" }, { indexed: true, name: "newOwner", type: "address" }] },
] as const;

