// ... your BANK stays here, above this line ...
const LEVELS={junior:"AGES 8-11",mid:"AGES 12-14",senior:"AGES 15-18"};
const SHORT={junior:"8-11",mid:"12-14",senior:"15-18"};
let ROUND=10,TIME=15;   // set from Settings when a game starts
const $=id=>document.getElementById(id);
let level="junior",name="",qs=[],idx=0,score=0,streak=0,left=TIME,timer=null,locked=false,db=null,myLast=null,paused=false;

function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function show(id){["start","game","end"].forEach(s=>$(s).classList.toggle("hide",s!==id))}

// ================= SETTINGS DATA =================
const SKEY="cyberquiz-settings";
const DEF={sfx:true,sfxVol:.7,theme:"neon",big:false,kbd:true,pad:true,rumble:true,time:15,round:10,delay:1700};
let cfg=Object.assign({},DEF);
try{
 const o=JSON.parse(localStorage.getItem(SKEY)||"null");
 if(o)Object.assign(cfg,o);
}catch(e){}
let saveT=null;   // settings are saved 300ms after the last change, so dragging a slider doesn't hammer storage
function writeCfg(){clearTimeout(saveT);saveT=null;try{localStorage.setItem(SKEY,JSON.stringify(cfg))}catch(e){}}
function saveCfg(){clearTimeout(saveT);saveT=setTimeout(writeCfg,300)}
addEventListener("pagehide",()=>{if(saveT)writeCfg()});
const THEMES=[["neon","Neon Arcade"],["sunset","Sunset"],["ocean","Ocean"],["forest","Forest"],["candy","Candy"],["retro","Retro Green"],["light","Light"],["contrast","High Contrast"]];

// ================= AUDIO ENGINE =================
let ac=null,mg=null;
function ctx(){if(!ac){ac=new(window.AudioContext||window.webkitAudioContext)();}if(ac.state==="suspended")ac.resume();return ac}
function beep(f,d=.12,at=0){
 if(!cfg.sfx||cfg.sfxVol<=0)return;
 try{ctx();const o=ac.createOscillator(),g=ac.createGain(),t=ac.currentTime+at;o.type="square";o.frequency.value=f;
  g.gain.setValueAtTime(Math.max(.0002,.12*cfg.sfxVol),t);g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+d)}catch(e){}
}
const jingle=a=>a.forEach((f,i)=>beep(f,.14,i*.13));
function buzz(){try{if(cfg.rumble&&cfg.pad&&padRef&&padRef.vibrationActuator)padRef.vibrationActuator.playEffect("dual-rumble",{duration:200,strongMagnitude:.7,weakMagnitude:.3}).catch(()=>{})}catch(e){}}

// sound effects only need the audio context woken up by a click, key press or controller button
function unlock(){try{ctx()}catch(e){}}

// ================= SETTINGS PANEL (built by script) =================
const rowsRefresh=[];
let gear=null,ov=null,padTag=null;
function h(t,p,...k){
 const e=document.createElement(t);
 if(p)Object.keys(p).forEach(n=>{if(n==="role"||n.indexOf("aria-")===0)e.setAttribute(n,p[n]);else e[n]=p[n]});
 k.flat().forEach(c=>e.append(c));return e;
}
function commit(){saveCfg();apply()}
function apply(){
 document.documentElement.dataset.theme=cfg.theme;
 document.documentElement.style.setProperty("--fs",cfg.big?"15px":"");
 startPoll();rowsRefresh.forEach(f=>f());
}

function tog(label,key){
 const b=h("button",{className:"cs-btn",onclick:()=>{cfg[key]=!cfg[key];commit()}});
 rowsRefresh.push(()=>{b.textContent=cfg[key]?"ON":"OFF";b.classList.toggle("on",!!cfg[key]);b.setAttribute("aria-pressed",!!cfg[key])});
 return h("div",{className:"cs-r"},h("span",{textContent:label}),b);
}
function sld(label,key,test){
 const i=h("input",{type:"range",min:0,max:1,step:.05,value:cfg[key],oninput:()=>{cfg[key]=+i.value;commit()},onchange:()=>test&&test()});
 i.setAttribute("aria-label",label);rowsRefresh.push(()=>{i.value=cfg[key]});
 return h("div",{className:"cs-r"},h("span",{textContent:label}),i);
}
function sel(label,key,opts){
 const s=h("select",{onchange:()=>{cfg[key]=typeof DEF[key]==="number"?+s.value:s.value;commit()}});
 opts.forEach(o=>s.append(h("option",{value:o[0],textContent:o[1]})));
 s.setAttribute("aria-label",label);rowsRefresh.push(()=>{s.value=cfg[key]});
 return h("div",{className:"cs-r"},h("span",{textContent:label}),s);
}
const sec=t=>h("h3",{textContent:t});
function confirmBtn(label,action){
 const b=h("button",{className:"cs-btn",textContent:label});let sure=false,tm=null;
 b.onclick=()=>{
  if(sure){clearTimeout(tm);sure=false;b.textContent=label;action();return}
  sure=true;b.textContent="SURE? PRESS AGAIN";tm=setTimeout(()=>{sure=false;b.textContent=label},3000);
 };
 return h("div",{className:"cs-r"},b);
}
const STYLE=`
#cs-gear{position:fixed;top:10px;right:10px;z-index:50;font-size:1.3em;padding:8px 12px;text-align:center}
#cs-pad{position:fixed;top:12px;left:10px;z-index:50;font-size:.9em;color:var(--good,#39ff88)}
#cs-ov{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.85);overflow:auto;padding:14px}
#cs-ov[hidden]{display:none}
#cs-pn{max-width:540px;margin:0 auto;background:var(--panel,#170a3d);border:var(--bw,4px) solid var(--a,#22f0ff);border-radius:var(--r,0);padding:16px;color:var(--ink,#f4f0ff);line-height:1.7}
#cs-pn h2{font-size:1.3em;color:var(--c,#ffe600);margin:0 0 8px}
#cs-pn h3{font-size:1em;color:var(--b,#ff2ec4);margin:18px 0 6px;border-bottom:2px dashed var(--b,#ff2ec4);padding-bottom:4px}
#cs-pn p{font-size:.85em;margin:6px 0;opacity:.85}
.cs-r{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:8px 0;flex-wrap:wrap;font-size:.9em}
.cs-r select,.cs-r input[type=range]{font:inherit;font-size:.9em;max-width:55%;min-width:130px;background:var(--input,#000);color:var(--good,#39ff88);border:3px solid var(--b,#ff2ec4);border-radius:var(--r,0);padding:6px}
.cs-r input[type=range]{padding:0;accent-color:var(--b,#ff2ec4)}
.cs-btn{font:inherit;font-size:.9em;color:var(--ink,#f4f0ff);background:var(--btn,#2b1270);border:3px solid var(--a,#22f0ff);border-radius:var(--r,0);padding:8px 12px;min-height:40px;cursor:pointer;text-align:center}
.cs-btn:hover{background:var(--b,#ff2ec4);color:var(--onb,#fff)}
.cs-btn.on{background:var(--c,#ffe600);color:var(--onc,#000);border-color:var(--c,#ffe600)}
.cs-close{display:block;width:100%;margin-top:16px;background:var(--good,#39ff88);color:var(--ong,#000);border-color:var(--good,#39ff88);font-size:1.1em}
.cs-btn:focus-visible,#cs-pn select:focus-visible,#cs-pn input:focus-visible,body.cs-padmode button:focus,body.cs-padmode select:focus,body.cs-padmode input:focus{outline:4px solid var(--c,#ffe600);outline-offset:3px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;
function openSettings(){
 paused=!$("game").classList.contains("hide");
 ov.hidden=false;apply();ov.querySelector(".cs-close").focus();
}
function closeSettings(){ov.hidden=true;paused=false;gear.focus()}
function buildSettings(){
 document.head.append(h("style",{textContent:STYLE}));
 gear=h("button",{id:"cs-gear",className:"cs-btn",textContent:"⚙",title:"Settings (Esc)","aria-label":"Settings",onclick:openSettings});
 padTag=h("span",{id:"cs-pad",textContent:"🎮 CONTROLLER",hidden:true});
const pn=h("div",{id:"cs-pn",role:"dialog","aria-modal":"true","aria-label":"Settings"},
  h("h2",{textContent:"⚙ SETTINGS"}),
  sec("🔊 SOUND EFFECTS"),
  tog("Sound effects","sfx"),
  sld("Effects volume","sfxVol",()=>jingle([660,880])),
  h("div",{className:"cs-r"},h("button",{className:"cs-btn",textContent:"TEST SOUND",onclick:()=>jingle([523,659,784])})),
  sec("🎨 LOOK"),
  sel("Colour theme","theme",THEMES),
  tog("Big text","big"),
  sec("🎮 CONTROLS"),
  tog("Keyboard controls","kbd"),
  tog("Controller controls","pad"),
  tog("Controller vibration","rumble"),
  h("p",{textContent:"KEYBOARD: 1-4 answer · arrows move · Enter select · Esc or S settings · M mute secret music"}),
  h("p",{textContent:"CONTROLLER: D-pad or stick move · A select · A/B/X/Y answer · Start play · Select settings"}),
  h("p",{textContent:"MOUSE: click anything"}),
  sec("🕹 GAMEPLAY (next game)"),
  sel("Seconds per question","time",[[10,"10"],[15,"15"],[20,"20"],[30,"30"]]),
  sel("Questions per round","round",[[5,"5"],[8,"8"],[10,"10"],[12,"12"]]),
  sel("Pause between questions","delay",[[1200,"SHORT"],[1700,"NORMAL"],[3000,"LONG"]]),
  sec("🗑 DATA"),
  confirmBtn("RESET MY SCORES",()=>{
   try{Object.keys(localStorage).forEach(k=>{if(k===LKEY||k.indexOf("cyberquiz-seen-")===0)localStorage.removeItem(k)})}catch(e){}
   render(localScores(),"SCORES SAVED ON THIS DEVICE")}),
  confirmBtn("RESET SETTINGS",()=>{cfg=Object.assign({},DEF);commit()}),
  h("button",{className:"cs-btn cs-close",textContent:"✔ CLOSE",onclick:closeSettings}));
 ov=h("div",{id:"cs-ov",hidden:true,onclick:e=>{if(e.target===ov)closeSettings()}},pn);
 document.body.append(gear,padTag,ov);
 apply();
}

// ================= KEYBOARD =================
const DIRS=["up","down","left","right"];
function visible(e){return !e.disabled&&!!(e.offsetWidth||e.offsetHeight||e.getClientRects().length)}
function move(dir){
 const scope=ov&&!ov.hidden?ov:document;
 const items=[...scope.querySelectorAll("button,input,select")].filter(visible);
 const cur=document.activeElement;
 if(!items.includes(cur)){const f=items.find(e=>e.tagName==="BUTTON")||items[0];if(f)f.focus();return}
 const c=e=>{const r=e.getBoundingClientRect();return[r.left+r.width/2,r.top+r.height/2]},[cx,cy]=c(cur);
 const vert=dir==="up"||dir==="down";let best=null,bs=1e9;
 items.forEach(e=>{if(e===cur)return;const[x,y]=c(e),dx=x-cx,dy=y-cy;
  const f=dir==="down"?dy:dir==="up"?-dy:dir==="right"?dx:-dx,o=vert?Math.abs(dx):Math.abs(dy);
  if(f>4&&f+o*2<bs){bs=f+o*2;best=e}});
 if(best){best.focus();best.scrollIntoView({block:"nearest"});beep(300,.04)}
}
addEventListener("keydown",e=>{
 if(e.ctrlKey||e.metaKey||e.altKey)return;
 const open=!!ov&&!ov.hidden;
 if(e.key==="Escape"){e.preventDefault();open?closeSettings():openSettings();return}
 if(!cfg.kbd)return;
 const t=e.target,tag=t.tagName,typing=(tag==="INPUT"&&t.type!=="range")||tag==="TEXTAREA";
 if(typing||tag==="SELECT")return;
 const k=e.key.toLowerCase();
 if(k==="m"){if(eggOut)eggOut.gain.value=eggOut.gain.value?0:.5;return}
if(k==="s"&&!open){openSettings();return}
 const d={arrowup:"up",arrowdown:"down",arrowleft:"left",arrowright:"right"}[k];
 if(d&&(tag==="BUTTON"||tag==="BODY")){e.preventDefault();move(d);return}
 if(open)return;
 if(!$("game").classList.contains("hide")){
  const n=+e.key;
  if(n>=1&&n<=4&&!locked&&$("ans").children[n-1])$("ans").children[n-1].click();
 }
});

// ================= CONTROLLER =================
const PADMAP={a:0,b:1,x:2,y:3,lb:4,rb:5,select:8,start:9,up:12,down:13,left:14,right:15};
let prevPad={},holdPad={},padRef=null,polling=false;
function press(k){
 if(!cfg.pad)return;
 const open=!!ov&&!ov.hidden;
 if(k==="select")return open?closeSettings():openSettings();
 const a=document.activeElement;
 if(open){
  if(k==="b")return closeSettings();
  if(k==="left"||k==="right"){
   const d=k==="left"?-1:1;
   if(a&&a.type==="range"){a.value=(+a.value+d*(+a.step||1)).toFixed(2);a.dispatchEvent(new Event("input",{bubbles:true}));a.dispatchEvent(new Event("change",{bubbles:true}));return}
   if(a&&a.tagName==="SELECT"){const n=a.selectedIndex+d;if(n>=0&&n<a.options.length){a.selectedIndex=n;a.dispatchEvent(new Event("change",{bubbles:true}))}return}
  }
  if(k==="a"){if(a&&a.tagName==="BUTTON")a.click();else move("down");return}
  if(DIRS.includes(k))move(k);
  return;
 }
 const inGame=!$("game").classList.contains("hide"),inEnd=!$("end").classList.contains("hide");
 if(inGame){
  const i={a:0,b:1,x:2,y:3}[k],b=i!==undefined?$("ans").children[i]:null;
  if(b&&!locked)b.click();
  return;
 }
 if(k==="start")return(inEnd?$("again"):$("play")).click();
 if(k==="b"&&inEnd)return $("again").click();
 if(k==="a"){if(a&&a.tagName==="BUTTON")a.click();else move("down");return}
 if(DIRS.includes(k))move(k);
}
function startPoll(){if(polling||!cfg.pad)return;polling=true;requestAnimationFrame(poll)}
function poll(){   // only runs while a controller is connected
 const gp=navigator.getGamepads?[...navigator.getGamepads()].find(g=>g&&g.connected):null;
 if(!gp||!cfg.pad){padRef=null;prevPad={};if(padTag)padTag.hidden=true;document.body.classList.remove("cs-padmode");polling=false;return}
 padRef=gp;if(padTag)padTag.hidden=false;document.body.classList.add("cs-padmode");
 const ax=gp.axes||[],cur={},now=performance.now();
 for(const k in PADMAP)cur[k]=!!(gp.buttons[PADMAP[k]]&&gp.buttons[PADMAP[k]].pressed);
 cur.left=cur.left||ax[0]<-.6;cur.right=cur.right||ax[0]>.6;cur.up=cur.up||ax[1]<-.6;cur.down=cur.down||ax[1]>.6;
 for(const k in cur){
  if(!cur[k])continue;
  if(!prevPad[k]){unlock();press(k);holdPad[k]=now+350}
  else if(DIRS.includes(k)&&now>=holdPad[k]){press(k);holdPad[k]=now+140}
 }
 prevPad=cur;
 requestAnimationFrame(poll);
}

// ================= SECRET NAMES (easter eggs) =================
// Type the code as the player name, then press PLAY. Add more codes here.
// This is the ONLY music in the game. It is an original tune made with the browser's sound engine (no audio files).
const EGGS={"V":{msg:"★ SECRET MODE: WELCOME, V ★"}};
let eggStopFn=null,eggOut=null,subText="";
function chiptune(){
 const a=ctx();eggOut=a.createGain();eggOut.gain.value=.5;eggOut.connect(a.destination);
 const out=eggOut;
 const chords=[[220,261.63,329.63],[174.61,220,261.63],[261.63,329.63,392],[196,246.94,293.66]]; // Am F C G
 const pat=[0,1,2,1,0,1,2,1];let i=0;
 const tone=(f,type,vol,len)=>{const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.value=f;
  g.gain.setValueAtTime(vol,a.currentTime);g.gain.exponentialRampToValueAtTime(0.0001,a.currentTime+len);
  o.connect(g);g.connect(out);o.start();o.stop(a.currentTime+len)};
 const id=setInterval(()=>{if(document.hidden)return;const c=chords[Math.floor(i/8)%4];
  tone(c[pat[i%8]]*(i%8===4?2:1),"square",0.07,0.13);
  if(i%4===0)tone(c[0]/2,"triangle",0.18,0.3);i++},150);
 return()=>{clearInterval(id);out.disconnect();if(eggOut===out)eggOut=null};
}
function eggStart(code){
 eggStop();const e=EGGS[code];if(!e)return;
 try{eggStopFn=chiptune()}catch(x){eggStopFn=null}
 document.documentElement.dataset.egg="1";
 const sub=document.querySelector(".sub");subText=sub.textContent;sub.textContent=e.msg;
}
function eggStop(){
 if(eggStopFn){eggStopFn();eggStopFn=null}
 if(document.documentElement.dataset.egg){delete document.documentElement.dataset.egg;document.querySelector(".sub").textContent=subText}
}

// ================= LEVEL BUTTONS =================
Object.keys(LEVELS).forEach(k=>{const b=document.createElement("button");b.textContent=LEVELS[k];b.dataset.k=k;
 b.onclick=()=>{level=k;[...$("ages").children].forEach(c=>c.classList.toggle("on",c===b))};
 if(k===level)b.classList.add("on");$("ages").appendChild(b)});

$("play").onclick=()=>{
 name=$("nm").value.trim().toUpperCase();
 if(!name&&document.body.classList.contains("cs-padmode"))name="PLAYER";
 if(!name){$("smsg").textContent="TYPE YOUR NAME FIRST!";$("nm").focus();return}
 eggStart(name);
 $("smsg").textContent="";beep(523,.1);start();
};
$("again").onclick=()=>{eggStop();show("start")};

// ================= GAME =================
function seenGet(){try{return JSON.parse(localStorage.getItem("cyberquiz-seen-"+level)||"[]")}catch(e){return[]}}
function seenSet(v){try{localStorage.setItem("cyberquiz-seen-"+level,JSON.stringify(v))}catch(e){}}
function start(){
 clearInterval(timer);
 const pool=BANK[level];
 TIME=cfg.time;ROUND=Math.min(cfg.round,pool.length);paused=false;
 let seen=seenGet();
 let order=shuffle(pool.map((_,i)=>i));
 let fresh=order.filter(i=>!seen.includes(i));
 if(fresh.length<ROUND){seen=[];fresh=order}
 const pick=fresh.slice(0,ROUND);seenSet(seen.concat(pick));
 qs=pick.map(i=>{const r=pool[i];return{q:r[0],c:r[1],opts:shuffle(r.slice(1))}});
 idx=0;score=0;streak=0;myLast=null;show("game");next();
}
function next(){
 if(idx>=qs.length)return finish();
 const x=qs[idx];locked=false;left=TIME;
 $("qn").textContent="Q "+(idx+1)+"/"+qs.length;$("sc").textContent="SCORE "+score;
 $("q").textContent=x.q;$("gmsg").textContent="";$("ans").replaceChildren();
 x.opts.forEach(o=>{const b=document.createElement("button");b.textContent=o;b.onclick=()=>answer(b,o);$("ans").appendChild(b)});
 tick();clearInterval(timer);
 timer=setInterval(()=>{if(paused||document.hidden)return;left-=0.25;tick();if(left<=0)answer(null,null)},250);
}
function tick(){
 $("tm").textContent="TIME "+Math.max(0,Math.ceil(left));$("fill").style.width=Math.max(0,left/TIME*100)+"%";
}
function answer(btn,val){
 if(locked)return;locked=true;clearInterval(timer);
 const x=qs[idx],ok=val===x.c;
 [...$("ans").children].forEach(b=>{b.disabled=true;if(b.textContent===x.c)b.classList.add("right")});
 if(btn&&!ok)btn.classList.add("wrong");
 if(ok){streak++;const pts=100+Math.round(Math.max(0,left)/TIME*50)+(streak-1)*10;score+=pts;
  $("gmsg").textContent="CORRECT! +"+pts+(streak>1?"  ("+streak+" IN A ROW!)":"");beep(660,.1);beep(880,.14,.1)}
 else{streak=0;$("gmsg").textContent=val===null?"TIME UP!":"WRONG! THE ANSWER IS GREEN.";buzz();beep(160,.3)}
 $("sc").textContent="SCORE "+score;
 idx++;setTimeout(next,cfg.delay);
}
async function finish(){
 show("end");$("final").textContent=score;
 eggStop();
 $("emsg").textContent="SAVING SCORE...";
 const ok=await saveScore();
 $("emsg").textContent=ok==="db"?"SCORE SAVED TO LEADERBOARD!":ok==="local"?"SAVED ON THIS DEVICE ONLY":"COULD NOT SAVE SCORE";
 loadBoard();
}

// ---------- leaderboard ----------
const LKEY="cyberquiz-scores";
function localScores(){try{return JSON.parse(localStorage.getItem(LKEY)||"[]")}catch(e){return[]}}
async function saveScore(){
 const rec={name,score,level,at:Date.now()};myLast=rec;
 if(db){try{await db.collection("scores").add(rec);return"db"}catch(e){}}
 try{const l=localScores();l.push(rec);l.sort((a,b)=>b.score-a.score);localStorage.setItem(LKEY,JSON.stringify(l.slice(0,20)));return"local"}catch(e){return null}
}
function render(list,note){
 const tb=$("lb");tb.replaceChildren();
 if(!list.length){const r=tb.insertRow(),c=r.insertCell();c.colSpan=4;c.textContent="NO SCORES YET - BE THE FIRST!";}
 list.slice(0,10).forEach((s,i)=>{const r=tb.insertRow();
  if(myLast&&s.name===myLast.name&&s.score===myLast.score&&s.at===myLast.at)r.className="me";
  [i+1,s.name,SHORT[s.level]||"",s.score].forEach(v=>{r.insertCell().textContent=v})});
 $("lbnote").textContent=note;
}
let unsub=null;
function loadBoard(){
 if(db){
  if(unsub)return;
  const t=setTimeout(()=>render(localScores(),"SHOWING THIS DEVICE ONLY"),10000);
  unsub=db.collection("scores").orderBy("score","desc").limit(10).onSnapshot(
   s=>{clearTimeout(t);render(s.docs.map(d=>d.data()),"SHARED ONLINE LEADERBOARD")},
   ()=>{clearTimeout(t);unsub=null;render(localScores(),"SHOWING THIS DEVICE ONLY")});
 }else render(localScores(),"SCORES SAVED ON THIS DEVICE");
}

// ---------- start-up (keep at the very bottom) ----------
buildSettings();
startPoll();addEventListener("gamepadconnected",startPoll);
render(localScores(),"LOADING...");
(async()=>{try{db=await claude.use("db")}catch(e){db=null}loadBoard()})();
