import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  ActivedPlan as ActivedPlanEvent,
  AddedPlan as AddedPlanEvent,
  EarlyUnstakePenaltyUpdated as EarlyUnstakePenaltyUpdatedEvent,
  RewardClaimed as RewardClaimedEvent,
  Staked as StakedEvent,
  Unstaked as UnstakedEvent,
  UpdatedPlan as UpdatedPlanEvent,
} from "../generated/Staking/Staking";
import { StakingActivity } from "../generated/schema";

function activityId(txHash: Bytes, logIndex: BigInt): string {
  return txHash.toHexString().concat("-").concat(logIndex.toString());
}

export function handleStaked(event: StakedEvent): void {
  const id = activityId(event.transaction.hash, event.logIndex);
  const a = new StakingActivity(id);
  a.activityType = "STAKE";
  a.user = event.params.user;
  a.planId = event.params.planId;
  a.positionIndex = event.params.positionIndex;
  a.amount = event.params.amount;
  a.blockNumber = event.block.number;
  a.timestamp = event.block.timestamp;
  a.txHash = event.transaction.hash;
  a.logIndex = event.logIndex;
  a.save();
}

export function handleRewardClaimed(event: RewardClaimedEvent): void {
  const id = activityId(event.transaction.hash, event.logIndex);
  const a = new StakingActivity(id);
  a.activityType = "CLAIM";
  a.user = event.params.user;
  a.positionIndex = event.params.positionIndex;
  a.amount = event.params.amount;
  a.blockNumber = event.block.number;
  a.timestamp = event.block.timestamp;
  a.txHash = event.transaction.hash;
  a.logIndex = event.logIndex;
  a.save();
}

export function handleUnstaked(event: UnstakedEvent): void {
  const id = activityId(event.transaction.hash, event.logIndex);
  const a = new StakingActivity(id);
  a.activityType = "UNSTAKE";
  a.user = event.params.user;
  a.positionIndex = event.params.positionIndex;
  a.principal = event.params.principal;
  a.rewardPaid = event.params.rewardPaid;
  a.early = event.params.early;
  a.penaltyOnRewards = event.params.penaltyAppliedOnRewards;
  a.blockNumber = event.block.number;
  a.timestamp = event.block.timestamp;
  a.txHash = event.transaction.hash;
  a.logIndex = event.logIndex;
  a.save();
}

export function handleAddedPlan(event: AddedPlanEvent): void {
  const id = activityId(event.transaction.hash, event.logIndex);
  const a = new StakingActivity(id);
  a.activityType = "ADD_PLAN";
  a.user = event.transaction.from;
  a.planId = event.params.planId;
  a.lockDuration = event.params.lockDuration;
  a.aprBps = event.params.aprBps;
  a.blockNumber = event.block.number;
  a.timestamp = event.block.timestamp;
  a.txHash = event.transaction.hash;
  a.logIndex = event.logIndex;
  a.save();
}

export function handleUpdatedPlan(event: UpdatedPlanEvent): void {
  const id = activityId(event.transaction.hash, event.logIndex);
  const a = new StakingActivity(id);
  a.activityType = "UPDATE_PLAN";
  a.user = event.transaction.from;
  a.planId = event.params.planId;
  a.lockDuration = event.params.lockDuration;
  a.aprBps = event.params.aprBps;
  a.blockNumber = event.block.number;
  a.timestamp = event.block.timestamp;
  a.txHash = event.transaction.hash;
  a.logIndex = event.logIndex;
  a.save();
}

export function handleActivedPlan(event: ActivedPlanEvent): void {
  const id = activityId(event.transaction.hash, event.logIndex);
  const a = new StakingActivity(id);
  a.activityType = "SET_PLAN_ACTIVE";
  a.user = event.transaction.from;
  a.planId = event.params.planId;
  a.planActive = event.params.active;
  a.blockNumber = event.block.number;
  a.timestamp = event.block.timestamp;
  a.txHash = event.transaction.hash;
  a.logIndex = event.logIndex;
  a.save();
}

export function handleEarlyUnstakePenaltyUpdated(
  event: EarlyUnstakePenaltyUpdatedEvent,
): void {
  const id = activityId(event.transaction.hash, event.logIndex);
  const a = new StakingActivity(id);
  a.activityType = "SET_PENALTY_BPS";
  a.user = event.transaction.from;
  a.penaltyBps = event.params.penaltyBps;
  a.blockNumber = event.block.number;
  a.timestamp = event.block.timestamp;
  a.txHash = event.transaction.hash;
  a.logIndex = event.logIndex;
  a.save();
}
