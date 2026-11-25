export function setupWalletButton({onConnect, onRestore, disconnectedLabel = 'Connect wallet'} = {}) {
  const button = document.getElementById('connect');
  const feedback = document.getElementById('wallet-feedback');
  const ethereum = window.ethereum;
  const show = address => {
    button.textContent = address ? address.slice(0, 6) + '…' + address.slice(-4) : disconnectedLabel;
    button.title = address || '';
    button.setAttribute('aria-label', address ? 'Connected wallet ' + address : disconnectedLabel);
  };

  async function authorizedAccounts() {
    return ethereum ? ethereum.request({method:'eth_accounts'}) : [];
  }

  show();
  button.disabled = false;
  button.onclick = async () => {
    button.disabled = true;
    feedback.textContent = '';
    try {
      if (!onConnect && !ethereum) throw new Error('Open this page in a browser with an Ethereum wallet.');
      const address = onConnect ? await onConnect() :
        (await ethereum.request({method:'eth_requestAccounts'}))[0];
      if (!address) throw new Error('No wallet account was selected.');
      show(address);
    } catch (error) {
      feedback.textContent = error.shortMessage || error.message;
    } finally {
      button.disabled = false;
    }
  };

  if (!onConnect) ethereum?.on?.('accountsChanged', accounts => show(accounts[0]));
  return authorizedAccounts().then(async accounts => {
    if (!accounts[0]) return;
    show(accounts[0]);
    if (onRestore) await onRestore(accounts[0]);
  }).catch(() => {});
}

if (document.querySelector('[data-wallet-header]')) setupWalletButton();
