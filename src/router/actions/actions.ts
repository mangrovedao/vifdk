import { type Address, encodePacked, type Hex, type Log } from 'viem'
import { Token, type TokenAmount } from '../../lib/token'
import type { VifRouter } from '../router'
import {
	isLimitOrderElement,
	isMultiOrderElement,
	isSingleOrderElement,
} from './action-element'
import type { Action } from './enum'
import { parseFromLogs } from './parser/receipt'
import { parseSimulationResult } from './parser/simulation'
import type {
	ActionElement,
	ActionsResult,
	ActionsResultFromReceipt,
	DispatchResult,
	ExpectedAllowances,
} from './types'

/**
 * Class for managing and executing router actions
 * @template TActions - Array of action types being managed
 */
export class VifRouterActions<
	TActions extends readonly Action[] = readonly [],
> {
	/**
	 * Returns the list of action elements
	 * @returns List of action elements
	 */
	get list(): readonly ActionElement[] {
		return this.actions
	}

	/**
	 * Creates a new VifRouterActions instance
	 * @param router - The VifRouter instance to use for execution
	 */
	constructor(
		public readonly router: VifRouter,
		private readonly actions: ActionElement[],
	) {}

	/**
	 * Gets the transaction data for all actions
	 * @returns Object containing commands and arguments
	 */
	txData(): { commands: Hex; args: Hex[] } {
		return {
			commands: encodePacked(
				Array(this.actions.length).fill('uint8') as 'uint8'[],
				this.actions.map((action) => action.action),
			),
			args: this.actions.map((action) => action.args),
		}
	}

	/**
	 * Parses the simulation results from a router dispatch call
	 * @param returnData - Array of dispatch results returned from simulation
	 * @returns Parsed action results array matching the actions array
	 * @throws Error if an action is not found
	 */
	parseSimulationResult(
		returnData: readonly DispatchResult[] | DispatchResult[],
	): ActionsResult<TActions> {
		return parseSimulationResult(returnData, this.actions)
	}

	/**
	 * Parses transaction logs to extract action results
	 * @param logs - Array of transaction logs to parse
	 * @returns Parsed action results array matching the actions array
	 *
	 * Handles parsing of:
	 * - Market orders (single and multi)
	 * - Limit orders
	 * - Cancellations and claims
	 *
	 * For each event type:
	 * - Matches event to corresponding action
	 * - Extracts relevant data like amounts, fees, etc
	 * - Builds appropriate result object
	 */
	parseLogs(logs: Log[]): ActionsResultFromReceipt<TActions> {
		return parseFromLogs(logs, this.actions)
	}

	/**
	 * Calculates the expected allowances needed for the actions
	 * @dev If a token amount is returned with 0, it means it is unknown
	 * 			This could be due to market orders with unknown fill volume (exact out)
	 *
	 * @dev These values do not take the returns from other actions (e.g. an order after a claim could require no allowance)
	 * @returns Expected allowances for the actions
	 */
	expectedAllowances(): ExpectedAllowances {
		const allowances: Map<Address, TokenAmount> = new Map()

		const addAmount = (amount: TokenAmount | Token) => {
			const token = amount instanceof Token ? amount : amount.token
			const bigintAmount = amount instanceof Token ? 0n : amount.amount
			const saved = allowances.get(token.address)
			if (saved) {
				if (saved.amount === 0n) return
				if (bigintAmount === 0n) {
					saved.amount = 0n
					return
				}
				saved.amount += bigintAmount
				return
			}
			allowances.set(token.address, token.withUnit(1n).amount(bigintAmount))
		}

		for (const action of this.actions) {
			if (isSingleOrderElement(action)) {
				addAmount(
					action.metadata.fillVolume.token.equals(
						action.metadata.market.inboundToken.token,
					)
						? action.metadata.fillVolume
						: action.metadata.market.inboundToken,
				)
			} else if (isMultiOrderElement(action)) {
				const sendToken = action.metadata.markets.at(0)?.inboundToken.token
				if (!sendToken) continue
				addAmount(
					action.metadata.fillWants ? sendToken : action.metadata.fillVolume,
				)
			} else if (isLimitOrderElement(action)) {
				addAmount(action.metadata.gives)
			}
		}
		return Array.from(allowances.values())
	}
}
