# House Arcade

Open [House Raffle](house-raffle.html) locally for the play-credit demo, or read [How It Works](how-it-works.html).

The [wallet edition](raffle/README.md) includes local blockchain setup, tests, and Base Sepolia deployment instructions. Run its npm commands from the `raffle` directory. The [Remix-ready contracts](contracts/) pin OpenZeppelin dependencies for browser compilation.

## Deploy on Hostinger

Use the repository root as the Node.js application directory and select Node.js 22. Select Express if prompted, use `npm run build` as the build command, and use `server.js` as the startup file or `npm start` as the start command. Upload archives with `package.json` at the top level and omit `node_modules`. The app listens on the port supplied by Hostinger. The home page serves the play-credit demo.

The wallet edition is available at `/wallet`. To configure a deployed round, set `PUBLIC_ROUND` to a JSON object with the public raffle `address`, numeric `chainId`, browser-safe `rpc`, and optional charity `labels`. Keep operator credentials outside this public configuration.

### File Manager upload

The [File Manager ZIP](downloads/House-Arcade-File-Manager.zip) contains the play-credit demo and How It Works page. Extract its two HTML files into the subdomain’s document root. The package runs as static HTML and contains no wallet integration.

See the [Remix deployment and admin guide](DEPLOY.md) for constructor inputs and instructions for opening `/admin`.
