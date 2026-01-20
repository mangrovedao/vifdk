import type { Hex } from 'viem'
import { extsload, type SlotLoaderParameters } from './extloader'

const PROVISION_SLOT: Hex =
	'0xc75405b747c226ae89c4992273ee1e417d533fd08bccf114697ed46756362c3f'

export function provision(): SlotLoaderParameters {
	return extsload(PROVISION_SLOT)
}
