# LedgerWorks Client

This library is intended to be used with the [LedgerWorks](https://lworks.io) Hedera Mirror. This is a convenience wrapper around `node-fetch` with automatic retry logic provided by `async-retry` and authentication handling. [Sign up](https://app.lworks.io/signup) for a free account if you don't have an existing access key. By default, this library will provide anonymous usage data back to LedgerWorks.

Support and questions should be directed to [our discord](https://discord.gg/Rph3nbEEFA).

## Installation

```sh
npm install lworks-client
```

## Usage

Once your access token is configured, you can call the mirror providing a network and endpoint (Endpoint documentation can be found [on the Hedera public mirror](https://mainnet-public.mirrornode.hedera.com/api/v1/docs/))

```js
const { callMirror, MirrorResponse } = require("lworks-client");

callMirror<MirrorResponse.Schemas["TransactionsResponse"]>("mainnet", "/api/v1/transactions?limit=100")
  .then((resp) => {
    console.log(resp);
    // {
    //     "transactions": [
    //         {
    //             "bytes": null,
    //             "charged_tx_fee": 1642787,
    //             "consensus_timestamp": "1666123944.820428059",
    //             "entity_id": "0.0.48651905",
    //             "max_fee": "200000000",
    //             "memo_base64": "",
    //             "name": "TOKENMINT",
    //             "node": "0.0.3",
    //             "nonce": 0,
    //             "parent_consensus_timestamp": null,
    //             "result": "SUCCESS",
    //             "scheduled": false,
    //             "token_transfers": [
    //                 {
    //                     "token_id": "0.0.48651905",
    //                     "account": "0.0.18602592",
    //                     "amount": 8112000000,
    //                     "is_approval": false
    //                 }
    //             ],
    //             "transaction_hash": "SXHasFfLzfn4E2PdN3LjoOAx7ZaAsuT8TsSiifBvAgUxYuhHQ5gzxrJOnTkWJrqJ",
    //             "transaction_id": "0.0.18602592-1666123934-274397160",
    //             "transfers": [
    //                 {
    //                     "account": "0.0.3",
    //                     "amount": 82230,
    //                     "is_approval": false
    //                 },
    //                 {
    //                     "account": "0.0.98",
    //                     "amount": 1560557,
    //                     "is_approval": false
    //                 },
    //                 {
    //                     "account": "0.0.18602592",
    //                     "amount": -1642787,
    //                     "is_approval": false
    //                 }
    //             ],
    //             "valid_duration_seconds": "120",
    //             "valid_start_timestamp": "1666123934.274397160"
    //         },
    //         {
    //             "bytes": null,
    //             "charged_tx_fee": 165214,
    //             "consensus_timestamp": "1666123944.388621003",
    //             "entity_id": "0.0.2601162",
    //             "max_fee": "2000000000",
    //             "memo_base64": "MTY2NjEyMzk0NDE3MyBNb25pdG9yIHBpbmdlciBvbiB0ZXN0bmV0LW1vbml0b3ItaGVkZXJhLW1pcnJvci1tb25pdG9yLTY5Y2ZmY2RkNmQta3Fta2Y=",
    //             "name": "CONSENSUSSUBMITMESSAGE",
    //             "node": "0.0.6",
    //             "nonce": 0,
    //             "parent_consensus_timestamp": null,
    //             "result": "SUCCESS",
    //             "scheduled": false,
    //             "transaction_hash": "P+tfWp7LQHWTevMoD7GhRXX7asFb6OHHjaDgS+5QP3QlqgDhIcMAp5InHoR3a1NI",
    //             "transaction_id": "0.0.88-1666123934-194790704",
    //             "transfers": [
    //                 {
    //                     "account": "0.0.6",
    //                     "amount": 8302,
    //                     "is_approval": false
    //                 },
    //                 {
    //                     "account": "0.0.88",
    //                     "amount": -165214,
    //                     "is_approval": false
    //                 },
    //                 {
    //                     "account": "0.0.98",
    //                     "amount": 156912,
    //                     "is_approval": false
    //                 }
    //             ],
    //             "valid_duration_seconds": "120",
    //             "valid_start_timestamp": "1666123934.194790704"
    //         }
    //     ],
    //     "links": {
    //         "next": "/api/v1/transactions?limit=2&timestamp=lt:1666123944.388621003"
    //     }
    // }
  });
```

```ts
import { callMirror, Network } from "lworks-client";

callMirror<{
    "transactions": Array<{
        "bytes": null,
        "consensus_timestamp": string,
        "name": string,
        "node": string
      }>
    }>(Network.Mainnet, "/api/v1/transactions?limit=100")
  .then((resp) => {
    console.log(resp.transactions);
  });
```

Alternatively if you only plan on using a single network, you can set the network and the omit it on each call.

```ts
import { callMirror, Network, setNetwork } from "lworks-client";

setNetwork(Network.Mainnet); // OR setNetwork("mainnet");
callMirror("/api/v1/transactions?limit=100");
```

## Access Token Configuration

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

    ```js
    const { setAccessToken } = require("lworks-client");

    setAccessToken("b226ac68f00b444b6ab249a029bd01d8");
    ```

    ```ts
    import { setAccessToken } from "lworks-client";

    setAccessToken("b226ac68f00b444b6ab249a029bd01d8");
    ```

## Options

The global configuration object can be configured with a single call or with individual `set<OPTION>` calls.

This global options has the following type

```ts
type Config = {
  disableTracking: boolean;
  network: null | Network;
  accessToken: null | string;
};
```

### Configure anonymous metrics

Disable anonymous metric collection by calling one of the following

```ts
import { configure } from "lworks-client";

configure({
  disableTracking: true,
});
```

or

```ts
import { disableTracking } from "lworks-client";

disableTracking();
```
