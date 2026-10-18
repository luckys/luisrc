"""Resultados calculados y simulados; los datos no describen sistemas reales."""
import json
import math
import platform
import random
from statistics import fmean, median, stdev
from foundations import (
    dot, cosine, pca, derivative, descend, bayes_flag, quantile,
    bootstrap_mean, permutation_mean, entropy, cross_entropy,
    kl_divergence, nll_logits, fft,
)


def run() -> dict:
    rng = random.Random(20261018)
    rows = [[3, 3, 0], [-3, -3, 0], [2, -2, 0], [-2, 2, 0], [0, 0, .5], [0, 0, -.5]]
    latencies = [rng.lognormvariate(math.log(50), 1) for _ in range(1000)]
    # Muestra sintética de 200 resultados binarios independientes del generador.
    correct = [int(rng.random() < .8) for _ in range(200)]
    flags = spam_flags = 0
    for _ in range(100000):
        spam = rng.random() < .01
        flagged = rng.random() < (.9 if spam else .05)
        flags += flagged
        spam_flags += spam and flagged
    signal = [math.sin(2*math.pi*5*n/64)+.5*math.sin(2*math.pi*12*n/64) for n in range(64)]
    spectrum = fft(signal)
    probabilities, prediction = [.25, .75], [.5, .5]
    return {
        'python': platform.python_version(), 'seed': 20261018, 'data': 'synthetic',
        'vectors': {'a': [1, 2], 'b': [10, 20], 'dot': dot([1, 2], [10, 20]), 'cosine': cosine([1, 2], [10, 20]), 'distance': math.dist([1, 2], [10, 20])},
        'pca': {'input': rows, **pca(rows, 2)},
        'derivatives': [{'h': h, 'numeric': derivative(lambda w: (3*w-4)**2, 2, h), 'absolute_error': abs(derivative(lambda w: (3*w-4)**2, 2, h)-12), 'sin_error': abs(derivative(math.sin, 1, h)-math.cos(1))} for h in [1e-1, 1e-3, 1e-5, 1e-8, 1e-12, 1e-16]],
        'optimization': [{'rate': rate, 'points': [[i, x*x] for i, x in enumerate(descend(lambda x: 2*x, 2, rate, 15))]} for rate in [.1, .8, 1.1]],
        'bayes': {'analytic': bayes_flag(.01, .9, .05), 'trials': 100000, 'flags': flags, 'spam_flags': spam_flags, 'simulated': spam_flags/flags},
        'latency': {'samples_ms': latencies, 'mean': fmean(latencies), 'median': median(latencies), 'p95': quantile(latencies, .95), 'p99': quantile(latencies, .99), 'sample_stdev': stdev(latencies), 'quantile': 'linear at (n-1)*p'},
        'inference': {'observations': correct, 'accuracy': fmean(correct), 'bootstrap_seed': 17, 'replicates': 2000, 'percentile_95': bootstrap_mean(correct), 'naive_standard_error': stdev(correct)/math.sqrt(len(correct))},
        'ab': {'a': [1, 2, 3], 'b': [4, 5, 6], **permutation_mean([1, 2, 3], [4, 5, 6])},
        'information': {'p': probabilities, 'q': prediction, 'entropy_nats': entropy(probabilities), 'cross_entropy_nats': cross_entropy(probabilities, prediction), 'kl_nats': kl_divergence(probabilities, prediction), 'confident_correct': -math.log(.9), 'confident_wrong': -math.log(.1), 'extreme_nll': nll_logits([1000, -1000], 1)},
        'fourier': {'sample_rate_hz': 64, 'signal': signal, 'amplitudes': [[k, (1 if k in (0, 32) else 2)*abs(value)/64] for k, value in enumerate(spectrum[:33])]},
    }


if __name__ == '__main__':
    print(json.dumps(run(), ensure_ascii=False, allow_nan=False))
