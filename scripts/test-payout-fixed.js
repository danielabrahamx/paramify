const { ethers } = require("hardhat");

async function main() {
  console.log("=== Testing Payout with Fixed Contract ===");
  
  const [admin, customer] = await ethers.getSigners();
  const contractAddress = "0x7a2088a1bFc9d81c55368AE168C2C02570cB814F";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  console.log("Customer address:", customer.address);
  
  // Check policy
  const policy = await contract.policies(customer.address);
  console.log("Policy active:", policy.active);
  console.log("Policy paid out:", policy.paidOut);
  console.log("Payout rate per second (wei):", policy.payoutRatePerSecond.toString());
  console.log("Payout rate per second (ETH):", ethers.formatEther(policy.payoutRatePerSecond));
  
  if (!policy.active || policy.paidOut) {
    console.log("Policy is not active or already paid out");
    return;
  }
  
  // Check oracle
  const outageDuration = await contract.getLatestPrice();
  console.log("Outage duration:", outageDuration.toString(), "seconds");
  
  // Calculate expected payout
  const expectedPayout = BigInt(outageDuration) * policy.payoutRatePerSecond;
  console.log("Expected payout (wei):", expectedPayout.toString());
  console.log("Expected payout (ETH):", ethers.formatEther(expectedPayout));
  
  // Check contract balance
  const contractBalance = await contract.getContractBalance();
  console.log("Contract balance (ETH):", ethers.formatEther(contractBalance));
  
  if (expectedPayout > contractBalance) {
    console.log("❌ Insufficient contract balance for payout");
    return;
  }
  
  // Get customer balance before payout
  const balanceBefore = await ethers.provider.getBalance(customer.address);
  console.log("Customer balance before payout (ETH):", ethers.formatEther(balanceBefore));
  
  // Trigger payout
  console.log("\n=== Triggering Payout ===");
  const payoutTx = await contract.connect(customer).triggerPayout();
  const receipt = await payoutTx.wait();
  console.log("✅ Payout transaction successful!");
  
  // Get customer balance after payout
  const balanceAfter = await ethers.provider.getBalance(customer.address);
  console.log("Customer balance after payout (ETH):", ethers.formatEther(balanceAfter));
  
  // Calculate net received (accounting for gas)
  const gasUsed = receipt.gasUsed * receipt.gasPrice;
  const netReceived = balanceAfter - balanceBefore + gasUsed;
  console.log("Gas used (ETH):", ethers.formatEther(gasUsed));
  console.log("Net payout received (ETH):", ethers.formatEther(netReceived));
  
  // Check events
  const events = receipt.logs.filter(log => {
    try {
      return contract.interface.parseLog(log) !== null;
    } catch {
      return false;
    }
  });
  
  console.log("\n=== Events ===");
  events.forEach(log => {
    const parsed = contract.interface.parseLog(log);
    if (parsed.name === "PayoutTriggered") {
      console.log("PayoutTriggered event:");
      console.log("- Customer:", parsed.args.customer);
      console.log("- Amount (ETH):", ethers.formatEther(parsed.args.amount));
    }
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });