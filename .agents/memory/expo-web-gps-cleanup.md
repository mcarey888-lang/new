---
name: Expo web GPS cleanup
description: SDK 54 location cleanup differs between browser and native event emitters.
---

The installed Expo Location 19.0.8 browser subscriber calls `removeSubscription` on an EventEmitter that does not provide that legacy method. Removing the last Expo browser location subscription can therefore crash during screen cleanup.

**Why:** Leaving the Track screen produced `LocationEventEmitter.removeSubscription is not a function`. The native module uses a LegacyEventEmitter and does not have the same incompatibility.

**How to apply:** For passive browser GPS status, use the browser geolocation watch and clearWatch lifecycle rather than suppressing the exception and leaving event subscriptions behind. Keep native GPS on Expo Location. Async native subscriptions must belong to their effect and be removed if startup finishes after cleanup. Check library compatibility before assuming an upgrade retains this issue; do not change hike recording or background tracking just to repair the status listener.
