/* Pixel tower renderer v3. Draws the live sim: customers queue, staff serve at counters, registers fill up.
   Used by the game page. */
(function(G){
const T=G.TT;

/* ---------- tiny 3x5 pixel font ---------- */
const GL={"0":"####.##.##.####","1":".#.##..#..#.###","2":"###..#####..###","3":"###..#.##..####","4":"#.##.####..#..#","5":"####..###..####","6":"####..####.####","7":"###..#.#..#..#.","8":"####.#####.####","9":"####.####..####",
"$":".####..#..####.","+":"....#.###.#....","-":"......###......",".":"............#..","%":"#.#..#.#.#..#.#","!":".#..#..#.....#.","^":".#.###.#..#..#.","~":".#..#..#.###.#.",":":"....#.....#....","/":"..#..#.#..#.#..","*":"....#.###.#.#.#","?":"###..#.##.....#.",
A:".#.#.#####.#.#",B:"##.#.###.#.###.",C:".###..#..#...##",D:"##.#.##.##.###.",E:"####..##.#..###",F:"####..##.#..#..",G:".###..#.##.#.##",H:"#.##.#####.##.#",I:"###.#..#..#.###",J:"..#..#..##.#.#.",K:"#.###.#..##.#.#",L:"#..#..#..#..###",M:"#.#####.##.##.#",N:"##.#.##.##.##.#",O:".#.#.##.##.#.#.",P:"##.#.###.#..#..",Q:".#.#.##.###..##",R:"##.#.###.#.##.#",S:".###...#...###.",T:"###.#..#..#..#.",U:"#.##.##.##.####",V:"#.##.##.##.#.#.",W:"#.##.########.#",X:"#.##.#.#.#.##.#",Y:"#.##.#.#..#..#.",Z:"###..#.#.#..###"};
for(const k in GL)if(GL[k].length!==15)GL[k]=(GL[k]+"...............").slice(0,15);
GL.A=".#.#.#####.##.#";GL["?"]="###..#.##....#.";
function text(cx,s,x,y,col,shadow=true){s=String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();x=Math.round(x);y=Math.round(y);
  const draw=(ox,oy,c)=>{cx.fillStyle=c;for(let i=0;i<s.length;i++){const g=GL[s[i]];if(!g)continue;for(let p=0;p<15;p++)if(g[p]==="#")cx.fillRect(ox+i*4+p%3,oy+(p/3|0),1,1)}};
  if(shadow)draw(x+1,y+1,"#000");draw(x,y,col)}
const textW=s=>String(s).length*4-1;
function short(n){n=Math.round(n);const a=Math.abs(n);
  if(a>=1e12)return"$"+(n/1e12).toFixed(a<1e13?1:0)+"T";if(a>=1e9)return"$"+(n/1e9).toFixed(a<1e10?1:0)+"B";
  if(a>=1e6)return"$"+(n/1e6).toFixed(a<1e7?1:0)+"M";if(a>=1e3)return"$"+(n/1e3).toFixed(a<1e4?1:0)+"K";return"$"+n}

/* ---------- color helpers ---------- */
const _c={};function rgb(h){return _c[h]||(_c[h]=[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)])}
function mix(a,b,t){const A=rgb(a),B=rgb(b);return"#"+[0,1,2].map(i=>Math.round(A[i]+(B[i]-A[i])*t).toString(16).padStart(2,"0")).join("")}
function shade(h,amt){const A=rgb(h);return"#"+A.map(v=>Math.max(0,Math.min(255,v+amt)).toString(16).padStart(2,"0")).join("")}
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));

/* ---------- themes ---------- */
const THEMES={
  city:  {night:["#0e0f26","#15163a","#1d1c4a","#28245a","#352c66"],day:["#4f8fe0","#63a0e8","#7ab2ee","#93c4f2","#b2d6f5"],ground:"#2b2b33",walk:"#4a4a56",city:"#0f0f24",cityDay:"#5a6f9a",cars:3,stars:1},
  harbor:{night:["#0c1a34","#102444","#163056","#1e3d6a","#284e80"],day:["#3f86d6","#56a0e4","#6fb6ec","#8ccaf2","#aedcf6"],ground:"#1f4f8a",walk:"#6b4a32",city:"#0c1a30",cityDay:"#4f7aa8",water:1,stars:1},
  tech:  {night:["#0b1d28","#102a36","#163843","#1c4750","#24575d"],day:["#4fa0c8","#62b2d0","#79c2d4","#94d2d8","#b6e2dc"],ground:"#2f6b3a",walk:"#7a8a7a",city:"#0b1c22",cityDay:"#4e8a8a",trees:1,cars:2,stars:1},
  mall:  {night:["#1f1630","#2b1d3c","#3a2448","#4a2c54","#5e3660"],day:["#7a8fe0","#8f9fe6","#a8b2ea","#c2c6ee","#ddd8f0"],ground:"#3a3a40",walk:"#6a6a72",city:"#1b1226",cityDay:"#7d7aa8",cars:5,stars:0},
  neon:  {night:["#08040f","#100820","#180b2e","#200e3a","#2a1046"],day:["#3a2a6a","#4a3478","#5c3e86","#6e4a94","#8458a2"],ground:"#18121e",walk:"#2c2236",city:"#06040c",cityDay:"#2a1e44",neon:1,cars:3,stars:1},
  desert:{night:["#1a1030","#2a1638","#3a1c40","#4c2444","#5e2c44"],day:["#5aa8e8","#74b8ec","#92c8ef","#b4d8ee","#f2e0b0"],ground:"#d9a85b",walk:"#c4924a",city:"#a8604a",cityDay:"#c48a62",cactus:1,cars:1,stars:1},
  sky:   {night:["#0c1a3a","#12244a","#1a305a","#223c6a","#2c4a7a"],day:["#3b7dd8","#4a8ae0","#5c9ae8","#73adf0","#8fc2f7"],ground:"#f2ecd8",walk:"#ffffff",city:null,clouds:1,stars:1},
  moon:  {night:["#000000","#04040a","#08081a","#0c0c22","#12122a"],day:["#000000","#04040a","#08081a","#0c0c22","#12122a"],ground:"#77778a",walk:"#8d8da0",city:null,earth:1,craters:1,cars:1,rover:1,suits:1,stars:2},
  mars:  {night:["#1a0806","#2a0f0a","#3e1810","#542216","#6a2c1c"],day:["#b56a3a","#c47a44","#d28c52","#dca068","#e6b680"],ground:"#a8462a",walk:"#bf5a38",city:null,craters:1,cars:1,rover:1,suits:1,stars:1},
};

const W=180,FH=24,GROUND=26,LOBBY=14,ROOF=56,TX=34,TW=110;
const RX0=TX+2,ROOM=98,RX1=RX0+ROOM,SHAFT=RX1+2;
const SHIRTS=["#ffcc3d","#5ad1ff","#ff7ad9","#5ee08a","#ff9b4a","#f2ecd8","#b78cff","#ff5d6c"];
const ADWORDS=["SALE","NEW!","WOW","HOT","OPEN","YUM"];
const px=x=>RX0+x*ROOM;

class TowerView{
  constructor(canvas,getS,getLot,opts={}){
    this.cv=canvas;this.cx=canvas.getContext("2d");this.getS=getS;this.getLot=getLot;this.getRT=opts.getRT||(()=>null);
    this.minH=opts.minH||220;this.getTime=opts.getTime||(()=>{const d=new Date();return(d.getHours()*60+d.getMinutes())/1440});
    this.showEarnings=opts.showEarnings??true;this.sel=opts.sel??-1;this.tick=0;this.parts=[];this.floats=[];this.cons={};this.flash={};
    this.rain=false;this.elev={y:0,target:0,wait:0};this.lastLot=null;this.idle=opts.idle||false;
    this.cv.width=W;this.rebuild();this.loop=this.loop.bind(this);requestAnimationFrame(this.loop)}
  S(){return this.getS()}
  floors(){return this.S().lots[this.getLot()]?.floors||[]}
  height(){return Math.max(this.minH,GROUND+LOBBY+this.floors().length*FH+ROOF)}
  floorY(i){return this.cv.height-GROUND-LOBBY-(i+1)*FH}
  hit(clientY){const r=this.cv.getBoundingClientRect(),y=(clientY-r.top)*this.cv.height/r.height;const i=Math.floor((this.cv.height-GROUND-LOBBY-y)/FH);return i>=0&&i<this.floors().length?i:-1}
  rebuild(){const S=this.S(),lot=this.getLot(),th=THEMES[T.lotDef(lot).theme];
    if(lot!==this.lastLot){this.cons={};this.flash={};this.parts=[];this.floats=[];this.lastLot=lot;this.elev={y:0,target:0,wait:0}}
    const n=Math.min(16,3+Math.floor(Math.sqrt(S.rep)/3));
    this.peds=Array.from({length:n},()=>({x:Math.random()*W,v:(.2+Math.random()*.3)*(Math.random()<.5?-1:1),shirt:th.suits?"#f2ecd8":T.pick(SHIRTS),skin:T.pick(["#f2d1b0","#c68c5e","#7a4a30","#e0b48c"]),hair:T.pick(["#2a1a10","#c98a3a","#1a1a1a"]),lane:Math.random()<.5?0:2}));
    this.cars=Array.from({length:th.cars||0},(_,k)=>({x:Math.random()*W,v:(.5+Math.random()*.5)*(k%2?-1:1),c:th.rover?"#d8d8e0":T.pick(["#ff5d6c","#5ad1ff","#5ee08a","#ffcc3d","#f2ecd8","#b78cff"])}))}
  construct(i){this.cons[i]=70}
  celebrate(i){this.flash[i]=24;const y=this.floorY(i)+FH/2;for(let k=0;k<14;k++)this.parts.push({x:RX0+Math.random()*ROOM,y,vx:(Math.random()-.5)*1.4,vy:-Math.random()*1.6-.3,life:50,kind:"spark",c:T.pick(["#ffcc3d","#f2ecd8","#ff7ad9","#5ad1ff"])})}
  coin(x,y,big){this.parts.push({x,y,vx:(Math.random()-.5)*(big?1.6:.3),vy:-(big?1.3+Math.random()*1.3:.5),life:big?60:30,kind:"coin"})}
  floatText(i,t,c){const y=i<0?this.cv.height-GROUND-LOBBY:this.floorY(i)+4;this.floats.push({x:i<0?TX:SHAFT-textW(t),y,t,c,life:90})}
  collected(i,amt){const y=this.floorY(i)+FH/2,x=px(T.GEO.reg)+3;const n=Math.min(14,3+Math.floor(Math.log10(amt+1)*2));for(let k=0;k<n;k++)this.coin(x,y,true);this.floatText(i,"+"+short(amt),"#ffcc3d")}
  loop(){try{this.draw()}catch(e){console.error(e)}requestAnimationFrame(this.loop)}

  person(x,y,shirt,skin,hair,walking,pose){const cx=this.cx,t=this.tick;x=Math.round(x);
    // 3px wide, 8px tall: hair, face, shirt, legs. y is the floor line.
    cx.fillStyle=skin;cx.fillRect(x,y-7,3,2);if(hair){cx.fillStyle=hair;cx.fillRect(x,y-8,3,1);cx.fillRect(x,y-7,1,1)}
    cx.fillStyle=shirt;cx.fillRect(x,y-5,3,3);
    if(pose==="cheer"){cx.fillStyle=skin;cx.fillRect(x-1,y-8,1,2);cx.fillRect(x+3,y-8,1,2)}
    cx.fillStyle="#22223a";if(pose==="sit"){cx.fillRect(x,y-2,4,1)}else if(walking){const s=(t>>3)%2;cx.fillRect(x+s,y-2,1,2);cx.fillRect(x+2-s,y-2,1,1)}else{cx.fillRect(x,y-2,1,2);cx.fillRect(x+2,y-2,1,2)}}
  heart(x,y){const cx=this.cx;cx.fillStyle="#ff7ad9";cx.fillRect(x,y,1,1);cx.fillRect(x+2,y,1,1);cx.fillRect(x,y+1,3,1);cx.fillRect(x+1,y+2,1,1)}

  draw(){
    const S=this.S(),cv=this.cv,cx=this.cx,fl=this.floors(),id=this.getLot(),lot=T.lotDef(id),th=THEMES[lot.theme],rt=this.getRT();
    if(cv.height!==this.height())cv.height=this.height();
    const H=cv.height,t=++this.tick,GY=H-GROUND,LY=GY-LOBBY;
    const tod=((this.getTime()%1)+1)%1,sunH=Math.sin((tod-.25)*Math.PI*2);
    if(t%3600===1)this.rain=Math.random()<.15;
    let light=clamp((sunH+.15)/.75);if(this.rain)light*=.7;const warm=clamp(1-Math.abs(sunH)/.35)*(th.earth?0:1);
    const bands=th.night.length,bh=Math.ceil(LY/bands)+1;
    for(let i=0;i<bands;i++){let c=mix(th.night[i],th.day[i],light);if(warm)c=mix(c,"#ff8a4a",warm*.45*(i+1)/bands);cx.fillStyle=c;cx.fillRect(0,i*bh,W,bh)}
    if(th.stars&&light<.7){cx.globalAlpha=1-light/.7;cx.fillStyle="#f2ecd8";const n=th.stars===2?56:30;for(let i=0;i<n;i++){const x=(i*37+11)%W,y=(i*53+7)%(H*.55);if(((t>>4)+i*7)%11>1)cx.fillRect(x,y,1,1)}cx.globalAlpha=1}
    const arc=(p,size,col,inner)=>{const x=8+p*(W-16),y=H*.42-Math.sin(p*Math.PI)*H*.34;cx.fillStyle=col;cx.fillRect(x-size/2+1,y-size/2,size-2,size);cx.fillRect(x-size/2,y-size/2+1,size,size-2);if(inner){cx.fillStyle=inner;cx.fillRect(x-size/2+2,y-size/2+2,size-4,size-4)}};
    if(sunH>-.08&&!th.earth)arc(clamp((tod-.2)/.6),10,warm>.3?"#ffb35a":"#ffe08a","#fff1c0");
    const mt=(tod+.5)%1,mH=Math.sin((mt-.25)*Math.PI*2);if(mH>-.08&&!th.earth)arc(clamp((mt-.2)/.6),8,"#f2ecd8","#e2dcc6");
    if(th.earth){cx.fillStyle="#3a7bd5";cx.fillRect(150,16,16,16);cx.fillStyle="#5ee08a";cx.fillRect(153,19,6,5);cx.fillRect(159,25,5,4);cx.fillStyle="#fff";cx.fillRect(155,16,7,1)}
    if(!th.earth&&lot.theme!=="neon"){cx.fillStyle=mix("#3a3a5a","#ffffff",light);cx.globalAlpha=th.clouds?.95:.55;
      for(let i=0;i<(th.clouds?7:4);i++){const x=((i*47+t/(10+i*3))%(W+40))-30,y=14+(i*29)%(H*.35);cx.fillRect(x,y,20,4);cx.fillRect(x+5,y-3,10,3);cx.fillRect(x+2,y+4,14,2)}cx.globalAlpha=1}
    if(S.rep>120&&light<.45&&!th.earth){cx.globalAlpha=.12*(1-light/.45);cx.fillStyle="#fff1c0";
      for(const[bx,ph]of[[16,0],[W-16,2]]){const a=Math.sin(t/90+ph)*.5-Math.PI/2;cx.beginPath();cx.moveTo(bx,GY);cx.lineTo(bx+Math.cos(a-.06)*H,GY+Math.sin(a-.06)*H);cx.lineTo(bx+Math.cos(a+.06)*H,GY+Math.sin(a+.06)*H);cx.closePath();cx.fill()}cx.globalAlpha=1}
    if(th.city){const bc=mix(th.city,th.cityDay,light);
      [[0,46,10],[9,72,9],[18,34,10],[148,58,10],[157,84,9],[165,40,8],[172,64,9]].forEach(([x,h,w],k)=>{cx.fillStyle=bc;cx.fillRect(x,GY-h,w,h);
        if(light<.6){cx.fillStyle=k%2?"#ffcc3d":"#5ad1ff";cx.globalAlpha=.7*(1-light/.6);for(let yy=GY-h+4;yy<GY-4;yy+=6)for(let xx=x+2;xx<x+w-2;xx+=4)if(((xx*7+yy*3+k)%9)<3)cx.fillRect(xx,yy,1,2);cx.globalAlpha=1}})}
    if(th.neon)[[3,GY-56,"#ff7ad9","BAR"],[150,GY-70,"#5ad1ff","24H"],[158,GY-40,"#ffcc3d","EAT"]].forEach(([x,y,c,w],i)=>{const on=((t>>4)+i)%5!==0;cx.fillStyle="#000";cx.fillRect(x-1,y-1,textW(w)+3,8);text(cx,w,x,y,on?c:"#3a2a4a",false)});
    if(th.trees)[3,13,150,162,172].forEach((x,k)=>{const sw=Math.round(Math.sin(t/40+k));cx.fillStyle="#5d4037";cx.fillRect(x+2,GY-6,2,6);cx.fillStyle=mix("#1f4a2a","#4fa35a",light);cx.fillRect(x+sw,GY-14,7,8);cx.fillRect(x+1+sw,GY-16,5,2)});
    if(th.cactus)[6,160].forEach(x=>{cx.fillStyle="#4f8a3a";cx.fillRect(x+2,GY-14,3,14);cx.fillRect(x,GY-10,2,4);cx.fillRect(x+5,GY-12,2,5)});
    cx.fillStyle=mix(shade(th.ground,-30),th.ground,light);cx.fillRect(0,GY,W,GROUND);
    if(th.water){cx.fillStyle=mix("#0e2a4a","#2e6aa8",light);cx.fillRect(0,GY+6,W,GROUND-6);cx.fillStyle="#7fc4ff";for(let x=((t>>2)%12)-12;x<W;x+=12)cx.fillRect(x,GY+12+((x>>2)%2)*5,5,1);
      cx.fillStyle=mix("#3a281c","#6b4a32",light);cx.fillRect(0,GY,W,6);cx.fillStyle="#3a281c";for(let x=4;x<W;x+=14)cx.fillRect(x,GY+6,2,6);
      const bx=(t/3)%(W+40)-30;cx.fillStyle="#f2ecd8";cx.fillRect(bx,GY+15,16,4);cx.fillStyle="#ff5d6c";cx.fillRect(bx+2,GY+19,12,1);cx.fillStyle="#9a95c2";cx.fillRect(bx+6,GY+7,2,8);cx.fillStyle="#f2ecd8";cx.fillRect(bx+8,GY+8,5,6)}
    else if(th.clouds){cx.fillStyle="#ffffff";cx.fillRect(0,GY+4,W,GROUND-4);for(let x=0;x<W;x+=10)cx.fillRect(x,GY+((x/10)%2)*2,12,6)}
    else{cx.fillStyle=mix(shade(th.walk,-30),th.walk,light);cx.fillRect(0,GY,W,5);cx.fillStyle=shade(th.walk,-50);for(let x=0;x<W;x+=8)cx.fillRect(x,GY+4,1,1);
      if(!th.craters){cx.fillStyle="#ffcc3d";for(let x=0;x<W;x+=12)cx.fillRect(x,GY+15,6,1)}
      else{cx.fillStyle=shade(th.ground,-35);[[8,GY+12],[60,GY+18],[110,GY+10],[160,GY+20]].forEach(([x,y])=>{cx.fillRect(x,y,9,2);cx.fillRect(x+2,y-1,5,1)})}}
    for(const c of this.cars){c.x+=c.v;if(c.x>W+16)c.x=-16;if(c.x<-16)c.x=W+16;const y=c.v>0?GY+16:GY+10,x=Math.round(c.x);
      if(c.c==="#d8d8e0"){cx.fillStyle=c.c;cx.fillRect(x,y-4,10,3);cx.fillStyle="#555";cx.fillRect(x+1,y-1,2,2);cx.fillRect(x+7,y-1,2,2);cx.fillStyle="#9a95c2";cx.fillRect(x+4,y-7,1,3);continue}
      cx.fillStyle=c.c;cx.fillRect(x,y-4,12,3);cx.fillRect(x+3,y-6,6,2);cx.fillStyle=mix("#141428","#9ad8ff",light);cx.fillRect(x+4,y-6,4,1);cx.fillStyle="#141428";cx.fillRect(x+2,y-1,2,2);cx.fillRect(x+8,y-1,2,2);
      if(light<.5){cx.fillStyle="#fff1c0";const fx=c.v>0?x+12:x-1;cx.fillRect(fx,y-3,1,1);cx.globalAlpha=.18;cx.fillRect(c.v>0?fx+1:fx-10,y-4,10,3);cx.globalAlpha=1}}
    const door=TX+TW/2;
    for(const p of this.peds){p.x+=p.v;if(p.x>W+4)p.x=-4;if(p.x<-4)p.x=W+4;if(Math.abs(p.x-door)<.4&&Math.random()<.4){p.x=p.v>0?-4:W+4;this.enter=8}this.person(p.x,GY+2+p.lane,p.shirt,p.skin,p.hair,true)}
    // tower body + lobby
    const top=fl.length?this.floorY(fl.length-1):LY;
    cx.fillStyle="#3d3a6e";cx.fillRect(TX-3,top-2,TW+6,LY-top+LOBBY+2);
    cx.fillStyle=mix("#2a2750","#8a85b8",light*.6);cx.fillRect(TX,LY+2,TW,LOBBY-2);
    cx.fillStyle=mix("#1c3550","#9ad8ff",light);for(let x=TX+4;x<TX+TW-4;x+=10)if(Math.abs(x+3-door)>8)cx.fillRect(x,LY+4,6,7);
    const open=this.enter>0;if(this.enter>0)this.enter-=.2;
    cx.fillStyle="#ffcc3d";cx.fillRect(door-7,LY+2,14,2);cx.fillStyle=open?"#fff1c0":mix("#1c3550","#9ad8ff",light);cx.fillRect(door-5,LY+4,open?2:4,LOBBY-4);cx.fillRect(door+(open?3:1),LY+4,open?2:4,LOBBY-4);
    cx.fillStyle="#4fa35a";cx.fillRect(TX+2,LY+7,3,5);cx.fillRect(TX+TW-5,LY+7,3,5);
    // elevator
    const shaftTop=top+2;cx.fillStyle="#1a1830";cx.fillRect(SHAFT,shaftTop,8,LY-shaftTop);cx.fillStyle="#3d3a6e";cx.fillRect(SHAFT+3,shaftTop,1,LY-shaftTop);
    const E=this.elev;if(E.wait>0)E.wait--;else{const d=E.target-E.y;if(Math.abs(d)<.5){E.y=E.target;E.wait=40+Math.random()*60|0;E.target=Math.floor(Math.random()*Math.max(1,fl.length+1))}else E.y+=Math.sign(d)*Math.min(Math.abs(d),.08)}
    const carY=Math.min(LY+1,Math.max(shaftTop+FH-4,LY-E.y*FH));cx.fillStyle="#ffcc3d";cx.fillRect(SHAFT+1,carY-FH+4,6,FH-5);cx.fillStyle=E.wait>0?"#fff1c0":"#c99a20";cx.fillRect(SHAFT+2,carY-FH+6,4,5);
    // floors
    fl.forEach((f,i)=>{try{this.drawFloor(f,i,light,S,id,rt)}catch(e){console.error(e)}});
    // construction
    for(const k in this.cons){const i=+k;if(i>=fl.length){delete this.cons[k];continue}const y=this.floorY(i),left=this.cons[k]--;
      cx.fillStyle="rgba(20,20,40,.55)";cx.fillRect(RX0,y+2,ROOM,FH-3);cx.fillStyle="#ff9b4a";
      for(let x=RX0-((t>>1)%8);x<RX1;x+=8)for(let d=0;d<FH-3;d++){const p=x+d;if(p>=RX0&&p<RX1)cx.fillRect(p,y+2+d,1,1)}
      if(t%3===0)this.parts.push({x:RX0+Math.random()*ROOM,y:y+4+Math.random()*12,vx:Math.random()-.5,vy:-Math.random(),life:14,kind:"spark",c:T.pick(["#ffcc3d","#fff1c0","#ff9b4a"])});
      text(cx,"BUILDING",RX0+ROOM/2-15,y+7,"#ffcc3d");if(left<=1){delete this.cons[k];this.celebrate(i)}}
    this.drawRoof(top,light);
    // marketing billboards outside
    fl.forEach((f,i)=>{if(f.type!=="marketing")return;const y=this.floorY(i),w=ADWORDS[((t>>6)+i)%ADWORDS.length],bg=["#ff7ad9","#ffcc3d","#5ad1ff"][((t>>6)+i)%3];
      cx.fillStyle="#55507f";cx.fillRect(TX-8,y+12,5,1);cx.fillStyle="#000";cx.fillRect(TX-33,y+2,26,13);cx.fillStyle=bg;cx.fillRect(TX-32,y+3,24,11);text(cx,w,TX-32+12-textW(w)/2,y+6,"#141428",false)});
    // labels on the right
    if(this.showEarnings)fl.forEach((f,i)=>{if(!f.type)return;const y=this.floorY(i);
      if(T.isBiz(f.type)){const r=rt&&rt.f[id+":"+i];const pm=r?r.earn.reduce((a,e)=>a+e[1],0):T.estPerMin(S,id,i,f);
        const l1=short(pm)+"/M",l2="*"+f.rating.toFixed(1);cx.fillStyle="rgba(10,10,24,.75)";cx.fillRect(TX+TW+3,y+2,Math.max(textW(l1),textW(l2))+3,15);
        text(cx,l1,TX+TW+4,y+3,"#ffcc3d",false);text(cx,l2,TX+TW+4,y+10,f.rating>=4?"#5ee08a":f.rating>=2.8?"#f2ecd8":"#ff5d6c",false)}
      else{const l={lounge:"REST",marketing:"ADS",training:"CLASS",office:"HR",trade:"STOCK"}[f.type]+" L"+f.lvl;cx.fillStyle="rgba(10,10,24,.75)";cx.fillRect(TX+TW+3,y+5,textW(l)+3,8);text(cx,l,TX+TW+4,y+6,"#5ad1ff",false)}});
    if(this.rain&&!th.earth){cx.fillStyle="rgba(170,210,255,.55)";for(let i=0;i<80;i++){const x=(i*29+t*1.3)%W,y=(i*47+t*4)%H;cx.fillRect(x,y,1,3)}}
    this.parts=this.parts.filter(p=>p.life-->0);
    for(const p of this.parts){p.x+=p.vx;p.y+=p.vy;if(p.kind==="coin"){p.vy+=.035;const s=(t>>2)%4;cx.fillStyle="#b8860b";cx.fillRect(p.x|0,p.y|0,3,3);cx.fillStyle="#ffcc3d";cx.fillRect(p.x|0,p.y|0,s===2?1:2,3);if(s===0){cx.fillStyle="#fff1c0";cx.fillRect((p.x|0)+1,p.y|0,1,1)}}else{cx.fillStyle=p.c;cx.fillRect(p.x|0,p.y|0,1,1)}}
    this.floats=this.floats.filter(f=>f.life-->0);
    for(const f of this.floats){f.y-=.25;cx.globalAlpha=Math.min(1,f.life/30);text(cx,f.t,Math.max(1,Math.min(W-textW(f.t)-1,f.x)),f.y|0,f.c);cx.globalAlpha=1}
  }

  drawFloor(f,i,light,S,lot,rt){
    const cx=this.cx,t=this.tick,y=this.floorY(i),fy=y+FH-2;
    const base=f.type?T.KINDS[f.type].color:"#3d3a6e";
    cx.fillStyle="#55507f";cx.fillRect(TX-1,y,TW+2,2);
    const deco=T.isBiz(f.type)?f.decor:0;
    const wall=f.type?mix(shade(base,-150),shade(base,-80),.2+light*.45+deco*.03):"#15142a";
    cx.fillStyle=wall;cx.fillRect(RX0,y+2,ROOM,FH-2);
    cx.fillStyle=deco>=4?mix(shade(base,-60),"#6b2a3a",.5):shade(wall,-25);cx.fillRect(RX0,fy,ROOM,2);
    if(!f.type){cx.fillStyle="#232142";for(let x=RX0+2;x<RX1;x+=6)cx.fillRect(x,y+4+((x/6|0)%2)*8,3,1);text(cx,"+ BUILD",RX0+ROOM/2-13,y+8,(t>>5)%2?"#ffcc3d":"#9a95c2");this.trim(i,y,light);return}
    if(T.isBiz(f.type))this.drawBiz(f,i,y,fy,light,S,lot,rt);else this.drawSupport(f,i,y,fy,light,S,lot);
    this.trim(i,y,light);
  }
  trim(i,y,light){const cx=this.cx,t=this.tick;
    cx.fillStyle="#55507f";cx.fillRect(TX-1,y+2,3,FH-2);cx.fillRect(RX1,y+2,2,FH-2);
    if(light<.55){cx.globalAlpha=.08*(1-light/.55);cx.fillStyle="#ffcc3d";cx.fillRect(RX0,y+2,ROOM,FH-2);cx.globalAlpha=1}
    if(this.flash[i]>0){cx.globalAlpha=this.flash[i]/24*.6;cx.fillStyle="#fff1c0";cx.fillRect(RX0,y+2,ROOM,FH-2);cx.globalAlpha=1;this.flash[i]--}
    if(i===this.sel){cx.strokeStyle=(t>>4)%2?"#ffcc3d":"#fff1c0";cx.lineWidth=1;cx.strokeRect(TX-1.5,y+.5,TW+3,FH)}}

  drawBiz(f,i,y,fy,light,S,lot,rt){
    const cx=this.cx,t=this.tick,B=T.BIZ[f.type],r=rt?T.frt(rt,lot,i,f):null,d=f.decor;
    // decor on the back wall
    if(d>=1){cx.fillStyle=shade(B.color,-40);cx.fillRect(RX0,y+2,ROOM,1)}
    if(d>=2)for(let k=0;k<Math.min(f.stations,6);k++){const x=px(T.GEO.st(k))+2;cx.fillStyle="#6b4a32";cx.fillRect(x,y+4,5,4);cx.fillStyle=SHIRTS[(k+i+d)%SHIRTS.length];cx.fillRect(x+1,y+5,3,2)}
    if(d>=3)for(let k=0;k<f.stations;k++){const x=px(T.GEO.st(k))+4;cx.fillStyle="#9a95c2";cx.fillRect(x,y+2,1,2);cx.fillStyle=light<.5?"#fff1c0":"#e8e0c8";cx.fillRect(x-1,y+4,3,1);
      if(light<.5){cx.globalAlpha=.15;cx.fillStyle="#fff1c0";cx.fillRect(x-3,y+5,7,10);cx.globalAlpha=1}}
    if(d>=5){const nm=B.name.split(" ")[0].toUpperCase().slice(0,6),nx=px(T.GEO.q0)+1;cx.fillStyle="#000";cx.fillRect(nx-1,y+3,textW(nm)+2,7);text(cx,nm,nx,y+4,(t>>5)%6?B.color:shade(B.color,-60),false)}
    if(d>=7){cx.fillStyle="#ffcc3d";cx.fillRect(RX0+ROOM/2-3,y+2,7,1);cx.fillRect(RX0+ROOM/2-2,y+3,5,1);if((t>>3)%4===0){cx.fillStyle="#fff1c0";cx.fillRect(RX0+ROOM/2,y+4,1,1)}}
    if(d>=2){cx.fillStyle="#4fa35a";cx.fillRect(RX1-4,fy-6,3,4);cx.fillStyle="#8a5a3a";cx.fillRect(RX1-3,fy-2,2,2)}
    if(d>=10){const p=(Math.sin(t/15+i)+1)/2;cx.fillStyle=mix("#b8860b","#fff1c0",p);cx.fillRect(RX0,y+FH-1,ROOM,1)}
    // stations
    for(let k=0;k<f.stations;k++){const sx=Math.round(px(T.GEO.st(k))),e=T.emp(S,f.staff[k]),here=e&&T.present(S,lot,i,f,k),st=r&&r.st[k];
      this.station(f.type,sx+3,fy,k,st,here);
      if(here){const tired=e.energy<25;this.person(sx,fy,"#f2ecd8",e.skin,B.color,false);cx.fillStyle=shade(B.color,-60);cx.fillRect(sx,fy-4,3,1);
        if(tired&&(t>>4)%3===0){text(cx,"Z",sx,y+3+((t>>3)%3),"#9ad8ff",false)}
        if(e.mood<30&&(t>>5)%2){cx.fillStyle="#ff5d6c";cx.fillRect(sx+1,fy-11,1,2)}}
      if(st&&st.c&&here){cx.fillStyle="#141428";cx.fillRect(sx,y+2,9,2);cx.fillStyle="#5ee08a";cx.fillRect(sx,y+2,Math.round(9*Math.min(1,st.prog)),2)}
      if(!e){if((t>>4)%2)text(cx,"?",sx,y+8,"#ff5d6c",false)}
      else if(!here){text(cx,e.state==="break"?"BRK":e.state==="train"?"TRN":"",sx-1,y+5,"#9ad8ff",false)}}
    // register
    const rx=Math.round(px(T.GEO.reg)),cap=T.registerCap(S,lot,f),fill=clamp(f.register/cap);
    cx.fillStyle="#3d3a6e";cx.fillRect(rx-1,fy-13,9,13);cx.fillStyle="#141428";cx.fillRect(rx,fy-12,7,11);
    if(fill>0){const h=Math.max(1,Math.round(fill*10));cx.fillStyle="#b8860b";cx.fillRect(rx+1,fy-1-h,5,h);cx.fillStyle="#ffcc3d";cx.fillRect(rx+1,fy-1-h,5,1);if((t>>3)%5===0){cx.fillStyle="#fff1c0";cx.fillRect(rx+2,fy-1-h,1,1)}}
    if(fill>=.999){if((t>>4)%2)text(cx,"FULL",rx-4,y+2,"#ff5d6c")}
    else if(fill>.25&&!f.manager){text(cx,"$",rx+2,y+2+((t>>4)%2),fill>.7?"#ff9b4a":"#ffcc3d")}
    const m=T.emp(S,f.manager);
    if(m&&m.state==="manage"){this.person(rx-4,fy,"#22223a",m.skin,m.hair,false);cx.fillStyle="#ff5d6c";cx.fillRect(rx-3,fy-5,1,2)}
    if(f.buff&&f.buff.until>Date.now()){cx.fillStyle=(t>>3)%2?"#ffcc3d":"#ff7ad9";cx.fillRect(RX0,y+2,2,FH-3)}
    // customers
    if(r)for(const c of r.cust){const x=px(c.x);if(x>RX1+1)continue;
      const pose=c.s==="at"&&f.type==="spa"?"sit":undefined;this.person(x,fy-(c.s==="at"&&f.type==="dining"?0:0),c.look[2],c.look[0],c.look[1],c.s!=="at"&&c.s!=="q",pose);
      if(c.vip){cx.fillStyle="#ffcc3d";cx.fillRect(Math.round(x),fy-10,3,1);cx.fillRect(Math.round(x),fy-11,1,1);cx.fillRect(Math.round(x)+2,fy-11,1,1)}
      if((c.s==="q"||c.s==="in")&&c.w/c.pat>.55){cx.fillStyle=c.w/c.pat>.8?"#ff5d6c":"#ffcc3d";if(c.w/c.pat<.8||(t>>3)%2)cx.fillRect(Math.round(x)+1,fy-11,1,1)}
      if(c.bub&&c.bt!==undefined&&c.bt<1.6){const bx=Math.round(x),by=fy-15-Math.round(c.bt*2);
        if(c.bub==="<3")this.heart(bx,by);else text(cx,c.bub,bx,by,c.bub==="!"?"#ff5d6c":"#ffcc3d",false)}}
  }
  station(type,x,fy,k,st,here){const cx=this.cx,t=this.tick,busy=st&&st.c;
    if(type==="cafe"){cx.fillStyle="#b07a48";cx.fillRect(x,fy-5,9,5);cx.fillStyle="#e0b070";cx.fillRect(x,fy-5,9,1);cx.fillStyle="#9a9aa8";cx.fillRect(x+5,fy-9,3,4);cx.fillStyle="#22223a";cx.fillRect(x+6,fy-8,1,1);
      if(busy&&(t>>3)%2){cx.fillStyle="rgba(242,236,216,.7)";cx.fillRect(x+6,fy-11-((t>>3)%2),1,2)}}
    else if(type==="burger"){cx.fillStyle="#8a8a96";cx.fillRect(x,fy-5,9,5);cx.fillStyle="#2a2a30";cx.fillRect(x+4,fy-6,5,1);
      if(busy){cx.fillStyle=(t>>2)%2?"#ff9b4a":"#ffcc3d";cx.fillRect(x+5,fy-7,3,1);cx.fillStyle="#8a4a20";cx.fillRect(x+5,fy-8,3,1)}}
    else if(type==="boutique"){cx.fillStyle="#cfcfe0";cx.fillRect(x,fy-6,9,1);cx.fillRect(x,fy-6,1,6);cx.fillRect(x+8,fy-6,1,6);
      for(let j=0;j<3;j++){cx.fillStyle=SHIRTS[(k*3+j)%SHIRTS.length];cx.fillRect(x+2+j*2,fy-5,1,4)}}
    else if(type==="arcade"){cx.fillStyle="#3a2a6a";cx.fillRect(x+4,fy-13,5,13);cx.fillStyle=busy?SHIRTS[((t>>3)+k)%SHIRTS.length]:"#141428";cx.fillRect(x+5,fy-11,3,3);cx.fillStyle="#ffcc3d";cx.fillRect(x+5,fy-6,1,1);cx.fillRect(x+7,fy-6,1,1)}
    else if(type==="spa"){cx.fillStyle="#f2ecd8";cx.fillRect(x+3,fy-4,7,2);cx.fillStyle="#9a95c2";cx.fillRect(x+3,fy-2,1,2);cx.fillRect(x+9,fy-2,1,2);
      if(busy&&(t>>4)%2){cx.fillStyle="rgba(242,236,216,.5)";cx.fillRect(x+5,fy-9,1,2);cx.fillRect(x+7,fy-10,1,2)}}
    else if(type==="dining"){cx.fillStyle="#f2ecd8";cx.fillRect(x+3,fy-5,7,1);cx.fillRect(x+4,fy-4,5,1);cx.fillStyle="#9a95c2";cx.fillRect(x+6,fy-4,1,4);
      cx.fillStyle="#ffcc3d";cx.fillRect(x+6,fy-7,1,2);if((t>>3)%2){cx.fillStyle="#fff1c0";cx.fillRect(x+6,fy-8,1,1)}}}
  drawSupport(f,i,y,fy,light,S,lot){
    const cx=this.cx,t=this.tick,who=S.emps.filter(e=>e.at&&e.at.lot===lot&&e.at.i===i);
    if(f.type==="lounge"){const seats=2*f.lvl;for(let k=0;k<Math.min(seats,10);k++){const x=RX0+4+k*8;cx.fillStyle="#b78cff";cx.fillRect(x,fy-4,7,3);cx.fillRect(x,fy-7,1,3);cx.fillStyle=shade("#b78cff",-60);cx.fillRect(x,fy-1,7,1)}
      who.forEach((e,k)=>{const x=RX0+6+k*8;this.person(x,fy-2,"#9a95c2",e.skin,e.hair,false,"sit");if((t>>4)%3===k%3)text(cx,"Z",x+2,y+2+((t>>3)%3),"#9ad8ff",false)});
      cx.fillStyle="#9a95c2";cx.fillRect(RX1-12,fy-8,5,8);if((t>>4)%2){cx.fillStyle="rgba(242,236,216,.6)";cx.fillRect(RX1-10,fy-11-((t>>3)%3),1,2)}
      cx.fillStyle="#3a2a6a";cx.fillRect(RX1-22,fy-13,7,13);cx.fillStyle=SHIRTS[(t>>3)%SHIRTS.length];cx.fillRect(RX1-21,fy-11,5,4)}
    if(f.type==="training"){cx.fillStyle="#f2ecd8";cx.fillRect(RX0+4,y+4,22,9);cx.fillStyle="#5ad1ff";cx.fillRect(RX0+6,y+6,10,1);cx.fillStyle="#ff5d6c";cx.fillRect(RX0+6,y+8,14,1);cx.fillStyle="#5ee08a";cx.fillRect(RX0+6,y+10,7,1);
      for(let k=0;k<2*f.lvl&&k<8;k++){const x=RX0+32+k*8;cx.fillStyle="#6b5a4a";cx.fillRect(x,fy-4,6,1);cx.fillRect(x+1,fy-3,1,3)}
      who.forEach((e,k)=>{this.person(RX0+33+k*8,fy-1,"#9ad8ff",e.skin,e.hair,false,"sit");if((t>>4)%4===k%4){cx.fillStyle="#ffcc3d";cx.fillRect(RX0+34+k*8,y+3,1,1)}})}
    if(f.type==="marketing"){[["#ff7ad9",RX0+4],["#ffcc3d",RX0+14],["#5ad1ff",RX0+24]].forEach(([c,x])=>{cx.fillStyle=c;cx.fillRect(x,y+5,7,8);cx.fillStyle=shade(c,-80);cx.fillRect(x+1,y+7,5,1);cx.fillRect(x+1,y+10,3,1)});
      const sx=RX0+40,sc=["#ff7ad9","#5ad1ff","#ffcc3d","#5ee08a"][(t>>5)%4];cx.fillStyle="#22223a";cx.fillRect(sx,y+4,30,11);cx.fillStyle=sc;cx.fillRect(sx+1,y+5,28,9);text(cx,ADWORDS[(t>>5)%ADWORDS.length],sx+5,y+7,"#141428",false);
      this.person(RX0+76+Math.sin(t/40)*6,fy,"#ff5d6c","#e0b48c","#1a1a1a",true)}
    if(f.type==="office"){for(let k=0;k<Math.min(5,1+f.lvl);k++){const dx=RX0+6+k*18;cx.fillStyle="#6b5a4a";cx.fillRect(dx,fy-5,12,1);cx.fillRect(dx+1,fy-4,1,4);cx.fillRect(dx+10,fy-4,1,4);
      cx.fillStyle="#22223a";cx.fillRect(dx+5,fy-10,6,5);cx.fillStyle=((t>>4)+k)%7===0?"#f2ecd8":"#5ad1ff";cx.fillRect(dx+6,fy-9,4,3);this.person(dx+2,fy-1,"#e8e0c8","#c68c5e","#2a1a10",false,"sit")}}
    if(f.type==="trade"){cx.fillStyle="#05050c";cx.fillRect(RX0+1,y+3,ROOM-2,7);
      const s=S.stocks.map(k=>{const c=(k.p/k.hist[k.hist.length-2]-1)*100;return{w:`${k.t}${c>=0?"^":"~"}${Math.abs(c).toFixed(1)}`,c:c>=0?"#5ee08a":"#ff5d6c"}});
      const total=s.reduce((a,o)=>a+textW(o.w)+6,0);let x0=RX1-((t*.4)%total);cx.save();cx.beginPath();cx.rect(RX0+1,y+3,ROOM-2,7);cx.clip();
      for(let rep=0;rep<3;rep++){let x=x0-rep*total;for(const o of s){if(x<RX1&&x+textW(o.w)>RX0)text(cx,o.w,x|0,y+4,o.c,false);x+=textW(o.w)+6}}cx.restore();
      for(let k=0;k<4;k++){const mx=RX0+6+k*22;cx.fillStyle="#22223a";cx.fillRect(mx,fy-8,12,7);cx.fillStyle="#0a1a10";cx.fillRect(mx+1,fy-7,10,5);const st=S.stocks[(k+i)%6],h=st.hist.slice(-10),mn=Math.min(...h),mxv=Math.max(...h);
        cx.fillStyle=h[h.length-1]>=h[0]?"#5ee08a":"#ff5d6c";h.forEach((v,j)=>cx.fillRect(mx+1+j,fy-3-Math.round((v-mn)/((mxv-mn)||1)*4),1,1))}}
    {const lt="L"+f.lvl;cx.fillStyle="rgba(10,10,24,.75)";cx.fillRect(RX0,y+2,textW(lt)+2,7);text(cx,lt,RX0+1,y+3,"#c9c4ea",false)}
  }
  drawRoof(top,light){const cx=this.cx,t=this.tick,cxm=TX+TW/2;
    cx.fillStyle="#55507f";cx.fillRect(TX-4,top-4,TW+8,4);cx.fillStyle="#8a85b8";cx.fillRect(TX-4,top-4,TW+8,1);
    cx.fillStyle="#6b4a32";cx.fillRect(TX+6,top-16,10,8);cx.fillRect(TX+5,top-17,12,2);cx.fillStyle="#3a281c";cx.fillRect(TX+7,top-8,1,4);cx.fillRect(TX+14,top-8,1,4);
    const name="TYCOON",sw=textW(name)+6,sx=cxm-sw/2;cx.fillStyle="#22223a";cx.fillRect(sx+3,top-8,1,4);cx.fillRect(sx+sw-4,top-8,1,4);cx.fillStyle="#000";cx.fillRect(sx,top-17,sw,10);
    const col=["#ffcc3d","#ff7ad9","#5ad1ff","#5ee08a"][(t>>5)%4];text(cx,name,sx+3,top-15,col,false);
    if(light<.5){cx.globalAlpha=.2;cx.fillStyle=col;cx.fillRect(sx-3,top-20,sw+6,16);cx.globalAlpha=1}
    cx.fillStyle="#9a95c2";cx.fillRect(TX+TW-12,top-26,1,22);cx.fillRect(TX+TW-14,top-18,5,1);cx.fillStyle=(t>>5)%2?"#ff5d6c":"#5a1a20";cx.fillRect(TX+TW-12,top-27,1,1);
    if(Object.keys(this.cons).length){const a=Math.sin(t/30)*10;cx.fillStyle="#ffcc3d";cx.fillRect(TX+TW-28,top-34,2,30);cx.fillRect(TX+TW-50+a,top-34,40,2);
      cx.fillStyle="#9a95c2";const hx=(TX+TW-46+a)|0;cx.fillRect(hx,top-32,1,10+((t>>3)%4));cx.fillStyle="#ff9b4a";cx.fillRect(hx-2,top-22+((t>>3)%4),5,3)}}
}
G.TowerView=TowerView;G.TOWER_THEMES=Object.fromEntries(Object.entries(THEMES).map(([k,v])=>[k,{...v,sky:v.night,skyDay:v.day}]));G.pixelShort=short;G.pixelText=text;
})(globalThis);
