from __future__ import annotations

import argparse
import csv
import json
import re
import urllib.request
import zipfile
from collections import defaultdict
from pathlib import Path

import shapefile
from pyproj import Geod
from shapely.geometry import MultiPolygon, Polygon, shape as shapely_shape
from shapely.ops import unary_union
from shapely.strtree import STRtree


ROOT = Path(__file__).resolve().parents[2]
PROJECTS_DIR = ROOT / "projects"
DATASET_DIR = PROJECTS_DIR / "datasets"
BASIN_DATA_PATH = PROJECTS_DIR / "basin-data.js"
RGI_DIR = DATASET_DIR / "rgi60"
GLACIER_DIR = DATASET_DIR / "glacier_zemp_2019"
BRIDGE_PATH = GLACIER_DIR / "glacier_area_by_basin_region.csv"

RGI_BASE_URL = "https://cluster.klima.uni-bremen.de/~fmaussion/fmaussion/fmaussion/misc/rgi7_data/l0_RGIv6"
RGI_FILES = {
    1: "01_rgi60_Alaska.zip",
    2: "02_rgi60_WesternCanadaUS.zip",
    3: "03_rgi60_ArcticCanadaNorth.zip",
    4: "04_rgi60_ArcticCanadaNorth.zip",
    5: "05_rgi60_GreenlandPeriphery.zip",
    6: "06_rgi60_Iceland.zip",
    7: "07_rgi60_Svalbard.zip",
    8: "07_rgi60_Scandinavia.zip",
    9: "09_rgi60_RussianArctic.zip",
    10: "10_rgi60_NorthAsia.zip",
    11: "11_rgi60_CentralEurope.zip",
    12: "12_rgi60_CaucasusMiddleEast.zip",
    13: "13_rgi60_CentralAsia.zip",
    14: "14_rgi60_SouthAsiaWest.zip",
    15: "15_rgi60_SouthAsiaEast.zip",
    16: "16_rgi60_LowLatitudes.zip",
    17: "17_rgi60_SouthernAndes.zip",
    18: "18_rgi60_NewZealand.zip",
    19: "19_rgi60_AntarcticSubantarctic.zip",
}

GEOD = Geod(ellps="WGS84")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build basin x RGI-region glacier area bridge table.")
    parser.add_argument(
        "--regions",
        nargs="*",
        type=int,
        default=sorted(RGI_FILES),
        help="RGI region numbers to process. Default: all 1-19.",
    )
    parser.add_argument("--output", type=Path, default=BRIDGE_PATH)
    return parser.parse_args()


def load_basin_data() -> list[dict]:
    text = BASIN_DATA_PATH.read_text(encoding="utf-8")
    match = re.search(r"window\.BASIN_DATA\s*=\s*(\{.*\})\s*;?\s*$", text, flags=re.S)
    if not match:
        raise ValueError(f"Could not parse {BASIN_DATA_PATH}")
    data = json.loads(match.group(1))
    basins = data["basins"]
    basins.sort(key=lambda basin: basin["id"])
    return basins


def basin_geometry(basin: dict) -> Polygon | MultiPolygon | None:
    polygons: list[Polygon] = []
    for ring in basin.get("rings", []):
        if len(ring) < 4:
            continue
        polygon = Polygon(ring)
        if polygon.is_empty:
            continue
        if not polygon.is_valid:
            polygon = polygon.buffer(0)
        if polygon.is_empty:
            continue
        if isinstance(polygon, Polygon):
            polygons.append(polygon)
        elif isinstance(polygon, MultiPolygon):
            polygons.extend(list(polygon.geoms))
    if not polygons:
        return None
    geometry = unary_union(polygons)
    if not geometry.is_valid:
        geometry = geometry.buffer(0)
    return geometry if not geometry.is_empty else None


def load_basin_geometries() -> tuple[list[int], list[Polygon | MultiPolygon]]:
    basin_ids: list[int] = []
    geometries: list[Polygon | MultiPolygon] = []
    for basin in load_basin_data():
        geometry = basin_geometry(basin)
        if geometry is None:
            continue
        basin_ids.append(int(basin["id"]))
        geometries.append(geometry)
    return basin_ids, geometries


def ensure_region_zip(region: int) -> Path:
    if region not in RGI_FILES:
        raise ValueError(f"Unknown RGI region: {region}")
    RGI_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = RGI_DIR / RGI_FILES[region]
    if zip_path.exists() and zip_path.stat().st_size > 0:
        return zip_path

    url = f"{RGI_BASE_URL}/{RGI_FILES[region]}"
    print(f"Downloading {url}")
    with urllib.request.urlopen(url, timeout=300) as response:
        zip_path.write_bytes(response.read())
    return zip_path


def ensure_region_extracted(region: int) -> Path:
    zip_path = ensure_region_zip(region)
    extract_dir = RGI_DIR / zip_path.stem
    shp_files = list(extract_dir.glob("*.shp"))
    if shp_files:
        return shp_files[0]

    extract_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as archive:
        archive.extractall(extract_dir)

    shp_files = list(extract_dir.rglob("*.shp"))
    if not shp_files:
        raise FileNotFoundError(f"No shapefile found in {zip_path}")
    return shp_files[0]


def geodesic_area_km2(geometry) -> float:
    if geometry.is_empty:
        return 0.0
    area_m2, _ = GEOD.geometry_area_perimeter(geometry)
    return abs(area_m2) / 1_000_000.0


def process_region(
    region: int,
    tree: STRtree,
    basin_ids: list[int],
    basin_geometries: list[Polygon | MultiPolygon],
) -> dict[tuple[int, int], float]:
    shp_path = ensure_region_extracted(region)
    reader = shapefile.Reader(str(shp_path))
    totals: dict[tuple[int, int], float] = defaultdict(float)

    for index, glacier_shape in enumerate(reader.iterShapes(), start=1):
        glacier = shapely_shape(glacier_shape.__geo_interface__)
        if glacier.is_empty:
            continue
        if not glacier.is_valid:
            glacier = glacier.buffer(0)
        if glacier.is_empty:
            continue

        candidate_indexes = tree.query(glacier)
        for basin_index in candidate_indexes:
            basin_geometry = basin_geometries[int(basin_index)]
            if not glacier.intersects(basin_geometry):
                continue
            intersection = glacier.intersection(basin_geometry)
            area = geodesic_area_km2(intersection)
            if area > 0:
                totals[(basin_ids[int(basin_index)], region)] += area

        if index % 10000 == 0:
            print(f"  region {region}: processed {index} glaciers")

    print(f"  region {region}: matched {len(totals)} basin-region pairs")
    return totals


def write_bridge(output_path: Path, totals: dict[tuple[int, int], float]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["basin_id", "rgi_region", "glacier_area_km2"])
        writer.writeheader()
        for (basin_id, region), area in sorted(totals.items()):
            writer.writerow(
                {
                    "basin_id": basin_id,
                    "rgi_region": region,
                    "glacier_area_km2": round(area, 6),
                }
            )


def main() -> None:
    args = parse_args()
    basin_ids, basin_geometries = load_basin_geometries()
    tree = STRtree(basin_geometries)
    print(f"Loaded {len(basin_geometries)} basin geometries")

    totals: dict[tuple[int, int], float] = defaultdict(float)
    for region in args.regions:
        print(f"Processing RGI region {region}")
        region_totals = process_region(region, tree, basin_ids, basin_geometries)
        for key, value in region_totals.items():
            totals[key] += value

    write_bridge(args.output, totals)
    print(f"Wrote {args.output} with {len(totals)} basin-region pairs")


if __name__ == "__main__":
    main()
