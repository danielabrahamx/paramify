const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Paramify Power Outage Insurance", function () {
  let Paramify, paramify, MockPriceFeed, mockPriceFeed, owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock price feed with initial outage duration of 0
    MockPriceFeed = await ethers.getContractFactory("MockV3Aggregator");
    mockPriceFeed = await MockPriceFeed.deploy(8, 0); // 0 seconds initial outage
    await mockPriceFeed.waitForDeployment();

    // Deploy Paramify
    const priceFeedAddress = await mockPriceFeed.getAddress();
    Paramify = await ethers.getContractFactory("Paramify");
    paramify = await Paramify.deploy(priceFeedAddress);
    await paramify.waitForDeployment();
  });

  it("should assign roles correctly", async function () {
    expect(await paramify.hasRole(await paramify.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
    expect(await paramify.hasRole(await paramify.ORACLE_UPDATER_ROLE(), owner.address)).to.be.true;
    expect(await paramify.hasRole(await paramify.INSURANCE_ADMIN_ROLE(), owner.address)).to.be.true;
  });

  it("should fetch latest outage duration", async function () {
    const duration = await paramify.getLatestOutageDuration();
    expect(duration).to.equal(0);
  });

  it("should allow users to buy insurance with payout rate per minute", async function () {
    const payoutRatePerMinute = ethers.parseEther("120"); // £120 per minute
    const requiredPremium = payoutRatePerMinute * 2n; // Monthly premium = rate * 2

    // Buy insurance
    await paramify.connect(user1).buyInsurance(payoutRatePerMinute, { value: requiredPremium });

    // Check policy was created correctly
    const policy = await paramify.policies(user1.address);
    expect(policy.customer).to.equal(user1.address);
    expect(policy.payoutRatePerSecond).to.equal(payoutRatePerMinute / 60n); // Should be rate/60 per second
    expect(policy.active).to.be.true;
    expect(policy.paidOut).to.be.false;
  });

  it("should reject insurance purchase with insufficient premium", async function () {
    const payoutRatePerMinute = ethers.parseEther("120");
    const insufficientPremium = payoutRatePerMinute; // Less than required 2x rate

    await expect(
      paramify.connect(user1).buyInsurance(payoutRatePerMinute, { value: insufficientPremium })
    ).to.be.revertedWith("Insufficient premium");
  });

  it("should reject duplicate insurance policies", async function () {
    const payoutRatePerMinute = ethers.parseEther("120");
    const requiredPremium = payoutRatePerMinute * 2n;

    // First purchase should succeed
    await paramify.connect(user1).buyInsurance(payoutRatePerMinute, { value: requiredPremium });

    // Second purchase should fail
    await expect(
      paramify.connect(user1).buyInsurance(payoutRatePerMinute, { value: requiredPremium })
    ).to.be.revertedWith("Policy already active");
  });

  it("should check payout eligibility correctly", async function () {
    const payoutRatePerMinute = ethers.parseEther("120");
    const requiredPremium = payoutRatePerMinute * 2n;

    // Initially not eligible (no outage)
    expect(await paramify.isPayoutEligible(user1.address)).to.be.false;

    // Buy insurance
    await paramify.connect(user1).buyInsurance(payoutRatePerMinute, { value: requiredPremium });

    // Still not eligible (no outage recorded)
    expect(await paramify.isPayoutEligible(user1.address)).to.be.false;
  });

  it("should allow triggering payout when outage is recorded", async function () {
    const payoutRatePerMinute = ethers.parseEther("120");
    const requiredPremium = payoutRatePerMinute * 2n;
    const outageDuration = 300; // 5 minutes = 300 seconds

    // Buy insurance
    await paramify.connect(user1).buyInsurance(payoutRatePerMinute, { value: requiredPremium });

    // Fund the contract with enough ETH for payout
    const expectedPayout = BigInt(outageDuration) * (payoutRatePerMinute / 60n);
    await owner.sendTransaction({
      to: await paramify.getAddress(),
      value: expectedPayout
    });

    // Update oracle with outage duration
    await mockPriceFeed.updateAnswer(outageDuration);

    // Verify user is eligible for payout
    expect(await paramify.isPayoutEligible(user1.address)).to.be.true;

    // Trigger payout
    const initialBalance = await ethers.provider.getBalance(user1.address);
    await paramify.connect(user1).triggerPayout();

    // Check policy was marked as paid out
    const policy = await paramify.policies(user1.address);
    expect(policy.paidOut).to.be.true;
    expect(policy.active).to.be.false;

    // Check user received payout (300 seconds * £120/60 per second = £600)
    const finalBalance = await ethers.provider.getBalance(user1.address);
    const actualPayout = finalBalance - initialBalance;
    expect(actualPayout).to.be.closeTo(expectedPayout, ethers.parseEther("0.001")); // Allow small tolerance
  });

  it("should reject payout when no outage is recorded", async function () {
    const payoutRatePerMinute = ethers.parseEther("120");
    const requiredPremium = payoutRatePerMinute * 2n;

    // Buy insurance
    await paramify.connect(user1).buyInsurance(payoutRatePerMinute, { value: requiredPremium });

    // No outage recorded, so should not be eligible
    expect(await paramify.isPayoutEligible(user1.address)).to.be.false;

    // Triggering payout should fail
    await expect(paramify.connect(user1).triggerPayout()).to.be.revertedWith("No outage recorded");
  });

  it("should calculate correct payout amounts", async function () {
    const payoutRatePerMinute = ethers.parseEther("240"); // £240 per minute
    const requiredPremium = payoutRatePerMinute * 2n;
    const outageDuration = 600; // 10 minutes = 600 seconds

    // Buy insurance
    await paramify.connect(user1).buyInsurance(payoutRatePerMinute, { value: requiredPremium });

    // Fund the contract with enough ETH for payout
    const expectedPayout = BigInt(outageDuration) * (payoutRatePerMinute / 60n);
    await owner.sendTransaction({
      to: await paramify.getAddress(),
      value: expectedPayout
    });

    // Update oracle with outage duration
    await mockPriceFeed.updateAnswer(outageDuration);

    // Trigger payout and check amount
    await expect(paramify.connect(user1).triggerPayout())
      .to.emit(paramify, "PayoutTriggered")
      .withArgs(user1.address, expectedPayout);
  });
});
