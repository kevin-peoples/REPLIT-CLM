import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  usersTable,
  contractTypesTable,
  workflowDefinitionsTable,
  workflowStagesTable,
  screeningCriteriaTable,
  valueTiersTable,
  dashboardConfigTable,
} from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(s, 10);
}

// === USERS ===

router.get("/users", requireAdmin, async (_req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      googleId: usersTable.googleId,
      email: usersTable.email,
      name: usersTable.name,
      photoUrl: usersTable.photoUrl,
      department: usersTable.department,
      roles: usersTable.roles,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(usersTable.name);

  res.json(users);
});

router.patch("/users/:id/roles", requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const { roles } = req.body;

  if (!Array.isArray(roles)) {
    res.status(400).json({ error: "roles must be an array" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ roles })
    .where(eq(usersTable.id, id))
    .returning({
      id: usersTable.id,
      googleId: usersTable.googleId,
      email: usersTable.email,
      name: usersTable.name,
      photoUrl: usersTable.photoUrl,
      department: usersTable.department,
      roles: usersTable.roles,
      createdAt: usersTable.createdAt,
    });

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(updated);
});

// === CONTRACT TYPES ===

router.post("/admin/contract-types", requireAdmin, async (req, res): Promise<void> => {
  const { name, description, formSchema, obligationTypes, isActive } = req.body;

  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const [created] = await db
    .insert(contractTypesTable)
    .values({
      name,
      description,
      formSchema: formSchema || {},
      obligationTypes: obligationTypes || [],
      isActive: isActive !== false,
    })
    .returning();

  res.status(201).json(created);
});

router.patch("/admin/contract-types/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const { name, description, formSchema, obligationTypes, isActive, defaultWorkflowId } = req.body;

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (formSchema !== undefined) updateData.formSchema = formSchema;
  if (obligationTypes !== undefined) updateData.obligationTypes = obligationTypes;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (defaultWorkflowId !== undefined) updateData.defaultWorkflowId = defaultWorkflowId ?? null;

  const [updated] = await db
    .update(contractTypesTable)
    .set(updateData)
    .where(eq(contractTypesTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Contract type not found" });
    return;
  }

  res.json(updated);
});

router.delete("/admin/contract-types/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);

  await db.delete(contractTypesTable).where(eq(contractTypesTable.id, id));

  res.json({ message: "Contract type deleted" });
});

// === WORKFLOWS ===

router.get("/admin/workflows", requireAdmin, async (_req, res): Promise<void> => {
  const workflows = await db
    .select()
    .from(workflowDefinitionsTable)
    .orderBy(workflowDefinitionsTable.name);

  const result = await Promise.all(
    workflows.map(async (w) => {
      const stages = await db
        .select()
        .from(workflowStagesTable)
        .where(eq(workflowStagesTable.workflowId, w.id))
        .orderBy(workflowStagesTable.stageOrder);

      const stagesWithUsers = await Promise.all(
        stages.map(async (stage) => {
          let assignedUserName = null;
          if (stage.assignedUserId) {
            const [user] = await db
              .select({ name: usersTable.name })
              .from(usersTable)
              .where(eq(usersTable.id, stage.assignedUserId));
            assignedUserName = user?.name || null;
          }
          return { ...stage, assignedUserName };
        }),
      );

      return { ...w, stages: stagesWithUsers };
    }),
  );

  res.json(result);
});

router.post("/admin/workflows", requireAdmin, async (req, res): Promise<void> => {
  const { name, direction, department, minTierId, maxTierId, isDefault, stages } = req.body;

  if (!name || !stages) {
    res.status(400).json({ error: "name and stages are required" });
    return;
  }

  const [workflow] = await db
    .insert(workflowDefinitionsTable)
    .values({ name, direction, department, minTierId, maxTierId, isDefault: isDefault ?? false })
    .returning();

  const stagesData = stages.map((s: any) => ({
    workflowId: workflow.id,
    name: s.name,
    stageOrder: s.stageOrder,
    assignedRole: s.assignedRole || null,
    assignedUserId: s.assignedUserId || null,
    canSendBack: s.canSendBack !== false,
    isOptional: s.isOptional ?? false,
    isSigned: s.isSigned ?? false,
  }));

  const createdStages = await db.insert(workflowStagesTable).values(stagesData).returning();

  res.status(201).json({ ...workflow, stages: createdStages });
});

router.patch("/admin/workflows/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const { name, direction, department, minTierId, maxTierId, isDefault, stages } = req.body;

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (direction !== undefined) updateData.direction = direction;
  if (department !== undefined) updateData.department = department;
  if (minTierId !== undefined) updateData.minTierId = minTierId;
  if (maxTierId !== undefined) updateData.maxTierId = maxTierId;
  if (isDefault !== undefined) updateData.isDefault = isDefault;

  const [updated] = await db
    .update(workflowDefinitionsTable)
    .set(updateData)
    .where(eq(workflowDefinitionsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Workflow not found" });
    return;
  }

  if (stages) {
    await db.delete(workflowStagesTable).where(eq(workflowStagesTable.workflowId, id));

    const stagesData = stages.map((s: any) => ({
      workflowId: id,
      name: s.name,
      stageOrder: s.stageOrder,
      assignedRole: s.assignedRole || null,
      assignedUserId: s.assignedUserId || null,
      canSendBack: s.canSendBack !== false,
      isOptional: s.isOptional ?? false,
      isSigned: s.isSigned ?? false,
    }));

    await db.insert(workflowStagesTable).values(stagesData);
  }

  const updatedStages = await db
    .select()
    .from(workflowStagesTable)
    .where(eq(workflowStagesTable.workflowId, id))
    .orderBy(workflowStagesTable.stageOrder);

  res.json({ ...updated, stages: updatedStages });
});

router.delete("/admin/workflows/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);

  // Clear any contract types pointing at this workflow
  await db
    .update(contractTypesTable)
    .set({ defaultWorkflowId: null })
    .where(eq(contractTypesTable.defaultWorkflowId, id));

  // Delete stages first, then the workflow definition
  await db.delete(workflowStagesTable).where(eq(workflowStagesTable.workflowId, id));
  await db.delete(workflowDefinitionsTable).where(eq(workflowDefinitionsTable.id, id));

  res.json({ message: "Workflow deleted" });
});

// === SCREENING CRITERIA ===

router.get("/admin/screening-criteria", requireAdmin, async (_req, res): Promise<void> => {
  const criteria = await db.select().from(screeningCriteriaTable).orderBy(screeningCriteriaTable.name);
  res.json(criteria);
});

router.post("/admin/screening-criteria", requireAdmin, async (req, res): Promise<void> => {
  const { name, description, isEnabled } = req.body;

  if (!name || !description) {
    res.status(400).json({ error: "name and description are required" });
    return;
  }

  const [created] = await db
    .insert(screeningCriteriaTable)
    .values({ name, description, isEnabled: isEnabled !== false })
    .returning();

  res.status(201).json(created);
});

router.patch("/admin/screening-criteria/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const { name, description, isEnabled } = req.body;

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (isEnabled !== undefined) updateData.isEnabled = isEnabled;

  const [updated] = await db
    .update(screeningCriteriaTable)
    .set(updateData)
    .where(eq(screeningCriteriaTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Criterion not found" });
    return;
  }

  res.json(updated);
});

router.delete("/admin/screening-criteria/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  await db.delete(screeningCriteriaTable).where(eq(screeningCriteriaTable.id, id));
  res.json({ message: "Criterion deleted" });
});

// === VALUE TIERS ===

router.get("/admin/value-tiers", requireAdmin, async (_req, res): Promise<void> => {
  const tiers = await db.select().from(valueTiersTable).orderBy(valueTiersTable.displayOrder);
  res.json(tiers);
});

router.post("/admin/value-tiers", requireAdmin, async (req, res): Promise<void> => {
  const { name, minValue, maxValue, displayOrder } = req.body;

  if (!name || minValue === undefined) {
    res.status(400).json({ error: "name and minValue are required" });
    return;
  }

  const [created] = await db
    .insert(valueTiersTable)
    .values({
      name,
      minValue: String(minValue),
      maxValue: maxValue !== null && maxValue !== undefined ? String(maxValue) : null,
      displayOrder: displayOrder ?? 0,
    })
    .returning();

  res.status(201).json(created);
});

router.patch("/admin/value-tiers/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const { name, minValue, maxValue, displayOrder } = req.body;

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (minValue !== undefined) updateData.minValue = String(minValue);
  if (maxValue !== undefined) updateData.maxValue = maxValue !== null ? String(maxValue) : null;
  if (displayOrder !== undefined) updateData.displayOrder = displayOrder;

  const [updated] = await db
    .update(valueTiersTable)
    .set(updateData)
    .where(eq(valueTiersTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Value tier not found" });
    return;
  }

  res.json(updated);
});

router.delete("/admin/value-tiers/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  await db.delete(valueTiersTable).where(eq(valueTiersTable.id, id));
  res.json({ message: "Value tier deleted" });
});

// === DASHBOARD CONFIG ===

router.get("/admin/dashboard-config", requireAuth, async (_req, res): Promise<void> => {
  let [config] = await db.select().from(dashboardConfigTable).limit(1);

  if (!config) {
    [config] = await db
      .insert(dashboardConfigTable)
      .values({})
      .returning();
  }

  res.json(config);
});

router.patch("/admin/dashboard-config", requireAdmin, async (req, res): Promise<void> => {
  let [config] = await db.select().from(dashboardConfigTable).limit(1);

  if (!config) {
    [config] = await db.insert(dashboardConfigTable).values(req.body).returning();
  } else {
    [config] = await db
      .update(dashboardConfigTable)
      .set(req.body)
      .where(eq(dashboardConfigTable.id, config.id))
      .returning();
  }

  res.json(config);
});

export default router;
