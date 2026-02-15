import { Node, Edge, Position } from 'reactflow'
import dagre from 'dagre'

/** ---- Types that match kg.json ---- */
export type Evidence = {
  source_type: string
  source_id: string
  path: string
  snippet_hash: string
  quote: string
}

export type KGNode = {
  id: string
  type: string
  name: string
  evidence: Evidence[]
  attrs?: { k: string; v: string }[]
}

export type KGEdge = {
  source: string
  type: string
  target: string
  evidence: Evidence[]
  attrs?: { k: string; v: string }[]
}

export type KG = {
  nodes: KGNode[]
  edges: KGEdge[]
}

/** ---- Styling helpers ---- */
export function colorForType(t: string) {
  const key = (t || '').toLowerCase()
  const m: Record<string, string> = {
    project: '#D4A843',
    module: '#06b6d4',
    process: '#10b981',
    runbook: '#22c55e',
    runbookstep: '#86efac',
    decisionrule: '#a855f7',
    decision: '#a855f7',
    risk: '#f97316',
    mitigation: '#16a34a',
    person: '#64748b',
    document: '#94a3b8',
    operationalartifact: '#f59e0b',
    component: '#06b6d4',
    threshold: '#f97316',
    role: '#64748b',
  }
  return m[key] ?? '#9ca3af'
}

/** ---- Dagre layout ---- */
export const nodeWidth = 240
export const nodeHeight = 90

export function layoutDagre(nodes: Node[], edges: Edge[], direction: 'LR' | 'TB' = 'LR') {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, ranksep: 70, nodesep: 40 })

  nodes.forEach((n) => {
    g.setNode(n.id, { width: nodeWidth, height: nodeHeight })
  })

  edges.forEach((e) => {
    g.setEdge(e.source, e.target)
  })

  dagre.layout(g)

  const laidOut = nodes.map((n) => {
    const p = g.node(n.id)
    return {
      ...n,
      position: { x: p.x - nodeWidth / 2, y: p.y - nodeHeight / 2 },
      targetPosition: direction === 'LR' ? Position.Left : Position.Top,
      sourcePosition: direction === 'LR' ? Position.Right : Position.Bottom,
    }
  })

  return { nodes: laidOut, edges }
}
