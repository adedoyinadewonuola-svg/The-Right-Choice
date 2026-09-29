"use client";

export default function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div
      className="controls section"
      style={{ justifyContent: "center" }}
    >
      <button
        className="btn light"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        ← Previous
      </button>
      <span className="label">
        Page {page} of {totalPages}
      </span>
      <button
        className="btn light"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next →
      </button>
    </div>
  );
}
