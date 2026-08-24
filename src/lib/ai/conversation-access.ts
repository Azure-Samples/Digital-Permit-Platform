import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createConversationAccessKey() {
  return randomBytes(32).toString("base64url");
}

export function hashConversationAccessKey(accessKey: string) {
  return createHash("sha256").update(accessKey).digest("hex");
}

export function canAccessConversation(input: {
  conversationUserId: string | null;
  conversationPersona: string;
  requestedPersona: string;
  sessionUserId: string | null;
  accessKeyHash: string | null;
  suppliedAccessKey: string | null;
}) {
  if (input.conversationPersona !== input.requestedPersona) return false;
  if (input.conversationUserId) {
    return input.sessionUserId === input.conversationUserId;
  }
  if (!input.accessKeyHash || !input.suppliedAccessKey) return false;
  const expected = Buffer.from(input.accessKeyHash, "hex");
  const actual = Buffer.from(
    hashConversationAccessKey(input.suppliedAccessKey),
    "hex",
  );
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}