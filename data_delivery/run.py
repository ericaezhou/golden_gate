from openai import OpenAI
from kg import extract_kg_with_evidence
from hash import normalize_and_hash_evidence
from neo4j_ import upsert_neo4j_with_evidence
import json
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from backend.parse_cli import parse_file



def build_and_store_kg(project_context: str, interview_transcript: str):
    client = OpenAI()

    kg_json = extract_kg_with_evidence(client, project_context, interview_transcript)
    print(f"kg_json: {kg_json}")
    # with open("kg_original.txt", "w") as f:
    #     f.write(kg_json)
    # kg = json.loads(kg_json)
    # kg = normalize_and_hash_evidence(kg_json)

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

def build_kg(interview_summary:str, parsed_directory: str = "output/parsed") -> str:
    project_context = ""
    for file in os.listdir(parsed_directory):
        if file.endswith(".json"):
            with open(os.path.join(parsed_directory, file), "r") as f:
                file_content = json.load(f)
                project_context += f"<<<FILE path='{file_content['file_path']}'>>>"
                project_context += str(file_content['content'])
                project_context += "<<</FILE>>>\n"
    kg_json = build_and_store_kg(project_context, interview_summary)
    with open(f"public/kg.json", "w") as f:
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
