import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Zap, Shield, TrendingUp, Wallet, AlertCircle, CheckCircle, ArrowLeft, Activity } from 'lucide-react';
import { PARAMIFY_ADDRESS, PARAMIFY_ABI } from './lib/contract';

interface ParamifyDashboardProps {
  setUserType?: (userType: string | null) => void;
}

export default function InsuracleDashboardAdmin({ setUserType }: ParamifyDashboardProps) {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [ethBalance, setEthBalance] = useState<number>(0);
  const [contractBalance, setContractBalance] = useState<number>(0);
  const [fundAmount, setFundAmount] = useState<string>("");
  const [transactionStatus, setTransactionStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [walletChecked, setWalletChecked] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [nextUpdateCountdown, setNextUpdateCountdown] = useState<string>('');

  // State variables for power outage insurance
  const [outageDuration, setOutageDuration] = useState<number>(0);
  const [payoutRatePerMinute, setPayoutRatePerMinute] = useState<string>('');
  const [premium, setPremium] = useState<number>(0);
  const [hasActivePolicy, setHasActivePolicy] = useState<boolean>(false);
  const [insuranceAmount, setInsuranceAmount] = useState<number>(0);
  const [outageDurationInput, setOutageDurationInput] = useState<string>('');
  const [isSettingOutage, setIsSettingOutage] = useState<boolean>(false);

  const handleConnectWallet = async () => {
    if (!window.ethereum) {
      setTransactionStatus('MetaMask not detected. Please install MetaMask.');
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        setTransactionStatus('Please connect your wallet to use the admin dashboard.');
        setIsAdmin(false);
        setWalletChecked(true);
        return;
      }
      setWalletAddress(accounts[0]);
      const adminAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'.toLowerCase();
      if (accounts[0].toLowerCase() === adminAddress) {
        setIsAdmin(true);
        setTransactionStatus('');
      } else {
        setIsAdmin(false);
        setTransactionStatus('You must be connected as the admin to access this dashboard.');
      }
      setWalletChecked(true);
    } catch (e) {
      setTransactionStatus('Error checking wallet connection.');
      setIsAdmin(false);
      setWalletChecked(true);
      return;
    }
  };

  useEffect(() => {
    // Listen for account changes in MetaMask
    if (window.ethereum && window.ethereum.on) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (!accounts || accounts.length === 0) {
          setIsAdmin(false);
          setTransactionStatus('Please connect your wallet to use the admin dashboard.');
          setWalletChecked(false);
        } else {
          setWalletAddress(accounts[0]);
          const adminAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'.toLowerCase();
          if (accounts[0].toLowerCase() === adminAddress) {
            setIsAdmin(true);
            setTransactionStatus('');
          } else {
            setIsAdmin(false);
            setTransactionStatus('You must be connected as the admin to access this dashboard.');
          }
          setWalletChecked(true);
        }
      };
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (window.ethereum) {
        try {
          // Ensure we're on the correct network
          await switchToLocalNetwork();
          
          const provider = new ethers.BrowserProvider(window.ethereum);
          const network = await provider.getNetwork();
          console.log('Connected to network:', network.chainId);
          
          const accounts = await provider.send('eth_requestAccounts', []);
          setWalletAddress(accounts[0]);
          const balance = await provider.getBalance(accounts[0]);
          setEthBalance(Number(ethers.formatEther(balance)));
          
          const contract = new ethers.Contract(PARAMIFY_ADDRESS, PARAMIFY_ABI, provider);
          try {
            const contractBal = await contract.getContractBalance();
            setContractBalance(Number(ethers.formatEther(contractBal)));
            const latestOutage = await contract.getLatestPrice();
            console.log("Raw oracle value:", latestOutage.toString());
            console.log("Converted to number:", Number(latestOutage));
            setOutageDuration(Number(latestOutage));
            
            // Check if current user has an active policy
            const policy = await contract.policies(accounts[0]);
            console.log("Policy for current user:", {
              active: policy.active,
              premium: ethers.formatEther(policy.premium),
              payoutRatePerSecond: policy.payoutRatePerSecond.toString(),
              paidOut: policy.paidOut
            });
            
            if (policy.active) {
              setHasActivePolicy(true);
              const premiumInEth = Number(ethers.formatEther(policy.premium));
              const payoutRatePerMinute = premiumInEth / 2; // Since premium = rate * 2
              setInsuranceAmount(payoutRatePerMinute);
              setPremium(premiumInEth);
            } else {
              setHasActivePolicy(false);
              setInsuranceAmount(0);
            }
            
          } catch (e) {
            console.log('Contract calls failed, contract may not be deployed yet:', e);
          }
        } catch (e) {
          console.error('Failed to connect to network:', e);
          setTransactionStatus('Please connect to Hardhat Local network (Chain ID: 31337)');
        }
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchAdminStatus = async () => {
      if (window.ethereum) {
        try {
          await switchToLocalNetwork();
          const provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await provider.send('eth_requestAccounts', []);
          const contract = new ethers.Contract(PARAMIFY_ADDRESS, PARAMIFY_ABI, provider);
          // Assume contract has a public 'hasRole' method and ADMIN_ROLE constant
          const ADMIN_ROLE = ethers.id('ADMIN_ROLE');
          const isAdmin = await contract.hasRole(ADMIN_ROLE, accounts[0]);
          setIsAdmin(isAdmin);
        } catch (e) {
          setIsAdmin(false);
        }
      }
    };
    fetchAdminStatus();
  }, []);


  
    const calculatePremium = (rate: number) => rate * 2;
  
    const handlePayoutRateChange = (value: string) => {
      setPayoutRatePerMinute(value);
      const rate = parseFloat(value) || 0;
      setPremium(calculatePremium(rate));
    };

  
    const handleBuyInsurance = async () => {
      if (!window.ethereum || !payoutRatePerMinute) return;
      
      const rateValue = parseFloat(payoutRatePerMinute);
      if (rateValue <= 0) {
        setTransactionStatus('Please enter a valid payout rate greater than 0');
        setTimeout(() => setTransactionStatus(''), 3000);
        return;
      }
      
      setIsLoading(true);
      setTransactionStatus('Processing insurance purchase...');
      
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(PARAMIFY_ADDRESS, PARAMIFY_ABI, signer);
        
        // Convert rate to wei properly
        const rateInWei = ethers.parseEther(payoutRatePerMinute);
        const calculatedPremium = ethers.parseEther(premium.toString());
        
        console.log('Insurance purchase parameters:');
        console.log('- Rate per minute (ETH):', payoutRatePerMinute);
        console.log('- Rate in wei:', rateInWei.toString());
        console.log('- Premium (ETH):', premium.toString());
        console.log('- Premium in wei:', calculatedPremium.toString());
        
        // Validate that the rate will not become zero after division by 60
        const expectedPayoutRatePerSecond = rateInWei / 60n;
        console.log('- Expected payout rate per second:', expectedPayoutRatePerSecond.toString(), 'wei');
        
        if (expectedPayoutRatePerSecond === 0n) {
          setTransactionStatus('Rate too small! Minimum rate is 0.001 ETH per minute');
          setIsLoading(false);
          setTimeout(() => setTransactionStatus(''), 5000);
          return;
        }
        
        const tx = await contract.buyInsurance(rateInWei, { value: calculatedPremium });
        await tx.wait();
        
        console.log('Insurance purchased successfully');
        setTransactionStatus('Insurance purchased successfully! Policy is now active.');
        setHasActivePolicy(true);
        setInsuranceAmount(rateValue);
        
        // Update balances
        const balance = await provider.getBalance(walletAddress);
        setEthBalance(Number(ethers.formatEther(balance)));
        const contractBal = await contract.getContractBalance();
        setContractBalance(Number(ethers.formatEther(contractBal)));
        
      } catch (e: any) {
        console.error('Insurance purchase error:', e);
        setTransactionStatus(`Insurance purchase failed! ${e.reason || e.message || 'Unknown error'}`);
      }
      setIsLoading(false);
      setTimeout(() => setTransactionStatus(''), 8000);
    };
  const handleFundContract = async () => {
    if (!window.ethereum || !fundAmount) return;
    setIsFunding(true);
    setTransactionStatus('Funding contract...');
    try {
      // Ensure we're on the correct network first
      await switchToLocalNetwork();
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Check network
      const network = await provider.getNetwork();
      if (network.chainId !== 31337n) {
        throw new Error('Please switch to Hardhat Local network (Chain ID: 31337)');
      }
      
      // Check if the contract exists at the address
      const code = await provider.getCode(PARAMIFY_ADDRESS);
      if (code === '0x') {
        throw new Error('Contract not found at address. Please ensure the contract is deployed.');
      }
      
      // Estimate gas first
      const gasEstimate = await provider.estimateGas({
        to: PARAMIFY_ADDRESS,
        value: ethers.parseEther(fundAmount),
        from: await signer.getAddress()
      });
      
      // Send transaction with estimated gas
      const tx = await signer.sendTransaction({ 
        to: PARAMIFY_ADDRESS, 
        value: ethers.parseEther(fundAmount),
        gasLimit: gasEstimate * 120n / 100n // Add 20% buffer
      });
      
      await tx.wait();
      setTransactionStatus('Contract funded successfully!');
      
      const contract = new ethers.Contract(PARAMIFY_ADDRESS, PARAMIFY_ABI, provider);
      const contractBal = await contract.getContractBalance();
      setContractBalance(Number(ethers.formatEther(contractBal)));
      const balance = await provider.getBalance(walletAddress);
      setEthBalance(Number(ethers.formatEther(balance)));
      setFundAmount(""); // Clear the input after successful funding
    } catch (e: any) {
      console.error('Funding error:', e);
      let errorMessage = 'Unknown error';
      if (e.message) {
        errorMessage = e.message;
      } else if (e.reason) {
        errorMessage = e.reason;
      } else if (e.code === 'CALL_EXCEPTION') {
        errorMessage = 'Transaction failed - contract may not be deployed or network issue';
      } else if (e.code === 'UNKNOWN_ERROR' && e.message?.includes('404')) {
        errorMessage = 'Network connection failed. Please ensure you are connected to Hardhat Local network';
      }
      setTransactionStatus(`Funding failed! ${errorMessage}`);
    }
    setIsFunding(false);
    setTimeout(() => setTransactionStatus(''), 5000);
  };

  const handleTriggerPayout = async () => {
    if (!window.ethereum) return;
    setIsLoading(true);
    setTransactionStatus('Triggering payout...');
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(PARAMIFY_ADDRESS, PARAMIFY_ABI, signer);
      
      // Check if eligible for payout first
      const accounts = await provider.send('eth_requestAccounts', []);
      const customerAddress = accounts[0];
      const isEligible = await contract.isPayoutEligible(customerAddress);
      
      if (!isEligible) {
        setTransactionStatus('Not eligible for payout. Check if you have an active policy and outage duration > 0.');
        setIsLoading(false);
        setTimeout(() => setTransactionStatus(''), 5000);
        return;
      }
      
      console.log('Triggering payout for address:', customerAddress);
      const tx = await contract.triggerPayout();
      await tx.wait();
      console.log('Payout transaction completed:', tx.hash);
      
      setTransactionStatus('Payout triggered successfully! Check your wallet balance.');
      setHasActivePolicy(false);
      setInsuranceAmount(0);
      
      // Update balances
      const balance = await provider.getBalance(walletAddress);
      setEthBalance(Number(ethers.formatEther(balance)));
      const contractBal = await contract.getContractBalance();
      setContractBalance(Number(ethers.formatEther(contractBal)));
      
    } catch (e: any) {
      console.error('Payout trigger error:', e);
      setTransactionStatus(`Payout failed! ${e.reason || e.message || 'Unknown error'}`);
    }
    setIsLoading(false);
    setTimeout(() => setTransactionStatus(''), 8000); // Longer timeout for success message
  };

  const addLocalNetwork = async () => {
    if (!window.ethereum) return;
    
    // Detect if we're in Codespaces
    const isCodespaces = window.location.hostname.includes('app.github.dev') || 
                        window.location.hostname.includes('github.dev');
    
    const rpcUrl = isCodespaces 
      ? 'https://expert-couscous-4j6674wqj9jr2q7xx-8545.app.github.dev'
      : 'http://localhost:8545';
    
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x7a69', // 31337 in hex
          chainName: 'Hardhat Local',
          nativeCurrency: {
            name: 'ETH',
            symbol: 'ETH',
            decimals: 18
          },
          rpcUrls: [rpcUrl],
          blockExplorerUrls: null
        }]
      });
      setTransactionStatus(`Network added with RPC: ${rpcUrl}`);
    } catch (error) {
      console.error('Failed to add network:', error);
      setTransactionStatus(`Failed to add network. RPC URL: ${rpcUrl}`);
    }
  };

  const switchToLocalNetwork = async () => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x7a69' }]
      });
    } catch (error) {
      if (error.code === 4902) {
        // Network not added yet, add it
        await addLocalNetwork();
      } else {
        console.error('Failed to switch network:', error);
      }
    }
  };

  
    const handleSetOutageDuration = async () => {
      if (!window.ethereum || !outageDurationInput) return;
      setIsSettingOutage(true);
      setTransactionStatus('Setting outage duration...');
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(PARAMIFY_ADDRESS, PARAMIFY_ABI, signer);
  
        const durationInSeconds = parseInt(outageDurationInput);
        const tx = await contract.setOutageDuration(durationInSeconds);
        await tx.wait();
        setTransactionStatus('Outage duration set successfully!');
        setOutageDurationInput('');
        
        // Update the displayed outage duration
        setOutageDuration(durationInSeconds);
      } catch (e: any) {
        console.error('Set outage duration error:', e);
        setTransactionStatus(`Failed to set outage duration: ${e.reason || e.message || 'Unknown error'}`);
      }
      setIsSettingOutage(false);
      setTimeout(() => setTransactionStatus(''), 5000);
    };
  

  const roleStatuses = [
    { name: 'Admin', status: true },
    { name: 'Oracle Updater', status: true },
    { name: 'Insurance Admin', status: true }
  ];

  // Only show admin dashboard if isAdmin is true
  if (!walletChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="bg-black/70 p-8 rounded-lg shadow-lg text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Admin Dashboard</h2>
          <p className="text-white/80 mb-2">Please connect your wallet to continue.</p>
          <button
            onClick={handleConnectWallet}
            className="mt-4 px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-blue-600 transition-all"
          >
            Connect Wallet
          </button>
          {transactionStatus && (
            <div className="mt-4 text-red-400">{transactionStatus}</div>
          )}
        </div>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="bg-black/70 p-8 rounded-lg shadow-lg text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Access Denied</h2>
          <p className="text-white/80 mb-2">You must be connected as the admin to access this dashboard.</p>
          <p className="text-white/60 text-sm mb-4">Admin address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266</p>
          <button
            onClick={() => setUserType && setUserType(null)}
            className="mt-4 px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-blue-600 transition-all"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setUserType && setUserType(null)}
              className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2 rounded-lg transition-all duration-200"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Home</span>
            </button>
            <div className="flex items-center justify-center">
              <div className="p-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full shadow-lg">
                <Zap className="h-8 w-8 text-white" />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                👑 ADMIN
              </div>
            </div>
          </div>
          <div className="mb-4">
            <p className="text-gray-300 text-sm mb-2">Paramify Logo</p>
            <h1 className="text-3xl font-bold text-white mb-2">
              Paramify: Power Outage Insurance Oracle
            </h1>
            <p className="text-gray-300 text-lg">
              Buy power outage insurance and claim payouts based on outage duration.
            </p>
          </div>
        </div>


        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 shadow-2xl">
          {/* Network connection status */}
          <div className="mb-6">
            <div className="flex items-center justify-between bg-black/20 rounded-lg p-4">
              <div className="flex flex-col">
                <span className="text-white font-medium">Network Status</span>
                <span className="text-gray-400 text-xs mt-1">
                  RPC: {window.location.hostname.includes('app.github.dev') || window.location.hostname.includes('github.dev') 
                    ? 'Codespaces URL' 
                    : 'localhost:8545'}
                </span>
              </div>
              <button
                onClick={switchToLocalNetwork}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm transition-all duration-200"
              >
                Connect to Hardhat Local
              </button>
            </div>
          </div>

          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Wallet className="h-5 w-5 text-purple-300" />
                <span className="text-white font-medium">Connected Wallet</span>
              </div>
            </div>
            <div className="bg-black/20 rounded-lg p-4 mb-4">
              <p className="text-gray-300 font-mono text-sm">
                Connected: {walletAddress}
              </p>
            </div>
            <div className="text-center">
              <span className="text-2xl font-bold text-white">Your Balance: {ethBalance.toFixed(3)} ETH</span>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <TrendingUp className="mr-2 h-5 w-5 text-blue-300" />
              Outage Duration
            </h3>
            <div className="space-y-4">
              <div className={`rounded-lg p-6 ${outageDuration > 0 ? 'bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-400/30' : 'bg-gradient-to-r from-blue-500/20 to-purple-500/20'}`}>
                <div className="text-center">
                  <div className={`text-3xl font-bold mb-2 ${outageDuration > 0 ? 'text-red-300' : 'text-white'}`}>
                    {outageDuration} seconds
                  </div>
                  <div className="text-gray-300">
                    Current outage duration
                  </div>
                  <div className="text-gray-400 text-sm mt-1">
                    Expected Payout: {(outageDuration * (premium / 2) / 60).toFixed(4)} ETH
                  </div>
                  {outageDuration > 0 && (
                    <div className="mt-2 text-red-300 font-semibold">⚠️ POWER OUTAGE DETECTED</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Outage Duration Simulator */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Activity className="mr-2 h-5 w-5 text-orange-300" />
              Power Outage Simulator
            </h3>
            <div className="bg-black/20 rounded-lg p-4">
              <p className="text-gray-300 text-sm mb-4">
                Simulate a power outage by setting the duration in seconds. This will update the oracle value.
              </p>
              <div className="space-y-3">
                <input
                  type="number"
                  value={outageDurationInput}
                  onChange={(e) => setOutageDurationInput(e.target.value)}
                  className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Outage duration (seconds)"
                  min="0"
                />
                <button
                  onClick={handleSetOutageDuration}
                  disabled={isSettingOutage || !outageDurationInput || parseInt(outageDurationInput) <= 0}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none"
                >
                  {isSettingOutage ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Setting Outage...
                    </div>
                  ) : (
                    '⚡ Simulate Power Outage'
                  )}
                </button>
                <div className="bg-black/30 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Current Outage Duration</p>
                  <p className="text-white font-bold">{outageDuration > 0 ? `${outageDuration} seconds` : 'No outage'}</p>
                  <p className="text-gray-400 text-xs mt-1">Expected Payout: {(outageDuration * (premium / 2) / 60).toFixed(4)} ETH</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Shield className="mr-2 h-5 w-5 text-purple-300" />
              Insurance Policy
            </h3>
            <div className="space-y-4">
              {hasActivePolicy ? (
                <div className="bg-green-500/20 border border-green-400/30 rounded-lg p-6">
                  <h4 className="text-green-200 font-semibold text-lg mb-4">✓ Active Insurance Policy</h4>
                  <div className="space-y-2">
                    <p className="text-white"><span className="text-green-300">Payout Rate:</span> {insuranceAmount.toFixed(1)} ETH/min</p>
                    <p className="text-white"><span className="text-green-300">Status:</span> Active</p>
                    {outageDuration > 0 && (
                      <div className="mt-4">
                        <button
                          onClick={handleTriggerPayout}
                          disabled={isLoading}
                          className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none"
                        >
                          {isLoading ? (
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Triggering...
                            </div>
                          ) : (
                            '🚨 Trigger Emergency Payout'
                          )}
                        </button>
                        <p className="text-red-300 text-sm mt-2">⚠️ Power outage detected - payout available</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-lg p-4">
                  <p className="text-yellow-200 font-medium">No active policy</p>
                </div>
              )}
              
              {!hasActivePolicy && (
                <div className="bg-black/20 rounded-lg p-4">
                  <div className="space-y-3">
                    <input
                      type="number"
                      value={payoutRatePerMinute}
                      onChange={(e) => handlePayoutRateChange(e.target.value)}
                      className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Payout rate per minute (ETH)"
                      min="0.001"
                      step="0.001"
                    />
                    <p className="text-gray-400 text-xs mt-1">
                      Minimum: 0.001 ETH/minute. Recommended: 1-10 ETH/minute for testing.
                    </p>
                    <div className="bg-black/30 rounded-lg p-3">
                      <p className="text-gray-300">Premium: <span className="text-white font-bold">{premium.toFixed(1)} ETH</span></p>
                      <p className="text-gray-300 text-sm mt-1">Formula: Premium = Rate × 2</p>
                    </div>
                    <button
                      onClick={handleBuyInsurance}
                      disabled={isLoading || !payoutRatePerMinute || parseFloat(payoutRatePerMinute) <= 0}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none"
                    >
                      {isLoading ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          Processing...
                        </div>
                      ) : (
                        <>
                          <Shield className="inline mr-2 h-5 w-5" />
                          Buy Insurance
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

 
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-white mb-4">Contract Info</h3>
            <div className="grid grid-cols-1 gap-4 mb-4">
              <div className="bg-black/20 rounded-lg p-4">
                <p className="text-gray-300 text-sm">Contract Balance</p>
                <p className="text-white font-bold text-lg">{contractBalance.toFixed(1)} ETH</p>
              </div>
            </div>
          </div>

   
          {isAdmin && (
            <>
              <div className="bg-black/20 rounded-lg p-4 mb-8">
                <div className="space-y-3">
                  <input
                    type="number"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    placeholder="Fund amount (ETH)"
                  />
                  <button
                    onClick={handleFundContract}
                    disabled={isFunding || !fundAmount || parseFloat(fundAmount) <= 0}
                    className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none"
                  >
                    {isFunding ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Funding...
                      </div>
                    ) : (
                      'Fund Contract'
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Always show roles section */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-white mb-4">Roles</h3>
            <div className="space-y-3">
              {roleStatuses.map((role, index) => (
                <div key={index} className="flex justify-between items-center bg-black/20 rounded-lg p-4">
                  <span className="text-white font-medium">{role.name}</span>
                  <span className={`font-semibold ${role.status ? 'text-green-400' : 'text-red-400'}`}>
                    {role.status ? 'Yes' : 'No'}
                  </span>
                </div>
              ))}
            </div>
          </div>

    
          {transactionStatus && (
            <div className="mt-6">
              <div className={`flex items-center p-4 rounded-lg ${
                transactionStatus.includes('successfully') 
                  ? 'bg-green-500/20 border border-green-400/30' 
                  : 'bg-blue-500/20 border border-blue-400/30'
              }`}>
                {transactionStatus.includes('successfully') ? (
                  <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-blue-400 mr-3" />
                )}
                <span className={`font-medium ${
                  transactionStatus.includes('successfully') ? 'text-green-200' : 'text-blue-200'
                }`}>
                  {transactionStatus}
                </span>
              </div>
            </div>
          )}
        </div>


        <div className="text-center mt-8">
          <p className="text-gray-400 text-sm">
            Powered by blockchain technology and smart contracts
          </p>
        </div>
      </div>
    </div>
  );
}
