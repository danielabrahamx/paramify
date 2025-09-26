const { ethers } = require("hardhat");

async function main() {
  console.log("=== Creating Fresh Active Policy for Testing ===");
  
  const contractAddress = "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  // Use Account 4 which has no policy
  const [admin, acc1, acc2, acc3, testCustomer] = await ethers.getSigners();
  console.log("Creating policy for:", testCustomer.address);
  
  // Create insurance with 2 ETH per minute payout rate
  const payoutRatePerMinute = ethers.parseEther("2"); // 2 ETH per minute
  const premium = ethers.parseEther("4"); // 4 ETH premium
  
  console.log("Policy Parameters:");
  console.log("- Payout Rate: 2 ETH per minute");
  console.log("- Premium: 4 ETH");
  console.log("- Expected Payout Rate/Second:", ethers.formatEther(payoutRatePerMinute / 60n), "ETH");
  
  try {
    const tx = await contract.connect(testCustomer).buyInsurance(payoutRatePerMinute, { 
      value: premium 
    });
    await tx.wait();
    
    console.log("✅ Policy created successfully!");
    
    // Verify policy
    const policy = await contract.policies(testCustomer.address);
    console.log("\nPolicy Details:");
    console.log("- Active:", policy.active);
    console.log("- Premium:", ethers.formatEther(policy.premium), "ETH");
    console.log("- PayoutRatePerSecond:", ethers.formatEther(policy.payoutRatePerSecond), "ETH/sec");
    
    // Calculate expected payout
    const oracleValue = await contract.getLatestPrice();
    const expectedPayout = BigInt(oracleValue) * policy.payoutRatePerSecond;
    
    console.log("\nPayout Calculation:");
    console.log("- Oracle Value:", oracleValue.toString(), "seconds");
    console.log("- Expected Payout:", ethers.formatEther(expectedPayout), "ETH");
    
    console.log("\n🎯 READY FOR TESTING!");
    console.log("Use this account in MetaMask:");
    console.log("Address:", testCustomer.address);
    console.log("Private Key: 0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a");
    console.log("Expected payout:", ethers.formatEther(expectedPayout), "ETH");
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });