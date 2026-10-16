/* Tower Tycoon accounts: keeps one company in the cloud so it can be played on any device.
   Uses Firebase Authentication (email or username + password) and Cloud Firestore through their REST APIs,
   so no SDK is needed and it works the same on the website and in the Chrome extension.
   Each player's company lives at saves/{uid}. Firestore rules only let a player read and write their own. */
(()=>{
const C=globalThis.TT_CLOUD||{};
const AUTH=C.authBase||"https://identitytoolkit.googleapis.com/v1";
const TOKEN=C.tokenBase||"https://securetoken.googleapis.com/v1";
const DB=C.dbBase||"https://firestore.googleapis.com/v1";
const AKEY="towerTycoonAccount";
const hasChrome=typeof chrome!=="undefined"&&chrome.storage&&chrome.storage.local;
const ready=!!(C.apiKey&&C.projectId);
let acct=null;

async function loadAcct(){try{if(hasChrome){const r=await chrome.storage.local.get(AKEY);acct=r[AKEY]||null}else acct=JSON.parse(localStorage.getItem(AKEY)||"null")}catch(e){acct=null}return acct}
async function storeAcct(){try{if(hasChrome){if(acct)await chrome.storage.local.set({[AKEY]:acct});else await chrome.storage.local.remove(AKEY)}
  else{if(acct)localStorage.setItem(AKEY,JSON.stringify(acct));else localStorage.removeItem(AKEY)}}catch(e){}}

/* Names without an @ become a private sign-in address, so players can just pick a username. */
const USER_DOMAIN="players.towertycoon.app";
function toEmail(name){name=String(name||"").trim();if(name.includes("@"))return name.toLowerCase();
  const u=name.toLowerCase().replace(/[^a-z0-9._-]/g,"");return u?u+"@"+USER_DOMAIN:""}
const shown=email=>email.endsWith("@"+USER_DOMAIN)?email.slice(0,-USER_DOMAIN.length-1):email;

const MSG={EMAIL_EXISTS:"That name is taken. Pick another, or sign in if it's yours.",
  INVALID_LOGIN_CREDENTIALS:"Wrong name or password.",INVALID_PASSWORD:"Wrong name or password.",EMAIL_NOT_FOUND:"Wrong name or password.",
  WEAK_PASSWORD:"Use a password with at least 6 characters.",INVALID_EMAIL:"Use letters, numbers, dots or dashes in your name.",
  MISSING_PASSWORD:"Type a password.",TOO_MANY_ATTEMPTS_TRY_LATER:"Too many tries. Wait a few minutes and try again.",
  USER_DISABLED:"This account has been turned off.",OPERATION_NOT_ALLOWED:"Accounts aren't switched on yet. In Firebase, turn on Email/Password sign-in.",
  TOKEN_EXPIRED:"Please sign in again.",INVALID_REFRESH_TOKEN:"Please sign in again.",USER_NOT_FOUND:"Please sign in again."};
function errText(code){code=String(code||"");const k=Object.keys(MSG).find(k=>code.startsWith(k));return k?MSG[k]:"Couldn't reach the save server. Check your connection and try again."}

async function call(url,opt){let r;try{r=await fetch(url,opt)}catch(e){throw new Error("Couldn't reach the save server. Check your connection and try again.")}
  let j={};try{j=await r.json()}catch(e){}
  if(!r.ok){const e=new Error(errText(j.error?.message||j.error?.status));e.status=r.status;e.code=j.error?.status||j.error?.message;throw e}return j}

async function signIn(name,password,create){if(!ready)throw new Error("Accounts aren't set up on this copy of the game yet.");
  const email=toEmail(name);if(!email)throw new Error("Type a name or email.");if(!password)throw new Error("Type a password.");
  const j=await call(`${AUTH}/accounts:${create?"signUp":"signInWithPassword"}?key=${C.apiKey}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password,returnSecureToken:true})});
  acct={uid:j.localId,email,idToken:j.idToken,refreshToken:j.refreshToken,exp:Date.now()+(+j.expiresIn||3600)*1000,base:null,lastSync:0};
  await storeAcct();return acct}

async function token(){if(!acct)throw new Error("Not signed in.");if(Date.now()<acct.exp-120e3)return acct.idToken;
  try{const j=await call(`${TOKEN}/token?key=${C.apiKey}`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=refresh_token&refresh_token="+encodeURIComponent(acct.refreshToken)});
    acct.idToken=j.id_token;acct.refreshToken=j.refresh_token;acct.exp=Date.now()+(+j.expires_in||3600)*1000;await storeAcct();return acct.idToken}
  catch(e){if(e.status===400){acct.expired=true;await storeAcct()}throw e}}

const docUrl=()=>`${DB}/projects/${C.projectId}/databases/(default)/documents/saves/${acct.uid}`;
const num=v=>v?+(v.integerValue??v.doubleValue??0):0;
function parse(d){const f=d.fields||{};return{code:f.code?.stringValue||"",at:num(f.at),nw:num(f.nw),rank:f.rank?.stringValue||"",device:f.device?.stringValue||"",updateTime:d.updateTime}}

/* Read the company stored in the cloud (null when there isn't one yet). */
async function pull(){const tk=await token();
  try{return parse(await call(docUrl(),{headers:{Authorization:"Bearer "+tk}}))}catch(e){if(e.status===404)return null;throw e}}

/* Save a company to the cloud. It only overwrites the save this device last saw,
   so two devices playing at once can't silently wipe each other's progress. */
async function push(S,{force=false,keepalive=false}={}){const tk=await token();const T=globalThis.TT;
  const code=T.exportCode(S),at=Date.now();
  const body={fields:{code:{stringValue:code},at:{integerValue:String(at)},nw:{doubleValue:T.netWorth(S)},rank:{stringValue:T.rank(S)},device:{stringValue:deviceName()}}};
  let q="";if(!force)q=acct.base?"?currentDocument.updateTime="+encodeURIComponent(acct.base):"?currentDocument.exists=false";
  const opt={method:"PATCH",headers:{Authorization:"Bearer "+tk,"Content-Type":"application/json"},body:JSON.stringify(body)};
  if(keepalive&&opt.body.length<60000)opt.keepalive=true;
  try{const d=await call(docUrl()+q,opt);acct.base=d.updateTime;acct.lastSync=at;await storeAcct();return{ok:true}}
  catch(e){if(e.status===400&&/FAILED_PRECONDITION/.test(e.code||"")||e.status===409||e.status===404&&!force){return{conflict:await pull()}}throw e}}

async function adopt(remote){acct.base=remote?remote.updateTime:null;acct.lastSync=Date.now();await storeAcct()}
async function signOut(){acct=null;await storeAcct()}

function deviceName(){const u=navigator.userAgent;const os=/iPhone|iPad/.test(u)?"iPhone/iPad":/Android/.test(u)?"Android":/CrOS/.test(u)?"Chromebook":/Mac/.test(u)?"Mac":/Windows/.test(u)?"Windows":/Linux/.test(u)?"Linux":"computer";
  return(hasChrome?"Extension":"Website")+" on "+os}

globalThis.Cloud={ready,loadAcct,signIn,signOut,pull,push,adopt,toEmail,shown,deviceName,get acct(){return acct}};
})();
