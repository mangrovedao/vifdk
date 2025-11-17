import { type Hex, isAddressEqual } from 'viem'
import type { SemiMarket } from '../../lib/market'
import type { Token } from '../../lib/token'

/**
 * Thrown when a token is not one of the expected tokens
 */
export class InvalidTokenError extends Error {
	constructor(token: Token, expectedTokens: Token[]) {
		super(
			`Invalid token ${token.symbol}, expected ${expectedTokens.map((t) => t.symbol).join(' or ')}.`,
		)
	}
}

/**
 * Thrown when an action fails during execution
 */
export class FailedActionError extends Error {
	constructor(
		/** The revert data returned by the failed action */
		public readonly revertData: Hex,
		/** The label of the failed action */
		public readonly actionLabel: string,
	) {
		super(`Action ${actionLabel} failed: ${revertData}`)
	}
}

/**
 * Thrown when a multi-order path is invalid
 * @dev A path is invalid if:
 * - It is empty
 * - It contains only one market
 * - The outbound token of one market does not match the inbound token of the next market
 */
export class InvalidPathMultiOrderError extends Error {
	constructor(
		/** The path of the multi-order */
		public readonly path: SemiMarket[],
	) {
		const firstMarket = path.at(0)
		if (!firstMarket) {
			super('Invalid path for multi order, path is empty.')
			return
		}
		if (path.length === 1) {
			super('Invalid path for multi order, path is a single market')
			return
		}

		const prevToken = firstMarket.outboundToken
		let pathString = firstMarket.inboundToken.token.symbol // WETH
		for (const [i, currentPath] of path.entries()) {
			if (
				!isAddressEqual(
					currentPath.inboundToken.token.address,
					prevToken.token.address,
				)
			) {
				pathString += ` -> [${prevToken.token.symbol} != ${currentPath.inboundToken.token.symbol}]`
			} else {
				pathString += ` -> ${currentPath.inboundToken.token.symbol}`
			}
			if (i === path.length - 1) {
				pathString += ` -> ${currentPath.outboundToken.token.symbol}`
			}
		}
		super(
			`Invalid path for multi order (incorrect links between markets), got: ${pathString}.`,
		)
	}
}
