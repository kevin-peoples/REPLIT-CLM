import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const valueTiersTable = pgTable("value_tiers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  minValue: numeric("min_value", { precision: 20, scale: 2 }).notNull(),
  maxValue: numeric("max_value", { precision: 20, scale: 2 }),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertValueTierSchema = createInsertSchema(valueTiersTable).omit({ id: true, createdAt: true });
export type InsertValueTier = z.infer<typeof insertValueTierSchema>;
export type ValueTier = typeof valueTiersTable.$inferSelect;
