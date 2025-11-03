import { describe, expect, it } from 'bun:test'
import { rawOffer } from '../../src/builder/core/offer'
import { Offer } from '../../src/lib/offer'
import { Token } from '../../src/lib/token'
import { VifRouter } from '../../src/router/router'
import { config } from '../config/tokens'
import { authorize, createOffer, marketOrder } from '../config/vif'
import { VifRouterAbi } from '../static/VifRouterABI'
import { mainClient } from '../utils'

describe('Limit order', () => {
	it.only('should create a limit order, and parse it correctly', async () => {
		const client = mainClient()
		await authorize(client, config.Vif, config.VifRouter)
		// create a sell order for 1 ETH
		const router = new VifRouter(config.VifRouter, config.Vif, client.chain.id)

		const market = config.market.asks // sell
		const sellAmount = config.market.base.token.amount('1') // 1 ETH
		const expiry = new Date(Date.now() + 1000 * 60 * 60 * 24)
		const actions = router
			.createActions()
			.wrapNative(Token.NATIVE_TOKEN.amount('1'))
			.limitSingle({
				market: config.market.asks,
				gives: sellAmount,
				tick: market.price(3500),
				expiry,
			})
			.settleAll(Token.NATIVE_TOKEN) // settle native provision
			.settleAll(config.market.base.token) // settle base token
			.sweep({
				receiver: client.account.address,
				token: Token.NATIVE_TOKEN,
			})
			.build()

		const { commands, args } = actions.txData()

		const { result, request } = await client.simulateContract({
			address: config.VifRouter,
			abi: VifRouterAbi,
			functionName: 'execute',
			args: [commands, args],
			value: Token.NATIVE_TOKEN.amount('1.1').amount,
		})

		const parsedSimulationResult = actions.parseSimulationResult(result)
		expect(parsedSimulationResult).toBeDefined()
		expect(parsedSimulationResult.length).toBe(5)
		expect(parsedSimulationResult[0]).toBeUndefined()
		expect(parsedSimulationResult[2]).toBeUndefined()
		expect(parsedSimulationResult[3]).toBeUndefined()
		expect(parsedSimulationResult[4]).toBeUndefined()

		expect(parsedSimulationResult[1]).toBeDefined()
		expect(parsedSimulationResult[1].claimedReceived.amount).toBe(0n)
		expect(parsedSimulationResult[1].offerId).toBe(1)

		const receipt = await client.writeContractSync(request)

		const parsedReceipt = actions.parseLogs(receipt.logs)

		expect(parsedReceipt).toBeDefined()
		expect(parsedReceipt.length).toBe(5)
		expect(parsedReceipt[0]).toBeUndefined()
		expect(parsedReceipt[2]).toBeUndefined()
		expect(parsedReceipt[3]).toBeUndefined()
		expect(parsedReceipt[4]).toBeUndefined()

		expect(parsedReceipt[1]).toBeDefined()
		expect(parsedReceipt[1]?.offerId).toBe(1)
		expect(parsedReceipt[1]?.claimedReceived.amount).toBe(0n)

		const offer = await client
			.readContract({
				address: config.Vif,
				...rawOffer(config.market.asks, 1),
			})
			.then((val) => Offer.fromPacked(market, val, 1, client.account.address))

		const expiryTime = Math.floor(expiry.getTime() / 1000)
		const receivedExpiryTime = Math.floor(
			(offer.data.expiry?.getTime() ?? 0) / 1000,
		)

		expect(receivedExpiryTime).toBe(expiryTime)
		expect(offer.data.gives.amount).toBe(sellAmount.amount)
		expect(offer.data.received.amount).toBe(0n)
		expect(offer.data.tick.value).toBe(market.price(3500).value)
		expect(offer.data.provision.amount).toBeGreaterThan(0n)
		expect(offer.data.isActive).toBe(true)
	})

	it('Should cancel a limit order', async () => {
		const client = mainClient()
		await authorize(client, config.Vif, config.VifRouter)
		const offer = await createOffer(
			client,
			config.market.asks,
			config.market.base.token.amount('1'),
			config.market.asks.price(3500),
			new Date(Date.now() + 1000 * 60 * 60 * 24),
		)

		const router = new VifRouter(config.VifRouter, config.Vif, client.chain.id)
		const actions = router
			.createActions()
			.cancel({
				market: config.market.asks,
				offerId: offer.id,
			})
			.takeAll({
				receiver: client.account.address,
				token: config.market.base.token,
			})
			.takeAll({
				receiver: client.account.address,
				token: config.market.quote.token,
			})
			.takeAll({
				receiver: client.account.address,
				token: Token.NATIVE_TOKEN,
			})
			.build()

		const { commands, args } = actions.txData()

		const { result, request } = await client.simulateContract({
			address: config.VifRouter,
			abi: VifRouterAbi,
			functionName: 'execute',
			args: [commands, args],
		})

		const parsedSimulationResult = actions.parseSimulationResult(result)
		expect(parsedSimulationResult).toBeDefined()
		expect(parsedSimulationResult.length).toBe(4)
		expect(parsedSimulationResult[0]).toBeDefined()
		expect(parsedSimulationResult[0].inbound.amount).toBe(
			offer.data.received.amount,
		)
		expect(parsedSimulationResult[0].outbound.amount).toBe(
			offer.data.gives.amount,
		)
		expect(parsedSimulationResult[0].provision.amount).toBe(
			offer.data.provision.amount,
		)
		expect(parsedSimulationResult[1]).toBeUndefined()
		expect(parsedSimulationResult[2]).toBeUndefined()
		expect(parsedSimulationResult[3]).toBeUndefined()

		const receipt = await client.writeContractSync(request)
		const parsedReceipt = actions.parseLogs(receipt.logs)

		expect(parsedReceipt).toBeDefined()
		expect(parsedReceipt.length).toBe(4)
		expect(parsedReceipt[0]).toBeDefined()
		expect(parsedReceipt[0]?.inbound.amount).toBe(offer.data.received.amount)
		expect(parsedReceipt[0]?.outbound.amount).toBe(offer.data.gives.amount)
		expect(parsedReceipt[0]?.provision.amount).toBe(offer.data.provision.amount)
		expect(parsedReceipt[1]).toBeUndefined()
		expect(parsedReceipt[2]).toBeUndefined()
		expect(parsedReceipt[3]).toBeUndefined()
	})

	it('Should cancel a consumed limit order', async () => {
		const client = mainClient()
		await authorize(client, config.Vif, config.VifRouter)
		const offer = await createOffer(
			client,
			config.market.asks,
			config.market.base.token.amount('1'),
			config.market.asks.price(3500),
			new Date(Date.now() + 1000 * 60 * 60 * 24),
		)
		const orderResult = await marketOrder(
			client,
			config.market.asks,
			config.market.quote.token.amount('1000'),
		)

		const outbound = offer.data.gives.amount - orderResult.got.amount
		const inbound = orderResult.gave.amount
		const provision = offer.data.provision.amount

		const router = new VifRouter(config.VifRouter, config.Vif, client.chain.id)
		const actions = router
			.createActions()
			.cancel({
				market: config.market.asks,
				offerId: offer.id,
			})
			.takeAll({
				receiver: client.account.address,
				token: config.market.base.token,
			})
			.takeAll({
				receiver: client.account.address,
				token: config.market.quote.token,
			})
			.takeAll({
				receiver: client.account.address,
				token: Token.NATIVE_TOKEN,
			})
			.build()
		const { commands, args } = actions.txData()

		const { result, request } = await client.simulateContract({
			address: config.VifRouter,
			abi: VifRouterAbi,
			functionName: 'execute',
			args: [commands, args],
		})
		const parsedSimulationResult = actions.parseSimulationResult(result)
		expect(parsedSimulationResult).toBeDefined()
		expect(parsedSimulationResult.length).toBe(4)
		expect(parsedSimulationResult[0]).toBeDefined()
		expect(parsedSimulationResult[0].inbound.amount).toBe(inbound)
		expect(parsedSimulationResult[0].outbound.amount).toBe(outbound)
		expect(parsedSimulationResult[0].provision.amount).toBe(provision)
		expect(parsedSimulationResult[1]).toBeUndefined()
		expect(parsedSimulationResult[2]).toBeUndefined()
		expect(parsedSimulationResult[3]).toBeUndefined()

		const receipt = await client.writeContractSync(request)
		const parsedReceipt = actions.parseLogs(receipt.logs)

		expect(parsedReceipt).toBeDefined()
		expect(parsedReceipt.length).toBe(4)
		expect(parsedReceipt[0]).toBeDefined()
		expect(parsedReceipt[0]?.inbound.amount).toBe(inbound)
		expect(parsedReceipt[0]?.outbound.amount).toBe(outbound)
		expect(parsedReceipt[0]?.provision.amount).toBe(provision)
		expect(parsedReceipt[1]).toBeUndefined()
		expect(parsedReceipt[2]).toBeUndefined()
		expect(parsedReceipt[3]).toBeUndefined()
	})

	it('Should claim a consumed limit order', async () => {
		const client = mainClient()
		await authorize(client, config.Vif, config.VifRouter)
		const offer = await createOffer(
			client,
			config.market.asks,
			config.market.base.token.amount('1'),
			config.market.asks.price(3500),
			new Date(Date.now() + 1000 * 60 * 60 * 24),
		)
		const orderResult = await marketOrder(
			client,
			config.market.asks,
			config.market.quote.token.amount('1000'),
		)

		const inbound = orderResult.gave.amount

		const router = new VifRouter(config.VifRouter, config.Vif, client.chain.id)
		const actions = router
			.createActions()
			.claim({
				market: config.market.asks,
				offerId: offer.id,
			})
			.takeAll({
				receiver: client.account.address,
				token: config.market.quote.token,
			})
			.build()
		const { commands, args } = actions.txData()
		const { result, request } = await client.simulateContract({
			address: config.VifRouter,
			abi: VifRouterAbi,
			functionName: 'execute',
			args: [commands, args],
		})
		const parsedSimulationResult = actions.parseSimulationResult(result)
		expect(parsedSimulationResult).toBeDefined()
		expect(parsedSimulationResult.length).toBe(2)
		expect(parsedSimulationResult[0]).toBeDefined()
		expect(parsedSimulationResult[0].inbound.amount).toBe(inbound)
		expect(parsedSimulationResult[0].outbound.amount).toBe(0n)
		expect(parsedSimulationResult[0].provision.amount).toBe(0n)
		expect(parsedSimulationResult[1]).toBeUndefined()

		const receipt = await client.writeContractSync(request)
		const parsedReceipt = actions.parseLogs(receipt.logs)

		expect(parsedReceipt).toBeDefined()
		expect(parsedReceipt.length).toBe(2)
		expect(parsedReceipt[0]).toBeDefined()
		expect(parsedReceipt[0]?.inbound.amount).toBe(inbound)
		expect(parsedReceipt[0]?.outbound.amount).toBe(0n)
		expect(parsedReceipt[0]?.provision.amount).toBe(0n)
	})
})
