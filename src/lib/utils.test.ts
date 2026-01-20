import { describe, expect, it } from 'vitest'
import { BitsOverflowError, checkFitsWithin, divUp, mulDivUp } from './utils'

describe('checkFitsWithin', () => {
	it('returns true for zero', () => {
		expect(checkFitsWithin(0n, 1)).toBe(true)
		expect(checkFitsWithin(0n, 8)).toBe(true)
		expect(checkFitsWithin(0n, 64)).toBe(true)
	})

	it('returns true for amounts that fit exactly', () => {
		expect(checkFitsWithin(1n, 1)).toBe(true)
		expect(checkFitsWithin(255n, 8)).toBe(true)
		expect(checkFitsWithin(2n ** 64n - 1n, 64)).toBe(true)
	})

	it('returns true for amounts below the limit', () => {
		expect(checkFitsWithin(127n, 8)).toBe(true)
		expect(checkFitsWithin(2n ** 32n - 1n, 64)).toBe(true)
	})

	it('returns false for amounts that exceed the bit limit', () => {
		expect(checkFitsWithin(2n, 1)).toBe(false)
		expect(checkFitsWithin(256n, 8)).toBe(false)
		expect(checkFitsWithin(2n ** 64n, 64)).toBe(false)
	})

	it('returns false for negative amounts', () => {
		expect(checkFitsWithin(-1n, 8)).toBe(false)
		expect(checkFitsWithin(-100n, 64)).toBe(false)
	})
})

describe('divUp', () => {
	it('divides exactly without rounding', () => {
		expect(divUp(10n, 2n)).toBe(5n)
		expect(divUp(100n, 10n)).toBe(10n)
		expect(divUp(9n, 3n)).toBe(3n)
	})

	it('rounds up when there is a remainder', () => {
		expect(divUp(10n, 3n)).toBe(4n) // 10/3 = 3.33... -> 4
		expect(divUp(11n, 3n)).toBe(4n) // 11/3 = 3.66... -> 4
		expect(divUp(7n, 2n)).toBe(4n) // 7/2 = 3.5 -> 4
	})

	it('handles edge cases', () => {
		expect(divUp(1n, 1n)).toBe(1n)
		expect(divUp(0n, 1n)).toBe(0n)
		expect(divUp(1n, 2n)).toBe(1n) // 0.5 -> 1
	})

	it('handles large numbers', () => {
		const large = 2n ** 128n
		expect(divUp(large, large)).toBe(1n)
		expect(divUp(large + 1n, large)).toBe(2n)
	})
})

describe('mulDivUp', () => {
	it('multiplies and divides exactly', () => {
		expect(mulDivUp(10n, 2n, 4n)).toBe(5n) // (10 * 2) / 4 = 5
		expect(mulDivUp(100n, 10n, 100n)).toBe(10n) // (100 * 10) / 100 = 10
	})

	it('rounds up when there is a remainder', () => {
		expect(mulDivUp(10n, 3n, 4n)).toBe(8n) // (10 * 3) / 4 = 7.5 -> 8
		expect(mulDivUp(7n, 3n, 4n)).toBe(6n) // (7 * 3) / 4 = 5.25 -> 6
	})

	it('handles zero numerator', () => {
		expect(mulDivUp(0n, 100n, 10n)).toBe(0n)
		expect(mulDivUp(100n, 0n, 10n)).toBe(0n)
	})

	it('handles large numbers without overflow', () => {
		const large = 2n ** 64n
		expect(mulDivUp(large, large, large)).toBe(large)
	})
})

describe('BitsOverflowError', () => {
	it('creates error with correct message', () => {
		const error = new BitsOverflowError(8, 256n)
		expect(error.message).toContain('8 bits')
		expect(error.message).toContain('256')
		expect(error.message).toContain('amount')
	})

	it('creates error with custom label', () => {
		const error = new BitsOverflowError(16, 70000n, 'custom value')
		expect(error.message).toContain('16 bits')
		expect(error.message).toContain('70000')
		expect(error.message).toContain('custom value')
	})

	it('is an instance of RangeError', () => {
		const error = new BitsOverflowError(8, 256n)
		expect(error).toBeInstanceOf(RangeError)
	})

	it('includes the bit count of the actual value', () => {
		const error = new BitsOverflowError(8, 256n)
		expect(error.message).toContain('9 bits') // 256 = 2^8 = 9 bits
	})
})
