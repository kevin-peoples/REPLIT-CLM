import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDatetime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function statusColor(status: string): string {
  switch (status) {
    case "draft": return "bg-gray-100 text-gray-700";
    case "pending_ai_screening": return "bg-purple-100 text-purple-700";
    case "returned_for_edits": return "bg-red-100 text-red-700";
    case "in_legal_review": return "bg-yellow-100 text-yellow-700";
    case "pending_signature": return "bg-blue-100 text-blue-700";
    case "pending_executed_upload": return "bg-indigo-100 text-indigo-700";
    case "executed": return "bg-green-100 text-green-700";
    case "expired": return "bg-gray-100 text-gray-500";
    case "cancelled": return "bg-red-50 text-red-400";
    default: return "bg-gray-100 text-gray-600";
  }
}

export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
