import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListUsers,
  useListContractTypes,
  useListWorkflows,
  useListScreeningCriteria,
  useListValueTiers,
  useUpdateUserRoles,
  useCreateContractType,
  useUpdateContractType,
  useDeleteContractType,
  useUpdateScreeningCriterion,
  useCreateValueTier,
  useDeleteValueTier,
  useGetMe,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Users, FileText, GitBranch, Brain, DollarSign, Plus, Trash2, X } from "lucide-react";
import { useLocation } from "wouter";

const ALL_ROLES = ["submitter", "legal_reviewer", "designated_signer", "admin"];

export default function Admin() {
  const [, setLocation] = useLocation();
  const { data: me } = useGetMe();
  const { toast } = useToast();
  const qc = useQueryClient();

  if (me && !me.roles?.includes("admin")) {
    setLocation("/dashboard");
    return null;
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground mt-1">Manage users, workflows, contract types, and AI screening settings.</p>
      </div>
      <Tabs defaultValue="users">
        <TabsList className="mb-6">
          <TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" /> Users</TabsTrigger>
          <TabsTrigger value="types" className="gap-2"><FileText className="w-4 h-4" /> Contract Types</TabsTrigger>
          <TabsTrigger value="workflows" className="gap-2"><GitBranch className="w-4 h-4" /> Workflows</TabsTrigger>
          <TabsTrigger value="screening" className="gap-2"><Brain className="w-4 h-4" /> AI Screening</TabsTrigger>
          <TabsTrigger value="tiers" className="gap-2"><DollarSign className="w-4 h-4" /> Value Tiers</TabsTrigger>
        </TabsList>

        <TabsContent value="users"><UsersPanel toast={toast} qc={qc} /></TabsContent>
        <TabsContent value="types"><ContractTypesPanel toast={toast} qc={qc} /></TabsContent>
        <TabsContent value="workflows"><WorkflowsPanel /></TabsContent>
        <TabsContent value="screening"><ScreeningPanel toast={toast} qc={qc} /></TabsContent>
        <TabsContent value="tiers"><ValueTiersPanel toast={toast} qc={qc} /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}

type ToastFn = ReturnType<typeof useToast>["toast"];
type QC = ReturnType<typeof useQueryClient>;

function UsersPanel({ toast, qc }: { toast: ToastFn; qc: QC }) {
  const { data: users, isLoading } = useListUsers();
  const updateRoles = useUpdateUserRoles();

  function toggleRole(userId: number, roles: string[], role: string) {
    const newRoles = roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role];
    updateRoles.mutate(
      { id: userId, data: { roles: newRoles } },
      {
        onSuccess: () => { toast({ title: "Roles updated" }); qc.invalidateQueries({ queryKey: ["/api/users"] }); },
        onError: () => toast({ title: "Failed to update roles", variant: "destructive" }),
      }
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Users</CardTitle><CardDescription>Manage user roles and access.</CardDescription></CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : !users?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">No users found.</p>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                    {user.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_ROLES.map((role) => (
                    <button
                      key={role}
                      onClick={() => toggleRole(user.id, user.roles ?? [], role)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                        user.roles?.includes(role)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-transparent text-muted-foreground border-muted-foreground/30 hover:border-primary/50"
                      }`}
                    >
                      {role.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContractTypesPanel({ toast, qc }: { toast: ToastFn; qc: QC }) {
  const { data: types, isLoading } = useListContractTypes();
  const createType = useCreateContractType();
  const updateType = useUpdateContractType();
  const deleteType = useDeleteContractType();
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  function handleCreate() {
    if (!newName) return;
    createType.mutate(
      { data: { name: newName, description: newDesc || null, isActive: true, formSchema: {} } },
      {
        onSuccess: () => {
          toast({ title: "Contract type created" });
          setNewName(""); setNewDesc(""); setShowCreate(false);
          qc.invalidateQueries({ queryKey: ["/api/contract-types"] });
        },
        onError: () => toast({ title: "Failed", variant: "destructive" }),
      }
    );
  }

  function handleToggle(id: number, isActive: boolean) {
    updateType.mutate({ id, data: { isActive: !isActive } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/contract-types"] }),
    });
  }

  function handleDelete(id: number) {
    if (!confirm("Delete this contract type?")) return;
    deleteType.mutate({ id }, {
      onSuccess: () => { toast({ title: "Deleted" }); qc.invalidateQueries({ queryKey: ["/api/contract-types"] }); },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div><CardTitle>Contract Types</CardTitle><CardDescription>Manage available contract categories.</CardDescription></div>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1.5" />Add Type</Button>
        </div>
      </CardHeader>
      <CardContent>
        {showCreate && (
          <div className="mb-4 p-4 border rounded-lg space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input className="mt-1" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Contract type name" />
              </div>
              <div>
                <Label>Description</Label>
                <Input className="mt-1" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Short description" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={createType.isPending}>Create</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}><X className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
        {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
          <div className="space-y-2">
            {types?.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">{t.name}</p>
                  {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch checked={t.isActive} onCheckedChange={() => handleToggle(t.id, t.isActive)} />
                    <span className="text-xs text-muted-foreground">{t.isActive ? "Active" : "Inactive"}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WorkflowsPanel() {
  const { data: workflows, isLoading } = useListWorkflows();

  return (
    <Card>
      <CardHeader><CardTitle>Workflow Definitions</CardTitle><CardDescription>Review configured approval workflows and their stages.</CardDescription></CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
          <div className="space-y-4">
            {workflows?.map((wf) => (
              <div key={wf.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium">{wf.name}</p>
                    <div className="flex gap-2 mt-1">
                      {wf.isDefault && <Badge variant="secondary">Default</Badge>}
                      {wf.direction && <Badge variant="outline" className="capitalize">{wf.direction}</Badge>}
                      {wf.department && <Badge variant="outline">{wf.department}</Badge>}
                    </div>
                  </div>
                </div>
                {wf.stages && (
                  <div className="space-y-1.5">
                    {wf.stages.map((stage, i) => (
                      <div key={stage.id} className="flex items-center gap-3 text-sm py-1.5 border-l-2 border-muted pl-3">
                        <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">{i + 1}</span>
                        <span className="font-medium">{stage.name}</span>
                        {stage.assignedRole && <span className="text-muted-foreground">→ {stage.assignedRole.replace(/_/g, " ")}</span>}
                        {stage.isOptional && <Badge variant="outline" className="text-xs ml-auto">Optional</Badge>}
                        {stage.isSigned && <Badge variant="outline" className="text-xs">Requires Signature</Badge>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!workflows?.length && <p className="text-sm text-muted-foreground text-center py-8">No workflows configured.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScreeningPanel({ toast, qc }: { toast: ToastFn; qc: QC }) {
  const { data: criteria, isLoading } = useListScreeningCriteria();
  const updateCriterion = useUpdateScreeningCriterion();

  function handleToggle(c: typeof criteria extends (infer T)[] | undefined ? T : never) {
    if (!c) return;
    updateCriterion.mutate({ id: c.id, data: { isEnabled: !c.isEnabled, name: c.name, description: c.description } }, {
      onSuccess: () => { toast({ title: "Updated" }); qc.invalidateQueries({ queryKey: ["/api/admin/screening-criteria"] }); },
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle>AI Screening Criteria</CardTitle><CardDescription>Configure which criteria are checked during AI pre-screening.</CardDescription></CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
          <div className="space-y-2">
            {criteria?.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">{c.name}</p>
                  {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={c.isEnabled} onCheckedChange={() => handleToggle(c)} />
                  <span className="text-xs text-muted-foreground w-14">{c.isEnabled ? "Enabled" : "Disabled"}</span>
                </div>
              </div>
            ))}
            {!criteria?.length && <p className="text-sm text-muted-foreground text-center py-8">No screening criteria configured.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ValueTiersPanel({ toast, qc }: { toast: ToastFn; qc: QC }) {
  const { data: tiers, isLoading } = useListValueTiers();
  const createTier = useCreateValueTier();
  const deleteTier = useDeleteValueTier();
  const [showCreate, setShowCreate] = useState(false);
  const [newTier, setNewTier] = useState({ name: "", minValue: "", maxValue: "" });

  function handleCreate() {
    if (!newTier.name || !newTier.minValue) return;
    createTier.mutate(
      { data: { name: newTier.name, minValue: parseFloat(newTier.minValue), maxValue: newTier.maxValue ? parseFloat(newTier.maxValue) : null, displayOrder: (tiers?.length ?? 0) + 1 } },
      {
        onSuccess: () => {
          toast({ title: "Value tier created" });
          setNewTier({ name: "", minValue: "", maxValue: "" });
          setShowCreate(false);
          qc.invalidateQueries({ queryKey: ["/api/admin/value-tiers"] });
        },
        onError: () => toast({ title: "Failed", variant: "destructive" }),
      }
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div><CardTitle>Value Tiers</CardTitle><CardDescription>Define contract value thresholds for routing and reporting.</CardDescription></div>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1.5" />Add Tier</Button>
        </div>
      </CardHeader>
      <CardContent>
        {showCreate && (
          <div className="mb-4 p-4 border rounded-lg">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div><Label>Name</Label><Input className="mt-1" value={newTier.name} onChange={(e) => setNewTier((t) => ({ ...t, name: e.target.value }))} placeholder="Tier name" /></div>
              <div><Label>Min Value ($)</Label><Input className="mt-1" type="number" value={newTier.minValue} onChange={(e) => setNewTier((t) => ({ ...t, minValue: e.target.value }))} /></div>
              <div><Label>Max Value ($)</Label><Input className="mt-1" type="number" value={newTier.maxValue} onChange={(e) => setNewTier((t) => ({ ...t, maxValue: e.target.value }))} placeholder="No limit" /></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={createTier.isPending}>Create</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}><X className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
        {isLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : (
          <div className="space-y-2">
            {tiers?.sort((a, b) => a.displayOrder - b.displayOrder).map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    ${t.minValue.toLocaleString()} – {t.maxValue != null ? `$${t.maxValue.toLocaleString()}` : "unlimited"}
                  </p>
                </div>
                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => {
                  if (confirm("Delete this tier?")) {
                    deleteTier.mutate({ id: t.id }, {
                      onSuccess: () => { toast({ title: "Deleted" }); qc.invalidateQueries({ queryKey: ["/api/admin/value-tiers"] }); },
                      onError: () => toast({ title: "Failed", variant: "destructive" }),
                    });
                  }
                }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {!tiers?.length && <p className="text-sm text-muted-foreground text-center py-8">No value tiers configured.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
