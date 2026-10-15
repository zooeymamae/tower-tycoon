/* Tower Tycoon background worker: opens the game, and drops new deals on your desk while the game is closed. */
importScripts("core.js");
const T=self.TT;
const GAME=chrome.runtime.getURL("game.html");

async function openGame(){
  const tabs=await chrome.tabs.query({url:GAME});
  if(tabs.length){await chrome.tabs.update(tabs[0].id,{active:true});await chrome.windows.update(tabs[0].windowId,{focused:true})}
  else await chrome.tabs.create({url:GAME});
}
chrome.action.onClicked.addListener(openGame);
chrome.runtime.onMessage.addListener(msg=>{if(msg?.type==="openGame")openGame()});
const ensureAlarm=()=>chrome.alarms.create("deals",{periodInMinutes:45,delayInMinutes:20});
chrome.runtime.onInstalled.addListener(d=>{ensureAlarm();if(d.reason==="install")openGame()});
chrome.runtime.onStartup.addListener(ensureAlarm);

chrome.alarms.onAlarm.addListener(async a=>{
  if(a.name!=="deals")return;
  const S=await T.loadState();if(!S||!S.tutorialDone||T.gameOpen(S))return;
  T.pruneDeals(S);
  if(S.deals.length>=3||Math.random()>.65){await T.saveState(S,"bg");return}
  const d=T.genDeal(S);await T.saveState(S,"bg");
  if(d&&S.settings.notify)chrome.notifications.create("deal-"+d.id,{type:"basic",iconUrl:"icons/icon128.png",
    title:`New deal: ${d.title}`,message:`${d.company} sent you an offer. Open Tower Tycoon to see it.`,priority:1});
});
chrome.notifications.onClicked.addListener(id=>{chrome.notifications.clear(id);openGame()});
