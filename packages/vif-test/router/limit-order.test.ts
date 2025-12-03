import { describe, expect, it } from 'bun:test'
import { Offer, Token } from '../../core/src'
import { rawOffer } from '../../core/src/builder/core'
import { Action } from '../../core/src/router/actions/enum'
import { VifRouter } from '../../core/src/router/router'
import { config } from '../config/tokens'
import { authorize, createOffer, marketOrder } from '../config/vif'
import { VifRouterAbi } from '../static/VifRouterABI'
import { mainClient } from '../utils'

describe('Limit order', () => {
	it('should create a limit order, and parse it correctly', async () => {
		const client = mainClient()
		await authorize(client, config.Vif, config.VifRouter)
		// create a sell order for 1 ETH
		const router = new VifRouter(config.VifRouter, config.Vif, client.chain.id)

		const market = config.market.asks // sell
		const sellAmount = config.market.base.token.amount('1') // 1 ETH
		const expiry = new Date(Date.now() + 1000 * 60 * 60 * 24)
		const actions = router
			.createTypedActions()
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

		expect(parsedSimulationResult[0]).toBeDefined()
		expect(parsedSimulationResult[0].type).toBe(Action.WRAP_NATIVE)
		expect(parsedSimulationResult[0].data).toBeUndefined()
		expect(parsedSimulationResult[0].success).toBeTrue()
		expect(parsedSimulationResult[0].error).toBeUndefined()

		expect(parsedSimulationResult[1]).toBeDefined()
		expect(parsedSimulationResult[1].type).toBe(Action.LIMIT_SINGLE)
		expect(parsedSimulationResult[1].data).toBeDefined()
		expect(parsedSimulationResult[1].data.claimedReceived.amount).toBe(0n)
		expect(parsedSimulationResult[1].data.offerId).toBe(1)
		expect(parsedSimulationResult[1].success).toBeTrue()
		expect(parsedSimulationResult[1].error).toBeUndefined()

		expect(parsedSimulationResult[2]).toBeDefined()
		expect(parsedSimulationResult[2].type).toBe(Action.SETTLE_ALL)
		expect(parsedSimulationResult[2].data).toBeUndefined()
		expect(parsedSimulationResult[2].success).toBeTrue()
		expect(parsedSimulationResult[2].error).toBeUndefined()

		expect(parsedSimulationResult[3]).toBeDefined()
		expect(parsedSimulationResult[3].type).toBe(Action.SETTLE_ALL)
		expect(parsedSimulationResult[3].data).toBeUndefined()
		expect(parsedSimulationResult[3].success).toBeTrue()
		expect(parsedSimulationResult[3].error).toBeUndefined()

		expect(parsedSimulationResult[4]).toBeDefined()
		expect(parsedSimulationResult[4].type).toBe(Action.SWEEP)
		expect(parsedSimulationResult[4].data).toBeUndefined()
		expect(parsedSimulationResult[4].success).toBeTrue()
		expect(parsedSimulationResult[4].error).toBeUndefined()

		const receipt = await client.writeContractSync(request)

		const parsedReceipt = actions.parseLogs(receipt.logs)

		expect(parsedReceipt).toBeDefined()
		expect(parsedReceipt.length).toBe(5)

		expect(parsedReceipt[0]).toBeDefined()
		expect(parsedReceipt[0].type).toBe(Action.WRAP_NATIVE)
		expect(parsedReceipt[0].data).toBeUndefined()
		expect(parsedReceipt[0].success).toBeTrue()

		expect(parsedReceipt[2]).toBeDefined()
		expect(parsedReceipt[2].type).toBe(Action.SETTLE_ALL)
		expect(parsedReceipt[2].data).toBeUndefined()
		expect(parsedReceipt[2].success).toBeTrue()

		expect(parsedReceipt[3]).toBeDefined()
		expect(parsedReceipt[3].type).toBe(Action.SETTLE_ALL)
		expect(parsedReceipt[3].data).toBeUndefined()
		expect(parsedReceipt[3].success).toBeTrue()

		expect(parsedReceipt[4]).toBeDefined()
		expect(parsedReceipt[4].type).toBe(Action.SWEEP)
		expect(parsedReceipt[4].data).toBeUndefined()
		expect(parsedReceipt[4].success).toBeTrue()

		expect(parsedReceipt[1]).toBeDefined()
		expect(parsedReceipt[1].type).toBe(Action.LIMIT_SINGLE)
		expect(parsedReceipt[1].data).toBeDefined()
		expect(parsedReceipt[1].success).toBeTrue()
		// biome-ignore lint/style/noNonNullAssertion: result is defined
		expect(parsedReceipt[1].data!.offerId).toBe(1)
		// biome-ignore lint/style/noNonNullAssertion: result is defined
		expect(parsedReceipt[1].data!.claimedReceived.amount).toBe(0n)

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
			.createTypedActions()
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
		expect(parsedSimulationResult[0].type).toBe(Action.CANCEL)
		expect(parsedSimulationResult[0].success).toBeTrue()
		expect(parsedSimulationResult[0].data.inbound.amount).toBe(
			offer.data.received.amount,
		)
		expect(parsedSimulationResult[0].data.outbound.amount).toBe(
			offer.data.gives.amount,
		)
		expect(parsedSimulationResult[0].data.provision.amount).toBe(
			offer.data.provision.amount,
		)
		expect(parsedSimulationResult[0].error).toBeUndefined()

		expect(parsedSimulationResult[1]).toBeDefined()
		expect(parsedSimulationResult[1].success).toBeTrue()
		expect(parsedSimulationResult[1].type).toBe(Action.TAKE_ALL)
		expect(parsedSimulationResult[1].data).toBeUndefined()
		expect(parsedSimulationResult[1].error).toBeUndefined()

		expect(parsedSimulationResult[2]).toBeDefined()
		expect(parsedSimulationResult[2].success).toBeTrue()
		expect(parsedSimulationResult[2].type).toBe(Action.TAKE_ALL)
		expect(parsedSimulationResult[2].data).toBeUndefined()
		expect(parsedSimulationResult[2].error).toBeUndefined()

		expect(parsedSimulationResult[3]).toBeDefined()
		expect(parsedSimulationResult[3].success).toBeTrue()
		expect(parsedSimulationResult[3].type).toBe(Action.TAKE_ALL)
		expect(parsedSimulationResult[3].data).toBeUndefined()
		expect(parsedSimulationResult[3].error).toBeUndefined()

		const receipt = await client.writeContractSync(request)
		const parsedReceipt = actions.parseLogs(receipt.logs)

		expect(parsedReceipt).toBeDefined()
		expect(parsedReceipt.length).toBe(4)
		expect(parsedReceipt[0]).toBeDefined()
		expect(parsedReceipt[0].type).toBe(Action.CANCEL)
		expect(parsedReceipt[0].success).toBeTrue()
		// biome-ignore lint/style/noNonNullAssertion: result is defined
		expect(parsedReceipt[0].data!.inbound.amount).toBe(
			offer.data.received.amount,
		)
		// biome-ignore lint/style/noNonNullAssertion: result is defined
		expect(parsedReceipt[0].data!.outbound.amount).toBe(offer.data.gives.amount)
		// biome-ignore lint/style/noNonNullAssertion: result is defined
		expect(parsedReceipt[0].data!.provision.amount).toBe(
			offer.data.provision.amount,
		)
		expect(parsedReceipt[1]).toBeDefined()
		expect(parsedReceipt[1].type).toBe(Action.TAKE_ALL)
		expect(parsedReceipt[1].data).toBeUndefined()
		expect(parsedReceipt[1].success).toBeTrue()
		expect(parsedReceipt[2]).toBeDefined()
		expect(parsedReceipt[2].type).toBe(Action.TAKE_ALL)
		expect(parsedReceipt[2].data).toBeUndefined()
		expect(parsedReceipt[2].success).toBeTrue()
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
			.createTypedActions()
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
		expect(parsedSimulationResult[0].type).toBe(Action.CANCEL)
		expect(parsedSimulationResult[0].data.inbound.amount).toBe(inbound)
		expect(parsedSimulationResult[0].data.outbound.amount).toBe(outbound)
		expect(parsedSimulationResult[0].data.provision.amount).toBe(provision)
		expect(parsedSimulationResult[0].success).toBeTrue()
		expect(parsedSimulationResult[0].error).toBeUndefined()

		expect(parsedSimulationResult[1]).toBeDefined()
		expect(parsedSimulationResult[1].type).toBe(Action.TAKE_ALL)
		expect(parsedSimulationResult[1].data).toBeUndefined()
		expect(parsedSimulationResult[1].success).toBeTrue()
		expect(parsedSimulationResult[1].error).toBeUndefined()

		expect(parsedSimulationResult[2]).toBeDefined()
		expect(parsedSimulationResult[2].type).toBe(Action.TAKE_ALL)
		expect(parsedSimulationResult[2].data).toBeUndefined()
		expect(parsedSimulationResult[2].success).toBeTrue()
		expect(parsedSimulationResult[2].error).toBeUndefined()

		expect(parsedSimulationResult[3]).toBeDefined()
		expect(parsedSimulationResult[3].type).toBe(Action.TAKE_ALL)
		expect(parsedSimulationResult[3].data).toBeUndefined()
		expect(parsedSimulationResult[3].success).toBeTrue()
		expect(parsedSimulationResult[3].error).toBeUndefined()

		const receipt = await client.writeContractSync(request)
		const parsedReceipt = actions.parseLogs(receipt.logs)

		expect(parsedReceipt).toBeDefined()
		expect(parsedReceipt.length).toBe(4)
		expect(parsedReceipt[0]).toBeDefined()
		expect(parsedReceipt[0].type).toBe(Action.CANCEL)
		expect(parsedReceipt[0].success).toBeTrue()
		// biome-ignore lint/style/noNonNullAssertion: result is defined
		expect(parsedReceipt[0]!.data!.inbound.amount).toBe(inbound)
		// biome-ignore lint/style/noNonNullAssertion: result is defined
		expect(parsedReceipt[0]!.data!.outbound.amount).toBe(outbound)
		// biome-ignore lint/style/noNonNullAssertion: result is defined
		expect(parsedReceipt[0]!.data!.provision.amount).toBe(provision)

		expect(parsedReceipt[1]).toBeDefined()
		expect(parsedReceipt[1].type).toBe(Action.TAKE_ALL)
		expect(parsedReceipt[1].data).toBeUndefined()
		expect(parsedReceipt[1].success).toBeTrue()
		expect(parsedReceipt[2]).toBeDefined()
		expect(parsedReceipt[2].type).toBe(Action.TAKE_ALL)
		expect(parsedReceipt[2].data).toBeUndefined()
		expect(parsedReceipt[2].success).toBeTrue()
		expect(parsedReceipt[3]).toBeDefined()
		expect(parsedReceipt[3].type).toBe(Action.TAKE_ALL)
		expect(parsedReceipt[3].data).toBeUndefined()
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
			.createTypedActions()
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
		expect(parsedSimulationResult[0].type).toBe(Action.CLAIM)
		expect(parsedSimulationResult[0].data.inbound.amount).toBe(inbound)
		expect(parsedSimulationResult[0].data.outbound.amount).toBe(0n)
		expect(parsedSimulationResult[0].data.provision.amount).toBe(0n)
		expect(parsedSimulationResult[0].success).toBeTrue()
		expect(parsedSimulationResult[0].error).toBeUndefined()
		expect(parsedSimulationResult[1]).toBeDefined()
		expect(parsedSimulationResult[1].type).toBe(Action.TAKE_ALL)
		expect(parsedSimulationResult[1].data).toBeUndefined()
		expect(parsedSimulationResult[1].success).toBeTrue()
		expect(parsedSimulationResult[1].error).toBeUndefined()

		const receipt = await client.writeContractSync(request)
		const parsedReceipt = actions.parseLogs(receipt.logs)

		expect(parsedReceipt).toBeDefined()
		expect(parsedReceipt.length).toBe(2)
		expect(parsedReceipt[0]).toBeDefined()
		expect(parsedReceipt[0].type).toBe(Action.CLAIM)
		expect(parsedReceipt[0].success).toBeTrue()
		// biome-ignore lint/style/noNonNullAssertion: result is defined
		expect(parsedReceipt[0]!.data!.inbound.amount).toBe(inbound)
		// biome-ignore lint/style/noNonNullAssertion: result is defined
		expect(parsedReceipt[0]!.data!.outbound.amount).toBe(0n)
		// biome-ignore lint/style/noNonNullAssertion: result is defined
		expect(parsedReceipt[0]!.data!.provision.amount).toBe(0n)
		expect(parsedReceipt[1]).toBeDefined()
		expect(parsedReceipt[1].type).toBe(Action.TAKE_ALL)
		expect(parsedReceipt[1].data).toBeUndefined()
		expect(parsedReceipt[1].success).toBeTrue()
	})
})
