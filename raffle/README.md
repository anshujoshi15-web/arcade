# House Raffle wallet edition

Run commands in this directory with Node 22 and npm.

## Play on a local blockchain

Run `npm ci --ignore-scripts`, then `npm run local`. Open http://127.0.0.1:14173 and connect a browser test wallet. The launcher uses chain 31337, RPC http://127.0.0.1:18545, symbol ETH. Connection requests a network switch and prepares the wallet with local gas, 100 practice dollars, and a round eligibility attestation. Nominate a sample charity and buy or claim a free entry. Restarting creates a fresh practice chain. All local funds are test fixtures.

## Verify the round

Run `npm test` for a full 6,000-sale integration test on an isolated chain with a test token and coordinator. The test checks rollover with escrow and serials retained, one free entry per wallet per week, unique winning wallets, the 34/33/33 purchase split, a claim after ticket transfer that releases USDC to the House for manual ETH payout, and the expiry sweep. Use `npm run build` to regenerate the ABI and bytecode. The production-facing contract has no mint faucet or administrative draw override.

## Base Sepolia configuration

Set RPC_URL and OPERATOR_KEY in a secure execution environment. Create a round configuration JSON containing monday (YYYY-MM-DD), publicRpc (a browser-safe endpoint), donationWallet (the donation custody wallet), charities (verified payout addresses in published tie-break order), labels (address to display name), and round. The round object takes currency (six-decimal USDC address), coordinator (Chainlink VRF v2.5 subscription coordinator), keyHash, subscription (decimal string), house, registrar and edition. The deploy command computes opens, closes and drawAt from the chosen Monday in America/Denver.

Run `node operator.mjs deploy config.json`. This creates a round, writes public/round.json, and prints its escrow address. Add that address as a consumer on the funded VRF subscription. Run `npm start` for the wallet UI. For each independently verified eligible wallet use `node operator.mjs attest WALLET UNIX_EXPIRY` from the registrar account. A zero expiry revokes future eligibility. Wallet attestations cover entry and pre-snapshot transfers. Operator staff wallets must be excluded during verification.

Use the House wallet as the operator when calling `node operator.mjs advance` after the scheduled draw time or sellout to request the random word. Call again after fulfillment to settle. Repeated calls progress an existing request. Winners claim from the snapshot wallet using the wallet page. After 30 days, `node operator.mjs sweep` sends outstanding prizes to the nominated charity. Below 6,000 paid entries, the checkpoint advances automatically for up to four weeks. If the round falls short at the limit, entries close. The House can end a round before a draw request and recover the prize escrow and combine it with the distributed shares for full manual USDC refunds. Once the threshold is reached, the current checkpoint is locked. Each contract holds one round, and serials begin again at 00001.

The first nomination recorded per entrant counts. Ties follow the published candidate order. Ownership freezes at sales close and unlocks on settlement. Total issuance and pre-draw holdings each have a 100-ticket wallet cap. Sellout with free entries pays the ladder from actual USDC collected. The contract emits entry, randomness request, seed, winning serial, payout, settlement and sweep events. Metadata and ticket artwork are embedded on chain.

## External integrations

The wallet workflow supports USDC. Public Base deployment, a funded randomness subscription, card processing, jurisdiction and age verification, winner tax processing, publication of terms, and charity verification require operator-provided accounts or decisions. Review the contract and payment flows before a funded launch. The local chain uses a mock coordinator to exercise the on-chain callback. The Hall of Winners reads linked previous rounds directly from the chain. Supply the prior contract address as previous in each subsequent deployment configuration. A missing weekly entry resets the streak. Two-week participation is recorded in serial metadata, four weeks unlock a free entry the following week, and weeks eight and twelve mint collectible badges. The first hour of each linked round reserves the first hundred serials for players with twelve consecutive prior entries. This one-hour priority window is an implementation choice. Livestreaming and notifications require operator channels.

For unattended draw progression run `node keeper.mjs` with the House wallet as the operator. It checks the configured round every 30 seconds, waits for the coordinator, finalizes, and sweeps unpaid prizes after expiry. Restarting resumes from contract state. A postponed round keeps running under the same contract address. The keeper does not create subsequent weekly deployments.
