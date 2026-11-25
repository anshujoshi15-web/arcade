// Compute the fixed local weekly schedule across Mountain daylight-saving changes.
const zone=new Intl.DateTimeFormat('en-US',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
function parts(ms){return Object.fromEntries(zone.formatToParts(ms).map(p=>[p.type,Number(p.value)]))}
function mountain(day,hour){let utc=day+hour*3600000;let guess=utc+7*3600000;let p=parts(guess);return (guess+utc-Date.UTC(p.year,p.month-1,p.day,p.hour))/1000}
export function weeklySchedule(monday){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(monday))throw Error('Expected YYYY-MM-DD');
  const day=Date.parse(monday+'T00:00:00Z');if(new Date(day).getUTCDay()!==1)throw Error('Choose a Monday');
  const sunday=day+6*86400000;
  return {opens:mountain(day,10),closes:mountain(sunday,18),drawAt:mountain(sunday,20)};
}
