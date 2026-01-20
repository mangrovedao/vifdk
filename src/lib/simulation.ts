import { InvalidTokenError } from '../router/actions/errors'
import type { OrderResult } from '../router/actions/types'
import type { SemiMarket } from './market'
import { Tick } from './tick'
import { Token, type TokenAmount } from './token'
import { mulDivUp } from './utils'

export type SimpleOfferData = {
	/** The amount of tokens to give */
	gives: TokenAmount
	/** The tick to simulate on */
	tick: Tick
	/** The expiry date of the offer (undefined if no expiry) */
	expiry?: Date | undefined
	/** The provision of the offer (undefined if no provision) */
	provision?: TokenAmount | undefined
}

export type SimulationParams = {
	/** The market to simulate on */
	market: SemiMarket
	/** The amount to simulate */
	amount: TokenAmount
	/** The offers to simulate on */
	offers: SimpleOfferData[]
	/** The maximum tick to simulate */
	maxTick?: Tick | undefined
	/** The date override for the simulation (defaults to the current date) */
	date?: Date | undefined
	/** The global provision for the simulation (i.e. max provision, defaults to 0) */
	provision?: TokenAmount | undefined
}

/**
 * Performs a simulation of a market order on a simplified offer list (exact in)
 * @param params - The simulation parameters
 * @returns The simulation result
 */
function _simulateExactIn({
	market,
	amount,
	offers,
	maxTick = Tick.MAX_TICK(market.market.tickSpacing),
	date = new Date(),
	provision = Token.PROVISION_TOKEN.amount(0n),
}: SimulationParams): OrderResult {
	const result: OrderResult = {
		gave: market.inboundToken.token.amount(0n),
		got: market.outboundToken.token.amount(0n),
		fee: market.inboundToken.token.withUnit(1n).amount(0n),
		bounty: Token.PROVISION_TOKEN.amount(0n),
	}

	const excludingFees = market.excludingFees(amount)

	for (const offer of offers) {
		if (excludingFees.amount === 0n) break
		if (offer.tick.value > maxTick.value) break
		const wants = offer.tick.inboundFromOutbound(
			offer.gives,
			market.inboundToken.token,
		)
		if (offer.expiry && date >= offer.expiry) {
			const fromOffer = offer.provision?.amount ?? 0n
			result.bounty.amount +=
				fromOffer > provision.amount ? provision.amount : fromOffer
			continue
		}
		if (excludingFees.amount >= wants.amount) {
			// using full amount here since using normalized wil have no impact
			result.gave.amount += wants.amount
			result.got.amount += offer.gives.amount
			excludingFees.amount -= wants.amount
		} else {
			const receivedNormalized =
				(offer.gives.normalizedAmount * excludingFees.normalizedAmount) /
				wants.normalizedAmount
			if (receivedNormalized === 0n) break
			result.got.normalizedAmount += receivedNormalized
			result.gave.amount += excludingFees.amount
			excludingFees.amount = 0n
		}
	}

	result.fee = market.computeFees(result.gave, amount)

	return result
}

/**
 * Performs a simulation of a market order on a simplified offer list (exact out)
 * @param params - The simulation parameters
 * @returns The simulation result
 */
function _simulateExactOut({
	market,
	amount,
	offers,
	maxTick = Tick.MAX_TICK(market.market.tickSpacing),
	date = new Date(),
	provision = Token.PROVISION_TOKEN.amount(0n),
}: SimulationParams): OrderResult {
	const result: OrderResult = {
		gave: market.inboundToken.token.amount(0n),
		got: market.outboundToken.token.amount(0n),
		fee: market.inboundToken.token.withUnit(1n).amount(0n),
		bounty: Token.PROVISION_TOKEN.amount(0n),
	}

	amount = amount.copy()

	for (const offer of offers) {
		if (amount.amount === 0n) break
		if (offer.tick.value > maxTick.value) break
		if (offer.expiry && date >= offer.expiry) {
			const fromOffer = offer.provision?.amount ?? 0n
			result.bounty.amount +=
				fromOffer > provision.amount ? provision.amount : fromOffer
			continue
		}
		const wants = offer.tick.inboundFromOutbound(
			offer.gives,
			market.inboundToken.token,
		)
		if (amount.amount >= offer.gives.amount) {
			// using full amount here since using normalized wil have no impact
			result.gave.amount += wants.amount
			result.got.amount += offer.gives.amount
			amount.amount -= offer.gives.amount
		} else {
			result.gave.normalizedAmount += mulDivUp(
				wants.normalizedAmount,
				amount.normalizedAmount,
				offer.gives.normalizedAmount,
			)
			result.got.amount += amount.amount
			amount.amount = 0n
		}
	}

	result.fee = market.computeFees(result.gave)

	return result
}

/**
 * Performs a simulation of a market order on a simplified offer list
 * @param params - The simulation parameters
 * @returns The simulation result
 */
export function simulate(params: SimulationParams): OrderResult {
	if (params.amount.token.equals(params.market.inboundToken.token)) {
		return _simulateExactIn(params)
	} else if (params.amount.token.equals(params.market.outboundToken.token)) {
		return _simulateExactOut(params)
	}
	throw new InvalidTokenError(params.amount.token, [
		params.market.inboundToken.token,
		params.market.outboundToken.token,
	])
}
