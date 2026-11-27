---
title: twilio-sendgrid-email-send
aliases:
  - twilio sendgrid email send
tags:
  - skill
  - domain/saas-platforms
domain: saas-platforms
status: untried
source: skills/twilio-sendgrid-email-send/SKILL.md
created: 2026-08-07
---

# twilio-sendgrid-email-send

> [!info] What it does
> Send transactional and bulk email via the SendGrid v3 Mail Send API. Covers single sends, personalized batch sends with dynamic templates, scheduled sends with cancellation, attachments, and sandbox mode for testing. Use this skill when the caller has a SendGrid API key (SG.-prefix). Do NOT use this skill if the caller is using the Twilio Email API (comms.twilio.com) — that is a separate product with different credentials.

**Source:** [skills/twilio-sendgrid-email-send/SKILL.md](../../../skills/twilio-sendgrid-email-send/SKILL.md)  ·  **Domain:** [SaaS & Vendor Platform Integrations](../../maps/saas-platforms.md)  ·  **Table:** [skills.base](../../skills.base)  ·  **Index:** [Skills Index](../../index.md)

## Related skills

- [credentials](../../notes/security-auditing/credentials.md) — Instructions for handling API keys and credentials safely, verifying their presence, and prompting the user to add them if missing using a safe protocol
- [email](../../notes/comms-productivity/email.md) — Email sending integration guidance — Resend (native Vercel Marketplace) with React Email templates
- [twilio-email-send](../../notes/saas-platforms/twilio-email-send.md) — Use when the caller has Twilio credentials (Account SID + Auth Token or API Key SID + Secret) and needs to send email via comms.twilio.com/v1/Emails
- [twilio-sendgrid-deliverability-advisor](../../notes/saas-platforms/twilio-sendgrid-deliverability-advisor.md) — Diagnostic and advisory skill for email deliverability problems

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes
