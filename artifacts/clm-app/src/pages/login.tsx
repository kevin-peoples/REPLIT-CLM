import { useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Shield, Scale, PenLine, User } from "lucide-react";

const DEMO_ACCOUNTS = [
  {
    role: "admin",
    label: "Admin",
    name: "Alex Admin",
    email: "admin@demo.clm",
    description: "Full access — manage users, workflows, and all contracts",
    icon: Shield,
    color: "bg-red-50 border-red-200 hover:bg-red-100",
    iconColor: "text-red-600 bg-red-100",
    badgeColor: "bg-red-100 text-red-700",
  },
  {
    role: "submitter",
    label: "Submitter",
    name: "Sam Submitter",
    email: "submitter@demo.clm",
    description: "Create and submit contracts for legal review",
    icon: User,
    color: "bg-blue-50 border-blue-200 hover:bg-blue-100",
    iconColor: "text-blue-600 bg-blue-100",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  {
    role: "legal",
    label: "Legal Reviewer",
    name: "Laura Legal",
    email: "legal@demo.clm",
    description: "Review, approve, or return contracts for edits",
    icon: Scale,
    color: "bg-amber-50 border-amber-200 hover:bg-amber-100",
    iconColor: "text-amber-600 bg-amber-100",
    badgeColor: "bg-amber-100 text-amber-700",
  },
  {
    role: "signer",
    label: "Designated Signer",
    name: "Derek Signer",
    email: "signer@demo.clm",
    description: "Execute final signatures on approved contracts",
    icon: PenLine,
    color: "bg-green-50 border-green-200 hover:bg-green-100",
    iconColor: "text-green-600 bg-green-100",
    badgeColor: "bg-green-100 text-green-700",
  },
];

export default function Login() {
  const { data: user, isLoading } = useGetMe({ query: { retry: false } });
  const [, setLocation] = useLocation();
  const [loggingIn, setLoggingIn] = useState<string | null>(null);

  useEffect(() => {
    if (user && !isLoading) {
      setLocation("/dashboard");
    }
  }, [user, isLoading, setLocation]);

  async function handleDemoLogin(role: string) {
    setLoggingIn(role);
    try {
      const res = await fetch("/api/auth/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        window.location.href = "/dashboard";
      } else {
        const err = await res.json();
        console.error("Demo login failed:", err);
        setLoggingIn(null);
      }
    } catch (e) {
      console.error(e);
      setLoggingIn(null);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="animate-spin text-primary">
          <FileText className="w-8 h-8" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="flex min-h-[100dvh]">
        {/* Left panel */}
        <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-20 xl:px-24 overflow-y-auto">
          <div className="mx-auto w-full max-w-lg">
            {/* Logo */}
            <div className="flex items-center mb-10">
              <img
                src="/ancora-logo.webp"
                alt="Ancora"
                className="h-12 w-auto select-none"
                draggable={false}
              />
            </div>

            <h1 className="!text-[34px] mb-2 text-foreground">
              Sign in to your account
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
              Secure access to your contract lifecycle management portal.
            </p>

            {/* Google sign-in */}
            <Button
              className="w-full"
              size="lg"
              onClick={() => { window.location.href = "/api/auth/google"; }}
            >
              Sign in with Google
            </Button>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-3 text-muted-foreground font-medium tracking-wider">
                  Demo accounts
                </span>
              </div>
            </div>

            {/* Demo account cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DEMO_ACCOUNTS.map((account) => {
                const Icon = account.icon;
                const isActive = loggingIn === account.role;
                return (
                  <button
                    key={account.role}
                    onClick={() => handleDemoLogin(account.role)}
                    disabled={loggingIn !== null}
                    className={`text-left rounded-lg border p-4 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${account.color}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${account.iconColor}`}>
                        {isActive ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Icon className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-foreground">{account.name}</span>
                        </div>
                        <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded mb-1.5 ${account.badgeColor}`}>
                          {account.label}
                        </span>
                        <p className="text-xs text-muted-foreground leading-snug">{account.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground mt-6 text-center">
              Demo accounts are for testing only and do not require authentication.
            </p>
          </div>
        </div>

        {/* Right panel */}
        <div className="hidden lg:block relative w-0 flex-1 bg-primary/5">
          <div className="absolute inset-0 flex flex-col justify-center p-24">
            <div className="max-w-2xl">
              <h2 className="text-4xl font-bold text-foreground mb-6">Master your contracts.</h2>
              <p className="text-xl text-muted-foreground">
                The command center for legal and operations teams. Precise, information-dense, professional, and authoritative.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
