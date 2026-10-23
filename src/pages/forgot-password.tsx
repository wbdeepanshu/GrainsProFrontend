import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  type ForgotPasswordFormData,
  type ResetPasswordFormData,
} from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, Phone, ArrowLeft } from "lucide-react";
import logo from "../assets/gp_logo1.png";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [mobile, setMobile] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [animatedElements, setAnimatedElements] = useState<
    { id: number; size: number; left: number; delay: number; duration: number }[]
  >([]);

  useEffect(() => {
    document.body.classList.add("login-page-active");
    document.documentElement.classList.add("login-page-active");

    return () => {
      document.body.classList.remove("login-page-active");
      document.documentElement.classList.remove("login-page-active");
    };
  }, []);

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

  const formStep1 = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      mobile: "",
    },
  });

  const formStep2 = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      mobile: "",
      otp: "",
      new_password: "",
      confirmPassword: "",
    },
  });

  const onStep1Submit = async (data: ForgotPasswordFormData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/forget-password/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mobile: data.mobile }),
      });

      const result = await response.json();

      if (response.ok && result.status === 200) {
        setMobile(data.mobile);
        formStep2.setValue("mobile", data.mobile);
        if (result.otp) {
          formStep2.setValue("otp", String(result.otp));
        }
        setStep(2);
        toast({
          title: "OTP Sent",
          description:
            result.message ||
            "OTP sent successfully. Enter it below along with your new password.",
        });
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to send OTP. Please try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Unable to connect. Please try again.",
        variant: "destructive",
      });
    }
  };

  const onStep2Submit = async (data: ResetPasswordFormData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/forget-password/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mobile: data.mobile,
          otp: data.otp,
          new_password: data.new_password,
        }),
      });

      const result = await response.json();

      if (response.ok && result.status === 200) {
        toast({
          title: "Password Updated",
          description:
            result.message ||
            "Password updated successfully. You can now sign in.",
        });
        setLocation("/login");
      } else {
        toast({
          title: "Error",
          description:
            result.message || "Invalid or expired OTP. Please request a new one.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Unable to connect. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBackToStep1 = () => {
    setStep(1);
    formStep1.setValue("mobile", mobile);
    formStep2.reset();
  };

  const inputClassName =
    "w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition-all text-base";

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
              // @ts-expect-error CSS custom properties
              "--delay": `${element.delay}s`,
              "--duration": `${element.duration}s`,
            }}
          />
        ))}
      </div>

      <div className="absolute top-10 left-10 w-32 h-32 border border-white border-opacity-20 rotate-45 animate-spin-slow pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-24 h-24 border border-white border-opacity-20 rotate-12 animate-pulse-gentle pointer-events-none" />
      <div className="absolute top-1/3 right-20 w-16 h-16 bg-white bg-opacity-10 rounded-full animate-bounce-gentle pointer-events-none" />

      <div className="flex-1 min-h-0 flex items-center justify-center py-4 sm:py-6">
        <div className="w-full max-w-md relative z-10 px-2 sm:px-4 flex items-center justify-center">
          <Card className="shadow-2xl border-0 backdrop-blur-sm bg-white bg-opacity-95 animate-slide-up w-full max-w-md">
            <CardContent className="p-4 sm:p-6 md:p-8">
              <div className="text-center mb-4 sm:mb-6">
                <div className="flex justify-center mb-3 sm:mb-4">
                  <div className="bg-gradient-to-r from-black to-gray-600 p-2 sm:p-3 rounded-full animate-bounce-gentle">
                    <div className="bg-white p-3 sm:p-4 rounded-full">
                      <img
                        src={logo}
                        alt="GrainsPro Logo"
                        className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24"
                      />
                    </div>
                  </div>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 animate-fade-in">
                  {step === 1 ? "Forgot Password" : "Set New Password"}
                </h2>
                <p className="text-sm text-gray-600 mt-2">
                  {step === 1
                    ? "Enter your mobile number to receive an OTP"
                    : "Enter the OTP sent to your mobile and your new password"}
                </p>
              </div>

              {step === 1 ? (
                <form
                  onSubmit={formStep1.handleSubmit(onStep1Submit)}
                  className="space-y-3 sm:space-y-4"
                >
                  <div className="animate-slide-in-left">
                    <Label
                      htmlFor="mobile"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4" />
                        <span>Mobile Number</span>
                      </div>
                    </Label>
                    <Input
                      id="mobile"
                      type="tel"
                      placeholder="Enter your 10-digit mobile number"
                      {...formStep1.register("mobile")}
                      className={inputClassName}
                      maxLength={10}
                    />
                    {formStep1.formState.errors.mobile && (
                      <p className="text-red-500 text-sm mt-1 animate-shake">
                        {formStep1.formState.errors.mobile.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full py-2 sm:py-2.5 px-4 bg-gradient-to-r from-gray-900 to-black text-white font-semibold rounded-lg hover:opacity-90 transition-all focus:ring-4 focus:ring-gray-300"
                    disabled={formStep1.formState.isSubmitting}
                  >
                    {formStep1.formState.isSubmitting ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        <span>Sending OTP...</span>
                      </div>
                    ) : (
                      "Send OTP"
                    )}
                  </Button>

                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setLocation("/login")}
                      className="text-xs sm:text-sm text-gray-900 hover:text-gray-600 underline transition-colors font-semibold"
                    >
                      Back to Login
                    </button>
                  </div>
                </form>
              ) : (
                <form
                  onSubmit={formStep2.handleSubmit(onStep2Submit)}
                  className="space-y-3 sm:space-y-4"
                >
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-2">
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4" />
                        <span>Mobile Number</span>
                      </div>
                    </Label>
                    <Input
                      value={mobile}
                      readOnly
                      className={`${inputClassName} bg-gray-50`}
                    />
                  </div>

                  <div>
                    <Label
                      htmlFor="otp"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      OTP (4 digits)
                    </Label>
                    <Input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      placeholder="Enter OTP"
                      {...formStep2.register("otp")}
                      className={inputClassName}
                      maxLength={4}
                    />
                    {formStep2.formState.errors.otp && (
                      <p className="text-red-500 text-sm mt-1">
                        {formStep2.formState.errors.otp.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="new_password"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      <div className="flex items-center space-x-2">
                        <Lock className="h-4 w-4" />
                        <span>New Password</span>
                      </div>
                    </Label>
                    <div className="relative">
                      <Input
                        id="new_password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter new password (min 6 characters)"
                        {...formStep2.register("new_password")}
                        className={`${inputClassName} pr-10 sm:pr-12`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff size={20} />
                        ) : (
                          <Eye size={20} />
                        )}
                      </button>
                    </div>
                    {formStep2.formState.errors.new_password && (
                      <p className="text-red-500 text-sm mt-1">
                        {formStep2.formState.errors.new_password.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label
                      htmlFor="confirmPassword"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      <div className="flex items-center space-x-2">
                        <Lock className="h-4 w-4" />
                        <span>Confirm Password</span>
                      </div>
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm new password"
                        {...formStep2.register("confirmPassword")}
                        className={`${inputClassName} pr-10 sm:pr-12`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={20} />
                        ) : (
                          <Eye size={20} />
                        )}
                      </button>
                    </div>
                    {formStep2.formState.errors.confirmPassword && (
                      <p className="text-red-500 text-sm mt-1">
                        {formStep2.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full py-2 sm:py-2.5 px-4 bg-gradient-to-r from-gray-900 to-black text-white font-semibold rounded-lg hover:opacity-90 transition-all focus:ring-4 focus:ring-gray-300"
                    disabled={formStep2.formState.isSubmitting}
                  >
                    {formStep2.formState.isSubmitting ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        <span>Updating...</span>
                      </div>
                    ) : (
                      "Update Password"
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBackToStep1}
                    className="w-full py-2 sm:py-2.5 border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to change mobile
                  </Button>

                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setLocation("/login")}
                      className="text-xs sm:text-sm text-gray-900 hover:text-gray-600 underline transition-colors font-semibold"
                    >
                      Back to Login
                    </button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
