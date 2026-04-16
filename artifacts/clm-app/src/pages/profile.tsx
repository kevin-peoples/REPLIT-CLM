import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { LogOut, User } from "lucide-react";

export default function Profile() {
  const { data: me, isLoading } = useGetMe();
  const logout = useLogout();

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">My Profile</h1>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-2xl">
                {me?.name?.charAt(0) ?? <User className="w-8 h-8" />}
              </div>
              <div>
                <CardTitle>{isLoading ? "Loading..." : me?.name}</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">{me?.email}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Roles</p>
              <div className="flex flex-wrap gap-2">
                {me?.roles?.length ? me.roles.map((role) => (
                  <Badge key={role} variant="secondary" className="capitalize">{role.replace(/_/g, " ")}</Badge>
                )) : (
                  <span className="text-sm text-muted-foreground">No roles assigned. Contact your admin.</span>
                )}
              </div>
            </div>
            <div className="pt-4 border-t">
              <Button
                variant="outline"
                className="w-full justify-center gap-2 text-muted-foreground"
                onClick={() => logout.mutate(undefined, { onSuccess: () => window.location.href = "/" })}
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
