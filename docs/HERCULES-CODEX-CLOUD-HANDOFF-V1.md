# Hercules Codex Cloud — reusable setup handoff v1

**Scope:** source-only onboarding assistance for the canonical Hercules GitHub repository. This does not publish a Codex Cloud environment.

## Verified documentation

Codex Cloud environments are created and published on **web or desktop**, then reused by tasks on mobile. Having GitHub connected alone does not prove the repository is mounted into a cloud task. Temporary prepared task sessions are not reusable published environments.

- https://help.openai.com/en/articles/20001545-using-codex-cloud
- https://learn.chatgpt.com/docs/environments/cloud-environments

## Hercules validated setup recipe

From the repository root, with Node.js 22 or newer:

```sh
node scripts/hercules-codex-cloud-handoff.mjs
node scripts/hercules-codex-cloud-handoff.mjs --json
```

This offline program reads the tracked, fixed-command profile and generates setup instructions. It does **not** execute those commands. The profile rejects altered repository/branch, unauthorized commands, excessive network permissions, public visibility, and any provider, payment, credential, or auto-publish authority.

## Last account-side action

On web or desktop Codex, choose **Work in > Cloud > Select environment > Create environment**. Select the GitHub repository **Sauceapproved7/expert-doodle**, then choose **Get started** to prepare it. Codex can use the existing Node-based setup checks from the verified handoff. Review the setup report and choose **Publish**. Once **Environment published** appears, start a new task using that environment. It will then also be selectable on mobile. Alternative entry: **Settings > Codex Cloud > Environments > Create environment**.

The connected Codex Tasks API here can list environments and start tasks, but does not expose creation or publication. A GitHub merge cannot substitute for account-side publication.

## Five-stage proof ladder

1. **GitHub committed:** verify exact canonical source and SHA; no cloud connection inferred.
2. **Local setup checks:** execute the actual checks in the task and retain exit status; no publish authority inferred.
3. **Published environment:** Codex account confirms the environment includes the canonical repository.
4. **New task proof:** the published environment actually checks out the expected SHA and runs the desired tests.
5. **Production permission:** requires separate authorization and release gates, never inherited from the four prior stages.

Two Hercules differentiators: fixed safe commands rather than arbitrary installers; and explicit evidence separation between source readiness, platform registration, task runtime, and live release.

## Cost, privacy, and ownership

Repository-side handoff adds no secret, provider call, billing, new hosting resource, model inference, production change, live checkout or DNS update. Codex Cloud usage itself is governed by the signed-in account's available usage limits. Implementation uses original SauceApproved JavaScript, Node built-ins, and no vendored external code.
