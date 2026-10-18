import math
import unittest

from foundations import (
    dot, cosine, matmul, pca, derivative, descend, bayes_flag,
    quantile, bootstrap_mean, permutation_mean, entropy, cross_entropy,
    kl_divergence, softmax, nll_logits, dft, fft, convolve,
)


class FoundationsTest(unittest.TestCase):
    def test_dot_and_shapes(self):
        self.assertEqual(dot([1, 2], [3, 4]), 11)
        self.assertEqual(matmul([[1, 2]], [[3], [4]]), [[11]])
        with self.assertRaises(ValueError):
            dot([1, 2], [1])
        with self.assertRaises(ValueError):
            matmul([[1, 2]], [[1, 2]])

    def test_cosine_ignores_positive_scale_but_not_zero(self):
        self.assertAlmostEqual(cosine([1, 2], [10, 20]), 1)
        self.assertAlmostEqual(cosine([1, 0], [0, 1]), 0)
        with self.assertRaises(ValueError):
            cosine([0, 0], [1, 2])

    def test_pca_reconstruction_and_variance(self):
        rows = [[3, 3, 0], [-3, -3, 0], [2, -2, 0], [-2, 2, 0], [0, 0, .5], [0, 0, -.5]]
        result = pca(rows, 2)
        self.assertAlmostEqual(sum(result['eigenvalues']), 10.5)
        self.assertAlmostEqual(result['retained'], 10.4 / 10.5)
        self.assertAlmostEqual(result['squared_error'], .5)
        for vector in result['components']:
            self.assertAlmostEqual(dot(vector, vector), 1)
        self.assertAlmostEqual(dot(*result['components']), 0)

    def test_pca_centers_and_rejects_invalid_rank(self):
        result = pca([[10, 11], [12, 13], [14, 15]], 1)
        self.assertEqual(result['mean'], [12, 13])
        self.assertAlmostEqual(result['squared_error'], 0)
        with self.assertRaises(ValueError):
            pca([[1, 1], [1, 1]], 1)
        with self.assertRaises(ValueError):
            pca([[1, 2], [3, 4]], 3)

    def test_chain_rule_matches_numeric_derivative(self):
        # L(w) = (3w - 4)^2, L'(w) = 6(3w - 4).
        self.assertAlmostEqual(derivative(lambda w: (3*w - 4)**2, 2), 12, places=6)
        with self.assertRaises(ValueError):
            derivative(lambda x: x*x, 1, 0)

    def test_learning_rate_convergence_and_divergence(self):
        stable = descend(lambda x: 2*x, 2, .1, 30)
        unstable = descend(lambda x: 2*x, 2, 1.1, 10)
        self.assertLess(abs(stable[-1]), .003)
        self.assertGreater(abs(unstable[-1]), 2)
        self.assertEqual(descend(lambda x: 4*x*(x*x-1), 0, .1, 10), [0]*11)

    def test_bayes_base_rate_and_invalid_probabilities(self):
        self.assertAlmostEqual(bayes_flag(.01, .9, .05), 90/585)
        with self.assertRaises(ValueError):
            bayes_flag(.01, 0, 0)
        with self.assertRaises(ValueError):
            bayes_flag(2, .9, .05)

    def test_quantiles_and_bootstrap_are_reproducible(self):
        self.assertEqual(quantile([1, 2, 3, 100], .5), 2.5)
        self.assertAlmostEqual(quantile([1, 2, 3, 100], .95), 85.45, places=10)
        self.assertEqual(bootstrap_mean([0, 1, 1, 1], 200, 12), bootstrap_mean([0, 1, 1, 1], 200, 12))
        self.assertEqual(bootstrap_mean([1]*10, 200, 12), [1, 1])

    def test_exact_permutation_not_a_probability_of_null(self):
        result = permutation_mean([1, 2, 3], [4, 5, 6])
        self.assertEqual(result['effect'], 3)
        self.assertEqual(result['assignments'], 20)
        self.assertAlmostEqual(result['p_value'], .1)

    def test_information_identity_and_support(self):
        p, q = [.25, .75], [.5, .5]
        self.assertAlmostEqual(cross_entropy(p, q), entropy(p) + kl_divergence(p, q))
        self.assertEqual(entropy([0, 1]), 0)
        self.assertEqual(cross_entropy([1, 0], [0, 1]), math.inf)
        with self.assertRaises(ValueError):
            entropy([.2, .2])

    def test_stable_logits_avoid_overflow_and_log_zero(self):
        self.assertAlmostEqual(sum(softmax([1000, 1001])), 1)
        self.assertAlmostEqual(nll_logits([1000, 1001], 1), math.log1p(math.exp(-1)))
        self.assertEqual(nll_logits([1000, -1000], 1), 2000)

    def test_fft_matches_dft_and_known_spectrum(self):
        signal = [math.sin(2*math.pi*5*n/64) + .5*math.sin(2*math.pi*12*n/64) for n in range(64)]
        actual, expected = fft(signal), dft(signal)
        self.assertLess(max(abs(a-b) for a,b in zip(actual, expected)), 1e-10)
        self.assertAlmostEqual(2*abs(actual[5])/64, 1)
        self.assertAlmostEqual(2*abs(actual[12])/64, .5)
        with self.assertRaises(ValueError):
            fft([1, 2, 3])

    def test_aliasing_and_convolution(self):
        a = [math.cos(2*math.pi*5*n/64) for n in range(64)]
        b = [math.cos(2*math.pi*59*n/64) for n in range(64)]
        self.assertLess(max(abs(x-y) for x,y in zip(a,b)), 1e-12)
        self.assertEqual(convolve([1, 2, 3], [1, 1]), [1, 3, 5, 3])


if __name__ == '__main__':
    unittest.main()
