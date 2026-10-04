import re

REQUIRED_BOOLEAN_GATES=(
 "trusted_source","immutable_commit","trusted_builder","provenance","sbom",
 "tests_passed","production_approved","signature_verified","rollback_evidence",
)

def admit_release(evidence):
    failures=[]
    for gate in REQUIRED_BOOLEAN_GATES:
        if evidence.get(gate) is not True: failures.append(gate)
    digest=str(evidence.get("artifact_sha256",""))
    if not re.fullmatch(r"[0-9a-f]{64}",digest): failures.append("artifact_sha256")
    critical=evidence.get("critical_findings")
    if critical != 0: failures.append("critical_findings")
    return {"admitted":not failures,"failures":failures,"artifact_sha256":digest if "artifact_sha256" not in failures else None}
