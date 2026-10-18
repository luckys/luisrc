import hashlib
import json
import math
import unittest
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

from data import generate, clean, split, quality, FEATURES
from models import (pipeline, ols, leakage_scaling, temporal_demo, classification,
                    regression, calibration_demo, clustering_demo, paired_interval)


class DataTests(unittest.TestCase):
    def test_generator_repeats_with_explicit_seed(self):
        pd.testing.assert_frame_equal(generate(), generate())
        self.assertEqual(len(generate()), 909)

    def test_cleaning_is_explicit_and_preserves_missing_values(self):
        raw = generate()
        frame = clean(raw)
        self.assertEqual(len(frame), 900)
        self.assertEqual(frame.shipment_id.nunique(), 900)
        self.assertEqual(frame.distance_km.isna().sum(), 10)
        self.assertEqual(frame.load.isna().sum(), 5)
        self.assertEqual(quality(raw)['duplicates'], 6)
        self.assertEqual(quality(raw)['invalid_distance'], 3)

    def test_split_never_overlaps_or_uses_future(self):
        train, val, test = split(clean(generate()))
        self.assertEqual([len(x) for x in (train, val, test)], [540, 180, 180])
        self.assertLess(train.departure.max(), val.departure.min())
        self.assertLess(val.departure.max(), test.departure.min())
        self.assertFalse(set(train.shipment_id) & set(test.shipment_id))
        self.assertNotIn('delay_minutes', FEATURES)
        self.assertNotIn('delayed', FEATURES)
        self.assertNotIn('shipment_id', FEATURES)


class ModelTests(unittest.TestCase):
    def test_unknown_hub_and_missing_numbers_are_supported(self):
        train, val, _ = split(clean(generate()))
        model = pipeline('logistic').fit(train[FEATURES], train.delayed)
        row = val[FEATURES].iloc[:1].copy()
        row['hub'] = 'unseen'
        row['distance_km'] = np.nan
        probability = model.predict_proba(row)[0, 1]
        self.assertTrue(0 <= probability <= 1)

    def test_pipeline_scaler_fits_only_training(self):
        train, _, _ = split(clean(generate()))
        model = pipeline('logistic').fit(train[FEATURES], train.delayed)
        numeric = model['prepare'].named_transformers_['numeric']
        median = train.distance_km.median()
        expected = train.distance_km.fillna(median).mean()
        self.assertAlmostEqual(numeric['scale'].mean_[0], expected)

    def test_leaked_statistics_change_even_without_target(self):
        result = leakage_scaling()
        self.assertEqual(result['train_mean'], 2)
        self.assertEqual(result['all_mean'], 26.5)
        self.assertAlmostEqual(result['held_out_correct'], 98 / np.sqrt(2/3))

    def test_ols_matches_library_on_known_line(self):
        x = np.arange(1., 6.)
        y = 2 + 3*x
        coefficients = ols(x, y)
        fitted = LinearRegression().fit(x[:, None], y)
        np.testing.assert_allclose(coefficients, [2, 3], atol=1e-12)
        np.testing.assert_allclose(coefficients, [fitted.intercept_, fitted.coef_[0]])

    def test_ols_rejects_rank_deficient_design(self):
        with self.assertRaises(ValueError):
            ols(np.ones(5), np.arange(5))

    def test_interpolating_time_does_not_measure_extrapolation(self):
        result = temporal_demo()
        self.assertLess(result['random_mae'], result['future_mae'])
        self.assertLess(result['last_train'], result['first_future'])

    def test_confusion_and_threshold_are_independently_known(self):
        row = classification([0, 0, 1, 1], [0.1, 0.7, 0.4, 0.9])
        self.assertEqual(row['confusion'], [[1, 1], [1, 1]])
        self.assertEqual(row['precision'], .5)
        self.assertEqual(row['recall'], .5)
        self.assertAlmostEqual(row['average_precision'], 5/6)
        lower = classification([0, 0, 1, 1], [0.1, 0.7, 0.4, 0.9], .3)
        self.assertEqual(lower['recall'], 1)

    def test_regression_metrics_keep_units_distinct(self):
        row = regression([0, 0], [3, 4])
        self.assertEqual(row, {'mae': 3.5, 'mse': 12.5, 'rmse': np.sqrt(12.5)})

    def test_equal_ranking_can_have_different_calibration(self):
        result = calibration_demo()
        self.assertEqual(result['honest']['roc_auc'], result['confident']['roc_auc'])
        self.assertGreater(result['confident']['brier'], result['honest']['brier'])

    def test_cluster_noise_is_reported_and_labels_are_not_categories(self):
        result = clustering_demo()
        self.assertEqual(len(result['dbscan']), 3)
        self.assertTrue(any(row['noise'] > 0 for row in result['dbscan']))
        self.assertGreaterEqual(result['kmeans_seed_ari'], 0)
        self.assertLessEqual(result['kmeans_seed_ari'], 1)

    def test_paired_interval_uses_same_observation_indexes(self):
        low, high = paired_interval(np.ones(20), np.zeros(20))
        self.assertEqual((low, high), (1, 1))
        self.assertEqual(paired_interval(np.arange(20), np.zeros(20)),
                         paired_interval(np.arange(20), np.zeros(20)))


class ArchiveTests(unittest.TestCase):
    def test_csv_is_the_generated_fixture(self):
        actual = pd.read_csv('data/logistics-v1.csv', parse_dates=['departure'])
        pd.testing.assert_frame_equal(actual, generate(), check_exact=False,
                                      rtol=1e-12, atol=1e-12)

    def test_hashes_match_the_data_and_protocol(self):
        result = json.loads(Path('results/experiments.json').read_text())
        for path, key in [('data/logistics-v1.csv', 'dataset_sha256'),
                          ('protocol.json', 'protocol_sha256')]:
            self.assertEqual(hashlib.sha256(Path(path).read_bytes()).hexdigest(), result[key])

    def test_all_archived_calculations_reproduce_with_tolerance(self):
        from experiments import run
        expected = json.loads(Path('results/experiments.json').read_text())

        def compare(actual, archived):
            if isinstance(archived, dict):
                self.assertEqual(actual.keys(), archived.keys())
                for key in archived:
                    compare(actual[key], archived[key])
            elif isinstance(archived, list):
                self.assertEqual(len(actual), len(archived))
                for a, b in zip(actual, archived):
                    compare(a, b)
            elif isinstance(archived, float):
                self.assertTrue(math.isclose(actual, archived, rel_tol=1e-12, abs_tol=1e-12),
                                f'{actual} != {archived}')
            else:
                self.assertEqual(actual, archived)

        compare(run(), expected)


if __name__ == '__main__':
    unittest.main()
