import json
import networkx as nx
import matplotlib.pyplot as plt

def build_nx_graph(kg_json_str: str) -> nx.MultiDiGraph:
    kg = json.loads(kg_json_str)
    G = nx.MultiDiGraph()

    for n in kg["nodes"]:
        G.add_node(n["id"], label=n["type"], name=n["name"], **n.get("properties", {}))

    for e in kg["edges"]:
        G.add_edge(e["source"], e["target"], key=e["type"], label=e["type"], **e.get("properties", {}))

    return G

if __name__ == "__main__":
    with open("kg.json", "r") as f:
        kg = json.load(f)
    G = build_nx_graph(json.dumps(kg))
    print(G)
    nx.draw(G, with_labels=True)
    plt.show()