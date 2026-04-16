import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetContract,
  useGetContractAudit,
  useGetContractScreening,
  useListObligations,
  useSubmitContract,
  useResubmitContract,
  useApproveContract,
  useSendBackContract,
  useRescreenContract,
  useAddComment,
  useCreateObligation,
  useCompleteObligation,
  useGetMe,
} from "@workspace/api-client-react";
import { formatCurrency, formatDate, formatDatetime, statusColor, statusLabel, daysUntil } from "@/lib/utils";
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  CheckCircle,
  XCircle,
  RotateCcw,
  Send,
  AlertTriangle,
  ExternalLink,
  Plus,
  MessageSquare,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function ContractDetail() {
  const [, params] = useRoute("/contracts/:id");
  const id = params?.id ? parseInt(params.id) : 0;
  const { data: me } = useGetMe();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [sendBackNote, setSendBackNote] = useState("");
  const [showSendBack, setShowSendBack] = useState(false);
  const [newObligation, setNewObligation] = useState({ obligationType: "", description: "", dueDate: "" });
  const [showObligationForm, setShowObligationForm] = useState(false);

  const { data: contract, isLoading } = useGetContract(id, { query: { enabled: !!id } });
  const { data: audit } = useGetContractAudit(id, { query: { enabled: !!id } });
  const { data: screening } = useGetContractScreening(id, { query: { enabled: !!id } });
  const { data: obligations } = useListObligations(id, { query: { enabled: !!id } });

  const submit = useSubmitContract();
  const resubmit = useResubmitContract();
  const approve = useApproveContract();
  const sendBack = useSendBackContract();
  const rescreen = useRescreenContract();
  const addComment = useAddComment();
  const createObligation = useCreateObligation();
  const completeObligation = useCompleteObligation();

  function invalidate() {
    qc.invalidateQueries({ queryKey: [`/api/contracts/${id}`] });
    qc.invalidateQueries({ queryKey: [`/api/contracts/${id}/audit`] });
  }

  function handleAction(action: "submit" | "resubmit" | "approve" | "rescreen") {
    const fn = action === "submit" ? submit
      : action === "resubmit" ? resubmit
      : action === "approve" ? approve
      : rescreen;
    (fn as any).mutate({ id }, {
      onSuccess: () => { toast({ title: "Action completed" }); invalidate(); },
      onError: (e: any) => toast({ title: e?.message ?? "Action failed", variant: "destructive" }),
    });
  }

  function handleSendBack() {
    (sendBack as any).mutate({ id, data: { note: sendBackNote } }, {
      onSuccess: () => {
        toast({ title: "Sent back for edits" }); invalidate();
        setShowSendBack(false); setSendBackNote("");
      },
      onError: (e: any) => toast({ title: e?.message ?? "Failed", variant: "destructive" }),
    });
  }

  function handleComment() {
    if (!comment.trim()) return;
    (addComment as any).mutate({ id, data: { comment } }, {
      onSuccess: () => {
        toast({ title: "Comment added" });
        setComment("");
        qc.invalidateQueries({ queryKey: [`/api/contracts/${id}/audit`] });
      },
      onError: () => toast({ title: "Failed to add comment", variant: "destructive" }),
    });
  }

  function handleCreateObligation() {
    if (!newObligation.description || !newObligation.obligationType || !newObligation.dueDate) return;
    (createObligation as any).mutate({
      id,
      data: {
        obligationType: newObligation.obligationType,
        description: newObligation.description,
        dueDate: newObligation.dueDate,
        status: "pending",
      },
    }, {
      onSuccess: () => {
        toast({ title: "Obligation created" });
        setNewObligation({ obligationType: "", description: "", dueDate: "" });
        setShowObligationForm(false);
        qc.invalidateQueries({ queryKey: [`/api/contracts/${id}/obligations`] });
      },
    });
  }

  function handleCompleteObligation(obligationId: number) {
    (completeObligation as any).mutate({ id: obligationId }, {
      onSuccess: () => {
        toast({ title: "Obligation marked complete" });
        qc.invalidateQueries({ queryKey: [`/api/contracts/${id}/obligations`] });
      },
    });
  }

  const isSubmitter = me?.roles?.includes("submitter") || me?.roles?.includes("admin");
  const isLegalReviewer = me?.roles?.includes("legal_reviewer") || me?.roles?.includes("admin");
  const isSigner = me?.roles?.includes("designated_signer") || me?.roles?.includes("admin");
  const isAdmin = me?.roles?.includes("admin");

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!contract) {
    return (
      <AppLayout>
        <div className="text-center py-24 text-muted-foreground">Contract not found.</div>
      </AppLayout>
    );
  }

  const days = daysUntil(contract.expirationDate);
  const expiring = days !== null && days >= 0 && days <= 30;

  return (
    <AppLayout>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link href="/contracts">
          <span className="hover:text-foreground cursor-pointer flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Contracts
          </span>
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-foreground font-medium truncate">{contract.contractName}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{contract.contractName}</h1>
            <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", statusColor(contract.status))}>
              {statusLabel(contract.status)}
            </span>
          </div>
          <p className="text-muted-foreground mt-1">
            {contract.counterpartyName} · {contract.contractTypeName} · <span className="capitalize">{contract.direction === "buy" ? "Buy" : "Sell"}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {contract.status === "draft" && isSubmitter && (
            <Button size="sm" onClick={() => handleAction("submit")} disabled={submit.isPending}>
              <Send className="w-4 h-4 mr-1.5" /> Submit for AI Screening
            </Button>
          )}
          {contract.status === "returned_for_edits" && isSubmitter && (
            <Button size="sm" onClick={() => handleAction("resubmit")} disabled={resubmit.isPending}>
              <Send className="w-4 h-4 mr-1.5" /> Resubmit
            </Button>
          )}
          {contract.status === "in_legal_review" && isLegalReviewer && (
            <>
              <Button size="sm" variant="outline" onClick={() => setShowSendBack(true)}>
                <XCircle className="w-4 h-4 mr-1.5" /> Send Back
              </Button>
              <Button size="sm" onClick={() => handleAction("approve")} disabled={approve.isPending}>
                <CheckCircle className="w-4 h-4 mr-1.5" /> Approve
              </Button>
            </>
          )}
          {contract.status === "approved_pending_signature" && isSigner && (
            <Button size="sm" onClick={() => handleAction("approve")} disabled={approve.isPending}>
              <CheckCircle className="w-4 h-4 mr-1.5" /> Mark as Signed
            </Button>
          )}
          {isAdmin && (contract.status === "ai_screening" || contract.status === "returned_for_edits") && (
            <Button size="sm" variant="ghost" onClick={() => handleAction("rescreen")} disabled={rescreen.isPending}>
              <RotateCcw className="w-4 h-4 mr-1.5" /> Re-Screen
            </Button>
          )}
        </div>
      </div>

      {showSendBack && (
        <Card className="mb-4 border-destructive/30 bg-destructive/5">
          <CardContent className="pt-4 space-y-3">
            <Label>Reason for sending back</Label>
            <Textarea
              placeholder="Explain what needs to be corrected..."
              value={sendBackNote}
              onChange={(e) => setSendBackNote(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={handleSendBack} disabled={sendBack.isPending}>
                Send Back
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowSendBack(false); setSendBackNote(""); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground mb-1">Contract Value</div>
            <div className="text-xl font-semibold">{formatCurrency(contract.contractValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground mb-1">Effective Date</div>
            <div className="text-sm font-medium">{formatDate(contract.effectiveDate)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              Expiration Date
              {expiring && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
            </div>
            <div className={cn("text-sm font-medium", expiring && "text-amber-600")}>
              {formatDate(contract.expirationDate)}
              {expiring && <span className="text-xs ml-1.5">({days}d left)</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="details">
        <TabsList className="mb-4">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="screening">AI Screening</TabsTrigger>
          <TabsTrigger value="obligations">Obligations</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Contract Details</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Type" value={contract.contractTypeName} />
                <Row label="Direction" value={<Badge variant="outline">{contract.direction === "buy" ? "Buy (inbound)" : "Sell (outbound)"}</Badge>} />
                <Row label="Department" value={contract.department} />
                <Row label="Auto-Renewal" value={contract.autoRenewal ? "Yes" : "No"} />
                {contract.noticePeriodDays && <Row label="Notice Period" value={`${contract.noticePeriodDays} days`} />}
                {contract.driveFileId && (
                  <Row label="Google Drive" value={
                    <a href={`https://drive.google.com/file/d/${contract.driveFileId}`} target="_blank" rel="noopener noreferrer" className="text-primary flex items-center gap-1 hover:underline">
                      Open <ExternalLink className="w-3 h-3" />
                    </a>
                  } />
                )}
                {contract.aiRiskScore && (
                  <Row label="AI Risk Score" value={
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-medium",
                      contract.aiRiskScore === "low" ? "bg-green-100 text-green-700"
                        : contract.aiRiskScore === "medium" ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    )}>
                      {contract.aiRiskScore.toUpperCase()}
                    </span>
                  } />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Counterparty</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Row label="Name" value={contract.counterpartyName} />
                <Row label="Address" value={contract.counterpartyAddress} />
                <Row label="Submitted By" value={contract.submittedByName} />
                <Row label="Created" value={formatDate(contract.createdAt)} />
              </CardContent>
            </Card>
            {contract.description && (
              <Card className="col-span-2">
                <CardHeader><CardTitle className="text-sm font-medium">Description</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contract.description}</p>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="mt-4">
            <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Comments</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                {audit?.filter((a) => a.action === "comment").length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No comments yet.</p>
                )}
                {audit?.filter((a) => a.action === "comment").map((a) => (
                  <div key={a.id} className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{a.userName}</span>
                      <span className="text-xs text-muted-foreground">{formatDatetime(a.createdAt)}</span>
                    </div>
                    <p className="text-sm">{a.comment}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Textarea
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  className="flex-1"
                />
                <Button size="sm" onClick={handleComment} disabled={addComment.isPending || !comment.trim()}>
                  Post
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="screening">
          {!screening ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No screening results yet</p>
              <p className="text-sm mt-1">Submit the contract to trigger AI pre-screening.</p>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>AI Screening Results</CardTitle>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-sm font-medium",
                    screening.riskScore === "low" ? "bg-green-100 text-green-700"
                      : screening.riskScore === "medium" ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                  )}>
                    {screening.riskScore?.toUpperCase()} RISK
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{formatDatetime(screening.createdAt)}</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {screening.criteriaResults?.map((c, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 border rounded-lg">
                      {c.passed ? (
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{c.criterionName}</p>
                        {c.explanation && <p className="text-xs text-muted-foreground mt-0.5">{c.explanation}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="obligations">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Obligations & Milestones</h3>
            <Button size="sm" onClick={() => setShowObligationForm(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Obligation
            </Button>
          </div>
          {showObligationForm && (
            <Card className="mb-4">
              <CardContent className="pt-4 grid grid-cols-3 gap-3">
                <div>
                  <Label>Type</Label>
                  <Input className="mt-1" value={newObligation.obligationType} onChange={(e) => setNewObligation((o) => ({ ...o, obligationType: e.target.value }))} placeholder="e.g. payment_milestone" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input className="mt-1" value={newObligation.description} onChange={(e) => setNewObligation((o) => ({ ...o, description: e.target.value }))} placeholder="Obligation description" />
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input className="mt-1" type="date" value={newObligation.dueDate} onChange={(e) => setNewObligation((o) => ({ ...o, dueDate: e.target.value }))} />
                </div>
                <div className="col-span-3 flex gap-2">
                  <Button size="sm" onClick={handleCreateObligation} disabled={createObligation.isPending}>Add</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowObligationForm(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="space-y-2">
            {!obligations?.length ? (
              <div className="text-center py-12 text-muted-foreground">No obligations added yet.</div>
            ) : obligations.map((ob) => {
              const obDays = daysUntil(ob.dueDate);
              const obExpiring = obDays !== null && obDays >= 0 && obDays <= 14;
              const completed = ob.status === "completed";
              return (
                <div key={ob.id} className={cn("flex items-center justify-between p-3 border rounded-lg", completed && "opacity-60")}>
                  <div className="flex items-center gap-3">
                    {completed ? (
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    ) : obExpiring ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                    )}
                    <div>
                      <p className={cn("text-sm font-medium", completed && "line-through")}>{ob.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {ob.obligationType && <span className="mr-2 capitalize">{ob.obligationType.replace(/_/g, " ")}</span>}
                        {ob.dueDate && <span>Due {formatDate(ob.dueDate)}{obDays !== null && !completed && ` (${obDays}d)`}</span>}
                      </p>
                    </div>
                  </div>
                  {!completed && (
                    <Button size="sm" variant="outline" onClick={() => handleCompleteObligation(ob.id)}>
                      Complete
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <div className="space-y-2">
            {!audit?.length ? (
              <div className="text-center py-12 text-muted-foreground">No audit entries yet.</div>
            ) : audit.map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3 border rounded-lg">
                <div className="w-2 h-2 rounded-full bg-primary/40 mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground capitalize">
                      {a.action?.replace(/_/g, " ")}
                      {a.fromStatus && a.toStatus && ` — ${statusLabel(a.fromStatus)} → ${statusLabel(a.toStatus)}`}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDatetime(a.createdAt)}</span>
                  </div>
                  <p className="text-sm mt-0.5">
                    <span className="font-medium">{a.userName ?? "System"}</span>
                    {a.comment && <span className="text-muted-foreground"> — {a.comment}</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function Row({ label, value }: { label: string; value?: React.ReactNode | null }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value ?? "—"}</span>
    </div>
  );
}
