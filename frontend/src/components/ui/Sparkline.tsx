import { useMemo } from 'react'

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  stroke?: string
  fill?: string
  threshold?: number // draws a hairline at this value if provided
  glow?: boolean
  showDots?: boolean
  className?: string
}

export function Sparkline({
  data,
  width = 160,
  height = 36,
  stroke = 'var(--color-phosphor)',
  fill,
  threshold,
  glow = true,
  showDots = false,
  className,
}: SparklineProps) {
  const { path, area, dots, thresholdY } = useMemo(() => {
    if (data.length < 2) return { path: '', area: '', dots: [], thresholdY: null }
    const min = Math.min(...data, threshold ?? Infinity)
    const max = Math.max(...data, threshold ?? -Infinity)
    const range = max - min || 1
    const stepX = width / (data.length - 1)
    const toY = (v: number) => height - ((v - min) / range) * (height - 6) - 3

    const pts = data.map((v, i) => [i * stepX, toY(v)] as const)
    const path = pts.map(([x, y], i) => (i === 0 ? `M${x.toFixed(2)},${y.toFixed(2)}` : `L${x.toFixed(2)},${y.toFixed(2)}`)).join(' ')
    const area = `${path} L${(data.length - 1) * stepX},${height} L0,${height} Z`
    const dots = pts.map(([x, y]) => ({ x, y }))
    const thresholdY = threshold != null ? toY(threshold) : null
    return { path, area, dots, thresholdY }
  }, [data, width, height, threshold])

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ display: 'block' }}
    >
      {glow && (
        <defs>
          <filter id="sparkglow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}
      {fill && <path d={area} fill={fill} opacity={0.3} />}
      {thresholdY != null && (
        <line
          x1={0}
          x2={width}
          y1={thresholdY}
          y2={thresholdY}
          stroke="var(--color-bone-ghost)"
          strokeDasharray="2 3"
          strokeWidth={1}
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={glow ? 'url(#sparkglow)' : undefined}
      />
      {showDots && dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={1.2} fill={stroke} />
      ))}
      {/* Last-point emphasized */}
      {dots.length > 0 && (
        <circle
          cx={dots[dots.length - 1].x}
          cy={dots[dots.length - 1].y}
          r={2}
          fill={stroke}
          stroke="var(--color-ink)"
          strokeWidth={1}
        />
      )}
    </svg>
  )
}
