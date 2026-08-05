export function isTrustedMutationOrigin(
  request: Request,
  configuredOrigin = process.env.NEXTAUTH_URL,
): boolean {
  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(configuredOrigin || request.url).origin;
  } catch {
    return false;
  }

  const suppliedOrigin = request.headers.get("origin");
  const suppliedReferer = request.headers.get("referer");
  const candidate = suppliedOrigin || suppliedReferer;
  if (!candidate) return false;

  try {
    return new URL(candidate).origin === expectedOrigin;
  } catch {
    return false;
  }
}