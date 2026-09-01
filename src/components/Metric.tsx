interface MetricProps {
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'accent';
  hint?: string;
}

export function Metric({ label, value, tone = 'default', hint }: MetricProps) {
  return (
    <div className={`metric metric--${tone}`}>
      <span className="metric__label">{label}</span>
      <strong className="metric__value">{value}</strong>
      {hint && <span className="metric__hint">{hint}</span>}
    </div>
  );
}
