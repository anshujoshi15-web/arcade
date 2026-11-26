# Deploy House Raffle on Base Sepolia

1. Upload [HouseRaffle.sol](contracts/HouseRaffle.sol) and [StreakBadges.sol](contracts/StreakBadges.sol) into the same Remix folder. The imports already pin OpenZeppelin 5.1.0.
2. Compile HouseRaffle.sol with Solidity 0.8.24, EVM Cancun, optimizer enabled at 200 runs, and Via IR off.
3. In Remix Deploy & Run, select Browser Extension and confirm your wallet is on Base Sepolia (84532) with test ETH for gas. Create a Chainlink VRF v2.5 subscription on Base Sepolia and fund it with test LINK.
4. Select HouseRaffle and leave Value at zero. Enter the four constructor arguments below. The raffle deploys the badge contract as part of its constructor.

The `c` tuple in order:

```text
["0x036CbD53842c5426634e7929541eC2318f3dCF7e","0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE","0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71","SUBSCRIPTION_ID","HOUSE_WALLET","REGISTRAR_WALLET",OPENS,CLOSES,DRAW_AT,1]
```

Replace the placeholders. Times are Unix seconds and must satisfy `OPENS < CLOSES <= DRAW_AT`. The final number is the edition. For `recipients`, enter an array of 1–32 distinct charity wallet addresses in published tie-break order. For `prior`, use `0x0000000000000000000000000000000000000000` for the first round. Subsequent rounds use the previous round contract address and the next edition number. For `donation`, enter the House-controlled donation custody wallet, separate from the House wallet and from the nominated recipient list.

Verify network-specific addresses before signing. [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses) · [Chainlink supported networks](https://docs.chain.link/vrf/v2-5/supported-networks#base-sepolia-testnet)

5. Deploy, copy the HouseRaffle address, and add it as a consumer on the funded VRF subscription.
6. For local testing only, use the connection details below in `raffle/public/round.json`. The hosted app accepts Base mainnet (8453).

```json
{"address":"YOUR_DEPLOYED_HOUSE_RAFFLE_ADDRESS","chainId":84532,"rpc":"YOUR_BROWSER_SAFE_BASE_SEPOLIA_RPC_URL"}
```

7. For a testnet rehearsal, run the app locally, open `/admin` and connect the registrar wallet. Grant eligibility to a separate player wallet with an expiry after the test entry. Open `/wallet` as that player and claim a free ticket. Check serial 00001 and its Gold artwork. The House treasury and registrar wallets cannot enter.

The admin page reads round status and submits transactions through the connected wallet. The contract restricts eligibility changes to the registrar and permits anyone to request, finalize, or sweep when the relevant conditions are met. A draw requires at least 6,000 paid entries. The static File Manager demo is a separate package. Serve the Node.js app to use `/admin`.

Admin sign-in is restricted to House wallet `0x6736d2eA9807297F0e56967361B9410854B86a5f`. The server verifies a one-time signed message and issues a 15-minute session. For the House wallet to manage player eligibility from the dashboard, set it as both `house` and `registrar` when deploying the round. Use the HTTPS arcade domain for hosted sign-in. Direct on-chain permissions follow the deployed contract.

## Revised carry-forward rules

Deploy the revised HouseRaffle bytecode for these rules. A previously deployed raffle retains its original contract rules. When sales are below 6,000 paid tickets, the on-chain checkpoint advances automatically by seven days and tickets and escrow remain in the same round. After the threshold is reached, the current sales checkpoint and draw time are fixed. Free and bonus entries share a 4,000-entry cap so paid sales can always reach the draw threshold. Each wallet may claim one free entry per seven-day period from the opening time, within its 100-entry round cap.

The site and Admin display round times in UTC. Rollover uses exact seven-day UTC intervals. For the example first mainnet round, the final four values of the constructor tuple are `1795699800,1796000400,1796007600,1`, corresponding to 26 November 2026 at 13:30 UTC (opening), 30 November at 01:00 UTC (checkpoint), and 30 November at 03:00 UTC (draw). Replace the schedule before deployment if it has passed.

## Escrow, manual ETH payouts, and refunds

Paid entry on the hosted site remains disabled during the soft opening. Deploy the revised contract to use these rules. Each paid ticket sends 34% immediately to the donation wallet and 33% to the House wallet. The remaining 33% stays in the contract as the prize reserve. After the draw settles, the House pays the nominated recipient from the donation wallet and publishes the transfer. A snapshot winner’s claim releases their prize allocation in USDC to the House. The House pays the winner in Base ETH and publishes the conversion rate and ETH transaction. Unclaimed allocations go to the donation recipient after 30 days.

The first sales checkpoint can advance by up to four weeks. At the limit, the contract closes entries if there are fewer than 6,000 paid tickets. A postponement or checkpoint does not trigger refunds. Refunds apply only after the House formally ends the round without a draw. Before a randomness request, the House can end a round via `emergencyClose()`. The House can then call `recoverFunds()` to transfer the prize escrow balance to its wallet. Full refunds require the funds already distributed to the donation and House wallets as well. Use the public entry events and `paidBy(address)` to reconcile original buyers and pay full USDC refunds manually. Free entries have no refund value. The admin dashboard provides both actions.

To prefill the Admin ledgers, add the contract creation block as the numeric `deploymentBlock` in `PUBLIC_ROUND`. Otherwise enter the block shown in the contract deployment receipt. Load the ledgers to see the original buyers and registered ETH claims. The refund CSV lists original payment amounts. The claim CSV includes fields for recording the conversion rate and the ETH payout transaction.

The hosted default is the current Base mainnet round in `raffle/round.mainnet.json`. A mainnet `PUBLIC_ROUND` overrides it. A legacy Base Sepolia configuration uses the mainnet default. Set `PUBLIC_ROUND` to `{}` to leave the site without an active round.

## Public paid purchases

The revised contract accepts paid entries from player wallets without a registrar attestation. House and registrar wallets remain excluded. Free and bonus entries and receipt of pre-draw transfers still require an attestation. The deployed contract address determines which rules apply. A new deployment needs a new VRF consumer registration and updated `PUBLIC_ROUND` configuration to enable purchases on the site.
