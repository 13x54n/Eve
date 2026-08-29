type SparklineProps = {
  values: Array<number | null>;
  className?: string;
};

export function Sparkline({ values, className }: SparklineProps) {
  const points = values.filter((value): value is number => value != null);
  if (points.length < 2) {
    return <div className={`h-8 ${className ?? ""}`} />;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(max - min, 1);
  const width = 120;
  const height = 32;
  const step = width / (values.length - 1);

  const path = values
    .map((value, index) => {
      const x = index * step;
      const y =
        value == null ? null : height - ((value - min) / range) * (height - 4) - 2;
      return y == null ? null : `${index === 0 || values[index - 1] == null ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`h-8 w-full ${className ?? ""}`} aria-hidden>
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
