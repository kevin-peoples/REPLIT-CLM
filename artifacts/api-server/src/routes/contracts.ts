import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, desc, and, or, ilike, sql, count, sum, notInArray } from "drizzle-orm";
import {
  db,
  contractsTable,
  contractTypesTable,
  usersTable,
  workflowDefinitionsTable,
  workflowStagesTable,
  auditTrailTable,
  screeningResultsTable,
  obligationsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { runAiScreening } from "../lib/ai-screening";
import { sendSignatureEmail } from "../lib/email";
import { logger } from "../lib/logger";
import { uploadToDrive, isDriveConfigured } from "../lib/drive";

const router: IRouter = Router();

const ALLOWED_UPLOAD_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
const ALLOWED_UPLOAD_EXTS = /\.(pdf|doc|docx|txt)$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mimeOk = ALLOWED_UPLOAD_MIMES.has(file.mimetype);
    const extOk = ALLOWED_UPLOAD_EXTS.test(file.originalname);
    if (mimeOk && extOk) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Allowed: PDF, DOC, DOCX, TXT"));
    }
  },
});

function handleUploadMiddleware(field: string) {
  const mw = upload.single(field);
  return (req: any, res: any, next: any) => {
    mw(req, res, (err: any) => {
      if (!err) return next();
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "File exceeds 25MB limit" });
      }
      return res.status(400).json({ error: err.message || "Upload rejected" });
    });
  };
}

function parseId(raw: string | string[]): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(s, 10);
}

type WorkflowStageRow = typeof workflowStagesTable.$inferSelect;

function canActOnStage(user: any, contractStatus: string, stage: WorkflowStageRow | null): boolean {
  const roles: string[] = user?.roles ?? [];
  if (roles.includes("admin")) return true;
  if (stage?.assignedUserId) return stage.assignedUserId === user.id;
  if (stage?.assignedRole) return roles.includes(stage.assignedRole);
  if (contractStatus === "in_legal_review") return roles.includes("legal_reviewer");
  if (contractStatus === "approved_pending_signature") return roles.includes("designated_signer");
  return false;
}

async function logAudit(
  contractId: number,
  userId: number | null,
  action: string,
  comment?: string,
  fromStatus?: string,
  toStatus?: string,
) {
  await db.insert(auditTrailTable).values({
    contractId,
    userId,
    action,
    comment,
    fromStatus,
    toStatus,
  });
}

function determineWorkflow(
  direction: string,
  department: string | null,
  contractValue: number | null,
  workflows: any[],
  tiers: any[],
): any {
  let tierId: number | null = null;
  if (contractValue !== null) {
    for (const tier of tiers) {
      const min = parseFloat(tier.minValue);
      const max = tier.maxValue !== null ? parseFloat(tier.maxValue) : Infinity;
      if (contractValue >= min && contractValue < max) {
        tierId = tier.id;
        break;
      }
    }
  }

  // Find matching workflow: prefer specific over generic
  let matched = workflows.find(
    (w) =>
      w.direction === direction &&
      w.department === department &&
      ((tierId === null) || (w.minTierId <= tierId && w.maxTierId >= tierId)),
  );

  if (!matched) {
    matched = workflows.find((w) => w.direction === direction && !w.department);
  }

  if (!matched) {
    matched = workflows.find((w) => !w.direction && !w.department);
  }

  if (!matched) {
    matched = workflows.find((w) => w.isDefault);
  }

  return matched || null;
}

// GET /contracts
router.get("/contracts", requireAuth, async (req, res): Promise<void> => {
  const user = req.user as any;
  const { status, type, direction, page = "1", limit = "20", search } = req.query as any;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const conditions: any[] = [];

  // Only show user's contracts unless admin/legal_reviewer/designated_signer
  const isPrivileged = user.roles?.some((r: string) =>
    ["admin", "legal_reviewer", "designated_signer"].includes(r),
  );
  if (!isPrivileged) {
    conditions.push(eq(contractsTable.submittedById, user.id));
  }

  if (status === "active") {
    conditions.push(notInArray(contractsTable.status, ["expired", "fully_executed"]));
  } else if (status) {
    conditions.push(eq(contractsTable.status, status));
  }
  if (direction) conditions.push(eq(contractsTable.direction, direction));
  if (type) conditions.push(eq(contractsTable.contractTypeId, parseInt(type)));
  if (search) {
    conditions.push(
      or(
        ilike(contractsTable.contractName, `%${search}%`),
        ilike(contractsTable.counterpartyName, `%${search}%`),
      ),
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [contracts, totalResult] = await Promise.all([
    db
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
      .where(whereClause)
      .orderBy(desc(contractsTable.updatedAt))
      .limit(parseInt(limit))
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(contractsTable)
      .where(whereClause),
  ]);

  res.json({
    contracts,
    total: Number(totalResult[0]?.count || 0),
    page: parseInt(page),
    limit: parseInt(limit),
  });
});

// POST /contracts
router.post("/contracts", requireAuth, async (req, res): Promise<void> => {
  const user = req.user as any;
  const {
    contractName,
    contractTypeId,
    direction,
    counterpartyName,
    counterpartyAddress,
    contractValue,
    effectiveDate,
    expirationDate,
    autoRenewal,
    noticePeriodDays,
    description,
    department,
    driveFileId,
    formData,
  } = req.body;

  if (!contractName || !contractTypeId || !direction || !counterpartyName) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [contract] = await db
    .insert(contractsTable)
    .values({
      contractName,
      contractTypeId,
      direction,
      status: "draft",
      counterpartyName,
      counterpartyAddress,
      contractValue: contractValue ? String(contractValue) : null,
      effectiveDate,
      expirationDate,
      autoRenewal: autoRenewal ?? false,
      noticePeriodDays,
      description,
      department: department || user.department,
      driveFileId,
      formData,
      submittedById: user.id,
    })
    .returning();

  await logAudit(contract.id, user.id, "created", "Contract created");

  const [contractWithType] = await db
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
    .where(eq(contractsTable.id, contract.id));

  res.status(201).json(contractWithType);
});

// GET /contracts/:id
router.get("/contracts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);

  const [contract] = await db
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
      currentWorkflowId: contractsTable.currentWorkflowId,
      formData: contractsTable.formData,
      aiRiskScore: contractsTable.aiRiskScore,
      createdAt: contractsTable.createdAt,
      updatedAt: contractsTable.updatedAt,
    })
    .from(contractsTable)
    .leftJoin(contractTypesTable, eq(contractsTable.contractTypeId, contractTypesTable.id))
    .leftJoin(usersTable, eq(contractsTable.submittedById, usersTable.id))
    .where(eq(contractsTable.id, id));

  if (!contract) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }

  const [auditTrail, screeningResult, obligations] = await Promise.all([
    db
      .select({
        id: auditTrailTable.id,
        contractId: auditTrailTable.contractId,
        userId: auditTrailTable.userId,
        userName: usersTable.name,
        action: auditTrailTable.action,
        comment: auditTrailTable.comment,
        fromStatus: auditTrailTable.fromStatus,
        toStatus: auditTrailTable.toStatus,
        createdAt: auditTrailTable.createdAt,
      })
      .from(auditTrailTable)
      .leftJoin(usersTable, eq(auditTrailTable.userId, usersTable.id))
      .where(eq(auditTrailTable.contractId, id))
      .orderBy(desc(auditTrailTable.createdAt)),
    db
      .select()
      .from(screeningResultsTable)
      .where(eq(screeningResultsTable.contractId, id))
      .orderBy(desc(screeningResultsTable.createdAt))
      .limit(1),
    db
      .select()
      .from(obligationsTable)
      .where(eq(obligationsTable.contractId, id)),
  ]);

  let currentStage = null;
  let workflowStages: any[] = [];

  if (contract.currentWorkflowId) {
    workflowStages = await db
      .select()
      .from(workflowStagesTable)
      .where(eq(workflowStagesTable.workflowId, contract.currentWorkflowId))
      .orderBy(workflowStagesTable.stageOrder);

    if (contract.currentStageId) {
      currentStage = workflowStages.find((s) => s.id === contract.currentStageId) || null;
    }
  }

  res.json({
    ...contract,
    auditTrail,
    screeningResult: screeningResult[0] || null,
    obligations,
    currentStage,
    workflowStages,
  });
});

// PATCH /contracts/:id
router.patch("/contracts/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const user = req.user as any;

  const [existing] = await db
    .select()
    .from(contractsTable)
    .where(eq(contractsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }

  if (existing.submittedById !== user.id && !user.roles?.includes("admin")) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const {
    contractName,
    counterpartyName,
    counterpartyAddress,
    contractValue,
    effectiveDate,
    expirationDate,
    autoRenewal,
    noticePeriodDays,
    description,
    department,
    driveFileId,
    formData,
  } = req.body;

  const updateData: any = {};
  if (contractName !== undefined) updateData.contractName = contractName;
  if (counterpartyName !== undefined) updateData.counterpartyName = counterpartyName;
  if (counterpartyAddress !== undefined) updateData.counterpartyAddress = counterpartyAddress;
  if (contractValue !== undefined) updateData.contractValue = contractValue ? String(contractValue) : null;
  if (effectiveDate !== undefined) updateData.effectiveDate = effectiveDate;
  if (expirationDate !== undefined) updateData.expirationDate = expirationDate;
  if (autoRenewal !== undefined) updateData.autoRenewal = autoRenewal;
  if (noticePeriodDays !== undefined) updateData.noticePeriodDays = noticePeriodDays;
  if (description !== undefined) updateData.description = description;
  if (department !== undefined) updateData.department = department;
  if (driveFileId !== undefined) updateData.driveFileId = driveFileId;
  if (formData !== undefined) updateData.formData = formData;

  const [updated] = await db
    .update(contractsTable)
    .set(updateData)
    .where(eq(contractsTable.id, id))
    .returning();

  await logAudit(id, user.id, "updated");

  const [result] = await db
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
    .where(eq(contractsTable.id, id));

  res.json(result);
});

// POST /contracts/:id/submit
router.post("/contracts/:id/submit", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const user = req.user as any;

  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, id));

  if (!contract) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }

  if (contract.submittedById !== user.id && !user.roles?.includes("admin")) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const prevStatus = contract.status;

  const [updated] = await db
    .update(contractsTable)
    .set({ status: "ai_screening", submittedAt: new Date(), stageEnteredAt: new Date() })
    .where(eq(contractsTable.id, id))
    .returning();

  await logAudit(id, user.id, "submitted", undefined, prevStatus, "ai_screening");

  // Trigger AI screening in the background
  runAiScreening(id, user.id).catch((err) =>
    logger.error({ err, contractId: id }, "AI screening failed"),
  );

  res.json(updated);
});

// POST /contracts/:id/resubmit
router.post("/contracts/:id/resubmit", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const user = req.user as any;

  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, id));

  if (!contract) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }

  const prevStatus = contract.status;

  // Return to the stage it was sent back from, skip re-screening
  const targetStatus = contract.currentStageId ? "in_legal_review" : "ai_screening";

  const [updated] = await db
    .update(contractsTable)
    .set({ status: targetStatus, stageEnteredAt: new Date() })
    .where(eq(contractsTable.id, id))
    .returning();

  await logAudit(id, user.id, "resubmitted", undefined, prevStatus, targetStatus);

  res.json(updated);
});

// POST /contracts/:id/rescreen
router.post("/contracts/:id/rescreen", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const user = req.user as any;

  runAiScreening(id, user.id).catch((err) =>
    logger.error({ err, contractId: id }, "AI re-screening failed"),
  );

  res.json({ message: "AI re-screening triggered" });
});

// POST /contracts/:id/approve
router.post("/contracts/:id/approve", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const user = req.user as any;
  const { comment } = req.body || {};

  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, id));

  if (!contract) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }

  const APPROVABLE_STATUSES = new Set(["in_legal_review", "approved_pending_signature"]);
  if (!APPROVABLE_STATUSES.has(contract.status)) {
    res.status(409).json({ error: `Cannot approve contract in status '${contract.status}'` });
    return;
  }

  const prevStatus = contract.status;

  // Load current stage (if any) and authorize before any state change
  let currentStage: WorkflowStageRow | null = null;
  let stages: WorkflowStageRow[] = [];
  if (contract.currentWorkflowId && contract.currentStageId) {
    stages = await db
      .select()
      .from(workflowStagesTable)
      .where(eq(workflowStagesTable.workflowId, contract.currentWorkflowId))
      .orderBy(workflowStagesTable.stageOrder);
    currentStage = stages.find((s) => s.id === contract.currentStageId) ?? null;
  }

  if (!canActOnStage(user, contract.status, currentStage)) {
    res.status(403).json({ error: "You are not authorized to approve this contract" });
    return;
  }

  // Advance to next stage in workflow
  let nextStatus: string;
  let nextStageId: number | null = null;

  if (currentStage) {
    const currentIndex = stages.findIndex((s) => s.id === currentStage!.id);
    const nextStage = stages[currentIndex + 1];

    if (nextStage) {
      nextStageId = nextStage.id;
      if (nextStage.isSigned) {
        nextStatus = "approved_pending_signature";
        // Send signature email
        sendSignatureEmail(contract, nextStage).catch((err) =>
          logger.error({ err, contractId: id }, "Failed to send signature email"),
        );
      } else {
        nextStatus = "in_legal_review";
      }
    } else {
      // No more stages - workflow complete, ready for executed file upload
      nextStatus = "awaiting_executed_upload";
    }
  } else {
    // No workflow context: legal_review -> awaiting signature, signature -> upload
    nextStatus = contract.status === "approved_pending_signature"
      ? "awaiting_executed_upload"
      : "approved_pending_signature";
  }

  const [updated] = await db
    .update(contractsTable)
    .set({
      status: nextStatus,
      currentStageId: nextStageId,
      stageEnteredAt: new Date(),
    })
    .where(eq(contractsTable.id, id))
    .returning();

  await logAudit(id, user.id, "approved", comment, prevStatus, nextStatus);

  res.json(updated);
});

// POST /contracts/:id/send-back
router.post("/contracts/:id/send-back", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const user = req.user as any;
  const { comment } = req.body;

  if (!comment) {
    res.status(400).json({ error: "Comment is required when sending back" });
    return;
  }

  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, id));

  if (!contract) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }

  const SEND_BACK_STATUSES = new Set(["in_legal_review", "approved_pending_signature", "ai_screening"]);
  if (!SEND_BACK_STATUSES.has(contract.status)) {
    res.status(409).json({ error: `Cannot send back contract in status '${contract.status}'` });
    return;
  }

  let currentStage: WorkflowStageRow | null = null;
  if (contract.currentWorkflowId && contract.currentStageId) {
    const [s] = await db
      .select()
      .from(workflowStagesTable)
      .where(eq(workflowStagesTable.id, contract.currentStageId));
    currentStage = s ?? null;
    if (currentStage && !currentStage.canSendBack && !user?.roles?.includes("admin")) {
      res.status(403).json({ error: "This stage does not permit sending back" });
      return;
    }
  }

  if (!canActOnStage(user, contract.status, currentStage)) {
    res.status(403).json({ error: "You are not authorized to send back this contract" });
    return;
  }

  const prevStatus = contract.status;

  const [updated] = await db
    .update(contractsTable)
    .set({ status: "returned_for_edits", stageEnteredAt: new Date() })
    .where(eq(contractsTable.id, id))
    .returning();

  await logAudit(id, user.id, "sent_back", comment, prevStatus, "returned_for_edits");

  res.json(updated);
});

// POST /contracts/:id/comment
router.post("/contracts/:id/comment", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const user = req.user as any;
  const { comment } = req.body;

  if (!comment) {
    res.status(400).json({ error: "Comment is required" });
    return;
  }

  const [audit] = await db
    .insert(auditTrailTable)
    .values({ contractId: id, userId: user.id, action: "commented", comment })
    .returning();

  const [result] = await db
    .select({
      id: auditTrailTable.id,
      contractId: auditTrailTable.contractId,
      userId: auditTrailTable.userId,
      userName: usersTable.name,
      action: auditTrailTable.action,
      comment: auditTrailTable.comment,
      fromStatus: auditTrailTable.fromStatus,
      toStatus: auditTrailTable.toStatus,
      createdAt: auditTrailTable.createdAt,
    })
    .from(auditTrailTable)
    .leftJoin(usersTable, eq(auditTrailTable.userId, usersTable.id))
    .where(eq(auditTrailTable.id, audit.id));

  res.status(201).json(result);
});

// POST /uploads/drive  - upload a file to Google Drive, return file metadata
router.post("/uploads/drive", requireAuth, handleUploadMiddleware("file"), async (req, res): Promise<void> => {
  if (!isDriveConfigured()) {
    res.status(503).json({ error: "Google Drive is not configured on the server" });
    return;
  }
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) {
    res.status(400).json({ error: "No file provided" });
    return;
  }
  try {
    const result = await uploadToDrive(file.buffer, file.originalname, file.mimetype || "application/octet-stream");
    res.json({
      driveFileId: result.id,
      fileName: result.name,
      webViewLink: result.webViewLink,
    });
  } catch (err: any) {
    logger.error({ err: err?.message }, "Drive upload endpoint failed");
    res.status(500).json({ error: "Upload to Google Drive failed" });
  }
});

// POST /contracts/:id/upload-document
router.post("/contracts/:id/upload-document", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const user = req.user as any;
  const { driveFileId, fileName } = req.body;

  if (!driveFileId) {
    res.status(400).json({ error: "driveFileId is required" });
    return;
  }

  const [updated] = await db
    .update(contractsTable)
    .set({ driveFileId, driveFileName: fileName })
    .where(eq(contractsTable.id, id))
    .returning();

  await logAudit(id, user.id, "document_uploaded", `File: ${fileName}`);

  res.json(updated);
});

// POST /contracts/:id/upload-executed
router.post("/contracts/:id/upload-executed", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const user = req.user as any;
  const { driveFileId, fileName } = req.body;

  if (!driveFileId) {
    res.status(400).json({ error: "driveFileId is required" });
    return;
  }

  const roles: string[] = user?.roles ?? [];
  if (!roles.includes("designated_signer") && !roles.includes("admin")) {
    res.status(403).json({ error: "Only designated signers or admins may upload executed contracts" });
    return;
  }

  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, id));
  if (!contract) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }
  if (contract.status !== "awaiting_executed_upload") {
    res.status(409).json({ error: `Cannot upload executed contract from status '${contract.status}'` });
    return;
  }

  const prevStatus = contract.status;
  const [updated] = await db
    .update(contractsTable)
    .set({
      executedDriveFileId: driveFileId,
      status: "fully_executed",
      fullyExecutedAt: new Date(),
    })
    .where(eq(contractsTable.id, id))
    .returning();

  await logAudit(id, user.id, "executed_uploaded", `Executed file: ${fileName}`, prevStatus, "fully_executed");

  res.json(updated);
});

// GET /contracts/:id/audit
router.get("/contracts/:id/audit", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);

  const entries = await db
    .select({
      id: auditTrailTable.id,
      contractId: auditTrailTable.contractId,
      userId: auditTrailTable.userId,
      userName: usersTable.name,
      action: auditTrailTable.action,
      comment: auditTrailTable.comment,
      fromStatus: auditTrailTable.fromStatus,
      toStatus: auditTrailTable.toStatus,
      createdAt: auditTrailTable.createdAt,
    })
    .from(auditTrailTable)
    .leftJoin(usersTable, eq(auditTrailTable.userId, usersTable.id))
    .where(eq(auditTrailTable.contractId, id))
    .orderBy(desc(auditTrailTable.createdAt));

  res.json(entries);
});

// GET /contracts/:id/screening
router.get("/contracts/:id/screening", requireAuth, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);

  const [result] = await db
    .select()
    .from(screeningResultsTable)
    .where(eq(screeningResultsTable.contractId, id))
    .orderBy(desc(screeningResultsTable.createdAt))
    .limit(1);

  if (!result) {
    res.status(404).json({ error: "No screening result found" });
    return;
  }

  res.json(result);
});

// GET /contract-types
router.get("/contract-types", requireAuth, async (_req, res): Promise<void> => {
  const types = await db
    .select()
    .from(contractTypesTable)
    .where(eq(contractTypesTable.isActive, true))
    .orderBy(contractTypesTable.name);

  res.json(types);
});

export default router;
