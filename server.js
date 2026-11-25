process.env.HOUSE_ARCADE_HOSTED = '1';
import('./raffle/server.mjs').catch(error => {
  console.error(error);
  process.exitCode = 1;
});
