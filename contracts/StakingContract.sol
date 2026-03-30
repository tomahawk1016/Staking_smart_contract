// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract StakingContract is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Plan {
        uint256 durationSeconds;
        uint256 aprBasisPoints; // 100 = 1%, 10000 = 100%
        bool isActive;
    }

    struct Position {
        address owner;
        uint256 amount;
        uint256 startTime;
        uint256 planId;
        uint256 rewardsClaimed;
        bool isWithdrawn;
    }

    IERC20 public immutable stakingToken;
    uint256 public nextPlanId;
    uint256 public nextPositionId;
    uint256 public earlyUnstakePenaltyBps; // Penalty on rewards only
    uint256 public constant YEAR = 365 days;
    uint256 public constant MAX_BPS = 10000;

    mapping(uint256 => Plan) public plans;
    mapping(uint256 => Position) public positions;
    mapping(address => uint256[]) public userPositions;

    event Staked(address indexed user, uint256 positionId, uint256 amount, uint256 planId);
    event RewardsClaimed(address indexed user, uint256 positionId, uint256 amount);
    event Unstaked(address indexed user, uint256 positionId, uint256 principal, uint256 rewards, uint256 penalty);
    event PlanAdded(uint256 planId, uint256 duration, uint256 apr);
    event PlanToggled(uint256 planId, bool isActive);
    event PenaltyUpdated(uint256 oldPenalty, uint256 newPenalty);

    constructor(address _token, uint256 _penaltyBps) Ownable(msg.sender) {
        stakingToken = IERC20(_token);
        earlyUnstakePenaltyBps = _penaltyBps;
    }

    function addPlan(uint256 _duration, uint256 _apr) external onlyOwner {
        plans[nextPlanId] = Plan(_duration, _apr, true);
        emit PlanAdded(nextPlanId, _duration, _apr);
        nextPlanId++;
    }

    function togglePlan(uint256 _planId, bool _isActive) external onlyOwner {
        require(_planId < nextPlanId, "Invalid plan");
        plans[_planId].isActive = _isActive;
        emit PlanToggled(_planId, _isActive);
    }

    function setEarlyUnstakePenalty(uint256 _penaltyBps) external onlyOwner {
        require(_penaltyBps <= MAX_BPS, "Invalid BPS");
        uint256 old = earlyUnstakePenaltyBps;
        earlyUnstakePenaltyBps = _penaltyBps;
        emit PenaltyUpdated(old, _penaltyBps);
    }

    function stake(uint256 _amount, uint256 _planId) external nonReentrant {
        require(_amount > 0, "Amount zero");
        require(_planId < nextPlanId, "Invalid plan");
        require(plans[_planId].isActive, "Plan inactive");

        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);

        positions[nextPositionId] = Position({
            owner: msg.sender,
            amount: _amount,
            startTime: block.timestamp,
            planId: _planId,
            rewardsClaimed: 0,
            isWithdrawn: false
        });

        userPositions[msg.sender].push(nextPositionId);
        emit Staked(msg.sender, nextPositionId, _amount, _planId);
        nextPositionId++;
    }

    function calculateRewards(uint256 _positionId) public view returns (uint256) {
        Position storage pos = positions[_positionId];
        Plan storage plan = plans[pos.planId];
        
        uint256 duration = block.timestamp - pos.startTime;
        uint256 totalReward = (pos.amount * plan.aprBasisPoints * duration) / (YEAR * MAX_BPS);
        
        return totalReward > pos.rewardsClaimed ? totalReward - pos.rewardsClaimed : 0;
    }

    function claimRewards(uint256 _positionId) public nonReentrant {
        Position storage pos = positions[_positionId];
        require(pos.owner == msg.sender, "Not owner");
        require(!pos.isWithdrawn, "Already withdrawn");

        uint256 reward = calculateRewards(_positionId);
        require(reward > 0, "No rewards");

        pos.rewardsClaimed += reward;
        stakingToken.safeTransfer(msg.sender, reward);
        
        emit RewardsClaimed(msg.sender, _positionId, reward);
    }

    function unstake(uint256 _positionId) external nonReentrant {
        Position storage pos = positions[_positionId];
        Plan storage plan = plans[pos.planId];
        require(pos.owner == msg.sender, "Not owner");
        require(!pos.isWithdrawn, "Already withdrawn");

        uint256 reward = calculateRewards(_positionId);
        uint256 penalty = 0;

        if (block.timestamp < pos.startTime + plan.durationSeconds) {
            penalty = (reward * earlyUnstakePenaltyBps) / MAX_BPS;
            reward -= penalty;
        }

        uint256 totalToTransfer = pos.amount + reward;
        pos.isWithdrawn = true;
        
        stakingToken.safeTransfer(msg.sender, totalToTransfer);
        
        emit Unstaked(msg.sender, _positionId, pos.amount, reward, penalty);
    }

    function getUserPositions(address _user) external view returns (uint256[] memory) {
        return userPositions[_user];
    }
}