
async function getPolicyDetails(policyId) {
  const agent = new HttpAgent({ host: ICP_HOST });
  await agent.fetchRootKey();
  const actor = Actor.createActor(idl, { agent, canisterId: CANISTER_ID });

  try {
    console.log(`\n🔍 Fetching details for Policy ID: ${policyId}`);
    const policy = await actor.get_policy(policyId);
    if (policy.length > 0) {
      console.log('✅ Policy Details:', policy[0]);
    } else {
      console.log('❌ Policy not found');
    }
  } catch (error) {
    console.error('Error fetching policy:', error);
  }
}

// Uncomment to test with your policy ID 1
// getPolicyDetails(1);

async function buyInsurance(coverageAmount) {
  const premium = coverageAmount / 10n; // Auto-calculate 10%
  const agent = new HttpAgent({ host: ICP_HOST });
  await agent.fetchRootKey();
  const actor = Actor.createActor(idl, { agent, canisterId: CANISTER_ID });

  console.log(`\n💸 Buying $${coverageAmount} coverage (Premium: $${premium})`);
  const result = await actor.create_policy(premium, coverageAmount);
  
  if ('Ok' in result) {
    console.log(`✅ Policy #${result.Ok} created!`);
    return result.Ok;
  } else {
    console.log(`❌ Failed: ${result.Err}`);
    return null;
  }
}

// Example: Buy $800 coverage (auto-calculates $80 premium)
// buyInsurance(800n);
