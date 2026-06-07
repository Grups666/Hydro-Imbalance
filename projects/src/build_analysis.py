from __future__ import annotations

import json
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
from netCDF4 import Dataset


ROOT = Path(__file__).resolve().parent.parent
DATASET_DIR = ROOT / "datasets"
PREFERRED_DATASET_MARKERS = ("watergap_22e_2019", "watergap2-2e")
WEB_DIR = ROOT / "web"
DATA_DIR = WEB_DIR / "data"
MANIFEST_PATH = WEB_DIR / "analysis-data.js"
MISSING_VALUE = 1e20
WINDOWS = (20, 30)
BASELINE_START_YEAR = 1950
SKIP_PREFIXES = ("lat", "lon", "time")
SPARSE_ACTIVE_SHARE_THRESHOLD = 0.35
SPARSE_ACTIVITY_FLOOR_PERCENTILE = 60
SPARSE_STD_REFERENCE_PERCENTILE = 75
SPARSE_STD_REFERENCE_RATIO = 0.5

VARIABLE_INFO = {
    "anag": {"zh": "实际地下水净取用", "en": "Actual Net Abstraction From Groundwater"},
    "anas": {"zh": "实际地表水净取用", "en": "Actual Net Abstraction From Surface Water"},
    "atotuse": {"zh": "实际总耗水量", "en": "Actual Consumptive Water Use"},
    "canopystor": {"zh": "冠层储水", "en": "Canopy Water Storage"},
    "continentalarea": {"zh": "大陆面积", "en": "Continental Area"},
    "dis": {"zh": "河川径流", "en": "Streamflow"},
    "disnat": {"zh": "天然河川径流", "en": "Naturalized Streamflow"},
    "evap": {"zh": "实际蒸散发", "en": "Actual Evapotranspiration"},
    "glolakestor": {"zh": "全球湖泊储量", "en": "Global Lake Storage"},
    "glowetlandstor": {"zh": "全球湿地储量", "en": "Global Wetland Storage"},
    "groundwstor": {"zh": "地下水储量", "en": "Groundwater Storage"},
    "landcover": {"zh": "土地覆盖", "en": "Land Cover"},
    "loclakestor": {"zh": "局地湖泊储量", "en": "Local Lake Storage"},
    "locwetlandstor": {"zh": "局地湿地储量", "en": "Local Wetland Storage"},
    "ncrun": {"zh": "净单元径流", "en": "Net Cell Runoff"},
    "ncrunnat": {"zh": "天然净单元径流", "en": "Naturalized Net Cell Runoff"},
    "pdomuse": {"zh": "潜在生活耗水量", "en": "Potential Domestic Consumptive Water Use"},
    "pdomww": {"zh": "潜在生活取水量", "en": "Potential Domestic Water Withdrawals"},
    "pgwuse": {"zh": "潜在地下水耗水量", "en": "Potential Groundwater Consumptive Water Use"},
    "pgwww": {"zh": "潜在地下水取水量", "en": "Potential Groundwater Withdrawals"},
    "pinduse": {"zh": "潜在工业耗水量", "en": "Potential Industrial Consumptive Water Use"},
    "pindww": {"zh": "潜在工业取水量", "en": "Potential Industrial Water Withdrawals"},
    "pirruse": {"zh": "潜在灌溉耗水量", "en": "Potential Irrigation Consumptive Water Use"},
    "pirrww": {"zh": "潜在灌溉取水量", "en": "Potential Irrigation Water Withdrawals"},
    "plivuse": {"zh": "潜在畜牧耗水量", "en": "Potential Livestock Consumptive Water Use"},
    "pnag": {"zh": "潜在地下水净取用", "en": "Potential Net Abstraction From Groundwater"},
    "pnas": {"zh": "潜在地表水净取用", "en": "Potential Net Abstraction From Surface Water"},
    "potevap": {"zh": "潜在蒸散发", "en": "Potential Evapotranspiration"},
    "precmon": {"zh": "月降水", "en": "Monthly Precipitation"},
    "ptotuse": {"zh": "潜在总耗水量", "en": "Potential Total Consumptive Water Use"},
    "ptotww": {"zh": "潜在总取水量", "en": "Potential Total Water Withdrawals"},
    "qg": {"zh": "地下水排泄", "en": "Groundwater Discharge"},
    "ql": {"zh": "陆地产流", "en": "Runoff From Land"},
    "qr": {"zh": "总地下水补给", "en": "Total Groundwater Recharge"},
    "qrdif": {"zh": "弥散地下水补给", "en": "Diffuse Groundwater Recharge"},
    "qrswb": {"zh": "地表水体向地下水补给", "en": "Groundwater Recharge From Surface Water Bodies"},
    "qs": {"zh": "快速地表与壤中流", "en": "Fast Surface And Fast Subsurface Runoff"},
    "reservoirstor": {"zh": "水库储量", "en": "Reservoir Storage"},
    "riverstor": {"zh": "河道储量", "en": "River Storage"},
    "soilmoist": {"zh": "土壤水储量", "en": "Soil Water Storage"},
    "startyear": {"zh": "起始年份", "en": "Start Year"},
    "swe": {"zh": "雪水储量", "en": "Snow Water Storage"},
    "tws": {"zh": "总水储量", "en": "Total Water Storage"},
}


@dataclass(frozen=True)
class VariableRecord:
    code: str
    filename: str
    long_name: str
    unit: str
    time_len: int
    yearly_means: np.ndarray
    lat: np.ndarray
    lon: np.ndarray
    years: np.ndarray
    temporal_resolution: str


def dataset_files() -> Iterable[Path]:
    for file_path in sorted(DATASET_DIR.rglob("*")):
        if not file_path.is_file():
            continue
        if file_path.suffix.lower() not in {".nc", ".nc4"}:
            continue
        yield file_path


def titleize(text: str) -> str:
    return " ".join(part.capitalize() for part in text.replace("_", " ").split())


def english_label(code: str, long_name: str) -> str:
    info = VARIABLE_INFO.get(code)
    if info:
        return info["en"]
    return titleize(long_name) if long_name else code.upper()


def chinese_label(code: str, long_name: str) -> str:
    info = VARIABLE_INFO.get(code)
    if info:
        return info["zh"]
    return long_name or code


def to_serializable_grid(array: np.ndarray, digits: int = 3) -> list[list[float | None]]:
    rounded = np.round(array.astype(np.float32), digits)
    rounded[~np.isfinite(rounded)] = np.nan
    return [[None if np.isnan(value) else float(value) for value in row] for row in rounded]


def sanitize_values(values: np.ndarray) -> np.ndarray:
    if np.ma.isMaskedArray(values):
        values = values.filled(np.nan)
    return np.where(np.abs(values) >= MISSING_VALUE, np.nan, values).astype(np.float32)


def select_data_variable(dataset: Dataset) -> str | None:
    for name, variable in dataset.variables.items():
        if name in SKIP_PREFIXES:
            continue
        dimensions = set(getattr(variable, "dimensions", ()))
        if {"time", "lat", "lon"}.issubset(dimensions):
            return name
    return None


def is_html_placeholder(file_path: Path) -> bool:
    with file_path.open("rb") as handle:
        prefix = handle.read(16)
    return prefix.startswith(b"<!DOCTYPE") or prefix.startswith(b"<html")


def infer_start_year(file_path: Path, time: np.ndarray, dataset) -> int:
    time_variable = dataset.variables.get("time")
    units = str(getattr(time_variable, "units", "")) if time_variable is not None else ""
    for token in units.replace("-", " ").split():
        if token.isdigit() and len(token) == 4:
            return int(token)

    for part in reversed(file_path.stem.split("_")):
        if part.isdigit() and len(part) == 4:
            return int(part)

    return 1901


def read_yearly_means(file_path: Path, variable_name: str) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, str]:
    with Dataset(str(file_path.relative_to(ROOT))) as dataset:
        lat = np.asarray(dataset.variables["lat"][:], dtype=np.float32)
        lon = np.asarray(dataset.variables["lon"][:], dtype=np.float32)
        time = np.asarray(dataset.variables["time"][:], dtype=np.float32)
        start_year = infer_start_year(file_path, time, dataset)
        series = sanitize_values(dataset.variables[variable_name][:].astype(np.float32))
        series = np.squeeze(series)

    time_len = len(time)
    if time_len >= 120 and time_len % 12 == 0:
        year_count = time_len // 12
        yearly_means = np.empty((year_count, len(lat), len(lon)), dtype=np.float32)
        for index in range(year_count):
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", category=RuntimeWarning)
                yearly_means[index] = np.nanmean(series[index * 12 : (index + 1) * 12], axis=0, dtype=np.float32)
        years = start_year + np.arange(year_count, dtype=np.int16)
        temporal_resolution = "monthly_to_yearly"
    else:
        yearly_means = series
        years = start_year + np.arange(time_len, dtype=np.int16)
        temporal_resolution = "yearly"

    return yearly_means, lat, lon, years, temporal_resolution


def discover_variables() -> tuple[list[VariableRecord], list[dict[str, str]]]:
    records_by_code: dict[str, VariableRecord] = {}
    unavailable: list[dict[str, str]] = []

    for file_path in dataset_files():
        if file_path.stat().st_size == 0:
            unavailable.append({"filename": str(file_path.relative_to(DATASET_DIR)), "reason": "empty_file"})
            continue
        if is_html_placeholder(file_path):
            unavailable.append({"filename": str(file_path.relative_to(DATASET_DIR)), "reason": "html_placeholder"})
            continue

        try:
            with Dataset(str(file_path.relative_to(ROOT))) as dataset:
                dimensions = dataset.dimensions
                if not {"lat", "lon", "time"}.issubset(dimensions.keys()):
                    unavailable.append({"filename": str(file_path.relative_to(DATASET_DIR)), "reason": "missing_required_dimensions"})
                    continue
                if len(dimensions["time"]) <= 1:
                    unavailable.append({"filename": str(file_path.relative_to(DATASET_DIR)), "reason": "static_or_single_step"})
                    continue

                variable_name = select_data_variable(dataset)
                if variable_name is None:
                    unavailable.append({"filename": str(file_path.relative_to(DATASET_DIR)), "reason": "missing_data_variable"})
                    continue

                variable = dataset.variables[variable_name]
                long_name = getattr(variable, "long_name", variable_name)
                unit = getattr(variable, "units", "-")
                time_len = len(dimensions["time"])

            yearly_means, lat, lon, years, temporal_resolution = read_yearly_means(file_path, variable_name)
            record = VariableRecord(
                code=variable_name,
                filename=str(file_path.relative_to(DATASET_DIR)),
                long_name=str(long_name),
                unit=str(unit),
                time_len=time_len,
                yearly_means=yearly_means,
                lat=lat,
                lon=lon,
                years=years,
                temporal_resolution=temporal_resolution,
            )
            existing = records_by_code.get(record.code)
            if existing is None or record_priority(record) > record_priority(existing):
                records_by_code[record.code] = record
        except Exception as exc:
            unavailable.append({"filename": str(file_path.relative_to(DATASET_DIR)), "reason": f"open_failed: {type(exc).__name__}"})

    records = list(records_by_code.values())
    latest_year = max(int(record.years[-1]) for record in records) if records else 0
    current_records = [record for record in records if int(record.years[-1]) == latest_year]
    stale_records = [record for record in records if int(record.years[-1]) != latest_year]
    unavailable.extend(
        {
            "filename": record.filename,
            "reason": f"stale_end_year_{int(record.years[-1])}_latest_{latest_year}",
        }
        for record in stale_records
    )
    return sorted(current_records, key=lambda record: record.code), unavailable


def record_priority(record: VariableRecord) -> tuple[int, int, int]:
    filename = record.filename.lower()
    preferred = int(any(marker in filename for marker in PREFERRED_DATASET_MARKERS))
    return (int(record.years[-1]), preferred, record.time_len)


def build_window_result(yearly_means: np.ndarray, years: np.ndarray, window: int) -> dict[str, object]:
    recent_mask = years >= years[-window]
    baseline_mask = (years >= BASELINE_START_YEAR) & (years < years[-window])

    baseline = yearly_means[baseline_mask]
    recent = yearly_means[recent_mask]

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=RuntimeWarning)
        baseline_mean = np.nanmean(baseline, axis=0, dtype=np.float32)
        baseline_std = np.nanstd(baseline, axis=0, dtype=np.float32)
        recent_mean = np.nanmean(recent, axis=0, dtype=np.float32)

    difference = recent_mean - baseline_mean
    magnitude = np.maximum(np.abs(baseline_mean), np.abs(recent_mean)).astype(np.float32)
    finite_magnitude = magnitude[np.isfinite(magnitude)]
    positive_magnitude = finite_magnitude[finite_magnitude > 0]
    active_share = float(positive_magnitude.size / finite_magnitude.size) if finite_magnitude.size else 0.0
    sparse_support = active_share < SPARSE_ACTIVE_SHARE_THRESHOLD
    activity_floor = (
        float(np.nanpercentile(positive_magnitude, SPARSE_ACTIVITY_FLOOR_PERCENTILE))
        if sparse_support and positive_magnitude.size
        else 0.0
    )
    practical_std_floor = (
        float(np.nanpercentile(positive_magnitude, SPARSE_STD_REFERENCE_PERCENTILE) * SPARSE_STD_REFERENCE_RATIO)
        if sparse_support and positive_magnitude.size
        else 0.0
    )
    positive_std = baseline_std[np.isfinite(baseline_std) & (baseline_std > 0)]
    std_floor = float(np.nanpercentile(positive_std, 5)) if positive_std.size else 1e-6
    effective_std = np.where(
        np.isfinite(baseline_std) & (baseline_std > 0),
        np.maximum(np.maximum(baseline_std, std_floor), practical_std_floor),
        np.nan,
    ).astype(np.float32)

    z_score = np.full_like(difference, np.nan, dtype=np.float32)
    valid = np.isfinite(effective_std) & (effective_std > 0)
    if activity_floor > 0:
        valid &= np.isfinite(magnitude) & (magnitude >= activity_floor)
    z_score[valid] = difference[valid] / effective_std[valid]
    z_abs = np.abs(z_score)

    return {
        "windowYears": window,
        "recentPeriod": [int(years[-window]), int(years[-1])],
        "baselinePeriod": [int(years[baseline_mask][0]), int(years[baseline_mask][-1])],
        "baselineMean": to_serializable_grid(baseline_mean, digits=6),
        "recentMean": to_serializable_grid(recent_mean, digits=6),
        "difference": to_serializable_grid(difference, digits=6),
        "magnitude": to_serializable_grid(magnitude, digits=6),
        "zScore": to_serializable_grid(z_score, digits=3),
        "summary": {
            "meanAbsZ": float(np.nanmean(z_abs)),
            "maxAbsZ": float(np.nanmax(z_abs)),
            "validCells": int(np.isfinite(z_abs).sum()),
            "imbalancedAt1Sigma": int(np.sum(z_abs >= 1.0)),
            "imbalancedAt2Sigma": int(np.sum(z_abs >= 2.0)),
            "imbalancedAt3Sigma": int(np.sum(z_abs >= 3.0)),
            "stdFloor": std_floor,
            "activeShare": active_share,
            "activityFloor": activity_floor,
            "practicalStdFloor": practical_std_floor,
            "sparseSupport": sparse_support,
        },
    }

def write_variable_payload(record: VariableRecord) -> None:
    payload = {
        "windows": {
            str(window): build_window_result(record.yearly_means, record.years, window)
            for window in WINDOWS
        }
    }
    target = DATA_DIR / f"{record.code}.js"
    target.write_text(
        f"window.ANALYSIS_VARIABLE_DATA = window.ANALYSIS_VARIABLE_DATA || {{}};\nwindow.ANALYSIS_VARIABLE_DATA['{record.code}'] = "
        + json.dumps(payload, ensure_ascii=False)
        + ";\n",
        encoding="utf-8",
    )


def remove_stale_payloads(records: list[VariableRecord]) -> None:
    valid_names = {f"{record.code}.js" for record in records}
    for file_path in DATA_DIR.glob("*.js"):
        if file_path.name not in valid_names:
            file_path.unlink()


def build_manifest() -> dict[str, object]:
    records, unavailable = discover_variables()
    if not records:
        raise RuntimeError("No valid time-series netCDF files were found in datasets/")

    manifest: dict[str, object] = {
        "meta": {
            "title": {"zh": "水循环失衡辨识", "en": "Water Cycle Imbalance Detection"},
            "source": "WaterGAP2-2e GSWP3-W5E5 obsclim/histsoc/default output where available; newest file per variable is selected.",
            "method": {
                "zh": "先将月尺度变量聚合为年均值，再将近20年或近30年的平均状态与此前长期基线比较。z-score 按基线标准差归一化，并使用5%分位数标准差下限以避免极小方差网格导致的不稳定放大。",
                "en": "Monthly variables are aggregated to annual means and compared between the recent 20-year or 30-year window and the earlier long-term baseline. The z-score is normalized by the baseline standard deviation, with a 5th-percentile standard-deviation floor to avoid unstable amplification in near-zero-variance cells.",
            },
            "resolution": "0.5 degree WaterGAP grid",
            "thresholdOptions": [0.5, 1, 1.5, 2, 2.5, 3],
            "generatedBy": "src/build_analysis.py",
            "availableVariableCount": len(records),
            "unavailableFiles": unavailable,
        },
        "grid": {
            "lat": [round(float(value), 2) for value in records[0].lat],
            "lon": [round(float(value), 2) for value in records[0].lon],
            "rows": int(records[0].lat.shape[0]),
            "cols": int(records[0].lon.shape[0]),
        },
        "variables": {},
    }

    for record in records:
        manifest["variables"][record.code] = {
            "label": {
                "zh": chinese_label(record.code, record.long_name),
                "en": english_label(record.code, record.long_name),
            },
            "description": {
                "zh": record.long_name,
                "en": record.long_name,
            },
            "unit": record.unit,
            "inputTimeSteps": record.time_len,
            "inputYears": [int(record.years[0]), int(record.years[-1])],
            "sourceFile": record.filename,
            "temporalResolution": record.temporal_resolution,
            "dataScript": f"./data/{record.code}.js",
        }
        write_variable_payload(record)

    remove_stale_payloads(records)

    return manifest


def main() -> None:
    WEB_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    manifest = build_manifest()
    MANIFEST_PATH.write_text(
        "window.ANALYSIS_DATA = " + json.dumps(manifest, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {MANIFEST_PATH}")
    print(f"Variables: {manifest['meta']['availableVariableCount']}")
    print(f"Unavailable files: {len(manifest['meta']['unavailableFiles'])}")


if __name__ == "__main__":
    main()
