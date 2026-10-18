"""Datos ficticios. Las features se conocen antes de salir el envío."""
import numpy as np
import pandas as pd

SEED = 20261018
FEATURES = ['distance_km', 'load', 'rain_forecast', 'hub']


def generate() -> pd.DataFrame:
    rng = np.random.default_rng(SEED)
    n = 900
    distance = rng.uniform(20, 600, n)
    load = rng.uniform(.1, 1, n)
    rain = rng.binomial(1, .3, n)
    hub = rng.choice(['urban', 'rural'], n, p=[.75, .25])
    delay = (distance*.025 + load*16 + rain*12 + (hub == 'rural')*5
             + rng.normal(0, 6, n) + np.arange(n)/n*3)
    frame = pd.DataFrame({
        'shipment_id': np.arange(n),
        'departure': pd.date_range('2024-01-01', periods=n, freq='D'),
        'distance_km': distance, 'load': load, 'rain_forecast': rain, 'hub': hub,
        'delay_minutes': delay, 'delayed': (delay > 30).astype(int),
    })
    frame.loc[np.arange(0, 500, 50), 'distance_km'] = np.nan
    frame.loc[np.arange(25, 500, 100), 'load'] = np.nan
    invalid = frame.iloc[:3].copy()
    invalid['shipment_id'] = [900, 901, 902]
    invalid['distance_km'] = -1
    return pd.concat([frame, frame.iloc[10:16], invalid], ignore_index=True)


def clean(raw: pd.DataFrame) -> pd.DataFrame:
    # En este fixture, mismo ID implica la misma fila, no otra observación.
    frame = raw.drop_duplicates('shipment_id').copy()
    valid = frame.distance_km.isna() | (frame.distance_km > 0)
    return frame.loc[valid].sort_values('departure').reset_index(drop=True)


def split(frame: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    return frame.iloc[:540].copy(), frame.iloc[540:720].copy(), frame.iloc[720:].copy()


def quality(raw: pd.DataFrame) -> dict[str, object]:
    return {
        'rows': len(raw), 'duplicates': int(raw.shipment_id.duplicated().sum()),
        'invalid_distance': int((raw.distance_km <= 0).sum()),
        'missing': raw.isna().sum().astype(int).to_dict(),
    }
