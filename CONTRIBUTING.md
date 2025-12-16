# Contributing to VIFDK

Thank you for your interest in contributing to VIFDK! This guide outlines our code guidelines and best practices.

## Code Guidelines

### TypeScript Standards

#### Type Annotations

**Always use explicit type annotations** for function parameters and return types:

```typescript
// ✅ Good
function createOffer(amount: bigint, price: Tick): Offer {
  // ...
}

// ❌ Avoid
function createOffer(amount, price) {
  // ...
}
```

**Explicitly type all parameters**, even when they might be inferred:

```typescript
// ✅ Good
static from(address: Address, decimals: number, symbol: string): Token {
  return new Token(address, decimals, symbol)
}

// ❌ Avoid - missing return type
static from(address: Address, decimals: number, symbol: string) {
  return new Token(address, decimals, symbol)
}
```

#### Handling Unused Parameters

When a parameter is required by an interface but not used in the implementation, **prefix it with an underscore**:

```typescript
// ✅ Good
function handleEvent(_sender: Address, amount: bigint): void {
  console.log(`Received amount: ${amount}`)
}
```

Alternatively, **use `Omit` or `Pick` utility types** to exclude unused parameters from interfaces when extending:

```typescript
// ✅ Good
type CoreActions = {
  nonce(
    user: Address,
    params?: Omit<ReadContractParameters, 'address' | 'abi' | 'functionName' | 'args'>
  ): Promise<bigint>
}
```

#### Immutability

Use `readonly` for array and object parameters that shouldn't be modified:

```typescript
// ✅ Good
function fromPacked(market: SemiMarket, packed: readonly bigint[]): Book {
  // ...
}

// ❌ Avoid
function fromPacked(market: SemiMarket, packed: bigint[]): Book {
  // ...
}
```

### Code Organization

#### Exports

- **Use named exports exclusively** - no default exports
- **Organize exports through dedicated files** (`export.ts` or `index.ts`)
- **Export types separately** from implementations:

```typescript
// ✅ Good - in export.ts
export type { Authorization, AuthorizationMessageType } from './authorization'
export { signatureDataForAuthorization, vifDomain } from './authorization'

// ❌ Avoid - mixing in source files without re-export structure
```

#### File Naming

- Use **lowercase with hyphens**: `offer-list.ts`, `action-element.ts`
- Test files: `filename.test.ts`
- Export files: `export.ts` or `index.ts`
- Group related files in directories with index exports

#### Classes vs Functions

- **Use classes for data models and stateful objects**: `Token`, `Market`, `Offer`, `Book`
- **Use functions for pure computations and utilities**: `simulate()`, `mulDivUp()`
- **Prefer static factory methods over public constructors**:

```typescript
// ✅ Good
class Token {
  private constructor(
    public readonly address: Address,
    public readonly decimals: number,
    public readonly symbol: string,
  ) {}
  
  static from(address: Address, decimals: number, symbol: string): Token {
    return new Token(address, decimals, symbol)
  }
}

// ❌ Avoid - public constructor for complex initialization
class Token {
  constructor(
    public readonly address: Address,
    public readonly decimals: number,
    public readonly symbol: string,
  ) {}
}
```

### Documentation

#### JSDoc Requirements

**Document all public APIs** with comprehensive JSDoc comments:

```typescript
/**
 * Creates a book from packed elements
 * @param market - The semi market attached to the book
 * @param packed - The packed book elements
 * @returns The book
 * @dev This function unpacks bigint arrays from contract calls
 * @example
 * const elements = await client.readContract({...})
 * const book = Book.fromPacked(market.asks, elements)
 */
static fromPacked(market: SemiMarket, packed: readonly bigint[]): Book {
  // ...
}
```

**Include these sections when relevant:**
- `@param` - Describe all parameters
- `@returns` - Describe the return value
- `@throws` - Document error conditions
- `@example` - Provide usage examples
- `@dev` - Implementation notes or constraints

**Document types and interfaces**:

```typescript
/**
 * Metadata for an ERC20 token
 */
export type TokenMetadata = {
  /** Contract address of the token */
  address: Address
  /** Number of decimal places used by the token */
  decimals: number
  /** Token symbol (e.g. "USDC") */
  symbol: string
}
```

#### When to Document

- ✅ All public classes, methods, and functions
- ✅ All exported types and interfaces
- ✅ Complex algorithms or non-obvious logic
- ❌ Private methods (optional)
- ❌ Self-explanatory getters/setters

### Error Handling

#### Custom Error Classes

Create **domain-specific error classes** that extend built-in errors:

```typescript
// ✅ Good
export class TickSpacingOverflowError extends RangeError {
  constructor(tickSpacing: bigint) {
    super(
      `Tick spacing ${tickSpacing} is out of range [${MIN_TICK_SPACING}, ${MAX_TICK_SPACING}]`
    )
  }
}

// Usage
if (tickSpacing < MIN_TICK_SPACING || tickSpacing > MAX_TICK_SPACING) {
  throw new TickSpacingOverflowError(tickSpacing)
}
```

**Include contextual information** in error messages to aid debugging.

### Import Organization

Organize imports in the following order:

1. External dependencies (viem, wagmi, react)
2. Type-only imports (`import type`)
3. Local library imports
4. Local type imports

```typescript
// ✅ Good
import { type Address, encodeAbiParameters } from 'viem'
import { readContract } from 'viem/actions'
import type { Market } from '../lib/market'
import { Token, type TokenAmount } from '../lib/token'

// ❌ Avoid - mixed ordering
import { Token, type TokenAmount } from '../lib/token'
import { type Address, encodeAbiParameters } from 'viem'
import type { Market } from '../lib/market'
```

### Testing

#### Test Structure

- **File naming**: `filename.test.ts`
- **Use `describe()` blocks** for grouping related tests
- **Use descriptive test names** with `it()`:

```typescript
describe('Book', () => {
  it('should parse the book and simulate it correctly (exact in)', async () => {
    // Arrange
    const market = await getMarket()
    
    // Act
    const result = await simulateBook(market)
    
    // Assert
    expect(result).toBeDefined()
    expect(result.amount).toBeCloseTo(expectedAmount, 2)
  })
})
```

#### Async Testing

Always use **async/await** for asynchronous tests:

```typescript
// ✅ Good
it('should execute order', async () => {
  const result = await executeOrder(params)
  expect(result).toBeDefined()
})

// ❌ Avoid - promise chains
it('should execute order', () => {
  return executeOrder(params).then(result => {
    expect(result).toBeDefined()
  })
})
```

### React Patterns (vif-react)

#### Hook Conventions

- **Always use the `use` prefix** for custom hooks
- **Explicitly type return values**:

```typescript
// ✅ Good
export function useVif(): VifChainConfig | undefined {
  const chainId = useChainId()
  const config = useVifConfig()
  return config[chainId]
}
```

#### Context Providers

- **Type the context explicitly**
- **Use `React.PropsWithChildren`** for provider props:

```typescript
// ✅ Good
export const VifContext = createContext<Record<number, VifChainConfig>>({})

export function VifProvider({
  children,
  config,
}: React.PropsWithChildren<{ config: VifConfigParameters }>): React.ReactElement {
  return <VifContext.Provider value={processedConfig}>{children}</VifContext.Provider>
}
```

### Additional Best Practices

#### Constants

- **Centralize constants** in dedicated files
- **Use UPPER_SNAKE_CASE** for constant names:

```typescript
// constants.ts
export const MAX_TICK = 887272n
export const MIN_TICK = -887272n
export const OFFER_AMOUNT_BITS = 127n
```

#### Builder Pattern

Use fluent interfaces for complex object construction:

```typescript
// ✅ Good
const actions = router
  .createTypedActions()
  .orderSingle({ token, amount, tick })
  .limitSingle({ token, amount, tick })
  .settleAll(token)
  .build()
```

#### Generics

Use generics for type-safe APIs with conditional return types:

```typescript
// ✅ Good
static create<TArgs extends CreateMarketArg | CreateMarketArg[]>(
  params: TArgs
): TArgs extends CreateMarketArg[] ? Market[] : Market {
  // ...
}
```

## Development Workflow

### Before Committing

Run these commands to ensure code quality:

```bash
# Type checking
bun run type-check

# Linting and formatting
bun run lint

# Auto-fix issues
bun run lint:fix

# Run tests
bun test

# Build packages
bun run build
```

### Git Hooks

Pre-commit hooks will automatically run linting and type checking. Ensure all checks pass before committing.

### Commit Messages

We follow **Conventional Commits** format:

```
feat: add new market order functionality
fix: correct tick spacing calculation
docs: update API documentation
test: add tests for offer simulation
chore: update dependencies
```

## Questions?

If you have questions about these guidelines or need clarification, please open an issue for discussion.

Thank you for contributing to VIFDK!
