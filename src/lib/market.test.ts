import { beforeAll, describe, expect, it } from 'vitest'
import { getTestConfig, type TestConfig } from '~test/config'
import { Market } from './market'

describe('Market', () => {
	let config: TestConfig

	beforeAll(() => {
		config = getTestConfig()
	})

	it('Should convert an outbound amount to an inbound amount', () => {
		const market = Market.create({
			base: config.WETH,
			quote: config.USDC,
			tickSpacing: 1n,
		})
		let tick = market.asks.price(3500)
		let inbound = tick.inboundFromOutbound(config.WETH.amount('1'), config.USDC)
		expect(Number(inbound.amountString)).toBeCloseTo(3500, 2)

		tick = market.bids.price(3500)
		inbound = tick.inboundFromOutbound(config.USDC.amount('3500'), config.WETH)
		expect(Number(inbound.amountString)).toBeCloseTo(1, 2)
	})
})
