import Anthropic from "@anthropic-ai/sdk";
import { db, contractsTable, screeningCriteriaTable, screeningResultsTable, obligationsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function runAiScreening(contractId: number, userId: number): Promise<void> {
  logger.info({ contractId }, "Starting AI screening");

  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, contractId));
  if (!contract) {
    logger.error({ contractId }, "Contract not found for AI screening");
    return;
  }

  const criteria = await db.select().from(screeningCriteriaTable).where(eq(screeningCriteriaTable.isEnabled, true));

  if (criteria.length === 0) {
    logger.warn({ contractId }, "No enabled screening criteria found");
    await advanceAfterScreening(contractId, "low", [], null);
    return;
  }

  const contractSummary = `
Contract Name: ${contract.contractName}
Counterparty: ${contract.counterpartyName}
Counterparty Address: ${contract.counterpartyAddress || "Not provided"}
Direction: ${contract.direction}
Effective Date: ${contract.effectiveDate || "Not provided"}
Expiration Date: ${contract.expirationDate || "Not provided"}
Value: ${contract.contractValue || "Not provided"}
Department: ${contract.department || "Not provided"}
Description: ${contract.description || "Not provided"}
Additional Form Data: ${JSON.stringify(contract.formData || {})}
  `.trim();

  const criteriaList = criteria
    .map((c, i) => `${i + 1}. ${c.name}: ${c.description}`)
    .join("\n");

  const prompt = `You are a contract review AI. Analyze the following contract metadata and evaluate it against the given criteria.

CONTRACT INFORMATION:
${contractSummary}

EVALUATION CRITERIA:
${criteriaList}

For each criterion, determine if it passes or fails based on the contract information provided. Return a JSON response with this exact structure:
{
  "results": [
    {
      "criterionId": <number>,
      "criterionName": "<string>",
      "passed": <boolean>,
      "explanation": "<one sentence explanation>"
    }
  ],
  "summary": "<brief overall assessment>"
}

Note: If information is missing to evaluate a criterion, mark it as failed and explain what's missing. Be practical and reasonable in your assessment.`;

  let rawResponse: any = null;
  let criteriaResults: any[] = [];

  try {
    const message = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      rawResponse = JSON.parse(jsonMatch[0]);
      criteriaResults = (rawResponse.results || []).map((r: any, i: number) => ({
        criterionId: criteria[i]?.id || r.criterionId,
        criterionName: r.criterionName || criteria[i]?.name || "",
        passed: r.passed,
        explanation: r.explanation,
      }));
    }
  } catch (err) {
    logger.error({ err, contractId }, "AI screening API call failed");
    // On API failure, create a placeholder result
    criteriaResults = criteria.map((c) => ({
      criterionId: c.id,
      criterionName: c.name,
      passed: true,
      explanation: "Screening temporarily unavailable - manual review required",
    }));
  }

  const failedCount = criteriaResults.filter((r) => !r.passed).length;
  let riskScore: "low" | "medium" | "high" = "low";
  if (failedCount >= 4) riskScore = "high";
  else if (failedCount >= 2) riskScore = "medium";

  await advanceAfterScreening(contractId, riskScore, criteriaResults, rawResponse);
}

async function advanceAfterScreening(
  contractId: number,
  riskScore: "low" | "medium" | "high",
  criteriaResults: any[],
  rawResponse: any,
): Promise<void> {
  // Save screening result
  await db.insert(screeningResultsTable).values({
    contractId,
    riskScore,
    criteriaResults,
    rawResponse,
  });

  // Update contract
  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, contractId));
  if (!contract) return;

  const prevStatus = contract.status;

  if (riskScore === "high") {
    // Return to submitter
    await db.update(contractsTable).set({
      status: "returned_for_edits",
      aiRiskScore: riskScore,
      stageEnteredAt: new Date(),
    }).where(eq(contractsTable.id, contractId));
  } else {
    // Advance to legal review (medium or low)
    await db.update(contractsTable).set({
      status: "in_legal_review",
      aiRiskScore: riskScore,
      stageEnteredAt: new Date(),
    }).where(eq(contractsTable.id, contractId));
  }

  // Auto-create renewal and cancellation notice obligations (skip if already exist)
  await createContractObligations(contractId, contract);

  logger.info({ contractId, riskScore }, "AI screening complete");
}

async function createContractObligations(contractId: number, contract: any): Promise<void> {
  // Look up submitter email for reminders
  const [submitter] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, contract.submittedById));
  const reminderEmail = submitter?.email ?? null;

  // Check existing obligations for this contract so we don't duplicate
  const existing = await db.select({ obligationType: obligationsTable.obligationType }).from(obligationsTable).where(eq(obligationsTable.contractId, contractId));
  const existingTypes = new Set(existing.map((o) => o.obligationType));

  const toInsert: any[] = [];

  // 1. Contract Renewal obligation — due on the expiration date
  if (contract.expirationDate && !existingTypes.has("contract_renewal")) {
    toInsert.push({
      contractId,
      obligationType: "contract_renewal",
      description: `Contract expires on ${contract.expirationDate}. Review and decide whether to renew or let expire.`,
      dueDate: contract.expirationDate,
      status: "pending",
      reminderDays: 30,
      reminderEmail,
    });
  }

  // 2. Cancellation Notice obligation — due noticePeriodDays before expiration
  if (contract.expirationDate && contract.noticePeriodDays && contract.noticePeriodDays > 0 && !existingTypes.has("cancellation_notice")) {
    const expiry = new Date(contract.expirationDate);
    const noticeDate = new Date(expiry);
    noticeDate.setDate(noticeDate.getDate() - contract.noticePeriodDays);
    const noticeDateStr = noticeDate.toISOString().split("T")[0];

    toInsert.push({
      contractId,
      obligationType: "cancellation_notice",
      description: `Cancellation notice must be sent by ${noticeDateStr} (${contract.noticePeriodDays} days before expiration on ${contract.expirationDate}).`,
      dueDate: noticeDateStr,
      status: "pending",
      reminderDays: 30,
      reminderEmail,
    });
  }

  if (toInsert.length > 0) {
    await db.insert(obligationsTable).values(toInsert);
    logger.info({ contractId, count: toInsert.length }, "Auto-created contract obligations");
  }
}
