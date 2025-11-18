import { describe, expect, it } from 'bun:test'
import { Action } from '../../src/router/actions/enum'
import { VifRouter } from '../../src/router/router'
import { mint } from '../config/mint'
import { approveIfNeeded, config } from '../config/tokens'
import { authorize, createOffers } from '../config/vif'
import { VifRouterAbi } from '../static/VifRouterABI'
import { expectCloseTo, mainClient } from '../utils'

describe('Market order', () => {
	it('should create a market order', async () => {
		const client = mainClient()
		await authorize(client, config.Vif, config.VifRouter)
		await createOffers(
			client,
			Array.from({ length: 10 }, (_, i) => ({
				market: config.market.asks,
				gives: config.market.base.token.amount('1'),
				tick: config.market.asks.price(3500 * (1 + i / 1000)),
				expiry: new Date(Date.now() + 1000 * 60 * 60 * 24),
			})),
		)

		const amount = config.market.quote.token.amount('30000')

		await approveIfNeeded(client, [config.market.quote.token], config.Vif)
		await mint(client, amount)

		const router = new VifRouter(config.VifRouter, config.Vif, client.chain.id)

		const actions = router
			.createTypedActions()
			.orderSingle({
				market: config.market.asks,
				fillVolume: amount,
				maxTick: config.market.asks.price(5000),
			})
			.settleAll(config.market.quote.token)
			.takeAll({
				receiver: client.account.address,
				token: config.market.base.token,
			})
			.build()

		const { commands, args } = actions.txData()

		const { result, request } = await client.simulateContract({
			address: config.VifRouter,
			abi: VifRouterAbi,
			functionName: 'execute',
			args: [commands, args],
		})

		const excludingFees = config.market.asks.excludingFees(amount)
		const fees = config.market.asks.computeFees(excludingFees)

		const parsedSimulationResult = actions.parseSimulationResult(result)
		expect(parsedSimulationResult).toBeDefined()
		expect(parsedSimulationResult.length).toBe(3)
		expect(parsedSimulationResult[0]).toBeDefined()
		expect(parsedSimulationResult[0].type).toBe(Action.ORDER_SINGLE)
		expect(parsedSimulationResult[0].data).toBeDefined()
		expectCloseTo(
			parsedSimulationResult[0].data.gave.amount,
			excludingFees.amount,
		)
		expect(parsedSimulationResult[0].data.got.amount).toBeGreaterThan(0n)
		expectCloseTo(parsedSimulationResult[0].data.fee.amount, fees.amount)
		expect(parsedSimulationResult[0].data.bounty.amount).toBe(0n)

		expect(parsedSimulationResult[1]).toBeDefined()
		expect(parsedSimulationResult[1].type).toBe(Action.SETTLE_ALL)
		expect(parsedSimulationResult[1].data).toBeUndefined()

		expect(parsedSimulationResult[2]).toBeDefined()
		expect(parsedSimulationResult[2].type).toBe(Action.TAKE_ALL)
		expect(parsedSimulationResult[2].data).toBeUndefined()

		const receipt = await client.writeContractSync(request)
		const results = actions.parseLogs(receipt.logs)

		expect(results).toBeDefined()
		expect(results.length).toBe(3)
		expect(results[0]).toBeDefined()
		expect(results[0].type).toBe(Action.ORDER_SINGLE)
		expect(results[0].data).toBeDefined()
		// biome-ignore lint/style/noNonNullAssertion: result is defined
		expectCloseTo(results[0]!.data!.gave.amount, excludingFees.amount)
		// biome-ignore lint/style/noNonNullAssertion: result is defined
		expect(results[0]!.data!.got.amount).toBeGreaterThan(0n)
		// biome-ignore lint/style/noNonNullAssertion: result is defined
		expectCloseTo(results[0]!.data!.fee.amount, fees.amount)
		// biome-ignore lint/style/noNonNullAssertion: result is defined
		expect(results[0]!.data!.bounty.amount).toBe(0n)
		expect(results[1]).toBeDefined()
		expect(results[1].type).toBe(Action.SETTLE_ALL)
		expect(results[1].data).toBeUndefined()
		expect(results[2]).toBeDefined()
		expect(results[2].type).toBe(Action.TAKE_ALL)
		expect(results[2].data).toBeUndefined()
	})
})
