// ─────────────────────────────────────────────────────────────
// Payment abstraction layer
// ─────────────────────────────────────────────────────────────
import type { PaymentMode, PaymentStatus } from "@prisma/client";
import { prisma } from "./db";
import { writeAuditLog } from "./audit";

export interface CreatePaymentInput {
  applicationId: string;
  amount: number;
  paymentMode: PaymentMode;
  externalReference?: string;
  paymentUrl?: string;
  receiptDocumentId?: string;
  userId: string;
}

/**
 * Create a payment record. The payment mode determines how the payment
 * is captured:
 *
 * 1. EXTERNAL_REDIRECT  – applicant redirected to external payment URL,
 *                          returns with a reference
 * 2. MANUAL_REFERENCE   – applicant enters a payment reference manually
 * 3. RECEIPT_UPLOAD     – applicant uploads a payment receipt document
 * 4. API_INTEGRATION    – future: server-to-server payment API
 * 5. NO_FEE             – no payment required
 */
export async function createPayment(input: CreatePaymentInput) {
  const status: PaymentStatus =
    input.paymentMode === "NO_FEE"
      ? "COMPLETED"
      : input.externalReference || input.receiptDocumentId
      ? "COMPLETED"
      : "PENDING";

  const payment = await prisma.payment.create({
    data: {
      applicationId: input.applicationId,
      amount: input.amount,
      paymentMode: input.paymentMode,
      status,
      externalReference: input.externalReference,
      paymentUrl: input.paymentUrl,
      receiptDocumentId: input.receiptDocumentId,
      paidAt: status === "COMPLETED" ? new Date() : null,
    },
  });

  await writeAuditLog({
    userId: input.userId,
    applicationId: input.applicationId,
    action: "payment.created",
    entityType: "Payment",
    entityId: payment.id,
    newValues: {
      amount: input.amount,
      mode: input.paymentMode,
      status,
    },
  });

  return payment;
}

/**
 * Mark a pending payment as completed (e.g. after external redirect callback).
 */
export async function completePayment(
  paymentId: string,
  reference: string,
  userId: string
) {
  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: "COMPLETED",
      externalReference: reference,
      paidAt: new Date(),
    },
  });

  await writeAuditLog({
    userId,
    applicationId: payment.applicationId,
    action: "payment.completed",
    entityType: "Payment",
    entityId: payment.id,
    newValues: { reference, status: "COMPLETED" },
  });

  return payment;
}

/**
 * Resolve the fee for an application based on the module's fee schedule.
 */
export function resolveFee(
  feeSchedule: Record<string, unknown> | null,
  applicationType: string
): number {
  if (!feeSchedule) return 0;
  const fee = (feeSchedule as Record<string, unknown>)[applicationType];
  if (typeof fee === "number") return fee;
  if (typeof fee === "object" && fee !== null && "baseAmount" in fee) {
    return (fee as { baseAmount: number }).baseAmount;
  }
  return 0;
}

/**
 * Get payment instructions based on module config.
 */
export function getPaymentInstructions(
  paymentMode: PaymentMode,
  _paymentUrl?: string
): string {
  switch (paymentMode) {
    case "EXTERNAL_REDIRECT":
      return `You will be redirected to the council's payment page to complete your payment.`;
    case "MANUAL_REFERENCE":
      return "Please enter your payment reference number from your receipt.";
    case "RECEIPT_UPLOAD":
      return "Please upload a copy of your payment receipt.";
    case "API_INTEGRATION":
      return "Payment will be processed automatically.";
    case "NO_FEE":
      return "No fee is required for this application.";
    default:
      return "Please follow the payment instructions provided.";
  }
}
