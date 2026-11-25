import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { base } from '@reown/appkit/networks';

export const appkit = createAppKit({
  adapters: [new EthersAdapter()],
  networks: [base],
  defaultNetwork: base,
  projectId: '22cd96c9c57e98f9aa3475083ba4dbb1',
  metadata: {
    name: 'House Arcade',
    description: 'Games from The House of Joshi',
    url: window.location.origin,
    icons: [window.location.origin + '/house-raffle-ticket-gold.svg']
  },
  features: { analytics: false, email: false, socials: false },
  themeVariables: { '--w3m-accent': '#0000ff' }
});
