import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Shield, Key, Copy, Download, CheckCircle, XCircle, QrCode } from "lucide-react";

const verifyCodeSchema = z.object({
  code: z.string().length(6, "Code must be 6 digits"),
});

const disableSchema = z.object({
  code: z.string().optional(),
  backupCode: z.string().optional(),
});

type VerifyCodeFormData = z.infer<typeof verifyCodeSchema>;
type DisableFormData = z.infer<typeof disableSchema>;

interface AdminTwoFactorProps {
  token: string;
  enabled: boolean;
  onUpdate: () => void;
}

export default function AdminTwoFactor({ token, enabled, onUpdate }: AdminTwoFactorProps) {
  const [step, setStep] = useState<'setup' | 'confirm' | 'complete'>('setup');
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const { toast } = useToast();

  const verifyForm = useForm<VerifyCodeFormData>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: {
      code: '',
    },
  });

  const disableForm = useForm<DisableFormData>({
    resolver: zodResolver(disableSchema),
    defaultValues: {
      code: '',
      backupCode: '',
    },
  });

  const handleEnable2FA = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/admin/api/enable-2fa', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to enable 2FA');
      }

      setQrCode(result.qrCode);
      setSecret(result.secret);
      setStep('confirm');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to enable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm2FA = async (data: VerifyCodeFormData) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/admin/api/confirm-2fa', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to confirm 2FA');
      }

      setBackupCodes(result.backupCodes);
      setStep('complete');
      toast({
        title: "2FA Enabled",
        description: "Two-factor authentication has been enabled successfully.",
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to confirm 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async (data: DisableFormData) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/admin/api/disable-2fa', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to disable 2FA');
      }

      setShowDisableDialog(false);
      onUpdate();
      toast({
        title: "2FA Disabled",
        description: "Two-factor authentication has been disabled.",
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Code copied to clipboard.",
    });
  };

  const downloadBackupCodes = () => {
    const content = `xHACCP Admin 2FA Backup Codes\n\nGenerated: ${new Date().toISOString()}\n\n${backupCodes.join('\n')}\n\nKeep these codes secure - they can be used to access your account if you lose your authenticator device.`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'xhaccp-admin-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetSetup = () => {
    setStep('setup');
    setQrCode('');
    setSecret('');
    setBackupCodes([]);
    setError('');
    verifyForm.reset();
    onUpdate();
  };

  if (enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-green-600" />
            <span>Two-Factor Authentication</span>
          </CardTitle>
          <CardDescription>Enhanced security for your admin account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-sm">2FA is currently enabled</span>
            <Badge variant="default">Active</Badge>
          </div>
          
          <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Disable 2FA
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
                <DialogDescription>
                  To disable 2FA, verify your identity with either your authenticator code or a backup code.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                
                <Form {...disableForm}>
                  <form onSubmit={disableForm.handleSubmit(handleDisable2FA)} className="space-y-4">
                    {useBackupCode ? (
                      <FormField
                        control={disableForm.control}
                        name="backupCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Backup Code</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Enter backup code"
                                className="font-mono"
                                disabled={loading}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <FormField
                        control={disableForm.control}
                        name="code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Authentication Code</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="000000"
                                className="text-center font-mono text-lg tracking-widest"
                                maxLength={6}
                                disabled={loading}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <div className="flex items-center justify-between">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setUseBackupCode(!useBackupCode)}
                      >
                        {useBackupCode ? "Use authenticator code" : "Use backup code"}
                      </Button>
                      
                      <div className="space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowDisableDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          variant="destructive"
                          disabled={loading}
                        >
                          {loading ? "Disabling..." : "Disable 2FA"}
                        </Button>
                      </div>
                    </div>
                  </form>
                </Form>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Shield className="h-5 w-5 text-gray-500" />
          <span>Two-Factor Authentication</span>
        </CardTitle>
        <CardDescription>Add an extra layer of security to your admin account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'setup' && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="text-sm">2FA is not enabled</span>
              <Badge variant="secondary">Inactive</Badge>
            </div>
            
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <Button onClick={handleEnable2FA} disabled={loading}>
              {loading ? "Setting up..." : "Enable 2FA"}
            </Button>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="text-center space-y-4">
              <div className="mx-auto bg-white p-4 rounded-lg border max-w-fit">
                <img src={qrCode} alt="QR Code" className="w-48 h-48" />
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Manual entry key:</p>
                <div className="flex items-center space-x-2">
                  <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm font-mono">
                    {secret}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(secret)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Form {...verifyForm}>
              <form onSubmit={verifyForm.handleSubmit(handleConfirm2FA)} className="space-y-4">
                <FormField
                  control={verifyForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Enter the code from your authenticator app</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="000000"
                          className="text-center font-mono text-lg tracking-widest"
                          maxLength={6}
                          disabled={loading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep('setup')}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Verifying..." : "Verify & Enable"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        )}

        {step === 'complete' && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Two-factor authentication has been enabled successfully!
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <h4 className="font-medium">Your backup codes:</h4>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                  {backupCodes.map((code, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span>{code}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(code)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadBackupCodes}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Codes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetSetup}
                >
                  Done
                </Button>
              </div>
            </div>

            <Alert>
              <AlertDescription>
                Save these backup codes in a secure location. You can use them to access your account if you lose your authenticator device.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
}