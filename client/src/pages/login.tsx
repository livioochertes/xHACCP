import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, getMarketFromHostname } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Eye, EyeOff } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/hooks/useTranslation";

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" fill="currentColor"/>
    </svg>
  );
}

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();
  const { t } = useTranslation();
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registerEmail, setRegisterEmail] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (token) {
      (async () => {
        try {
          const response = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}`, 'X-Market': getMarketFromHostname() },
          });
          if (response.ok) {
            const user = await response.json();
            await login(token, user);
            toast({ title: t('auth.welcomeBack'), description: t('auth.loginSuccess') });
            navigate("/");
          }
        } catch (err) {
          console.error('OAuth login failed:', err);
        }
      })();
      window.history.replaceState({}, '', '/login');
    } else if (error) {
      toast({
        title: t('auth.loginErrorTitle'),
        description: error === 'google_not_configured' || error === 'apple_not_configured'
          ? t('auth.socialNotConfigured')
          : t('auth.socialLoginError'),
        variant: "destructive",
      });
      window.history.replaceState({}, '', '/login');
    }
  }, []);

  const handleSocialLogin = (provider: 'google' | 'apple') => {
    window.location.href = `/api/auth/${provider}`;
  };

  const toggleForm = () => {
    setIsLogin(!isLogin);
    loginForm.reset();
    registerForm.reset();
    setRegisterEmail("");
  };

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return response.json();
    },
    onSuccess: async (data) => {
      await login(data.token, data.user);
      toast({
        title: t('auth.welcomeBack'),
        description: t('auth.loginSuccess'),
      });
      navigate("/");
    },
    onError: (error) => {
      toast({
        title: t('auth.loginErrorTitle'),
        description: error.message || t('auth.loginErrorDesc'),
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterFormData) => {
      const response = await apiRequest("POST", "/api/auth/register", data);
      return response.json();
    },
    onSuccess: async (data) => {
      await login(data.token, data.user);
      toast({
        title: t('auth.accountCreated'),
        description: t('auth.accountCreatedDesc'),
      });
      navigate("/");
    },
    onError: (error) => {
      toast({
        title: t('auth.registerErrorTitle'),
        description: error.message || t('auth.registerErrorDesc'),
        variant: "destructive",
      });
    },
  });

  const handleLoginSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  const handleRegisterSubmit = (data: RegisterFormData) => {
    const { confirmPassword, ...registerData } = data;
    registerData.email = registerEmail;
    registerMutation.mutate(registerData as any);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      
      <div className="container max-w-md mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              {isLogin ? "Sign In" : "Create Account"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLogin ? (
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(handleLoginSubmit)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="your@email.com" 
                            autoComplete="username"
                            {...field} 
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
                              type={showLoginPassword ? "text" : "password"} 
                              placeholder="Password" 
                              autoComplete="current-password"
                              {...field} 
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                              onClick={() => setShowLoginPassword(!showLoginPassword)}
                              tabIndex={-1}
                            >
                              {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? "Signing In..." : "Sign In"}
                  </Button>
                </form>
              </Form>
            ) : (
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(handleRegisterSubmit)} className="space-y-4" autoComplete="off">

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={registerForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John" autoComplete="given-name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" autoComplete="family-name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Email
                    </label>
                    <Input
                      type="text"
                      inputMode="email"
                      placeholder="your@email.com"
                      autoComplete="off"
                      value={registerEmail}
                      onChange={(e) => {
                        setRegisterEmail(e.target.value);
                        registerForm.setValue("email", e.target.value);
                      }}
                    />
                    {registerForm.formState.errors.email && (
                      <p className="text-sm font-medium text-destructive">
                        {registerForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                  <FormField
                    control={registerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type={showRegisterPassword ? "text" : "password"} 
                              placeholder="Password" 
                              autoComplete="new-password"
                              {...field} 
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                              onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                              tabIndex={-1}
                            >
                              {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type={showConfirmPassword ? "text" : "password"} 
                              placeholder="Confirm password" 
                              autoComplete="new-password"
                              {...field} 
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              tabIndex={-1}
                            >
                              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={registerMutation.isPending}
                  >
                    {registerMutation.isPending ? "Creating Account..." : "Create Account"}
                  </Button>
                </form>
              </Form>
            )}
            
            <div className="mt-6 flex items-center gap-4">
              <Separator className="flex-1" />
              <span className="text-sm text-gray-500">or</span>
              <Separator className="flex-1" />
            </div>

            <div className="mt-4 space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full relative flex items-center justify-center gap-3 h-11 border-gray-300 hover:bg-gray-50"
                onClick={() => handleSocialLogin('google')}
              >
                <GoogleLogo className="h-5 w-5 absolute left-4" />
                <span>Sign in with Google</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full relative flex items-center justify-center gap-3 h-11 border-black bg-black text-white hover:bg-gray-900 hover:text-white"
                onClick={() => handleSocialLogin('apple')}
              >
                <AppleLogo className="h-5 w-5 absolute left-4" />
                <span>Sign in with Apple</span>
              </Button>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={toggleForm}
                className="text-blue-600 hover:text-blue-800"
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
            
            <div className="mt-4 text-center">
              <Link href="/" className="text-gray-600 hover:text-gray-800">
                Continue as guest
              </Link>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
