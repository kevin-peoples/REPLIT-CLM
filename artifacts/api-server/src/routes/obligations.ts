import { Router, type IRouter } from "express";
import { eq, lte, gte, and } from "drizzle-orm";
import { db, obligationsTable, contractsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(s, 10);
}

// GET /contracts/:id/obligations
router.get("/contracts/:id/obligations", requireAuth, async (req, res): Promise<void> => {
  const contractId = parseId(req.params.id);

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
    .where(eq(obligationsTable.contractId, contractId))
    .orderBy(obligationsTable.dueDate);

  res.json(obligations);
});

// POST /contracts/:id/obligations
router.post("/contracts/:id/obligations", requireAuth, async (req, res): Promise<void> => {
  const contractId = parseId(req.params.id);
  const { obligationType, description, dueDate, status } = req.body;

  if (!obligationType || !description || !dueDate) {
    res.status(400).json({ error: "obligationType, description, and dueDate are required" });
    return;
  }

  const [obligation] = await db
    .insert(obligationsTable)
    .values({
      contractId,
      obligationType,
      description,
      dueDate,
      status: status || "pending",
    })
    .returning();

  const [result] = await db
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
    .where(eq(obligationsTable.id, obligation.id));

  res.status(201).json(result);
});

// POST /obligations/:id/complete
router.post("/obligations/:id/complete", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);

  const [updated] = await db
    .update(obligationsTable)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(obligationsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Obligation not found" });
    return;
  }

  const [result] = await db
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
    .where(eq(obligationsTable.id, id));

  res.json(result);
});

export default router;
