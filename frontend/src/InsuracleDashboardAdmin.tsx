import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Waves, Shield, TrendingUp, Wallet, AlertCircle, CheckCircle, ArrowLeft, RefreshCw, Activity, Satellite, Radar } from 'lucide-react';
import { PARAMIFY_ADDRESS, PARAMIFY_ABI, MOCK_ORACLE_ADDRESS, MOCK_ORACLE_ABI } from './lib/contract';
import { usgsApi, formatTimestamp, getTimeUntilNextUpdate, type ServiceStatus } from './lib/usgsApi';
import { getCurrentPosition, formatCoords } from './lib/geolocation';

interface ParamifyDashboardProps {
  setUserType?: (userType: string | null) => void;
}

export default function InsuracleDashboardAdmin({ setUserType }: ParamifyDashboardProps) {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [ethBalance, setEthBalance] = useState<number>(0);
  const [floodLevel, setFloodLevel] = useState<number>(0);
  const [threshold, setThreshold] = useState<number>(1200000000000); // 12 feet default
  const [thresholdInFeet, setThresholdInFeet] = useState<number>(12);
  const [newThresholdFeet, setNewThresholdFeet] = useState<string>("");
  const [coverageAmount, setCoverageAmount] = useState<string>("");
  const [premium, setPremium] = useState<number>(0);
  const [insuranceAmount, setInsuranceAmount] = useState<number>(0);
  const [contractBalance, setContractBalance] = useState<number>(0);
  const [fundAmount, setFundAmount] = useState<string>("");
  const [transactionStatus, setTransactionStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingThreshold, setIsUpdatingThreshold] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [hasActivePolicy, setHasActivePolicy] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [walletChecked, setWalletChecked] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [nextUpdateCountdown, setNextUpdateCountdown] = useState<string>('');

  // Demo mode: no MetaMask needed — sign with hardhat account #0 key (the admin) against localhost:8545
  const DEMO_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [forceDemo, setForceDemo] = useState(false);

  const getProviderAndSigner = async () => {
    if (window.ethereum && !forceDemo) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      return { provider, signer, address: await signer.getAddress() };
    }
    // No wallet extension (or demo forced) — sign with the hardhat admin account directly
    const provider = new ethers.JsonRpcProvider('http://localhost:8545');
    const signer = new ethers.Wallet(DEMO_PRIVATE_KEY, provider);
    return { provider, signer, address: signer.address };
  };

  const handleConnectWallet = async () => {
    try {
      const { provider, address } = await getProviderAndSigner();
      setIsDemoMode(!window.ethereum || forceDemo);
      setWalletAddress(address);
      const adminAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'.toLowerCase();
      if (address.toLowerCase() === adminAddress) {
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

  // Force demo admin mode even when a wallet extension is installed
  const handleDemoAdmin = async () => {
    setForceDemo(true);
    setIsDemoMode(true);
    setIsAdmin(true);
    setWalletAddress('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    setWalletChecked(true);
    setTransactionStatus('');
  };

  // Satellite & Drone Fleet Feed (demo) state
  const [fleetPhase, setFleetPhase] = useState<'idle' | 'scanning' | 'done'>('idle');
  const [feedLines, setFeedLines] = useState<string[]>([]);
  const [fleetHomes, setFleetHomes] = useState([
    { id: 'UK-LON-0012', owner: 'Daniel Abraham', address: '12 Kings Road, London', status: 'idle', damagePct: 0, payout: 0, paidOut: false },
    { id: 'UK-LON-0047', owner: 'Sarah Mitchell', address: '47 Abbey Road, London', status: 'idle', damagePct: 0, payout: 0, paidOut: false },
    { id: 'UK-MAN-0231', owner: 'James Whitfield', address: '231 Deansgate, Manchester', status: 'idle', damagePct: 0, payout: 0, paidOut: false },
    { id: 'UK-BHM-0098', owner: 'Priya Sharma', address: '98 Broad Street, Birmingham', status: 'idle', damagePct: 0, payout: 0, paidOut: false },
  ]);

  const runFleetScan = async () => {
    setFleetPhase('scanning');
    setFeedLines([]);
    setFleetHomes(prev => prev.map(h => ({ ...h, status: 'idle', damagePct: 0, paidOut: false, payout: 0 })));

    const pushLine = (line: string) => setFeedLines(prev => [...prev, line]);

    // Real geolocation for the first monitored home
    const geo = await getCurrentPosition();
    const coordsLabel = formatCoords(geo);

    // Home 1: satellite pass → clean
    await new Promise(r => setTimeout(r, 1200));
    pushLine(`SAT-01 ▸ UK-LON-0012: geolocation locked (${coordsLabel})`);
    setFleetHomes(prev => prev.map(h => h.id === 'UK-LON-0012' ? { ...h, status: 'scanning' } : h));
    await new Promise(r => setTimeout(r, 1200));
    pushLine('DRN-03 ▸ UK-LON-0012: imagery analyzed — NO structural damage');
    setFleetHomes(prev => prev.map(h => h.id === 'UK-LON-0012' ? { ...h, status: 'checked' } : h));

    // Home 2: drone confirms damage → payout
    await new Promise(r => setTimeout(r, 1200));
    pushLine('SAT-02 ▸ UK-LON-0047: geolocation locked (51.5320°N, 0.1230°W)');
    setFleetHomes(prev => prev.map(h => h.id === 'UK-LON-0047' ? { ...h, status: 'scanning' } : h));
    await new Promise(r => setTimeout(r, 1200));
    pushLine('DRN-01 ▸ UK-LON-0047: ⚠ DAMAGE — 92% structural damage confirmed');
    setFleetHomes(prev => prev.map(h => h.id === 'UK-LON-0047' ? { ...h, status: 'damaged', damagePct: 92 } : h));
    await new Promise(r => setTimeout(r, 1000));
    pushLine('GOV-DB ▸ UK-LON-0047: owner verified — Sarah Mitchell');
    pushLine('PAYOUT ▸ 3.5 ETH sent instantly to 0x71C...9eF2 (Sarah Mitchell)');
    setFleetHomes(prev => prev.map(h => h.id === 'UK-LON-0047' ? { ...h, paidOut: true, payout: 3.5 } : h));

    // Home 3: clean
    await new Promise(r => setTimeout(r, 1200));
    pushLine('SAT-01 ▸ UK-MAN-0231: geolocation locked (53.4808°N, 2.2426°W)');
    setFleetHomes(prev => prev.map(h => h.id === 'UK-MAN-0231' ? { ...h, status: 'scanning' } : h));
    await new Promise(r => setTimeout(r, 1200));
    pushLine('DRN-04 ▸ UK-MAN-0231: imagery analyzed — NO structural damage');
    setFleetHomes(prev => prev.map(h => h.id === 'UK-MAN-0231' ? { ...h, status: 'checked' } : h));

    // Home 4: minor damage → payout
    await new Promise(r => setTimeout(r, 1200));
    pushLine('SAT-02 ▸ UK-BHM-0098: geolocation locked (52.4862°N, 1.8904°W)');
    setFleetHomes(prev => prev.map(h => h.id === 'UK-BHM-0098' ? { ...h, status: 'scanning' } : h));
    await new Promise(r => setTimeout(r, 1200));
    pushLine('DRN-02 ▸ UK-BHM-0098: ⚠ DAMAGE — 61% structural damage confirmed');
    setFleetHomes(prev => prev.map(h => h.id === 'UK-BHM-0098' ? { ...h, status: 'damaged', damagePct: 61 } : h));
    await new Promise(r => setTimeout(r, 1000));
    pushLine('GOV-DB ▸ UK-BHM-0098: owner verified — Priya Sharma');
    pushLine('PAYOUT ▸ 2.0 ETH sent instantly to 0x3Ae...77c1 (Priya Sharma)');
    setFleetHomes(prev => prev.map(h => h.id === 'UK-BHM-0098' ? { ...h, paidOut: true, payout: 2.0 } : h));

    await new Promise(r => setTimeout(r, 800));
    pushLine('FLEET ▸ Scan complete — 2 payouts issued, 2 homes clear');
    setFleetPhase('done');
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
      try {
        const { provider, address } = await getProviderAndSigner();
        setIsDemoMode(!window.ethereum);
        if (window.ethereum) {
          // Ensure we're on the correct network
          await switchToLocalNetwork();
          
          const network = await provider.getNetwork();
          console.log('Connected to network:', network.chainId);
        }
        
        setWalletAddress(address);
        const balance = await provider.getBalance(address);
        setEthBalance(Number(ethers.formatEther(balance)));
        
        const contract = new ethers.Contract(PARAMIFY_ADDRESS, PARAMIFY_ABI, provider);
        try {
          const contractBal = await contract.getContractBalance();
          setContractBalance(Number(ethers.formatEther(contractBal)));
          const latestFlood = await contract.getLatestPrice();
          setFloodLevel(Number(latestFlood));
          
          // Fetch current threshold
          try {
            const currentThreshold = await contract.floodThreshold();
            setThreshold(Number(currentThreshold));
            setThresholdInFeet(Number(currentThreshold) / 100000000000);
          } catch (e) {
            console.log('Could not fetch threshold:', e);
          }
        } catch (e) {
          console.log('Contract calls failed, contract may not be deployed yet:', e);
        }
      } catch (e) {
        console.error('Failed to connect to network:', e);
        setTransactionStatus('Please connect to Hardhat Local network (Chain ID: 31337)');
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchAdminStatus = async () => {
      try {
        const { provider, address } = await getProviderAndSigner();
        setIsDemoMode(!window.ethereum);
        if (window.ethereum) await switchToLocalNetwork();
        const contract = new ethers.Contract(PARAMIFY_ADDRESS, PARAMIFY_ABI, provider);
        // Contract grants DEFAULT_ADMIN_ROLE (bytes32 zero) to the deployer
        const isAdmin = await contract.hasRole(ethers.ZeroHash, address);
        setIsAdmin(isAdmin);
      } catch (e) {
        setIsAdmin(false);
      }
    };
    fetchAdminStatus();
  }, []);

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

  const handleManualUSGSUpdate = async () => {
    try {
      setTransactionStatus('Triggering USGS data update...');
      const result = await usgsApi.triggerManualUpdate();
      if (result.success) {
        setTransactionStatus('USGS data updated successfully!');
        // Refresh service status
        const status = await usgsApi.getStatus();
        setServiceStatus(status);
      }
    } catch (error) {
      console.error('Failed to trigger manual update:', error);
      setTransactionStatus('Failed to update USGS data');
    }
    setTimeout(() => setTransactionStatus(''), 5000);
  };

  const calculatePremium = (coverage: number) => coverage * 0.1;

  const handleCoverageChange = (value: string) => {
    setCoverageAmount(value);
    const coverage = parseFloat(value) || 0;
    setPremium(calculatePremium(coverage));
  };

  const handleUpdateThreshold = async () => {
    if (!newThresholdFeet) return;
    
    const thresholdValue = parseFloat(newThresholdFeet);
    if (isNaN(thresholdValue) || thresholdValue <= 0) {
      setTransactionStatus('Invalid threshold value. Must be a positive number.');
      setTimeout(() => setTransactionStatus(''), 5000);
      return;
    }
    
    if (thresholdValue > 100) {
      setTransactionStatus('Threshold too high. Maximum is 100 feet.');
      setTimeout(() => setTransactionStatus(''), 5000);
      return;
    }
    
    setIsUpdatingThreshold(true);
    setTransactionStatus('Updating threshold...');
    
    try {
      const response = await fetch('http://localhost:3001/api/threshold', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ thresholdFeet: thresholdValue })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setTransactionStatus('Threshold updated successfully!');
        setThresholdInFeet(data.thresholdFeet);
        setThreshold(Number(data.thresholdUnits));
        setNewThresholdFeet(""); // Clear input
        
        // Refresh service status
        const status = await usgsApi.getStatus();
        setServiceStatus(status);
      } else {
        throw new Error(data.error || 'Failed to update threshold');
      }
    } catch (e: any) {
      console.error('Threshold update error:', e);
      setTransactionStatus(`Threshold update failed! ${e.message || 'Unknown error'}`);
    }
    
    setIsUpdatingThreshold(false);
    setTimeout(() => setTransactionStatus(''), 5000);
  };

  const handleBuyInsurance = async () => {
    if (!coverageAmount) return;
    setIsLoading(true);
    setTransactionStatus('Processing insurance purchase...');
    try {
      const { provider, signer } = await getProviderAndSigner();
      const contract = new ethers.Contract(PARAMIFY_ADDRESS, PARAMIFY_ABI, signer);
      const coverage = ethers.parseEther(coverageAmount);
      const calculatedPremium = ethers.parseEther(premium.toString());
      const tx = await contract.buyInsurance(coverage, { value: calculatedPremium });
      await tx.wait();
      setTransactionStatus('Insurance purchased successfully!');
      setHasActivePolicy(true);
      setInsuranceAmount(parseFloat(coverageAmount));
      const balance = await provider.getBalance(walletAddress);
      setEthBalance(Number(ethers.formatEther(balance)));
      const contractBal = await contract.getContractBalance();
      setContractBalance(Number(ethers.formatEther(contractBal)));
    } catch (e: any) {
      console.error('Insurance purchase error:', e);
      setTransactionStatus(`Insurance purchase failed! ${e.reason || e.message || 'Unknown error'}`);
    }
    setIsLoading(false);
    setTimeout(() => setTransactionStatus(''), 5000);
  };

  const handleFundContract = async () => {
    if (!fundAmount) return;
    setIsFunding(true);
    setTransactionStatus('Funding contract...');
    try {
      const { provider, signer } = await getProviderAndSigner();
      
      // Check network (only when a wallet extension is in play)
      if (window.ethereum) {
        await switchToLocalNetwork();
        const network = await provider.getNetwork();
        if (network.chainId !== 31337n) {
          throw new Error('Please switch to Hardhat Local network (Chain ID: 31337)');
        }
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
    setIsLoading(true);
    setTransactionStatus('Triggering payout...');
    try {
      const { provider, signer } = await getProviderAndSigner();
      const contract = new ethers.Contract(PARAMIFY_ADDRESS, PARAMIFY_ABI, signer);
      const tx = await contract.triggerPayout();
      await tx.wait();
      setTransactionStatus('Payout triggered successfully!');
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
    setTimeout(() => setTransactionStatus(''), 5000);
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

  // Auto-connect in demo mode (no wallet extension) so the connect gate is skipped
  useEffect(() => {
    if (!window.ethereum) {
      handleConnectWallet();
    }
  }, []);

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
          <div className="mt-4">
            <button
              onClick={handleDemoAdmin}
              className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-700 transition-all"
            >
              ⚡ Continue as Demo Admin (no wallet needed)
            </button>
          </div>
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
            onClick={handleDemoAdmin}
            className="mt-4 px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-semibold hover:from-cyan-600 hover:to-blue-700 transition-all"
          >
            ⚡ Continue as Demo Admin
          </button>
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
                <Waves className="h-8 w-8 text-white" />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {isDemoMode && (
                <div className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                  ⚡ DEMO
                </div>
              )}
              <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                👑 ADMIN
              </div>
            </div>
          </div>
          <div className="mb-4">
            <p className="text-gray-300 text-sm mb-2">Paramify Logo</p>
            <h1 className="text-3xl font-bold text-white mb-2">
              Paramify
            </h1>
            <p className="text-gray-300 text-lg">
              Satellite and drone damage detection with instant payouts.
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

          {false && (
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
              {isAdmin && (
                <div className="bg-black/20 rounded-lg p-4 mt-2">
                  <h4 className="text-white font-medium mb-3 flex items-center">
                    <Shield className="h-4 w-4 mr-2 text-yellow-300" />
                    Threshold Management
                  </h4>
                  <div className="bg-black/30 rounded-lg p-3 mb-3">
                    <p className="text-gray-400 text-xs mb-1">Current Threshold</p>
                    <p className="text-white font-bold">{thresholdInFeet.toFixed(1)} feet</p>
                    <p className="text-gray-400 text-xs mt-1">= {threshold.toFixed(0)} units</p>
                  </div>
                  <div className="space-y-3">
                    <input
                      type="number"
                      value={newThresholdFeet}
                      onChange={(e) => setNewThresholdFeet(e.target.value)}
                      className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      placeholder="New threshold (feet)"
                      step="0.1"
                      min="0"
                      max="100"
                    />
                    <button
                      onClick={handleUpdateThreshold}
                      disabled={isUpdatingThreshold || !newThresholdFeet}
                      className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none"
                    >
                      {isUpdatingThreshold ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Updating...
                        </div>
                      ) : (
                        'Update Threshold'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}

          {false && (
          // USGS Data Integration Status (hidden for demo)
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Activity className="mr-2 h-5 w-5 text-green-300" />
              USGS Real-Time Data
            </h3>
            <div className="bg-black/20 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${isBackendConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                  <span className={`text-sm font-medium ${isBackendConnected ? 'text-green-300' : 'text-red-300'}`}>
                    {isBackendConnected ? 'Connected to USGS Service' : 'USGS Service Disconnected'}
                  </span>
                </div>
                <button
                  onClick={handleManualUSGSUpdate}
                  disabled={!isBackendConnected}
                  className="flex items-center space-x-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white px-3 py-1 rounded-lg text-sm transition-all duration-200"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Manual Update</span>
                </button>
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
                    ⚠️ USGS service not running. Start the backend server to enable automatic updates.
                  </p>
                  <p className="text-yellow-200/70 text-xs mt-1">
                    Run: cd backend && npm start
                  </p>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Satellite & Drone Fleet Feed (demo) */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Satellite className="mr-2 h-5 w-5 text-cyan-300" />
              Satellite &amp; Drone Fleet Feed
            </h3>
            <div className="bg-black/20 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${fleetPhase === 'scanning' ? 'bg-cyan-400 animate-pulse' : fleetPhase === 'done' ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                  <span className={`text-sm font-medium ${fleetPhase === 'done' ? 'text-green-300' : 'text-cyan-200'}`}>
                    {fleetPhase === 'idle' && 'Fleet online — 4 drones, 2 satellites monitoring portfolio'}
                    {fleetPhase === 'scanning' && 'Fleet scanning portfolio...'}
                    {fleetPhase === 'done' && 'Scan complete — payouts issued'}
                  </span>
                </div>
                <button
                  onClick={runFleetScan}
                  disabled={fleetPhase === 'scanning'}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200 shadow-lg flex items-center"
                >
                  <Radar className="h-4 w-4 mr-2" />
                  {fleetPhase === 'scanning' ? 'Scanning...' : 'Run Fleet Scan'}
                </button>
              </div>

              {/* Monitored homes */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {fleetHomes.map((home) => (
                  <div key={home.id} className={`bg-black/30 rounded-lg p-3 border ${home.status === 'damaged' ? 'border-red-400/40' : home.status === 'checked' ? 'border-green-400/30' : 'border-white/10'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-300 text-xs font-mono">{home.id}</span>
                      {home.status === 'damaged' && <span className="bg-red-500/30 text-red-300 text-xs px-2 py-0.5 rounded-full font-semibold">⚠ DAMAGE</span>}
                      {home.status === 'checked' && <span className="bg-green-500/30 text-green-300 text-xs px-2 py-0.5 rounded-full font-semibold">✓ OK</span>}
                      {home.status === 'scanning' && <span className="bg-cyan-500/30 text-cyan-300 text-xs px-2 py-0.5 rounded-full font-semibold animate-pulse">◉ SCANNING</span>}
                      {home.status === 'idle' && <span className="bg-gray-500/30 text-gray-400 text-xs px-2 py-0.5 rounded-full font-semibold">○ QUEUED</span>}
                    </div>
                    <p className="text-white text-sm font-medium">{home.owner}</p>
                    <p className="text-gray-400 text-xs">{home.address}</p>
                    {home.damagePct > 0 && (
                      <p className="text-red-300 text-xs mt-1 font-semibold">{home.damagePct}% structural damage</p>
                    )}
                    {home.paidOut && (
                      <p className="text-green-300 text-xs mt-1">💰 {home.payout} ETH paid to owner</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Live signal feed */}
              <div className="bg-black/30 rounded-lg p-3 max-h-32 overflow-y-auto">
                <p className="text-gray-400 text-xs mb-2 font-medium">📡 Incoming satellite / drone telemetry</p>
                {feedLines.length === 0 ? (
                  <p className="text-gray-500 text-xs">Waiting for fleet scan...</p>
                ) : (
                  feedLines.map((line, i) => (
                    <p key={i} className={`text-xs font-mono ${line.includes('PAYOUT') ? 'text-green-300 font-semibold' : line.includes('DAMAGE') ? 'text-red-300' : 'text-cyan-200/80'}`}>
                      {line}
                    </p>
                  ))
                )}
              </div>

              {fleetPhase === 'idle' && (
                <p className="text-gray-400 text-sm mt-3">
                  Demo: insurer-side view of satellite geolocation + drone damage detection with automatic payout to registered owners.
                </p>
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
                  <h4 className="text-green-200 font-semibold text-lg mb-4">✓ Active Insurance Policy</h4>
                  <div className="space-y-2">
                    <p className="text-white"><span className="text-green-300">Coverage:</span> {insuranceAmount.toFixed(1)} ETH</p>
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
                              Triggering...
                            </div>
                          ) : (
                            '🚨 Trigger Emergency Payout'
                          )}
                        </button>
                        <p className="text-red-300 text-sm mt-2">⚠️ Flood threshold exceeded - payout available</p>
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
                      value={coverageAmount}
                      onChange={(e) => handleCoverageChange(e.target.value)}
                      className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Coverage amount (ETH)"
                    />
                    <div className="bg-black/30 rounded-lg p-3">
                      <p className="text-gray-300">Premium: <span className="text-white font-bold">{premium.toFixed(1)} ETH</span></p>
                    </div>
                    <button
                      onClick={handleBuyInsurance}
                      disabled={isLoading || !coverageAmount || parseFloat(coverageAmount) <= 0}
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
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-black/20 rounded-lg p-4">
                <p className="text-gray-300 text-sm">Insurance Amount</p>
                <p className="text-white font-bold text-lg">{insuranceAmount} units</p>
              </div>
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
