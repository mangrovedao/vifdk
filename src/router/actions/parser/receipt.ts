import {
	type ContractEventName,
	type Log,
	type ParseEventLogsReturnType,
	parseEventLogs,
} from 'viem'
import { type SemiMarket, Token } from '../../../lib/export'
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
 * Determines if the provided action element represents a cancellation or claim action.
 * @param element - The action element to check.
 * @returns True if the element's action is CANCEL, FAILABE_CANCEL, CLAIM, or FAILABE_CLAIM, otherwise false.
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
 * Determines if the provided action element represents a limit order action.
 * @param element - The action element to check.
 * @returns True if the action element is LIMIT_SINGLE or FAILABLE_LIMIT_SINGLE.
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
 * Determines if the provided action element represents a single order action.
 * @param element - The action element to check.
 * @returns True if the action element is ORDER_SINGLE or FAILABLE_ORDER_SINGLE.
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
 * Determines if the provided action element represents a multi order action.
 * @param element - The action element to check.
 * @returns True if the action element is ORDER_MULTI.
 */
export function isMultiOrderElement(
	element: ActionElement,
): element is ActionElement<ActionOrFailable<Action.ORDER_MULTI>> {
	return element.action === Action.ORDER_MULTI
}

/**
 * Creates a skeleton result object for a multi-order action, initializing all amounts to zero.
 * @param action - The multi-order action element.
 * @returns MultiOrderResultFromReceipt with all fields set to zero.
 * @throws If the action's markets are invalid or missing tokens.
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
 * Deprecated! Parses transaction logs and matches them to specific action results.
 * Iterates through event logs, associates them to individual actions, and constructs
 * result objects containing amounts, fees, bounties, etc. for each action.
 *
 * Supports parsing market orders (single/multi), limit orders, cancellations, and claims.
 *
 * @param logs - Array of raw transaction logs to be parsed.
 * @param actions - The original actions array to match results to.
 * @returns An array of action results matched (by index) to the actions.
 */
export function parseFromLogsDeprecated<
	TActions extends readonly Action[] = readonly Action[],
>(logs: Log[], actions: ActionElement[]): ActionsResultFromReceipt<TActions> {
	const events = parseEventLogs({
		logs: logs,
		abi: VifEventsABI,
	})
	const results: ActionsResultFromReceipt<Action[]> = actions.map((action) => ({
		type: action.action,
		data: undefined,
		// TODO: only set to true things we'll not check or loop through actions instead of events
		success: true,
	})) as ActionsResultFromReceipt<Action[]>
	for (const event of events) {
		switch (event.eventName) {
			case 'MarketOrder':
				// Handle both single and multi market orders
				for (const [i, action] of actions.entries()) {
					if (isSingleOrderElement(action)) {
						if (results[i]?.data !== undefined) continue
						if (action.metadata.key !== event.args.market) continue
						results[i] = {
							type: action.action,
							success: true,
							data: {
								gave: action.metadata.inboundToken.token.amount(
									event.args.gave,
								),
								got: action.metadata.outboundToken.token.amount(event.args.got),
								fee: action.metadata.inboundToken.token
									.withUnit(1n)
									.amount(event.args.fee),
								bounty: Token.NATIVE_TOKEN.amount(event.args.bounty),
							},
						} satisfies ActionResultFromReceipt<
							ActionOrFailable<Action.ORDER_SINGLE>
						>
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
				// Handle limit single actions
				for (const [i, action] of actions.entries()) {
					// if the result is already defined, it means a limit order was already processed
					if (results[i]?.data !== undefined) continue
					// if the action is not a limit order, continue
					if (!isLimitOrderElement(action)) continue
					// If market/key or offerId don't match, skip
					if (
						action.metadata.market.key !== event.args.market ||
						(event.eventName === 'OfferUpdated' &&
							action.metadata.offerId !== event.args.offerId)
					)
						continue
					results[i] = {
						type: action.action,
						success: true,
						data: {
							offerId: event.args.offerId,
							claimedReceived: action.metadata.market.inboundToken.token.amount(
								'claimedReceived' in event.args
									? event.args.claimedReceived
									: 0n,
							),
						},
					} satisfies ActionResultFromReceipt<
						ActionOrFailable<Action.LIMIT_SINGLE>
					>
					break
				}
				break
			case 'OfferCancelled':
			case 'OfferClaimed':
				// Handle cancel or claim actions
				for (const [i, action] of actions.entries()) {
					// if the result is already defined, it means a cancel was already processed
					if (results[i]?.data !== undefined) continue
					// if the action is not a cancel, return false
					if (!isCancelOrClaimElement(action)) continue
					// match by market + offerId
					if (
						action.metadata.market.key !== event.args.market ||
						action.metadata.offerId !== event.args.offerId
					)
						continue
					results[i] = {
						type: action.action,
						success: true,
						data: {
							inbound: action.metadata.market.inboundToken.token.amount(
								event.args.inbound,
							),
							outbound: action.metadata.market.outboundToken.token.amount(
								event.args.outbound,
							),
							provision: Token.NATIVE_TOKEN.amount(event.args.provision),
						},
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

/**
 * Type alias for results of parsing VI.F logs.
 */
type VifEvents = ParseEventLogsReturnType<
	typeof VifEventsABI,
	ContractEventName<typeof VifEventsABI>,
	true
>

/** Represents an event with the 'MarketOrder' name. */
type MarketOrderEvent = VifEvents[number] & { eventName: 'MarketOrder' }
/** Represents an event with 'NewOffer' or 'OfferUpdated'. */
type OfferEvent = VifEvents[number] & {
	eventName: 'NewOffer' | 'OfferUpdated'
}
/** Represents an event with 'OfferCancelled' or 'OfferClaimed'. */
type ClaimCancelEvent = VifEvents[number] & {
	eventName: 'OfferCancelled' | 'OfferClaimed'
}

/**
 * Parses a single order (market order) action from a list of parsed events.
 * Removes the matched 'MarketOrder' event (if found) from the provided events array.
 * @param events - The parsed VI.F events (mutable, will be spliced in place).
 * @param action - The single order action element.
 * @returns ActionResultFromReceipt with parsed values if found; success=false and data=undefined if not found.
 */
function parseSingleOrderFromEvents(
	events: VifEvents,
	action: ActionElement<ActionOrFailable<Action.ORDER_SINGLE>>,
): ActionResultFromReceipt<ActionOrFailable<Action.ORDER_SINGLE>> {
	const index = events.findIndex(
		(event) =>
			event.eventName === 'MarketOrder' &&
			event.args.market === action.metadata.key,
	)
	if (index === -1) {
		return {
			type: action.action,
			success: false,
			data: undefined,
		}
	}
	const event = events.splice(index, 1)[0] as MarketOrderEvent
	return {
		type: action.action,
		success: true,
		data: {
			gave: action.metadata.inboundToken.token.amount(event.args.gave),
			got: action.metadata.outboundToken.token.amount(event.args.got),
			fee: action.metadata.inboundToken.token
				.withUnit(1n)
				.amount(event.args.fee),
			bounty: Token.NATIVE_TOKEN.amount(event.args.bounty),
		},
	}
}

/**
 * Recursively checks if a sequence of market order events matches the provided markets in order.
 * Used to identify a contiguous run of events corresponding to a multi-order action.
 * @param events - Array of VifEvents.
 * @param markets - Array of SemiMarket (order route).
 * @param eventIndex - Current index in events array.
 * @param marketIndex - Current index in markets array.
 * @returns True if a series is found, otherwise false.
 */
function isSeriesOfMarketOrders(
	events: VifEvents,
	markets: SemiMarket[],
	eventIndex: number,
	marketIndex: number,
): boolean {
	const market = markets[marketIndex]
	if (!market) return true
	const event = events[eventIndex]
	if (!event) return false
	if (event.eventName === 'MarketOrder' && event.args.market === market.key)
		return isSeriesOfMarketOrders(
			events,
			markets,
			eventIndex + 1,
			marketIndex + 1,
		)
	return false
}

/**
 * Parses a multi order action from events. Attempts to match a continuous
 * run of MarketOrder events to each hop in the route; if matched,
 * removes them from the events list and constructs a full MultiOrderResultFromReceipt.
 *
 * @param events - Array of parsed VifEvents (will be spliced).
 * @param action - The multi order action element.
 * @returns ActionResultFromReceipt for the multi order, or success=false if not found.
 */
function parseMultiOrderFromEvents(
	events: VifEvents,
	action: ActionElement<ActionOrFailable<Action.ORDER_MULTI>>,
): ActionResultFromReceipt<ActionOrFailable<Action.ORDER_MULTI>> {
	const markets = action.metadata.markets.slice()
	if (action.metadata.fillWants) markets.reverse()
	const index = events.findIndex((_, i) =>
		isSeriesOfMarketOrders(events, markets, i, 0),
	)
	const inboundToken = action.metadata.markets.at(0)?.inboundToken
	const outboundToken = action.metadata.markets.at(-1)?.outboundToken
	if (index === -1 || !inboundToken || !outboundToken) {
		return {
			type: action.action,
			success: false,
			data: undefined,
		}
	}
	const orders = events.splice(index, markets.length) as MarketOrderEvent[]
	const hops: MultiOrderResultFromReceipt['hops'] = []
	const bounty = Token.NATIVE_TOKEN.amount(0n)
	for (const order of orders) {
		const market = markets[hops.length]
		if (!market) {
			throw new Error('Unexpected error: market not found')
		}
		hops.push({
			market,
			gave: market.inboundToken.token.amount(order.args.gave),
			got: market.outboundToken.token.amount(order.args.got),
			fee: market.inboundToken.token.withUnit(1n).amount(order.args.fee),
			bounty: Token.NATIVE_TOKEN.amount(order.args.bounty),
			seen: true,
		})
		bounty.amount += order.args.bounty
	}
	if (action.metadata.fillWants) hops.reverse()
	return {
		type: action.action,
		success: true,
		data: {
			gave: inboundToken.token.amount(orders[0]?.args.gave ?? 0n),
			got: outboundToken.token.amount(
				orders[orders.length - 1]?.args.got ?? 0n,
			),
			fee: inboundToken.token.withUnit(1n).amount(orders[0]?.args.fee ?? 0n),
			bounty,
			hops,
		},
	}
}

/**
 * Parses a limit single offer action from events list.
 * Finds the first NewOffer or (if offerId matches) an OfferUpdated event and removes it from the list.
 * @param events - Array of VifEvents (mutable, will be spliced).
 * @param action - The limit single action element.
 * @returns An ActionResultFromReceipt for the limit order, or success=false if not found.
 */
function parseOfferFromEvents(
	events: VifEvents,
	action: ActionElement<ActionOrFailable<Action.LIMIT_SINGLE>>,
): ActionResultFromReceipt<ActionOrFailable<Action.LIMIT_SINGLE>> {
	const index = events.findIndex(
		(event) =>
			event.eventName === 'NewOffer' ||
			(event.eventName === 'OfferUpdated' &&
				event.args.market === action.metadata.market.key &&
				event.args.offerId === action.metadata.offerId),
	)
	if (index === -1) {
		return {
			type: action.action,
			success: false,
			data: undefined,
		}
	}
	const event = events.splice(index, 1)[0] as OfferEvent
	return {
		type: action.action,
		success: true,
		data: {
			offerId: event.args.offerId,
			claimedReceived: action.metadata.market.inboundToken.token.amount(
				'claimedReceived' in event.args ? event.args.claimedReceived : 0n,
			),
		},
	}
}

/**
 * Parses a claim or cancel action result from events list.
 * Locates the first OfferCancelled or OfferClaimed event and removes it from the list.
 * @param events - Array of VifEvents (mutable, spliced).
 * @param action - The cancel/claim action element.
 * @returns The corresponding result, or success=false if not found.
 */
function parseClaimCancelFromEvents(
	events: VifEvents,
	action: ActionElement<ActionOrFailable<Action.CANCEL | Action.CLAIM>>,
): ActionResultFromReceipt<ActionOrFailable<Action.CANCEL | Action.CLAIM>> {
	const index = events.findIndex(
		(event) =>
			event.eventName === 'OfferCancelled' ||
			event.eventName === 'OfferClaimed',
	)
	if (index === -1) {
		return {
			type: action.action,
			success: false,
			data: undefined,
		}
	}
	const event = events.splice(index, 1)[0] as ClaimCancelEvent
	return {
		type: action.action,
		success: true,
		data: {
			inbound: action.metadata.market.inboundToken.token.amount(
				event.args.inbound,
			),
			outbound: action.metadata.market.outboundToken.token.amount(
				event.args.outbound,
			),
			provision: Token.NATIVE_TOKEN.amount(event.args.provision),
		},
	}
}

/**
 * Parses a single action result from the provided list of VI.F events.
 * Delegates to specific parsing functions for each action type.
 * @param events - Array of parsed VI.F events (will be mutated).
 * @param action - An action element of any type.
 * @returns The parsed action result; if not matched, returns a default result with success=true and data=undefined.
 */
function parseActionFromEvents(
	events: VifEvents,
	action: ActionElement,
): ActionResultFromReceipt<Action> {
	if (isSingleOrderElement(action)) {
		return parseSingleOrderFromEvents(events, action)
	} else if (isLimitOrderElement(action)) {
		return parseOfferFromEvents(events, action)
	} else if (isCancelOrClaimElement(action)) {
		return parseClaimCancelFromEvents(events, action)
	} else if (isMultiOrderElement(action)) {
		return parseMultiOrderFromEvents(events, action)
	} else {
		return {
			type: action.action,
			success: true, // By default true if not handled
			data: undefined,
		} as ActionResultFromReceipt<Action>
	}
}

/**
 * Parses event logs and produces action results for an entire actions array.
 * Each action is matched to its corresponding event(s), and the results reflect
 * amounts, fees, and other data as appropriate to each action type.
 *
 * @param logs - Raw EVM log entries to parse into structured events.
 * @param actions - The action elements being processed; expected order must match logs.
 * @returns An array of action results, matched by index.
 */
export function parseFromLogs<
	TActions extends readonly Action[] = readonly Action[],
>(logs: Log[], actions: ActionElement[]): ActionsResultFromReceipt<TActions> {
	const events: VifEvents = parseEventLogs({
		logs: logs,
		abi: VifEventsABI,
	})
	const results: ActionsResultFromReceipt<Action[]> = []
	for (const action of actions) {
		results.push(parseActionFromEvents(events, action))
	}
	return results as ActionsResultFromReceipt<TActions>
}
