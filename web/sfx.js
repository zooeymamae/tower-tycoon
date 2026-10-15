/* Chiptune sound effects, synthesized with Web Audio. No audio files. */
(function(G){
let ac=null,enabled=true;
function ctx(){if(!ac){try{ac=new (G.AudioContext||G.webkitAudioContext)()}catch(e){return null}}if(ac.state==="suspended")ac.resume();return ac}
function tone(f,start,dur,type="square",vol=.08,slide=0){const a=ctx();if(!a)return;const o=a.createOscillator(),g=a.createGain(),t=a.currentTime+start;
  o.type=type;o.frequency.setValueAtTime(f,t);if(slide)o.frequency.linearRampToValueAtTime(f+slide,t+dur);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+dur+.02)}
function seq(notes,step=.07,type="square",vol=.07){notes.forEach((n,i)=>n&&tone(n,i*step,step*1.1,type,vol))}
const N={C4:262,E4:330,G4:392,A4:440,C5:523,D5:587,E5:659,G5:784,A5:880,C6:1047,E6:1319,G6:1568};
const SOUNDS={
  click:()=>tone(660,0,.04,"square",.04),
  coin:()=>{tone(N.E5*1.5,0,.06,"square",.06);tone(N.C6*1.25,.06,.14,"square",.06)},
  cash:()=>seq([N.C5,N.E5,N.G5,N.C6,N.E6,N.G6],.06,"square",.07),
  build:()=>{tone(120,0,.08,"square",.08,-40);tone(180,.09,.08,"square",.08,-40);tone(N.G5,.2,.1,"square",.05)},
  level:()=>seq([N.C5,N.E5,N.G5,N.C6],.08,"square",.07),
  up:()=>seq([N.G4,N.C5,N.E5,N.G5],.06,"triangle",.12),
  bad:()=>{tone(300,0,.25,"sawtooth",.05,-180)},
  alert:()=>{tone(N.A5,0,.07,"square",.05);tone(N.A5,.12,.07,"square",.05)},
  day:()=>tone(N.C5,0,.05,"triangle",.08),
  fanfare:()=>{seq([N.C5,N.C5,N.C5,N.G5,0,N.E5,N.G5,N.C6],.1,"square",.07);seq([N.C4,0,N.E4,0,N.G4,0,N.C5,N.E5],.1,"triangle",.1)},
  deal:()=>seq([N.E5,N.G5,N.E6],.07,"square",.06),
  tut:()=>tone(N.E5,0,.06,"triangle",.1),
};
G.SFX={play(name){if(!enabled)return;try{SOUNDS[name]?.()}catch(e){}},set enabled(v){enabled=v},get enabled(){return enabled},unlock(){ctx()}};
})(globalThis);
