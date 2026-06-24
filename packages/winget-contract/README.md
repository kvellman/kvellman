# @kvellman/winget-contract

The **winget REST source contract** shared by the kvellman origin and its edge/mirror nodes:
TypeScript types for the winget REST shapes (`information`, `manifestSearch`, `packageManifests`,
the `{ Data }` envelope) plus winget-aware version comparison. Dependency-free, Apache-2.0.

## Install

```bash
npm install @kvellman/winget-contract
```

## Usage

```ts
import {
  compareWingetVersions,
  isNewer,
  maxWingetVersion,
  type ManifestSearchRequest,
  type PackageManifestResponse,
} from '@kvellman/winget-contract'

isNewer('0.100.0', '0.81.0') // true
maxWingetVersion(['1.2.0', '1.10.0', '1.9.0']) // '1.10.0'
```

It is the single source of truth for the contract, so the origin and the nodes never drift.
