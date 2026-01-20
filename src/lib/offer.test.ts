import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import { Market } from './market'
import { Offer, OfferAmountOverflowError, unpackOffer } from './offer'
import { Tick } from './tick'
import { Token } from './token'

const WETH_ADDRESS: Address = '0x0000000000000000000000000000000000000001'
const USDC_ADDRESS: Address = '0x0000000000000000000000000000000000000002'

// Use units that ensure normalized amounts fit within 48 bits
// WETH: unit = 10^14 means amounts are in 0.0001 ETH units
// USDC: unit = 100 means amounts are in 0.0001 USDC units
const WETH = Token.from(WETH_ADDRESS, 18, 'WETH', 10n ** 14n)
const USDC = Token.from(USDC_ADDRESS, 6, 'USDC', 100n)

const market = Market.create({
	base: WETH.amount(WETH.unit),
	quote: USDC.amount(USDC.unit),
	tickSpacing: 1n,
})

describe('unpackOffer', () => {
	it('unpacks an offer with all fields set', () => {
		// Construct a packed offer with known values
		// prev=1, next=2, expiry=1700000000 (Nov 14, 2023), gives=1000, received=3500, tick=100, provision=1000, isActive=1
		const prev = 1n
		const next = 2n
		const expiry = 1700000000n
		const gives = 1000n
		const received = 3500n
		const tick = 100n
		const provision = 1000n
		const isActive = 1n

		const packed =
			(prev << 216n) |
			(next << 176n) |
			(expiry << 144n) |
			(gives << 96n) |
			(received << 48n) |
			(tick << 24n) |
			(provision << 1n) |
			isActive

		const result = unpackOffer(packed)

		expect(result.prev).toBe(1)
		expect(result.next).toBe(2)
		expect(result.expiry).toBeInstanceOf(Date)
		expect(result.expiry?.getTime()).toBe(1700000000 * 1000)
		expect(result.gives).toBe(1000n)
		expect(result.received).toBe(3500n)
		expect(result.tick).toBe(100n)
		expect(result.provision).toBe(1000n)
		expect(result.isActive).toBe(true)
	})

	it('unpacks an offer with no expiry', () => {
		// expiry = 0 means no expiry
		const packed =
			(1n << 216n) | // prev
			(2n << 176n) | // next
			(0n << 144n) | // expiry = 0
			(1000n << 96n) | // gives
			(3500n << 48n) | // received
			(100n << 24n) | // tick
			(1000n << 1n) | // provision
			1n // isActive

		const result = unpackOffer(packed)

		expect(result.expiry).toBeUndefined()
	})

	it('unpacks an inactive offer', () => {
		const packed =
			(1n << 216n) |
			(2n << 176n) |
			(0n << 144n) |
			(1000n << 96n) |
			(3500n << 48n) |
			(100n << 24n) |
			(1000n << 1n) |
			0n // isActive = false

		const result = unpackOffer(packed)

		expect(result.isActive).toBe(false)
	})

	it('unpacks an offer with negative tick', () => {
		// Negative tick uses signed 24-bit representation
		const negativeTick = BigInt.asUintN(24, -100n)

		const packed =
			(1n << 216n) |
			(2n << 176n) |
			(0n << 144n) |
			(1000n << 96n) |
			(3500n << 48n) |
			(negativeTick << 24n) |
			(1000n << 1n) |
			1n

		const result = unpackOffer(packed)

		expect(result.tick).toBe(-100n)
	})

	it('unpacks a zero offer', () => {
		const result = unpackOffer(0n)

		expect(result.prev).toBe(0)
		expect(result.next).toBe(0)
		expect(result.expiry).toBeUndefined()
		expect(result.gives).toBe(0n)
		expect(result.received).toBe(0n)
		expect(result.tick).toBe(0n)
		expect(result.provision).toBe(0n)
		expect(result.isActive).toBe(false)
	})
})

describe('Offer.checkOfferAmount', () => {
	it('returns true for amounts that fit in 48 bits', () => {
		expect(Offer.checkOfferAmount(0n)).toBe(true)
		expect(Offer.checkOfferAmount(1n)).toBe(true)
		expect(Offer.checkOfferAmount(2n ** 48n - 1n)).toBe(true)
	})

	it('returns false for amounts that exceed 48 bits', () => {
		expect(Offer.checkOfferAmount(2n ** 48n)).toBe(false)
		expect(Offer.checkOfferAmount(2n ** 48n + 1n)).toBe(false)
		expect(Offer.checkOfferAmount(2n ** 64n)).toBe(false)
	})

	it('returns false for negative amounts', () => {
		expect(Offer.checkOfferAmount(-1n)).toBe(false)
	})
})

describe('Offer.fromPacked', () => {
	it('creates an offer from packed data', () => {
		const packed =
			(1n << 216n) |
			(2n << 176n) |
			(0n << 144n) |
			(1000n << 96n) |
			(3500n << 48n) |
			(100n << 24n) |
			(1000n << 1n) |
			1n

		const offer = Offer.fromPacked(market.asks, packed, 5, WETH_ADDRESS)

		expect(offer.id).toBe(5)
		expect(offer.owner).toBe(WETH_ADDRESS)
		expect(offer.data.prev).toBe(1)
		expect(offer.data.next).toBe(2)
		expect(offer.data.gives.normalizedAmount).toBe(1000n)
		expect(offer.data.received.normalizedAmount).toBe(3500n)
		expect(offer.data.tick.value).toBe(100n)
		expect(offer.data.isActive).toBe(true)
	})

	it('uses default values for id and owner', () => {
		const packed =
			(1n << 216n) |
			(2n << 176n) |
			(0n << 144n) |
			(1000n << 96n) |
			(3500n << 48n) |
			(100n << 24n) |
			(1000n << 1n) |
			1n

		const offer = Offer.fromPacked(market.asks, packed)

		expect(offer.id).toBe(0)
		expect(offer.owner).toBe('0x0000000000000000000000000000000000000000')
	})
})

describe('Offer.fromData', () => {
	it('creates an offer from data', () => {
		const data = {
			prev: 1,
			next: 2,
			expiry: undefined,
			gives: WETH.amount('1'),
			received: USDC.amount('3500'),
			tick: Tick.fromValue(100n),
			provision: Token.PROVISION_TOKEN.amount('0.001'),
			isActive: true,
		}

		const offer = Offer.fromData(market.asks, data, 5, WETH_ADDRESS)

		expect(offer.id).toBe(5)
		expect(offer.owner).toBe(WETH_ADDRESS)
		expect(offer.data.prev).toBe(1)
		expect(offer.data.next).toBe(2)
		expect(offer.data.tick.value).toBe(100n)
	})

	it('throws OfferAmountOverflowError for gives amount exceeding 48 bits', () => {
		const data = {
			prev: 1,
			next: 2,
			expiry: undefined,
			gives: WETH.amount(2n ** 48n * WETH.unit),
			received: USDC.amount('3500'),
			tick: Tick.fromValue(100n),
			provision: Token.PROVISION_TOKEN.amount('0.001'),
			isActive: true,
		}

		expect(() => Offer.fromData(market.asks, data)).toThrow(
			OfferAmountOverflowError,
		)
	})

	it('throws OfferAmountOverflowError for received amount exceeding 48 bits', () => {
		const data = {
			prev: 1,
			next: 2,
			expiry: undefined,
			gives: WETH.amount('1'),
			received: USDC.amount(2n ** 48n * USDC.unit),
			tick: Tick.fromValue(100n),
			provision: Token.PROVISION_TOKEN.amount('0.001'),
			isActive: true,
		}

		expect(() => Offer.fromData(market.asks, data)).toThrow(
			OfferAmountOverflowError,
		)
	})
})

describe('Offer.toString', () => {
	it('returns a string representation of the offer', () => {
		const data = {
			prev: 1,
			next: 2,
			expiry: undefined,
			gives: WETH.amount('1'),
			received: USDC.amount('3500'),
			tick: Tick.fromValue(100n),
			provision: Token.PROVISION_TOKEN.amount('0.001'),
			isActive: true,
		}

		const offer = Offer.fromData(market.asks, data, 5, WETH_ADDRESS)
		const str = offer.toString()

		expect(str).toContain('Offer(')
		expect(str).toContain('id: 5')
		expect(str).toContain('isActive: true')
	})
})

describe('OfferAmountOverflowError', () => {
	it('creates error with custom label', () => {
		const error = new OfferAmountOverflowError(2n ** 48n, 'gives')
		expect(error.message).toContain('gives')
		expect(error.message).toContain('48 bits')
	})

	it('creates error with default label', () => {
		const error = new OfferAmountOverflowError(2n ** 48n)
		expect(error.message).toContain('offer amount')
	})
})
