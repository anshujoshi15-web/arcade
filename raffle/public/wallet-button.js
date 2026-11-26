export function setupWalletButton({
  onConnect, onWalletChange, local = false, disconnectedLabel = 'Connect wallet'
} = {}) {
  const button = document.getElementById('connect');
  const feedback = document.getElementById('wallet-feedback');
  const ethereum = window.ethereum;
  const show = address => {
    button.textContent = address ? address.slice(0, 6) + '…' + address.slice(-4) : disconnectedLabel;
    button.title = address || '';
    button.setAttribute('aria-label', address ? 'Connected wallet ' + address : disconnectedLabel);
  };
  const report = error => { feedback.textContent = error.shortMessage || error.message; };

  function connectInjected() {
    button.onclick = async () => {
      button.disabled = true;
      feedback.textContent = '';
      try {
        if (onConnect) show(await onConnect());
        else {
          if (!ethereum) throw new Error('Open House Arcade in your wallet app’s browser, or use a desktop wallet extension.');
          const [address] = await ethereum.request({method:'eth_requestAccounts'});
          show(address);
          await onWalletChange?.(address ? {address, provider:ethereum} : null);
        }
      } catch (error) {
        report(error);
      } finally {
        button.disabled = false;
      }
    };
    async function update(accounts) {
      show(accounts[0]);
      if (!onConnect) await onWalletChange?.(accounts[0] ? {address: accounts[0], provider: ethereum} : null);
    }
    if (!onConnect && ethereum) {
      const refresh = () => ethereum.request({method:'eth_accounts'}).then(update).catch(report);
      ethereum.on?.('accountsChanged', refresh);
      ethereum.on?.('chainChanged', refresh);
      void refresh();
    }
  }

  show();
  button.disabled = false;
  if (local) {
    connectInjected();
    return;
  }

  button.onclick = async () => {
    feedback.textContent = 'Loading wallet options…';
    await ready;
    feedback.textContent = '';
    await button.onclick();
  };
  const ready = import('/appkit.js').then(({appkit}) => {
    let connected = false;
    let lastConnection;
    const update = () => {
      const account = appkit.getAccount();
      const provider = appkit.getWalletProvider();
      connected = Boolean(account?.isConnected && account.address && provider);
      show(connected ? account.address : undefined);
      const connection = connected ? {address:account.address, provider, chainId:appkit.getChainId()} : null;
      if (connection === lastConnection || (connection && lastConnection &&
          connection.address === lastConnection.address && connection.provider === lastConnection.provider &&
          connection.chainId === lastConnection.chainId)) return;
      lastConnection = connection;
      if (onWalletChange) {
        feedback.textContent = '';
        Promise.resolve(onWalletChange(connection)).catch(report);
      }
    };
    appkit.subscribeAccount(update);
    appkit.subscribeNetwork(update);
    appkit.subscribeProviders(update);
    update();
    button.disabled = false;
    button.onclick = async () => {
      feedback.textContent = '';
      try { await appkit.open({view: connected ? 'Account' : 'Connect'}); }
      catch (error) { report(error); }
    };
  }).catch(error => {
    console.warn('Reown AppKit unavailable. Using the browser wallet.', error);
    connectInjected();
    button.disabled = false;
  });
}

if (document.querySelector('[data-wallet-header]')) setupWalletButton();
