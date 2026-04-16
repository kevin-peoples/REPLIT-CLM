import { useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

export default function Login() {
  const { data: user, isLoading, error } = useGetMe({ query: { retry: false } });
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && !isLoading) {
      setLocation("/dashboard");
    }
  }, [user, isLoading, setLocation]);

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
    <div className="min-h-[100dvh] flex bg-background">
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-primary rounded flex items-center justify-center text-primary-foreground">
              <FileText className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">CLM Pro</h2>
          </div>
          
          <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-2">
            Sign in to your account
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            Secure access to your contract lifecycle management portal.
          </p>

          <div className="mt-6">
            <Button 
              className="w-full" 
              size="lg" 
              onClick={() => { (window.top || window).location.href = "/api/auth/google"; }}
            >
              Sign in with Google
            </Button>
          </div>
        </div>
      </div>
      <div className="hidden lg:block relative w-0 flex-1 bg-muted">
        <div className="absolute inset-0 h-full w-full object-cover bg-primary/5 flex flex-col justify-center p-24">
           <div className="max-w-2xl">
              <h2 className="text-4xl font-bold text-foreground mb-6">Master your contracts.</h2>
              <p className="text-xl text-muted-foreground">
                The command center for legal and operations teams. Precise, information-dense, professional, and authoritative.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}
