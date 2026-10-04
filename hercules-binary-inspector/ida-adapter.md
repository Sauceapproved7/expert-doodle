# IDA adapter boundary

Hercules may integrate with a user-provided, properly licensed IDA installation only through a separately authorized adapter.

Allowed default operations are read-only analysis: overview, functions, imports, strings, types, cross-references, disassembly/decompilation, and evidence export.

The Binary Inspector core does not invoke IDA and contains no IDA plugin code. Any future adapter that launches or controls external software must be declared in the owner-code policy, authenticated at its service boundary, audited, and tested separately.

IDB mutation, binary patching, target execution, credential extraction, privilege escalation, and self-granted permissions are outside the default adapter and outside Binary Inspector v1.

No third-party IDA plugin source is copied into this repository.
