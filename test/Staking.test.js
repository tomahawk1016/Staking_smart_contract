const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Staking Smart Contract", function () {
  const YEAR = 365n * 24n * 60n * 60n;
  const BPS = 10_000n;

  async function deployFixture() {
    const [owner, alice, bob] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockERC20");
    const token = await Token.deploy("Stake Token", "STK", ethers.parseEther("1000000"));
    await token.waitForDeployment();

    const Staking = await ethers.getContractFactory("Staking");
    const staking = await Staking.deploy(await token.getAddress(), owner.address);
    await staking.waitForDeployment();

    await token.transfer(alice.address, ethers.parseEther("100000"));
    await token.transfer(bob.address, ethers.parseEther("100000"));
    await token.connect(alice).approve(await staking.getAddress(), ethers.MaxUint256);
    await token.connect(bob).approve(await staking.getAddress(), ethers.MaxUint256);

    await token.transfer(await staking.getAddress(), ethers.parseEther("500000"));

    return { token, staking, owner, alice, bob };
  }

  function expectedReward(amount, aprBps, elapsed) {
    return (amount * aprBps * elapsed) / (BPS * YEAR);
  }

  it("add plans and updatedPlan changes template for new stakes only", async function () {
    const { staking, alice, token } = await deployFixture();
    await staking.addedPlan(30 * 24 * 3600, 800);
    await staking.addedPlan(90 * 24 * 3600, 1200);

    const p0 = await staking.getPlan(0n);
    expect(p0.lockDuration).to.equal(30n * 24n * 3600n);
    expect(p0.aprBps).to.equal(800n);

    await staking.updatedPlan(0n, 60 * 24 * 3600, 900n);
    const p0b = await staking.getPlan(0n);
    expect(p0b.lockDuration).to.equal(60n * 24n * 3600n);
    expect(p0b.aprBps).to.equal(900n);

    const amt = ethers.parseEther("1000");
    await staking.connect(alice).stake(0n, amt);
    const pos = await staking.getUserPosition(alice.address, 0n);
    expect(pos.lockDuration).to.equal(60n * 24n * 3600n);
    expect(pos.aprBps).to.equal(900n);
    expect(pos.amount).to.equal(amt);
    expect(await token.balanceOf(await staking.getAddress())).to.be.gt(0n);
  });

  it("accrues rewards by formula and allows claim without unstaking", async function () {
    const { staking, alice, token } = await deployFixture();
    await staking.addedPlan(30 * 24 * 3600, 800); // 8% APR
    const amt = ethers.parseEther("1000");
    await staking.connect(alice).stake(0n, amt);

    const halfYear = YEAR / 2n;
    await ethers.provider.send("evm_increaseTime", [Number(halfYear)]);
    await ethers.provider.send("evm_mine");

    const pending = await staking.pendingRewards(alice.address, 0n);
    const expected = expectedReward(amt, 800n, halfYear);
    expect(pending).to.be.closeTo(expected, ethers.parseEther("0.001"));

    const before = await token.balanceOf(alice.address);
    await staking.connect(alice).claimRewards(0n);
    const after = await token.balanceOf(alice.address);
    expect(after - before).to.be.closeTo(pending, ethers.parseEther("0.01"));
    expect(await staking.pendingRewards(alice.address, 0n)).to.equal(0n);
  });

  it("unstake after lock pays principal + pending rewards without penalty", async function () {
    const { staking, alice, token } = await deployFixture();
    await staking.setEarlyUnstakePenaltyBps(5000);
    await staking.addedPlan(7 * 24 * 3600, 1000);
    const amt = ethers.parseEther("500");
    await staking.connect(alice).stake(0n, amt);

    await ethers.provider.send("evm_increaseTime", [8 * 24 * 3600]);
    await ethers.provider.send("evm_mine");

    const pending = await staking.pendingRewards(alice.address, 0n);
    const before = await token.balanceOf(alice.address);
    await staking.connect(alice).unstake(0n);
    const paid = (await token.balanceOf(alice.address)) - before;
    expect(paid).to.be.closeTo(amt + pending, ethers.parseEther("0.01"));
    expect(await staking.isPositionClosed(alice.address, 0n)).to.equal(true);
  });

  it("early unstake applies penalty on rewards only; principal returned in full", async function () {
    const { staking, alice, token } = await deployFixture();
    await staking.setEarlyUnstakePenaltyBps(5000); // 50% of rewards
    await staking.addedPlan(30 * 24 * 3600, 1200);
    const amt = ethers.parseEther("2000");
    await staking.connect(alice).stake(0n, amt);

    const elapsed = 10n * 24n * 3600n;
    await ethers.provider.send("evm_increaseTime", [Number(elapsed)]);
    await ethers.provider.send("evm_mine");

    const pending = await staking.pendingRewards(alice.address, 0n);
    expect(await staking.isPositionLocked(alice.address, 0n)).to.equal(true);

    const [previewReward, early] = await staking.previewUnstakeReward(alice.address, 0n);
    expect(early).to.equal(true);
    const penalty = (pending * 5000n) / BPS;
    expect(previewReward).to.equal(pending - penalty);

    const before = await token.balanceOf(alice.address);
    await staking.connect(alice).unstake(0n);
    const gain = (await token.balanceOf(alice.address)) - before;
    expect(gain).to.be.closeTo(amt + previewReward, ethers.parseEther("0.01"));
  });

  it("supports multiple positions per user in different plans", async function () {
    const { staking, alice } = await deployFixture();
    await staking.addedPlan(10 * 24 * 3600, 500);
    await staking.addedPlan(20 * 24 * 3600, 1000);

    await staking.connect(alice).stake(0n, ethers.parseEther("100"));
    await staking.connect(alice).stake(1n, ethers.parseEther("200"));

    expect(await staking.getUserPositionCount(alice.address)).to.equal(2n);
    const p0 = await staking.getUserPosition(alice.address, 0n);
    const p1 = await staking.getUserPosition(alice.address, 1n);
    expect(p0.aprBps).to.equal(500n);
    expect(p1.aprBps).to.equal(1000n);
  });

  it("reverts on invalid plan, inactive plan, zero stake", async function () {
    const { staking, alice } = await deployFixture();
    await staking.addedPlan(1, 100);
    await staking.activedPlan(0n, false);
    await expect(staking.connect(alice).stake(0n, 1)).to.be.revertedWithCustomError(staking, "PlanInactive");
    await expect(staking.connect(alice).stake(99n, 1)).to.be.revertedWithCustomError(staking, "InvalidPlan");
    await expect(staking.connect(alice).stake(0n, 0)).to.be.revertedWithCustomError(staking, "ZeroAmount");
  });
});
