# Deploy House Raffle on Base Sepolia

1. Upload [HouseRaffle.sol](contracts/HouseRaffle.sol) and [StreakBadges.sol](contracts/StreakBadges.sol) into the same Remix folder. The imports already pin OpenZeppelin 5.1.0.
2. Compile HouseRaffle.sol with Solidity 0.8.24, EVM Cancun, optimizer enabled at 200 runs, and Via IR off.
3. In Remix Deploy & Run, select Browser Extension and confirm your wallet is on Base Sepolia (84532) with test ETH for gas. Create a Chainlink VRF v2.5 subscription on Base Sepolia and fund it with test LINK.
4. Select HouseRaffle and leave Value at zero. Enter the three constructor arguments below. The raffle deploys the badge contract as part of its constructor.

The `c` tuple in order:

```text
["0x036CbD53842c5426634e7929541eC2318f3dCF7e","0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE","0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71","SUBSCRIPTION_ID","HOUSE_WALLET","REGISTRAR_WALLET",OPENS,CLOSES,DRAW_AT,1]
```

Replace the placeholders. Times are Unix seconds and must satisfy `OPENS < CLOSES <= DRAW_AT`. The final number is the edition. For `recipients`, enter an array of 1–32 distinct charity wallet addresses in published tie-break order. For `prior`, use `0x0000000000000000000000000000000000000000` for the first round. Subsequent rounds use the previous round contract address and the next edition number.

Verify network-specific addresses before signing. [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses) · [Chainlink supported networks](https://docs.chain.link/vrf/v2-5/supported-networks#base-sepolia-testnet)

5. Deploy, copy the HouseRaffle address, and add it as a consumer on the funded VRF subscription.
6. On the Node.js host, set `PUBLIC_ROUND` to the public connection details below and restart the app.

```json
{"address":"YOUR_DEPLOYED_HOUSE_RAFFLE_ADDRESS","chainId":84532,"rpc":"YOUR_BROWSER_SAFE_BASE_SEPOLIA_RPC_URL"}
```

7. Open `/admin` and connect the registrar wallet. Grant eligibility to a separate player wallet with an expiry after the test entry. Open `/wallet` as that player and claim a free ticket. Check serial 00001 and its Gold artwork. The House treasury and registrar wallets cannot enter.

The admin page reads round status and submits transactions through the connected wallet. The contract restricts eligibility changes to the registrar and permits anyone to request, finalize, or sweep when the relevant conditions are met. A draw requires at least 6,000 paid entries. The static File Manager demo is a separate package. Serve the Node.js app to use `/admin`.
