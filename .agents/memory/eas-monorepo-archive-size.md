---
name: EAS monorepo archive size
description: Why SummitReady needs repository-level EAS exclusions before mobile builds.
---

Keep the repository-level EAS ignore rules when launching SummitReady builds from the monorepo. Build context includes tracked files from the Git root, not only the Expo artifact directory.

**Why:** Two large tracked Git backup bundles and terrain datasets expanded the EAS archive to roughly 1.4 GB. Android uploaded, but local iOS archive creation repeatedly failed with system write error -122. Excluding unrelated assets reduced the archive to about 79 MB and iOS registered successfully.

**How to apply:** Before future EAS builds, preserve exclusions for backup bundles, attached assets, terrain-engine data, local caches, and unrelated artifacts while retaining root workspace manifests, shared libraries, and the SummitReady artifact.