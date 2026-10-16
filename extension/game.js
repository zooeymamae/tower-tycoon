/* Tower Tycoon game page v3: runs the live sim and the management UI */
/* if anything breaks, say so on screen instead of silently freezing */
(()=>{let shown=0;const show=m=>{if(shown++>2)return;let d=document.getElementById("crash");if(!d){d=document.createElement("div");d.id="crash";
  d.style.cssText="position:fixed;left:8px;right:8px;bottom:8px;z-index:9999;background:#2a0f14;color:#ffd0d6;border:3px solid #ff5d6c;padding:10px;font:14px monospace;white-space:pre-wrap;max-height:40vh;overflow:auto";document.body.appendChild(d)}
  d.textContent="Something broke. Try reloading (for the extension: reload it in chrome://extensions after replacing ALL its files). Send this to fix it:\n\n"+m}
  addEventListener("error",e=>show((e.message||"")+"\n"+(e.error?.stack||"").split("\n").slice(0,4).join("\n")));
  addEventListener("unhandledrejection",e=>show(String(e.reason?.stack||e.reason).split("\n").slice(0,4).join("\n")))})();
(async()=>{
const T=globalThis.TT,$=s=>document.querySelector(s),money=T.money;
// pages from older versions may be missing newer elements: add them so new code never trips over them
if(!globalThis.Cloud){const load=src=>new Promise(r=>{const sc=document.createElement("script");sc.src=src;sc.onload=sc.onerror=r;document.head.appendChild(sc)});await load("cloud-config.js");await load("cloud.js")}
if(!globalThis.Cloud)globalThis.Cloud={ready:false,acct:null,loadAcct:async()=>null,shown:x=>x,deviceName:()=>""};
if(!$("#world")){const c=document.createElement("canvas");c.id="world";c.setAttribute("aria-hidden","true");document.body.prepend(c)}
if(!$("#street")){const c=document.createElement("canvas");c.id="street";c.setAttribute("aria-hidden","true");$("#world").after(c)}
if(!$("#tower-hint")){const h=document.querySelector(".towerbox .hint");if(h)h.id="tower-hint";else{const d=document.createElement("div");d.id="tower-hint";d.className="hint";$("#towerbox")?.appendChild(d)}}
const ME="game-"+Math.random().toString(36).slice(2,7);
let hideAt=0;
let S=await T.loadState()||T.fresh();
await Cloud.loadAcct();
const bootBeat=S.heartbeat||0;
const rt=T.newRT();
let tab="floor",sel=0,mktSel="PXLS",dirty=true,lastSig="",pointerDown=false,armed={};
const hasNotif=typeof chrome!=="undefined"&&chrome.notifications;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const first=e=>e.name.split(" ")[0];

/* ---------- tower view ---------- */
const curShop=()=>S.curShop&&S.shops?.[S.curShop]?S.curShop:null;
const view=new TowerView($("#tower"),()=>S,()=>S.cur,{minH:200,getRT:()=>rt,getTime:()=>((Date.now()/240000)+.3)%1,getShop:curShop,transparent:true,fit:$("#towerscroll")});
if(globalThis.WorldView)new WorldView($("#world"),view,$("#street"));
view.sel=sel;
$("#tower").addEventListener("click",e=>{if(curShop()){SFX.play("click");return setTab("floor")}const i=view.hit(e.clientY);if(i<0)return;sel=i;view.sel=i;
  const f=S.lots[S.cur].floors[i];if(T.isBiz(f.type)&&f.register>0&&!f.manager)collect(S.cur,i);else SFX.play("click");setTab("floor")});
$("#earn-toggle").onclick=()=>{view.showEarnings=!view.showEarnings;$("#earn-toggle").setAttribute("aria-pressed",view.showEarnings);SFX.play("click")};
$("#collect-all").onclick=()=>{if(curShop())return ACT.shoppromo({k:curShop()});let tot=0;S.lots[S.cur].floors.forEach((f,i)=>{if(T.isBiz(f.type)&&f.register>0){tot+=f.register;view.collected(i,f.register);S.cash+=f.register;f.register=0}});
  if(tot>0){SFX.play("cash");floatCash();save()}else SFX.play("click")};
const owned=()=>T.LOTS.filter(l=>S.lots[l.id]);
$("#add-floor").onclick=()=>{if(curShop())return ACT.buyshop({k:curShop()});const L0=S.lots[S.cur];if(L0.floors.length>=T.maxFloors(S))return toast("Floor limit reached. Rank up to add more floors.");
  const c=T.floorCost(S,S.cur);if(S.cash<c)return toast(`A new floor costs ${money(c)}.`);S.cash-=c;S.spent+=c;L0.floors.push({type:null});sel=L0.floors.length-1;view.sel=sel;view.construct(sel);
  T.log(S,`Added floor ${L0.floors.length} at ${T.lotDef(S.cur).name}.`);SFX.play("build");toast("New floor! Pick what goes on it.");save();setTab("floor")};
function goEmptyFloor(){for(const[lot,L0]of Object.entries(S.lots)){const i=L0.floors.findIndex(f=>!f.type);if(i>=0){if(lot!==S.cur)goLot(lot);sel=i;view.sel=i;setTab("floor");return true}}
  toast("No empty floors. Use + FLOOR under your tower first.");return false}
function toBottom(){requestAnimationFrame(()=>requestAnimationFrame(()=>{const ts=$("#towerscroll");ts.scrollTop=ts.scrollHeight}))}
function goLot(id){S.curShop=null;S.cur=id;sel=0;TU.lot=null;view.sel=0;view.rebuild();toBottom();SFX.play("click");save();render()}
/* the ◀ ▶ arrows step through every tower, then every shop */
const places=()=>[...owned().map(l=>({t:"lot",id:l.id})),...Object.keys(T.SHOPS).filter(k=>S.shops?.[k]).map(k=>({t:"shop",id:k}))];
function goShop(k){S.curShop=k;view.rebuild();SFX.play("click");save();setTab("floor")}
function stepPlace(d){const P=places(),cs=curShop(),i=P.findIndex(p=>cs?p.t==="shop"&&p.id===cs:p.t==="lot"&&p.id===S.cur),n=P[(i+d+P.length)%P.length];
  if(n.t==="shop")goShop(n.id);else goLot(n.id)}
$("#lot-prev").onclick=()=>stepPlace(-1);
$("#lot-next").onclick=()=>stepPlace(1);
function collect(lot,i){const f=S.lots[lot].floors[i],amt=f.register;if(!amt)return;S.cash+=amt;f.register=0;if(lot===S.cur)view.collected(i,amt);SFX.play("coin");floatCash();save()}
function floatCash(){const h=$("#hud .cash");h.classList.remove("flash");void h.offsetWidth;h.classList.add("flash")}

/* ---------- persistence ---------- */
let saveT=null;
function save(){clearTimeout(saveT);saveT=setTimeout(saveNow,400)}
function saveNow(){clearTimeout(saveT);S.heartbeat=Date.now();return T.saveState(S,ME)}
setInterval(saveNow,5000);
setInterval(()=>{if(!document.hidden)cloudSync()},60000);
addEventListener("resize",()=>view.fit());
document.addEventListener("visibilitychange",()=>{if(document.hidden){hideAt=Date.now();saveNow();cloudSync({keepalive:true})}else cloudStart(hideAt)});
addEventListener("pagehide",()=>saveNow());
async function processActions(){const acts=await T.takeActions();for(const a of acts){
  if(a.type==="deal"){const r=a.yes?T.applyDeal(S,a.id):(T.declineDeal(S,a.id),{ok:true,msg:"Passed on the deal."});note({kind:r.ok?"good":"bad",title:a.yes?(r.ok?"DEAL CLOSED":"DEAL FAILED"):"DEAL PASSED",text:r.msg,sfx:r.ok&&a.yes?"deal":"click"})}
  if(a.type==="gendeal"){const d=T.genDeal(S);if(d)note({kind:"deal",title:"NEW BUSINESS DEAL",text:`${d.company}: ${d.title}`,sfx:"alert"})}}
  if(acts.length){dirty=true;saveNow()}}
T.onActions(processActions);

/* ---------- feedback ---------- */
function toast(m){document.querySelectorAll(".toast").forEach(t=>t.remove());const t=document.createElement("div");t.className="toast";t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),2600)}
function note(n){if(n.sfx)SFX.play(n.sfx);
  const el=document.createElement("div");el.className="note "+n.kind;el.innerHTML="<b></b><p></p>";el.querySelector("b").textContent=n.title;el.querySelector("p").textContent=n.text;
  el.onclick=()=>{if(n.kind==="deal"||/UNHAPPY/.test(n.title))setTab("inbox");else if(/LEVEL/.test(n.title))setTab("team");el.classList.add("out");setTimeout(()=>el.remove(),300)};
  const box=$("#notes");box.prepend(el);while(box.children.length>3)box.lastChild.remove();
  setTimeout(()=>{el.classList.add("out");setTimeout(()=>el.remove(),300)},n.kind==="milestone"?8000:5000);
  if(n.kind==="milestone"){const h=$("#hud .rank");h.classList.remove("flash");void h.offsetWidth;h.classList.add("flash")}
  if(document.hidden&&S.settings.notify&&hasNotif&&["big","milestone","deal","bad"].includes(n.kind))try{chrome.notifications.create({type:"basic",iconUrl:"icons/icon128.png",title:"Tower Tycoon: "+n.title,message:n.text,priority:1})}catch(e){}}

/* ---------- live values ---------- */
let LIVE={},lk=0;
const L=(fn,cls="")=>{const k="l"+(lk++);LIVE[k]=fn;return`<span data-live="${k}" class="${cls}"></span>`};
const cost=c=>`data-cost="${c}" ${S.cash<c?"disabled":""}`;
const Wb=(fn,col)=>{const k="w"+(lk++);LIVE[k]=fn;const dyn=col==="energy";return`<div class="bar"><i data-w="${k}" ${dyn?'data-dyn="1"':""} style="background:${dyn?"var(--green)":col||"var(--green)"}"></i></div>`};
function live(){document.querySelectorAll("[data-live]").forEach(el=>{const f=LIVE[el.dataset.live];if(f){const v=f();if(typeof v==="object"){el.innerHTML=v.html}else if(el.textContent!==String(v))el.textContent=v}});
  document.querySelectorAll("[data-cost]").forEach(b=>{b.disabled=S.cash<+b.dataset.cost});
  document.querySelectorAll("[data-w]").forEach(el=>{const f=LIVE[el.dataset.w];if(f){const v=f();el.style.width=Math.max(0,Math.min(100,v))+"%";if(el.dataset.dyn)el.style.background=v<25?"var(--red)":v<50?"var(--gold)":"var(--green)"}})}

/* ---------- helpers ---------- */
const starsHTML=r=>{const n=Math.round(r);return`<span class="stars-big">${"★".repeat(n)}<span class="off">${"★".repeat(5-n)}</span></span>`};
const moodWord=m=>m>=70?["HAPPY","var(--green)"]:m>=45?["OKAY","var(--ink)"]:m>=25?["LOW","var(--gold)"]:["UPSET","var(--red)"];
const shirtOf=e=>{if(e.role==="manager")return"#22223a";if(e.role==="broker")return"#2fbf71";if(e.role==="hr")return"#e8e0c8";const f=e.loc&&S.lots[e.loc.lot]?.floors[e.loc.i];return f&&f.type?T.KINDS[f.type].color:"#6a6a8a"};
const ava=(e,lg)=>`<div class="ava${lg?" lg":""}" aria-hidden="true"><i class="h" style="background:${e.hair}"></i><i class="f" style="background:${e.skin}"></i><i class="e1"></i><i class="e2"></i><i class="s" style="background:${shirtOf(e)}"></i><i class="l"></i></div>`;
function where(e){if(e.role==="broker")return"Investing your money as a broker";if(e.role==="hr")return"Running HR from the HR Office";if(e.state==="break")return"Resting in the lounge";if(e.state==="train")return"In training";
  if(!e.loc)return"Not assigned";const f=S.lots[e.loc.lot]?.floors[e.loc.i];if(!f)return"Not assigned";
  return e.loc.mgr?`Managing the ${T.BIZ[f.type].name} at ${T.lotDef(e.loc.lot).name}`:`${T.BIZ[f.type].name} at ${T.lotDef(e.loc.lot).name}, station ${e.loc.slot+1}`}
function moodWhy(e){const r=[],fair=T.fairPay(e);
  if(e.salary<fair*.95)r.push(`feels underpaid (fair is ${money(fair)}/min)`);
  if(e.energy<25)r.push("is exhausted");
  if(e.loc&&!e.loc.mgr&&S.lots[e.loc.lot]?.floors[e.loc.i]?.type===e.fav)r.push(`loves working at the ${T.BIZ[e.fav].name}`);
  if(Date.now()-e.praisedAt<300e3)r.push("feels appreciated");
  if(e.state==="idle")r.push("is bored with nothing to do");
  if(e.role!=="staff")r.push(`is proud to be ${e.role==="hr"?"HR Director":"a "+ROLE_NAME[e.role].toLowerCase()}`);
  if(T.hrActive(S)&&e.role!=="hr")r.push("feels looked after by HR");
  if(S.cash<0)r.push("is worried about the company's money");
  return r}
function floorStats(lot,i,f){const r=T.frt(rt,lot,i,f),w=r.waits.length?r.waits.reduce((a,b)=>a+b,0)/r.waits.length:0;
  return{r,arr:T.arrivalsPerMin(S,lot,f),cap:T.capacityPerMin(S,lot,i,f),served:r.served.length,walk:r.walk.length,wait:w,pm:r.earn.reduce((a,e)=>a+e[1],0),
    queue:r.cust.filter(c=>c.s==="q"||c.s==="in").length,staffed:f.staff.filter((x,k)=>T.present(S,lot,i,f,k)).length,assigned:f.staff.filter(Boolean).length}}
function diagnose(lot,i,f){const s=floorStats(lot,i,f),cap=T.registerCap(S,lot,f),tired=f.staff.map(id=>T.emp(S,id)).filter(e=>e&&e.energy<25).length;
  const T0=T.TIERS[f.price];
  if(!s.assigned)return["bad","NOBODY IS WORKING HERE","Customers are lining up but no one can serve them. Assign an employee to a station below."];
  if(!s.staffed)return["warn","YOUR STAFF STEPPED AWAY","Everyone here is on a break or training right now. Customers will wait until they return."];
  if(f.register>=cap*.98&&!f.manager)return["bad","THE REGISTER IS FULL","Money is being lost right now. Tap this floor on the tower to collect it, or promote a manager to collect automatically."];
  if(tired&&T.findSupport(S,lot,"lounge")<0)return["warn","YOUR STAFF ARE EXHAUSTED",`${tired} worker${tired>1?"s are":" is"} running on empty and serving slowly. Build a Staff Lounge in this tower so they can rest on their own.`];
  if(s.walk>=3||s.queue>=7)return["warn","CUSTOMERS ARE GIVING UP",`${s.walk} customer${s.walk===1?"":"s"} left without being served in the last 5 minutes. Add a station, assign faster staff, or raise prices to thin the crowd.`];
  if(f.price>=2&&f.decor<T0.expect)return["warn","IT FEELS OVERPRICED",`${T0.name} customers expect decor level ${T0.expect}+. Upgrade the decor or lower prices to stop the bad reviews.`];
  if(s.cap>s.arr*1.6&&s.arr>0)return["warn","YOUR STAFF HAVE TIME ON THEIR HANDS","More staff than customers. Draw a bigger crowd with decor, a Marketing floor, or lower prices, or move someone to a busier floor."];
  if(f.register>=cap*.6&&!f.manager)return["warn","REGISTER FILLING UP","Collect soon so you don't lose money. A manager would handle this for you."];
  if(f.rating>=4.2)return["good","CUSTOMERS LOVE THIS PLACE","Running beautifully. Keep the team rested and happy."];
  return["good","RUNNING SMOOTHLY","Customers are being served. Watch the reviews to see what they think."]}

/* ---------- tabs & render ---------- */
function setTab(t){tab=t;document.querySelectorAll("#tabs button").forEach(b=>b.setAttribute("aria-selected",b.dataset.tab===t));dirty=true;render();$("#body").scrollTop=0}
document.querySelectorAll("#tabs button").forEach(b=>b.onclick=()=>{SFX.play("click");setTab(b.dataset.tab)});
const V={};
function render(){LIVE={};lk=0;const b=$("#body"),st=b.scrollTop;b.innerHTML=V[tab]();
  if(tab==="team"&&TU.q.trim()){const q=TU.q.trim().toLowerCase();b.querySelectorAll(".erow").forEach(r=>r.hidden=!r.dataset.name.includes(q))}
  b.scrollTop=st;live();lastSig=sig();dirty=false;hud()}
function sig(){
  if(tab==="floor"&&curShop())return JSON.stringify(["shop",curShop(),S.shops[curShop()],Object.keys(armed)]).replace(/"earned":[\d.e+]+,?/g,"");
  if(tab==="floor"){const f=S.lots[S.cur].floors[sel];return JSON.stringify([S.cur,sel,f,S.emps.map(e=>[e.id,e.state,e.loc,e.lvl]),S.goalIdx].map(x=>x===undefined?0:x)).replace(/"register":[\d.]+,|"rating":[\d.]+,|"served":\d+,/g,"")}
  if(tab==="team")return JSON.stringify([TU,S.emps.map(e=>[e.id,e.state,e.loc,e.lvl,e.pts,e.salary,e.role,e.promoReady,Math.round(e.mood/10),e.spd,e.chr,e.sta,praiseReady(e)]),S.applicants.map(a=>a.id),T.staffCap(S),S.hr,TU.sub==="hr"?S.hrLog[0]?.at:0,Object.keys(armed)]);
  if(tab==="inbox")return JSON.stringify([S.inbox.map(x=>x.id),S.deals.map(x=>x.id)]);
  if(tab==="market")return JSON.stringify([mktSub,S.stocks.map(s=>[s.p,s.rating,s.preview,s.earnIn]),S.port,S.basis,S.orders,Math.floor(Math.log(Math.max(1,S.cash))*15),S.tips,mktSel,S.fund.alloc,S.fund.hist.length,S.fund.log[0]?.at,S.emps.filter(e=>e.role==="broker").map(e=>[e.id,e.strat,e.sector]),Object.keys(S.fund.pos),T.brokerCap(S),S.mkt.news[0]?.id,S.mkt.news.map(n=>n.in).join(""),Math.floor((Date.now()-(S.mkt.news[0]?.at||0))/60000)]);
  if(tab==="land")return JSON.stringify([Object.keys(armed),Object.keys(S.lots),S.cur,S.landDiscount,S.shops]).replace(/"earned":[\d.e+]+,?/g,"");
  if(tab==="money")return String(S.chart.length)+Math.floor(Date.now()/10000);
  if(tab==="records")return String(S.goalIdx)+Math.floor(Date.now()/10000);
  return tab+JSON.stringify(S.settings)+(armed.reset||0)+(armed.imp||0)+saveUI.code.length+"|"+saveUI.at+"|"+(saveUI.imp.trim()?1:0)+"|"+cloudSig()}

function hud(){
  $("#h-cash").textContent=money(S.cash);
  const pm=T.perMin(rt)-T.wagesPerMin(S)+T.contractPerMin(S);$("#h-inc").textContent=(pm>=0?"+":"")+money(pm);$("#h-inc").style.color=pm<0?"var(--red)":"";
  $("#h-nw").textContent=money(T.netWorth(S));$("#h-rate").textContent="★ "+T.avgRating(S).toFixed(1);
  if(curShop()){$("#h-team").textContent=`${S.emps.length}`;$("#h-team").style.color="";$("#hud .team b").textContent="TEAM (ALL)"}
  else{const n=T.headcount(S,S.cur),c=T.staffCap(S,S.cur);$("#h-team").textContent=`${n} / ${c}`;$("#h-team").style.color=n>c?"var(--red)":"";$("#hud .team b").textContent=owned().length>1?"TEAM HERE":"TEAM"}$("#h-rank").textContent=T.rank(S);
  const multi=places().length>1;$("#lot-prev").disabled=!multi;$("#lot-next").disabled=!multi;
  const cs=curShop();document.body.classList.toggle("shopmode",!!cs);
  if(cs){const D=T.SHOPS[cs],sh=S.shops[cs],c=T.shopCost(S,cs);$("#lot-name").textContent=shopName(cs);$("#lot-bonus").textContent=`${D.name} · runs itself · ${money(T.shopInc(S,cs))}/min`;
    const cb=$("#collect-all"),pr=(sh.promoReady||0)-Date.now();cb.textContent=T.promoOn(S,cs)?"PROMO ON "+Math.ceil((sh.promoUntil-Date.now())/1000)+"s":pr>0?"PROMO IN "+Math.ceil(pr/60e3)+"m":"RUN PROMO";cb.disabled=pr>0;
    const b=$("#add-floor"),mx=sh.lvl>=T.SHOP_MAX;b.textContent=mx?"MAX LEVEL":"UPGRADE "+money(c);b.disabled=mx||S.cash<c;b.title=mx?"Fully upgraded":"Upgrade this shop";
    $("#tower-hint").textContent="Shops run themselves. Tap it, or open FLOOR, to manage it.";}
  else{
  const lot=T.lotDef(S.cur);$("#lot-name").textContent=lot.name;$("#lot-bonus").textContent=lot.blurb;$("#tower-hint").textContent="Tap a floor to manage it and empty its register.";
  const reg=S.lots[S.cur].floors.reduce((a,f)=>a+(T.isBiz(f.type)&&!f.manager?f.register:0),0);$("#collect-all").textContent="COLLECT "+money(reg);$("#collect-all").disabled=reg<1;
  {const L0=S.lots[S.cur],cap=L0.floors.length>=T.maxFloors(S),c=T.floorCost(S,S.cur),b=$("#add-floor");b.textContent=cap?"MAX FLOORS":"+ FLOOR "+money(c);b.disabled=cap||S.cash<c;b.title=cap?"Rank up to add more floors":"Add an empty floor to this tower"}}
  const ib=$("#inbox-badge"),n=S.inbox.length+S.deals.length;ib.hidden=!n;ib.textContent=n;
  const tb=$("#team-badge"),m=S.emps.filter(e=>e.pts>0||e.mood<30||(e.promoReady&&e.role==="staff")).length;tb.hidden=!m;tb.textContent=m;
}

/* ===== FLOOR ===== */
function estNew(type,lot){const B=T.BIZ[type],cap=60/(B.time/.96),arr=B.arrive*.89*T.hypeMult(S)*(1+.15*T.lotSum(S,lot,"marketing"));return Math.min(cap,arr)*B.price*T.lotMult(lot,type)}
V.floor=()=>{if(curShop())return vShopDetail(curShop());
  const lot=S.cur,L0=S.lots[lot];if(sel>=L0.floors.length)sel=0;view.sel=sel;const f=L0.floors[sel];
  const body=!f.type?vEmpty(lot):T.isBiz(f.type)?vBiz(lot,sel,f):vSupport(lot,sel,f);
  return towerRow(lot)+body};
function towerRow(lot){const L0=S.lots[lot],n=L0.floors.length,mx=T.maxFloors(S),c=T.floorCost(S,lot),next=T.RANKS[Math.min(T.RANKS.length-1,S.goalIdx+1)];
  return`<div class="towerrow"><span><b>${T.lotDef(lot).name.toUpperCase()}</b> · ${n} of ${mx} floors</span>${n<mx?`<button class="cyan" data-act="addfloor" ${cost(c)}>+ ADD FLOOR ${money(c)}</button>`:`<span class="muted">Reach ${next} for another floor</span>`}</div>`}
function vEmpty(lot){
  let h=`<div class="head"><h2>FLOOR ${sel+1} · EMPTY</h2><span class="pill">${T.lotDef(lot).name.toUpperCase()}</span></div>
  <div class="muted">What should go here? Businesses earn money from customers. Support floors make your team and businesses better.</div><div class="sec"><h3>BUSINESSES</h3><div class="grid2">`;
  const biz=Object.entries(T.BIZ).filter(([k])=>T.allowedHere(k,lot)).sort((a,b)=>(!!b[1].only)-(!!a[1].only));
  for(const[k,B]of biz){const c=T.buildCost(k,lot),ok=T.unlocked(S,k),m=T.lotMult(lot,k);
    h+=`<div class="card${B.only?" excl":""}" style="${ok?"":"opacity:.55"}"><div class="row spread"><span><span class="swatch" style="background:${B.color}"></span> <b>${B.name}</b></span>${B.only?`<span class="pill" style="color:var(--gold)">ONLY HERE</span>`:m>1?`<span class="pill" style="color:var(--green)">×${m.toFixed(1)} HERE</span>`:""}</div>
    <div class="muted">${B.desc}</div><div>${money(B.price*m)} per customer · ${B.time}s each</div><div class="up">About ${money(estNew(k,lot))}/min with one employee</div>
    ${ok?`<button data-act="build" data-t="${k}" ${cost(c)}>OPEN IT ${money(c)}</button>`:`<button disabled>REACH ${T.RANKS[B.rank].toUpperCase()}</button>`}</div>`}
  h+=`</div></div><div class="sec"><h3>SUPPORT FLOORS</h3><div class="grid2">`;
  for(const[k,B]of Object.entries(T.SUPPORT)){const c=T.buildCost(k,lot),have=T.findSupport(S,lot,k)>=0,ok=T.allowedHere(k,lot);
    if(!ok&&B.minLot!=null){h+=`<div class="card" style="opacity:.5"><div><span class="swatch" style="background:${B.color}"></span> <b>${B.name}</b></div><div class="muted">${B.desc}</div><button disabled>${T.LOTS[B.minLot].name.toUpperCase()} AND UP</button></div>`;continue}
    h+=`<div class="card${B.minLot!=null?" excl":""}"><div class="row spread"><span><span class="swatch" style="background:${B.color}"></span> <b>${B.name}</b></span>${B.minLot!=null?`<span class="pill" style="color:var(--gold)">UPSCALE</span>`:""}</div><div class="muted">${B.desc}</div>${have&&(k==="lounge"||k==="marketing")?`<div class="muted">This tower already has one. Upgrading it is usually better.</div>`:""}
    <button data-act="build" data-t="${k}" ${cost(c)}>BUILD ${money(c)}</button></div>`}
  return h+`</div></div>`}
function vBiz(lot,i,f){
  const B=T.BIZ[f.type],d=diagnose(lot,i,f),cap=T.registerCap(S,lot,f),stats=()=>floorStats(lot,i,f);
  let h=`<div class="head"><div><h2>${B.name.toUpperCase()} · FLOOR ${i+1}</h2><div class="muted">${T.lotDef(lot).name} · ${f.served.toLocaleString()} customers served</div></div>
    <div style="text-align:right">${L(()=>({html:starsHTML(f.rating)}))}<div>${L(()=>f.rating.toFixed(2)+" rating")}</div></div></div>`;
  h+=`<div class="why ${d[0]}"><div><b>${L(()=>diagnose(lot,i,f)[1])}</b>${L(()=>diagnose(lot,i,f)[2])}</div></div>`;
  h+=L(()=>{const r=rt.f[lot+":"+i],g=r?r.cust.filter(c=>c.sp&&c.s!=="out"):[];
    return{html:g.length?`<div class="guests">${g.map(c=>`<span class="g-${c.sp}">${{critic:"★ FOOD CRITIC",celeb:"$ CELEBRITY",influencer:"♥ INFLUENCER"}[c.sp]} <i>${esc(c.name)}</i>${c.s==="at"?" · being served":" · waiting "+Math.round(c.w)+"s"}</span>`).join("")}</div>`:""}});
  h+=`<div class="tiles">
    <div class="tile"><span>Arriving</span><b>${L(()=>stats().arr.toFixed(1)+" / min")}</b></div>
    <div class="tile"><span>Can serve</span><b>${L(()=>stats().cap.toFixed(1)+" / min")}</b></div>
    <div class="tile"><span>In line</span><b>${L(()=>stats().queue+" waiting")}</b></div>
    <div class="tile"><span>Walked out (5m)</span><b>${L(()=>String(stats().walk))}</b></div>
    <div class="tile"><span>Average wait</span><b>${L(()=>stats().wait.toFixed(0)+"s")}</b></div>
    <div class="tile"><span>Earning</span><b class="up">${L(()=>money(stats().pm)+" / min")}</b></div></div>`;
  h+=`<div class="sec"><h3>REGISTER</h3><div class="row spread"><span>${L(()=>money(f.register)+" of "+money(T.registerCap(S,lot,f)))}</span>
    ${f.manager?`<span class="up">Your manager collects automatically.</span>`:`<button class="green" data-act="collect">COLLECT</button>`}</div>${Wb(()=>f.register/T.registerCap(S,lot,f)*100,"var(--gold)")}</div>`;
  // stations
  h+=`<div class="sec"><h3>STATIONS ${f.stations}/${T.MAX_ST}</h3><div class="muted">Each station serves one customer at a time and needs one employee (5 max). Speed makes service faster, charm makes customers happier (and tip more), stamina keeps them going.</div>`;
  for(let k=0;k<f.stations;k++){const e=T.emp(S,f.staff[k]);
    if(e){h+=`<div class="slot">${ava(e)}<div class="who"><b>${esc(e.name)} <span class="muted">Lv${e.lvl}</span></b>
      <div class="muted">${L(()=>e.state==="work"?(e.energy<25?"Exhausted, working slowly":"Working"):e.state==="break"?"Resting in the lounge":e.state==="train"?"In training":"Away")} · SPD ${e.spd} CHR ${e.chr} STA ${e.sta}${e.fav===f.type?" · <span style='color:var(--pink)'>♥ loves this place</span>":""}</div>
      <div class="minibars"><span>Energy</span>${Wb(()=>e.energy,"energy")}<span>Mood</span>${Wb(()=>e.mood,"var(--pink)")}</div></div>
      <div class="acts"><button class="ghost" data-act="praise" data-id="${e.id}" ${Date.now()-e.praisedAt<300e3?"disabled":""}>PRAISE</button><button class="ghost" data-act="unassign" data-id="${e.id}">REMOVE</button></div></div>`}
    else h+=`<div class="slot empty"><div class="ava" style="opacity:.3"><i class="s" style="background:#3d3a6e"></i></div><div class="who"><b>Empty station ${k+1}</b><div class="muted">Customers can't be served here until someone works it.</div></div>
      <div class="acts">${assignSelect(lot,i,k)}</div></div>`}
  if(f.stations<T.MAX_ST){const c=T.stationCost(f,lot);h+=`<div class="row"><button class="cyan" data-act="station" ${cost(c)}>ADD STATION ${money(c)}</button><span class="muted">Serve one more customer at a time.</span></div>`}
  h+=`</div>`;
  // manager
  const m=T.emp(S,f.manager);
  h+=`<div class="sec"><h3>MANAGER</h3>`;
  if(m){const ab={rush:["RUSH HOUR","Double customers for 60 seconds"],happy:["HAPPY HOUR","+50% revenue for 60 seconds"],pep:["PEP TALK","Every worker here gets full energy and a mood boost"]}[m.ability];
    h+=`<div class="slot">${ava(m)}<div class="who"><b>${esc(m.name)} <span class="muted">Manager</span></b><div class="muted">Collects the register, makes staff 10% faster, and keeps this floor earning while you're away.</div></div>
      <div class="acts"><button class="pink" data-act="ability" title="${ab[1]}">${L(()=>f.abil>Date.now()?ab[0]+" "+Math.ceil((f.abil-Date.now())/1000)+"s":ab[0])}</button><button class="ghost" data-act="unassign" data-id="${m.id}">STEP DOWN</button></div></div>
      <div class="muted">${ab[0]}: ${ab[1]}. Recharges in 5 minutes.</div>`}
  else{const el=S.emps.filter(e=>e.lvl>=3&&e.role!=="manager"&&T.homeOf(e)===lot);
    h+=`<div class="muted">No manager. You collect the register yourself, and this floor only fills its register while you're away. Anyone level 3+ can be promoted. They leave their station to manage.</div>
    ${el.length?`<select data-act="mgr"><option value="">Promote someone…</option>${el.map(e=>`<option value="${e.id}">${esc(e.name)} · Lv${e.lvl}${e.promoReady?" · wants this!":""}</option>`).join("")}</select>`:`<div class="muted">Nobody at ${esc(T.lotDef(lot).name)} is level 3 yet. Staff level up by serving customers or in a Training Room.</div>`}`;
    const far=S.emps.filter(e=>e.lvl>=3&&(e.role==="staff"||e.role==="manager")&&T.homeOf(e)!==lot).sort((a,b)=>b.lvl-a.lvl),room=T.roomAt(S,lot)>0;
    if(far.length)h+=`<div class="muted">${room?"Or bring in an experienced worker from another property. They move here and take over this floor.":`Experienced workers from your other properties could run this, but ${esc(T.lotDef(lot).name)} is full. Build or upgrade an HR Office here first.`}</div>
      <select data-act="mgrmove" ${room?"":"disabled"}><option value="">Bring in a manager…</option>${far.map(e=>`<option value="${e.id}">${esc(e.name)} · Lv${e.lvl} · from ${esc(T.lotDef(T.homeOf(e)).name)}${e.role==="manager"?" (manages there now)":""}</option>`).join("")}</select>`}
  h+=`</div>`;
  // price
  h+=`<div class="sec"><h3>PRICES</h3><div class="seg">${T.TIERS.map((t,k)=>`<button data-act="price" data-k="${k}" aria-pressed="${f.price===k}">${t.name.toUpperCase()}<small>${money(B.price*t.mult*T.lotMult(lot,f.type)*(1+f.decor*.15))} each · ${Math.round(t.demand*100)}% crowd</small></button>`).join("")}</div>
    <div class="muted">${T.TIERS[f.price].desc}</div></div>`;
  // decor
  const dc=f.decor<T.MAX_DECOR?T.decorCost(f,lot):0;
  h+=`<div class="sec"><h3>DECOR ${f.decor}/${T.MAX_DECOR}</h3><div class="bar"><i style="width:${f.decor*10}%;background:var(--pink)"></i></div>
    <div class="muted">Each level: +15% revenue, +6% customers, customers wait 8% longer, and they're happier. You'll see it change on the tower: art, lights, signs, a chandelier.</div>
    ${f.decor<T.MAX_DECOR?`<button class="pink" data-act="decor" ${cost(dc)}>UPGRADE DECOR ${money(dc)}</button>`:`<div class="up">Fully decorated. Gorgeous.</div>`}</div>`;
  // reviews
  h+=`<div class="sec"><h3>RECENT REVIEWS</h3><div class="reviews">${f.reviews.length?f.reviews.map(r=>`<div class="review"><span class="s">${"★".repeat(r.s)}${"☆".repeat(5-r.s)}</span><span>"${esc(r.t)}" <span class="n">${esc(r.n)}</span></span></div>`).join(""):`<div class="muted">No reviews yet. They'll come in as you serve customers.</div>`}</div></div>`;
  h+=`<div class="danger"><button class="${armed.demo?"red":"ghost"}" data-act="demolish">${armed.demo?"TAP AGAIN TO CLOSE THIS BUSINESS":"CLOSE THIS BUSINESS"}</button></div>`;
  return h}
function assignSelect(lot,i,k){const opts=S.emps.filter(e=>e.role==="staff"&&T.homeOf(e)===lot).sort((a,b)=>(a.loc?1:0)-(b.loc?1:0));
  if(!opts.length)return`<button data-act="tab" data-t="team">HIRE SOMEONE</button>`;
  return`<select data-act="assign" data-k="${k}"><option value="">Assign…</option>${opts.map(e=>`<option value="${e.id}">${esc(e.name)} · SPD ${e.spd} CHR ${e.chr}${e.fav===S.lots[lot].floors[i].type?" ♥":""} · ${e.loc?"moves from "+(e.loc.mgr?"manager":T.BIZ[S.lots[e.loc.lot].floors[e.loc.i].type].name):"free"}</option>`).join("")}</select>`}
function vSupport(lot,i,f){const B=T.SUPPORT[f.type],c=f.lvl<T.MAX_SUP?T.supCost(f,lot):0;
  let effect={lounge:`${2*f.lvl} seats. Staff recover ${Math.round(100*(1+.25*(f.lvl-1)))}% faster per level here.`,marketing:`+${15*f.lvl}% customers on every business in ${T.lotDef(lot).name}. Hype grows over time.`,
    training:`${2*f.lvl} seats. Trainees earn XP ${Math.round(30*(f.lvl-1))}% faster than at level 1.`,valet:`+${10*f.lvl}% customers on every business in ${T.lotDef(lot).name}.`,helipad:`+${8*f.lvl}% revenue on every business in ${T.lotDef(lot).name}.`,robots:`Staff in ${T.lotDef(lot).name} tire ${15*f.lvl}% slower.`,office:`Makes room for ${3*f.lvl} more people at ${T.lotDef(lot).name} (${T.headcount(S,lot)}/${T.staffCap(S,lot)} here). You can't remove it while that would leave more people here than fit.`,trade:`${T.brokerCap(S)} broker seat${T.brokerCap(S)>1?"s":""}, ${Math.round(Math.min(70,8*T.deskLvl(S)))}% chance of a tip each update, ${(T.fee(S)*100).toFixed(1)}% trading fee. Unlocked: ${T.PERKS.filter(p=>T.hasPerk(S,p.l)).map(p=>p.n.toLowerCase()).join("; ")}.${T.PERKS.find(p=>!T.hasPerk(S,p.l))?` Next: ${T.PERKS.find(p=>!T.hasPerk(S,p.l)).n.toLowerCase()} (company-wide desk level ${T.PERKS.find(p=>!T.hasPerk(S,p.l)).l}).`:""}`}[f.type];
  let h=`<div class="head"><h2>${B.name.toUpperCase()} · LV ${f.lvl}</h2><span class="pill">${T.lotDef(lot).name.toUpperCase()}</span></div><div class="muted">${B.desc}</div><div class="why good"><div><b>RIGHT NOW</b>${effect}</div></div>
    ${f.lvl<T.MAX_SUP?`<button data-act="supup" ${cost(c)}>UPGRADE TO LV ${f.lvl+1} · ${money(c)}</button>`:`<div class="up">Max level.</div>`}`;
  if(f.type==="lounge"||f.type==="training"){const who=S.emps.filter(e=>e.at&&e.at.lot===lot&&e.at.i===i);
    h+=`<div class="sec"><h3>${f.type==="lounge"?"RESTING NOW":"TRAINING NOW"} ${who.length}/${2*f.lvl}</h3>${who.length?who.map(e=>`<div class="slot">${ava(e)}<div class="who"><b>${esc(e.name)}</b><div class="minibars"><span>${f.type==="lounge"?"Energy":"XP"}</span>${Wb(()=>f.type==="lounge"?e.energy:e.xp/T.xpNeed(e.lvl)*100,f.type==="lounge"?"energy":"var(--cyan)")}</div></div>
      ${f.type==="training"?`<div class="acts"><button class="ghost" data-act="stoptrain" data-id="${e.id}">BACK TO WORK</button></div>`:"<span></span>"}</div>`).join(""):`<div class="muted">${f.type==="lounge"?"Nobody right now. Staff come here on their own when their energy drops below 25%.":"Nobody right now. Send someone from the Team tab."}</div>`}</div>`}
  if(f.type==="lounge")h+=`<div class="muted">Without a lounge, exhausted staff keep working at 60% speed and get grumpy.</div>`;
  h+=`<div class="danger"><button class="${armed.demo?"red":"ghost"}" data-act="demolish">${armed.demo?"TAP AGAIN TO CLEAR THIS FLOOR":"CLEAR THIS FLOOR"}</button></div>`;
  return h}

/* ===== TEAM ===== */
const TU={sub:"staff",filter:"all",sort:"attention",q:"",open:null,limit:40,lot:null};
const tl=()=>TU.lot&&TU.lot!=="all"&&S.lots[TU.lot]?TU.lot:S.cur;
const allTowers=()=>TU.lot==="all";
const teamSet=()=>allTowers()?S.emps:S.emps.filter(e=>T.homeOf(e)===tl());
function towerChips(){if(owned().length<2&&!allTowers())return"";
  return`<div class="chips tchips">${owned().map(l=>{const n=T.headcount(S,l.id),c=T.staffCap(S,l.id);return`<button data-act="tlot" data-k="${l.id}" aria-pressed="${!allTowers()&&tl()===l.id}" class="${n>c?"over":""}">${esc(l.name)} ${n}/${c}</button>`}).join("")}<button data-act="tlot" data-k="all" aria-pressed="${allTowers()}">ALL ${S.emps.length}</button></div>`}
function overCapNote(lot){const n=T.headcount(S,lot),c=T.staffCap(S,lot);if(n<=c)return"";
  return`<div class="why bad"><div><b>${esc(T.lotDef(lot).name.toUpperCase())} IS OVER ITS STAFF LIMIT</b>${n} people work here but there's room for ${c}. Nobody has been let go, but you can't hire here until you build or upgrade an HR Office, or move ${n-c} ${n-c>1?"people":"person"} to another property.</div></div>`}
const ROLE_NAME={manager:"Manager",broker:"Broker",hr:"HR Director"};
function shortWhere(e){if(e.role==="broker")return"Broker";if(e.role==="hr")return"HR Director";
  if(e.state==="break")return"Resting";if(e.state==="train")return"Training";if(!e.loc)return"No job";
  const f=S.lots[e.loc.lot]?.floors[e.loc.i];if(!f||!T.BIZ[f.type])return"No job";const lot=T.lotDef(e.loc.lot).name.split(" ")[0];
  return e.loc.mgr?`Manager · ${T.BIZ[f.type].name} · ${lot}`:`${T.BIZ[f.type].name} · ${lot} F${e.loc.i+1}`}
const underpaid=e=>e.salary<T.fairPay(e)*.95;
const praiseReady=e=>Date.now()-e.praisedAt>=300e3;
const atFav=e=>e.loc&&!e.loc.mgr&&S.lots[e.loc.lot]?.floors[e.loc.i]?.type===e.fav;
const needs=e=>(e.mood<30?4:0)+(e.pts>0?2:0)+(underpaid(e)?2:0)+(e.promoReady&&e.role==="staff"?1:0)+(e.state==="idle"&&e.role==="staff"?1:0);
const FILTERS=[["all","All"],["attention","Needs you"],["idle","No job"],["working","Working"],["away","Resting / training"],["leaders","Managers & roles"]];
function passFilter(e){switch(TU.filter){case"attention":return needs(e)>0;case"idle":return e.role==="staff"&&e.state==="idle";case"working":return e.state==="work";
  case"away":return e.state==="break"||e.state==="train";case"leaders":return e.role!=="staff";default:return true}}
const SORTS={attention:(a,b)=>needs(b)-needs(a)||b.lvl-a.lvl,level:(a,b)=>b.lvl-a.lvl,mood:(a,b)=>a.mood-b.mood,speed:(a,b)=>b.spd-a.spd,charm:(a,b)=>b.chr-a.chr,name:(a,b)=>a.name.localeCompare(b.name),pay:(a,b)=>b.salary-a.salary};
function teamSubtabs(){const lot=tl(),hrOn=T.hrActive(S,lot);return towerChips()+`<div class="subtabs">${[["staff",allTowers()?`STAFF ${S.emps.length}`:`STAFF ${T.headcount(S,lot)}/${T.staffCap(S,lot)}`],["hire",`HIRE (${S.applicants.length})`],["hr",`HR DIRECTOR${hrOn?" ✓":""}`]].map(([k,l])=>`<button data-act="teamsub" data-k="${k}" aria-pressed="${TU.sub===k}">${l}</button>`).join("")}</div>`}
V.team=()=>teamSubtabs()+(TU.sub==="hire"?vHire():TU.sub==="hr"?vHR():vStaff());
function vStaff(){
  const E=teamSet(),c={work:0,rest:0,train:0,idle:0,upset:0,pts:0,under:0};
  E.forEach(e=>{if(e.state==="work")c.work++;if(e.state==="break")c.rest++;if(e.state==="train")c.train++;if(e.role==="staff"&&e.state==="idle")c.idle++;if(e.mood<30)c.upset++;if(e.pts>0)c.pts+=e.pts;if(underpaid(e))c.under++});
  const raiseCost=E.filter(underpaid).reduce((a,e)=>a+(T.fairPay(e)*1.02-e.salary),0),praiseN=E.filter(e=>praiseReady(e)&&e.mood<80).length;
  const empty=T.emptyStations(S,(f,l)=>allTowers()||l===tl()).length;
  let h=(allTowers()?owned().map(l=>overCapNote(l.id)).join(""):overCapNote(tl()))+`<div class="tstats">
    <button data-act="tfilter" data-k="working"><b>${c.work}</b><span>working</span></button>
    <button data-act="tfilter" data-k="away"><b>${c.rest+c.train}</b><span>resting/training</span></button>
    <button data-act="tfilter" data-k="idle" class="${c.idle?"warn":""}"><b>${c.idle}</b><span>no job</span></button>
    <button data-act="tfilter" data-k="attention" class="${c.upset?"bad":""}"><b>${c.upset}</b><span>upset</span></button>
    <button data-act="tfilter" data-k="attention" class="${c.pts?"gold":""}"><b>${c.pts}</b><span>skill points</span></button>
    <div><b>${money(E.reduce((a,e)=>a+e.salary,0))}</b><span>wages / min</span></div></div>`;
  if(!allTowers()&&T.hrActive(S,tl()))h+=`<div class="why good"><div><b>THIS TOWER'S HR DIRECTOR IS ON IT</b>${esc(T.hrDirector(S,tl()).name)} handles ${Object.entries(S.hr).filter(([k,v])=>v).length} of 8 people jobs for you. <a href="#" data-act="teamsub" data-k="hr">See what they're doing</a></div></div>`;
  h+=`<div class="bulk">${c.under?`<button class="green" data-act="payfair">PAY ${c.under} FAIRLY (+${money(raiseCost)}/MIN)</button>`:""}
    ${praiseN?`<button class="pink" data-act="praiseall">PRAISE ${praiseN}</button>`:""}
    ${c.pts?`<button class="green" data-act="spendall">SPEND ${c.pts} POINT${c.pts>1?"S":""}</button>`:""}
    ${c.idle&&empty?`<button class="cyan" data-act="fillall">FILL ${Math.min(c.idle,empty)} EMPTY STATION${Math.min(c.idle,empty)>1?"S":""}</button>`:""}</div>
  <div class="tcontrols"><div class="chips">${FILTERS.map(([k,l])=>`<button data-act="tfilter" data-k="${k}" aria-pressed="${TU.filter===k}">${l}</button>`).join("")}</div>
    <div class="row"><input id="tsearch" type="search" placeholder="Find by name" value="${esc(TU.q)}" autocomplete="off">
    <label class="muted" for="tsort">Sort</label><select id="tsort" data-act="tsort">${[["attention","Needs attention"],["level","Level"],["mood","Lowest mood"],["speed","Speed"],["charm","Charm"],["pay","Pay"],["name","Name"]].map(([k,l])=>`<option value="${k}" ${TU.sort===k?"selected":""}>${l}</option>`).join("")}</select></div></div>`;
  const list=E.filter(passFilter).sort(SORTS[TU.sort]||SORTS.attention);
  if(!list.length)h+=`<div class="muted">Nobody matches this filter.</div>`;
  h+=`<div class="elist">`;
  list.slice(0,TU.limit).forEach(e=>{const mw=moodWord(e.mood),open=TU.open===e.id;
    h+=`<div class="erow${open?" open":""}${e.mood<30?" alert":""}" data-name="${esc(e.name.toLowerCase())}">
      <button class="ehead" data-act="openemp" data-id="${e.id}" aria-expanded="${open}">${ava(e)}
        <span class="ename"><b>${esc(e.name)}</b><small>${esc(shortWhere(e))}</small></span>
        <span class="elv">Lv${e.lvl}</span>
        <span class="emini"><span class="bar"><i style="width:${e.energy}%;background:${e.energy<25?"var(--red)":e.energy<50?"var(--gold)":"var(--green)"}"></i></span><span class="bar"><i style="width:${e.mood}%;background:var(--pink)"></i></span></span>
        <span class="eflags">${e.pts?`<i class="f gold" title="Skill points to spend">+${e.pts}</i>`:""}${underpaid(e)?`<i class="f red" title="Underpaid">$</i>`:""}${e.mood<30?`<i class="f red" title="Upset">!</i>`:""}${atFav(e)?`<i class="f pink" title="Working where they love">♥</i>`:""}${e.role!=="staff"?`<i class="f cyan" title="${ROLE_NAME[e.role]}">${e.role==="manager"?"M":e.role==="broker"?"B":"HR"}</i>`:""}<span class="mw" style="color:${mw[1]}">${mw[0]}</span></span>
        <span class="chev">${open?"▲":"▼"}</span></button>
      ${open?empDetail(e):""}</div>`});
  h+=`</div>`;
  if(list.length>TU.limit)h+=`<button class="ghost" data-act="tmore">SHOW ${Math.min(40,list.length-TU.limit)} MORE (${list.length-TU.limit} hidden)</button>`;
  return h}
function empDetail(e){const why=moodWhy(e),tr=T.trait(e),fair=T.fairPay(e);
  const hasTrain=Object.keys(S.lots).some(l=>T.findSupport(S,l,"training")>=0&&T.seatsFree(S,l,"training")>0);
  const loungeLot=e.loc&&T.findSupport(S,e.loc.lot,"lounge")>=0,bSeats=T.brokerCap(S)-T.brokers(S).length,office=T.coSum(S,"office")>0;
  return`<div class="edetail">
    <div class="row"><span class="chip trait" title="${esc(tr.desc)}">${tr.name.toUpperCase()}</span><span class="chip fav">♥ ${T.BIZ[e.fav].name.toUpperCase()}</span><span class="muted">${esc(tr.desc)} ${esc(e.bio)}</span></div>
    <div class="muted">${L(()=>where(e))}</div>
    <div class="stats">
      <span>Speed</span><div class="bar"><i style="width:${e.spd*10}%;background:var(--cyan)"></i></div><b>${e.spd}</b>
      <span>Charm</span><div class="bar"><i style="width:${e.chr*10}%;background:var(--pink)"></i></div><b>${e.chr}</b>
      <span>Stamina</span><div class="bar"><i style="width:${e.sta*10}%;background:var(--green)"></i></div><b>${e.sta}</b>
      <span>XP</span>${Wb(()=>e.xp/T.xpNeed(e.lvl)*100,"var(--gold)")}<b>${L(()=>Math.floor(e.xp)+"/"+T.xpNeed(e.lvl))}</b>
      <span>Energy</span>${Wb(()=>e.energy,"energy")}<b>${L(()=>Math.round(e.energy)+"%")}</b>
      <span>Mood</span>${Wb(()=>e.mood,"var(--pink)")}<b>${L(()=>Math.round(e.mood))}</b></div>
    <div class="muted">${why.length?esc(first(e))+" "+why.join(", ")+". ":""}Paid ${money(e.salary)}/min${underpaid(e)?` <span class="down">(fair is ${money(fair)})</span>`:""}${e.role==="broker"?` · ${e.trades||0} trades, ${money(e.pnl||0)} profit`:` · ${e.served.toLocaleString()} customers served`}.</div>
    ${e.pts>0?`<div class="row"><b class="up">${e.pts} POINT${e.pts>1?"S":""}:</b>${["spd","chr","sta"].map(s=>`<button class="green" data-act="point" data-id="${e.id}" data-s="${s}" ${e[s]>=10?"disabled":""}>+${{spd:"SPEED",chr:"CHARM",sta:"STAMINA"}[s]}</button>`).join("")}</div>`:""}
    ${(e.promoReady||armed["promo"+e.id])&&e.role!=="manager"?`<div class="row"><span class="up">Pick a floor for ${esc(first(e))} to manage:</span>${promoSelect(e)}</div>`:""}
    ${e.role==="staff"&&!e.loc?`<div class="row"><span class="muted">Give ${esc(first(e))} a station:</span>${stationSelect(e)}</div>`:""}
    ${owned().length>1?`<div class="row"><span class="muted">Works at <b>${esc(T.lotDef(T.homeOf(e)).name)}</b>.</span><select data-act="moveemp" data-id="${e.id}"><option value="">Move to another property…</option>${owned().filter(l=>l.id!==T.homeOf(e)).map(l=>`<option value="${l.id}" ${T.roomAt(S,l.id)>0?"":"disabled"}>${esc(l.name)} · ${T.headcount(S,l.id)}/${T.staffCap(S,l.id)}${T.roomAt(S,l.id)>0?"":" (full)"}</option>`).join("")}</select></div>`:""}
    <div class="row">
      <button class="ghost" data-act="praise" data-id="${e.id}" ${praiseReady(e)?"":"disabled"}>${praiseReady(e)?"PRAISE":"PRAISED ♥"}</button>
      <button class="ghost" data-act="raise" data-id="${e.id}">RAISE +15%</button>
      ${e.state==="train"?`<button class="ghost" data-act="stoptrain" data-id="${e.id}">STOP TRAINING</button>`:e.role==="staff"?`<button class="ghost" data-act="train" data-id="${e.id}" ${hasTrain?"":"disabled title='Build a Training Room first'"}>TRAIN</button>`:""}
      ${e.state==="work"&&loungeLot?`<button class="ghost" data-act="rest" data-id="${e.id}">SEND TO REST</button>`:""}
      ${e.loc&&e.role==="staff"?`<button class="ghost" data-act="unassign" data-id="${e.id}">TAKE OFF STATION</button>`:""}
      ${e.lvl>=3&&e.role==="staff"&&!e.promoReady?`<button class="ghost" data-act="promoready" data-id="${e.id}">MAKE MANAGER…</button>`:""}
      ${e.role!=="broker"&&bSeats>0?`<button class="ghost" data-act="mkbroker" data-id="${e.id}">MAKE BROKER</button>`:""}
      ${e.role!=="hr"&&T.lotSum(S,T.homeOf(e),"office")>0&&!T.hrDirector(S,T.homeOf(e))?`<button class="ghost" data-act="mkhr" data-id="${e.id}">MAKE HR DIRECTOR</button>`:""}
      ${e.role==="broker"||e.role==="hr"||e.role==="manager"?`<button class="ghost" data-act="unassign" data-id="${e.id}">STEP DOWN</button>`:""}
      <button class="${armed["fire"+e.id]?"red":"ghost"}" data-act="fire" data-id="${e.id}">${armed["fire"+e.id]?"REALLY LET GO?":"LET GO"}</button></div></div>`}
function stationSelect(e){const es=T.emptyStations(S,(f,l)=>l===T.homeOf(e));if(!es.length)return`<span class="muted">No empty stations. Add one on a business floor.</span>`;
  es.sort((a,b)=>(b.f.type===e.fav)-(a.f.type===e.fav));
  return`<select data-act="placeemp" data-id="${e.id}"><option value="">Choose a station…</option>${es.map(x=>`<option value="${x.lot}:${x.i}:${x.k}">${x.f.type===e.fav?"♥ ":""}${T.BIZ[x.f.type].name} · ${T.lotDef(x.lot).name} F${x.i+1} · station ${x.k+1}</option>`).join("")}</select>`}
function vHire(){const lot=allTowers()?S.cur:tl(),cap=T.staffCap(S,lot),full=T.roomAt(S,lot)<=0;
  let h=`<div class="muted">Hiring for <b>${esc(T.lotDef(lot).name)}</b>: ${T.headcount(S,lot)} of ${cap} spots filled. New hires work only at this property.</div><div class="row spread"><span class="muted">New applicants in ${L(()=>{const l=Math.max(0,180-Math.floor((Date.now()-S.appAt)/1000));return Math.floor(l/60)+":"+String(l%60).padStart(2,"0")})}</span>
    <button class="ghost" data-act="postad" ${cost(100)}>POST A JOB AD $100</button></div>${full?`<div class="why warn"><div><b>${esc(T.lotDef(lot).name.toUpperCase())} IS FULL</b>Each HR Office level in this tower makes room for 3 more people here. Build one on an empty floor, or upgrade one you already have.<div class="row" style="margin-top:6px"><button data-act="gohr">BUILD AN HR OFFICE</button></div></div></div>`:""}<div class="grid2">`;
  for(const a of S.applicants){const tr=T.trait(a),fee=T.hireFee(a);
    h+=`<div class="card"><div class="row">${ava(a)}<div><b>${esc(a.name)}</b><div class="muted">${esc(a.bio)}</div></div></div>
    <div class="row"><span class="chip trait" title="${esc(tr.desc)}">${tr.name.toUpperCase()}</span><span class="chip fav">♥ ${T.BIZ[a.fav].name.toUpperCase()}</span></div>
    <div class="muted">${esc(tr.desc)}</div><div>SPD ${a.spd} · CHR ${a.chr} · STA ${a.sta}</div><div class="muted">${money(a.salary)}/min · hiring fee ${money(fee)}</div>
    <button class="green" data-act="hire" data-id="${a.id}" data-l="${lot}" ${full?"disabled":cost(fee)}>HIRE ${esc(first(a).toUpperCase())}</button></div>`}
  return h+`</div>`}
const HR_DUTIES=[["requests","Answer staff requests","Gives raises to unhappy staff and approves transfers to jobs they love."],["raises","Keep pay fair","Raises anyone paid below the fair wage."],["praise","Check in on morale","Praises anyone whose mood dips below 55."],
  ["points","Spend skill points","Speed first, then charm, then stamina."],["staffing","Fill empty stations","Puts people without a job on open stations, favorites first."],["favorites","Match people to jobs they love","Moves and swaps staff so they work at their favorite business."],
  ["training","Train people without a job","Sends anyone without a station to a free Training Room seat."],["promote","Promote managers","Makes your best level 3+ worker the manager of any floor without one."]];
function vHR(){const lot=allTowers()?S.cur:tl(),LN=esc(T.lotDef(lot).name),d=T.hrDirector(S,lot),office=T.lotSum(S,lot,"office")>0;
  let h=`<div class="muted">Each property can have its own HR Director. They look after the people at ${LN} only, working from that tower's HR Office, and lift everyone's mood there a little (more if they're charming).</div>
  ${owned().length>1?`<div class="row">${owned().map(l=>{const x=T.hrDirector(S,l.id);return`<span class="chip">${esc(l.name)}: ${x?esc(first(x))+(T.hrActive(S,l.id)?" ✓":" (needs HR Office)"):"none"}</span>`}).join("")}</div>`:""}`;
  if(!office)return h+`<div class="why warn"><div><b>${LN.toUpperCase()} NEEDS AN HR OFFICE FIRST</b>Build one on a floor in this tower. It also makes room for 3 more people here per level.<div class="row" style="margin-top:6px"><button data-act="gohr">BUILD AN HR OFFICE</button></div></div></div>`;
  if(!d){const c=S.emps.filter(e=>(e.role==="staff"||e.role==="manager")&&T.homeOf(e)===lot).sort((a,b)=>b.chr-a.chr);
    return h+`<div class="why warn"><div><b>NO HR DIRECTOR YET</b>Choose someone to lead HR. They leave their current job, and their pay goes up 50%. Charm makes them better at lifting the team's mood.</div></div>
    ${c.length?`<select data-act="mkhrsel"><option value="">Appoint an HR Director for ${LN}…</option>${c.map(e=>`<option value="${e.id}">${esc(e.name)} · CHR ${e.chr} · Lv${e.lvl} · ${esc(shortWhere(e))}</option>`).join("")}</select>`:`<div class="muted">Hire someone first.</div>`}`}
  h+=`<div class="slot">${ava(d)}<div class="who"><b>${esc(d.name)} <span class="muted">HR Director</span></b><div class="muted">Charm ${d.chr} · everyone's mood +${Math.round(3+d.chr*.5)} · ${money(d.salary)}/min</div></div><div class="acts"><button class="ghost" data-act="unassign" data-id="${d.id}">STEP DOWN</button></div></div>
  <div class="sec"><h3>WHAT ${esc(first(d).toUpperCase())} HANDLES</h3><div class="muted">These switches apply to every HR Director you have.</div>${HR_DUTIES.map(([k,l,desc])=>`<div class="toggle"><span><b class="tl">${l}</b><br><span class="muted">${desc}</span></span><button data-act="hrtoggle" data-k="${k}" class="${S.hr[k]?"green":"ghost"}" aria-pressed="${!!S.hr[k]}">${S.hr[k]?"ON":"OFF"}</button></div>`).join("")}</div>
  <div class="sec"><h3>RECENT HR ACTIVITY</h3><div class="log">${S.hrLog.filter(x=>!x.lot||x.lot===lot).length?S.hrLog.filter(x=>!x.lot||x.lot===lot).slice(0,12).map(x=>`<div>${esc(x.m)}</div>`).join(""):`<div class="muted">Nothing needed yet. ${esc(first(d))} checks in every few seconds.</div>`}</div></div>`;
  return h}
function promoSelect(e){const fl=[],lot=T.homeOf(e);S.lots[lot].floors.forEach((f,i)=>{if(T.isBiz(f.type))fl.push({lot,i,f})});
  return`<select data-act="promote" data-id="${e.id}"><option value="">Manage which floor?</option>${fl.map(x=>`<option value="${x.lot}:${x.i}">${T.BIZ[x.f.type].name} · ${T.lotDef(x.lot).name}${x.f.manager?" (replace "+esc(T.emp(S,x.f.manager)?.name||"")+")":""}</option>`).join("")}</select>`}

/* ===== INBOX ===== */
V.inbox=()=>{
  let h=`<div class="head"><h2>INBOX</h2></div><div class="muted">Requests and opportunities wait here. Nothing here is urgent. Take your time.</div>`;
  if(!S.inbox.length)h+=`<div class="card"><b>All caught up.</b><div class="muted">Staff requests, visitors and local events will show up here.</div></div>`;
  for(const it of S.inbox){const e=T.emp(S,it.emp);h+=`<div class="item"><span class="kind">${{unhappy:"STAFF",transfer:"STAFF",promo:"STAFF",critic:"VISITOR",festival:"EVENT",charity:"COMMUNITY",supplier:"OFFER"}[it.kind]||"NOTE"}</span>
    ${e?`<div class="row">${ava(e)}<h4>${esc(it.title)}</h4></div>`:`<h4>${esc(it.title)}</h4>`}<div>${esc(it.text)}</div>
    <div class="row spread"><span class="muted">${L(()=>"Open for "+T.timeLeft(it.expires))}</span><div class="row">${it.ch.map((c,k)=>`<button class="${k?"ghost":"green"}" data-act="inbox" data-id="${it.id}" data-a="${c.a}">${esc(c.l)}</button>`).join("")}</div></div></div>`}
  h+=`<div class="sec"><h3>BUSINESS DEALS</h3><div class="muted">Offers from other companies. New ones arrive every few minutes while you play, and now and then while the game is closed.</div>`;
  if(!S.deals.length)h+=`<div class="muted">No offers right now.</div>`;
  for(const d of S.deals)h+=`<div class="item deal"><span class="kind">${d.title.toUpperCase()}</span><h4>${esc(d.company)}</h4><div>${esc(d.text)}</div>
    <div class="row spread"><span class="muted">Expires in ${T.timeLeft(d.expires)}</span><div class="row"><button class="ghost" data-act="deal" data-id="${d.id}" data-y="0">PASS</button><button class="green" data-act="deal" data-id="${d.id}" data-y="1" ${d.cost>0?cost(d.cost):""}>${d.accept}</button></div></div></div>`;
  return h+`</div>`};

/* ===== MARKET ===== */
let mktSub="market";
const fmtP=p=>"$"+(p>=1?p.toFixed(2):p.toFixed(3));
const pct=(x,d=1)=>(x>=0?"+":"")+(x*100).toFixed(Math.abs(x)>=1?0:d)+"%";
const mmss=s=>s==null?"–":Math.floor(s/60)+":"+String(Math.floor(s%60)).padStart(2,"0");
const ago=t=>{const s=Math.floor((Date.now()-t)/1000);return s<60?s+"s ago":Math.floor(s/60)+"m ago"};
function spark(h,w=300,ht=80,ref){if(h.length<2)h=[h[0]||0,h[0]||0];let mn=Math.min(...h),mx=Math.max(...h);if(ref){mn=Math.min(mn,ref);mx=Math.max(mx,ref)}
  const pad=5,Y=v=>ht-pad-(v-mn)/((mx-mn)||1)*(ht-pad*2),pts=h.map((v,i)=>[(i/(h.length-1)*(w-pad*2)+pad),Y(v)]),col=h[h.length-1]>=(ref||h[0])?"#5ee08a":"#ff5d6c",last=pts[pts.length-1];
  return`<svg viewBox="0 0 ${w} ${ht}" width="100%" height="${ht}" preserveAspectRatio="none" style="display:block;background:#141428">${[.25,.5,.75].map(f=>`<line x1="0" x2="${w}" y1="${ht*f}" y2="${ht*f}" stroke="#2a2750"/>`).join("")}
  ${ref?`<line x1="0" x2="${w}" y1="${Y(ref).toFixed(1)}" y2="${Y(ref).toFixed(1)}" stroke="#ffcc3d" stroke-dasharray="6 4" stroke-width="1.5"/>`:""}
  <polygon points="${pad},${ht} ${pts.map(p=>p.join(",")).join(" ")} ${w-pad},${ht}" fill="${col}" fill-opacity=".12"/><polyline points="${pts.map(p=>p.join(",")).join(" ")}" fill="none" stroke="${col}" stroke-width="2"/><rect x="${last[0]-3}" y="${last[1]-3}" width="6" height="6" fill="${col}"/></svg>`}
function mini(h){h=h.slice(-20);const mn=Math.min(...h),mx=Math.max(...h),col=h[h.length-1]>=h[0]?"#5ee08a":"#ff5d6c";
  return`<svg viewBox="0 0 60 16" width="60" height="16" aria-hidden="true"><polyline points="${h.map((v,i)=>`${(i/(h.length-1)*58+1).toFixed(1)},${(15-(v-mn)/((mx-mn)||1)*14).toFixed(1)}`).join(" ")}" fill="none" stroke="${col}" stroke-width="1.5"/></svg>`}
const ratingTag=s=>s.rating==null?"–":s.rating>0?'<span class="rt buy">BUY</span>':s.rating<0?'<span class="rt sell">SELL</span>':'<span class="rt hold">HOLD</span>';
function deskBanner(){const n=T.deskLvl(S);
  if(!n)return`<div class="why warn"><div><b>NO TRADING DESK YET</b>You can still buy and sell, but a Trading Desk (any floor) unlocks tips, brokers, auto orders, analyst ratings, earnings previews and early news. Every level adds a broker seat and cuts fees.</div></div>`;
  return`<div class="perks"><b>TRADING DESK LV ${n}</b>${T.PERKS.map(p=>`<span class="perk ${n>=p.l?"on":""}" title="${esc(p.n)}">${n>=p.l?"✓":"Lv"+p.l} ${esc(p.n)}</span>`).join("")}<span class="perk on">Fee ${(T.fee(S)*100).toFixed(1)}%</span></div>`}
function moodOf(){const r=S.stocks.filter(s=>!s.penny),a=r.reduce((x,s)=>x+(s.last||0),0)/r.length+S.mkt.sent;return a>.006?["BULLISH","up"]:a<-.006?["BEARISH","down"]:["CALM","muted"]}
V.market=()=>{if(mktSub==="stocks")mktSub="market";const n=T.brokers(S).length,pos=Object.values(S.port).filter(q=>q>0).length;
  return`<div class="subtabs"><button data-act="mktsub" data-k="market" aria-pressed="${mktSub==="market"}">MARKET</button><button data-act="mktsub" data-k="portfolio" aria-pressed="${mktSub==="portfolio"}">PORTFOLIO${pos?" ("+pos+")":""}</button><button data-act="mktsub" data-k="brokers" aria-pressed="${mktSub==="brokers"}">BROKERS ${n}/${T.brokerCap(S)}</button></div>`+deskBanner()+(mktSub==="brokers"?vBrokers():mktSub==="portfolio"?vPortfolio():vMarketMain())};
function newsList(items){return`<div class="news">${items.map(n=>`<div class="nw ${n.dir>0?"pos":"neg"}"><span class="nt">${n.dir>0?"▲":"▼"} ${n.t||(n.sec?T.SECTORS[n.sec].name.toUpperCase():"MARKET")}${n.big?" · BIG":""}</span><span class="nh">${esc(n.h)}</span><span class="na">${n.in>0?`<i class="pend">HITS ${n.in>1?"IN 2 UPDATES":"NEXT UPDATE"}</i>`:ago(n.at)}</span></div>`).join("")||`<div class="muted">No news yet. Headlines arrive every minute or two.</div>`}</div>`}
function vMarketMain(){const st=S.stocks.find(s=>s.t===mktSel)||S.stocks[0];mktSel=st.t;const L3=T.hasPerk(S,3),mood=moodOf();
  let h=`<div class="row spread"><h3>LATEST NEWS</h3><span class="muted">Market mood: <b class="${mood[1]}">${mood[0]}</b></span></div>${newsList(S.mkt.news.slice(0,4))}
  <div class="muted">News moves prices on the next update, so you get about 20 seconds to react. Prices update every 20 seconds.</div>
  ${stockDetail(st)}<h3>ALL STOCKS</h3>
  <div class="tbl"><table class="stocks"><tr><th>STOCK</th><th>PRICE</th><th>LAST</th><th></th><th>${L3?"ANALYSTS":"🔒 RATING"}</th><th>EARNINGS</th><th>OWN</th></tr>`;
  for(const[sk,sec]of Object.entries(T.SECTORS)){const list=S.stocks.filter(s=>s.sec===sk);if(!list.length)continue;const m=sk==="penny"?0:(S.mkt.sec[sk]||0);
    h+=`<tr class="sech"><td colspan="7"><span class="swatch" style="background:${sec.color}"></span> ${sec.name.toUpperCase()} ${Math.abs(m)>.004?`<span class="${m>0?"up":"down"}">${m>0?"▲ hot":"▼ cold"}</span>`:""}</td></tr>`;
    for(const s of list){const q=S.port[s.t]||0,tip=S.tips[s.t],te=T.stockTimeToEarn(S,s);
      h+=`<tr data-act="stock" data-t="${s.t}" tabindex="0" class="${s.t===st.t?"sel":""}"><td><b>${s.t}</b>${s.penny?' <span class="penny">PENNY</span>':""}${s.div?' <span class="divb">DIV</span>':""}${tip?` <span class="${tip>0?"up":"down"}">${tip>0?"▲TIP":"▼TIP"}</span>`:""}</td>
      <td>${fmtP(s.p)}</td><td class="${(s.last||0)>=0?"up":"down"}">${pct(s.last||0)}</td><td>${mini(s.hist)}</td><td>${L3?ratingTag(s):"–"}</td>
      <td>${te==null?"–":L(()=>mmss(T.stockTimeToEarn(S,s)))}${s.preview!=null?` <span class="${s.preview>0?"up":"down"}">${s.preview>0?"BEAT?":"MISS?"}</span>`:""}</td><td>${q?q.toLocaleString():"–"}</td></tr>`}}
  h+=`</table></div>`;return h}
function stockDetail(st){const own=S.port[st.t]||0,b=S.basis[st.t],fe=T.fee(S),maxBuy=Math.floor(Math.max(0,S.cash)/(st.p*(1+fe))),te=T.stockTimeToEarn(S,st),o=S.orders[st.t]||{},L2=T.hasPerk(S,2);
  const news=S.mkt.news.filter(n=>n.t===st.t||(n.kind==="sec"&&n.sec===st.sec)).slice(0,2);const lo=Math.min(...st.hist),hi=Math.max(...st.hist);
  let h=`<div class="card sdet"><div class="row spread"><div><b class="sname">${esc(st.n)} (${st.t})</b> <span class="muted">${T.SECTORS[st.sec].name}</span></div><div><b class="sname">${fmtP(st.p)}</b> <span class="${(st.last||0)>=0?"up":"down"}">${pct(st.last||0)}</span></div></div>
   ${spark(st.hist,300,90,own?b:null)}
   <div class="chipsrow"><span class="chip">Range ${fmtP(lo)}–${fmtP(hi)}</span><span class="chip">${st.penny?"Wild":st.vol>.05?"Very jumpy":st.vol>.03?"Jumpy":st.vol>.018?"Normal":"Steady"}</span>
   ${st.div?`<span class="chip divc">Pays ${(st.div*100).toFixed(2)}% every 5 min</span>`:""}${te!=null?`<span class="chip">Earnings in ${L(()=>mmss(T.stockTimeToEarn(S,st)))}</span>`:""}
   ${T.hasPerk(S,3)?`<span class="chip">Analysts: ${ratingTag(st)}</span>`:""}${st.preview!=null?`<span class="chip ${st.preview>0?"up":"down"}">Preview: likely to ${st.preview>0?"beat":"miss"}</span>`:te!=null&&!T.hasPerk(S,4)?`<span class="chip muted">🔒 Earnings preview at desk Lv4</span>`:""}</div>
   ${st.penny?`<div class="why warn"><div><b>WILD CARD</b>Penny stocks swing hard. Now and then one rockets 2–6×, then usually slides back within a few minutes. Some crash. Cash out a moonshot fast.</div></div>`:""}
   ${news.length?newsList(news):""}
   ${own?`<div class="tiles"><div class="tile"><span>You own</span><b>${own.toLocaleString()}</b></div><div class="tile"><span>Avg cost</span><b>${fmtP(b)}</b></div><div class="tile"><span>Value</span><b>${money(own*st.p)}</b></div><div class="tile"><span>Profit</span><b class="${st.p>=b?"up":"down"}">${money(own*(st.p-b))} (${pct(st.p/b-1)})</b></div></div><div class="muted">Gold dashed line on the chart = your average cost.</div>`:`<div class="muted">You don't own any ${st.t}. Fee ${(fe*100).toFixed(1)}% per trade.</div>`}
   <div class="row"><span class="muted lbl">BUY</span>${[.1,.25,.5].map(p=>`<button class="green" data-act="buy" data-p="${p}" ${Math.floor(Math.max(0,S.cash)*p/(st.p*(1+fe)))<1?"disabled":""}>${p*100}% OF CASH</button>`).join("")}<button class="green" data-act="buy" data-p="1" ${maxBuy<1?"disabled":""}>MAX</button></div>
   <div class="row"><span class="muted lbl">SELL</span>${[.25,.5].map(p=>`<button class="red" data-act="sell" data-p="${p}" ${Math.floor(own*p)<1?"disabled":""}>${p*100}%</button>`).join("")}<button class="red" data-act="sell" data-p="1" ${!own?"disabled":""}>ALL</button></div>`;
  if(L2)h+=`<div class="sec"><h3>AUTO ORDERS</h3><div class="muted">Your desk sells everything automatically when the price hits your target, measured from your average cost.</div>
    <div class="row"><span class="muted lbl">TAKE PROFIT</span>${[0,.1,.25,.5,1].map(v=>`<button class="${(o.tp||0)===v?"cyan":"ghost"}" data-act="order" data-k="tp" data-v="${v}">${v?"+"+v*100+"%":"OFF"}</button>`).join("")}</div>
    <div class="row"><span class="muted lbl">STOP LOSS</span>${[0,.1,.2,.35].map(v=>`<button class="${(o.sl||0)===v?"pink":"ghost"}" data-act="order" data-k="sl" data-v="${v}">${v?"−"+v*100+"%":"OFF"}</button>`).join("")}</div>
    ${own&&(o.tp||o.sl)?`<div class="muted">Sells at ${o.tp?fmtP(b*(1+o.tp)):""}${o.tp&&o.sl?" or ":""}${o.sl?fmtP(b*(1-o.sl)):""}.</div>`:""}</div>`;
  else h+=`<div class="muted">🔒 Stop-loss and take-profit orders unlock at Trading Desk Lv2.</div>`;
  return h+`</div>`}
function vPortfolio(){const rows=S.stocks.filter(s=>(S.port[s.t]||0)>0);let val=0,unr=0;rows.forEach(s=>{const q=S.port[s.t];val+=q*s.p;unr+=q*(s.p-(S.basis[s.t]||s.p))});
  let h=`<div class="tiles"><div class="tile"><span>Your stocks</span><b>${money(val)}</b></div><div class="tile"><span>Unrealized</span><b class="${unr>=0?"up":"down"}">${unr>=0?"+":""}${money(unr)}</b></div><div class="tile"><span>Realized</span><b class="${(S.realized||0)>=0?"up":"down"}">${(S.realized||0)>=0?"+":""}${money(S.realized||0)}</b></div>
    <div class="tile"><span>Dividends</span><b class="up">${money(S.divPaid||0)}</b></div><div class="tile"><span>Broker fund</span><b>${money(T.fundValue(S))}</b></div><div class="tile"><span>Next dividends</span><b>${L(()=>mmss(300-(S.mkt.divT||0)-(S.clock.mkt||0)))}</b></div></div>`;
  if(!rows.length)return h+`<div class="card"><b>You don't own any stocks yet.</b><div class="muted">Pick one in the Market tab. Dividend stocks (DIV) pay you every 5 minutes just for holding them.</div></div>`;
  const bySec={};rows.forEach(s=>bySec[s.sec]=(bySec[s.sec]||0)+S.port[s.t]*s.p);
  h+=`<div class="secbar">${Object.entries(bySec).map(([k,v])=>`<i style="width:${v/val*100}%;background:${T.SECTORS[k].color}" title="${T.SECTORS[k].name} ${Math.round(v/val*100)}%"></i>`).join("")}</div>
  <div class="row">${Object.entries(bySec).map(([k,v])=>`<span class="muted"><span class="swatch" style="background:${T.SECTORS[k].color}"></span> ${T.SECTORS[k].name} ${Math.round(v/val*100)}%</span>`).join("")}</div>
  <div class="tbl"><table><tr><th>STOCK</th><th>SHARES</th><th>AVG COST</th><th>PRICE</th><th>VALUE</th><th>PROFIT</th><th>ORDERS</th></tr>
  ${rows.map(s=>{const q=S.port[s.t],b=S.basis[s.t]||s.p,o=S.orders[s.t]||{};return`<tr data-act="gostock" data-t="${s.t}" tabindex="0"><td><b>${s.t}</b>${s.div?' <span class="divb">DIV</span>':""}</td><td>${q.toLocaleString()}</td><td>${fmtP(b)}</td><td>${fmtP(s.p)}</td><td>${money(q*s.p)}</td><td class="${s.p>=b?"up":"down"}">${money(q*(s.p-b))} ${pct(s.p/b-1)}</td><td>${o.tp?"+"+o.tp*100+"% ":""}${o.sl?"−"+o.sl*100+"%":""}${!o.tp&&!o.sl?"–":""}</td></tr>`}).join("")}</table></div>
  <div class="muted">Tap a row to trade it or set auto orders.</div>`;return h}
function vBrokers(){const F=S.fund,cap=T.brokerCap(S),bs=T.brokers(S);
  let h=`<div class="muted">Brokers invest part of your money for you. Each one follows a strategy you choose. Better brokers (speed, charm, level) read the market right more often, and a bigger Trading Desk helps too. They keep 20% of what they make.</div>`;
  if(!cap)return h+`<div class="why warn"><div><b>YOU NEED A TRADING DESK</b>Every Trading Desk level gives you one broker seat. Build one on any floor.</div></div>`;
  h+=`<div class="tiles"><div class="tile"><span>Fund value</span><b class="up">${L(()=>money(T.fundValue(S)))}</b></div><div class="tile"><span>Last update</span><b>${L(()=>({html:`<span class="${S.fund.last>=0?"up":"down"}">${S.fund.last>=0?"+":""}${money(S.fund.last)}</span>`}))}</b></div><div class="tile"><span>All-time</span><b>${L(()=>({html:`<span class="${(S.fund.total||0)>=0?"up":"down"}">${(S.fund.total||0)>=0?"+":""}${money(S.fund.total||0)}</span>`}))}</b></div></div>
  ${F.hist.length>1?spark(F.hist,300,70):""}
  <div class="sec"><h3>HOW MUCH THEY INVEST</h3><div class="seg seg5">${[0,.1,.25,.4,.5].map(a=>`<button data-act="alloc" data-a="${a}" aria-pressed="${Math.abs(F.alloc-a)<.001}">${a*100}%<small>${a?"of your money":"pause"}</small></button>`).join("")}</div>
    <div class="muted">Each update they top up or hand back cash so the fund stays at this share of your money (cash plus fund).</div></div>
  <div class="sec"><h3>YOUR BROKERS ${bs.length}/${cap}</h3>`;
  bs.forEach((e,i)=>{const on=i<cap,p=F.pos[e.id],ps=p&&S.stocks.find(x=>x.t===p.t),strat=T.STRATS[e.strat]?e.strat:"day";
    const acc=Math.round(Math.min(.8,T.brokerAcc(S,e)+(strat==="sector"?.035:strat==="dividend"?.02:0))*100);
    h+=`<div class="bcard">${ava(e)}<div class="who"><div class="row spread"><b>${esc(e.name)} <span class="muted">Lv${e.lvl}</span></b><span class="${(e.pnl||0)>=0?"up":"down"}">${(e.pnl||0)>=0?"+":""}${money(e.pnl||0)} · ${e.trades||0} closed</span></div>
      <div class="row"><select data-act="bstrat" data-id="${e.id}">${Object.entries(T.STRATS).map(([k,s])=>`<option value="${k}" ${strat===k?"selected":""}>${s.name}</option>`).join("")}</select>
      ${strat==="sector"?`<select data-act="bsector" data-id="${e.id}">${Object.entries(T.SECTORS).filter(([k])=>k!=="penny").map(([k,s])=>`<option value="${k}" ${e.sector===k?"selected":""}>${s.name}</option>`).join("")}</select>`:""}
      <span class="muted">${on?(strat==="penny"?"Penny stocks are mostly luck":`Reads right ~${acc}%`):"No seat. Upgrade a Trading Desk."}</span></div>
      <div class="muted">${esc(T.STRATS[strat].desc)}</div>
      <div class="bpos">${ps?`Holding <b>${p.q.toLocaleString()} ${p.t}</b> · bought at ${fmtP(p.cost)} · <span class="${ps.p>=p.cost?"up":"down"}">${pct(ps.p/p.cost-1)} (${money(p.q*(ps.p-p.cost))})</span>`:on?`<span class="muted">In cash, waiting for a good buy.</span>`:""}</div></div>
      <div class="acts"><button class="ghost" data-act="unassign" data-id="${e.id}">REMOVE</button></div></div>`});
  if(bs.length<cap){const c=S.emps.filter(e=>(e.role==="staff"||e.role==="manager")&&T.homeOf(e)===S.cur).sort((a,b)=>T.brokerSkill(b)-T.brokerSkill(a));
    h+=c.length?`<select data-act="mkbrokersel"><option value="">Add a broker (${cap-bs.length} seat${cap-bs.length>1?"s":""} open)…</option>${c.map(e=>`<option value="${e.id}">${esc(e.name)} · reads right ~${Math.round(T.brokerAcc(S,e)*100)}% · ${esc(shortWhere(e))}</option>`).join("")}</select><div class="muted">Showing people at ${esc(T.lotDef(S.cur).name)}. Visit another property to pick from its staff. Brokers leave their current job, and their pay goes up 30%.</div>`:`<div class="muted">Nobody at ${esc(T.lotDef(S.cur).name)} can become a broker. Hire someone here or visit another property.</div>`}
  h+=`</div>${T.fundValue(S)>=1?`<button class="ghost" data-act="withdraw">SELL EVERYTHING AND WITHDRAW (${money(T.fundValue(S))})</button>`:""}
  <div class="sec"><h3>RECENT TRADES</h3><div class="log">${F.log.length?F.log.slice(0,10).map(x=>x.a==="bought"?`<div><b>${esc(x.n)}</b> bought ${x.q.toLocaleString()} ${x.t}</div>`:`<div><b>${esc(x.n)}</b> sold ${x.t} at ${pct(x.r)}: <span class="${x.p>=0?"up":"down"}">${x.p>=0?"+":""}${money(x.p)}</span></div>`).join(""):`<div class="muted">No trades yet. Brokers act every 20 seconds.</div>`}</div></div>`;
  return h}

/* ===== LAND ===== */
let landShop=null;const shopUI={name:null};
const PAINTS=["#5ee08a","#ff9b4a","#5ad1ff","#ff5d6c","#ff7ad9","#b78cff","#ffcc3d","#f2ecd8"];
const shopName=k=>S.shops[k]?.name||T.SHOPS[k].name;
function vShopDetail(k){const D=T.SHOPS[k],sh=S.shops[k];if(!sh){landShop=null;return vShops()}
  const l=sh.lvl,c=T.shopCost(S,k),mode=sh.mode||"normal",perkNow=T.shopPerk(S,k);
  const perkTxt={corner:`+${perkNow}% customers in every tower`,gas:`+${perkNow}% customers in every tower`,motel:`+${perkNow}% customers in every tower`,truck:`+${2*perkNow}% revenue at food businesses`,
    laundry:`Staff everywhere tire ${2*perkNow}% slower`,carwash:`Away earnings +${Math.min(50,3*perkNow)}%`,parking:`+${perkNow}% revenue everywhere`,bank:`+${5*perkNow}% stock dividends`}[k];
  let h=`<div class="towerrow"><span><b>${esc(D.name.toUpperCase())}</b> · LV ${l}${l>=T.SHOP_MAX?" MAX":""} · runs itself</span><button class="ghost" data-act="tab" data-t="land">BUY MORE SHOPS</button></div>
  <div class="head"><h2>${esc(shopName(k).toUpperCase())}</h2><div style="text-align:right"><b class="up">${L(()=>money(T.shopInc(S,k))+"/min")}</b><div class="muted">${L(()=>"earned "+money(sh.earned||0))}</div></div></div>
  <div class="tiles"><div class="tile"><span>Perk right now</span><b>${perkTxt}</b></div><div class="tile"><span>Owned for</span><b>${L(()=>{const m=(Date.now()-(sh.since||Date.now()))/60e3;return m<60?Math.round(m)+" min":m<1440?(m/60).toFixed(1)+" hr":(m/1440).toFixed(1)+" days"})}</b></div>
    <div class="tile"><span>Pays back</span><b>${L(()=>{const m=T.shopRefund(S,k)*2/Math.max(1,T.shopInc(S,k,true));return m<60?Math.round(m)+" min":(m/60).toFixed(1)+" hr"})}</b></div></div>
  <div class="sec"><h3>PRICES</h3><div class="muted">${T.SHOP_MODES[mode].desc}</div><div class="row">${Object.entries(T.SHOP_MODES).map(([m,M])=>`<button class="${m===mode?"green":"ghost"}" data-act="shopmode" data-k="${k}" data-m="${m}" aria-pressed="${m===mode}">${M.name.toUpperCase()}</button>`).join("")}</div></div>
  <div class="sec"><h3>RUN A PROMOTION</h3><div class="muted">Double this shop's earnings for 2 minutes. Ready again 10 minutes after you start one.</div>
    <div class="row"><button class="pink" data-act="shoppromo" data-k="${k}">${L(()=>T.promoOn(S,k)?"PROMO ON · "+Math.ceil((sh.promoUntil-Date.now())/1000)+"s":(sh.promoReady||0)>Date.now()?"READY IN "+Math.ceil((sh.promoReady-Date.now())/60e3)+" MIN":"START PROMO")}</button></div></div>
  <div class="sec"><h3>UPGRADE</h3>${l>=T.SHOP_MAX?`<div class="up">Fully upgraded.</div>`:`<div class="muted">Level ${l+1} earns ${money(T.shopInc(S,k,true)*1.45)}/min and makes the perk stronger.</div><button class="cyan" data-act="buyshop" data-k="${k}" ${cost(c)}>UPGRADE ${money(c)}</button>`}</div>
  <div class="sec"><h3>MAKE IT YOURS</h3>
    <div class="row"><input id="shop-name" class="shopname" maxlength="22" placeholder="${esc(D.name)}" value="${esc(shopUI.name??(sh.name||""))}"><button class="ghost" data-act="renameshop" data-k="${k}">RENAME</button></div>
    <div class="row swatches">${PAINTS.map(c=>`<button class="sw ${(sh.color||D.color)===c?"on":""}" style="background:${c}" data-act="paintshop" data-k="${k}" data-c="${c}" aria-label="Paint color"></button>`).join("")}</div></div>
  <div class="sec"><h3>SELL</h3><div class="muted">Get back ${money(T.shopRefund(S,k))}, half of what you spent on it.</div><button class="${armed["sell"+k]?"red":"ghost"}" data-act="sellshop" data-k="${k}">${armed["sell"+k]?"TAP AGAIN TO SELL":"SELL SHOP"}</button></div>`;
  return h}
function vShops(){const ks=Object.keys(T.SHOPS),own=ks.filter(k=>T.shopLvl(S,k));
  let h=`<div class="head"><h2>SHOPS ${own.length}/${ks.length}</h2>${own.length?`<span class="pill" style="color:var(--green)">+${money(T.shopsPerMin(S))}/MIN, NO WORK</span>`:""}</div>
  <div class="muted">Small single-building businesses that run themselves. No staff, no floors, no registers to empty. Buy one and it earns on its own, even at full speed while you're away (up to 8 hours). Each one also gives your whole company a small perk that grows with its level.</div><div class="grid2 shops">`;
  ks.forEach(k=>{const D=T.SHOPS[k],l=T.shopLvl(S,k),c=T.shopCost(S,k),inc=l?T.shopInc(S,k):D.inc,next=l&&l<T.SHOP_MAX?T.shopInc(S,k,true)*1.45:0;
    h+=`<div class="card shop ${l?"owned":""}" ${l?`data-act="openshop" data-k="${k}" role="button" tabindex="0" title="Manage this shop"`:""}><canvas class="shopcv" data-k="${k}" data-l="${l}" width="120" height="64"></canvas>
      <div class="row spread"><b>${esc(l?shopName(k):D.name)}</b>${l?`<span class="pill">LV ${l}${l>=T.SHOP_MAX?" MAX":""}</span>`:`<span class="pill">FOR SALE</span>`}</div>
      <div class="muted">${D.blurb}</div>
      <div><span class="up">${money(inc)}/min</span>${l?` · earned ${L(()=>money(S.shops[k]?.earned||0))}`:""}</div>
      <div class="muted">Perk: ${D.perk}${l?` (now ×${T.shopPerk(S,k)})`:""}</div>${l?`<div class="muted tapme">${T.promoOn(S,k)?"★ PROMO RUNNING · ":""}Tap to visit and manage ▸</div>`:""}
      ${l>=T.SHOP_MAX?`<div class="up">Fully upgraded.</div>`:`<button class="${l?"cyan":""}" data-act="buyshop" data-k="${k}" ${cost(c)}>${l?`UPGRADE ${money(c)} → ${money(next)}/MIN`:`BUY ${money(c)}`}</button>`}</div>`});
  return h+`</div>`}
V.land=()=>{let h=vShops()+`<div class="head" style="margin-top:10px"><h2>PROPERTIES ${owned().length}/${T.LOTS.length}</h2>${S.landDiscount?`<span class="pill" style="color:var(--green)">30% OFF NEXT</span>`:""}</div>
  <div class="muted">Each property is a new tower with its own staff (hire them there), HR, lounge and crowds. Fancier districts unlock their own exclusive floors. Districts boost certain businesses, and busier districts draw bigger crowds.</div><div class="grid2">`;
  T.LOTS.forEach(l=>{const th=TOWER_THEMES[l.theme],own=S.lots[l.id],p=T.lotPrice(S,l),here=S.cur===l.id;
    h+=`<div class="card ${here?"sel":""}"><div class="thumb" style="background:linear-gradient(${th.sky.join(",")})"><div class="gr" style="background:${th.ground}"></div></div><b>${l.name}</b><div class="muted">${l.blurb}</div>`;
    const ex=Object.values(T.BIZ).find(b=>b.only===l.id),ups=Object.values(T.SUPPORT).filter(b=>b.minLot!=null&&T.LOTS.findIndex(x=>x.id===l.id)===b.minLot);
    if(ex||ups.length)h+=`<div class="up">Unlocks: ${[ex?ex.name+" (only here)":null,...ups.map(b=>b.name+" (here and fancier)")].filter(Boolean).join(", ")}</div>`;
    if(own){const inc=own.floors.reduce((a,f,i)=>a+(T.isBiz(f.type)?T.estPerMin(S,l.id,i,f):0),0);h+=`<div class="row spread"><span class="pill">${own.floors.length} FLOORS · ${money(inc)}/MIN · ${T.headcount(S,l.id)}/${T.staffCap(S,l.id)} STAFF</span><button class="${here?"ghost":"cyan"}" data-act="visit" data-l="${l.id}" ${here?"disabled":""}>${here?"YOU'RE HERE":"VISIT"}</button></div>`}
    else h+=`<button data-act="buylot" data-l="${l.id}" ${cost(p)}>BUY ${money(p)}</button>`;h+=`</div>`});return h+`</div>`};

/* ===== MONEY ===== */
V.money=()=>{const by={};let contracts=T.contractPerMin(S);for(const[lot,L0]of Object.entries(S.lots))L0.floors.forEach((f,i)=>{if(T.isBiz(f.type)){const r=T.frt(rt,lot,i,f);by[f.type]=(by[f.type]||0)+r.earn.reduce((a,e)=>a+e[1],0)}});
  const wages=T.wagesPerMin(S),gross=Object.values(by).reduce((a,b)=>a+b,0)+contracts,mx=Math.max(1,gross,wages),net=gross-wages;
  const line=(l,v,c,neg)=>`<div class="flow"><span>${l}</span><div class="fbar"><i style="width:${Math.max(v>0?1.5:0,v/mx*100)}%;background:${c}"></i></div><b class="${neg?"down":"up"}">${neg?"−":"+"}${money(v)}</b></div>`;
  let h=`<div class="card"><h3>LAST MINUTE, BY BUSINESS</h3>${Object.entries(by).map(([k,v])=>line(T.BIZ[k].name,v,T.BIZ[k].color)).join("")}${contracts?line("Contracts",contracts,"var(--green)"):""}${line("Wages",wages,"var(--red)",true)}
    <div class="flow total"><span>PROFIT</span><div></div><b class="${net>=0?"up":"down"}">${net>=0?"+":"−"}${money(Math.abs(net))}/min</b></div>
    ${S.buffs.length?`<div class="muted">Active: ${S.buffs.map(b=>esc(b.name)+" (ends in "+T.timeLeft(b.until)+")").join(", ")}</div>`:""}</div>`;
  const d=S.chart.slice(-120);
  if(d.length>1){const w=320,ht=120,X=i=>4+i/(d.length-1)*(w-8),mxv=Math.max(...d.map(x=>x.nw)),mn=Math.min(...d.map(x=>x.nw)),Y=v=>8+(1-(v-mn)/((mxv-mn)||1))*(ht-34),pts=d.map((x,i)=>X(i).toFixed(1)+","+Y(x.nw).toFixed(1)).join(" ");
    const pm=Math.max(1,...d.map(x=>Math.abs(x.pm))),bw=Math.max(1,(w-8)/d.length-1);
    h+=`<div class="card"><h3>NET WORTH · LAST ${Math.round(d.length/2)} MINUTES</h3><div class="row spread"><b class="up">${money(d[d.length-1].nw)}</b><span class="muted">bars show profit per minute</span></div>
    <svg viewBox="0 0 ${w} ${ht}" width="100%" height="150" preserveAspectRatio="none" style="display:block;background:#141428">${[.25,.5,.75].map(f=>`<line x1="0" x2="${w}" y1="${8+(ht-34)*f}" y2="${8+(ht-34)*f}" stroke="#2a2750"/>`).join("")}
    <polygon points="${X(0)},${ht-26} ${pts} ${X(d.length-1)},${ht-26}" fill="#5ee08a" fill-opacity=".15"/><polyline points="${pts}" fill="none" stroke="#5ee08a" stroke-width="2"/>
    ${d.map((x,i)=>{const b=Math.abs(x.pm)/pm*16;return`<rect x="${(X(i)-bw/2).toFixed(1)}" y="${(x.pm>=0?ht-4-b:ht-4).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(.5,b).toFixed(1)}" fill="${x.pm>=0?"#5ee08a":"#ff5d6c"}"/>`}).join("")}</svg></div>`}
  else h+=`<div class="card muted">Your growth chart appears after a minute of play.</div>`;
  const fl=[];for(const[lot,L0]of Object.entries(S.lots))L0.floors.forEach((f,i)=>{if(T.isBiz(f.type))fl.push({lot,i,f,v:T.estPerMin(S,lot,i,f)})});
  fl.sort((a,b)=>b.v-a.v);
  h+=`<div class="card"><h3>EVERY BUSINESS</h3>${fl.map(x=>`<div class="flow"><span>${T.BIZ[x.f.type].name} <span class="muted">· ${T.lotDef(x.lot).name} F${x.i+1} · ★${x.f.rating.toFixed(1)}</span></span><div class="fbar"><i style="width:${x.v/(fl[0].v||1)*100}%;background:${T.BIZ[x.f.type].color}"></i></div><b class="up">${money(x.v)}/min</b></div>`).join("")}</div>`;
  return h};

/* ===== RANK ===== */
V.records=()=>{const nw=T.netWorth(S),g=T.goal(S.goalIdx),prev=S.goalIdx?T.goal(S.goalIdx-1):0,pct=Math.max(0,Math.min(100,(nw-prev)/(g-prev)*100));
  const next=Object.values(T.BIZ).find(b=>b.rank>S.goalIdx);
  let h=`<div class="card sel"><h3>RANK: ${T.rank(S).toUpperCase()}</h3><div>Next rank at ${money(g)} net worth.</div><div class="bar"><i style="width:${pct}%;background:var(--gold)"></i></div>
    <div class="muted">Each rank adds a floor to every tower and pays a bonus.${next?` At ${T.RANKS[next.rank]} you can open a ${next.name}.`:""} There's no finish line.</div></div><div class="grid2">`;
  const st=(k,v)=>`<div class="card"><span class="muted">${k}</span><b style="font-family:var(--pix);font-size:12px;font-weight:normal">${v}</b></div>`;
  const served=Object.values(S.lots).reduce((a,L0)=>a+L0.floors.reduce((b,f)=>b+(f.served||0),0),0);
  h+=st("TOTAL EARNED",money(S.totalEarned))+st("CUSTOMERS SERVED",served.toLocaleString())+st("BEST PACE",money(S.bestMin)+"/min")+st("PROPERTIES",owned().length+" / "+T.LOTS.length)+st("TEAM",S.emps.length)+st("DAYS",S.day);
  h+=`</div><h3>COMPANY LOG</h3><div class="log">${S.log.slice(0,30).map(l=>`<div>${esc(l)}</div>`).join("")}</div>`;return h};

/* ===== SETTINGS ===== */
V.settings=()=>`${vAccount()}<h3>SETTINGS</h3>
  <div class="toggle"><span>Sound effects</span><button data-act="set" data-k="sound" class="${S.settings.sound?"green":"ghost"}">${S.settings.sound?"ON":"OFF"}</button></div>
  ${hasNotif?`<div class="toggle"><span>Desktop alerts for deals and big moments</span><button data-act="set" data-k="notify" class="${S.settings.notify?"green":"ghost"}">${S.settings.notify?"ON":"OFF"}</button></div>`:""}
  <div class="toggle"><span>Tutorial</span><button class="cyan" data-act="tut">REPLAY</button></div>
  <div class="toggle"><span>Start a brand new company</span><button data-act="reset" class="${armed.reset?"red":"ghost"}">${armed.reset?"TAP AGAIN TO ERASE":"RESET"}</button></div>
  <div class="muted">While this tab is closed, floors with a manager keep earning at half speed for up to 8 hours. Floors without one fill their registers.</div>
  <div class="sec" style="margin-top:8px"><h3>MOVE YOUR COMPANY</h3>
  <div class="muted">Copy your save code here, then paste it into Tower Tycoon on another browser, device, or the website version. Everything comes with you: money, towers, staff and stocks.</div>
  ${saveUI.code?`<textarea id="exp-code" class="code" readonly>${saveUI.code}</textarea>
    <div class="row"><button class="green" data-act="copysave">COPY CODE</button><button class="ghost" data-act="dlsave">DOWNLOAD AS FILE</button><span class="muted">Code from ${esc(saveUI.at)}. Your company keeps playing here.</span></div>`
   :`<div class="row"><button class="cyan" data-act="exportsave">GET MY SAVE CODE</button></div>`}
  <h3 style="margin-top:6px">LOAD A SAVE</h3>
  <textarea id="imp-code" class="code" placeholder="Paste a save code here (starts with TT3:)">${esc(saveUI.imp)}</textarea>
  <div class="row"><label class="ghost filebtn" for="imp-file">OR CHOOSE A SAVE FILE</label><input type="file" id="imp-file" accept=".json,.txt,application/json,text/plain" hidden>
    <button class="${armed.imp?"red":"green"}" data-act="importsave" ${saveUI.imp.trim()?"":"disabled"}>${armed.imp?"TAP AGAIN: REPLACE MY COMPANY":"LOAD THIS SAVE"}</button></div>
  <div class="muted">Loading a save replaces the company in this browser.</div></div>`;
const saveUI={code:"",at:"",imp:""};

/* ---------- accounts: one company, any device ---------- */
const CU={name:"",pass:"",busy:"",err:"",pending:false};
const cloudSig=()=>[Cloud.ready,!!Cloud.acct,Cloud.acct?.expired,CU.busy,CU.err,CU.pending,!!CU.name.trim()&&!!CU.pass].join(",");
const cAgo=t=>{const s=Math.round((Date.now()-t)/1000);return s<10?"just now":s<60?s+"s ago":s<3600?Math.round(s/60)+" min ago":s<86400?Math.round(s/3600)+" hr ago":Math.round(s/86400)+" days ago"};
function vAccount(){
  if(!Cloud.ready)return`<div class="sec acct"><h3>ACCOUNT</h3><div class="muted">Accounts aren't switched on for this copy of the game yet, so your company only lives in this browser. Use the save code below to move it for now.</div></div>`;
  const a=Cloud.acct;
  if(a&&!a.expired)return`<div class="sec acct"><h3>ACCOUNT</h3>
    <div class="row spread"><span>☁ Signed in as <b class="tl">${esc(Cloud.shown(a.email))}</b></span><span class="muted">${L(()=>CU.busy?CU.busy:a.lastSync?"Saved to cloud "+cAgo(a.lastSync):"Not saved yet")}</span></div>
    <div class="muted">Sign in with the same name and password on any device to keep playing this company. It saves to the cloud every minute and when you close the game.</div>
    ${CU.err?`<div class="down">${esc(CU.err)}</div>`:""}
    <div class="row"><button class="green" data-act="cloudsave" ${CU.busy?"disabled":""}>SAVE NOW</button><button class="ghost" data-act="cloudpull" ${CU.busy?"disabled":""}>LOAD FROM CLOUD</button><button class="ghost" data-act="signout">SIGN OUT</button></div></div>`;
  return`<div class="sec acct"><h3>ACCOUNT</h3>
    <div class="muted">${a&&a.expired?"Your sign-in expired. Sign in again to keep saving to the cloud.":"Make an account to play the same company on your phone, laptop or the extension. Your progress here comes with you."}</div>
    <form class="acctform" onsubmit="return false">
      <input id="acc-name" autocomplete="username" placeholder="Username or email" value="${esc(CU.name)}" maxlength="80">
      <input id="acc-pass" type="password" autocomplete="current-password" placeholder="Password (6+ characters)" value="${esc(CU.pass)}" maxlength="128">
    </form>
    ${CU.err?`<div class="down">${esc(CU.err)}</div>`:""}
    <div class="row"><button class="green" data-act="signin" ${CU.busy||!CU.name.trim()||!CU.pass?"disabled":""}>${CU.busy==="Signing in…"?CU.busy:"SIGN IN"}</button><button class="cyan" data-act="signup" ${CU.busy||!CU.name.trim()||!CU.pass?"disabled":""}>${CU.busy==="Creating…"?CU.busy:"CREATE ACCOUNT"}</button></div>
    <div class="muted">A username works fine. Write your password down: with a username there's no email to reset it.</div></div>`}

/* Swap in a company from somewhere else (a save code or the cloud) and give it its offline earnings. */
function loadCompany(ns,title,text){S=ns;rt.f={};rt.earn=[];sel=0;view.sel=0;saveUI.imp="";saveUI.code="";SFX.enabled=S.settings.sound;
  const o=T.offline(S);T.applyOffline(S,o||{mins:0,earned:0,filled:0});S.lastTick=Date.now();
  saveNow();view.rebuild();toBottom();note({kind:"milestone",title,text:text||`Welcome back, boss. ${T.rank(S)} with ${money(T.netWorth(S))} net worth.`,sfx:"fanfare"});setTab("floor")}

async function cloudSync({manual=false,keepalive=false}={}){const a=Cloud.acct;if(!Cloud.ready||!a||a.expired||CU.pending||(CU.busy&&!keepalive))return;
  if(!keepalive){CU.busy="Saving…";dirty=true}
  try{await saveNow();const r=await Cloud.push(S,{keepalive});CU.err="";if(r.conflict!==undefined)cloudChoice(r.conflict,"conflict");else if(manual){SFX.play("coin");toast("Saved to the cloud.")}}
  catch(e){CU.err=Cloud.acct?.expired?"":e.message;if(manual)toast(e.message)}
  CU.busy="";dirty=true}

/* Ask which company to keep when this device and the cloud disagree. */
function cloudChoice(remote,why){if(!remote){Cloud.push(S,{force:true}).then(()=>{dirty=true}).catch(e=>{CU.err=e.message;dirty=true});return}
  let rs=null;try{rs=T.importCode(remote.code)}catch(e){}
  CU.pending=true;dirty=true;const root=$("#modal-root");
  const head=why==="signin"?["YOUR ACCOUNT","WHICH COMPANY?","This account already has a company saved. Which one do you want to play?"]
    :why==="conflict"?["CLOUD SAVE","PLAYED SOMEWHERE ELSE","Your company was saved from another device while this one was open. Which one should continue?"]
    :["CLOUD SAVE","NEWER SAVE FOUND","You've played on another device since this one last saved. Which company do you want?"];
  root.innerHTML=`<div class="modal"><div class="event" role="dialog" aria-modal="true"><span class="tag">${head[0]}</span><h2>${head[1]}</h2><p>${head[2]}</p>
    <div class="cchoice"><div class="card"><b class="tl">IN THE CLOUD</b><div class="big">${money(remote.nw)}</div><div class="muted">${esc(remote.rank)} · saved ${cAgo(remote.at)}<br>from ${esc(remote.device||"another device")}</div></div>
    <div class="card"><b class="tl">ON THIS DEVICE</b><div class="big">${money(T.netWorth(S))}</div><div class="muted">${esc(T.rank(S))} · playing now<br>${esc(Cloud.deviceName())}</div></div></div>
    ${rs?"":`<p class="down">The cloud save couldn't be read, so keeping this device's company is the safe choice.</p>`}
    <div class="row"><button id="cc-cloud" ${rs?"":"disabled"}>PLAY THE CLOUD ONE</button><button id="cc-here" class="ghost">KEEP THIS ONE</button></div>
    <div class="muted">The one you don't pick is replaced.</div></div></div>`;
  const done=()=>{root.innerHTML="";CU.pending=false;dirty=true};
  $("#cc-cloud").onclick=async()=>{done();await Cloud.adopt(remote);loadCompany(rs,"CLOUD SAVE LOADED")};
  $("#cc-here").onclick=async()=>{done();try{await saveNow();await Cloud.push(S,{force:true});toast("This company is now your cloud save.")}catch(e){CU.err=e.message;toast(e.message)}dirty=true};
  ($("#cc-cloud").disabled?$("#cc-here"):$("#cc-cloud")).focus()}

/* On startup: grab a newer company from another device, or upload this one. */
async function cloudStart(beat){const a=Cloud.acct;if(!Cloud.ready||!a||a.expired)return;
  try{const remote=await Cloud.pull();
    if(!remote){await Cloud.push(S,{force:true});dirty=true;return}
    if(remote.updateTime===a.base)return cloudSync();
    // This device hasn't been played since its last cloud save, so the newer cloud company simply wins.
    if(a.base&&a.lastSync&&beat<=a.lastSync+70000){let rs;try{rs=T.importCode(remote.code)}catch(e){return cloudChoice(remote,"newer")}
      await Cloud.adopt(remote);loadCompany(rs,"PICKED UP WHERE YOU LEFT OFF",`Loaded your company from ${remote.device||"your other device"}. ${T.rank(S)} with ${money(T.netWorth(S))} net worth.`);return}
    cloudChoice(remote,"newer")}
  catch(e){CU.err=Cloud.acct?.expired?"":e.message;dirty=true}}

async function doSignIn(create){if(CU.busy)return;CU.busy=create?"Creating…":"Signing in…";CU.err="";dirty=true;render();
  try{await Cloud.signIn(CU.name,CU.pass,create);CU.pass="";
    const remote=create?null:await Cloud.pull();
    if(remote){CU.busy="";cloudChoice(remote,"signin")}
    else{await saveNow();await Cloud.push(S,{force:true});SFX.play("fanfare");toast(create?"Account made! This company now saves to the cloud.":"Signed in. This company now saves to the cloud.")}}
  catch(e){CU.err=e.message;SFX.play("bad")}
  CU.busy="";dirty=true;render()}

/* ---------- actions ---------- */
function arm(k){armed[k]=1;setTimeout(()=>{delete armed[k];dirty=true},3000);dirty=true;render()}
function act(sfx,msg){if(sfx)SFX.play(sfx);if(msg)toast(msg);view.rebuild();save();render()}
function spend(c){if(S.cash<c)return false;S.cash-=c;S.spent+=c;return true}
const ACT={
  tab:d=>setTab(d.t),
  addfloor:()=>$("#add-floor").click(),
  gohr:()=>{const lot=TU.sub&&tab==="team"?(allTowers()?S.cur:tl()):S.cur,L0=S.lots[lot];let i=L0.floors.findIndex(f=>f.type==="office"&&f.lvl<T.MAX_SUP);if(i<0)i=L0.floors.findIndex(f=>!f.type);
    if(i<0)return toast(`No empty floor at ${T.lotDef(lot).name}. Use + FLOOR under the tower first.`);if(lot!==S.cur)goLot(lot);sel=i;view.sel=i;setTab("floor")},
  build:d=>{const lot=S.cur;if(!T.allowedHere(d.t,lot))return toast("That can't be built here.");if(!spend(T.buildCost(d.t,lot)))return;S.lots[lot].floors[sel]=T.isBiz(d.t)?T.bizFloor(d.t):T.supFloor(d.t);view.construct(sel);T.log(S,`Opened a ${T.KINDS[d.t].name} at ${T.lotDef(lot).name}.`);
    act("build",T.isBiz(d.t)?"Now assign someone to the new station.":"Built! "+T.pick(T.AFFIRM))},
  station:()=>{const f=S.lots[S.cur].floors[sel];if(!spend(T.stationCost(f,S.cur)))return;f.stations++;f.staff.push(null);view.construct(sel);act("build","New station. Assign someone to it.")},
  decor:()=>{const f=S.lots[S.cur].floors[sel];if(!spend(T.decorCost(f,S.cur)))return;f.decor++;view.celebrate(sel);act("level",f.decor===5?"Your business now has its own neon sign!":f.decor===7?"A chandelier! Fancy.":T.pick(T.AFFIRM))},
  price:d=>{const f=S.lots[S.cur].floors[sel];f.price=+d.k;act("click")},
  supup:()=>{const f=S.lots[S.cur].floors[sel];if(!spend(T.supCost(f,S.cur)))return;f.lvl++;view.construct(sel);act("level")},
  demolish:()=>{const f0=S.lots[S.cur].floors[sel];if(f0.type==="office"){const n=T.headcount(S,S.cur),after=T.staffCap(S,S.cur)-3*f0.lvl;
      if(n>after){SFX.play("bad");return toast(`${n} people work at ${T.lotDef(S.cur).name}, but only ${after} would fit without this HR Office. Move or let go ${n-after} first.`)}}
    if(!armed.demo)return arm("demo");delete armed.demo;const f=S.lots[S.cur].floors[sel];
    S.emps.forEach(e=>{if((e.loc&&e.loc.lot===S.cur&&e.loc.i===sel)||(e.at&&e.at.lot===S.cur&&e.at.i===sel))T.unassign(S,e.id)});if(T.isBiz(f.type))S.cash+=f.register;
    S.lots[S.cur].floors[sel]={type:null};delete rt.f[S.cur+":"+sel];act("bad","Floor cleared.")},
  collect:()=>{collect(S.cur,sel);dirty=true},
  assign:(d,el)=>{if(!el.value)return;const e=T.emp(S,el.value);T.assign(S,el.value,S.cur,sel,+d.k);act("coin",`${first(e)} is on station ${+d.k+1}.${e.fav===S.lots[S.cur].floors[sel].type?" They love it here!":""}`)},
  unassign:d=>{const e=T.emp(S,d.id);T.unassign(S,d.id);act("click",`${first(e)} is free for another job.`)},
  mgr:(d,el)=>{if(!el.value)return;const e=T.emp(S,el.value);T.setManager(S,el.value,S.cur,sel);act("fanfare",`${first(e)} is now a manager! Their pay went up 50%.`)},
  promote:(d,el)=>{if(!el.value)return;const[lot,i]=el.value.split(":");const e=T.emp(S,d.id);T.setManager(S,d.id,lot,+i);act("fanfare",`${first(e)} is now managing the ${T.BIZ[S.lots[lot].floors[+i].type].name}!`)},
  promoready:d=>{armed["promo"+d.id]=1;TU.open=d.id;act("click")},
  ability:()=>{const f=S.lots[S.cur].floors[sel],m=T.emp(S,f.manager);if(!m||f.abil>Date.now())return;f.abil=Date.now()+300e3;
    if(m.ability==="pep"){f.staff.forEach(id=>{const e=T.emp(S,id);if(e){e.energy=100;e.mood=Math.min(100,e.mood+15)}});toast(`${first(m)} fired everyone up!`)}
    else{f.buff={kind:m.ability,until:Date.now()+60e3};toast(m.ability==="rush"?"Rush hour! Double customers for 60 seconds.":"Happy hour! +50% revenue for 60 seconds.")}act("up")},
  hire:d=>{const a=S.applicants.find(x=>x.id===d.id),fee=T.hireFee(a),lot=d.l&&S.lots[d.l]?d.l:S.cur;if(S.cash<fee||T.roomAt(S,lot)<=0)return;S.cash-=fee;a.home=lot;S.emps.push(a);S.applicants=S.applicants.filter(x=>x!==a);
    T.log(S,`Hired ${a.name} at ${T.lotDef(lot).name}.`);act("coin",`Welcome aboard, ${first(a)}! They'll work at ${T.lotDef(lot).name}. Give them a station on the Floor tab.`)},
  mgrmove:(d,el)=>{if(!el.value)return;const e=T.emp(S,el.value),lot=S.cur;if(T.roomAt(S,lot)<=0)return toast(`${T.lotDef(lot).name} is full.`);
    const from=T.lotDef(T.homeOf(e)).name;T.unassign(S,e.id);e.home=lot;T.setManager(S,e.id,lot,sel);act("fanfare",`${first(e)} moved from ${from} to manage the ${T.BIZ[S.lots[lot].floors[sel].type].name}!`)},
  moveemp:(d,el)=>{if(!el.value)return;const e=T.emp(S,d.id),to=el.value;if(T.roomAt(S,to)<=0)return toast(`${T.lotDef(to).name} is full.`);
    const wasHr=e.role==="hr";if(e.role!=="broker")T.unassign(S,d.id);if(wasHr&&T.hrDirector(S,to)){e.role="staff";e.state="idle"}e.home=to;
    act("coin",`${first(e)} moved to ${T.lotDef(to).name}.${wasHr&&e.role!=="hr"?" That tower already has an HR Director, so they're regular staff there.":""}`)},
  tlot:d=>{TU.lot=d.k===S.cur?null:d.k;TU.open=null;act("click")},
  postad:()=>{if(S.cash<100)return;S.cash-=100;T.refreshApplicants(S);act("click")},
  praise:d=>{const e=T.emp(S,d.id);if(Date.now()-e.praisedAt<300e3)return;e.praisedAt=Date.now();e.mood=Math.min(100,e.mood+15);e.low=Math.max(0,e.low-60);act("up",`${first(e)}: "${T.pick(["Thanks, boss!","That means a lot.","I'll keep it up!","Aw, shucks."])}"`)},
  raise:d=>{const e=T.emp(S,d.id);e.salary=Math.round(e.salary*1.15*100)/100;e.mood=Math.min(100,e.mood+20);e.low=0;act("coin",`${first(e)} now earns ${money(e.salary)}/min and is thrilled.`)},
  train:d=>{const e=T.emp(S,d.id),l=T.homeOf(e),i=T.findSupport(S,l,"training");const spot=i>=0&&T.seatsFree(S,l,"training")>0?{lot:l,i}:null;
    if(!spot)return toast(`No free training seats at ${T.lotDef(l).name}. Each tower needs its own Training Room.`);e.state="train";e.at=spot;act("click",`${first(e)} is off to training. Their station is empty until they're back.`)},
  stoptrain:d=>{const e=T.emp(S,d.id);e.state=e.loc?(e.loc.mgr?"manage":"work"):"idle";e.at=null;act("click")},
  rest:d=>{const e=T.emp(S,d.id),li=T.findSupport(S,e.loc.lot,"lounge");if(li<0||T.seatsFree(S,e.loc.lot,"lounge")<=0)return toast("The lounge is full right now.");e.state="break";e.at={lot:e.loc.lot,i:li};act("click")},
  point:d=>{const e=T.emp(S,d.id);if(e.pts<1||e[d.s]>=10)return;e.pts--;e[d.s]++;act("level",`${first(e)} got better at ${{spd:"speed",chr:"charm",sta:"stamina"}[d.s]}!`)},
  fire:d=>{if(!armed["fire"+d.id])return arm("fire"+d.id);const e=T.emp(S,d.id);T.unassign(S,d.id);S.emps=S.emps.filter(x=>x!==e);S.inbox=S.inbox.filter(x=>x.emp!==d.id);
    S.emps.forEach(x=>x.mood=Math.max(0,x.mood-5));T.log(S,`Let ${e.name} go.`);act("bad",`${first(e)} packed up. The team is a little shaken.`)},
  inbox:d=>{const r=T.resolveInbox(S,rt,d.id,d.a);if(!r.ok){SFX.play("bad");return toast(r.msg)}act(d.a==="deny"?"click":"up",r.msg)},
  deal:d=>{if(d.y==="1"){const r=T.applyDeal(S,d.id);if(!r.ok){SFX.play("bad");return toast(r.msg)}act("deal",r.msg)}else{T.declineDeal(S,d.id);act("click")}},
  stock:d=>{mktSel=d.t;act("click");document.querySelector(".sdet")?.scrollIntoView({block:"start"})},
  mktsub:d=>{mktSub=d.k;act("click");$("#body").scrollTop=0},
  alloc:d=>{S.fund.alloc=+d.a;act("click",+d.a?`Brokers will keep ${+d.a*100}% of your money invested.`:"Brokers paused. They'll hand the fund back at the next update.")},
  withdraw:()=>{const F=S.fund;for(const p of Object.values(F.pos)){const s=S.stocks.find(x=>x.t===p.t);if(s)F.cash+=p.q*s.p*(1-.004)}F.pos={};const v=F.cash;S.cash+=v;F.cash=0;F.alloc=0;act("cash",`${money(v)} moved back to cash. Investing is paused.`)},
  mkbrokersel:(d,el)=>{if(!el.value)return;ACT.mkbroker({id:el.value})},
  mkbroker:d=>{if(T.brokers(S).length>=T.brokerCap(S))return toast("No broker seats. Upgrade a Trading Desk.");const e=T.emp(S,d.id);T.setRole(S,d.id,"broker");act("fanfare",`${first(e)} is now a broker!`)},
  mkhrsel:(d,el)=>{if(!el.value)return;ACT.mkhr({id:el.value})},
  mkhr:d=>{const e=T.emp(S,d.id),lot=T.homeOf(e),old=T.hrDirector(S,lot);if(old)T.unassign(S,old.id);T.setRole(S,d.id,"hr");TU.sub="hr";TU.lot=lot===S.cur?null:lot;act("fanfare",`${first(e)} is the new HR Director at ${T.lotDef(lot).name}!`)},
  hrtoggle:d=>{S.hr[d.k]=!S.hr[d.k];act("click")},
  teamsub:(d,el,ev)=>{ev?.preventDefault?.();TU.sub=d.k;TU.open=null;act("click");$("#body").scrollTop=0},
  tfilter:d=>{TU.filter=d.k;TU.limit=40;act("click")},
  tsort:(d,el)=>{TU.sort=el.value;act("click")},
  tmore:()=>{TU.limit+=40;act("click")},
  openemp:d=>{TU.open=TU.open===d.id?null:d.id;act("click")},
  placeemp:(d,el)=>{if(!el.value)return;const[lot,i,k]=el.value.split(":"),e=T.emp(S,d.id);T.assign(S,d.id,lot,+i,+k);act("coin",`${first(e)} is on the ${T.BIZ[S.lots[lot].floors[+i].type].name}.`)},
  payfair:()=>{let n=0;teamSet().forEach(e=>{if(underpaid(e)){e.salary=Math.round(T.fairPay(e)*1.02*100)/100;e.mood=Math.min(100,e.mood+10);e.low=0;n++}});act("coin",`${n} people got a fair raise. Morale is up.`)},
  praiseall:()=>{let n=0;teamSet().forEach(e=>{if(praiseReady(e)&&e.mood<80){e.praisedAt=Date.now();e.mood=Math.min(100,e.mood+15);e.low=Math.max(0,e.low-60);n++}});act("up",`You thanked ${n} people. Smiles all around.`)},
  spendall:()=>{let n=0;teamSet().forEach(e=>{while(e.pts>0){if(!T.spendPoint(e))break;e.pts--;n++}});act("level",`Spent ${n} skill point${n>1?"s":""}: speed first, then charm, then stamina.`)},
  fillall:()=>{let n=0;for(const e of teamSet().filter(e=>e.role==="staff"&&e.state==="idle")){const es=T.emptyStations(S,(f,l)=>l===T.homeOf(e)),b=es.find(x=>x.f.type===e.fav)||es[0];if(!b)break;T.assign(S,e.id,b.lot,b.i,b.k);n++}act("coin",`${n} empty station${n>1?"s":""} filled.`)},
  buy:d=>{const st=S.stocks.find(s=>s.t===mktSel),fe=T.fee(S),q=Math.floor(Math.max(0,S.cash)*+d.p/(st.p*(1+fe)));const r=T.buyStock(S,st.t,q);if(!r)return;act("coin",`Bought ${q.toLocaleString()} ${st.t} for ${money(r.cost)}.`)},
  sell:d=>{const st=S.stocks.find(s=>s.t===mktSel),own=S.port[st.t]||0,q=+d.p>=1?own:Math.floor(own*+d.p);const r=T.sellStock(S,st.t,q);if(!r)return;act(r.pnl>=0?"cash":"bad",`Sold ${q.toLocaleString()} ${st.t} for ${money(r.value)} (${r.pnl>=0?"+":""}${money(r.pnl)}).`)},
  order:d=>{const o=S.orders[mktSel]||(S.orders[mktSel]={});o[d.k]=+d.v;if(!o.tp&&!o.sl)delete S.orders[mktSel];act("click",+d.v?`${d.k==="tp"?"Take profit":"Stop loss"} set at ${d.k==="tp"?"+":"−"}${+d.v*100}%.`:"Order cleared.")},
  gostock:d=>{mktSel=d.t;mktSub="market";act("click");document.querySelector(".sdet")?.scrollIntoView({block:"start"})},
  bstrat:(d,el)=>{const e=T.emp(S,d.id);e.strat=el.value;act("click",`${first(e)} is now a ${T.STRATS[el.value].name.toLowerCase()}.`)},
  bsector:(d,el)=>{const e=T.emp(S,d.id);e.sector=el.value;act("click",`${first(e)} now specializes in ${T.SECTORS[el.value].name}.`)},
  visit:d=>{goLot(d.l);setTab("floor")},
  openshop:d=>{shopUI.name=null;goShop(d.k)},
  shopmode:d=>{T.setShop(S,d.k,{mode:d.m});act("click",`${shopName(d.k)} is now ${T.SHOP_MODES[d.m].name.toLowerCase()}.`)},
  shoppromo:d=>{const r=T.shopPromo(S,d.k);if(!r.ok){SFX.play("bad");return toast(r.msg||"Not ready.")}act("cash",`Promo running! ${shopName(d.k)} earns double for 2 minutes.`)},
  renameshop:d=>{T.setShop(S,d.k,{name:shopUI.name??""});shopUI.name=null;act("coin",`Renamed to ${shopName(d.k)}.`)},
  paintshop:d=>{T.setShop(S,d.k,{color:d.c});act("click")},
  sellshop:d=>{if(!armed["sell"+d.k])return arm("sell"+d.k);delete armed["sell"+d.k];const n=shopName(d.k),r=T.sellShop(S,d.k);S.curShop=null;view.rebuild();act("coin",`Sold ${n} for ${money(r.v)}.`)},
  buyshop:d=>{const r=T.buyShop(S,d.k),D=T.SHOPS[d.k];if(!r.ok){SFX.play("bad");return toast(r.msg||"Can't do that yet.")}
    if(r.lvl===1)note({kind:"milestone",title:`NEW SHOP: ${D.name.toUpperCase()}`,text:`It runs itself and earns ${money(T.shopInc(S,d.k))}/min, even while you're away. Visit it with the ◀ ▶ arrows by your tower. Perk: ${D.perk}.`,sfx:"fanfare"});
    act("cash",r.lvl>1?`${D.name} is now level ${r.lvl}: ${money(T.shopInc(S,d.k))}/min.`:null)},
  buylot:d=>{const l=T.lotDef(d.l),p=T.lotPrice(S,l);if(S.cash<p)return;S.cash-=p;S.spent+=l.price;S.landDiscount=0;S.lots[l.id]={floors:[{type:null},{type:null}]};
    T.log(S,`Bought ${l.name}!`);note({kind:"milestone",title:"NEW PROPERTY!",text:`Welcome to ${l.name}. ${l.blurb}`,sfx:"fanfare"});goLot(l.id);setTab("floor")},
  set:d=>{S.settings[d.k]=!S.settings[d.k];SFX.enabled=S.settings.sound;act("click")},
  tut:()=>startTutorial(),
  exportsave:()=>{saveUI.code=T.exportCode(S);saveUI.at=new Date().toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});act("click","Save code ready. Copy it or download it.")},
  copysave:()=>{const ta=$("#exp-code");const done=()=>{SFX.play("coin");toast("Copied! Paste it into the other game's Settings.")};
    try{navigator.clipboard.writeText(saveUI.code).then(done,()=>{ta.select();document.execCommand("copy");done()})}catch(e){ta.select();document.execCommand("copy");done()}},
  dlsave:()=>{const blob=new Blob([saveUI.code],{type:"text/plain"}),a=document.createElement("a"),d=new Date();a.href=URL.createObjectURL(blob);
    a.download=`tower-tycoon-save-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}.txt`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);SFX.play("coin")},
  importsave:()=>{let ns;try{ns=T.importCode(saveUI.imp)}catch(e){SFX.play("bad");return toast(e.message)}
    if(!armed.imp)return arm("imp");delete armed.imp;loadCompany(ns,"COMPANY LOADED");cloudSync({manual:false})},
  signin:()=>doSignIn(false),
  signup:()=>doSignIn(true),
  signout:async()=>{await cloudSync({manual:false});await Cloud.signOut();CU.err="";act("click","Signed out. Your company stays on this device too.")},
  cloudsave:()=>cloudSync({manual:true}),
  cloudpull:async()=>{CU.busy="Checking…";dirty=true;try{const r=await Cloud.pull();CU.busy="";if(!r)toast("Nothing in the cloud yet. Tap SAVE NOW.");else if(r.updateTime===Cloud.acct.base)toast("You're already playing your latest cloud save.");else cloudChoice(r,"newer")}catch(e){CU.busy="";CU.err=e.message}dirty=true},
  reset:()=>{if(!armed.reset)return arm("reset");delete armed.reset;const keep=S.settings;S=T.fresh();S.settings=keep;S.tutorialDone=true;rt.f={};sel=0;act("bad","Fresh start. Go build.")},
};
const body=$("#body");
body.addEventListener("click",e=>{const b=e.target.closest("[data-act]");if(!b||b.disabled||b.tagName==="SELECT")return;if(b.tagName==="A")e.preventDefault();SFX.unlock();ACT[b.dataset.act]?.(b.dataset,b,e)});
body.addEventListener("change",e=>{const s=e.target.closest("select[data-act]");if(s)ACT[s.dataset.act]?.(s.dataset,s);
  if(e.target.id==="imp-file"&&e.target.files[0]){const r=new FileReader();r.onload=()=>{saveUI.imp=String(r.result);dirty=true;render();toast("Save file loaded. Tap LOAD THIS SAVE.")};r.readAsText(e.target.files[0])}});
body.addEventListener("input",e=>{if(e.target.id==="tsearch"){TU.q=e.target.value;const q=TU.q.trim().toLowerCase();body.querySelectorAll(".erow").forEach(r=>r.hidden=!!q&&!r.dataset.name.includes(q))}
  if(e.target.id==="shop-name"){shopUI.name=e.target.value}
  if(e.target.id==="acc-name"||e.target.id==="acc-pass"){CU[e.target.id==="acc-name"?"name":"pass"]=e.target.value;const ok=!!CU.name.trim()&&!!CU.pass&&!CU.busy;body.querySelectorAll('[data-act="signin"],[data-act="signup"]').forEach(b=>b.disabled=!ok);lastSig=sig()}
  if(e.target.id==="imp-code"){const had=!!saveUI.imp.trim();saveUI.imp=e.target.value;const b=body.querySelector('[data-act="importsave"]');if(b)b.disabled=!saveUI.imp.trim();if(had!==!!saveUI.imp.trim())lastSig=sig()}});
body.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.matches("tr[data-act],div[data-act]"))ACT[e.target.dataset.act]?.(e.target.dataset)});
addEventListener("pointerdown",()=>{pointerDown=true;SFX.unlock()});addEventListener("pointerup",()=>setTimeout(()=>pointerDown=false,50));
body.addEventListener("focusin",e=>{if(e.target.tagName==="SELECT")pointerDown=true});body.addEventListener("focusout",e=>{if(e.target.tagName==="SELECT")pointerDown=false});

/* ---------- main loop ---------- */
let last=performance.now();
function handle(evs){for(const e of evs){if(e.dirty)dirty=true;if(e.title)note(e)}}
setInterval(()=>{const n=performance.now();let dt=(n-last)/1000;last=n;
  if(dt>90){const o=T.offline(S);if(o){T.applyOffline(S,o);note({kind:"good",title:"WELCOME BACK",text:`Managers earned ${money(o.earned)} and registers filled with ${money(o.filled)}.`,sfx:"cash"});view.rebuild()}return}
  while(dt>0){const s=Math.min(.5,dt);handle(T.tick(S,rt,s));dt-=s}},100);
(function shopLoop(){let t=0;const step=()=>{t++;if(tab==="land"&&!document.hidden)document.querySelectorAll("canvas.shopcv").forEach(c=>{const x=c.getContext("2d");drawShop(x,c.dataset.k,+c.dataset.l,t+c.dataset.k.length*37,S.shops[c.dataset.k]?.color||T.SHOPS[c.dataset.k].color,T.promoOn(S,c.dataset.k))});requestAnimationFrame(step)};requestAnimationFrame(step)})();
setInterval(()=>{hud();live();if(!pointerDown&&!["TEXTAREA","INPUT"].includes(document.activeElement?.tagName)&&(dirty||sig()!==lastSig))render()},350);

/* ---------- tutorial ---------- */
const STEPS=[
  {sel:null,t:"WELCOME, BOSS",p:"You run a tiny café with one loyal employee. Your goal is to build a business people love. Nothing here is on a timer, so take your time and watch how things work."},
  {sel:"#towerscroll",t:"WATCH YOUR CAFÉ",p:"Customers ride the elevator up and wait in line on the right. Your barista serves them at the counter (the green bar is their progress), and they pay into the gold register. A heart means they loved it. A red ! means they're upset."},
  {sel:"#towerscroll",t:"COLLECT YOUR MONEY",p:"Tap a floor to collect its register. When a register is FULL, new money is lost, so check in on your floors."},
  {sel:"#body",tab:"floor",t:"THE FLOOR PANEL",p:"The colored box at the top tells you what's holding this business back right now, and what to do about it. Below it are live numbers: customers arriving, how many you can serve, and who walked out."},
  {sel:"#body",tab:"floor",t:"STATIONS AND STAFF",p:"Each station serves one customer at a time and needs one employee (5 max). If customers are walking out, you need more stations or faster staff. If your staff are idle, you need more customers."},
  {sel:"#body",tab:"team",t:"YOUR PEOPLE",p:"Every employee has speed, charm and stamina, a personality, and a favorite kind of business. They level up by working. Spend their skill points, praise them, and pay them fairly. Unhappy people quit."},
  {sel:"#towerscroll",t:"REST MATTERS",p:"Working drains energy. Exhausted staff work slowly and customers notice. A Staff Lounge lets tired staff rest on their own and come back at full speed."},
  {sel:"#body",tab:"inbox",t:"YOUR INBOX",p:"Staff requests, visiting critics, local events and offers wait here. None of it is urgent. Business deals from other companies show up here too."},
  {sel:"#towerscroll",tab:"floor",t:"YOUR FIRST MOVE",p:"There's an empty floor above the café. Tap it and choose what to build. Later, promote a level 3 employee to manager so that floor runs itself."},
];
let tutI=0;
function startTutorial(){tutI=0;showTut()}
function showTut(){const st=STEPS[tutI],root=$("#tut-root");if(st.tab&&tab!==st.tab)setTab(st.tab);SFX.play("tut");
  root.innerHTML=`<div class="tut-hole"></div><div class="tut-box" role="dialog" aria-modal="true"><span class="step">${tutI+1} / ${STEPS.length}</span><h2></h2><p></p>
    <div class="row spread"><div class="row"><button class="ghost" id="tut-skip">SKIP</button>${!tutI&&Cloud.ready&&!Cloud.acct?`<button class="cyan" id="tut-acct">I HAVE AN ACCOUNT</button>`:""}</div><div class="row">${tutI?`<button class="ghost" id="tut-back">BACK</button>`:""}<button id="tut-next">${tutI===STEPS.length-1?"LET'S GO":"NEXT"}</button></div></div></div>`;
  root.querySelector("h2").textContent=st.t;root.querySelector("p").textContent=st.p;
  const hole=root.querySelector(".tut-hole"),box=root.querySelector(".tut-box");
  requestAnimationFrame(()=>{const bw=box.offsetWidth,bh=box.offsetHeight,vw=innerWidth,vh=innerHeight;
    if(st.sel){const r=$(st.sel).getBoundingClientRect();Object.assign(hole.style,{left:r.left-4+"px",top:r.top-4+"px",width:r.width+8+"px",height:r.height+8+"px"});
      let x=r.right+12,y=r.top;if(x+bw>vw-8){x=Math.max(8,Math.min(vw-bw-8,r.left));y=r.bottom+12;if(y+bh>vh-8)y=Math.max(8,r.top-bh-12)}
      Object.assign(box.style,{left:x+"px",top:Math.max(8,Math.min(vh-bh-8,y))+"px"})}
    else{Object.assign(hole.style,{left:vw/2+"px",top:vh/2+"px",width:"0px",height:"0px"});Object.assign(box.style,{left:(vw-bw)/2+"px",top:(vh-bh)/2+"px"})}});
  const done=()=>{root.innerHTML="";S.tutorialDone=true;const e=S.lots[S.cur].floors.findIndex(f=>!f.type);if(e>=0){sel=e;view.sel=e}save();setTab("floor")};
  $("#tut-next").onclick=()=>{if(tutI===STEPS.length-1)return done();tutI++;showTut()};
  $("#tut-back")?.addEventListener("click",()=>{tutI--;showTut()});$("#tut-skip").onclick=done;const ta=$("#tut-acct");if(ta)ta.onclick=()=>{done();setTab("settings");setTimeout(()=>$("#acc-name")?.focus(),50)};$("#tut-next").focus()}
addEventListener("resize",()=>{if($("#tut-root").innerHTML)showTut()});

/* ---------- boot ---------- */
SFX.enabled=S.settings.sound;T.pruneDeals(S);
const o=T.offline(S);
toBottom();render();
if(o&&(o.earned>0||o.filled>0)){T.applyOffline(S,o);
  const root=$("#modal-root");root.innerHTML=`<div class="modal"><div class="event" role="dialog" aria-modal="true"><span class="tag">WELCOME BACK</span><h2>WHILE YOU WERE AWAY</h2>
    ${o.earned?`<div class="big">+${money(o.earned)}</div><p>${o.shops&&o.earned-o.shops>0?`Your managers banked ${money(o.earned-o.shops)} and your shops made ${money(o.shops)}.`:o.shops?`Your shops kept the lights on and made ${money(o.shops)}.`:"Your managers kept things running and banked it for you."}</p>`:""}
    ${o.filled?`<p>Your registers filled up with <b style="color:var(--gold)">${money(o.filled)}</b>. Tap each floor (or COLLECT) to bank it.${o.earned?"":" Promote managers so floors earn on their own while you're gone."}</p>`:""}
    <div class="row"><button id="wb-ok">LET'S GO</button></div></div></div>`;
  $("#wb-ok").focus();$("#wb-ok").onclick=()=>{root.innerHTML="";SFX.play("cash")}}
else T.applyOffline(S,{mins:0,earned:0,filled:0});
S.lastTick=Date.now();await saveNow();processActions();
cloudStart(bootBeat);
if(!S.tutorialDone)startTutorial();
})();
