import {
	type Address,
	formatUnits,
	isAddressEqual,
	parseUnits,
	zeroAddress,
} from 'viem'
import { UNITS_BITS } from './constants'
import { BitsOverflowError, checkFitsWithin } from './utils'

/**
 * Thrown when a token amount is out of range
 */
export class TokenAmountOverflowError extends BitsOverflowError {
	constructor(amount: bigint) {
		super(256, amount, 'Token amount')
	}
}

/**
 * Thrown when a unit is out of range
 */
export class UnitOverflowError extends BitsOverflowError {
	constructor(unit: bigint, label: string = 'unit') {
		super(UNITS_BITS, unit, label)
	}
}

/**
 * Represents an amount of a token
 */
export class TokenAmount {
	/**
	 * The amount of the token in the smallest unit
	 */
	get amount(): bigint {
		return this._amount
	}

	/**
	 * The amount of the token in the smallest unit
	 */
	set amount(amount: bigint) {
		if (!checkFitsWithin(amount, 256)) {
			throw new TokenAmountOverflowError(amount)
		}
		this._amount = amount - (amount % this.token.unit)
	}

	/**
	 * The amount of the token in the smallest unit
	 */
	get normalizedAmount(): bigint {
		return this._amount / this.token.unit
	}

	/**
	 * The amount of the token in the smallest unit
	 */
	set normalizedAmount(amount: bigint) {
		this.amount = amount * this.token.unit
	}

	/**
	 * The amount of the token formatted as a string
	 */
	get amountString(): string {
		return formatUnits(this._amount, this.token.decimals)
	}

	/**
	 * The amount of the token formatted as a string
	 */
	set amountString(amount: string) {
		this.amount = parseUnits(amount, this.token.decimals)
	}

	private constructor(
		private _amount: bigint,
		public readonly token: Token,
	) {
		this.amount = _amount
	}

	/**
	 * Creates a token amount from a string or bigint
	 * @param amount - The amount to create
	 * @param token - The token to create
	 * @returns The token amount
	 * @dev passing a string will parse the amount with the token's decimals
	 * @dev passing a bigint will use the bigint as is
	 */
	static from(amount: string | bigint, token: Token): TokenAmount {
		return new TokenAmount(
			typeof amount === 'string' ? parseUnits(amount, token.decimals) : amount,
			token,
		)
	}

	copy(): TokenAmount {
		return new TokenAmount(this._amount, this.token)
	}

	toString(): string {
		return `TokenAmount(${this.amountString} ${this.token.symbol})`
	}
}

/**
 * Represents a token
 */
export class Token {
	/**
	 * The native token
	 * @dev If the the native token is different or has a different units, you can override it
	 * @dev The zero address is always the native token address
	 * @dev You can use any token definition as long as the correct unit is passed (defaults to wei)
	 * @dev and as long as the address is zero
	 * @example
	 * Token.NATIVE_TOKEN = Token.from(zeroAddress, 18, "ETH", 1n);
	 */
	static NATIVE_TOKEN: Token = Token.from(zeroAddress, 18, 'ETH', 1n)

	/**
	 * The provision token
	 * @dev If the the provision token is different or has a different units, you can override it
	 * @dev The zero address is always the native token address
	 * @dev You can use any token definition as long as the correct unit is passed (defaults to gwei)
	 * @dev and as long as the address is zero
	 * @example
	 * Token.PROVISION_TOKEN = Token.from(zeroAddress, 18, "ETH", 10n ** 9n);
	 */
	static PROVISION_TOKEN: Token = Token.NATIVE_TOKEN.withUnit(10n ** 9n)

	private constructor(
		public readonly address: Address,
		public readonly decimals: number,
		public readonly symbol: string,
		public readonly unit: bigint,
	) {
		if (!checkFitsWithin(unit, UNITS_BITS)) {
			throw new UnitOverflowError(unit)
		}
	}

	/**
	 * Creates a token from an address, decimals, and symbol
	 * @param address - The address of the token
	 * @param decimals - The number of decimals of the token
	 * @param symbol - The symbol of the token
	 * @param unit - The unit of the token
	 * @returns The token
	 */
	static from(
		address: Address,
		decimals: number,
		symbol: string,
		unit: bigint = 1n,
	): Token {
		return new Token(address, decimals, symbol, unit)
	}

	/**
	 * Creates a token amount from a string or bigint
	 * @param amount - The amount to create
	 * @returns The token amount
	 * @dev passing a string will parse the amount with the token's decimals
	 * @dev passing a bigint will use the bigint as is
	 * @example
	 * const token = Token.from(USDC_ADDRESS, 6, "USDC");
	 * const amount = token.amount("1");
	 * //      ^ parsed as 1,000,000
	 * const amount2 = token.amount(1_000_000n);
	 * //      ^ parsed as 1,000,000
	 */
	amount(amount: string | bigint): TokenAmount {
		return TokenAmount.from(amount, this)
	}

	/**
	 * Checks if the token is equal to another token
	 * @param other - The other token
	 * @returns True if the tokens are equal, false otherwise
	 */
	equals(other: Token): boolean {
		return (
			isAddressEqual(this.address, other.address) &&
			this.decimals === other.decimals &&
			this.symbol === other.symbol &&
			this.unit === other.unit
		)
	}

	/**
	 * Creates a new token with the same properties but a different unit
	 * @param unit - The unit to create the token with
	 * @returns The new token
	 */
	withUnit(unit: bigint): Token {
		return new Token(this.address, this.decimals, this.symbol, unit)
	}
}
