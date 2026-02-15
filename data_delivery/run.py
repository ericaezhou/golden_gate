import json
import os
import sys

from openai import OpenAI
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
# Relative imports so this module works when loaded via backend (e.g. backend.routes.session)
from .kg import extract_kg_with_evidence
from .hash import normalize_and_hash_evidence
from .neo4j_ import upsert_neo4j_with_evidence

from backend.parse_cli import parse_file

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

def build_and_store_kg(project_context: str, interview_transcript: str):
    client = OpenAI()

    kg_json = extract_kg_with_evidence(client, project_context, interview_transcript)
    # print(f"kg_json: {kg_json}")
    with open("./public/kg.json", "w") as f:
        json.dump(kg_json, f)
    return kg_json

def show_kg(kg_path: str):
    with open(kg_path, "r") as f:
        kg = json.load(f)
    upsert_neo4j_with_evidence("bolt://localhost:7687", "neo4j", "password", kg)
    

def build_project_context(file_paths: list[str]) -> str:
    project_context = ""
    for file_path in file_paths:
        project_context += f"File: {file_path}\n"
        project_context += str(parse_file(file_path))
        project_context += "\n"
    return project_context

def build_interview_transcript(interview_transcript_path: str) -> str:
    with open(interview_transcript_path, "r") as f:
        interview_transcript = f.read()
    return interview_transcript

def _file_path_from_parsed(file_content: dict, fallback_name: str) -> str:
    """Path or name for a parsed file — supports both data_delivery and backend session format."""
    return (
        file_content.get("file_path")
        or file_content.get("file_name")
        or file_content.get("file_id")
        or fallback_name
    )


def _content_from_parsed(file_content: dict) -> str:
    """Text content for KG — supports both data_delivery and backend session format."""
    if "content" in file_content:
        return str(file_content["content"])
    parsed = file_content.get("parsed_content")
    if isinstance(parsed, dict) and "content" in parsed:
        return str(parsed["content"])
    if isinstance(parsed, dict):
        return json.dumps(parsed, indent=0, default=str, ensure_ascii=False)
    return str(parsed) if parsed else ""


def build_kg(interview_summary: str, parsed_directory: str = "output/parsed"):
    project_context = ""
    if not os.path.isdir(parsed_directory):
        return {"nodes": [], "edges": []}
    for file in os.listdir(parsed_directory):
        if not file.endswith(".json"):
            continue
        try:
            with open(os.path.join(parsed_directory, file), "r") as f:
                file_content = json.load(f)
            if not isinstance(file_content, dict):
                continue
            path = _file_path_from_parsed(file_content, file)
            content = _content_from_parsed(file_content)
            project_context += f"<<<FILE path='{path}'>>>\n{content}\n<<</FILE>>>\n"
        except (KeyError, json.JSONDecodeError, OSError) as e:
            continue
    if not project_context.strip():
        return {"nodes": [], "edges": []}
    kg_json = build_and_store_kg(project_context, interview_summary)
    with open("public/kg.json", "w") as f:
        json.dump(kg_json, f)
    return kg_json

if __name__ == "__main__":
    file_paths = ["public/artifacts/alice-chen/Risk_Committee_Notes.md", "public/artifacts/alice-chen/Q3_Loss_Forecast.json"]
    for file_path in file_paths:
        res = parse_file(file_path)
        json.dump(res.to_dict(), open(f"mock/{file_path.split('/')[-1]}.json", "w"))
    interview_summary = build_interview_transcript("src/data/short_interview.md")
    build_kg(interview_summary, "mock")
    print("finish building and storing kg")
