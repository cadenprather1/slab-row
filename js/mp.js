/* Slab Row: accounts, saving, user shows, live multiplayer, real trading and real voice calls.
   Loads after the main app script and plugs into it. Money is always demo money. */
(function(){
const MP=window.MP={uid:null,email:null,profile:null,profiles:{},listings:{},online:{},peers:{},ra:{},room:null,roomKey:null,lobby:null,
  seen:new Set(),rows:{},notes:[],lastListings:'',lastProf:'',sendT:0,last:{x:0,z:0,r:0},alerted:{},unsub:[]};
const COLORS=['#3db5ff','#ff7a2f','#3ccf7e','#a35cff','#f06292','#e3a12f','#e0473a','#2fd4c4'];
const css=`
.auth{min-height:calc(100vh - 40px);display:grid;place-items:center;padding:24px 16px}
.authcard{width:min(420px,100%);background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:22px;display:grid;gap:14px}
.authcard h1{font-family:var(--f-disp);font-style:italic;font-weight:900;font-size:40px;margin:0;line-height:1}.authcard h1 span{color:var(--gold)}
.authcard label{display:grid;gap:5px;font-size:12.5px;font-weight:600;color:var(--mute)}
.authcard input{background:var(--bg);border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:11px 12px;font:inherit;font-size:15px}
.authtabs{display:flex;gap:6px;background:var(--bg);border-radius:10px;padding:4px}.authtabs button{flex:1;border:0;background:none;color:var(--mute);font-weight:700;padding:9px;border-radius:8px;cursor:pointer}.authtabs button[aria-pressed="true"]{background:var(--panel2);color:var(--ink)}
.autherr{color:#ff6b74;font-size:13px;min-height:18px}
.demo{font-size:12px;color:var(--mute);line-height:1.5}
.acct{border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:999px;padding:6px 12px;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap}
.hostbar{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:-6px 0 18px}
.hostform{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,180px),1fr));gap:10px}
.hostform label{display:grid;gap:4px;font-size:12px;color:var(--mute);font-weight:600}
.hostform input,.hostform select{background:var(--bg);border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:9px 10px;font:inherit}
.whochip{top:calc(296px + env(safe-area-inset-top,0px));right:max(12px,env(safe-area-inset-right,0px));font-family:var(--f-mono);font-size:12px;background:rgba(4,7,14,.78);border:1px solid rgba(60,207,126,.5);border-radius:6px;padding:5px 10px;color:#bff5d6;pointer-events:auto;cursor:pointer}
@media (max-width:720px){.whochip{top:calc(140px + env(safe-area-inset-top,0px));right:max(8px,env(safe-area-inset-right,0px));font-size:10.5px;padding:3px 7px}}
#dealNote{top:auto;bottom:calc(90px + env(safe-area-inset-bottom,0px));border-color:var(--gold)}
.reallist{display:grid;gap:10px;margin-bottom:20px}
.realrow{display:flex;gap:12px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
.realrow .who{flex:1;min-width:0}.realrow b{display:block}.realrow span{font-size:12.5px;color:var(--mute)}
.livebadge{position:fixed;left:10px;bottom:10px;z-index:40;font-size:11px;background:#ffd54a;color:#2a1f00;border-radius:6px;padding:3px 8px;font-weight:700}
`;
document.head.insertAdjacentHTML('beforeend',`<style>${css}</style>`);
document.body.insertAdjacentHTML('beforeend',`<div id="dealNote" class="vcard" hidden role="alert"></div>`);
document.getElementById('world').insertAdjacentHTML('beforeend',`<div class="hud whochip" id="whochip" data-act="whoList" hidden></div>`);
if(NET.mode==='local')document.body.insertAdjacentHTML('beforeend','<div class="livebadge">Local test mode · not connected to the server</div>');

const fmtWhen=t=>new Date(t).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const cardRef=c=>({...snap(c),id:c.id,price:c.price,mkt:c.mkt||c.price});
const nameOf=uid=>MP.profiles[uid]?.name||MP.peers[uid]?.name||'Collector';

/* ================= sign in ================= */
let authMode='signin';
function renderAuth(err){S.view='auth';$('#topbar').hidden=true;
  $('#app').innerHTML=`<div class="auth"><form class="authcard" data-form="authForm" novalidate>
   <h1>Slab <span>Row</span></h1><p class="mute" style="margin:0">A virtual card show. Walk the floor with friends, set up a table, and trade.</p>
   <div class="authtabs" role="tablist"><button type="button" data-act="authMode" data-id="signin" aria-pressed="${authMode==='signin'}">Sign in</button><button type="button" data-act="authMode" data-id="signup" aria-pressed="${authMode==='signup'}">Create account</button></div>
   ${authMode==='signup'?'<label>Display name<input name="name" autocomplete="nickname" required maxlength="24" placeholder="What people see over your head"></label>':''}
   <label>Email<input name="email" type="email" autocomplete="email" required></label>
   <label>Password<input name="pw" type="password" autocomplete="${authMode==='signup'?'new-password':'current-password'}" required minlength="6" placeholder="${authMode==='signup'?'At least 6 characters':''}"></label>
   <div class="autherr" id="autherr">${esc(err||'')}</div>
   <button class="btn gold" id="authgo">${authMode==='signup'?'Create account':'Sign in'}</button>
   <p class="demo">Demo mode: no real money ever moves. Everything else is live: shows, tables, offers, sales and voice calls between real people.</p></form></div>`;
  setTimeout(()=>$('#app input')?.focus(),30);try{authHook()}catch(e){console.error(e)}}
FORMS.authForm=async f=>{const d=Object.fromEntries(new FormData(f)),err=$('#autherr'),b=$('#authgo');err.textContent='';
  if(!d.email||!d.pw)return err.textContent='Enter your email and password.';if(authMode==='signup'&&!(d.name||'').trim())return err.textContent='Pick a display name.';
  b.disabled=true;b.textContent=authMode==='signup'?'Creating…':'Signing in…';
  try{const s=authMode==='signup'?await NET.signUp(d.email.trim(),d.pw,d.name.trim()):await NET.signIn(d.email.trim(),d.pw);
    if(authMode==='signup')MP.newName=d.name.trim();await afterLogin(s)}
  catch(e){b.disabled=false;b.textContent=authMode==='signup'?'Create account':'Sign in';err.textContent=NET.friendly(e)}};
ACT.authMode=m=>{authMode=m;renderAuth()};

async function afterLogin(s){
  MP.uid=s.uid;MP.email=s.email;
  let prof=null;try{prof=await NET.getProfile(s.uid)}catch(e){}
  if(!prof)prof={id:s.uid,name:MP.newName||(s.email||'').split('@')[0],role:'collector'};
  if(MP.newName&&prof.name!==MP.newName)prof.name=MP.newName;
  MP.profile=prof;MP.profiles[s.uid]=prof;
  let me=null;try{me=await NET.loadState(s.uid)}catch(e){toast('Couldn’t load your saved data: '+NET.friendly(e))}
  if(!(me&&loadME(me))){seedME();ME.role=prof.role||'collector'}
  ME.name=prof.name||ME.name;if(!ME.table||ME.table==='My Table')ME.table=`${ME.name}’s Table`;ME.color=ME.color||pick(COLORS);
  UID=s.uid;STORE='cloud';
  $('#topbar').hidden=false;mountAcct();
  joinLobby();
  MP.unsub.push(NET.onOffers(s.uid,r=>processRow(r)));
  try{(await NET.myOffers(s.uid)).reverse().forEach(r=>processRow(r,true))}catch(e){}
  await refreshShows();
  go('shows');save(true);
}
function mountAcct(){if($('#acct'))return $('#acct').textContent=ME.name;$('#wallet').insertAdjacentHTML('afterend',`<button class="acct" id="acct" data-act="acct">${esc(ME.name)}</button>`)}
ACT.acct=()=>openModal(`<div class="sec"><span class="eyebrow">Signed in</span><h2>${esc(ME.name)}</h2><p class="mute" style="margin:0">${esc(MP.email||'')}</p></div>
  <div class="sec"><form class="hostform" data-form="acctName"><label>Display name<input name="name" maxlength="24" value="${esc(ME.name)}"></label><button class="btn ghost" style="align-self:end">Save name</button></form>
  <p class="mute" style="font-size:12.5px">Your name shows over your head, on your table and on offers. Switch between collector and vendor in Inventory.</p></div>
  <div class="sec" style="display:flex;gap:8px"><button class="btn ghost" data-act="signOut">Sign out</button></div>`);
FORMS.acctName=f=>{const n=f.name.value.trim().slice(0,24);if(!n)return;const old=ME.name;ME.name=n;if(ME.table===`${old}’s Table`)ME.table=`${n}’s Table`;MP.profile.name=n;save(true);mountAcct();closeModal();toast('Name saved')};
ACT.signOut=async()=>{try{await NET.signOut()}catch(e){}location.reload()};

/* ================= saving ================= */
let saveT2=null;
window.save=function(now){clearTimeout(saveT2);saveT2=setTimeout(doSave,now?0:700)};
async function doSave(){if(!MP.uid||!ME)return;const body=stripForSave();
  try{await NET.saveState(MP.uid,body);STORE='cloud';
    const rows=ME.inv.filter(c=>!c.sold&&c.forSale).map(c=>({card_id:c.id,price:+c.price,card:{...snap(c),mkt:c.mkt||c.price,cert:c.cert||null,base:c.base??null,box:!!c.box,hold:c.hold&&c.hold.until>Date.now()?{uid:c.hold.uid||null,name:c.hold.name||'',until:c.hold.until}:null}}));
    const lk=JSON.stringify(rows);if(lk!==MP.lastListings){MP.lastListings=lk;await NET.syncListings(MP.uid,rows)}
    const look={av:lookOf(),booth:styleOf()},pk=JSON.stringify([ME.name,ME.role,ME.table,ME.from,ME.color,look]);if(pk!==MP.lastProf){MP.lastProf=pk;const pr={name:ME.name,role:ME.role,table_name:ME.table,city:ME.from,color:ME.color};
      if(!MP.noLook){try{await NET.saveProfile(MP.uid,{...pr,look})}catch(e){if(/look/i.test(String(e&&(e.message||e))))MP.noLook=true;else throw e}}if(MP.noLook)await NET.saveProfile(MP.uid,pr);
      MP.profiles[MP.uid]={...MP.profile,...pr,look};if(MP.room)MP.room.track({look:look.av,bstyle:ME.role==='vendor'?look.booth:null,name:ME.name,role:ME.role})}
    MP.saveWarned=0}
  catch(e){STORE='device';if(!MP.saveWarned){MP.saveWarned=1;toast('Couldn’t save to the server: '+NET.friendly(e))}}
  updateSaveBadge(true)}
window.addEventListener('beforeunload',()=>{if(saveT2){clearTimeout(saveT2);doSave()}});

/* ================= photos (Supabase Storage) ================= */
const _imgURL=imgURL;
window.imgURL=r=>r&&r.startsWith('s:')?NET.photoURL(r.slice(2)):_imgURL(r);
window.initAssets=async()=>{};
window.storePhoto=async function(file){
  if(file.type&&!/^image\//.test(file.type))throw new Error('that file isn’t a photo');
  let im;try{im=await decodeFile(file)}catch(e){throw new Error('this browser can’t open that photo type. Try a JPG or PNG')}
  const cv=toCanvas(im,1500),blob=await new Promise(r=>cv.toBlob(r,'image/jpeg',.86));
  try{return 's:'+await NET.uploadPhoto(MP.uid,blob)}catch(e){throw new Error(NET.friendly(e))}};
const _removeStored=removeStored;
window.removeStored=async ref=>{if(!ref)return;if(ref.startsWith('s:')){if(refInUse(ref))return;return NET.deletePhoto(ref.slice(2))}return _removeStored(ref)};

/* ================= shows people create ================= */
async function refreshShows(){
  try{const rows=await NET.listShows();for(let i=SHOWS.length-1;i>=0;i--)if(SHOWS[i].db)SHOWS.splice(i,1);
    rows.filter(r=>!r.ends_at||Date.parse(r.ends_at)>Date.now()-6*3600e3).reverse().forEach(r=>SHOWS.unshift(dbShow(r)))}
  catch(e){toast('Couldn’t load shows: '+NET.friendly(e))}}
function dbShow(r){const st=Date.parse(r.starts_at)||Date.now(),en=r.ends_at?Date.parse(r.ends_at):st+4*3600e3,now=Date.now();
  const live=now>=st-15*60e3&&now<en,ended=now>=en,gp=+r.general_price||0,ep=+r.early_price||0,id='s_'+r.id;
  const tiers=gp>0||ep>0?{early:{label:'Early entry',price:Math.max(ep,gp),desc:'Doors open now · first look at every table'},general:{label:'General admission',price:gp,get desc(){return now<st?`Doors open at ${clockStr(st)}`:'Doors are open'}}}:null;
  const base=r.crowd?['sopure','gridiron','rookieroom','waxwizard','courtside','hometown']:[];
  return {id,db:r,dbid:r.id,hostId:r.host,name:r.name,tag:r.tagline||'A Slab Row show',host:r.host_name||'A collector',
    when:ended?'Ended':live?'Live now':fmtWhen(st),date:`${fmtWhen(st)} – ${clockStr(en)}`,live,ended,price:tiers?gp:0,
    get attendees(){return (r.crowd?96:0)+Object.values(MP.online).filter(p=>p.show===id).length},
    vendors:[...base],_baseVendors:[...base],tiers,guest:null,gateAt:st,
    stage:r.crowd?{key:'stage',speaker:r.host_name||'The host',title:`${r.name} · main stage`,sub:'Host talk and Q&A'}:null,
    rooms:r.crowd?[{key:'vip1',title:'Collector meetup',kind:'Working session',speaker:r.host_name||'The host',sub:'Bring your PC list'},{key:'vip2',title:'Price Your PC',kind:'Working session',speaker:'Jordan Reyes',sub:'Comps, pops and when to sell'}]:[],
    program:[[clockStr(st).replace(/\s?[AP]M/,''),'Doors open',live?'now':''],[clockStr(en).replace(/\s?[AP]M/,''),'Floor closes']]}}
const _renderShows=renderShows;
window.renderShows=function(){SHOWS.forEach(s=>{if(s.db&&s.hostId===MP.uid){ME.tickets=ME.tickets||{};if(!ME.tickets[s.id])ME.tickets[s.id]={tier:'early',code:'HOST',checkedIn:true}}});
  _renderShows();const shows=$('.shows');if(!shows)return;
  shows.insertAdjacentHTML('beforebegin',`<div class="hostbar"><span class="mute" style="font-size:13px">${SHOWS.filter(s=>s.db&&s.live).length} live show${SHOWS.filter(s=>s.db&&s.live).length===1?'':'s'} made by people on Slab Row · ${Object.keys(MP.online).length} online now</span><span style="display:flex;gap:8px"><button class="btn ghost sm" data-act="refreshShows">Refresh</button><button class="btn gold sm" data-act="hostShow">Host a show</button></span></div>`);
  shows.querySelectorAll('article').forEach(a=>{const b=a.querySelector('[data-id]');const s=b&&SHOWS.find(x=>x.id===b.dataset.id);if(!s||!s.db)return;
    const foot=a.querySelector('.foot');if(s.hostId===MP.uid){foot.insertAdjacentHTML('afterbegin','<span class="chip gold">Your show</span>');foot.insertAdjacentHTML('beforeend',`<button class="btn ghost sm" data-act="delShow" data-id="${s.dbid}">Delete</button>`)}
    if(s.hostId===MP.uid&&!s.live&&!s.ended){const go=foot.querySelector('[data-act]');if(go){go.outerHTML=`<button class="btn gold" data-act="enter" data-id="${s.id}">Open early (host)</button>`}}})};
ACT.refreshShows=async()=>{await refreshShows();renderShows();toast('Shows updated')};
ACT.hostShow=()=>{const d=new Date(Date.now()+5*60e3);d.setSeconds(0,0);const loc=new Date(d.getTime()-d.getTimezoneOffset()*60e3).toISOString().slice(0,16);
  openModal(`<div class="sec"><span class="eyebrow">Host a show</span><h2>Create a show</h2><p class="mute" style="margin:0">Anyone with an account can join. Ticket prices are demo money.</p></div>
  <div class="sec"><form class="hostform" data-form="createShow">
   <label style="grid-column:1/-1">Show name<input name="name" required maxlength="40" placeholder="Friday Night Slabs"></label>
   <label style="grid-column:1/-1">Tagline<input name="tag" maxlength="60" placeholder="Football and hoops, all price ranges"></label>
   <label>Starts<input name="start" type="datetime-local" value="${loc}"></label>
   <label>Length<select name="hours">${[1,2,3,4,6,8,12,24].map(h=>`<option value="${h}" ${h===3?'selected':''}>${h} hour${h>1?'s':''}</option>`).join('')}</select></label>
   <label>General ticket ($)<input name="gp" inputmode="decimal" value="0"></label>
   <label>Early entry ($)<input name="ep" inputmode="decimal" value="0"></label>
   <label class="switch" style="grid-column:1/-1;display:flex;flex-direction:row;align-items:center;gap:8px;color:var(--ink)"><input type="checkbox" name="crowd" checked> Fill the floor with the simulated crowd and sample vendors</label>
   <button class="btn gold" style="grid-column:1/-1">Create show</button></form>
   <p class="mute" style="font-size:12px">Free shows open straight away. Paid shows use check-in at the ticket desk, and early entry gets in before the start time.</p></div>`)};
FORMS.createShow=async f=>{const d=Object.fromEntries(new FormData(f));if(!(d.name||'').trim())return toast('Give your show a name');
  const st=d.start?new Date(d.start):new Date(),en=new Date(st.getTime()+(+d.hours||3)*3600e3),num=x=>Math.max(0,parseFloat(String(x||'0').replace(/[$,]/g,''))||0);
  f.querySelector('button').disabled=true;
  try{const r=await NET.createShow({host:MP.uid,host_name:ME.name,name:d.name.trim(),tagline:(d.tag||'').trim(),starts_at:st.toISOString(),ends_at:en.toISOString(),general_price:num(d.gp),early_price:num(d.ep),crowd:!!d.crowd});
    ME.tickets=ME.tickets||{};ME.tickets['s_'+r.id]={tier:'early',code:'HOST',checkedIn:true};save();closeModal();NET.addActivity('show',{host:ME.name,name:r.name}).catch(()=>{});await refreshShows();renderShows();toast(`${r.name} is up. Share the site link and tell friends to look for it.`)}
  catch(e){f.querySelector('button').disabled=false;toast('Couldn’t create the show: '+NET.friendly(e))}};
ACT.delShow=async(id,b)=>{if(!b.dataset.armed){b.dataset.armed=1;b.textContent='Confirm delete';setTimeout(()=>{if(b.isConnected){delete b.dataset.armed;b.textContent='Delete'}},3000);return}
  try{await NET.deleteShow(id);await refreshShows();renderShows();toast('Show deleted')}catch(e){toast('Couldn’t delete: '+NET.friendly(e))}};
const _gateOpen=gateOpen;
window.gateOpen=function(){const D=showData;if(D&&D.db){if(D.hostId===MP.uid||!D.price)return true;const tk=tixOf(D.id);return !!tk?.checkedIn&&(tk.tier==='early'||Date.now()>=D.gateAt)}return _gateOpen()};

/* ================= real people as tables / parties ================= */
function listingCard(l){const c=decorate({...l.card,id:l.card_id,price:+l.price,mkt:+(l.card.mkt||l.price),cert:l.card.cert??null,sold:false});if(+l.card.base>c.price)c.list=+l.card.base;delete c.base;c.owner=l.owner;return c}
async function loadParties(uids){uids=[...new Set(uids)].filter(u=>u&&u!==MP.uid);if(!uids.length)return;
  try{Object.assign(MP.profiles,await NET.profiles(uids))}catch(e){}
  await Promise.all(uids.map(async u=>{try{MP.listings[u]=await NET.listings(u)}catch(e){}}))}
function realParty(uid,fallbackName){const id='u_'+uid,p=MP.profiles[uid]||{name:fallbackName||nameOf(uid),role:'collector'};let v=VBY[id];
  if(!v){v=V(id,p.name,'@'+(p.name||'collector').replace(/\s+/g,'').toLowerCase(),false,'open',p.color||'#3db5ff','','',.85,9999,[]);v.real=true;v.uid=uid;VBY[id]=v}
  const vendor=p.role==='vendor';v.person=p.name;v.name=vendor&&p.table_name?p.table_name:p.name;v.kind=vendor?undefined:'attendee';v.color=p.color||v.color;
  v.spec=vendor?`Real vendor · ${p.name}`:'Real collector · showing you their cards';{const ps=MP.peers[uid]?.bstyle||p.look?.booth;if(vendor&&ps)v.style=ps}v.city=p.city||'';
  const keep=new Map((v.inv||[]).filter(c=>c.sold||c.held).map(c=>[c.id,c]));v.inv=(MP.listings[uid]||[]).map(l=>{const k=keep.get(l.card_id);return k&&!k.sold?k:listingCard(l)});
  const pe=MP.peers[uid];v.online=vendor?!!(pe&&pe.op):!!(pe||MP.online[uid]);return v}
window.realParty=realParty;
async function openReal(uid,ctx){await loadParties([uid]);const v=realParty(uid);openTable(v,ctx||'show')}
ACT.tradeReal=uid=>openReal(uid,'show');

/* ================= booths at a show ================= */
async function prepRoom(key){const D=SHOWS.find(s=>s.id===key);if(!D)return;
  D._baseVendors=D._baseVendors||[...D.vendors];
  let rows=[];try{rows=await NET.booths(key)}catch(e){}
  let mine=rows.find(r=>r.user_id===MP.uid);
  if(ME.role==='vendor'&&!mine){const base=D._baseVendors.length,order=[...Array(8).keys()].filter(i=>i>=base).concat([...Array(Math.min(base,8)).keys()].reverse());
    for(const s of order){if(rows.some(r=>r.slot===s))continue;try{await NET.claimBooth(key,MP.uid,s);mine={slot:s,user_id:MP.uid,show_key:key};rows.push(mine);break}catch(e){try{rows=await NET.booths(key)}catch(_){}}}
    if(!mine)toast('Every table at this show is taken by real vendors, so you’re walking the floor as a collector this time.')}
  if(ME.role!=='vendor'&&mine){try{await NET.releaseBooth(key,MP.uid)}catch(e){}rows=rows.filter(r=>r!==mine);mine=null}
  await loadParties(rows.map(r=>r.user_id));
  layoutVendors(D,rows,mine)}
function layoutVendors(D,rows,mine){const v=Array(8).fill(null);D._baseVendors.forEach((id,i)=>{if(i<8)v[i]=id});
  rows.filter(r=>r.user_id!==MP.uid).forEach(r=>{realParty(r.user_id);v[r.slot]='u_'+r.user_id});if(mine)v[mine.slot]=null;
  D.vendors=v;D.mySlot=mine?mine.slot:null;D.boothRows=rows}
const _enter=ACT.enter;
ACT.enter=async id=>{if(!hasTicket(id))return ticketModal(id);toast('Opening the doors…');await prepRoom(id);_enter(id)};
function slotPos(i){return [BOOTHX[i%4],i>=4?ROWS.B:ROWS.A]}
function removeBoothAt(slot){const [x,z]=slotPos(slot);const i=booths.findIndex(b=>Math.abs(b.x-x)<.01&&Math.abs(b.z-z)<.01);if(i<0)return;const b=booths[i];
  scene.remove(b.g);booths.splice(i,1);colliders=colliders.filter(c=>!(Math.abs(c.x1-(x-3.3))<.01&&Math.abs(c.z1-(z-2.5))<.01));blockers=blockers.filter(m=>m.parent!==b.g);
  const ci=CAROUSELS.indexOf(b.car);if(ci>=0)CAROUSELS.splice(ci,1);if(b.served){const si=SERVED.indexOf(b.served);if(si>=0)SERVED.splice(si,1)}
  (b.v.inv||[]).forEach(c=>{delete slabMeshes[c.id];delete CARO[c.id]});bots.forEach(bt=>{if(bt.userData.visiting===b)bt.userData.visiting=null})}
async function refreshBoothsLive(){const D=showData;if(!D||S.view!=='room'||!scene)return;let rows;try{rows=await NET.booths(D.id)}catch(e){return}
  await loadParties(rows.map(r=>r.user_id));const before=[...D.vendors],mine=rows.find(r=>r.user_id===MP.uid);layoutVendors(D,rows,mine);
  for(let i=0;i<8;i++){if(before[i]===D.vendors[i]||(mine&&mine.slot===i))continue;removeBoothAt(i);const id=D.vendors[i];if(id&&VBY[id]){const [x,z]=slotPos(i);buildBooth(VBY[id],x,z);const b=booths.find(b=>b.v===VBY[id]);if(b&&b.v.real)b.vendorAv.visible=false;
    if(VBY[id].real)toast(`${VBY[id].person||VBY[id].name} set up a table on the expo floor`)}}}
const _buildBooth=buildBooth;
window.buildBooth=function(v,x,z){_buildBooth(v,x,z);const b=booths[booths.length-1];if(b&&b.v.real){b.vendorAv.visible=false;if(b.served)b.served.visible=false}};

/* ================= live room: see each other ================= */

function joinRoom(key){leaveRoom();MP.roomKey=key;
  MP.room=NET.channel('room:'+key,{uid:MP.uid,name:ME.name,role:ME.role,color:ME.color,op:false,look:lookOf(),bstyle:ME.role==='vendor'?styleOf():null},{sync:onSync,msg:onMsg,error:()=>toast('Live connection is having trouble. Retrying…')});
  MP.lobby&&MP.lobby.track({show:key,name:ME.name});MP.unsub.push(MP.unbooth=NET.onBooths(key,()=>refreshBoothsLive()));updateWho()}
function leaveRoom(){if(MP.room){MP.room.leave();MP.room=null}if(MP.unbooth){MP.unbooth();MP.unbooth=null}
  Object.values(MP.ra).forEach(r=>{try{scene&&scene.remove(r.av)}catch(e){}});MP.ra={};MP.peers={};MP.roomKey=null;MP.lobby&&MP.lobby.track({show:null});$('#whochip').hidden=true}
function onSync(list){const now={};list.forEach(p=>{if(p&&p.uid&&p.uid!==MP.uid)now[p.uid]=p});
  Object.keys(MP.ra).forEach(u=>{if(!now[u]){try{scene.remove(MP.ra[u].av)}catch(e){}delete MP.ra[u]}});
  Object.values(now).forEach(p=>{const r=MP.ra[p.uid];if(r&&p.look&&JSON.stringify(p.look)!==r.lk){const t=r.t,pos=r.av.position.clone(),ry=r.av.rotation.y;try{scene.remove(r.av)}catch(e){}delete MP.ra[p.uid];const n=ensureRA(p.uid,p);if(n){n.t=t;n.av.position.copy(pos);n.av.rotation.y=ry;n.av.visible=!!t;n.seen=performance.now()}}
    const v=VBY['u_'+p.uid];if(v&&v.real&&p.bstyle&&JSON.stringify(p.bstyle)!==JSON.stringify(v.style||null)){v.style=p.bstyle;rebuildBooth(v)}});
  const was=MP.peers;MP.peers=now;Object.values(now).forEach(p=>{if(!was[p.uid]&&S.view==='room'){nlog('sys',`${p.name} walked in.`)}const v=VBY['u_'+p.uid];if(v){v.online=p.role==='vendor'?!!p.op:true;try{syncBooth(v)}catch(e){}}});
  Object.keys(was).forEach(u=>{if(!now[u]){nlog('sys',`${was[u].name} left the show.`);const v=VBY['u_'+u];if(v){v.online=false;try{syncBooth(v)}catch(e){}}if(VOICE.call&&VOICE.call.kind==='real'&&VOICE.call.members[u]){const nm=was[u].name;clearTimeout(MP.goneT[u]);MP.goneT[u]=setTimeout(()=>{if(!MP.peers[u])dropMember(u,`${nm} left the show, so they dropped off the call`)},9000)}}});
  loadParties(Object.keys(now).filter(u=>!MP.profiles[u]));updateWho()}
MP.goneT={};
function rebuildBooth(v){const D=showData;if(!D||!scene||S.view!=='room')return;const i=(D.vendors||[]).indexOf(v.id);if(i<0)return;removeBoothAt(i);const [x,z]=slotPos(i);buildBooth(v,x,z);try{syncBooth(v)}catch(e){}}
function updateWho(){const n=Object.keys(MP.peers).length,el=$('#whochip');if(!el)return;el.hidden=S.view!=='room';el.textContent=n?`${n} real ${n===1?'person':'people'} here`:(innerWidth<720?'Only you · invite friends':'Only you so far · invite friends');placeWho()}
function placeWho(){const el=$('#whochip'),w=$('#wchip');if(!el||!w||el.hidden)return;if(innerWidth>=720){el.style.top='';return}const r=w.getBoundingClientRect();if(r.height)el.style.top=(r.bottom+6)+'px'}
window.addEventListener('resize',()=>setTimeout(placeWho,50));setInterval(placeWho,2000);
ACT.whoList=()=>{const ps=Object.values(MP.peers);openModal(`<div class="sec"><span class="eyebrow">Real people in ${esc(showData?.name||'this show')}</span><h2>${ps.length?`${ps.length} here with you`:'Just you right now'}</h2>
  ${ps.length?ps.map(p=>`<div class="realrow"><div class="vava" style="background:${p.color||'#3db5ff'};width:34px;height:34px;font-size:13px">${initials(p.name)}</div><div class="who"><b>${esc(p.name)}</b><span>${p.role==='vendor'?(p.op?'Vendor · behind their table':'Vendor · walking the floor'):'Collector'}</span></div><button class="btn ghost sm" data-act="walkToPeer" data-id="${p.uid}">Walk there</button><button class="btn gold sm" data-act="tradeReal" data-id="${p.uid}">Their cards</button></div>`).join(''):'<p class="mute">Send friends the site link. Anyone with an account who enters this show shows up here, walking the same floor.</p>'}</div>`)};
ACT.walkToPeer=uid=>{const r=MP.ra[uid];closeModal();if(!r)return;player.userData.path=[{x:r.av.position.x+1.2,z:r.av.position.z+1.2}]};
function ensureRA(uid,info){let r=MP.ra[uid];if(r||!scene)return r;const p=info||MP.peers[uid]||{name:'Collector'};
  const lk=p.look||MP.profiles[uid]?.look?.av,av=makeAvatar(lk||{shirt:new THREE.Color(p.color||'#3db5ff').getHex()});av.userData.name=p.name;av.userData.real=uid;
  const tag=tagSprite(p.name+(p.role==='vendor'?' · vendor':''),'rgba(5,9,18,.82)','#ffffff');tag.position.y=2.6;tag.scale.multiplyScalar(.78);av.add(tag);
  av.visible=false;scene.add(av);r=MP.ra[uid]={av,uid,name:p.name,t:null,sp:0,lean:0,lvl:0,lk:JSON.stringify(lk||null)};return r}
function onMsg(ev,d){if(!d||d.uid===MP.uid||d.from===MP.uid)return;
  if(ev==='pos'){const r=ensureRA(d.uid,MP.peers[d.uid]||{name:d.n,color:d.c,role:d.role});if(!r)return;const first=!r.t;r.t=d;if(first){r.av.position.set(d.x,d.y||0,d.z);r.av.rotation.y=d.r}r.av.visible=true;r.seen=performance.now()}
  else if(ev==='say'){const r=MP.ra[d.uid];if(r&&player&&r.av.position.distanceTo(player.position)<16){say(r.av,d.text,4200);nlog(d.n||r.name,d.text)}}
  else if(ev==='talk')onTalk(d);
  else if(ev==='rtc')onRtc(d);
  else if(ev==='booth')refreshBoothsLive();}
function mpFrame(now){if(S.view!=='room'||!player||!MP.room)return;const dt=Math.min(.05,(now-(MP.lastF||now))/1000);MP.lastF=now;
  for(const r of Object.values(MP.ra)){if(!r.t)continue;const a=r.av,t=r.t,k=Math.min(1,dt*9);const dx=t.x-a.position.x,dz=t.z-a.position.z;
    if(Math.hypot(dx,dz)>8){a.position.set(t.x,t.y||0,t.z)}else{a.position.x+=dx*k;a.position.z+=dz*k;a.position.y+=((t.y||0)-a.position.y)*k}
    let dr=t.r-a.rotation.y;dr=Math.atan2(Math.sin(dr),Math.cos(dr));a.rotation.y+=dr*k;a.userData.leanT=t.l||0;walkAnim(a,t.sp||0,dt);
    if(peerLevel(r.uid)>.04)setSpeaking(a,180);
    if(now-r.seen>6000)a.visible=false}
  if(now-MP.sendT>110){const p=player.position,ry=player.rotation.y,mv=Math.hypot(p.x-MP.last.x,p.z-MP.last.z),idle=now-MP.sendT>1000;
    if(mv>.02||Math.abs(ry-MP.last.r)>.04||idle){const sp=mv/((now-MP.sendT)/1000);MP.room.send('pos',{uid:MP.uid,n:ME.name,c:ME.color,role:ME.role,x:+p.x.toFixed(2),y:+p.y.toFixed(2),z:+p.z.toFixed(2),r:+ry.toFixed(3),sp:+Math.min(8,sp).toFixed(2),l:player.userData.leanT||0});MP.last={x:p.x,z:p.z,r:ry};MP.sendT=now}}
  if(now-(MP.boothT||0)>1000){MP.boothT=now;boothWatch()}}
function boothWatch(){const b=typeof myBooth==='function'&&myBooth();if(!b||S.op)return;for(const r of Object.values(MP.ra)){const p=r.av.position,d=Math.hypot(p.x-b.x,p.z-(b.z+2));
  if(d<2.4){r.atBooth=(r.atBooth||0)+1;if(r.atBooth===2&&window.runVisitor)runVisitor(r.name);if(r.atBooth===2&&!(MP.alerted[r.uid]>Date.now())){MP.alerted[r.uid]=Date.now()+60000;showBoothAlert(r.av)}}else r.atBooth=0}}
window.mpNear=p=>{for(const r of Object.values(MP.ra)){if(r.av.visible&&r.av.position.distanceTo(p)<2.2)return r}return null};
const _vf=voiceFrame;window.voiceFrame=function(now){_vf(now);try{mpFrame(now)}catch(e){console.error(e)}};
const _enterVenue=ACT.enterVenue;
const _buildWorld=buildWorld;window.buildWorld=function(){_buildWorld();try{booths.forEach(b=>{if(b.v.real){b.vendorAv.visible=false;if(b.served)b.served.visible=false}});joinRoom(showData.id)}catch(e){console.error(e)}};
const _leaveWorld=leaveWorld;window.leaveWorld=function(){if(VOICE.call&&VOICE.call.kind==='real')endReal(false);leaveRoom();_leaveWorld();const D=showData;if(D&&D._baseVendors)D.vendors=[...D._baseVendors]};
const _op=operateBooth;window.operateBooth=function(){_op();MP.room&&MP.room.track({op:true})};
const _lb=leaveBooth;window.leaveBooth=function(){_lb();MP.room&&MP.room.track({op:false})};
const _prox=FORMS.prox;FORMS.prox=f=>{const t=f.msg.value.trim();if(t&&MP.room)MP.room.send('say',{uid:MP.uid,n:ME.name,text:t.slice(0,200)});_prox(f)};

/* ================= real offers, orders and sales ================= */
async function newRow(o){try{return await NET.createOffer({by_user:MP.uid,show_key:MP.roomKey||null,...o})}catch(e){toast('Couldn’t send that: '+NET.friendly(e));return null}}
async function setRow(id,patch){try{const r=await NET.updateOffer(id,patch);processRow(r);return r}catch(e){toast('Couldn’t update that: '+NET.friendly(e));return null}}
function chatTo(v,m){(S.chat[v.id]=S.chat[v.id]||[]).push(m);try{renderLog(v)}catch(e){}}
const _respond=respond;
window.respond=function(v,c,amt){if(!v.real)return _respond(v,c,amt);
  newRow({kind:'offer',buyer:MP.uid,seller:v.uid,buyer_name:ME.name,seller_name:v.person||v.name,cards:[cardRef(c)],amount:amt}).then(r=>{if(r)chatTo(v,{f:'sys',t:`Offer of ${money(amt)} sent to ${v.person||v.name}. Their answer shows up here${v.online?'':' when they’re back online'}.`})})};
const _lotOffer=FORMS.lotOffer;
FORMS.lotOffer=f=>{const v=VBY[f.dataset.id];if(!v||!v.real)return _lotOffer(f);const cs=pickCards(v),amt=Math.round(parseFloat(f.amt.value.replace(/[$,]/g,''))*100)/100;if(!(amt>0)||!cs.length)return toast('Enter an offer for the lot');
  newRow({kind:'offer',buyer:MP.uid,seller:v.uid,buyer_name:ME.name,seller_name:v.person||v.name,cards:cs.map(cardRef),amount:amt}).then(r=>{if(!r)return;S.lot[v.id]={msg:`Lot offer of ${money(amt)} sent to ${v.person||v.name}. You’ll see their answer here.`};renderLot(v)})};
const _vwHold=ACT.vwHold;ACT.vwHold=async()=>{const v=VBY[VW.vid],c=findCard(VW.vid,VW.cid);if(!v||!v.real)return _vwHold();if(!c||c.sold)return;
  const r=await newRow({kind:'hold',buyer:MP.uid,seller:v.uid,buyer_name:ME.name,seller_name:v.person||v.name,cards:[cardRef(c)],amount:+c.price});if(r)toast(`Asked ${v.person||v.name} to hold it for 15 minutes`)};
ACT.ofTrade=id=>{const o=S.offers.find(x=>x.id===id);if(!o||!o.real)return;if(o.cds.some(c=>!c||c.sold))return toast('One of those cards already sold');
  /* seller perspective: I give o.cds, I get o.give, cash from them = +amount, so my cash = -amount */
  bookTrade(o.party,o.cds,o.give,-(+o.real.amount||0));S.offers=S.offers.filter(x=>x!==o);renderOffers();try{syncBooth(VBY.me)}catch(e){}refreshView&&refreshView();
  setRow(o.real.id,{status:'completed',by_user:MP.uid});toast(`Trade done with ${o.real.buyer_name}. Your cards to ship are on your packing list.`)};
FORMS.ofTradeCash=f=>{const o=S.offers.find(x=>x.id===f.dataset.id);if(!o||!o.real)return;const v=parseFloat(String(f.amt.value).replace(/[$,]/g,''));if(!(v>=0||v<0))return toast('Enter a cash amount');setRow(o.real.id,{status:'countered',amount:v,by_user:MP.uid});S.offers=S.offers.filter(x=>x!==o);renderOffers();toast(`Countered: ${v>0?money(v)+' cash from them':v<0?money(-v)+' cash from you':'straight up'}`)};
ACT.ofHold=id=>{const o=S.offers.find(x=>x.id===id);if(!o||!o.real)return;const until=Date.now()+15*60000;o.cds.forEach(c=>c.hold={uid:o.real.buyer,name:o.real.buyer_name,until});save(true);try{syncBooth(VBY.me)}catch(e){}
  setRow(o.real.id,{status:'accepted',by_user:MP.uid,note:String(until)});S.offers=S.offers.filter(x=>x!==o);renderOffers();toast(`Holding it for ${o.real.buyer_name} until ${new Date(until).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`)};
const _trTake=ACT.trTake;ACT.trTake=vid=>{const v=VBY[vid];if(!v||!v.real)return _trTake(vid);const T=tradeOf(v);if(!T.counterRow)return;const id=T.counterRow;T.counterRow=null;T.pendingRow=id;T.msg='Accepted. Waiting for them to finish the trade…';T.counter=null;renderVBody(v);
  NET.updateOffer(id,{status:'accepted',by_user:MP.uid}).then(r=>processRow(r)).catch(e=>toast('Couldn’t update that: '+NET.friendly(e)))};
async function cancelTradeRow(v,quiet){const T=tradeOf(v),id=T.pendingRow||T.counterRow;T.pendingRow=null;T.counterRow=null;T.counter=null;ME.inv.forEach(c=>{if(c.pendTrade===v.id){c.pending=false;delete c.pendTrade}});if(!id)return;const r=MP.rows[id];const ids=((r&&r.ship&&r.ship.give)||[]).map(x=>x.id);ME.inv.forEach(c=>{if(ids.includes(c.id)){c.pending=false;delete c.pendTrade}});
  try{await NET.updateOffer(id,{status:'cancelled',by_user:MP.uid})}catch(e){}if(!quiet)toast('Trade cancelled')}
const _trCancel=ACT.trCancel;ACT.trCancel=async vid=>{const v=VBY[vid];if(!v||!v.real)return _trCancel(vid);await cancelTradeRow(v);const T=tradeOf(v);T.msg=null;renderVBody(v)};
ACT.openTrade=vid=>{const v=VBY[vid];if(!v)return;S.vtab[vid]='trade';if(v.real)openReal(v.uid,'show');else openTable(v,'show')};
const _trSend=ACT.trSend;ACT.trSend=async vid=>{const v=VBY[vid];if(!v||!v.real)return _trSend(vid);{const T0=tradeOf(v);if(T0.pendingRow||T0.counterRow)await cancelTradeRow(v,true)}
  const {T,getC,giveC}=tradeParts(v),c=+T.cash||0;if(!getC.length)return toast('Pick something from their table first');
  const r=await newRow({kind:'trade',buyer:MP.uid,seller:v.uid,buyer_name:ME.name,seller_name:v.person||v.name,cards:getC.map(cardRef),amount:c,ship:{give:giveC.map(x=>({...cardRef(x),grade:x.grade,cost:x.cost}))}});
  if(!r)return;giveC.forEach(x=>{x.pending=true;x.pendTrade=v.id});T.pendingRow=r.id;T.msg=`Trade sent to ${v.person||v.name}. Their answer pops up here and on your screen.`;T.counter=null;MP.trades=MP.trades||{};MP.trades[r.id]=vid;renderVBody(v);toast('Trade proposal sent')};
const _doPitch=doPitch;
window.doPitch=function(v,c,k){if(!v.real)return _doPitch(v,c,k);S.pitch[k]={msg:`Pitched to ${v.person||v.name} at ${money(c.price)}. Their answer pops up when they respond.`,wait:true};
  newRow({kind:'pitch',buyer:v.uid,seller:MP.uid,buyer_name:v.person||v.name,seller_name:ME.name,cards:[cardRef(c)],amount:c.price})};
const _doBundle=doBundle;
window.doBundle=function(v,cs,amt){if(!v.real)return _doBundle(v,cs,amt);S.bundle[v.id]={ids:cs.map(c=>c.id),wait:true,msg:`Bundle of ${cs.length} pitched to ${v.person||v.name} at ${money(amt)}. Their answer pops up when they respond.`};
  newRow({kind:'pitch',buyer:v.uid,seller:MP.uid,buyer_name:v.person||v.name,seller_name:ME.name,cards:cs.map(cardRef),amount:amt})};
const _placeOrder=placeOrder;
window.placeOrder=ACT.placeOrder=async function(){if(!CO||CO.done)return;const {v,cs,tot,opts}=CO;if(!v.real)return _placeOrder();CO.done=true;
  const o=opts.find(x=>x.id===CO.ship),addr=($('#addr')?.value||CO.addr).trim();
  const r=await newRow({kind:'order',buyer:MP.uid,seller:v.uid,buyer_name:ME.name,seller_name:v.person||v.name,cards:cs.map(cardRef),amount:tot,ship:{id:o.id,payer:CO.payer,cost:o.cost,addr}});if(!r)return;
  cs.forEach(c=>{c.held=false;c.pending=true});S.deal[v.id]=[];try{renderInv(v)}catch(e){}
  openModal(`<div class="sec"><span class="eyebrow">Order sent</span><h2>Waiting for ${esc(v.person||v.name)}</h2><p>${cs.length} card${cs.length>1?'s':''} for ${money(tot)}${CO.payer==='buyer'?` plus ${money(o.cost)} shipping`:''}. ${v.online?'They’re online, so it should confirm in a moment.':'It confirms as soon as they’re back online.'} The cards land in your binder when it does.</p><p class="mute" style="font-size:12.5px">Demo money. Nothing is charged.</p><button class="btn gold" data-act="closeModal" style="justify-self:start">Keep shopping</button></div>`)};
/* seller: fulfill an order or an accepted deal */
function myCards(r){return r.cards.map(ref=>ME.inv.find(c=>c.id===ref.id&&!c.sold))}
MP.done=new Set();
function fulfill(r){if(MP.done.has(r.id))return;MP.done.add(r.id);const cds=myCards(r);if(cds.some(c=>!c))return setRow(r.id,{status:'declined',note:'Already sold',by_user:MP.uid});if(cds.some(c=>c.hold&&c.hold.until>Date.now()&&c.hold.uid&&c.hold.uid!==r.buyer))return setRow(r.id,{status:'declined',note:'On hold for another buyer',by_user:MP.uid});
  const party=realParty(r.buyer,r.buyer_name),opts=shipFor(cds,+r.amount),ship=opts.find(o=>o.id===r.ship?.id)||opts.find(o=>o.id===(+r.amount>=500?'pri':'bmwt'))||opts[0],payer=r.ship?.payer||'buyer';
  const res=completeSale(party,cds,+r.amount,ship,payer);if(Array.isArray(party.inv))party.inv=party.inv.filter(c=>!cds.some(x=>x.id===c.id&&c.owner===undefined));
  S.offers=S.offers.filter(o=>o.id!=='r_'+r.id);renderOffers();rerenderOpen();refreshView();try{logSale(r.buyer_name,cds,+r.amount)}catch(e){}
  toast(`Sold to ${r.buyer_name}: ${cds.length} card${cds.length>1?'s':''} for ${money(+r.amount)} · ${res.profit>=0?'profit':'loss'} ${signed(res.profit)}. It’s on your packing list.`);
  setRow(r.id,{status:'completed',by_user:MP.uid,ship:{id:ship.id,payer,cost:ship.cost,addr:r.ship?.addr||''}})}
function dockAdd(r){const cds=myCards(r);if(cds.some(c=>!c))return setRow(r.id,{status:'declined',note:'Already sold',by_user:MP.uid});
  const party=realParty(r.buyer,r.buyer_name);S.offers=S.offers.filter(o=>o.id!=='r_'+r.id);
  if(r.kind==='trade'){const give=(r.ship&&r.ship.give)||[];S.offers.unshift({id:'r_'+r.id,real:r,party,cds,cd:cds[0],amt:+r.amount,max:1e12,tries:0,kind:'trade',give,via:'Trade offer'});S.offersOpen=true;renderOffers();return toast(`${r.buyer_name} wants to trade for your ${cds.length>1?cds.length+' cards':cds[0].name}`)}
  if(r.kind==='hold'){S.offers.unshift({id:'r_'+r.id,real:r,party,cds,cd:cds[0],amt:+r.amount,max:1e12,tries:0,kind:'hold',via:'Hold request'});S.offersOpen=true;renderOffers();return toast(`${r.buyer_name} asked you to hold your ${cds[0].name}`)}
  S.offers.unshift({id:'r_'+r.id,real:r,party,cds,cd:cds[0],amt:+r.amount,max:1e12,tries:0,via:r.kind==='pitch'?`${r.buyer_name} countered your pitch`:`From ${r.buyer_name} · real person`,msg:r.note||''});
  S.offersOpen=true;renderOffers();toast(`${r.buyer_name} offered ${money(+r.amount)} for ${cds.length>1?cds.length+' of your cards':'your '+cds[0].name}`)}
function dockRemove(r){S.offers=S.offers.filter(o=>o.id!=='r_'+r.id);renderOffers()}
/* buyer: cards arrive when the seller confirms */
function receive(r){if(MP.got&&MP.got.has(r.id))return;(MP.got=MP.got||new Set()).add(r.id);
  const n=r.cards.length,amt=+r.amount,shipPaid=r.ship&&r.ship.payer==='buyer'?+r.ship.cost||0:0,al=allocate(r.cards,amt),no='SR-'+r.id.slice(0,5).toUpperCase(),ts=Date.now();
  r.cards.forEach((c,i)=>{const share=+(shipPaid*(amt?al[i]/amt:1/n)).toFixed(2),total=+(al[i]+share).toFixed(2);
    const L={no,fromName:r.seller_name,fromCity:'',toAddr:r.ship?.addr||ME.name,svc:'USPS GROUND ADVANTAGE',l:'G',cost:+(r.ship?.cost||0),payer:r.ship?.payer||'buyer',trk:genTrk(),cardName:n>1?`${n} cards`:c.name,grade:n>1?'lot':c.grade};
    ME.ledger.unshift({id:n>1?`${no}-${i+1}`:no,order:no,ts,side:'buy',card:{name:c.name,year:c.year,set:c.set,num:c.num,grade:c.grade,...(c.img?{img:c.img}:{})},party:r.seller_name,price:al[i],ship:share,total,where:S.view==='room'?showData.name:'Marketplace',label:L});
    ME.inv.unshift(mkMine({name:c.name,year:c.year,set:c.set,num:c.num,grade:c.grade,cost:total,price:c.price||al[i],mkt:c.mkt||c.price,forSale:false,from:r.seller_name}));const m=ME.inv[0];if(c.img)m.img=JSON.parse(JSON.stringify(c.img))});
  const v=VBY['u_'+r.seller];if(v){v.inv=v.inv.filter(c=>!r.cards.some(x=>x.id===c.id));try{renderInv(v)}catch(e){}chatTo(v,{f:'sys',t:`${r.seller_name} confirmed order ${no}. ${n>1?n+' cards are':'The card is'} in your binder.`})}
  save(true);renderTabs();refreshView();toast(`${r.seller_name} confirmed your order. ${n>1?n+' cards are':'The card is'} in your binder.`);
  NET.updateOffer(r.id,{received:true}).catch(()=>{})}
/* buyer: a counter or a pitch to answer */
function buyerNote(r){MP.notes=MP.notes.filter(x=>x.id!==r.id);MP.notes.push(r);const v=VBY['u_'+r.seller];
  if(v)chatTo(v,{f:'v',t:r.kind==='pitch'?`${r.seller_name} offers you ${r.cards.length>1?r.cards.length+' cards':r.cards[0].name} for ${money(+r.amount)}.`:`${r.seller_name} countered at ${money(+r.amount)}.`,btn:{act:'rAccept',id:r.id,label:`Accept ${money(+r.amount)}`}});
  showNote()}
function showNote(){const el=$('#dealNote'),r=MP.notes[0];if(!r){el.hidden=true;return}const names=r.cards.map(c=>c.name).join(', ');
  el.innerHTML=`<div class="av" style="background:${MP.profiles[r.seller]?.color||'#3db5ff'}">${initials(r.seller_name||'?')}</div><div style="min-width:0"><b>${r.kind==='pitch'?`${esc(r.seller_name)} offers you ${r.cards.length>1?r.cards.length+' cards':'a card'}`:`${esc(r.seller_name)} countered`}: ${money(+r.amount)}</b><span class="sub">${esc(names)}</span></div><button class="chbtn" data-act="rLater" data-id="${r.id}" aria-label="Later">×</button>
   <div class="acts"><button class="btn gold sm" data-act="rAccept" data-id="${r.id}">Accept ${money(+r.amount)}</button>${(()=>{const list=r.cards.reduce((t,c)=>t+(+c.price||0),0),k1=r.cards.length===1?`c:u_${r.seller}|${r.cards[0].id}`:`lot:u_${r.seller}`,mine=S.mine['r:'+r.id]||S.mine[k1];return mine&&mine<+r.amount?qcHTML('rCounter',r.id,list,+r.amount,mine):qoHTML('rCounter',r.id,+r.amount).replace('Quick offer','Quick counter')})()}<form data-form="rCounter" data-id="${r.id}" style="display:flex;gap:6px;flex:1 1 160px"><div class="amt sm" style="flex:1"><span class="mute">$</span><input name="amt" inputmode="decimal" placeholder="Custom" aria-label="Custom counter amount" autocomplete="off"></div><button class="btn ghost sm">Counter</button></form><button class="btn ghost sm" data-act="rDecline" data-id="${r.id}">Decline</button></div>`;el.hidden=false}
ACT.rAccept=id=>{const r=MP.rows[id];if(!r)return;MP.notes=MP.notes.filter(x=>x.id!==id);showNote();setRow(id,{status:'accepted',by_user:MP.uid});toast(`Accepted. ${r.seller_name} confirms and the cards land in your binder.`)};
ACT.rDecline=id=>{const r=MP.rows[id];MP.notes=MP.notes.filter(x=>x.id!==id);showNote();setRow(id,{status:'declined',by_user:MP.uid});if(r)toast(`Declined ${r.seller_name}’s ${r.kind==='pitch'?'offer':'counter'}`)};
ACT.rLater=id=>{MP.notes=MP.notes.filter(x=>x.id!==id).concat(MP.notes.filter(x=>x.id===id));$('#dealNote').hidden=true};
FORMS.rCounter=f=>{const id=f.dataset.id,amt=Math.round(parseFloat(f.amt.value.replace(/[$,]/g,''))*100)/100;if(!(amt>0))return toast('Enter a number');MP.notes=MP.notes.filter(x=>x.id!==id);showNote();setRow(id,{status:'countered',amount:amt,by_user:MP.uid});toast(`Counter of ${money(amt)} sent`)};
function processRow(r,initial){if(!r||!r.id||!MP.uid)return;const prev=MP.rows[r.id];if(prev&&prev.updated_at&&r.updated_at&&r.updated_at<prev.updated_at)return;if(prev&&['completed','declined','cancelled'].includes(prev.status)&&!['completed','declined','cancelled'].includes(r.status))return;MP.rows[r.id]=r;const key=r.id+'|'+r.status+'|'+r.amount+'|'+r.received;if(MP.seen.has(key))return;MP.seen.add(key);
  const seller=r.seller===MP.uid,buyer=r.buyer===MP.uid,mine=r.by_user===MP.uid,old=Date.now()-Date.parse(r.updated_at||r.created_at)>7*864e5;
  if(seller){if(r.status==='pending'&&r.kind==='order')return fulfill(r);
    if(r.status==='accepted'&&!mine&&r.kind==='trade'){if(MP.done.has(r.id))return;MP.done.add(r.id);const cds=myCards(r);if(cds.some(c=>!c))return setRow(r.id,{status:'declined',note:'Already sold',by_user:MP.uid});bookTrade(realParty(r.buyer,r.buyer_name),cds,(r.ship&&r.ship.give)||[],-(+r.amount||0));try{syncBooth(VBY.me)}catch(e){}refreshView&&refreshView();setRow(r.id,{status:'completed',by_user:MP.uid});return toast(`Trade done with ${r.buyer_name}`)}
    if(r.status==='accepted'&&!mine)return fulfill(r);
    if(old)return;
    if((r.status==='pending'&&(r.kind==='offer'||r.kind==='hold'||r.kind==='trade'))||(r.status==='countered'&&!mine))return dockAdd(r);
    if(r.status==='declined'&&!mine){dockRemove(r);if(!initial)toast(`${r.buyer_name} passed on your ${r.kind==='pitch'?'pitch':'counter'}`);return}
    if(r.status==='cancelled'||r.status==='completed')return dockRemove(r)}
  if(buyer&&r.kind==='trade'){const v=VBY['u_'+r.seller];
    if(r.status==='completed'&&!r.received){if(MP.got&&MP.got.has(r.id))return;(MP.got=MP.got||new Set()).add(r.id);const ids=((r.ship&&r.ship.give)||[]).map(x=>x.id),give=ME.inv.filter(c=>ids.includes(c.id)&&!c.sold);
      bookTrade(v||{name:r.seller_name,city:''},give,r.cards,+r.amount);if(v){v.inv.forEach(c=>{if(r.cards.some(x=>x.id===c.id))c.sold=true});const T=tradeOf(v);T.done=`${r.seller_name} accepted. You got ${r.cards.map(c=>c.name).join(', ')}. Your cards to ship are on your packing list.`;T.msg=null;T.pendingRow=null;T.counterRow=null;try{renderInv(v);renderVBody(v)}catch(e){}}
      refreshView&&refreshView();toast(`${r.seller_name} accepted your trade`);NET.updateOffer(r.id,{received:true}).catch(()=>{});return}
    if(r.status==='declined'&&!mine&&!initial){const ids=((r.ship&&r.ship.give)||[]).map(x=>x.id);ME.inv.forEach(c=>{if(ids.includes(c.id))c.pending=false});if(v){const T=tradeOf(v);T.pendingRow=null;T.counterRow=null;T.counter=null;T.msg=`${r.seller_name} passed on that trade${r.note?': '+r.note:''}.`;try{renderVBody(v)}catch(e){}chatTo(v,{f:'v',t:`${r.seller_name} passed on your trade.`})}toast(`${r.seller_name} passed on your trade`)}
    if(r.status==='countered'&&!mine&&!initial){if(v){const T=tradeOf(v);T.counter=+r.amount;T.msg=`${r.seller_name} would do it for ${+r.amount>0?money(+r.amount)+' cash from you':+r.amount<0?money(-r.amount)+' cash to you':'straight up'}.`;T.counterRow=r.id;T.pendingRow=null;try{renderVBody(v)}catch(e){}chatTo(v,{f:'v',t:`${r.seller_name} countered your trade: ${+r.amount>0?money(+r.amount)+' cash from you':+r.amount<0?money(-r.amount)+' cash to you':'straight up'}.`,btn:{act:'openTrade',id:v.id,label:'Open trade'}})}toast(`${r.seller_name} countered your trade. Open their table → Trade to answer.`)}
    return}
  if(buyer&&r.kind==='hold'){if(initial||mine)return;const v=VBY['u_'+r.seller],until=+(r.note||0);
    if(r.status==='accepted'){if(v)v.inv.forEach(c=>{if(r.cards.some(x=>x.id===c.id))c.hold={uid:MP.uid,name:ME.name,until}});if(v)chatTo(v,{f:'v',t:`${r.seller_name}: I’ll hold it for you until ${new Date(until).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}.`});toast(`${r.seller_name} is holding it for you until ${new Date(until).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`);rerenderOpen()}
    else if(r.status==='declined')toast(`${r.seller_name} can’t hold that one right now`);return}
  if(buyer){if(r.status==='completed'&&!r.received)return receive(r);
    if(old)return;
    if((r.status==='countered'&&!mine)||(r.status==='pending'&&r.kind==='pitch'&&!mine))return buyerNote(r);
    if(r.status==='declined'&&!mine&&!initial){const v=VBY['u_'+r.seller];if(v){v.inv.forEach(c=>{if(r.cards.some(x=>x.id===c.id))c.pending=false});chatTo(v,{f:'sys',t:`${r.seller_name} declined${r.note?': '+r.note:''}.`})}toast(`${r.seller_name} declined ${r.kind==='order'?'the order':'your offer'}${r.note?' ('+r.note+')':''}`)}}}
/* seller answers to real offers from the offers dock */
const _confirmSale=confirmSale;
window.confirmSale=ACT.confirmSale=function(){if(!SO||SO.done)return;const o=S.offers.find(x=>x.id===SO.offerId),real=o&&o.real,ship=SO.opts.find(x=>x.id===SO.ship),payer=SO.payer;_confirmSale();
  if(real)setRow(real.id,{status:'completed',by_user:MP.uid,amount:SO.price,ship:{id:ship.id,payer,cost:ship.cost}})};
const _confirmAll=confirmAll;
window.confirmAll=ACT.confirmAll=function(){const rows=(S.allRows||[]).filter(r=>r.o.real).map(r=>({row:r.o.real,ship:r.ship,amt:r.o.amt}));_confirmAll();
  rows.forEach(x=>setRow(x.row.id,{status:'completed',by_user:MP.uid,amount:x.amt,ship:{id:x.ship.id,payer:'buyer',cost:x.ship.cost}}))};
const _ofDecline=ACT.ofDecline;ACT.ofDecline=id=>{const o=S.offers.find(x=>x.id===id);if(o&&o.real)setRow(o.real.id,{status:'declined',by_user:MP.uid});_ofDecline(id)};
const _ofCounter=FORMS.ofCounter;FORMS.ofCounter=f=>{const o=S.offers.find(x=>x.id===f.dataset.id);if(!o||!o.real)return _ofCounter(f);const amt=Math.round(parseFloat(f.amt.value.replace(/[$,]/g,''))*100)/100;if(!(amt>0))return toast('Enter a number');
  setRow(o.real.id,{status:'countered',amount:amt,by_user:MP.uid});S.offers=S.offers.filter(x=>x!==o);renderOffers();toast(`Counter of ${money(amt)} sent to ${o.real.buyer_name}`)};

/* ================= marketplace: real people's tables ================= */
const _rmb=renderMarketBody;
window.renderMarketBody=function(){_rmb();const host=$('#mkbody');if(!host||MP.mkLoading)return;MP.mkLoading=true;
  NET.listings().then(async ls=>{MP.mkLoading=false;const by={};ls.forEach(l=>{if(l.owner!==MP.uid)(by[l.owner]=by[l.owner]||[]).push(l)});await loadParties(Object.keys(by).filter(u=>!MP.profiles[u]));
    Object.entries(by).forEach(([u,a])=>MP.listings[u]=a);const people=Object.keys(by);if(!$('#mkbody'))return;$('#realmk')?.remove();
    $('#mkbody').insertAdjacentHTML('afterbegin',`<div id="realmk"><div class="sectionlabel">Real people selling · ${people.length}</div>${people.length?`<div class="reallist">${people.map(u=>{const p=MP.profiles[u]||{name:'Collector'},a=by[u],on=!!MP.online[u],lo=Math.min(...a.map(l=>+l.price)),hi=Math.max(...a.map(l=>+l.price));
      return `<div class="realrow"><div class="vava" style="background:${p.color||'#3db5ff'};width:38px;height:38px;font-size:14px">${initials(p.table_name||p.name)}</div><div class="who"><b>${esc(p.role==='vendor'&&p.table_name?p.table_name:p.name)}</b><span><span class="dot ${on?'on':''}"></span> ${on?'Online now':'Offline · offers wait for them'} · ${a.length} card${a.length>1?'s':''} · ${money(lo)}${hi>lo?'–'+money(hi):''}</span></div><button class="btn gold sm" data-act="visitReal" data-id="${u}">Visit</button></div>`}).join('')}</div>`:'<p class="mute" style="margin-bottom:18px">Nobody else has cards for sale yet. Mark cards “For sale” in Inventory and they show up here for everyone.</p>'}</div>`)}).catch(()=>{MP.mkLoading=false})};
ACT.visitReal=uid=>openReal(uid,'market');

/* ================= real voice calls (WebRTC mesh, up to 6 people) ================= */
const RTC=window.RTC={peers:{},req:null};
const ICE=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}];
function sendRoom(ev,p){if(MP.room)MP.room.send(ev,{...p,from:MP.uid})}
function peerLevel(uid){return RTC.peers[uid]?.level||0}
function realCall(){const c=VOICE.call;return c&&c.kind==='real'?c:null}
function memberIds(c,all){return Object.keys(c.members).filter(u=>all||c.members[u].state!=='ringing')}
function pName(uid){return MP.peers[uid]?.name||realCall()?.members[uid]?.name||'Someone'}
function callLabel(c){const ids=Object.keys(c.members);if(!ids.length)return 'Call';const n=c.members[ids[0]].name;return ids.length>1?`${n} +${ids.length-1}`:n}
const _callPeople=callPeople;window.callPeople=function(c){if(!c||c.kind!=='real')return _callPeople(c);
  return Object.entries(c.members).map(([u,m])=>({key:'u:'+u,name:m.name,color:MP.peers[u]?.color||m.color||'#5a6a8a',state:m.state,talking:peerLevel(u)>.04,cards:true}))};
const _callCands=callCandidates;window.callCandidates=function(c){if(!c||c.kind!=='real')return _callCands(c);
  return Object.values(MP.peers).filter(p=>!c.members[p.uid]).map(p=>{const r=MP.ra[p.uid],d=r&&player?r.av.position.distanceTo(player.position):null;return {key:'u:'+p.uid,name:p.name,color:p.color,sub:(p.role==='vendor'?'Vendor':'Collector')+(d!=null&&r.av.visible?` · ${Math.round(d)} m away`:''),d:d??999}}).sort((a,b)=>a.d-b.d).slice(0,8)};
function ringTimer(uid){setTimeout(()=>{const c=realCall();if(!c||!c.members[uid]||c.members[uid].state!=='ringing')return;sendRoom('talk',{t:'cancel',to:uid,call:c.id});const n=c.members[uid].name;delete c.members[uid];
  if(!Object.keys(c.members).length){VOICE.call=null;renderCall();vNote(n,'No answer')}else{renderCall();toast(`No answer from ${n}`)}},25000)}
window.talkReal=function(uid){const p=MP.peers[uid];if(!p)return toast('They’re not in this show right now');
  const c0=VOICE.call;if(c0&&c0.kind==='real')return inviteReal(uid);if(c0)return toast('End your current call first');
  const wait=(VOICE.cool['u:'+uid]||0)-Date.now();if(wait>0)return vNote(p.name,'Not right now'),toast(`${p.name} said not right now. Try again in ${Math.ceil(wait/1000)}s.`);
  const id=Math.random().toString(36).slice(2,10)+Date.now().toString(36);
  VOICE.call={kind:'real',id,state:'ringing',uid,name:p.name,members:{[uid]:{name:p.name,color:p.color,state:'ringing'}}};renderCall();requestMic();
  sendRoom('talk',{t:'req',to:uid,call:id,name:ME.name,with:[]});ringTimer(uid)};
function inviteReal(uid){const c=realCall(),p=MP.peers[uid];if(!c||!p)return;if(c.members[uid])return toast(`${p.name} is already in the call`);
  if(Object.keys(c.members).length>=5)return toast('Calls max out at 6 people');
  const wait=(VOICE.cool['u:'+uid]||0)-Date.now();if(wait>0)return toast(`${p.name} said not right now. Try again in ${Math.ceil(wait/1000)}s.`);
  c.members[uid]={name:p.name,color:p.color,state:'ringing'};c.adding=false;renderCall();toast(`Asking ${p.name} to join…`);
  sendRoom('talk',{t:'req',to:uid,call:c.id,name:ME.name,with:memberIds(c).filter(u=>u!==uid).map(u=>({uid:u,name:c.members[u].name}))});ringTimer(uid)}
const _callInvite=ACT.callInvite;ACT.callInvite=k=>{if(k&&k.startsWith('u:'))return inviteReal(k.slice(2));_callInvite(k)};
function sendRoster(c){const ms=[{uid:MP.uid,name:ME.name}].concat(memberIds(c).map(u=>({uid:u,name:c.members[u].name})));memberIds(c).forEach(u=>sendRoom('talk',{t:'roster',to:u,call:c.id,members:ms}))}
function ensurePeers(){const c=realCall();if(!c)return;memberIds(c).forEach(u=>{if(!RTC.peers[u])startPeer(u,MP.uid<u)})}
function dropMember(uid,msg){const c=realCall();if(!c||!c.members[uid])return;const n=c.members[uid].name;delete c.members[uid];closePeer(uid);
  if(!Object.keys(c.members).length){closeAll();VOICE.call=null;renderCall();toast(msg||`${n} ended the call`)}
  else{if(!memberIds(c).some(u=>c.members[u].state==='live')&&c.state==='live')c.state='connecting';if(c.uid===uid){c.uid=Object.keys(c.members)[0];}c.name=callLabel(c);renderCall();toast(msg||`${n} left the call`)}}
function onTalk(d){if(d.to!==MP.uid)return;const from=d.from,name=d.name||MP.peers[from]?.name||'Someone',c=realCall();
  if(d.t==='req'){if(c&&c.id===d.call)return;if(VOICE.req&&!VOICE.call)clearReq();
    if(VOICE.call||!vprefs().requests)return sendRoom('talk',{t:'no',to:from,call:d.call,name:ME.name,busy:!!VOICE.call});
    RTC.req={from,call:d.call,name,with:d.with||[]};const others=(d.with||[]).map(x=>x.name),el=$('#vreq');
    el.innerHTML=`<div class="av" style="background:${MP.peers[from]?.color||'#5a6a8a'}">${initials(name)}</div><div><b>${others.length?`${esc(name)} invited you to a call`:`${esc(name)} wants to talk`}</b><span class="sub">${others.length?`With ${esc(others.join(', '))} · real voice`:'Real voice call · only you two hear it'}</span></div><span></span><div class="acts"><button class="btn gold sm" data-act="rtYes" data-id="${from}">${others.length?'Join':'Accept'}</button><button class="btn ghost sm" data-act="rtNo" data-id="${from}">Not right now</button></div>`;el.hidden=false;
    clearTimeout(RTC.reqT);RTC.reqT=setTimeout(()=>{if(RTC.req&&RTC.req.from===from){RTC.req=null;el.hidden=true}},24000)}
  else if(d.t==='cancel'){if(RTC.req&&RTC.req.from===from&&RTC.req.call===d.call){RTC.req=null;$('#vreq').hidden=true}}
  else if(d.t==='yes'){if(!c||c.id!==d.call||!c.members[from])return;c.members[from].state='connecting';if(c.state==='ringing'){c.state='connecting'}renderCall();sendRoster(c);ensurePeers()}
  else if(d.t==='no'){if(!c||c.id!==d.call||!c.members[from]||c.members[from].state!=='ringing')return;VOICE.cool['u:'+from]=Date.now()+30000;delete c.members[from];
    const txt=d.busy?'On another call':'Not right now';if(!Object.keys(c.members).length){VOICE.call=null;renderCall();vNote(name,txt)}else{renderCall();toast(`${name}: ${txt}`)}}
  else if(d.t==='roster'){if(!c||c.id!==d.call)return;(d.members||[]).forEach(m=>{if(m.uid===MP.uid||c.members[m.uid])return;c.members[m.uid]={name:m.name,color:MP.peers[m.uid]?.color,state:'connecting'};if(c.state==='live')toast(`${m.name} joined the call`)});c.name=callLabel(c);renderCall();ensurePeers()}
  else if(d.t==='end'||d.t==='leave'){if(c&&(!d.call||c.id===d.call))dropMember(from,Object.keys(c.members).length>1?`${name} left the call`:`${name} ended the call`)}}
ACT.rtYes=async uid=>{const q=RTC.req;RTC.req=null;$('#vreq').hidden=true;const p=MP.peers[uid];if(!p||!q)return;
  const ms={[uid]:{name:p.name,color:p.color,state:'connecting'}};q.with.forEach(x=>{if(x.uid!==MP.uid)ms[x.uid]={name:x.name,color:MP.peers[x.uid]?.color,state:'connecting'}});
  VOICE.call={kind:'real',id:q.call,state:'connecting',uid,name:p.name,members:ms};VOICE.call.name=callLabel(VOICE.call);renderCall();await requestMic();sendRoom('talk',{t:'yes',to:uid,call:q.call,name:ME.name});ensurePeers()};
ACT.rtNo=uid=>{const q=RTC.req;RTC.req=null;$('#vreq').hidden=true;sendRoom('talk',{t:'no',to:uid,call:q?.call,name:ME.name});toast(`You told ${MP.peers[uid]?.name||'them'}: Not right now`)};
function startPeer(uid,caller){const c=realCall();if(!c)return null;closePeer(uid);
  const pc=new RTCPeerConnection({iceServers:ICE}),P=RTC.peers[uid]={pc,uid,call:c.id,queue:[],level:0,chain:Promise.resolve()};
  pc.onicecandidate=e=>{if(e.candidate)sendRoom('rtc',{to:uid,call:P.call,cand:e.candidate.toJSON()})};
  pc.ontrack=e=>{const st=e.streams[0]||new MediaStream([e.track]);if(!P.audio){P.audio=new Audio();P.audio.autoplay=true;P.audio.playsInline=true}P.audio.srcObject=st;P.audio.play().catch(()=>toast('Tap anywhere to hear them'));
    try{const C=window.AudioContext||window.webkitAudioContext;RTC.ctx=RTC.ctx||new C();const src=RTC.ctx.createMediaStreamSource(st);P.an=RTC.ctx.createAnalyser();P.an.fftSize=512;P.buf=new Uint8Array(512);src.connect(P.an)}catch(err){}};
  const onState=()=>{const s=pc.connectionState,ice=pc.iceConnectionState,c=realCall();if(!c||RTC.peers[uid]!==P||!c.members[uid])return;
    if(s==='connected'||ice==='connected'||ice==='completed'){if(c.members[uid].state==='live')return;c.members[uid].state='live';if(c.state!=='live'){c.state='live';c.start=c.start||Date.now()}renderCall()}
    else if(s==='failed'||ice==='failed'){dropMember(uid,`Voice couldn’t connect to ${c.members[uid].name} on this network. Use chat instead.`)}};
  pc.onconnectionstatechange=onState;pc.oniceconnectionstatechange=onState;
  P.chain=P.chain.then(async()=>{await requestMic();if(VOICE.stream)VOICE.stream.getAudioTracks().forEach(t=>{t.enabled=!(realCall()&&realCall().muted);pc.addTrack(t,VOICE.stream)});else pc.addTransceiver('audio',{direction:'recvonly'});
    if(caller){const off=await pc.createOffer();await pc.setLocalDescription(off);sendRoom('rtc',{to:uid,call:P.call,sdp:pc.localDescription.toJSON()})}}).catch(e=>console.error(e));
  return P}
function onRtc(d){if(d.to!==MP.uid)return;const c=realCall();if(!c||d.call!==c.id)return;let P=RTC.peers[d.from];
  if(!P){if(!c.members[d.from])c.members[d.from]={name:pName(d.from),color:MP.peers[d.from]?.color,state:'connecting'};P=startPeer(d.from,false);if(!P)return}
  P.chain=P.chain.then(async()=>{const pc=P.pc;if(d.sdp){await pc.setRemoteDescription(d.sdp);if(d.sdp.type==='offer'){const ans=await pc.createAnswer();await pc.setLocalDescription(ans);sendRoom('rtc',{to:d.from,call:P.call,sdp:pc.localDescription.toJSON()})}
      for(const x of P.queue)await pc.addIceCandidate(x).catch(()=>{});P.queue=[]}
    if(d.cand){if(pc.remoteDescription)await pc.addIceCandidate(d.cand).catch(()=>{});else P.queue.push(d.cand)}}).catch(e=>console.error(e))}
function closePeer(uid){const P=RTC.peers[uid];if(!P)return;try{P.pc.close()}catch(e){}if(P.audio){P.audio.srcObject=null}delete RTC.peers[uid]}
function closeAll(){Object.keys(RTC.peers).forEach(closePeer)}
function endReal(silent,msg){const c=realCall();if(c&&!silent)Object.keys(c.members).forEach(u=>sendRoom('talk',{t:c.members[u].state==='ringing'?'cancel':'leave',to:u,call:c.id,name:ME.name}));closeAll();VOICE.call=null;renderCall();if(msg)toast(msg)}
window.endReal=endReal;
const _endCall=endCall;window.endCall=function(msg){const c=realCall();if(c){const g=Object.keys(c.members).length>1;return endReal(false,msg||(g?'You left the call':`Call with ${c.name} ended`))}return _endCall(msg)};
ACT.endCall=()=>endCall();
const _callMute=ACT.callMute;ACT.callMute=()=>{_callMute();const c=realCall();if(c&&VOICE.stream)VOICE.stream.getAudioTracks().forEach(t=>t.enabled=!c.muted)};
const _callCards=ACT.callCards;ACT.callCards=id=>{const c=realCall();if(c){c.min=true;c.adding=false;renderCall();const u=id&&id.startsWith('u:')?id.slice(2):c.uid;return openReal(u,'show')}_callCards(id)};
const _talkTo=ACT.talkTo;ACT.talkTo=n=>{const r=Object.values(MP.peers).find(p=>p.name===n);if(r)return talkReal(r.uid);_talkTo(n)};
const _boothVoice=ACT.boothVoice;ACT.boothVoice=id=>{const v=VBY[id];if(v&&v.real)return talkReal(v.uid);_boothVoice(id)};
setInterval(()=>{for(const P of Object.values(RTC.peers)){if(P.an){P.an.getByteTimeDomainData(P.buf);let s=0;for(let i=0;i<P.buf.length;i++){const x=(P.buf[i]-128)/128;s+=x*x}P.level=Math.sqrt(s/P.buf.length)}else P.level=0}
  const c=realCall();if(c&&c.state==='live')callTickUI(c)},150);
document.addEventListener('pointerdown',()=>{for(const P of Object.values(RTC.peers)){if(P.audio&&P.audio.paused&&P.audio.srcObject)P.audio.play().catch(()=>{})}},true);


/* ================= who's online + activity pop-ups ================= */
document.head.insertAdjacentHTML('beforeend',`<style>
.onl{display:inline-flex;align-items:center;gap:7px;font-family:var(--f-body,Figtree),sans-serif;font-style:normal;text-transform:none;font-weight:700;font-size:13px;color:var(--ink);background:rgba(60,207,126,.1);border:1px solid rgba(60,207,126,.35);border-radius:999px;padding:4px 11px;cursor:pointer;white-space:nowrap;margin-left:6px}
.onl i{width:8px;height:8px;border-radius:50%;background:var(--go);box-shadow:0 0 0 0 rgba(60,207,126,.6);animation:onlp 2s infinite;margin:0!important}
@keyframes onlp{0%{box-shadow:0 0 0 0 rgba(60,207,126,.55)}70%{box-shadow:0 0 0 7px rgba(60,207,126,0)}100%{box-shadow:0 0 0 0 rgba(60,207,126,0)}}
.onl.onla{margin:0;cursor:default}
.onl[hidden],#authOnl[hidden]{display:none!important}
.realn{display:inline-flex;align-items:center;gap:6px;color:var(--go)}.realn i{width:7px;height:7px;border-radius:50%;background:var(--go)}
#feedPop{position:fixed;left:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:30;width:min(340px,calc(100vw - 32px));background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:0 16px 40px rgba(0,0,0,.55);padding:11px 12px;display:grid;grid-template-columns:auto 1fr auto;gap:11px;align-items:center;transform:translateY(16px);opacity:0;transition:transform .35s ease,opacity .35s ease;pointer-events:none}
#feedPop.on{transform:none;opacity:1;pointer-events:auto}
#feedPop .fa{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;font-weight:800;font-size:13px;color:#fff;flex:none}
#feedPop b{display:block;font-size:13.5px;line-height:1.3}#feedPop .fs{font-size:12px;color:var(--mute);margin-top:2px;display:block}
#feedPop .fs em{font-style:normal;color:var(--go);font-weight:700}
#feedPop .slab{transform:scale(.8);transform-origin:center}
body.hasdock #feedPop{bottom:calc(76px + env(safe-area-inset-bottom,0px))}
</style>`);
document.body.insertAdjacentHTML('beforeend','<div id="feedPop" role="status" aria-live="polite"></div>');
const LIVE=window.LIVE={count:0,list:[],feed:[],shown:new Set(),q:[],t:null,watch:null};
try{(JSON.parse(sessionStorage.getItem('sr:seen')||'[]')).forEach(x=>LIVE.shown.add(x))}catch(e){}
function lobbySync(list){const by={};list.forEach(p=>{if(p&&p.uid)by[p.uid]=p});MP.online={};Object.values(by).forEach(p=>{if(p.uid!==MP.uid)MP.online[p.uid]=p});LIVE.list=Object.values(by);LIVE.count=LIVE.list.length;paintOnline()}
function onlineText(n){return `${n.toLocaleString()} ${n===1?'user':'users'} online`}
function paintOnline(){const n=LIVE.count;let c=$('#onl');const brand=$('#topbar .brand');if(!c&&brand){brand.insertAdjacentHTML('beforeend','<button class="onl" id="onl" data-act="whoOnline"><i></i><span></span></button>');c=$('#onl')}
  if(c){c.hidden=!n;c.querySelector('span').textContent=onlineText(n)}const a=$('#authOnl');if(a){a.hidden=!n;a.querySelector('.onl>span').textContent=n?`${onlineText(n)} right now`:''}
  if(S.view==='shows')paintShowCounts()}
function inShow(key){return LIVE.list.filter(p=>p.show===key).length}
function paintShowCounts(){document.querySelectorAll('.shows article').forEach(a=>{const b=a.querySelector('[data-id]');const s=b&&SHOWS.find(x=>x.id===b.dataset.id);if(!s)return;const n=inShow(s.id),f=a.querySelector('.facts');if(!f)return;let el=f.querySelector('.realn');
    if(!n){el&&el.remove();return}if(!el){f.insertAdjacentHTML('beforeend','<span class="realn"><i></i><span></span></span>');el=f.querySelector('.realn')}el.lastChild.textContent=`${n} real ${n===1?'person':'people'} inside`});
  const hb=$('.hostbar .mute');if(hb){const live=SHOWS.filter(s=>s.db&&s.live).length;hb.textContent=`${live} live show${live===1?'':'s'} made by people on Slab Row · ${onlineText(LIVE.count)}`}}
ACT.whoOnline=()=>{const ps=LIVE.list.slice().sort((a,b)=>(b.uid===MP.uid)-(a.uid===MP.uid));const where=p=>{if(!p.show)return 'Browsing';const s=SHOWS.find(x=>x.id===p.show);return s?`At ${s.name}`:'At a show'};
  openModal(`<div class="sec"><span class="eyebrow">Live right now</span><h2>${onlineText(ps.length)}</h2><p class="mute" style="margin:0 0 10px">Real signed-in people only. The crowd you see walking around at shows is extra.</p>${ps.map(p=>`<div class="realrow"><div class="vava" style="background:${MP.profiles[p.uid]?.color||p.color||'#3db5ff'};width:34px;height:34px;font-size:13px">${initials(p.name||'?')}</div><div class="who"><b>${esc(p.name||'Collector')}${p.uid===MP.uid?' (you)':''}</b><span>${esc(where(p))}</span></div>${p.show&&p.uid!==MP.uid&&SHOWS.find(x=>x.id===p.show)?`<button class="btn ghost sm" data-act="enter" data-id="${p.show}">Join them</button>`:''}</div>`).join('')}</div>`)};
/* listen-only presence before sign-in, so the sign-in screen shows the real count */
function watchLobby(){if(LIVE.watch||MP.lobby)return;try{LIVE.watch=NET.channel('lobby',null,{sync:lobbySync})}catch(e){}}
window.joinLobby=async function(){const w=LIVE.watch;LIVE.watch=null;if(w){try{await w.leave()}catch(e){}}MP.lobby=NET.channel('lobby',{uid:MP.uid,name:ME.name,show:MP.roomKey||null},{sync:lobbySync})};
/* activity feed: sign-ups, new shows, notable sales */
function notable(amount,cards){amount=+amount||0;const tens=(cards||[]).some(c=>/\b10\b/.test(c.grade||''));return amount>=100||(tens&&amount>=40)||((cards||[]).length>=3&&amount>=150)}
function cardLine(c){return [c.year,c.set,c.name,c.grade&&c.grade!=='Raw'?c.grade:''].filter(Boolean).join(' ')}
function logSale(buyer,cards,amount){if(!notable(amount,cards))return;const seller=ME.role==='vendor'&&ME.table?ME.table:ME.name;
  NET.addActivity('sale',{buyer:buyer||'Someone',seller,amount:+amount,n:cards.length,cards:cards.slice(0,3).map(c=>({name:c.name,year:c.year||'',set:c.set||'',grade:c.grade||''})),show:S.view==='room'&&showData?showData.name:null}).catch(()=>{})}
window.logSale=logSale;
function ago(t){const s=Math.max(0,(Date.now()-Date.parse(t))/1000);return s<60?'just now':s<3600?`${Math.floor(s/60)} min ago`:s<86400?`${Math.floor(s/3600)} hr ago`:`${Math.floor(s/86400)} d ago`}
function feedHTML(a){const d=a.data||{},col=a.kind==='sale'?'#3db5ff':a.kind==='show'?'#ff7a2f':'#3ccf7e';
  if(a.kind==='sale'){const c=(d.cards||[])[0]||{},one=d.n===1;return `<div class="fa" style="background:${col}">$</div><div style="min-width:0"><b>${esc(d.buyer)} picked up ${one?esc(cardLine(c)):`${d.n} cards`}</b><span class="fs"><em>${money(d.amount)}</em> from ${esc(d.seller)}${d.show?` at ${esc(d.show)}`:''} · ${ago(a.created_at)}</span></div>`}
  if(a.kind==='show')return `<div class="fa" style="background:${col}">${initials(d.host||'?')}</div><div style="min-width:0"><b>${esc(d.host)} is hosting ${esc(d.name)}</b><span class="fs">New show on Slab Row · ${ago(a.created_at)}</span></div>`;
  return `<div class="fa" style="background:${col}">${initials(d.name||'?')}</div><div style="min-width:0"><b>${esc(d.name)} just joined Slab Row</b><span class="fs">New account · ${ago(a.created_at)}</span></div>`}
function feedOK(a){if(!a||!a.data)return false;if(MP.uid&&a.actor===MP.uid)return false;if(a.kind==='sale')return notable(a.data.amount,a.data.cards);return a.kind==='join'||a.kind==='show'}
function feedView(){return (S.view==='shows'||S.view==='auth')&&$('#modal').hidden&&document.visibilityState==='visible'}
function feedNext(){clearTimeout(LIVE.t);if(!feedView()){LIVE.t=setTimeout(feedNext,4000);return}
  const a=LIVE.q.shift()||LIVE.feed.find(x=>!LIVE.shown.has(x.kind+x.id));if(!a){LIVE.t=setTimeout(feedNext,15000);return}
  LIVE.shown.add(a.kind+a.id);try{sessionStorage.setItem('sr:seen',JSON.stringify([...LIVE.shown].slice(-200)))}catch(e){}
  const el=$('#feedPop');document.body.classList.toggle('hasdock',!!$('#offers .odock'));el.innerHTML=feedHTML(a)+'<button class="chbtn" data-act="feedX" aria-label="Dismiss">×</button>';el.classList.add('on');
  LIVE.t=setTimeout(()=>{el.classList.remove('on');LIVE.t=setTimeout(feedNext,rnd(7000,12000))},6000)}
ACT.feedX=()=>{$('#feedPop').classList.remove('on');clearTimeout(LIVE.t);LIVE.t=setTimeout(feedNext,15000)};
async function startFeed(){if(LIVE.started)return;LIVE.started=true;
  try{const rows=await NET.activity(40);const wk=Date.now()-7*864e5;LIVE.feed=rows.filter(a=>feedOK(a)&&Date.parse(a.created_at)>wk)}catch(e){LIVE.feed=[]}
  try{NET.onActivity(a=>{if(!feedOK(a))return;LIVE.feed.unshift(a);LIVE.q.push(a);if(!$('#feedPop').classList.contains('on')){clearTimeout(LIVE.t);LIVE.t=setTimeout(feedNext,600)}})}catch(e){}
  LIVE.t=setTimeout(feedNext,2500)}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')$('#feedPop')?.classList.remove('on')});
/* hook into the app */
function authHook(){const p=$('.authcard .mute');if(p&&!$('#authOnl'))p.insertAdjacentHTML('afterend','<div id="authOnl" hidden><span class="onl onla"><i></i><span></span></span></div>');watchLobby();paintOnline();startFeed()}
const _rs2=window.renderShows;window.renderShows=function(){_rs2();paintShowCounts();startFeed()};
const _authForm=FORMS.authForm;FORMS.authForm=async f=>{const signup=authMode==='signup',name=(f.name?.value||'').trim();await _authForm(f);if(signup&&MP.uid)NET.addActivity('join',{name:ME?.name||name}).catch(()=>{})};
const _cs2=window.confirmSale;window.confirmSale=ACT.confirmSale=function(){if(!SO||SO.done)return;const o=S.offers.find(x=>x.id===SO.offerId),real=o&&o.real,price=SO.price,cds=o?o.cds.slice():[];_cs2();if(real)logSale(real.buyer_name,cds,price)};
const _ca2=window.confirmAll;window.confirmAll=ACT.confirmAll=function(){const rows=(S.allRows||[]).filter(r=>r.o.real).map(r=>({b:r.o.real.buyer_name,cds:r.o.cds.slice(),amt:r.o.amt}));_ca2();rows.forEach(x=>logSale(x.b,x.cds,x.amt))};

/* ================= start ================= */
(async()=>{$('#topbar').hidden=true;$('#app').innerHTML='<div class="auth"><p class="mute">Loading…</p></div>';
  let s=null;try{s=await NET.session()}catch(e){}
  if(s){try{await afterLogin(s)}catch(e){console.error(e);renderAuth('Couldn’t load your account: '+NET.friendly(e))}}else renderAuth()})();
})();
