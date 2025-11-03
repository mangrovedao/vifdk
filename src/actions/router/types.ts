import type {
	Address,
	Hex,
	SimulateContractParameters,
	WriteContractParameters,
} from 'viem'
import type { LimitSingleParams } from '../../router/actions/types'

/** Additional parameters for the router execute function */
export type AdditionalParams<TSimulate extends boolean = false> = {
	/** The deadline for the execute function */
	deadline?: bigint
	/** Additional parameters for the viem write contract function */
	viemParams?: Omit<
		TSimulate extends true
			? SimulateContractParameters
			: WriteContractParameters,
		'address' | 'abi' | 'functionName' | 'args'
	>
}

/** Parameters for the router execute function */
export type RouterExecuteParams<TSimulate extends boolean = false> = {
	/** The commands to execute */
	commands: Hex
	/** The arguments to pass to the execute function */
	args: Hex[]
	/** Additional parameters for the execute function */
	params?: AdditionalParams<TSimulate>
}

export type LimitOrderParams = Omit<
	LimitSingleParams<false>,
	'initialOfferId' | 'canFail'
> & {
	user: Address
	params?: AdditionalParams<false>
}
