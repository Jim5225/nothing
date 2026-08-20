"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, RefreshCw, Unplug, AlertCircle, CheckCircle2 } from "lucide-react";
import { disconnectEmailAccount } from "./actions";

interface EmailAccount {
  id: string;
  email_address: string;
  provider: string;
  status: string;
  created_at: string;
}

export function EmailClient({ initialAccounts }: { initialAccounts: EmailAccount[] }) {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const success = searchParams.get("success");

  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const handleDisconnect = async (id: string) => {
    if (!confirm("Are you sure you want to disconnect this account? Active campaigns using this account will fail to send.")) {
      return;
    }

    setIsProcessing(id);
    try {
      const result = await disconnectEmailAccount(id);
      if (result && !result.success) {
        alert("Failed to disconnect account: " + result.error);
      }
    } catch (error) {
      console.error(error);
      alert("Failed to disconnect account.");
    } finally {
      setIsProcessing(null);
    }
  };

  const handleConnectGmail = () => {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/settings/email/connect";
  };

  return (
    <div className="space-y-6">
      {error === "missing_credentials" && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 space-y-1">
            <p className="font-semibold">Google OAuth Credentials Required</p>
            <p>
              To connect Gmail, you must configure <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in your Vercel Environment Variables.
            </p>
          </div>
        </div>
      )}

      {error && error !== "missing_credentials" && error !== "oauth_rejected" && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">
            <p className="font-semibold">Connection Failed</p>
            <p>
              {error === "oauth_failed"
                ? "Google authentication failed or was interrupted. Please check your Google Cloud OAuth settings and try again."
                : decodeURIComponent(error)}
            </p>
          </div>
        </div>
      )}

      {error === "oauth_rejected" && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-700">
            Access was not granted in Google. Please allow the requested permissions to connect Gmail.
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div className="text-sm text-green-700 font-medium">
            Gmail account connected successfully!
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connected Accounts</CardTitle>
          <CardDescription>Accounts used to send automated email campaigns.</CardDescription>
        </CardHeader>
        <CardContent>
          {initialAccounts.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 mb-4">No email accounts connected.</p>
              <Button onClick={handleConnectGmail}>Connect Gmail</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end mb-4">
                <Button onClick={handleConnectGmail}>Connect Another Gmail</Button>
              </div>
              <div className="divide-y border rounded-lg overflow-hidden">
                {initialAccounts.map((account) => (
                  <div key={account.id} className="p-4 flex items-center justify-between bg-white hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="bg-gray-100 p-2 rounded-full">
                        <Mail className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <div className="font-medium">{account.email_address}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                          <span className="capitalize">{account.provider}</span>
                          &bull; 
                          Connected {new Date(account.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <Badge 
                        variant="secondary" 
                        className={
                          account.status === "connected" ? "bg-green-100 text-green-800" :
                          account.status === "expired" ? "bg-yellow-100 text-yellow-800" :
                          "bg-red-100 text-red-800"
                        }
                      >
                        {account.status}
                      </Badge>
                      
                      {account.status === "disconnected" ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleConnectGmail()}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Reconnect
                        </Button>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDisconnect(account.id)}
                          disabled={isProcessing === account.id}
                        >
                          <Unplug className="h-4 w-4 mr-2" />
                          {isProcessing === account.id ? "Disconnecting..." : "Disconnect"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
