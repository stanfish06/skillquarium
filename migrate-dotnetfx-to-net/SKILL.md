---
name: migrate-dotnetfx-to-net
description: >
  Migrate a .NET Framework (4.x) project or solution to modern .NET (8/9), the
  large cross-runtime jump — not a version bump. USE FOR: ".NET Framework
  migration", "netfx to net", porting net48/net472 to net8.0/net9.0, assessment
  with the .NET Upgrade Assistant / GitHub Copilot app modernization ("modernize
  .NET") / apiport, converting old-style .csproj to SDK-style, "packages.config"
  → <PackageReference>, replacing System.Configuration, "WCF migration" to
  CoreWCF or gRPC, porting System.Web/ASP.NET to ASP.NET Core, multi-targeting
  during transition, and Framework→Core breaking changes (BinaryFormatter,
  ICU globalization, config model). DO NOT USE FOR: bumping between modern .NET
  versions (net8→net9→net10 — use the migrate-dotnetN-to-dotnetN+1 skills),
  greenfield .NET projects, or trimming/AOT concerns (use dotnet-aot-compat).
license: MIT
metadata: {"version": "1.0", "skill-author": "vault-audit"}
---

# .NET Framework (4.x) → Modern .NET (8/9) Migration

Port a .NET Framework project or solution off the Windows-only `netframework` runtime onto modern, cross-platform .NET (currently `net8.0` LTS or `net9.0` STS). This is a re-platforming effort, not an in-place TFM bump: the project system, package model, configuration stack, and several major frameworks (WCF server, ASP.NET/System.Web, WebForms, Remoting) all change or have no direct port. The outcome is a solution that builds on the modern SDK, restores via `<PackageReference>`, and runs its tests green.

## Overview

Work bottom-up through the dependency graph — leaf class libraries first, entry-point apps (web/WinForms/WPF/console) last — so each project migrates against already-migrated dependencies. Prefer **multi-targeting** (`net48;net9.0`) as a transition state: it keeps the app shippable on Framework while you port, and lets you fix cross-runtime issues incrementally behind `#if` guards. Only drop the `net48` target once everything downstream is on modern .NET.

Pick the target TFM deliberately: **`net8.0`** if you want LTS (supported into late 2026) stability; **`net9.0`** for the current release. After landing on modern .NET, subsequent version bumps are a *different, smaller* job — see the disambiguation at the end.

## Assessment & tooling

Assess before touching code. Tooling landscape as of 2026 (.NET 9):

- **GitHub Copilot app modernization ("Modernize")** — Microsoft's current recommended, agent-driven path. Built into **Visual Studio 2026** (or VS 2022 **17.14.17+**) as the "GitHub Copilot app modernization" optional component, and as a VS Code extension. Right-click the solution/project → **Modernize**, or type `@Modernize` in Copilot Chat. Handles assessment, SDK-style conversion, packages.config migration, and can drive WebForms→Blazor and add Aspire. Best for interactive, IDE-based migrations.
- **.NET Upgrade Assistant** (CLI) — now **officially deprecated** in favor of the above, but the global tool still works and is useful for **headless/scripted** assessment and upgrade. It uses `try-convert` under the hood.
  ```bash
  dotnet tool install -g upgrade-assistant
  upgrade-assistant analyze  <path-to.sln-or.csproj>   # report only, no changes
  upgrade-assistant upgrade  <path-to.sln-or.csproj>   # interactive, staged upgrade
  # optionally: --target-tfm-support LTS | Current | Preview
  ```
- **try-convert** — narrowly converts an old-style `.csproj` to SDK-style. Conservative; **not guaranteed** to produce a 100%-working project (it warns you). Good for class libraries; classic ASP.NET/WebForms conversion is *not* officially supported.
  ```bash
  dotnet tool install -g try-convert
  try-convert -p MyLib.csproj      # single project
  try-convert -w MySolution.sln    # whole solution/workspace
  ```
- **API Portability Analyzer / ApiPort (`dotnet-apiport`)** — **deprecated; its backend service is shut down** and it is unsupported in VS 2022+. Do not rely on it for new work. For the API-availability question it used to answer, prefer the Upgrade Assistant/Copilot assessment report, and use the Roslyn **Platform Compatibility Analyzer (`CA1416`)** (on by default since .NET 5) to catch Windows-only API calls after you retarget.

Assessment checklist — flag these blockers up front, since they change the plan:

| Signal | Implication |
|--------|-------------|
| `System.Web` / `Global.asax` / WebForms (`.aspx`) | No direct port. WebForms must be rewritten (Blazor/Razor/MVC); classic ASP.NET → ASP.NET Core. |
| WCF **service host** (`System.ServiceModel` server) | Server side → **CoreWCF** or re-architect to **gRPC**/ASP.NET Core Web API. |
| `System.Runtime.Remoting`, `AppDomain.CreateDomain`, `MarshalByRefObject` | No port. Remoting → gRPC/WCF/HTTP; secondary AppDomains → `AssemblyLoadContext` or separate processes. |
| `BinaryFormatter` | Removed on modern .NET (throws). Must switch serializer. |
| `packages.config` | Convert to `<PackageReference>`. |
| Old-style `.csproj` (has `<Compile Include=...>`, `ToolsVersion`, `.sln`-driven GUIDs) | Convert to SDK-style. |
| `app.config`/`web.config` with `configSections`, binding redirects | Config model changes; redirects are obsolete on modern .NET. |
| `System.Drawing` on non-Windows target | `System.Drawing.Common` is Windows-only on modern .NET. |

## Migration workflow

### Step 1 — Baseline and inventory
Build the solution on .NET Framework and record a green baseline. List every project, its TFM, its `packages.config`/`PackageReference` set, and any assessment-checklist blockers. Confirm the modern SDK is installed (`dotnet --version`) and (for the Copilot path) VS 2026 or VS 2022 17.14.17+.

### Step 2 — Convert each project to SDK-style
SDK-style projects use implicit file globbing (no `<Compile Include>`), `<PackageReference>`, and auto-generated assembly attributes. Convert leaf libraries first with `try-convert -p`, or hand-edit. The shape shrinks dramatically:

```xml
<!-- BEFORE: old-style (excerpt) -->
<Project ToolsVersion="15.0" DefaultTargets="Build"
         xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
  <Import Project="$(MSBuildToolsPath)\Microsoft.CSharp.targets" />
  <PropertyGroup>
    <TargetFrameworkVersion>v4.8</TargetFrameworkVersion>
    <OutputType>Library</OutputType>
  </PropertyGroup>
  <ItemGroup><Compile Include="Foo.cs" /><Compile Include="Bar.cs" /></ItemGroup>
  <ItemGroup><Reference Include="System.Net.Http" /></ItemGroup>
</Project>
```
```xml
<!-- AFTER: SDK-style -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net9.0</TargetFramework>   <!-- or a multi-target set, Step 4 -->
    <!-- if you keep a hand-written AssemblyInfo.cs, avoid duplicate-attribute errors: -->
    <GenerateAssemblyInfo>false</GenerateAssemblyInfo>
  </PropertyGroup>
  <!-- .cs files are globbed automatically; framework assemblies come from the SDK -->
</Project>
```
Delete `AssemblyInfo.cs` (or keep it and set `GenerateAssemblyInfo=false`). Remove `.sln`-level `<ProjectReference>` GUID noise where possible.

### Step 3 — Migrate `packages.config` → `<PackageReference>`
In Visual Studio: right-click the project's **References/packages.config → "Migrate packages.config to PackageReference"**. The Upgrade Assistant and Copilot modernization do this automatically. Manually, move each entry and **delete** `packages.config`:

```xml
<!-- BEFORE: packages.config -->
<packages>
  <package id="Newtonsoft.Json" version="13.0.3" targetFramework="net48" />
</packages>
```
```xml
<!-- AFTER: in the .csproj -->
<ItemGroup>
  <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
</ItemGroup>
```
`PackageReference` is transitive: after migration, remove packages that were only present as transitive dependencies of another package. Consider Central Package Management (`Directory.Packages.props`) if the solution has many projects.

### Step 4 — Multi-target for the transition (recommended)
Keep the app shippable on Framework while porting. Use the **plural** `<TargetFrameworks>` and guard runtime-divergent code:

```xml
<TargetFrameworks>net48;net9.0</TargetFrameworks>
```
```csharp
#if NET48
    // legacy Framework-only path
#else               // NET / NET9_0_OR_GREATER
    // modern .NET path
#endif
```
```xml
<!-- conditional dependency: only the Framework target needs the bridge package -->
<ItemGroup Condition="'$(TargetFramework)' == 'net48'">
  <PackageReference Include="System.Net.Http" Version="4.3.4" />
</ItemGroup>
```

### Step 5 — Replace framework dependencies
Swap Framework-only stacks for their modern equivalents:

| .NET Framework | Modern .NET replacement |
|----------------|-------------------------|
| `System.Configuration.ConfigurationManager` (app.config) | `Microsoft.Extensions.Configuration` (+ `.Json`/`.EnvironmentVariables`) with `appsettings.json`. Bridge package `System.Configuration.ConfigurationManager` (on NuGet) can *temporarily* keep reading `app.config` during transition. |
| WCF **server** (`ServiceHost`) | **CoreWCF** (`CoreWCF.*` packages) for lift-and-shift, or re-architect to **gRPC** / ASP.NET Core Web API. |
| WCF **client** | The `System.ServiceModel.*` client packages (Primitives/Http/NetTcp) on NuGet — supported on modern .NET. |
| `System.Web` / ASP.NET MVC / Web API | **ASP.NET Core**. For large apps, migrate incrementally with **`Microsoft.AspNetCore.SystemWebAdapters`** + YARP (run Framework and Core side-by-side, route by route). |
| ASP.NET **WebForms** (`.aspx`) | **No port.** Rewrite as Blazor, Razor Pages, or MVC. (Copilot modernization has a WebForms→Blazor path.) |
| `.NET Remoting`, secondary `AppDomain`s | **No port.** Remoting → gRPC/HTTP/CoreWCF; AppDomain isolation → `AssemblyLoadContext` (load/unload) or separate processes. |
| `BinaryFormatter` | See Gotchas — pick `System.Text.Json`, `DataContractSerializer`, MessagePack, or protobuf. |

### Step 6 — Retarget, build, and fix
Once dependencies are resolved and (if used) the `net48` target is dropped, build against modern .NET and work through errors: `dotnet build`. Resolve Windows-only API usage surfaced by `CA1416`, replace removed APIs, and adjust config/globalization behavior (Gotchas). Web/WinForms/WPF entry points move to a `Program.cs` host (`Global.asax`/`Startup` → minimal hosting).

### Step 7 — Verify
`dotnet build` clean, `dotnet test` green. Smoke-test config loading, serialization round-trips, culture-sensitive formatting/sorting, and any Windows-specific features on the actual target OS. If you were multi-targeting, confirm the `net48` target is gone and no `#if NET48` dead code remains.

## Gotchas / breaking changes

- **`BinaryFormatter` is gone.** It was progressively disabled and is removed on modern .NET (usage throws at runtime; the `System.Runtime.Serialization.Formatters` compat shim also throws by default). There is no safe re-enable for production. Re-serialize to `System.Text.Json`, `DataContractSerializer`/`XmlSerializer`, MessagePack, or protobuf — and note the wire format changes, so persisted/queued blobs need a migration story.
- **Globalization uses ICU, not NLS.** Modern .NET uses ICU on all platforms instead of Windows NLS, so string comparison, sorting, casing, and culture data differ from Framework. This silently changes ordering and equality results. Test culture-sensitive code; if you must match legacy Windows behavior, opt into NLS on Windows via runtimeconfig `System.Globalization.UseNls=true`. Beware `InvariantGlobalization=true` (common in containers) — it collapses all cultures to invariant.
- **Configuration model changed.** No `System.Configuration` `ConfigurationManager.AppSettings`/custom `configSections` by default, and **`app.config` binding redirects are obsolete** (the SDK resolves versions). Move to `appsettings.json` + `Microsoft.Extensions.Configuration`, or use the `System.Configuration.ConfigurationManager` NuGet bridge as a stopgap.
- **Code-page encodings aren't registered by default.** `Encoding.GetEncoding(1252)` and other non-UTF encodings throw until you add `System.Text.Encoding.CodePages` and call `Encoding.RegisterProvider(CodePagesEncodingProvider.Instance)` at startup.
- **`System.Drawing.Common` is Windows-only** on modern .NET (throws `PlatformNotSupportedException` elsewhere). For cross-platform imaging use ImageSharp, SkiaSharp, or similar.
- **Windows-only APIs surface as `CA1416` warnings** after retargeting (registry, WMI, event log, ACLs). Guard with `OperatingSystem.IsWindows()` or annotate; move genuinely Windows-only projects to a `net9.0-windows` TFM.
- **Entry points move.** `Global.asax`, `Startup`, and `Web.config`-driven pipelines become `Program.cs` minimal hosting; WinForms/WPF need `<UseWindowsForms>`/`<UseWPF>` and a `net9.0-windows` TFM.
- **No more `App.config` assembly binding / GAC.** Dependencies are private per-app; there is no Global Assembly Cache. Native/interop dependencies ship alongside the app.

## Use this vs related skills

Use this skill for the one-time Framework→modern jump; then use the version-bump skills **`migrate-dotnet8-to-dotnet9` / `migrate-dotnet9-to-dotnet10` / `migrate-dotnet10-to-dotnet11`** for subsequent moves once already on modern .NET, **`migrate-nullable-references`** to adopt NRTs, and **`dotnet-aot-compat`** for downstream trimming/Native-AOT hardening.

## References

- [Overview of porting from .NET Framework to .NET](https://learn.microsoft.com/dotnet/core/porting/)
- [GitHub Copilot app modernization for .NET](https://learn.microsoft.com/dotnet/core/porting/github-copilot-app-modernization/overview)
- [.NET Upgrade Assistant overview](https://learn.microsoft.com/dotnet/core/porting/upgrade-assistant-overview)
- [Port from packages.config to PackageReference](https://learn.microsoft.com/nuget/consume-packages/migrate-packages-config-to-package-reference)
- [Breaking changes for migration from .NET Framework to .NET](https://learn.microsoft.com/dotnet/core/compatibility/fx-core)
- [CoreWCF](https://github.com/CoreWCF/CoreWCF) · [Incremental ASP.NET → ASP.NET Core (System.Web adapters)](https://learn.microsoft.com/aspnet/core/migration/inc/overview)
