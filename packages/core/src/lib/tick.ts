import { MAX_TICK, MIN_TICK } from './constants'
import { Market, TickSpacingOverflowError } from './market'
import { Offer, OfferAmountOverflowError } from './offer'
import type { Token, TokenAmount } from './token'
import { divUp } from './utils'

/**
 * Thrown when a tick is out of range
 */
export class TickOverflowError extends RangeError {
	constructor(tick: bigint) {
		super(`Tick ${tick} is out of range [${MIN_TICK}, ${MAX_TICK}]`)
	}
}

export class PriceOverflowError extends RangeError {
	constructor(price: number) {
		super(`Price ${price} is out of range [0, Infinity[`)
	}
}

export class Tick {
	/** The memoized price map */
	private static memoizedPrice: Map<bigint, bigint> = new Map()

	/** The tick */
	private _tick: bigint

	/**
	 * The value of the tick
	 */
	get value(): bigint {
		return this._tick
	}

	/**
	 * The value of the tick
	 */
	set value(tick: bigint) {
		tick = this.tickSpacing * (tick / this.tickSpacing)
		if (!Tick.checkTick(tick)) {
			throw new TickOverflowError(tick)
		}
		this._tick = tick
	}

	/**
	 * The price of the tick
	 * @dev This is memoized to avoid recalculating the price for the same tick
	 */
	get price(): bigint {
		const memoized = Tick.memoizedPrice.get(this._tick)
		if (memoized) {
			return memoized
		}
		const price = tickToPrice(this._tick)
		Tick.memoizedPrice.set(this._tick, price)
		return price
	}

	/**
	 * Constructs a tick
	 * @param tick - The tick to construct
	 */
	private constructor(
		tick: bigint,
		public readonly tickSpacing: bigint = 1n,
	) {
		if (!Market.checkTickSpacing(tickSpacing)) {
			throw new TickSpacingOverflowError(tickSpacing)
		}
		// set a default value
		this._tick = 0n
		this.value = tick
	}

	/**
	 * Converts an outbound amount to an inbound amount
	 * @param outbound - The outbound amount to convert
	 * @param inbound - The inbound token
	 * @returns The inbound amount as a token amount
	 * @throws {OfferAmountOverflowError} If the outbound amount is out of range
	 * @throws {UnitOverflowError} If the outbound unit is out of range
	 * @throws {UnitOverflowError} If the inbound unit is out of range
	 * @throws {OfferAmountOverflowError} If the inbound amount is out of range
	 */
	inboundFromOutbound(outbound: TokenAmount, inbound: Token): TokenAmount {
		const result = inbound.amount(0n)
		result.normalizedAmount = inboundFromOutbound(
			this.price,
			outbound.normalizedAmount,
			outbound.token.unit,
			inbound.unit,
		)
		return result
	}

	/**
	 * Constructs a tick from a value
	 * @param tick - The tick to construct
	 * @param tickSpacing - The tick spacing
	 * @throws {TickOverflowError} If the tick is out of range
	 * @throws {TickSpacingOverflowError} If the tick spacing is out of range
	 * @returns The tick
	 * @dev the tick will be mutated if it does not respect `tick % tickSpacing === 0`
	 */
	static fromValue(tick: bigint, tickSpacing: bigint = 1n): Tick {
		return new Tick(tick, tickSpacing)
	}

	/**
	 * Constructs a tick from an index
	 * @param index - The index to construct (0 is the minimum tick)
	 * @param tickSpacing - The tick spacing
	 * @throws {TickOverflowError} If the tick is out of range
	 * @throws {TickSpacingOverflowError} If the tick spacing is out of ranges
	 * @returns The tick
	 */
	static fromIndex(index: number, tickSpacing: bigint = 1n): Tick {
		return Tick.fromValue(
			(BigInt(index) - MAX_TICK / tickSpacing) * tickSpacing,
			tickSpacing,
		)
	}

	/**
	 * Checks if a tick is in range
	 * @param tick - The tick to check
	 * @returns True if the tick is in range, false otherwise
	 */
	static checkTick(tick: bigint): boolean {
		return tick >= MIN_TICK && tick <= MAX_TICK
	}

	/**
	 * Constructs the maximum tick
	 * @param tickSpacing - The tick spacing
	 * @returns The maximum tick
	 */
	static MAX_TICK(tickSpacing: bigint = 1n): Tick {
		return new Tick(MAX_TICK, tickSpacing)
	}

	/**
	 * Constructs the minimum tick
	 * @param tickSpacing - The tick spacing
	 * @returns The minimum tick
	 */
	static MIN_TICK(tickSpacing: bigint = 1n): Tick {
		return new Tick(MIN_TICK, tickSpacing)
	}

	/**
	 * Converts a price to a tick
	 * @param price - The price to convert (JS floating point)
	 * @param roundUp - Whether to round up to the nearest tick
	 * @param tickSpacing - The tick spacing
	 * @returns The tick as a bigint
	 * @throws {TickOverflowError} If the tick is out of range
	 * @throws {TickSpacingOverflowError} If the tick spacing is out of range
	 * @dev This function is an estimation using JS numbers and may not be exact
	 * @dev the tick will be mutated if it does not respect `tick % tickSpacing === 0`
	 * @dev price is the ratio `inbound/outbound`
	 */
	static fromPrice(
		price: number,
		roundUp = true,
		tickSpacing: bigint = 1n,
	): Tick {
		if (price <= 0 || !Number.isFinite(price)) {
			throw new PriceOverflowError(price)
		}
		const tickRaw = Math.log(price) / Math.log(1.00001)
		const rounding = roundUp ? Math.ceil : Math.floor
		const tick = BigInt(rounding(tickRaw))
		return new Tick(tick, tickSpacing)
	}

	/**
	 * Returns the index of the tick
	 * @returns The index of the tick with the given tick spacing
	 * @dev The index 0 is the minimum tick
	 */
	index(): number {
		const val = MAX_TICK / this.tickSpacing + this.value / this.tickSpacing
		return Number(val)
	}

	/**
	 * Returns the string representation of the tick
	 * @param multiplier - The multiplier to apply to the price (to account for decimal offsets)
	 * @param shouldInvert - Whether to invert the price
	 * @returns The string representation of the tick
	 */
	toString(multiplier: number = 1, shouldInvert: boolean = false): string {
		const raw = Number(this.price) / 2 ** 128
		return `Tick(${this.value}, price: ${multiplier * (shouldInvert ? 1 / raw : raw)})`
	}
}

/**
 * Converts a tick to a price
 * @param tick - The tick to convert
 * @returns The price as a fixed point 128.128 number
 * @dev This function is an exact conversion as implemented in the core Vif contract
 * @dev This function assumes the tick is in range
 */
export function tickToPrice(tick: bigint): bigint {
	const absTick = tick < 0n ? -tick : tick

	let price = 0x100000000000000000000000000000000n

	if ((absTick & 0x1n) !== 0n) price = 0xffff583ac1ac1c114b9160ddeb4791b7n
	if ((absTick & 0x2n) !== 0n)
		price = (price * 0xfffeb075f14b276d06cdbc6b138e4c4bn) >> 128n
	if ((absTick & 0x4n) !== 0n)
		price = (price * 0xfffd60ed9a60ebcb383de6edb7557ef0n) >> 128n
	if ((absTick & 0x8n) !== 0n)
		price = (price * 0xfffac1e213e349a0cf1e3d3ec62bf25bn) >> 128n
	if ((absTick & 0x10n) !== 0n)
		price = (price * 0xfff583dfa4044e3dfe90c4057e3e4c27n) >> 128n
	if ((absTick & 0x20n) !== 0n)
		price = (price * 0xffeb082d36bf2958d476ee75c4da258an) >> 128n
	if ((absTick & 0x40n) !== 0n)
		price = (price * 0xffd61212165632bd1dda4c1abdf5f9f1n) >> 128n
	if ((absTick & 0x80n) !== 0n)
		price = (price * 0xffac2b0240039d9cdadb751e0acc14c4n) >> 128n
	if ((absTick & 0x100n) !== 0n)
		price = (price * 0xff5871784dc6fa608dca410bdecb9ff4n) >> 128n
	if ((absTick & 0x200n) !== 0n)
		price = (price * 0xfeb1509bdff34ccb280fad9a309403cfn) >> 128n
	if ((absTick & 0x400n) !== 0n)
		price = (price * 0xfd6456c5e15445b458f4403d279c1a89n) >> 128n
	if ((absTick & 0x800n) !== 0n)
		price = (price * 0xfacf7ad7076227f61d95f764e8d7e35an) >> 128n
	if ((absTick & 0x1000n) !== 0n)
		price = (price * 0xf5b9e413dd1b4e7046f8f721e1f1b295n) >> 128n
	if ((absTick & 0x2000n) !== 0n)
		price = (price * 0xebdd5589751f38fd7adce84988dba856n) >> 128n
	if ((absTick & 0x4000n) !== 0n)
		price = (price * 0xd9501a6728f01c1f121094aacf4c9475n) >> 128n
	if ((absTick & 0x8000n) !== 0n)
		price = (price * 0xb878e5d36699c3a0fd844110d8b9945fn) >> 128n
	if ((absTick & 0x10000n) !== 0n)
		price = (price * 0x84ee037828011d8035f12eb571b46c2an) >> 128n
	if ((absTick & 0x20000n) !== 0n)
		price = (price * 0x450650de5cb791d4a002074d7f179cb3n) >> 128n
	if ((absTick & 0x40000n) !== 0n)
		price = (price * 0x129c67bfc1f3084f1f52dd418a4a8f6dn) >> 128n
	if ((absTick & 0x80000n) !== 0n)
		price = (price * 0x15a5e2593066b11cd1c3ea05eb95f74n) >> 128n
	if ((absTick & 0x100000n) !== 0n)
		price = (price * 0x1d4a2a0310ad5f70ad53ef4d3dcf3n) >> 128n
	if ((absTick & 0x200000n) !== 0n)
		price = (price * 0x359e3010271ed5cfce08f99aan) >> 128n
	if ((absTick & 0x400000n) !== 0n)
		price = (price * 0xb3ae1a60d291e4871n) >> 128n

	if (tick > 0n) {
		return 2n ** 256n / price
	}
	return price
}

/**
 * Converts an outbound amount to an inbound amount
 * @param price - The price to convert
 * @param outbound - The outbound amount to convert
 * @param outboundUnit - The outbound unit
 * @param inboundUnit - The inbound unit
 * @returns The inbound amount as a bigint
 * @throws {OfferAmountOverflowError} If the outbound amount is out of range
 * @throws {UnitOverflowError} If the outbound unit is out of range
 * @throws {UnitOverflowError} If the inbound unit is out of range
 * @throws {OfferAmountOverflowError} If the inbound amount is out of range
 * @dev This function is an exact conversion as implemented in the core Vif contract
 */
export function inboundFromOutbound(
	price: bigint,
	outbound: bigint,
	outboundUnit: bigint,
	inboundUnit: bigint,
): bigint {
	const inbound = divUp(
		divUp(outbound * outboundUnit * price, 2n ** 128n),
		inboundUnit,
	)
	if (!Offer.checkOfferAmount(inbound)) {
		throw new OfferAmountOverflowError(inbound, 'inbound')
	}
	return inbound
}
