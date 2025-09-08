import React, { useState, useEffect } from "react";
import { Waves, Shield, TrendingUp, Wallet, AlertCircle, CheckCircle, ArrowLeft, Activity, RefreshCw } from "lucide-react";
import { getCurrentPrincipal, formatPrincipal, isAuthenticated, createPolicy, getPolicies, claimPayout } from "../lib/icp";
import { usgsApi, formatTimestamp, getTimeUntilNextUpdate, type ServiceStatus } from "../lib/usgsApi";

interface IndividualDashboardProps {
  setUserType: (type: null) => void;
}

interface Policy {
  id: string;
  principal: string;
  coverageAmount: number;
  premium: number;
  isActive: boolean;
  createdAt: string;
  thresholdExceeded: boolean;
  claimedAt?: string;
}

export default function IndividualDashboard({ setUserType }: IndividualDashboardProps) {
  const [principal, setPrincipal] = useState<string>("");
  const [floodLevel, setFloodLevel] = useState<number>(0);
  const [threshold, setThreshold] = useState<number>(12);
  const [thresholdUnits, setThresholdUnits] = useState<number>(1200000000000);
  const [coverageAmount, setCoverageAmount] = useState<string>("1");
  const [premium, setPremium] = useState<number>(0.1);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [activePolicy, setActivePolicy] = useState<Policy | null>(null);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [nextUpdateCountdown, setNextUpdateCountdown] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [walletBalance, setWalletBalance] = useState<number>(100); // Simulated wallet balance

  useEffect(() => {
    if (isAuthenticated()) {
      const currentPrincipal = getCurrentPrincipal();
      if (currentPrincipal) {
        setPrincipal(formatPrincipal(currentPrincipal));
        loadPolicies();
      }
    }
    
    // Load saved threshold from localStorage (shared with admin)
    const savedThreshold = localStorage.getItem('floodThreshold');
    if (savedThreshold) {
      const thresholdValue = parseFloat(savedThreshold);
      setThreshold(thresholdValue);
      setThresholdUnits(thresholdValue * 100000000000);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch the real USGS data from the backend
        const response = await fetch('http://localhost:3001/flood-data');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Real USGS data received:', data);
        
        // Handle the actual backend response format
        const floodLevel = data.level || 0;
        
        setFloodLevel(floodLevel);
        setIsBackendConnected(true);
        setMessage(`✅ Connected to real USGS data - ${data.stationName}`);
        
        // Set service status with real data
        setServiceStatus({
          currentFloodLevel: floodLevel,
          oracleValue: floodLevel,
          threshold: {
            thresholdFeet: threshold,
            thresholdUnits: thresholdUnits
          },
          lastUpdate: data.timestamp,
          nextUpdate: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          site: {
            name: data.stationName,
            siteId: data.stationId
          }
        });
        
      } catch (error) {
        console.error("Failed to fetch USGS data:", error);
        setIsBackendConnected(false);
        setMessage("❌ Backend connection failed");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [threshold]); // Re-fetch when threshold changes

  useEffect(() => {
    if (serviceStatus?.nextUpdate) {
      const updateCountdown = () => {
        setNextUpdateCountdown(getTimeUntilNextUpdate(serviceStatus.nextUpdate));
      };
      updateCountdown();
      const interval = setInterval(updateCountdown, 1000);
      return () => clearInterval(interval);
    }
  }, [serviceStatus]);

  const loadPolicies = async () => {
    try {
      const userPolicies = await getPolicies();
      setPolicies(userPolicies);
      
      // Find active policy
      const active = userPolicies.find(p => p.isActive);
      setActivePolicy(active || null);
    } catch (error) {
      console.error("Failed to load policies:", error);
    }
  };

  const handleCoverageChange = (value: string) => {
    setCoverageAmount(value);
    const amount = parseFloat(value) || 0;
    setPremium(amount * 0.1); // 10% premium rate
  };

  const handleBuyInsurance = async () => {
    try {
      setIsLoading(true);
      const amount = parseFloat(coverageAmount);
      
      if (amount <= 0) {
        setMessage("❌ Coverage amount must be greater than 0");
        return;
      }
      
      if (amount > walletBalance) {
        setMessage("❌ Insufficient wallet balance");
        return;
      }
      
      const result = await createPolicy(amount);
      if (result.success) {
        setWalletBalance(walletBalance - amount); // Deduct from wallet
        setMessage(`✅ Insurance policy purchased! Coverage: $${coverageAmount}M`);
        await loadPolicies(); // Reload policies
      } else {
        setMessage("❌ Failed to purchase insurance");
      }
    } catch (error) {
      console.error("Failed to buy insurance:", error);
      setMessage("❌ Failed to purchase insurance");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimPayout = async () => {
    if (!activePolicy) return;
    
    try {
      setIsLoading(true);
      const result = await claimPayout(activePolicy.id);
      if (result.success) {
        const payoutAmount = activePolicy.coverageAmount;
        setWalletBalance(walletBalance + payoutAmount); // Add to wallet
        setMessage(`✅ Payout claimed! Amount: $${payoutAmount.toFixed(1)}M`);
        await loadPolicies(); // Reload policies
      } else {
        setMessage("❌ Failed to claim payout");
      }
    } catch (error) {
      console.error("Failed to claim payout:", error);
      setMessage("❌ Failed to claim payout");
    } finally {
      setIsLoading(false);
    }
  };

  const isThresholdExceeded = floodLevel >= threshold;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => setUserType(null)}
            className="flex items-center space-x-2 text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Main</span>
          </button>
          <div className="text-right">
            <p className="text-white/60 text-sm">Connected as:</p>
            <p className="text-white font-mono text-sm">{principal}</p>
          </div>
        </div>

        <h1 className="text-4xl font-bold text-white mb-8 text-center">
          Customer Dashboard
        </h1>

        {/* Wallet Balance */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white flex items-center">
              <Wallet className="h-6 w-6 mr-2" />
              Wallet Balance
            </h2>
            <div className="text-right">
              <p className="text-3xl font-bold text-white">${walletBalance.toFixed(1)}M</p>
              <p className="text-white/60 text-sm">Internet Identity Wallet</p>
            </div>
          </div>
        </div>

        {/* USGS Data Status */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center">
              <Activity className="h-6 w-6 mr-2" />
              USGS Data Status
            </h2>
            <div className="flex items-center space-x-2">
              {isBackendConnected ? (
                <CheckCircle className="h-5 w-5 text-green-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-400" />
              )}
              <span className={`text-sm ${isBackendConnected ? 'text-green-400' : 'text-red-400'}`}>
                {isBackendConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          
          {serviceStatus && (
            <div className="grid md:grid-cols-3 gap-4 text-white/80">
              <div>
                <p className="text-sm">Last Update:</p>
                <p className="font-mono">{formatTimestamp(serviceStatus.lastUpdate)}</p>
              </div>
              <div>
                <p className="text-sm">Next Update:</p>
                <p className="font-mono">{nextUpdateCountdown}</p>
              </div>
              <div>
                <p className="text-sm">Station:</p>
                <p className="font-mono">{serviceStatus.site?.name || 'Unknown'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Flood Level Display */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 mb-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-6">Current Flood Level</h2>
            <div className="relative">
              <div className="text-6xl font-bold text-white mb-4">
                {floodLevel.toFixed(2)} ft
              </div>
              <div className="text-xl text-white/80 mb-6">
                Threshold: {threshold} ft
              </div>
              
              {/* Visual indicator */}
              <div className="w-full bg-gray-700 rounded-full h-8 mb-6">
                <div 
                  className={`h-8 rounded-full transition-all duration-500 ${
                    isThresholdExceeded 
                      ? 'bg-gradient-to-r from-red-500 to-red-600' 
                      : 'bg-gradient-to-r from-green-500 to-green-600'
                  }`}
                  style={{ 
                    width: `${Math.min((floodLevel / threshold) * 100, 100)}%` 
                  }}
                ></div>
              </div>
              
              <div className="flex items-center justify-center space-x-2">
                {isThresholdExceeded ? (
                  <>
                    <AlertCircle className="h-6 w-6 text-red-400" />
                    <span className="text-red-400 text-xl font-semibold">
                      THRESHOLD EXCEEDED - INSURANCE TRIGGERED
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-6 w-6 text-green-400" />
                    <span className="text-green-400 text-xl font-semibold">
                      Within Safe Limits
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Insurance Policy Section */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Buy Insurance */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
              <Shield className="h-6 w-6 mr-2" />
              Buy Insurance
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-white/80 text-sm mb-2">
                  Coverage Amount (Millions)
                </label>
                <input
                  type="number"
                  value={coverageAmount}
                  onChange={(e) => handleCoverageChange(e.target.value)}
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="1.0"
                  min="0.1"
                  max={walletBalance}
                  step="0.1"
                />
              </div>
              
              <div className="bg-white/10 rounded-lg p-4">
                <p className="text-white/80 text-sm">Premium (10%):</p>
                <p className="text-2xl font-bold text-white">${premium.toFixed(1)}M</p>
              </div>
              
              <button
                onClick={handleBuyInsurance}
                disabled={isLoading || activePolicy?.isActive || parseFloat(coverageAmount) > walletBalance}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-500 disabled:to-gray-600 text-white text-lg py-4 px-6 rounded-lg font-semibold transition-all duration-200"
              >
                {isLoading ? (
                  <RefreshCw className="inline h-5 w-5 animate-spin mr-2" />
                ) : (
                  <Wallet className="inline h-5 w-5 mr-2" />
                )}
                {activePolicy?.isActive ? 'Policy Active' : 'Buy Insurance'}
              </button>
            </div>
          </div>

          {/* Current Policy */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
              <TrendingUp className="h-6 w-6 mr-2" />
              Current Policy
            </h3>
            
            {activePolicy ? (
              <div className="space-y-4">
                <div className="bg-white/10 rounded-lg p-4">
                  <p className="text-white/80 text-sm">Coverage Amount:</p>
                  <p className="text-2xl font-bold text-white">${activePolicy.coverageAmount.toFixed(1)}M</p>
                </div>
                
                <div className="bg-white/10 rounded-lg p-4">
                  <p className="text-white/80 text-sm">Premium Paid:</p>
                  <p className="text-xl font-bold text-white">${activePolicy.premium.toFixed(1)}M</p>
                </div>
                
                <div className="bg-white/10 rounded-lg p-4">
                  <p className="text-white/80 text-sm">Status:</p>
                  <p className={`text-xl font-bold ${isThresholdExceeded ? 'text-red-400' : 'text-green-400'}`}>
                    {isThresholdExceeded ? 'Payout Available' : 'Active'}
                  </p>
                </div>
                
                <div className="bg-white/10 rounded-lg p-4">
                  <p className="text-white/80 text-sm">Policy ID:</p>
                  <p className="text-sm font-mono text-white/60">{activePolicy.id}</p>
                </div>
                
                {isThresholdExceeded && (
                  <button
                    onClick={handleClaimPayout}
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white text-lg py-4 px-6 rounded-lg font-semibold transition-all duration-200"
                  >
                    {isLoading ? (
                      <RefreshCw className="inline h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <Wallet className="inline h-5 w-5 mr-2" />
                    )}
                    Claim Payout
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center text-white/60">
                <Shield className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>No active insurance policy</p>
                <p className="text-sm">Buy insurance to protect your property</p>
              </div>
            )}
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className="mt-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6">
            <p className="text-white text-center text-lg">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
