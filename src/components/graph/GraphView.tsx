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

const TEXT_LIGHT = "#94a3b8";   // slate-400
const TEXT_SOFT = "#64748b";    // slate-500

/** ------------------ Types ------------------ */
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
  attrs?: { k: string; v: string }[];
};

type KGEdge = {
  source: string;
  type: string;
  target: string;
  evidence: Evidence[];
  attrs?: { k: string; v: string }[];
};

type KG = {
  nodes: KGNode[];
  edges: KGEdge[];
};

/** ------------------ Palette + stable mapping ------------------ */
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
  const key = (t || "unknown").toLowerCase();
  const idx = hashString(key) % PALETTE.length;
  return PALETTE[idx];
}

function labelForNode(n: KGNode) {
  return `${n.name}`;
}

/** ------------------ Dagre layout ------------------ */
const nodeWidth = 240;
const nodeHeight = 90;

function layoutDagre(nodes: Node[], edges: Edge[], direction: "LR" | "TB" = "LR") {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, ranksep: 70, nodesep: 40 });

  nodes.forEach((n) => {
    g.setNode(n.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((e) => {
    g.setEdge(e.source, e.target);
  });

  dagre.layout(g);

  const laidOut = nodes.map((n) => {
    const p = g.node(n.id);
    return {
      ...n,
      position: { x: p.x - nodeWidth / 2, y: p.y - nodeHeight / 2 },
      targetPosition: direction === "LR" ? "left" : "top",
      sourcePosition: direction === "LR" ? "right" : "bottom",
    };
  });

  return { nodes: laidOut, edges };
}

/** ------------------ Node view ------------------ */
function KGNodeView({ data }: NodeProps) {
  const raw = (data as any)?.__raw as KGNode | undefined;
  const isCenter = !!raw?.center;

  const color = isCenter ? colorForType(raw?.type ?? "") : "#9ca3af";
  const bg = isCenter ? `${color}70` : TEXT_LIGHT + "70";

  const evidence = raw?.evidence || [];
  const hasInterview = evidence.some((e) => e.source_type === "interview");

  return (
    <div
      style={{
        padding: hasInterview ? 4 : 0,
        borderRadius: 18,
        border: hasInterview ? `2px dashed ${isCenter ? color : "#9ca3af"}` : "none",
      }}
    >
      <div
        style={{
          width: nodeWidth,
          height: nodeHeight,
          borderRadius: 14,
          background: bg,
          border: "1px solid rgba(0,0,0,0.10)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          borderLeft: `14px solid ${color}`,
          padding: 10,
          cursor: isCenter ? "pointer" : "default",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          opacity: isCenter ? 1 : 0.92,
        }}
      >
        {isCenter && (
          <div style={{ pointerEvents: "none", fontWeight: 800, color, marginBottom: 4, textTransform: "lowercase" }}>
            {raw?.type ?? ""}
          </div>
        )}

        <div
        style={{
            whiteSpace: "pre-wrap",
            pointerEvents: "none",
            fontSize: 12,
            lineHeight: 1.15,
            color: TEXT_SOFT,   // ✅ 改这里
        }}
        >
        {(data as any)?.label}
        </div>

        <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
        <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      </div>
    </div>
  );
}

export default function GraphView() {
  const [kg, setKg] = useState<KG | null>(null);
  const [selected, setSelected] = useState<KGNode | null>(null);

  const [showDocuments, setShowDocuments] = useState(true);
  const [showPeople, setShowPeople] = useState(true);
  const [direction, setDirection] = useState<"LR" | "TB">("LR");

  const [expandedCenterId, setExpandedCenterId] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [rf, setRf] = useState<any>(null);

  const nodeTypes = useMemo(() => ({ kgNode: KGNodeView }), []);

  useEffect(() => {
    fetch("/kg.json")
      .then((r) => r.json())
      .then((data: KG) => setKg(data))
      .catch((e) => {
        console.error(e);
        setKg({ nodes: [], edges: [] });
      });
  }, []);

  const filteredKG = useMemo(() => {
    if (!kg) return null;

    const hiddenTypes = new Set<string>();
    if (!showDocuments) hiddenTypes.add("Document");
    if (!showPeople) hiddenTypes.add("Person");

    const nodesAllowedByToggle = kg.nodes.filter((n) => !hiddenTypes.has(n.type));
    const centers = nodesAllowedByToggle.filter((n) => n.center);
    const centerIds = new Set(centers.map((n) => n.id));

    const allowed = new Set<string>(centerIds);

    if (expandedCenterId) {
      kg.edges.forEach((e) => {
        if (e.source === expandedCenterId) allowed.add(e.target);
        if (e.target === expandedCenterId) allowed.add(e.source);
      });
    }

    const allowedByToggle = new Set(nodesAllowedByToggle.map((n) => n.id));
    const finalAllowed = new Set([...allowed].filter((id) => allowedByToggle.has(id)));

    const edges2 = kg.edges.filter((e) => finalAllowed.has(e.source) && finalAllowed.has(e.target));
    const nodes2 = nodesAllowedByToggle.filter((n) => finalAllowed.has(n.id));

    return { nodes: nodes2, edges: edges2 } as KG;
  }, [kg, showDocuments, showPeople, expandedCenterId]);

  const legendCenterTypes = useMemo(() => {
    if (!filteredKG) return [];
    const set = new Set(filteredKG.nodes.filter((n) => n.center).map((n) => n.type).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [filteredKG]);

  useEffect(() => {
    if (!filteredKG) return;

    const rfNodes: Node[] = filteredKG.nodes.map((n) => ({
      id: n.id,
      type: "kgNode",
      data: {
        label: labelForNode(n),
        __raw: n,
      },
      position: { x: 0, y: 0 },
    }));

    const rfEdges: Edge[] = filteredKG.edges.map((e, i) => {
      const sourceNode = filteredKG.nodes.find((n) => n.id === e.source);
      const targetNode = filteredKG.nodes.find((n) => n.id === e.target);
      const touchesCenter = !!(sourceNode?.center || targetNode?.center);

      return {
        id: `e_${i}_${e.source}_${e.target}_${e.type}`,
        source: e.source,
        target: e.target,
        label: e.type,
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: touchesCenter ? { opacity: 0.85, strokeWidth: 2 } : { opacity: 0.35 },
        data: { __raw: e },
      };
    });

    const laidOut = layoutDagre(rfNodes, rfEdges, direction);
    setNodes(laidOut.nodes);
    setEdges(laidOut.edges);

    if (selected && !filteredKG.nodes.find((n) => n.id === selected.id)) {
      setSelected(null);
    }
  }, [filteredKG, direction]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", height: "100vh" }}>
      {/* Graph */}
      <div style={{ position: "relative" }}>
        {/* Top bar */}
        <div
          style={{
            position: "absolute",
            zIndex: 10,
            top: 12,
            left: 12,
            display: "flex",
            gap: 10,
            padding: 10,
            background: "rgba(255,255,255,0.9)",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 12,
            backdropFilter: "blur(6px)",
            alignItems: "center",
          }}
        >
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={showDocuments} onChange={(e) => setShowDocuments(e.target.checked)} />
            Documents
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={showPeople} onChange={(e) => setShowPeople(e.target.checked)} />
            People
          </label>

          <select value={direction} onChange={(e) => setDirection(e.target.value as any)}>
            <option value="LR">Left → Right</option>
            <option value="TB">Top → Bottom</option>
          </select>

          <button
            onClick={() => setExpandedCenterId(null)}
            style={{
              marginLeft: 6,
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.10)",
              background: "white",
              cursor: "pointer",
            }}
            title="Back to centers"
          >
            Reset
          </button>
        </div>

        <ReactFlow
          onInit={setRf}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          onNodeClick={(_, n) => {
            const raw = (n.data as any)?.__raw as KGNode | undefined;
            if (!raw) return;

            setSelected(raw);

            if (raw.center) {
              setExpandedCenterId((prev) => (prev === raw.id ? null : raw.id));
            }

            const centerId = raw.center ? raw.id : expandedCenterId;
            if (!centerId) return;

            const neighborIds = new Set<string>();
            neighborIds.add(centerId);

            edges.forEach((e) => {
              if (e.source === centerId) neighborIds.add(e.target);
              if (e.target === centerId) neighborIds.add(e.source);
            });

            const focusNodes = nodes.filter((nd) => neighborIds.has(nd.id));

            rf?.fitView({
              nodes: focusNodes.length ? focusNodes : undefined,
              padding: 0.35,
              duration: 500,
            });
          }}
          nodeTypes={nodeTypes}
        >
          <MiniMap
            nodeColor={(n) => {
              const raw = (n.data as any)?.__raw as KGNode | undefined;
              return raw?.center ? colorForType(raw.type) : "#d1d5db";
            }}
          />
          <Controls />
          <Background />
        </ReactFlow>
      </div>

      {/* Side panel */}
      <div style={{ borderLeft: "1px solid rgba(0,0,0,0.08)", padding: 16, overflow: "auto" }}>
        <h2 style={{ marginTop: 0 }}>Details</h2>

        {!selected ? (
          <div style={{ color: "#64748b", lineHeight: 1.6 }}>
            Click a node to see details (name/type/evidence).
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div
              style={{
                padding: 12,
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 12,
                background: "white",
              }}
            >
              <div style={{ fontSize: 14, color: "#64748b" }}>{selected.type}</div>
              <div style={{ fontSize: 18, fontWeight: 700, margin: "6px 0" }}>{selected.name}</div>
              <div style={{ fontSize: 13 }}>
                <b>id:</b> {selected.id}
              </div>
              <div style={{ fontSize: 13 }}>
                <b>center:</b> {String(selected.center)}
              </div>
            </div>

            <div>
              <h3 style={{ margin: "6px 0" }}>Evidence</h3>
              {(!selected.evidence || selected.evidence.length === 0) && (
                <div style={{ color: "#64748b" }}>No evidence attached.</div>
              )}
              <div style={{ display: "grid", gap: 10 }}>
                {(selected.evidence || []).map((ev, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 10,
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 12,
                      background: "white",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        <b>{ev.source_type}</b> — {ev.source_id}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, marginTop: 6 }}>
                      <b>path:</b> {ev.path || "(none)"}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 6, color: "#0f172a", whiteSpace: "pre-wrap" }}>
                      {ev.quote}
                    </div>
                    <div style={{ fontSize: 11, marginTop: 6, color: "#64748b" }}>{ev.snippet_hash}</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 style={{ margin: "6px 0" }}>Legend (center nodes)</h3>
              {legendCenterTypes.length === 0 ? (
                <div style={{ color: "#64748b" }}>No center node types.</div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {legendCenterTypes.map((t) => (
                    <div key={t} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 999,
                          background: colorForType(t),
                          display: "inline-block",
                        }}
                      />
                      {t}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
