import { Link, useLocation } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { 
  LayoutDashboard, 
  FileText, 
  Settings, 
  User, 
  LogOut,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const [location] = useLocation();
  const { data: user } = useGetMe();
  const logout = useLogout();

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/contracts", label: "Contracts", icon: FileText },
    ...(user?.roles?.includes("admin") ? [{ href: "/admin", label: "Admin", icon: Settings }] : []),
    { href: "/profile", label: "Profile", icon: User },
  ];

  return (
    <div className="flex flex-col w-64 bg-sidebar border-r border-sidebar-border h-full h-[100dvh] fixed left-0 top-0">
      <div className="p-4 font-bold text-xl tracking-tight text-sidebar-foreground flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-primary-foreground">
          <FileText className="w-5 h-5" />
        </div>
        CLM Pro
      </div>
      
      <div className="px-4 py-2">
        <Button asChild className="w-full justify-start gap-2" variant="default">
          <Link href="/contracts/new">
            <Plus className="w-4 h-4" />
            New Contract
          </Link>
        </Button>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.startsWith(link.href);
          return (
            <Link key={link.href} href={link.href}>
              <span className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                isActive 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <Icon className="w-4 h-4" />
                {link.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
            {user?.name?.charAt(0) || "U"}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="text-sm font-medium truncate">{user?.name}</div>
            <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => logout.mutate(undefined, { onSuccess: () => window.location.href = "/" })}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
