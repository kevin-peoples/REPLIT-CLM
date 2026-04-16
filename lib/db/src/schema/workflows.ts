import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const workflowDefinitionsTable = pgTable("workflow_definitions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  direction: text("direction"),
  department: text("department"),
  minTierId: integer("min_tier_id"),
  maxTierId: integer("max_tier_id"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const workflowStagesTable = pgTable("workflow_stages", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").notNull(),
  name: text("name").notNull(),
  stageOrder: integer("stage_order").notNull(),
  assignedRole: text("assigned_role"),
  assignedUserId: integer("assigned_user_id"),
  canSendBack: boolean("can_send_back").notNull().default(true),
  isOptional: boolean("is_optional").notNull().default(false),
  isSigned: boolean("is_signed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWorkflowDefinitionSchema = createInsertSchema(workflowDefinitionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWorkflowDefinition = z.infer<typeof insertWorkflowDefinitionSchema>;
export type WorkflowDefinition = typeof workflowDefinitionsTable.$inferSelect;

export const insertWorkflowStageSchema = createInsertSchema(workflowStagesTable).omit({ id: true, createdAt: true });
export type InsertWorkflowStage = z.infer<typeof insertWorkflowStageSchema>;
export type WorkflowStage = typeof workflowStagesTable.$inferSelect;
