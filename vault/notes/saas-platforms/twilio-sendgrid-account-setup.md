---
title: twilio-sendgrid-account-setup
aliases:
  - twilio sendgrid account setup
tags:
  - skill
  - domain/saas-platforms
domain: saas-platforms
status: untried
source: skills/twilio-sendgrid-account-setup/SKILL.md
created: 2026-08-07
---

# twilio-sendgrid-account-setup

> [!info] What it does
> Set up a SendGrid account for email delivery. Covers API key creation (SG.-prefix), domain authentication (DKIM/SPF via CNAME records), Single Sender Verification for testing, SDK installation, and the relationship between SendGrid and Twilio credentials. Use before any other SendGrid skill. This skill is for SendGrid only — not the Twilio Email API (comms.twilio.com).

**Source:** [skills/twilio-sendgrid-account-setup/SKILL.md](../../../skills/twilio-sendgrid-account-setup/SKILL.md)  ·  **Domain:** [SaaS & Vendor Platform Integrations](../../maps/saas-platforms.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [credentials](../../notes/security-auditing/credentials.md) — Instructions for handling API keys and credentials safely, verifying their presence, and prompting the user to add them if missing using a safe protocol
- [email](../../notes/comms-productivity/email.md) — Email sending integration guidance — Resend (native Vercel Marketplace) with React Email templates
- [verification](../../notes/software-dev/verification.md) — Full-story verification — infers what the user is building, then verifies the complete flow end-to-end: browser → API → data → response

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
