# House Arcade

Open [House Raffle](house-raffle.html) locally for the play-credit demo, or read [How It Works](how-it-works.html).

The [wallet edition](raffle/README.md) includes local blockchain setup, tests, and Base Sepolia deployment instructions. Run its npm commands from the `raffle` directory. The [Remix-ready contracts](contracts/) pin OpenZeppelin dependencies for browser compilation.

## Deploy on Hostinger

Use the repository root as the Node.js application directory and select Node.js 22. Select Express if prompted, use `npm run build` as the build command, and use `server.js` as the startup file or `npm start` as the start command. Upload archives with `package.json` at the top level and omit `node_modules`. The app listens on the port supplied by Hostinger. The homepage serves the House Arcade game hub.

The wallet-backed raffle is available at `/raffle` and `/wallet`. To configure a deployed round, set `PUBLIC_ROUND` to a JSON object with the public raffle `address`, numeric Base mainnet `chainId` (8453), browser-safe HTTPS `rpc`, and optional charity `labels`. Keep operator credentials outside this public configuration.

### File Manager upload

The [File Manager ZIP](downloads/House-Arcade-File-Manager.zip) contains the play-credit demo and How It Works page. Extract its two HTML files into the subdomain’s document root. The package runs as static HTML and contains no wallet integration.

See the [Remix deployment and admin guide](DEPLOY.md) for constructor inputs and instructions for opening `/admin`.

### Reown wallet connections

Run `npm ci` and `npm run build` before `npm start`. The build bundles the AppKit Ethers adapter into the browser asset served at `/appkit.js`. AppKit offers wallet extensions, mobile wallets, and WalletConnect QR codes on public pages. The House-only admin signature flow uses its existing browser-wallet connection.

In the Reown project dashboard, allow `https://arcade.thehouseofjoshi.com` for the configured project. If the modal falls back to the browser extension, check that `/appkit.js` returns JavaScript and that the Hostinger build ran. If the modal opens but pairing fails, check the project's domain allowlist. The hosted raffle uses Base mainnet (8453).

Paid entry is off by default for hosted rounds. Once paid play is cleared for a particular round, set the Boolean `"paidSalesEnabled": true` in that round’s `PUBLIC_ROUND` JSON and apply the Hostinger settings. The checked-in mainnet round carries its own explicit default. Hostinger can override it with `"paidSalesEnabled": false`, and a different round address requires its own opt-in. The setting controls the website’s purchase flow. Direct contract calls are governed by eligibility and the contract’s rules.

## Agent discovery

The hosted app publishes `/robots.txt`, `/sitemap.xml`, `/llms.txt`, and the MCP card at `/.well-known/mcp/server-card.json`. Request the homepage with `Accept: text/markdown` or open `/index.md` for the Markdown version. The homepage registers two read-only WebMCP tools in supporting browsers. The same tools are available through the stateless Streamable HTTP MCP endpoint at `/mcp`.
