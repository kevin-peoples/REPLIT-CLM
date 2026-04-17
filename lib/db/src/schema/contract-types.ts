import { pgTable, text, serial, timestamp, jsonb, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contractTypesTable = pgTable("contract_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  formSchema: jsonb("form_schema").notNull().default({}),
  obligationTypes: text("obligation_types").array().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  defaultWorkflowId: integer("default_workflow_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertContractTypeSchema = createInsertSchema(contractTypesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContractType = z.infer<typeof insertContractTypeSchema>;
export type ContractType = typeof contractTypesTable.$inferSelect;
