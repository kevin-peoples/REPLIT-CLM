import { ReactNode } from "react";
import { Sidebar, MobileHeader } from "./sidebar";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Desktop: fixed left sidebar */}
      <Sidebar />

      {/* Mobile: sticky top header */}
      <MobileHeader />

      {/* Main content — offset by sidebar on desktop, by header on mobile */}
      <main className="md:pl-64">
        <div className="max-w-7xl mx-auto px-4 py-4 pt-[calc(3.5rem+1rem)] md:pt-8 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
