// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {
    ReentrancyGuard
} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

contract Staking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Plan {
        uint256 lockDuration;
        uint256 aprBps;
        bool active;
    }

    struct Position {
        uint256 amount;
        uint256 stakeStart;
        uint256 claimedRewards;
        uint256 lockDuration;
        uint256 aprBps;
        bool closed;
    }

    IERC20 public immutable stakingToken;

    uint256 public planCount;
    uint256 public constant BPS_DENOM = 10_000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public earlyUnstakePenaltyBps;

    mapping(uint256 => Plan) public plans;
    mapping(address => Position[]) public userPositions;

    event AddedPlan(
        uint256 indexed planId,
        uint256 lockDuration,
        uint256 aprBps
    );
    event UpdatedPlan(
        uint256 indexed planId,
        uint256 lockDuration,
        uint256 aprBps
    );
    event ActivedPlan(uint256 indexed planId, bool active);
    event EarlyUnstakePenaltyUpdated(uint256 penaltyBps);
    event Staked(
        address indexed user,
        uint256 indexed positionIndex,
        uint256 indexed planId,
        uint256 amount
    );
    event RewardClaimed(
        address indexed user,
        uint256 indexed positionIndex,
        uint256 amount
    );
    event Unstaked(
        address indexed user,
        uint256 indexed positionIndex,
        uint256 principal,
        uint256 rewardPaid,
        bool early,
        uint256 penaltyAppliedOnRewards
    );

    error ZeroAddress();
    error ZeroAmount();
    error InvalidPlan();
    error PlanInactive();
    error InvalidPositionIndex();
    error PositionClosed();
    error NothingToClaim();
    error PenaltyTooHigh();

    constructor(IERC20 _stakingToken, address _owner) Ownable(_owner) {
        if (address(_stakingToken) == address(0)) revert ZeroAddress();
        stakingToken = _stakingToken;
    }

    function addedPlan(
        uint256 lockDuration,
        uint256 aprBps
    ) external onlyOwner returns (uint256 planId) {
        planId = planCount;
        unchecked {
            planCount = planId + 1;
        }
        plans[planId] = Plan({
            lockDuration: lockDuration,
            aprBps: aprBps,
            active: true
        });
        emit AddedPlan(planId, lockDuration, aprBps);
    }

    function updatedPlan(
        uint256 planId,
        uint256 lockDuration,
        uint256 aprBps
    ) external onlyOwner {
        if (planId >= planCount) revert InvalidPlan();
        Plan storage p = plans[planId];
        p.lockDuration = lockDuration;
        p.aprBps = aprBps;
        emit UpdatedPlan(planId, lockDuration, aprBps);
    }

    function activedPlan(uint256 planId, bool active) external onlyOwner {
        if (planId >= planCount) revert InvalidPlan();
        plans[planId].active = active;
        emit ActivedPlan(planId, active);
    }

    function setEarlyUnstakePenaltyBps(uint256 penaltyBps) external onlyOwner {
        if (penaltyBps > BPS_DENOM) revert PenaltyTooHigh();
        earlyUnstakePenaltyBps = penaltyBps;
        emit EarlyUnstakePenaltyUpdated(penaltyBps);
    }

    function stake(
        uint256 planId,
        uint256 amount
    ) external nonReentrant returns (uint256 positionIndex) {
        if (amount == 0) revert ZeroAmount();
        if (planId >= planCount) revert InvalidPlan();
        Plan storage p = plans[planId];
        if (!p.active) revert PlanInactive();

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        Position memory pos = Position({
            amount: amount,
            stakeStart: block.timestamp,
            claimedRewards: 0,
            lockDuration: p.lockDuration,
            aprBps: p.aprBps,
            closed: false
        });
        userPositions[msg.sender].push(pos);
        positionIndex = userPositions[msg.sender].length - 1;

        emit Staked(msg.sender, positionIndex, planId, amount);
    }

    function claimRewards(uint256 positionIndex) external nonReentrant {
        Position storage pos = _loadOpenPosition(msg.sender, positionIndex);
        uint256 pending = _pendingRewards(pos);
        if (pending == 0) revert NothingToClaim();

        pos.claimedRewards += pending;
        stakingToken.safeTransfer(msg.sender, pending);

        emit RewardClaimed(msg.sender, positionIndex, pending);
    }

    function unstake(uint256 positionIndex) external nonReentrant {
        Position storage pos = _loadOpenPosition(msg.sender, positionIndex);

        uint256 principal = pos.amount;
        uint256 pending = _pendingRewards(pos);
        bool early = block.timestamp < pos.stakeStart + pos.lockDuration;

        uint256 rewardPaid = pending;
        uint256 penaltyOnRewards = 0;
        if (early && earlyUnstakePenaltyBps > 0 && pending > 0) {
            penaltyOnRewards = Math.mulDiv(
                pending,
                earlyUnstakePenaltyBps,
                BPS_DENOM
            );
            rewardPaid = pending - penaltyOnRewards;
        }

        pos.closed = true;
        pos.claimedRewards += pending;

        stakingToken.safeTransfer(msg.sender, principal + rewardPaid);

        emit Unstaked(
            msg.sender,
            positionIndex,
            principal,
            rewardPaid,
            early,
            penaltyOnRewards
        );
    }

    function _loadOpenPosition(
        address user,
        uint256 positionIndex
    ) internal view returns (Position storage) {
        if (positionIndex >= userPositions[user].length)
            revert InvalidPositionIndex();
        Position storage pos = userPositions[user][positionIndex];
        if (pos.closed) revert PositionClosed();
        return pos;
    }

    function _lifetimeAccruedReward(
        Position storage pos
    ) internal view returns (uint256) {
        if (pos.closed) {
            return pos.claimedRewards;
        }
        if (pos.amount == 0) return 0;
        uint256 elapsed = block.timestamp - pos.stakeStart;
        return
            Math.mulDiv(
                Math.mulDiv(pos.amount, pos.aprBps, BPS_DENOM),
                elapsed,
                SECONDS_PER_YEAR
            );
    }

    function _pendingRewards(
        Position storage pos
    ) internal view returns (uint256) {
        uint256 life = _lifetimeAccruedReward(pos);
        uint256 claimed = pos.claimedRewards;
        if (life <= claimed) return 0;
        unchecked {
            return life - claimed;
        }
    }

    function getPlan(uint256 planId) external view returns (Plan memory) {
        if (planId >= planCount) revert InvalidPlan();
        return plans[planId];
    }

    function getUserPositionCount(
        address user
    ) external view returns (uint256) {
        return userPositions[user].length;
    }

    function getUserPosition(
        address user,
        uint256 positionIndex
    ) external view returns (Position memory) {
        if (positionIndex >= userPositions[user].length)
            revert InvalidPositionIndex();
        return userPositions[user][positionIndex];
    }

    function pendingRewards(
        address user,
        uint256 positionIndex
    ) external view returns (uint256) {
        if (positionIndex >= userPositions[user].length)
            revert InvalidPositionIndex();
        Position storage pos = userPositions[user][positionIndex];
        if (pos.closed) return 0;
        return _pendingRewards(pos);
    }

    function totalAccruedRewards(
        address user,
        uint256 positionIndex
    ) external view returns (uint256) {
        if (positionIndex >= userPositions[user].length)
            revert InvalidPositionIndex();
        return _lifetimeAccruedReward(userPositions[user][positionIndex]);
    }

    function isPositionClosed(
        address user,
        uint256 positionIndex
    ) external view returns (bool) {
        if (positionIndex >= userPositions[user].length)
            revert InvalidPositionIndex();
        return userPositions[user][positionIndex].closed;
    }

    function positionLockEnd(
        address user,
        uint256 positionIndex
    ) external view returns (uint256) {
        if (positionIndex >= userPositions[user].length)
            revert InvalidPositionIndex();
        Position storage pos = userPositions[user][positionIndex];
        return pos.stakeStart + pos.lockDuration;
    }

    function isPositionLocked(
        address user,
        uint256 positionIndex
    ) external view returns (bool) {
        if (positionIndex >= userPositions[user].length)
            revert InvalidPositionIndex();
        Position storage pos = userPositions[user][positionIndex];
        if (pos.closed) return false;
        return block.timestamp < pos.stakeStart + pos.lockDuration;
    }

    function secondsUntilUnlock(
        address user,
        uint256 positionIndex
    ) external view returns (uint256) {
        if (positionIndex >= userPositions[user].length)
            revert InvalidPositionIndex();
        Position storage pos = userPositions[user][positionIndex];
        if (pos.closed) return 0;
        uint256 endTime = pos.stakeStart + pos.lockDuration;
        if (block.timestamp >= endTime) return 0;
        unchecked {
            return endTime - block.timestamp;
        }
    }

    function stakingDurationElapsed(
        address user,
        uint256 positionIndex
    ) external view returns (uint256) {
        if (positionIndex >= userPositions[user].length)
            revert InvalidPositionIndex();
        Position storage pos = userPositions[user][positionIndex];
        if (pos.closed) return 0;
        unchecked {
            return block.timestamp - pos.stakeStart;
        }
    }

    function previewUnstakeReward(
        address user,
        uint256 positionIndex
    ) external view returns (uint256 rewardPaid, bool early) {
        if (positionIndex >= userPositions[user].length)
            revert InvalidPositionIndex();
        Position storage pos = userPositions[user][positionIndex];
        if (pos.closed) return (0, false);
        uint256 pending = _pendingRewards(pos);
        early = block.timestamp < pos.stakeStart + pos.lockDuration;
        rewardPaid = pending;
        if (early && earlyUnstakePenaltyBps > 0 && pending > 0) {
            uint256 penalty = Math.mulDiv(
                pending,
                earlyUnstakePenaltyBps,
                BPS_DENOM
            );
            rewardPaid = pending - penalty;
        }
    }

    function previewClaimableRewards(
        address user,
        uint256 positionIndex
    ) external view returns (uint256) {
        if (positionIndex >= userPositions[user].length)
            revert InvalidPositionIndex();
        Position storage pos = userPositions[user][positionIndex];
        if (pos.closed) return 0;
        return _pendingRewards(pos);
    }

    function claimedRewardsOf(
        address user,
        uint256 positionIndex
    ) external view returns (uint256) {
        if (positionIndex >= userPositions[user].length)
            revert InvalidPositionIndex();
        return userPositions[user][positionIndex].claimedRewards;
    }

    function positionPrincipal(
        address user,
        uint256 positionIndex
    ) external view returns (uint256) {
        if (positionIndex >= userPositions[user].length)
            revert InvalidPositionIndex();
        return userPositions[user][positionIndex].amount;
    }

    function positionAprBps(
        address user,
        uint256 positionIndex
    ) external view returns (uint256) {
        if (positionIndex >= userPositions[user].length)
            revert InvalidPositionIndex();
        return userPositions[user][positionIndex].aprBps;
    }

    function positionLockDuration(
        address user,
        uint256 positionIndex
    ) external view returns (uint256) {
        if (positionIndex >= userPositions[user].length)
            revert InvalidPositionIndex();
        return userPositions[user][positionIndex].lockDuration;
    }

    function positionStakeStart(
        address user,
        uint256 positionIndex
    ) external view returns (uint256) {
        if (positionIndex >= userPositions[user].length)
            revert InvalidPositionIndex();
        return userPositions[user][positionIndex].stakeStart;
    }

    function isPlanActive(uint256 planId) external view returns (bool) {
        if (planId >= planCount) revert InvalidPlan();
        return plans[planId].active;
    }

    function contractTokenBalance() external view returns (uint256) {
        return stakingToken.balanceOf(address(this));
    }

    function totalOpenPrincipal(
        address user
    ) external view returns (uint256 sum) {
        Position[] storage arr = userPositions[user];
        uint256 n = arr.length;
        for (uint256 i; i < n; ) {
            if (!arr[i].closed) sum += arr[i].amount;
            unchecked {
                ++i;
            }
        }
    }
}
