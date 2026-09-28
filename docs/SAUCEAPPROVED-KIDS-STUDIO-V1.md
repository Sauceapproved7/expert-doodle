# SauceApproved Kids Studio v1

An original, parent-operated story planner inside SauceApproved Studio. Route: `/kids`; manifest: `/api/studio/kids/manifest`.

| Kit | Campaign lane | Two Hercules additions |
| --- | --- | --- |
| Neighborhood Hero | Boy-focused creative, available to every child | Choice Compass branches a decision; Courage Replay plans an alternate ending. |
| Dream Director | Girl-focused creative, available to every child | Beat Board produces timed shots; Role Swap plans director and performer views. |
| Time Capsule | All kids | Then / Now pairs a present moment and future reflection; Privacy Check flags obvious contact details in the text draft. |

The interface inherits the vintage camera's analog feel and links to its separate local capture surface. A parent or guardian must affirm review before a shot plan can be previewed and downloaded. Switching kits or changing input invalidates the reviewed plan. The privacy check is intentionally limited and is not a substitute for human review.

No child account, server upload, public posting, cloud generation, or media storage is implemented. The plan exists in browser memory until explicitly downloaded as plain text; the camera does not automatically receive it. Server mutation endpoints remain default-deny. Parent review includes permission to film others. This is a parent-operated design, not a claim that the service has completed legal review for a child-directed account or collection flow.

Verification: `node --test tests/sauceapproved-kids-studio.test.mjs tests/hercules-video-studio-server.test.mjs tests/hercules-video-studio-contract.test.mjs`; `node scripts/verify-hercules-execution-contract.mjs`.

Commercial and deployment gates are independent of this feature. No paid launch or child registration is authorized by this implementation.
