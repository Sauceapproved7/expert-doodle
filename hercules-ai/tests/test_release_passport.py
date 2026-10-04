from app.release_passport import admit_release

def good():
    return dict(trusted_source=True,immutable_commit=True,trusted_builder=True,artifact_sha256="a"*64,provenance=True,sbom=True,tests_passed=True,critical_findings=0,production_approved=True,signature_verified=True,rollback_evidence=True)

def test_release_passport_admits_complete_evidence():
    r=admit_release(good()); assert r["admitted"] is True; assert r["failures"]==[]

def test_release_passport_fails_closed_on_missing_gate():
    x=good(); x["signature_verified"]=False
    r=admit_release(x); assert r["admitted"] is False; assert "signature_verified" in r["failures"]

def test_release_passport_rejects_bad_digest():
    x=good(); x["artifact_sha256"]="nope"
    r=admit_release(x); assert r["admitted"] is False; assert "artifact_sha256" in r["failures"]
