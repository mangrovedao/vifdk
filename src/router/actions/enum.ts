import type {
	ActionToFailable,
	FailableActions,
	SettlementActions,
	ToNonFailableAction,
} from './types'

export enum Action {
	/** Command to execute a single market order */
	ORDER_SINGLE = 0x00,
	/** Command to execute a single market order with failable outcome */
	FAILABLE_ORDER_SINGLE = 0x80,
	/** Command to execute a market order with multihopping (exact in only) */
	ORDER_MULTI = 0x01,
	/** Command to create a single limit order */
	LIMIT_SINGLE = 0x02,
	/** Command to create a single limit order with failable outcome */
	FAILABLE_LIMIT_SINGLE = 0x82,
	/** Command to claim a single order */
	CLAIM = 0x03,
	/** Command to claim a single order with failable outcome */
	FAILABLE_CLAIM = 0x83,
	/** Command to cancel a single order */
	CANCEL = 0x04,
	/** Command to cancel a single order with failable outcome */
	FAILABLE_CANCEL = 0x84,

	// Settlement

	/** Command to settle debt using router balance first, then caller balance */
	SETTLE = 0x05,
	/** Command to settle debt using router balance first, then caller balance with failable outcome */
	FAILABLE_SETTLE = 0x85,
	/** Command to take tokens from vif to a specified receiver */
	TAKE = 0x06,
	/** Command to take tokens from vif to a specified receiver with failable outcome */
	FAILABLE_TAKE = 0x86,
	/** Command to settle complete debt using router balance first, then caller balance */
	SETTLE_ALL = 0x07,
	/** Command to settle complete debt using router balance first, then caller balance with failable outcome */
	FAILABLE_SETTLE_ALL = 0x87,
	/** Command to take complete credit towards a specified receiver */
	TAKE_ALL = 0x08,
	/** Command to take complete credit towards a specified receiver with failable outcome */
	FAILABLE_TAKE_ALL = 0x88,

	// Additional Actions

	/** Command to send all tokens in the router to a receiver */
	SWEEP = 0x09,
	/** Command to wrap native tokens into the router */
	WRAP_NATIVE = 0x0a,
	/** Command to wrap native tokens into the router with failable outcome */
	FAILABLE_WRAP_NATIVE = 0x8a,
	/** Command to unwrap native tokens from the router */
	UNWRAP_NATIVE = 0x0b,
	/** Command to unwrap native tokens from the router with failable outcome */
	FAILABLE_UNWRAP_NATIVE = 0x8b,
	/** Command to send tokens from the receiver to the router */
	AUTHORIZE = 0x0c,
	/** Command to send tokens from the receiver to the router with failable outcome */
	FAILABLE_AUTHORIZE = 0x8c,

	// Clearing

	/** Command to clear a token credit without transfers */
	CLEAR_ALL = 0x0d,
	/** Command to clear a token credit up without transfers to or claim a token credit above */
	CLEAR_UPTO_OR_CLAIM = 0x0e,
	/** Command to clear a token credit up without transfers to or claim a token credit above with failable outcome */
	FAILABLE_CLEAR_UPTO_OR_CLAIM = 0x8e,
}

/** Mask to extract the action type from a raw action */
export const ACTION_MASK = 0x0f

/** Mask to extract the failable flag from a raw action */
export const FAILABLE_MASK = 0x80

/**
 * Maps each action to its failable counterpart
 */
export const FAILABLE_COUNTERPARTS: ActionToFailable = {
	[Action.ORDER_SINGLE]: Action.FAILABLE_ORDER_SINGLE,
	[Action.LIMIT_SINGLE]: Action.FAILABLE_LIMIT_SINGLE,
	[Action.CLAIM]: Action.FAILABLE_CLAIM,
	[Action.CANCEL]: Action.FAILABLE_CANCEL,
	[Action.SETTLE]: Action.FAILABLE_SETTLE,
	[Action.TAKE]: Action.FAILABLE_TAKE,
	[Action.SETTLE_ALL]: Action.FAILABLE_SETTLE_ALL,
	[Action.TAKE_ALL]: Action.FAILABLE_TAKE_ALL,
	[Action.WRAP_NATIVE]: Action.FAILABLE_WRAP_NATIVE,
	[Action.UNWRAP_NATIVE]: Action.FAILABLE_UNWRAP_NATIVE,
	[Action.AUTHORIZE]: Action.FAILABLE_AUTHORIZE,
	[Action.CLEAR_UPTO_OR_CLAIM]: Action.FAILABLE_CLEAR_UPTO_OR_CLAIM,
}

/**
 * Checks if an action is failable
 * @param action - The action to check
 * @returns True if the action is failable, false otherwise
 */
export function isFailableAction(action: Action): action is FailableActions {
	return (action & FAILABLE_MASK) === FAILABLE_MASK
}

/**
 * Converts a failable action to its non-failable counterpart
 * @param action - The failable action to convert
 * @returns The non-failable action
 */
export function toNonFailableAction<TAction extends Action = Action>(
	action: TAction,
): ToNonFailableAction<TAction> {
	return (action & ACTION_MASK) as ToNonFailableAction<TAction>
}

/**
 * Maps each action to its label
 */
export const ACTION_LABELS: Record<Action, string> = {
	[Action.ORDER_SINGLE]: 'Order Single',
	[Action.FAILABLE_ORDER_SINGLE]: 'Order Single (Failable)',
	[Action.ORDER_MULTI]: 'Order Multi',
	[Action.LIMIT_SINGLE]: 'Limit Single',
	[Action.FAILABLE_LIMIT_SINGLE]: 'Limit Single (Failable)',
	[Action.CLAIM]: 'Claim',
	[Action.FAILABLE_CLAIM]: 'Claim (Failable)',
	[Action.CANCEL]: 'Cancel',
	[Action.FAILABLE_CANCEL]: 'Cancel (Failable)',
	[Action.SETTLE]: 'Settle',
	[Action.FAILABLE_SETTLE]: 'Settle (Failable)',
	[Action.TAKE]: 'Take',
	[Action.FAILABLE_TAKE]: 'Take (Failable)',
	[Action.SETTLE_ALL]: 'Settle All',
	[Action.FAILABLE_SETTLE_ALL]: 'Settle All (Failable)',
	[Action.TAKE_ALL]: 'Take All',
	[Action.FAILABLE_TAKE_ALL]: 'Take All (Failable)',
	[Action.SWEEP]: 'Sweep',
	[Action.WRAP_NATIVE]: 'Wrap Native',
	[Action.FAILABLE_WRAP_NATIVE]: 'Wrap Native (Failable)',
	[Action.UNWRAP_NATIVE]: 'Unwrap Native',
	[Action.FAILABLE_UNWRAP_NATIVE]: 'Unwrap Native (Failable)',
	[Action.AUTHORIZE]: 'Authorize',
	[Action.FAILABLE_AUTHORIZE]: 'Authorize (Failable)',
	[Action.CLEAR_ALL]: 'Clear All',
	[Action.CLEAR_UPTO_OR_CLAIM]: 'Clear Up to or Claim',
	[Action.FAILABLE_CLEAR_UPTO_OR_CLAIM]: 'Clear Up to or Claim (Failable)',
}

/**
 * Checks if an action is a settlement action
 * @param action - The action to check
 * @returns True if the action is a settlement action, false otherwise
 */
export function isSettlementAction(
	action: Action,
): action is SettlementActions {
	action = toNonFailableAction(action)
	return (
		(action < Action.SWEEP && action > Action.CANCEL) ||
		action > Action.AUTHORIZE
	)
}
