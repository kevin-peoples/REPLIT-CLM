import { Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  useGetMe,
  useGetDashboardSummary,
  useGetExpiringContracts,
  useGetObligationsDue,
  useGetBottlenecks,
  useGetReviewerWorkload,
} from "@workspace/api-client-react";
import { formatCurrency, formatDate, statusColor, statusLabel, daysUntil } from "@/lib/utils";
import {
  FileText,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { data: me } = useGetMe();
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: expiring } = useGetExpiringContracts({ days: 30 });
  const { data: obligationsDue } = useGetObligationsDue();
  const { data: bottlenecks } = useGetBottlenecks();
  const { data: workload } = useGetReviewerWorkload({
    query: { enabled: me?.roles?.includes("admin") || me?.roles?.includes("legal_reviewer") },
  });

  const activeContracts = summary ? Object.entries(summary.statusCounts)
    .filter(([s]) => !["expired", "fully_executed"].includes(s))
    .reduce((sum, [, v]) => sum + v, 0) : 0;

  const pendingReview = summary ? (
    (summary.statusCounts["in_legal_review"] ?? 0) +
    (summary.statusCounts["approved_pending_signature"] ?? 0) +
    (summary.statusCounts["ai_screening"] ?? 0)
  ) : 0;

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Welcome back, {me?.name?.split(" ")[0]}</p>
        </div>
        <Button asChild size="sm" className="hidden md:inline-flex">
          <Link href="/contracts/new">
            <FileText className="w-4 h-4 mr-2" /> New Contract
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Active Contracts"
          value={summaryLoading ? undefined : activeContracts}
          icon={<FileText className="w-5 h-5" />}
          loading={summaryLoading}
          color="text-blue-600"
          bg="bg-blue-50"
          href="/contracts?status=active"
        />
        <StatCard
          label="Total Active Value"
          value={summaryLoading ? undefined : formatCurrency(summary?.totalActiveValue)}
          icon={<DollarSign className="w-5 h-5" />}
          loading={summaryLoading}
          color="text-green-600"
          bg="bg-green-50"
        />
        <StatCard
          label="Pending Review"
          value={summaryLoading ? undefined : pendingReview}
          icon={<Clock className="w-5 h-5" />}
          loading={summaryLoading}
          color="text-yellow-600"
          bg="bg-yellow-50"
          href="/contracts?status=in_legal_review"
        />
        <StatCard
          label="Avg Cycle Time"
          value={summaryLoading ? undefined : summary?.averageCycleTimeDays != null ? `${Math.round(summary.averageCycleTimeDays)} days` : "—"}
          icon={<TrendingUp className="w-5 h-5" />}
          loading={summaryLoading}
          color="text-purple-600"
          bg="bg-purple-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Expiring Soon (30 days)
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/contracts">View all <ArrowRight className="w-3 h-3 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!expiring?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No contracts expiring in the next 30 days.</p>
            ) : (
              <div className="space-y-1">
                {expiring.slice(0, 5).map((c) => {
                  const days = daysUntil(c.expirationDate);
                  return (
                    <Link key={c.id} href={`/contracts/${c.id}`}>
                      <div className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted/50 cursor-pointer transition-colors">
                        <div>
                          <p className="text-sm font-medium">{c.contractName}</p>
                          <p className="text-xs text-muted-foreground">{c.counterpartyName}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-medium text-amber-600">{days}d left</p>
                          <p className="text-xs text-muted-foreground">{formatDate(c.expirationDate)}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-blue-500" /> Obligations Due Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!obligationsDue?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No obligations due in the next 30 days.</p>
            ) : (
              <div className="space-y-1">
                {obligationsDue.slice(0, 5).map((ob) => {
                  const days = daysUntil(ob.dueDate);
                  return (
                    <Link key={ob.id} href={`/contracts/${ob.contractId}`}>
                      <div className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted/50 cursor-pointer transition-colors">
                        <div>
                          <p className="text-sm font-medium">{ob.description}</p>
                          <p className="text-xs text-muted-foreground">{ob.contractName}</p>
                        </div>
                        <div className="text-right">
                          <p className={cn("text-xs font-medium", days !== null && days <= 3 ? "text-red-600" : "text-amber-600")}>
                            {days}d left
                          </p>
                          <p className="text-xs text-muted-foreground">{formatDate(ob.dueDate)}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-red-500" /> Workflow Bottlenecks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!bottlenecks?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No bottlenecks detected.</p>
            ) : (
              <div className="space-y-1">
                {bottlenecks.slice(0, 5).map((b) => (
                  <Link key={b.id} href={`/contracts/${b.id}`}>
                    <div className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted/50 cursor-pointer transition-colors">
                      <div>
                        <p className="text-sm font-medium">{b.contractName}</p>
                        <p className="text-xs text-muted-foreground">Stuck at: {b.currentStageName ?? statusLabel(b.status)}</p>
                      </div>
                      <div className="text-right">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", statusColor(b.status))}>
                          {b.daysAtStage}d
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Contracts by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {summary && Object.entries(summary.statusCounts)
                  .filter(([, count]) => (count as number) > 0)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([s, count]) => (
                    <div key={s} className="flex items-center justify-between">
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", statusColor(s))}>
                        {statusLabel(s)}
                      </span>
                      <span className="text-sm font-medium">{count as number}</span>
                    </div>
                  ))
                }
                {(!summary || Object.values(summary.statusCounts).every((v) => v === 0)) && (
                  <p className="text-sm text-muted-foreground text-center py-4">No contracts yet.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {workload && workload.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" /> Reviewer Workload
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {workload.map((r) => {
                  const maxCount = Math.max(...workload.map((x) => x.assignedCount), 1);
                  return (
                    <div key={r.userId} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm shrink-0">
                        {r.userName?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.userName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 bg-muted rounded-full h-1.5">
                            <div
                              className="bg-primary rounded-full h-1.5 transition-all"
                              style={{ width: `${(r.assignedCount / maxCount) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-8 text-right">{r.assignedCount}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

function StatCard({ label, value, icon, loading, color, bg, href }: {
  label: string;
  value?: string | number | null;
  icon: React.ReactNode;
  loading?: boolean;
  color: string;
  bg: string;
  href?: string;
}) {
  const inner = (
    <CardContent className="pt-4">
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg", bg, color)}>{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="h-6 w-16 mt-1" />
          ) : (
            <p className="text-xl font-bold">{value ?? "—"}</p>
          )}
        </div>
      </div>
    </CardContent>
  );

  if (href) {
    return (
      <Link href={href}>
        <Card className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all">
          {inner}
        </Card>
      </Link>
    );
  }

  return <Card>{inner}</Card>;
}
