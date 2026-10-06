import json
from pathlib import Path

from app.product_quiz import deterministic_quiz, validate_recommendation

PRODUCTS = [
    {"id":"hoodie","name":"Premium Hoodie","description":"Premium hoodie","tags":["hoodie","streetwear"],"url":"https://sauceapproved.com/products/sauceapproved-premium-hoodie","available":True},
]

def test_empty_answers_returns_questions_only():
    result=deterministic_quiz(PRODUCTS,[])
    assert result["next_action"]=="ask_questions"
    assert 3 <= len(result["questions"]) <= 5
    assert result["recommended_product_id"] is None

def test_answers_return_only_catalog_product():
    result=deterministic_quiz(PRODUCTS,[{"question_id":"color","value":"black"}])
    assert result["next_action"]=="show_recommendation"
    assert result["recommended_product_id"]=="hoodie"

def test_unknown_or_unavailable_model_recommendation_is_rejected():
    assert validate_recommendation(PRODUCTS,"made-up") is None
    unavailable=[{**PRODUCTS[0],"available":False}]
    assert validate_recommendation(unavailable,"hoodie") is None

def test_widget_never_contains_api_key_and_renders_customer_product():
    widget=Path("hercules-ai/ui/product-quiz.js").read_text()
    assert "OPENAI_API_KEY" not in widget
    assert "/api/product-quiz" in widget
    assert "recommended_product.name" in widget
    assert "recommended_product.url" in widget

def test_catalog_uses_one_canonical_shopify_product_without_guessed_price():
    catalog=json.loads(Path("hercules-ai/data/products.json").read_text())
    assert len(catalog)==1
    product=catalog[0]
    assert product["id"]=="sauceapproved-premium-hoodie"
    assert product["url"]=="https://sauceapproved.com/products/sauceapproved-premium-hoodie"
    assert "price" not in product
    assert product["shopify_product_gid"]=="gid://shopify/Product/10258238406976"
    assert product["variants_count"]==29
