"""Imprime resultados; no escribe ni modifica el dataset o el protocolo."""
import hashlib
import json
import platform
from pathlib import Path

import numpy as np
import pandas as pd
import scipy
import sklearn
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.decomposition import PCA
from sklearn.ensemble import IsolationForest
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LinearRegression
from sklearn.metrics import precision_recall_curve, roc_curve
from sklearn.model_selection import GridSearchCV, TimeSeriesSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from data import FEATURES, SEED, clean, split, quality
from models import (pipeline, ols, leakage_scaling, temporal_demo, classification,
                    regression, calibration_demo, clustering_demo, paired_interval)


def run() -> dict[str, object]:
    path = Path('data/logistics-v1.csv')
    raw = pd.read_csv(path, parse_dates=['departure'])
    frame = clean(raw)
    train, val, test = split(frame)
    x, y = train[FEATURES], train.delayed
    vx, vy = val[FEATURES], val.delayed
    result = {
        'environment': {'python': platform.python_version(), 'numpy': np.__version__,
            'pandas': pd.__version__, 'scipy': scipy.__version__, 'sklearn': sklearn.__version__},
        'seed': SEED, 'dataset_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'protocol_sha256': hashlib.sha256(Path('protocol.json').read_bytes()).hexdigest(),
        'quality': quality(raw),
        'split': [{'n': len(part), 'first': str(part.departure.min().date()),
                   'last': str(part.departure.max().date())} for part in (train, val, test)],
        'eda_train': {
            'missing': train.isna().sum().astype(int).to_dict(),
            'positive_rate': float(y.mean()),
            'distance_quantiles': train.distance_km.quantile([.05, .5, .95]).tolist(),
            'distance_delay_correlation': float(train[['distance_km', 'delay_minutes']].corr().iloc[0, 1]),
            'distance_histogram': np.histogram(train.distance_km.dropna(), bins=np.arange(0, 701, 100))[0].tolist(),
            'histogram_edges': list(range(0, 701, 100)),
        },
        'leakage_scaling': leakage_scaling(), 'temporal_demo': temporal_demo(),
        'validation': {}, 'tree_depth': [],
    }
    for kind in ['baseline', 'logistic', 'tree', 'forest', 'boosting']:
        model = pipeline(kind).fit(x, y)
        probability = model.predict_proba(vx)[:, 1]
        precision, recall, _ = precision_recall_curve(vy, probability)
        fpr, tpr, _ = roc_curve(vy, probability)
        result['validation'][kind] = {'metrics': classification(vy, probability),
            'pr_curve': list(map(list, zip(recall.tolist(), precision.tolist()))),
            'roc_curve': list(map(list, zip(fpr.tolist(), tpr.tolist())))}

    for depth in [1, 3, 6, None]:
        model = pipeline('tree', depth=depth).fit(x, y)
        result['tree_depth'].append({'depth': depth,
            'train_ap': classification(y, model.predict_proba(x)[:, 1])['average_precision'],
            'validation_ap': classification(vy, model.predict_proba(vx)[:, 1])['average_precision']})

    search = GridSearchCV(pipeline('tree'), {'model__max_depth': [1, 3, 6]},
                          scoring='average_precision', cv=TimeSeriesSplit(n_splits=3))
    search.fit(x, y)
    result['selection_train_only'] = {'best_depth': search.best_params_['model__max_depth'],
        'mean_cv_ap': search.cv_results_['mean_test_score'].tolist(),
        'candidates': [1, 3, 6]}

    rx = np.arange(1., 11.)
    ry = 2 + 3*rx + np.array([0, 1, -1, 0, 1, -1, 0, 1, -1, 0])
    coefficients = ols(rx, ry)
    reference = LinearRegression().fit(rx[:, None], ry)
    result['ols'] = {'numpy': coefficients.tolist(),
        'sklearn': [float(reference.intercept_), float(reference.coef_[0])],
        'training_metrics': regression(ry, reference.predict(rx[:, None]))}

    clusters = clustering_demo()
    points = np.array(clusters['points'])
    pca = PCA(n_components=1).fit(points)
    detector = IsolationForest(contamination=.05, random_state=SEED).fit(points)
    clusters['pca_one_component_variance'] = float(pca.explained_variance_ratio_[0])
    clusters['far_points_anomaly_labels'] = detector.predict([[8, 8], [-8, -8]]).tolist()
    result['clustering'] = clusters

    result['calibration_toy'] = calibration_demo()
    logistic = pipeline('logistic').fit(x, y)
    lp = logistic.predict_proba(vx)[:, 1]
    result['validation_predictions'] = {'y': vy.tolist(), 'logistic': lp.tolist()}
    calibrator = CalibratedClassifierCV(pipeline('logistic'), method='sigmoid',
                                       cv=TimeSeriesSplit(n_splits=3), ensemble=True)
    calibrator.fit(x, y)
    calibrated = calibrator.predict_proba(vx)[:, 1]
    observed, predicted = calibration_curve(vy, lp, n_bins=5, strategy='uniform')
    result['calibration_validation'] = {'original_brier': classification(vy, lp)['brier'],
        'calibrated_brier': classification(vy, calibrated)['brier'],
        'observed_fraction': observed.tolist(), 'mean_prediction': predicted.tolist()}
    result['threshold_validation'] = [classification(vy, lp, t) for t in [.2, .5, .8]]
    result['subgroups_validation'] = {}
    for hub in ['rural', 'urban']:
        mask = val.hub == hub
        result['subgroups_validation'][hub] = {
            'n': int(mask.sum()), 'positives': int(vy[mask].sum()),
            'metrics': classification(vy[mask], lp[mask])}
    importance = permutation_importance(logistic, vx, vy, scoring='neg_log_loss',
                                        n_repeats=5, random_state=SEED)
    result['permutation_validation'] = dict(zip(FEATURES, importance.importances_mean.tolist()))

    without_rain = pipeline('logistic', numeric=['distance_km', 'load']).fit(x, y)
    result['ablation_validation'] = {'all_features': classification(vy, lp)['average_precision'],
        'without_rain': classification(vy, without_rain.predict_proba(vx)[:, 1])['average_precision']}
    baseline = pipeline('baseline').fit(x, y).predict_proba(vx)[:, 1]
    result['paired_brier_validation'] = paired_interval((vy.to_numpy()-baseline)**2,
                                                        (vy.to_numpy()-lp)**2)
    result['forest_seeds_validation'] = [
        classification(vy, pipeline('forest', seed=s).fit(x, y).predict_proba(vx)[:, 1])['average_precision']
        for s in [SEED, SEED+1, SEED+2]]

    # Evaluación final predefinida: ninguna decisión posterior depende de estas cifras.
    protocol = json.loads(Path('protocol.json').read_text())
    result['final_test'] = {}
    result['test_predictions'] = {'id': test.shipment_id.tolist(), 'y': test.delayed.tolist()}
    for kind in protocol['final_models']:
        fitted = pipeline(kind).fit(x, y)
        probability = fitted.predict_proba(test[FEATURES])[:, 1]
        result['final_test'][kind] = classification(test.delayed, probability, protocol['threshold'])
        result['test_predictions'][kind] = probability.tolist()
    return result


if __name__ == '__main__':
    print(json.dumps(run(), indent=2, allow_nan=False))
