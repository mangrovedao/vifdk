import { decodeAbiParameters, type Hex } from 'viem'
import { Token } from '../../../lib/export'
import { ACTION_LABELS, Action, isFailableAction } from '../enum'
import { FailedActionError } from '../errors'
import type {
	ActionElement,
	ActionOrFailable,
	ActionResult,
	ActionsResult,
	DispatchResult,
	RawActionResult,
} from '../types'

/**
 * Parses a single order simulation result
 * @param element - Action element
 * @param result - Result hex data
 * @returns Parsed result
 */
export function parseSingleActionSimulationResultOrderSingle(
	element: ActionElement<ActionOrFailable<Action.ORDER_SINGLE>>,
	result: Hex,
): RawActionResult<ActionOrFailable<Action.ORDER_SINGLE>> {
	const market = element.metadata
	const res = decodeAbiParameters(
		[
			{
				type: 'tuple',
				name: 'result',
				components: [
					{ type: 'uint256', name: 'gave' },
					{ type: 'uint256', name: 'got' },
					{ type: 'uint256', name: 'fee' },
					{ type: 'uint256', name: 'bounty' },
				],
			},
		],
		result,
	)[0]
	return {
		type: element.action,
		data: {
			gave: market.inboundToken.token.amount(res.gave),
			got: market.outboundToken.token.amount(res.got),
			fee: market.inboundToken.token.withUnit(1n).amount(res.fee),
			bounty: Token.NATIVE_TOKEN.amount(res.bounty),
		},
	}
}

/**
 * Parses a multi order simulation result
 * @param element - Action element
 * @param result - Result hex data
 * @returns Parsed result
 */
export function parseSingleActionSimulationResultOrderMulti(
	element: ActionElement<ActionOrFailable<Action.ORDER_MULTI>>,
	result: Hex,
): RawActionResult<ActionOrFailable<Action.ORDER_MULTI>> {
	const markets = element.metadata
	const res = decodeAbiParameters(
		[
			{
				type: 'tuple',
				name: 'result',
				components: [{ type: 'uint256', name: 'amount' }],
			},
		],
		result,
	)[0]
	const sendToken = markets.markets.at(0)?.inboundToken
	const receiveToken = markets.markets.at(-1)?.outboundToken
	if (!sendToken || !receiveToken) {
		throw new Error('Invalid markets')
	}
	const amount = markets.fillWants
		? sendToken.token.amount(res.amount)
		: receiveToken.token.amount(res.amount)
	return {
		type: element.action,
		data: {
			amount,
		},
	}
}

/**
 * Parses a claim/cancel simulation result
 * @param element - Action element
 * @param result - Result hex data
 * @returns Parsed result
 */
export function parseSingleActionSimulationResultClaimCancel(
	element: ActionElement<ActionOrFailable<Action.CLAIM | Action.CANCEL>>,
	result: Hex,
): RawActionResult<ActionOrFailable<Action.CLAIM | Action.CANCEL>> {
	const { market } = element.metadata
	const res = decodeAbiParameters(
		[
			{
				type: 'tuple',
				name: 'result',
				components: [
					{ type: 'uint256', name: 'inbound' },
					{ type: 'uint256', name: 'outbound' },
					{ type: 'uint256', name: 'provision' },
				],
			},
		],
		result,
	)[0]
	return {
		type: element.action,
		data: {
			inbound: market.inboundToken.token.amount(res.inbound),
			outbound: market.outboundToken.token.amount(res.outbound),
			provision: Token.NATIVE_TOKEN.amount(res.provision),
		},
	}
}

/**
 * Parses a limit single simulation result
 * @param element - Action element
 * @param result - Result hex data
 * @returns Parsed result
 */
export function parseSingleActionSimulationResultLimitSingle(
	element: ActionElement<ActionOrFailable<Action.LIMIT_SINGLE>>,
	result: Hex,
): RawActionResult<ActionOrFailable<Action.LIMIT_SINGLE>> {
	const { market } = element.metadata
	const res = decodeAbiParameters(
		[
			{
				type: 'tuple',
				name: 'result',
				components: [
					{ type: 'uint40', name: 'offerId' },
					{ type: 'uint256', name: 'claimedReceived' },
				],
			},
		],
		result,
	)[0]
	return {
		type: element.action,
		data: {
			offerId: res.offerId,
			claimedReceived: market.inboundToken.token.amount(res.claimedReceived),
		},
	}
}

/**
 * Parses a successful single action simulation result
 * @param element - Action element
 * @param result - Result hex data
 * @returns Parsed result
 */
export function parseSingleActionSimulationResultSuccess<
	TAction extends Action,
>(element: ActionElement<TAction>, result: Hex): RawActionResult<TAction> {
	switch (element.action) {
		case Action.ORDER_SINGLE:
		case Action.FAILABLE_ORDER_SINGLE:
			return parseSingleActionSimulationResultOrderSingle(
				element as ActionElement<ActionOrFailable<Action.ORDER_SINGLE>>,
				result,
			) as RawActionResult<TAction>
		case Action.ORDER_MULTI:
			return parseSingleActionSimulationResultOrderMulti(
				element as ActionElement<ActionOrFailable<Action.ORDER_MULTI>>,
				result,
			) as RawActionResult<TAction>
		case Action.CLAIM:
		case Action.FAILABLE_CLAIM:
		case Action.CANCEL:
		case Action.FAILABLE_CANCEL:
			return parseSingleActionSimulationResultClaimCancel(
				element as ActionElement<
					ActionOrFailable<
						| Action.CLAIM
						| Action.FAILABLE_CLAIM
						| Action.CANCEL
						| Action.FAILABLE_CANCEL
					>
				>,
				result,
			) as RawActionResult<TAction>
		case Action.LIMIT_SINGLE:
		case Action.FAILABLE_LIMIT_SINGLE:
			return parseSingleActionSimulationResultLimitSingle(
				element as ActionElement<
					ActionOrFailable<Action.LIMIT_SINGLE | Action.FAILABLE_LIMIT_SINGLE>
				>,
				result,
			) as RawActionResult<TAction>
		default:
			return {
				type: element.action,
				data: undefined,
			} as RawActionResult<TAction>
	}
}

/**
 * Parses a single action simulation result
 * @param element - Action element
 * @param result - Dispatch result
 * @returns Parsed action result
 */
export function parseSingleActionSimulationResult<TAction extends Action>(
	element: ActionElement<TAction>,
	result: DispatchResult,
): ActionResult<TAction> {
	const isFailable = isFailableAction(element.action)
	if (!isFailable && !result.success) throw new Error('Action should not fail')
	if (!result.success) {
		return {
			success: false,
			error: new FailedActionError(
				result.returnData,
				ACTION_LABELS[element.action],
			),
		} as ActionResult<TAction>
	}
	const res = parseSingleActionSimulationResultSuccess(
		element,
		result.returnData,
	)
	if (isFailable) {
		return {
			success: true,
			result: res,
		} as ActionResult<TAction>
	}
	return res as ActionResult<TAction>
}

/**
 * Parses the simulation results from a router dispatch call
 * @param returnData - Array of dispatch results returned from simulation
 * @param actions - Array of action elements
 * @returns Parsed action results array matching the actions array
 * @throws Error if an action is not found
 */
export function parseSimulationResult<
	TActions extends readonly Action[] = readonly Action[],
>(
	returnData: readonly DispatchResult[] | DispatchResult[],
	actions: ActionElement[],
): ActionsResult<TActions> {
	return returnData.map((result, index) => {
		const action = actions[index]
		if (!action) throw new Error('Action not found')
		return parseSingleActionSimulationResult(action, result)
	}) as ActionsResult<TActions>
}
