"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/lib/auth-store";
import { checkBackendConnection } from "@/lib/api/client";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuthStore();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checkingBackend, setCheckingBackend] = useState(true);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    let mounted = true;

    async function runCheck() {
      setCheckingBackend(true);
      const ok = await checkBackendConnection();
      if (!mounted) return;
      setBackendOnline(ok);
      setCheckingBackend(false);
    }

    void runCheck();
    return () => {
      mounted = false;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (backendOnline === false) {
      toast.warning("Backend holati noaniq. Login urinishini davom ettiramiz.");
    }

    const result = await login(identifier, password);
    if (!result.success) {
      toast.error(result.error ?? "Kirishda xatolik");
      return;
    }

    toast.success("Xush kelibsiz");
    router.replace("/dashboard");
  }

  async function recheckBackend() {
    setCheckingBackend(true);
    const ok = await checkBackendConnection();
    setBackendOnline(ok);
    setCheckingBackend(false);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#edf3fb] px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(55,119,244,0.16),transparent_35%),radial-gradient(circle_at_88%_76%,rgba(106,76,226,0.14),transparent_40%)]" />

      <Card className="relative z-10 w-full max-w-[420px] rounded-3xl border border-white/45 bg-white/90 shadow-[0_24px_44px_-30px_rgba(38,53,90,0.7)]">
        <CardHeader className="space-y-2 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl gradient-primary">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <button
              type="button"
              onClick={recheckBackend}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                checkingBackend
                  ? "bg-[#eef1f8] text-[#647192]"
                  : backendOnline
                    ? "bg-[#e9fbf1] text-[#188454]"
                    : "bg-[#fff2f2] text-[#b64b4b]"
              }`}
            >
              {checkingBackend ? "Tekshirilmoqda..." : backendOnline ? "Backend online" : "Backend offline"}
            </button>
          </div>
          <CardTitle className="font-heading text-2xl text-[#253254]">Tizimga kirish</CardTitle>
          <CardDescription className="text-[#66739a]">
            Superadmin yoki admin account bilan davom eting.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="identifier">Login</Label>
              <Input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="superadmin@academy.uz"
                className="soft-input h-11"
                autoComplete="username"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Parol</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Parolingiz"
                  className="soft-input h-11 pr-10"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8792b1] transition hover:text-[#3e4a73]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="gradient-primary h-11 w-full rounded-xl text-sm"
              disabled={isLoading || checkingBackend}
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  Tekshirilmoqda...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Kirish
                </span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
