import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import { InvalidTokenError } from '../router/actions/errors'
import { Market } from './market'
import { type SimpleOfferData, simulate } from './simulation'
import { Token } from './token'

const WETH_ADDRESS: Address = '0x0000000000000000000000000000000000000001'
const USDC_ADDRESS: Address = '0x0000000000000000000000000000000000000002'
const OTHER_ADDRESS: Address = '0x0000000000000000000000000000000000000003'

// Use units that ensure normalized amounts fit within 48 bits
// WETH: unit = 10^14 means amounts are in 0.0001 ETH units
// USDC: unit = 100 means amounts are in 0.0001 USDC units
const WETH = Token.from(WETH_ADDRESS, 18, 'WETH', 10n ** 14n)
const USDC = Token.from(USDC_ADDRESS, 6, 'USDC', 100n)
const OTHER = Token.from(OTHER_ADDRESS, 18, 'OTHER', 10n ** 14n)

const market = Market.create({
	base: WETH.amount(WETH.unit),
	quote: USDC.amount(USDC.unit),
	tickSpacing: 1n,
	askFees: 1000, // 0.1% fee
})

// Use small amounts to avoid overflow in inbound calculations
// With WETH unit=10^14, amount('0.0001') = 1 normalized unit
// With USDC unit=100, amount('0.01') = 100 normalized units

describe('simulate (exact in)', () => {
	it('simulates with no offers', () => {
		const result = simulate({
			market: market.asks,
			amount: USDC.amount('1'),
			offers: [],
		})

		expect(result.gave.amount).toBe(0n)
		expect(result.got.amount).toBe(0n)
		expect(result.fee.amount).toBe(0n)
		expect(result.bounty.amount).toBe(0n)
	})

	it('simulates exact in with single offer fully filled', () => {
		// Use market.asks.price to get correct tick for a given human price
		const tick = market.asks.price(3500)
		const wethAmount = WETH.amount('0.0001') // 1 normalized unit

		const offers: SimpleOfferData[] = [
			{
				gives: wethAmount,
				tick,
			},
		]

		// Calculate how much USDC is needed to buy this amount (add buffer for fees)
		const inboundNeeded = tick.inboundFromOutbound(wethAmount, USDC)
		// Add 1% buffer to account for fees
		const withBuffer = USDC.amount((inboundNeeded.amount * 101n) / 100n)

		const result = simulate({
			market: market.asks,
			amount: withBuffer,
			offers,
		})

		expect(result.got.amount).toBe(wethAmount.amount)
	})

	it('simulates exact in with partial fill', () => {
		const tick = market.asks.price(3500)
		const wethAmount = WETH.amount('0.001') // 10 normalized units

		const offers: SimpleOfferData[] = [
			{
				gives: wethAmount,
				tick,
			},
		]

		// Try to buy with only half the needed amount
		const inboundNeeded = tick.inboundFromOutbound(wethAmount, USDC)
		const halfAmount = USDC.amount(inboundNeeded.amount / 2n)

		const result = simulate({
			market: market.asks,
			amount: halfAmount,
			offers,
		})

		// Should get less than original due to partial fill
		expect(result.got.amount).toBeLessThan(wethAmount.amount)
		expect(result.got.amount).toBeGreaterThan(0n)
	})

	it('simulates with multiple offers at different ticks', () => {
		const tick1 = market.asks.price(3500)
		const tick2 = market.asks.price(3600)
		const wethAmount = WETH.amount('0.0001')

		const offers: SimpleOfferData[] = [
			{ gives: wethAmount, tick: tick1 },
			{ gives: wethAmount, tick: tick2 },
		]

		// Large amount to fill both offers
		const result = simulate({
			market: market.asks,
			amount: USDC.amount('1'),
			offers,
		})

		expect(result.got.amount).toBe(wethAmount.amount * 2n)
	})

	it('respects maxTick parameter', () => {
		const tick1 = market.asks.price(3500)
		const tick2 = market.asks.price(4000)
		const wethAmount = WETH.amount('0.0001')

		const offers: SimpleOfferData[] = [
			{ gives: wethAmount, tick: tick1 },
			{ gives: wethAmount, tick: tick2 },
		]

		// Set maxTick to exclude second offer
		const maxTick = market.asks.price(3700)

		const result = simulate({
			market: market.asks,
			amount: USDC.amount('1'),
			offers,
			maxTick,
		})

		expect(result.got.amount).toBe(wethAmount.amount)
	})

	it('skips expired offers and collects bounty', () => {
		const tick = market.asks.price(3500)
		const pastDate = new Date(Date.now() - 1000 * 60 * 60) // 1 hour ago
		const wethAmount = WETH.amount('0.0001')

		const offers: SimpleOfferData[] = [
			{
				gives: wethAmount,
				tick,
				expiry: pastDate,
				provision: Token.PROVISION_TOKEN.amount('0.001'),
			},
		]

		const result = simulate({
			market: market.asks,
			amount: USDC.amount('1'),
			offers,
			provision: Token.PROVISION_TOKEN.amount('0.01'),
		})

		expect(result.got.amount).toBe(0n)
		expect(result.bounty.amount).toBeGreaterThan(0n)
	})

	it('processes non-expired offers', () => {
		const tick = market.asks.price(3500)
		const futureDate = new Date(Date.now() + 1000 * 60 * 60) // 1 hour from now
		const wethAmount = WETH.amount('0.0001')

		const offers: SimpleOfferData[] = [
			{
				gives: wethAmount,
				tick,
				expiry: futureDate,
			},
		]

		const result = simulate({
			market: market.asks,
			amount: USDC.amount('1'),
			offers,
		})

		expect(result.got.amount).toBe(wethAmount.amount)
	})
})

describe('simulate (exact out)', () => {
	it('simulates exact out with single offer', () => {
		const tick = market.asks.price(3500)
		const wethAmount = WETH.amount('0.0001')

		const offers: SimpleOfferData[] = [
			{
				gives: wethAmount,
				tick,
			},
		]

		const wantAmount = WETH.amount('0.00005') // Half the offer

		const result = simulate({
			market: market.asks,
			amount: wantAmount,
			offers,
		})

		expect(result.got.amount).toBe(wantAmount.amount)
	})

	it('simulates exact out with partial fill from larger offer', () => {
		const tick = market.asks.price(3500)
		const wethAmount = WETH.amount('0.001') // 10 normalized units

		const offers: SimpleOfferData[] = [
			{
				gives: wethAmount,
				tick,
			},
		]

		const wantAmount = WETH.amount('0.0001') // 1 normalized unit

		const result = simulate({
			market: market.asks,
			amount: wantAmount,
			offers,
		})

		expect(result.got.amount).toBe(wantAmount.amount)
	})

	it('simulates exact out spanning multiple offers', () => {
		const tick1 = market.asks.price(3500)
		const tick2 = market.asks.price(3600) // Use larger price gap
		const wethAmount = WETH.amount('0.0001')

		const offers: SimpleOfferData[] = [
			{ gives: wethAmount, tick: tick1 },
			{ gives: wethAmount, tick: tick2 },
		]

		const wantAmount = WETH.amount('0.0002') // Needs both offers

		const result = simulate({
			market: market.asks,
			amount: wantAmount,
			offers,
		})

		expect(result.got.amount).toBe(wantAmount.amount)
	})

	it('respects maxTick in exact out mode', () => {
		const tick1 = market.asks.price(3500)
		const tick2 = market.asks.price(4500)
		const wethAmount = WETH.amount('0.00005')

		const offers: SimpleOfferData[] = [
			{ gives: wethAmount, tick: tick1 },
			{ gives: wethAmount, tick: tick2 },
		]

		// Set maxTick to exclude second offer
		const maxTick = market.asks.price(4000)

		const wantAmount = WETH.amount('0.0001') // Needs both offers

		const result = simulate({
			market: market.asks,
			amount: wantAmount,
			offers,
			maxTick,
		})

		// Only gets first offer
		expect(result.got.amount).toBe(wethAmount.amount)
	})
})

describe('simulate error handling', () => {
	it('throws InvalidTokenError for wrong token', () => {
		const tick = market.asks.price(3500)
		const wethAmount = WETH.amount('0.0001')

		const offers: SimpleOfferData[] = [
			{
				gives: wethAmount,
				tick,
			},
		]

		expect(() =>
			simulate({
				market: market.asks,
				amount: OTHER.amount('0.0001'), // Wrong token
				offers,
			}),
		).toThrow(InvalidTokenError)
	})
})
