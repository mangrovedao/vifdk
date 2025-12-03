import { zeroAddress } from 'viem'
import { OFFER_AMOUNT_BITS } from './constants'
import { BA, type SemiMarket } from './market'
import { Tick } from './tick'
import { Token, type TokenAmount } from './token'
import { BitsOverflowError, checkFitsWithin } from './utils'

/**
 * The data of an offer
 * @dev This data is raw and does not contain the offer id nor the owner address
 */
export type RawOfferData = {
	/** The previous offer id in the linked list */
	prev: number
	/** The next offer id in the linked list */
	next: number
	/** The expiry date of the offer (undefined if no expiry) */
	expiry: Date | undefined
	/** The amount of tokens given (expressed in the outbound token units) */
	gives: bigint
	/** The amount of tokens received (expressed in the inbound token units) */
	received: bigint
	/** The tick of the offer */
	tick: bigint
	/** The provision of the offer (expressed in provision token units) */
	provision: bigint
	/** Whether the offer is active */
	isActive: boolean
}

/**
 * The data of an offer
 * @dev This data does not contain the offer id nor the owner address
 */
export type OfferData = {
	/** The previous offer id in the linked list */
	prev: number
	/** The next offer id in the linked list */
	next: number
	/** The expiry date of the offer (undefined if no expiry) */
	expiry?: Date | undefined
	/** The amount of tokens given (expressed in the outbound token) */
	gives: TokenAmount
	/** The amount of tokens received (expressed in the inbound token) */
	received: TokenAmount
	/** The tick of the offer */
	tick: Tick
	/** The provision of the offer (expressed in wei) */
	provision: TokenAmount
	/** Whether the offer is active */
	isActive: boolean
}

/**
 * Thrown when an offer amount is out of range
 */
export class OfferAmountOverflowError extends BitsOverflowError {
	constructor(amount: bigint, label: string = 'offer amount') {
		super(OFFER_AMOUNT_BITS, amount, label)
	}
}

/**
 * An offer
 */
export class Offer {
	private constructor(
		/** The market attached to the offer */
		public market: SemiMarket,
		/** The offer data */
		public data: OfferData,
		/** The owner of the offer */
		public owner: `0x${string}`,
		/** The id of the offer */
		public id: number,
	) {
		if (!Offer.checkOfferAmount(data.gives.amount / data.gives.token.unit)) {
			throw new OfferAmountOverflowError(
				data.gives.amount / data.gives.token.unit,
				'gives',
			)
		}
		if (
			!Offer.checkOfferAmount(data.received.amount / data.received.token.unit)
		) {
			throw new OfferAmountOverflowError(
				data.received.amount / data.received.token.unit,
				'received',
			)
		}
	}

	/**
	 * Constructs an offer from data
	 * @param market - The market attached to the offer
	 * @param data - The offer data
	 * @param id - The id of the offer
	 * @param owner - The owner of the offer
	 * @throws {OfferAmountOverflowError} If the gives or received amount is out of range
	 * @returns The offer
	 */
	static fromData(
		market: SemiMarket,
		data: OfferData,
		id = 0,
		owner: `0x${string}` = zeroAddress,
	): Offer {
		return new Offer(market, data, owner, id)
	}

	/**
	 * Constructs an offer from a packed bigint
	 * @param packed - The packed bigint
	 * @param id - The id of the offer
	 * @param owner - The owner of the offer
	 * @throws {OfferAmountOverflowError} If the gives or received amount is out of range
	 * @returns The offer
	 */
	static fromPacked(
		market: SemiMarket,
		packed: bigint,
		id = 0,
		owner: `0x${string}` = zeroAddress,
	): Offer {
		const data = unpackOffer(packed)
		return new Offer(
			market,
			{
				...data,
				gives: market.outboundToken.token.amount(
					data.gives * market.outboundToken.token.unit,
				),
				received: market.inboundToken.token.amount(
					data.received * market.inboundToken.token.unit,
				),
				tick: Tick.fromValue(data.tick, market.market.tickSpacing),
				provision: Token.PROVISION_TOKEN.amount(
					data.provision * Token.PROVISION_TOKEN.unit,
				),
			},
			owner,
			id,
		)
	}

	/**
	 * Checks if an amount is in range
	 * @param amount - The amount to check
	 * @returns True if the amount is in range, false otherwise
	 */
	static checkOfferAmount(amount: bigint): boolean {
		return checkFitsWithin(amount, OFFER_AMOUNT_BITS)
	}

	toString(): string {
		const fields = {
			id: this.id,
			owner: this.owner,
			expiry: this.data.expiry,
			gives: this.data.gives,
			received: this.data.received,
			tick: this.data.tick.toString(
				this.market.market.priceMultiplier,
				this.market.ba === BA.BIDS,
			),
			provision: this.data.provision,
			isActive: this.data.isActive,
		}
		return `Offer(\n${Object.entries(fields)
			.map(([key, value]) => `\t${key}: ${value}`)
			.join('\n')}\n)`
	}
}

const _PREV_MASK = 0xffffffffffn // 5 bytes
const _NEXT_MASK = 0xffffffffffn // 5 bytes
const _EXPIRY_MASK = 0xffffffffn // 4 bytes
const _GIVES_MASK = 0xffffffffffffn // 6 bytes
const _RECEIVED_MASK = 0xffffffffffffn // 6 bytes
const _TICK_MASK = 0xffffffn // 3 bytes
const _PROVISION_MASK = 0x7fffffn // 3 bytes - 1 bit
const _IS_ACTIVE_MASK = 0x01n // 1 bit

const _PREV_SHIFT = 0xd8n
const _NEXT_SHIFT = 0xb0n
const _EXPIRY_SHIFT = 0x90n
const _GIVES_SHIFT = 0x60n
const _RECEIVED_SHIFT = 0x30n
const _TICK_SHIFT = 0x18n
const _PROVISION_SHIFT = 0x01n
const _IS_ACTIVE_SHIFT = 0x00n

/**
 * Unpacks an offer from a bigint representation (256 bits)
 * @param offer - The offer to unpack
 * @returns The offer data
 */
export function unpackOffer(offer: bigint): RawOfferData {
	const expiry = (offer >> _EXPIRY_SHIFT) & _EXPIRY_MASK

	return {
		prev: Number((offer >> _PREV_SHIFT) & _PREV_MASK),
		next: Number((offer >> _NEXT_SHIFT) & _NEXT_MASK),
		expiry: expiry === 0n ? undefined : new Date(Number(expiry) * 1000),
		gives: (offer >> _GIVES_SHIFT) & _GIVES_MASK,
		received: (offer >> _RECEIVED_SHIFT) & _RECEIVED_MASK,
		tick: BigInt.asIntN(24, (offer >> _TICK_SHIFT) & _TICK_MASK),
		provision: (offer >> _PROVISION_SHIFT) & _PROVISION_MASK,
		isActive:
			((offer >> _IS_ACTIVE_SHIFT) & _IS_ACTIVE_MASK) === _IS_ACTIVE_MASK,
	}
}
