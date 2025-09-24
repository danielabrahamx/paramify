import React, { useState, useEffect } from "react";
import { Waves, Shield, TrendingUp, Wallet, AlertCircle, CheckCircle, ArrowLeft, Activity, RefreshCw, Settings, DollarSign } from "lucide-react";
import { getCurrentPrincipal, formatPrincipal, isAuthenticated, isAdminPrincipal, updateThreshold, fundContract } from "../lib/icp";
import { usgsApi, formatTimestamp, getTimeUntilNextUpdate, type ServiceStatus } from "../lib/usgsApi";

interface AdminDashboardProps {
  setUserType: (type: null) => void;
}

export default function AdminDashboard({ setUserType }: AdminDashboardProps) {
  const [principal, setPrincipal] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [floodLevel, setFloodLevel] = useState<number>(0);
  const [threshold, setThreshold] = useState<number>(12);
  const [thresholdUnits, setThresholdUnits] = useState<number>(1200000000000);
  const [newThresholdFeet, setNewThresholdFeet] = useState<string>("");
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);
  const [nextUpdateCountdown, setNextUpdateCountdown] = useState<string>("");
  const [isUpdatingThreshold, setIsUpdatingThreshold] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [contractBalance, setContractBalance] = useState<number>(1000); // Simulated
  const [fundAmount, setFundAmount] = useState<string>("");
  const [isFunding, setIsFunding] = useState<boolean>(false);

  useEffect(() => {
    if (isAuthenticated()) {
      const currentPrincipal = getCurrentPrincipal();
      if (currentPrincipal) {
        setPrincipal(formatPrincipal(currentPrincipal));
        setIsAdmin(isAdminPrincipal(currentPrincipal));
      }
    }
    
    // Load saved threshold from localStorage
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

  const handleUpdateThreshold = async () => {
    try {
      setIsUpdatingThreshold(true);
      const thresholdFeet = parseFloat(newThresholdFeet);
      
      if (thresholdFeet <= 0 || thresholdFeet > 100) {
        setMessage("❌ Threshold must be between 0.1 and 100 feet");
        return;
      }

      // Update threshold in localStorage
      localStorage.setItem('floodThreshold', thresholdFeet.toString());
      
      // Simulate ICP call
      await updateThreshold(thresholdFeet);
      
      setThreshold(thresholdFeet);
      setThresholdUnits(thresholdFeet * 100000000000);
      setNewThresholdFeet("");
      setMessage(`✅ Threshold updated to ${thresholdFeet} feet`);
    } catch (error) {
      setMessage("❌ Failed to update threshold");
    } finally {
      setIsUpdatingThreshold(false);
    }
  };

  const handleFundContract = async () => {
    try {
      setIsFunding(true);
      const amount = parseFloat(fundAmount);
      
      if (amount <= 0) {
        setMessage("❌ Fund amount must be greater than 0");
        return;
      }

      // Simulate ICP call
      await fundContract(amount);
      
      setContractBalance(contractBalance + amount);
      setFundAmount("");
      setMessage(`✅ Contract funded with $${amount}M`);
    } catch (error) {
      setMessage("❌ Failed to fund contract");
    } finally {
      setIsFunding(false);
    }
  };

  const handleTriggerPayout = async () => {
    try {
      setIsLoading(true);
      // Simulate ICP call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setMessage("✅ Payout triggered for all eligible policies");
    } catch (error) {
      setMessage("❌ Failed to trigger payout");
    } finally {
      setIsLoading(false);
    }
  };

  const isThresholdExceeded = floodLevel >= threshold;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-400" />
          <h1 className="text-3xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-white/80 mb-8">You don't have admin privileges</p>
          <button
            onClick={() => setUserType(null)}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200"
          >
            Back to Main
          </button>
        </div>
      </div>
    );
  }

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
            <p className="text-white/60 text-sm">Admin:</p>
            <p className="text-white font-mono text-sm">{principal}</p>
          </div>
        </div>

        <h1 className="text-4xl font-bold text-white mb-8 text-center">
          Admin Dashboard
        </h1>

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
                      THRESHOLD EXCEEDED - PAYOUTS TRIGGERED
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

        {/* Admin Controls */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Threshold Management */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
              <Settings className="h-6 w-6 mr-2" />
              Threshold Management
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-white/80 text-sm mb-2">
                  New Threshold (feet)
                </label>
                <input
                  type="number"
                  value={newThresholdFeet}
                  onChange={(e) => setNewThresholdFeet(e.target.value)}
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="12.0"
                  min="0.1"
                  max="100"
                  step="0.1"
                />
              </div>
              
              <button
                onClick={handleUpdateThreshold}
                disabled={isUpdatingThreshold || !newThresholdFeet}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-500 disabled:to-gray-600 text-white text-lg py-4 px-6 rounded-lg font-semibold transition-all duration-200"
              >
                {isUpdatingThreshold ? (
                  <RefreshCw className="inline h-5 w-5 animate-spin mr-2" />
                ) : (
                  <Settings className="inline h-5 w-5 mr-2" />
                )}
                Update Threshold
              </button>
            </div>
          </div>

          {/* Contract Funding */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
              <DollarSign className="h-6 w-6 mr-2" />
              Contract Funding
            </h3>
            
            <div className="space-y-4">
              <div className="bg-white/10 rounded-lg p-4">
                <p className="text-white/80 text-sm">Current Balance:</p>
                <p className="text-2xl font-bold text-white">${contractBalance}M</p>
              </div>
              
              <div>
                <label className="block text-white/80 text-sm mb-2">
                  Fund Amount (Millions)
                </label>
                <input
                  type="number"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="10.0"
                  min="0.1"
                  max="1000"
                  step="0.1"
                />
              </div>
              
              <button
                onClick={handleFundContract}
                disabled={isFunding || !fundAmount}
                className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:from-gray-500 disabled:to-gray-600 text-white text-lg py-4 px-6 rounded-lg font-semibold transition-all duration-200"
              >
                {isFunding ? (
                  <RefreshCw className="inline h-5 w-5 animate-spin mr-2" />
                ) : (
                  <DollarSign className="inline h-5 w-5 mr-2" />
                )}
                Fund Contract
              </button>
            </div>
          </div>
        </div>

        {/* Payout Controls */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 mb-8">
          <h3 className="text-2xl font-bold text-white mb-6 flex items-center">
            <TrendingUp className="h-6 w-6 mr-2" />
            Payout Management
          </h3>
          
          <div className="text-center">
            <p className="text-white/80 mb-6">
              {isThresholdExceeded 
                ? "Threshold exceeded - payouts are automatically triggered"
                : "Payouts will be triggered when flood level exceeds threshold"
              }
            </p>
            
            <button
              onClick={handleTriggerPayout}
              disabled={isLoading || !isThresholdExceeded}
              className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 disabled:from-gray-500 disabled:to-gray-600 text-white text-lg py-4 px-8 rounded-lg font-semibold transition-all duration-200"
            >
              {isLoading ? (
                <RefreshCw className="inline h-5 w-5 animate-spin mr-2" />
              ) : (
                <TrendingUp className="inline h-5 w-5 mr-2" />
              )}
              {isThresholdExceeded ? 'Trigger Payouts' : 'Payouts Disabled'}
            </button>
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
