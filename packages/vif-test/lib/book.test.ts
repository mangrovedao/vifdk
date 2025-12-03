import { describe, expect, it } from 'bun:test'
import { packedBook } from '../../core/src/builder/reader/book'
import { Book } from '../../core/src/lib/book'
import { VifRouter } from '../../core/src/router/router'
import { mint } from '../config/mint'
import { approveIfNeeded, config } from '../config/tokens'
import { authorize, createOffers, marketOrder } from '../config/vif'
import { VifRouterAbi } from '../static/VifRouterABI'
import { mainClient } from '../utils'

describe('Book', () => {
	it('should parse the book and simulate it correctly (exact in)', async () => {
		const client = mainClient()
		await authorize(client, config.Vif, config.VifRouter)
		await createOffers(
			client,
			Array.from({ length: 10 }, (_, i) => ({
				market: config.market.asks,
				gives: config.market.base.token.amount('1'),
				tick: config.market.asks.price(3500 * (1 + i / 1000)),
			})),
		)

		const [, packedBookData] = await client.readContract({
			address: config.VifReader,
			...packedBook(config.market.asks),
		})

		expect(packedBookData).toBeDefined()
		expect(packedBookData.length).toBe(10)

		const book = Book.fromPacked(config.market.asks, packedBookData)

		expect(book.elements.length).toBe(10)

		for (let i = 0; i < book.elements.length; i++) {
			const element = book.elements[i]
			if (!element) throw new Error('Element is undefined')
			expect(element.tick.value).toBe(
				config.market.asks.price(3500 * (1 + i / 1000)).value,
			)
			expect(element.totalGives.amount).toBe(
				config.market.base.token.amount('1').amount,
			)
		}

		const amount = config.market.quote.token.amount('10000')

		const simulation = book.grossSimulation(amount)
		const result = await marketOrder(client, config.market.asks, amount)

		expect(simulation.gave.amount).toBe(result.gave.amount)
		expect(simulation.got.amount).toBe(result.got.amount)
		expect(simulation.fee.amount).toBe(result.fee.amount)
	})

	it('should simulate the book correctly (exact out)', async () => {
		const client = mainClient()
		await authorize(client, config.Vif, config.VifRouter)
		await createOffers(
			client,
			Array.from({ length: 10 }, (_, i) => ({
				market: config.market.asks,
				gives: config.market.base.token.amount('1'),
				tick: config.market.asks.price(3500 * (1 + i / 1000)),
			})),
		)

		const [, packedBookData] = await client.readContract({
			address: config.VifReader,
			...packedBook(config.market.asks),
		})

		expect(packedBookData).toBeDefined()
		expect(packedBookData.length).toBe(10)

		const book = Book.fromPacked(config.market.asks, packedBookData)

		const amount = config.market.base.token.amount('3.5')
		const simulation = book.grossSimulation(amount)

		await mint(client, config.market.quote.token.amount('100000'))
		await approveIfNeeded(client, [config.market.quote.token], config.Vif)
		// biome-ignore lint/style/noNonNullAssertion: test env
		const router = new VifRouter(config.VifRouter, config.Vif, client.chain!.id)
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
		const [res] = actions.parseSimulationResult(result)

		expect(res.data.gave.amount).toBe(simulation.gave.amount)
		expect(res.data.got.amount).toBe(simulation.got.amount)
		expect(res.data.fee.amount).toBe(simulation.fee.amount)
	})
})
