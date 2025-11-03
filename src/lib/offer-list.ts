import type { Address } from 'viem'
import type { OrderResult } from '../router/actions/types'
import type { SemiMarket } from './market'
import { Offer } from './offer'
import { simulate } from './simulation'
import type { Tick } from './tick'
import type { TokenAmount } from './token'

export type OfferListSimulationParams = {
	/** The amount to simulate */
	amount: TokenAmount
	/** The maximum tick to simulate */
	maxTick?: Tick | undefined
	/** The date override for the simulation (defaults to the current date) */
	date?: Date | undefined
	/** The global provision for the simulation (i.e. max provision, defaults to 0) */
	provision?: TokenAmount | undefined
}

export class OfferList {
	private constructor(
		/** The offers in the list */
		public offers: Offer[],
		/** The semi market attached to the offer list */
		public readonly market: SemiMarket,
	) {}

	/**
	 * Creates an offer list from a semi market
	 * @param market - The semi market attached to the offer list
	 * @returns The offer list
	 */
	static fromSemiMarket(market: SemiMarket): OfferList {
		return new OfferList([], market)
	}

	/**
	 * Creates an offer list from packed data
	 * @param market - The semi market attached to the offer list
	 * @param offerIds - The offer ids
	 * @param packedOffers - The packed offers
	 * @param owners - The owners of the offers
	 * @returns The offer list
	 */
	static fromPacked(
		market: SemiMarket,
		offerIds: number[] | readonly number[],
		packedOffers: bigint[] | readonly bigint[],
		owners: Address[] | readonly Address[],
	): OfferList {
		const ol = new OfferList([], market)
		ol.setOffersFromPacked(offerIds, packedOffers, owners)
		return ol
	}

	/**
	 * Sets the offers of the offer list from packed data
	 * @param offerIds - The offer ids
	 * @param packedOffers - The packed offers
	 * @param owners - The owners of the offers
	 */
	setOffersFromPacked(
		offerIds: number[] | readonly number[],
		packedOffers: bigint[] | readonly bigint[],
		owners: Address[] | readonly Address[],
	): void {
		this.offers = []
		for (let i = 0; i < offerIds.length; i++) {
			const offerId = offerIds[i]
			const packedOffer = packedOffers[i]
			const owner = owners[i]
			if (!offerId || !packedOffer || !owner)
				throw new Error('Unexpected invalid offer data')
			const offer = Offer.fromPacked(this.market, packedOffer, offerId, owner)
			this.offers.push(offer)
		}
	}

	/**
	 * Simulates an order on the offer list
	 * @param params - The simulation parameters
	 * @returns The simulation result
	 */
	simulateOrder(params: OfferListSimulationParams): OrderResult {
		return simulate({
			market: this.market,
			amount: params.amount,
			offers: this.offers.map((offer) => ({
				gives: offer.data.gives,
				tick: offer.data.tick,
				expiry: offer.data.expiry,
				provision: offer.data.provision,
			})),
			maxTick: params.maxTick,
			date: params.date,
			provision: params.provision,
		})
	}
}
