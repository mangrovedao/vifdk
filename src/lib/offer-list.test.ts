import { mint } from '~test/config/mint'
import { approveIfNeeded } from '~test/config/tokens'
import { authorize, createOffers } from '~test/config/vif'
import { describe, expect, test } from '~test/fixture'
import { VifRouterAbi } from '~test/static/VifRouterABI'
import { OfferList, packedOfferList } from '../index'
import { Action } from '../router/export'
import { VifRouter } from '../router/router'

describe('OfferList', () => {
	test('should parse and simulate order correctly (exact in)', async ({
		client,
		config,
		vifConfig,
	}) => {
		await authorize(client, config.Vif, config.VifRouter)
		await createOffers(
			client,
			vifConfig,
			Array.from({ length: 10 }, (_, i) => ({
				market: config.market.asks,
				gives: config.market.base.token.amount('1'),
				tick: config.market.asks.price(3500 * (1 + Math.floor(i / 2) / 1000)),
			})),
		)

		const [, offerIds, offersPacked, owners] = await client.readContract({
			address: config.VifReader,
			...packedOfferList(config.market.asks, 0, 200),
		})

		const offerList = OfferList.fromPacked(
			config.market.asks,
			offerIds,
			offersPacked,
			owners,
		)

		const amount = config.market.quote.token.amount('10000')
		const simulation = offerList.simulateOrder({
			amount,
		})

		const router = new VifRouter(config.VifRouter, config.Vif, client.chain.id)

		await mint(client, amount, config.WETH.address)
		await approveIfNeeded(client, [amount.token], config.Vif)

		const actions = router
			.createTypedActions()
			.orderSingle({
				market: config.market.asks,
				fillVolume: amount,
			})
			.settleAll(config.market.quote.token)
			.takeAll({
				receiver: client.account.address,
				token: config.market.base.token,
			})
			.build()
		const { commands, args } = actions.txData()
		const { result } = await client.simulateContract({
			address: config.VifRouter,
			abi: VifRouterAbi,
			functionName: 'execute',
			args: [commands, args],
		})
		const [orderResult, settleResult, takeResult] =
			actions.parseSimulationResult(result)

		expect(orderResult).toBeDefined()
		expect(settleResult).toBeDefined()
		expect(takeResult).toBeDefined()

		expect(orderResult.type).toBe(Action.ORDER_SINGLE)
		expect(orderResult.data).toBeDefined()
		expect(orderResult.data.gave.amount).toBe(simulation.gave.amount)
		expect(orderResult.data.got.amount).toBe(simulation.got.amount)
		expect(orderResult.data.fee.amount).toBe(simulation.fee.amount)
		expect(orderResult.data.bounty.amount).toBe(simulation.bounty.amount)

		expect(settleResult.type).toBe(Action.SETTLE_ALL)
		expect(settleResult.data).toBeUndefined()

		expect(takeResult.type).toBe(Action.TAKE_ALL)
		expect(takeResult.data).toBeUndefined()
	})

	test('should simulate the book correctly (exact out)', async ({
		client,
		config,
		vifConfig,
	}) => {
		await authorize(client, config.Vif, config.VifRouter)
		await createOffers(
			client,
			vifConfig,
			Array.from({ length: 10 }, (_, i) => ({
				market: config.market.asks,
				gives: config.market.base.token.amount('1'),
				tick: config.market.asks.price(3500 * (1 + Math.floor(i / 2) / 1000)),
			})),
		)

		const [, offerIds, offersPacked, owners] = await client.readContract({
			address: config.VifReader,
			...packedOfferList(config.market.asks, 0, 200),
		})

		const offerList = OfferList.fromPacked(
			config.market.asks,
			offerIds,
			offersPacked,
			owners,
		)

		const amount = config.market.base.token.amount('3.5')
		const simulation = offerList.simulateOrder({
			amount,
		})

		const router = new VifRouter(config.VifRouter, config.Vif, client.chain.id)

		await mint(
			client,
			config.market.quote.token.amount('100000'),
			config.WETH.address,
		)
		await approveIfNeeded(client, [config.market.quote.token], config.Vif)

		const actions = router
			.createTypedActions()
			.orderSingle({
				market: config.market.asks,
				fillVolume: amount,
			})
			.settleAll(config.market.quote.token)
			.takeAll({
				receiver: client.account.address,
				token: config.market.base.token,
			})
			.build()
		const { commands, args } = actions.txData()
		const { result } = await client.simulateContract({
			address: config.VifRouter,
			abi: VifRouterAbi,
			functionName: 'execute',
			args: [commands, args],
		})
		const [orderResult, settleResult, takeResult] =
			actions.parseSimulationResult(result)

		expect(orderResult).toBeDefined()
		expect(settleResult).toBeDefined()
		expect(takeResult).toBeDefined()

		expect(orderResult.type).toBe(Action.ORDER_SINGLE)
		expect(orderResult.data).toBeDefined()
		expect(orderResult.data.gave.amount).toBe(simulation.gave.amount)
		expect(orderResult.data.got.amount).toBe(simulation.got.amount)
		expect(orderResult.data.fee.amount).toBe(simulation.fee.amount)
		expect(orderResult.data.bounty.amount).toBe(simulation.bounty.amount)

		expect(settleResult.type).toBe(Action.SETTLE_ALL)
		expect(settleResult.data).toBeUndefined()

		expect(takeResult.type).toBe(Action.TAKE_ALL)
		expect(takeResult.data).toBeUndefined()
	})
})
