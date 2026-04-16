import { pgTable, text, serial, timestamp, integer, boolean, numeric, jsonb, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contractStatusEnum = [
  "draft",
  "ai_screening",
  "in_legal_review",
  "returned_for_edits",
  "approved_pending_signature",
  "awaiting_executed_upload",
  "fully_executed",
  "expired",
] as const;

export const contractsTable = pgTable("contracts", {
  id: serial("id").primaryKey(),
  contractName: text("contract_name").notNull(),
  contractTypeId: integer("contract_type_id").notNull(),
  direction: text("direction").notNull(), // buy | sell
  status: text("status").notNull().default("draft"),
  counterpartyName: text("counterparty_name").notNull(),
  counterpartyAddress: text("counterparty_address"),
  contractValue: numeric("contract_value", { precision: 20, scale: 2 }),
  effectiveDate: date("effective_date"),
  expirationDate: date("expiration_date"),
  autoRenewal: boolean("auto_renewal").notNull().default(false),
  noticePeriodDays: integer("notice_period_days"),
  description: text("description"),
  department: text("department"),
  driveFileId: text("drive_file_id"),
  driveFileName: text("drive_file_name"),
  executedDriveFileId: text("executed_drive_file_id"),
  formData: jsonb("form_data"),
  submittedById: integer("submitted_by_id").notNull(),
  currentStageId: integer("current_stage_id"),
  currentWorkflowId: integer("current_workflow_id"),
  aiRiskScore: text("ai_risk_score"), // low | medium | high
  stageEnteredAt: timestamp("stage_entered_at", { withTimezone: true }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  fullyExecutedAt: timestamp("fully_executed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertContractSchema = createInsertSchema(contractsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contractsTable.$inferSelect;
