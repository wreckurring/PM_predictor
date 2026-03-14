from __future__ import annotations

import argparse
from pathlib import Path

import joblib
import pandas as pd
import shap

from .config import FEATURE_TABLE_NAME, MODELS_DIR, PLOTS_DIR, PROCESSED_DIR, ensure_directories


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Explain a PM2.5 prediction using SHAP.")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--month", type=int, required=True)
    parser.add_argument("--lat", type=float, required=True)
    parser.add_argument("--lon", type=float, required=True)
    parser.add_argument("--top-k", type=int, default=10)
    return parser.parse_args()


def main() -> None:
    ensure_directories()
    args = parse_args()

    frame = pd.read_parquet(PROCESSED_DIR / FEATURE_TABLE_NAME)
    model = joblib.load(MODELS_DIR / "pm25_xgboost.joblib")
    features = joblib.load(MODELS_DIR / "feature_columns.joblib")

    subset = frame[(frame["year"] == args.year) & (frame["month"] == args.month)].copy()
    if subset.empty:
        raise ValueError("Requested year/month not found in processed feature table.")

    subset["distance_to_query"] = ((subset["latitude"] - args.lat) ** 2 + (subset["longitude"] - args.lon) ** 2) ** 0.5
    row = subset.sort_values("distance_to_query").iloc[0]
    sample = pd.DataFrame([row[features]])

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(sample)
    predicted_pm25 = float(model.predict(sample)[0])
    base_value = explainer.expected_value
    if isinstance(base_value, (list, tuple)):
        base_value = base_value[0]
    base_value = float(base_value)

    explanation = pd.DataFrame(
        {
            "feature": features,
            "feature_value": sample.iloc[0].values,
            "shap_value": shap_values[0],
        }
    )
    explanation["abs_shap"] = explanation["shap_value"].abs()
    explanation = explanation.sort_values("abs_shap", ascending=False).reset_index(drop=True)

    output_path = PLOTS_DIR / f"shap_explanation_{args.year}_{args.month:02d}_{row['latitude']:.4f}_{row['longitude']:.4f}.csv"
    explanation.to_csv(output_path, index=False)

    print("SHAP explanation summary")
    print(f"Requested location: lat={args.lat:.4f}, lon={args.lon:.4f}")
    print(f"Nearest grid cell: lat={row['latitude']:.4f}, lon={row['longitude']:.4f}")
    print(f"Requested month: {args.year}-{args.month:02d}")
    print(f"Predicted PM2.5: {predicted_pm25:.3f}")
    print(f"Base value: {base_value:.3f}")
    if "pm25" in row.index:
        print(f"Actual PM2.5: {float(row['pm25']):.3f}")
    print("Top contributing factors:")
    for _, item in explanation.head(args.top_k).iterrows():
        direction = "increased" if item["shap_value"] >= 0 else "decreased"
        print(
            f"- {item['feature']}: value={item['feature_value']:.6g}, "
            f"SHAP={item['shap_value']:.3f} ({direction} prediction)"
        )
    print(f"Saved full SHAP explanation to {output_path}")


if __name__ == "__main__":
    main()
