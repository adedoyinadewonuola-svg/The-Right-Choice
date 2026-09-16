export default function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="metric">{value}</div>
      {hint && <small className="label">{hint}</small>}
    </div>
  );
}
