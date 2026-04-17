import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, obligationsTable, contractsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(s, 10);
}

const baseSelect = {
  id: obligationsTable.id,
  contractId: obligationsTable.contractId,
  contractName: contractsTable.contractName,
  obligationType: obligationsTable.obligationType,
  description: obligationsTable.description,
  dueDate: obligationsTable.dueDate,
  status: obligationsTable.status,
  reminderDays: obligationsTable.reminderDays,
  reminderSentAt: obligationsTable.reminderSentAt,
  reminderEmail: obligationsTable.reminderEmail,
  completedAt: obligationsTable.completedAt,
  createdAt: obligationsTable.createdAt,
};

// GET /contracts/:id/obligations
router.get("/contracts/:id/obligations", requireAuth, async (req, res): Promise<void> => {
  const contractId = parseId(req.params.id);

  const obligations = await db
    .select(baseSelect)
    .from(obligationsTable)
    .leftJoin(contractsTable, eq(obligationsTable.contractId, contractsTable.id))
    .where(eq(obligationsTable.contractId, contractId))
    .orderBy(obligationsTable.dueDate);

  res.json(obligations);
});

// POST /contracts/:id/obligations
router.post("/contracts/:id/obligations", requireAuth, async (req, res): Promise<void> => {
  const contractId = parseId(req.params.id);
  const { obligationType, description, dueDate, status, reminderDays, reminderEmail } = req.body;

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
      reminderDays: reminderDays ?? 30,
      reminderEmail: reminderEmail || null,
    })
    .returning();

  const [result] = await db
    .select(baseSelect)
    .from(obligationsTable)
    .leftJoin(contractsTable, eq(obligationsTable.contractId, contractsTable.id))
    .where(eq(obligationsTable.id, obligation.id));

  res.status(201).json(result);
});

// PATCH /obligations/:id — update reminderDays / reminderEmail
router.patch("/obligations/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const { reminderDays, reminderEmail } = req.body;

  const updateData: Record<string, any> = {};
  if (reminderDays !== undefined) {
    const days = parseInt(reminderDays, 10);
    if (isNaN(days) || days < 1) {
      res.status(400).json({ error: "reminderDays must be a positive integer" });
      return;
    }
    updateData.reminderDays = days;
    // Reset sent-at so the reminder can fire again with the new schedule
    updateData.reminderSentAt = null;
  }
  if (reminderEmail !== undefined) updateData.reminderEmail = reminderEmail || null;

  const [updated] = await db
    .update(obligationsTable)
    .set(updateData)
    .where(eq(obligationsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Obligation not found" });
    return;
  }

  const [result] = await db
    .select(baseSelect)
    .from(obligationsTable)
    .leftJoin(contractsTable, eq(obligationsTable.contractId, contractsTable.id))
    .where(eq(obligationsTable.id, id));

  res.json(result);
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
    .select(baseSelect)
    .from(obligationsTable)
    .leftJoin(contractsTable, eq(obligationsTable.contractId, contractsTable.id))
    .where(eq(obligationsTable.id, id));

  res.json(result);
});

export default router;
