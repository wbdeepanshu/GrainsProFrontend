import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Eye, EyeOff, Shield, Lock, Phone, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import logo from "../assets/new_logo.png";
import loginBg from "../assets/login_bg.png";

export default function Login() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForceLogoutDialog, setShowForceLogoutDialog] = useState(false);
  const [showOTPScreen, setShowOTPScreen] = useState(false);
  const [otp, setOtp] = useState("");
  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const [isVerifyingOTP, setIsVerifyingOTP] = useState(false);
  const [userMobile, setUserMobile] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    document.body.classList.add("login-page-active");
    document.documentElement.classList.add("login-page-active");
    return () => {
      document.body.classList.remove("login-page-active");
      document.documentElement.classList.remove("login-page-active");
    };
  }, []);

  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      mobile: "",
      password: "",
      rememberMe: false,
    },
  });

  const handleRememberMeChange = (checked) => {
    if (checked) {
      const mobile = form.getValues("mobile");
      const password = form.getValues("password");
      localStorage.setItem("credentials", JSON.stringify({ mobile, password }));
    } else {
      form.setValue("mobile", "");
      form.setValue("password", "");
      localStorage.removeItem("credentials");
    }
  };

  useEffect(() => {
    const savedCredentials = localStorage.getItem("credentials");
    if (savedCredentials) {
      try {
        const { mobile, password } = JSON.parse(savedCredentials);
        form.setValue("rememberMe", Boolean(mobile));
        form.setValue("mobile", mobile || "");
        form.setValue("password", password || "");
      } catch (error) {
        console.error("Invalid credentials format in localStorage:", error);
        form.setValue("mobile", "");
        form.setValue("password", "");
        form.setValue("rememberMe", false);
      }
    } else {
      form.setValue("mobile", "");
      form.setValue("password", "");
      form.setValue("rememberMe", false);
      localStorage.removeItem("credentials");
    }
  }, [form]);

  const handleContinueForceLogout = async () => {
    if (!userMobile) {
      toast({
        title: "Error",
        description: "Mobile number is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSendingOTP(true);
      const response = await AuthService.resendVerificationCode(userMobile);

      if (response.status === 200) {
        setShowForceLogoutDialog(false);
        setShowOTPScreen(true);
        toast({
          title: "OTP Sent",
          description: "OTP has been sent to your mobile number. Please check your SMS.",
          variant: "default",
          duration: 3000,
        });
      } else {
        toast({
          title: "Failed to Send OTP",
          description: response.message || "Unable to send OTP. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to send OTP. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSendingOTP(false);
    }
  };

  const handleForceLogout = async () => {
    if (!otp || otp.length !== 4) {
      toast({
        title: "Invalid OTP",
        description: "Please enter a valid 4-digit OTP",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsVerifyingOTP(true);
      const response = await AuthService.forceLogout(userMobile, otp);

      if (response.status === 200 && response.access_token) {
        queryClient.clear();
        queryClient.invalidateQueries();
        queryClient.resetQueries();
        setShowOTPScreen(false);
        setShowForceLogoutDialog(false);
        setOtp("");
        toast({
          title: "Login Successful",
          description: `Welcome back, ${response.data?.name || "User"}!`,
          variant: "success",
          duration: 800,
        });
        setLocation("/dashboard");
      } else {
        toast({
          title: "Force Logout Failed",
          description: response.message || "Invalid OTP or unable to logout. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to logout from previous device. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifyingOTP(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      setIsLoading(true);
      const response = await AuthService.login({
        mobile: data.mobile,
        password: data.password,
        source: "Portal",
      });

      if (response.status === 200) {
        queryClient.clear();
        queryClient.invalidateQueries();
        queryClient.resetQueries();
        toast({
          title: "Login Successful",
          description: `Welcome back, ${response.data.name}!`,
          variant: "success",
          duration: 800,
        });
        setLocation("/dashboard");
      } else if (response.status === 403 && response.message?.includes("already logged in")) {
        setUserMobile(data.mobile);
        setShowForceLogoutDialog(true);
      } else {
        toast({
          title: "Login Failed",
          description: response.message || "Invalid mobile number or password",
          variant: "destructive",
          duration: 1500,
        });
      }
    } catch (error) {
      toast({
        title: "Login Failed",
        description: error.message || "Unable to connect to server. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Banner art is 2528×1696 (~1.49:1). Use contain so all four corners stay visible.
  return (
    <div className="login-page login-container relative h-screen min-h-0 w-full overflow-hidden bg-[#141414]">
      <div className="flex h-full min-h-0 w-full flex-col lg:flex-row">
        {/* Left: full image visible, corners not cropped */}
        <section className="relative hidden h-full min-h-0 min-w-0 flex-1 bg-[#141414] lg:flex lg:items-center lg:justify-center">
          <img
            src={loginBg}
            alt=""
            width={2528}
            height={1696}
            className="max-h-full max-w-full h-auto w-auto object-contain object-center"
            draggable={false}
          />
        </section>

        {/* Right: wider white form with theme gold border */}
        <section className="relative z-20 flex h-full min-h-0 w-full flex-col border-[#c9a227] bg-white lg:w-[420px] lg:shrink-0 lg:border-l-2 xl:w-[460px]">
          {/* Mobile: image strip */}
          <div className="relative flex h-40 w-full shrink-0 items-center justify-center overflow-hidden bg-[#141414] lg:hidden">
            <img
              src={loginBg}
              alt=""
              width={2528}
              height={1696}
              className="max-h-full max-w-full object-contain object-center"
              draggable={false}
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-6 py-6 sm:px-8 sm:py-8 lg:px-8 lg:py-9">
            <div className="mx-auto flex w-full max-w-[340px] flex-1 flex-col justify-center xl:max-w-[360px]">
              <div className="mb-7 flex flex-col items-center text-center">
                <img
                  src={logo}
                  alt="GrainsPro ERP"
                  className="mb-5 h-28 w-28 object-contain sm:h-32 sm:w-32"
                />
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Sign In</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                  Mobile number and password for portal access.
                </p>
              </div>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5">
                <div>
                  <Label htmlFor="mobile" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Mobile Number
                  </Label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#c9a227]" />
                    <Input
                      id="mobile"
                      type="tel"
                      placeholder="Enter 10-digit mobile number"
                      {...form.register("mobile")}
                      className="h-10 w-full rounded-lg border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-[#c9a227] focus-visible:ring-[#c9a227]/35"
                      maxLength={10}
                    />
                  </div>
                  {form.formState.errors.mobile && (
                    <p className="mt-1 text-sm text-red-500">{form.formState.errors.mobile.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#c9a227]" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      {...form.register("password")}
                      className="h-10 w-full rounded-lg border-slate-200 bg-slate-50 pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-[#c9a227] focus-visible:ring-[#c9a227]/35"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-[#c9a227]"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {form.formState.errors.password && (
                    <p className="mt-1 text-sm text-red-500">{form.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="rememberMe"
                      checked={form.watch("rememberMe")}
                      onCheckedChange={(checked) => {
                        form.setValue("rememberMe", checked);
                        handleRememberMeChange(checked);
                      }}
                      className="border-[#c9a227]/60 data-[state=checked]:border-[#c9a227] data-[state=checked]:bg-[#c9a227] data-[state=checked]:text-[#141414]"
                    />
                    <Label htmlFor="rememberMe" className="cursor-pointer text-sm text-slate-600">
                      Remember me
                    </Label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocation("/forgot-password")}
                    className="shrink-0 text-sm font-medium text-[#c9a227] underline-offset-2 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                <Button
                  type="submit"
                  className="mt-1 h-10 w-full rounded-lg border-2 border-[#c9a227] bg-[#141414] text-sm font-semibold text-white hover:bg-[#1f1f1f] hover:border-[#e8c547]"
                  disabled={form.formState.isSubmitting || isLoading}
                >
                  {form.formState.isSubmitting || isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#c9a227] border-t-transparent" />
                      <span>Signing In...</span>
                    </div>
                  ) : (
                    "Sign In"
                  )}
                </Button>

                <div className="flex justify-center pt-0.5">
                  <button
                    type="button"
                    onClick={() => setLocation("/superadmin/login")}
                    className="text-xs font-semibold text-slate-500 underline underline-offset-2 transition-colors hover:text-[#c9a227] sm:text-sm"
                  >
                    Super Admin Login
                  </button>
                </div>
              </form>
            </div>

            <div className="mx-auto mt-5 w-full max-w-[340px] border-t border-[#c9a227]/30 pt-3 text-center xl:max-w-[360px]">
              <p className="text-xs text-slate-400">All rights reserved, © {new Date().getFullYear()}</p>
              <p className="mt-1 text-xs text-slate-400">A Premium Product by</p>
              <p className="mt-0.5 text-sm font-semibold text-[#c9a227]">MWB Technologies India Pvt Ltd</p>
            </div>
          </div>
        </section>
      </div>

      {/* Force Logout Confirmation Dialog */}
      <AlertDialog open={showForceLogoutDialog} onOpenChange={setShowForceLogoutDialog}>
        <AlertDialogContent className="border-2 border-orange-200 shadow-2xl sm:max-w-lg">
          <div className="flex flex-col items-center space-y-4 py-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
              <AlertCircle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            </div>
            <AlertDialogHeader className="space-y-2 text-center">
              <AlertDialogTitle className="text-center text-2xl font-bold text-gray-900 dark:text-gray-100">
                Already Logged In
              </AlertDialogTitle>
              <AlertDialogDescription className="pt-2 text-base leading-relaxed text-gray-600 dark:text-gray-400">
                Your account is currently active on another device.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="w-full flex-col gap-2 sm:flex-row sm:gap-0">
              <AlertDialogCancel
                disabled={isSendingOTP}
                className="order-2 w-full border-gray-300 font-medium text-gray-700 hover:bg-gray-50 sm:order-1 sm:w-auto"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleContinueForceLogout}
                disabled={isSendingOTP}
                className="order-1 w-full bg-gradient-to-r from-orange-500 to-orange-600 font-semibold text-white shadow-lg transition-all duration-200 hover:from-orange-600 hover:to-orange-700 hover:shadow-xl sm:order-2 sm:w-auto"
              >
                {isSendingOTP ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Sending OTP...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Shield className="h-4 w-4" />
                    <span>Continue with Force Logout</span>
                  </div>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* OTP Input Dialog */}
      <AlertDialog open={showOTPScreen} onOpenChange={setShowOTPScreen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Enter OTP
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Please enter the 4-digit OTP sent to {userMobile} to logout from the previous device.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="otp" className="text-sm font-medium">
                Enter OTP
              </Label>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={4}
                  value={otp}
                  onChange={(value) => setOtp(value)}
                  disabled={isVerifyingOTP || isSendingOTP}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <p className="text-center text-xs text-gray-500">
                Enter the 4-digit OTP sent to {userMobile}
              </p>
            </div>

            <div className="flex justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleContinueForceLogout}
                disabled={isSendingOTP || isVerifyingOTP}
                className="text-sm"
              >
                {isSendingOTP ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-gray-600" />
                    Sending...
                  </>
                ) : (
                  "Resend OTP"
                )}
              </Button>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isVerifyingOTP || isSendingOTP}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForceLogout}
              disabled={isVerifyingOTP || isSendingOTP || otp.length !== 4}
              className="bg-gradient-to-r from-gray-900 to-black"
            >
              {isVerifyingOTP ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                  Verifying...
                </div>
              ) : (
                "Verify & Login"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
