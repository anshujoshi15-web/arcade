# Puzzle Print paid edition

Free practice remains at /puzzle-print. The paid interface is at /puzzle-print/live.
With no PUBLIC_PUZZLE configured, visitors have no paid entry controls.

## Edition and prize rules

The existing pearlescent print is the master artwork. IDs 1–25 represent
1,000 copies of each jigsaw design. ID 26 represents the completed print.
Keep the public artwork and metadata stable for the lifetime of the edition.

A paid piece costs 2 Base USDC. Each wallet can claim one free piece per
seven-day period measured from opening, buy 25 per transaction and hold 50
pieces. At most 6,818 pieces can be allocated to free draws, preserving room
for the paid threshold. USDC stays in the contract pending claims, settlement
or refunds. Each completed paid draw accounts for the 34/33/33 split.

Each request uses Chainlink VRF v2.5. Anyone can process the queue in request
order. The public VRF words generate draws without replacement from the fixed
25,000-slot inventory. Allocation does not inspect the wallet's holdings.
This is a rolling verifiable shuffle. It differs from precommitting a complete
hidden permutation. After processing, the requesting wallet collects its
pieces using the request ID from the transaction. An unfulfilled head request
can expire after two days, releasing its reservation and refunding paid entry.

Duplicate offers escrow one spare piece for an atomic swap. The maker can
cancel an open offer. Claims unlock at 18,182 paid pieces, and every place
requires sufficient funding. A winning claim burns one of each piece, issues
the print, and transfers the prize's USDC allocation to the House for the
Base ETH payout. There is one claim per wallet and a ten-winner maximum.

Claims end 30 days after the configured entry close. Settlement sends the
House share to the House and the donation share and unclaimed prizes to the
most-nominated listed recipient. Ties follow nominee list order. Below the
funding gate, full USDC refunds can open once sales close and the queue clears.

## Local rehearsal and deployment

- Install dependencies at the project root and in raffle. From raffle, run
  npm run build and node puzzle-test.mjs. This uses Ganache for actual paid
  and free transactions, simulated VRF fulfillment, collection, trading,
  nominations and refunds. The funded claim and settlement start from a
  seeded snapshot to avoid purchasing all 18,182 setup pieces.
- Review the contract and run a Base Sepolia rehearsal with actual VRF.
  Review the unfulfilled-request timeout and agree on the edition windows.
- Compile raffle/contracts/PuzzlePrint.sol with Solidity 0.8.24, Cancun,
  optimizer enabled at 200 runs. Use official Base USDC, the correct official
  VRF v2.5 coordinator and key hash, the funded subscription, House wallet,
  agreed UTC opening and closing timestamps, and approved nominee list.
  Deploy PuzzlePrint, verify source, and register the contract as a consumer
  before opening. The test fixture is for local tests.
- Verify the artwork at https://arcade.thehouseofjoshi.com/puzzle-nft/ before
  using it as the constructor's metadata base URI. Public metadata runs from
  1.json to 26.json. To regenerate with ImageMagick, run
  node raffle/puzzle-assets.mjs from the repository root.
- Set PUBLIC_PUZZLE on Hostinger with address, rpc and paidSalesEnabled.
  Start with paidSalesEnabled set to false. The constructor's timestamps
  control on-chain entry. The host flag controls the Arcade entry buttons.

[Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
and [Chainlink VRF networks](https://docs.chain.link/vrf/v2-5/supported-networks).

## Prize receipts

Record the conversion rate, then send the exact Base ETH amount from the House
wallet to the winner recorded on-chain. Divide the USD prize by the conversion
rate and round down to the nearest wei. Verify the payment locally:

    node raffle/puzzle-payout.mjs CONTRACT PLACE BASE_TX_HASH USD_PER_ETH

The verifier checks the network, confirmations, sender, recipient and ETH
amount, and outputs unsigned calldata. The House can then sign recordPayout
with the verified hash. The prize page links recorded payouts and the
on-chain donation settlement receipt.
