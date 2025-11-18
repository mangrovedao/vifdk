import { describe, expect, it } from 'bun:test'
import { packedOfferList } from '../../src/builder/reader/offer-list'
import { OfferList } from '../../src/lib/offer-list'
import { Action } from '../../src/router/actions/enum'
import { VifRouter } from '../../src/router/router'
import { mint } from '../config/mint'
import { approveIfNeeded, config } from '../config/tokens'
import { authorize, createOffers } from '../config/vif'
import { VifRouterAbi } from '../static/VifRouterABI'
import { mainClient } from '../utils'

describe('OfferList', () => {
	it('should parse and simulate order correctly (exact in)', async () => {
		const client = mainClient()
		await authorize(client, config.Vif, config.VifRouter)
		await createOffers(
			client,
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

		await mint(client, amount)
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

	it('should simulate the book correctly (exact out)', async () => {
		const client = mainClient()
		await authorize(client, config.Vif, config.VifRouter)
		await createOffers(
			client,
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

		await mint(client, config.market.quote.token.amount('100000'))
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
