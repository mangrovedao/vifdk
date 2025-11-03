import type { OrderResult } from '../router/actions/types'
import type { SemiMarket } from './market'
import { simulate } from './simulation'
import { Tick } from './tick'
import type { TokenAmount } from './token'

/** The raw data of an element of the book */
export type RawBookElement = {
	/** The head offer id */
	head: number
	/** The tail offer id */
	tail: number
	/** The number of offers */
	offerCount: number
	/** The total amount of tokens given (expressed in the outbound token units) */
	totalGives: bigint
	/** The index of the offer list */
	index: number
}

/** Represents an element of the book */
export type BookElement = {
	/** The head offer id */
	head: number
	/** The tail offer id */
	tail: number
	/** The number of offers */
	offerCount: number
	/** The total amount of tokens given (expressed in the outbound token units) */
	totalGives: TokenAmount
	/** The index of the offer list */
	tick: Tick
}

/** Represents a book (price points without offer details) */
export class Book {
	constructor(
		/** The elements of the book */
		public elements: BookElement[],
		/** The semi market attached to the book */
		public readonly market: SemiMarket,
	) {}

	/**
	 * Creates a book from packed elements
	 * @param market - The semi market attached to the book
	 * @param packed - The packed book elements
	 * @returns The book
	 * @dev This function creates a book from packed elements
	 * @example
	 * const elements = await client.readContract({
	 * 	address: config.VifReader,
	 * 	...packedBook(market.asks),
	 * })
	 * const book = Book.fromPacked(market.asks, elements)
	 */
	static fromPacked(
		market: SemiMarket,
		packed: bigint[] | readonly bigint[],
	): Book {
		const book = new Book([], market)
		book.setElementsFromPacked(packed)
		return book
	}

	/**
	 * Sets the elements of the book from packed elements
	 * @param packed - The packed book elements
	 */
	setElementsFromPacked(packed: bigint[] | readonly bigint[]): void {
		this.elements = packed
			.map(unpackOfferListElement)
			.sort((a, b) => a.index - b.index)
			.map<BookElement>((e) => ({
				...e,
				totalGives: this.market.outboundToken.amount(
					e.totalGives * this.market.outboundToken.unit,
				),
				tick: Tick.fromIndex(e.index, this.market.market.tickSpacing),
			}))
	}

	/**
	 * Performs a gross simulation of a book
	 * @param amount - The amount to simulate
	 * @param maxTick - The maximum tick to simulate
	 * @returns The gross simulation result
	 * @dev The simulation is not exact since it is performed on the partial offer lists
	 * @dev for a complete simulation, the simulation should be performed agains the offer list instead.
	 */
	grossSimulation(amount: TokenAmount, maxTick?: Tick): OrderResult {
		return simulate({
			market: this.market,
			amount,
			offers: this.elements.map((element) => ({
				gives: element.totalGives,
				tick: element.tick,
			})),
			maxTick,
		})
	}
}

const HEAD_MASK = 0xffffffffffn // 5 bytes
const TAIL_MASK = 0xffffffffffn // 5 bytes
const OFFER_COUNT_MASK = 0xffffffffffn // 5 bytes
const TOTAL_GIVES_MASK = 0xffffffffffffffffn // 8 bytes
const INDEX_MASK = 0xffffffn // 3 bytes

const INDEX_SHIFT = 0xb8n
const HEAD_SHIFT = 0x90n
const TAIL_SHIFT = 0x68n
const OFFER_COUNT_SHIFT = 0x40n
const TOTAL_GIVES_SHIFT = 0x00n

/**
 * Unpacks an offer list from a bigint representation (256 bits)
 * @param offerList - The offer list to unpack
 * @returns The offer list data
 */
export function unpackOfferListElement(offerList: bigint): RawBookElement {
	return {
		head: Number((offerList >> HEAD_SHIFT) & HEAD_MASK),
		tail: Number((offerList >> TAIL_SHIFT) & TAIL_MASK),
		offerCount: Number((offerList >> OFFER_COUNT_SHIFT) & OFFER_COUNT_MASK),
		totalGives: (offerList >> TOTAL_GIVES_SHIFT) & TOTAL_GIVES_MASK,
		index: Number((offerList >> INDEX_SHIFT) & INDEX_MASK),
	}
}
