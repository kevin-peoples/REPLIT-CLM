import { db, obligationsTable, contractsTable, usersTable } from "@workspace/db";
import { eq, and, isNull, lte } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { sendEmail } from "./mailer";
import { logger } from "./logger";

export async function runReminderJob(): Promise<void> {
  try {
    logger.info("Running obligation reminder job");

    const now = new Date();

    const dueObligations = await db
      .select({
        id: obligationsTable.id,
        contractId: obligationsTable.contractId,
        contractName: contractsTable.contractName,
        obligationType: obligationsTable.obligationType,
        description: obligationsTable.description,
        dueDate: obligationsTable.dueDate,
        reminderDays: obligationsTable.reminderDays,
        reminderEmail: obligationsTable.reminderEmail,
        submittedById: contractsTable.submittedById,
      })
      .from(obligationsTable)
      .innerJoin(contractsTable, eq(obligationsTable.contractId, contractsTable.id))
      .where(
        and(
          eq(obligationsTable.status, "pending"),
          isNull(obligationsTable.reminderSentAt),
          sql`(${obligationsTable.dueDate}::date - ${obligationsTable.reminderDays} * INTERVAL '1 day') <= NOW()`
        )
      );

    logger.info({ count: dueObligations.length }, "Obligations ready for reminder");

    for (const ob of dueObligations) {
      let toEmail = ob.reminderEmail;

      if (!toEmail && ob.submittedById) {
        const [user] = await db
          .select({ email: usersTable.email })
          .from(usersTable)
          .where(eq(usersTable.id, ob.submittedById));
        toEmail = user?.email ?? null;
      }

      if (!toEmail) {
        logger.warn({ obligationId: ob.id }, "No email for obligation reminder — skipping");
        continue;
      }

      const dueDate = new Date(ob.dueDate);
      const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const typeLabel = ob.obligationType === "contract_renewal" ? "Contract Renewal" : ob.obligationType === "cancellation_notice" ? "Cancellation Notice" : ob.obligationType.replace(/_/g, " ");

      const subject = `[CLM] Reminder: ${typeLabel} for "${ob.contractName}" in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`;
      const html = `
        <div style="font-family: sans-serif; max-width: 580px; margin: 0 auto;">
          <div style="background: #1e293b; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 18px;">CLM Pro — Obligation Reminder</h2>
          </div>
          <div style="border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <p style="margin: 0 0 16px; color: #374151; font-size: 15px;">
              This is a reminder that the following obligation is due in <strong>${daysUntil} day${daysUntil !== 1 ? "s" : ""}</strong>:
            </p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
              <tr>
                <td style="padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: 600; width: 36%; color: #64748b; font-size: 13px;">Contract</td>
                <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 14px;">${ob.contractName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: 600; color: #64748b; font-size: 13px;">Obligation Type</td>
                <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 14px; text-transform: capitalize;">${typeLabel}</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: 600; color: #64748b; font-size: 13px;">Due Date</td>
                <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; color: #dc2626;">${ob.dueDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-weight: 600; color: #64748b; font-size: 13px;">Details</td>
                <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 14px;">${ob.description}</td>
              </tr>
            </table>
            <p style="margin: 0; color: #6b7280; font-size: 13px;">
              Please log in to CLM Pro to take action on this obligation.
            </p>
          </div>
        </div>
      `;

      const sent = await sendEmail(toEmail, subject, html);

      if (sent) {
        await db
          .update(obligationsTable)
          .set({ reminderSentAt: new Date() })
          .where(eq(obligationsTable.id, ob.id));
        logger.info({ obligationId: ob.id, toEmail }, "Reminder sent and marked");
      }
    }
  } catch (err) {
    logger.error({ err }, "Obligation reminder job failed");
  }
}

export function startReminderScheduler(): void {
  const ONE_HOUR = 60 * 60 * 1000;

  // Run once shortly after startup (5 minutes delay so the server is fully warmed up)
  setTimeout(() => {
    runReminderJob();
  }, 5 * 60 * 1000);

  // Then every hour
  setInterval(() => {
    runReminderJob();
  }, ONE_HOUR);

  logger.info("Obligation reminder scheduler started (runs every hour)");
}
