#!/usr/bin/env python3
"""Read-only checks for the app-owned Apple privacy declarations."""
import json
import plistlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / "app.json").read_text())["expo"]["ios"]["privacyManifests"]
expected = {
    "PreciseLocation", "CoarseLocation", "Name", "EmailAddress", "UserID",
    "Fitness", "PhotosorVideos", "OtherUserContent", "PurchaseHistory",
    "ProductInteraction", "CustomerSupport", "OtherDiagnosticData", "DeviceID",
}
entries = manifest["NSPrivacyCollectedDataTypes"]
by_type = {entry["NSPrivacyCollectedDataType"]: entry for entry in entries}
assert len(by_type) == len(entries), "Duplicate data category"
assert set(by_type) == {"NSPrivacyCollectedDataType" + name for name in expected}
assert not manifest["NSPrivacyTracking"]
assert manifest["NSPrivacyTrackingDomains"] == []
for entry in entries:
    assert entry["NSPrivacyCollectedDataTypeLinked"] is True
    assert entry["NSPrivacyCollectedDataTypeTracking"] is False
    assert entry["NSPrivacyCollectedDataTypePurposes"], "Every category needs a purpose"
for name in ("UserID", "PurchaseHistory"):
    assert "NSPrivacyCollectedDataTypePurposeAnalytics" in by_type["NSPrivacyCollectedDataType" + name]["NSPrivacyCollectedDataTypePurposes"]
for name in ("Fitness", "OtherUserContent"):
    assert "NSPrivacyCollectedDataTypePurposeProductPersonalization" in by_type["NSPrivacyCollectedDataType" + name]["NSPrivacyCollectedDataTypePurposes"]
assert len(manifest["NSPrivacyAccessedAPITypes"]) == 3
print("PASS: 13 unique account-linked categories, purposes and non-tracking app declaration")

native_path = ROOT / "ios/SummitReady/PrivacyInfo.xcprivacy"
if native_path.exists():
    assert plistlib.loads(native_path.read_bytes()) == manifest, "Expo/native manifest mismatch"
    print("PASS: generated native plist matches canonical Expo declaration exactly")
else:
    print("SKIP: generated native plist absent; canonical Expo declaration checked")

policy = (ROOT.parent / "summit-landing/src/pages/Privacy.tsx").read_text()
for required in (
    "30 October 2026", "Expeditions and Pro", "linked to your account",
    "Community, Photos and Profile Covers", "AI Coaching and Planning",
    "Reddit", "Google Analytics", 'id="account-deletion"',
    "does not itself cancel", "one calendar month",
    "prepared but not yet deployed", "Existing Android releases", "Existing iOS releases",
    "Current deletion request", "not a guarantee of provider erasure",
):
    assert required in policy, f"Policy missing coverage: {required}"
for obsolete in ("anonymised usage", "within 30 days", "Last updated: July 2026"):
    assert obsolete not in policy, f"Obsolete policy claim: {obsolete}"
print("PASS: policy covers newer features and removes unsupported blanket claims")
