import type {
	Abi,
	Address,
	ContractFunctionArgs,
	ContractFunctionName,
	ContractFunctionParameters,
	MulticallResults,
	ReadContractReturnType,
} from 'viem'

export type PrepareReadsResult<
	TContracts extends readonly unknown[],
	TSelectData,
> = {
	contracts?: TContracts | undefined
	select: (data: MulticallResults<TContracts>) => TSelectData | undefined
	initialData: MulticallResults<TContracts>
}

export type PrepareReadResult<
	TSelectData,
	abi extends Abi | readonly unknown[] = Abi,
	functionName extends ContractFunctionName<
		abi,
		'pure' | 'view'
	> = ContractFunctionName<abi, 'pure' | 'view'>,
	args extends ContractFunctionArgs<
		abi,
		'pure' | 'view',
		functionName
	> = ContractFunctionArgs<abi, 'pure' | 'view', functionName>,
> = Omit<
	ContractFunctionParameters<abi, 'pure' | 'view', functionName, args>,
	'address'
> & {
	address?: Address | undefined
	select: (
		data: ReadContractReturnType<abi, functionName, args>,
	) => TSelectData | undefined
	initialData: ReadContractReturnType<abi, functionName, args>
}
