const { ethers } = require("hardhat");

async function main() {
  console.log("=== Testing Correct Insurance Purchase ===");
  
  const [admin, customer] = await ethers.getSigners();
  const contractAddress = "0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1";
  const contract = await ethers.getContractAt("Paramify", contractAddress);
  
  console.log("Customer address:", customer.address);
  
  // Test buying insurance with correct parameters
  const payoutRatePerMinute = "2"; // 2 ETH per minute
  const payoutRateInWei = ethers.parseEther(payoutRatePerMinute);
  const premiumInWei = ethers.parseEther((parseFloat(payoutRatePerMinute) * 2).toString()); // 4 ETH premium
  
  console.log("Payout rate per minute:", payoutRatePerMinute, "ETH");
  console.log("Payout rate in wei:", payoutRateInWei.toString());
  console.log("Premium:", ethers.formatEther(premiumInWei), "ETH");
  
  try {
    // Check if customer already has a policy
    const existingPolicy = await contract.policies(customer.address);
    if (existingPolicy.active) {
      console.log("Customer already has active policy");
      return;
    }
    
    if (existingPolicy.paidOut) {
      console.log("Customer had a policy that was already paid out");
      console.log("For testing, let's use account 2");
      
      // Use account 2 instead
      const testCustomer = await ethers.getSigner("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC");
      console.log("Using test customer:", testCustomer.address);
      
      // Check balance
      const balance = await ethers.provider.getBalance(testCustomer.address);
      console.log("Customer balance:", ethers.formatEther(balance), "ETH");
      
      if (balance < premiumInWei) {
        console.log("❌ Insufficient balance for premium");
        return;
      }
      
      // Buy insurance
      console.log("Buying insurance...");
      const tx = await contract.connect(testCustomer).buyInsurance(payoutRateInWei, { value: premiumInWei });
      await tx.wait();
      console.log("✅ Insurance purchased successfully!");
      
      // Check the policy
      const newPolicy = await contract.policies(testCustomer.address);
      console.log("New Policy:");
      console.log("- Active:", newPolicy.active);
      console.log("- Premium (ETH):", ethers.formatEther(newPolicy.premium));
      console.log("- PayoutRatePerSecond (wei):", newPolicy.payoutRatePerSecond.toString());
      console.log("- PayoutRatePerSecond (ETH):", ethers.formatEther(newPolicy.payoutRatePerSecond));
      
      if (newPolicy.payoutRatePerSecond > 0) {
        console.log("✅ Payout rate is correctly set!");
        
        // Test payout
        const outageDuration = await contract.getLatestPrice();
        console.log("Current outage duration:", outageDuration.toString(), "seconds");
        
        if (outageDuration > 0) {
          console.log("Triggering payout...");
          const payoutTx = await contract.connect(testCustomer).triggerPayout();
          await payoutTx.wait();
          console.log("✅ Payout completed!");
          
          // Check final balances
          const finalBalance = await ethers.provider.getBalance(testCustomer.address);
          console.log("Customer final balance:", ethers.formatEther(finalBalance), "ETH");
        } else {
          console.log("No outage recorded, cannot trigger payout");
        }
      } else {
        console.log("❌ Payout rate is still 0 - there's still an issue");
      }
    }
    
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