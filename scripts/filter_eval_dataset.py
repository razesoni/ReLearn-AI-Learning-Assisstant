import json, pathlib, sys

file_path = pathlib.Path(r'C:\Users\akash\OneDrive\Desktop\Agentic Learning App\evaluation\eval_data\eval_dataset.json')

with file_path.open('r', encoding='utf-8') as f:
    data = json.load(f)

project_pdf = 'Agentic_AI_with_LangGraph_Handwritten_Style_Notes.pdf'
filtered = [item for item in data if item.get('source_document') == project_pdf]

with file_path.open('w', encoding='utf-8') as f:
    json.dump(filtered, f, indent=2)

print('Filtered entries:', len(filtered))
