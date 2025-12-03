import { describe, expect, it } from 'bun:test'
import { zeroAddress } from 'viem'
import { Action, Token, VifRouter } from '../../core/src'
import {
	isSettleAllElement,
	isTakeAllElement,
} from '../../core/src/router/actions/action-element'
import { isSettlementAction } from '../../core/src/router/actions/enum'
import type { SortedActions } from '../../core/src/router/actions/types'
import { config } from '../config/tokens'
import { mainClient } from '../utils'

describe('Builder', () => {
	it('should reorder settlements correctly (with correct types)', () => {
		const actions = [
			Action.SETTLE_ALL,
			Action.LIMIT_SINGLE,
			Action.ORDER_SINGLE,
			Action.TAKE_ALL,
			Action.SWEEP,
		] as const

		type SortedArray = SortedActions<typeof actions>

		const sorted = ([...actions] as Action[]).sort((a, b) => {
			return (
				Number(isSettlementAction(a) || a === Action.SWEEP) -
				Number(isSettlementAction(b) || b === Action.SWEEP)
			)
		}) as SortedArray

		expect(sorted[0]).toBe(Action.LIMIT_SINGLE)
		expect(sorted[1]).toBe(Action.ORDER_SINGLE)
		expect(sorted[2]).toBe(Action.SETTLE_ALL)
		expect(sorted[3]).toBe(Action.TAKE_ALL)
		expect(sorted[4]).toBe(Action.SWEEP)
	})

	it('should add the correct recommended actions and correct approval recommendations', () => {
		const client = mainClient()
		const router = new VifRouter(config.VifRouter, config.Vif, client.chain.id)
		const actions = router
			.createTypedActions()
			.orderSingle({
				market: config.market.asks,
				fillVolume: config.market.quote.token.amount('10000'),
			})
			.orderSingle({
				market: config.market.asks,
				fillVolume: config.market.quote.token.amount('10000'),
			})
			.limitSingle({
				market: config.market.asks,
				gives: config.market.base.token.amount('1'),
				tick: config.market.asks.price(3500),
				expiry: new Date(Date.now() + 1000 * 60 * 60 * 24),
			})
			.limitSingle({
				market: config.market.bids,
				gives: config.market.quote.token.amount('1000'),
				tick: config.market.asks.price(3500),
				provision: Token.PROVISION_TOKEN.amount('0.01'),
			})
			.build({ addRecommendedActions: true, receiver: client.account.address })

		expect(actions.list.length).toBe(4 + 6)
		expect(
			actions.list.findIndex(
				(action) =>
					isSettleAllElement(action) &&
					action.metadata.address === config.market.base.token.address,
			),
		).not.toBe(-1)
		expect(
			actions.list.findIndex(
				(action) =>
					isSettleAllElement(action) &&
					action.metadata.address === config.market.quote.token.address,
			),
		).not.toBe(-1)
		expect(
			actions.list.findIndex(
				(action) =>
					isTakeAllElement(action) &&
					action.metadata.address === config.market.base.token.address,
			),
		).not.toBe(-1)
		expect(
			actions.list.findIndex(
				(action) =>
					isTakeAllElement(action) && action.metadata.address === zeroAddress,
			),
		).not.toBe(-1)
		expect(
			actions.list.findIndex(
				(action) =>
					isSettleAllElement(action) && action.metadata.address === zeroAddress,
			),
		).not.toBe(-1)
		expect(
			actions.list.findIndex((action) => action.action === Action.SWEEP),
		).not.toBe(-1)

		const approvals = actions.expectedAllowances()

		expect(approvals.length).toBe(2)
		expect(
			approvals.find(
				(approval) =>
					approval.token.address === config.market.base.token.address,
			)?.amountString,
		).toBe('1')
		expect(
			approvals.find(
				(approval) =>
					approval.token.address === config.market.quote.token.address,
			)?.amountString,
		).toBe('21000')

		const value = actions.expectedValue({ globalProvision: config.provision })
		const expectedValue = Token.NATIVE_TOKEN.amount('0.01')
		expectedValue.amount += config.provision.amount
		expect(value.amount).toBe(expectedValue.amount)
	})
})
