import json
from pathlib import Path

from app.product_quiz import deterministic_quiz, validate_recommendation

PRODUCTS = [
    {"id":"hoodie-black","name":"Black Hoodie","description":"Black premium hoodie","tags":["black","hoodie","streetwear"],"price":79,"url":"https://sauceapproved.com/products/hoodie-black","available":True},
    {"id":"hoodie-gray","name":"Sports Gray Hoodie","description":"Gray premium hoodie","tags":["gray","hoodie","streetwear"],"price":79,"url":"https://sauceapproved.com/products/hoodie-gray","available":True},
]

def test_empty_answers_returns_questions_only():
    result=deterministic_quiz(PRODUCTS,[])
    assert result["next_action"]=="ask_questions"
    assert 3 <= len(result["questions"]) <= 5
    assert result["recommended_product_id"] is None

def test_answers_return_only_catalog_product():
    result=deterministic_quiz(PRODUCTS,[{"question_id":"color","value":"black"}])
    assert result["next_action"]=="show_recommendation"
    assert result["recommended_product_id"]=="hoodie-black"

def test_unknown_or_unavailable_model_recommendation_is_rejected():
    assert validate_recommendation(PRODUCTS,"made-up") is None
    unavailable=[{**PRODUCTS[0],"available":False}]
    assert validate_recommendation(unavailable,"hoodie-black") is None

def test_widget_never_contains_api_key():
    widget=Path("hercules-ai/ui/product-quiz.js").read_text()
    assert "OPENAI_API_KEY" not in widget
    assert "/api/product-quiz" in widget

def test_catalog_has_stable_required_fields():
    catalog=json.loads(Path("hercules-ai/data/products.json").read_text())
    assert catalog
    for product in catalog:
        assert {"id","name","description","tags","price","url","available"} <= set(product)
