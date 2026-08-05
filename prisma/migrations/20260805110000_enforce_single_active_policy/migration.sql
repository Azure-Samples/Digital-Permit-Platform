CREATE UNIQUE INDEX "licensing_policies_one_active_regime_key"
ON "licensing_policies"("regime")
WHERE "isActive" = true;