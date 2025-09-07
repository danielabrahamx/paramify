import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Waves, Shield, TrendingUp, Wallet, Eye, EyeOff, AlertCircle, CheckCircle, ArrowLeft, Activity } from 'lucide-react';
import { PARAMIFY_ADDRESS, PARAMIFY_ABI } from './lib/contract';
import { usgsApi, formatTimestamp, getTimeUntilNextUpdate, type ServiceStatus } from './lib/usgsApi';

interface InsuracleDashboardProps {
  setUserType?: (userType: string | null) => void;
}

export default function InsuracleDashboard({ setUserType }: InsuracleDashboardProps) {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [ethBalance, setEthBalance] = useState<number>(0);
  const [floodLevel, setFloodLevel] = useState<number>(0);
  const [threshold, setThreshold] = useState<number>(1200000000000); // 12 feet default
  const [thresholdInFeet, setThresholdInFeet] = useState<number>(12);
  const [policyAmount, setPolicyAmount] = useState<number>(1);
  const [premium, setPremium] = useState<number>(0.1);
  const [insuranceAmount, setInsuranceAmount] = useState<number>(0);
  const [contractBalance, setContractBalance] = useState<number>(0);
  const [transactionStatus, setTransactionStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasActivePolicy, setHasActivePolicy] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [nextUpdateCountdown, setNextUpdateCountdown] = useState<string>('');

  // Connect wallet and fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      if (window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          
          // Check network
          const network = await provider.getNetwork();
          if (network.chainId !== 31337n) { // Hardhat network chainId
            setNetworkError(true);
            setTransactionStatus('Please connect to Hardhat network (localhost:8545, Chain ID: 31337)');
            return;
          } else {
            setNetworkError(false);
          }
          
          const accounts = await provider.send('eth_requestAccounts', []);
          setWalletAddress(accounts[0]);
          const balance = await provider.getBalance(accounts[0]);
          setEthBalance(Number(ethers.formatEther(balance)));
          
          const contract = new ethers.Contract(PARAMIFY_ADDRESS, PARAMIFY_ABI, provider);
          
          // Get contract balance
          try {
            const contractBal = await contract.getContractBalance();
            setContractBalance(Number(ethers.formatEther(contractBal)));
          } catch (e) {
            console.warn('Could not fetch contract balance:', e);
          }
          
          // Get flood level
          try {
            const latestFlood = await contract.getLatestPrice();
            setFloodLevel(Number(latestFlood));
          } catch (e) {
            console.warn('Could not fetch flood level:', e);
          }
          
          // Get current threshold
          try {
            const currentThreshold = await contract.floodThreshold();
            setThreshold(Number(currentThreshold));
            setThresholdInFeet(Number(currentThreshold) / 100000000000);
          } catch (e) {
            console.warn('Could not fetch threshold:', e);
          }
          
          // Check if user has active policy
          try {
            const policy = await contract.policies(accounts[0]);
            if (policy.customer !== "0x0000000000000000000000000000000000000000" && policy.active) {
              setHasActivePolicy(true);
              setInsuranceAmount(Number(ethers.formatEther(policy.coverage)));
              setPolicyAmount(Number(ethers.formatEther(policy.coverage)));
              setPremium(Number(ethers.formatEther(policy.premium)));
            }
          } catch (e) {
            console.warn('Could not fetch policy:', e);
          }
        } catch (e) {
          console.error('Error connecting to wallet:', e);
          setTransactionStatus('Error connecting to wallet. Make sure MetaMask is installed and connected to localhost:8545');
        }
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    setPremium(0.1 * policyAmount);
  }, [policyAmount]);

  // Fetch USGS service status
  useEffect(() => {
    const fetchServiceStatus = async () => {
      try {
        const status = await usgsApi.getStatus();
        setServiceStatus(status);
        setIsBackendConnected(true);
        
        // Update flood level from USGS data
        if (status.oracleValue !== null) {
          setFloodLevel(status.oracleValue * 100000000000); // Convert feet to contract units
        }
        
        // Update threshold from service status
        if (status.threshold) {
          setThresholdInFeet(status.threshold.thresholdFeet);
          setThreshold(Number(status.threshold.thresholdUnits));
        }
      } catch (error) {
        console.error('Failed to fetch USGS service status:', error);
        setIsBackendConnected(false);
      }
    };

    fetchServiceStatus();
    const interval = setInterval(fetchServiceStatus, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Update countdown timer
  useEffect(() => {
    const updateCountdown = () => {
      if (serviceStatus?.nextUpdate) {
        setNextUpdateCountdown(getTimeUntilNextUpdate(serviceStatus.nextUpdate));
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [serviceStatus]);

  // Buy insurance (send tx)
  const handleBuyInsurance = async () => {
    if (!window.ethereum) {
      setTransactionStatus('MetaMask not detected. Please install MetaMask.');
      return;
    }
    
    if (policyAmount <= 0) {
      setTransactionStatus('Please enter a valid policy amount.');
      return;
    }
    
    setIsLoading(true);
    setTransactionStatus('Preparing transaction...');
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(PARAMIFY_ADDRESS, PARAMIFY_ABI, signer);
      
      const coverage = ethers.parseEther(policyAmount.toString());
      const calculatedPremium = ethers.parseEther((0.1 * policyAmount).toString());
      
      console.log('Calling buyInsurance with coverage:', coverage.toString(), 'and premium:', calculatedPremium.toString());
      
      setTransactionStatus('Estimating gas...');
      
      // First estimate gas to catch any revert early
      try {
        await contract.buyInsurance.estimateGas(coverage, { value: calculatedPremium });
      } catch (gasError) {
        console.error('Gas estimation failed:', gasError);
        throw new Error(`Transaction would fail: ${gasError.reason || gasError.message || 'Unknown error'}`);
      }
      
      setTransactionStatus('Sending transaction...');
      const tx = await contract.buyInsurance(coverage, { value: calculatedPremium });
      
      setTransactionStatus('Transaction sent. Waiting for confirmation...');
      await tx.wait();
      
      setTransactionStatus('Transaction successful!');
      setHasActivePolicy(true);
      setInsuranceAmount(policyAmount);
      
      // Update balances
      const balance = await provider.getBalance(walletAddress);
      setEthBalance(Number(ethers.formatEther(balance)));
      const contractBal = await contract.getContractBalance();
      setContractBalance(Number(ethers.formatEther(contractBal)));
      
    } catch (e: any) {
      console.error('Transaction error:', e);
      let errorMessage = 'Unknown error';
      
      if (e.reason) {
        errorMessage = e.reason;
      } else if (e.message) {
        if (e.message.includes('user rejected')) {
          errorMessage = 'Transaction rejected by user';
        } else if (e.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for transaction';
        } else {
          errorMessage = e.message;
        }
      }
      
      setTransactionStatus(`Transaction failed: ${errorMessage}`);
    }
    
    setIsLoading(false);
    setTimeout(() => setTransactionStatus(''), 10000);
  };

  // Trigger payout (send tx)
  const handleTriggerPayout = async () => {
    if (!window.ethereum) {
      setTransactionStatus('MetaMask not detected. Please install MetaMask.');
      return;
    }
    
    setIsLoading(true);
    setTransactionStatus('Checking payout conditions...');
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(PARAMIFY_ADDRESS, PARAMIFY_ABI, signer);
      
      // Check if conditions are met for payout
      const currentFlood = await contract.getLatestPrice();
      const floodLevelValue = Number(currentFlood) / 1e8;
      
      if (floodLevelValue < 3000) {
        setTransactionStatus('Payout conditions not met. Flood level must exceed threshold.');
        setIsLoading(false);
        setTimeout(() => setTransactionStatus(''), 5000);
        return;
      }
      
      setTransactionStatus('Estimating gas...');
      
      // Estimate gas first
      try {
        await contract.triggerPayout.estimateGas();
      } catch (gasError) {
        console.error('Gas estimation failed:', gasError);
        throw new Error(`Payout would fail: ${gasError.reason || gasError.message || 'Unknown error'}`);
      }
      
      setTransactionStatus('Triggering payout...');
      const tx = await contract.triggerPayout();
      
      setTransactionStatus('Transaction sent. Waiting for confirmation...');
      await tx.wait();
      
      setTransactionStatus('Payout received successfully!');
      setHasActivePolicy(false);
      setInsuranceAmount(0);
      
      // Update balances
      const balance = await provider.getBalance(walletAddress);
      setEthBalance(Number(ethers.formatEther(balance)));
      const contractBal = await contract.getContractBalance();
      setContractBalance(Number(ethers.formatEther(contractBal)));
      
    } catch (e: any) {
      console.error('Payout trigger error:', e);
      let errorMessage = 'Unknown error';
      
      if (e.reason) {
        errorMessage = e.reason;
      } else if (e.message) {
        if (e.message.includes('user rejected')) {
          errorMessage = 'Transaction rejected by user';
        } else if (e.message.includes('No active policy')) {
          errorMessage = 'No active policy found';
        } else if (e.message.includes('Flood level below threshold')) {
          errorMessage = 'Flood level below threshold';
        } else {
          errorMessage = e.message;
        }
      }
      
      setTransactionStatus(`Payout failed: ${errorMessage}`);
    }
    
    setIsLoading(false);
    setTimeout(() => setTransactionStatus(''), 10000);
  };

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
                <Waves className="h-8 w-8 text-white" />
              </div>
            </div>
            <div className="w-24"></div> 
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Paramify: Flood Insurance Oracle
          </h1>
          <p className="text-gray-300 text-lg">
            Buy flood insurance and claim payouts if flood levels exceed the threshold.
          </p>
        </div>


        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-8 shadow-2xl">
          
          {networkError && (
            <div className="mb-6 bg-red-500/20 border border-red-400/30 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
                <div>
                  <p className="text-red-200 font-semibold">Wrong Network</p>
                  <p className="text-red-300 text-sm">Please connect to Hardhat network (localhost:8545, Chain ID: 31337)</p>
                </div>
              </div>
            </div>
          )}

          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <Wallet className="h-5 w-5 text-purple-300" />
                <span className="text-white font-medium">Connected Wallet</span>
              </div>
            </div>
            <div className="bg-black/20 rounded-lg p-4 mb-4">
              <p className="text-gray-300 font-mono text-sm break-all">
                {walletAddress}
              </p>
            </div>
            <div className="text-center">
              <span className="text-2xl font-bold text-white">Your Balance: {ethBalance.toFixed(1)} ETH</span>
            </div>
          </div>


          <div className="mb-8">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <TrendingUp className="mr-2 h-5 w-5 text-blue-300" />
              Flood Level
            </h3>
            <div className="space-y-4">
              <div className={`rounded-lg p-6 ${floodLevel >= threshold ? 'bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-400/30' : 'bg-gradient-to-r from-blue-500/20 to-purple-500/20'}`}>
                <div className="text-center">
                  <div className={`text-3xl font-bold mb-2 ${floodLevel >= threshold ? 'text-red-300' : 'text-white'}`}>
                    {(floodLevel / 100000000000).toFixed(2)} ft
                  </div>
                  <div className="text-gray-300">
                    (Threshold: {thresholdInFeet.toFixed(1)} ft)
                  </div>
                  <div className="text-gray-400 text-sm mt-1">
                    = {floodLevel.toFixed(0)} units
                  </div>
                  {floodLevel >= threshold && (
                    <div className="mt-2 text-red-300 font-semibold">⚠️ THRESHOLD EXCEEDED</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* USGS Data Integration Status */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Activity className="mr-2 h-5 w-5 text-green-300" />
              Live Data Source
            </h3>
            <div className="bg-black/20 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${isBackendConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                  <span className={`text-sm font-medium ${isBackendConnected ? 'text-green-300' : 'text-red-300'}`}>
                    {isBackendConnected ? 'Connected to USGS Service' : 'USGS Service Disconnected'}
                  </span>
                </div>
              </div>
              
              {serviceStatus && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/30 rounded-lg p-3">
                      <p className="text-gray-400 text-xs mb-1">USGS Water Level</p>
                      <p className="text-white font-bold">{serviceStatus.currentFloodLevel?.toFixed(2) || 'N/A'} ft</p>
                      <p className="text-gray-400 text-xs mt-1">= {((serviceStatus.currentFloodLevel || 0) * 100000000000).toFixed(0)} units</p>
                    </div>
                    <div className="bg-black/30 rounded-lg p-3">
                      <p className="text-gray-400 text-xs mb-1">Next Update In</p>
                      <p className="text-white font-bold">{nextUpdateCountdown}</p>
                      <p className="text-gray-400 text-xs mt-1">Every 5 minutes</p>
                    </div>
                  </div>
                  
                  <div className="bg-black/30 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Data Source</p>
                    <p className="text-white text-sm font-medium">{serviceStatus.site.name}</p>
                    <p className="text-gray-400 text-xs">Site ID: {serviceStatus.site.siteId}</p>
                  </div>
                  
                  <div className="bg-black/30 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Last Updated</p>
                    <p className="text-white text-sm">{formatTimestamp(serviceStatus.lastUpdate)}</p>
                  </div>
                </div>
              )}
              
              {!isBackendConnected && (
                <div className="mt-4 bg-yellow-500/20 border border-yellow-400/30 rounded-lg p-3">
                  <p className="text-yellow-200 text-sm">
                    ⚠️ Real-time USGS data is currently unavailable. Showing last known values.
                  </p>
                </div>
              )}
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
                  <h4 className="text-green-200 font-semibold text-lg mb-4">Insurance Policy</h4>
                  <div className="space-y-2">
                    <p className="text-white"><span className="text-green-300">Premium:</span> {premium.toFixed(1)} ETH</p>
                    <p className="text-white"><span className="text-green-300">Coverage:</span> {policyAmount.toFixed(1)} ETH</p>
                    <p className="text-white"><span className="text-green-300">Status:</span> Active</p>
                    {floodLevel >= threshold && (
                      <div className="mt-4">
                        <button
                          onClick={handleTriggerPayout}
                          disabled={isLoading}
                          className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none"
                        >
                          {isLoading ? (
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Claiming...
                            </div>
                          ) : (
                            '💰 Claim Insurance Payout'
                          )}
                        </button>
                        <p className="text-red-300 text-sm mt-2">⚠️ Emergency conditions met - claim your payout!</p>
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
                <>
                  <div className="space-y-3">
                    <label className="block text-white font-medium">Policy Amount</label>
                    <input
                      type="number"
                      value={policyAmount}
                      onChange={(e) => setPolicyAmount(Number(e.target.value))}
                      className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter amount"
                    />
                  </div>
                  
                  <div className="bg-black/20 rounded-lg p-4">
                    <p className="text-gray-300">Premium: <span className="text-white font-bold">{premium.toFixed(4)} ETH</span></p>
                  </div>
                  
                  <button
                    onClick={handleBuyInsurance}
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none"
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
                </>
              )}
            </div>
          </div>

   
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-white mb-4">Contract Info</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/20 rounded-lg p-4">
                <p className="text-gray-300 text-sm">Insurance Amount</p>
                <p className="text-white font-bold text-lg">{insuranceAmount.toFixed(1)} ETH</p>
              </div>
              <div className="bg-black/20 rounded-lg p-4">
                <p className="text-gray-300 text-sm">Contract Balance</p>
                <p className="text-white font-bold text-lg">{contractBalance.toFixed(1)} ETH</p>
              </div>
            </div>
          </div>

          {transactionStatus && (
            <div className="mt-6">
              <div className={`flex items-center p-4 rounded-lg ${
                transactionStatus.includes('successful') || transactionStatus.includes('received') 
                  ? 'bg-green-500/20 border border-green-400/30' 
                  : transactionStatus.includes('failed') || transactionStatus.includes('Error') || transactionStatus.includes('Wrong')
                  ? 'bg-red-500/20 border border-red-400/30'
                  : 'bg-blue-500/20 border border-blue-400/30'
              }`}>
                {transactionStatus.includes('successful') || transactionStatus.includes('received') ? (
                  <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                ) : transactionStatus.includes('failed') || transactionStatus.includes('Error') || transactionStatus.includes('Wrong') ? (
                  <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-blue-400 mr-3" />
                )}
                <span className={`font-medium ${
                  transactionStatus.includes('successful') || transactionStatus.includes('received') ? 'text-green-200' 
                  : transactionStatus.includes('failed') || transactionStatus.includes('Error') || transactionStatus.includes('Wrong') ? 'text-red-200'
                  : 'text-blue-200'
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
