import type { Hex } from 'viem'

type Bytecodes = {
	WETH: Hex
	ERC20: Hex
	VifRouter: Hex
	Vif: Hex
	VifReader: Hex
	multicall: Hex
}

let _bytesCodes: Promise<Bytecodes> | undefined

export function bytesCodes(): Promise<Bytecodes> {
	if (!_bytesCodes) {
		_bytesCodes = Bun.file('./test/static/bytecodes.json').json()
	}
	return _bytesCodes
}
