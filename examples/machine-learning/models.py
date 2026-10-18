import numpy as np
from numpy.typing import ArrayLike
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.compose import ColumnTransformer
from sklearn.datasets import make_moons
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, confusion_matrix, brier_score_loss,
    log_loss, mean_absolute_error, mean_squared_error, adjusted_rand_score,
    silhouette_score)
from sklearn.model_selection import train_test_split
from sklearn.neighbors import KNeighborsRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.tree import DecisionTreeClassifier

from data import SEED


def pipeline(kind: str, depth: int | None = 3, seed: int = SEED,
             numeric: list[str] | None = None) -> Pipeline:
    numeric = numeric or ['distance_km', 'load', 'rain_forecast']
    prepare = ColumnTransformer([
        ('numeric', Pipeline([
            ('impute', SimpleImputer(strategy='median')),
            ('scale', StandardScaler()),
        ]), numeric),
        ('category', OneHotEncoder(handle_unknown='ignore', sparse_output=False), ['hub']),
    ])
    estimators = {
        'baseline': DummyClassifier(strategy='prior'),
        'logistic': LogisticRegression(C=1., max_iter=1000),
        'tree': DecisionTreeClassifier(max_depth=depth, min_samples_leaf=10, random_state=seed),
        'forest': RandomForestClassifier(n_estimators=100, max_depth=5,
                    min_samples_leaf=5, random_state=seed, n_jobs=1),
        'boosting': HistGradientBoostingClassifier(max_iter=80, max_leaf_nodes=7,
                    learning_rate=.1, early_stopping=False, random_state=seed),
    }
    return Pipeline([('prepare', prepare), ('model', estimators[kind])])


def ols(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    design = np.column_stack([np.ones(len(x)), x])
    coefficients, _, rank, _ = np.linalg.lstsq(design, y, rcond=None)
    if rank < design.shape[1]:
        raise ValueError('no hay solución única para los coeficientes')
    return coefficients


def leakage_scaling() -> dict[str, float]:
    train = np.array([[1.], [2.], [3.]])
    held_out = np.array([[100.]])
    correct = StandardScaler().fit(train)
    leaked = StandardScaler().fit(np.vstack([train, held_out]))
    return {'train_mean': float(correct.mean_[0]), 'all_mean': float(leaked.mean_[0]),
            'held_out_correct': float(correct.transform(held_out)[0, 0]),
            'held_out_leaked': float(leaked.transform(held_out)[0, 0])}


def temporal_demo() -> dict[str, float | int]:
    time = np.arange(300).reshape(-1, 1)
    target = time[:, 0]/10
    a, b = train_test_split(np.arange(300), test_size=.3, random_state=SEED)
    random_model = KNeighborsRegressor(n_neighbors=3).fit(time[a], target[a])
    future_model = KNeighborsRegressor(n_neighbors=3).fit(time[:210], target[:210])
    return {'random_mae': float(mean_absolute_error(target[b], random_model.predict(time[b]))),
            'future_mae': float(mean_absolute_error(target[210:], future_model.predict(time[210:]))),
            'last_train': 209, 'first_future': 210}


def classification(y: ArrayLike, probability: ArrayLike,
                   threshold: float = .5) -> dict[str, object]:
    predicted = np.asarray(probability) >= threshold
    return {
        'threshold': threshold,
        'accuracy': float(accuracy_score(y, predicted)),
        'precision': float(precision_score(y, predicted, zero_division=0)),
        'recall': float(recall_score(y, predicted, zero_division=0)),
        'f1': float(f1_score(y, predicted, zero_division=0)),
        'roc_auc': float(roc_auc_score(y, probability)),
        'average_precision': float(average_precision_score(y, probability)),
        'brier': float(brier_score_loss(y, probability)),
        'log_loss': float(log_loss(y, probability, labels=[0, 1])),
        'confusion': confusion_matrix(y, predicted, labels=[0, 1]).tolist(),
    }


def regression(y: ArrayLike, predicted: ArrayLike) -> dict[str, float]:
    mse = float(mean_squared_error(y, predicted))
    return {'mae': float(mean_absolute_error(y, predicted)), 'mse': mse, 'rmse': float(np.sqrt(mse))}


def calibration_demo() -> dict[str, object]:
    y = np.array([0]*8 + [1]*2 + [0]*2 + [1]*8)
    honest = np.array([.2]*10 + [.8]*10)
    confident = np.array([.01]*10 + [.99]*10)
    return {'honest': classification(y, honest), 'confident': classification(y, confident)}


def clustering_demo() -> dict[str, object]:
    x, truth = make_moons(n_samples=240, noise=.06, random_state=SEED)
    x = StandardScaler().fit_transform(x)
    a = KMeans(n_clusters=2, n_init=10, random_state=SEED).fit_predict(x)
    b = KMeans(n_clusters=2, n_init=10, random_state=SEED+1).fit_predict(x)
    dbscan = []
    for eps in [.12, .3, .8]:
        labels = DBSCAN(eps=eps, min_samples=5).fit_predict(x)
        mask = labels != -1
        clusters = len(set(labels[mask]))
        silhouette = (float(silhouette_score(x[mask], labels[mask]))
                      if 1 < clusters < mask.sum() else None)
        dbscan.append({'eps': eps, 'clusters': clusters, 'noise': int((~mask).sum()),
                       'silhouette_without_noise': silhouette,
                       'ari_with_synthetic_truth': float(adjusted_rand_score(truth, labels))})
    hierarchical = AgglomerativeClustering(n_clusters=2, linkage='single').fit_predict(x)
    return {'points': x.tolist(), 'kmeans_labels': a.tolist(),
            'kmeans_silhouette': float(silhouette_score(x, a)),
            'kmeans_seed_ari': float(adjusted_rand_score(a, b)),
            'kmeans_truth_ari': float(adjusted_rand_score(truth, a)),
            'hierarchical_truth_ari': float(adjusted_rand_score(truth, hierarchical)),
            'dbscan': dbscan}


def paired_interval(a: ArrayLike, b: ArrayLike, seed: int = 17) -> list[float]:
    # Pérdidas por observación de dos predicciones fijas sobre los mismos casos.
    difference = np.asarray(a) - np.asarray(b)
    if len(difference) < 2 or np.asarray(a).shape != np.asarray(b).shape:
        raise ValueError('se necesitan pares de pérdidas')
    indexes = np.random.default_rng(seed).integers(0, len(difference), (2000, len(difference)))
    return np.quantile(difference[indexes].mean(axis=1), [.025, .975]).tolist()
