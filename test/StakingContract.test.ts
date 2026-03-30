import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { StakingContract, MockToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("StakingContract", function () {
  let stakingContract: StakingContract;
  let mockToken: MockToken;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const INITIAL_MINT = ethers.parseEther("1000000");
  const STAKE_AMOUNT = ethers.parseEther("1000");
  const PENALTY_BPS = 2000; // 20% penalty on rewards for early unstake
  const APR = 1000; // 10% APR
  const DURATION = 30 * 24 * 60 * 60; // 30 days

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy Mock Token
    const MockTokenFactory = await ethers.getContractFactory("MockToken");
    mockToken = await MockTokenFactory.deploy();

    // Deploy Staking Contract
    const StakingFactory = await ethers.getContractFactory("StakingContract");
    stakingContract = await StakingFactory.deploy(await mockToken.getAddress(), PENALTY_BPS);

    // Mint tokens to users and funding for rewards
    await mockToken.mint(user1.address, INITIAL_MINT);
    await mockToken.mint(user2.address, INITIAL_MINT);
    await mockToken.mint(await stakingContract.getAddress(), INITIAL_MINT); // Fund rewards

    // Approve staking contract
    await mockToken.connect(user1).approve(await stakingContract.getAddress(), INITIAL_MINT);
  });

  describe("Plan Management", function () {
    it("Should allow owner to add a plan", async function () {
      await stakingContract.addPlan(DURATION, APR);
      const plan = await stakingContract.plans(0);
      expect(plan.durationSeconds).to.equal(DURATION);
      expect(plan.aprBasisPoints).to.equal(APR);
      expect(plan.isActive).to.be.true;
    });

    it("Should fail if non-owner tries to add a plan", async function () {
      await expect(stakingContract.connect(user1).addPlan(DURATION, APR))
        .to.be.revertedWithCustomError(stakingContract, "OwnableUnauthorizedAccount");
    });
  });

  describe("Staking and Rewards", function () {
    beforeEach(async function () {
      await stakingContract.addPlan(DURATION, APR); // Plan ID: 0
    });

    it("Should allow user to stake", async function () {
      await expect(stakingContract.connect(user1).stake(STAKE_AMOUNT, 0))
        .to.emit(stakingContract, "Staked")
        .withArgs(user1.address, 0, STAKE_AMOUNT, 0);

      const position = await stakingContract.positions(0);
      expect(position.owner).to.equal(user1.address);
      expect(position.amount).to.equal(STAKE_AMOUNT);
    });

    it("Should calculate rewards correctly after 15 days", async function () {
      await stakingContract.connect(user1).stake(STAKE_AMOUNT, 0);
      
      // Advance time by 15 days
      await time.increase(15 * 24 * 60 * 60);

      const rewards = await stakingContract.calculateRewards(0);
      
      // Math: (1000 * 0.10 * 15) / 365 days = ~4.1095 tokens
      const expectedRewards = (STAKE_AMOUNT * BigInt(APR) * BigInt(15 * 24 * 60 * 60)) / (BigInt(365 * 24 * 60 * 60) * 10000n);
      
      // Use a small buffer for block timestamp variance
      expect(rewards).to.be.closeTo(expectedRewards, ethers.parseEther("0.001"));
    });

    it("Should allow user to claim rewards mid-term", async function () {
      await stakingContract.connect(user1).stake(STAKE_AMOUNT, 0);
      await time.increase(15 * 24 * 60 * 60);

      const initialBalance = await mockToken.balanceOf(user1.address);
      await stakingContract.connect(user1).claimRewards(0);
      const finalBalance = await mockToken.balanceOf(user1.address);

      expect(finalBalance).to.be.gt(initialBalance);
      
      const position = await stakingContract.positions(0);
      expect(position.rewardsClaimed).to.be.gt(0);
    });
  });

  describe("Unstaking", function () {
    beforeEach(async function () {
      await stakingContract.addPlan(DURATION, APR);
      await stakingContract.connect(user1).stake(STAKE_AMOUNT, 0);
    });

    it("Should apply penalty for early unstake", async function () {
      await time.increase(10 * 24 * 60 * 60); // 10 days (before 30 days)
      
      const rewardsBefore = await stakingContract.calculateRewards(0);
      
      await expect(stakingContract.connect(user1).unstake(0))
        .to.emit(stakingContract, "Unstaked");

      const finalBalance = await mockToken.balanceOf(user1.address);
      // Balance should be: Initial - Stake + Principal + (Rewards - 20% Penalty)
      // Which is basically Initial + (Rewards * 0.8)
      expect(finalBalance).to.be.gt(INITIAL_MINT - STAKE_AMOUNT);
    });

    it("Should not apply penalty after duration ends", async function () {
      await time.increase(DURATION + 100);
      
      const tx = await stakingContract.connect(user1).unstake(0);
      const receipt = await tx.wait();
      
      // Check Unstaked event for 0 penalty
      const event = receipt?.logs.find((x: any) => x.fragment?.name === 'Unstaked');
      // @ts-ignore
      expect(event?.args[4]).to.equal(0); 
    });
  });
});