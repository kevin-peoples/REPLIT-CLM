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
  useDeleteContractType, useUpdateScreeningCriterion, useCreateValueTier,
  useDeleteValueTier, useGetMe,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  Users, FileText, GitBranch, Brain, DollarSign, Plus, Trash2, X,
  ChevronUp, ChevronDown, Settings2, Eye, ArrowLeft, GripVertical,
  Type, AlignLeft, Hash, Calendar, List, ToggleLeft,
} from "lucide-react";
import { useLocation } from "wouter";

const ALL_ROLES = ["submitter", "legal_reviewer", "designated_signer", "admin"];
type ToastFn = ReturnType<typeof useToast>["toast"];
type QC = ReturnType<typeof useQueryClient>;

// ─── Field schema types ───────────────────────────────────────────────────────
type FieldType = "text" | "textarea" | "number" | "date" | "select" | "checkbox";

interface FormField {
  name: string;
  type: FieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

interface FormSchema { fields: FormField[] }

const FIELD_TYPES: { value: FieldType; label: string; icon: React.ReactNode }[] = [
  { value: "text",     label: "Short text",   icon: <Type className="w-3.5 h-3.5" /> },
  { value: "textarea", label: "Long text",    icon: <AlignLeft className="w-3.5 h-3.5" /> },
  { value: "number",   label: "Number",       icon: <Hash className="w-3.5 h-3.5" /> },
  { value: "date",     label: "Date",         icon: <Calendar className="w-3.5 h-3.5" /> },
  { value: "select",   label: "Dropdown",     icon: <List className="w-3.5 h-3.5" /> },
  { value: "checkbox", label: "Checkbox",     icon: <ToggleLeft className="w-3.5 h-3.5" /> },
];

function makeSlug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "field";
}

// ─── Form Builder ─────────────────────────────────────────────────────────────
function FormBuilder({
  contractType,
  onClose,
  onSave,
  isSaving,
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
      const autoSlug = field.name === makeSlug(field.label) || field.name === `field_${String(i)}` || field.name.startsWith("field_");
      return { ...field, label, ...(autoSlug ? { name: makeSlug(label) } : {}) };
    }));
  }

  function addOption(idx: number) {
    const opt = (newOption[idx] ?? "").trim();
    if (!opt) return;
    setFields((f) => f.map((field, i) => i === idx
      ? { ...field, options: [...(field.options ?? []), opt] }
      : field));
    setNewOption((p) => ({ ...p, [idx]: "" }));
  }

  function removeOption(fieldIdx: number, optIdx: number) {
    setFields((f) => f.map((field, i) => i === fieldIdx
      ? { ...field, options: (field.options ?? []).filter((_, oi) => oi !== optIdx) }
      : field));
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div>
          <h3 className="font-semibold">{contractType.name}</h3>
          <p className="text-xs text-muted-foreground">Intake form builder — {fields.length} field{fields.length !== 1 ? "s" : ""}</p>
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

      {/* Preview mode */}
      {preview ? (
        <div className="border rounded-lg p-6 bg-muted/20">
          <p className="text-sm font-medium mb-4 text-muted-foreground uppercase tracking-wide text-xs">
            {contractType.name} — Preview
          </p>
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No fields yet. Switch to Edit to add fields.</p>
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
                        <div className="mt-1.5 h-20 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                          {field.placeholder ?? ""}
                        </div>
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
        /* Edit mode */
        <div className="grid grid-cols-5 gap-4">
          {/* Field list */}
          <div className="col-span-2 space-y-1.5">
            {fields.length === 0 && (
              <div className="text-center py-10 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                No fields yet.<br />Click "Add Field" to start building.
              </div>
            )}
            {fields.map((field, idx) => {
              const typeInfo = FIELD_TYPES.find((t) => t.value === field.type);
              return (
                <div
                  key={idx}
                  onClick={() => setActiveField(idx)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    activeField === idx
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
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
                    <button onClick={() => moveField(idx, -1)} disabled={idx === 0} className="disabled:opacity-20 hover:text-foreground text-muted-foreground">
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button onClick={() => moveField(idx, 1)} disabled={idx === fields.length - 1} className="disabled:opacity-20 hover:text-foreground text-muted-foreground">
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={addField} className="w-full gap-1.5 mt-2">
              <Plus className="w-4 h-4" /> Add Field
            </Button>
          </div>

          {/* Field editor */}
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
                      <Input
                        className="mt-1 h-8 text-sm"
                        value={field.label}
                        onChange={(e) => updateLabel(idx, e.target.value)}
                        placeholder="e.g. Payment Terms"
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Field Key <span className="text-muted-foreground">(auto-generated)</span></Label>
                      <Input
                        className="mt-1 h-8 text-sm font-mono"
                        value={field.name}
                        onChange={(e) => updateField(idx, { name: e.target.value.replace(/\s+/g, "_").toLowerCase() })}
                        placeholder="e.g. payment_terms"
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Used as the data key in contract records</p>
                    </div>

                    <div>
                      <Label className="text-xs">Field Type</Label>
                      <Select value={field.type} onValueChange={(v) => updateField(idx, { type: v as FieldType, options: v === "select" ? (field.options ?? []) : undefined })}>
                        <SelectTrigger className="mt-1 h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
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
                        <Label className="text-xs">Placeholder text</Label>
                        <Input
                          className="mt-1 h-8 text-sm"
                          value={field.placeholder ?? ""}
                          onChange={(e) => updateField(idx, { placeholder: e.target.value || undefined })}
                          placeholder="Optional hint shown inside the field"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between py-1">
                      <div>
                        <Label className="text-xs">Required</Label>
                        <p className="text-[10px] text-muted-foreground">Submitter must fill this in</p>
                      </div>
                      <Switch checked={field.required} onCheckedChange={(v) => updateField(idx, { required: v })} />
                    </div>

                    {/* Dropdown options editor */}
                    {field.type === "select" && (
                      <div>
                        <Label className="text-xs">Dropdown Options</Label>
                        <div className="mt-1.5 space-y-1.5 border rounded-md p-2 bg-muted/20">
                          {(field.options ?? []).length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-1">No options yet</p>
                          )}
                          {(field.options ?? []).map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-1.5">
                              <div className="flex-1 text-xs bg-background border rounded px-2 py-1">{opt}</div>
                              <button onClick={() => removeOption(idx, oi)} className="text-muted-foreground hover:text-destructive shrink-0">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          <div className="flex gap-1.5 pt-1">
                            <Input
                              className="h-7 text-xs flex-1"
                              placeholder="Add option…"
                              value={newOption[idx] ?? ""}
                              onChange={(e) => setNewOption((p) => ({ ...p, [idx]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(idx); } }}
                            />
                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => addOption(idx)}>
                              <Plus className="w-3 h-3" />
                            </Button>
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

// ─── Contract Types Panel ────────────────────────────────────────────────────
function ContractTypesPanel({ toast, qc }: { toast: ToastFn; qc: QC }) {
  const { data: types, isLoading } = useListContractTypes();
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Contract Types</CardTitle>
            <CardDescription>
              {editingType
                ? "Build the intake form fields for this contract type"
                : "Manage contract categories and design their intake forms"}
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

            {isLoading ? (
              <p className="text-sm text-muted-foreground py-4">Loading…</p>
            ) : (
              <div className="space-y-2">
                {types?.map((t) => {
                  const schema = t.formSchema as FormSchema | null | undefined;
                  const fieldCount = schema?.fields?.length ?? 0;
                  return (
                    <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/20 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{t.name}</p>
                          <Badge variant={t.isActive ? "secondary" : "outline"} className="text-[10px]">
                            {t.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {fieldCount === 0
                            ? <span className="text-amber-600">No intake fields — click Edit Form to add some</span>
                            : `${fieldCount} intake field${fieldCount !== 1 ? "s" : ""}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingFormId(t.id)}
                          className="gap-1.5 h-7 text-xs"
                        >
                          <Settings2 className="w-3.5 h-3.5" /> Edit Form
                        </Button>
                        <Switch checked={t.isActive} onCheckedChange={() => handleToggle(t.id, t.isActive)} />
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => handleDelete(t.id)}
                          className="text-muted-foreground hover:text-destructive h-7 w-7 p-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
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

// ─── Workflows Panel ─────────────────────────────────────────────────────────
function WorkflowsPanel() {
  const { data: workflows, isLoading } = useListWorkflows();
  return (
    <Card>
      <CardHeader><CardTitle>Workflow Definitions</CardTitle><CardDescription>Review configured approval workflows and their stages.</CardDescription></CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
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

// ─── Screening Panel ─────────────────────────────────────────────────────────
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
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
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
              <div><Label className="text-xs">Min Value ($)</Label><Input className="mt-1" type="number" value={newTier.minValue} onChange={(e) => setNewTier((t) => ({ ...t, minValue: e.target.value }))} /></div>
              <div><Label className="text-xs">Max Value ($)</Label><Input className="mt-1" type="number" value={newTier.maxValue} onChange={(e) => setNewTier((t) => ({ ...t, maxValue: e.target.value }))} placeholder="No limit" /></div>
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

// ─── Page ────────────────────────────────────────────────────────────────────
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
        <TabsContent value="workflows"><WorkflowsPanel /></TabsContent>
        <TabsContent value="screening"><ScreeningPanel toast={toast} qc={qc} /></TabsContent>
        <TabsContent value="tiers"><ValueTiersPanel toast={toast} qc={qc} /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}
