import json
from pathlib import Path

def test_knowledge_first_is_canonical_governance():
    doc=Path("governance/hercules-knowledge-first-v1.md").read_text().lower()
    contract=json.loads(Path("governance/hercules-knowledge-first-v1.json").read_text())
    assert "vault is hercules' brain" in doc
    assert contract["principle"]=="knowledge_first"
    assert contract["require_provenance"] is True
    assert contract["distinguish_verified_from_assumed"] is True
    assert contract["unsafe_or_unlicensed_material_is_trusted"] is False
