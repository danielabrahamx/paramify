import React, { useState, useEffect } from "react";
import { Waves, Shield, Wallet, Building2 } from "lucide-react";
import { loginWithInternetIdentity, getCurrentPrincipal, isAuthenticated, formatPrincipal } from "./lib/icp";
import { Principal } from "@dfinity/principal";
import IndividualDashboard from "./components/IndividualDashboard";
import AdminDashboard from "./components/AdminDashboard";

function App() {
  const [principal, setPrincipal] = useState<Principal | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userType, setUserType] = useState<"individual" | "company" | null>(null);

  useEffect(() => {
    // Check if already authenticated
    if (isAuthenticated()) {
      const currentPrincipal = getCurrentPrincipal();
      if (currentPrincipal) {
        setPrincipal(currentPrincipal);
        setIsConnected(true);
      }
    }
  }, []);

  const connectInternetIdentity = async () => {
    try {
      const principal = await loginWithInternetIdentity();
      if (principal) {
        setPrincipal(principal);
        setIsConnected(true);
      } else {
        alert("Failed to connect to Internet Identity");
      }
    } catch (error) {
      console.error("Connection error:", error);
      alert("Error connecting to Internet Identity");
    }
  };

  const handleAccessType = (type: "individual" | "company") => {
    setUserType(type);
  };

  if (userType === "individual") {
    return <IndividualDashboard setUserType={setUserType} />;
  }

  if (userType === "company") {
    return <AdminDashboard setUserType={setUserType} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <Waves className="h-12 w-12 text-white" />
            <h1 className="text-5xl font-bold text-white">Paramify ICP</h1>
          </div>
          <p className="text-xl text-white/80 max-w-2xl mx-auto">
            Decentralized flood insurance powered by Internet Computer Protocol
          </p>
        </div>

        {/* Internet Identity Connection */}
        <div className="mb-16">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Connect to Internet Identity</h2>
            {isConnected ? (
              <div className="space-y-4">
                <p className="text-white/80">Connected as: {formatPrincipal(principal!)}</p>
                <button
                  onClick={() => setIsConnected(false)}
                  className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg transition-all duration-200"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connectInternetIdentity}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-lg py-6 px-8 rounded-lg font-semibold transition-all duration-200"
              >
                <Wallet className="inline mr-2 h-5 w-5" />
                Connect with Internet Identity
              </button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 hover:bg-white/20 transition-all duration-300 cursor-pointer transform hover:scale-105">
            <div className="text-center">
              <Shield className="h-16 w-16 mx-auto mb-4 text-pink-200" />
              <h2 className="text-2xl font-bold text-white mb-4">For Individuals</h2>
              <p className="text-white/80 mb-6">
                Protect your property with personalized flood insurance coverage
              </p>
              <button
                onClick={() => handleAccessType("individual")}
                disabled={!isConnected}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-500 disabled:to-gray-600 text-white text-lg py-4 px-6 rounded-lg font-semibold transition-all duration-200"
              >
                <Wallet className="inline mr-2 h-5 w-5" />
                Access Individual Portal
              </button>
              <div className="mt-4 text-white/80 text-sm">
                • Real-time flood monitoring • Buy insurance • Claim payouts
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 hover:bg-white/20 transition-all duration-300 cursor-pointer transform hover:scale-105">
            <div className="text-center">
              <Building2 className="h-16 w-16 mx-auto mb-4 text-pink-200" />
              <h2 className="text-2xl font-bold text-white mb-4">For Companies</h2>
              <p className="text-white/80 mb-6">
                Manage flood thresholds and contract reserves
              </p>
              <button
                onClick={() => handleAccessType("company")}
                disabled={!isConnected}
                className="w-full bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 disabled:from-gray-500 disabled:to-gray-600 text-white text-lg py-4 px-6 rounded-lg font-semibold transition-all duration-200"
              >
                <Building2 className="inline mr-2 h-5 w-5" />
                Admin Dashboard
              </button>
              <div className="mt-4 text-white/80 text-sm">
                • Adjust thresholds • Fund reserves • Trigger payouts
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mt-16 text-white/60">
          <p>&copy; 2025 Paramify ICP. Revolutionizing flood insurance through blockchain technology.</p>
        </div>
      </div>
    </div>
  );
}

export default App;
