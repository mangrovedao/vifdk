import type { Address, Hex } from 'viem'
import type { Authorization } from '../../lib/authorization'
import type { SemiMarket } from '../../lib/market'
import type { Tick } from '../../lib/tick'
import type { Token, TokenAmount } from '../../lib/token'
import type { Action } from './enum'
import type { FailedActionError } from './errors'

export type OrderSingleParams<TCanFail extends boolean = false> = {
	/** The market to order on */
	market: SemiMarket
	/** The tick to order on (Max tick if undefined) */
	maxTick?: Tick | undefined
	/** The volume to fill (either inbound or outbound) */
	fillVolume: TokenAmount
	/** The maximum number of offers to fill */
	maxOffers?: bigint | undefined
	/** Whether the action can fail */
	canFail?: TCanFail
}

export type OrderMultiParams = {
	/** The markets to order on */
	markets: SemiMarket[]
	/** The volume to fill (either the inbound or outbound amount) */
	fillVolume: TokenAmount
	/** The maximum number of offers to fill per path */
	maxOffers?: bigint | undefined
	/** The limit volume to fill per path, either max in if exact out, or max out if exact in (undefined if no limit) */
	limitVolume?: TokenAmount | undefined
}

export type LimitSingleParams<TCanFail extends boolean = false> = {
	/** The market to order on */
	market: SemiMarket
	/** The initial offer id (if defined, it'll edit the existing offer) */
	initialOfferId?: number | undefined
	/** The amount of tokens to give */
	gives: TokenAmount
	/** The tick to order on */
	tick: Tick
	/** The expiry date of the offer (undefined if no expiry) */
	expiry?: Date | undefined
	/** The provision of the offer (Provision is needed if expiry is defined) */
	provision?: TokenAmount | undefined
	/** Whether the action can fail */
	canFail?: TCanFail
}

/** Parameters for the claim or cancel action */
export type ClaimCancelParams<TCanFail extends boolean = false> = {
	/** The market to claim or cancel on */
	market: SemiMarket
	/** The offer id to claim or cancel */
	offerId: number
	/** Whether the action can fail */
	canFail?: TCanFail
}

/** Parameters for the settle action */
export type SettleParams<TCanFail extends boolean = false> = {
	/** The amount to settle */
	amount: TokenAmount
	/** Whether the action can fail */
	canFail?: TCanFail
}

/** Parameters for the take action */
export type TakeParams<TCanFail extends boolean = false> = {
	/** The receiver of the tokens */
	receiver: Address
	/** The token to take with amount */
	amount: TokenAmount
	/** Whether the action can fail */
	canFail?: TCanFail
}

/** Parameters for the take all action */
export type TakeAllParams<TCanFail extends boolean = false> = {
	/** The receiver of the tokens */
	receiver: Address
	/** The token to take */
	token: Token
	/** Whether the action can fail */
	canFail?: TCanFail
}

/** Parameters for the sweep action */
export type SweepParams = {
	/** The receiver of the tokens */
	receiver: Address
	/** The token to sweep */
	token: Token
}

/** Parameters for the authorize action */
export type AuthorizeParams<TCanFail extends boolean = false> = {
	/** The authorization to broadcast */
	authorization: Authorization
	/** The signature of the authorization */
	signature: Hex
	/** Whether the action can fail */
	canFail?: TCanFail
}

/** Parameters for the clear all upto or claim action */
export type ClearAllUptoParams<TCanFail extends boolean = false> = {
	/** The amount to clear (and amount up to which to claim) */
	amount: TokenAmount
	/** The receiver of the tokens */
	receiver: Address
	/** Whether the action can fail */
	canFail?: TCanFail
}

/** Represents the result of a single order */
export type OrderResult = {
	/** The amount of tokens sold */
	gave: TokenAmount
	/** The amount of tokens bought */
	got: TokenAmount
	/** The fee paid (expressed in the sent token, with a different unit) */
	fee: TokenAmount
	/** The bounty paid (in native token) */
	bounty: TokenAmount
}

/** Represents the result of a multi-order */
export type MultiOrderResult = {
	/** The amount of tokens sold if exact out, else the amount of tokens bought */
	amount: TokenAmount
}

/** Represents the result of a multi-order from a receipt */
export type MultiOrderResultFromReceipt = OrderResult & {
	/** The hops of the multi-order */
	hops: ({
		/** The market of the hop */
		market: SemiMarket
		/** Whether the hop has been seen on the logs */
		seen: boolean
	} & OrderResult)[]
}

/** Represents the result of a claim or cancel */
export type ClaimCancelResult = {
	/** The amount of tokens received */
	inbound: TokenAmount
	/** The amount of tokens sent */
	outbound: TokenAmount
	/** The provision refunded (in native token) */
	provision: TokenAmount
}

/** Represents the result of a limit order */
export type LimitOrderResult = {
	/** The id of the offer */
	offerId: number
	/** The amount of tokens received claimed (non zero if a previous offer with same id was claimed) */
	claimedReceived: TokenAmount
}

export type ActionStoredMetadata<TAction = Action> = TAction extends Action
	? TAction extends ActionOrFailable<Action.ORDER_SINGLE>
		? SemiMarket
		: TAction extends ActionOrFailable<Action.ORDER_MULTI>
			? { markets: SemiMarket[]; fillWants: boolean }
			: TAction extends
						| ActionOrFailable<Action.CLAIM>
						| ActionOrFailable<Action.CANCEL>
				? {
						market: SemiMarket
						offerId: number
					}
				: TAction extends ActionOrFailable<Action.LIMIT_SINGLE>
					? {
							market: SemiMarket
							offerId: number
							expiry?: Date | undefined
							provision: TokenAmount
						}
					: TAction extends
								| ActionOrFailable<Action.SETTLE>
								| ActionOrFailable<Action.TAKE>
								| ActionOrFailable<Action.SETTLE_ALL>
								| ActionOrFailable<Action.TAKE_ALL>
								| ActionOrFailable<Action.SWEEP>
								| ActionOrFailable<Action.CLEAR_ALL>
								| ActionOrFailable<Action.CLEAR_UPTO_OR_CLAIM>
						? Token
						: TAction extends ActionOrFailable<Action.AUTHORIZE>
							? Authorization
							: undefined
	: never

export type ActionsStoredMetadata<
	TActions extends readonly unknown[] = readonly [],
> = TActions extends readonly []
	? readonly []
	: TActions extends readonly [infer TAction]
		? [ActionStoredMetadata<TAction>]
		: TActions extends readonly [infer TAction, ...infer TRest]
			? [ActionStoredMetadata<TAction>, ...ActionsStoredMetadata<TRest>]
			: never

export type DispatchResult = {
	success: boolean
	returnData: Hex
}

export type ActionElement<TAction = Action> = {
	action: TAction
	args: Hex
	metadata: ActionStoredMetadata<TAction>
}

export type ActionOrFailable<TAction extends Action> =
	ToFailableAction<TAction> extends Action
		? TAction | ToFailableAction<TAction>
		: TAction

export type RawActionResultContent<TAction extends Action> =
	TAction extends ActionOrFailable<Action.ORDER_SINGLE>
		? OrderResult
		: TAction extends ActionOrFailable<Action.ORDER_MULTI>
			? MultiOrderResult
			: TAction extends
						| ActionOrFailable<Action.CLAIM>
						| ActionOrFailable<Action.CANCEL>
				? ClaimCancelResult
				: TAction extends ActionOrFailable<Action.LIMIT_SINGLE>
					? LimitOrderResult
					: undefined

export type ActionResult<TAction> = TAction extends Action
	?
			| {
					type: TAction
					success: true
					data: RawActionResultContent<TAction>
					error?: undefined
			  }
			| (TAction extends FailableActions
					? {
							type: TAction
							success: false
							error: FailedActionError
							data?: undefined
						}
					: never)
	: never

export type ActionResultFromReceiptContent<TAction extends Action> =
	TAction extends ActionOrFailable<Action.ORDER_MULTI>
		? MultiOrderResultFromReceipt
		: RawActionResultContent<TAction>

export type ActionResultFromReceipt<TAction> = TAction extends Action
	?
			| {
					type: TAction
					data: ActionResultFromReceiptContent<TAction>
					success: true
			  }
			| {
					type: TAction
					data?: undefined
					success: false
			  }
	: never

export type ActionToFailable = {
	[Action.ORDER_SINGLE]: Action.FAILABLE_ORDER_SINGLE
	[Action.LIMIT_SINGLE]: Action.FAILABLE_LIMIT_SINGLE
	[Action.CLAIM]: Action.FAILABLE_CLAIM
	[Action.CANCEL]: Action.FAILABLE_CANCEL
	[Action.SETTLE]: Action.FAILABLE_SETTLE
	[Action.TAKE]: Action.FAILABLE_TAKE
	[Action.SETTLE_ALL]: Action.FAILABLE_SETTLE_ALL
	[Action.TAKE_ALL]: Action.FAILABLE_TAKE_ALL
	[Action.WRAP_NATIVE]: Action.FAILABLE_WRAP_NATIVE
	[Action.UNWRAP_NATIVE]: Action.FAILABLE_UNWRAP_NATIVE
	[Action.AUTHORIZE]: Action.FAILABLE_AUTHORIZE
	[Action.CLEAR_UPTO_OR_CLAIM]: Action.FAILABLE_CLEAR_UPTO_OR_CLAIM
}

export type FailableActions = ActionToFailable[keyof ActionToFailable]
export type NonFailableActions = Exclude<Action, FailableActions>

export type ToFailableAction<TAction> = TAction extends keyof ActionToFailable
	? ActionToFailable[TAction]
	: never

export type ToNonFailableAction<TAction> = TAction extends NonFailableActions
	? TAction
	: {
			[K in keyof ActionToFailable]: ActionToFailable[K] extends TAction
				? K
				: never
		}[keyof ActionToFailable]

export type ActionsResult<
	TActions extends readonly unknown[] = readonly Action[],
> = TActions extends readonly []
	? readonly []
	: TActions extends Action[]
		? TActions extends readonly [infer TAction]
			? [ActionResult<TAction>]
			: TActions extends readonly [infer TAction, ...infer TRest]
				? [ActionResult<TAction>, ...ActionsResult<TRest>]
				: ActionResult<Action>[]
		: never

export type ActionsResultFromReceipt<
	TActions extends readonly unknown[] = readonly Action[],
> = TActions extends readonly []
	? readonly []
	: TActions extends Action[]
		? TActions extends readonly [infer TAction]
			? [ActionResultFromReceipt<TAction>]
			: TActions extends readonly [infer TAction, ...infer TRest]
				? [ActionResultFromReceipt<TAction>, ...ActionsResultFromReceipt<TRest>]
				: ActionResultFromReceipt<Action>[]
		: never

export type ExtendActions<
	TActions extends readonly Action[],
	TAction extends Action,
	TCanFail extends boolean,
> = Action[] extends TActions
	? Action[]
	: [...TActions, TCanFail extends true ? ToFailableAction<TAction> : TAction]

export type SettlementActions =
	| Action.SETTLE
	| Action.FAILABLE_SETTLE
	| Action.TAKE
	| Action.FAILABLE_TAKE
	| Action.SETTLE_ALL
	| Action.FAILABLE_SETTLE_ALL
	| Action.TAKE_ALL
	| Action.FAILABLE_TAKE_ALL
	| Action.CLEAR_ALL
	| Action.CLEAR_UPTO_OR_CLAIM
	| Action.FAILABLE_CLEAR_UPTO_OR_CLAIM

type Partition<
	T extends readonly Action[],
	Target extends Action,
	NonTarget extends readonly Action[] = [],
	Targets extends readonly Action[] = [],
> = T extends readonly [
	infer Head extends Action,
	...infer Tail extends readonly Action[],
]
	? Head extends Target
		? // If Head is the Target (SETTLE), append it to the Targets array
			Partition<Tail, Target, NonTarget, [...Targets, Head]>
		: // If Head is NOT the Target, append it to the NonTarget array
			Partition<Tail, Target, [...NonTarget, Head], Targets>
	: // Base Case: When T is empty, concatenate the two lists
		[...NonTarget, ...Targets]

export type SortedActions<T extends readonly Action[]> = Action[] extends T
	? Action[]
	: Partition<T, SettlementActions | Action.SWEEP>
