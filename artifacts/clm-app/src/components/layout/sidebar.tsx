import { Link, useLocation } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import {
  LayoutDashboard,
  FileText,
  Settings,
  User,
  LogOut,
  Plus,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

function useNavLinks() {
  const { data: user } = useGetMe();
  return [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/contracts", label: "Contracts", icon: FileText },
    ...(user?.roles?.includes("admin") ? [{ href: "/admin", label: "Admin", icon: Settings }] : []),
    { href: "/profile", label: "Profile", icon: User },
  ];
}

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { data: user } = useGetMe();
  const logout = useLogout();
  const links = useNavLinks();

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 font-bold text-xl tracking-tight text-sidebar-foreground flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-primary-foreground shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        CLM Pro
      </div>

      <div className="px-4 py-2">
        <Button asChild className="w-full justify-start gap-2" variant="default">
          <Link href="/contracts/new" onClick={onNavigate}>
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
            <Link key={link.href} href={link.href} onClick={onNavigate}>
              <span className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <Icon className="w-4 h-4 shrink-0" />
                {link.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm shrink-0">
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
          onClick={() => logout.mutate(undefined, { onSuccess: () => (window.location.href = "/") })}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

/** Desktop sidebar — hidden on mobile */
export function Sidebar() {
  return (
    <div className="hidden md:flex flex-col w-64 bg-sidebar border-r border-sidebar-border h-[100dvh] fixed left-0 top-0 z-30">
      <NavContent />
    </div>
  );
}

/** Mobile top header with slide-out drawer */
export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const links = useNavLinks();

  const currentPage = links.find((l) => location.startsWith(l.href))?.label ?? "CLM Pro";

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-background border-b flex items-center px-4 gap-3">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0">
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar [&>button]:hidden">
          <NavContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="w-6 h-6 bg-primary rounded flex items-center justify-center text-primary-foreground shrink-0">
          <FileText className="w-3.5 h-3.5" />
        </div>
        <span className="font-semibold text-sm truncate">{currentPage}</span>
      </div>

      <Button asChild size="sm" className="shrink-0 gap-1.5 h-8 text-xs px-3">
        <Link href="/contracts/new">
          <Plus className="w-3.5 h-3.5" /> New
        </Link>
      </Button>
    </header>
  );
}
