import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useListContracts } from "@workspace/api-client-react";
import { formatCurrency, formatDate, statusColor, statusLabel, daysUntil } from "@/lib/utils";
import { Plus, Search, FileText, AlertTriangle } from "lucide-react";

const STATUSES = [
  "all",
  "draft",
  "ai_screening",
  "returned_for_edits",
  "in_legal_review",
  "approved_pending_signature",
  "awaiting_executed_upload",
  "fully_executed",
  "expired",
];

export default function Contracts() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [direction, setDirection] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListContracts(
    {
      page,
      limit: 25,
      ...(search ? { search } : {}),
      ...(status && status !== "all" ? { status } : {}),
      ...(direction && direction !== "all" ? { direction } : {}),
    },
    { query: { queryKey: ["/api/contracts", { search, status, direction, page }] } }
  );

  const contracts = data?.contracts ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contracts</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} total contracts</p>
        </div>
        <Button asChild>
          <Link href="/contracts/new">
            <Plus className="w-4 h-4 mr-2" />
            New Contract
          </Link>
        </Button>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by title, counterparty..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s === "all" ? "All Statuses" : statusLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={direction} onValueChange={(v) => { setDirection(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Directions</SelectItem>
            <SelectItem value="buy">Buy (Inbound)</SelectItem>
            <SelectItem value="sell">Sell (Outbound)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contract</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Effective</TableHead>
              <TableHead>Expiration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : contracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-48">
                  <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <FileText className="w-10 h-10 opacity-30" />
                    <p className="font-medium">No contracts found</p>
                    <p className="text-sm">Try adjusting your filters or create a new contract.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              contracts.map((c) => {
                const days = daysUntil(c.expirationDate);
                const expiring = days !== null && days >= 0 && days <= 30;
                return (
                  <TableRow key={c.id} className="hover:bg-muted/40 cursor-pointer">
                    <TableCell>
                      <Link href={`/contracts/${c.id}`}>
                        <div className="font-medium text-foreground hover:text-primary transition-colors">
                          {c.contractName}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{c.counterpartyName}</div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.contractTypeName ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{c.direction === "buy" ? "Buy" : "Sell"}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(c.status)}`}>
                        {statusLabel(c.status)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{formatCurrency(c.contractValue)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(c.effectiveDate)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-muted-foreground">{formatDate(c.expirationDate)}</span>
                        {expiring && (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
