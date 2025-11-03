import { encodePacked, type Hex, type Log } from 'viem'
import type { VifRouter } from '../router'
import type { Action } from './enum'
import { parseFromLogs } from './parser/receipt'
import { parseSimulationResult } from './parser/simulation'
import type {
	ActionElement,
	ActionsResult,
	ActionsResultFromReceipt,
	DispatchResult,
} from './types'

/**
 * Class for managing and executing router actions
 * @template TActions - Array of action types being managed
 */
export class VifRouterActions<
	TActions extends readonly Action[] = readonly [],
> {
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
}
