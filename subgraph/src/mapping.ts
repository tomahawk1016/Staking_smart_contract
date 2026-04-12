import {
  Staked as StakedEvent,
  RewardClaimed as RewardClaimedEvent,
  Unstaked as UnstakedEvent,
} from "../generated/Staking/Staking";
import { StakeEvent, ClaimEvent, UnstakeEvent } from "../generated/schema";

function eventId(txHash: string, logIndex: i32): string {
  return txHash.concat("-").concat(logIndex.toString());
}

export function handleStaked(event: StakedEvent): void {
  let id = eventId(event.transaction.hash.toHexString(), event.logIndex.toI32());
  let e = new StakeEvent(id);
  e.user = event.params.user;
  e.positionIndex = event.params.positionIndex;
  e.planId = event.params.planId;
  e.amount = event.params.amount;
  e.blockNumber = event.block.number;
  e.txHash = event.transaction.hash;
  e.timestamp = event.block.timestamp;
  e.save();
}

export function handleRewardClaimed(event: RewardClaimedEvent): void {
  let id = eventId(event.transaction.hash.toHexString(), event.logIndex.toI32());
  let e = new ClaimEvent(id);
  e.user = event.params.user;
  e.positionIndex = event.params.positionIndex;
  e.amount = event.params.amount;
  e.blockNumber = event.block.number;
  e.txHash = event.transaction.hash;
  e.timestamp = event.block.timestamp;
  e.save();
}

export function handleUnstaked(event: UnstakedEvent): void {
  let id = eventId(event.transaction.hash.toHexString(), event.logIndex.toI32());
  let e = new UnstakeEvent(id);
  e.user = event.params.user;
  e.positionIndex = event.params.positionIndex;
  e.principal = event.params.principal;
  e.rewardPaid = event.params.rewardPaid;
  e.early = event.params.early;
  e.penaltyAppliedOnRewards = event.params.penaltyAppliedOnRewards;
  e.blockNumber = event.block.number;
  e.txHash = event.transaction.hash;
  e.timestamp = event.block.timestamp;
  e.save();
}
