'use client';
import { useState, useEffect, useCallback } from "react";
import { useGames, addBet as apiBet, updateBetResult, updateComment as apiComment, syncGames, syncScores } from "@/lib/hooks";

const C = {
  bg: "#F7F7F7", white: "#FFFFFF", panel: "#FFFFFF", hover: "#F2F2F0",
  border: "#E3E3E0", borderSoft: "#EDEDEA",
  shadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  shadowLg: "0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
  text: "#0A0A0A", textSec: "#525252", textMuted: "#9A9A9A",
  accent: "#635BFF", accentBg: "#F0EEFF",
  win: "#0E7B41", winBg: "#EDFBF3", lose: "#C4321A", loseBg: "#FEF2F0",
  push: "#8A6E2F", pushBg: "#FDF8EC", chipBg: "#F0F0ED",
};

const FRIENDS = [
  { id: "jason", name: "Jason", label: "Jason's Meditations", i: "J", c: "#E84A27", ct: "#13294B", bg: "#13294B", fg: "#E84A27" },
  { id: "zock", name: "Zock", label: "Zock's Thots", i: "Z", c: "#8C1515", ct: "#8C1515", bg: "#8C1515", fg: "#FFFFFF" },
  { id: "justin", name: "Justin", label: "Justin's Thrustins", i: "J", c: "#FFCD00", ct: "#B8900A", bg: "#1A1A1A", fg: "#FFCD00" },
];

const ROUNDS = [
  { id: "r64", short: "R64", label: "Round of 64" },
  { id: "r32", short: "R32", label: "Round of 32" },
  { id: "s16", short: "S16", label: "Sweet 16" },
  { id: "e8", short: "E8", label: "Elite Eight" },
  { id: "f4", short: "F4", label: "Final Four" },
  { id: "champ", short: "Final", label: "Championship" },
];

const mono = "'IBM Plex Mono', monospace";
const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif";

// --- MATH ---
function o2d(o){const n=Number(o);if(isNaN(n)||!n)return null;return n>0?n/100+1:100/Math.abs(n)+1;}
function d2a(d){if(!d||d<=1)return"—";return d>=2?"+"+Math.round((d-1)*100):"-"+Math.round(100/(d-1));}
function pDec(legs){return legs.reduce((a,l)=>{const d=o2d(l.odds);return d?a*d:a;},1);}
function pay(w,o){if(w==null||!o)return null;const d=o2d(o);return d?Math.round(w*d*100)/100:null;}
function outc(w,o,r){if(!r||w==null)return null;if(r==="push")return w;if(r==="loss")return 0;return pay(w,o);}
function bOdds(b){return b.legs.length===1?b.legs[0].odds:d2a(pDec(b.legs));}
function fmt$(n){if(n==null)return"—";if(n===0)return"$0";return(n<0?"-":"")+"$"+Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g,",");}

function calcStats(games){
  const bets=games.flatMap(g=>g.bets||[]);const res=bets.filter(b=>b.result);
  const w=bets.reduce((s,b)=>s+(b.wager||0),0);
  const r=res.reduce((s,b)=>s+(outc(b.wager,bOdds(b),b.result)||0),0);
  return{wagered:w,returned:r,net:r-w,wins:res.filter(b=>b.result==="win").length,losses:res.filter(b=>b.result==="loss").length,bets:bets.length,resolved:res.length,roi:w>0?(r-w)/w:0};
}

// --- ORGANIZE GAMES BY ROUND > DAY ---
function organizeByRound(games) {
  const roundData = {};
  ROUNDS.forEach(r => { roundData[r.id] = { days: [] }; });

  // Group by round
  const byRound = {};
  games.forEach(g => {
    const r = g.round || 'r64';
    if (!byRound[r]) byRound[r] = [];
    byRound[r].push(g);
  });

  // Within each round, group by date
  Object.entries(byRound).forEach(([roundId, roundGames]) => {
    const byDate = {};
    roundGames.forEach(g => {
      const localDate = g.commence_time ? new Date(g.commence_time) : null;
      const label = localDate ? localDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBD';
      const dateKey = localDate ? `${localDate.getFullYear()}-${String(localDate.getMonth()+1).padStart(2,'0')}-${String(localDate.getDate()).padStart(2,'0')}` : 'tbd';
      if (!byDate[dateKey]) byDate[dateKey] = { date: dateKey, label, games: [] };
      byDate[dateKey].games.push(g);
    });
    if (roundData[roundId]) {
      roundData[roundId].days = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
    }
  });

  return roundData;
}

function getGamesForRound(roundData, roundId) {
  const rd = roundData[roundId];
  if (!rd?.days) return [];
  return rd.days.flatMap(d => d.games);
}

function getAllGamesUpTo(roundData, upToRoundId) {
  const order = ROUNDS.map(r => r.id);
  const idx = upToRoundId ? order.indexOf(upToRoundId) : order.length - 1;
  let games = [];
  for (let i = 0; i <= idx; i++) {
    games.push(...getGamesForRound(roundData, order[i]));
  }
  return games;
}

// --- TEAM LOGOS via ESPN CDN ---
const ESPN_IDS = {
  // Full API names
  "Duke Blue Devils":150,"Michigan Wolverines":130,"Arizona Wildcats":12,"Florida Gators":57,
  "Houston Cougars":248,"Purdue Boilermakers":2509,"Iowa State Cyclones":66,"Connecticut Huskies":41,
  "St. John's Red Storm":2599,"Tennessee Volunteers":2633,"Alabama Crimson Tide":333,
  "Michigan State Spartans":127,"Illinois Fighting Illini":356,"Wisconsin Badgers":275,
  "Gonzaga Bulldogs":2250,"Virginia Cavaliers":258,"Kentucky Wildcats":96,
  "Texas Tech Red Raiders":2641,"Arkansas Razorbacks":8,"Nebraska Cornhuskers":158,
  "Kansas Jayhawks":2305,"Maryland Terrapins":120,"Vanderbilt Commodores":238,
  "Clemson Tigers":228,"Oregon Ducks":2483,"Memphis Tigers":235,
  "BYU Cougars":252,"Louisville Cardinals":97,"North Carolina Tar Heels":153,
  "Ole Miss Rebels":145,"Missouri Tigers":142,"UCLA Bruins":26,
  "Saint Mary's Gaels":2608,"Miami Hurricanes":2390,"Marquette Golden Eagles":269,
  "Ohio State Buckeyes":194,"Georgia Bulldogs":61,"Villanova Wildcats":2918,
  "TCU Horned Frogs":2628,"Utah State Aggies":328,"Iowa Hawkeyes":2294,
  "Saint Louis Billikens":139,"Baylor Bears":239,"Creighton Bluejays":156,
  "Oklahoma Sooners":201,"Texas A&M Aggies":245,"Santa Clara Broncos":2541,
  "UCF Knights":2116,"New Mexico Lobos":167,"VCU Rams":2670,
  "South Florida Bulls":58,"Texas Longhorns":251,"NC State Wolfpack":152,
  "SMU Mustangs":2567,"Drake Bulldogs":2181,"Miami (OH) RedHawks":193,
  "McNeese Cowboys":2377,"Northern Iowa Panthers":2460,"Akron Zips":2006,
  "High Point Panthers":2272,"Liberty Flames":2335,"UCSD Tritons":28,
  "Colorado State Rams":36,"Hofstra Pride":2275,"Troy Trojans":2653,
  "Hawaii Rainbow Warriors":62,"California Baptist Lancers":2856,
  "Grand Canyon Antelopes":2253,"Lipscomb Bisons":288,"Yale Bulldogs":43,
  "North Dakota State Bison":2449,"Kennesaw State Owls":2320,"Wright State Raiders":2750,
  "Penn Quakers":219,"Furman Paladins":231,"Tennessee State Tigers":2590,
  "Queens Royals":null,"Idaho Vandals":70,"Wofford Terriers":2747,
  "Bryant Bulldogs":2803,"Robert Morris Colonials":2523,"Omaha Mavericks":2437,
  "Long Island Sharks":2344,"Siena Saints":2561,"Lehigh Mountain Hawks":2329,
  "Howard Bison":47,"Prairie View A&M Panthers":2504,"UMBC Retrievers":2692,
  "Norfolk State Spartans":2450,"Alabama State Hornets":2011,
  "Mount St. Mary's Mountaineers":116,"Montana Grizzlies":149,
  // Short names (from shortName function)
  "Duke":150,"Michigan":130,"Arizona":12,"Florida":57,"Houston":248,"Purdue":2509,
  "Iowa State":66,"UConn":41,"St. John's":2599,"Tennessee":2633,"Alabama":333,
  "Michigan St":127,"Illinois":356,"Wisconsin":275,"Gonzaga":2250,"Virginia":258,
  "Kentucky":96,"Texas Tech":2641,"Arkansas":8,"Nebraska":158,"Kansas":2305,
  "Maryland":120,"Vanderbilt":238,"Clemson":228,"Oregon":2483,"Memphis":235,
  "BYU":252,"Louisville":97,"UNC":153,"Ole Miss":145,"Mizzou":142,"UCLA":26,
  "Saint Mary's":2608,"Miami (FL)":2390,"Marquette":269,"Ohio State":194,
  "Georgia":61,"Villanova":2918,"TCU":2628,"Utah State":328,"Iowa":2294,
  "Saint Louis":139,"Baylor":239,"Creighton":156,"Oklahoma":201,
  "Texas A&M":245,"Santa Clara":2541,"UCF":2116,"New Mexico":167,
  "VCU":2670,"South Florida":58,"Texas":251,"NC State":152,"SMU":2567,
  "Drake":2181,"Miami (OH)":193,"McNeese":2377,"Northern Iowa":2460,
  "Akron":2006,"High Point":2272,"Liberty":2335,"Colorado St":36,
  "Hofstra":2275,"Troy":2653,"Hawaii":62,"Cal Baptist":2856,
  "Grand Canyon":2253,"Lipscomb":288,"Yale":43,"NDSU":2449,
  "Kennesaw St":2320,"Wright State":2750,"Penn":219,"Furman":231,
  "Tennessee St":2590,"Idaho":70,"Wofford":2747,"Bryant":2803,
  "Robert Morris":2523,"Omaha":2437,"LIU":2344,"Siena":2561,
  "Lehigh":2329,"Howard":47,"Prairie View":2504,"UMBC":2692,
  "Norfolk St":2450,"Alabama St":2011,"Mt St Mary's":116,"Montana":149,
};

function TeamIcon({name, fullName, size=20}) {
  const id = ESPN_IDS[fullName] || ESPN_IDS[name];
  if (id) {
    return <img
      src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png`}
      alt={name}
      style={{width:size,height:size,objectFit:"contain",flexShrink:0,borderRadius:2}}
      onError={e=>{e.target.style.display="none";}}
    />;
  }
  // Fallback: first letter in a circle
  const letter = (name || "?")[0];
  return <div style={{width:size,height:size,borderRadius:size/2,background:"#E8E6E0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.45,fontWeight:700,color:"#9A9A9A",fontFamily:mono,flexShrink:0}}>{letter}</div>;
}

// --- UI COMPONENTS ---
function Stat({label, value, color, large}) {
  return <div>
    <div style={{fontSize:11,color:C.textMuted,fontWeight:500,marginBottom:large?6:4,fontFamily:mono,letterSpacing:"0.02em"}}>{label}</div>
    <div style={{fontSize:large?32:18,fontWeight:large?600:500,color:color||C.text,fontFamily:sans,letterSpacing:"-0.02em",lineHeight:1}}>{value}</div>
  </div>;
}

function Chip({children, active, color, onClick}) {
  return <button onClick={onClick} style={{
    padding:"6px 12px",borderRadius:6,cursor:"pointer",fontSize:13,fontWeight:500,fontFamily:sans,
    border:`1px solid ${active?color||C.accent:C.border}`,
    background:active?(color===C.win?C.winBg:color===C.lose?C.loseBg:color===C.push?C.pushBg:C.accentBg):C.white,
    color:active?color||C.accent:C.textSec,transition:"all 0.15s",
  }}>{children}</button>;
}

function LegTag({leg,onRemove}) {
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 8px 3px 10px",background:C.accentBg,borderRadius:5,fontSize:12,color:C.accent,fontFamily:mono,fontWeight:500}}>
    {leg.label} <span style={{color:C.textMuted,fontSize:11}}>{leg.odds}</span>
    {onRemove&&<button onClick={onRemove} style={{background:"none",border:"none",cursor:"pointer",color:C.textMuted,fontSize:14,lineHeight:1,padding:"0 0 0 2px"}}>×</button>}
  </span>;
}

function BetBuilder({game, onAddBet, onToggleParlayLeg}) {
  const [legs,setLegs]=useState([]);const [wager,setWager]=useState("");
  const [custom,setCustom]=useState(false);const [cL,setCL]=useState("");const [cO,setCO]=useState("");
  const a=game.api;
  const lines=[
    {label:`${a.f} ${a.sp}`,odds:a.so},{label:`${a.d} +${a.sp?.replace("-","")||""}`,odds:a.so},
    {label:`${a.f} ML`,odds:a.fm},{label:`${a.d} ML`,odds:a.dm},
    {label:`Over ${a.ou}`,odds:a.oo},{label:`Under ${a.ou}`,odds:a.ou2},
  ].filter(l => l.odds && l.odds !== "");
  const tog=l=>{const ex=legs.find(x=>x.label===l.label);setLegs(ex?legs.filter(x=>x.label!==l.label):[...legs,{...l,gid:game.id}]);};
  const addC=()=>{if(cL&&cO){setLegs(p=>[...p,{label:cL,odds:cO,gid:game.id}]);setCL("");setCO("");setCustom(false);}};
  const dec=legs.length>0?pDec(legs):null;const odds=dec?d2a(dec):null;
  const w=wager?Number(wager):null;const p=w&&dec?Math.round(w*dec*100)/100:null;
  const [placing,setPlacing]=useState(false);
  const place=async()=>{
    if(!legs.length||!w||placing)return;
    setPlacing(true);
    await onAddBet(game.id, legs.length>1?"parlay":"straight", w, legs);
    setLegs([]);setWager("");setPlacing(false);
  };

  return <div style={{marginTop:16}}>
    <div style={{fontSize:12,fontWeight:600,color:C.textSec,marginBottom:8,fontFamily:sans}}>Build a bet</div>
    <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
      {lines.map((l,i)=><Chip key={i} active={!!legs.find(x=>x.label===l.label)} onClick={()=>tog(l)}>{l.label} <span style={{fontFamily:mono,fontSize:12,marginLeft:4,opacity:0.7}}>{l.odds}</span></Chip>)}
      <Chip active={custom} onClick={()=>setCustom(!custom)}>+ Custom</Chip>
    </div>
    {custom&&<div style={{display:"flex",gap:6,marginBottom:8}}>
      <input value={cL} onChange={e=>setCL(e.target.value)} placeholder="Prop description" style={{flex:2,background:C.white,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 10px",fontSize:13,color:C.text,fontFamily:sans,outline:"none"}}/>
      <input value={cO} onChange={e=>setCO(e.target.value)} placeholder="Odds" style={{flex:0.7,background:C.white,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 10px",fontSize:13,color:C.text,fontFamily:mono,outline:"none"}}/>
      <button onClick={addC} style={{padding:"7px 14px",borderRadius:6,border:"none",background:C.accent,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:sans}}>Add</button>
    </div>}
    {legs.length>0&&<>
      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:10}}>{legs.map((l,i)=><LegTag key={i} leg={l} onRemove={()=>setLegs(p=>p.filter((_,j)=>j!==i))}/>)}</div>
      <div style={{display:"flex",alignItems:"center",gap:16,padding:"12px 14px",background:C.bg,borderRadius:8,border:`1px solid ${C.borderSoft}`}}>
        <div>
          <div style={{fontSize:10,color:C.textMuted,fontFamily:mono,marginBottom:3}}>WAGER</div>
          <input value={wager} onChange={e=>setWager(e.target.value)} placeholder="$" style={{width:80,background:C.white,border:`1px solid ${C.border}`,borderRadius:5,padding:"5px 8px",fontSize:14,fontFamily:mono,color:C.text,outline:"none"}}/>
        </div>
        <div style={{textAlign:"center"}}><div style={{fontSize:10,color:C.textMuted,fontFamily:mono,marginBottom:3}}>ODDS</div><div style={{fontSize:16,fontWeight:600,color:C.accent,fontFamily:mono}}>{odds||"—"}</div></div>
        <div style={{textAlign:"center"}}><div style={{fontSize:10,color:C.textMuted,fontFamily:mono,marginBottom:3}}>PAYOUT</div><div style={{fontSize:16,fontWeight:600,color:p?C.text:C.textMuted,fontFamily:mono}}>{p?fmt$(p):"—"}</div></div>
        <div style={{textAlign:"center"}}><div style={{fontSize:10,color:C.textMuted,fontFamily:mono,marginBottom:3}}>PROFIT</div><div style={{fontSize:16,fontWeight:600,color:p?C.win:C.textMuted,fontFamily:mono}}>{p&&w?"+"+fmt$(p-w):"—"}</div></div>
        <button onClick={place} disabled={!w||placing} style={{marginLeft:"auto",padding:"8px 20px",borderRadius:6,border:"none",cursor:w&&!placing?"pointer":"default",background:w?C.accent:C.chipBg,color:w?"#fff":C.textMuted,fontSize:13,fontWeight:600,fontFamily:sans,transition:"all 0.15s",opacity:placing?0.5:1}}>{placing?"Placing...":"Place bet"}</button>
      </div>
      {legs.length===1&&<button onClick={()=>{onToggleParlayLeg(legs[0]);setLegs([]);}} style={{marginTop:6,fontSize:12,color:C.accent,background:"none",border:"none",cursor:"pointer",fontFamily:sans,fontWeight:500,padding:"4px 0"}}>+ Add to cross-game parlay</button>}
    </>}
  </div>;
}

function BetRow({bet, onUpdate}) {
  const odds=bOdds(bet);const p=pay(bet.wager,odds);
  const [updating,setUpdating]=useState(false);
  const handleResult=async(val)=>{
    setUpdating(true);
    await onUpdate(bet.id, val);
    setUpdating(false);
  };
  return <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:`1px solid ${C.borderSoft}`,opacity:updating?0.5:1}}>
    <div style={{flex:1,minWidth:0}}>
      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
        {bet.legs.length>1&&<span style={{fontSize:10,fontWeight:600,color:C.accent,background:C.accentBg,padding:"2px 6px",borderRadius:3,fontFamily:mono}}>PARLAY</span>}
        {bet.legs.map((l,i)=><span key={i} style={{fontSize:13,color:C.text,fontFamily:sans,fontWeight:500}}>{l.label}{i<bet.legs.length-1?<span style={{color:C.textMuted,margin:"0 4px"}}>+</span>:""}</span>)}
      </div>
      <div style={{fontSize:12,color:C.textMuted,fontFamily:mono,marginTop:3}}>{fmt$(bet.wager)} @ {odds}{p?` → ${fmt$(p)}`:""}</div>
    </div>
    <div style={{display:"flex",gap:3,flexShrink:0}}>
      {[{v:"win",l:"Win",c:C.win,bg:C.winBg},{v:"loss",l:"Loss",c:C.lose,bg:C.loseBg},{v:"push",l:"Push",c:C.push,bg:C.pushBg}].map(r=>{
        const a=bet.result===r.v;
        return <button key={r.v} onClick={e=>{e.stopPropagation();handleResult(a?null:r.v);}} style={{
          padding:"4px 12px",borderRadius:5,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:sans,
          border:a?`1.5px solid ${r.c}`:"1.5px solid transparent",
          background:a?r.bg:"transparent",color:a?r.c:C.textMuted,transition:"all 0.15s",
        }}>{r.l}</button>;
      })}
    </div>
    <div style={{width:80,textAlign:"right",flexShrink:0}}>
      {bet.result==="win"&&p&&<span style={{fontSize:14,fontWeight:600,color:C.win,fontFamily:mono}}>+{fmt$(p-bet.wager)}</span>}
      {bet.result==="loss"&&<span style={{fontSize:14,fontWeight:600,color:C.lose,fontFamily:mono}}>-{fmt$(bet.wager)}</span>}
      {bet.result==="push"&&<span style={{fontSize:13,fontWeight:500,color:C.push,fontFamily:mono}}>Push</span>}
    </div>
  </div>;
}

function GameCard({game,expanded,onToggle,onUpdateComment,onAddBet,onUpdateBet,onToggleParlayLeg}) {
  const hasBets=game.bets.length>0;
  const allRes=hasBets&&game.bets.every(b=>b.result);
  const pl=game.bets.reduce((s,b)=>{const o=bOdds(b);const ot=outc(b.wager,o,b.result);return ot!=null?s+(ot-b.wager):s;},0);
  const commentCount=FRIENDS.filter(f=>game.comments[f.id]).length;
  const [savingComment,setSavingComment]=useState({});

  const handleComment = useCallback((gameId, friendId, text) => {
    // Debounced save
    if (savingComment[friendId]) clearTimeout(savingComment[friendId]);
    const timeout = setTimeout(() => { onUpdateComment(gameId, friendId, text); }, 1500);
    setSavingComment(prev => ({...prev, [friendId]: timeout}));
  }, [onUpdateComment, savingComment]);

  // Local comment state for instant UI feedback
  const [localComments, setLocalComments] = useState(game.comments);
  useEffect(() => { setLocalComments(game.comments); }, [game.comments]);

  const isCompleted = game.completed;
  const gameTime = game.commence_time ? new Date(game.commence_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';

  return <div style={{background:C.panel,borderRadius:10,boxShadow:C.shadow,marginBottom:8,overflow:"hidden",transition:"box-shadow 0.2s",border:`1px solid ${C.borderSoft}`,opacity:isCompleted&&!hasBets?0.6:1}}>
    <div onClick={onToggle} style={{display:"flex",alignItems:"center",padding:"14px 18px",cursor:"pointer",gap:16,transition:"background 0.1s"}}
      onMouseEnter={e=>e.currentTarget.style.background=C.hover} onMouseLeave={e=>e.currentTarget.style.background=C.panel}>
      <div style={{width:6,height:6,borderRadius:3,flexShrink:0,background:isCompleted?(hasBets?(pl>0?C.win:pl<0?C.lose:C.textMuted):C.textMuted):hasBets?C.accent:C.border,alignSelf:"flex-start",marginTop:14}}/>
      <div style={{flex:2,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
          <TeamIcon name={game.api.f} fullName={game.api.fFull} size={20}/>
          <span style={{fontSize:12,color:C.textMuted,fontFamily:sans}}>vs</span>
          <TeamIcon name={game.api.d} fullName={game.api.dFull} size={20}/>
          <span style={{fontSize:14,fontWeight:600,color:C.text,fontFamily:sans}}>{game.matchup}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:12,color:C.textMuted,fontFamily:mono}}>{game.api.f} {game.api.sp} · O/U {game.api.ou} · ML {game.api.fm}/{game.api.dm}</span>
        </div>
      </div>
      {/* Score / Status area */}
      <div style={{flex:0.6,textAlign:"center"}}>
        {isCompleted && game.fav_score != null ? (
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.text,fontFamily:mono}}>{game.fav_score} – {game.dog_score}</div>
            <div style={{fontSize:10,fontWeight:600,color:C.textMuted,fontFamily:mono,textTransform:"uppercase",marginTop:2}}>Final</div>
          </div>
        ) : (
          <div>
            <div style={{fontSize:12,color:C.textSec,fontFamily:mono}}>{gameTime}</div>
          </div>
        )}
      </div>
      {/* Bet summary */}
      <div style={{flex:0.8,textAlign:"right"}}>
        {hasBets?<>
          <div style={{fontSize:13,fontWeight:500,color:C.textSec,fontFamily:sans}}>{game.bets.length} bet{game.bets.length>1?"s":""} · {fmt$(game.bets.reduce((s,b)=>s+(b.wager||0),0))}</div>
          {allRes&&pl!==0&&<div style={{fontSize:13,fontWeight:700,color:pl>0?C.win:C.lose,fontFamily:mono,marginTop:2}}>{pl>0?"+":""}{fmt$(pl)}</div>}
        </>:<span style={{fontSize:13,color:C.textMuted,fontFamily:sans}}>No bets</span>}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0,width:80,justifyContent:"flex-end"}}>
        <div style={{display:"flex",gap:2}}>
          {FRIENDS.map(f => {
            const has = !!game.comments[f.id];
            return <div key={f.id} style={{width:20,height:20,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,fontFamily:mono,background:has?f.bg:"transparent",color:has?f.fg:C.border,border:`1.5px solid ${has?f.bg:C.borderSoft}`,transition:"all 0.2s"}}>{f.i}</div>;
          })}
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" style={{transform:expanded?"rotate(180deg)":"rotate(0)",transition:"transform 0.2s",marginLeft:2}}><polyline points="6 9 12 15 18 9"/></svg>
      </div>
    </div>
    {expanded&&<div style={{padding:"0 18px 18px",borderTop:`1px solid ${C.borderSoft}`}}>
      {hasBets&&<div style={{paddingTop:8}}>{game.bets.map(b=><BetRow key={b.id} bet={b} onUpdate={onUpdateBet}/>)}</div>}
      <BetBuilder game={game} onAddBet={onAddBet} onToggleParlayLeg={onToggleParlayLeg}/>
      <div style={{marginTop:20}}>
        <div style={{fontSize:12,fontWeight:600,color:C.textSec,marginBottom:10,fontFamily:sans}}>Discussion</div>
        {FRIENDS.map(f=><div key={f.id} style={{display:"flex",gap:10,marginBottom:10}}>
          <div style={{width:26,height:26,borderRadius:13,background:f.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:f.fg,fontFamily:mono,flexShrink:0,marginTop:2}}>{f.i}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:12,fontWeight:600,color:f.ct,marginBottom:3,fontFamily:sans}}>{f.label}</div>
            <textarea value={localComments[f.id]||""} onChange={e=>{const v=e.target.value;setLocalComments(p=>({...p,[f.id]:v}));handleComment(game.id,f.id,v);}} placeholder={`${f.name}'s take...`}
              rows={localComments[f.id]?Math.min(3,Math.ceil(localComments[f.id].length/55)):1}
              style={{width:"100%",background:C.bg,border:`1px solid ${C.borderSoft}`,borderRadius:6,color:C.textSec,padding:"7px 10px",fontSize:13,fontFamily:sans,outline:"none",resize:"vertical",lineHeight:1.5,minHeight:34,transition:"border-color 0.2s"}}
              onFocus={e=>e.target.style.borderColor=f.c+"44"} onBlur={e=>e.target.style.borderColor=C.borderSoft}/>
          </div>
        </div>)}
      </div>
    </div>}
  </div>;
}

function ParlayBuilder({legs,wager,setWager,onPlace,onRemoveLeg,onClear}) {
  if(!legs.length)return null;
  const dec=pDec(legs);const odds=d2a(dec);const w=wager?Number(wager):null;const p=w?Math.round(w*dec*100)/100:null;
  return <div style={{position:"sticky",bottom:0,zIndex:10,padding:"12px 0 0"}}>
    <div style={{background:C.panel,border:`1px solid ${C.accent}33`,borderRadius:10,padding:"14px 18px",boxShadow:C.shadowLg}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:13,fontWeight:700,color:C.accent,fontFamily:sans}}>Cross-Game Parlay · {legs.length} legs</span>
        <button onClick={onClear} style={{background:"none",border:"none",cursor:"pointer",color:C.textMuted,fontSize:12,fontFamily:sans}}>Clear</button>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:10}}>{legs.map((l,i)=><LegTag key={i} leg={l} onRemove={()=>onRemoveLeg(i)}/>)}</div>
      <div style={{display:"flex",alignItems:"center",gap:14}}>
        <input value={wager} onChange={e=>setWager(e.target.value)} placeholder="$" style={{width:80,background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,padding:"6px 8px",fontSize:14,fontFamily:mono,color:C.text,outline:"none"}}/>
        <span style={{fontSize:15,fontWeight:600,color:C.accent,fontFamily:mono}}>{odds}</span>
        <span style={{fontSize:15,fontWeight:600,color:p?C.text:C.textMuted,fontFamily:mono}}>→ {p?fmt$(p):"—"}</span>
        {p&&w&&<span style={{fontSize:15,fontWeight:600,color:C.win,fontFamily:mono}}>+{fmt$(p-w)}</span>}
        <button onClick={()=>{if(w)onPlace();}} style={{marginLeft:"auto",padding:"8px 18px",borderRadius:6,border:"none",cursor:w?"pointer":"default",background:w?C.accent:C.chipBg,color:w?"#fff":C.textMuted,fontSize:13,fontWeight:600,fontFamily:sans}}>Place parlay</button>
      </div>
    </div>
  </div>;
}

// --- HISTORICAL DATA ---
const HISTORY = [
  { year: 2022, roi: 30.81, net: 258, wagered: 837, record: null },
  { year: 2023, roi: 14.03, net: 135, wagered: 960, record: null },
  { year: 2024, roi: 5.81, net: 63, wagered: 1091, record: null },
  { year: 2025, roi: 29.69, net: 385, wagered: 1297, record: null },
];

function HistoryPage({ liveStats }) {
  const years = [...HISTORY, { year: 2026, roi: liveStats.roi * 100, net: liveStats.net, wagered: liveStats.wagered, record: `${liveStats.wins}–${liveStats.losses}`, live: true }];
  const avgRoi = years.reduce((s, y) => s + y.roi, 0) / years.length;
  const maxRoi = Math.max(...years.map(y => y.roi));
  const barMax = Math.max(maxRoi, 1);

  return <div>
    <div style={{background:C.panel,borderRadius:10,boxShadow:C.shadow,padding:"24px 28px",marginBottom:16,border:`1px solid ${C.borderSoft}`}}>
      <div style={{display:"flex",gap:48,alignItems:"flex-end"}}>
        <Stat label="LIFETIME AVG ROI" value={`+${avgRoi.toFixed(1)}%`} color={C.accent} large/>
        <Stat label="SEASONS" value={years.length}/>
        <Stat label="BEST YEAR" value={<span>+{maxRoi.toFixed(1)}% <span style={{fontSize:13,color:C.textMuted,fontWeight:400}}>({years.find(y=>y.roi===maxRoi).year})</span></span>} color={C.win}/>
        <Stat label="PROFITABLE" value={`${years.filter(y=>y.roi>0).length} / ${years.length}`}/>
      </div>
    </div>
    <div style={{background:C.panel,borderRadius:10,boxShadow:C.shadow,padding:"24px 28px",marginBottom:16,border:`1px solid ${C.borderSoft}`}}>
      <div style={{fontSize:12,fontWeight:600,color:C.textSec,marginBottom:20,fontFamily:sans}}>ROI by Year</div>
      <div style={{display:"flex",alignItems:"flex-end",gap:16,height:220,position:"relative"}}>
        {years.map(y => {
          const barH = Math.max(6, (y.roi / barMax) * 170);
          return <div key={y.year} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",height:"100%"}}>
            <div style={{fontSize:14,fontWeight:700,color:y.roi>=0?C.win:C.lose,fontFamily:mono,marginBottom:8}}>{y.roi>=0?"+":""}{y.roi.toFixed(1)}%</div>
            {y.net!=null&&<div style={{fontSize:11,color:C.textMuted,fontFamily:mono,marginBottom:4}}>{y.net>=0?"+":""}{fmt$(y.net)}</div>}
            <div style={{width:"100%",maxWidth:100,height:barH,borderRadius:"8px 8px 4px 4px",background:y.live?C.accent:C.win,opacity:y.live?1:0.7+((y.roi/barMax)*0.3),transition:"height 0.8s cubic-bezier(0.4,0,0.2,1)",position:"relative"}}>
              {y.live&&<div style={{position:"absolute",top:-4,left:"50%",transform:"translateX(-50%)",width:8,height:8,borderRadius:4,background:C.accent,border:`2px solid ${C.panel}`}}/>}
            </div>
            <div style={{fontSize:13,fontWeight:y.live?700:500,color:y.live?C.accent:C.textSec,fontFamily:mono,marginTop:10}}>{y.year}</div>
          </div>;
        })}
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:`repeat(${years.length}, 1fr)`,gap:8}}>
      {years.map(y => (
        <div key={y.year} style={{background:C.panel,borderRadius:10,boxShadow:C.shadow,padding:"16px 18px",border:`1px solid ${y.live?C.accent+"33":C.borderSoft}`,position:"relative",overflow:"hidden"}}>
          {y.live&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:C.accent}}/>}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
            <span style={{fontSize:15,fontWeight:700,color:C.text,fontFamily:sans}}>{y.year}</span>
            {y.live&&<span style={{fontSize:8,fontWeight:700,color:C.accent,background:C.accentBg,padding:"2px 5px",borderRadius:3,fontFamily:mono,textTransform:"uppercase"}}>Live</span>}
          </div>
          <div style={{fontSize:24,fontWeight:600,color:y.roi>=0?C.win:C.lose,fontFamily:sans,letterSpacing:"-0.02em",marginBottom:10}}>{y.roi>=0?"+":""}{y.roi.toFixed(1)}%</div>
          <div style={{borderTop:`1px solid ${C.borderSoft}`,paddingTop:8,display:"flex",flexDirection:"column",gap:5}}>
            {[{l:"Net",v:y.net!=null?(y.net>=0?"+":"")+fmt$(y.net):"—",c:y.net!=null?(y.net>=0?C.text:C.lose):C.textMuted},{l:"Wagered",v:y.wagered?fmt$(y.wagered):"—"},{l:"Record",v:y.record||"—"}].map((r,i)=>
              <div key={i} style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:10,color:C.textMuted,fontFamily:mono}}>{r.l}</span><span style={{fontSize:11,fontWeight:600,color:r.c||C.text,fontFamily:mono}}>{r.v}</span></div>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>;
}

// --- MAIN APP ---
export default function App() {
  const { games, loading, refetch } = useGames();
  const [page, setPage] = useState("tracker");
  const [ar, setAr] = useState("r64");
  const [exp, setExp] = useState({});
  const [pL, setPL] = useState([]);
  const [pW, setPW] = useState("");
  const [syncing, setSyncing] = useState(false);

  const roundData = organizeByRound(games);
  const allG = getAllGamesUpTo(roundData, "champ");
  const ts = calcStats(allG);
  const rg = getGamesForRound(roundData, ar);
  const rs = calcStats(rg);
  const curr = roundData[ar];
  const ri = ROUNDS.find(r => r.id === ar);

  const tog = id => setExp(p => ({...p, [id]: !p[id]}));

  const handleAddBet = async (gameId, betType, wager, legs) => {
    await apiBet(gameId, betType, wager, legs);
    refetch();
  };

  const handleUpdateBet = async (betId, result) => {
    await updateBetResult(betId, result);
    refetch();
  };

  const handleComment = async (gameId, friendId, content) => {
    await apiComment(gameId, friendId, content);
    // Don't refetch on every keystroke — real-time subscription handles it
  };

  const togPL = l => setPL(p => {
    const ex = p.find(x => x.label === l.label && x.gid === l.gid);
    return ex ? p.filter(x => !(x.label === l.label && x.gid === l.gid)) : [...p, l];
  });

  const placeParlay = async () => {
    if (pL.length < 2 || !pW) return;
    await apiBet(pL[0].gid, "parlay", Number(pW), pL);
    setPL([]); setPW("");
    refetch();
  };

  const handleSync = async () => {
    setSyncing(true);
    await syncGames();
    await syncScores();
    await refetch();
    setSyncing(false);
  };

  if (loading) return <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div style={{textAlign:"center"}}>
      <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:sans,marginBottom:8}}>Ideas of March</div>
      <div style={{fontSize:13,color:C.textMuted,fontFamily:mono}}>Loading games...</div>
    </div>
  </div>;

  return <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:sans}}>
    <div style={{maxWidth:960,margin:"0 auto",padding:"0 28px"}}>
      {/* Header */}
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"36px 0 0"}}>
        <div style={{display:"flex",alignItems:"baseline",gap:16}}>
          <h1 style={{fontSize:20,fontWeight:700,letterSpacing:"-0.03em",cursor:"pointer"}} onClick={()=>setPage("tracker")}>Ideas of March</h1>
          <span style={{fontSize:12,color:C.textMuted,fontFamily:mono}}>March Madness 2026</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <button onClick={handleSync} disabled={syncing} style={{padding:"5px 12px",borderRadius:5,border:`1px solid ${C.border}`,background:C.white,color:syncing?C.textMuted:C.textSec,fontSize:11,fontWeight:600,fontFamily:mono,cursor:syncing?"default":"pointer",opacity:syncing?0.5:1}}>
            {syncing?"Syncing...":"↻ Sync"}
          </button>
          <div style={{display:"flex",gap:12}}>
            {FRIENDS.map(f=><div key={f.id} style={{display:"flex",alignItems:"center",gap:5}}>
              <div style={{width:20,height:20,borderRadius:10,background:f.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:f.fg,fontFamily:mono}}>{f.i}</div>
              <span style={{fontSize:12,color:C.textSec}}>{f.name}</span>
            </div>)}
          </div>
        </div>
      </header>

      {/* Page nav */}
      <div style={{display:"flex",gap:0,borderBottom:`1px solid ${C.border}`,marginBottom:24,marginTop:16}}>
        {[{id:"tracker",label:"2026 Tracker"},{id:"history",label:"All-Time"}].map(p=>(
          <button key={p.id} onClick={()=>setPage(p.id)} style={{
            padding:"10px 20px 10px 0",cursor:"pointer",background:"none",border:"none",
            borderBottom:page===p.id?`2px solid ${C.text}`:"2px solid transparent",
            fontSize:13,fontWeight:page===p.id?700:400,color:page===p.id?C.text:C.textMuted,fontFamily:sans,
            transition:"all 0.15s",marginRight:8,
          }}>{p.label}</button>
        ))}
      </div>

      {page==="history"?<HistoryPage liveStats={ts}/>:<>
      {/* Dark sticky stats bar */}
      <div style={{position:"sticky",top:0,zIndex:20,margin:"0 -28px",padding:"0 28px"}}>
        <div style={{background:"#0A0A0A",borderRadius:10,padding:"16px 18px",marginBottom:24,boxShadow:"0 4px 20px rgba(0,0,0,0.12)",display:"flex",gap:8,alignItems:"stretch"}}>
          <div style={{flex:"0 0 160px",background:"#161616",borderRadius:8,padding:"14px 18px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
            <div style={{fontSize:10,color:"#666",fontWeight:500,fontFamily:mono,letterSpacing:"0.04em",marginBottom:6}}>TOURNAMENT ROI</div>
            <div style={{fontSize:30,fontWeight:600,color:ts.roi>=0?"#4ADE80":"#F87171",fontFamily:sans,letterSpacing:"-0.03em",lineHeight:1}}>{ts.roi>=0?"+":""}{(ts.roi*100).toFixed(1)}%</div>
          </div>
          {[
            {l:"NET P&L",v:`${ts.net>=0?"+":""}${fmt$(ts.net)}`,c:ts.net>=0?"#4ADE80":"#F87171"},
            {l:"WAGERED",v:fmt$(ts.wagered)},
            {l:"RETURNED",v:fmt$(ts.returned)},
            {l:"RECORD",v:`${ts.wins}W – ${ts.losses}L`},
          ].map((s,i) => (
            <div key={i} style={{flex:1,background:"#161616",borderRadius:8,padding:"14px 16px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
              <div style={{fontSize:10,color:"#555",fontWeight:500,fontFamily:mono,letterSpacing:"0.04em",marginBottom:6}}>{s.l}</div>
              <div style={{fontSize:16,fontWeight:600,color:s.c||"#E0E0E0",fontFamily:sans,letterSpacing:"-0.01em"}}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Round nav */}
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,marginBottom:24}}>
        {ROUNDS.map(r=>{
          const a=ar===r.id;const rg2=getGamesForRound(roundData,r.id);const st=calcStats(rg2);const has=rg2.length>0;
          const roi=st.wagered>0?st.net/st.wagered*100:null;
          return <button key={r.id} onClick={()=>setAr(r.id)} style={{
            flex:1,padding:"12px 0 10px",cursor:"pointer",background:"none",border:"none",
            borderBottom:a?`2px solid ${C.text}`:"2px solid transparent",transition:"all 0.15s",
          }}>
            <div style={{fontSize:13,fontWeight:a?700:400,color:a?C.text:has?C.textSec:C.textMuted,fontFamily:sans}}>{r.short}</div>
            {roi!=null&&<div style={{fontSize:11,color:roi>=0?C.win:C.lose,fontFamily:mono,marginTop:2,fontWeight:600}}>{roi>=0?"+":""}{roi.toFixed(1)}%</div>}
          </button>;
        })}
      </div>

      {/* Round content */}
      <div key={ar}>
        {rs.bets>0&&(() => {
          const cumStats = calcStats(getAllGamesUpTo(roundData, ar));
          const cumRoi = cumStats.wagered > 0 ? cumStats.net / cumStats.wagered : 0;
          const hitRate = rs.resolved > 0 ? (rs.wins / rs.resolved * 100) : 0;
          return <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,marginBottom:24}}>
            {[
              {label:"ROUND ROI",value:`${rs.roi>=0?"+":""}${(rs.roi*100).toFixed(1)}%`,color:rs.roi>=0?C.win:C.lose},
              {label:"ROUND P&L",value:`${rs.net>=0?"+":""}${fmt$(rs.net)}`,color:rs.net>=0?C.win:C.lose},
              {label:"WAGERED",value:fmt$(rs.wagered)},
              {label:"RECORD",value:`${rs.wins}–${rs.losses}`},
              {label:"HIT RATE",value:`${hitRate.toFixed(0)}%`,color:hitRate>=50?C.win:C.lose},
              {label:"CUM. ROI",value:`${cumRoi>=0?"+":""}${(cumRoi*100).toFixed(1)}%`,color:cumRoi>=0?C.accent:C.lose},
            ].map((s,i) => (
              <div key={i} style={{background:C.panel,borderRadius:10,boxShadow:C.shadow,border:`1px solid ${C.borderSoft}`,padding:"16px 18px"}}>
                <div style={{fontSize:10,color:C.textMuted,fontWeight:500,fontFamily:mono,letterSpacing:"0.02em",marginBottom:8}}>{s.label}</div>
                <div style={{fontSize:20,fontWeight:600,color:s.color||C.text,fontFamily:sans,letterSpacing:"-0.02em"}}>{s.value}</div>
              </div>
            ))}
          </div>;
        })()}

        {curr?.days?.length>0?curr.days.map(day=>(
          <div key={day.date} style={{marginBottom:24}}>
            <div style={{fontSize:11,fontWeight:600,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.06em",fontFamily:mono,marginBottom:8,paddingLeft:2}}>{day.label}</div>
            {day.games.map(g=><GameCard key={g.id} game={g} expanded={!!exp[g.id]} onToggle={()=>tog(g.id)} onUpdateComment={handleComment} onAddBet={handleAddBet} onUpdateBet={handleUpdateBet} onToggleParlayLeg={togPL}/>)}
          </div>
        )):(
          <div style={{padding:"60px 0",textAlign:"center",color:C.textMuted}}>
            <div style={{fontSize:14,fontStyle:"italic"}}>No games in this round yet</div>
          </div>
        )}
      </div>

      <ParlayBuilder legs={pL} wager={pW} setWager={setPW} onPlace={placeParlay} onRemoveLeg={i=>setPL(p=>p.filter((_,j)=>j!==i))} onClear={()=>{setPL([]);setPW("");}}/>
      </>}

      <footer style={{padding:"32px 0 40px",borderTop:`1px solid ${C.borderSoft}`,marginTop:40,display:"flex",justifyContent:"space-between"}}>
        <span style={{fontSize:11,color:C.textMuted,fontFamily:mono}}>For entertainment purposes only</span>
        <span style={{fontSize:11,color:C.textMuted,fontFamily:mono}}>2026</span>
      </footer>
    </div>
  </div>;
}
