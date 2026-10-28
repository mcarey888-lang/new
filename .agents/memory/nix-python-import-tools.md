---
name: Nix Python import tools
description: Avoid unwanted project bootstrapping for one-off geospatial imports.
---

For one-off OSM imports in this workspace, prefer the packaged `osmium-tool`
CLI with standard-library orchestration rather than adding a root Python app.

**Why:** The Python package installer attempted an immutable Nix site-packages
write and failed, while also creating unrelated root Python project boilerplate.
The system CLI installed successfully without introducing another application.

**How to apply:** Follow the package-management instructions; after a failed
language installation inspect and remove only its unintended boilerplate.
Do not create virtual environments or replace the existing pnpm structure to
support a temporary data-processing command.
