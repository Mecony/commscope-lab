"""Independent NumPy/SciPy reference for coherent, uncoded BPSK/QPSK in AWGN."""
from __future__ import annotations
import argparse
import csv
import json
from pathlib import Path
import numpy as np
from scipy.special import erfc


def theoretical_ber(ebn0_db: float) -> float:
    return float(0.5 * erfc(np.sqrt(10.0 ** (ebn0_db / 10.0))))


def map_bits(bits: np.ndarray, mode: str) -> np.ndarray:
    if mode not in ('BPSK', 'QPSK'):
        raise ValueError('mode must be BPSK or QPSK')
    bits = np.asarray(bits, dtype=np.int8)
    if not len(bits) or np.any((bits != 0) & (bits != 1)):
        raise ValueError('bits must be a nonempty binary sequence')
    if mode == 'BPSK':
        return (1 - 2 * bits).astype(np.complex128)
    padded = np.pad(bits, (0, len(bits) % 2))
    return ((1 - 2 * padded[0::2]) + 1j * (1 - 2 * padded[1::2])) / np.sqrt(2)


def demap(symbols: np.ndarray, mode: str, length: int) -> np.ndarray:
    if mode == 'BPSK':
        return (symbols.real < 0).astype(np.int8)[:length]
    bits = np.empty(2 * len(symbols), dtype=np.int8)
    bits[0::2] = symbols.real < 0
    bits[1::2] = symbols.imag < 0
    return bits[:length]


def interval(errors: int, bits: int) -> dict:
    if errors == 0:
        return {'low': 0., 'high': float(-np.expm1(np.log(.05) / bits)), 'method': 'one-sided-exact-95'}
    if errors == bits:
        return {'low': float(np.exp(np.log(.05) / bits)), 'high': 1., 'method': 'one-sided-exact-95'}
    z = 1.959963984540054
    p, d = errors / bits, 1 + z*z/bits
    centre = (p + z*z/(2*bits)) / d
    half = z * np.sqrt(p*(1-p)/bits + z*z/(4*bits*bits)) / d
    return {'low': float(max(0, centre-half)), 'high': float(min(1, centre+half)), 'method': 'wilson-approx-95'}


def run_point(mode: str, ebn0: float, seed: int, max_bits: int, target_errors: int) -> dict:
    rng = np.random.default_rng(seed)
    k = 2 if mode == 'QPSK' else 1
    sigma = np.sqrt(1 / (2 * k * 10. ** (ebn0 / 10)))
    bits = errors = 0
    while bits < max_bits and errors < target_errors:
        count = min(10000, max_bits - bits)
        data = rng.integers(0, 2, count, dtype=np.int8)
        tx = map_bits(data, mode)
        noise = sigma * (rng.standard_normal(len(tx)) + 1j * rng.standard_normal(len(tx)))
        received = demap(tx + noise, mode, count)
        errors += int(np.count_nonzero(received != data))
        bits += count
    return {'mode': mode, 'ebn0': ebn0, 'seed': seed, 'bits': bits, 'errors': errors,
            'ber': errors / bits, 'theory': theoretical_ber(ebn0), **interval(errors, bits),
            'stoppedBy': 'target-errors' if errors >= target_errors else 'max-bits'}


def point_seed(seed: int, mode: str, ebn0: int) -> int:
    return (seed ^ (((ebn0 + 128) * 0x9e3779b1) & 0xffffffff) ^
            (0x12345678 if mode == 'BPSK' else 0x87654321)) & 0xffffffff


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ebn0', type=int, nargs='+', default=[0, 2, 4, 6, 8])
    parser.add_argument('--seed', type=int, default=2026)
    parser.add_argument('--max-bits', type=int, default=500000)
    parser.add_argument('--target-errors', type=int, default=200)
    parser.add_argument('--output', type=Path, default=Path('reference-results.csv'))
    parser.add_argument('--fixtures', action='store_true', help='write SciPy theoretical fixtures as JSON')
    args = parser.parse_args()
    if any(x < -4 or x > 14 for x in args.ebn0) or not 0 <= args.seed <= 0xffffffff:
        parser.error('Eb/N0 must be within -4..14 and seed within uint32')
    if not 10000 <= args.max_bits <= 2000000 or args.max_bits % 2 or not 20 <= args.target_errors <= 5000:
        parser.error('invalid sample budget or target errors')
    if args.fixtures:
        values = [{'ebn0': x, 'ber': theoretical_ber(x)} for x in range(-4, 15)]
        args.output.write_text(json.dumps(values, indent=2) + '\n')
        return
    rows = [run_point(mode, x, point_seed(args.seed, mode, x), args.max_bits, args.target_errors)
            for x in args.ebn0 for mode in ('BPSK', 'QPSK')]
    with args.output.open('w', newline='', encoding='utf-8') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print(f'Wrote {len(rows)} experiment points to {args.output}')


if __name__ == '__main__':
    main()
