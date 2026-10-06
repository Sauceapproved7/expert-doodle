import json, os
from pathlib import Path
from typing import Any
import httpx
from fastapi import APIRouter
from pydantic import BaseModel, Field

router=APIRouter()
CATALOG_PATH=Path(__file__).resolve().parent.parent/"data"/"products.json"
OPENAI_API_KEY=os.getenv("OPENAI_API_KEY","").strip()
QUIZ_MODEL=os.getenv("HERCULES_QUIZ_MODEL","gpt-6-astra").strip()

class Answer(BaseModel):
    question_id:str=Field(min_length=1,max_length=80)
    value:str=Field(min_length=1,max_length=120)

class QuizRequest(BaseModel):
    answers:list[Answer]=Field(default_factory=list,max_length=10)

def load_products()->list[dict[str,Any]]:
    data=json.loads(CATALOG_PATH.read_text())
    return [p for p in data if isinstance(p,dict) and p.get("id") and p.get("available") is True]

def validate_recommendation(products:list[dict[str,Any]],product_id:str|None)->str|None:
    if not product_id:
        return None
    return product_id if any(p.get("id")==product_id and p.get("available") is True for p in products) else None

def _questions(products:list[dict[str,Any]])->list[dict[str,Any]]:
    tags={str(t).lower() for p in products for t in p.get("tags",[]) if t}
    colors=[c for c in ("black","gray","white","blue","red") if c in tags]
    questions=[
        {"id":"priority","text":"What matters most for this pick?","options":[{"label":"Everyday style","value":"streetwear"},{"label":"Comfort","value":"comfort"},{"label":"Statement look","value":"statement"}]},
        {"id":"color","text":"Which color direction fits you best?","options":[{"label":c.title(),"value":c} for c in colors] or [{"label":"No preference","value":"any"}]},
        {"id":"use","text":"How do you plan to wear it?","options":[{"label":"Daily rotation","value":"daily"},{"label":"Layering","value":"layering"},{"label":"Going out","value":"going-out"}]},
    ]
    return questions

def deterministic_quiz(products:list[dict[str,Any]],answers:list[dict[str,str]])->dict[str,Any]:
    available=[p for p in products if p.get("available") is True]
    if not answers:
        return {"next_action":"ask_questions","questions":_questions(available),"recommended_product_id":None,"rationale":None}
    if not available:
        return {"next_action":"show_recommendation","questions":[],"recommended_product_id":None,"rationale":"No matching product is currently available."}
    wanted={str(a.get("value","")).lower() for a in answers}
    def score(p):
        hay={str(x).lower() for x in p.get("tags",[])}
        hay.update(str(p.get(k,"")).lower() for k in ("name","description","category"))
        return sum(1 for v in wanted if v and v!="any" and any(v in x for x in hay))
    best=max(available,key=lambda p:(score(p),str(p.get("id"))))
    return {"next_action":"show_recommendation","questions":[],"recommended_product_id":best["id"],"recommended_product":best,"rationale":f"{best['name']} is the closest available catalog match for the preferences you selected."}

QUIZ_SCHEMA={"type":"object","properties":{
 "next_action":{"type":"string","enum":["ask_questions","show_recommendation"]},
 "questions":{"type":"array","items":{"type":"object","properties":{"id":{"type":"string"},"text":{"type":"string"},"options":{"type":"array","items":{"type":"object","properties":{"label":{"type":"string"},"value":{"type":"string"}},"required":["label","value"],"additionalProperties":False}}},"required":["id","text","options"],"additionalProperties":False}},
 "recommended_product_id":{"type":["string","null"]},"rationale":{"type":["string","null"]}},
 "required":["next_action","questions","recommended_product_id","rationale"],"additionalProperties":False}

async def model_quiz(products:list[dict[str,Any]],answers:list[dict[str,str]])->dict[str,Any]|None:
    if not OPENAI_API_KEY:
        return None
    payload={"model":QUIZ_MODEL,"input":[
      {"role":"system","content":"Create a short product-matching quiz. Recommend only an exact product ID from the supplied available catalog. Empty answers: return 3-5 useful questions and no recommendation. Existing answers: return one best match and a concise rationale."},
      {"role":"user","content":json.dumps({"products":products,"answers":answers},separators=(",",":"))}],
      "text":{"format":{"type":"json_schema","name":"product_quiz_response","strict":True,"schema":QUIZ_SCHEMA}}}
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response=await client.post("https://api.openai.com/v1/responses",headers={"Authorization":f"Bearer {OPENAI_API_KEY}","Content-Type":"application/json"},json=payload)
        response.raise_for_status()
        data=response.json()
        text=data.get("output_text")
        if not text:
            for item in data.get("output",[]):
                for part in item.get("content",[]):
                    if part.get("type")=="output_text": text=part.get("text"); break
        parsed=json.loads(text) if text else None
        if not isinstance(parsed,dict): return None
        if parsed.get("next_action")=="show_recommendation":
            valid=validate_recommendation(products,parsed.get("recommended_product_id"))
            if not valid: return None
            parsed["recommended_product_id"]=valid
            parsed["recommended_product"]=next((p for p in products if p.get("id")==valid),None)
        return parsed
    except (httpx.HTTPError,ValueError,TypeError,json.JSONDecodeError):
        return None

@router.post("/api/product-quiz")
async def product_quiz(req:QuizRequest):
    products=load_products()
    answers=[a.model_dump() for a in req.answers]
    result=await model_quiz(products,answers)
    return result or deterministic_quiz(products,answers)
