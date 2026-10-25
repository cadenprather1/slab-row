/* Slab Row network layer.
   NET has one interface and two backends:
   - Supabase (the live site): accounts, database, storage, realtime rooms.
   - Local (?local in the URL, or no config): everything in this browser, with
     BroadcastChannel standing in for realtime, so two tabs act as two people. */
(function(){
  const cfg=window.SLABROW_CONFIG||{};
  const EVENTS=['pos','say','talk','rtc','booth','spk','ping'];
  const iso=()=>new Date().toISOString();
  const rid=()=>(crypto.randomUUID?crypto.randomUUID():'x'+Date.now().toString(36)+Math.random().toString(36).slice(2));
  const friendly=e=>{const m=(e&&(e.message||e.error_description||e.msg))||String(e||'Something went wrong');
    if(/Invalid login/i.test(m))return 'That email and password don’t match an account.';
    if(/already registered|already exists/i.test(m))return 'There’s already an account with that email. Sign in instead.';
    if(/Password should be/i.test(m))return 'Use a password with at least 6 characters.';
    if(/rate limit/i.test(m))return 'Too many tries. Wait a minute and try again.';
    if(/Failed to fetch|NetworkError|Load failed/i.test(m))return 'Can’t reach the server. Check your connection.';
    return m};

  /* ---------------- Supabase ---------------- */
  function supa(){
    const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'slabrow-auth'}});
    const ok=r=>{if(r.error)throw r.error;return r.data};
    return {
      mode:'supabase',friendly,
      async session(){const {data}=await sb.auth.getSession();const u=data.session?.user;return u?{uid:u.id,email:u.email}:null},
      async signUp(email,password,name){const r=await sb.auth.signUp({email,password,options:{data:{name}}});if(r.error)throw r.error;
        if(!r.data.session)throw new Error('Check your email to confirm your account, then sign in.');return {uid:r.data.user.id,email}},
      async signIn(email,password){const r=await sb.auth.signInWithPassword({email,password});if(r.error)throw r.error;return {uid:r.data.user.id,email}},
      async signOut(){await sb.auth.signOut()},
      async getProfile(uid){return ok(await sb.from('profiles').select('*').eq('id',uid).maybeSingle())},
      async profiles(ids){ids=[...new Set(ids)].filter(Boolean);if(!ids.length)return {};const d=ok(await sb.from('profiles').select('*').in('id',ids));return Object.fromEntries(d.map(p=>[p.id,p]))},
      async saveProfile(uid,p){ok(await sb.from('profiles').upsert({id:uid,...p,updated_at:iso()}))},
      async loadState(uid){const d=ok(await sb.from('user_state').select('me').eq('id',uid).maybeSingle());return d?d.me:null},
      async saveState(uid,me){ok(await sb.from('user_state').upsert({id:uid,me,updated_at:iso()}))},
      async syncListings(uid,rows){const cur=ok(await sb.from('listings').select('card_id').eq('owner',uid));const keep=new Set(rows.map(r=>r.card_id));const del=cur.map(r=>r.card_id).filter(id=>!keep.has(id));
        if(rows.length)ok(await sb.from('listings').upsert(rows.map(r=>({owner:uid,...r,updated_at:iso()}))));
        if(del.length)ok(await sb.from('listings').delete().eq('owner',uid).in('card_id',del))},
      async listings(owner){let q=sb.from('listings').select('*');if(owner)q=q.eq('owner',owner);return ok(await q.limit(3000))},
      async listShows(){return ok(await sb.from('shows').select('*').order('starts_at',{ascending:true}).limit(300))},
      async createShow(s){return ok(await sb.from('shows').insert(s).select().single())},
      async deleteShow(id){ok(await sb.from('shows').delete().eq('id',id))},
      async booths(show){return ok(await sb.from('booths').select('*').eq('show_key',show))},
      async claimBooth(show,uid,slot){const r=await sb.from('booths').insert({show_key:show,user_id:uid,slot});if(r.error)throw r.error},
      async releaseBooth(show,uid){ok(await sb.from('booths').delete().eq('show_key',show).eq('user_id',uid))},
      async createOffer(o){return ok(await sb.from('offers').insert(o).select().single())},
      async updateOffer(id,patch){return ok(await sb.from('offers').update({...patch,updated_at:iso()}).eq('id',id).select().single())},
      async myOffers(uid){return ok(await sb.from('offers').select('*').or(`buyer.eq.${uid},seller.eq.${uid}`).order('created_at',{ascending:false}).limit(400))},
      onOffers(uid,cb){const ch=sb.channel('offers-'+uid);
        ch.on('postgres_changes',{event:'*',schema:'public',table:'offers',filter:`buyer=eq.${uid}`},p=>cb(p.new&&p.new.id?p.new:p.old));
        ch.on('postgres_changes',{event:'*',schema:'public',table:'offers',filter:`seller=eq.${uid}`},p=>cb(p.new&&p.new.id?p.new:p.old));
        ch.subscribe();return ()=>sb.removeChannel(ch)},
      async activity(limit){return ok(await sb.from('activity').select('*').order('created_at',{ascending:false}).limit(limit||40))},
      async addActivity(kind,data){ok(await sb.from('activity').insert({kind,data}))},
      onActivity(cb){const ch=sb.channel('activity-feed');ch.on('postgres_changes',{event:'INSERT',schema:'public',table:'activity'},p=>p.new&&cb(p.new));ch.subscribe();return ()=>sb.removeChannel(ch)},
      onBooths(show,cb){const ch=sb.channel('booths-'+show);ch.on('postgres_changes',{event:'*',schema:'public',table:'booths',filter:`show_key=eq.${show}`},()=>cb());ch.subscribe();return ()=>sb.removeChannel(ch)},
      async uploadPhoto(uid,blob){const path=`${uid}/${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}.jpg`;
        const r=await sb.storage.from('photos').upload(path,blob,{contentType:'image/jpeg',cacheControl:'31536000',upsert:false});if(r.error)throw r.error;return path},
      photoURL(path){return sb.storage.from('photos').getPublicUrl(path).data.publicUrl},
      async deletePhoto(path){try{await sb.storage.from('photos').remove([path])}catch(e){}},
      channel(name,presence,h){
        const ch=sb.channel(name,{config:{presence:{key:presence?presence.uid:''},broadcast:{self:false,ack:false}}});
        ch.on('presence',{event:'sync'},()=>{const st=ch.presenceState();h.sync&&h.sync(Object.values(st).map(a=>a[a.length-1]).filter(Boolean))});
        EVENTS.forEach(ev=>ch.on('broadcast',{event:ev},m=>h.msg&&h.msg(ev,m.payload)));
        let ready=false,state={...presence};
        ch.subscribe(st=>{if(st==='SUBSCRIBED'){ready=true;if(presence)ch.track(state)}else if(st==='CHANNEL_ERROR'||st==='TIMED_OUT'){h.error&&h.error(st)}});
        return {send(ev,p){if(ready)ch.send({type:'broadcast',event:ev,payload:p})},track(p){if(!presence)return;state={...state,...p};if(ready)ch.track(state)},leave(){try{if(presence)ch.untrack()}catch(e){}return sb.removeChannel(ch)}}}
    }}

  /* ---------------- Local (tests / no server) ---------------- */
  function local(){
    const T=k=>{try{return JSON.parse(localStorage.getItem('L:'+k)||'[]')}catch(e){return []}};
    const W=(k,v)=>localStorage.setItem('L:'+k,JSON.stringify(v));
    const bc=new BroadcastChannel('L:rt');const subs=new Set();bc.onmessage=e=>subs.forEach(f=>f(e.data));
    const emit=d=>{bc.postMessage(d);subs.forEach(f=>f(d))};
    const sess=()=>{try{return JSON.parse(sessionStorage.getItem('L:sess'))}catch(e){return null}};
    const dbEvent=(table,row)=>emit({type:'db',table,row});
    const wait=()=>new Promise(r=>setTimeout(r,20));
    return {
      mode:'local',friendly,
      async session(){return sess()},
      async signUp(email,password,name){await wait();const us=T('users');if(us.some(u=>u.email===email.toLowerCase()))throw new Error('already registered');if(password.length<6)throw new Error('Password should be at least 6');
        const u={uid:rid(),email:email.toLowerCase(),pw:password};us.push(u);W('users',us);const ps=T('profiles');ps.push({id:u.uid,name,role:'collector'});W('profiles',ps);sessionStorage.setItem('L:sess',JSON.stringify({uid:u.uid,email:u.email}));return {uid:u.uid,email:u.email}},
      async signIn(email,password){await wait();const u=T('users').find(x=>x.email===email.toLowerCase()&&x.pw===password);if(!u)throw new Error('Invalid login');sessionStorage.setItem('L:sess',JSON.stringify({uid:u.uid,email:u.email}));return {uid:u.uid,email:u.email}},
      async signOut(){sessionStorage.removeItem('L:sess')},
      async getProfile(uid){return T('profiles').find(p=>p.id===uid)||null},
      async profiles(ids){const s=new Set(ids);return Object.fromEntries(T('profiles').filter(p=>s.has(p.id)).map(p=>[p.id,p]))},
      async saveProfile(uid,p){const ps=T('profiles').filter(x=>x.id!==uid);ps.push({...(T('profiles').find(x=>x.id===uid)||{}),id:uid,...p});W('profiles',ps)},
      async loadState(uid){const r=T('state').find(x=>x.id===uid);return r?r.me:null},
      async saveState(uid,me){const st=T('state').filter(x=>x.id!==uid);st.push({id:uid,me});W('state',st)},
      async syncListings(uid,rows){const ls=T('listings').filter(l=>l.owner!==uid);rows.forEach(r=>ls.push({owner:uid,...r,updated_at:iso()}));W('listings',ls)},
      async listings(owner){return T('listings').filter(l=>!owner||l.owner===owner)},
      async listShows(){return T('shows').sort((a,b)=>String(a.starts_at).localeCompare(String(b.starts_at)))},
      async createShow(s){const sh=T('shows');const r={id:rid(),created_at:iso(),...s};sh.push(r);W('shows',sh);return r},
      async deleteShow(id){W('shows',T('shows').filter(s=>s.id!==id))},
      async booths(show){return T('booths').filter(b=>b.show_key===show)},
      async claimBooth(show,uid,slot){const bs=T('booths');if(bs.some(b=>b.show_key===show&&(b.slot===slot||b.user_id===uid)))throw new Error('duplicate key');const r={show_key:show,user_id:uid,slot};bs.push(r);W('booths',bs);dbEvent('booths',r)},
      async releaseBooth(show,uid){W('booths',T('booths').filter(b=>!(b.show_key===show&&b.user_id===uid)));dbEvent('booths',{show_key:show})},
      async createOffer(o){const os=T('offers');const r={id:rid(),created_at:iso(),updated_at:iso(),status:'pending',...o};os.push(r);W('offers',os);dbEvent('offers',r);return r},
      async updateOffer(id,patch){const os=T('offers');const i=os.findIndex(o=>o.id===id);if(i<0)throw new Error('missing');os[i]={...os[i],...patch,updated_at:iso()};W('offers',os);dbEvent('offers',os[i]);return os[i]},
      async myOffers(uid){return T('offers').filter(o=>o.buyer===uid||o.seller===uid).reverse()},
      onOffers(uid,cb){const f=d=>{if(d.type==='db'&&d.table==='offers'&&(d.row.buyer===uid||d.row.seller===uid))cb(d.row)};subs.add(f);return ()=>subs.delete(f)},
      onBooths(show,cb){const f=d=>{if(d.type==='db'&&d.table==='booths'&&d.row.show_key===show)cb()};subs.add(f);return ()=>subs.delete(f)},
      async uploadPhoto(uid,blob){const path=`${uid}/${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}.jpg`;
        const d=await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(blob)});try{localStorage.setItem('L:ph:'+path,d)}catch(e){throw new Error('this browser is out of room for photos')}return path},
      photoURL(path){return localStorage.getItem('L:ph:'+path)||''},
      async deletePhoto(path){localStorage.removeItem('L:ph:'+path)},
      async activity(limit){return T('activity').slice(-(limit||40)).reverse()},
      async addActivity(kind,data){const s=sess();const a=T('activity');const row={id:a.length+1,kind,actor:s&&s.uid,data,created_at:new Date().toISOString()};a.push(row);W('activity',a);dbEvent('activity',row)},
      onActivity(cb){const f=d=>{if(d.type==='db'&&d.table==='activity')cb(d.row)};subs.add(f);return ()=>subs.delete(f)},
      channel(name,presence,h){const me=presence?presence.uid:'w'+Math.random().toString(36).slice(2),peers={};let state=presence?{...presence}:null;
        const f=d=>{if(d.ch!==name||d.from===me)return;if(d.type==='pres'){peers[d.from]={st:d.st,t:Date.now()};push()}else if(d.type==='bye'){delete peers[d.from];push()}else if(d.type==='msg')h.msg&&h.msg(d.ev,d.p)};
        const push=()=>{const now=Date.now();Object.keys(peers).forEach(k=>{if(now-peers[k].t>12000)delete peers[k]});h.sync&&h.sync([...(state?[state]:[]),...Object.values(peers).map(p=>p.st)])};
        subs.add(f);const beat=()=>{if(state)bc.postMessage({ch:name,type:'pres',from:me,st:state})};beat();const iv=setInterval(()=>{beat();push()},1000);setTimeout(push,50);
        return {send(ev,p){bc.postMessage({ch:name,type:'msg',from:me,ev,p})},track(p){if(!state)return;state={...state,...p};beat();push()},leave(){clearInterval(iv);subs.delete(f);if(state)bc.postMessage({ch:name,type:'bye',from:me})}}}
    }}

  const wantLocal=/[?&]local\b/.test(location.search)||!cfg.supabaseUrl||!cfg.supabaseKey||!window.supabase;
  window.NET=wantLocal?local():supa();
})();
