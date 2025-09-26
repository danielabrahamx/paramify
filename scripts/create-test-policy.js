const { ethers } = require("hardhat");

async function main() {
  console.log("=== Creating Fresh Policy for Testing ===");
  
  const contractAddress = "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  // Use the customer address from README
  const customerAddress = "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199";
  const customer = await ethers.getImpersonatedSigner(customerAddress);
  
  console.log("Customer address:", customerAddress);
  
  // Check current balance
  const balance = await ethers.provider.getBalance(customerAddress);
  console.log("Customer balance:", ethers.formatEther(balance), "ETH");
  
  // Create a policy: 2 ETH per minute payout rate
  const payoutRatePerMinute = ethers.parseEther("2"); // 2 ETH per minute
  const premium = ethers.parseEther("4"); // Premium = rate * 2
  
  console.log("Creating policy...");
  console.log("- Payout rate per minute: 2 ETH");
  console.log("- Premium: 4 ETH");
  
  try {
    const tx = await contract.connect(customer).buyInsurance(payoutRatePerMinute, { value: premium });
    await tx.wait();
    console.log("✅ Policy created successfully!");
    
    // Check the policy
    const policy = await contract.policies(customerAddress);
    console.log("\nPolicy details:");
    console.log("- Active:", policy.active);
    console.log("- Premium (ETH):", ethers.formatEther(policy.premium));
    console.log("- PayoutRatePerSecond (wei):", policy.payoutRatePerSecond.toString());
    console.log("- PayoutRatePerSecond (ETH):", ethers.formatEther(policy.payoutRatePerSecond));
    
    // Check current oracle value
    const oracleValue = await contract.getLatestPrice();
    console.log("\nCurrent oracle value:", oracleValue.toString(), "seconds");
    
    if (oracleValue > 0) {
      const expectedPayout = BigInt(oracleValue) * policy.payoutRatePerSecond;
      console.log("Expected payout (ETH):", ethers.formatEther(expectedPayout));
      
      console.log("\n✅ Policy is ready for payout testing!");
      console.log("You can now use this address in MetaMask:", customerAddress);
      console.log("Private key for this address: 0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e");
    } else {
      console.log("⚠️ No outage duration set. Use the admin dashboard to set an outage duration first.");
    }
    
  } catch (error) {
    console.error("Error creating policy:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });