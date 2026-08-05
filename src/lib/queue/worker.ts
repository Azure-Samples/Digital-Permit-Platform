// ─────────────────────────────────────────────────────────────
// BullMQ worker – processes background jobs
// Run with: npx tsx src/lib/queue/worker.ts
// ─────────────────────────────────────────────────────────────
import { Worker, type Job } from "bullmq";
import type {
  NotificationJobData,
  SlaTimerJobData,
  DocumentScanJobData,
  ReminderJobData,
} from "./index";
import { getRedisConnectionOptions } from "./connection";

const connection = getRedisConnectionOptions();

// ─── Notification worker ──────────────────────────────────────
const notificationWorker = new Worker(
  "notifications",
  async (job: Job<NotificationJobData>) => {
    const { type, userId, subject, body } = job.data;

    if (type === "email") {
      // In production: integrate with SMTP / Azure Communication Services
      console.log(`[EMAIL] To: ${userId} | Subject: ${subject}`);
      console.log(`  Body: ${body.substring(0, 200)}...`);
    } else {
      // In-app notification – write to DB
      // Import would cause circular dep in a real setup;
      // in production, use a shared DB module
      console.log(`[IN-APP] To: ${userId} | ${subject}`);
    }

    return { sent: true, type, userId };
  },
  { connection, concurrency: 5 }
);

// ─── SLA timer worker ─────────────────────────────────────────
const slaWorker = new Worker(
  "sla-timers",
  async (job: Job<SlaTimerJobData>) => {
    const { applicationId, stageKey, slaDeadline } = job.data;
    const deadline = new Date(slaDeadline);
    const now = new Date();

    if (now >= deadline) {
      console.log(
        `[SLA BREACH] Application ${applicationId} stage ${stageKey} – deadline was ${slaDeadline}`
      );
      // In production: escalate, send notifications, flag in dashboard
    }

    return { checked: true, breached: now >= deadline };
  },
  { connection, concurrency: 3 }
);

// ─── Document scan worker ─────────────────────────────────────
const scanWorker = new Worker(
  "document-scan",
  async (job: Job<DocumentScanJobData>) => {
    const { documentId, storagePath } = job.data;

    // In production: integrate with Azure Defender for Storage
    // or a commercial AV scanning API (e.g., ClamAV via container)
    console.log(`[SCAN] Document ${documentId} at ${storagePath}`);

    // Simulate scan pass
    const isSafe = true;

    return { documentId, scanned: true, safe: isSafe };
  },
  { connection, concurrency: 2 }
);

// ─── Reminder worker ──────────────────────────────────────────
const reminderWorker = new Worker(
  "reminders",
  async (job: Job<ReminderJobData>) => {
    const { type, applicationId, userId, message } = job.data;
    console.log(
      `[REMINDER] Type: ${type} | App: ${applicationId} | User: ${userId}`
    );
    console.log(`  Message: ${message}`);

    return { reminded: true, type };
  },
  { connection, concurrency: 3 }
);

// ─── Graceful shutdown ────────────────────────────────────────
async function shutdown() {
  console.log("Shutting down workers...");
  await Promise.all([
    notificationWorker.close(),
    slaWorker.close(),
    scanWorker.close(),
    reminderWorker.close(),
  ]);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("🚀 Workers started: notifications, sla-timers, document-scan, reminders");
