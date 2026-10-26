import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Lock, Phone, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import Loader from "@/components/common/loader";
import logo from "@/assets/new_logo.png";
import loginBg from "@/assets/login_bg.png";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

export default function SuperAdminLogin() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
      localStorage.setItem(
        "superadmin_credentials",
        JSON.stringify({ mobile, password })
      );
    } else {
      form.setValue("mobile", "");
      form.setValue("password", "");
      localStorage.removeItem("superadmin_credentials");
    }
  };

  useEffect(() => {
    const savedCredentials = localStorage.getItem("superadmin_credentials");

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
      localStorage.removeItem("superadmin_credentials");
    }
  }, [form]);

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
        localStorage.setItem("superadmin_token", result.data.access_token);
        localStorage.setItem("superadmin_user", JSON.stringify(result.data));

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
    <div className="login-page login-container relative h-screen min-h-0 w-full overflow-hidden bg-[#141414]">
      <div className="flex h-full min-h-0 w-full flex-col lg:flex-row">
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

        <section className="relative z-20 flex h-full min-h-0 w-full flex-col border-[#c9a227] bg-white lg:w-[420px] lg:shrink-0 lg:border-l-2 xl:w-[460px]">
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
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-[#c9a227]/50 bg-[#141414] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#c9a227]">
                  <Shield className="h-3 w-3" />
                  Super Admin
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Sign In
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                  Mobile number and password for super admin access.
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
                      disabled={isLoading}
                    />
                  </div>
                  {form.formState.errors.mobile && (
                    <p className="mt-1 text-sm text-red-500">
                      {form.formState.errors.mobile.message}
                    </p>
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
                      disabled={isLoading}
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
                    <p className="mt-1 text-sm text-red-500">
                      {form.formState.errors.password.message}
                    </p>
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
                      disabled={isLoading}
                      className="border-[#c9a227]/60 data-[state=checked]:border-[#c9a227] data-[state=checked]:bg-[#c9a227] data-[state=checked]:text-[#141414]"
                    />
                    <Label htmlFor="rememberMe" className="cursor-pointer text-sm text-slate-600">
                      Remember me
                    </Label>
                  </div>
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
                    onClick={() => setLocation("/login")}
                    className="text-xs font-semibold text-slate-500 underline underline-offset-2 transition-colors hover:text-[#c9a227] sm:text-sm"
                  >
                    Organization Admin Login
                  </button>
                </div>
              </form>
            </div>

            <div className="mx-auto mt-5 w-full max-w-[340px] border-t border-[#c9a227]/30 pt-3 text-center xl:max-w-[360px]">
              <p className="text-xs text-slate-400">
                All rights reserved, © {new Date().getFullYear()}
              </p>
              <p className="mt-1 text-xs text-slate-400">A Premium Product by</p>
              <p className="mt-0.5 text-sm font-semibold text-[#c9a227]">
                MWB Technologies India Pvt Ltd
              </p>
            </div>
          </div>
        </section>
      </div>

      <Loader isLoading={isLoading} text="Authenticating user" />
    </div>
  );
}
