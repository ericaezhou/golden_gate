"use client";
import React, { useEffect, useMemo, useState } from "react";
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
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ---------------- Typography ---------------- */

const TEXT_NODE = "#475569";      // 节点内部文字（slate-600）
const TEXT_NODE_SOFT = "#64748b"; // 节点副文本
const TEXT_PANEL = "#0f172a";     // Details 黑色
const TEXT_PANEL_SOFT = "#334155";

/* ---------------- Types ---------------- */

type Evidence = {
  source_type: "file" | "interview" | "ticket" | "email" | "other";
  source_id: string;
  path: string;
  snippet_hash: string;
  quote: string;
};

type KGNode = {
  id: string;
  type: string;
  name: string;
  evidence: Evidence[];
  center: boolean;
};

type KGEdge = {
  source: string;
  type: string;
  target: string;
  evidence: Evidence[];
};

type KG = {
  nodes: KGNode[];
  edges: KGEdge[];
};

/** API response: { session_id, kg: { nodes?, edges? } } */
function normalizeKg(apiKg: { nodes?: unknown[]; edges?: unknown[] } | null): KG {
  if (!apiKg || !Array.isArray(apiKg.nodes)) return { nodes: [], edges: [] };
  const nodes: KGNode[] = (apiKg.nodes as any[]).map((n) => ({
    id: n.id ?? String(n.id),
    type: n.type ?? "concept",
    name: n.name ?? n.label ?? n.id ?? "",
    evidence: Array.isArray(n.evidence) ? n.evidence : [],
    center: n.center !== false,
  }));
  const edges: KGEdge[] = Array.isArray(apiKg.edges)
    ? (apiKg.edges as any[]).map((e) => ({
        source: e.source ?? "",
        target: e.target ?? "",
        type: e.type ?? e.label ?? "references",
        evidence: Array.isArray(e.evidence) ? e.evidence : [],
      }))
    : [];
  return { nodes, edges };
}

/* ---------------- Color Palette ---------------- */

const PALETTE = [
  "#2563EB", "#0EA5E9", "#06B6D4", "#10B981", "#22C55E",
  "#84CC16", "#EAB308", "#F59E0B", "#F97316", "#EF4444",
  "#EC4899", "#D946EF", "#A855F7", "#6366F1", "#14B8A6",
  "#64748B", "#8B5CF6", "#FB7185", "#4ADE80", "#F43F5E",
];

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function colorForType(t: string) {
  const idx = hashString(t || "unknown") % PALETTE.length;
  return PALETTE[idx];
}

/* ---------------- Layout ---------------- */

const nodeWidth = 240;
const nodeHeight = 90;

function layoutDagre(nodes: Node[], edges: Edge[], direction: "LR" | "TB" = "LR") {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, ranksep: 70, nodesep: 40 });

  nodes.forEach((n) => g.setNode(n.id, { width: nodeWidth, height: nodeHeight }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return {
    nodes: nodes.map((n) => {
      const p = g.node(n.id);
      return {
        ...n,
        position: { x: p.x - nodeWidth / 2, y: p.y - nodeHeight / 2 },
        targetPosition: direction === "LR" ? "left" : "top",
        sourcePosition: direction === "LR" ? "right" : "bottom",
      };
    }),
    edges,
  };
}

/* ---------------- Node View ---------------- */

function KGNodeView({ data }: NodeProps) {
  const raw = (data as any)?.__raw as KGNode | undefined;
  const isCenter = !!raw?.center;

  const color = isCenter ? colorForType(raw?.type ?? "") : "#cbd5e1";
  const bg = isCenter ? `${color}30` : "#f1f5f9";

  return (
    <div
      style={{
        width: nodeWidth,
        height: nodeHeight,
        borderRadius: 14,
        background: bg,
        border: "1px solid rgba(0,0,0,0.08)",
        borderLeft: `14px solid ${color}`,
        boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
        padding: 10,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      {isCenter && (
        <div
          style={{
            fontWeight: 700,
            fontSize: 12,
            color,
            marginBottom: 4,
            textTransform: "lowercase",
          }}
        >
          {raw?.type}
        </div>
      )}

      <div
        style={{
          fontSize: 13,
          lineHeight: 1.2,
          color: TEXT_NODE,
        }}
      >
        {(data as any)?.label}
      </div>

      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

/* ---------------- Main Component ---------------- */

type GraphViewProps = {
  sessionId: string | null;
};

export default function GraphView({ sessionId }: GraphViewProps) {
  const [kg, setKg] = useState<KG | null>(null);
  const [kgLoading, setKgLoading] = useState(false);
  const [kgError, setKgError] = useState<string | null>(null);
  const [selected, setSelected] = useState<KGNode | null>(null);
  const [expandedCenterId, setExpandedCenterId] = useState<string | null>(null);
  const [direction, setDirection] = useState<"LR" | "TB">("LR");

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const nodeTypes = useMemo(() => ({ kgNode: KGNodeView }), []);

  useEffect(() => {
    if (!sessionId) {
      setKg({ nodes: [], edges: [] });
      setKgError(null);
      return;
    }
    setKgLoading(true);
    setKgError(null);
    fetch(`${API_BASE}/api/session/${sessionId}/kg`)
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      })
      .then((data: { session_id?: string; kg?: { nodes?: unknown[]; edges?: unknown[] } }) => {
        setKg(normalizeKg(data?.kg ?? null));
      })
      .catch((e) => {
        setKg({ nodes: [], edges: [] });
        setKgError(e instanceof Error ? e.message : "Failed to load knowledge graph");
      })
      .finally(() => setKgLoading(false));
  }, [sessionId]);

  const filteredKG = useMemo(() => {
    if (!kg) return null;

    const centers = kg.nodes.filter((n) => n.center);
    const allowed = new Set(centers.map((n) => n.id));

    if (expandedCenterId) {
      kg.edges.forEach((e) => {
        if (e.source === expandedCenterId) allowed.add(e.target);
        if (e.target === expandedCenterId) allowed.add(e.source);
      });
    }

    return {
      nodes: kg.nodes.filter((n) => allowed.has(n.id)),
      edges: kg.edges.filter((e) => allowed.has(e.source) && allowed.has(e.target)),
    };
  }, [kg, expandedCenterId]);

  useEffect(() => {
    if (!filteredKG) return;

    const rfNodes: Node[] = filteredKG.nodes.map((n) => ({
      id: n.id,
      type: "kgNode",
      data: { label: n.name, __raw: n },
      position: { x: 0, y: 0 },
    }));

    const rfEdges: Edge[] = filteredKG.edges.map((e, i) => ({
      id: `e_${i}`,
      source: e.source,
      target: e.target,
      label: e.type,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 2, opacity: 0.7 },
    }));

    const laidOut = layoutDagre(rfNodes, rfEdges, direction);
    setNodes(laidOut.nodes);
    setEdges(laidOut.edges);
  }, [filteredKG, direction]);

  if (kgLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 12 }}>
        <div style={{ width: 40, height: 40, border: "4px solid #e2e8f0", borderTopColor: "#f59e0b", borderRadius: "50%" }} />
        <p style={{ color: "#64748b" }}>Loading knowledge graph...</p>
      </div>
    );
  }

  if (kgError) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 12 }}>
        <p style={{ color: "#dc2626" }}>{kgError}</p>
        {sessionId && (
          <a href={`/onboarding?session=${sessionId}`} style={{ color: "#f59e0b", fontWeight: 600 }}>← Onboarding Narrative</a>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", height: "100vh" }}>
      <div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          onNodeClick={(_, n) => {
            const raw = (n.data as any)?.__raw;
            if (!raw) return;
            setSelected(raw);
            if (raw.center) {
              setExpandedCenterId((prev) => (prev === raw.id ? null : raw.id));
            }
          }}
        >
          <MiniMap
            nodeColor={(n) => {
              const raw = (n.data as any)?.__raw;
              return raw?.center ? colorForType(raw.type) : "#cbd5e1";
            }}
          />
          <Controls />
          <Background />
        </ReactFlow>
      </div>

      {/* ---------------- Details Panel ---------------- */}
      <div
        style={{
          borderLeft: "1px solid rgba(0,0,0,0.08)",
          padding: 20,
          overflow: "auto",
          background: "white",
          color: TEXT_PANEL,   // ✅ 全黑
        }}
      >
        <h2 style={{ marginTop: 0 }}>Details</h2>

        {!selected ? (
          <div style={{ color: TEXT_PANEL_SOFT }}>
            Click a node to see details.
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: TEXT_PANEL_SOFT }}>{selected.type}</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{selected.name}</div>
              {/* <div style={{ fontSize: 13, marginTop: 4 }}>
                id: {selected.id}
              </div> */}
            </div>

            <h3>Evidence</h3>
            {(selected.evidence || []).map((ev, idx) => (
              <div key={idx} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {ev.source_type} — {ev.source_id}
                </div>
                <div style={{ fontSize: 13 }}>{ev.quote}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}