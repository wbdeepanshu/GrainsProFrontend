import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
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
import { Eye, EyeOff, Shield, Lock, User, CheckCircle, Phone, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import logo from "../assets/gp_logo1.png"

export default function Login() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [animatedElements, setAnimatedElements] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForceLogoutDialog, setShowForceLogoutDialog] = useState(false);
  const [showOTPScreen, setShowOTPScreen] = useState(false);
  const [otp, setOtp] = useState("");
  const [isSendingOTP, setIsSendingOTP] = useState(false);
  const [isVerifyingOTP, setIsVerifyingOTP] = useState(false);
  const [userMobile, setUserMobile] = useState("");
  const { toast } = useToast();

  // Add login page class to body and html for proper scrolling
  useEffect(() => {
    document.body.classList.add('login-page-active');
    document.documentElement.classList.add('login-page-active');

    return () => {
      document.body.classList.remove('login-page-active');
      document.documentElement.classList.remove('login-page-active');
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

  // Floating animation elements
  useEffect(() => {
    const elements = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      size: Math.random() * 60 + 20,
      left: Math.random() * 100,
      delay: Math.random() * 4,
      duration: Math.random() * 10 + 10,
    }));
    setAnimatedElements(elements);
  }, []);

  const handleRememberMeChange = (checked) => {
    if (checked) {
      const mobile = form.getValues("mobile")
      const password = form.getValues("password")
      //alert(`Remember me is checked! Your credentials is  ${mobile + " " + password}.`);
      localStorage.setItem(
        "credentials",
        JSON.stringify({ mobile, password })
      )
    }
    else {
      //alert("Remember me is unchecked! Your credentials will be saved.");
      form.setValue("mobile", "") // keep empty if missing
      form.setValue("password", "") // keep empty if missing
      localStorage.removeItem("credentials")
    }
  };

  useEffect(() => {
    const savedCredentials = localStorage.getItem("credentials")

    if (savedCredentials) {
      try {
        const { mobile } = JSON.parse(savedCredentials)
        const { password } = JSON.parse(savedCredentials)

        if (mobile) {
          //alert(mobile)
          form.setValue("rememberMe", true)
          form.setValue("mobile", mobile) // bind to textbox
        } else {
          form.setValue("mobile", "") // keep empty if missing
        }
        if (password) {
          form.setValue("password", password) // bind to textbox
        } else {
          form.setValue("password", "") // keep empty if missing
        }
      } catch (error) {
        console.error("Invalid credentials format in localStorage:", error)
        form.setValue("mobile", "")
        form.setValue("password", "")
        form.setValue("rememberMe", false)
      }
    } else {
      form.setValue("mobile", "")
      form.setValue("password", "")
      form.setValue("rememberMe", false)
      localStorage.removeItem("credentials")
    }
  }, [form])

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
        // Clear any existing cache to ensure fresh data for the new user
        queryClient.clear();
        queryClient.invalidateQueries();
        queryClient.resetQueries();

        // Close dialogs and reset OTP
        setShowOTPScreen(false);
        setShowForceLogoutDialog(false);
        setOtp("");

        toast({
          title: "Login Successful",
          description: `Welcome back, ${response.data?.name || 'User'}!`,
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

      //console.log(response)
      if (response.status === 200) {
        // Clear any existing cache to ensure fresh data for the new user
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
        // User is already logged in on another device
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
      //alert("Login error:", error);
      toast({
        title: "Login Failed",
        description: error.message || "Unable to connect to server. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page login-container h-screen min-h-0 overflow-hidden bg-gradient-to-br from-gray-900 via-black to-gray-800 px-3 sm:px-6 lg:px-8 relative flex flex-col">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {animatedElements.map((element) => (
          <div
            key={element.id}
            className="absolute bg-white bg-opacity-5 rounded-full animate-float"
            style={{
              width: `${element.size}px`,
              height: `${element.size}px`,
              left: `${element.left}%`,
              '--delay': `${element.delay}s`,
              '--duration': `${element.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Geometric shapes */}
      <div className="absolute top-10 left-10 w-32 h-32 border border-white border-opacity-20 rotate-45 animate-spin-slow"></div>
      <div className="absolute bottom-10 right-10 w-24 h-24 border border-white border-opacity-20 rotate-12 animate-pulse-gentle"></div>

      {/* Super admin login link moved below Sign In button inside card */}
      <div className="absolute top-1/3 right-20 w-16 h-16 bg-white bg-opacity-10 rounded-full animate-bounce-gentle"></div>

      <div className="flex-1 min-h-0 flex items-center justify-center py-4 sm:py-6">
        <div className="w-full max-w-md relative z-10 px-2 sm:px-4 flex items-center justify-center">
          <Card className="shadow-2xl border-0 backdrop-blur-sm bg-white bg-opacity-95 animate-slide-up w-full max-w-md">
            <CardContent className="p-4 sm:p-6 md:p-8">
              <div className="text-center mb-4 sm:mb-6">
                <div className="flex justify-center mb-3 sm:mb-4">
                  <div className="bg-gradient-to-r from-black to-gray-600 p-2 sm:p-3 rounded-full animate-bounce-gentle">
                    <div className="bg-white p-3 sm:p-4 rounded-full">
                      <img src={logo} alt="App Logo" className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24" />
                    </div>
                  </div>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 animate-fade-in">Sign In</h2>
              </div>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4">
                <div className="animate-slide-in-left">
                  <Label htmlFor="mobile" className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4" />
                      <span>Mobile Number</span>
                    </div>
                  </Label>
                  <Input
                    id="mobile"
                    type="tel"
                    placeholder="Enter your 10-digit mobile number"
                    {...form.register("mobile")}
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition-all text-base"
                    maxLength={10}
                  />
                  {form.formState.errors.mobile && (
                    <p className="text-red-500 text-sm mt-1 animate-shake">{form.formState.errors.mobile.message}</p>
                  )}
                </div>

                <div className="animate-slide-in-right">
                  <Label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center space-x-2">
                      <Lock className="h-4 w-4" />
                      <span>Password</span>
                    </div>
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      {...form.register("password")}
                      className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition-all text-base pr-10 sm:pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {form.formState.errors.password && (
                    <p className="text-red-500 text-sm mt-1 animate-shake">{form.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="flex items-center justify-between animate-fade-in">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="rememberMe"
                      checked={form.watch("rememberMe")}
                      // {...form.register("rememberMe")}
                      //onCheckedChange={handleRememberMeChange}
                      onCheckedChange={(checked) => {
                        form.setValue("rememberMe", checked) // update RHF state
                        handleRememberMeChange(checked)      // run your logic
                      }}
                    />
                    <Label htmlFor="rememberMe" className="text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4" />
                        <span>Remember me</span>
                      </div>
                    </Label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocation("/forgot-password")}
                    className="text-sm text-black hover:underline transition-all transform hover:scale-105"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* <div className="text-center animate-fade-in">
                  <p className="text-gray-600 text-sm">
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setLocation("/signup")}
                      className="text-black hover:underline font-medium transition-all transform hover:scale-105"
                    >
                      Sign Up
                    </button>
                  </p>
                </div> */}

                <Button
                  type="submit"
                  className="w-full py-2 sm:py-2.5 px-4 bg-gradient-to-r from-gray-900 to-black text-white font-semibold rounded-lg hover:opacity-90 transition-all focus:ring-4 focus:ring-gray-300"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Signing In...</span>
                    </div>
                  ) : (
                    "Sign In"
                  )}
                </Button>

                {/* Super admin login link centered below Sign In button */}
                <div className="flex justify-center" style={{ marginBottom: "-25px" }}>
                  <button
                    type="button"
                    onClick={() => setLocation("/superadmin/login")}
                    className="text-xs sm:text-sm text-gray-900 hover:text-gray-600 underline transition-colors font-semibold"
                    style={{
                      marginTop: "-11px",
                    }}
                  >
                    Super Admin Login
                  </button>
                </div>

              </form>
            </CardContent>
          </Card>

          {/* <div className="text-center text-gray-300 text-xs sm:text-sm animate-fade-in-up">
            <p className="bg-black bg-opacity-20 rounded-lg p-2 sm:p-3 backdrop-blur-sm">
              Demo credentials: admin@cpmanager.com / admin123
            </p>
          </div> */}
        </div>
      </div>

      {/* Force Logout Confirmation Dialog */}
      <AlertDialog open={showForceLogoutDialog} onOpenChange={setShowForceLogoutDialog}>
        <AlertDialogContent className="sm:max-w-lg border-2 border-orange-200 shadow-2xl">
          <div className="flex flex-col items-center space-y-4 py-2">
            {/* Icon Container */}
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/20">
              <AlertCircle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            </div>

            <AlertDialogHeader className="text-center space-y-2">
              <AlertDialogTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100 text-center">
                Already Logged In
              </AlertDialogTitle>
              <AlertDialogDescription className="text-base text-gray-600 dark:text-gray-400 leading-relaxed pt-2">
                Your account is currently active on another device.
                {/* To continue here, you'll need to logout from the previous session. */}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {/* Info Box */}
            {/* <div className="w-full p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300 text-center">
                <Shield className="h-4 w-4 inline-block mr-1.5" />
                This action will securely logout your previous session
              </p>
            </div> */}

            <AlertDialogFooter className="w-full flex-col sm:flex-row gap-2 sm:gap-0">
              <AlertDialogCancel
                disabled={isSendingOTP}
                className="w-full sm:w-auto order-2 sm:order-1 border-gray-300 hover:bg-gray-50 text-gray-700 font-medium"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleContinueForceLogout}
                disabled={isSendingOTP}
                className="w-full sm:w-auto order-1 sm:order-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {isSendingOTP ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
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
              <p className="text-xs text-gray-500 text-center">
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
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                    Sending...
                  </>
                ) : (
                  "Resend OTP"
                )}
              </Button>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isVerifyingOTP || isSendingOTP}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForceLogout}
              disabled={isVerifyingOTP || isSendingOTP || otp.length !== 4}
              className="bg-gradient-to-r from-gray-900 to-black"
            >
              {isVerifyingOTP ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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