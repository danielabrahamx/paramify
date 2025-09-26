import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Zap, Shield, TrendingUp, Wallet, AlertCircle, CheckCircle, ArrowLeft, Activity, Play, Pause, Square, Timer } from 'lucide-react';
import { PARAMIFY_ADDRESS, PARAMIFY_ABI } from './lib/contract';
import { formatTimestamp, getTimeUntilNextUpdate } from './lib/usgsApi';
import { usgsApi } from './lib/usgsApi';

interface InsuracleDashboardProps {
  setUserType?: (userType: string | null) => void;
}

interface ServiceStatus {
  service: string;
  lastUpdate: string | null;
  currentFloodLevel: number | null;
  oracleValue: number | null;
  dataSource: string;
  site: {
    name: string;
    siteId: string;
  };
  updateInterval: string;
  nextUpdate: string | null;
  threshold?: {
    thresholdFeet: number;
    thresholdUnits: number;
  };
}

export default function InsuracleDashboard({ setUserType }: InsuracleDashboardProps) {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [ethBalance, setEthBalance] = useState<number>(0);
  const [outageDuration, setOutageDuration] = useState<number>(0);
  const [payoutRatePerMinute, setPayoutRatePerMinute] = useState<number>(0); // No default value
  const [premium, setPremium] = useState<number>(0); // Premium = payoutRatePerMinute * 2
  const [contractBalance, setContractBalance] = useState<number>(0);
  const [transactionStatus, setTransactionStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasActivePolicy, setHasActivePolicy] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  // Missing state variables for flood logic
  const [floodLevel, setFloodLevel] = useState<number>(0);
  const [threshold, setThreshold] = useState<number>(1200000000000); // 12 feet default
  const [thresholdInFeet, setThresholdInFeet] = useState<number>(12);
  const [insuranceAmount, setInsuranceAmount] = useState<number>(0);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [nextUpdateCountdown, setNextUpdateCountdown] = useState<string>('');

  // Stopwatch state
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [stopwatchInterval, setStopwatchInterval] = useState<NodeJS.Timeout | null>(null);

  // State for manual outage duration setting
  const [manualOutageDuration, setManualOutageDuration] = useState<string>('');
  const [isSettingOracle, setIsSettingOracle] = useState<boolean>(false);

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


  // Fetch service status
  useEffect(() => {
    const fetchServiceStatus = async () => {
      try {
        const status = await usgsApi.getStatus();
        setServiceStatus(status);
        setIsBackendConnected(true);

        // Update flood level from service data
        if (status.oracleValue !== null) {
          setFloodLevel(status.oracleValue * 100000000000); // Convert feet to contract units
        }

        // Update threshold from service status
        if (status.threshold) {
          setThresholdInFeet(status.threshold.thresholdFeet);
          setThreshold(Number(status.threshold.thresholdUnits));
        }
      } catch (error) {
        console.error('Failed to fetch service status:', error);
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

  // Stopwatch functionality
  const startStopwatch = () => {
    if (!stopwatchRunning) {
      setStopwatchRunning(true);
      const interval = setInterval(() => {
        setStopwatchTime(prev => prev + 1);
      }, 1000);
      setStopwatchInterval(interval);
    }
  };

  const pauseStopwatch = () => {
    if (stopwatchRunning && stopwatchInterval) {
      setStopwatchRunning(false);
      clearInterval(stopwatchInterval);
      setStopwatchInterval(null);
    }
  };

  const resetStopwatch = () => {
    setStopwatchRunning(false);
    setStopwatchTime(0);
    if (stopwatchInterval) {
      clearInterval(stopwatchInterval);
      setStopwatchInterval(null);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Function to set outage duration in oracle (for testing)
  const handleSetOutageDuration = async () => {
    if (!window.ethereum || !manualOutageDuration) return;
    setIsSettingOracle(true);
    setTransactionStatus('Setting outage duration in oracle...');
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(PARAMIFY_ADDRESS, PARAMIFY_ABI, signer);

      const durationInSeconds = parseInt(manualOutageDuration);
      const tx = await contract.setOutageDuration(durationInSeconds);
      await tx.wait();

      setTransactionStatus('Outage duration set successfully!');
      setManualOutageDuration('');
      // Update the stopwatch time to match
      setStopwatchTime(durationInSeconds);
    } catch (e: any) {
      console.error('Set outage duration error:', e);
      setTransactionStatus(`Failed to set outage duration: ${e.reason || e.message || 'Unknown error'}`);
    }
    setIsSettingOracle(false);
    setTimeout(() => setTransactionStatus(''), 5000);
  };

  // Buy insurance (send tx)
  const handleBuyInsurance = async () => {
    if (!window.ethereum) {
      setTransactionStatus('MetaMask not detected. Please install MetaMask.');
      return;
    }

    if (payoutRatePerMinute <= 0) {
      setTransactionStatus('Please enter a valid payout rate per minute.');
      return;
    }

    setIsLoading(true);
    setTransactionStatus('Preparing transaction...');

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(PARAMIFY_ADDRESS, PARAMIFY_ABI, signer);

      // Calculate required premium (payoutRatePerMinute * 2)
      const requiredPremium = payoutRatePerMinute * 2;
      const premiumInWei = ethers.parseEther(requiredPremium.toString());

      console.log('Calling buyInsurance with payoutRatePerMinute:', payoutRatePerMinute, 'premium:', requiredPremium, 'ETH');

      setTransactionStatus('Estimating gas...');

      // First estimate gas to catch any revert early
      try {
        await contract.buyInsurance.estimateGas(payoutRatePerMinute, { value: premiumInWei });
      } catch (gasError) {
        console.error('Gas estimation failed:', gasError);
        throw new Error(`Transaction would fail: ${gasError.reason || gasError.message || 'Unknown error'}`);
      }

      setTransactionStatus('Sending transaction...');
      const tx = await contract.buyInsurance(payoutRatePerMinute, { value: premiumInWei });

      setTransactionStatus('Transaction sent. Waiting for confirmation...');
      await tx.wait();

      setTransactionStatus('Insurance purchased successfully!');
      setHasActivePolicy(true);
      setPremium(requiredPremium);

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
        } else if (e.message.includes('Insufficient premium')) {
          errorMessage = 'Insufficient premium - you need at least double the payout rate';
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

    if (stopwatchTime === 0) {
      setTransactionStatus('No outage duration recorded. Start the stopwatch first.');
      setTimeout(() => setTransactionStatus(''), 5000);
      return;
    }

    setIsLoading(true);
    setTransactionStatus('Recording outage duration...');

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(PARAMIFY_ADDRESS, PARAMIFY_ABI, signer);

      // First set the outage duration in the oracle (this requires admin role)
      // For individual users, we'll need to use a different approach
      setTransactionStatus('Setting outage duration in oracle...');

      // Check if user has admin role, if not, provide instructions
      const adminRole = ethers.id('DEFAULT_ADMIN_ROLE');
      const hasAdminRole = await contract.hasRole(adminRole, walletAddress);

      if (hasAdminRole) {
        // User is admin, set the oracle value directly
        const setOutageTx = await contract.setOutageDuration(stopwatchTime);
        await setOutageTx.wait();
        setTransactionStatus('Outage duration recorded. Processing payout...');
      } else {
        // User is not admin, but we can still try the payout
        // The contract will check the oracle value
        setTransactionStatus('Processing payout with recorded duration...');
      }

      // Now trigger the payout on the contract
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
      setStopwatchTime(0); // Reset stopwatch

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
        } else if (e.message.includes('No outage recorded')) {
          errorMessage = 'No outage duration recorded on blockchain. Use admin dashboard to set outage duration.';
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
                <Zap className="h-8 w-8 text-white" />
              </div>
            </div>
            <div className="w-24"></div> 
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Paramify: Power Outage Insurance Oracle
          </h1>
          <p className="text-gray-300 text-lg">
            Get protected against power outages with blockchain-based insurance. Use the stopwatch to simulate outages and calculate potential payouts.
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
              <Zap className="mr-2 h-5 w-5 text-yellow-300" />
              Power Outage Simulation
            </h3>
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/30 rounded-lg p-6">
                <div className="text-center">
                  <div className="text-4xl font-bold mb-2 text-yellow-300">
                    {formatTime(stopwatchTime)}
                  </div>
                  <div className="text-gray-300 mb-4">
                    Current Outage Duration
                  </div>
                  <div className="flex justify-center space-x-3">
                    {!stopwatchRunning ? (
                      <button
                        onClick={startStopwatch}
                        className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                      >
                        <Play className="h-4 w-4" />
                        <span>Start Outage</span>
                      </button>
                    ) : (
                      <button
                        onClick={pauseStopwatch}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                      >
                        <Pause className="h-4 w-4" />
                        <span>Pause</span>
                      </button>
                    )}
                    <button
                      onClick={resetStopwatch}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                    >
                      <Square className="h-4 w-4" />
                      <span>Reset</span>
                    </button>
                  </div>
                  <div className="mt-4 text-sm text-gray-400">
                    {payoutRatePerMinute > 0 ? `Payout Rate: ${payoutRatePerMinute} ETH per minute` : 'Enter payout rate above to see potential payout'}
                  </div>
                  {payoutRatePerMinute > 0 && (
                    <div className="mt-2 text-sm text-yellow-300">
                      Potential Payout: {(stopwatchTime * payoutRatePerMinute) / 60} ETH
                    </div>
                  )}
                </div>
              </div>
           </div>
         </div>

         {/* Manual Outage Duration Setter */}
         <div className="mb-8">
           <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
             <Activity className="mr-2 h-5 w-5 text-orange-300" />
             Set Outage Duration (for testing)
           </h3>
           <div className="bg-black/20 rounded-lg p-4">
             <p className="text-gray-300 text-sm mb-4">
               Manually set the outage duration in seconds for testing payout functionality.
             </p>
             <div className="space-y-3">
               <input
                 type="number"
                 value={manualOutageDuration}
                 onChange={(e) => setManualOutageDuration(e.target.value)}
                 className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                 placeholder="Outage duration (seconds)"
                 min="0"
               />
               <button
                 onClick={handleSetOutageDuration}
                 disabled={isSettingOracle || !manualOutageDuration || parseInt(manualOutageDuration) <= 0}
                 className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none"
               >
                 {isSettingOracle ? (
                   <div className="flex items-center justify-center">
                     <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                     Setting...
                   </div>
                 ) : (
                   '⚡ Set Outage Duration'
                 )}
               </button>
               <div className="bg-black/30 rounded-lg p-3">
                 <p className="text-gray-400 text-xs mb-1">Current Oracle Duration</p>
                 <p className="text-white font-bold">{floodLevel > 0 ? `${floodLevel} seconds` : '0 seconds (no outage)'}</p>
                 {payoutRatePerMinute > 0 && floodLevel > 0 && (
                   <p className="text-gray-400 text-xs mt-1">Expected Payout: {((floodLevel * payoutRatePerMinute) / 60).toFixed(4)} ETH</p>
                 )}
               </div>
             </div>
           </div>
         </div>

         {/* Power Outage Monitoring Status */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Activity className="mr-2 h-5 w-5 text-green-300" />
              Power Grid Status
            </h3>
            <div className="bg-black/20 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${isBackendConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                  <span className={`text-sm font-medium ${isBackendConnected ? 'text-green-300' : 'text-red-300'}`}>
                    {isBackendConnected ? 'Grid Monitoring Active' : 'Grid Monitoring Offline'}
                  </span>
                </div>
              </div>

              {serviceStatus && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/30 rounded-lg p-3">
                      <p className="text-gray-400 text-xs mb-1">Grid Status</p>
                      <p className="text-white font-bold">{serviceStatus.currentFloodLevel ? 'OUTAGE DETECTED' : 'POWER RESTORED'}</p>
                      <p className="text-gray-400 text-xs mt-1">Monitoring Active</p>
                    </div>
                    <div className="bg-black/30 rounded-lg p-3">
                      <p className="text-gray-400 text-xs mb-1">Next Check In</p>
                      <p className="text-white font-bold">{nextUpdateCountdown}</p>
                      <p className="text-gray-400 text-xs mt-1">Every 5 minutes</p>
                    </div>
                  </div>

                  {serviceStatus.site && (
                    <div className="bg-black/30 rounded-lg p-3">
                      <p className="text-gray-400 text-xs mb-1">Monitoring Zone</p>
                      <p className="text-white text-sm font-medium">{serviceStatus.site.name}</p>
                      <p className="text-gray-400 text-xs">Zone ID: {serviceStatus.site.siteId}</p>
                    </div>
                  )}

                  <div className="bg-black/30 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Last Updated</p>
                    <p className="text-white text-sm">{formatTimestamp(serviceStatus.lastUpdate)}</p>
                  </div>
                </div>
              )}

              {!isBackendConnected && (
                <div className="mt-4 bg-yellow-500/20 border border-yellow-400/30 rounded-lg p-3">
                  <p className="text-yellow-200 text-sm">
                    ⚠️ Grid monitoring is offline. Use the stopwatch to simulate outages manually.
                  </p>
                </div>
              )}
            </div>
          </div>
  
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Shield className="mr-2 h-5 w-5 text-purple-300" />
              Power Outage Insurance
            </h3>
            <div className="space-y-4">
              {hasActivePolicy ? (
                <div className="bg-green-500/20 border border-green-400/30 rounded-lg p-6">
                  <h4 className="text-green-200 font-semibold text-lg mb-4">Active Power Outage Policy</h4>
                  <div className="space-y-2">
                    <p className="text-white"><span className="text-green-300">Payout Rate:</span> {payoutRatePerMinute} ETH/minute</p>
                    <p className="text-white"><span className="text-green-300">Premium Paid:</span> {(payoutRatePerMinute * 2).toFixed(1)} ETH</p>
                    <p className="text-white"><span className="text-green-300">Status:</span> Active</p>
                    <div className="mt-4 p-3 bg-blue-500/20 rounded-lg">
                      <p className="text-blue-200 text-sm font-medium">Current Outage: {formatTime(stopwatchTime)}</p>
                      <p className="text-blue-300 text-sm">Potential Payout: {(stopwatchTime * payoutRatePerMinute) / 60} ETH</p>
                    </div>
                    <div className="mt-4">
                      <button
                        onClick={handleTriggerPayout}
                        disabled={isLoading || stopwatchTime === 0}
                        className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none"
                      >
                        {isLoading ? (
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Processing...
                          </div>
                        ) : (
                          '💰 Claim Outage Payout'
                        )}
                      </button>
                      <p className="text-red-300 text-sm mt-2">⚠️ Submit claim for current outage duration</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-lg p-4">
                  <p className="text-yellow-200 font-medium">No active policy</p>
                  <p className="text-yellow-300 text-sm mt-1">Purchase a policy below to get outage protection</p>
                </div>
              )}
              
              {!hasActivePolicy && (
                <>
                  <div className="space-y-3">
                    <label className="block text-white font-medium">Payout Rate Per Minute</label>
                    <div className="text-sm text-gray-400 mb-2">How much you want to receive per minute of outage (in ETH)</div>
                    <input
                      type="number"
                      value={payoutRatePerMinute}
                      onChange={(e) => setPayoutRatePerMinute(Number(e.target.value))}
                      className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter payout rate (ETH/min)"
                      min="0.1"
                      step="0.1"
                    />
                  </div>

                  {payoutRatePerMinute > 0 && (
                    <div className="bg-black/20 rounded-lg p-4">
                      <p className="text-gray-300">Premium Required: <span className="text-white font-bold">{(payoutRatePerMinute * 2).toFixed(4)} ETH</span></p>
                      <p className="text-gray-400 text-sm">Premium = Payout Rate × 2</p>
                    </div>
                  )}
                  
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
                <p className="text-gray-300 text-sm">Your Balance</p>
                <p className="text-white font-bold text-lg">{ethBalance.toFixed(3)} ETH</p>
              </div>
              <div className="bg-black/20 rounded-lg p-4">
                <p className="text-gray-300 text-sm">Contract Balance</p>
                <p className="text-white font-bold text-lg">{contractBalance.toFixed(3)} ETH</p>
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
