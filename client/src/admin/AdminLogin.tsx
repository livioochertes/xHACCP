import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Shield, Key, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const twoFactorSchema = z.object({
  code: z.string().length(6, "Code must be 6 digits"),
  backupCode: z.string().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;
type TwoFactorFormData = z.infer<typeof twoFactorSchema>;

interface AdminLoginProps {
  onLoginSuccess: (token: string, admin: any) => void;
}

export default function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const [step, setStep] = useState<'login' | '2fa'>('login');
  const [tempToken, setTempToken] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const { toast } = useToast();

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const twoFactorForm = useForm<TwoFactorFormData>({
    resolver: zodResolver(twoFactorSchema),
    defaultValues: {
      code: '',
      backupCode: '',
    },
  });

  const handleLogin = async (data: LoginFormData) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/admin/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Login failed');
      }

      if (result.requiresTwoFactor) {
        setTempToken(result.tempToken);
        setStep('2fa');
        toast({
          title: "Two-Factor Authentication Required",
          description: "Please enter your 6-digit code from your authenticator app.",
        });
      } else {
        onLoginSuccess(result.token, result.admin);
        toast({
          title: "Login Successful",
          description: "Welcome to the admin dashboard.",
        });
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed');
      toast({
        title: "Oops! Something went wrong",
        description: error instanceof Error ? error.message : 'Please check your credentials and try again.',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactor = async (data: TwoFactorFormData) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/admin/api/verify-2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tempToken,
          code: useBackupCode ? undefined : data.code,
          backupCode: useBackupCode ? data.backupCode : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || '2FA verification failed');
      }

      onLoginSuccess(result.token, result.admin);
      toast({
        title: "Login Successful",
        description: "Two-factor authentication verified.",
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : '2FA verification failed');
      toast({
        title: "Verification Failed",
        description: error instanceof Error ? error.message : 'Please check your code.',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const goBackToLogin = () => {
    setStep('login');
    setTempToken('');
    setError('');
    setUseBackupCode(false);
    twoFactorForm.reset();
  };

  if (step === '2fa') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-blue-100 dark:bg-blue-900 rounded-full w-fit">
              <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-2xl font-bold">Two-Factor Authentication</CardTitle>
            <CardDescription>
              {useBackupCode 
                ? "Enter one of your backup codes" 
                : "Enter the 6-digit code from your authenticator app"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <Form {...twoFactorForm}>
              <form onSubmit={twoFactorForm.handleSubmit(handleTwoFactor)} className="space-y-4">
                {useBackupCode ? (
                  <FormField
                    control={twoFactorForm.control}
                    name="backupCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Backup Code</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Enter backup code"
                            className="text-center font-mono text-lg"
                            disabled={loading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={twoFactorForm.control}
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

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? "Verifying..." : "Verify Code"}
                </Button>
              </form>
            </Form>

            <div className="text-center space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUseBackupCode(!useBackupCode)}
                className="text-sm"
              >
                {useBackupCode ? "Use authenticator code" : "Use backup code"}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={goBackToLogin}
                className="text-sm flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-blue-100 dark:bg-blue-900 rounded-full w-fit">
            <Key className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-2xl font-bold">Admin Login</CardTitle>
          <CardDescription>
            Access the xHACCP admin dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
              <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="admin@xhaccp.com"
                        disabled={loading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          disabled={loading}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-1 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? "Signing In..." : "Sign In"}
              </Button>
            </form>
          </Form>

          <div className="text-center text-sm text-muted-foreground">
            Secure admin access with optional two-factor authentication
          </div>
        </CardContent>
      </Card>
    </div>
  );
}