import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const auditTrailTable = pgTable("audit_trail", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull(),
  userId: integer("user_id"),
  action: text("action").notNull(),
  comment: text("comment"),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAuditEntrySchema = createInsertSchema(auditTrailTable).omit({ id: true, createdAt: true });
export type InsertAuditEntry = z.infer<typeof insertAuditEntrySchema>;
export type AuditEntry = typeof auditTrailTable.$inferSelect;
