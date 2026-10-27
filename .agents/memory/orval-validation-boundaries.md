---
name: Orval runtime validation boundaries
description: Generated Zod parsers can drop open record fields and omit integer enforcement on nullable numeric schemas.
---

Do not assume a generated Zod parser is a lossless decoder for an OpenAPI DTO
with additional properties. Validate required fields, but preserve the original
trusted server DTO when its documented open fields carry editable content.
Enforce integer-only constraints explicitly at paid-work boundaries where the
generated validator does not do so.

**Why:** The workspace's Orval-generated schemas stripped open expedition and
stage fields, and accepted a fractional nullable walking-day allowance despite
the OpenAPI integer declaration. Type checks alone did not catch either issue.

**How to apply:** Use boundary regression tests with the actual generated
validator: assert full editable response fields survive serialization and
malformed numerical inputs fail before provider calls. Do not hand-edit generated
files; keep the contract and deliberate server-side checks aligned.
