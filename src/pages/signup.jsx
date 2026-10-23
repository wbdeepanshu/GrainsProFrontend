import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, EyeOff, Shield, Lock, User, CheckCircle, Phone, Mail, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Loader from "../components/common/loader";

export default function Signup() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [animatedElements, setAnimatedElements] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      mobile: "",
      email: "",
      password: "",
      confirmPassword: "",
      agreeToTerms: false,
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

  const onSubmit = async (data) => {
    try {
      setIsLoading(true);
      
      // Simulate API call for demo purposes
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Account Created Successfully",
        description: `Welcome to Grain Pro ERP, ${data.name}! Please check your email for verification.`,
      });
      
      // Redirect to login page after successful signup
      setTimeout(() => {
        setLocation("/login");
      }, 2000);
      
    } catch (error) {
      console.error("Signup error:", error);
      toast({
        title: "Signup Failed",
        description: error.message || "Unable to create account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg px-4 sm:px-6 lg:px-8 relative overflow-hidden">
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
      <div className="absolute bottom-10 right-10 w-24 h-24 border border-white border-opacity-20 rotate-12 animate-pulse"></div>
      <div className="absolute top-1/3 right-20 w-16 h-16 bg-white bg-opacity-10 rounded-full animate-bounce"></div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Header with animation */}
        <div className="text-center animate-fade-in-down">
          <div className="flex justify-center mb-4">
            <div className="bg-white bg-opacity-20 p-4 rounded-full animate-pulse">
              <Shield className="text-white h-12 w-12" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 animate-fade-in">Grain Pro ERP</h1>
          <p className="text-gray-300 text-lg animate-fade-in-up">Enterprise Resource Planning</p>
        </div>
        
        <Card className="shadow-2xl border-0 backdrop-blur-sm bg-white bg-opacity-95 animate-slide-up">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="bg-gradient-to-r from-black to-gray-600 p-3 rounded-full animate-bounce">
                  <User className="text-white h-8 w-8" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 animate-fade-in">Create Account</h2>
              <p className="text-gray-600 mt-2 animate-fade-in-up">Join Grain Pro ERP today</p>
            </div>
            
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="animate-slide-in-left">
                <Label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span>Full Name</span>
                  </div>
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  {...form.register("name")}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition-all transform hover:scale-105"
                />
                {form.formState.errors.name && (
                  <p className="text-red-500 text-sm mt-1 animate-shake">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="animate-slide-in-right">
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition-all transform hover:scale-105"
                  maxLength={10}
                />
                {form.formState.errors.mobile && (
                  <p className="text-red-500 text-sm mt-1 animate-shake">{form.formState.errors.mobile.message}</p>
                )}
              </div>

              <div className="animate-slide-in-left">
                <Label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4" />
                    <span>Email Address (Optional)</span>
                  </div>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  {...form.register("email")}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition-all transform hover:scale-105"
                />
                {form.formState.errors.email && (
                  <p className="text-red-500 text-sm mt-1 animate-shake">{form.formState.errors.email.message}</p>
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
                    placeholder="Create a strong password"
                    {...form.register("password")}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition-all transform hover:scale-105 pr-12"
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

              <div className="animate-slide-in-left">
                <Label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center space-x-2">
                    <Lock className="h-4 w-4" />
                    <span>Confirm Password</span>
                  </div>
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    {...form.register("confirmPassword")}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition-all transform hover:scale-105 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {form.formState.errors.confirmPassword && (
                  <p className="text-red-500 text-sm mt-1 animate-shake">{form.formState.errors.confirmPassword.message}</p>
                )}
              </div>
              
              <div className="flex items-start space-x-2 animate-fade-in">
                <Checkbox
                  id="agreeToTerms"
                  {...form.register("agreeToTerms")}
                  className="mt-1"
                />
                <Label htmlFor="agreeToTerms" className="text-sm text-gray-600 leading-relaxed">
                  <div className="flex items-start space-x-2">
                    <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      I agree to the{" "}
                      <button
                        type="button"
                        className="text-black hover:underline font-medium"
                        onClick={() => toast({
                          title: "Terms & Conditions",
                          description: "Terms and conditions will be displayed here.",
                        })}
                      >
                        Terms & Conditions
                      </button>{" "}
                      and{" "}
                      <button
                        type="button"
                        className="text-black hover:underline font-medium"
                        onClick={() => toast({
                          title: "Privacy Policy",
                          description: "Privacy policy will be displayed here.",
                        })}
                      >
                        Privacy Policy
                      </button>
                    </span>
                  </div>
                </Label>
              </div>
              {form.formState.errors.agreeToTerms && (
                <p className="text-red-500 text-sm animate-shake">{form.formState.errors.agreeToTerms.message}</p>
              )}
              
              <Button
                type="submit"
                className="w-full py-3 px-4 gradient-bg text-white font-semibold rounded-lg hover:opacity-90 transition-all transform hover:scale-105 focus:ring-4 focus:ring-gray-300 animate-pulse-custom"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Creating Account...</span>
                  </div>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-600 text-sm">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setLocation("/login")}
                  className="text-black hover:underline font-medium transition-all transform hover:scale-105"
                >
                  Sign In
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
        
        <div className="text-center text-gray-300 text-sm animate-fade-in-up">
          <p className="bg-black bg-opacity-20 rounded-lg p-3 backdrop-blur-sm">
            Demo: This is a static signup page for demonstration purposes
          </p>
          <div className="mt-4">
            <p className="text-gray-400 text-xs">
              © 2024 MWB Technologies Pvt Ltd. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* Loader */}
      <Loader isLoading={isLoading} text="Creating your account" />
    </div>
  );
} 