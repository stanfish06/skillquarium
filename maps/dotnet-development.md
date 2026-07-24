---
title: .NET & C# Development
tags:
  - skill-map
created: 2026-07-21
---

# .NET & C# Development

> [!abstract] Scope
> The official dotnet/skills catalog: C# language/runtime tooling, MSBuild build performance and modernization, .NET/xUnit/MSTest testing and migration, ASP.NET Core and Blazor web development, .NET MAUI mobile/desktop, EF Core, native interop, crash/performance diagnostics, project templates, and cross-version migration.

[Back to Skill Index](../index.md)

**Related maps:** [Software Development & Engineering](software-dev.md) | [Cloud, Infra & MLOps](cloud-devops.md) | [Web Automation, Frontend & Design](web-automation-frontend.md) | [Security & Auditing](security-auditing.md)

## Skills (101)

- [analyzing-dotnet-performance](../analyzing-dotnet-performance.md) — Scans .NET code for ~50 performance anti-patterns across async, memory, strings, collections, LINQ, regex, serialization, and I/O with tiered severity classification
- [android-tombstone-symbolication](../android-tombstone-symbolication.md) — Symbolicate the .NET runtime frames in an Android tombstone file
- [apple-crash-symbolication](../apple-crash-symbolication.md) — Symbolicate .NET runtime frames in Apple platform .ips crash logs (iOS, tvOS, Mac Catalyst, macOS)
- [assertion-quality](../assertion-quality.md) — Analyzes the variety and depth of assertions across test suites in any language
- [author-component](../author-component.md) — Create or review Blazor components (.razor files) with correct architecture
- [authoring-github-workflows](../authoring-github-workflows.md) — Author and review GitHub Actions workflow YAML safely so syntactically-valid YAML can't ship a workflow that GitHub Actions refuses to run
- [binlog-failure-analysis](../binlog-failure-analysis.md) — Analyze MSBuild binary logs to diagnose build failures
- [binlog-generation](../binlog-generation.md) — Generate MSBuild binary logs (binlogs) for build diagnostics and analysis
- [build-parallelism](../build-parallelism.md) — Diagnose and fix under-parallelized MSBuild builds
- [build-perf-baseline](../build-perf-baseline.md) — Establish build performance baselines and apply systematic optimization techniques
- [build-perf-diagnostics](../build-perf-diagnostics.md) — Diagnose MSBuild build performance bottlenecks using binary log analysis
- [check-bin-obj-clash](../check-bin-obj-clash.md) — Detects MSBuild projects with conflicting OutputPath or IntermediateOutputPath
- [clr-activation-debugging](../clr-activation-debugging.md) — Diagnoses .NET Framework CLR activation issues using CLR activation logs (CLRLoad logs) produced by mscoree.dll
- [code-testing-agent](../code-testing-agent.md) — Generates and writes new unit tests for any programming language — scaffolds test projects and configures coverage tooling (coverlet, pytest-cov, @vitest/coverage-v8) as part of test...
- [code-testing-extensions](../code-testing-extensions.md) — Provides file paths to language-specific extension files for the code-testing pipeline
- [collect-user-input](../collect-user-input.md) — Build forms, validate data, and react to user input in Blazor
- [configure-auth](../configure-auth.md) — Add authentication and authorization to a Blazor Web App, accounting for the app's render mode
- [configuring-opentelemetry-dotnet](../configuring-opentelemetry-dotnet.md) — Configure OpenTelemetry distributed tracing, metrics, and logging in ASP.NET Core using the .NET OpenTelemetry SDK
- [convert-blazor-server-to-webapp](../convert-blazor-server-to-webapp.md) — Guides conversion of a pre-.NET 8 Blazor Server app into a .NET 8+ Blazor Web App
- [convert-to-cpm](../convert-to-cpm.md) — Convert .NET projects and solutions (.sln, .slnx) to NuGet Central Package Management (CPM) using Directory.Packages.props
- [coordinate-components](../coordinate-components.md) — Share state between components that don't have a direct parent-child parameter relationship, using cascading values, scoped services with change events, or CascadingValueSource via DI
- [copy-to-output-directory](../copy-to-output-directory.md) — Choosing an MSBuild CopyToOutputDirectory / CopyToPublishDirectory mode: Never, PreserveNewest, Always, and IfDifferent (MSBuild 17.13+), plus $(SkipUnchangedFilesOnCopyAlways)
- [crap-score](../crap-score.md) — Calculates targeted CRAP (Change Risk Anti-Patterns) scores for a named .NET method, class, or single source file
- [create-blazor-project](../create-blazor-project.md) — Create a new ASP.NET Core web application or web site using Blazor
- [csharp-scripts](../csharp-scripts.md) — Run file-based C# apps with the .NET CLI when the user explicitly wants C#/.NET code without creating a project
- [detect-static-dependencies](../detect-static-dependencies.md) — Scan C# source files for hard-to-test static dependencies — DateTime.Now/UtcNow, File.*, Directory.*, Environment.*, HttpClient, Console.*, Process.*, and other untestable statics
- [directory-build-organization](../directory-build-organization.md) — Guide for organizing MSBuild infrastructure with Directory.Build.props, Directory.Build.targets, Directory.Packages.props, and Directory.Build.rsp
- [dotnet-aot-compat](../dotnet-aot-compat.md) — Make .NET projects compatible with Native AOT and trimming by systematically resolving IL trim/AOT analyzer warnings
- [dotnet-coverage-analysis](../dotnet-coverage-analysis.md) — Project-wide code coverage and CRAP (Change Risk Anti-Patterns) score analysis for .NET projects
- [dotnet-maui-doctor](../dotnet-maui-doctor.md) — Diagnoses and fixes .NET MAUI development environment issues
- [dotnet-pinvoke](../dotnet-pinvoke.md) — Correctly call native (C/C++) libraries from .NET using P/Invoke and LibraryImport
- [dotnet-trace-collect](../dotnet-trace-collect.md) — Guide developers through capturing diagnostic artifacts to diagnose production .NET performance issues
- [dotnet-webapi](../dotnet-webapi.md) — Guides creation and modification of ASP.NET Core Web API endpoints with correct HTTP semantics, OpenAPI metadata, and error handling
- [dump-collect](../dump-collect.md) — Configure and collect crash dumps for modern .NET applications
- [eval-performance](../eval-performance.md) — Guide for diagnosing and improving MSBuild project evaluation performance
- [exp-mock-usage-analysis](../exp-mock-usage-analysis.md) — Audits .NET test mock usage by tracing each mock setup through the production code's execution path to find dead, unreachable, redundant, or replaceable mocks
- [exp-simd-vectorization](../exp-simd-vectorization.md) — Optimizes hot-path scalar loops in .NET 8+ with cross-platform Vector128/Vector256/Vector512 SIMD intrinsics, or replaces manual math loops with single TensorPrimitives API calls
- [exp-test-maintainability](../exp-test-maintainability.md) — Detects duplicate boilerplate, copy-paste tests, and structural maintainability issues across .NET test suites
- [extension-points](../extension-points.md) — Guide for MSBuild extensibility: CustomBefore/CustomAfter hooks, wildcard imports with alphabetic ordering, import gating with control properties, NuGet package build extension layout...
- [fetch-and-send-data](../fetch-and-send-data.md) — Call APIs, load data into components, and handle the async lifecycle in Blazor
- [filter-syntax](../filter-syntax.md) — Reference data for test filter syntax across all platform and framework combinations: VSTest --filter expressions, MTP filters for MSTest/NUnit/xUnit v3/TUnit, and VSTest-to-MTP filter...
- [find-untested-sources](../find-untested-sources.md) — Parse-only static analysis that pairs source files with the tests referencing them and emits JSON listing untested files ordered by API surface, each with a suggested_test_path
- [generate-testability-wrappers](../generate-testability-wrappers.md) — Generate wrapper interfaces and DI registration for hard-to-test static dependencies in C#, when the abstraction does NOT exist yet
- [grade-tests](../grade-tests.md) — Grades a specified set of test methods individually and produces a concise table mapping each test (fully-qualified name) to a letter grade (A–F), a score band, and a one-line note —...
- [including-generated-files](../including-generated-files.md) — Fix MSBuild targets that generate files during the build but those files are missing from compilation or output
- [incremental-build](../incremental-build.md) — Guide for optimizing MSBuild incremental builds
- [item-management](../item-management.md) — Patterns for managing MSBuild item groups: Include/Remove/Update semantics, item metadata, batching with %(Metadata), transforms, per-item filtering, and cross-product batching pitfalls
- [maui-app-lifecycle](../maui-app-lifecycle.md) — .NET MAUI app lifecycle guidance — the four app states, cross-platform Window lifecycle events (Created, Activated, Deactivated, Stopped, Resumed, Destroying), platform-specific...
- [maui-collectionview](../maui-collectionview.md) — Guidance for implementing CollectionView in .NET MAUI apps — data display, layouts (list & grid), selection, grouping, scrolling, empty views, templates, incremental loading, swipe...
- [maui-data-binding](../maui-data-binding.md) — Guidance for .NET MAUI XAML and C# data bindings — compiled bindings, INotifyPropertyChanged / ObservableObject, value converters, binding modes, multi-binding, relative bindings...
- [maui-dependency-injection](../maui-dependency-injection.md) — Guidance for configuring dependency injection in .NET MAUI apps — service registration in MauiProgram.cs, lifetime selection (Singleton / Transient / Scoped), constructor injection...
- [maui-safe-area](../maui-safe-area.md) — .NET MAUI safe area and edge-to-edge layout guidance for .NET 10+
- [maui-shell-navigation](../maui-shell-navigation.md) — Guide for implementing Shell-based navigation in .NET MAUI apps
- [maui-theming](../maui-theming.md) — Guide for theming .NET MAUI apps — light/dark mode via AppThemeBinding, ResourceDictionary theme switching, DynamicResource bindings, system theme detection, and user theme preferences
- [mcp-csharp-create](../mcp-csharp-create.md) — Create MCP servers using the C# SDK and .NET project templates
- [mcp-csharp-debug](../mcp-csharp-debug.md) — Run and debug C# MCP servers locally. Covers IDE configuration, MCP Inspector testing, GitHub Copilot Agent Mode integration, logging setup, and troubleshooting
- [mcp-csharp-publish](../mcp-csharp-publish.md) — Publish and deploy C# MCP servers. Covers NuGet packaging for stdio servers, Docker containerization for HTTP servers, Azure Container Apps and App Service deployment, and publishing...
- [mcp-csharp-test](../mcp-csharp-test.md) — Test C# MCP servers at multiple levels: unit tests for individual tools and integration tests using the MCP client SDK
- [microbenchmarking](../microbenchmarking.md) — Activate this skill when BenchmarkDotNet (BDN) is involved in the task — creating, running, configuring, or reviewing BDN benchmarks
- [migrate-dotnet10-to-dotnet11](../migrate-dotnet10-to-dotnet11.md) — Migrate a .NET 10 project or solution to .NET 11 and resolve all breaking changes
- [migrate-dotnet8-to-dotnet9](../migrate-dotnet8-to-dotnet9.md) — Migrate a .NET 8 project to .NET 9 and resolve all breaking changes
- [migrate-dotnet9-to-dotnet10](../migrate-dotnet9-to-dotnet10.md) — Migrate a .NET 9 project or solution to .NET 10 and resolve all breaking changes
- [migrate-dotnetfx-to-net](../migrate-dotnetfx-to-net.md) — Migrate a .NET Framework (4.x) project or solution to modern .NET (8/9), the large cross-runtime jump — not a version bump
- [migrate-mstest-v1v2-to-v3](../migrate-mstest-v1v2-to-v3.md) — Migrate MSTest v1 or v2 test projects to MSTest v3
- [migrate-mstest-v3-to-v4](../migrate-mstest-v3-to-v4.md) — Fix build errors and breaking changes after upgrading MSTest from v3 to v4, or plan a complete MSTest v3-to-v4 migration
- [migrate-nullable-references](../migrate-nullable-references.md) — Enable nullable reference types in a C# project and systematically resolve all warnings
- [migrate-static-to-wrapper](../migrate-static-to-wrapper.md) — Replace existing static dependency call sites with a wrapper or built-in abstraction that already exists or is registered in DI
- [migrate-vstest-to-mtp](../migrate-vstest-to-mtp.md) — Migrates .NET test projects from VSTest to Microsoft.Testing.Platform (MTP)
- [migrate-xunit-to-mstest](../migrate-xunit-to-mstest.md) — Convert .NET test projects from xUnit.net v2 or v3 to MSTest v4
- [migrate-xunit-to-xunit-v3](../migrate-xunit-to-xunit-v3.md) — Migrates .NET test projects from xUnit.net v2 to xUnit.net v3
- [minimal-api-file-upload](../minimal-api-file-upload.md) — File upload endpoints in ASP.NET minimal APIs (.NET 8+)
- [msbuild-antipatterns](../msbuild-antipatterns.md) — Detect and fix MSBuild anti-patterns in project and build files
- [msbuild-modernization](../msbuild-modernization.md) — Guide for modernizing and migrating MSBuild project files to SDK-style format
- [msbuild-server](../msbuild-server.md) — Guide for using MSBuild Server to improve CLI build performance
- [mtp-hot-reload](../mtp-hot-reload.md) — Suggests using Microsoft Testing Platform (MTP) hot reload to iterate fixes on failing tests without rebuilding
- [nuget-trusted-publishing](../nuget-trusted-publishing.md) — Set up NuGet trusted publishing (OIDC) on a GitHub Actions repo — replaces long-lived API keys with short-lived tokens
- [optimizing-ef-core-queries](../optimizing-ef-core-queries.md) — Optimize Entity Framework Core queries by fixing N+1 problems, choosing correct tracking modes, using compiled queries, and avoiding common performance traps
- [plan-ui-change](../plan-ui-change.md) — Plan complex Blazor UI features by decomposing them into focused components
- [platform-detection](../platform-detection.md) — Reference data for detecting the test platform (VSTest vs Microsoft.Testing.Platform) and test framework (MSTest, xUnit, NUnit, TUnit) from project files
- [property-patterns](../property-patterns.md) — MSBuild property definition patterns: conditional defaults, composition/concatenation, path normalization, trailing-slash handling, TFM detection helpers, and evaluation order
- [resolve-project-references](../resolve-project-references.md) — Guide for interpreting ResolveProjectReferences time in MSBuild performance summaries
- [run-tests](../run-tests.md) — Recommend or run the exact `dotnet test` command
- [setup-local-sdk](../setup-local-sdk.md) — Install a .NET SDK locally for safe preview testing, specific-version pinning, or reproducible team setups — without modifying the system-wide installation
- [support-prerendering](../support-prerendering.md) — Make interactive Blazor components work correctly with prerendering
- [system-text-json-net11](../system-text-json-net11.md) — Provides guidance on new System.Text.Json APIs introduced in .NET 11
- [target-authoring](../target-authoring.md) — Canonical patterns for writing custom MSBuild targets
- [technology-selection](../technology-selection.md) — Guides technology selection and implementation of AI and ML features in .NET 8+ applications using ML.NET, Microsoft.Extensions.AI (MEAI), Microsoft Agent Framework (MAF), GitHub...
- [template-authoring](../template-authoring.md) — Guides creation and validation of custom dotnet new templates from existing projects
- [template-comparison](../template-comparison.md) — Compares two or more dotnet new templates side by side to help users choose between them based on parameters, feature support, frameworks, and classifications
- [template-discovery](../template-discovery.md) — Helps find, inspect, and compare (at a high level) .NET project templates
- [template-instantiation](../template-instantiation.md) — Creates .NET projects from templates with validated parameters, smart defaults, Central Package Management adaptation, and latest NuGet version resolution
- [template-smart-defaults](../template-smart-defaults.md) — Applies cross-parameter default rules when creating .NET projects with dotnet new, filling gaps consistently without overriding values the user set explicitly
- [template-validation](../template-validation.md) — Validates custom dotnet new templates for correctness before publishing
- [test-analysis-extensions](../test-analysis-extensions.md) — Provides file paths to language-specific reference files for the test ANALYSIS skills (assertion-quality, test-anti-patterns, test-gap-analysis, test-smell-detection, test-tagging)
- [test-anti-patterns](../test-anti-patterns.md) — Audits an existing test file or suite in any language for anti-patterns and quality issues — produces a severity-ranked report (Critical/Warning/Info)
- [test-gap-analysis](../test-gap-analysis.md) — Performs pseudo-mutation analysis on production code in any language to find gaps in existing tests
- [test-smell-detection](../test-smell-detection.md) — Deep-dive audit using the full testsmells.org 19-smell academic catalog for tests in any language
- [test-tagging](../test-tagging.md) — Analyzes test suites in any language and tags each test with standardized traits (positive, negative, critical-path, boundary, smoke, regression, integration, performance, security)
- [thread-abort-migration](../thread-abort-migration.md) — Guides migration of .NET Framework Thread.Abort usage to cooperative cancellation in modern .NET
- [use-js-interop](../use-js-interop.md) — Add, review, or fix JavaScript interop in Blazor components
- [writing-mstest-tests](../writing-mstest-tests.md) — Write, create, modernize, or fix comprehensive MSTest unit tests with MSTest 3.x/4.x APIs
