// ─────────────────────────────────────────────────────────────
// BullMQ queue setup for background jobs
// Queues are lazily initialized to avoid Redis connections
// during Next.js build time.
// ─────────────────────────────────────────────────────────────
import { Queue } from "bullmq";
import { getRedisConnectionOptions } from "./connection";

// ─── Lazy queue singletons ────────────────────────────────────
let _notificationQueue: Queue | null = null;
const _slaTimerQueue: Queue | null = null;
let _documentScanQueue: Queue | null = null;
let _reminderQueue: Queue | null = null;

export function getNotificationQueue() {
  if (!_notificationQueue) {
    _notificationQueue = new Queue("notifications", {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 1000, age: 7 * 24 * 3600 },
        removeOnFail: { count: 5000, age: 30 * 24 * 3600 },
      },
    });
  }
  return _notificationQueue;
}

export function getDocumentScanQueue() {
  if (!_documentScanQueue) {
    _documentScanQueue = new Queue("document-scan", {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "fixed", delay: 30000 },
      },
    });
  }
  return _documentScanQueue;
}

export function getReminderQueue() {
  if (!_reminderQueue) {
    _reminderQueue = new Queue("reminders", {
      connection: getRedisConnectionOptions(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 60000 },
      },
    });
  }
  return _reminderQueue;
}

// ─── Job type definitions ─────────────────────────────────────
export interface NotificationJobData {
  type: "email" | "in_app";
  userId: string;
  templateKey: string;
  subject: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface SlaTimerJobData {
  applicationId: string;
  stageKey: string;
  slaDeadline: string; // ISO date
  reminderDate?: string;
}

export interface DocumentScanJobData {
  documentId: string;
  storagePath: string;
}

export interface ReminderJobData {
  type: "missing_documents" | "renewal" | "sla_warning" | "consultation_deadline";
  applicationId: string;
  userId: string;
  message: string;
}

// ─── Enqueue helpers ──────────────────────────────────────────
export async function enqueueNotification(data: NotificationJobData) {
  return getNotificationQueue().add("send", data);
}

export async function enqueueDocumentScan(data: DocumentScanJobData) {
  return getDocumentScanQueue().add("scan", data);
}

export async function enqueueReminder(data: ReminderJobData, delayMs?: number) {
  return getReminderQueue().add("remind", data, delayMs ? { delay: delayMs } : {});
}
