import { pgTable, text, serial, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const obligationsTable = pgTable("obligations", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull(),
  obligationType: text("obligation_type").notNull(),
  description: text("description").notNull(),
  dueDate: date("due_date").notNull(),
  status: text("status").notNull().default("pending"), // pending | completed | overdue | acknowledged
  reminderDays: integer("reminder_days").notNull().default(30),
  reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
  reminderEmail: text("reminder_email"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertObligationSchema = createInsertSchema(obligationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertObligation = z.infer<typeof insertObligationSchema>;
export type Obligation = typeof obligationsTable.$inferSelect;
