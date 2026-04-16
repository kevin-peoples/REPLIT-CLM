import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dashboardConfigTable = pgTable("dashboard_config", {
  id: serial("id").primaryKey(),
  showActiveValue: boolean("show_active_value").notNull().default(true),
  showContractsByType: boolean("show_contracts_by_type").notNull().default(true),
  showExpiringContracts: boolean("show_expiring_contracts").notNull().default(true),
  showAverageCycleTime: boolean("show_average_cycle_time").notNull().default(true),
  showBottlenecks: boolean("show_bottlenecks").notNull().default(true),
  showReviewerWorkload: boolean("show_reviewer_workload").notNull().default(true),
  bottleneckThresholdDays: integer("bottleneck_threshold_days").notNull().default(7),
  expiringWindowDays: integer("expiring_window_days").notNull().default(30),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDashboardConfigSchema = createInsertSchema(dashboardConfigTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDashboardConfig = z.infer<typeof insertDashboardConfigSchema>;
export type DashboardConfig = typeof dashboardConfigTable.$inferSelect;
