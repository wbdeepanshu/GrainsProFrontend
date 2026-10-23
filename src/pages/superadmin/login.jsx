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
import { Eye, EyeOff, Shield, Lock, User, CheckCircle, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import Loader from "@/components/common/loader";
import logo from "@/assets/gp_logo1.png";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

export default function SuperAdminLogin() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [animatedElements, setAnimatedElements] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
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
      localStorage.setItem(
        "superadmin_credentials",
        JSON.stringify({ mobile, password })
      )
    }
    else {
      form.setValue("mobile", "")
      form.setValue("password", "")
      localStorage.removeItem("superadmin_credentials")
    }
  };

  useEffect(() => {
    const savedCredentials = localStorage.getItem("superadmin_credentials")

    if (savedCredentials) {
      try {
        const { mobile } = JSON.parse(savedCredentials)
        const { password } = JSON.parse(savedCredentials)

        if (mobile) {
          form.setValue("rememberMe", true)
          form.setValue("mobile", mobile)
        } else {
          form.setValue("mobile", "")
        }
        if (password) {
          form.setValue("password", password)
        } else {
          form.setValue("password", "")
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
      localStorage.removeItem("superadmin_credentials")
    }
  }, [form])

  const onSubmit = async (data) => {
    try {
      setIsLoading(true);

      const response = await fetch(`${API_BASE_URL}/api/superadmin/super-admin/login/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mobile: data.mobile,
          password: data.password,
          source: "Portal",
        }),
      });

      const result = await response.json();
     
      if (result.status === 200) {
        // Store token and user data
        localStorage.setItem("superadmin_token", result.data.access_token);
        localStorage.setItem("superadmin_user", JSON.stringify(result.data));
        
        // Clear any existing cache
        queryClient.clear();
        queryClient.invalidateQueries();
        queryClient.resetQueries();
       
        toast({
          title: "Login Successful",
          description: `Welcome back, ${result.data.name}!`,
          variant: "success",
          duration: 800,
        });
        setLocation("/superadmin/onboarding-design");
      } else {
        toast({
          title: "Login Failed",
          description: result.message || "Invalid mobile number or password",
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

      {/* Organization admin login link - right bottom corner */}
      {/* <button
        type="button"
        onClick={() => setLocation("/login")}
        className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-20 text-xs sm:text-sm text-white/80 hover:text-white underline transition-colors"
      >
        Organization admin login
      </button> */}
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
                    disabled={isLoading}
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
                      disabled={isLoading}
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
                      onCheckedChange={(checked) => {
                        form.setValue("rememberMe", checked)
                        handleRememberMeChange(checked)
                      }}
                      disabled={isLoading}
                    />
                    <Label htmlFor="rememberMe" className="text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4" />
                        <span>Remember me</span>
                      </div>
                    </Label>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full py-2 sm:py-2.5 px-4 bg-gradient-to-r from-gray-900 to-black text-white font-semibold rounded-lg hover:opacity-90 transition-all focus:ring-4 focus:ring-gray-300"
                  disabled={isLoading || form.formState.isSubmitting}
                >
                  {isLoading || form.formState.isSubmitting ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Signing In...</span>
                    </div>
                  ) : (
                    "Sign In"
                  )}
                </Button>

                <div className="flex justify-center" style={{ marginBottom: "-25px" }}>
                  <button
                    type="button"
                    onClick={() => setLocation("/login")}
                    className="text-xs sm:text-sm text-gray-900 hover:text-gray-600 underline transition-colors font-semibold"
                    style={{
                      marginTop: "-11px",
                    }}
                  >
                    Organization Admin Login
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Loader */}
      <Loader isLoading={isLoading} text="Authenticating user" />
    </div>
  );
}
