from __future__ import annotations

import json
import math
import struct
import urllib.request
import zipfile
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parent.parent
BASIN_DIR = ROOT / "datasets" / "basins"
RAW_DIR = BASIN_DIR / "raw"
BASIN_DATA_PATH = ROOT / "basin-data.js"
HYDROBASINS_LEVEL = 4
REGIONS = ("af", "ar", "as", "au", "eu", "gr", "na", "sa", "si")
BASE_URL = "https://data.hydrosheds.org/file/hydrobasins/standard/hybas_{region}_lev{level:02d}_v1c.zip"
ROWS = 360
COLS = 720
LAT_VALUES = [89.75 - row * 0.5 for row in range(ROWS)]
LON_VALUES = [-179.75 + col * 0.5 for col in range(COLS)]
RENDER_TOLERANCE_DEGREES = 0.05


def download_hydrobasins() -> list[Path]:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    archives: list[Path] = []
    for region in REGIONS:
        url = BASE_URL.format(region=region, level=HYDROBASINS_LEVEL)
        target = RAW_DIR / Path(url).name
        if not target.exists():
            print(f"Downloading {url}")
            request = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0",
                    "Referer": "https://www.hydrosheds.org/products/hydrobasins",
                },
            )
            with urllib.request.urlopen(request) as response, target.open("wb") as handle:
                handle.write(response.read())
        archives.append(target)
    return archives


def decode_dbf_value(raw: bytes) -> str | int | float | None:
    text = raw.decode("latin1", errors="ignore").strip()
    if text == "":
        return None
    try:
        return int(text)
    except ValueError:
        try:
            return float(text)
        except ValueError:
            return text


def read_dbf(path: Path) -> list[dict[str, str | int | float | None]]:
    data = path.read_bytes()
    record_count = struct.unpack_from("<I", data, 4)[0]
    header_length = struct.unpack_from("<H", data, 8)[0]
    record_length = struct.unpack_from("<H", data, 10)[0]

    fields: list[tuple[str, int]] = []
    offset = 32
    while data[offset] != 0x0D:
        descriptor = data[offset : offset + 32]
        name = descriptor[:11].split(b"\x00", 1)[0].decode("latin1")
        length = descriptor[16]
        fields.append((name, length))
        offset += 32

    records: list[dict[str, str | int | float | None]] = []
    offset = header_length
    for _ in range(record_count):
        row = data[offset : offset + record_length]
        offset += record_length
        if not row or row[0:1] == b"*":
            continue
        position = 1
        record: dict[str, str | int | float | None] = {}
        for name, length in fields:
            record[name] = decode_dbf_value(row[position : position + length])
            position += length
        records.append(record)
    return records


def read_shp_polygons(path: Path) -> Iterable[dict[str, object]]:
    data = path.read_bytes()
    offset = 100
    while offset < len(data):
        record_number, content_length_words = struct.unpack_from(">2i", data, offset)
        offset += 8
        content_length = content_length_words * 2
        content = data[offset : offset + content_length]
        offset += content_length
        shape_type = struct.unpack_from("<i", content, 0)[0]
        if shape_type == 0:
            continue
        if shape_type != 5:
            raise ValueError(f"Unsupported shape type {shape_type} in {path}")
        min_x, min_y, max_x, max_y = struct.unpack_from("<4d", content, 4)
        part_count, point_count = struct.unpack_from("<2i", content, 36)
        parts = list(struct.unpack_from(f"<{part_count}i", content, 44))
        points_offset = 44 + part_count * 4
        points = [
            struct.unpack_from("<2d", content, points_offset + index * 16)
            for index in range(point_count)
        ]
        rings = []
        for index, start in enumerate(parts):
            end = parts[index + 1] if index + 1 < len(parts) else point_count
            ring = points[start:end]
            if len(ring) >= 4:
                rings.append(ring)
        yield {
            "recordNumber": record_number,
            "bbox": [min_x, min_y, max_x, max_y],
            "rings": rings,
        }


def extract_archive(archive: Path) -> tuple[Path, Path]:
    target_dir = archive.with_suffix("")
    marker = target_dir / ".extracted"
    if not marker.exists():
        target_dir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(archive) as handle:
            handle.extractall(target_dir)
        marker.write_text("ok", encoding="utf-8")
    shp_files = list(target_dir.rglob("*.shp"))
    dbf_files = list(target_dir.rglob("*.dbf"))
    if not shp_files or not dbf_files:
        raise FileNotFoundError(f"Missing .shp/.dbf in {archive}")
    return shp_files[0], dbf_files[0]


def perpendicular_distance(point: tuple[float, float], start: tuple[float, float], end: tuple[float, float]) -> float:
    if start == end:
        return math.dist(point, start)
    numerator = abs((end[0] - start[0]) * (start[1] - point[1]) - (start[0] - point[0]) * (end[1] - start[1]))
    denominator = math.dist(start, end)
    return numerator / denominator


def simplify_ring(points: list[tuple[float, float]], tolerance: float) -> list[list[float]]:
    if len(points) <= 8:
        return [[round(x, 4), round(y, 4)] for x, y in points]
    closed = points[0] == points[-1]
    working = points[:-1] if closed else points

    def simplify_segment(segment: list[tuple[float, float]]) -> list[tuple[float, float]]:
        if len(segment) <= 2:
            return segment
        start, end = segment[0], segment[-1]
        distances = [perpendicular_distance(point, start, end) for point in segment[1:-1]]
        max_distance = max(distances, default=0)
        if max_distance <= tolerance:
            return [start, end]
        split = distances.index(max_distance) + 1
        return simplify_segment(segment[: split + 1])[:-1] + simplify_segment(segment[split:])

    simplified = simplify_segment(working)
    if closed and simplified[0] != simplified[-1]:
        simplified.append(simplified[0])
    return [[round(x, 4), round(y, 4)] for x, y in simplified]


def point_in_ring(lon: float, lat: float, ring: list[tuple[float, float]]) -> bool:
    inside = False
    previous_lon, previous_lat = ring[-1]
    for current_lon, current_lat in ring:
        intersects = (current_lat > lat) != (previous_lat > lat)
        if intersects:
            x_intersection = (previous_lon - current_lon) * (lat - current_lat) / (previous_lat - current_lat) + current_lon
            if lon < x_intersection:
                inside = not inside
        previous_lon, previous_lat = current_lon, current_lat
    return inside


def point_in_polygon(lon: float, lat: float, rings: list[list[tuple[float, float]]]) -> bool:
    inside = False
    for ring in rings:
        if point_in_ring(lon, lat, ring):
            inside = not inside
    return inside


def cell_indices_for_polygon(bbox: list[float], rings: list[list[tuple[float, float]]]) -> list[int]:
    min_lon, min_lat, max_lon, max_lat = bbox
    row_start = max(0, int(math.floor((89.75 - max_lat) / 0.5)))
    row_end = min(ROWS - 1, int(math.ceil((89.75 - min_lat) / 0.5)))
    col_start = max(0, int(math.floor((min_lon + 179.75) / 0.5)))
    col_end = min(COLS - 1, int(math.ceil((max_lon + 179.75) / 0.5)))
    cells: list[int] = []
    for row in range(row_start, row_end + 1):
        lat = LAT_VALUES[row]
        if lat < min_lat or lat > max_lat:
            continue
        for col in range(col_start, col_end + 1):
            lon = LON_VALUES[col]
            if lon < min_lon or lon > max_lon:
                continue
            if point_in_polygon(lon, lat, rings):
                cells.append(row * COLS + col)
    return cells


def build_basins() -> dict[str, object]:
    basins: list[dict[str, object]] = []
    for archive in download_hydrobasins():
        shp_path, dbf_path = extract_archive(archive)
        records = read_dbf(dbf_path)
        shapes = list(read_shp_polygons(shp_path))
        if len(records) != len(shapes):
            raise ValueError(f"Record count mismatch in {archive.name}: {len(records)} dbf vs {len(shapes)} shp")
        region = archive.name.split("_")[1].upper()
        for record, shape in zip(records, shapes):
            rings = shape["rings"]
            cells = cell_indices_for_polygon(shape["bbox"], rings)  # type: ignore[arg-type]
            if not cells:
                continue
            hybas_id = int(record.get("HYBAS_ID") or shape["recordNumber"])
            basins.append(
                {
                    "id": hybas_id,
                    "region": region,
                    "name": f"{region}-{hybas_id}",
                    "areaKm2": float(record.get("SUB_AREA") or 0),
                    "cellCount": len(cells),
                    "bbox": [round(float(value), 4) for value in shape["bbox"]],  # type: ignore[index]
                    "cells": cells,
                    "rings": [simplify_ring(ring, RENDER_TOLERANCE_DEGREES) for ring in rings],  # type: ignore[arg-type]
                }
            )
    basins.sort(key=lambda item: int(item["id"]))
    return {
        "meta": {
            "source": "HydroBASINS",
            "sourceUrl": "https://www.hydrosheds.org/products/hydrobasins",
            "level": HYDROBASINS_LEVEL,
            "grid": "0.5 degree WaterGAP grid",
            "aggregation": "Basin score is the mean score of all valid 0.5 degree grid cells whose centers fall inside the basin polygon.",
            "basinCount": len(basins),
        },
        "basins": basins,
    }


def main() -> None:
    data = build_basins()
    BASIN_DATA_PATH.write_text(
        "window.BASIN_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {BASIN_DATA_PATH}")
    print(f"Basins: {data['meta']['basinCount']}")


if __name__ == "__main__":
    main()
