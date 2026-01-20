import type { Address } from 'viem'
import { inject } from 'vitest'
import { Market, Token, type TokenAmount } from '../../src'
import type { VifTestConfig } from './vif'

export type TestConfig = {
	WETH: Token
	USDC: Token
	Vif: Address
	market: Market
	VifReader: Address
	VifRouter: Address
	multicall: Address
	provision: TokenAmount
}

/**
 * Get the test config from vitest's injected context.
 * Must be called within a test or hook (beforeAll, beforeEach, etc.)
 */
export function getTestConfig(): TestConfig {
	const testConfig = inject('testConfig')

	const WETH = Token.from(testConfig.WETH, 18, 'WETH', 10n ** 14n)
	const USDC = Token.from(testConfig.USDC, 6, 'USDC', 100n)

	return {
		WETH,
		USDC,
		Vif: testConfig.Vif,
		VifReader: testConfig.VifReader,
		VifRouter: testConfig.VifRouter,
		multicall: testConfig.multicall,
		market: Market.create({
			base: WETH.amount('0.001'),
			quote: USDC.amount('5'),
			tickSpacing: BigInt(testConfig.market.tickSpacing),
			askFees: testConfig.market.askFees,
			bidsFees: testConfig.market.bidsFees,
		}),
		provision: Token.PROVISION_TOKEN.amount('0.00001'),
	}
}

/**
 * Convert TestConfig to VifTestConfig for use with vif.ts helper functions.
 */
export function toVifTestConfig(config: TestConfig): VifTestConfig {
	return {
		Vif: config.Vif,
		VifRouter: config.VifRouter,
		VifReader: config.VifReader,
		WETH: config.WETH.address,
		provision: config.provision,
	}
}
