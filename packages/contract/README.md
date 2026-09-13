# @polinetworkorg/polinet.cc

The [ts-rest](https://ts-rest.com) contract and [zod](https://zod.dev) schemas for the
[polinet.cc](https://polinet.cc) URL shortener API, published so that any TypeScript client
can talk to the API with full end-to-end type safety.

## Install

```sh
pnpm add @polinetworkorg/polinet.cc @ts-rest/core zod
```

`@ts-rest/core` and `zod` are peer dependencies — install them yourself so a single copy is
shared with the rest of your app.

## Usage

```ts
import { initClient } from "@ts-rest/core"
import { contract } from "@polinetworkorg/polinet.cc"

const client = initClient(contract, {
  baseUrl: "https://polinet.cc/api",
})

const res = await client.getAllUrls({ query: { page: 1, limit: 10 } })
if (res.status === 200) {
  console.log(res.body.urls)
}
```

The zod schemas and their inferred types are exported too:

```ts
import { URLRecord, type UrlRecord, createUrlSchema } from "@polinetworkorg/polinet.cc"
```

## Releasing

This package lives in the [polinet.cc repository](https://github.com/PoliNetworkOrg/polinet.cc)
under `packages/contract`. To cut a release:

1. Bump `version` in `packages/contract/package.json`.
2. Merge to `main`.
3. Push a tag of the form `contract-v<version>` (e.g. `contract-v0.1.0`).

The `Publish contract package` workflow builds, type-checks, tests and publishes to npm with
[provenance](https://docs.npmjs.com/generating-provenance-statements). It can also be run
manually from the Actions tab.
