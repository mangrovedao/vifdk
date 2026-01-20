import { Action } from './enum'
import type { ActionElement, ActionOrFailable } from './types'

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
 * Determines if the provided action element represents a SETTLE_ALL action.
 * @param element - The action element to check.
 * @returns True if the action element is SETTLE_ALL or FAILABLE_SETTLE_ALL.
 */
export function isSettleAllElement(
	element: ActionElement,
): element is ActionElement<ActionOrFailable<Action.SETTLE_ALL>> {
	return (
		element.action === Action.SETTLE_ALL ||
		element.action === Action.FAILABLE_SETTLE_ALL
	)
}

/**
 * Determines if the provided action element represents a TAKE_ALL action.
 * @param element - The action element to check.
 * @returns True if the action element is TAKE_ALL or FAILABLE_TAKE_ALL.
 */
export function isTakeAllElement(
	element: ActionElement,
): element is ActionElement<ActionOrFailable<Action.TAKE_ALL>> {
	return (
		element.action === Action.TAKE_ALL ||
		element.action === Action.FAILABLE_TAKE_ALL
	)
}
