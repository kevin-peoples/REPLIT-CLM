import { useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useListContractTypes, useCreateContract, useGetMe } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ChevronRight, Sparkles } from "lucide-react";
import { Link } from "wouter";

interface FormField {
  name: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "checkbox";
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

interface FormSchema {
  fields: FormField[];
}

function DynamicField({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string | boolean;
  onChange: (val: string | boolean) => void;
}) {
  const id = `custom_${field.name}`;

  if (field.type === "select" && field.options) {
    return (
      <div>
        <Label htmlFor={id}>
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Select value={value as string} onValueChange={(v) => onChange(v)}>
          <SelectTrigger className="mt-1.5" id={id}>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div>
        <Label htmlFor={id}>
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Textarea
          id={id}
          className="mt-1.5"
          rows={3}
          placeholder={field.placeholder}
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (field.type === "checkbox") {
    return (
      <div className="flex items-center gap-2 mt-1">
        <Checkbox
          id={id}
          checked={value as boolean}
          onCheckedChange={(checked) => onChange(!!checked)}
        />
        <Label htmlFor={id} className="cursor-pointer font-normal">
          {field.label}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
      </div>
    );
  }

  return (
    <div>
      <Label htmlFor={id}>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        id={id}
        className="mt-1.5"
        type={field.type}
        step={field.type === "number" ? "0.01" : undefined}
        placeholder={field.placeholder}
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default function NewContract() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createContract = useCreateContract();
  const { data: me } = useGetMe();

  const { data: contractTypes } = useListContractTypes();

  const [form, setForm] = useState({
    contractName: "",
    contractTypeId: "",
    direction: "buy" as "buy" | "sell",
    counterpartyName: "",
    counterpartyAddress: "",
    contractValue: "",
    effectiveDate: "",
    expirationDate: "",
    description: "",
    department: (me as any)?.department ?? "",
    driveFileId: "",
    autoRenewal: false,
    noticePeriodDays: "",
  });

  const [customFields, setCustomFields] = useState<Record<string, string | boolean>>({});

  function setField(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function setCustomField(name: string, value: string | boolean) {
    setCustomFields((f) => ({ ...f, [name]: value }));
  }

  const selectedType = contractTypes?.find((ct) => String(ct.id) === form.contractTypeId);
  const formSchema = selectedType?.formSchema as FormSchema | null | undefined;
  const typeFields: FormField[] = formSchema?.fields ?? [];

  function validateCustomFields(): boolean {
    for (const field of typeFields) {
      if (field.required) {
        const val = customFields[field.name];
        if (val === undefined || val === "" || val === null) return false;
      }
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.contractName || !form.contractTypeId || !form.counterpartyName) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (!validateCustomFields()) {
      toast({ title: "Please fill in all required fields for this contract type", variant: "destructive" });
      return;
    }

    createContract.mutate(
      {
        data: {
          contractName: form.contractName,
          contractTypeId: parseInt(form.contractTypeId),
          direction: form.direction,
          counterpartyName: form.counterpartyName,
          counterpartyAddress: form.counterpartyAddress || null,
          contractValue: form.contractValue ? parseFloat(form.contractValue) : null,
          effectiveDate: form.effectiveDate || null,
          expirationDate: form.expirationDate || null,
          description: form.description || null,
          department: form.department || null,
          driveFileId: form.driveFileId || null,
          autoRenewal: form.autoRenewal,
          noticePeriodDays: form.noticePeriodDays ? parseInt(form.noticePeriodDays) : null,
          formData: Object.keys(customFields).length > 0 ? customFields : null,
        },
      },
      {
        onSuccess: (data) => {
          toast({ title: "Contract created successfully" });
          setLocation(`/contracts/${data.id}`);
        },
        onError: () => {
          toast({ title: "Failed to create contract", variant: "destructive" });
        },
      }
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/contracts">
            <span className="hover:text-foreground cursor-pointer flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Contracts
            </span>
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium">New Contract</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create New Contract</CardTitle>
            <CardDescription>
              Fields marked with <span className="text-destructive">*</span> are required.
              {selectedType && (
                <span className="ml-2">
                  Additional fields for <strong>{selectedType.name}</strong> are shown below.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Core fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="contractName">Contract Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="contractName"
                    className="mt-1.5"
                    placeholder="e.g. Software License Agreement with Acme Corp"
                    value={form.contractName}
                    onChange={(e) => setField("contractName", e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="contractType">Contract Type <span className="text-destructive">*</span></Label>
                  <Select
                    value={form.contractTypeId}
                    onValueChange={(v) => {
                      setField("contractTypeId", v);
                      setCustomFields({});
                    }}
                  >
                    <SelectTrigger className="mt-1.5" id="contractType">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {contractTypes?.filter((ct) => ct.isActive).map((ct) => (
                        <SelectItem key={ct.id} value={String(ct.id)}>{ct.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="direction">Direction <span className="text-destructive">*</span></Label>
                  <Select value={form.direction} onValueChange={(v) => setField("direction", v)}>
                    <SelectTrigger className="mt-1.5" id="direction">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buy">Buy (we receive services/goods)</SelectItem>
                      <SelectItem value="sell">Sell (we provide services/goods)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Contract-type-specific fields */}
              {typeFields.length > 0 && (
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h3 className="font-medium text-sm">{selectedType?.name} — Specific Fields</h3>
                    <Badge variant="secondary" className="text-xs">{typeFields.length} fields</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {typeFields.map((field) => (
                      <div
                        key={field.name}
                        className={field.type === "textarea" || field.type === "checkbox" ? "col-span-2" : ""}
                      >
                        <DynamicField
                          field={field}
                          value={customFields[field.name] ?? (field.type === "checkbox" ? false : "")}
                          onChange={(val) => setCustomField(field.name, val)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Counterparty */}
              <div className="border-t pt-4">
                <h3 className="font-medium text-sm mb-3">Counterparty Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="counterpartyName">Counterparty Legal Name <span className="text-destructive">*</span></Label>
                    <Input
                      id="counterpartyName"
                      className="mt-1.5"
                      placeholder="Full legal entity name as it appears in the contract"
                      value={form.counterpartyName}
                      onChange={(e) => setField("counterpartyName", e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="counterpartyAddress">Counterparty Address</Label>
                    <Input
                      id="counterpartyAddress"
                      className="mt-1.5"
                      placeholder="Street, City, State, ZIP"
                      value={form.counterpartyAddress}
                      onChange={(e) => setField("counterpartyAddress", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Financial & Timeline */}
              <div className="border-t pt-4">
                <h3 className="font-medium text-sm mb-3">Financial & Timeline</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contractValue">Contract Value ($)</Label>
                    <Input
                      id="contractValue"
                      className="mt-1.5"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={form.contractValue}
                      onChange={(e) => setField("contractValue", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="noticePeriodDays">Notice Period (days)</Label>
                    <Input
                      id="noticePeriodDays"
                      className="mt-1.5"
                      type="number"
                      placeholder="e.g. 30"
                      value={form.noticePeriodDays}
                      onChange={(e) => setField("noticePeriodDays", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="effectiveDate">Effective Date</Label>
                    <Input
                      id="effectiveDate"
                      className="mt-1.5"
                      type="date"
                      value={form.effectiveDate}
                      onChange={(e) => setField("effectiveDate", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="expirationDate">Expiration Date</Label>
                    <Input
                      id="expirationDate"
                      className="mt-1.5"
                      type="date"
                      value={form.expirationDate}
                      onChange={(e) => setField("expirationDate", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <Checkbox
                      id="autoRenewal"
                      checked={form.autoRenewal}
                      onCheckedChange={(v) => setField("autoRenewal", !!v)}
                    />
                    <Label htmlFor="autoRenewal" className="font-normal cursor-pointer">
                      Auto-renews at expiration
                    </Label>
                  </div>
                </div>
              </div>

              {/* Additional Details */}
              <div className="border-t pt-4">
                <h3 className="font-medium text-sm mb-3">Additional Details</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      className="mt-1.5"
                      placeholder="e.g. Engineering, Legal, Sales"
                      value={form.department}
                      onChange={(e) => setField("department", e.target.value)}
                    />
                    {(me as any)?.department && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Pre-filled from your Google Workspace profile
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="driveFileId">Google Drive File ID</Label>
                    <Input
                      id="driveFileId"
                      className="mt-1.5"
                      placeholder="Paste the file ID from the Google Drive URL"
                      value={form.driveFileId}
                      onChange={(e) => setField("driveFileId", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description / Notes</Label>
                    <Textarea
                      id="description"
                      className="mt-1.5"
                      rows={3}
                      placeholder="Additional context or notes about this contract..."
                      value={form.description}
                      onChange={(e) => setField("description", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={createContract.isPending}>
                  {createContract.isPending ? "Creating..." : "Create Contract"}
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/contracts">Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
