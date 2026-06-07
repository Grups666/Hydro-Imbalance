from __future__ import annotations

import json
import ssl
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DATASET_DIR = ROOT / "datasets" / "watergap_22e_2019"
MANIFEST_PATH = DATASET_DIR / "download_manifest.json"
API_URL = "https://data.isimip.org/api/v1/files/"
FILE_BASE_URL = "https://files.isimip.org/"
MAX_WORKERS = 4

QUERY = {
    "model": "watergap2-2e",
    "climate_forcing": "gswp3-w5e5",
    "climate_scenario": "obsclim",
    "soc_scenario": "histsoc",
    "sens_scenario": "default",
    "page_size": "100",
}


def urlopen(url: str, *, timeout: int = 60):
    return urllib.request.urlopen(url, context=ssl._create_unverified_context(), timeout=timeout)


def api_pages() -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    url = f"{API_URL}?{urllib.parse.urlencode(QUERY)}"
    while url:
        with urlopen(url) as response:
            payload = json.load(response)
        records.extend(payload["results"])
        url = payload["next"]
    return records


def select_monthly_2019_outputs(records: list[dict[str, object]]) -> list[dict[str, object]]:
    selected = []
    for record in records:
        spec = record["specifiers"]
        if spec.get("start_year") != 1901 or spec.get("end_year") != 2019:
            continue
        if spec.get("time_step") != "monthly" or spec.get("region") != "global":
            continue
        if not record["name"].startswith("watergap2-2e_"):
            continue
        selected.append(record)
    return sorted(selected, key=lambda item: item["name"])


def download_file(record: dict[str, object]) -> str:
    target = DATASET_DIR / str(record["name"])
    expected_size = int(record["size"])
    if target.exists() and target.stat().st_size == expected_size:
        return f"skip {target.name}"

    tmp = target.with_suffix(target.suffix + ".part")
    url = FILE_BASE_URL + str(record["path"])
    headers = {}
    mode = "wb"
    if tmp.exists() and tmp.stat().st_size < expected_size:
        headers["Range"] = f"bytes={tmp.stat().st_size}-"
        mode = "ab"

    request = urllib.request.Request(url, headers=headers)
    downloaded = tmp.stat().st_size if tmp.exists() and mode == "ab" else 0
    print(f"download {target.name} ({expected_size / 1_000_000:.1f} MB)", flush=True)
    with urlopen(request.full_url, timeout=120) if not headers else urllib.request.urlopen(
        request, context=ssl._create_unverified_context(), timeout=120
    ) as response:
        with tmp.open(mode + "") as handle:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)
                downloaded += len(chunk)
                if downloaded % (50 * 1024 * 1024) < len(chunk):
                    print(f"  {target.name}: {downloaded / 1_000_000:.1f}/{expected_size / 1_000_000:.1f} MB", flush=True)

    if tmp.stat().st_size != expected_size:
        raise RuntimeError(f"Incomplete download for {target.name}: {tmp.stat().st_size} != {expected_size}")
    tmp.replace(target)
    return f"done {target.name}"


def main() -> None:
    DATASET_DIR.mkdir(parents=True, exist_ok=True)
    records = select_monthly_2019_outputs(api_pages())
    MANIFEST_PATH.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"found {len(records)} monthly WaterGAP2-2e 1901-2019 files", flush=True)
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(download_file, record) for record in records]
        for future in as_completed(futures):
            print(future.result(), flush=True)
    print(f"wrote {MANIFEST_PATH}", flush=True)


if __name__ == "__main__":
    main()
