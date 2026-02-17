'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QrCode, Camera, Copy, Check, ArrowRight, AlertCircle } from 'lucide-react';
import { generatePaymentQR, parsePaymentQR, formatAddress, getWallet } from '@/lib/blockchain';
import { useToast } from '@/hooks/use-toast';

export default function ScanPage() {
  const router = useRouter();
  const { toast } = useToast();
  const wallet = getWallet();

  // Generate QR state
  const [generateAmount, setGenerateAmount] = useState('');
  const [generateToken, setGenerateToken] = useState('ETH');
  const [qrData, setQrData] = useState('');
  const [copied, setCopied] = useState(false);

  // Scan QR state
  const [scanInput, setScanInput] = useState('');
  const [scannedData, setScannedData] = useState<{
    address: string;
    amount?: string;
    token?: string;
  } | null>(null);
  const [scanError, setScanError] = useState('');

  const handleGenerateQR = () => {
    if (!wallet.isConnected) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return;
    }

    const data = generatePaymentQR(
      wallet.address,
      generateAmount || undefined,
      generateToken
    );
    setQrData(data);
  };

  const handleCopyQR = () => {
    navigator.clipboard.writeText(qrData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Copied!',
      description: 'QR code data copied to clipboard',
    });
  };

  const handleScanQR = () => {
    setScanError('');
    try {
      const parsed = parsePaymentQR(scanInput);
      setScannedData(parsed);
    } catch (err) {
      setScanError('Invalid QR code data. Please check and try again.');
      setScannedData(null);
    }
  };

  const handlePay = () => {
    if (scannedData) {
      const params = new URLSearchParams({
        to: scannedData.address,
        ...(scannedData.amount && { amount: scannedData.amount }),
        ...(scannedData.token && { token: scannedData.token }),
      });
      router.push(`/send?${params.toString()}`);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-balance text-4xl font-bold">QR Payments</h1>
          <p className="mt-2 text-muted-foreground">
            Generate payment requests or scan QR codes for quick payments
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="generate" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate" className="gap-2">
              <QrCode className="h-4 w-4" />
              Generate QR
            </TabsTrigger>
            <TabsTrigger value="scan" className="gap-2">
              <Camera className="h-4 w-4" />
              Scan QR
            </TabsTrigger>
          </TabsList>

          {/* Generate QR Tab */}
          <TabsContent value="generate" className="space-y-6">
            <Card className="border border-[#1A1E22] p-6">
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold">Generate Payment Request</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create a QR code for receiving payments
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="generate-amount">Amount (Optional)</Label>
                    <Input
                      id="generate-amount"
                      type="number"
                      step="0.0001"
                      placeholder="0.00"
                      value={generateAmount}
                      onChange={(e) => setGenerateAmount(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="generate-token">Token</Label>
                    <Input
                      id="generate-token"
                      value={generateToken}
                      onChange={(e) => setGenerateToken(e.target.value)}
                      placeholder="ETH"
                    />
                  </div>
                </div>

                <Button onClick={handleGenerateQR} className="w-full gap-2">
                  <QrCode className="h-4 w-4" />
                  Generate QR Code
                </Button>

                {qrData && (
                  <div className="space-y-4">
                    {/* QR Code Display (Mock) */}
                    <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8">
                      <div className="flex h-64 w-64 items-center justify-center rounded-lg bg-background">
                        <div className="text-center">
                          <QrCode className="mx-auto h-32 w-32 text-primary" />
                          <p className="mt-4 text-sm text-muted-foreground">
                            QR Code Generated
                          </p>
                        </div>
                      </div>
                      <div className="w-full space-y-2">
                        <Label>Payment Request Data</Label>
                        <div className="flex gap-2">
                          <Input
                            value={qrData}
                            readOnly
                            className="font-mono text-xs"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={handleCopyQR}
                          >
                            {copied ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* QR Details */}
                    <Card className="border border-[#1A1E22] bg-muted p-4">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Your Address:</span>
                          <span className="font-mono">{formatAddress(wallet.address)}</span>
                        </div>
                        {generateAmount && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Requested Amount:</span>
                            <span className="font-semibold">
                              {generateAmount} {generateToken}
                            </span>
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Scan QR Tab */}
          <TabsContent value="scan" className="space-y-6">
            <Card className="border border-[#1A1E22] p-6">
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold">Scan Payment Request</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Paste QR code data or enter payment details manually
                  </p>
                </div>

                {/* Mock Camera View */}
                <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-border bg-muted/50 p-12">
                  <Camera className="h-16 w-16 text-muted-foreground" />
                  <div className="text-center">
                    <p className="font-medium">Camera Scanner</p>
                    <p className="text-sm text-muted-foreground">
                      In a production app, this would activate your camera
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or paste QR data</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scan-input">QR Code Data or Address</Label>
                  <Input
                    id="scan-input"
                    placeholder="Paste QR data or enter address..."
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    className="font-mono"
                  />
                </div>

                {scanError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{scanError}</AlertDescription>
                  </Alert>
                )}

                <Button onClick={handleScanQR} className="w-full gap-2" disabled={!scanInput}>
                  <QrCode className="h-4 w-4" />
                  Parse QR Data
                </Button>

                {scannedData && (
                  <Card className="border border-[#1A1E22] bg-primary/5 p-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-primary">
                        <Check className="h-5 w-5" />
                        <span className="font-semibold">Payment Request Detected</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Recipient:</span>
                          <span className="font-mono">{formatAddress(scannedData.address)}</span>
                        </div>
                        {scannedData.amount && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Amount:</span>
                            <span className="font-semibold">
                              {scannedData.amount} {scannedData.token || 'ETH'}
                            </span>
                          </div>
                        )}
                      </div>
                      <Button onClick={handlePay} className="w-full gap-2">
                        Proceed to Payment
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
