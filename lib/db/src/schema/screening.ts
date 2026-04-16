import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const screeningCriteriaTable = pgTable("screening_criteria", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const screeningResultsTable = pgTable("screening_results", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull(),
  riskScore: text("risk_score").notNull(), // low | medium | high
  criteriaResults: jsonb("criteria_results").notNull().default([]),
  rawResponse: jsonb("raw_response"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertScreeningCriterionSchema = createInsertSchema(screeningCriteriaTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertScreeningCriterion = z.infer<typeof insertScreeningCriterionSchema>;
export type ScreeningCriterion = typeof screeningCriteriaTable.$inferSelect;

export const insertScreeningResultSchema = createInsertSchema(screeningResultsTable).omit({ id: true, createdAt: true });
export type InsertScreeningResult = z.infer<typeof insertScreeningResultSchema>;
export type ScreeningResult = typeof screeningResultsTable.$inferSelect;
