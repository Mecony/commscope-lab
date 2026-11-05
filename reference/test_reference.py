import unittest
import numpy as np
from simulate import map_bits, demap, theoretical_ber, run_point, interval


class ModelTests(unittest.TestCase):
    def test_unit_energy_and_odd_length_roundtrip(self):
        data = np.array([0, 1, 1, 0, 1], dtype=np.int8)
        for mode in ('BPSK', 'QPSK'):
            tx = map_bits(data, mode)
            np.testing.assert_allclose(np.abs(tx)**2, 1)
            np.testing.assert_array_equal(demap(tx, mode, len(data)), data)

    def test_known_theoretical_value(self):
        self.assertAlmostEqual(theoretical_ber(0), 0.07864960352514258, places=14)

    def test_monte_carlo_matches_theory_with_sampling_tolerance(self):
        for mode in ('BPSK', 'QPSK'):
            r = run_point(mode, 4, 2026, 500000, 5000)
            p = r['theory']
            self.assertLess(abs(r['ber']-p), 6*np.sqrt(p*(1-p)/r['bits']))

    def test_zero_error_bound(self):
        bound = interval(0, 100000)['high']
        self.assertAlmostEqual((1-bound)**100000, .05, places=10)


if __name__ == '__main__':
    unittest.main()
