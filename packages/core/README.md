# vifdk

Typescript SDK to interact with the Vif order-book DeX

## Installation

```bash
bun add vifdk
```

## Usage

### Defining tokens

To define a token, you need to provide the address, decimals and symbol. You also need to provide the unit which you can initially set to 1.

```ts
import { Token } from 'vifdk';

// tokens that will be quote should be defined first
const tokens = [
	Token.from(config.USDC, 6, 'USDC', 1n),
	Token.from(config.WETH, 18, 'WETH', 1n),
];
```

### Getting the open markets

You can get the list of open markets that are trustlessly updated on the `VifReader` contract like this:

```ts
import { Market, openMarkets } from 'vifdk';

const markets = await client.readContract({
	address: config.VifReader,
	...openMarkets(),
});

// use the previously built token list to create the markets
const markets = markets
	.map((market) => Market.fromOpenMarketResult(market, tokens))
	.filter((market) => market !== undefined);
```

All markets with unknwon tokens will be ignored.

## Contributing

Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## License

MIT
