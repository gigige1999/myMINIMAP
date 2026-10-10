window.createGardenGame = function createGardenGame(THREE, { root, heightAt, explorer, reduced, section, invalidate }) {
  const $ = id => document.getElementById(id);
  const home = { x: 1, z: 1.2 };
  const canyon = explorer.navigation.nearest(-3.8, -.6);
  let snapshot, journal, active = false, guidance = null, lastUI = '', lastUpdate = 0, progressSecond = -1;
  let collapsed = true;
  let restAt = null, restPending = 0;
  try { collapsed = window.localStorage.getItem('quiet-lands-quest-collapsed') !== 'false'; } catch {}
  const store = window.createGardenStore({ onChange(value) {
    snapshot = value;
    section.dataset.gardenStage = value.stage;
    section.dataset.canyonRestored = String(value.canyonRestored);
    journal?.render(); lastUI = ''; render(); invalidate();
  }});
  snapshot = store.snapshot();
  const visual = window.createGardenScene(THREE, root, heightAt, reduced, canyon);
  journal = window.createGardenJournal({ getState: () => store.snapshot(), onRead: id => store.markRead(id), onReset() {
    guidance = null; restAt=null;restPending=0;explorer.resetPose(); store.reset(); progressSecond=-1; lastUI=''; render(); invalidate();
  }});
  const near = (a,b,r=.38) => Math.hypot(a.x-b.x,a.z-b.z)<r;
  function updateRest() {
    const now=performance.now(),traveler=explorer.snapshot();
    const resting=active&&!document.hidden&&snapshot.needsRest&&traveler.state==='sitting'&&traveler.campVisible&&traveler.campPosition;
    if(resting&&restAt!==null) {
      const elapsed=now-restAt;
      // Long frame gaps are suspension, never an offline rest reward.
      if(elapsed>0&&elapsed<=1000)restPending+=elapsed;
    }
    restAt=resting?now:null;
    if(restPending>=500||restPending>=snapshot.restRemainingMs&&restPending>0||(!resting&&restPending>0)) {
      const credit=restPending,needed=snapshot.needsRest;
      restPending=0;
      store.addRest(credit);
      if(needed&&!snapshot.needsRest)explorer.say('歇好了，风又捎来一粒种子。可以去峡谷了。');
    }
  }
  function setCollapsed(value) {
    collapsed=value;
    $('gardenQuest').classList.toggle('is-collapsed',value);
    $('gardenDetails').hidden=value;
    $('gardenToggle').setAttribute('aria-expanded',String(!value));
    $('gardenToggle').setAttribute('aria-label',`${value?'展开':'收起'}种花任务，已种 ${snapshot.plantedCount} 朵，共 3 朵`);
    try { window.localStorage.setItem('quiet-lands-quest-collapsed',String(value)); } catch {}
  }
  $('gardenToggle').addEventListener('click',()=>setCollapsed(!collapsed));
  function trip(point, goal) {
    if(explorer.moveTo(point)){guidance=goal;lastUI='';render();invalidate();}
  }
  function plantedSpot(traveler) {
    const fire=traveler.campPosition;
    if(!fire)return null;
    const direction=Math.atan2(fire.x-traveler.position.x,fire.z-traveler.position.z);
    // Keep each flower separate and leave the campfire and walkable paths clear.
    for(const radius of [.66,.9,1.1]) for(const offset of [Math.PI/2,-Math.PI/2,Math.PI,Math.PI/4,-Math.PI/4,3*Math.PI/4,-3*Math.PI/4]) {
      const x=fire.x+Math.sin(direction+offset)*radius,z=fire.z+Math.cos(direction+offset)*radius;
      if(explorer.navigation.canCamp(x,z)&&!near({x,z},traveler.position,.45)&&
        snapshot.flowers.every(flower=>!near({x,z},flower.plot,.36)))return {x,z};
    }
    return null;
  }
  function descriptor(traveler) {
    const inCamp=near(traveler.position,home,.42),moving=traveler.remaining>0;
    if(snapshot.seedCount) {
      if(inCamp&&traveler.state==='sitting'&&traveler.campVisible)return {step:2,caption:`风铃花种子 × 1 · 这是第 ${snapshot.plantedCount+1} 朵`,action:'在篝火旁种下',kind:'plant'};
      if(inCamp&&traveler.state==='lighting')return {step:2,caption:'等火焰暖起来，就可以种花了。',action:'正在生火…',disabled:true};
      if(inCamp&&traveler.state==='standing')return {step:2,caption:'把种子安放在温暖的地方。',action:'稍等，小人正在起身…',disabled:true};
      return {step:2,caption:'拾到一粒种子，带回火光旁。',action:guidance==='camp'&&moving?'带着种子，回到营地…':inCamp?'生火，准备种花':'带种子回营地',kind:'camp',disabled:guidance==='camp'&&moving};
    }
    if(snapshot.canRestore)return {step:4,caption:'三朵花安了家，峡谷也在等待春天。',action:'修复微风峡谷',kind:'restore',secondary:'第一阶段 · 让彩虹与远山归来'};
    const unseen=snapshot.flowers.find(flower=>flower.bloomed&&!flower.witnessed);
    if(unseen)return {step:3,caption:snapshot.entryUnlocked?'又一朵小花开了，回去看看吧。':'第一朵花开了，回去看看吧。',action:guidance==='flower'&&moving?'循着花香，回到营地…':'回去看花',kind:'flower',disabled:guidance==='flower'&&moving};
    if(snapshot.needsRest) {
      const sitting=traveler.state==='sitting'&&traveler.campVisible;
      return {step:3,caption:sitting?'让火光暖一暖，等风带来下一粒种子。':'出发前，在篝火旁歇满一分钟。',action:sitting?'围炉小憩中…':traveler.state==='lighting'?'正在生火…':guidance==='rest'&&moving?'回到火光旁…':'生火，歇一会儿',kind:'rest',disabled:sitting||traveler.state==='lighting'||traveler.state==='standing'||guidance==='rest'&&moving,secondary:'只在火边坐着时计时，起身或离开会暂停。'};
    }
    if(snapshot.canCollect)return {step:snapshot.plantedCount?3:1,caption:snapshot.plantedCount?`已种 ${snapshot.plantedCount} / 3 朵 · 再带一粒种子回来`:'峡谷的风，捎来一粒种子。',action:guidance==='canyon'&&moving?'循着微光，走向峡谷…':snapshot.plantedCount?'去峡谷再拾一粒':'去峡谷散步',kind:'canyon',disabled:guidance==='canyon'&&moving,secondary:snapshot.entryUnlocked?`已收藏 ${snapshot.entryCount} 页风景，每朵花带回一张画。`:'种下三朵花，唤回峡谷的彩虹。'};
    if(snapshot.flowers.some(flower=>!flower.bloomed))return {step:3,caption:'三粒种子都在草地上安了家。',action:'去峡谷散步',kind:'stroll',secondary:'小花仍在慢慢生长。'};
    return {step:4,caption:snapshot.canyonRestored?'峡谷 · 虹归，第一阶段已修复。':'三朵花，留住了一小片春天。',action:'翻开花的手记',kind:'journal',secondary:'花留在草地，故事收进行囊。'};
  }
  function render() {
    const traveler=explorer.snapshot(),view=descriptor(traveler);
    const key=JSON.stringify([view,snapshot.stage,snapshot.seedCount,snapshot.entryCount,snapshot.unreadCount,snapshot.plantedCount,snapshot.canyonRestored]);
    if(key!==lastUI) {
      lastUI=key;
      $('gardenCopy').textContent=view.caption;
      $('gardenActionText').textContent=view.action;
      $('gardenAction').disabled=Boolean(view.disabled);
      $('gardenFootnote').textContent=view.secondary||'';
      $('gardenFlowerCount').textContent=`${snapshot.plantedCount} / 3`;
      $('gardenTitle').textContent=snapshot.canyonRestored?'峡谷 · 虹归':snapshot.needsRest?'火边小憩':'花与峡谷';
      $('gardenToggle').setAttribute('aria-label',`${collapsed?'展开':'收起'}种花任务，已种 ${snapshot.plantedCount} 朵，共 3 朵`);
      $('gardenQuest').classList.toggle('is-ready',snapshot.canRestore);
      $('gardenSteps').querySelectorAll('span').forEach((dot,i)=>{dot.classList.toggle('complete',i<view.step-1);dot.classList.toggle('current',i===view.step-1);});
      $('gardenSteps').setAttribute('aria-label',`种花旅途：第 ${view.step} 步，共 4 步`);
      $('journalCount').textContent=String(snapshot.entryCount);
      $('journalOpen').classList.toggle('has-unread',snapshot.unreadCount>0);
      $('journalOpen').setAttribute('aria-label',`手记背包，${snapshot.seedCount} 粒种子，${snapshot.entryCount} 页插画${snapshot.unreadCount?'，有新手记':''}`);
      $('gardenReward').hidden=!snapshot.entryUnlocked;
      $('canyonRestore').hidden=!snapshot.canRestore;
    }
    $('gardenRest').hidden=!snapshot.needsRest;
    if(snapshot.needsRest) {
      const remaining=Math.ceil(snapshot.restRemainingMs/1000);
      $('gardenRestBar').value=snapshot.restElapsedMs/1000;
      $('gardenRestText').textContent=`${traveler.state==='sitting'&&traveler.campVisible?'火边休息':'休息暂停'} · 还需 ${remaining} 秒`;
    }
    section.dataset.restRemaining=String(Math.ceil(snapshot.restRemainingMs/1000));
    const growing=snapshot.flowers.filter(flower=>!flower.bloomed);
    $('gardenGrowth').hidden=!growing.length;
    if(growing.length) {
      const remaining=Math.max(0,Math.ceil((Math.min(...growing.map(f=>f.bloomAt))-Date.now())/1000));
      if(remaining!==progressSecond){progressSecond=remaining;$('gardenGrowthText').textContent=`下一朵约 ${remaining} 秒后开花`;$('gardenGrowthBar').value=30-remaining;}
    }
  }
  function restoreCanyon() {
    if(store.restoreCanyon()) {
      guidance=null;setCollapsed(true);
      explorer.say('虹归 · 峡谷第一阶段修复了。彩虹与远山，又回到风里。');
      document.dispatchEvent(new CustomEvent('journey:restored',{detail:{region:'canyon',stage:1}}));
      invalidate();
    }
  }
  $('canyonRestore').addEventListener('click',restoreCanyon);
  $('gardenAction').addEventListener('click',()=>{
    store.tick();
    const traveler=explorer.snapshot(),view=descriptor(traveler);
    if(view.disabled)return;
    if(view.kind==='canyon'||view.kind==='stroll')trip(canyon,view.kind);
    else if(view.kind==='plant') {
      const plot=plantedSpot(traveler);
      if(!plot){explorer.say('这边的小花有些挤了，换个方向生火吧。');return;}
      if(store.plant(plot)){guidance=null;restAt=performance.now();restPending=0;explorer.say(`种下第 ${snapshot.plantedCount} 朵小花。${snapshot.canRestore?'现在可以修复微风峡谷了。':'在火边歇一分钟，再去拾下一粒种子。'}`);}
    } else if(view.kind==='camp') {
      if(!near(traveler.position,home,.42))trip(home,'camp');else {explorer.makeCamp();render();}
    } else if(view.kind==='rest') {
      if(!explorer.makeCamp())trip(home,'rest');
      render();
    } else if(view.kind==='flower') {
      const flower=snapshot.flowers.find(entry=>entry.bloomed&&!entry.witnessed);
      if(flower)trip(explorer.navigation.nearest(flower.plot.x,flower.plot.z),'flower');
    } else if(view.kind==='restore')restoreCanyon();
    else journal.open();
    invalidate();
  });
  $('journalOpen').addEventListener('click',()=>{store.tick();journal.open();});
  const refresh=()=>{updateRest();store.tick();if(active||journal.isOpen()){render();invalidate();}};
  let timer=setInterval(refresh,500);
  document.addEventListener('visibilitychange',refresh);
  window.addEventListener('pagehide',()=>{updateRest();restAt=null;clearInterval(timer);timer=null;});
  window.addEventListener('pageshow',()=>{restAt=null;if(timer===null)timer=setInterval(refresh,500);refresh();});
  section.dataset.gardenStage=snapshot.stage;
  section.dataset.canyonRestored=String(snapshot.canyonRestored);
  setCollapsed(collapsed);render();
  return {
    update(dt,time,night) {
      if(!active)return;
      updateRest();
      const traveler=explorer.snapshot();
      if(snapshot.canCollect&&near(traveler.position,canyon,.38)&&traveler.remaining===0) {
        if(store.collectSeed()){guidance=null;explorer.say('拾到风铃花种子 × 1，已收进手记背包。');}
      }
      if(snapshot.seedCount&&guidance==='camp'&&near(traveler.position,home,.12)&&traveler.state==='idle') {guidance=null;explorer.makeCamp();}
      if(snapshot.needsRest&&guidance==='rest'&&near(traveler.position,home,.12)&&traveler.state==='idle') {guidance=null;explorer.makeCamp();}
      for(const flower of snapshot.flowers)if(flower.bloomed&&!flower.witnessed&&near(traveler.position,flower.plot,1.3)) {
        if(store.witnessBloom(flower.id)){if(guidance==='flower')guidance=null;explorer.say(`${flower.id==='flower-1'?'第一朵花':'又一朵花'}开了。手记里，多了一页风景。`);}
      }
      visual.update(snapshot,time,night);
      if(time-lastUpdate>.2||reduced.matches){render();lastUpdate=time;}
    },
    setActive(value){updateRest();active=value;restAt=null;updateRest();if(value){store.tick();render();invalidate();}},
    clearGuidance(){guidance=null;lastUI='';},
    closeJournal(){journal.close();},
    snapshot(){return store.snapshot();}
  };
};
