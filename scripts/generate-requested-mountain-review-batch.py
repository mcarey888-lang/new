"""One-time, resumable review-only batch for the user's named mountain list.

Run with --run to initiate paid artwork requests. Without it, only inspect.
No candidates are approved by this script. Tryfan is intentionally excluded.
"""

import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
import json
import os
import time
import urllib.error
import urllib.request

MOUNTAINS = [
    ("Ben Nevis", "c72f54a6-7022-4569-8573-0cb476b24a50"),
    ("Snowdon / Yr Wyddfa", "d2e4f6b3-d992-4ed4-9622-4ab05c6ef1dd"),
    ("Scafell Pike", "a4bf692f-2b58-463e-9960-a293e6c6a687"),
    ("Ben Lomond", "404a4fc5-20da-46b3-a693-0d3bbea02e28"),
    ("Helvellyn", "0a3d3334-cb82-4659-a8bc-9f8658557731"),
    ("Buachaille Etive Mòr", "03d78457-5527-4fcc-ae4b-33897f8ca8d3"),
    ("Cadair Idris / Cader Idris", "943fe1c6-ad6e-474c-8103-99779e791c1e"),
    ("Pen y Fan", "290278a7-1103-4d1c-8363-e8dfe95b3edb"),
    ("Old Man of Coniston", "f58d263f-9cf9-4eac-a2a2-c84332fbccfa"),
    ("Blencathra", "8a08d454-eb8c-449d-8d34-c6954df9bb86"),
    ("Great Gable", "30cb5f2a-c724-4fca-81e6-5f03736430f9"),
    ("Catbells", "696871ce-7baa-4ea2-8cf3-8c55869df893"),
    ("Schiehallion", "e494f618-a3a5-447e-aceb-12297f4e3c61"),
    ("Suilven", "1f136228-983f-4360-a13a-4980c19fce10"),
    ("Liathach", "b0116175-ae63-48a8-b4b2-420cf1c86cc9"),
    ("An Teallach", "272c0a8c-1cac-456e-848e-89813b965c09"),
    ("Ben Macdui", "ede071e6-bc65-422d-b351-48fddb160ea1"),
    ("Cairn Gorm", "88e5bb48-2f26-45c7-bad5-71a9887d57be"),
    ("Ben A'an", "a90c9e1f-9910-489e-81d3-214ca592dcbb"),
    ("The Cobbler / Ben Arthur", "add53e5b-770e-479d-8466-04889d855d36"),
    ("Stac Pollaidh", "0b3eeae1-416d-42a6-892f-62254fce2d9e"),
    ("Aonach Eagach", "ad6b9493-2366-4dba-963e-59cd7eff3d9d"),
    ("Crib Goch", "da8533db-1fba-4568-bbe5-0649b86237ad"),
    ("Glyder Fawr", "2427f0f5-4ca7-4727-a1b9-3176c30a506e"),
    ("Kinder Scout", "0a435ff8-be02-45cb-9ea4-9add83762f22"),
    ("Mam Tor", "8c5dd25e-8dc7-4b9f-b182-f24a7b8821e3"),
    ("Ingleborough", "9bbcba26-82be-430a-9887-27f6112d5c0b"),
    ("Pen-y-ghent", "8e90bcd9-35a9-456c-aee5-1ceb9a9a67b7"),
    ("Roseberry Topping", "b49901a7-989b-4ec3-bbab-c32e85eeb95d"),
]

assert len(MOUNTAINS) == 29 and len({id for _, id in MOUNTAINS}) == 29


def prompt(name):
    # Exact user wording from the previous Tryfan candidate; only the name changes.
    return (
        f'evalute the image of "{name}" online, look at the more high end '
        "photograpers and pictures entered into photography competiotions, "
        "then recreate the image in your interpritation, i want it to look "
        "realistic with fantastic lighting"
    )


def request(mountain_id, suffix, data=None):
    base = "https://" + os.environ["REPLIT_DEV_DOMAIN"] + "/api/artwork/mountains/"
    key = base64.b64encode(os.environ["ADMIN_API_KEY"].encode("utf-8")).decode("ascii")
    headers = {"x-vx-admin-key-b64": key}
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(
        base + mountain_id + "/" + suffix,
        headers=headers,
        data=json.dumps(data).encode("utf-8") if data is not None else None,
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.load(response)


def process(item, run):
    name, mountain_id = item
    expected = prompt(name)
    try:
        for poll in range(130):
            state = request(mountain_id, "generation")
            candidate = state.get("candidate") or {}
            if state["status"] == "ready" and candidate.get("prompt") == expected:
                print("READY", name, candidate.get("imageUrl"), flush=True)
                return name, "ready"
            if state["status"] == "generating":
                if state.get("prompt") != expected:
                    print("BUSY_OTHER_PROMPT", name, flush=True)
                    return name, "busy"
                if poll == 0:
                    print("WAIT_EXISTING", name, flush=True)
                time.sleep(15)
                continue
            if not run:
                print("NEEDS_GENERATION", name, state["status"], flush=True)
                return name, "not_started"
            try:
                job = request(mountain_id, "generate", {"confirmed": True, "prompt": expected})
                print("START", name, job["jobId"], flush=True)
            except urllib.error.HTTPError as exc:
                if exc.code != 409:
                    raise
                # A concurrent request may have claimed the generation.
                time.sleep(15)
                continue
            # Poll on the next iteration; if the server restarts, a stale claim
            # becomes failed and can be safely retried through the API.
            time.sleep(15)
        print("TIMED_OUT", name, flush=True)
        return name, "timed_out"
    except Exception as exc:
        print("ERROR", name, str(exc)[:250], flush=True)
        return name, "error"


if __name__ == "__main__":
    args = argparse.ArgumentParser()
    args.add_argument("--run", action="store_true")
    options = args.parse_args()
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(lambda item: process(item, options.run), MOUNTAINS))
    print("SUMMARY", json.dumps(results, ensure_ascii=False), flush=True)