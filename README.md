# LedgerWorks Client

This library is intended to be used with the [Ledger Works'](https://lworks.io) Streams API, TimeSeries API, and Hedera Mirror REST API.

To learn more about these services, see [LWorks Docs](https://docs.lworks.io).

The client uses Node's built-in `fetch` with automatic retry logic provided by `async-retry` and custom authentication handling.

Support and questions should be directed to [our discord](https://discord.gg/Rph3nbEEFA).

## Installation

```sh
npm install lworks-client
```

## Call Streams

```ts
import { queryRules, getRuleById, deleteRuleById, StreamTypes, getRuleById } from "lworks-client";

// Query all rules targeting HCS Topic activity
const result = await queryRules({
  network: Network.Testnet,
  ruleType: StreamTypes.StreamsRuleType.HCSMessagesByTopicId,
});

let rules = result.rules;
// simple pagination example
if (result.next) {
  const result2 = await queryRules({
    network: Network.Testnet,
    ruleType: StreamTypes.StreamsRuleType.HCSMessagesByTopicId,
    next: result1.next,
  });

  rules = rules.concat(result2.rules);
}

if (rules.length > 0) {
  // Delete example
  await deleteRuleById(rule[0].ruleId, { network: Network.Testnet });

  // Sentinel update and delete operations are asynchronous.
  // E.g., the Sentinel API returns a 202 status code.
  // Here, we wait for the rule deletion to be processed.
  // Note: This code is for demonstrational purposes only and should not be used as written.
  let ruleDeleted = false;
  while (true) {
    const deletedRule = getRuleById(rule[0].ruleId, { network: Network.Testnet });
    if (deletedRule === undefined) {
      break;
    }
  }
}
```

## Mirror Usage

### Lworks Mirror

The LedgerWorks mirror is not longer a full archive node. It only holds a brief window of history.

For this reason, you should only use the client with the public API for reliable queries.

```ts
const { callMirror, MirrorResponse } = require("lworks-client");

await callMirror<MirrorResponse.Schemas["TransactionsResponse"]>("/api/v1/transactions?limit=100", {
  network: Network.Mainnet,
  environment: Environment.public,
});
```

## Options

The global configuration object can be configured with a single call or with individual `set<OPTION>` calls.

This global options has the following type

```ts
type Config = {
  network: null | Network;
  accessToken: null | string;
  environment: null | Environment;
};
```

### Configure Access Token

Get your access token(s) from <https://app.lworks.io/api-access-tokens>

1. Support both `mainnet` and `testnet` usage by setting access tokens for both on the environment

   ```sh
   export LWORKS_TESTNET_TOKEN=462c5e6dd0314fdbbbb48497949ba201
   export LWORKS_MAINNET_TOKEN=a1a4de795a8b427b68a9a068fd81245b
   ```

1. Support single network usage by setting a single token on the environment

   ```sh
   export LWORKS_TOKEN=b226ac68f00b444b6ab249a029bd01d8
   ```

1. Programmatically configure a single token by

   ```ts
   import { setAccessToken } from "lworks-client";

   setAccessToken("b226ac68f00b444b6ab249a029bd01d8");
   ```

   ```ts
   import { configure } from "lworks-client";

   configure({
     accessToken: "b226ac68f00b444b6ab249a029bd01d8",
   });
   ```

### Configure Network

If you only plan on using a single network, you can set the network and the omit it on each call.

```ts
import { setNetwork } from "lworks-client";

setNetwork(Network.Mainnet);
```

```ts
import { configure } from "lworks-client";

configure({
  network: Network.Mainnet,
});
```

### Configure Environment

If you only plan on using a single environment, you can set the environment and the omit it on each call.

```ts
import { setEnvironment } from "lworks-client";

setEnvironment(Environment.public);
```

```ts
import { configure } from "lworks-client";

configure({
  environment: Environment.public,
});
```

```ts
process.env.LWORKS_ENVIRONMENT = 'prod' # Use prod for all services
process.env.LWORKS_MIRROR_ENVIRONMENT = 'public' # Override environment for the mirror only.
```
