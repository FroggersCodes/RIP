interface Props {
  points: number[];
  width?: number;
  height?: number;
  stroke?: string;
}

export function ValueSparkline({ points, width = 120, height = 34, stroke }: Props) {
  if (points.length < 2) {
    return <svg width={width} height={height} aria-hidden />;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - ((p - min) / range) * (height - 4) - 2).toFixed(1)}`)
    .join(' ');
  const up = points[points.length - 1]! >= points[0]!;
  const color = stroke ?? (up ? 'var(--green)' : 'var(--red)');
  return (
    <svg width={width} height={height} className="spark">
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
