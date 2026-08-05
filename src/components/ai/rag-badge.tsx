import type { RagRating } from "@/lib/ai/types";

const RAG_CONFIG: Record<
  RagRating,
  { label: string; className: string }
> = {
  green: { label: "Consistent", className: "govuk-tag govuk-tag--green" },
  amber: { label: "Attention", className: "govuk-tag govuk-tag--orange" },
  red: { label: "Conflict", className: "govuk-tag govuk-tag--red" },
  na: { label: "Not applicable", className: "govuk-tag govuk-tag--grey" },
};

export function RagBadge({
  rating,
  label,
}: {
  rating: RagRating | string | null | undefined;
  label?: string;
}) {
  const key = (rating ?? "amber") as RagRating;
  const config = RAG_CONFIG[key] ?? RAG_CONFIG.amber;
  return <span className={config.className}>{label ?? config.label}</span>;
}

/** A small coloured dot for inline RAG status. */
export function RagDot({ rating }: { rating: RagRating | string | null | undefined }) {
  const color =
    rating === "green"
      ? "bg-govuk-green"
      : rating === "red"
        ? "bg-govuk-red"
        : rating === "na"
          ? "bg-govuk-mid-grey"
          : "bg-[#b35900]";
  return (
    <span
      className={`inline-block h-3 w-3 rounded-full ${color}`}
      aria-hidden="true"
    />
  );
}
