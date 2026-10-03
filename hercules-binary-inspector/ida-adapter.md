# IDA adapter boundary

Hercules may integrate with a user-provided, properly licensed IDA installation.

Allowed default operations are read-only analysis: overview, functions, imports, strings, types, cross-references, disassembly/decompilation and evidence export.

Any IDB mutation must be separately policy-authorized and auditable. Binary patching and target execution are outside the default adapter.

No third-party IDA plugin source is copied into this repository.
