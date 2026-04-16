import { Router, type IRouter } from "express";
import { eq, and, lt, gt, lte, gte, desc, sql, isNull, ne } from "drizzle-orm";
import {
  db,
  contractsTable,
  contractTypesTable,
  obligationsTable,
  usersTable,
  workflowStagesTable,
  dashboardConfigTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// GET /dashboard/summary
router.get("/dashboard/summary", requireAuth, async (_req, res): Promise<void> => {
  const [statusCounts, typeDistribution, valueStats, config] = await Promise.all([
    db
      .select({
        status: contractsTable.status,
        count: sql<number>`count(*)`,
      })
      .from(contractsTable)
      .groupBy(contractsTable.status),
    db
      .select({
        typeName: contractTypesTable.name,
        count: sql<number>`count(*)`,
      })
      .from(contractsTable)
      .leftJoin(contractTypesTable, eq(contractsTable.contractTypeId, contractTypesTable.id))
      .groupBy(contractTypesTable.name),
    db
      .select({
        totalActive: sql<number>`coalesce(sum(case when status not in ('expired','fully_executed') then cast(contract_value as numeric) else 0 end),0)`,
        totalBuy: sql<number>`coalesce(sum(case when direction='buy' and status not in ('expired','fully_executed') then cast(contract_value as numeric) else 0 end),0)`,
        totalSell: sql<number>`coalesce(sum(case when direction='sell' and status not in ('expired','fully_executed') then cast(contract_value as numeric) else 0 end),0)`,
        avgCycle: sql<number>`avg(extract(epoch from (fully_executed_at - submitted_at))/86400)`,
      })
      .from(contractsTable),
    db.select().from(dashboardConfigTable).limit(1),
  ]);

  const statusCountMap: Record<string, number> = {};
  for (const row of statusCounts) {
    statusCountMap[row.status] = Number(row.count);
  }

  const configRow = config[0];
  const threshold = configRow?.bottleneckThresholdDays ?? 7;

  res.json({
    statusCounts: statusCountMap,
    totalActiveValue: Number(valueStats[0]?.totalActive || 0),
    totalBuySideValue: Number(valueStats[0]?.totalBuy || 0),
    totalSellSideValue: Number(valueStats[0]?.totalSell || 0),
    contractsByType: typeDistribution.map((t) => ({
      typeName: t.typeName || "Unknown",
      count: Number(t.count),
    })),
    averageCycleTimeDays: valueStats[0]?.avgCycle ? Number(valueStats[0].avgCycle) : null,
    bottleneckThresholdDays: threshold,
  });
});

// GET /dashboard/expiring
router.get("/dashboard/expiring", requireAuth, async (req, res): Promise<void> => {
  const days = parseInt((req.query.days as string) || "30");
  const future = new Date();
  future.setDate(future.getDate() + days);

  const contracts = await db
    .select({
      id: contractsTable.id,
      contractName: contractsTable.contractName,
      contractTypeId: contractsTable.contractTypeId,
      contractTypeName: contractTypesTable.name,
      direction: contractsTable.direction,
      status: contractsTable.status,
      counterpartyName: contractsTable.counterpartyName,
      counterpartyAddress: contractsTable.counterpartyAddress,
      contractValue: contractsTable.contractValue,
      effectiveDate: contractsTable.effectiveDate,
      expirationDate: contractsTable.expirationDate,
      autoRenewal: contractsTable.autoRenewal,
      noticePeriodDays: contractsTable.noticePeriodDays,
      description: contractsTable.description,
      department: contractsTable.department,
      driveFileId: contractsTable.driveFileId,
      executedDriveFileId: contractsTable.executedDriveFileId,
      submittedById: contractsTable.submittedById,
      submittedByName: usersTable.name,
      currentStageId: contractsTable.currentStageId,
      formData: contractsTable.formData,
      aiRiskScore: contractsTable.aiRiskScore,
      createdAt: contractsTable.createdAt,
      updatedAt: contractsTable.updatedAt,
    })
    .from(contractsTable)
    .leftJoin(contractTypesTable, eq(contractsTable.contractTypeId, contractTypesTable.id))
    .leftJoin(usersTable, eq(contractsTable.submittedById, usersTable.id))
    .where(
      and(
        lte(contractsTable.expirationDate, future.toISOString().split("T")[0]),
        gte(contractsTable.expirationDate, new Date().toISOString().split("T")[0]),
        ne(contractsTable.status, "expired"),
      ),
    )
    .orderBy(contractsTable.expirationDate)
    .limit(50);

  res.json(contracts);
});

// GET /dashboard/obligations-due
router.get("/dashboard/obligations-due", requireAuth, async (_req, res): Promise<void> => {
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);

  const obligations = await db
    .select({
      id: obligationsTable.id,
      contractId: obligationsTable.contractId,
      contractName: contractsTable.contractName,
      obligationType: obligationsTable.obligationType,
      description: obligationsTable.description,
      dueDate: obligationsTable.dueDate,
      status: obligationsTable.status,
      completedAt: obligationsTable.completedAt,
      createdAt: obligationsTable.createdAt,
    })
    .from(obligationsTable)
    .leftJoin(contractsTable, eq(obligationsTable.contractId, contractsTable.id))
    .where(
      and(
        lte(obligationsTable.dueDate, thirtyDays.toISOString().split("T")[0]),
        ne(obligationsTable.status, "completed"),
      ),
    )
    .orderBy(obligationsTable.dueDate)
    .limit(50);

  res.json(obligations);
});

// GET /dashboard/bottlenecks
router.get("/dashboard/bottlenecks", requireAuth, async (_req, res): Promise<void> => {
  const [config] = await db.select().from(dashboardConfigTable).limit(1);
  const threshold = config?.bottleneckThresholdDays ?? 7;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - threshold);

  const contracts = await db
    .select({
      id: contractsTable.id,
      contractName: contractsTable.contractName,
      status: contractsTable.status,
      stageEnteredAt: contractsTable.stageEnteredAt,
      submittedByName: usersTable.name,
      currentStageId: contractsTable.currentStageId,
    })
    .from(contractsTable)
    .leftJoin(usersTable, eq(contractsTable.submittedById, usersTable.id))
    .where(
      and(
        lte(contractsTable.stageEnteredAt, cutoff),
        ne(contractsTable.status, "fully_executed"),
        ne(contractsTable.status, "expired"),
        ne(contractsTable.status, "draft"),
      ),
    )
    .orderBy(contractsTable.stageEnteredAt)
    .limit(50);

  const stageIds = contracts.map((c) => c.currentStageId).filter(Boolean) as number[];
  let stageMap: Record<number, string> = {};

  if (stageIds.length > 0) {
    const stages = await db
      .select({ id: workflowStagesTable.id, name: workflowStagesTable.name })
      .from(workflowStagesTable)
      .where(sql`id = any(${stageIds})`);
    stageMap = Object.fromEntries(stages.map((s) => [s.id, s.name]));
  }

  const result = contracts.map((c) => ({
    id: c.id,
    contractName: c.contractName,
    status: c.status,
    currentStageName: c.currentStageId ? stageMap[c.currentStageId] || null : null,
    daysAtStage: c.stageEnteredAt
      ? Math.floor((Date.now() - new Date(c.stageEnteredAt).getTime()) / 86400000)
      : 0,
    submittedByName: c.submittedByName || null,
  }));

  res.json(result);
});

// GET /dashboard/workload
router.get("/dashboard/workload", requireAuth, async (_req, res): Promise<void> => {
  const reviewers = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      roles: usersTable.roles,
    })
    .from(usersTable)
    .where(sql`roles && array['legal_reviewer','designated_signer']`);

  const contractCounts = await db
    .select({
      status: contractsTable.status,
      count: sql<number>`count(*)`,
    })
    .from(contractsTable)
    .where(
      sql`status in ('in_legal_review','approved_pending_signature')`,
    )
    .groupBy(contractsTable.status);

  // Simplified: assign counts proportionally
  const legalCount = Number(contractCounts.find((c) => c.status === "in_legal_review")?.count || 0);
  const signerCount = Number(contractCounts.find((c) => c.status === "approved_pending_signature")?.count || 0);

  const result = reviewers.map((r) => {
    const isLegal = r.roles?.includes("legal_reviewer");
    const isSigner = r.roles?.includes("designated_signer");
    return {
      userId: r.id,
      userName: r.name,
      role: isLegal ? "legal_reviewer" : "designated_signer",
      assignedCount: isLegal ? legalCount : signerCount,
    };
  });

  res.json(result);
});

export default router;
