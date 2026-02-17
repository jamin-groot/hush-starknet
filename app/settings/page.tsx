'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Shield,
  Bell,
  Wallet,
  Eye,
  Lock,
  Globe,
  Save,
  Copy,
  Check,
} from 'lucide-react';
import { getWallet, formatAddress } from '@/lib/blockchain';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { toast } = useToast();
  const wallet = getWallet();

  // Privacy Settings
  const [defaultPrivacy, setDefaultPrivacy] = useState(false);
  const [hideBalances, setHideBalances] = useState(false);
  const [autoEncrypt, setAutoEncrypt] = useState(true);

  // Notification Settings
  const [notifyTransactions, setNotifyTransactions] = useState(true);
  const [notifyInvoices, setNotifyInvoices] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);

  // App Settings
  const [currency, setCurrency] = useState('USD');
  const [language, setLanguage] = useState('en');

  const [copied, setCopied] = useState(false);

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Copied!',
      description: 'Wallet address copied to clipboard',
    });
  };

  const handleSave = () => {
    toast({
      title: 'Settings Saved',
      description: 'Your preferences have been updated',
    });
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-balance text-4xl font-bold">Settings</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your account preferences and privacy settings
          </p>
        </div>

        {/* Wallet Info */}
        <Card className="border border-[#1A1E22] p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h2 className="text-xl font-semibold">Connected Wallet</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your Starknet wallet information
                </p>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-sm text-muted-foreground">Address</div>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="text-sm">{wallet.address}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleCopyAddress}
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-primary" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Balance</div>
                  <div className="mt-1 font-mono text-lg font-semibold">
                    {wallet.balance} ETH
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Privacy Settings */}
        <Card className="border border-[#1A1E22] p-6">
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Privacy & Security</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Control how your data is shared and encrypted
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    <Lock className="h-4 w-4 text-primary" />
                    Default Privacy Mode
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Automatically enable encryption for all transactions
                  </p>
                </div>
                <Switch checked={defaultPrivacy} onCheckedChange={setDefaultPrivacy} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    <Eye className="h-4 w-4" />
                    Hide Balances
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Hide your wallet balance from the dashboard
                  </p>
                </div>
                <Switch checked={hideBalances} onCheckedChange={setHideBalances} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    <Lock className="h-4 w-4 text-primary" />
                    Auto-encrypt Notes
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Automatically encrypt transaction notes with Hush
                  </p>
                </div>
                <Switch checked={autoEncrypt} onCheckedChange={setAutoEncrypt} />
              </div>
            </div>
          </div>
        </Card>

        {/* Notification Settings */}
        <Card className="border border-[#1A1E22] p-6">
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Bell className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Notifications</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose what updates you want to receive
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="font-medium">Transaction Notifications</div>
                  <p className="text-sm text-muted-foreground">
                    Get notified when you send or receive payments
                  </p>
                </div>
                <Switch
                  checked={notifyTransactions}
                  onCheckedChange={setNotifyTransactions}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="font-medium">Invoice Notifications</div>
                  <p className="text-sm text-muted-foreground">
                    Alerts for invoice payments and due dates
                  </p>
                </div>
                <Switch checked={notifyInvoices} onCheckedChange={setNotifyInvoices} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="font-medium">Email Notifications</div>
                  <p className="text-sm text-muted-foreground">
                    Receive updates via email
                  </p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* App Settings */}
        <Card className="border border-[#1A1E22] p-6">
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">App Settings</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Customize your app experience
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="currency">Display Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="JPY">JPY (¥)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="ja">Japanese</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} className="gap-2" size="lg">
            <Save className="h-4 w-4" />
            Save Settings
          </Button>
        </div>

        {/* About Hush */}
        <Card className="border border-[#1A1E22] bg-primary/5 p-6">
          <div className="space-y-2">
            <h3 className="font-semibold">About Hush</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Hush is a privacy-first payment application built on Starknet. We use
              zero-knowledge proofs and end-to-end encryption to ensure your transactions
              remain private and secure. Your financial privacy is our top priority.
            </p>
            <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
              <span>Version 1.0.0</span>
              <span>•</span>
              <span>Powered by Starknet</span>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
