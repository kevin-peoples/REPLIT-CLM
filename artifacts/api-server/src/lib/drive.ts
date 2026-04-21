import { google } from "googleapis";
import { Readable } from "stream";
import { logger } from "./logger.js";

const SHARED_DRIVE_ID = process.env.GOOGLE_SHARED_DRIVE_ID;
const SERVICE_ACCOUNT_KEY =
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.Google_Service_account_Key;

let driveClient: ReturnType<typeof google.drive> | null = null;

function getDriveClient() {
  if (driveClient) return driveClient;
  if (!SERVICE_ACCOUNT_KEY) {
    throw new Error("Google service account key is not configured");
  }
  let credentials: any;
  try {
    credentials = JSON.parse(SERVICE_ACCOUNT_KEY);
  } catch (err) {
    throw new Error("Google service account key is not valid JSON");
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

export function isDriveConfigured(): boolean {
  return !!SERVICE_ACCOUNT_KEY;
}

export interface DriveUploadResult {
  id: string;
  name: string;
  webViewLink: string;
}

export async function uploadToDrive(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<DriveUploadResult> {
  const drive = getDriveClient();
  const stream = Readable.from(buffer);
  const requestBody: any = { name: fileName };
  const useSharedDrive = !!SHARED_DRIVE_ID;
  if (useSharedDrive) {
    requestBody.parents = [SHARED_DRIVE_ID];
  }
  try {
    const res = await drive.files.create({
      requestBody,
      media: { mimeType, body: stream },
      fields: "id, name, webViewLink",
      supportsAllDrives: useSharedDrive,
    });
    const id = res.data.id!;
    return {
      id,
      name: res.data.name || fileName,
      webViewLink: res.data.webViewLink || `https://drive.google.com/file/d/${id}`,
    };
  } catch (err: any) {
    logger.error({ err: err?.message, fileName }, "Drive upload failed");
    throw new Error(`Drive upload failed: ${err?.message || "unknown error"}`);
  }
}
