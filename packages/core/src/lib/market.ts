import {
	type ContractFunctionReturnType,
	encodeAbiParameters,
	type Hex,
	isAddressEqual,
	keccak256,
} from 'viem'
import type { OPEN_MARKETS_ABI } from '../builder/reader/open-markets'
import { InvalidTokenError } from '../router/actions/errors'
import { FEES_BITS, MAX_TICK_SPACING, MIN_TICK_SPACING } from './constants'
import { Tick } from './tick'
import { Token, type TokenAmount } from './token'
import { BitsOverflowError, checkFitsWithin } from './utils'

/**
 * Thrown when a tick spacing is out of range
 */
export class TickSpacingOverflowError extends RangeError {
	constructor(tickSpacing: bigint) {
		super(
			`Tick spacing ${tickSpacing} is out of range [${MIN_TICK_SPACING}, ${MAX_TICK_SPACING}]`,
		)
	}
}

/**
 * Thrown when fees are out of range
 */
export class FeesOverflowError extends BitsOverflowError {
	constructor(fees: number) {
		super(FEES_BITS, BigInt(fees), 'Fees')
	}
}

/**
 * Thrown when the max amount is lower than the amount
 */
export class MaxAmountLowerThanAmountError extends RangeError {
	constructor(maxAmount: TokenAmount, amount: TokenAmount) {
		super(`Max amount ${maxAmount} is lower than amount ${amount}`)
	}
}

export enum BA {
	ASKS = 'asks',
	BIDS = 'bids',
}

/**
 * Params for the creation of a market
 */
export type CreateMarketArg = {
	/** Base token or base token amount representing the min amount to create an offer */
	base: Token | TokenAmount
	/** Quote token or quote token amount representing the min amount to create an offer */
	quote: Token | TokenAmount
	/** Spacing between 2 consecutive price points */
	tickSpacing: bigint
	/** Fees of the ask market */
	askFees?: number
	/** Fees of the bid market */
	bidsFees?: number
}

/** Result of the openMarkets function */
export type OpenMarketResult = ContractFunctionReturnType<
	typeof OPEN_MARKETS_ABI,
	'view',
	'openMarkets'
>[number]

/** Represents a market */
export class Market {
	/** The fee denominator */
	static readonly FEE_DENOMINATOR = 1_000_000n

	/** The asks semi market (makers sell base, takers buy base) */
	public readonly asks: SemiMarket
	/** The bids semi market (makers buy base, takers sell base) */
	public readonly bids: SemiMarket

	/** The key for the asks semi market */
	private _asksKey: Hex | null = null
	/** The key for the bids semi market */
	private _bidsKey: Hex | null = null

	/** The ask fees for the market */
	private _askFees: number | undefined = undefined
	/** The bid fees for the market */
	private _bidsFees: number | undefined = undefined

	/** The ask fees for the market */
	get askFees(): number | undefined {
		return this._askFees
	}

	/** The ask fees for the market */
	set askFees(fees: number | undefined) {
		if (fees && !Market.checkFees(fees)) {
			throw new FeesOverflowError(fees)
		}
		this._askFees = fees
	}

	/**
	 * The bids fees for the market */
	get bidsFees(): number | undefined {
		return this._bidsFees
	}

	/**
	 * The bids fees for the market */
	set bidsFees(fees: number | undefined) {
		if (fees && !Market.checkFees(fees)) {
			throw new FeesOverflowError(fees)
		}
		this._bidsFees = fees
	}

	/**
	 * The asks key
	 * @returns The asks key
	 */
	get asksKey(): Hex {
		if (this._asksKey) {
			return this._asksKey
		}
		this._asksKey = keccak256(
			encodeAbiParameters(
				[
					{ type: 'address' },
					{ type: 'uint256' },
					{ type: 'address' },
					{ type: 'uint256' },
					{ type: 'uint256' },
				],
				[
					this.base.token.address,
					this.base.token.unit,
					this.quote.token.address,
					this.quote.token.unit,
					this.tickSpacing,
				],
			),
		)
		return this._asksKey
	}

	/**
	 * The bids key
	 * @returns The bids key
	 */
	get bidsKey(): Hex {
		if (this._bidsKey) {
			return this._bidsKey
		}
		this._bidsKey = keccak256(
			encodeAbiParameters(
				[
					{ type: 'address' },
					{ type: 'uint256' },
					{ type: 'address' },
					{ type: 'uint256' },
					{ type: 'uint256' },
				],
				[
					this.quote.token.address,
					this.quote.token.unit,
					this.base.token.address,
					this.base.token.unit,
					this.tickSpacing,
				],
			),
		)
		return this._bidsKey
	}

	private constructor(
		/** The base token with min volume (defaults to 1) */
		public readonly base: TokenAmount,
		/** The quote token with min volume (defaults to 1) */
		public readonly quote: TokenAmount,
		/** The tick spacing */
		public readonly tickSpacing: bigint,
	) {
		if (!Market.checkTickSpacing(tickSpacing)) {
			throw new TickSpacingOverflowError(tickSpacing)
		}
		this.asks = new SemiMarket(BA.ASKS, this)
		this.bids = new SemiMarket(BA.BIDS, this)
	}

	/**
	 * Checks if a tick spacing is in range
	 * @param tickSpacing - The tick spacing to check
	 * @returns True if the tick spacing is in range, false otherwise
	 */
	static checkTickSpacing(tickSpacing: bigint): boolean {
		return tickSpacing >= MIN_TICK_SPACING && tickSpacing <= MAX_TICK_SPACING
	}

	/**
	 * Checks if fees are in range
	 * @param fees - The fees to check
	 * @returns True if the fees are in range, false otherwise
	 */
	static checkFees(fees: number): boolean {
		return checkFitsWithin(BigInt(fees), FEES_BITS)
	}

	/**
	 * Creates a single market
	 * @param params - Params for the creation of a market
	 * @returns The market
	 */
	private static _createSingle({
		base,
		quote,
		tickSpacing,
		askFees,
		bidsFees,
	}: CreateMarketArg): Market {
		if (base instanceof Token) {
			base = base.amount(base.unit)
		}
		if (quote instanceof Token) {
			quote = quote.amount(quote.unit)
		}
		const market = new Market(base, quote, tickSpacing)
		if (askFees !== undefined) market.askFees = askFees
		if (bidsFees !== undefined) market.bidsFees = bidsFees
		return market
	}

	/**
	 * Creates a single or multiple markets
	 * @param params - Params for the creation of either one market or multiple markets
	 * @returns The market
	 * @dev This function creates a single or multiple markets
	 * @example
	 * const market = Market.create({
	 * 	base: Token.from(zeroAddress, 18, "ETH", 1n),
	 * 	quote: Token.from(zeroAddress, 18, "USDC", 1n),
	 * 	tickSpacing: 100n,
	 * 	askFees: 1000,
	 * 	bidsFees: 1000,
	 * })
	 */
	static create<
		TArgs extends CreateMarketArg | CreateMarketArg[] =
			| CreateMarketArg
			| CreateMarketArg[],
	>(params: TArgs): TArgs extends CreateMarketArg[] ? Market[] : Market {
		if (Array.isArray(params)) {
			return params.map(Market._createSingle) as TArgs extends CreateMarketArg[]
				? Market[]
				: Market
		}
		return Market._createSingle(params) as TArgs extends CreateMarketArg[]
			? Market[]
			: Market
	}

	/**
	 * Creates a market from an open market result
	 * @param result - The open market result
	 * @param tokens
	 * - The tokens to create the market from
	 * - These tokens should be ordered by descending cashness (stable tokens first, tokens with higher volatility last)
	 * @returns The market or undefined if the tokens are not found
	 * @example
	 * const markets = await client.readContract({
	 * 	address: config.VifReader,
	 * 	...openMarkets(),
	 * })
	 * const markets = Market.fromOpenMarketResult(markets, tokens)
	 * })
	 */
	static fromOpenMarketResult(
		result: OpenMarketResult,
		tokens: Token[],
	): Market | undefined {
		const index0 = tokens.findIndex((token) =>
			isAddressEqual(token.address, result.market01.outboundToken),
		)
		const index1 = tokens.findIndex((token) =>
			isAddressEqual(token.address, result.market01.inboundToken),
		)
		if (index0 === -1 || index1 === -1) {
			return undefined
		}
		const isReversed = index0 > index1

		// biome-ignore lint/style/noNonNullAssertion: we know the tokens are in the array
		const token0 = tokens[index0]!.withUnit(result.market01.outboundUnits)
		// biome-ignore lint/style/noNonNullAssertion: we know the tokens are in the array
		const token1 = tokens[index1]!.withUnit(result.market01.inboundUnits)

		return Market.create(
			isReversed
				? {
						base: token1,
						quote: token0,
						tickSpacing: BigInt(result.market01.tickSpacing),
						askFees: result.market10.fees,
						bidsFees: result.market01.fees,
					}
				: {
						base: token0,
						quote: token1,
						tickSpacing: BigInt(result.market01.tickSpacing),
						askFees: result.market01.fees,
						bidsFees: result.market10.fees,
					},
		)
	}

	/**
	 * Converts a price to an ask tick
	 * @param price - The price to convert
	 * @returns The ask tick
	 */
	askPrice(price: number): Tick {
		price = price / this.priceMultiplier
		return Tick.fromPrice(price, true, this.tickSpacing)
	}

	/**
	 * Converts a price to a bid tick
	 * @param price - The price to convert
	 * @returns The bid tick
	 */
	bidPrice(price: number): Tick {
		price = (1 / price) * this.priceMultiplier
		return Tick.fromPrice(price, true, this.tickSpacing)
	}

	/**
	 * Computes the fees for a token amount
	 * @param feeToken - The token to compute the fees for
	 * @param amount - The amount to compute the fees for
	 * @param fees - The fees to compute
	 * @param maxAmount - The maximum amount that can be spent (fees will be truncated to this amount)
	 * @returns The fees for the token amount
	 */
	private static _computeFees(
		feeToken: Token,
		amount: TokenAmount,
		fees: number,
		maxAmount?: TokenAmount,
	): TokenAmount {
		if (
			!isAddressEqual(amount.token.address, feeToken.address) ||
			(maxAmount && !isAddressEqual(maxAmount.token.address, feeToken.address))
		) {
			throw new InvalidTokenError(amount.token, [feeToken])
		}
		let computedFees =
			(amount.amount * BigInt(fees)) / (Market.FEE_DENOMINATOR - BigInt(fees))
		if (maxAmount) {
			// ensure non-negative fees
			if (maxAmount.amount < amount.amount) {
				throw new MaxAmountLowerThanAmountError(maxAmount, amount)
			}
			const maxFees = maxAmount.amount - amount.amount
			computedFees = maxFees < computedFees ? maxFees : computedFees
		}
		return feeToken.withUnit(1n).amount(computedFees)
	}

	/**
	 * Computes the fees for an ask market order
	 * @param amount - The amount to compute the fees for
	 * @param maxAmount - The maximum amount that can be spent (fees will be truncated to this amount)
	 * @returns The fees for the ask market order
	 */
	computeAskFees(amount: TokenAmount, maxAmount?: TokenAmount): TokenAmount {
		return Market._computeFees(
			this.quote.token,
			amount,
			this.askFees ?? 0,
			maxAmount,
		)
	}

	/**
	 * Computes the fees for a bid market order
	 * @param amount - The amount to compute the fees for
	 * @param maxAmount - The maximum amount that can be spent (fees will be truncated to this amount)
	 * @returns The fees for the bid market order
	 */
	computeBidFees(amount: TokenAmount, maxAmount?: TokenAmount): TokenAmount {
		return Market._computeFees(
			this.base.token,
			amount,
			this.bidsFees ?? 0,
			maxAmount,
		)
	}

	/**
	 * Excludes the fees from the given amount
	 * @param amount - The amount to exclude the fees from
	 * @param feeToken - The token to exclude the fees from
	 * @param fees - The fees to exclude
	 * @returns The amount that excluded the fees from the given amount
	 */
	private static _excludingFees(
		amount: TokenAmount,
		feeToken: Token,
		fees: number,
	): TokenAmount {
		if (!isAddressEqual(amount.token.address, feeToken.address)) {
			throw new InvalidTokenError(amount.token, [feeToken])
		}
		const result = amount.copy()
		result.normalizedAmount =
			(amount.normalizedAmount * (Market.FEE_DENOMINATOR - BigInt(fees))) /
			Market.FEE_DENOMINATOR
		return result
	}

	/**
	 * Returns the amount that excluded the fees from the given amount
	 * @param amount - The amount to exclude the fees from
	 * @returns The amount that excluded the fees from the given amount
	 */
	excludingAskFees(amount: TokenAmount): TokenAmount {
		return Market._excludingFees(amount, this.quote.token, this.askFees ?? 0)
	}

	/**
	 * Returns the amount that excluded the fees from the given amount
	 * @param amount - The amount to exclude the fees from
	 * @returns The amount that excluded the fees from the given amount
	 */
	excludingBidFees(amount: TokenAmount): TokenAmount {
		return Market._excludingFees(amount, this.base.token, this.bidsFees ?? 0)
	}

	/**
	 * Returns the price multiplier to go from raw price to human price
	 * @returns The price multiplier to go from raw price to human price
	 */
	public get priceMultiplier(): number {
		return 10 ** (this.base.token.decimals - this.quote.token.decimals)
	}
}

export class SemiMarket {
	/**
	 * The key for the semi market
	 * @returns The key for the semi market
	 */
	get key(): Hex {
		return this.ba === BA.ASKS ? this.market.asksKey : this.market.bidsKey
	}

	/**
	 * The outbound token on the semi market
	 * @dev In the context of a market order, this is the bought token
	 * @returns The outbound token on the semi market
	 */
	get outboundToken(): TokenAmount {
		return this.ba === BA.ASKS ? this.market.base : this.market.quote
	}

	/**
	 * The inbound token on the semi market
	 * @dev In the context of a market order, this is the sold token
	 * @returns The inbound token on the semi market
	 */
	get inboundToken(): TokenAmount {
		return this.ba === BA.ASKS ? this.market.quote : this.market.base
	}

	constructor(
		public readonly ba: BA,
		public readonly market: Market,
	) {}

	/**
	 * Gets the price for the semi market
	 * @param price - The price to convert
	 * @returns The price for the semi market
	 */
	price(price: number): Tick {
		return this.ba === BA.ASKS
			? this.market.askPrice(price)
			: this.market.bidPrice(price)
	}

	/**
	 * Computes the fees for a market order
	 * @param amount - The amount to compute the fees for
	 * @param maxAmount - The maximum amount that can be spent (fees will be truncated to this amount)
	 * @returns The fees for the ask market order
	 */
	computeFees(amount: TokenAmount, maxAmount?: TokenAmount): TokenAmount {
		return this.ba === BA.ASKS
			? this.market.computeAskFees(amount, maxAmount)
			: this.market.computeBidFees(amount, maxAmount)
	}

	/**
	 * Returns the amount that excluded the fees from the given amount
	 * @param amount - The amount to exclude the fees from
	 * @returns The amount that excluded the fees from the given amount
	 */
	excludingFees(amount: TokenAmount): TokenAmount {
		return this.ba === BA.ASKS
			? this.market.excludingAskFees(amount)
			: this.market.excludingBidFees(amount)
	}
}
