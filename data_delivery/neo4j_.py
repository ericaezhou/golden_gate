from neo4j import GraphDatabase
import json

def upsert_neo4j_with_evidence(uri: str, user: str, password: str, kg: dict):
    driver = GraphDatabase.driver(uri, auth=(user, password))

    def run(tx, query, params=None):
        tx.run(query, params or {})

    with driver.session() as session:
        # Nodes
        for n in kg["nodes"]:
            props = n.get("properties", {}) or {}
            session.execute_write(
                run,
                f"""
                MERGE (x:{n['type']} {{id:$id}})
                SET x.name = $name,
                    x.confidence = $confidence,
                    x.evidence_json = $evidence_json
                SET x += $props
                """,
                {
                    "id": n["id"],
                    "name": n["name"],
                    "confidence": float(n["confidence"]),
                    "evidence_json": json.dumps(n.get("evidence", []), ensure_ascii=False),
                    "props": props,
                },
            )

        # Edges
        for e in kg["edges"]:
            props = e.get("properties", {}) or {}
            session.execute_write(
                run,
                f"""
                MATCH (a {{id:$sid}}), (b {{id:$tid}})
                MERGE (a)-[r:{e['type']}]->(b)
                SET r.confidence = $confidence,
                    r.evidence_json = $evidence_json
                SET r += $props
                """,
                {
                    "sid": e["source"],
                    "tid": e["target"],
                    "confidence": float(e["confidence"]),
                    "evidence_json": json.dumps(e.get("evidence", []), ensure_ascii=False),
                    "props": props,
                },
            )

    driver.close()

if __name__ == "__main__":
    with open("kg.json", "r") as f:
        kg = json.load(f)
    uri = "neo4j://127.0.0.1:7687"
    user = "neo4j"
    password = "12345678"
    upsert_neo4j_with_evidence(uri, user, password, kg)