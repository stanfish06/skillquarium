---
title: twilio-email-send
aliases:
  - twilio email send
tags:
  - skill
  - domain/saas-platforms
domain: saas-platforms
status: untried
source: skills/twilio-email-send/SKILL.md
created: 2026-08-07
---

# twilio-email-send

> [!info] What it does
> Use when the caller has Twilio credentials (Account SID + Auth Token or API Key SID + Secret) and needs to send email via comms.twilio.com/v1/Emails. This is Twilio-native email — NOT SendGrid. Do NOT use if the caller has a SendGrid API key (SG.-prefix) — use twilio-sendgrid-email-send instead. Covers single sends, batch sends up to 10,000 recipients, Liquid personalization, operation tracking, and error handling.

**Source:** [skills/twilio-email-send/SKILL.md](../../../skills/twilio-email-send/SKILL.md)  ·  **Domain:** [SaaS & Vendor Platform Integrations](../../maps/saas-platforms.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [auth](../../notes/security-auditing/auth.md) — Authentication integration guidance — Clerk (native Vercel Marketplace), Descope, and Auth0 setup for Next.js applications
- [credentials](../../notes/security-auditing/credentials.md) — Instructions for handling API keys and credentials safely, verifying their presence, and prompting the user to add them if missing using a safe protocol
- [email](../../notes/comms-productivity/email.md) — Email sending integration guidance — Resend (native Vercel Marketplace) with React Email templates
- [twilio-sendgrid-email-send](../../notes/saas-platforms/twilio-sendgrid-email-send.md) — Send transactional and bulk email via the SendGrid v3 Mail Send API

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
