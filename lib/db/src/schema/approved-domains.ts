import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const approvedDomainsTable = pgTable("approved_domains", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ApprovedDomain = typeof approvedDomainsTable.$inferSelect;
