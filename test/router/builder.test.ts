import { describe, expect, it } from 'bun:test'
import { Action, isSettlementAction } from '../../src/router/actions/enum'
import type { SortedActions } from '../../src/router/actions/types'

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
})
