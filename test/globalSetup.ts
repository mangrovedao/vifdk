import { anvil, type Instance } from 'prool/instances'
import type { Address } from 'viem'
import type { GlobalSetupContext } from 'vitest/node'
import { deployToken, deployWETH } from './config/tokens'
import { deployMulticall } from './config/utils'
import {
	deployVif,
	deployVifReader,
	deployVifRouter,
	openMarket,
} from './config/vif'
import { BASE_IPC, BASE_PORT, baseClient, MNEMONIC } from './utils'

declare module 'vitest' {
	export interface ProvidedContext {
		testConfig: {
			WETH: Address
			USDC: Address
			Vif: Address
			VifReader: Address
			VifRouter: Address
			multicall: Address
			market: {
				base: Address
				quote: Address
				tickSpacing: `${bigint}`
				askFees: number
				bidsFees: number
			}
		}
	}
}

let baseInstance: Instance | undefined

export default async function globalSetup({
	provide,
}: GlobalSetupContext): Promise<() => Promise<void>> {
	if (baseInstance) await baseInstance.stop()

	baseInstance = anvil({
		mnemonic: MNEMONIC,
		port: BASE_PORT,
		ipc: BASE_IPC,
	})
	await baseInstance.start()

	const client = baseClient()

	// deploy WETH
	const WETH = await deployWETH(client, 10n ** 14n)

	// deploy USDC
	const USDC = await deployToken(client, 'USDC', 'USDC', 6, 100n)

	// deploy VIF
	const Vif = await deployVif(
		client,
		client.account.address,
		10, // provision in gwei
	)

	// deploy VIFReader
	const VifReader = await deployVifReader(client, Vif)

	// deploy VIFRouter
	const VifRouter = await deployVifRouter(
		client,
		Vif,
		WETH.address,
		client.account.address,
	)

	// deploy multicall
	const multicall = await deployMulticall(client)

	// open market
	const market = await openMarket(
		client,
		WETH.amount('0.001'),
		USDC.amount('5'),
		1n,
		100,
		Vif,
		VifReader,
	)

	// Provide config to tests via vitest context
	provide('testConfig', {
		WETH: WETH.address,
		USDC: USDC.address,
		Vif,
		VifReader,
		VifRouter,
		multicall,
		market: {
			base: market.base.token.address,
			quote: market.quote.token.address,
			tickSpacing: `${market.tickSpacing}`,
			askFees: market.askFees ?? 0,
			bidsFees: market.bidsFees ?? 0,
		},
	})

	// Return teardown function (base instance cleanup)
	return async () => {
		if (baseInstance) await baseInstance.stop()
	}
}
