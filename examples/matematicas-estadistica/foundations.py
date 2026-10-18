"""Modelos pequeños para aprender, no sustitutos de bibliotecas numéricas."""
import cmath
import math
import random
from itertools import combinations
from statistics import fmean


def dot(a: list[float], b: list[float]) -> float:
    if not a or len(a) != len(b):
        raise ValueError('dimensiones incompatibles')
    return math.fsum(x*y for x, y in zip(a, b))


def cosine(a: list[float], b: list[float]) -> float:
    numerator = dot(a, b)
    denominator = math.hypot(*a) * math.hypot(*b)
    if denominator == 0:
        raise ValueError('el vector cero no tiene dirección')
    return max(-1.0, min(1.0, numerator / denominator))


def shape(rows: list[list[float]]) -> tuple[int, int]:
    if not rows or not rows[0] or any(len(row) != len(rows[0]) for row in rows):
        raise ValueError('matriz vacía o irregular')
    if any(not math.isfinite(value) for row in rows for value in row):
        raise ValueError('se requieren valores finitos')
    return len(rows), len(rows[0])


def matmul(a: list[list[float]], b: list[list[float]]) -> list[list[float]]:
    _, columns = shape(a)
    rows, _ = shape(b)
    if columns != rows:
        raise ValueError('dimensiones incompatibles')
    return [[dot(row, list(column)) for column in zip(*b)] for row in a]


def symmetric_eigen(matrix: list[list[float]]) -> tuple[list[float], list[list[float]]]:
    """Rotaciones de Jacobi, solo matrices simétricas pequeñas (2D/3D)."""
    n, columns = shape(matrix)
    if n != columns or n not in (2, 3):
        raise ValueError('solo matrices 2x2 o 3x3')
    if any(abs(matrix[i][j]-matrix[j][i]) > 1e-12 for i in range(n) for j in range(n)):
        raise ValueError('la matriz debe ser simétrica')
    a = [row[:] for row in matrix]
    vectors = [[float(i == j) for j in range(n)] for i in range(n)]
    for _ in range(100):
        p, q = max(combinations(range(n), 2), key=lambda pair: abs(a[pair[0]][pair[1]]))
        if abs(a[p][q]) <= 1e-12:
            order = sorted(range(n), key=lambda i: a[i][i], reverse=True)
            return [a[i][i] for i in order], [[row[i] for row in vectors] for i in order]
        angle = .5 * math.atan2(2*a[p][q], a[q][q]-a[p][p])
        c, s = math.cos(angle), math.sin(angle)
        rotation = [[float(i == j) for j in range(n)] for i in range(n)]
        rotation[p][p] = rotation[q][q] = c
        rotation[p][q], rotation[q][p] = s, -s
        a = matmul(matmul([list(row) for row in zip(*rotation)], a), rotation)
        vectors = matmul(vectors, rotation)
    raise ArithmeticError('Jacobi no convergió')


def pca(rows: list[list[float]], dimensions: int) -> dict:
    n, d = shape(rows)
    if n < 2 or not 1 <= dimensions <= d:
        raise ValueError('muestra o rango insuficiente')
    center = [fmean(column) for column in zip(*rows)]
    centered = [[value-mean for value, mean in zip(row, center)] for row in rows]
    columns = [list(column) for column in zip(*centered)]
    covariance = [[dot(a, b)/(n-1) for b in columns] for a in columns]
    values, vectors = symmetric_eigen(covariance)
    if sum(values) <= 1e-12:
        raise ValueError('no hay varianza que proyectar')
    components = vectors[:dimensions]
    projected = [[dot(row, vector) for vector in components] for row in centered]
    reconstructed = [[center[j] + math.fsum(score[k]*components[k][j] for k in range(dimensions)) for j in range(d)] for score in projected]
    error = math.fsum((x-y)**2 for row, rebuilt in zip(rows, reconstructed) for x, y in zip(row, rebuilt))
    return dict(mean=center, components=components, eigenvalues=values, projected=projected,
                reconstructed=reconstructed, retained=sum(values[:dimensions])/sum(values), squared_error=error)


def derivative(function, x: float, h: float = 1e-5) -> float:
    if not math.isfinite(h) or h <= 0:
        raise ValueError('h debe ser positivo y finito')
    return (function(x+h)-function(x-h))/(2*h)


def descend(gradient, start: float, rate: float, steps: int) -> list[float]:
    if rate <= 0 or not math.isfinite(rate) or steps < 0:
        raise ValueError('parámetros inválidos')
    values = [start]
    for _ in range(steps):
        next_value = values[-1] - rate*gradient(values[-1])
        if not math.isfinite(next_value) or abs(next_value) > 1e6:
            break
        values.append(next_value)
    return values


def bayes_flag(prior: float, sensitivity: float, false_positive: float) -> float:
    if not all(0 <= value <= 1 for value in (prior, sensitivity, false_positive)):
        raise ValueError('probabilidades fuera de [0,1]')
    joint = prior*sensitivity
    evidence = joint + (1-prior)*false_positive
    if evidence == 0:
        raise ValueError('el evento condicionado tiene probabilidad cero')
    return joint/evidence


def quantile(values: list[float], probability: float) -> float:
    if not values or not 0 <= probability <= 1:
        raise ValueError('muestra o probabilidad inválida')
    ordered = sorted(values)
    index = (len(ordered)-1)*probability
    lower, upper = math.floor(index), math.ceil(index)
    return ordered[lower] + (ordered[upper]-ordered[lower])*(index-lower)


def bootstrap_mean(values: list[float], repetitions: int = 2000, seed: int = 17) -> list[float]:
    if not values or repetitions < 2:
        raise ValueError('muestra vacía o pocas réplicas')
    rng = random.Random(seed)
    estimates = [fmean(rng.choices(values, k=len(values))) for _ in range(repetitions)]
    return [quantile(estimates, .025), quantile(estimates, .975)]


def permutation_mean(a: list[float], b: list[float]) -> dict:
    if not a or not b or len(a)+len(b) > 16:
        raise ValueError('experimento exacto limitado a 16 observaciones')
    pool = a+b
    observed = fmean(b)-fmean(a)
    statistics = []
    for indices in combinations(range(len(pool)), len(a)):
        selected = set(indices)
        first = [value for i, value in enumerate(pool) if i in selected]
        second = [value for i, value in enumerate(pool) if i not in selected]
        statistics.append(fmean(second)-fmean(first))
    extreme = sum(abs(value) >= abs(observed)-1e-12 for value in statistics)
    return dict(effect=observed, p_value=extreme/len(statistics), assignments=len(statistics), statistics=statistics)


def distribution(probabilities: list[float]) -> None:
    if not probabilities or any(not math.isfinite(p) or p < 0 for p in probabilities) or not math.isclose(sum(probabilities), 1, abs_tol=1e-12, rel_tol=0):
        raise ValueError('distribución inválida')


def entropy(p: list[float]) -> float:
    distribution(p)
    return -math.fsum(value*math.log(value) for value in p if value > 0)


def cross_entropy(p: list[float], q: list[float]) -> float:
    distribution(p)
    distribution(q)
    if len(p) != len(q):
        raise ValueError('soportes incompatibles')
    if any(x > 0 and y == 0 for x, y in zip(p, q)):
        return math.inf
    return -math.fsum(x*math.log(y) for x, y in zip(p, q) if x > 0)


def kl_divergence(p: list[float], q: list[float]) -> float:
    return cross_entropy(p, q)-entropy(p)


def softmax(logits: list[float]) -> list[float]:
    if not logits or not all(math.isfinite(value) for value in logits):
        raise ValueError('logits inválidos')
    maximum = max(logits)
    weights = [math.exp(value-maximum) for value in logits]
    denominator = math.fsum(weights)
    return [value/denominator for value in weights]


def nll_logits(logits: list[float], target: int) -> float:
    if not logits or not 0 <= target < len(logits) or not all(math.isfinite(value) for value in logits):
        raise ValueError('logits o clase inválidos')
    maximum = max(logits)
    return maximum-logits[target]+math.log(math.fsum(math.exp(value-maximum) for value in logits))


def dft(signal: list[complex]) -> list[complex]:
    n = len(signal)
    if not n:
        raise ValueError('señal vacía')
    return [sum(value*cmath.exp(-2j*math.pi*k*t/n) for t, value in enumerate(signal)) for k in range(n)]


def fft(signal: list[complex]) -> list[complex]:
    n = len(signal)
    if n == 0 or n & (n-1):
        raise ValueError('radix-2 requiere longitud potencia de dos')
    if n == 1:
        return list(signal)
    even, odd = fft(signal[::2]), fft(signal[1::2])
    twiddles = [cmath.exp(-2j*math.pi*k/n)*odd[k] for k in range(n//2)]
    return [even[k]+twiddles[k] for k in range(n//2)] + [even[k]-twiddles[k] for k in range(n//2)]


def convolve(signal: list[float], kernel: list[float]) -> list[float]:
    if not signal or not kernel:
        raise ValueError('entrada vacía')
    output = [0.0]*(len(signal)+len(kernel)-1)
    for i, value in enumerate(signal):
        for j, weight in enumerate(kernel):
            output[i+j] += value*weight
    return output
