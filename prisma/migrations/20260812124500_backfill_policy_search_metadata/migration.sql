UPDATE "licensing_policies" AS policy
SET "searchableCharacters" = section_totals.characters
FROM (
  SELECT "policyId", COALESCE(SUM(char_length("content")), 0)::INTEGER AS characters
  FROM "policy_sections"
  GROUP BY "policyId"
) AS section_totals
WHERE policy."id" = section_totals."policyId"
  AND policy."searchableCharacters" = 0;