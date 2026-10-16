/* Tower Tycoon core v3: a real-time service sim.
   Customers arrive, queue, get served by your staff, pay into a register and leave a rating.
   Shared by the game page (runs the sim) and the background worker. No DOM here. */
(function(G){
const rnd=(a,b)=>a+Math.random()*(b-a), ri=(a,b)=>Math.floor(rnd(a,b+1)), pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const money=n=>{const s=n<0?"-":"";n=Math.abs(n);
  if(n>=1e12)return s+"$"+(n/1e12).toFixed(2)+"T";if(n>=1e9)return s+"$"+(n/1e9).toFixed(2)+"B";
  if(n>=1e6)return s+"$"+(n/1e6).toFixed(2)+"M";if(n>=1e4)return s+"$"+(n/1e3).toFixed(1)+"K";
  if(n<100&&n%1)return s+"$"+n.toFixed(2);return s+"$"+Math.round(n).toLocaleString("en-US")};

/* ---------- businesses & support floors ---------- */
const BIZ={
  cafe:    {name:"Café",       color:"#c98a5a",price:8,  time:4, arrive:14,  cost:300,   rank:0,desc:"Coffee and pastries. Lots of quick customers with small tabs."},
  burger:  {name:"Burger Bar", color:"#ff9b4a",price:22, time:7, arrive:9,  cost:1500,  rank:1,desc:"Hearty meals and steady crowds."},
  boutique:{name:"Boutique",   color:"#ff7ad9",price:65, time:11,arrive:6,cost:9000,  rank:3,desc:"Fashion. Fewer shoppers who spend a lot more."},
  arcade:  {name:"Arcade",     color:"#5ad1ff",price:170,time:14,arrive:4.5,cost:45000, rank:4,desc:"Games and prizes. Big spenders who stay a while."},
  spa:     {name:"Day Spa",    color:"#5ee08a",price:520,time:24,arrive:2.8,cost:250e3, rank:6,desc:"Pampering. Guests expect a beautiful space."},
  dining:  {name:"Sky Dining", color:"#ffcc3d",price:1700,time:36,arrive:1.9,cost:1.8e6, rank:8,desc:"Fine dining. Every single guest is a big deal."},
  // district exclusives: only buildable in one property
  seafood: {name:"Seafood Shack",color:"#4fc3d9",price:60,  time:8, arrive:7,  cost:14500, rank:0,only:"harbor",desc:"Fresh catch off the pier. Fast, busy and only on Harbor Pier."},
  vr:      {name:"VR Arcade",    color:"#7a6bff",price:240, time:15,arrive:4,  cost:39000, rank:0,only:"tech",  desc:"Headsets and holograms. Only in Tech Park."},
  cinema:  {name:"Cinema",       color:"#e04a5a",price:420, time:22,arrive:4,  cost:59000, rank:0,only:"mall",  desc:"Blockbusters and popcorn. Only in Mega Mall."},
  club:    {name:"Nightclub",    color:"#ff3dd0",price:900, time:26,arrive:3,  cost:160e3, rank:0,only:"neon",  desc:"Velvet ropes and a packed dance floor. Only on Neon Strip."},
  resort:  {name:"Resort Pool",  color:"#3ad6c4",price:2600,time:40,arrive:2,  cost:417e3, rank:0,only:"oasis", desc:"Cabanas and cocktails. Only at Desert Oasis."},
  skylounge:{name:"Sky Lounge",  color:"#9ec9ff",price:7000,time:45,arrive:1.6,cost:1.22e6,rank:0,only:"sky",   desc:"Drinks above the clouds. Only in Skyline Heights."},
  zerog:   {name:"Zero-G Hotel", color:"#c8c8ff",price:25000,time:60,arrive:1.2,cost:3.8e6,rank:0,only:"moon",  desc:"Float to sleep. Only on Moon Base."},
  dome:    {name:"Dome Resort",  color:"#ff8a5a",price:90000,time:70,arrive:1, cost:12.8e6,rank:0,only:"mars",  desc:"A garden under glass on Mars. Only on Mars Colony."},
};
const SUPPORT={
  lounge:   {name:"Staff Lounge", color:"#b78cff",cost:800, desc:"Tired staff in this tower rest here, then go back to work at full energy. 2 seats per level."},
  marketing:{name:"Marketing",    color:"#ff5d6c",cost:1200,desc:"+15% customers on every floor of this tower per level, and builds hype."},
  training: {name:"Training Room",color:"#9ad8ff",cost:2000,desc:"Send staff here to learn. They earn XP quickly. 2 seats per level."},
  office:   {name:"HR Office",    color:"#e8e0c8",cost:1000,desc:"+3 people you can employ, per level."},
  trade:    {name:"Trading Desk", color:"#2fbf71",cost:3000,desc:"Gives you stock tips and lowers trading fees."},
  // upscale support floors for pricier districts (minLot = first property where it unlocks)
  valet:    {name:"Valet Garage", color:"#c9c4ea",cost:30000,minLot:3,desc:"Drivers park for your guests: +10% customers on every business in this tower, per level."},
  helipad:  {name:"VIP Helipad",  color:"#ffd36b",cost:90000,minLot:6,desc:"VIP guests fly in: +8% revenue on every business in this tower, per level."},
  robots:   {name:"Robot Bay",    color:"#8fe3ff",cost:250e3,minLot:7,desc:"Robot helpers take the heavy lifting: staff in this tower tire 15% slower, per level."},
};
const KINDS={...BIZ,...SUPPORT};
const isBiz=t=>!!BIZ[t];
const TIERS=[
  {name:"Bargain",mult:.7, demand:1.35,expect:0,desc:"Crowds love it. Customers are happier, you earn less each."},
  {name:"Fair",   mult:1,  demand:1,   expect:0,desc:"Normal prices. No surprises."},
  {name:"Premium",mult:1.45,demand:.8, expect:3,desc:"Earn more per customer. They expect decor level 3+."},
  {name:"Luxury", mult:2.1,demand:.6,  expect:6,desc:"Big tickets, fewer guests. They expect decor level 6+."},
];
const LOTS=[
  {id:"main", name:"Main Street",    price:0,    theme:"city",  mults:{},                      blurb:"Where it all started."},
  {id:"harbor",name:"Harbor Pier",   price:25e3, theme:"harbor",mults:{burger:1.3,dining:1.5}, blurb:"Seaside crowds. Burger Bars ×1.3, Sky Dining ×1.5."},
  {id:"tech", name:"Tech Park",      price:100e3,theme:"tech",  mults:{cafe:1.3,arcade:1.6},   blurb:"Caffeinated coders. Cafés ×1.3, Arcades ×1.6."},
  {id:"mall", name:"Mega Mall",      price:400e3,theme:"mall",  mults:{boutique:1.6,cafe:1.3}, blurb:"Shoppers everywhere. Boutiques ×1.6, Cafés ×1.3."},
  {id:"neon", name:"Neon Strip",     price:1.5e6,theme:"neon",  mults:{arcade:1.5,burger:1.5}, blurb:"Night owls. Arcades and Burger Bars ×1.5."},
  {id:"oasis",name:"Desert Oasis",   price:10e6, theme:"desert",mults:{spa:1.8},               blurb:"A resort town. Day Spas ×1.8."},
  {id:"sky",  name:"Skyline Heights",price:60e6, theme:"sky",   mults:{all:1.4},               blurb:"Above the clouds. Every business ×1.4."},
  {id:"moon", name:"Moon Base",      price:400e6,theme:"moon",  mults:{all:1.8},               blurb:"Tourists pay anything. Every business ×1.8."},
  {id:"mars", name:"Mars Colony",    price:3e9,  theme:"mars",  mults:{all:2.5},               blurb:"A whole new market. Every business ×2.5."},
];
/* ---------- shops: small single-building businesses that run themselves ---------- */
const SHOPS={
  corner:  {name:"Corner Store",   color:"#5ee08a",price:12e3, inc:90,   perk:"+1% customers in every tower",      blurb:"Snacks, lotto tickets and gossip. Runs itself."},
  truck:   {name:"Food Truck",     color:"#ff9b4a",price:35e3, inc:260,  perk:"+2% revenue at food businesses",    blurb:"Parks wherever the lunch crowd is."},
  laundry: {name:"Laundromat",     color:"#5ad1ff",price:90e3, inc:600,  perk:"Staff everywhere tire 2% slower",   blurb:"Fresh uniforms for your whole team."},
  gas:     {name:"Gas Station",    color:"#ff5d6c",price:250e3,inc:1500, perk:"+1% customers in every tower",      blurb:"Everyone has to fill up eventually."},
  carwash: {name:"Car Wash",       color:"#9ec9ff",price:700e3,inc:3900, perk:"Away earnings +3% (up to +50%)",    blurb:"Suds, brushes and a long line on Saturdays."},
  parking: {name:"Parking Garage", color:"#9a95c2",price:2.5e6,inc:12500,perk:"+1% revenue everywhere",            blurb:"Concrete, cars and pure profit."},
  motel:   {name:"Roadside Motel", color:"#ffcc3d",price:10e6, inc:45e3, perk:"+1% customers in every tower",      blurb:"Vacancy? Rarely."},
  bank:    {name:"Bank Branch",    color:"#2fbf71",price:50e6, inc:200e3,perk:"+5% dividends from your stocks",    blurb:"Your money, making money."},
};
const SHOP_MAX=10;
const shopLvl=(S,k)=>S.shops&&S.shops[k]?S.shops[k].lvl:0;
/* how a shop is run: cheaper prices draw a crowd that helps your towers more, pricier ones earn more on their own */
const SHOP_MODES={budget:{name:"Budget",inc:.8,perk:1.5,desc:"Cheap prices. Earns 20% less, but its perk is 50% stronger."},
  normal:{name:"Regular",inc:1,perk:1,desc:"Fair prices. Normal earnings and perk."},
  premium:{name:"Premium",inc:1.25,perk:.5,desc:"Fancy prices. Earns 25% more, but its perk is half as strong."}};
const PROMO={len:120e3,cd:600e3};
const shopMode=(S,k)=>SHOP_MODES[S.shops?.[k]?.mode]||SHOP_MODES.normal;
const shopPerk=(S,k)=>shopLvl(S,k)*shopMode(S,k).perk;
const promoOn=(S,k,t=now())=>(S.shops?.[k]?.promoUntil||0)>t;
const shopInc=(S,k,noPromo)=>{const l=shopLvl(S,k);return l?SHOPS[k].inc*Math.pow(1.45,l-1)*shopMode(S,k).inc*(!noPromo&&promoOn(S,k)?2:1)*gbuff(S,"rev"):0};
const shopsPerMin=(S,noPromo)=>Object.keys(SHOPS).reduce((a,k)=>a+shopInc(S,k,noPromo),0);
function shopPromo(S,k,t=now()){const sh=S.shops[k];if(!sh)return{ok:false};if((sh.promoReady||0)>t)return{ok:false,msg:`Ready again in ${Math.ceil((sh.promoReady-t)/60e3)} min.`};
  sh.promoUntil=t+PROMO.len;sh.promoReady=t+PROMO.cd;return{ok:true}}
function setShop(S,k,patch){const sh=S.shops[k];if(!sh)return false;if(patch.mode&&SHOP_MODES[patch.mode])sh.mode=patch.mode;
  if(patch.name!==undefined)sh.name=String(patch.name).replace(/[<>]/g,"").trim().slice(0,22)||undefined;if(patch.color)sh.color=patch.color;return true}
const shopRefund=(S,k)=>{let v=0;for(let l=0;l<shopLvl(S,k);l++)v+=l?SHOPS[k].price*.6*Math.pow(1.75,l-1):SHOPS[k].price;return Math.round(v*.5)};
function sellShop(S,k){if(!S.shops[k])return{ok:false};const v=shopRefund(S,k);S.cash+=v;delete S.shops[k];log(S,`Sold the ${SHOPS[k].name} for ${money(v)}.`);return{ok:true,v}}
const shopCost=(S,k)=>{const l=shopLvl(S,k);return l?Math.round(SHOPS[k].price*.6*Math.pow(1.75,l-1)):SHOPS[k].price};
const shopValue=S=>Object.keys(SHOPS).reduce((a,k)=>a+shopRefund(S,k),0);
const FOOD=new Set(["cafe","burger","dining","seafood"]);
const shopCustBoost=S=>1+.01*(shopPerk(S,"corner")+shopPerk(S,"gas")+shopPerk(S,"motel"));
function buyShop(S,k){const D=SHOPS[k];if(!D)return{ok:false};const l=shopLvl(S,k);if(l>=SHOP_MAX)return{ok:false,msg:"Already maxed out."};
  const c=shopCost(S,k);if(S.cash<c)return{ok:false,msg:`You need ${money(c)}.`};S.cash-=c;S.shops[k]={...(S.shops[k]||{since:now(),earned:0,mode:"normal"}),lvl:l+1};
  log(S,l?`Upgraded the ${D.name} to level ${l+1}.`:`Bought a ${D.name}!`);return{ok:true,lvl:l+1}}
const RANKS=["Corner Shop","Local Favorite","Block Boss","City Player","Regional Power","Tycoon","Mogul","Titan","Megacorp","Global Giant","Planetary Empire","Solar Syndicate","Galactic Conglomerate"];
const AFFIRM=["Your business is really taking shape.","Customers are noticing.","Great call, boss.","The team believes in you.","That's how fortunes are built.","Another step toward an empire."];

/* ---------- people ---------- */
const FIRST=["Ace","Bex","Cruz","Dot","Eli","Flo","Gus","Hana","Ivo","Jax","Kit","Lux","Mo","Nia","Oz","Pip","Quin","Rae","Sol","Tex","Uma","Vic","Wren","Zed","Ada","Bo","Cleo","Dev","Ema","Finn","Gia","Hal","Iris","June","Kai","Lola","Milo","Nova","Otto","Pia","Remy","Sage","Theo","Vera","Yuki"];
const LAST=["Byte","Cash","Dash","Volt","Pike","Stone","Banks","Gold","Rush","Bolt","Quill","Penny","Ledger","Sterling","Park","Rivera","Okafor","Nguyen","Silva","Moreau","Kowal","Sato"];
const SKIN=["#f2d1b0","#e0b48c","#c68c5e","#a86f4c","#7a4a30","#5a3420"];
const HAIR=["#2a1a10","#5a3a1a","#c98a3a","#f2d16a","#1a1a1a","#a0402a","#e8e0d0","#ff7ad9","#5ad1ff"];
const TRAITS=[
  {id:"hard",      name:"Hard worker", desc:"Barely gets tired.",                 mod:{sta:2}},
  {id:"charmer",   name:"Charmer",     desc:"Customers adore them.",              mod:{chr:2}},
  {id:"speedy",    name:"Speed demon", desc:"Fastest hands in town.",             mod:{spd:2}},
  {id:"chatty",    name:"Chatterbox",  desc:"Super friendly, a little slow.",     mod:{chr:3,spd:-1}},
  {id:"ambitious", name:"Ambitious",   desc:"Learns fast. Dreams of managing.",  xp:1.5},
  {id:"loyal",     name:"Loyal",       desc:"Sticks with you through rough days.",loyal:1},
  {id:"perfect",   name:"Perfectionist",desc:"Slower, but every customer leaves happy.",mod:{spd:-1},sat:.4},
  {id:"easy",      name:"Easygoing",   desc:"Happy with a modest paycheck.",      pay:.8},
];
const BIOS=["Used to run a food truck.","Saving up for college.","Wants to own a tower someday.","Has worked in four cafés.","Just moved here from the coast.","Plays guitar on breaks.","Knows every regular by name.","Never misses a shift.","Bakes for the team on Fridays.","Was a champion speed-stacker.","Trying to pay off a scooter.","Takes great photos of the food."];
const CUST=["Mae","Leo","Ivy","Sam","Ana","Raj","Tom","Bea","Kim","Lou","Noor","Ray","Zoe","Max","Eve","Ben","Ola","Jin"];
const REV={
  fast:["So fast!","In and out in no time.","Best service in town."],charm:["The staff were so kind.","{e} made my day!","Friendliest place ever."],
  decor:["Gorgeous place.","Love the vibe in here."],cheap:["Great prices!","Such a bargain."],good:["Solid. Will be back.","Really enjoyed it."],
  slow:["Waited forever.","The line was way too long.","Slow service."],pricey:["Too pricey for what it is.","Way overpriced."],tired:["Staff looked exhausted.","Everyone seemed worn out."],
  walk:["Gave up waiting.","Left before I was served."]};

function stat(){return ri(2,5)}
function mkEmp(q=0,o={}){
  const tr=o.trait?TRAITS.find(t=>t.id===o.trait):pick(TRAITS),m=tr.mod||{};
  const e={id:Math.random().toString(36).slice(2,9),name:pick(FIRST)+" "+pick(LAST),skin:pick(SKIN),hair:pick(HAIR),
    trait:tr.id,bio:pick(BIOS),fav:pick(Object.keys(BIZ).slice(0,3+Math.min(3,q))),
    spd:clamp(stat()+q+(m.spd||0),1,10),chr:clamp(stat()+q+(m.chr||0),1,10),sta:clamp(stat()+q+(m.sta||0),1,10),
    lvl:1+(o.lvl||0),xp:0,pts:0,energy:100,mood:75,role:"staff",state:"idle",loc:null,praisedAt:0,served:0,low:0,ability:pick(["rush","happy","pep"])};
  e.salary=Math.round(fairPay(e)*(tr.pay||1)*100)/100;return e}
function fairPay(e){return(.6+(e.spd+e.chr+e.sta)*.12)*(1+(e.lvl-1)*.25)}
const xpNeed=l=>Math.round(15*Math.pow(l,1.5));
const trait=e=>TRAITS.find(t=>t.id===e.trait)||TRAITS[0];

/* ---------- state ---------- */
function bizFloor(type){return{type,stations:1,decor:0,price:1,staff:[null],manager:null,register:0,rating:3,served:0,reviews:[],abil:0,buff:null}}
function supFloor(type){return{type,lvl:1}}
const STOCK_DEFS=[
  {t:"PXLS",n:"Pixel Corp",p:42,vol:.03,drift:.0004,sec:"tech"},{t:"CHIP",n:"ChipForge",p:120,vol:.04,drift:.0006,sec:"tech"},
  {t:"BYTE",n:"Byte Foods",p:18,vol:.022,drift:.0002,sec:"food",div:.002},{t:"SODA",n:"Fizz Soda",p:55,vol:.012,drift:.0003,sec:"food",div:.003},
  {t:"GRID",n:"GridPower",p:30,vol:.028,drift:.0003,sec:"energy",div:.0025},{t:"VOLT",n:"Volt Motors",p:64,vol:.045,drift:.0004,sec:"energy"},
  {t:"MOON",n:"MoonRocket",p:6,vol:.09,drift:0,sec:"space"},{t:"ORBT",n:"Orbit Labs",p:210,vol:.06,drift:.0006,sec:"space"},
  {t:"BANK",n:"Sterling Bank",p:90,vol:.015,drift:.0002,sec:"finance",div:.0035},{t:"MEGA",n:"Gigamart",p:75,vol:.02,drift:.0003,sec:"finance",div:.0025},
  // penny stocks: cheap, wild, and they can rocket or crash
  {t:"MEME",n:"Meme Corp",p:.5,vol:.16,drift:-.002,penny:1,sec:"penny"},{t:"YOLO",n:"Yolo Motors",p:1.2,vol:.14,drift:-.002,penny:1,sec:"penny"},
  {t:"ZAPP",n:"Zapp Energy",p:.9,vol:.18,drift:-.003,penny:1,sec:"penny"},{t:"GOOB",n:"Goober Labs",p:2.4,vol:.12,drift:-.001,penny:1,sec:"penny"},
  {t:"FROG",n:"Frog Holdings",p:.3,vol:.2,drift:-.003,penny:1,sec:"penny"}];
const mkStock=d=>{const s={...d,base:d.p,hist:Array.from({length:30},(_,i)=>d.p*(1+Math.sin(i/4)*.04+rnd(-.03,.03))),trend:rnd(-.01,.01)};scheduleEarnings(s);s.earnIn=s.earnIn&&ri(4,30);return s};
function mkStocks(){return STOCK_DEFS.map(mkStock)}
function fresh(){
  const first=mkEmp(0,{trait:"loyal"});first.home="main";first.fav="cafe";first.spd=4;first.chr=4;first.sta=4;first.salary=Math.round(fairPay(first)*100)/100;
  const S={v:3,cash:500,rep:5,cur:"main",day:1,
    lots:{main:{floors:[bizFloor("cafe"),{type:null}]}},
    emps:[first],applicants:[],appAt:0,inbox:[],deals:[],stocks:mkStocks(),port:{},tips:{},buffs:[],contracts:[],shops:{},
    landDiscount:0,goalIdx:0,spent:300,
    fund:{cash:0,pos:{},alloc:.2,hist:[],log:[],total:0,last:0},mkt:{sec:{},sent:0,news:[],newsIn:3,divT:0},basis:{},orders:{},realized:0,divPaid:0,
    hr:{raises:true,points:true,staffing:true,favorites:true,training:true,praise:true,requests:true,promote:false},hrLog:[],totalEarned:0,bestMin:0,chart:[],log:["Day 1. A tiny café on Main Street, one loyal employee and $500."],
    settings:{sound:true,notify:true},tutorialDone:false,lastTick:Date.now(),lastDealGen:0,nextEvent:Date.now()+150e3,clock:{mkt:0,day:0,chart:0},rev:0,writer:"",heartbeat:0};
  assign(S,first.id,"main",0,0);refreshApplicants(S);return S}

/* ---------- lookups ---------- */
const lotDef=id=>LOTS.find(l=>l.id===id);
const lotIdx=id=>LOTS.findIndex(l=>l.id===id);
const lotMult=(id,t)=>{const m=lotDef(id).mults;return(m[t]||1)*(m.all||1)};
const lotTier=id=>Math.pow(1+lotDef(id).price/20000,.4);
const lotTraffic=id=>1+.12*lotIdx(id);
const emp=(S,id)=>id?S.emps.find(e=>e.id===id):null;
function lotSum(S,lot,t){return(S.lots[lot]?.floors||[]).filter(f=>f.type===t).reduce((a,f)=>a+f.lvl,0)}
function coSum(S,t){let n=0;for(const id in S.lots)n+=lotSum(S,id,t);return n}
/* every employee belongs to one property; each property has its own staff limit */
const homeOf=e=>e.home||"main";
const staffCap=(S,lot=S.cur)=>4+3*lotSum(S,lot,"office");
const headcount=(S,lot=S.cur)=>S.emps.filter(e=>homeOf(e)===lot).length;
const roomAt=(S,lot=S.cur)=>staffCap(S,lot)-headcount(S,lot);
const hypeMult=S=>1+Math.sqrt(Math.max(0,S.rep))/12;
const maxFloors=S=>Math.min(20,3+S.goalIdx);
const floorCost=(S,lot)=>Math.round(400*Math.pow(1.8,Math.max(0,S.lots[lot].floors.length-2))*lotTier(lot));
const buildCost=(t,lot)=>Math.round(KINDS[t].cost*lotTier(lot));
const stationCost=(f,lot)=>Math.round(BIZ[f.type].cost*.6*Math.pow(2.1,f.stations-1)*lotTier(lot));
const decorCost=(f,lot)=>Math.round(BIZ[f.type].cost*.4*Math.pow(1.75,f.decor)*lotTier(lot));
const supCost=(f,lot)=>Math.round(SUPPORT[f.type].cost*Math.pow(1.9,f.lvl)*lotTier(lot));
const hireFee=e=>Math.round(e.salary*40);
const lotPrice=(S,l)=>Math.round(l.price*(1-(S.landDiscount||0)));
const goal=i=>Math.round(2500*Math.pow(2.6,i));
const rank=S=>RANKS[Math.min(RANKS.length-1,S.goalIdx)]+(S.goalIdx>=RANKS.length?" "+(S.goalIdx-RANKS.length+2):"");
const unlocked=(S,t)=>!isBiz(t)||BIZ[t].rank<=S.goalIdx;
/* can this floor type be built on this property at all? */
const allowedHere=(t,lot)=>{const k=KINDS[t];if(!k)return false;if(k.only&&k.only!==lot)return false;if(k.minLot!=null&&lotIdx(lot)<k.minLot)return false;return true};
const MAX_ST=5,MAX_DECOR=10,MAX_SUP=5;

/* ---------- economics of one business floor ---------- */
const now=()=>Date.now();
function fbuff(f,k){return f.buff&&f.buff.kind===k&&f.buff.until>now()}
function gbuff(S,k){return S.buffs.filter(b=>b.kind===k&&!b.lot&&b.until>now()).reduce((a,b)=>a*b.mult,1)}
function lbuff(S,lot,k){return S.buffs.filter(b=>b.kind===k&&b.lot===lot&&b.until>now()).reduce((a,b)=>a*b.mult,1)}
function arrivalsPerMin(S,lot,f){const B=BIZ[f.type],T=TIERS[f.price];
  return B.arrive*(.35+f.rating*.18)*hypeMult(S)*shopCustBoost(S)*T.demand*(1+.06*f.decor)*(1+.15*lotSum(S,lot,"marketing"))*(1+.1*lotSum(S,lot,"valet"))*lotTraffic(lot)*lbuff(S,lot,"traffic")*(fbuff(f,"rush")?2:1)}
function revenue(S,lot,f){return BIZ[f.type].price*TIERS[f.price].mult*lotMult(lot,f.type)*(1+f.decor*.15)*(1+.08*lotSum(S,lot,"helipad"))*(1+.01*shopPerk(S,"parking")+(FOOD.has(f.type)?.02*shopPerk(S,"truck"):0))*gbuff(S,"rev")*(fbuff(f,"happy")?1.5:1)}
function present(S,lot,i,f,k){const e=emp(S,f.staff[k]);return e&&e.state==="work"&&e.loc&&e.loc.lot===lot&&e.loc.i===i&&e.loc.slot===k?e:null}
function speedF(e,f,mgr){return(.6+e.spd*.09)*(e.fav===f.type?1.2:1)*(e.energy<=0?.35:e.energy<25?.6:1)*(mgr?1.1:1)}
const svcTime=(e,f,mgr)=>BIZ[f.type].time/speedF(e,f,mgr);
const patience=f=>25*(1+f.decor*.08);
function capacityPerMin(S,lot,i,f){let c=0;for(let k=0;k<f.stations;k++){const e=present(S,lot,i,f,k);if(e)c+=60/svcTime(e,f,!!f.manager)}return c}
const registerCap=(S,lot,f)=>Math.max(150,revenue(S,lot,f)*25*(1+f.stations));
function estPerMin(S,lot,i,f){return Math.min(arrivalsPerMin(S,lot,f),capacityPerMin(S,lot,i,f))*revenue(S,lot,f)}
const wagesPerMin=S=>S.emps.reduce((a,e)=>a+e.salary,0);
const contractPerMin=S=>S.contracts.reduce((a,c)=>a+(c.until>now()?c.perMin:0),0);
function estIncomePerMin(S){let t=0;for(const[lot,L]of Object.entries(S.lots))L.floors.forEach((f,i)=>{if(isBiz(f.type))t+=estPerMin(S,lot,i,f)});return t+contractPerMin(S)+shopsPerMin(S)}
const regTotal=S=>Object.values(S.lots).reduce((a,L)=>a+L.floors.reduce((b,f)=>b+(f.register||0),0),0);
const portVal=S=>Object.entries(S.port).reduce((a,[t,q])=>a+q*S.stocks.find(s=>s.t===t).p,0);
const netWorth=S=>S.cash+shopValue(S)+portVal(S)+S.spent*.5+regTotal(S)+(S.fund?fundValue(S):0);
const fee=S=>Math.max(.002,.02-.004*coSum(S,"trade"));
const avgRating=S=>{let n=0,t=0;for(const L of Object.values(S.lots))for(const f of L.floors)if(isBiz(f.type)){n++;t+=f.rating}return n?t/n:0};

/* ---------- assignments ---------- */
function unassign(S,id){const e=emp(S,id);if(!e)return;
  if(e.loc){const f=S.lots[e.loc.lot]?.floors[e.loc.i];if(f){if(e.loc.mgr){if(f.manager===id)f.manager=null}else if(f.staff&&f.staff[e.loc.slot]===id)f.staff[e.loc.slot]=null}}
  if(e.role!=="staff")e.role="staff";
  e.loc=null;e.state="idle";e.at=null}
function assign(S,id,lot,i,slot){const e=emp(S,id),f=S.lots[lot].floors[i];if(!e||!isBiz(f.type))return false;
  const cur=f.staff[slot];if(cur&&cur!==id)unassign(S,cur);unassign(S,id);f.staff[slot]=id;e.loc={lot,i,slot};e.state="work";e.role="staff";return true}
function setManager(S,id,lot,i){const e=emp(S,id),f=S.lots[lot].floors[i];if(!e||!isBiz(f.type))return false;
  const was=e.role==="manager";if(f.manager)unassign(S,f.manager);unassign(S,id);f.manager=id;e.loc={lot,i,mgr:true};e.state="manage";e.role="manager";e.promoReady=false;
  if(!was)e.salary=Math.round(Math.max(e.salary,fairPay(e))*1.5*100)/100;return true}
/* brokers and the HR director are employees who leave the floor for a special job */
function setRole(S,id,role){const e=emp(S,id);if(!e)return false;unassign(S,id);e.role=role;e.state=role;e.promoReady=false;
  if(role==="broker"){e.strat=e.strat||"day";e.sector=e.sector||{cafe:"food",burger:"food",dining:"food",arcade:"tech",boutique:"finance",spa:"energy"}[e.fav]||"tech"}
  e.salary=Math.round(Math.max(e.salary,fairPay(e))*(role==="hr"?1.5:1.3)*100)/100;return true}
const brokers=S=>S.emps.filter(e=>e.role==="broker");
const brokerCap=S=>coSum(S,"trade");
const brokerSkill=e=>e.spd*.5+e.chr*.3+Math.min(10,e.lvl)*.4;
const brokerAcc=(S,e)=>Math.min(.655,.5+.013*brokerSkill(e)+.006*coSum(S,"trade"));
const hrDirector=(S,lot=S.cur)=>S.emps.find(e=>e.role==="hr"&&homeOf(e)===lot);
const hrActive=(S,lot=S.cur)=>!!hrDirector(S,lot)&&lotSum(S,lot,"office")>0;
function seatsFree(S,lot,type){const cap=2*lotSum(S,lot,type);const used=S.emps.filter(e=>(e.state==="break"||e.state==="train")&&e.at&&e.at.lot===lot&&S.lots[lot].floors[e.at.i]?.type===type).length;return cap-used}
function findSupport(S,lot,type){return(S.lots[lot]?.floors||[]).findIndex(f=>f.type===type)}

/* ---------- runtime (not saved) ---------- */
const GEO={room:98,st:k=>(2+k*13)/98,spot:k=>(12+k*13)/98,reg:70/98,q0:83/98,qs:4/98};
function frt(rt,lot,i,f){const k=lot+":"+i;let r=rt.f[k];
  if(!r||r.type!==f.type)r=rt.f[k]={type:f.type,cust:[],st:[],acc:Math.random(),served:[],walk:[],earn:[],waits:[],full:false,fullNoted:0};
  while(r.st.length<f.stations)r.st.push({c:null,prog:0});return r}
const newRT=()=>({f:{},cid:0,earn:[]});

/* ---------- the sim tick ---------- */
function tick(S,rt,dt,t=now()){
  const ev=[];if(dt<=0)return ev;
  const wage=wagesPerMin(S)/60*dt;S.cash-=wage;
  const con=contractPerMin(S)/60*dt;if(con){S.cash+=con;S.totalEarned+=con;rt.earn.push([t,con])}
  for(const k in S.shops){const v=shopInc(S,k)/60*dt;if(v>0){S.cash+=v;S.totalEarned+=v;S.shops[k].earned=(S.shops[k].earned||0)+v;rt.earn.push([t,v])}}
  S.buffs=S.buffs.filter(b=>b.until>t);S.contracts=S.contracts.filter(c=>c.until>t);
  for(const[lot,L]of Object.entries(S.lots))L.floors.forEach((f,i)=>{if(isBiz(f.type))simFloor(S,rt,lot,i,f,dt,t,ev)});
  simStaff(S,dt,t,ev);
  const C=S.clock;C.mkt+=dt;C.day+=dt;C.chart+=dt;
  if(C.mkt>=20){C.mkt=0;marketTick(S,ev)}
  C.hr=(C.hr||0)+dt;if(C.hr>=6){C.hr=0;hrTick(S,rt,ev)}
  if(C.day>=120){C.day=0;S.day++;S.rep=Math.max(0,S.rep*.99)}
  if(C.chart>=30){C.chart=0;const pm=perMin(rt,t);S.chart.push({d:S.day,nw:Math.round(netWorth(S)),pm:Math.round(pm-wagesPerMin(S))});if(S.chart.length>120)S.chart.shift();
    if(pm>S.bestMin*1.15&&pm>60&&S.bestMin>0)ev.push({kind:"good",title:"RECORD PACE",text:`You're earning ${money(pm)} a minute. Best ever.`,sfx:"up"});if(pm>S.bestMin)S.bestMin=pm}
  S.rep+=dt*(coSum(S,"marketing")*.05+Math.max(0,avgRating(S)-3)*.05+.004*Object.values(S.lots).reduce((a,L)=>a+L.floors.filter(f=>isBiz(f.type)).length,0));
  while(netWorth(S)>=goal(S.goalIdx)){const g=goal(S.goalIdx);S.goalIdx++;S.cash+=g*.05;
    const nb=Object.values(BIZ).filter(b=>b.rank===S.goalIdx).map(b=>b.name);
    ev.push({kind:"milestone",title:`NEW RANK: ${rank(S).toUpperCase()}`,text:`Net worth passed ${money(g)}. +${money(g*.05)} bonus and +1 floor per tower${nb.length?`. You can now open a ${nb.join(", ")}`:""}.`,sfx:"fanfare",dirty:1});
    log(S,`Reached ${rank(S)}.`)}
  if(t-S.appAt>180e3)refreshApplicants(S);
  if(t>S.nextEvent){S.nextEvent=t+rnd(180e3,320e3);const it=genInbox(S);if(it)ev.push({kind:"deal",title:"NEW IN YOUR INBOX",text:it.title,sfx:"alert",dirty:1})}
  if(t-S.lastDealGen>420e3&&Math.random()<dt/60){const d=genDeal(S);if(d)ev.push({kind:"deal",title:"NEW BUSINESS DEAL",text:`${d.company}: ${d.title}`,sfx:"alert",dirty:1})}
  const n1=S.inbox.length+S.deals.length;S.inbox=S.inbox.filter(x=>x.expires>t);S.deals=S.deals.filter(d=>d.expires>t);if(S.inbox.length+S.deals.length!==n1)ev.push({dirty:1});
  S.lastTick=t;return ev;
}
function perMin(rt,t=now()){rt.earn=rt.earn.filter(e=>t-e[0]<60e3);return rt.earn.reduce((a,e)=>a+e[1],0)}

function simFloor(S,rt,lot,i,f,dt,t,ev){
  const r=frt(rt,lot,i,f),pat=patience(f),mgr=emp(S,f.manager);
  r.acc+=arrivalsPerMin(S,lot,f)/60*dt;
  while(r.acc>=1){r.acc--;const waiting=r.cust.filter(c=>c.s==="in"||c.s==="q").length;
    const c={id:++rt.cid,x:1.03,s:"in",w:0,pat,look:[pick(SKIN),pick(HAIR),pick(["#ffcc3d","#5ad1ff","#ff7ad9","#5ee08a","#ff9b4a","#f2ecd8","#b78cff","#ff5d6c","#6b8cff"])],name:pick(CUST),vip:false};
    if(r.vipPending){c.vip=true;c.sp="critic";c.pri=3;c.pat=pat*.85;c.name="The critic";r.vipPending=false}
    // special guests are rare: at most one every 6 minutes across your whole company, and they arrive quietly (look for the spotlight)
    else if(S.goalIdx>=1&&t-(rt.guestAt||0)>360e3){const x=Math.random();const k=x<.003?"celeb":x<.007?"influencer":null;
      if(k){const G=GUESTS[k];rt.guestAt=t;Object.assign(c,{sp:k,pri:G.pri,pat:pat*G.pat,name:G.name()});ev.push({dirty:1})}}
    if(waiting>=8&&!c.sp){c.s="turn";c.bub="!";r.walk.push(t);f.rating+=(1-f.rating)*.01}
    r.cust.push(c)}
  for(let k=0;k<f.stations;k++){const st=r.st[k],e=present(S,lot,i,f,k);
    if(!e)continue;e.busy=!!st.c;
    if(!st.c){const q=r.cust.filter(c=>c.s==="q"||c.s==="in").sort((a,b)=>((b.pri||0)-(a.pri||0))||(a.id-b.id))[0];
      if(q&&q.s==="q"){q.s="go";q.k=k;st.c=q.id;st.prog=0}}
    else{const c=r.cust.find(x=>x.id===st.c);if(!c){st.c=null;continue}
      if(c.s==="at"){st.prog+=dt/svcTime(e,f,!!mgr);e.energy=Math.max(0,e.energy-dt*100/(200+e.sta*45)/(1+.15*lotSum(S,lot,"robots"))/(1+.02*shopPerk(S,"laundry")));
        if(st.prog>=1)finish(S,rt,lot,i,f,r,c,e,k,t,ev)}}}
  // stations whose worker left mid-service: send the customer back to the front of the line
  for(let k=0;k<r.st.length;k++){const st=r.st[k];if(st.c&&(k>=f.stations||!present(S,lot,i,f,k))){const c=r.cust.find(x=>x.id===st.c);if(c){c.s="q";c.k=undefined}st.c=null;st.prog=0}}
  const queue=r.cust.filter(c=>c.s==="in"||c.s==="q").sort((a,b)=>((b.pri||0)-(a.pri||0))||(a.id-b.id));
  queue.forEach((c,j)=>{c.tx=Math.min(.985,GEO.q0+j*GEO.qs);c.w+=dt;
    if(c.s==="in"&&Math.abs(c.x-c.tx)<.01)c.s="q";
    if(c.w>c.pat){c.s="out";c.bub="!";c.bt=0;c.tx=1.05;r.walk.push(t);f.rating+=(1-f.rating)*.04;
      if(c.vip){f.rating=Math.max(1,f.rating-.5);ev.push({kind:"bad",title:"THE CRITIC LEFT",text:`The food critic gave up waiting at your ${BIZ[f.type].name}. Ouch.`,sfx:"bad"})}
      else if(c.sp){const G=GUESTS[c.sp];f.rating=Math.max(1,f.rating-G.leaveHit);review(f,1,G.leaveReview,c.name);ev.push({dirty:1})}
      else if(Math.random()<.25)review(f,1,pick(REV.walk),c.name)}});
  for(const c of r.cust){if(c.s==="go"){c.tx=GEO.spot(c.k);c.w+=dt}if(c.s==="turn")c.tx=.93;
    const d=(c.tx??c.x)-c.x,sp=.38*dt;c.x+=Math.sign(d)*Math.min(Math.abs(d),sp);
    if(c.s==="go"&&Math.abs(c.x-c.tx)<.005)c.s="at";
    if(c.s==="turn"&&Math.abs(c.x-c.tx)<.005){c.s="out";c.tx=1.05;c.bt=0}
    if(c.bt!==undefined)c.bt+=dt}
  r.cust=r.cust.filter(c=>!(c.s==="out"&&c.x>=1.04));
  if(mgr&&f.register>0){S.cash+=f.register;f.register=0}
  const cutoff=t-300e3;r.served=r.served.filter(x=>x>cutoff);r.walk=r.walk.filter(x=>x>cutoff);r.earn=r.earn.filter(x=>x[0]>t-60e3);r.waits=r.waits.slice(-30);
}
function finish(S,rt,lot,i,f,r,c,e,k,t,ev){
  const tr=trait(e),wr=c.w/c.pat;let sat=3.2+(e.chr-5)*.15+f.decor*.12-Math.max(0,wr-.3)*2.5+(e.fav===f.type?.2:0)+(tr.sat||0)+(e.energy<25?-.4:0)+rnd(-.4,.4);
  const T=TIERS[f.price],pp=f.price===0?-.3:f.price===1?0:Math.max(0,T.expect-f.decor)*.3+(f.price===2?.2:.4);sat-=pp;sat=clamp(sat,1,5);
  let pay=revenue(S,lot,f)*(sat>=4?1+.12*e.chr/10:1)*(c.vip?3:c.sp?GUESTS[c.sp].pay(sat):1);
  const cap=registerCap(S,lot,f);
  if(f.manager){S.cash+=pay}else if(f.register+pay>cap){const room=Math.max(0,cap-f.register);f.register=cap;pay=room;
    if(t-r.fullNoted>90e3){r.fullNoted=t;ev.push({kind:"bad",title:"REGISTER FULL",text:`Your ${BIZ[f.type].name} register is full, so money is being lost. Tap the floor to collect, or hire a manager.`,sfx:"alert"})}r.full=true}
  else{f.register+=pay;r.full=false}
  S.totalEarned+=pay;r.earn.push([t,pay]);rt.earn.push([t,pay]);
  f.rating+=(sat-f.rating)*(c.vip?.35:.06);f.served++;r.served.push(t);r.waits.push(c.w);
  e.xp+=(tr.xp||1);e.served++;
  const reasons=[[wr<.3&&sat>=4,"fast"],[e.chr>=7&&sat>=4,"charm"],[f.decor>=4&&sat>=4,"decor"],[f.price===0&&sat>=3.5,"cheap"],[wr>.7,"slow"],[pp>.4,"pricey"],[e.energy<25,"tired"]].filter(x=>x[0]).map(x=>x[1]);
  const why=reasons[0]||(sat>=3.5?"good":"slow");
  if(c.vip){const good=sat>=4;f.rating=clamp(f.rating+(good?.6:-.4),1,5);S.rep+=good?25:-10;
    review(f,Math.round(sat),good?"A triumph. A must-visit!":"Disappointing visit.","Food critic");
    ev.push({kind:good?"big":"bad",title:good?"THE CRITIC LOVED IT!":"THE CRITIC WAS UNIMPRESSED",text:good?`${e.name} wowed the critic at your ${BIZ[f.type].name}. Rating and hype are way up!`:`The critic gave your ${BIZ[f.type].name} ${Math.round(sat)}★. Better decor and faster service would help.`,sfx:good?"fanfare":"bad",dirty:1})}
  else if(c.sp){const G=GUESTS[c.sp],good=sat>=4;G.done(S,lot,f,good,t);review(f,Math.round(sat),good?G.goodReview:G.badReview,c.name);
    ev.push(good?{kind:"good",title:G.goodTitle,text:G.result(good,e.name,BIZ[f.type].name,pay),sfx:"coin",dirty:1}:{dirty:1})}
  else if(Math.random()<.1)review(f,Math.round(sat),pick(REV[why]).replace("{e}",e.name.split(" ")[0]),c.name);
  c.s="out";c.tx=1.05;c.bub=sat>=4.2?"<3":sat<2.5?"!":"$";c.bt=0;
  r.st[k].c=null;r.st[k].prog=0;
}
/* special guests: rare customers with their own look, rules and payoff */
const GUESTS={
  celeb:{pri:2,pat:.7,name:()=>pick(["Starr Monroe","Jett Valentino","Lux Laurent","Rio Diamond","Vega Kensington"]),title:"A CELEBRITY WALKED IN",
    arrive:(b,l)=>`Someone famous is in line at your ${b} at ${l}. Look for the sparkles and sunglasses. They pay 5× (7× if they love it) but hate waiting.`,
    pay:sat=>sat>=4?7:5,leaveHit:.2,leftTitle:"THE CELEBRITY STORMED OUT",left:b=>`They waited too long at your ${b}. Rating dropped.`,leaveReview:"I am NOT waiting in line.",
    done:(S,lot,f,good)=>{if(good)S.rep+=8},goodTitle:"THE CELEBRITY LOVED IT!",badTitle:"THE CELEBRITY WASN'T IMPRESSED",goodReview:"Obsessed. Telling everyone.",badReview:"Overrated, honestly.",
    result:(good,e,b,pay)=>good?`${e} gave them star treatment at your ${b}. They paid ${money(pay)}!`:`They paid ${money(pay)} at your ${b} but left grumbling. Faster service and nicer decor help.`},
  influencer:{pri:1,pat:.9,name:()=>"@"+pick(["snackqueen","tasteoftay","dailydrip","vibecheckvic","eatwithemi","lowkeyluxe"]),title:"AN INFLUENCER IS HERE",
    arrive:(b,l)=>`A big influencer is filming at your ${b} at ${l}. Look for the phone and pink hair. Wow them and a crowd follows: +40% customers there for 3 minutes.`,
    pay:()=>1.5,leaveHit:.25,leftTitle:"THE INFLUENCER POSTED A RANT",left:b=>`They got tired of waiting at your ${b} and told their followers. Rating dropped.`,leaveReview:"Waited forever. Not worth the hype.",
    done:(S,lot,f,good,t)=>{if(good){S.buffs.push({kind:"traffic",lot,mult:1.4,until:t+180e3});S.rep+=5}else f.rating=Math.max(1,f.rating-.15)},
    goodTitle:"YOU WENT VIRAL!",badTitle:"MEH REVIEW ONLINE",goodReview:"10/10 would film again!",badReview:"It was... fine I guess.",
    result:(good,e,b)=>good?`The influencer loved ${e}'s service. Their followers are heading to this property: +40% customers for 3 minutes!`:`The influencer's post about your ${b} was lukewarm. Rating slipped a bit.`}};
function review(f,stars,text,name){f.reviews.unshift({s:clamp(stars,1,5),t:text,n:name});f.reviews=f.reviews.slice(0,6)}

function simStaff(S,dt,t,ev){
  for(const e of[...S.emps]){
    const tr=trait(e);
    if(e.state==="work"){if(!e.busy)e.energy=Math.max(0,e.energy-dt*30/(200+e.sta*45)/(1+.15*lotSum(S,e.loc?.lot,"robots"))/(1+.02*shopPerk(S,"laundry")));
      if(e.energy<25&&e.loc&&!e.noBreak){const li=findSupport(S,e.loc.lot,"lounge");
        if(li>=0&&seatsFree(S,e.loc.lot,"lounge")>0){e.state="break";e.at={lot:e.loc.lot,i:li};e.busy=false;ev.push({dirty:1})}}}
    else if(e.state==="break"){e.energy=Math.min(100,e.energy+dt*2*(1+.25*(lotSum(S,e.at.lot,"lounge")-1)));
      if(e.energy>=95){e.state=e.loc?(e.loc.mgr?"manage":"work"):"idle";e.at=null;ev.push({dirty:1})}}
    else if(e.state==="train"){const tl=Math.max(1,lotSum(S,e.at.lot,"training"));e.xp+=dt*.25*(1+.3*(tl-1))*(tr.xp||1);e.energy=Math.max(0,e.energy-dt*.15);
      if(e.energy<15){e.state=e.loc?"work":"idle";e.at=null;ev.push(hrActive(S,homeOf(e))&&S.hr.training?{dirty:1}:{kind:"info",title:"TRAINING DONE",text:`${e.name} is worn out and left training.`,dirty:1})}}
    else e.energy=Math.min(100,e.energy+dt*(e.state==="idle"?.8:.2));
    const fair=fairPay(e),payGap=(e.salary/fair-1)*80;
    const atFav=e.loc&&!e.loc.mgr&&S.lots[e.loc.lot]?.floors[e.loc.i]?.type===e.fav;
    let target=65+payGap+(atFav?12:0)+(e.energy<25?-25:0)+(t-e.praisedAt<300e3?12:0)+(S.cash<0?-30:0)+(e.state==="idle"?-8:0)+(e.role!=="staff"?10:0)+(e.role!=="hr"&&hrActive(S,homeOf(e))?3+hrDirector(S,homeOf(e)).chr*.5:0);
    target=clamp(target,0,100);if(tr.loyal)target=Math.max(target,40);
    e.mood=clamp(e.mood+(target-e.mood)*dt/90,0,100);
    while(e.xp>=xpNeed(e.lvl)){e.xp-=xpNeed(e.lvl);e.lvl++;e.pts++;
      ev.push(hrActive(S,homeOf(e))&&S.hr.points?{dirty:1}:{kind:"good",title:"LEVEL UP!",text:`${e.name} reached level ${e.lvl}. Spend their skill point in Team.`,sfx:"level",dirty:1});log(S,`${e.name} reached level ${e.lvl}.`)}
    if(e.mood<25){e.low+=dt;if(e.low>40&&!S.inbox.some(x=>x.kind==="unhappy"&&x.emp===e.id)){S.inbox.unshift(mkUnhappy(S,e));ev.push({kind:"bad",title:`${e.name.toUpperCase()} IS UNHAPPY`,text:"Check your inbox before they walk out.",sfx:"alert",dirty:1})}
      if(e.low>300){unassign(S,e.id);S.emps=S.emps.filter(x=>x!==e);S.inbox=S.inbox.filter(x=>x.emp!==e.id);
        ev.push({kind:"bad",title:"RESIGNATION",text:`${e.name} quit. They felt ${payGap<-10?"underpaid":e.energy<25?"burned out":"ignored"}.`,sfx:"bad",dirty:1});log(S,`${e.name} quit.`)}}
    else e.low=Math.max(0,e.low-dt*2);
  }
}

/* ---------- market: sectors, news, earnings, dividends, orders ---------- */
const SECTORS={tech:{name:"Tech",color:"#5ad1ff"},food:{name:"Food & Drink",color:"#ff9b4a"},energy:{name:"Energy",color:"#5ee08a"},space:{name:"Space",color:"#b78cff"},finance:{name:"Finance & Retail",color:"#ffcc3d"},penny:{name:"Penny stocks",color:"#ff7ad9"}};
const PERKS=[{l:1,n:"Desk tips and your first broker seat"},{l:2,n:"Stop-loss and take-profit orders"},{l:3,n:"Analyst ratings on every stock"},{l:4,n:"Earnings previews before each report"},{l:5,n:"Breaking news one update before the market reacts"}];
const deskLvl=S=>coSum(S,"trade");
const hasPerk=(S,l)=>deskLvl(S)>=l;
const NEWS={
  secUp:["{S} demand is booming","Government backs {S} with new funding","{S} sales beat expectations nationwide","Big investors pile into {S}"],
  secDown:["{S} hit by supply shortages","New rules squeeze {S} companies","{S} demand cools off","Investors dump {S} stocks"],
  coUp:["{N} unveils a hit new product","{N} lands a huge contract","Analysts upgrade {N}","{N} reports record customers"],
  coDown:["{N} recalls its best seller","{N} CEO steps down suddenly","{N} hit by a data breach","{N} loses a major lawsuit"],
  mktUp:["Interest rates cut. Investors cheer.","Strong jobs report lifts the whole market"],
  mktDown:["Recession fears rattle the market","Bank troubles spook investors"]};
function stockTimeToEarn(S,s){return s.earnIn==null?null:Math.max(0,(s.earnIn-1)*20+(20-(S.clock.mkt||0)))}
function scheduleEarnings(s){if(s.penny){s.earnIn=null;return}s.earnIn=ri(18,30);s.bias=Math.random()<.5+clamp((s.trend||0)*8,-.15,.15)?1:-1;s.preview=null}
function genNews(S,ev){const M=S.mkt,r=Math.random(),dir=Math.random()<.5?1:-1,big=Math.random()<.3,delay=hasPerk(S,5)?2:1;let n;
  if(r<.45){const secs=Object.keys(SECTORS).filter(k=>k!=="penny"),sec=pick(secs);n={kind:"sec",sec,h:pick(NEWS[dir>0?"secUp":"secDown"]).replace("{S}",SECTORS[sec].name),imp:dir*rnd(.012,.022)*(big?1.7:1)}}
  else if(r<.88){const s=pick(S.stocks.filter(x=>!x.penny));n={kind:"co",t:s.t,sec:s.sec,h:pick(NEWS[dir>0?"coUp":"coDown"]).replace("{N}",s.n),imp:dir*s.vol*rnd(.6,1.1)*(big?1.6:1)}}
  else n={kind:"mkt",h:pick(NEWS[dir>0?"mktUp":"mktDown"]),imp:dir*rnd(.006,.012)*(big?1.6:1)};
  Object.assign(n,{id:Math.random().toString(36).slice(2,8),dir,big,in:delay,at:now()});M.news.unshift(n);M.news=M.news.slice(0,25);
  const mine=n.kind==="mkt"?Object.keys(S.port).some(t=>S.port[t]>0):n.kind==="sec"?S.stocks.some(s=>s.sec===n.sec&&S.port[s.t]>0):S.port[n.t]>0;
  if(big||mine)ev.push({kind:dir>0?"good":"bad",title:(big?"BIG NEWS: ":"NEWS: ")+(n.t||(n.sec?SECTORS[n.sec].name.toUpperCase():"MARKET")),text:n.h+(mine?". You own shares that this affects.":". Prices react on the next update."),sfx:"alert"})}
function applyNews(S){const M=S.mkt;for(const n of M.news){if(n.in<=0)continue;n.in--;if(n.in>0)continue;
  if(n.kind==="sec")M.sec[n.sec]=(M.sec[n.sec]||0)+n.imp;else if(n.kind==="mkt")M.sent+=n.imp;else{const s=S.stocks.find(x=>x.t===n.t);if(s)s.trend+=n.imp}}}
function expectedMove(S,s){const M=S.mkt,beta=s.penny?1:s.vol/.03;let e=s.drift+s.trend+((M.sec[s.sec]||0)+M.sent)*beta;
  for(const n of M.news)if(n.in===1&&(n.kind==="mkt"||(n.kind==="sec"&&n.sec===s.sec)||(n.kind==="co"&&n.t===s.t)))e+=n.kind==="co"?n.imp:n.imp*beta;return e}
function buyStock(S,t,q,cashOverride){const s=S.stocks.find(x=>x.t===t),f=fee(S),c=q*s.p*(1+f);if(q<1||S.cash<c)return null;
  const q0=S.port[t]||0;S.basis[t]=((S.basis[t]||s.p)*q0+s.p*q)/(q0+q);S.port[t]=q0+q;S.cash-=c;return{cost:c}}
function sellStock(S,t,q){const s=S.stocks.find(x=>x.t===t),own=S.port[t]||0;q=Math.min(q,own);if(q<1)return null;const v=q*s.p*(1-fee(S)),pnl=v-q*(S.basis[t]||s.p);
  S.cash+=v;S.port[t]=own-q;S.realized=(S.realized||0)+pnl;if(!S.port[t]){delete S.basis[t];delete S.orders[t]}return{value:v,pnl}}
function marketTick(S,ev){
  const M=S.mkt,tipOdds=Math.min(.7,.08*deskLvl(S)),moves={};
  applyNews(S);
  S.stocks.forEach(s=>{const beta=s.penny?1:s.vol/.03;let mv=s.drift+s.trend+((M.sec[s.sec]||0)+M.sent)*beta+(Math.random()-.5)*2*s.vol;
    if(S.tips[s.t])mv=Math.abs(mv)*S.tips[s.t]+S.tips[s.t]*s.vol*.4;
    if(Math.random()<.02)mv+=(Math.random()<.5?-1:1)*s.vol*4;s.event=null;
    if(s.penny){if(Math.random()<.012){mv=Math.abs(mv)+rnd(1,5);s.event="moon"}else if(Math.random()<.01){mv=-rnd(.45,.8);s.event="bust"}}
    else if(s.earnIn!=null&&--s.earnIn<=0){mv+=s.bias*s.vol*rnd(2.5,5);s.event=s.bias>0?"beat":"miss"}
    moves[s.t]=Math.max(-.9,mv)});
  const fv0=brokerTick(S,moves,ev);
  S.stocks.forEach(s=>{const mv=moves[s.t];s.last=mv;s.p=Math.max(s.penny?.02:.5,s.p*(1+mv));s.hist.push(s.p);s.hist=s.hist.slice(-40);
    if(!s.penny)s.base=(s.base||s.p)*(1+s.drift);
    s.trend=s.trend*.7+rnd(-1,1)*s.vol*.25+(s.penny?clamp(.03*Math.log((s.base||1)/s.p),-.12,.08):clamp(.006*Math.log((s.base||s.p)/s.p),-.012,.012));
    const own=S.port[s.t]||0;
    if(s.event==="moon")ev.push({kind:own?"big":"info",title:`${s.t} MOONSHOT ▲${Math.round(mv*100)}%`,text:own?`Your ${own.toLocaleString()} shares are now worth ${money(own*s.p)}! Penny rockets usually fall back, so think about cashing out.`:`${s.n} just exploded. Spikes like this usually fade within a few minutes.`,sfx:own?"fanfare":"alert"});
    else if(s.event==="bust"&&own)ev.push({kind:"bad",title:`${s.t} CRASHED ▼${Math.round(-mv*100)}%`,text:`Your ${s.t} shares fell to ${money(own*s.p)}. Penny stocks often bounce back, but not always.`,sfx:"bad"});
    else if(s.event==="beat"||s.event==="miss"){if(own||hasPerk(S,4))ev.push({kind:s.event==="beat"?(own?"big":"good"):"bad",title:`${s.t} ${s.event==="beat"?"BEAT":"MISSED"} EARNINGS ${mv>0?"▲":"▼"}${Math.abs(mv*100).toFixed(1)}%`,text:own?`Your ${own.toLocaleString()} shares ${mv>0?"gained":"lost"} ${money(Math.abs(own*s.p*mv/(1+mv)))}.`:`${s.n} reported results.`,sfx:s.event==="beat"?"up":"bad"});scheduleEarnings(s)}
    else if(!s.penny&&own&&Math.abs(mv)>=.06){const v=own*s.p*mv/(1+mv);
      ev.push(mv>0?{kind:"big",title:`${s.t} UP ${(mv*100).toFixed(1)}%`,text:`Your ${own.toLocaleString()} shares gained ${money(v)}.`,sfx:"up"}:{kind:"bad",title:`${s.t} DOWN ${(-mv*100).toFixed(1)}%`,text:`Your ${own.toLocaleString()} shares lost ${money(-v)}.`,sfx:"bad"})}
    if(s.earnIn!=null&&s.earnIn<=3&&s.preview==null&&hasPerk(S,4))s.preview=Math.random()<.75?s.bias:-s.bias;
    if(hasPerk(S,3)){const e=expectedMove(S,s),thr=s.penny?.03:.004;let r=Math.abs(e)<thr?0:Math.sign(e);if(Math.random()>.72)r=r===0?pick([1,-1]):(Math.random()<.5?0:-r);s.rating=r}});
  // automatic orders
  if(hasPerk(S,2))for(const[t,o]of Object.entries(S.orders)){const s=S.stocks.find(x=>x.t===t),own=S.port[t]||0,b=S.basis[t];if(!s||!own||!b)continue;
    const g=s.p/b-1;let why=null;if(o.tp&&g>=o.tp)why="TAKE PROFIT";else if(o.sl&&g<=-o.sl)why="STOP LOSS";
    if(why){const r=sellStock(S,t,own);ev.push({kind:r.pnl>=0?"big":"bad",title:`${why}: SOLD ${t}`,text:`Sold ${own.toLocaleString()} ${t} at ${g>=0?"+":""}${(g*100).toFixed(1)}% for ${money(r.value)} (${r.pnl>=0?"+":""}${money(r.pnl)}).`,sfx:r.pnl>=0?"cash":"bad",dirty:1})}}
  // dividends every 5 minutes of play
  M.divT=(M.divT||0)+20;if(M.divT>=300){M.divT=0;let paid=0;
    for(const s of S.stocks)if(s.div){paid+=(S.port[s.t]||0)*s.p*s.div;for(const p of Object.values(S.fund.pos))if(p.t===s.t)S.fund.cash+=p.q*s.p*s.div}
    paid*=1+.05*shopPerk(S,"bank");
    if(paid>=1){S.cash+=paid;S.divPaid=(S.divPaid||0)+paid;S.totalEarned+=paid;ev.push({kind:"good",title:"DIVIDENDS PAID",text:`Your stocks paid you ${money(paid)} in dividends.`,sfx:"coin"})}}
  // sector momentum fades, market mood fades
  for(const k in M.sec)M.sec[k]*=.8;M.sent*=.85;
  const F=S.fund;if(fv0!=null){const fv=fundValue(S);F.last=fv-fv0;F.total=(F.total||0)+F.last;F.hist.push(Math.round(fv));F.hist=F.hist.slice(-60);
    if(Math.abs(F.last)>Math.max(1000,fv*.08))ev.push(F.last>0?{kind:"big",title:"BROKERS SCORED",text:`Your broker fund made ${money(F.last)} this update.`,sfx:"cash"}:{kind:"bad",title:"BROKERS TOOK A HIT",text:`Your broker fund lost ${money(-F.last)} this update.`,sfx:"bad"})}
  if(--M.newsIn<=0){M.newsIn=ri(3,6);genNews(S,ev)}
  S.tips={};if(Math.random()<tipOdds){const s=pick(S.stocks);const d=expectedMove(S,s)>=0?1:-1;S.tips[s.t]=d;ev.push({kind:"info",title:"DESK TIP",text:`Your traders think ${s.t} goes ${d>0?"UP":"DOWN"} next.`,sfx:"alert"})}
}

/* ---------- brokers: each one runs a strategy and holds real positions ---------- */
const STRATS={
  day:{name:"Day trader",desc:"Trades any regular stock, in and out quickly.",ok:s=>!s.penny},
  sector:{name:"Sector specialist",desc:"Only trades one sector, and reads it much better.",ok:(s,e)=>!s.penny&&s.sec===(e.sector||"tech")},
  dividend:{name:"Dividend hunter",desc:"Holds steady dividend stocks and collects the payouts. Low risk.",ok:s=>s.div>0},
  penny:{name:"Penny hunter",desc:"Chases penny stocks. Mostly luck: huge wins and big losses.",ok:s=>s.penny}};
const RISK={};// kept so old saves load
const fundValue=S=>{const F=S.fund;let v=F.cash||0;for(const p of Object.values(F.pos||{})){const s=S.stocks.find(x=>x.t===p.t);if(s)v+=p.q*s.p}return v};
function brokerAccOn(S,e,s){if(s.event==="moon"||s.event==="bust")return .5;let a=brokerAcc(S,e);
  if(e.strat==="sector"&&s.sec===e.sector)a+=.035;if(e.strat==="dividend"&&s.div)a+=.02;
  if(S.mkt.news.some(n=>n.in===0&&Date.now()-n.at<120e3&&(n.t===s.t||n.sec===s.sec)))a+=.015;
  if(s.penny)a=.5+(a-.5)*.4;return Math.min(.8,a)}
function brokerTick(S,moves,ev){
  const F=S.fund,bs=brokers(S).slice(0,brokerCap(S)),ids=new Set(bs.map(e=>e.id)),fb=.004;
  // positions of brokers who left are sold back into the fund
  for(const[id,p]of Object.entries(F.pos)){if(!ids.has(id)){const s=S.stocks.find(x=>x.t===p.t);if(s)F.cash+=p.q*s.p*(1-fb);delete F.pos[id]}}
  let fv=fundValue(S);const target=bs.length?F.alloc*(Math.max(0,S.cash)+fv):0;let diff=target-fv;
  if(diff>0){diff=Math.min(diff,Math.max(0,S.cash));S.cash-=diff;F.cash+=diff}else if(diff<0){const back=Math.min(-diff,F.cash);F.cash-=back;S.cash+=back}
  if(!bs.length){return fundValue(S)>=1?fundValue(S):null}
  fv=fundValue(S);const budget=fv/bs.length;
  for(const e of bs){const strat=STRATS[e.strat]?e.strat:"day";let pos=F.pos[e.id];
    if(pos){const s=S.stocks.find(x=>x.t===pos.t),mv=moves[s.t],good=Math.random()<brokerAccOn(S,e,s),seesDown=good?mv<=0:mv>0;
      if(seesDown&&!(strat==="dividend"&&(Math.random()<.8||s.p<pos.cost))){const fee=s.penny?.02:fb,v=pos.q*s.p*(1-fee),pnl=v-pos.q*pos.cost,com=pnl>0?pnl*.2:0;
        F.cash+=v-com;e.pnl=(e.pnl||0)+pnl-com;e.trades=(e.trades||0)+1;e.xp+=1;F.log.unshift({n:e.name.split(" ")[0],a:"sold",t:s.t,r:s.p/pos.cost-1,p:Math.round(pnl-com),at:now()});delete F.pos[e.id];pos=null}}
    if(!pos){const uni=S.stocks.filter(s=>STRATS[strat].ok(s,e));if(!uni.length)continue;const s=strat==="dividend"?uni.sort((a,b)=>(b.div/(b.p/(b.base||b.p)))-(a.div/(a.p/(a.base||a.p))))[0]:pick(uni),mv=moves[s.t],good=Math.random()<brokerAccOn(S,e,s),seesUp=strat==="dividend"?(good||Math.random()<.5):good?mv>0:mv<=0;
      if(seesUp){const fee=s.penny?.02:fb,spend=Math.min(budget,F.cash),q=Math.floor(spend/(s.p*(1+fee)));
        if(q>=1){F.cash-=q*s.p*(1+fee);F.pos[e.id]={t:s.t,q,cost:s.p*(1+fee)};e.xp+=.5;F.log.unshift({n:e.name.split(" ")[0],a:"bought",t:s.t,q,at:now()})}}}}
  F.log=F.log.slice(0,14);return fundValue(S)}

/* ---------- HR director: runs the people side of the company ---------- */
function hrLog(S,m,lot){S.hrLog.unshift({m,at:now(),lot});S.hrLog=S.hrLog.slice(0,40)}
function spendPoint(e){const order=["spd","chr","sta"];for(const cap of[8,10])for(const k of order)if(e[k]<cap){e[k]++;return k}return null}
function emptyStations(S,pred=()=>true){const out=[];for(const[lot,L]of Object.entries(S.lots))L.floors.forEach((f,i)=>{if(isBiz(f.type)&&pred(f,lot,i))f.staff.forEach((x,k)=>{if(!x)out.push({lot,i,k,f})})});return out}
function hrTick(S,rt,ev){for(const lot of Object.keys(S.lots))hrTickLot(S,rt,ev,lot)}
function hrTickLot(S,rt,ev,lot){
  if(!hrActive(S,lot))return;const P=S.hr,d=hrDirector(S,lot),fn=e=>e.name.split(" ")[0],mine=e=>homeOf(e)===lot,here=f=>(f2,l)=>l===lot&&f(f2);let acts=0;const t=now();
  const log=m=>{hrLog(S,m,lot);acts++};
  if(P.requests)for(const it of[...S.inbox]){const e=emp(S,it.emp);if(!e||!mine(e))continue;const a=it.kind==="unhappy"?"raise":it.kind==="transfer"?"transfer":it.kind==="promo"?(P.promote?"promo":null):null;
    if(a){const r=resolveInbox(S,rt,it.id,a);if(r.ok)log(`Handled a request: ${r.msg}`)}}
  for(const e of S.emps){if(!mine(e))continue;
    if(P.raises){const fair=fairPay(e);if(e.salary<fair*.97){e.salary=Math.round(fair*1.02*100)/100;log(`Raised ${fn(e)} to ${money(e.salary)}/min.`)}}
    if(P.praise&&e.mood<55&&t-e.praisedAt>300e3){e.praisedAt=t;e.mood=Math.min(100,e.mood+15);e.low=Math.max(0,e.low-60);log(`Checked in with ${fn(e)}.`)}
    if(P.points)while(e.pts>0){const k=spendPoint(e);if(!k)break;e.pts--;log(`Trained ${fn(e)}'s ${{spd:"speed",chr:"charm",sta:"stamina"}[k]}.`)}}
  if(P.promote)S.lots[lot].floors.forEach((f,i)=>{if(!isBiz(f.type)||f.manager)return;
    const c=S.emps.filter(e=>mine(e)&&e.role==="staff"&&e.lvl>=3).sort((a,b)=>(b.promoReady-a.promoReady)||(b.lvl-a.lvl))[0];
    if(c){setManager(S,c.id,lot,i);log(`Promoted ${fn(c)} to manage the ${BIZ[f.type].name}.`);ev.push({kind:"good",title:"NEW MANAGER",text:`${d.name} promoted ${c.name} to manage the ${BIZ[f.type].name} at ${lotDef(lot).name}.`,sfx:"up",dirty:1})}});
  const idle=()=>S.emps.filter(e=>mine(e)&&e.role==="staff"&&!e.loc&&e.state==="idle");
  if(P.staffing){for(const e of idle()){const es=emptyStations(S,here(()=>true)),best=es.find(x=>x.f.type===e.fav)||es[0];if(!best)break;
      assign(S,e.id,best.lot,best.i,best.k);log(`Put ${fn(e)} on the ${BIZ[best.f.type].name}${best.f.type===e.fav?" (their favorite)":""}.`)}}
  if(P.favorites)for(const e of S.emps){if(!mine(e)||e.role!=="staff"||!e.loc||e.state!=="work")continue;const cur=S.lots[e.loc.lot]?.floors[e.loc.i];if(!cur||cur.type===e.fav)continue;
    const spot=emptyStations(S,here(f=>f.type===e.fav))[0];if(spot){assign(S,e.id,spot.lot,spot.i,spot.k);log(`Moved ${fn(e)} to the ${BIZ[e.fav].name} they love.`)}}
  if(P.staffing&&P.favorites){const ws=S.emps.filter(e=>mine(e)&&e.role==="staff"&&e.loc&&e.state==="work");
    outer:for(const a of ws){const fa=S.lots[a.loc.lot].floors[a.loc.i];if(fa.type===a.fav)continue;
      for(const b of ws){if(b===a)continue;const fb=S.lots[b.loc.lot].floors[b.loc.i];if(fb.type===a.fav&&fb.type!==b.fav){
        const la={...a.loc},lb={...b.loc};assign(S,a.id,lb.lot,lb.i,lb.slot);assign(S,b.id,la.lot,la.i,la.slot);log(`Swapped ${fn(a)} and ${fn(b)} so ${fn(a)} works where they're happiest.`);break outer}}}}
  if(P.training){const ti=findSupport(S,lot,"training");if(ti>=0)for(const e of idle()){if(seatsFree(S,lot,"training")<=0)break;if(e.energy<=60)continue;e.state="train";e.at={lot,i:ti};log(`Sent ${fn(e)} to training while there's no open station.`)}}
  if(acts){d.xp+=.2*acts;ev.push({dirty:1})}
}

function refreshApplicants(S){const q=Math.min(4,Math.floor(S.goalIdx/2));S.applicants=Array.from({length:3},()=>mkEmp(ri(0,q)));S.appAt=now()}

/* ---------- inbox: requests that wait for you ---------- */
function bestFloor(S,pred=()=>true){let best=null;for(const[lot,L]of Object.entries(S.lots))L.floors.forEach((f,i)=>{if(isBiz(f.type)&&pred(f)&&(!best||f.rating>best.f.rating))best={lot,i,f}});return best}
function mkUnhappy(S,e){const fair=fairPay(e),gap=e.salary<fair*.95,first=e.name.split(" ")[0];
  return{id:Math.random().toString(36).slice(2,9),kind:"unhappy",emp:e.id,expires:now()+600e3,title:`${e.name} is thinking about quitting`,
    text:gap?`${first} feels underpaid: ${money(e.salary)}/min when fair is about ${money(fair)}/min.`:e.energy<25?`${first} is exhausted. A Staff Lounge in their tower would let them rest.`:`${first} feels unappreciated. A little recognition goes a long way.`,
    ch:[{l:gap?`Raise to ${money(fair*1.05)}/min`:`Give a ${money(Math.round(e.salary*30))} bonus`,a:"raise"},{l:"Have a heart-to-heart",a:"praise"}]}}
function genInbox(S){
  if(S.inbox.length>=5)return null;const opts=[];const t=now();
  const emps=S.emps.filter(e=>!S.inbox.some(x=>x.emp===e.id));
  const wantsFav=emps.find(e=>e.role==="staff"&&e.loc&&!e.loc.mgr&&S.lots[e.loc.lot].floors[e.loc.i].type!==e.fav&&S.lots[homeOf(e)]?.floors.some(f=>f.type===e.fav));
  if(wantsFav)opts.push(()=>({kind:"transfer",emp:wantsFav.id,title:`${wantsFav.name} has a request`,text:`${wantsFav.name.split(" ")[0]} loves working at a ${BIZ[wantsFav.fav].name} and asked to transfer. They'd be 20% faster and happier there.`,ch:[{l:"Transfer them",a:"transfer"},{l:"Not right now",a:"deny"}]}));
  const amb=emps.find(e=>e.role==="staff"&&e.lvl>=4&&!e.promoReady);
  if(amb)opts.push(()=>({kind:"promo",emp:amb.id,title:`${amb.name} wants to lead`,text:`${amb.name.split(" ")[0]} asked to become a manager. Managers collect cash on their own, speed up their floor 10%, and keep it earning while you're away.`,ch:[{l:"Promote them",a:"promo"},{l:"Not yet",a:"deny"}]}));
  const bf=bestFloor(S);
  if(bf&&S.goalIdx>=1)opts.push(()=>({kind:"critic",lot:bf.lot,i:bf.i,title:"A food critic wants to visit",text:`A famous critic wants to review your ${BIZ[bf.f.type].name} at ${lotDef(bf.lot).name}. Serve them fast and well for a huge rating boost. A bad visit will hurt.`,ch:[{l:"Welcome them",a:"critic"},{l:"Politely decline",a:"deny"}]}));
  const lot=pick(Object.keys(S.lots)),fc=Math.round(Math.max(200,estIncomePerMin(S)*4));
  opts.push(()=>({kind:"festival",lot,cost:fc,title:`${lotDef(lot).name} street festival`,text:`The neighborhood is throwing a festival. Sponsor it for ${money(fc)} and every business in that tower gets +60% customers for 10 minutes. Make sure your staff can handle it.`,ch:[{l:`Sponsor it (${money(fc)})`,a:"festival"},{l:"Skip it",a:"deny"}]}));
  const cc=Math.round(Math.max(100,estIncomePerMin(S)*2));
  opts.push(()=>({kind:"charity",cost:cc,title:"Charity drive",text:`A local shelter is raising money. Donating ${money(cc)} builds goodwill: more hype, and your whole team feels proud.`,ch:[{l:`Donate ${money(cc)}`,a:"charity"},{l:"Not this time",a:"deny"}]}));
  const sc=Math.round(Math.max(300,estIncomePerMin(S)*5));
  opts.push(()=>({kind:"supplier",cost:sc,title:"Premium supplier offer",text:`A supplier offers better ingredients and materials for ${money(sc)}. Every business earns +20% for 15 minutes.`,ch:[{l:`Sign up (${money(sc)})`,a:"supplier"},{l:"No thanks",a:"deny"}]}));
  const it={id:Math.random().toString(36).slice(2,9),expires:t+900e3,...pick(opts)()};S.inbox.unshift(it);return it}
function resolveInbox(S,rt,id,a){
  const it=S.inbox.find(x=>x.id===id);if(!it)return{ok:false,msg:"That request is gone."};const e=emp(S,it.emp),first=e?e.name.split(" ")[0]:"";let msg="Done.";
  if(a==="deny"){if(e){e.mood=Math.max(0,e.mood-8);msg=`${first} is a little disappointed.`}else msg="Passed."}
  if(a==="raise"&&e){const fair=fairPay(e);if(e.salary<fair*.95){e.salary=Math.round(fair*1.05*100)/100}else{const b=Math.round(e.salary*30);if(S.cash<b)return{ok:false,msg:`You need ${money(b)}.`};S.cash-=b}e.mood=Math.min(100,e.mood+30);e.low=0;msg=`${first} feels valued again.`}
  if(a==="praise"&&e){e.praisedAt=now();e.mood=Math.min(100,e.mood+15);e.low=Math.max(0,e.low-60);msg=`${first} appreciated the talk.`}
  if(a==="transfer"&&e){let done=false;for(const[lot,L]of Object.entries(S.lots))L.floors.forEach((f,i)=>{if(done||f.type!==e.fav||lot!==homeOf(e))return;const k=f.staff.findIndex(x=>!x);if(k<0)return;assign(S,e.id,lot,i,k);done=true});
    if(!done)return{ok:false,msg:`No free station at a ${BIZ[e.fav].name}. Add a station there first.`};e.mood=Math.min(100,e.mood+20);msg=`${first} is thrilled with the move.`}
  if(a==="promo"&&e){e.promoReady=true;e.mood=Math.min(100,e.mood+15);msg=`Open Team and pick a floor for ${first} to manage.`}
  if(a==="critic"){const f=S.lots[it.lot]?.floors[it.i];if(rt&&f&&isBiz(f.type))frt(rt,it.lot,it.i,f).vipPending=true;msg="The critic is on the way. Make sure that floor is staffed!"}
  if(["festival","charity","supplier"].includes(a)){if(S.cash<it.cost)return{ok:false,msg:`You need ${money(it.cost)}.`};S.cash-=it.cost;
    if(a==="festival"){S.buffs.push({kind:"traffic",lot:it.lot,mult:1.6,until:now()+600e3,name:"Festival at "+lotDef(it.lot).name});msg="Festival time! Customers incoming."}
    if(a==="charity"){S.rep+=15;S.emps.forEach(x=>x.mood=Math.min(100,x.mood+10));msg="The whole team is proud of you."}
    if(a==="supplier"){S.buffs.push({kind:"rev",mult:1.2,until:now()+900e3,name:"Premium supplier"});msg="+20% revenue for 15 minutes."}}
  S.inbox=S.inbox.filter(x=>x!==it);log(S,`${it.title}: ${msg}`);return{ok:true,msg}}

/* ---------- business deals ---------- */
const COMPANIES=["Gigamart","Pixel Pete's","Nimbus Air","Bolt Logistics","Kraken Shipping","Sunny Farms","Orbit Labs","Hyper Gym","Velvet Hotels","Turbo Taxi","Bean There Coffee","Cloud Nine Bakery","MegaByte Games"];
function genDeal(S){
  if(S.deals.length>=4)return null;
  const pm=Math.max(40,estIncomePerMin(S)),co=pick(COMPANIES),kinds=["supply","supply","partner","acquire","star","investor"];
  if(LOTS.some(l=>!S.lots[l.id])&&!S.landDiscount&&!S.deals.some(x=>x.kind==="land"))kinds.push("land");
  const owned=Object.entries(S.port).filter(([t,q])=>q>=10);if(owned.length)kinds.push("shares");
  const k=pick(kinds),d={id:Math.random().toString(36).slice(2,9),kind:k,company:co,created:now(),expires:now()+18*3600e3};
  if(k==="supply"){const c=Math.round(pm*rnd(6,10)),r=Math.round(c*rnd(1.3,1.7));Object.assign(d,{title:"Supply contract",text:`Pay ${money(c)} now and ${co} pays you back ${money(r)} over the next 10 minutes of play.`,cost:c,ret:r,accept:"SIGN IT"})}
  if(k==="partner"){const c=Math.round(pm*6);Object.assign(d,{title:"Brand partnership",text:`Co-brand with ${co} for ${money(c)}: every business earns +25% for 20 minutes of play.`,cost:c,accept:"PARTNER UP"})}
  if(k==="acquire"){const types=Object.keys(BIZ).filter(t=>BIZ[t].rank<=S.goalIdx&&!BIZ[t].only),type=pick(types),c=Math.round(BIZ[type].cost*1.4);
    Object.assign(d,{title:"Acquisition",text:`${co} is selling a ready-made ${BIZ[type].name} with 2 stations and nice decor for ${money(c)}. It moves into your tower. You'll still need staff.`,cost:c,ftype:type,accept:"BUY IT"})}
  if(k==="star"){const e=mkEmp(Math.min(5,2+Math.floor(S.goalIdx/2)),{lvl:2});Object.assign(d,{title:"Star applicant",text:`${e.name}, ${TRAITS.find(t=>t.id===e.trait).name.toLowerCase()}, SPD ${e.spd} · CHR ${e.chr} · STA ${e.sta}, wants to work for you. No hiring fee. ${money(e.salary)}/min.`,cost:0,emp:e,accept:"HIRE THEM"})}
  if(k==="investor"){const g=Math.round(pm*15);Object.assign(d,{title:"Angel investor",text:`${co}'s founder offers ${money(g)} now for 15% of your revenue over the next 20 minutes of play.`,cost:-g,accept:"TAKE IT"})}
  if(k==="land"){const next=LOTS.find(l=>!S.lots[l.id]),c=Math.round(next.price*.08);Object.assign(d,{title:"Realtor tip",text:`Pay a ${money(c)} finder's fee and get 30% off the next property you buy (like ${next.name}).`,cost:c,accept:"PAY THE FEE"})}
  if(k==="shares"){const[t,q]=pick(owned),st=S.stocks.find(s=>s.t===t),n=Math.max(10,Math.floor(q*.5)),px=st.p*1.2;Object.assign(d,{title:"Share buyer",text:`${co} wants ${n} of your ${t} shares at $${px.toFixed(2)}, 20% above market. That's ${money(n*px)}.`,cost:0,t,n,px,accept:"SELL"})}
  S.deals.push(d);S.lastDealGen=now();return d}
function applyDeal(S,id){
  const d=S.deals.find(x=>x.id===id);if(!d)return{ok:false,msg:"That deal is gone."};if(d.cost>0&&S.cash<d.cost)return{ok:false,msg:`You need ${money(d.cost)}.`};
  let msg="";const T=now();
  if(d.kind==="supply"){S.contracts.push({name:d.company,perMin:d.ret/10,until:T+600e3});msg=`${d.company} will pay you back over 10 minutes.`}
  if(d.kind==="partner"){S.buffs.push({kind:"rev",mult:1.25,until:T+1200e3,name:d.company+" partnership"});msg="+25% revenue for 20 minutes."}
  if(d.kind==="investor"){S.buffs.push({kind:"rev",mult:.85,until:T+1200e3,name:"Investor cut"});msg=`${money(-d.cost)} in the bank.`}
  if(d.kind==="land"){S.landDiscount=.3;msg="30% off your next property."}
  if(d.kind==="star"){if(roomAt(S,S.cur)<=0)return{ok:false,msg:`${lotDef(S.cur).name} is full. Build or upgrade an HR Office there, or switch to another property.`};d.emp.home=S.cur;S.emps.push(d.emp);msg=`${d.emp.name} joined! Give them a station in Team.`}
  if(d.kind==="shares"){const own=S.port[d.t]||0;if(own<d.n)return{ok:false,msg:`You only have ${own} ${d.t}.`};S.port[d.t]=own-d.n;S.cash+=d.n*d.px;msg=`Sold for ${money(d.n*d.px)}.`}
  if(d.kind==="acquire"){let placed=null;
    for(const[lot,L]of Object.entries(S.lots)){const i=L.floors.findIndex(f=>!f.type);if(i>=0){placed=[lot,i];break}}
    if(!placed)for(const[lot,L]of Object.entries(S.lots))if(L.floors.length<maxFloors(S)){L.floors.push({type:null});placed=[lot,L.floors.length-1];break}
    if(!placed)return{ok:false,msg:"No room. Clear a floor or rank up first."};
    const f=bizFloor(d.ftype);f.stations=2;f.staff=[null,null];f.decor=2;S.lots[placed[0]].floors[placed[1]]=f;msg=`New ${BIZ[d.ftype].name} at ${lotDef(placed[0]).name}. Staff it up!`}
  S.cash-=d.cost;if(d.cost>0)S.spent+=d.cost*.3;S.deals=S.deals.filter(x=>x!==d);log(S,`Deal with ${d.company}: ${msg}`);return{ok:true,msg}}
function declineDeal(S,id){S.deals=S.deals.filter(x=>x.id!==id)}
const pruneDeals=S=>{const t=now();S.deals=S.deals.filter(d=>d.expires>t)};
function timeLeft(ms){const m=Math.max(0,Math.round((ms-now())/60000));return m>=60?Math.floor(m/60)+"h "+(m%60)+"m":m+"m"}

/* ---------- offline ---------- */
function offline(S,t=now()){
  const el=Math.min(8*3600e3,t-(S.lastTick||t));if(el<60e3)return null;const mins=el/60000;let earned=0,filled=0;
  for(const[lot,L]of Object.entries(S.lots))L.floors.forEach((f,i)=>{if(!isBiz(f.type))return;const pm=estPerMin(S,lot,i,f);
    if(f.manager)earned+=pm*mins*.5*(1+Math.min(.5,.03*shopPerk(S,"carwash")));else{const cap=registerCap(S,lot,f);filled+=Math.max(0,Math.min(cap-f.register,pm*mins*.5))}});
  const shops=Math.round(shopsPerMin(S,true)*mins);earned+=shops;
  return{mins,shops,earned:Math.round(earned),filled:Math.round(filled)}}
function applyOffline(S,o){if(!o)return;S.cash+=o.earned;if(o.mins)for(const k in S.shops)S.shops[k].earned=(S.shops[k].earned||0)+shopInc(S,k,true)*o.mins;S.totalEarned+=o.earned+o.filled;
  for(const[lot,L]of Object.entries(S.lots))L.floors.forEach((f,i)=>{if(isBiz(f.type)&&!f.manager){const cap=registerCap(S,lot,f);f.register=Math.min(cap,f.register+estPerMin(S,lot,i,f)*o.mins*.5)}});
  S.emps.forEach(e=>{e.energy=100;if(e.state==="break"){e.state=e.loc?(e.loc.mgr?"manage":"work"):"idle";e.at=null}});S.lastTick=now()}

/* ---------- storage ---------- */
function log(S,m){S.log.unshift(`D${S.day}: ${m}`);S.log=S.log.slice(0,80)}
const KEY="towerTycoonState",AKEY="towerTycoonActions";
const hasChrome=typeof chrome!=="undefined"&&chrome.storage&&chrome.storage.local;
async function loadState(){try{if(hasChrome){const r=await chrome.storage.local.get(KEY);if(r[KEY])return migrate(r[KEY])}else{const r=localStorage.getItem(KEY);if(r)return migrate(JSON.parse(r))}}catch(e){}return null}
async function saveState(S,writer){S.rev=(S.rev||0)+1;S.writer=writer;const clean=JSON.parse(JSON.stringify(S,(k,v)=>k==="busy"?undefined:v));
  try{if(hasChrome)await chrome.storage.local.set({[KEY]:clean});else localStorage.setItem(KEY,JSON.stringify(clean))}catch(e){}}
function onStateChange(cb){if(hasChrome)chrome.storage.onChanged.addListener((ch,a)=>{if(a==="local"&&ch[KEY]?.newValue)cb(migrate(ch[KEY].newValue))});
  else addEventListener("storage",e=>{if(e.key===KEY&&e.newValue)cb(migrate(JSON.parse(e.newValue)))})}
async function pushAction(a){try{if(hasChrome){const r=await chrome.storage.local.get(AKEY);await chrome.storage.local.set({[AKEY]:[...(r[AKEY]||[]),a]})}else{const q=JSON.parse(localStorage.getItem(AKEY)||"[]");q.push(a);localStorage.setItem(AKEY,JSON.stringify(q))}}catch(e){}}
async function takeActions(){try{if(hasChrome){const r=await chrome.storage.local.get(AKEY);if(r[AKEY]?.length){await chrome.storage.local.set({[AKEY]:[]});return r[AKEY]}}else{const q=JSON.parse(localStorage.getItem(AKEY)||"[]");if(q.length){localStorage.setItem(AKEY,"[]");return q}}}catch(e){}return[]}
function onActions(cb){if(hasChrome)chrome.storage.onChanged.addListener((ch,a)=>{if(a==="local"&&ch[AKEY]?.newValue?.length)cb()});else addEventListener("storage",e=>{if(e.key===AKEY)cb()})}
const gameOpen=S=>!!S&&now()-(S.heartbeat||0)<15e3;
/* ---------- save codes: move a company between the extension and the website ---------- */
function exportCode(S){const clean=JSON.parse(JSON.stringify(S,(k,v)=>k==="busy"?undefined:v));const json=JSON.stringify(clean);
  return "TT3:"+btoa(unescape(encodeURIComponent(json)))}
function importCode(str){str=String(str||"").trim();let json;
  if(str.startsWith("TT3:")){try{json=decodeURIComponent(escape(atob(str.slice(4).replace(/\s+/g,""))))}catch(e){throw new Error("That save code is damaged or incomplete. Copy the whole thing and try again.")}}
  else if(str.startsWith("{"))json=str;
  else throw new Error("That doesn't look like a Tower Tycoon save code. It should start with TT3:");
  let S;try{S=JSON.parse(json)}catch(e){throw new Error("That save code is damaged or incomplete. Copy the whole thing and try again.")}
  if(!S||S.v!==3||!S.lots||!S.emps)throw new Error("That save is from an older version of the game and can't be loaded.");
  S=migrate(S);S.lastTick=Date.now();S.heartbeat=0;return S}
function migrate(S){if(!S||S.v!==3)return fresh();const F=fresh();for(const k in F)if(S[k]===undefined)S[k]=F[k];
  for(const d of STOCK_DEFS){const s=S.stocks.find(x=>x.t===d.t);if(!s)S.stocks.push(mkStock(d));else{s.sec=d.sec;s.div=d.div||0;s.vol=d.vol;s.n=d.n;s.drift=d.drift;if(!s.base)s.base=s.p;if(s.earnIn===undefined){scheduleEarnings(s);if(s.earnIn)s.earnIn=ri(4,30)}}}
  S.stocks.sort((a,b)=>STOCK_DEFS.findIndex(d=>d.t===a.t)-STOCK_DEFS.findIndex(d=>d.t===b.t));
  if(S.fund&&S.fund.cash===undefined){S.fund.cash=S.fund.value||0;S.fund.pos={};delete S.fund.value;delete S.fund.risk}
  S.hr={...F.hr,...S.hr};S.fund={...F.fund,...S.fund};S.mkt={...F.mkt,...S.mkt};
  for(const e of S.emps)if(e.role==="broker"&&!e.strat){e.strat="day";e.sector="tech"}
  for(const e of S.emps)if(!e.home||!S.lots[e.home])e.home=(e.loc&&S.lots[e.loc.lot]&&e.loc.lot)||(e.at&&S.lots[e.at.lot]&&e.at.lot)||"main";
  {const seen=new Set();for(const e of S.emps)if(e.role==="hr"){if(seen.has(e.home)){e.role="staff";e.state="idle"}else seen.add(e.home)}}
  for(const[t,q]of Object.entries(S.port||{}))if(q>0&&!S.basis[t]){const st=S.stocks.find(x=>x.t===t);if(st)S.basis[t]=st.p}S.settings={...F.settings,...S.settings};S.clock={...F.clock,...S.clock};if(!S.lots[S.cur])S.cur="main";return S}

G.TT={rnd,ri,pick,clamp,money,BIZ,SUPPORT,KINDS,isBiz,TIERS,LOTS,RANKS,AFFIRM,TRAITS,GEO,MAX_ST,MAX_DECOR,MAX_SUP,
  mkEmp,fairPay,xpNeed,trait,fresh,bizFloor,supFloor,lotDef,lotIdx,lotMult,lotTier,emp,lotSum,coSum,staffCap,homeOf,headcount,roomAt,allowedHere,hypeMult,maxFloors,
  floorCost,buildCost,stationCost,decorCost,supCost,hireFee,lotPrice,goal,rank,unlocked,arrivalsPerMin,revenue,present,speedF,svcTime,patience,
  SHOPS,SHOP_MAX,SHOP_MODES,PROMO,shopMode,shopPerk,promoOn,shopPromo,setShop,shopRefund,sellShop,shopLvl,shopInc,shopsPerMin,shopCost,buyShop,
  capacityPerMin,registerCap,estPerMin,wagesPerMin,contractPerMin,estIncomePerMin,regTotal,portVal,netWorth,fee,avgRating,
  unassign,assign,setManager,setRole,brokers,brokerCap,brokerSkill,brokerAcc,brokerAccOn,hrDirector,hrActive,RISK,STOCK_DEFS,SECTORS,PERKS,STRATS,deskLvl,hasPerk,fundValue,buyStock,sellStock,stockTimeToEarn,expectedMove,spendPoint,emptyStations,seatsFree,findSupport,frt,newRT,tick,perMin,refreshApplicants,resolveInbox,genInbox,
  genDeal,applyDeal,declineDeal,pruneDeals,timeLeft,offline,applyOffline,log,loadState,saveState,exportCode,importCode,migrate,onStateChange,pushAction,takeActions,onActions,gameOpen,KEY};
})(typeof globalThis!=="undefined"?globalThis:self);
