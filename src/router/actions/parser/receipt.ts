import { type Log, parseEventLogs } from 'viem'
import { Token } from '../../../lib/export'
import { Action } from '../enum'
import { VifEventsABI } from '../events'
import type {
	ActionElement,
	ActionOrFailable,
	ActionResultFromReceipt,
	ActionsResultFromReceipt,
	MultiOrderResultFromReceipt,
} from '../types'

/**
 * Checks if an element is a cancel or claim action
 * @param element - Action element to check
 * @returns True if cancel/claim action
 */
export function isCancelOrClaimElement(
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
export function isLimitOrderElement(
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
export function isSingleOrderElement(
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
export function isMultiOrderElement(
	element: ActionElement,
): element is ActionElement<ActionOrFailable<Action.ORDER_MULTI>> {
	return element.action === Action.ORDER_MULTI
}

/**
 * Creates a multi order result
 * @param action - Action element
 * @returns Multi order result
 */
export function createMultiOrderResult(
	action: ActionElement<ActionOrFailable<Action.ORDER_MULTI>>,
): MultiOrderResultFromReceipt {
	const startToken = action.metadata.markets.at(0)?.inboundToken
	const endToken = action.metadata.markets.at(-1)?.outboundToken
	if (!startToken || !endToken) {
		throw new Error('Invalid markets')
	}
	return {
		gave: startToken.token.amount(0n),
		got: endToken.token.amount(0n),
		fee: startToken.token.withUnit(1n).amount(0n),
		bounty: Token.NATIVE_TOKEN.amount(0n),
		hops: action.metadata.markets.map((market) => ({
			market,
			gave: market.inboundToken.token.amount(0n),
			got: market.outboundToken.token.amount(0n),
			fee: market.inboundToken.token.withUnit(1n).amount(0n),
			bounty: Token.NATIVE_TOKEN.amount(0n),
			seen: false,
		})),
	}
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
export function parseFromLogs<
	TActions extends readonly Action[] = readonly Action[],
>(logs: Log[], actions: ActionElement[]): ActionsResultFromReceipt<TActions> {
	const events = parseEventLogs({
		logs: logs,
		abi: VifEventsABI,
	})
	const results = actions.map(
		(action) =>
			({
				type: action.action,
				data: undefined,
			}) as ActionResultFromReceipt<Action>,
	)
	for (const event of events) {
		switch (event.eventName) {
			case 'MarketOrder':
				// single or multi order
				for (const [i, action] of actions.entries()) {
					if (isSingleOrderElement(action)) {
						if (results[i]?.data !== undefined) continue
						if (action.metadata.key !== event.args.market) continue
						// biome-ignore lint/style/noNonNullAssertion: result is defined at this index
						results[i]!.data = {
							gave: action.metadata.inboundToken.token.amount(event.args.gave),
							got: action.metadata.outboundToken.token.amount(event.args.got),
							fee: action.metadata.inboundToken.token
								.withUnit(1n)
								.amount(event.args.fee),
							bounty: Token.NATIVE_TOKEN.amount(event.args.bounty),
						} satisfies ActionResultFromReceipt<
							ActionOrFailable<Action.ORDER_SINGLE>
						>['data']
						break
					} else if (isMultiOrderElement(action)) {
						if (
							action.metadata.markets.every(
								(market) => market.key !== event.args.market,
							)
						)
							continue
						let res = results[i]?.data as ActionResultFromReceipt<
							ActionOrFailable<Action.ORDER_MULTI>
						>['data']

						res = res ?? createMultiOrderResult(action)

						const findIndex = action.metadata.fillWants
							? res.hops.findLastIndex.bind(res.hops)
							: res.hops.findIndex.bind(res.hops)

						const index = findIndex(
							(value) => !value.seen && value.market.key === event.args.market,
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

						// biome-ignore lint/style/noNonNullAssertion: result is defined at this index
						results[i]!.data = res
						break
					}
				}
				break
			case 'NewOffer':
			case 'OfferUpdated':
				// limit single
				for (const [i, action] of actions.entries()) {
					// if the result is already defined, it means a limit order was already processed
					if (results[i]?.data !== undefined) continue
					// if the action is not a limit order, continue
					if (!isLimitOrderElement(action)) continue
					// if the limit order is not on the same market or is an update with a different offer id, continue
					if (
						action.metadata.market.key !== event.args.market ||
						(event.eventName === 'OfferUpdated' &&
							action.metadata.offerId !== event.args.offerId)
					)
						continue
					// biome-ignore lint/style/noNonNullAssertion: result is defined at this index
					results[i]!.data = {
						offerId: event.args.offerId,
						claimedReceived: action.metadata.market.inboundToken.token.amount(
							'claimedReceived' in event.args ? event.args.claimedReceived : 0n,
						),
					} satisfies ActionResultFromReceipt<
						ActionOrFailable<Action.LIMIT_SINGLE>
					>['data']
					break
				}
				break
			case 'OfferCancelled':
			case 'OfferClaimed':
				// cancel or claim
				for (const [i, action] of actions.entries()) {
					// if the result is already defined, it means a cancel was already processed
					if (results[i]?.data !== undefined) continue
					// if the action is not a cancel, return false
					if (!isCancelOrClaimElement(action)) continue
					// if the cancel is not on the same market, same offer id, return false
					if (
						action.metadata.market.key !== event.args.market ||
						action.metadata.offerId !== event.args.offerId
					)
						continue
					// biome-ignore lint/style/noNonNullAssertion: result is defined at this index
					results[i]!.data = {
						inbound: action.metadata.market.inboundToken.token.amount(
							event.args.inbound,
						),
						outbound: action.metadata.market.outboundToken.token.amount(
							event.args.outbound,
						),
						provision: Token.NATIVE_TOKEN.amount(event.args.provision),
					} satisfies ActionResultFromReceipt<
						ActionOrFailable<Action.CANCEL | Action.CLAIM>
					>['data']
					break
				}
				break
		}
	}
	return results as ActionsResultFromReceipt<TActions>
}
