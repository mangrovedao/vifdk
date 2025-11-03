import type {
	Address,
	Hex,
	SimulateContractReturnType,
	WriteContractReturnType,
} from 'viem'
import type { SignTypedDataParameters } from 'viem/accounts'
import type { RouterExecuteABI } from '../../builder/router'
import type { Authorization } from '../../lib/authorization'
import type { LimitSingleParams } from '../../router/actions/types'
import type { RouterExecuteParams } from './types'

export type RouterActions = {
	simulateExecute(
		params: RouterExecuteParams<true>,
	): SimulateContractReturnType<typeof RouterExecuteABI, 'execute'>

	execute(params: RouterExecuteParams): WriteContractReturnType

	limitOrder(
		params: Omit<LimitSingleParams<false>, 'initialOfferId' | 'canFail'> & {
			user: Address
		},
	): WriteContractReturnType

	signAuthorization(
		data: Authorization,
		params?: Omit<
			SignTypedDataParameters,
			'address' | 'abi' | 'functionName' | 'args' // TODO: change
		>,
	): Promise<Hex>
}
