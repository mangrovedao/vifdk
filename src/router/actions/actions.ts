/**
 * ABI imports for encoding/decoding parameters and events
 */
import {
	decodeAbiParameters,
	encodePacked,
	type Hex,
	type Log,
	parseEventLogs,
} from 'viem'
/**
 * Token types and utilities
 */
import { Token } from '../../lib/token'
/**
 * Router type
 */
import type { VifRouter } from '../router'
/**
 * Action enums and utilities
 */
import { ACTION_LABELS, Action, isFailableAction } from './enum'
/**
 * Error types
 */
import { FailedActionError } from './errors'
/**
 * Event ABI definitions
 */
import { VifEventsABI } from './events'
/**
 * Action types and parameters
 */
/**
 * Action result types
 */
import type {
	ActionElement,
	ActionOrFailable,
	ActionResult,
	ActionResultFromReceipt,
	ActionsResult,
	ActionsResultFromReceipt,
	DispatchResult,
	MultiOrderResultFromReceipt,
	RawActionResult,
} from './types'

/**
 * Class for managing and executing router actions
 * @template TActions - Array of action types being managed
 */
export class VifRouterActions<
	TActions extends readonly Action[] = readonly [],
> {
	/**
	 * Creates a new VifRouterActions instance
	 * @param router - The VifRouter instance to use for execution
	 */
	constructor(
		public readonly router: VifRouter,
		private readonly actions: ActionElement[],
	) {}

	/**
	 * Gets the transaction data for all actions
	 * @returns Object containing commands and arguments
	 */
	txData(): { commands: Hex; args: Hex[] } {
		return {
			commands: encodePacked(
				Array(this.actions.length).fill('uint8') as 'uint8'[],
				this.actions.map((action) => action.action),
			),
			args: this.actions.map((action) => action.args),
		}
	}

	/**
	 * Parses a single order simulation result
	 * @param element - Action element
	 * @param result - Result hex data
	 * @returns Parsed result
	 */
	private static _parseSingleActionSimulationResultOrderSingle(
		element: ActionElement<ActionOrFailable<Action.ORDER_SINGLE>>,
		result: Hex,
	): RawActionResult<Action.ORDER_SINGLE> {
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
			gave: market.inboundToken.amount(res.gave),
			got: market.outboundToken.amount(res.got),
			fee: market.inboundToken.withUnit(1n).amount(res.fee),
			bounty: Token.NATIVE_TOKEN.amount(res.bounty),
		}
	}

	/**
	 * Parses a multi order simulation result
	 * @param element - Action element
	 * @param result - Result hex data
	 * @returns Parsed result
	 */
	private static _parseSingleActionSimulationResultOrderMulti(
		element: ActionElement<ActionOrFailable<Action.ORDER_MULTI>>,
		result: Hex,
	): RawActionResult<Action.ORDER_MULTI> {
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
			? sendToken.amount(res.amount)
			: receiveToken.amount(res.amount)
		return {
			amount,
		}
	}

	/**
	 * Parses a claim/cancel simulation result
	 * @param element - Action element
	 * @param result - Result hex data
	 * @returns Parsed result
	 */
	private static _parseSingleActionSimulationResultClaimCancel(
		element: ActionElement<ActionOrFailable<Action.CLAIM | Action.CANCEL>>,
		result: Hex,
	): RawActionResult<Action.CLAIM | Action.CANCEL> {
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
			inbound: market.inboundToken.amount(res.inbound),
			outbound: market.outboundToken.amount(res.outbound),
			provision: Token.NATIVE_TOKEN.amount(res.provision),
		}
	}

	/**
	 * Parses a limit single simulation result
	 * @param element - Action element
	 * @param result - Result hex data
	 * @returns Parsed result
	 */
	private static _parseSingleActionSimulationResultLimitSingle(
		element: ActionElement<ActionOrFailable<Action.LIMIT_SINGLE>>,
		result: Hex,
	): RawActionResult<Action.LIMIT_SINGLE> {
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
			offerId: res.offerId,
			claimedReceived: market.inboundToken.amount(res.claimedReceived),
		}
	}

	/**
	 * Parses a successful single action simulation result
	 * @param element - Action element
	 * @param result - Result hex data
	 * @returns Parsed result
	 */
	private static _parseSingleActionSimulationResultSuccess<
		TAction extends Action,
	>(element: ActionElement<TAction>, result: Hex): RawActionResult<TAction> {
		switch (element.action) {
			case Action.ORDER_SINGLE:
			case Action.FAILABLE_ORDER_SINGLE:
				return VifRouterActions._parseSingleActionSimulationResultOrderSingle(
					element as ActionElement<ActionOrFailable<Action.ORDER_SINGLE>>,
					result,
				) as RawActionResult<TAction>
			case Action.ORDER_MULTI:
				return VifRouterActions._parseSingleActionSimulationResultOrderMulti(
					element as ActionElement<ActionOrFailable<Action.ORDER_MULTI>>,
					result,
				) as RawActionResult<TAction>
			case Action.CLAIM:
			case Action.FAILABLE_CLAIM:
			case Action.CANCEL:
			case Action.FAILABLE_CANCEL:
				return VifRouterActions._parseSingleActionSimulationResultClaimCancel(
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
				return VifRouterActions._parseSingleActionSimulationResultLimitSingle(
					element as ActionElement<
						ActionOrFailable<Action.LIMIT_SINGLE | Action.FAILABLE_LIMIT_SINGLE>
					>,
					result,
				) as RawActionResult<TAction>
			default:
				return undefined as RawActionResult<TAction>
		}
	}

	/**
	 * Parses a single action simulation result
	 * @param element - Action element
	 * @param result - Dispatch result
	 * @returns Parsed action result
	 */
	private static _parseSingleActionSimulationResult<TAction extends Action>(
		element: ActionElement<TAction>,
		result: DispatchResult,
	): ActionResult<TAction> {
		const isFailable = isFailableAction(element.action)
		if (!isFailable && !result.success)
			throw new Error('Action should not fail')
		if (!result.success) {
			return {
				success: false,
				error: new FailedActionError(
					result.returnData,
					ACTION_LABELS[element.action],
				),
			} as ActionResult<TAction>
		}
		const res = VifRouterActions._parseSingleActionSimulationResultSuccess(
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
	 * Checks if an element is a cancel or claim action
	 * @param element - Action element to check
	 * @returns True if cancel/claim action
	 */
	private static _isCancelOrClaimElement(
		element: ActionElement,
	): element is ActionElement<ActionOrFailable<Action.CANCEL | Action.CLAIM>> {
		return (
			element.action === Action.CANCEL ||
			element.action === Action.FAILABLE_CANCEL ||
			element.action === Action.CLAIM ||
			element.action === Action.FAILABLE_CLAIM
		)
	}

	/**
	 * Checks if an element is a limit order action
	 * @param element - Action element to check
	 * @returns True if limit order action
	 */
	private static _isLimitOrderElement(
		element: ActionElement,
	): element is ActionElement<ActionOrFailable<Action.LIMIT_SINGLE>> {
		return (
			element.action === Action.LIMIT_SINGLE ||
			element.action === Action.FAILABLE_LIMIT_SINGLE
		)
	}

	/**
	 * Checks if an element is a single order action
	 * @param element - Action element to check
	 * @returns True if single order action
	 */
	private static _isSingleOrderElement(
		element: ActionElement,
	): element is ActionElement<ActionOrFailable<Action.ORDER_SINGLE>> {
		return (
			element.action === Action.ORDER_SINGLE ||
			element.action === Action.FAILABLE_ORDER_SINGLE
		)
	}

	/**
	 * Checks if an element is a multi order action
	 * @param element - Action element to check
	 * @returns True if multi order action
	 */
	private static _isMultiOrderElement(
		element: ActionElement,
	): element is ActionElement<ActionOrFailable<Action.ORDER_MULTI>> {
		return element.action === Action.ORDER_MULTI
	}

	/**
	 * Creates a multi order result
	 * @param action - Action element
	 * @returns Multi order result
	 */
	private static _createMultiOrderResult(
		action: ActionElement<ActionOrFailable<Action.ORDER_MULTI>>,
	): MultiOrderResultFromReceipt {
		const startToken = action.metadata.markets.at(0)?.inboundToken
		const endToken = action.metadata.markets.at(-1)?.outboundToken
		if (!startToken || !endToken) {
			throw new Error('Invalid markets')
		}
		return {
			gave: startToken.amount(0n),
			got: endToken.amount(0n),
			fee: startToken.withUnit(1n).amount(0n),
			bounty: Token.NATIVE_TOKEN.amount(0n),
			hops: action.metadata.markets.map((market) => ({
				market,
				gave: market.inboundToken.amount(0n),
				got: market.outboundToken.amount(0n),
				fee: market.inboundToken.withUnit(1n).amount(0n),
				bounty: Token.NATIVE_TOKEN.amount(0n),
				seen: false,
			})),
		}
	}

	/**
	 * Parses the simulation results from a router dispatch call
	 * @param returnData - Array of dispatch results returned from simulation
	 * @returns Parsed action results array matching the actions array
	 * @throws Error if an action is not found
	 */
	parseSimulationResult(
		returnData: readonly DispatchResult[] | DispatchResult[],
	): ActionsResult<TActions> {
		return returnData.map((result, index) => {
			const action = this.actions[index]
			if (!action) throw new Error('Action not found')
			return VifRouterActions._parseSingleActionSimulationResult(action, result)
		}) as ActionsResult<TActions>
	}

	/**
	 * Parses transaction logs to extract action results
	 * @param logs - Array of transaction logs to parse
	 * @returns Parsed action results array matching the actions array
	 *
	 * Handles parsing of:
	 * - Market orders (single and multi)
	 * - Limit orders
	 * - Cancellations and claims
	 *
	 * For each event type:
	 * - Matches event to corresponding action
	 * - Extracts relevant data like amounts, fees, etc
	 * - Builds appropriate result object
	 */
	parseLogs(logs: Log[]): ActionsResultFromReceipt<TActions> {
		const events = parseEventLogs({
			logs: logs,
			abi: VifEventsABI,
		})
		const results = Array(this.actions.length).fill(undefined)
		for (const event of events) {
			switch (event.eventName) {
				case 'MarketOrder':
					// single or multi order
					for (const [i, action] of this.actions.entries()) {
						if (VifRouterActions._isSingleOrderElement(action)) {
							if (results[i] !== undefined) continue
							if (action.metadata.key !== event.args.market) continue
							results[i] = {
								gave: action.metadata.inboundToken.amount(event.args.gave),
								got: action.metadata.outboundToken.amount(event.args.got),
								fee: action.metadata.inboundToken
									.withUnit(1n)
									.amount(event.args.fee),
								bounty: Token.NATIVE_TOKEN.amount(event.args.bounty),
							} satisfies ActionResultFromReceipt<
								ActionOrFailable<Action.ORDER_SINGLE>
							>
							break
						} else if (VifRouterActions._isMultiOrderElement(action)) {
							if (
								action.metadata.markets.every(
									(market) => market.key !== event.args.market,
								)
							)
								continue
							let res = results[i] as ActionResultFromReceipt<
								ActionOrFailable<Action.ORDER_MULTI>
							>

							res = res ?? VifRouterActions._createMultiOrderResult(action)

							const findIndex = action.metadata.fillWants
								? res.hops.findLastIndex.bind(res.hops)
								: res.hops.findIndex.bind(res.hops)

							const index = findIndex(
								(value) =>
									!value.seen && value.market.key === event.args.market,
							)

							if (index !== -1) {
								if (index === 0) {
									res.gave.amount = event.args.gave
									res.fee.amount = event.args.fee
								} else if (index === res.hops.length - 1) {
									res.got.amount = event.args.got
								}
								res.bounty.amount += event.args.bounty
								const hop = res.hops[index]
								if (!hop) {
									throw new Error('Unexpected error: hop not found')
								}
								hop.gave.amount = event.args.gave
								hop.fee.amount = event.args.fee
								hop.got.amount = event.args.got
								hop.bounty.amount = event.args.bounty
								hop.seen = true
							}

							results[i] = res
							break
						}
					}
					break
				case 'NewOffer':
				case 'OfferUpdated':
					// limit single
					for (const [i, action] of this.actions.entries()) {
						// if the result is already defined, it means a limit order was already processed
						if (results[i] !== undefined) continue
						// if the action is not a limit order, continue
						if (!VifRouterActions._isLimitOrderElement(action)) continue
						// if the limit order is not on the same market or is an update with a different offer id, continue
						if (
							action.metadata.market.key !== event.args.market ||
							(event.eventName === 'OfferUpdated' &&
								action.metadata.offerId !== event.args.offerId)
						)
							continue
						results[i] = {
							offerId: event.args.offerId,
							claimedReceived: action.metadata.market.inboundToken.amount(
								'claimedReceived' in event.args
									? event.args.claimedReceived
									: 0n,
							),
						} satisfies ActionResultFromReceipt<
							ActionOrFailable<Action.LIMIT_SINGLE>
						>
						break
					}
					break
				case 'OfferCancelled':
				case 'OfferClaimed':
					// cancel or claim
					for (const [i, action] of this.actions.entries()) {
						// if the result is already defined, it means a cancel was already processed
						if (results[i] !== undefined) continue
						// if the action is not a cancel, return false
						if (!VifRouterActions._isCancelOrClaimElement(action)) continue
						// if the cancel is not on the same market, same offer id, return false
						if (
							action.metadata.market.key !== event.args.market ||
							action.metadata.offerId !== event.args.offerId
						)
							continue
						results[i] = {
							inbound: action.metadata.market.inboundToken.amount(
								event.args.inbound,
							),
							outbound: action.metadata.market.outboundToken.amount(
								event.args.outbound,
							),
							provision: Token.NATIVE_TOKEN.amount(event.args.provision),
						} satisfies ActionResultFromReceipt<
							ActionOrFailable<Action.CANCEL | Action.CLAIM>
						>
						break
					}
					break
			}
		}
		return results as ActionsResultFromReceipt<TActions>
	}
}
