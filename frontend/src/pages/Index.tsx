import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, Building2, Shield, Waves, TrendingUp, Users, Menu, Home, Info, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import InsuracleDashboard from '@/InsuracleDashboard'; 
import InsuracleDashboardAdmin from '@/InsuracleDashboardAdmin'; 
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar";

declare global {
  interface Window {
    ethereum?: any;
  }
}

const Index = () => {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [isConnected, setIsConnected] = useState(false);
  const [userType, setUserType] = useState<"individual" | "company" | null>(null);
  const { toast } = useToast();

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({
          method: 'eth_request_accounts'
        });
        setWalletAddress(accounts[0]);
        setIsConnected(true);
        toast({
          title: "Wallet Connected",
          description: `Connected to ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`,
        });
      } catch (error) {
        toast({
          title: "Connection Failed",
          description: "Failed to connect to MetaMask wallet",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "MetaMask Not Found",
        description: "Please install MetaMask to connect your wallet",
        variant: "destructive",
      });
    }
  };

  const handleAccessType = (type: "individual" | "company") => {
    setUserType(type);
  };

  if (userType === "individual") {
    return <InsuracleDashboard setUserType={setUserType as unknown as (userType: string) => void} />;
  }

  if (userType === "company") {
    return <InsuracleDashboardAdmin setUserType={setUserType as unknown as (userType: string) => void} />;
  }

  return (
    <div className="min-h-screen gradient-bg">
      <div className="bg-gradient-to-r from-purple-900 to-red-900 border-b border-white/10">
        <div className="container mx-auto px-4">
          <Menubar className="bg-transparent border-none h-14">
            <MenubarMenu>
              <MenubarTrigger className="text-white hover:bg-white/10 data-[state=open]:bg-white/10">
                <Home className="mr-2 h-4 w-4" />
                Home
              </MenubarTrigger>
            </MenubarMenu>
            <MenubarMenu>
              <MenubarTrigger className="text-white hover:bg-white/10 data-[state=open]:bg-white/10">
                <Info className="mr-2 h-4 w-4" />
                About
              </MenubarTrigger>
              <MenubarContent className="bg-gray-900 border-gray-700">
                <MenubarItem className="text-white hover:bg-gray-800">Company Info</MenubarItem>
                <MenubarItem className="text-white hover:bg-gray-800">How It Works</MenubarItem>
                <MenubarItem className="text-white hover:bg-gray-800">Technology</MenubarItem>
              </MenubarContent>
            </MenubarMenu>
            <MenubarMenu>
              <MenubarTrigger className="text-white hover:bg-white/10 data-[state=open]:bg-white/10">
                Services
              </MenubarTrigger>
              <MenubarContent className="bg-gray-900 border-gray-700">
                <MenubarItem className="text-white hover:bg-gray-800">Individual Insurance</MenubarItem>
                <MenubarItem className="text-white hover:bg-gray-800">Business Solutions</MenubarItem>
                <MenubarItem className="text-white hover:bg-gray-800">API Access</MenubarItem>
              </MenubarContent>
            </MenubarMenu>
            <MenubarMenu>
              <MenubarTrigger className="text-white hover:bg-white/10 data-[state=open]:bg-white/10">
                <Mail className="mr-2 h-4 w-4" />
                Contact
              </MenubarTrigger>
            </MenubarMenu>
          </Menubar>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <Waves className="h-12 w-12 text-white" />
            <h1 className="text-5xl font-bold text-white">Paramify</h1>
          </div>
        </div>

        <div className="text-center mb-12">
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            The world's first decentralized flood insurance oracle. Providing real-time flood risk assessment 
            and automated insurance claims processing through blockchain technology.
          </p>
        </div>

  
        <div className="mb-16">
          <Card className="bg-white/10 backdrop-blur-md border-white/20 max-w-4xl mx-auto">
            <CardContent className="p-8">
              <h2 className="text-3xl font-bold text-white mb-6 text-center">About Paramify</h2>
              <div className="grid md:grid-cols-3 gap-6 text-white/90">
                <div className="text-center">
                  <Shield className="h-12 w-12 mx-auto mb-4 text-pink-200" />
                  <h3 className="font-semibold mb-2">Decentralized Protection</h3>
                  <p className="text-sm">Smart contracts ensure transparent and automated claim processing without intermediaries.</p>
                </div>
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 text-pink-200" />
                  <h3 className="font-semibold mb-2">Real-time Data</h3>
                  <p className="text-sm">Advanced weather monitoring and AI-powered risk assessment for accurate flood predictions.</p>
                </div>
                <div className="text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-pink-200" />
                  <h3 className="font-semibold mb-2">Community Driven</h3>
                  <p className="text-sm">Powered by a global network of data providers and insurance partners.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

 
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 transition-all duration-300 cursor-pointer transform hover:scale-105">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Users className="h-16 w-16 text-pink-200" />
              </div>
              <CardTitle className="text-2xl text-white">For Individuals</CardTitle>
              <CardDescription className="text-white/80">
                Protect your property with personalized flood insurance coverage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => handleAccessType("individual")}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-lg py-6"
              >
                <Wallet className="mr-2 h-5 w-5" />
                Access Individual Portal
              </Button>
              <div className="mt-4 text-white/80 text-sm">
                • Connect your wallet • Buy insurance coverage • Manage claims
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 transition-all duration-300 cursor-pointer transform hover:scale-105">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Building2 className="h-16 w-16 text-pink-200" />
              </div>
              <CardTitle className="text-2xl text-white">For Insurance Companies</CardTitle>
              <CardDescription className="text-white/80">
                Access our oracle data and integrate with your existing systems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => handleAccessType("company")}
                className="w-full bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white text-lg py-6"
              >
                <Building2 className="mr-2 h-5 w-5" />
                Admin Dashboard
              </Button>
              <div className="mt-4 text-white/80 text-sm">
                • API access • Risk analytics • White-label solutions
              </div>
            </CardContent>
          </Card>
        </div>


        <div className="text-center mt-16 text-white/60">
          <p>&copy; 2025 Paramify. Revolutionizing flood insurance through blockchain technology.</p>
        </div>
      </div>
    </div>
  );
};

export default Index;
