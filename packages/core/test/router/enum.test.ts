import { describe, expect, it } from 'bun:test'
import {
	Action,
	isFailableAction,
	isSettlementAction,
	toNonFailableAction,
} from '../../src/router/actions/enum'

describe('Enum', () => {
	const actions = Object.values(Action).filter((v) => typeof v === 'number')
	it('should correctly identify failable actions', () => {
		const failableActions = actions.filter(isFailableAction)
		const nonFailableActions = actions.filter((v) => !isFailableAction(v))

		expect(failableActions).toEqual([
			Action.FAILABLE_ORDER_SINGLE,
			Action.FAILABLE_LIMIT_SINGLE,
			Action.FAILABLE_CLAIM,
			Action.FAILABLE_CANCEL,
			Action.FAILABLE_SETTLE,
			Action.FAILABLE_TAKE,
			Action.FAILABLE_SETTLE_ALL,
			Action.FAILABLE_TAKE_ALL,
			Action.FAILABLE_WRAP_NATIVE,
			Action.FAILABLE_UNWRAP_NATIVE,
			Action.FAILABLE_AUTHORIZE,
			Action.FAILABLE_CLEAR_UPTO_OR_CLAIM,
		])

		expect(nonFailableActions).toEqual([
			Action.ORDER_SINGLE,
			Action.ORDER_MULTI,
			Action.LIMIT_SINGLE,
			Action.CLAIM,
			Action.CANCEL,
			Action.SETTLE,
			Action.TAKE,
			Action.SETTLE_ALL,
			Action.TAKE_ALL,
			Action.SWEEP,
			Action.WRAP_NATIVE,
			Action.UNWRAP_NATIVE,
			Action.AUTHORIZE,
			Action.CLEAR_ALL,
			Action.CLEAR_UPTO_OR_CLAIM,
		])
	})

	it('should correctly identify settlement actions', () => {
		const settlementActions = actions.filter(isSettlementAction)

		expect(settlementActions).toEqual([
			Action.SETTLE,
			Action.FAILABLE_SETTLE,
			Action.TAKE,
			Action.FAILABLE_TAKE,
			Action.SETTLE_ALL,
			Action.FAILABLE_SETTLE_ALL,
			Action.TAKE_ALL,
			Action.FAILABLE_TAKE_ALL,
			Action.CLEAR_ALL,
			Action.CLEAR_UPTO_OR_CLAIM,
			Action.FAILABLE_CLEAR_UPTO_OR_CLAIM,
		])
	})

	it('should correctly convert failable actions to non-failable actions', () => {
		const nonFailable = actions.map(toNonFailableAction)

		expect(nonFailable).toEqual([
			Action.ORDER_SINGLE,
			Action.ORDER_SINGLE,
			Action.ORDER_MULTI,
			Action.LIMIT_SINGLE,
			Action.LIMIT_SINGLE,
			Action.CLAIM,
			Action.CLAIM,
			Action.CANCEL,
			Action.CANCEL,
			Action.SETTLE,
			Action.SETTLE,
			Action.TAKE,
			Action.TAKE,
			Action.SETTLE_ALL,
			Action.SETTLE_ALL,
			Action.TAKE_ALL,
			Action.TAKE_ALL,
			Action.SWEEP,
			Action.WRAP_NATIVE,
			Action.WRAP_NATIVE,
			Action.UNWRAP_NATIVE,
			Action.UNWRAP_NATIVE,
			Action.AUTHORIZE,
			Action.AUTHORIZE,
			Action.CLEAR_ALL,
			Action.CLEAR_UPTO_OR_CLAIM,
			Action.CLEAR_UPTO_OR_CLAIM,
		])
	})
})
