import { type Address, type Client, parseAbi } from 'viem'
import { deployContract, waitForTransactionReceipt } from 'viem/actions'
import { bytesCodes } from '../static/bytescodes'

export async function deployMulticall(client: Client): Promise<Address> {
	const bytecode = await bytesCodes()
	const hash = await deployContract(client, {
		abi: parseAbi(['constructor()']),
		bytecode: bytecode.multicall,
		// biome-ignore lint/style/noNonNullAssertion: test env
		account: client.account!,
		chain: client.chain,
	})
	const receipt = await waitForTransactionReceipt(client, { hash })
	const multicall = receipt.contractAddress
	if (!multicall) throw new Error('Multicall not deployed')
	return multicall
}
