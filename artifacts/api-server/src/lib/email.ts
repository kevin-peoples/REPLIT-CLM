import nodemailer from "nodemailer";
import { logger } from "./logger";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendSignatureEmail(contract: any, stage: any): Promise<void> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    logger.warn("SMTP not configured, skipping signature email");
    return;
  }

  const appUrl = process.env.REPLIT_DOMAINS
    ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
    : "http://localhost";

  const contractUrl = `${appUrl}/contracts/${contract.id}`;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.SMTP_USER, // In production, look up signer's email
      subject: `Contract Ready for Signature: ${contract.contractName}`,
      html: `
        <h2>Contract Ready for Signature</h2>
        <p>The following contract requires your signature:</p>
        <ul>
          <li><strong>Contract:</strong> ${contract.contractName}</li>
          <li><strong>Counterparty:</strong> ${contract.counterpartyName}</li>
          <li><strong>Value:</strong> ${contract.contractValue ? `$${parseFloat(contract.contractValue).toLocaleString()}` : "N/A"}</li>
        </ul>
        <p><a href="${contractUrl}">View Contract in CLM System</a></p>
        <p>After signing, please upload the executed document through the system.</p>
      `,
    });
    logger.info({ contractId: contract.id }, "Signature email sent");
  } catch (err) {
    logger.error({ err, contractId: contract.id }, "Failed to send signature email");
  }
}

export async function sendObligationReminder(
  recipientEmail: string,
  recipientName: string,
  obligations: any[],
): Promise<void> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    return;
  }

  const appUrl = process.env.REPLIT_DOMAINS
    ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
    : "http://localhost";

  const obligationList = obligations
    .map(
      (o) =>
        `<li><strong>${o.contractName}</strong> - ${o.obligationType}: ${o.description} (Due: ${o.dueDate})</li>`,
    )
    .join("\n");

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipientEmail,
      subject: `Contract Obligations Due - ${obligations.length} item(s) require attention`,
      html: `
        <h2>Contract Obligation Reminder</h2>
        <p>Hi ${recipientName},</p>
        <p>The following contract obligations are coming due or are overdue:</p>
        <ul>${obligationList}</ul>
        <p><a href="${appUrl}/dashboard">View Dashboard</a></p>
      `,
    });
  } catch (err) {
    logger.error({ err }, "Failed to send obligation reminder");
  }
}
