import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListUsers, useListContractTypes, useListWorkflows, useListScreeningCriteria,
  useListValueTiers, useUpdateUserRoles, useCreateContractType, useUpdateContractType,
  useDeleteContractType, useUpdateScreeningCriterion, useCreateScreeningCriterion,
  useCreateValueTier, useDeleteValueTier, useGetMe, useCreateWorkflow, useUpdateWorkflow,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  Users, FileText, GitBranch, Brain, DollarSign, Plus, Trash2, X,
  ChevronUp, ChevronDown, Settings2, Eye, ArrowLeft, GripVertical,
  Type, AlignLeft, Hash, Calendar, List, ToggleLeft, PenLine,
  CheckCircle2, RotateCcw, UserCheck, GitBranch as StageIcon,
} from "lucide-react";
import { useLocation } from "wouter";

const ALL_ROLES = ["submitter", "legal_reviewer", "designated_signer", "admin"];
const STAGE_ROLES = [
  { value: "submitter", label: "Submitter" },
  { value: "legal_reviewer", label: "Legal Reviewer" },
  { value: "designated_signer", label: "Designated Signer" },
  { value: "admin", label: "Admin" },
];
const DIRECTIONS = [
  { value: "", label: "Any direction" },
  { value: "buy", label: "Buy (we receive services)" },
  { value: "sell", label: "Sell (we provide services)" },
];

type ToastFn = ReturnType<typeof useToast>["toast"];
type QC = ReturnType<typeof useQueryClient>;

// ─── Form field builder types ─────────────────────────────────────────────────
type FieldType = "text" | "textarea" | "number" | "date" | "select" | "checkbox";
interface FormField { name: string; type: FieldType; label: string; required: boolean; placeholder?: string; options?: string[] }
interface FormSchema { fields: FormField[] }
const FIELD_TYPES: { value: FieldType; label: string; icon: React.ReactNode }[] = [
  { value: "text",     label: "Short text",  icon: <Type className="w-3.5 h-3.5" /> },
  { value: "textarea", label: "Long text",   icon: <AlignLeft className="w-3.5 h-3.5" /> },
  { value: "number",   label: "Number",      icon: <Hash className="w-3.5 h-3.5" /> },
  { value: "date",     label: "Date",        icon: <Calendar className="w-3.5 h-3.5" /> },
  { value: "select",   label: "Dropdown",    icon: <List className="w-3.5 h-3.5" /> },
  { value: "checkbox", label: "Checkbox",    icon: <ToggleLeft className="w-3.5 h-3.5" /> },
];
function makeSlug(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "field";
}

// ─── Workflow stage type ──────────────────────────────────────────────────────
interface StageEditor {
  id?: number;
  name: string;
  stageOrder: number;
  assignedRole: string | null;
  canSendBack: boolean;
  isOptional: boolean;
  isSigned: boolean;
}

function makeEmptyStage(order: number): StageEditor {
  return { name: "New Stage", stageOrder: order, assignedRole: "legal_reviewer", canSendBack: true, isOptional: false, isSigned: false };
}

// ─── Workflow Editor ──────────────────────────────────────────────────────────
function WorkflowEditor({
  workflow,
  onClose,
  onSaved,
}: {
  workflow: { id?: number; name?: string; direction?: string | null; department?: string | null; isDefault?: boolean; stages?: StageEditor[] } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const createWorkflow = useCreateWorkflow();
  const updateWorkflow = useUpdateWorkflow();
  const isNew = !workflow?.id;

  const [name, setName] = useState(workflow?.name ?? "");
  const [direction, setDirection] = useState(workflow?.direction ?? "");
  const [department, setDepartment] = useState(workflow?.department ?? "");
  const [isDefault, setIsDefault] = useState(workflow?.isDefault ?? false);
  const [stages, setStages] = useState<StageEditor[]>(workflow?.stages?.map((s) => ({ ...s })) ?? []);
  const [activeStage, setActiveStage] = useState<number | null>(null);

  function addStage() {
    const next = makeEmptyStage(stages.length + 1);
    setStages((s) => [...s, next]);
    setActiveStage(stages.length);
  }

  function removeStage(idx: number) {
    setStages((s) => s.filter((_, i) => i !== idx).map((st, i) => ({ ...st, stageOrder: i + 1 })));
    setActiveStage(null);
  }

  function moveStage(idx: number, dir: -1 | 1) {
    setStages((s) => {
      const arr = [...s];
      const to = idx + dir;
      if (to < 0 || to >= arr.length) return arr;
      [arr[idx], arr[to]] = [arr[to], arr[idx]];
      return arr.map((st, i) => ({ ...st, stageOrder: i + 1 }));
    });
    setActiveStage(idx + dir);
  }

  function updateStage(idx: number, patch: Partial<StageEditor>) {
    setStages((s) => s.map((st, i) => i === idx ? { ...st, ...patch } : st));
  }

  async function handleSave() {
    if (!name.trim()) { toast({ title: "Workflow name is required", variant: "destructive" }); return; }
    if (stages.length === 0) { toast({ title: "Add at least one stage", variant: "destructive" }); return; }

    const body = {
      name: name.trim(),
      direction: direction || null,
      department: department.trim() || null,
      isDefault,
      stages: stages.map((s, i) => ({
        name: s.name,
        stageOrder: i + 1,
        assignedRole: s.assignedRole || null,
        assignedUserId: null,
        canSendBack: s.canSendBack,
        isOptional: s.isOptional,
        isSigned: s.isSigned,
      })),
    };

    const onSuccess = () => {
      toast({ title: isNew ? "Workflow created" : "Workflow saved" });
      qc.invalidateQueries({ queryKey: ["/api/admin/workflows"] });
      onSaved();
    };
    const onError = () => toast({ title: "Failed to save workflow", variant: "destructive" });

    if (isNew) {
      createWorkflow.mutate({ data: body }, { onSuccess, onError });
    } else {
      updateWorkflow.mutate({ id: workflow!.id!, data: body }, { onSuccess, onError });
    }
  }

  const isSaving = createWorkflow.isPending || updateWorkflow.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div>
          <h3 className="font-semibold">{isNew ? "New Workflow" : name || "Workflow"}</h3>
          <p className="text-xs text-muted-foreground">{stages.length} stage{stages.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="ml-auto">
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1.5">
            {isSaving ? "Saving…" : isNew ? "Create Workflow" : "Save Changes"}
          </Button>
        </div>
      </div>

      <Separator />

      {/* Definition */}
      <div className="border rounded-lg p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Workflow Definition</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Workflow Name <span className="text-destructive">*</span></Label>
            <Input className="mt-1 h-8 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard Legal Review" />
          </div>
          <div>
            <Label className="text-xs">Department <span className="text-muted-foreground">(optional)</span></Label>
            <Input className="mt-1 h-8 text-sm" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Engineering, Finance" />
          </div>
          <div>
            <Label className="text-xs">Direction filter</Label>
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIRECTIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between pt-5">
            <div>
              <Label className="text-xs">Default workflow</Label>
              <p className="text-[10px] text-muted-foreground">Used when no other workflow matches</p>
            </div>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>
        </div>
      </div>

      {/* Stages */}
      <div className="grid grid-cols-5 gap-4">
        {/* Stage list */}
        <div className="col-span-2 space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-0.5 mb-2">Approval Stages</p>
          {stages.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
              No stages yet.<br />Click "Add Stage" below.
            </div>
          )}
          {stages.map((stage, idx) => (
            <div
              key={idx}
              onClick={() => setActiveStage(idx)}
              className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                activeStage === idx
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
              }`}
            >
              <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
              <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0 text-muted-foreground">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{stage.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {stage.assignedRole?.replace(/_/g, " ") ?? "No role"}
                  {stage.isSigned && " · signature"}
                  {stage.isOptional && " · optional"}
                </p>
              </div>
              <div className="flex flex-col gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => moveStage(idx, -1)} disabled={idx === 0} className="disabled:opacity-20 hover:text-foreground text-muted-foreground">
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button onClick={() => moveStage(idx, 1)} disabled={idx === stages.length - 1} className="disabled:opacity-20 hover:text-foreground text-muted-foreground">
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addStage} className="w-full gap-1.5 mt-2">
            <Plus className="w-4 h-4" /> Add Stage
          </Button>
        </div>

        {/* Stage editor */}
        <div className="col-span-3">
          {activeStage === null || !stages[activeStage] ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[220px] text-center text-sm text-muted-foreground border-2 border-dashed rounded-lg p-6">
              <StageIcon className="w-8 h-8 mb-2 opacity-30" />
              Select a stage to configure it
            </div>
          ) : (() => {
            const stage = stages[activeStage];
            const idx = activeStage;
            return (
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Stage {idx + 1} Properties</p>
                  <Button variant="ghost" size="sm" onClick={() => removeStage(idx)} className="text-destructive hover:text-destructive gap-1.5 h-7 px-2">
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </Button>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Stage Name <span className="text-destructive">*</span></Label>
                    <Input className="mt-1 h-8 text-sm" value={stage.name}
                      onChange={(e) => updateStage(idx, { name: e.target.value })}
                      placeholder="e.g. Legal Review" />
                  </div>

                  <div>
                    <Label className="text-xs">Assigned Role</Label>
                    <Select value={stage.assignedRole ?? ""} onValueChange={(v) => updateStage(idx, { assignedRole: v || null })}>
                      <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="No specific role" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No specific role</SelectItem>
                        {STAGE_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground mt-0.5">This role will be notified and can action this stage</p>
                  </div>

                  <Separator />

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-medium">Requires signature</p>
                          <p className="text-[10px] text-muted-foreground">Contract must be signed at this stage</p>
                        </div>
                      </div>
                      <Switch checked={stage.isSigned} onCheckedChange={(v) => updateStage(idx, { isSigned: v })} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-medium">Can send back</p>
                          <p className="text-[10px] text-muted-foreground">Reviewer can return to submitter for edits</p>
                        </div>
                      </div>
                      <Switch checked={stage.canSendBack} onCheckedChange={(v) => updateStage(idx, { canSendBack: v })} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-xs font-medium">Optional stage</p>
                          <p className="text-[10px] text-muted-foreground">Can be skipped if reviewer approves</p>
                        </div>
                      </div>
                      <Switch checked={stage.isOptional} onCheckedChange={(v) => updateStage(idx, { isOptional: v })} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ─── Workflows Panel ─────────────────────────────────────────────────────────
function WorkflowsPanel({ toast, qc }: { toast: ToastFn; qc: QC }) {
  const { data: workflows, isLoading } = useListWorkflows();
  const [editingId, setEditingId] = useState<number | "new" | null>(null);

  const editingWorkflow = editingId === "new"
    ? null
    : workflows?.find((w) => w.id === editingId) ?? null;

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/workflows/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error();
      toast({ title: "Workflow deleted" });
      qc.invalidateQueries({ queryKey: ["/api/admin/workflows"] });
      qc.invalidateQueries({ queryKey: ["/api/contract-types"] });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  }

  if (editingId !== null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workflows</CardTitle>
          <CardDescription>{editingId === "new" ? "Define a new approval chain" : "Edit approval chain and stages"}</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkflowEditor
            workflow={editingId === "new" ? null : (editingWorkflow as any)}
            onClose={() => setEditingId(null)}
            onSaved={() => setEditingId(null)}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Approval Workflows</CardTitle>
            <CardDescription>Define the approval chains for your contracts. Assign them to contract types.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setEditingId("new")} className="gap-1.5">
            <Plus className="w-4 h-4" /> New Workflow
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Loading…</p>
        ) : (
          <div className="space-y-3">
            {workflows?.map((wf) => (
              <div key={wf.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{wf.name}</p>
                      {wf.isDefault && <Badge variant="secondary">Default</Badge>}
                      {wf.direction && <Badge variant="outline" className="capitalize">{wf.direction}</Badge>}
                      {wf.department && <Badge variant="outline">{wf.department}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {wf.stages?.length ?? 0} stage{wf.stages?.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => setEditingId(wf.id)}>
                      <PenLine className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive h-7 w-7 p-0" onClick={() => handleDelete(wf.id, wf.name)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                {wf.stages && wf.stages.length > 0 && (
                  <div className="space-y-1">
                    {wf.stages.map((stage, i) => (
                      <div key={stage.id} className="flex items-center gap-3 text-xs py-1.5 border-l-2 border-muted pl-3">
                        <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0 text-muted-foreground">{i + 1}</span>
                        <span className="font-medium text-sm">{stage.name}</span>
                        {stage.assignedRole && (
                          <span className="text-muted-foreground">→ {stage.assignedRole.replace(/_/g, " ")}</span>
                        )}
                        <div className="ml-auto flex gap-1">
                          {stage.isSigned && <Badge variant="outline" className="text-[10px] h-4 px-1">Signature</Badge>}
                          {stage.isOptional && <Badge variant="outline" className="text-[10px] h-4 px-1">Optional</Badge>}
                          {stage.canSendBack && <Badge variant="outline" className="text-[10px] h-4 px-1">Can send back</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!workflows?.length && (
              <div className="text-center py-10 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                No workflows yet. Create one to define your approval chain.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Form Builder ─────────────────────────────────────────────────────────────
function FormBuilder({
  contractType, onClose, onSave, isSaving,
}: {
  contractType: { id: number; name: string; formSchema?: any };
  onClose: () => void;
  onSave: (fields: FormField[]) => void;
  isSaving: boolean;
}) {
  const rawSchema = contractType.formSchema as FormSchema | null | undefined;
  const [fields, setFields] = useState<FormField[]>(rawSchema?.fields ?? []);
  const [activeField, setActiveField] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);
  const [newOption, setNewOption] = useState<Record<number, string>>({});

  function addField() {
    const next: FormField = { name: `field_${Date.now()}`, type: "text", label: "New Field", required: false };
    setFields((f) => [...f, next]);
    setActiveField(fields.length);
    setPreview(false);
  }

  function removeField(idx: number) {
    setFields((f) => f.filter((_, i) => i !== idx));
    setActiveField(null);
  }

  function moveField(idx: number, dir: -1 | 1) {
    setFields((f) => {
      const arr = [...f];
      const to = idx + dir;
      if (to < 0 || to >= arr.length) return arr;
      [arr[idx], arr[to]] = [arr[to], arr[idx]];
      return arr;
    });
    setActiveField((i) => (i === idx ? idx + dir : i));
  }

  function updateField(idx: number, patch: Partial<FormField>) {
    setFields((f) => f.map((field, i) => i === idx ? { ...field, ...patch } : field));
  }

  function updateLabel(idx: number, label: string) {
    setFields((f) => f.map((field, i) => {
      if (i !== idx) return field;
      const autoSlug = field.name === makeSlug(field.label) || field.name.startsWith("field_");
      return { ...field, label, ...(autoSlug ? { name: makeSlug(label) } : {}) };
    }));
  }

  function addOption(idx: number) {
    const opt = (newOption[idx] ?? "").trim();
    if (!opt) return;
    setFields((f) => f.map((field, i) => i === idx ? { ...field, options: [...(field.options ?? []), opt] } : field));
    setNewOption((p) => ({ ...p, [idx]: "" }));
  }

  function removeOption(fieldIdx: number, optIdx: number) {
    setFields((f) => f.map((field, i) => i === fieldIdx ? { ...field, options: (field.options ?? []).filter((_, oi) => oi !== optIdx) } : field));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div>
          <h3 className="font-semibold">{contractType.name}</h3>
          <p className="text-xs text-muted-foreground">Intake form — {fields.length} field{fields.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreview((p) => !p)} className="gap-1.5">
            <Eye className="w-4 h-4" />{preview ? "Edit" : "Preview"}
          </Button>
          <Button size="sm" onClick={() => onSave(fields)} disabled={isSaving} className="gap-1.5">
            {isSaving ? "Saving…" : "Save & Deploy"}
          </Button>
        </div>
      </div>
      <Separator />

      {preview ? (
        <div className="border rounded-lg p-6 bg-muted/20">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-4">{contractType.name} — Preview</p>
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No fields yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {fields.map((field, i) => (
                <div key={i} className={field.type === "textarea" || field.type === "checkbox" ? "col-span-2" : ""}>
                  {field.type === "checkbox" ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border rounded" />
                      <span className="text-sm">{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</span>
                    </div>
                  ) : (
                    <div>
                      <Label className="text-sm">{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</Label>
                      {field.type === "select" ? (
                        <div className="mt-1.5 h-9 rounded-md border border-input bg-background px-3 flex items-center text-sm text-muted-foreground">
                          {field.options?.[0] ?? "Select…"}
                        </div>
                      ) : field.type === "textarea" ? (
                        <div className="mt-1.5 h-20 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">{field.placeholder ?? ""}</div>
                      ) : (
                        <div className="mt-1.5 h-9 rounded-md border border-input bg-background px-3 flex items-center text-sm text-muted-foreground">
                          {field.placeholder ?? (field.type === "date" ? "YYYY-MM-DD" : "")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-2 space-y-1.5">
            {fields.length === 0 && (
              <div className="text-center py-10 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                No fields yet.<br />Click "Add Field" to start.
              </div>
            )}
            {fields.map((field, idx) => {
              const typeInfo = FIELD_TYPES.find((t) => t.value === field.type);
              return (
                <div key={idx} onClick={() => setActiveField(idx)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    activeField === idx ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
                  }`}
                >
                  <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                  <span className="text-muted-foreground shrink-0">{typeInfo?.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{field.label}</p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">{field.name}</p>
                  </div>
                  {field.required && <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 shrink-0">req</Badge>}
                  <div className="flex flex-col gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => moveField(idx, -1)} disabled={idx === 0} className="disabled:opacity-20 hover:text-foreground text-muted-foreground"><ChevronUp className="w-3 h-3" /></button>
                    <button onClick={() => moveField(idx, 1)} disabled={idx === fields.length - 1} className="disabled:opacity-20 hover:text-foreground text-muted-foreground"><ChevronDown className="w-3 h-3" /></button>
                  </div>
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={addField} className="w-full gap-1.5 mt-2"><Plus className="w-4 h-4" /> Add Field</Button>
          </div>

          <div className="col-span-3">
            {activeField === null || !fields[activeField] ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center text-sm text-muted-foreground border-2 border-dashed rounded-lg p-6">
                <Settings2 className="w-8 h-8 mb-2 opacity-30" />
                Select a field to edit its properties
              </div>
            ) : (() => {
              const field = fields[activeField];
              const idx = activeField;
              return (
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Field Properties</p>
                    <Button variant="ghost" size="sm" onClick={() => removeField(idx)} className="text-destructive hover:text-destructive gap-1.5 h-7 px-2">
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Label <span className="text-destructive">*</span></Label>
                      <Input className="mt-1 h-8 text-sm" value={field.label} onChange={(e) => updateLabel(idx, e.target.value)} placeholder="e.g. Payment Terms" />
                    </div>
                    <div>
                      <Label className="text-xs">Field Key <span className="text-muted-foreground">(auto-generated)</span></Label>
                      <Input className="mt-1 h-8 text-sm font-mono" value={field.name}
                        onChange={(e) => updateField(idx, { name: e.target.value.replace(/\s+/g, "_").toLowerCase() })}
                        placeholder="e.g. payment_terms" />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Used as the data key in contract records</p>
                    </div>
                    <div>
                      <Label className="text-xs">Field Type</Label>
                      <Select value={field.type} onValueChange={(v) => updateField(idx, { type: v as FieldType, options: v === "select" ? (field.options ?? []) : undefined })}>
                        <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              <div className="flex items-center gap-2">{t.icon}<span>{t.label}</span></div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {field.type !== "checkbox" && (
                      <div>
                        <Label className="text-xs">Placeholder</Label>
                        <Input className="mt-1 h-8 text-sm" value={field.placeholder ?? ""}
                          onChange={(e) => updateField(idx, { placeholder: e.target.value || undefined })}
                          placeholder="Optional hint inside the field" />
                      </div>
                    )}
                    <div className="flex items-center justify-between py-1">
                      <div>
                        <Label className="text-xs">Required</Label>
                        <p className="text-[10px] text-muted-foreground">Submitter must fill this in</p>
                      </div>
                      <Switch checked={field.required} onCheckedChange={(v) => updateField(idx, { required: v })} />
                    </div>
                    {field.type === "select" && (
                      <div>
                        <Label className="text-xs">Dropdown Options</Label>
                        <div className="mt-1.5 space-y-1.5 border rounded-md p-2 bg-muted/20">
                          {(field.options ?? []).length === 0 && <p className="text-xs text-muted-foreground text-center py-1">No options yet</p>}
                          {(field.options ?? []).map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-1.5">
                              <div className="flex-1 text-xs bg-background border rounded px-2 py-1">{opt}</div>
                              <button onClick={() => removeOption(idx, oi)} className="text-muted-foreground hover:text-destructive shrink-0"><X className="w-3 h-3" /></button>
                            </div>
                          ))}
                          <div className="flex gap-1.5 pt-1">
                            <Input className="h-7 text-xs flex-1" placeholder="Add option…" value={newOption[idx] ?? ""}
                              onChange={(e) => setNewOption((p) => ({ ...p, [idx]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(idx); } }} />
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => addOption(idx)}><Plus className="w-3 h-3" /></Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Contract Types Panel ─────────────────────────────────────────────────────
function ContractTypesPanel({ toast, qc }: { toast: ToastFn; qc: QC }) {
  const { data: types, isLoading } = useListContractTypes();
  const { data: workflows } = useListWorkflows();
  const createType = useCreateContractType();
  const updateType = useUpdateContractType();
  const deleteType = useDeleteContractType();

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingFormId, setEditingFormId] = useState<number | null>(null);

  const editingType = types?.find((t) => t.id === editingFormId);

  function handleCreate() {
    if (!newName) return;
    createType.mutate(
      { data: { name: newName, description: newDesc || null, isActive: true, formSchema: { fields: [] } } },
      {
        onSuccess: () => {
          toast({ title: "Contract type created" });
          setNewName(""); setNewDesc(""); setShowCreate(false);
          qc.invalidateQueries({ queryKey: ["/api/contract-types"] });
        },
        onError: () => toast({ title: "Failed to create", variant: "destructive" }),
      }
    );
  }

  function handleToggle(id: number, isActive: boolean) {
    updateType.mutate({ id, data: { isActive: !isActive } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/contract-types"] }),
    });
  }

  function handleDelete(id: number) {
    if (!confirm("Delete this contract type? This cannot be undone.")) return;
    deleteType.mutate({ id }, {
      onSuccess: () => { toast({ title: "Deleted" }); qc.invalidateQueries({ queryKey: ["/api/contract-types"] }); },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    });
  }

  function handleSaveForm(fields: FormField[]) {
    if (!editingFormId) return;
    updateType.mutate(
      { id: editingFormId, data: { formSchema: { fields } } },
      {
        onSuccess: () => {
          toast({ title: "Form schema saved and deployed" });
          qc.invalidateQueries({ queryKey: ["/api/contract-types"] });
          setEditingFormId(null);
        },
        onError: () => toast({ title: "Failed to save form", variant: "destructive" }),
      }
    );
  }

  function handleAssignWorkflow(typeId: number, workflowId: string) {
    const val = workflowId === "none" ? null : parseInt(workflowId, 10);
    updateType.mutate(
      { id: typeId, data: { defaultWorkflowId: val } as any },
      {
        onSuccess: () => { toast({ title: "Workflow assigned" }); qc.invalidateQueries({ queryKey: ["/api/contract-types"] }); },
        onError: () => toast({ title: "Failed to assign workflow", variant: "destructive" }),
      }
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Contract Types</CardTitle>
            <CardDescription>
              {editingType ? "Build the intake form for this contract type" : "Manage contract categories, their intake forms, and assigned workflows"}
            </CardDescription>
          </div>
          {!editingType && (
            <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1.5" />Add Type</Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editingType ? (
          <FormBuilder
            contractType={editingType}
            onClose={() => setEditingFormId(null)}
            onSave={handleSaveForm}
            isSaving={updateType.isPending}
          />
        ) : (
          <>
            {showCreate && (
              <div className="mb-4 p-4 border rounded-lg bg-muted/20 space-y-3">
                <p className="text-sm font-medium">New Contract Type</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Name <span className="text-destructive">*</span></Label>
                    <Input className="mt-1" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Partnership Agreement" />
                  </div>
                  <div>
                    <Label className="text-xs">Description</Label>
                    <Input className="mt-1" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Brief description" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreate} disabled={!newName || createType.isPending}>
                    {createType.isPending ? "Creating…" : "Create"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowCreate(false); setNewName(""); setNewDesc(""); }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {isLoading ? <p className="text-sm text-muted-foreground py-4">Loading…</p> : (
              <div className="space-y-2">
                {types?.map((t) => {
                  const schema = t.formSchema as FormSchema | null | undefined;
                  const fieldCount = schema?.fields?.length ?? 0;
                  const assignedWorkflow = workflows?.find((w) => w.id === (t as any).defaultWorkflowId);
                  return (
                    <div key={t.id} className="border rounded-lg p-3 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{t.name}</p>
                            <Badge variant={t.isActive ? "secondary" : "outline"} className="text-[10px]">
                              {t.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {fieldCount === 0
                                ? <span className="text-amber-600">No intake fields</span>
                                : `${fieldCount} intake field${fieldCount !== 1 ? "s" : ""}`}
                            </span>
                            <span className="text-muted-foreground/40 text-xs">·</span>
                            <span className="text-xs text-muted-foreground">
                              {assignedWorkflow
                                ? <span className="text-green-700 dark:text-green-400">Workflow: {assignedWorkflow.name}</span>
                                : <span className="text-amber-600">No workflow assigned</span>}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-3 shrink-0">
                          <Button size="sm" variant="outline" onClick={() => setEditingFormId(t.id)} className="gap-1.5 h-7 text-xs">
                            <Settings2 className="w-3.5 h-3.5" /> Edit Form
                          </Button>
                          <Switch checked={t.isActive} onCheckedChange={() => handleToggle(t.id, t.isActive)} />
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)} className="text-muted-foreground hover:text-destructive h-7 w-7 p-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      {/* Workflow assignment row */}
                      <div className="mt-2.5 pt-2.5 border-t flex items-center gap-2">
                        <GitBranch className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground shrink-0">Approval workflow:</span>
                        <Select
                          value={String((t as any).defaultWorkflowId ?? "none")}
                          onValueChange={(v) => handleAssignWorkflow(t.id, v)}
                        >
                          <SelectTrigger className="h-6 text-xs flex-1 max-w-[260px]">
                            <SelectValue placeholder="Select a workflow…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— None (use routing rules) —</SelectItem>
                            {workflows?.map((w) => (
                              <SelectItem key={w.id} value={String(w.id)}>
                                {w.name}
                                {w.isDefault && " (default)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
                {!types?.length && (
                  <p className="text-sm text-muted-foreground text-center py-8">No contract types yet.</p>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Users Panel ─────────────────────────────────────────────────────────────
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
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : !users?.length ? (
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
                    <button key={role} onClick={() => toggleRole(user.id, user.roles ?? [], role)}
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

// ─── Screening Panel ─────────────────────────────────────────────────────────
interface CriterionForm { name: string; description: string; isEnabled: boolean }
const EMPTY_CRITERION: CriterionForm = { name: "", description: "", isEnabled: true };

function ScreeningPanel({ toast, qc }: { toast: ToastFn; qc: QC }) {
  const { data: criteria, isLoading } = useListScreeningCriteria();
  const createCriterion = useCreateScreeningCriterion();
  const updateCriterion = useUpdateScreeningCriterion();

  const [showCreate, setShowCreate] = useState(false);
  const [newForm, setNewForm] = useState<CriterionForm>(EMPTY_CRITERION);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<CriterionForm>(EMPTY_CRITERION);

  function startEdit(c: { id: number; name: string; description: string; isEnabled: boolean }) {
    setEditingId(c.id);
    setEditForm({ name: c.name, description: c.description, isEnabled: c.isEnabled });
  }

  function cancelEdit() { setEditingId(null); }

  function handleCreate() {
    if (!newForm.name.trim() || !newForm.description.trim()) {
      toast({ title: "Name and description are required", variant: "destructive" }); return;
    }
    createCriterion.mutate(
      { data: { name: newForm.name.trim(), description: newForm.description.trim(), isEnabled: newForm.isEnabled } },
      {
        onSuccess: () => {
          toast({ title: "Criterion added" });
          qc.invalidateQueries({ queryKey: ["/api/admin/screening-criteria"] });
          setNewForm(EMPTY_CRITERION);
          setShowCreate(false);
        },
        onError: () => toast({ title: "Failed to create", variant: "destructive" }),
      }
    );
  }

  function handleSaveEdit() {
    if (!editForm.name.trim() || !editForm.description.trim()) {
      toast({ title: "Name and description are required", variant: "destructive" }); return;
    }
    updateCriterion.mutate(
      { id: editingId!, data: { name: editForm.name.trim(), description: editForm.description.trim(), isEnabled: editForm.isEnabled } },
      {
        onSuccess: () => {
          toast({ title: "Criterion updated" });
          qc.invalidateQueries({ queryKey: ["/api/admin/screening-criteria"] });
          setEditingId(null);
        },
        onError: () => toast({ title: "Failed to update", variant: "destructive" }),
      }
    );
  }

  function handleToggle(c: { id: number; name: string; description: string; isEnabled: boolean }) {
    updateCriterion.mutate(
      { id: c.id, data: { name: c.name, description: c.description, isEnabled: !c.isEnabled } },
      { onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/screening-criteria"] }) }
    );
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/screening-criteria/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error();
      toast({ title: "Criterion deleted" });
      qc.invalidateQueries({ queryKey: ["/api/admin/screening-criteria"] });
      if (editingId === id) setEditingId(null);
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>AI Screening Criteria</CardTitle>
            <CardDescription>
              Define what Claude checks when pre-screening contracts. Each criterion is evaluated and contributes to the risk score.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => { setShowCreate(true); setEditingId(null); }} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add Criterion
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Create form */}
        {showCreate && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
            <p className="text-sm font-semibold">New Screening Criterion</p>
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Name <span className="text-destructive">*</span></Label>
                <Input
                  className="mt-1 h-8 text-sm"
                  value={newForm.name}
                  onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Indemnification Clause Check"
                />
              </div>
              <div>
                <Label className="text-xs">Description <span className="text-destructive">*</span></Label>
                <textarea
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  rows={3}
                  value={newForm.description}
                  onChange={(e) => setNewForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe what Claude should check for — be specific. e.g. 'Check if the contract contains a mutual indemnification clause that limits liability to the contract value.'"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">Claude uses this description as the evaluation instruction</p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Switch checked={newForm.isEnabled} onCheckedChange={(v) => setNewForm((f) => ({ ...f, isEnabled: v })) } />
                <span className="text-xs text-muted-foreground">Enabled immediately</span>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleCreate} disabled={!newForm.name || !newForm.description || createCriterion.isPending}>
                {createCriterion.isPending ? "Adding…" : "Add Criterion"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowCreate(false); setNewForm(EMPTY_CRITERION); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Criteria list */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Loading…</p>
        ) : !criteria?.length ? (
          <div className="text-center py-10 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
            No screening criteria yet.<br />Add one above to start configuring what Claude evaluates.
          </div>
        ) : (
          <div className="space-y-2">
            {criteria.map((c) => (
              <div key={c.id} className="border rounded-lg overflow-hidden">
                {editingId === c.id ? (
                  /* Edit mode */
                  <div className="p-4 space-y-3 bg-muted/10">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Editing criterion</p>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={cancelEdit}>
                        <X className="w-3 h-3 mr-1" /> Cancel
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs">Name <span className="text-destructive">*</span></Label>
                      <Input
                        className="mt-1 h-8 text-sm"
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Description <span className="text-destructive">*</span></Label>
                      <textarea
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        rows={3}
                        value={editForm.description}
                        onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch checked={editForm.isEnabled} onCheckedChange={(v) => setEditForm((f) => ({ ...f, isEnabled: v }))} />
                        <span className="text-xs text-muted-foreground">{editForm.isEnabled ? "Enabled" : "Disabled"}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive gap-1.5 h-7 text-xs"
                          onClick={() => handleDelete(c.id, c.name)}>
                          <Trash2 className="w-3 h-3" /> Delete
                        </Button>
                        <Button size="sm" className="h-7 text-xs gap-1.5" onClick={handleSaveEdit} disabled={updateCriterion.isPending}>
                          {updateCriterion.isPending ? "Saving…" : "Save Changes"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div className={`flex items-start gap-3 p-3 transition-colors ${c.isEnabled ? "" : "opacity-60"}`}>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{c.name}</p>
                        <Badge variant={c.isEnabled ? "secondary" : "outline"} className="text-[10px]">
                          {c.isEnabled ? "Active" : "Disabled"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{c.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      <Switch checked={c.isEnabled} onCheckedChange={() => handleToggle(c)} />
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => startEdit(c)}>
                        <PenLine className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(c.id, c.name)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {criteria && criteria.length > 0 && (
          <p className="text-xs text-muted-foreground pt-2">
            {criteria.filter((c) => c.isEnabled).length} of {criteria.length} criteria active —
            Claude evaluates all active criteria when a contract is submitted for screening.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Value Tiers Panel ───────────────────────────────────────────────────────
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
          <div className="mb-4 p-4 border rounded-lg bg-muted/20">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div><Label className="text-xs">Name</Label><Input className="mt-1" value={newTier.name} onChange={(e) => setNewTier((t) => ({ ...t, name: e.target.value }))} placeholder="Tier name" /></div>
              <div><Label className="text-xs">Min ($)</Label><Input className="mt-1" type="number" value={newTier.minValue} onChange={(e) => setNewTier((t) => ({ ...t, minValue: e.target.value }))} /></div>
              <div><Label className="text-xs">Max ($)</Label><Input className="mt-1" type="number" value={newTier.maxValue} onChange={(e) => setNewTier((t) => ({ ...t, maxValue: e.target.value }))} placeholder="No limit" /></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={!newTier.name || !newTier.minValue || createTier.isPending}>
                {createTier.isPending ? "Creating…" : "Create"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}><X className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
        {isLoading ? <p className="text-sm text-muted-foreground py-4">Loading…</p> : (
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
                }}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
            {!tiers?.length && <p className="text-sm text-muted-foreground text-center py-8">No value tiers configured.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
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
        <p className="text-muted-foreground mt-1">Manage users, contract types, approval workflows, and AI screening settings.</p>
      </div>
      <Tabs defaultValue="types">
        <TabsList className="mb-6">
          <TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" /> Users</TabsTrigger>
          <TabsTrigger value="types" className="gap-2"><FileText className="w-4 h-4" /> Contract Types</TabsTrigger>
          <TabsTrigger value="workflows" className="gap-2"><GitBranch className="w-4 h-4" /> Workflows</TabsTrigger>
          <TabsTrigger value="screening" className="gap-2"><Brain className="w-4 h-4" /> AI Screening</TabsTrigger>
          <TabsTrigger value="tiers" className="gap-2"><DollarSign className="w-4 h-4" /> Value Tiers</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UsersPanel toast={toast} qc={qc} /></TabsContent>
        <TabsContent value="types"><ContractTypesPanel toast={toast} qc={qc} /></TabsContent>
        <TabsContent value="workflows"><WorkflowsPanel toast={toast} qc={qc} /></TabsContent>
        <TabsContent value="screening"><ScreeningPanel toast={toast} qc={qc} /></TabsContent>
        <TabsContent value="tiers"><ValueTiersPanel toast={toast} qc={qc} /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}
