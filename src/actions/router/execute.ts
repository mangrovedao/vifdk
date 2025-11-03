import type {
	Address,
	Client,
	SimulateContractParameters,
	SimulateContractReturnType,
	WriteContractParameters,
	WriteContractReturnType,
} from 'viem'
import { simulateContract, writeContract } from 'viem/actions'
import { getAction } from 'viem/utils'
import { RouterExecuteABI } from '../../builder/router'
import type { RouterExecuteParams } from './types'

export function execute(
	client: Client,
	router: Address,
	params: RouterExecuteParams,
): Promise<WriteContractReturnType> {
	return getAction(
		client,
		writeContract,
		'writeContract',
	)({
		address: router,
		abi: RouterExecuteABI,
		functionName: 'execute',
		args: params.params?.deadline
			? [params.commands, params.args, params.params.deadline]
			: [params.commands, params.args],
		...params.params?.viemParams,
	} as WriteContractParameters<typeof RouterExecuteABI, 'execute'>)
}

export async function simulateExecute(
	client: Client,
	router: Address,
	params: RouterExecuteParams<true>,
): Promise<SimulateContractReturnType<typeof RouterExecuteABI, 'execute'>> {
	return getAction(
		client,
		simulateContract,
		'simulateContract',
	)({
		address: router,
		abi: RouterExecuteABI,
		functionName: 'execute',
		args: params.params?.deadline
			? [params.commands, params.args, params.params.deadline]
			: [params.commands, params.args],
		...params.params?.viemParams,
	} as SimulateContractParameters<typeof RouterExecuteABI, 'execute'>)
}
