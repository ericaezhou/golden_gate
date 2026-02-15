'use client'

import React, { useEffect, useMemo, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  NodeProps,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { colorForType, layoutDagre, nodeWidth, nodeHeight, KG, KGNode } from '@/components/graph/shared'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/** Custom node - dark themed variant */
function KGNodeView({ data }: NodeProps) {
  const raw = (data as Record<string, unknown>)?.__raw as KGNode | undefined
  const color = raw ? colorForType(raw.type) : '#9ca3af'
  const bg = `${color}22`

  return (
    <div
      style={{
        width: nodeWidth,
        height: nodeHeight,
        borderRadius: 14,
        background: bg,
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: `14px solid ${color}`,
        padding: 10,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <div style={{ pointerEvents: 'none', fontWeight: 800, color, marginBottom: 4, textTransform: 'lowercase', fontSize: 11 }}>
        {raw?.type ?? ''}
      </div>
      <div style={{ whiteSpace: 'pre-wrap', pointerEvents: 'none', fontSize: 12, lineHeight: 1.15, color: '#e8e5f5' }}>
        {(data as Record<string, unknown>)?.label as string}
      </div>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}

export function OnboardingGraph({ sessionId }: { sessionId: string }) {
  const [kg, setKg] = useState<KG | null>(null)
  const [selected, setSelected] = useState<KGNode | null>(null)
  const [showDocuments, setShowDocuments] = useState(true)
  const [showPeople, setShowPeople] = useState(true)
  const [direction, setDirection] = useState<'LR' | 'TB'>('LR')
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [rf, setRf] = useState<ReturnType<typeof Object> | null>(null)
  const nodeTypes = useMemo(() => ({ kgNode: KGNodeView }), [])

  // Try API first, fall back to /kg.json
  useEffect(() => {
    async function loadGraph() {
      try {
        const res = await fetch(`${API_BASE}/api/onboarding/${sessionId}/knowledge-graph`)
        if (res.ok) {
          const data = await res.json()
          setKg(data)
          return
        }
      } catch {}
      // Fallback to static file
      try {
        const res = await fetch('/kg.json')
        const data = await res.json()
        setKg(data)
      } catch {
        setKg({ nodes: [], edges: [] })
      }
    }
    loadGraph()
  }, [sessionId])

  const filteredKG = useMemo(() => {
    if (!kg) return null
    const hidden = new Set<string>()
    if (!showDocuments) hidden.add('Document')
    if (!showPeople) hidden.add('Person')
    const allowed = new Set(kg.nodes.filter(n => !hidden.has(n.type)).map(n => n.id))
    return {
      nodes: kg.nodes.filter(n => allowed.has(n.id)),
      edges: kg.edges.filter(e => allowed.has(e.source) && allowed.has(e.target)),
    } as KG
  }, [kg, showDocuments, showPeople])

  useEffect(() => {
    if (!filteredKG) return
    const rfNodes: Node[] = filteredKG.nodes.map(n => ({
      id: n.id,
      type: 'kgNode',
      data: { label: n.name, __raw: n },
      position: { x: 0, y: 0 },
    }))
    const rfEdges: Edge[] = filteredKG.edges.map((e, i) => ({
      id: `e_${i}_${e.source}_${e.target}_${e.type}`,
      source: e.source,
      target: e.target,
      label: e.type,
      animated: false,
      style: { opacity: 0.5, stroke: '#6b6890' },
      labelStyle: { fill: '#9b97b8', fontSize: 10 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6b6890' },
    }))
    const laidOut = layoutDagre(rfNodes, rfEdges, direction)
    setNodes(laidOut.nodes)
    setEdges(laidOut.edges)
    if (selected && !filteredKG.nodes.find(n => n.id === selected.id)) {
      setSelected(null)
    }
  }, [filteredKG, direction]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-full relative" style={{ background: '#060318' }}>
      {/* Controls overlay */}
      <div className="absolute z-10 top-3 left-3 flex gap-2 px-3 py-2 bg-gg-card/90 border border-gg-border rounded-xl backdrop-blur-sm text-xs text-gg-secondary">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={showDocuments} onChange={e => setShowDocuments(e.target.checked)} className="accent-gg-accent" />
          Documents
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={showPeople} onChange={e => setShowPeople(e.target.checked)} className="accent-gg-accent" />
          People
        </label>
        <select
          value={direction}
          onChange={e => setDirection(e.target.value as 'LR' | 'TB')}
          className="bg-gg-surface border border-gg-border rounded px-1.5 py-0.5 text-gg-secondary"
        >
          <option value="LR">Left &rarr; Right</option>
          <option value="TB">Top &darr; Bottom</option>
        </select>
      </div>

      {/* Selected node detail */}
      {selected && (
        <div className="absolute z-10 top-3 right-3 w-72 bg-gg-card/95 border border-gg-border rounded-xl backdrop-blur-sm p-4 overflow-auto max-h-[80%]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: colorForType(selected.type) }}>
              {selected.type}
            </span>
            <button onClick={() => setSelected(null)} className="text-gg-muted hover:text-gg-text text-xs">&times;</button>
          </div>
          <h3 className="font-semibold text-gg-text mb-2">{selected.name}</h3>
          {selected.evidence && selected.evidence.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold text-gg-muted uppercase">Evidence</p>
              {selected.evidence.map((ev, i) => (
                <div key={i} className="bg-gg-surface border border-gg-border rounded-lg p-2 text-xs">
                  <p className="text-gg-muted">{ev.source_type} — {ev.source_id}</p>
                  {ev.quote && <p className="text-gg-secondary mt-1 whitespace-pre-wrap">{ev.quote}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ReactFlow
        onInit={setRf}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        onNodeClick={(_, n) => {
          const raw = (n.data as Record<string, unknown>)?.__raw as KGNode | undefined
          if (raw) setSelected(raw)
          const neighborIds = new Set<string>()
          neighborIds.add(n.id)
          edges.forEach(e => {
            if (e.source === n.id) neighborIds.add(e.target)
            if (e.target === n.id) neighborIds.add(e.source)
          })
          const focusNodes = nodes.filter(nd => neighborIds.has(nd.id))
          if (rf && 'fitView' in rf) {
            (rf as { fitView: (opts: Record<string, unknown>) => void }).fitView({
              nodes: focusNodes,
              padding: 0.35,
              duration: 500,
            })
          }
        }}
        nodeTypes={nodeTypes}
        style={{ background: '#060318' }}
      >
        <MiniMap
          nodeColor={n => {
            const raw = (n.data as Record<string, unknown>)?.__raw as KGNode | undefined
            return raw ? colorForType(raw.type) : '#2a2560'
          }}
          style={{ background: '#0f0b2e', border: '1px solid #2a2560' }}
        />
        <Controls style={{ button: { background: '#1a1548', color: '#9b97b8', border: '1px solid #2a2560' } } as React.CSSProperties} />
        <Background color="#2a2560" gap={20} />
      </ReactFlow>
    </div>
  )
}
