import { describe, expect, it } from 'bun:test'
import { MAX_TICK, MIN_TICK } from '../../src/lib/constants'
import { TickSpacingOverflowError } from '../../src/lib/market'
import { PriceOverflowError, Tick, TickOverflowError } from '../../src/lib/tick'

describe('Tick.checkTick', () => {
	it('accepts boundary ticks', () => {
		expect(Tick.checkTick(MIN_TICK)).toBe(true)
		expect(Tick.checkTick(MAX_TICK)).toBe(true)
	})

	it('rejects out-of-range ticks', () => {
		expect(Tick.checkTick(MIN_TICK - 1n)).toBe(false)
		expect(Tick.checkTick(MAX_TICK + 1n)).toBe(false)
	})
})

describe('Tick.fromValue and tick spacing', () => {
	it('snaps to spacing by truncating toward zero (positive)', () => {
		const t = Tick.fromValue(13n, 5n)
		expect(t.value).toBe(10n)
	})

	it('snaps to spacing by truncating toward zero (negative)', () => {
		const t = Tick.fromValue(-13n, 5n)
		expect(t.value).toBe(-10n)
	})

	it('throws on invalid tick spacing', () => {
		expect(() => Tick.fromValue(0n, 0n)).toThrow(TickSpacingOverflowError)
	})

	it('throws when setting value out of range', () => {
		const t = Tick.fromValue(0n, 1n)
		expect(() => {
			t.value = MAX_TICK + 1n
		}).toThrow(TickOverflowError)
	})
})

describe('Tick.fromPrice', () => {
	it('converts price to tick is correct', () => {
		const t = Tick.fromPrice(1.00001)
		expect(t.value).toBe(1n)
	})

	it('throws when price is too small', () => {
		expect(() => Tick.fromPrice(-1)).toThrow(PriceOverflowError)
		expect(() => Tick.fromPrice(0)).toThrow(PriceOverflowError)
	})

	it('throws when price is too large', () => {
		expect(() => Tick.fromPrice(Infinity)).toThrow(PriceOverflowError)
	})

	it('throws when price is not a number', () => {
		expect(() => Tick.fromPrice(NaN)).toThrow(PriceOverflowError)
	})
})

describe('tickToPrice', () => {
	it.each([1000n, 0n, MAX_TICK, MIN_TICK, 1_000_000n, 8_000_000n])(
		'converts tick to price is correct',
		(value: bigint) => {
			const tick = Tick.fromValue(value)
			const price = Number(tick.price) / 2 ** 128
			tick.value = -tick.value
			const price2 = Number(tick.price) / 2 ** 128
			expect(price).toBeCloseTo(1 / price2, 4)
		},
	)
})

describe('Tick.fromIndex', () => {
	it('converts index to tick is correct', () => {
		const t = Tick.fromIndex(0)
		expect(t.value).toBe(MIN_TICK)
	})
})
