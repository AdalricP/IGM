import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import ForceGraph2D from 'react-force-graph-2d'
import { X, MapPin, Users, Activity } from 'lucide-react'
import { api } from '../lib/api'
import type { GraphNode, GraphResponse } from '../types'
import { Card } from '../components/ui/Card'
import { Chip } from '../components/ui/Chip'
import { fmtCount } from '../lib/format'

interface FGNode extends GraphNode {
  x?: number
  y?: number
}

const COLOR = {
  bangalore: '#7fffc9',
  bangalore_inferred: '#4cb893',
  other: '#8b8dee',
  unknown: '#6a6862',
  seed: '#f2a341',
}

function nodeColor(n: GraphNode): string {
  if (n.is_seed) return COLOR.seed
  if (n.city === 'bangalore') return n.city_source === 'inferred' ? COLOR.bangalore_inferred : COLOR.bangalore
  if (!n.city) return COLOR.unknown
  return COLOR.other
}

export function Graph() {
  const [data, setData] = useState<GraphResponse | null>(null)
  const [selected, setSelected] = useState<FGNode | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 560 })

  useEffect(() => {
    api.graph().then(setData)
  }, [])

  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        setSize({ w: e.contentRect.width, h: e.contentRect.height })
      }
    })
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  // Statistics for the legend
  const stats = useMemo(() => {
    if (!data) return null
    const blr = data.nodes.filter(n => n.city === 'bangalore').length
    const blrConfirmed = data.nodes.filter(n => n.city === 'bangalore' && n.city_source === 'bio').length
    const blrInferred = data.nodes.filter(n => n.city === 'bangalore' && n.city_source === 'inferred').length
    const other = data.nodes.filter(n => n.city && n.city !== 'bangalore').length
    const unknown = data.nodes.filter(n => !n.city).length
    return { total: data.nodes.length, blr, blrConfirmed, blrInferred, other, unknown, links: data.links.length }
  }, [data])

  return (
    <div className="grid grid-cols-12 gap-4">
      <Card label="Graph state" className="col-span-12 lg:col-span-4 xl:col-span-3 self-start">
        {!stats ? (
          <div className="text-bone-faint font-mono text-[11px]">loading…</div>
        ) : (
          <div className="space-y-3">
            <StatLine label="total nodes" value={stats.total} />
            <StatLine label="links" value={stats.links} />
            <hr className="border-hairline" />
            <LegendLine color={COLOR.seed} label="seed (my followers)" count={data!.nodes.filter(n => n.is_seed).length} />
            <LegendLine color={COLOR.bangalore} label="bangalore · confirmed" count={stats.blrConfirmed} />
            <LegendLine color={COLOR.bangalore_inferred} label="bangalore · inferred" count={stats.blrInferred} dashed />
            <LegendLine color={COLOR.other} label="other city" count={stats.other} />
            <LegendLine color={COLOR.unknown} label="unknown geo" count={stats.unknown} />
            <hr className="border-hairline" />
            <div className="text-[11px] font-mono text-bone-faint leading-relaxed">
              edges = appearance in someone's suggestion panel.
              node size scales with follower count.
              click a node for detail.
            </div>
          </div>
        )}
      </Card>

      <div className="col-span-12 lg:col-span-8 xl:col-span-9 relative">
        <Card label="2-hop network" bodyClassName="p-0" className="overflow-hidden">
          <div ref={wrapRef} className="relative h-[640px] bg-ink-elevated/50">
            {data && (
              <ForceGraph2D
                graphData={data as any}
                width={size.w}
                height={size.h}
                backgroundColor="#0a0a0b"
                cooldownTicks={120}
                nodeRelSize={3}
                linkColor={() => 'rgba(165, 163, 154, 0.18)'}
                linkWidth={(l: any) => Math.max(0.4, (l.weight ?? 1) * 0.2)}
                linkDirectionalParticles={(l: any) => (l.kind === 'follows' ? 2 : 0)}
                linkDirectionalParticleColor={() => '#f2a341'}
                linkDirectionalParticleWidth={1.6}
                nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, scale: number) => {
                  const radius = Math.max(2, Math.sqrt(node.followers ?? 100) / 6)
                  const color = nodeColor(node)
                  ctx.beginPath()
                  ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)
                  ctx.fillStyle = color
                  ctx.shadowColor = color
                  ctx.shadowBlur = node.is_seed ? 14 : 8
                  ctx.fill()
                  ctx.shadowBlur = 0
                  if (node.city_source === 'inferred') {
                    ctx.strokeStyle = '#0a0a0b'
                    ctx.lineWidth = 1
                    ctx.stroke()
                  }
                  if (scale > 2.5) {
                    ctx.font = '10px JetBrains Mono'
                    ctx.fillStyle = '#a6a39a'
                    ctx.textAlign = 'center'
                    ctx.fillText(`@${node.id}`, node.x, node.y + radius + 9)
                  }
                }}
                nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                  const radius = Math.max(6, Math.sqrt(node.followers ?? 100) / 4)
                  ctx.fillStyle = color
                  ctx.beginPath()
                  ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)
                  ctx.fill()
                }}
                onNodeClick={(n: any) => setSelected(n)}
                onBackgroundClick={() => setSelected(null)}
              />
            )}
            <div className="absolute bottom-3 right-3 flex items-center gap-2 px-2 py-1 bg-ink/80 border border-hairline">
              <Activity size={10} className="text-phosphor" />
              <span className="font-mono text-[10px] text-bone-faint">drag to pan · scroll to zoom</span>
            </div>
          </div>
        </Card>

        <AnimatePresence>
          {selected && (
            <motion.aside
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.18 }}
              className="absolute top-3 right-3 w-72 card bg-ink-elevated"
            >
              <header className="flex items-center justify-between px-3 py-2 border-b border-hairline">
                <span className="section-label">Selected</span>
                <button onClick={() => setSelected(null)} className="text-bone-faint hover:text-bone">
                  <X size={12} />
                </button>
              </header>
              <div className="p-4 space-y-3">
                <div>
                  <a
                    href={`https://instagram.com/${selected.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[14px] text-bone hover:text-phosphor"
                  >
                    @{selected.id}
                  </a>
                  <div className="text-[12px] text-bone-muted mt-0.5">{selected.full_name}</div>
                </div>
                <div className="flex items-center gap-2 text-[12px] font-mono">
                  <Users size={11} className="text-bone-faint" />
                  <span className="text-bone tabular-nums">{fmtCount(selected.followers)}</span>
                  <span className="text-bone-faint">followers</span>
                </div>
                {selected.city && (
                  <div className="flex items-center gap-2">
                    <MapPin size={11} className="text-bone-faint" />
                    <Chip tone={selected.city === 'bangalore' ? 'phosphor' : 'bone'} variant={selected.city_source === 'inferred' ? 'outline' : 'filled'}>
                      {selected.city}
                    </Chip>
                    {selected.city_source && (
                      <span className="font-mono text-[10px] text-bone-faint uppercase">{selected.city_source}</span>
                    )}
                  </div>
                )}
                {selected.is_seed && (
                  <Chip tone="amber" variant="outline">seed · my follower</Chip>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function StatLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="section-label">{label}</span>
      <span className="font-mono text-[14px] text-bone tabular-nums">{value}</span>
    </div>
  )
}

function LegendLine({ color, label, count, dashed }: { color: string; label: string; count: number; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="size-2.5"
        style={{
          background: dashed ? 'transparent' : color,
          border: dashed ? `1px dashed ${color}` : 'none',
          boxShadow: !dashed ? `0 0 6px ${color}80` : undefined,
        }}
      />
      <span className="flex-1 text-[11.5px] text-bone-muted">{label}</span>
      <span className="font-mono text-[11.5px] text-bone tabular-nums">{count}</span>
    </div>
  )
}
