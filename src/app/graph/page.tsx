"use client";

import GraphView from "@/components/graph/GraphView";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function GraphPageContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  return (
    <main style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          flexShrink: 0,
          padding: "12px 20px",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          background: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontWeight: 700, color: "#f59e0b" }}>Golden Gate</span>
          <span style={{ color: "#64748b", fontSize: 14 }}>Knowledge Graph</span>
          {sessionId && (
            <span style={{ fontSize: 13, color: "#94a3b8" }}>session: {sessionId}</span>
          )}
        </div>
        {sessionId ? (
          <Link
            href={`/onboarding?session=${sessionId}`}
            style={{
              padding: "8px 16px",
              background: "#f59e0b",
              color: "white",
              fontWeight: 600,
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            ← Onboarding Narrative
          </Link>
        ) : (
          <p style={{ fontSize: 14, color: "#64748b" }}>Add ?session=... to load a graph</p>
        )}
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <GraphView sessionId={sessionId} />
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Loading...</div>}>
      <GraphPageContent />
    </Suspense>
  );
}
