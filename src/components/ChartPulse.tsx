import { useEffect, useState } from 'react'

const cycleDuration = '5s'

type ChartPulseProps = {
  path: string
  enabled: boolean
}

/** Decorative motion follows the existing data path; it never changes chart values. */
export function ChartPulse({ path, enabled }: ChartPulseProps) {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  if (!enabled || !path || reduced) return null

  const points = Array.from(path.matchAll(/[ML]\s*([\d.-]+)\s+([\d.-]+)/g), match => ({ x: Number(match[1]), y: Number(match[2]) }))
  if (points.length < 2) return null

  let distance = 0
  const distances = points.map((point, index) => {
    if (index) distance += Math.hypot(point.x - points[index - 1].x, point.y - points[index - 1].y)
    return distance
  })
  if (!distance) return null

  return (
    <g className="chart-traveler" aria-hidden="true" key={path}>
      <path className="chart-strand-glow" d={path} pathLength="1000" strokeDasharray="160 840">
        <animate attributeName="stroke-dashoffset" values="0;-1000;-1000" keyTimes="0;.22;1" dur={cycleDuration} repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.015;.19;.22;1" dur={cycleDuration} repeatCount="indefinite" />
      </path>
      {points.map((point, index) => {
        // Match fixed dot highlights to the continuous wave's distance along the path.
        const peak = Math.max(.015, distances[index] / distance * .22)
        const start = Math.max(0, peak - .025)
        const end = peak + .06
        const times = start === 0 ? `0;${peak};${end};1` : `0;${start};${peak};${end};1`
        const values = start === 0 ? '0;1;0;0' : '0;0;1;0;0'
        return <circle key={index} className="chart-pulse-halo" cx={point.x} cy={point.y} r="4">
          <animate attributeName="opacity" values={values} keyTimes={times} dur={cycleDuration} repeatCount="indefinite" />
        </circle>
      })}
    </g>
  )
}
