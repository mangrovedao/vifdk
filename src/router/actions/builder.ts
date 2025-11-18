/**
 * ABI imports for encoding/decoding parameters and events
 */
import {
	encodeAbiParameters,
	isAddressEqual,
	maxUint256,
	zeroAddress,
} from 'viem'
/**
 * Market types
 */
import { BA } from '../../lib/market'
/**
 * Tick utilities
 */
import { Tick } from '../../lib/tick'
/**
 * Token types and utilities
 */
import { Token, type TokenAmount } from '../../lib/token'
/**
 * Router type
 */
import type { VifRouter } from '../router'
/**
 * Actions class
 */
import { VifRouterActions } from './actions'
/**
 * Action enums and utilities
 */
import { Action } from './enum'
/**
 * Error types
 */
import { InvalidPathMultiOrderError, InvalidTokenError } from './errors'
/**
 * Action types and parameters
 */
import type {
	ActionElement,
	ActionOrFailable,
	AuthorizeParams,
	ClaimCancelParams,
	ClearAllUptoParams,
	ExtendActions,
	LimitSingleParams,
	OrderMultiParams,
	OrderSingleParams,
	SettleParams,
	SweepParams,
	TakeAllParams,
	TakeParams,
} from './types'

export class VifRouterActionsBuilder<
	TActions extends readonly Action[] = readonly [],
> {
	/** Array of action elements to be executed */
	private actions: ActionElement[] = []

	/**
	 * Returns the list of action elements
	 * @returns List of action elements
	 */
	get list(): readonly ActionElement[] {
		return this.actions
	}

	/**
	 * Creates a new VifRouterActionsBuilder instance
	 * @param router - The VifRouter instance to use for execution
	 */
	constructor(public readonly router: VifRouter) {}

	/**
	 * Adds a single order action
	 * @param params - Parameters for the order
	 * @returns Updated VifRouterActionsBuilder instance
	 */
	orderSingle<TCanFail extends boolean = false>({
		market,
		fillVolume,
		maxTick,
		maxOffers = 100n,
		canFail,
	}: OrderSingleParams<TCanFail>): VifRouterActionsBuilder<
		ExtendActions<TActions, Action.ORDER_SINGLE, TCanFail>
	> {
		maxTick = maxTick ?? Tick.MAX_TICK(market.market.tickSpacing)
		const isBase = fillVolume.token.equals(market.market.base.token)
		if (!isBase && !fillVolume.token.equals(market.market.quote.token)) {
			throw new InvalidTokenError(fillVolume.token, [
				market.market.base.token,
				market.market.quote.token,
			])
		}
		// If I express in base on asks market, then I want to fill wants
		const fillWants = isBase ? market.ba === BA.ASKS : market.ba === BA.BIDS
		this.actions.push({
			action: canFail ? Action.FAILABLE_ORDER_SINGLE : Action.ORDER_SINGLE,
			args: encodeAbiParameters(
				[
					{ type: 'bytes32', name: 'marketId' },
					{ type: 'int256', name: 'maxTick' },
					{ type: 'uint256', name: 'fillVolume' },
					{ type: 'bool', name: 'fillWants' },
					{ type: 'uint256', name: 'maxOffers' },
				],
				[market.key, maxTick.value, fillVolume.amount, fillWants, maxOffers],
			),
			metadata: market,
		} satisfies ActionElement<ActionOrFailable<Action.ORDER_SINGLE>>)
		return this as unknown as VifRouterActionsBuilder<
			ExtendActions<TActions, Action.ORDER_SINGLE, TCanFail>
		>
	}

	/**
	 * Adds a multi-order action
	 * @param params - Parameters for the multi-order
	 * @returns Updated VifRouterActionsBuilder instance
	 */
	orderMulti({
		markets,
		fillVolume,
		maxOffers = 50n,
		limitVolume,
	}: OrderMultiParams): VifRouterActionsBuilder<
		ExtendActions<TActions, Action.ORDER_MULTI, false>
	> {
		if (markets.length < 2) throw new InvalidPathMultiOrderError(markets)

		const sendToken = markets.at(0)?.inboundToken
		const receiveToken = markets.at(-1)?.outboundToken

		if (!sendToken || !receiveToken) {
			throw new Error(
				'Unexpected error: sendToken or receiveToken is undefined',
			)
		}

		// set fill wants and check the correctness of the fill volume token
		const fillWants = fillVolume.token.equals(receiveToken.token)
		if (!fillWants && !fillVolume.token.equals(sendToken.token)) {
			throw new InvalidTokenError(fillVolume.token, [
				sendToken.token,
				receiveToken.token,
			])
		}

		// Set default limit volume and check the token
		limitVolume =
			limitVolume ??
			(fillWants
				? sendToken.token.amount(maxUint256)
				: receiveToken.token.amount(0n))
		if (
			(fillWants && !limitVolume.token.equals(sendToken.token)) ||
			(!fillWants && !limitVolume.token.equals(receiveToken.token))
		) {
			throw new InvalidTokenError(limitVolume.token, [
				sendToken.token,
				receiveToken.token,
			])
		}

		// check the path is correct
		let prevToken = sendToken
		for (const market of markets) {
			if (
				!isAddressEqual(
					market.inboundToken.token.address,
					prevToken.token.address,
				)
			) {
				throw new InvalidPathMultiOrderError(markets)
			}
			prevToken = market.outboundToken
		}

		// push the arguments
		this.actions.push({
			action: Action.ORDER_MULTI,
			args: encodeAbiParameters(
				[
					{ type: 'bytes32[]', name: 'markets' },
					{ type: 'uint256', name: 'fillVolume' },
					{ type: 'bool', name: 'fillWants' },
					{ type: 'uint256', name: 'maxOffers' },
					{ type: 'uint256', name: 'limitVolume' },
				],
				[
					markets.map((market) => market.key),
					fillVolume.amount,
					fillWants,
					maxOffers,
					limitVolume.amount,
				],
			),
			metadata: { markets, fillWants },
		} satisfies ActionElement<ActionOrFailable<Action.ORDER_MULTI>>)
		return this as unknown as VifRouterActionsBuilder<
			ExtendActions<TActions, Action.ORDER_MULTI, false>
		>
	}

	/**
	 * Adds a limit single order action
	 * @param params - Parameters for the limit order
	 * @returns Updated VifRouterActionsBuilder instance
	 */
	limitSingle<TCanFail extends boolean = false>({
		market,
		initialOfferId = 0,
		gives,
		tick,
		expiry,
		provision = Token.PROVISION_TOKEN.amount(0n),
		canFail,
	}: LimitSingleParams<TCanFail>): VifRouterActionsBuilder<
		ExtendActions<TActions, Action.LIMIT_SINGLE, TCanFail>
	> {
		const expirySeconds = expiry ? Math.floor(expiry.getTime() / 1000) : 0

		// check provision token is valid
		if (provision.token.address !== zeroAddress) {
			throw new InvalidTokenError(provision.token, [Token.PROVISION_TOKEN])
		}

		// check if the sell token is valid
		if (!market.outboundToken.token.equals(gives.token)) {
			throw new InvalidTokenError(gives.token, [market.outboundToken.token])
		}

		this.actions.push({
			action: canFail ? Action.FAILABLE_LIMIT_SINGLE : Action.LIMIT_SINGLE,
			args: encodeAbiParameters(
				[
					{ type: 'bytes32', name: 'marketId' },
					{ type: 'uint40', name: 'initialOfferId' },
					{ type: 'uint256', name: 'give' },
					{ type: 'int256', name: 'tick' },
					{ type: 'uint32', name: 'expirySeconds' },
					{ type: 'uint24', name: 'provision' },
				],
				[
					market.key,
					initialOfferId,
					gives.amount,
					tick.value,
					expirySeconds,
					Number(provision.amount / provision.token.unit),
				],
			),
			metadata: { market, offerId: initialOfferId },
		} satisfies ActionElement<ActionOrFailable<Action.LIMIT_SINGLE>>)
		return this as unknown as VifRouterActionsBuilder<
			ExtendActions<TActions, Action.LIMIT_SINGLE, TCanFail>
		>
	}

	/**
	 * Adds a claim action
	 * @param params - Parameters for claiming
	 * @returns Updated VifRouterActionsBuilder instance
	 */
	claim<TCanFail extends boolean = false>({
		market,
		offerId,
		canFail,
	}: ClaimCancelParams<TCanFail>): VifRouterActionsBuilder<
		ExtendActions<TActions, Action.CLAIM, TCanFail>
	> {
		this.actions.push({
			action: canFail ? Action.FAILABLE_CLAIM : Action.CLAIM,
			args: encodeAbiParameters(
				[
					{ type: 'bytes32', name: 'marketId' },
					{ type: 'uint40', name: 'offerId' },
				],
				[market.key, offerId],
			),
			metadata: { market, offerId },
		} satisfies ActionElement<ActionOrFailable<Action.CLAIM>>)
		return this as unknown as VifRouterActionsBuilder<
			ExtendActions<TActions, Action.CLAIM, TCanFail>
		>
	}

	/**
	 * Adds a cancel action
	 * @param params - Parameters for canceling
	 * @returns Updated VifRouterActionsBuilder instance
	 */
	cancel<TCanFail extends boolean = false>({
		market,
		offerId,
		canFail,
	}: ClaimCancelParams<TCanFail>): VifRouterActionsBuilder<
		ExtendActions<TActions, Action.CANCEL, TCanFail>
	> {
		this.actions.push({
			action: canFail ? Action.FAILABLE_CANCEL : Action.CANCEL,
			args: encodeAbiParameters(
				[
					{ type: 'bytes32', name: 'marketId' },
					{ type: 'uint40', name: 'offerId' },
				],
				[market.key, offerId],
			),
			metadata: { market, offerId },
		} satisfies ActionElement<ActionOrFailable<Action.CANCEL>>)
		return this as unknown as VifRouterActionsBuilder<
			ExtendActions<TActions, Action.CANCEL, TCanFail>
		>
	}

	/**
	 * Adds a settle action
	 * @param params - Parameters for settling
	 * @returns Updated VifRouterActionsBuilder instance
	 */
	settle<TCanFail extends boolean = false>({
		amount,
		canFail,
	}: SettleParams<TCanFail>): VifRouterActionsBuilder<
		ExtendActions<TActions, Action.SETTLE, TCanFail>
	> {
		this.actions.push({
			action: canFail ? Action.FAILABLE_SETTLE : Action.SETTLE,
			args: encodeAbiParameters(
				[
					{ type: 'address', name: 'token' },
					{ type: 'uint256', name: 'amount' },
				],
				[amount.token.address, amount.amount],
			),
			metadata: amount.token,
		} satisfies ActionElement<ActionOrFailable<Action.SETTLE>>)
		return this as unknown as VifRouterActionsBuilder<
			ExtendActions<TActions, Action.SETTLE, TCanFail>
		>
	}

	/**
	 * Adds a take action
	 * @param params - Parameters for taking
	 * @returns Updated VifRouterActionsBuilder instance
	 */
	take<TCanFail extends boolean = false>({
		receiver,
		amount,
		canFail,
	}: TakeParams<TCanFail>): VifRouterActionsBuilder<
		ExtendActions<TActions, Action.TAKE, TCanFail>
	> {
		this.actions.push({
			action: canFail ? Action.FAILABLE_TAKE : Action.TAKE,
			args: encodeAbiParameters(
				[
					{ type: 'address', name: 'token' },
					{ type: 'uint256', name: 'amount' },
					{ type: 'address', name: 'receiver' },
				],
				[amount.token.address, amount.amount, receiver],
			),
			metadata: amount.token,
		} satisfies ActionElement<ActionOrFailable<Action.TAKE>>)
		return this as unknown as VifRouterActionsBuilder<
			ExtendActions<TActions, Action.TAKE, TCanFail>
		>
	}

	/**
	 * Adds a settle all action
	 * @param token - Token to settle
	 * @param canFail - Whether the action can fail
	 * @returns Updated VifRouterActionsBuilder instance
	 */
	settleAll<TCanFail extends boolean = false>(
		token: Token,
		canFail?: TCanFail,
	): VifRouterActionsBuilder<
		ExtendActions<TActions, Action.SETTLE_ALL, TCanFail>
	> {
		this.actions.push({
			action: canFail ? Action.FAILABLE_SETTLE_ALL : Action.SETTLE_ALL,
			args: encodeAbiParameters(
				[{ type: 'address', name: 'token' }],
				[token.address],
			),
			metadata: token,
		} satisfies ActionElement<ActionOrFailable<Action.SETTLE_ALL>>)
		return this as unknown as VifRouterActionsBuilder<
			ExtendActions<TActions, Action.SETTLE_ALL, TCanFail>
		>
	}

	/**
	 * Adds a take all action
	 * @param params - Parameters for taking all
	 * @returns Updated VifRouterActionsBuilder instance
	 */
	takeAll<TCanFail extends boolean = false>({
		receiver,
		token,
		canFail,
	}: TakeAllParams<TCanFail>): VifRouterActionsBuilder<
		ExtendActions<TActions, Action.TAKE_ALL, TCanFail>
	> {
		this.actions.push({
			action: canFail ? Action.FAILABLE_TAKE_ALL : Action.TAKE_ALL,
			args: encodeAbiParameters(
				[
					{ type: 'address', name: 'token' },
					{ type: 'address', name: 'receiver' },
				],
				[token.address, receiver],
			),
			metadata: token,
		} satisfies ActionElement<ActionOrFailable<Action.TAKE_ALL>>)
		return this as unknown as VifRouterActionsBuilder<
			ExtendActions<TActions, Action.TAKE_ALL, TCanFail>
		>
	}

	/**
	 * Adds a sweep action
	 * @param params - Parameters for sweeping
	 * @returns Updated VifRouterActionsBuilder instance
	 */
	sweep({
		receiver,
		token,
	}: SweepParams): VifRouterActionsBuilder<
		ExtendActions<TActions, Action.SWEEP, false>
	> {
		this.actions.push({
			action: Action.SWEEP,
			args: encodeAbiParameters(
				[
					{ type: 'address', name: 'token' },
					{ type: 'address', name: 'receiver' },
				],
				[token.address, receiver],
			),
			metadata: token,
		} satisfies ActionElement<ActionOrFailable<Action.SWEEP>>)
		return this as unknown as VifRouterActionsBuilder<
			ExtendActions<TActions, Action.SWEEP, false>
		>
	}

	/**
	 * Adds a wrap native token action
	 * @param amount - Amount to wrap
	 * @param canFail - Whether the action can fail
	 * @returns Updated VifRouterActionsBuilder instance
	 */
	wrapNative<TCanFail extends boolean = false>(
		amount: TokenAmount,
		canFail?: TCanFail,
	): VifRouterActionsBuilder<
		ExtendActions<TActions, Action.WRAP_NATIVE, TCanFail>
	> {
		this.actions.push({
			action: canFail ? Action.FAILABLE_WRAP_NATIVE : Action.WRAP_NATIVE,
			args: encodeAbiParameters(
				[{ type: 'uint256', name: 'amount' }],
				[amount.amount],
			),
			metadata: undefined,
		} satisfies ActionElement<ActionOrFailable<Action.WRAP_NATIVE>>)
		return this as unknown as VifRouterActionsBuilder<
			ExtendActions<TActions, Action.WRAP_NATIVE, TCanFail>
		>
	}

	/**
	 * Adds an unwrap native token action
	 * @param amount - Amount to unwrap
	 * @param canFail - Whether the action can fail
	 * @returns Updated VifRouterActionsBuilder instance
	 */
	unwrapNative<TCanFail extends boolean = false>(
		amount: TokenAmount,
		canFail?: TCanFail,
	): VifRouterActionsBuilder<
		ExtendActions<TActions, Action.UNWRAP_NATIVE, TCanFail>
	> {
		this.actions.push({
			action: canFail ? Action.FAILABLE_UNWRAP_NATIVE : Action.UNWRAP_NATIVE,
			args: encodeAbiParameters(
				[{ type: 'uint256', name: 'amount' }],
				[amount.amount],
			),
			metadata: undefined,
		} satisfies ActionElement<ActionOrFailable<Action.UNWRAP_NATIVE>>)
		return this as unknown as VifRouterActionsBuilder<
			ExtendActions<TActions, Action.UNWRAP_NATIVE, TCanFail>
		>
	}

	/**
	 * Adds an authorize action
	 * @param params - Parameters for authorization
	 * @returns Updated VifRouterActionsBuilder instance
	 */
	authorize<TCanFail extends boolean = false>({
		authorization,
		signature,
		canFail,
	}: AuthorizeParams<TCanFail>): VifRouterActionsBuilder<
		ExtendActions<TActions, Action.AUTHORIZE, TCanFail>
	> {
		this.actions.push({
			action: canFail ? Action.FAILABLE_AUTHORIZE : Action.AUTHORIZE,
			args: encodeAbiParameters(
				[
					{
						type: 'tuple',
						name: 'authorizationData',
						components: [
							{
								type: 'tuple',
								name: 'authorization',
								components: [
									{ type: 'address', name: 'authorizer' },
									{ type: 'address', name: 'authorized' },
									{ type: 'bool', name: 'isAuthorized' },
									{ type: 'uint256', name: 'nonce' },
									{ type: 'uint256', name: 'deadline' },
								],
							},
							{ type: 'bytes', name: 'signature' },
						],
					},
				],
				[
					{
						authorization: {
							...authorization,
							deadline: BigInt(
								Math.floor(authorization.deadline.getTime() / 1000),
							),
						},
						signature,
					},
				],
			),
			metadata: authorization,
		} satisfies ActionElement<ActionOrFailable<Action.AUTHORIZE>>)
		return this as unknown as VifRouterActionsBuilder<
			ExtendActions<TActions, Action.AUTHORIZE, TCanFail>
		>
	}

	/**
	 * Adds a clear all action
	 * @param token - Token to clear
	 * @returns Updated VifRouterActionsBuilder instance
	 */
	clearAll(
		token: Token,
	): VifRouterActionsBuilder<ExtendActions<TActions, Action.CLEAR_ALL, false>> {
		this.actions.push({
			action: Action.CLEAR_ALL,
			args: encodeAbiParameters(
				[{ type: 'address', name: 'token' }],
				[token.address],
			),
			metadata: token,
		} satisfies ActionElement<ActionOrFailable<Action.CLEAR_ALL>>)
		return this as unknown as VifRouterActionsBuilder<
			ExtendActions<TActions, Action.CLEAR_ALL, false>
		>
	}

	/**
	 * Adds a clear all up to or claim action
	 * @param params - Parameters for clearing
	 * @returns Updated VifRouterActionsBuilder instance
	 */
	clearAllUptoOrClaim<TCanFail extends boolean = false>({
		amount,
		receiver,
		canFail,
	}: ClearAllUptoParams<TCanFail>): VifRouterActionsBuilder<
		ExtendActions<TActions, Action.CLEAR_UPTO_OR_CLAIM, TCanFail>
	> {
		this.actions.push({
			action: canFail
				? Action.FAILABLE_CLEAR_UPTO_OR_CLAIM
				: Action.CLEAR_UPTO_OR_CLAIM,
			args: encodeAbiParameters(
				[
					{ type: 'address', name: 'token' },
					{ type: 'uint256', name: 'amount' },
					{ type: 'address', name: 'receiver' },
				],
				[amount.token.address, amount.amount, receiver],
			),
			metadata: amount.token,
		} satisfies ActionElement<ActionOrFailable<Action.CLEAR_UPTO_OR_CLAIM>>)
		return this as unknown as VifRouterActionsBuilder<
			ExtendActions<TActions, Action.CLEAR_UPTO_OR_CLAIM, TCanFail>
		>
	}

	build(): VifRouterActions<TActions> {
		return new VifRouterActions(this.router, this.actions)
	}
}
