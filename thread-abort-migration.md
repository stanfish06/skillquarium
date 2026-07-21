---
title: thread-abort-migration
aliases:
  - thread abort migration
tags:
  - skill
  - domain/dotnet-development
domain: dotnet-development
status: untried
source: thread-abort-migration/SKILL.md
created: 2026-07-21
---

# thread-abort-migration

> [!info] What it does
> Guides migration of .NET Framework Thread.Abort usage to cooperative cancellation in modern .NET. USE FOR: modernizing code that calls Thread.Abort, catching ThreadAbortException, replacing Thread.ResetAbort, replacing Thread.Interrupt for thread termination, resolving PlatformNotSupportedException or SYSLIB0006 after retargeting to .NET 6+, migrating ASP.NET Response.End or Response.Redirect(url, true) which internally call Thread.Abort. DO NOT USE FOR: code that only uses Thread.Join, Thread.Sleep, or Thread.Start without any abort, interrupt, or ThreadAbortException usage — these APIs work identically in modern .NET and need no migration. Also not for projects staying on .NET Framework, or Thread.Abort usage inside third-party libraries you do not control.

**Source:** [thread-abort-migration/SKILL.md](thread-abort-migration/SKILL.md)  ·  **Domain:** [.NET & C# Development](maps/dotnet-development.md)  ·  **Table:** [skills.base](skills.base)  ·  **Index:** [Skills Index](index.md)

## Related skills

_None auto-detected. Add your own links here, e.g. `[scanpy](scanpy.md)`._

%% ---8<--- personal notes below are preserved on re-run ---8<--- %%

## Notes

