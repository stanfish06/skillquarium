---
name: terraform
description: Terraform and OpenTofu infrastructure-as-code (IaC) — declare cloud/SaaS resources in HCL, manage state with remote backends and locking, author and consume modules, and run the init/plan/apply/destroy lifecycle. Use whenever the user mentions Terraform, OpenTofu, the tofu CLI, IaC, "infrastructure as code", provisioning cloud resources, .tf/HCL files, tfstate/backends, providers, modules, workspaces, drift, or importing existing infrastructure. For AWS-only IaC written in a general-purpose language (TypeScript/Python) via CloudFormation, prefer aws-cdk-development instead.
license: MIT
metadata: {"version": "1.0", "skill-author": "vault-audit"}
---

# Terraform / OpenTofu

## Overview

Terraform is a declarative infrastructure-as-code tool: you describe desired resources in HCL (`.tf` files), and Terraform computes and applies the diff against real infrastructure via provider plugins. It works across AWS, GCP, Azure, Kubernetes, and hundreds of other APIs (Cloudflare, GitHub, Datadog, etc.).

**OpenTofu** is a drop-in open-source fork of Terraform under the Linux Foundation (MPL 2.0), created after HashiCorp relicensed Terraform to the BSL in 2023. It reads the same `.tf` files and state format; you just run `tofu` instead of `terraform`. Everything in this skill applies to both unless noted. OpenTofu has since shipped features Terraform lacks (notably client-side **state encryption**).

Use this skill when you need to provision, change, or tear down infrastructure reproducibly; manage `tfstate`; write reusable modules; detect drift; or import existing resources under management.

## Installation

Current stable as of mid-2026: **Terraform ~1.15.x** (1.16 in development) and **OpenTofu ~1.12.x**. HCL and the core CLI are stable across the 1.x line, so the workflow below is version-agnostic; check release notes for exact newest.

```bash
# macOS (Homebrew)
brew install terraform          # or: brew install opentofu

# Linux — download the pinned release and put the single binary on PATH
# Terraform:  https://developer.hashicorp.com/terraform/install
# OpenTofu:   https://opentofu.org/docs/intro/install/ (has an install script + apt/dnf repos)

terraform version     # or: tofu version
```

Pin the tool version per project with `required_version` (below) and commit `.terraform.lock.hcl` (the provider dependency lock) to Git so everyone resolves identical provider builds.

## Core workflow

### 1. Root config: terraform block, provider, resource, data source

```hcl
# main.tf
terraform {
  required_version = ">= 1.9"
  required_providers {
    aws = {
      source  = "hashicorp/aws"   # registry.terraform.io / registry.opentofu.org
      version = "~> 5.0"          # pessimistic constraint: >=5.0, <6.0
    }
  }
}

provider "aws" {
  region = var.region
}

# A managed resource
resource "aws_s3_bucket" "assets" {
  bucket = "acme-${var.env}-assets"
  tags   = local.common_tags
}

# A data source: read something Terraform does NOT manage
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
}
```

Reference attributes as `aws_s3_bucket.assets.arn` or `data.aws_ami.ubuntu.id`. Do not invent argument names — every provider's exact schema is in its registry docs (e.g. `registry.terraform.io/providers/hashicorp/aws/latest/docs`).

### 2. The lifecycle

```bash
terraform init                 # download providers + configure backend (run after any provider/backend change)
terraform init -upgrade        # bump providers within version constraints, rewrite lock file
terraform fmt -recursive       # canonical formatting
terraform validate             # static/type checks (no API calls)
terraform plan -out=tfplan     # compute diff; save it so apply matches exactly
terraform apply tfplan         # apply the saved plan (no re-plan, no prompt)
terraform apply -auto-approve  # plan + apply in one step (CI/dev only)
terraform destroy              # tear down everything in state
terraform output               # print root outputs (add -json for machine use)
```

### 3. Remote backend + state locking

State is Terraform's record of managed resources. Keep it in a shared, encrypted, **locked** backend — never on a laptop, never in Git.

```hcl
# S3 (native locking via a lock file, Terraform 1.10+ / OpenTofu 1.11+)
terraform {
  backend "s3" {
    bucket       = "acme-tf-state"
    key          = "prod/network.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true   # replaces the old dynamodb_table lock; that arg is deprecated
  }
}
```

```hcl
# GCS
backend "gcs" {
  bucket = "acme-tf-state"
  prefix = "prod/network"
}
```

```hcl
# Azure (azurerm) — uses blob leases for locking automatically
backend "azurerm" {
  resource_group_name  = "tfstate-rg"
  storage_account_name = "acmetfstate"
  container_name       = "tfstate"
  key                  = "prod.network.tfstate"
}
```

Backend blocks cannot use variables; supply per-environment values with `terraform init -backend-config=prod.s3.tfbackend`. State ops: `terraform state list`, `state show <addr>`, `state mv`, `state rm`, `terraform force-unlock <LOCK_ID>` (only if a lock is truly stale).

### 4. Variables, outputs, locals

```hcl
variable "env" {
  type        = string
  description = "Deployment environment"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.env)
    error_message = "env must be dev, staging, or prod."
  }
}

variable "db_password" {
  type      = string
  sensitive = true   # redacted in CLI output (still stored in state — see gotchas)
}

locals {
  common_tags = { Project = "acme", ManagedBy = "terraform" }
}

output "bucket_arn" {
  value = aws_s3_bucket.assets.arn
}
```

Set variables via `-var`, a `*.tfvars` file (`-var-file=prod.tfvars`, and `terraform.tfvars`/`*.auto.tfvars` load automatically), or env vars `TF_VAR_env=prod`.

### 5. Modules — consume and author

```hcl
# Consume a registry module (pin the version!)
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.13.0"

  name = "acme-prod"
  cidr = "10.0.0.0/16"
}
# outputs: module.vpc.vpc_id
```

A module is just a directory of `.tf` files. Conventional layout: `main.tf`, `variables.tf`, `outputs.tf`, `versions.tf`. Reference a local one with `source = "./modules/network"` or a git module with `source = "git::https://github.com/org/repo.git//subdir?ref=v1.2.0"`. Consumers pass values to your `variable`s and read your `output`s. Publish to the public/private registry with the `terraform-<PROVIDER>-<NAME>` repo naming convention and semver git tags.

### 6. Workspaces (multiple states, one config)

```bash
terraform workspace new dev
terraform workspace select dev     # each workspace = a separate state file
terraform workspace list
```

Reference the active one with `terraform.workspace`. CLI workspaces are best for small variations of the *same* config; for real environment isolation, prefer separate root directories/state keys (smaller blast radius, independent provider/backend config).

### 7. Drift detection

```bash
terraform plan -refresh-only     # show out-of-band changes vs. state, propose nothing
terraform apply -refresh-only    # reconcile state to reality without changing infra
```

### 8. Import existing infrastructure and refactor

```hcl
# import block (Terraform 1.5+): declarative, plannable, reviewable
import {
  to = aws_s3_bucket.assets
  id = "acme-prod-assets"
}
# then: terraform plan -generate-config-out=generated.tf   (scaffolds the resource HCL)

# moved block: rename/move a resource in config WITHOUT destroy+recreate
moved {
  from = aws_instance.web
  to   = aws_instance.frontend
}

# removed block (Terraform 1.7+): drop a resource from state but leave it alive
removed {
  from = aws_s3_bucket.legacy
  lifecycle { destroy = false }
}
```

The one-shot CLI equivalent of import is `terraform import aws_s3_bucket.assets acme-prod-assets`.

### 9. OpenTofu-specific: state encryption

OpenTofu can encrypt state and plan files client-side (Terraform cannot natively):

```hcl
terraform {
  encryption {
    key_provider "pbkdf2" "k" { passphrase = var.state_passphrase }  # pass via TF_VAR_, never literal
    method "aes_gcm" "m" { keys = key_provider.pbkdf2.k }
    state { method = method.aes_gcm.m }
    plan  { method = method.aes_gcm.m }
  }
}
```

## Gotchas / best practices

- **State holds secrets in plaintext.** DB passwords, private keys, and tokens land in `tfstate` even when a variable/output is marked `sensitive` (that only redacts CLI output). Use an encrypted, access-controlled remote backend (bucket policy/IAM), and OpenTofu state encryption if you can. Never commit `*.tfstate`.
- **Don't overuse `-target`.** It's a recovery escape hatch, not a workflow: it applies a partial graph, skips dependency resolution, and leaves state inconsistent. If you reach for it routinely, split the config into smaller root modules instead.
- **Never hand-edit state.** Use `terraform state mv/rm`, or `moved`/`import`/`removed` blocks. Manual JSON edits corrupt it silently.
- **Pin versions and commit the lock.** Pin `required_version`, use `~>` provider constraints, and commit `.terraform.lock.hcl` for reproducible builds across machines/CI.
- **Plan then apply the saved file in CI** (`plan -out` → `apply tfplan`) so what gets applied is exactly what was reviewed.
- **Protect critical resources**: `lifecycle { prevent_destroy = true }`; for zero-downtime replacement use `create_before_destroy = true`.
- **Secrets should flow through data sources / env vars** (Vault, AWS/GCP secret managers) rather than hardcoded literals — but remember anything read still enters state.
- **Drift happens** when people click in consoles. Run `plan -refresh-only` on a schedule to catch it early.
- **Keep blast radius small**: many small states with clear boundaries beat one giant monolith; share values via published outputs or the `terraform_remote_state` data source.

## Use this vs related skills

Use **terraform** for multi-cloud/provider-agnostic HCL IaC; use **aws-cdk-development** when the infrastructure is AWS-only and authored in a general-purpose language (TypeScript/Python) that synthesizes to CloudFormation.

## Resources

- Terraform docs: https://developer.hashicorp.com/terraform/docs — Registry (provider/module schemas): https://registry.terraform.io
- OpenTofu docs: https://opentofu.org/docs/ — Registry: https://registry.opentofu.org
- Language reference (blocks, functions, expressions): https://developer.hashicorp.com/terraform/language
