(function(root){'use strict';

const RECIPES={
  milk:{id:'milk',name:'Ao Leite',short:'LEITE',points:1,cooling:20,base:1,wrapper:'lightBrown',wrapperLabel:'Marrom claro',wrapperColor:0xb97a57,ribbons:1,tags:0,tulle:0,color:0xb97958,standard:true},
  dark:{id:'dark',name:'Amargo',short:'AMARGO',points:1,cooling:20,base:1,wrapper:'darkBrown',wrapperLabel:'Marrom escuro',wrapperColor:0x5f392d,ribbons:1,tags:0,tulle:0,color:0x5b3529,standard:true},
  white:{id:'white',name:'Branco',short:'BRANCO',points:1,cooling:20,base:1,wrapper:'beige',wrapperLabel:'Bege',wrapperColor:0xe6d1a5,ribbons:1,tags:0,tulle:0,color:0xf5e7c7,standard:true},
  pistachio:{id:'pistachio',name:'Pistache',short:'PISTACHE',points:3,cooling:45,base:2,wrapper:'green',wrapperLabel:'Verde',wrapperColor:0x6f9a63,ribbons:1,tags:1,tulle:0,color:0x8fb377,standard:false},
  berries:{id:'berries',name:'Frutas Vermelhas',short:'FRUTAS',points:5,cooling:50,base:2,wrapper:'red',wrapperLabel:'Vermelho',wrapperColor:0xb94b4d,ribbons:1,tags:1,tulle:0,color:0xc95a65,standard:false},
  caramel:{id:'caramel',name:'Caramelo',short:'CARAMELO',points:7,cooling:60,base:2,wrapper:'yellow',wrapperLabel:'Amarelo',wrapperColor:0xd5a942,ribbons:2,tags:1,tulle:1,color:0xd18f4a,standard:false}
};
const RECIPE_ORDER=['milk','dark','white','pistachio','berries','caramel'];
const TEAM_COLORS=[0xe46f51,0x5aa0d6,0x69ad74,0x9c7bd1];
const TEAM_CSS=['#e46f51','#5aa0d6','#69ad74','#9c7bd1'];
const MAX_ATTEMPTS=50,STANDARD_MINIMUM=10,PLAYER_RADIUS=18;

const MAP={w:1280,h:720,spawn:[{x:610,y:350},{x:650,y:350},{x:610,y:390},{x:650,y:390},{x:610,y:430},{x:650,y:430}],
  rawBins:[
    {id:'raw-milk',kind:'raw',recipe:'milk',x:110,y:76,w:132,h:72,label:'AO LEITE'},
    {id:'raw-dark',kind:'raw',recipe:'dark',x:258,y:76,w:132,h:72,label:'AMARGO'},
    {id:'raw-white',kind:'raw',recipe:'white',x:406,y:76,w:132,h:72,label:'BRANCO'},
    {id:'raw-pistachio',kind:'raw',recipe:'pistachio',x:554,y:76,w:132,h:72,label:'PISTACHE'},
    {id:'raw-berries',kind:'raw',recipe:'berries',x:702,y:76,w:132,h:72,label:'FRUTAS'},
    {id:'raw-caramel',kind:'raw',recipe:'caramel',x:850,y:76,w:132,h:72,label:'CARAMELO'}
  ],
  wrappers:[
    {id:'wrap-lightBrown',kind:'wrapper',wrapper:'lightBrown',x:110,y:644,w:132,h:60,label:'MARROM CL.'},
    {id:'wrap-darkBrown',kind:'wrapper',wrapper:'darkBrown',x:258,y:644,w:132,h:60,label:'MARROM ESC.'},
    {id:'wrap-beige',kind:'wrapper',wrapper:'beige',x:406,y:644,w:132,h:60,label:'BEGE'},
    {id:'wrap-green',kind:'wrapper',wrapper:'green',x:554,y:644,w:132,h:60,label:'VERDE'},
    {id:'wrap-red',kind:'wrapper',wrapper:'red',x:702,y:644,w:132,h:60,label:'VERMELHO'},
    {id:'wrap-yellow',kind:'wrapper',wrapper:'yellow',x:850,y:644,w:132,h:60,label:'AMARELO'}
  ],
  assembly:[
    {id:'assembly-1',kind:'assembly',x:130,y:265,w:142,h:94,label:'MONTAGEM A'},
    {id:'assembly-2',kind:'assembly',x:130,y:410,w:142,h:94,label:'MONTAGEM B'}
  ],
  counters:[
    {id:'counter-1',kind:'counter',x:382,y:258,w:128,h:78,label:'BANCADA'},
    {id:'counter-2',kind:'counter',x:382,y:430,w:128,h:78,label:'BANCADA'},
    {id:'counter-3',kind:'counter',x:555,y:258,w:128,h:78,label:'BANCADA'},
    {id:'counter-4',kind:'counter',x:555,y:430,w:128,h:78,label:'BANCADA'}
  ],
  finish:[
    {id:'finish-ribbon',kind:'finish',resource:'ribbon',x:755,y:248,w:126,h:82,label:'FITAS'},
    {id:'finish-tag',kind:'finish',resource:'tag',x:755,y:351,w:126,h:82,label:'TAGS'},
    {id:'finish-tulle',kind:'finish',resource:'tulle',x:755,y:454,w:126,h:82,label:'TULE'}
  ],
  freezer:{id:'freezer',kind:'freezer',x:1012,y:230,w:212,h:285,label:'FREEZER'},
  freezerConsole:{id:'freezer-console',kind:'freezerConsole',x:1050,y:535,w:136,h:60,label:'INICIAR CICLO'},
  dispatch:{id:'dispatch',kind:'dispatch',x:1040,y:620,w:180,h:72,label:'EXPEDIÇÃO'},
  neutralWalls:[
    {x:0,y:0,w:1280,h:22},{x:0,y:698,w:1280,h:22},{x:0,y:0,w:22,h:720},{x:1258,y:0,w:22,h:720}
  ]
};
MAP.stations=[...MAP.rawBins,...MAP.wrappers,...MAP.assembly,...MAP.counters,...MAP.finish,MAP.freezer,MAP.freezerConsole,MAP.dispatch];
MAP.obstacles=[...MAP.neutralWalls,...MAP.stations];

function uid(prefix='id'){return prefix+'-'+Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-5)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function dist2(a,b){const dx=a.x-b.x,dy=a.y-b.y;return dx*dx+dy*dy}
function now(){return Date.now()}
function initialInventory(){return{baseBars:70,wrappers:{beige:30,lightBrown:30,darkBrown:30,green:20,red:20,yellow:20},ribbons:50,tags:20,tulle:20}}
function createTeam(index){return{
  id:'team-'+(index+1),name:'Fábrica '+String.fromCharCode(65+index),color:TEAM_COLORS[index],css:TEAM_CSS[index],
  inventory:initialInventory(),attempts:0,players:{},items:{},stationItems:{},assemblyProgress:{},
  freezer:{slots:[null,null,null],running:false,endAt:null,cooling:null,ready:false,batchStartedWith:0},
  delivered:{milk:0,dark:0,white:0,pistachio:0,berries:0,caramel:0},penalties:[],events:[],telemetry:{pickups:0,drops:0,throws:0,deliveries:0,freezerErrors:0,earlyPulls:0,assemblyCompletions:0}
}}
function createSession(opts={}){
  const teamCount=clamp(Number(opts.teamCount)||2,2,4);
  return{version:2,code:opts.code||Math.random().toString(36).slice(2,8).toUpperCase(),mode:opts.mode==='pressure'?'pressure':'classic',phase:'lobby',entriesOpen:true,
    planningSeconds:Math.max(60,(Number(opts.planningMinutes)||10)*60),productionSeconds:Math.max(60,(Number(opts.productionMinutes)||15)*60),endsAt:null,pausedRemaining:null,
    freezerCapacity:3,berriesPoints:5,createdAt:now(),teams:Array.from({length:teamCount},(_,i)=>createTeam(i)),participants:{},messages:[],events:[],
    interventions:{market:false,freezer:false,talent:false},settings:{friendlyCollision:true,maxAttempts:MAX_ATTEMPTS}
  }
}
function publicSession(session){return{code:session.code,mode:session.mode,phase:session.phase,entriesOpen:session.entriesOpen,endsAt:session.endsAt,pausedRemaining:session.pausedRemaining,freezerCapacity:session.freezerCapacity,berriesPoints:session.berriesPoints,interventions:session.interventions,settings:session.settings,messages:session.messages.slice(-8),teams:session.teams.map(t=>({id:t.id,name:t.name,color:t.color,css:t.css,score:scoreTeam(t,session),participantCount:Object.values(session.participants).filter(p=>p.teamId===t.id&&!p.removed).length}))}}
function scoreTeam(team,session){
  const c=team.delivered;const standardsOk=c.milk>=STANDARD_MINIMUM&&c.dark>=STANDARD_MINIMUM&&c.white>=STANDARD_MINIMUM;
  const standard=c.milk+c.dark+c.white;
  const premium=c.pistachio*RECIPES.pistachio.points+c.berries*session.berriesPoints+c.caramel*RECIPES.caramel.points;
  return{total:standard+(standardsOk?premium:0),standard,premium,standardsOk,counts:{...c},pendingPremium:standardsOk?0:premium}
}
function phaseRemaining(session){if(session.pausedRemaining!=null)return Math.max(0,Math.ceil(session.pausedRemaining));if(!session.endsAt)return 0;return Math.max(0,Math.ceil((session.endsAt-now())/1000))}
function isProductionActive(session){return session.phase==='production'&&session.pausedRemaining==null&&phaseRemaining(session)>0}
function isMovementActive(session){return ['planning','production'].includes(session.phase)&&session.pausedRemaining==null&&phaseRemaining(session)>0}
function rectDistance2(x,y,r){const dx=Math.max(r.x-x,0,x-(r.x+r.w)),dy=Math.max(r.y-y,0,y-(r.y+r.h));return dx*dx+dy*dy}
function nearestStation(player,max=75){let best=null,bestD=max*max;for(const s of MAP.stations){const d=rectDistance2(player.x,player.y,s);if(d<bestD){bestD=d;best=s}}return best}
function nearestFloorItem(team,player,max=54){let best=null,bestD=max*max;for(const it of Object.values(team.items)){if(it.holderId||it.stationId||it.freezerSlot!=null)continue;const d=dist2(it,player);if(d<bestD){bestD=d;best=it}}return best}
function pointInsideRect(x,y,r,pad=0){return x>=r.x-pad&&x<=r.x+r.w+pad&&y>=r.y-pad&&y<=r.y+r.h+pad}
function collides(team,playerId,x,y){
  for(const r of MAP.obstacles){if(pointInsideRect(x,y,r,PLAYER_RADIUS-2))return true}
  if(team && team.players && team.players[playerId]){
    for(const [id,p] of Object.entries(team.players)){if(id===playerId)continue;if((x-p.x)**2+(y-p.y)**2<(PLAYER_RADIUS*1.65)**2)return true}
  }
  return false
}
function placeNear(player,distance=38){const dirs={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};const d=dirs[player.dir]||dirs.down;return{x:clamp(player.x+d[0]*distance,40,1240),y:clamp(player.y+d[1]*distance,40,680)}}
function event(session,msg,teamId=null,type='info'){session.events.push({id:uid('evt'),t:now(),msg,teamId,type});if(session.events.length>300)session.events.splice(0,session.events.length-300)}
function teamEvent(team,msg,type='info'){team.events.push({id:uid('tevt'),t:now(),msg,type});if(team.events.length>160)team.events.splice(0,team.events.length-160)}
function penalty(team,msg,points=0){team.penalties.push({id:uid('pen'),t:now(),msg,points});if(team.penalties.length>100)team.penalties.shift();teamEvent(team,msg,'penalty')}
function makeItem(recipeId,x,y){return{id:uid('item'),recipeId,state:'raw',wrapper:null,ribbons:0,tags:0,tulle:0,faulty:false,x,y,holderId:null,stationId:null,freezerSlot:null,ready:false,createdAt:now()}}
function validPackaging(item){const r=RECIPES[item.recipeId];return item.wrapper===r.wrapper&&item.ribbons===r.ribbons&&item.tags===r.tags&&item.tulle===r.tulle&&!item.faulty}
function finishedEnough(item){const r=RECIPES[item.recipeId];return item.wrapper!=null&&item.ribbons>=r.ribbons&&item.tags>=r.tags&&item.tulle>=r.tulle}

class GameHostEngine{
  constructor(session){this.session=session;this.controls={};this.lastTick=now();this.lastSave=0}
  addPlayer(participant){const team=this.session.teams.find(t=>t.id===participant.teamId);if(!team)return; if(team.players[participant.id])return;const idx=Object.keys(team.players).length%MAP.spawn.length,sp=MAP.spawn[idx];team.players[participant.id]={id:participant.id,name:participant.name,x:sp.x,y:sp.y,dir:'down',carry:null,dashUntil:0,lastAction:0,connected:true}}
  removePlayerFromWorld(participantId,teamId,dropCarry=true){const team=this.session.teams.find(t=>t.id===teamId);if(!team)return;const p=team.players[participantId];if(!p)return;if(dropCarry&&p.carry&&team.items[p.carry]){const it=team.items[p.carry],pos=placeNear(p,30);it.holderId=null;it.x=pos.x;it.y=pos.y;p.carry=null}delete team.players[participantId];delete this.controls[participantId]}
  movePlayerTeam(participant,newTeamId){const old=participant.teamId;if(old===newTeamId)return;const oldTeam=this.session.teams.find(t=>t.id===old);if(oldTeam&&oldTeam.players[participant.id]){const carry=oldTeam.players[participant.id].carry;if(carry&&oldTeam.items[carry]){const it=oldTeam.items[carry],p=oldTeam.players[participant.id],pp=placeNear(p,35);it.holderId=null;it.x=pp.x;it.y=pp.y}delete oldTeam.players[participant.id]}
    participant.teamId=newTeamId;this.addPlayer(participant);event(this.session,`${participant.name} foi realocado para ${this.session.teams.find(t=>t.id===newTeamId)?.name||newTeamId}.`,newTeamId,'move')}
  setInput(playerId,input){this.controls[playerId]={...(this.controls[playerId]||{}),...input,receivedAt:now()}}
  action(playerId,action){const part=this.session.participants[playerId];if(!part||part.removed||!part.teamId)return;const team=this.session.teams.find(t=>t.id===part.teamId),p=team?.players[playerId];if(!p)return;if(action==='interact')this.interact(team,p);else if(action==='dash')this.dash(team,p);else if(action==='throw')this.throwItem(team,p)}
  tick(){const n=now(),dt=Math.min(.08,Math.max(.001,(n-this.lastTick)/1000));this.lastTick=n;for(const team of this.session.teams){this.tickFreezer(team,n);for(const p of Object.values(team.players)){this.tickPlayer(team,p,dt,n)}}if(this.session.phase==='planning'||this.session.phase==='production'){if(this.session.pausedRemaining==null&&this.session.endsAt&&this.session.endsAt<=n){if(this.session.phase==='planning'){this.session.phase='briefing';this.session.endsAt=null;event(this.session,'Planejamento encerrado. Aguardando início da produção.')}else{this.session.phase='results';this.session.endsAt=null;event(this.session,'Tempo de produção encerrado.')}}}}
  tickPlayer(team,p,dt,n){const c=this.controls[p.id]||{};if(isMovementActive(this.session)){
      let dx=(c.right?1:0)-(c.left?1:0),dy=(c.down?1:0)-(c.up?1:0);if(dx||dy){const len=Math.hypot(dx,dy);dx/=len;dy/=len;if(Math.abs(dx)>Math.abs(dy))p.dir=dx>0?'right':'left';else p.dir=dy>0?'down':'up';const speed=158;let nx=p.x+dx*speed*dt,ny=p.y;if(!collides(team,p.id,nx,ny))p.x=nx;nx=p.x;ny=p.y+dy*speed*dt;if(!collides(team,p.id,nx,ny))p.y=ny;this.syncCarry(team,p)}
      if(c.interactHold&&isProductionActive(this.session))this.processAssemblyHold(team,p,dt)
    }
  }
  syncCarry(team,p){if(p.carry&&team.items[p.carry]){const it=team.items[p.carry],pos=placeNear(p,26);it.x=pos.x;it.y=pos.y}}
  dash(team,p){if(!isMovementActive(this.session)||now()<p.dashUntil)return;p.dashUntil=now()+850;const dirs={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]},d=dirs[p.dir]||dirs.down;for(let i=0;i<5;i++){const nx=p.x+d[0]*20,ny=p.y+d[1]*20;if(collides(team,p.id,nx,ny))break;p.x=nx;p.y=ny}this.syncCarry(team,p)}
  throwItem(team,p){if(!isProductionActive(this.session)||!p.carry)return;const it=team.items[p.carry];if(!it||it.freezerSlot!=null)return;const dirs={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]},d=dirs[p.dir]||dirs.down;let tx=clamp(p.x+d[0]*120,35,1245),ty=clamp(p.y+d[1]*120,35,685);if(MAP.obstacles.some(r=>pointInsideRect(tx,ty,r,18))){const q=placeNear(p,45);tx=q.x;ty=q.y}it.holderId=null;it.stationId=null;it.x=tx;it.y=ty;p.carry=null;team.telemetry.throws++;teamEvent(team,`${p.name} lançou ${RECIPES[it.recipeId].name}.`,'action')}
  processAssemblyHold(team,p,dt){if(p.carry)return;const s=nearestStation(p,70);if(!s||s.kind!=='assembly')return;const itemId=team.stationItems[s.id],it=itemId&&team.items[itemId];if(!it||it.state!=='raw')return;team.assemblyProgress[s.id]=(team.assemblyProgress[s.id]||0)+dt;if(team.assemblyProgress[s.id]>=2.4){it.state='assembled';team.assemblyProgress[s.id]=2.4;team.telemetry.assemblyCompletions++;teamEvent(team,`${RECIPES[it.recipeId].name} montado em ${s.label}.`,'success')}}
  interact(team,p){if(!isProductionActive(this.session)){return}const s=nearestStation(p,78);if(p.carry){const it=team.items[p.carry];if(!it)return;
      if(s){if(s.kind==='counter')return this.placeOnStation(team,p,it,s);if(s.kind==='assembly'&&it.state==='raw')return this.placeOnAssembly(team,p,it,s);if(s.kind==='wrapper')return this.applyWrapper(team,p,it,s);if(s.kind==='finish')return this.applyFinish(team,p,it,s);if(s.kind==='freezer')return this.loadFreezer(team,p,it);if(s.kind==='dispatch')return this.dispatch(team,p,it)}
      return this.drop(team,p,it)
    }
    if(s){if(s.kind==='raw')return this.pickRaw(team,p,s);if(s.kind==='counter')return this.pickStationItem(team,p,s);if(s.kind==='assembly')return this.pickAssemblyItem(team,p,s);if(s.kind==='freezer')return this.pullFreezer(team,p,s);if(s.kind==='freezerConsole')return this.startFreezer(team,p)}
    const floor=nearestFloorItem(team,p,55);if(floor)return this.pickFloor(team,p,floor)
  }
  pickRaw(team,p,s){if(team.attempts>=MAX_ATTEMPTS){teamEvent(team,'Limite de 50 tentativas atingido.','warning');return}const r=RECIPES[s.recipe];if(team.inventory.baseBars<r.base){teamEvent(team,'Sem barras-base suficientes.','warning');return}team.inventory.baseBars-=r.base;team.attempts++;const it=makeItem(r.id,p.x,p.y);it.holderId=p.id;team.items[it.id]=it;p.carry=it.id;team.telemetry.pickups++;teamEvent(team,`${p.name} retirou ${r.name} do estoque.`)}
  pickFloor(team,p,it){if(p.carry)return;it.holderId=p.id;p.carry=it.id;team.telemetry.pickups++;this.syncCarry(team,p)}
  drop(team,p,it){const pos=placeNear(p,42);if(MAP.obstacles.some(r=>pointInsideRect(pos.x,pos.y,r,18))){return}it.holderId=null;it.stationId=null;it.x=pos.x;it.y=pos.y;p.carry=null;team.telemetry.drops++}
  placeOnStation(team,p,it,s){if(team.stationItems[s.id])return;team.stationItems[s.id]=it.id;it.holderId=null;it.stationId=s.id;it.x=s.x+s.w/2;it.y=s.y+s.h/2;p.carry=null;team.telemetry.drops++}
  pickStationItem(team,p,s){const id=team.stationItems[s.id],it=id&&team.items[id];if(!it)return;delete team.stationItems[s.id];it.stationId=null;it.holderId=p.id;p.carry=it.id;team.telemetry.pickups++;this.syncCarry(team,p)}
  placeOnAssembly(team,p,it,s){if(team.stationItems[s.id])return;team.stationItems[s.id]=it.id;team.assemblyProgress[s.id]=0;it.holderId=null;it.stationId=s.id;it.x=s.x+s.w/2;it.y=s.y+s.h/2;p.carry=null;team.telemetry.drops++}
  pickAssemblyItem(team,p,s){const id=team.stationItems[s.id],it=id&&team.items[id];if(!it||it.state!=='assembled')return;delete team.stationItems[s.id];delete team.assemblyProgress[s.id];it.stationId=null;it.holderId=p.id;p.carry=it.id;team.telemetry.pickups++;this.syncCarry(team,p)}
  applyWrapper(team,p,it,s){if(it.state!=='assembled'&&it.state!=='packaged')return;if(it.wrapper){teamEvent(team,'Este produto já está embalado.','warning');return}if((team.inventory.wrappers[s.wrapper]||0)<=0){teamEvent(team,`Acabou a embalagem ${s.label}.`,'warning');return}team.inventory.wrappers[s.wrapper]--;it.wrapper=s.wrapper;it.state='packaged';if(s.wrapper!==RECIPES[it.recipeId].wrapper)it.faulty=true;teamEvent(team,`${p.name} aplicou embalagem ${s.label}.`,it.faulty?'warning':'action')}
  applyFinish(team,p,it,s){if(it.state!=='packaged'&&it.state!=='finished')return;const r=RECIPES[it.recipeId];if(s.resource==='ribbon'){if(team.inventory.ribbons<=0)return teamEvent(team,'Sem fitas.','warning');team.inventory.ribbons--;it.ribbons++;if(it.ribbons>r.ribbons)it.faulty=true}
    if(s.resource==='tag'){if(team.inventory.tags<=0)return teamEvent(team,'Sem tags.','warning');team.inventory.tags--;it.tags++;if(it.tags>r.tags)it.faulty=true}
    if(s.resource==='tulle'){if(team.inventory.tulle<=0)return teamEvent(team,'Sem tule.','warning');team.inventory.tulle--;it.tulle++;if(it.tulle>r.tulle)it.faulty=true}
    if(finishedEnough(it))it.state='finished';teamEvent(team,`${p.name} adicionou ${s.label}.`,it.faulty?'warning':'action')}
  loadFreezer(team,p,it){if(team.freezer.running||team.freezer.ready){teamEvent(team,'Freezer ocupado com um ciclo.','warning');return}if(!validPackaging(it)){p.carry=null;delete team.items[it.id];penalty(team,`${RECIPES[it.recipeId].name} invalidado no freezer: embalagem/acabamento incorreto.`);team.telemetry.freezerErrors++;return}
    let capacity=this.session.freezerCapacity;if(team.freezer.batchStartedWith>capacity&&team.freezer.slots.some(Boolean)){capacity=team.freezer.batchStartedWith}
    const idx=team.freezer.slots.findIndex((x,i)=>!x&&i<capacity);if(idx<0){teamEvent(team,'Freezer sem espaço disponível.','warning');return}
    p.carry=null;it.holderId=null;it.stationId='freezer';it.freezerSlot=idx;team.freezer.slots[idx]=it.id;it.x=MAP.freezer.x+55+(idx%2)*92;it.y=MAP.freezer.y+92+Math.floor(idx/2)*90;teamEvent(team,`${RECIPES[it.recipeId].name} carregado no freezer.`,'action')}
  startFreezer(team,p){if(team.freezer.running){teamEvent(team,'O ciclo já está em andamento.','warning');return}if(team.freezer.ready){teamEvent(team,'Retire os produtos prontos antes de iniciar outro ciclo.','warning');return}const ids=team.freezer.slots.filter(Boolean);if(!ids.length){teamEvent(team,'Freezer vazio.','warning');return}const items=ids.map(id=>team.items[id]).filter(Boolean),times=new Set(items.map(i=>RECIPES[i.recipeId].cooling));if(times.size!==1){for(const id of ids)delete team.items[id];team.freezer.slots=[null,null,null];penalty(team,'Tempos de resfriamento incompatíveis: lote inteiro invalidado.');team.telemetry.freezerErrors++;return}
    const cooling=[...times][0];team.freezer.running=true;team.freezer.ready=false;team.freezer.cooling=cooling;team.freezer.endAt=now()+cooling*1000;team.freezer.batchStartedWith=items.length;teamEvent(team,`Ciclo iniciado: ${items.length} produto(s), ${cooling}s.`,'success')}
  tickFreezer(team,n){if(team.freezer.running&&team.freezer.endAt<=n){team.freezer.running=false;team.freezer.ready=true;team.freezer.endAt=null;for(const id of team.freezer.slots){if(id&&team.items[id]){team.items[id].ready=true;team.items[id].state='ready'}}teamEvent(team,'Ciclo concluído. Produtos prontos para retirada.','success')}}
  pullFreezer(team,p){const ids=team.freezer.slots.filter(Boolean);if(!ids.length)return;let idx=-1;const localY=p.y-MAP.freezer.y;if(localY<125)idx=0;else if(localY<215)idx=1;else idx=2;if(!team.freezer.slots[idx])idx=team.freezer.slots.findIndex(Boolean);if(idx<0)return;const id=team.freezer.slots[idx],it=team.items[id];if(team.freezer.running){team.freezer.slots[idx]=null;delete team.items[id];team.telemetry.earlyPulls++;penalty(team,`Retirada antecipada: ${RECIPES[it.recipeId].name} invalidado.`);if(!team.freezer.slots.some(Boolean)){team.freezer.running=false;team.freezer.endAt=null;team.freezer.cooling=null;team.freezer.batchStartedWith=0}return}
    if(!team.freezer.ready||!it)return;team.freezer.slots[idx]=null;it.freezerSlot=null;it.stationId=null;it.holderId=p.id;it.x=p.x;it.y=p.y;p.carry=it.id;this.syncCarry(team,p);team.telemetry.pickups++;if(!team.freezer.slots.some(Boolean)){team.freezer.ready=false;team.freezer.cooling=null;team.freezer.batchStartedWith=0}}
  dispatch(team,p,it){if(it.state!=='ready'){teamEvent(team,'Somente chocolates resfriados podem ser expedidos.','warning');return}const rid=it.recipeId;team.delivered[rid]++;team.telemetry.deliveries++;p.carry=null;delete team.items[it.id];teamEvent(team,`${p.name} expediu ${RECIPES[rid].name}.`,'success')}
  teamSnapshot(teamId){const t=this.session.teams.find(t=>t.id===teamId);if(!t)return null;return{...t,score:scoreTeam(t,this.session)}}
}

root.ChocoV2={RECIPES,RECIPE_ORDER,TEAM_COLORS,TEAM_CSS,MAX_ATTEMPTS,STANDARD_MINIMUM,MAP,uid,clamp,now,createSession,createTeam,publicSession,scoreTeam,phaseRemaining,isProductionActive,isMovementActive,GameHostEngine};
})(window);
