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
    useReactFlow,
    MarkerType,
  } from "reactflow";
  import "reactflow/dist/style.css";
  import dagre from "dagre";
  

  function KGNodeView({ data }: NodeProps) {
    const raw = (data as any)?.__raw;
    const color = raw ? colorForType(raw.type) : "#9ca3af";
  
    const bg = `${color}22`;
  
    return (
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
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div style={{ pointerEvents: "none", fontWeight: 800, color, marginBottom: 4, textTransform: "lowercase" }}>
          {raw?.type ?? ""}
        </div>
  
        <div
          style={{
            whiteSpace: "pre-wrap",
            pointerEvents: "none",
            fontSize: 12,
            lineHeight: 1.15,
            color: "#0f172a",
          }}
        >
          {(data as any)?.label}
        </div>
  
        <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
        <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      </div>
    );
  }
  
  

/** ---- Types that match your kg.json ---- */
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
  // optional if you have it
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

/** ---- Styling helpers ---- */
function colorForType(t: string) {
    const key = (t || "").toLowerCase();
    const m: Record<string, string> = {
      project: "#2563eb",
      module: "#06b6d4",
      process: "#10b981",
      runbook: "#22c55e",
      runbookstep: "#86efac",
      decisionrule: "#a855f7",
      decision: "#a855f7",      
      risk: "#f97316",
      mitigation: "#16a34a",
      person: "#64748b",
      document: "#94a3b8",
      operationalartifact: "#f59e0b",
      component: "#06b6d4",     
      threshold: "#f97316",     
      role: "#64748b",          
    };
    return m[key] ?? "#9ca3af";
  }

function labelForNode(n: KGNode) {
  return `${n.name}`;
}

/** ---- Dagre layout ---- */
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
      // Helps React Flow avoid jitter
      targetPosition: direction === "LR" ? "left" : "top",
      sourcePosition: direction === "LR" ? "right" : "bottom",
    };
  });

  return { nodes: laidOut, edges };
}

/** ---- Component ---- */
export default function GraphView() {
  const [kg, setKg] = useState<KG | null>(null);
  const [selected, setSelected] = useState<KGNode | null>(null);

  // simple toggles to reduce clutter
  const [showDocuments, setShowDocuments] = useState(true);
  const [showPeople, setShowPeople] = useState(true);
  const [direction, setDirection] = useState<"LR" | "TB">("LR");

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

    const allowed = new Set(kg.nodes.filter((n) => !hiddenTypes.has(n.type)).map((n) => n.id));

    // Filter edges that connect only allowed nodes
    const edges2 = kg.edges.filter((e) => allowed.has(e.source) && allowed.has(e.target));
    const nodes2 = kg.nodes.filter((n) => allowed.has(n.id));

    return { nodes: nodes2, edges: edges2 } as KG;
  }, [kg, showDocuments, showPeople]);

  useEffect(() => {
    if (!filteredKG) return;

    // Convert KG nodes to React Flow nodes
    const rfNodes: Node[] = filteredKG.nodes.map((n) => ({
      id: n.id,
      type: "kgNode",
      data: {
        label: labelForNode(n),
        __raw: n, // keep original node for click panel
      },
      position: { x: 0, y: 0 }
    }));

    const rfEdges: Edge[] = filteredKG.edges.map((e, i) => ({
        id: `e_${i}_${e.source}_${e.target}_${e.type}`,
        source: e.source,
        target: e.target,
        label: e.type,
        animated: false,
        style: { opacity: 0.7 },
        markerEnd: { type: MarkerType.ArrowClosed }, // ✅ 箭头
        data: { __raw: e },
    }));

    // Layout
    const laidOut = layoutDagre(rfNodes, rfEdges, direction);
    setNodes(laidOut.nodes);
    setEdges(laidOut.edges);

    // If selected node was filtered out, clear it
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
        </div>

        <ReactFlow onInit={setRf}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
        //   onNodeClick={(_, n) => {
        //     const raw = (n.data as any)?.__raw as KGNode | undefined;
        //     if (raw) setSelected(raw);
        //   }}
        onNodeClick={(_, n) => {
            const raw = (n.data as any)?.__raw as KGNode | undefined;
            if (raw) setSelected(raw);
          
            // 1-hop 子图节点集合
            const neighborIds = new Set<string>();
            neighborIds.add(n.id);
          
            edges.forEach((e) => {
              if (e.source === n.id) neighborIds.add(e.target);
              if (e.target === n.id) neighborIds.add(e.source);
            });
          
            const focusNodes = nodes.filter((nd) => neighborIds.has(nd.id));
          
            rf?.fitView({
              nodes: focusNodes,
              padding: 0.35,
              duration: 500,
            });
          }}
          nodeTypes={nodeTypes}
        >
          <MiniMap
            nodeColor={(n) => {
              const raw = (n.data as any)?.__raw as KGNode | undefined;
              return raw ? colorForType(raw.type) : "#ddd";
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
              {/* <div style={{ fontSize: 13 }}>
                <b>confidence:</b> {selected.confidence?.toFixed?.(2) ?? selected.confidence}
              </div> */}
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
                    <div style={{ fontSize: 11, marginTop: 6, color: "#64748b" }}>
                      {ev.snippet_hash}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 style={{ margin: "6px 0" }}>Legend</h3>
              <div style={{ display: "grid", gap: 6 }}>
                {["Project", "Module", "Process", "Runbook", "DecisionRule", "Risk", "Mitigation", "Person", "Document"].map((t) => (
                  <div key={t} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: colorForType(t), display: "inline-block" }} />
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
