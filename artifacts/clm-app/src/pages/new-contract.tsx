import { useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useListContractTypes, useListValueTiers, useCreateContract } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";

export default function NewContract() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createContract = useCreateContract();

  const { data: contractTypes } = useListContractTypes();
  const { data: valueTiers } = useListValueTiers();

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
    department: "",
    driveFileId: "",
    autoRenewal: false,
    noticePeriodDays: "",
  });

  function handleChange(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.contractName || !form.contractTypeId || !form.counterpartyName) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
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
            <CardDescription>Enter the contract details below. Fields marked with * are required.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="contractName">Contract Name *</Label>
                  <Input
                    id="contractName"
                    className="mt-1.5"
                    placeholder="e.g. Software License Agreement with Acme Corp"
                    value={form.contractName}
                    onChange={(e) => handleChange("contractName", e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="contractType">Contract Type *</Label>
                  <Select value={form.contractTypeId} onValueChange={(v) => handleChange("contractTypeId", v)}>
                    <SelectTrigger className="mt-1.5">
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
                  <Label htmlFor="direction">Direction *</Label>
                  <Select value={form.direction} onValueChange={(v) => handleChange("direction", v)}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buy">Buy (we receive services/goods)</SelectItem>
                      <SelectItem value="sell">Sell (we provide services/goods)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium text-sm mb-3">Counterparty Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="counterpartyName">Counterparty Legal Name *</Label>
                    <Input
                      id="counterpartyName"
                      className="mt-1.5"
                      placeholder="Full legal entity name as it appears in the contract"
                      value={form.counterpartyName}
                      onChange={(e) => handleChange("counterpartyName", e.target.value)}
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
                      onChange={(e) => handleChange("counterpartyAddress", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium text-sm mb-3">Financial & Timeline</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contractValue">Contract Value ($)</Label>
                    <Input
                      id="contractValue"
                      className="mt-1.5"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={form.contractValue}
                      onChange={(e) => handleChange("contractValue", e.target.value)}
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
                      onChange={(e) => handleChange("noticePeriodDays", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="effectiveDate">Effective Date</Label>
                    <Input
                      id="effectiveDate"
                      className="mt-1.5"
                      type="date"
                      value={form.effectiveDate}
                      onChange={(e) => handleChange("effectiveDate", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="expirationDate">Expiration Date</Label>
                    <Input
                      id="expirationDate"
                      className="mt-1.5"
                      type="date"
                      value={form.expirationDate}
                      onChange={(e) => handleChange("expirationDate", e.target.value)}
                    />
                  </div>
                </div>
              </div>

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
                      onChange={(e) => handleChange("department", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="driveFileId">Google Drive File ID</Label>
                    <Input
                      id="driveFileId"
                      className="mt-1.5"
                      placeholder="Google Drive file ID or link"
                      value={form.driveFileId}
                      onChange={(e) => handleChange("driveFileId", e.target.value)}
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
                      onChange={(e) => handleChange("description", e.target.value)}
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
