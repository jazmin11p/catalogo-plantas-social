import { useState, useEffect, useRef } from "react";
import { auth, provider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where, serverTimestamp } from "firebase/firestore";
import PlantCanvas from "./PlantCanvas";

// ── Feature flag hook ──────────────────────────────────
function useFeature(featureId, user) {
  const [access, setAccess] = useState("loading");
  useEffect(() => {
    if (!user) { setAccess("denied"); return; }
    (async () => {
      try {
        const snap = await getDoc(doc(db, "featureFlags", featureId));
        if (!snap.exists()) { setAccess("denied"); return; }
        const { allowedUids = [], requiredPlan, enabled } = snap.data();
        if (!enabled) { setAccess("denied"); return; }
        if (allowedUids.includes(user.uid)) { setAccess("granted"); return; }
        if (requiredPlan) {
          const userSnap = await getDoc(doc(db, "users", user.uid));
          const plan = userSnap.data()?.plan || "free";
          setAccess(plan === requiredPlan || plan === "enterprise" ? "granted" : "upgrade");
          return;
        }
        setAccess("denied");
      } catch(e) { setAccess("denied"); }
    })();
  }, [featureId, user?.uid]);
  return access;
}

// ── Constants ──────────────────────────────────────────
const LIGHT_OPTIONS = ["Pleno sol","Sol parcial","Sombra","Sombra parcial"];
const WATER_OPTIONS = ["Diario","Cada 2-3 días","Semanal","Quincenal","Mensual"];
const ORIGIN_SUGGESTIONS = ["América del Sur","América Central","América del Norte","México","Asia tropical","Asia templada","África","Mediterráneo","Europa","Oceanía","Oriente Medio","Cosmopolita"];
const CANOPY_TYPES = ["Globosa","Aparasolada","Columnar","Piramidal","Irregular"];
const CANOPY_TEXTURES = ["Fina","Media","Gruesa"];
const PLANT_TYPES = [
  { value:"cubresuelo", label:"Cubresuelo", emoji:"🍀", desc:"Crece al ras del suelo cubriendo superficies" },
  { value:"herbaceas",  label:"Herbácea",   emoji:"🌿", desc:"Tallo blando sin madera, generalmente pequeña" },
  { value:"arbustivas", label:"Arbustiva",  emoji:"🪴", desc:"Tallo leñoso ramificado desde la base" },
  { value:"arboles",    label:"Árbol",      emoji:"🌲", desc:"Tallo leñoso principal con copa definida" },
];
const DEFAULT_TAGS = ["Interior","Exterior","Jardín tropical","Jardín desértico","Jardín zen","Jardín acuático","Balcón","Terrario","Huerto","Sombra profunda","Cubierta","Maceta"];
const ROOT_GROWTH = [
  { value:"horizontal",  label:"Horizontal (lateral)",   emoji:"↔️" },
  { value:"fasciculada", label:"Fasciculada (diagonal)",  emoji:"↗️" },
  { value:"vertical",    label:"Vertical",               emoji:"↕️" },
];
const ROOT_DEPTH = [
  { value:"superficial", label:"Superficiales",     color:"#4a7a30" },
  { value:"media",       label:"Profundidad media", color:"#7a6030" },
  { value:"profunda",    label:"Profundas",         color:"#7a4030" },
];

// ── Glossary data ──────────────────────────────────────
const GLOSSARY_ROOTS_GROWTH = [
  { value:"horizontal",  label:"Horizontal (lateral)",  emoji:"↔️", description:"Raíces que crecen en forma lateral desde la base del tronco, distribuyéndose radialmente cerca de la superficie del suelo." },
  { value:"fasciculada", label:"Fasciculada (diagonal)", emoji:"↗️", description:"Raíces que crecen en diagonal, expandiéndose en varias prolongaciones desde la base de la planta." },
  { value:"vertical",    label:"Vertical",              emoji:"↕️", description:"Raíces que crecen hacia abajo de forma recta y pronunciada, alcanzando capas profundas del suelo." },
];
const GLOSSARY_ROOTS_DEPTH = [
  { value:"superficial", label:"Superficiales",     color:"#4a7a30", description:"También conocidas como de crecimiento horizontal. Son aquellas raíces que crecen a poca profundidad y se distribuyen radialmente desde la base del tronco. Pueden encontrarse desde el nivel del suelo hasta 40 a 50 cm de profundidad." },
  { value:"media",       label:"Profundidad media", color:"#7a6030", description:"Las raíces que tienen un crecimiento vertical limitado que continúa en forma diagonal expandiéndose en varias prolongaciones. Pueden encontrarse desde 50 a 60 hasta 90 a 100 cm de profundidad." },
  { value:"profunda",    label:"Profundas",         color:"#7a4030", description:"Son las raíces que crecen en forma vertical y que alcanzan profundidades de 80 a 100 cm a más. A estas raíces también se les conoce como pivotantes." },
];
const GLOSSARY_CANOPY_TYPES = [
  { value:"Globosa",     label:"Globosa",     description:"Copa redonda y uniforme, como una esfera. Proyección de sombra circular y simétrica.", shape:"circle" },
  { value:"Aparasolada", label:"Aparasolada", description:"Copa plana y muy extendida horizontalmente, como un paraguas abierto. Genera sombra amplia.", shape:"umbrella" },
  { value:"Columnar",    label:"Columnar",    description:"Copa estrecha y alargada verticalmente, sin mucha extensión lateral. Ideal para espacios reducidos.", shape:"column" },
  { value:"Piramidal",   label:"Piramidal",   description:"Copa en forma de triángulo o cono, más ancha en la base y estrecha en la punta.", shape:"triangle" },
  { value:"Irregular",   label:"Irregular",   description:"Copa sin forma definida, asimétrica. Varía mucho según el individuo y las condiciones del entorno.", shape:"irregular" },
];
const GLOSSARY_CANOPY_TEXTURES = [
  { value:"Fina",   label:"Fina",   description:"Follaje compuesto por hojas o folíolos pequeños y delicados. Da aspecto ligero y aireado a la copa." },
  { value:"Media",  label:"Media",  description:"Follaje de tamaño intermedio. Equilibrio entre ligereza y densidad visual." },
  { value:"Gruesa", label:"Gruesa", description:"Follaje compuesto por hojas grandes y densas. Da aspecto robusto y genera más sombra." },
];
const GLOSSARY_LEAVES_TYPES = [
  { value:"simple",    label:"Simples",    description:"Las que presentan una sola lámina y se fijan a la rama mediante el peciolo." },
  { value:"compuesta", label:"Compuestas", description:"Las que están formadas por varias láminas que se fijan al eje de la hoja, que a su vez se une al peciolo." },
];
const GLOSSARY_LEAVES_SHAPES = [
  { value:"lanceolada", label:"Lanceolada", description:"Hoja larga y estrecha, puntiaguda en ambos extremos, como una lanza." },
  { value:"romboide",   label:"Romboide",   description:"Hoja en forma de rombo o diamante, más ancha en el centro." },
  { value:"abanico",    label:"Abanico",    description:"Hoja en forma de abanico, con nervios que se abren radialmente desde la base." },
  { value:"aguja",      label:"Aguja",      description:"Hoja muy delgada y rígida, típica de coníferas como el pino." },
];

const emptyForm = {
  commonName:"", scientificName:"", origin:"",
  photo:"", photoFlower:"", photoFruit:"", photoLeaf:"",
  light:"", waterFrequency:"", waterLitersYoung:"", waterLitersMedium:"", waterLitersAdult:"",
  soil:"", canopyType:"", canopyTexture:"",
  rootGrowth:"", rootGrowthPhoto:"", rootGrowthDesc:"", rootDepth:"",
  plantType:"", heightMin:"", heightMax:"", canopySize:"",
  gardenTags:[], notes:"",
};

// ── Theme ──────────────────────────────────────────────
const C = {
  bg:        "#f5f0e8",
  bgCard:    "#ffffff",
  bgDeep:    "#3a5c28",
  bgPanel:   "#4a7235",
  bgItem:    "#3a5c28",
  bgItemHov: "#305020",
  border:    "#c8b898",
  borderMid: "#a89878",
  green:     "#5a8a3a",
  greenLight:"#7aaa50",
  greenPale: "#dde8cc",
  greenText: "#2c4a1a",
  sand:      "#e8dfc8",
  sandText:  "#5a4a27",
  text:      "#2c3020",
  textMid:   "#5a6a4a",
  textLight: "#8a9a72",
  teal:      "#1a5060",
  tealBg:    "#d0e8f0",
};
const font = { serif:"'Playfair Display', serif", body:"'Lora', serif" };

// ── Shared UI ──────────────────────────────────────────
function TagChip({ label, active, onClick, onDelete }) {
  return (
    <span onClick={onClick} style={{display:"inline-flex",alignItems:"center",gap:"4px",padding:"3px 12px",borderRadius:"999px",fontSize:"12px",fontFamily:font.body,cursor:onClick?"pointer":"default",background:active?C.greenPale:"#f0ece0",color:active?C.greenText:C.textLight,border:active?`1px solid ${C.green}`:`0.5px solid ${C.border}`,transition:"all 0.15s",userSelect:"none"}}>
      {label}
      {onDelete&&<span onClick={e=>{e.stopPropagation();onDelete();}} style={{marginLeft:"2px",opacity:0.6,fontWeight:"bold"}}>×</span>}
    </span>
  );
}
function TealChip({ label }) {
  return <span style={{display:"inline-flex",alignItems:"center",padding:"3px 12px",borderRadius:"999px",fontSize:"12px",fontFamily:font.body,background:C.tealBg,color:C.teal,border:`0.5px solid #a0c8d8`}}>{label}</span>;
}
function SandChip({ label }) {
  return <span style={{display:"inline-flex",alignItems:"center",padding:"3px 12px",borderRadius:"999px",fontSize:"12px",fontFamily:font.body,background:C.sand,color:C.sandText,border:`0.5px solid ${C.borderMid}`}}>{label}</span>;
}
function SectionLabel({ children }) {
  return <p style={{color:C.textLight,fontFamily:font.body,fontSize:"11px",textTransform:"uppercase",letterSpacing:"0.12em",margin:"0 0 8px"}}>{children}</p>;
}
function DimCard({ label, value }) {
  return (
    <div style={{background:C.bg,border:`0.5px solid ${C.border}`,borderRadius:"10px",padding:"8px 14px",textAlign:"center"}}>
      <p style={{margin:0,color:C.textLight,fontFamily:font.body,fontSize:"10px",textTransform:"uppercase",letterSpacing:"0.08em"}}>{label}</p>
      <p style={{margin:"3px 0 0",color:C.text,fontFamily:font.serif,fontSize:"16px",fontWeight:600}}>{value}</p>
    </div>
  );
}
function Spinner() {
  return <div style={{width:"20px",height:"20px",border:`2px solid ${C.border}`,borderTop:`2px solid ${C.green}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>;
}

// ── Photo Uploader ─────────────────────────────────────
function PhotoUploader({ value, onChange, label, height=200 }) {
  const fileRef = useRef();
  const [scale, setScale] = useState(100);
  const handleFile = e => { const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>onChange(ev.target.result); r.readAsDataURL(f); };
  return (
    <div>
      {label&&<p style={{color:C.textLight,fontFamily:font.body,fontSize:"11px",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"6px",marginTop:0}}>{label}</p>}
      <div style={{height:`${height}px`,borderRadius:"12px",border:value?`0.5px solid ${C.border}`:`2px dashed ${C.border}`,background:C.bg,overflow:"hidden",position:"relative",display:"flex",alignItems:"center",justifyContent:"center",cursor:value?"default":"pointer"}} onClick={()=>!value&&fileRef.current.click()}>
        {value?(
          <>
            <img src={value} style={{width:"100%",height:"100%",objectFit:"contain",transform:`scale(${scale/100})`,transformOrigin:"center",transition:"transform 0.2s"}} alt=""/>
            <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(240,236,224,0.92)",padding:"8px 12px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"5px"}}>
                <span style={{color:C.textLight,fontFamily:font.body,fontSize:"10px",whiteSpace:"nowrap"}}>Zoom</span>
                <input type="range" min="100" max="220" value={scale} onChange={e=>setScale(+e.target.value)} style={{flex:1,accentColor:C.green}}/>
              </div>
              <div style={{display:"flex",gap:"6px"}}>
                <button onClick={e=>{e.stopPropagation();fileRef.current.click();}} style={{flex:1,padding:"4px",background:C.green,color:"#fff",border:"none",borderRadius:"6px",fontFamily:font.body,fontSize:"11px",cursor:"pointer"}}>Cambiar foto</button>
                <button onClick={e=>{e.stopPropagation();onChange("");setScale(100);}} style={{padding:"4px 10px",background:"#f0e0d8",color:"#a05050",border:`0.5px solid #d4b8b8`,borderRadius:"6px",fontFamily:font.body,fontSize:"11px",cursor:"pointer"}}>✕</button>
              </div>
            </div>
          </>
        ):(
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:"26px",opacity:0.3}}>📷</div>
            <p style={{color:C.textLight,fontFamily:font.body,fontSize:"12px",margin:"4px 0 0"}}>{label||"Agregar foto"}</p>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{display:"none"}}/>
    </div>
  );
}

// ── Login ──────────────────────────────────────────────
function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const go = async()=>{ setLoading(true); try { await signInWithPopup(auth,provider); } catch(e){ console.error(e); setLoading(false); } };
  return (
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg, #e8f0d8 0%, ${C.bg} 100%)`,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px"}}>
      <div style={{textAlign:"center",maxWidth:"360px"}}>
        <div style={{fontSize:"60px",marginBottom:"16px"}}>🌿</div>
        <p style={{color:C.green,fontFamily:font.body,fontSize:"12px",textTransform:"uppercase",letterSpacing:"0.2em",margin:"0 0 8px"}}>Bienvenida a</p>
        <h1 style={{color:C.text,fontFamily:font.serif,fontSize:"30px",fontWeight:600,margin:"0 0 12px",lineHeight:1.1}}>Catálogo de Plantas</h1>
        <p style={{color:C.textMid,fontFamily:font.body,fontSize:"14px",lineHeight:1.7,margin:"0 0 40px"}}>Tu biblioteca personal y comunidad de plantas.</p>
        <button onClick={go} disabled={loading} style={{display:"inline-flex",alignItems:"center",gap:"12px",padding:"14px 28px",background:"#fff",color:"#333",border:`0.5px solid ${C.border}`,borderRadius:"12px",fontFamily:font.body,fontSize:"15px",cursor:"pointer",boxShadow:"0 2px 12px rgba(0,0,0,0.1)",width:"100%",justifyContent:"center"}}>
          {loading?<Spinner/>:<><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" alt="G"/> Continuar con Gmail</>}
        </button>
      </div>
    </div>
  );
}

// ── Plant Card ─────────────────────────────────────────
function PlantCard({ plant, onClick, onCopy, isOwn }) {
  const pt = PLANT_TYPES.find(o=>o.value===plant.plantType);
  const heightStr = plant.heightMin||plant.heightMax ? (plant.heightMin&&plant.heightMax?`${plant.heightMin}–${plant.heightMax} m`:`${plant.heightMin||plant.heightMax} m`) : null;
  return (
    <div style={{background:C.bgCard,border:`0.5px solid ${C.border}`,borderRadius:"14px",overflow:"hidden",cursor:"pointer",transition:"transform 0.2s,box-shadow 0.2s",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.12)";}}
      onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,0.06)";}}>
      <div onClick={()=>onClick(plant)} style={{height:"190px",overflow:"hidden",position:"relative",background:`linear-gradient(135deg, ${C.greenPale}, #c8d8a0)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
        {plant.photo?<img src={plant.photo} alt={plant.commonName} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:"42px",opacity:0.3}}>🌿</span>}
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:"50px",background:"linear-gradient(transparent,rgba(240,236,224,0.7))"}}/>
        {pt&&<span style={{position:"absolute",top:"8px",right:"8px",fontSize:"16px",background:"rgba(255,255,255,0.8)",borderRadius:"8px",padding:"3px 7px"}}>{pt.emoji}</span>}
        {(plant.photoFlower||plant.photoFruit||plant.photoLeaf)&&(
          <div style={{position:"absolute",bottom:"8px",left:"8px",display:"flex",gap:"4px"}}>
            {plant.photoFlower&&<span style={{fontSize:"11px",background:"rgba(255,255,255,0.8)",borderRadius:"6px",padding:"2px 5px"}}>🌸</span>}
            {plant.photoFruit&&<span style={{fontSize:"11px",background:"rgba(255,255,255,0.8)",borderRadius:"6px",padding:"2px 5px"}}>🍎</span>}
            {plant.photoLeaf&&<span style={{fontSize:"11px",background:"rgba(255,255,255,0.8)",borderRadius:"6px",padding:"2px 5px"}}>🍃</span>}
          </div>
        )}
      </div>
      <div onClick={()=>onClick(plant)} style={{padding:"12px 14px 8px"}}>
        <h3 style={{margin:"0 0 2px",color:C.text,fontFamily:font.serif,fontSize:"15px",fontWeight:600,lineHeight:1.2}}>{plant.commonName||"Sin nombre"}</h3>
        <p style={{margin:"0 0 2px",color:C.textMid,fontFamily:font.body,fontSize:"11px",fontStyle:"italic"}}>{plant.scientificName||"—"}</p>
        {plant.origin&&<p style={{margin:"0 0 8px",color:C.green,fontFamily:font.body,fontSize:"11px"}}>📍 {plant.origin}</p>}
        <div style={{display:"flex",flexWrap:"wrap",gap:"4px",marginBottom:"6px"}}>
          {plant.gardenTags?.slice(0,2).map(t=><TagChip key={t} label={t} active/>)}
          {plant.gardenTags?.length>2&&<span style={{color:C.textLight,fontSize:"11px",alignSelf:"center"}}>+{plant.gardenTags.length-2}</span>}
        </div>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          {plant.light&&<span style={{color:C.textMid,fontSize:"11px",fontFamily:font.body}}>☀️ {plant.light}</span>}
          {heightStr&&<span style={{color:C.textMid,fontSize:"11px",fontFamily:font.body}}>📏 {heightStr}</span>}
        </div>
      </div>
      {!isOwn&&onCopy&&<div style={{padding:"6px 14px 12px"}}><button onClick={e=>{e.stopPropagation();onCopy(plant);}} style={{width:"100%",padding:"7px",background:C.tealBg,color:C.teal,border:`0.5px solid #a0c8d8`,borderRadius:"8px",fontFamily:font.body,fontSize:"12px",cursor:"pointer"}}>＋ Traer a mi colección</button></div>}
      {isOwn&&<div style={{height:"12px"}}/>}
    </div>
  );
}

// ── Carousel Detail Modal ──────────────────────────────
function DetailModal({ plant, onClose, onEdit, onDelete, onCopy, isOwn }) {
  const [slide, setSlide] = useState(0);
  if (!plant) return null;
  const pt = PLANT_TYPES.find(o=>o.value===plant.plantType);
  const rg = ROOT_GROWTH.find(r=>r.value===plant.rootGrowth);
  const rd = ROOT_DEPTH.find(r=>r.value===plant.rootDepth);
  const heightStr = plant.heightMin||plant.heightMax ? (plant.heightMin&&plant.heightMax?`${plant.heightMin} – ${plant.heightMax} m`:`${plant.heightMin||plant.heightMax} m`) : null;

  const slides = [
    plant.photo && { src:plant.photo, label:"Principal" },
    plant.photoFlower && { src:plant.photoFlower, label:"Flor 🌸" },
    plant.photoFruit  && { src:plant.photoFruit,  label:"Fruto 🍎" },
    plant.photoLeaf   && { src:plant.photoLeaf,   label:"Hoja 🍃" },
  ].filter(Boolean);

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(44,48,32,0.6)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.bgCard,border:`0.5px solid ${C.border}`,borderRadius:"20px",width:"100%",maxWidth:"540px",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>

        {/* Carousel */}
        {slides.length>0&&(
          <div style={{height:"250px",position:"relative",background:C.bg,borderRadius:"20px 20px 0 0",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <img src={slides[slide].src} style={{width:"100%",height:"100%",objectFit:"contain"}} alt={slides[slide].label}/>
            {slides.length>1&&(
              <>
                <button onClick={()=>setSlide(s=>(s-1+slides.length)%slides.length)} style={{position:"absolute",left:"10px",top:"50%",transform:"translateY(-50%)",background:"rgba(255,255,255,0.85)",border:`0.5px solid ${C.border}`,borderRadius:"50%",width:"32px",height:"32px",cursor:"pointer",fontSize:"16px",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
                <button onClick={()=>setSlide(s=>(s+1)%slides.length)} style={{position:"absolute",right:"10px",top:"50%",transform:"translateY(-50%)",background:"rgba(255,255,255,0.85)",border:`0.5px solid ${C.border}`,borderRadius:"50%",width:"32px",height:"32px",cursor:"pointer",fontSize:"16px",display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
                <div style={{position:"absolute",bottom:"10px",left:0,right:0,display:"flex",justifyContent:"center",gap:"5px",alignItems:"center"}}>
                  {slides.map((_,i)=><span key={i} onClick={()=>setSlide(i)} style={{width:"7px",height:"7px",borderRadius:"50%",background:i===slide?C.green:C.border,display:"inline-block",cursor:"pointer",transition:"background 0.2s"}}/>)}
                </div>
                <span style={{position:"absolute",top:"10px",right:"12px",background:"rgba(255,255,255,0.85)",borderRadius:"8px",padding:"3px 9px",color:C.textMid,fontFamily:font.body,fontSize:"11px"}}>{slides[slide].label} · {slide+1}/{slides.length}</span>
              </>
            )}
          </div>
        )}

        <div style={{padding:"22px 24px"}}>
          <h2 style={{margin:"0 0 2px",color:C.text,fontFamily:font.serif,fontSize:"24px",fontWeight:600}}>{plant.commonName}</h2>
          <p style={{margin:"0 0 4px",color:C.textMid,fontFamily:font.body,fontStyle:"italic",fontSize:"14px"}}>{plant.scientificName}</p>
          {plant.origin&&<p style={{margin:"0 0 16px",color:C.green,fontFamily:font.body,fontSize:"13px"}}>📍 {plant.origin}</p>}

          {pt&&<div style={{marginBottom:"14px"}}><SectionLabel>Clasificación</SectionLabel><span style={{display:"inline-flex",alignItems:"center",gap:"5px",padding:"3px 12px",borderRadius:"999px",fontSize:"12px",fontFamily:font.body,background:C.tealBg,color:C.teal,border:`0.5px solid #a0c8d8`}}>{pt.emoji} {pt.label}</span></div>}

          {(heightStr||plant.canopySize||plant.canopyType||plant.canopyTexture)&&(
            <div style={{marginBottom:"14px"}}>
              <SectionLabel>Dimensiones y copa</SectionLabel>
              <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                {heightStr&&<DimCard label="Altura" value={heightStr}/>}
                {plant.canopySize&&<DimCard label="Copa" value={`${plant.canopySize} m`}/>}
                {plant.canopyType&&<DimCard label="Forma" value={plant.canopyType}/>}
                {plant.canopyTexture&&<DimCard label="Textura" value={plant.canopyTexture}/>}
              </div>
            </div>
          )}

          {plant.light&&<div style={{marginBottom:"14px"}}><SectionLabel>Luz</SectionLabel><TealChip label={"☀️ "+plant.light}/></div>}

          {(plant.waterFrequency||plant.waterLitersYoung||plant.waterLitersMedium||plant.waterLitersAdult)&&(
            <div style={{marginBottom:"14px"}}>
              <SectionLabel>Riego</SectionLabel>
              {plant.waterFrequency&&<div style={{marginBottom:"8px"}}><TealChip label={"💧 "+plant.waterFrequency}/></div>}
              {(plant.waterLitersYoung||plant.waterLitersMedium||plant.waterLitersAdult)&&(
                <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                  {plant.waterLitersYoung&&<DimCard label="Joven" value={`${plant.waterLitersYoung} L`}/>}
                  {plant.waterLitersMedium&&<DimCard label="Mediano" value={`${plant.waterLitersMedium} L`}/>}
                  {plant.waterLitersAdult&&<DimCard label="Adulto" value={`${plant.waterLitersAdult} L`}/>}
                </div>
              )}
            </div>
          )}

          {plant.soil&&<div style={{marginBottom:"14px"}}><SectionLabel>Tierra</SectionLabel><p style={{color:C.textMid,fontFamily:font.body,fontSize:"14px",lineHeight:1.6,margin:0}}>🪴 {plant.soil}</p></div>}

          {(rg||rd)&&(
            <div style={{marginBottom:"14px"}}>
              <SectionLabel>Sistema radicular</SectionLabel>
              <div style={{display:"flex",gap:"7px",flexWrap:"wrap",marginBottom:"6px"}}>
                {rg&&<SandChip label={`${rg.emoji} ${rg.label}`}/>}
                {rd&&<SandChip label={rd.label}/>}
              </div>
              <p style={{color:C.textLight,fontFamily:font.body,fontSize:"11px",margin:0,fontStyle:"italic"}}>Descripción completa en Glosario botánico</p>
            </div>
          )}

          {plant.gardenTags?.length>0&&<div style={{marginBottom:"14px"}}><SectionLabel>Tipo de jardín</SectionLabel><div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>{plant.gardenTags.map(t=><TagChip key={t} label={t} active/>)}</div></div>}
          {plant.notes&&<div style={{marginBottom:"18px"}}><SectionLabel>Notas</SectionLabel><p style={{color:C.textMid,fontFamily:font.body,fontSize:"14px",lineHeight:1.7,margin:0}}>{plant.notes}</p></div>}

          <div style={{display:"flex",gap:"8px"}}>
            {isOwn?(<><button onClick={()=>onEdit(plant)} style={{flex:1,padding:"10px",background:C.green,color:"#fff",border:"none",borderRadius:"10px",fontFamily:font.body,fontSize:"14px",cursor:"pointer"}}>✏️ Editar</button><button onClick={()=>onDelete(plant.id)} style={{padding:"10px 14px",background:"#f8ece8",color:"#a05050",border:`0.5px solid #d4b8b8`,borderRadius:"10px",fontFamily:font.body,fontSize:"14px",cursor:"pointer"}}>🗑</button></>)
            :(<button onClick={()=>onCopy(plant)} style={{flex:1,padding:"10px",background:C.tealBg,color:C.teal,border:`0.5px solid #a0c8d8`,borderRadius:"10px",fontFamily:font.body,fontSize:"14px",cursor:"pointer"}}>＋ Traer a mi colección</button>)}
            <button onClick={onClose} style={{padding:"10px 14px",background:C.bg,color:C.textMid,border:`0.5px solid ${C.border}`,borderRadius:"10px",fontFamily:font.body,fontSize:"14px",cursor:"pointer"}}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Plant Form ─────────────────────────────────────────
function PlantForm({ initial, allTags, onSave, onCancel }) {
  const [form, setForm] = useState(initial||emptyForm);
  const [showOriginSug, setShowOriginSug] = useState(false);
  const set = (f,v)=>setForm(p=>({...p,[f]:v}));
  const toggleTag = tag=>setForm(p=>({...p,gardenTags:p.gardenTags.includes(tag)?p.gardenTags.filter(t=>t!==tag):[...p.gardenTags,tag]}));
  const inp={width:"100%",padding:"10px 12px",background:C.bg,border:`0.5px solid ${C.border}`,borderRadius:"8px",color:C.text,fontFamily:font.body,fontSize:"14px",boxSizing:"border-box",outline:"none"};
  const lbl={display:"block",color:C.textLight,fontFamily:font.body,fontSize:"11px",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"6px"};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(44,48,32,0.55)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
      <div style={{background:C.bgCard,border:`0.5px solid ${C.border}`,borderRadius:"20px",width:"100%",maxWidth:"600px",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.15)",padding:"28px"}}>
        <h2 style={{color:C.text,fontFamily:font.serif,fontSize:"22px",margin:"0 0 24px"}}>{initial?"Editar planta":"Nueva ficha de planta"}</h2>

        <div style={{marginBottom:"20px"}}><PhotoUploader value={form.photo} onChange={v=>set("photo",v)} label="Foto principal" height={220}/></div>
        <div style={{marginBottom:"20px"}}>
          <label style={lbl}>Fotos de detalle</label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"10px"}}>
            <PhotoUploader value={form.photoFlower} onChange={v=>set("photoFlower",v)} label="Flor 🌸" height={110}/>
            <PhotoUploader value={form.photoFruit}  onChange={v=>set("photoFruit",v)}  label="Fruto 🍎" height={110}/>
            <PhotoUploader value={form.photoLeaf}   onChange={v=>set("photoLeaf",v)}   label="Hoja 🍃" height={110}/>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px",marginBottom:"14px"}}>
          <div><label style={lbl}>Nombre común</label><input style={inp} value={form.commonName} onChange={e=>set("commonName",e.target.value)} placeholder="Ej: Helecho"/></div>
          <div><label style={lbl}>Nombre científico</label><input style={inp} value={form.scientificName} onChange={e=>set("scientificName",e.target.value)} placeholder="Ej: Nephrolepis"/></div>
        </div>

        <div style={{marginBottom:"14px",position:"relative"}}>
          <label style={lbl}>Origen geográfico</label>
          <input style={inp} value={form.origin} onChange={e=>set("origin",e.target.value)} onFocus={()=>setShowOriginSug(true)} onBlur={()=>setTimeout(()=>setShowOriginSug(false),150)} placeholder="Ej: América del Sur, Asia tropical..."/>
          {showOriginSug&&(
            <div style={{position:"absolute",top:"100%",left:0,right:0,background:C.bgCard,border:`0.5px solid ${C.border}`,borderRadius:"8px",zIndex:10,maxHeight:"140px",overflowY:"auto",marginTop:"2px",boxShadow:"0 8px 24px rgba(0,0,0,0.1)"}}>
              {ORIGIN_SUGGESTIONS.filter(s=>!form.origin||s.toLowerCase().includes(form.origin.toLowerCase())).map(s=>(
                <div key={s} onClick={()=>{set("origin",s);setShowOriginSug(false);}} style={{padding:"8px 14px",color:C.text,fontFamily:font.body,fontSize:"13px",cursor:"pointer",borderBottom:`0.5px solid ${C.border}`}}
                  onMouseEnter={e=>e.currentTarget.style.background=C.bg}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{s}</div>
              ))}
            </div>
          )}
        </div>

        <div style={{marginBottom:"16px"}}>
          <label style={lbl}>Clasificación de la planta</label>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px"}}>
            {PLANT_TYPES.map(pt=>(
              <div key={pt.value} onClick={()=>set("plantType",form.plantType===pt.value?"":pt.value)} style={{padding:"10px 8px",borderRadius:"10px",textAlign:"center",cursor:"pointer",transition:"all 0.15s",background:form.plantType===pt.value?C.tealBg:C.bg,border:form.plantType===pt.value?`1px solid #a0c8d8`:`0.5px solid ${C.border}`}}>
                <div style={{fontSize:"22px"}}>{pt.emoji}</div>
                <p style={{margin:"4px 0 0",color:form.plantType===pt.value?C.teal:C.textLight,fontFamily:font.body,fontSize:"11px"}}>{pt.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{marginBottom:"14px"}}>
          <label style={lbl}>Dimensiones</label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"10px"}}>
            <div><p style={{...lbl,marginBottom:"4px"}}>Altura mín. (m)</p><input style={inp} type="number" min="0" step="0.1" value={form.heightMin} onChange={e=>set("heightMin",e.target.value)} placeholder="0.5"/></div>
            <div><p style={{...lbl,marginBottom:"4px"}}>Altura máx. (m)</p><input style={inp} type="number" min="0" step="0.1" value={form.heightMax} onChange={e=>set("heightMax",e.target.value)} placeholder="2"/></div>
            <div><p style={{...lbl,marginBottom:"4px"}}>Copa (m)</p><input style={inp} type="number" min="0" step="0.1" value={form.canopySize} onChange={e=>set("canopySize",e.target.value)} placeholder="1.5"/></div>
          </div>
        </div>

        <div style={{marginBottom:"14px"}}>
          <label style={lbl}>Tipo y textura de copa</label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
            <select style={{...inp,appearance:"none"}} value={form.canopyType} onChange={e=>set("canopyType",e.target.value)}>
              <option value="">Forma de copa —</option>{CANOPY_TYPES.map(o=><option key={o}>{o}</option>)}
            </select>
            <select style={{...inp,appearance:"none"}} value={form.canopyTexture} onChange={e=>set("canopyTexture",e.target.value)}>
              <option value="">Textura —</option>{CANOPY_TEXTURES.map(o=><option key={o}>{o}</option>)}
            </select>
          </div>
        </div>

        <div style={{marginBottom:"14px"}}>
          <label style={lbl}>Luz</label>
          <select style={{...inp,appearance:"none"}} value={form.light} onChange={e=>set("light",e.target.value)}>
            <option value="">—</option>{LIGHT_OPTIONS.map(o=><option key={o}>{o}</option>)}
          </select>
        </div>

        <div style={{marginBottom:"14px"}}>
          <label style={lbl}>Riego</label>
          <select style={{...inp,appearance:"none",marginBottom:"10px"}} value={form.waterFrequency} onChange={e=>set("waterFrequency",e.target.value)}>
            <option value="">Frecuencia —</option>{WATER_OPTIONS.map(o=><option key={o}>{o}</option>)}
          </select>
          <p style={{...lbl,marginBottom:"6px"}}>Litros por etapa de crecimiento</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px"}}>
            <div><p style={{...lbl,marginBottom:"4px",fontSize:"10px"}}>Joven (L)</p><input style={inp} type="number" min="0" step="0.1" value={form.waterLitersYoung} onChange={e=>set("waterLitersYoung",e.target.value)} placeholder="0.5"/></div>
            <div><p style={{...lbl,marginBottom:"4px",fontSize:"10px"}}>Mediano (L)</p><input style={inp} type="number" min="0" step="0.1" value={form.waterLitersMedium} onChange={e=>set("waterLitersMedium",e.target.value)} placeholder="1"/></div>
            <div><p style={{...lbl,marginBottom:"4px",fontSize:"10px"}}>Adulto (L)</p><input style={inp} type="number" min="0" step="0.1" value={form.waterLitersAdult} onChange={e=>set("waterLitersAdult",e.target.value)} placeholder="2"/></div>
          </div>
        </div>

        <div style={{marginBottom:"14px"}}>
          <label style={lbl}>Tipo de tierra</label>
          <textarea style={{...inp,minHeight:"70px",resize:"vertical"}} value={form.soil} onChange={e=>set("soil",e.target.value)} placeholder="Describe el tipo de tierra, composición, pH, drenaje..."/>
        </div>

        <div style={{marginBottom:"14px"}}>
          <label style={lbl}>Raíz según crecimiento</label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px",marginBottom:"10px"}}>
            {ROOT_GROWTH.map(r=>(
              <div key={r.value} onClick={()=>set("rootGrowth",form.rootGrowth===r.value?"":r.value)} style={{padding:"10px 8px",borderRadius:"10px",textAlign:"center",cursor:"pointer",transition:"all 0.15s",background:form.rootGrowth===r.value?C.greenPale:C.bg,border:form.rootGrowth===r.value?`1px solid ${C.green}`:`0.5px solid ${C.border}`}}>
                <div style={{fontSize:"20px"}}>{r.emoji}</div>
                <p style={{margin:"4px 0 0",color:form.rootGrowth===r.value?C.greenText:C.textLight,fontFamily:font.body,fontSize:"10px",lineHeight:1.3}}>{r.label}</p>
              </div>
            ))}
          </div>
          {form.rootGrowth&&(
            <>
              <PhotoUploader value={form.rootGrowthPhoto} onChange={v=>set("rootGrowthPhoto",v)} label="Foto de la raíz (opcional)" height={120}/>
              <textarea style={{...inp,minHeight:"60px",resize:"vertical",marginTop:"8px"}} value={form.rootGrowthDesc} onChange={e=>set("rootGrowthDesc",e.target.value)} placeholder="Descripción específica..."/>
            </>
          )}
        </div>

        <div style={{marginBottom:"18px"}}>
          <label style={lbl}>Profundidad de raíces</label>
          <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
            {ROOT_DEPTH.map(r=>(
              <div key={r.value} onClick={()=>set("rootDepth",form.rootDepth===r.value?"":r.value)} style={{padding:"10px 14px",borderRadius:"10px",cursor:"pointer",transition:"all 0.15s",background:form.rootDepth===r.value?`${r.color}15`:C.bg,border:form.rootDepth===r.value?`1px solid ${r.color}`:`0.5px solid ${C.border}`}}>
                <p style={{margin:0,color:form.rootDepth===r.value?r.color:C.textMid,fontFamily:font.body,fontSize:"13px",fontWeight:500}}>{r.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{marginBottom:"18px"}}>
          <label style={lbl}>Etiquetas de jardín</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>{allTags.map(tag=><TagChip key={tag} label={tag} active={form.gardenTags.includes(tag)} onClick={()=>toggleTag(tag)}/>)}</div>
        </div>

        <div style={{marginBottom:"24px"}}>
          <label style={lbl}>Notas personales</label>
          <textarea style={{...inp,minHeight:"80px",resize:"vertical"}} value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Observaciones, dónde la conseguiste, recuerdos..."/>
        </div>

        <div style={{display:"flex",gap:"10px"}}>
          <button onClick={()=>onSave(form)} style={{flex:1,padding:"12px",background:C.green,color:"#fff",border:"none",borderRadius:"10px",fontFamily:font.serif,fontSize:"15px",cursor:"pointer"}}>{initial?"Guardar cambios":"Agregar planta"}</button>
          <button onClick={onCancel} style={{padding:"12px 18px",background:C.bg,color:C.textMid,border:`0.5px solid ${C.border}`,borderRadius:"10px",fontFamily:font.body,fontSize:"14px",cursor:"pointer"}}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── Manage Tags ────────────────────────────────────────
function ManageTagsPanel({ tags, onSave, onClose }) {
  const [local, setLocal] = useState([...tags]);
  const [newTag, setNewTag] = useState("");
  const add = ()=>{ const t=newTag.trim(); if(t&&!local.includes(t)) setLocal(p=>[...p,t]); setNewTag(""); };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(44,48,32,0.55)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.bgCard,border:`0.5px solid ${C.border}`,borderRadius:"20px",width:"100%",maxWidth:"480px",boxShadow:"0 20px 60px rgba(0,0,0,0.15)",padding:"28px"}}>
        <h2 style={{color:C.text,fontFamily:font.serif,fontSize:"22px",margin:"0 0 20px"}}>Gestionar etiquetas 🏷️</h2>
        <div style={{display:"flex",gap:"8px",marginBottom:"20px"}}>
          <input value={newTag} onChange={e=>setNewTag(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Nueva etiqueta..." style={{flex:1,padding:"10px 12px",background:C.bg,border:`0.5px solid ${C.border}`,borderRadius:"8px",color:C.text,fontFamily:font.body,fontSize:"14px",outline:"none"}}/>
          <button onClick={add} style={{padding:"10px 18px",background:C.green,color:"#fff",border:"none",borderRadius:"8px",fontFamily:font.body,fontSize:"14px",cursor:"pointer"}}>+ Agregar</button>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:"8px",minHeight:"60px",marginBottom:"16px"}}>
          {local.map(tag=><TagChip key={tag} label={tag} active onDelete={()=>setLocal(p=>p.filter(t=>t!==tag))}/>)}
        </div>
        <div style={{display:"flex",gap:"10px",marginTop:"8px"}}>
          <button onClick={()=>onSave(local)} style={{flex:1,padding:"12px",background:C.green,color:"#fff",border:"none",borderRadius:"10px",fontFamily:font.serif,fontSize:"15px",cursor:"pointer"}}>Guardar</button>
          <button onClick={onClose} style={{padding:"12px 18px",background:C.bg,color:C.textMid,border:`0.5px solid ${C.border}`,borderRadius:"10px",fontFamily:font.body,fontSize:"14px",cursor:"pointer"}}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── Botanical Glossary ─────────────────────────────────
function GlossaryPanel({ onClose }) {
  const [tab, setTab] = useState("copa");
  const [selected, setSelected] = useState(null);

  const tabs = [
    { key:"copa",    label:"Copa" },
    { key:"raices",  label:"Raíces" },
    { key:"hojas",   label:"Hojas" },
  ];

  const canopyShapes = {
    Globosa:     <svg viewBox="0 0 50 55" width="40"><ellipse cx="25" cy="24" rx="18" ry="18" fill={C.greenPale} stroke={C.green} strokeWidth="1"/><rect x="22" y="40" width="6" height="13" rx="3" fill={C.borderMid}/></svg>,
    Aparasolada: <svg viewBox="0 0 60 55" width="44"><ellipse cx="30" cy="18" rx="24" ry="10" fill={C.greenPale} stroke={C.green} strokeWidth="1"/><rect x="27" y="26" width="6" height="26" rx="3" fill={C.borderMid}/></svg>,
    Columnar:    <svg viewBox="0 0 50 55" width="36"><rect x="16" y="6" width="18" height="36" rx="9" fill={C.greenPale} stroke={C.green} strokeWidth="1"/><rect x="22" y="41" width="6" height="12" rx="3" fill={C.borderMid}/></svg>,
    Piramidal:   <svg viewBox="0 0 50 55" width="36"><polygon points="25,4 44,40 6,40" fill={C.greenPale} stroke={C.green} strokeWidth="1"/><rect x="22" y="40" width="6" height="13" rx="3" fill={C.borderMid}/></svg>,
    Irregular:   <svg viewBox="0 0 50 55" width="38"><path d="M25,6 Q38,8 42,22 Q46,36 34,42 Q20,48 10,38 Q2,28 8,16 Q14,4 25,6Z" fill={C.greenPale} stroke={C.green} strokeWidth="1"/><rect x="22" y="42" width="6" height="11" rx="3" fill={C.borderMid}/></svg>,
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(44,48,32,0.55)",backdropFilter:"blur(6px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.bgCard,border:`0.5px solid ${C.border}`,borderRadius:"20px",width:"100%",maxWidth:"660px",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.15)",padding:"28px"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"20px"}}>
          <div>
            <p style={{color:C.green,fontFamily:font.body,fontSize:"11px",textTransform:"uppercase",letterSpacing:"0.2em",margin:"0 0 4px"}}>Referencia</p>
            <h2 style={{color:C.text,fontFamily:font.serif,fontSize:"22px",margin:0}}>Glosario botánico 🌱</h2>
          </div>
          <button onClick={onClose} style={{background:C.bg,border:`0.5px solid ${C.border}`,color:C.textMid,borderRadius:"10px",padding:"8px 14px",fontFamily:font.body,cursor:"pointer",fontSize:"13px"}}>Cerrar</button>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:"6px",marginBottom:"20px",borderBottom:`0.5px solid ${C.border}`,paddingBottom:"0"}}>
          {tabs.map(t=>(
            <button key={t.key} onClick={()=>{setTab(t.key);setSelected(null);}} style={{padding:"8px 16px",background:tab===t.key?C.greenPale:"transparent",color:tab===t.key?C.greenText:C.textLight,border:"none",borderRadius:"8px 8px 0 0",fontFamily:font.body,fontSize:"13px",cursor:"pointer",borderBottom:tab===t.key?`2px solid ${C.green}`:"2px solid transparent"}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Copa tab */}
        {tab==="copa"&&(
          <>
            <p style={{...SectionLabel,color:C.textLight,fontFamily:font.body,fontSize:"11px",textTransform:"uppercase",letterSpacing:"0.12em",margin:"0 0 12px"}}>Forma de copa</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:"10px",marginBottom:"24px"}}>
              {GLOSSARY_CANOPY_TYPES.map(r=>(
                <div key={r.value} onClick={()=>setSelected(selected===r.value?null:r.value)} style={{background:selected===r.value?C.greenPale:C.bg,border:selected===r.value?`1px solid ${C.green}`:`0.5px solid ${C.border}`,borderRadius:"12px",padding:"14px 10px",cursor:"pointer",transition:"all 0.2s",textAlign:"center"}}>
                  <div style={{height:"52px",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:"6px"}}>{canopyShapes[r.value]||<span style={{fontSize:"24px"}}>🌳</span>}</div>
                  <p style={{margin:0,color:selected===r.value?C.greenText:C.textMid,fontFamily:font.body,fontSize:"12px",fontWeight:500}}>{r.label}</p>
                </div>
              ))}
            </div>
            {selected&&(() => { const r=GLOSSARY_CANOPY_TYPES.find(x=>x.value===selected); return r&&(
              <div style={{background:C.greenPale,border:`1px solid ${C.green}`,borderRadius:"12px",padding:"16px",marginBottom:"20px"}}>
                <h3 style={{margin:"0 0 8px",color:C.greenText,fontFamily:font.serif,fontSize:"17px"}}>{r.label}</h3>
                <p style={{color:C.textMid,fontFamily:font.body,fontSize:"14px",lineHeight:1.7,margin:0}}>{r.description}</p>
              </div>
            );})()}
            <p style={{color:C.textLight,fontFamily:font.body,fontSize:"11px",textTransform:"uppercase",letterSpacing:"0.12em",margin:"0 0 12px"}}>Textura de follaje</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"10px"}}>
              {GLOSSARY_CANOPY_TEXTURES.map(r=>(
                <div key={r.value} onClick={()=>setSelected(selected===`tex-${r.value}`?null:`tex-${r.value}`)} style={{background:selected===`tex-${r.value}`?C.greenPale:C.bg,border:selected===`tex-${r.value}`?`1px solid ${C.green}`:`0.5px solid ${C.border}`,borderRadius:"12px",padding:"14px",cursor:"pointer",transition:"all 0.2s"}}>
                  <div style={{display:"flex",gap:r.value==="Fina"?"3px":r.value==="Media"?"5px":"7px",marginBottom:"8px",alignItems:"center"}}>
                    {[1,2,3].map(i=><span key={i} style={{width:r.value==="Fina"?"4px":r.value==="Media"?"7px":"11px",height:r.value==="Fina"?"4px":r.value==="Media"?"7px":"11px",borderRadius:"50%",background:C.green,display:"inline-block"}}/>)}
                  </div>
                  <p style={{margin:"0 0 4px",color:selected===`tex-${r.value}`?C.greenText:C.textMid,fontFamily:font.body,fontSize:"13px",fontWeight:500}}>{r.label}</p>
                  {selected===`tex-${r.value}`&&<p style={{margin:0,color:C.textMid,fontFamily:font.body,fontSize:"12px",lineHeight:1.6}}>{r.description}</p>}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Raíces tab */}
        {tab==="raices"&&(
          <>
            <p style={{color:C.textLight,fontFamily:font.body,fontSize:"11px",textTransform:"uppercase",letterSpacing:"0.12em",margin:"0 0 12px"}}>Según crecimiento</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"10px",marginBottom:"20px"}}>
              {GLOSSARY_ROOTS_GROWTH.map(r=>(
                <div key={r.value} onClick={()=>setSelected(selected===r.value?null:r.value)} style={{background:selected===r.value?C.greenPale:C.bg,border:selected===r.value?`1px solid ${C.green}`:`0.5px solid ${C.border}`,borderRadius:"12px",padding:"14px 10px",cursor:"pointer",transition:"all 0.2s",textAlign:"center"}}>
                  <span style={{fontSize:"24px"}}>{r.emoji}</span>
                  <p style={{margin:"6px 0 0",color:selected===r.value?C.greenText:C.textMid,fontFamily:font.body,fontSize:"12px",fontWeight:500,lineHeight:1.3}}>{r.label}</p>
                </div>
              ))}
            </div>
            {selected&&(() => { const r=GLOSSARY_ROOTS_GROWTH.find(x=>x.value===selected); return r&&(
              <div style={{background:C.greenPale,border:`1px solid ${C.green}`,borderRadius:"12px",padding:"16px",marginBottom:"20px"}}>
                <h3 style={{margin:"0 0 8px",color:C.greenText,fontFamily:font.serif,fontSize:"17px"}}>{r.emoji} {r.label}</h3>
                <p style={{color:C.textMid,fontFamily:font.body,fontSize:"14px",lineHeight:1.7,margin:0}}>{r.description}</p>
              </div>
            );})()}
            <p style={{color:C.textLight,fontFamily:font.body,fontSize:"11px",textTransform:"uppercase",letterSpacing:"0.12em",margin:"0 0 12px"}}>Profundidad</p>
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              {GLOSSARY_ROOTS_DEPTH.map(r=>(
                <div key={r.value} onClick={()=>setSelected(selected===`d-${r.value}`?null:`d-${r.value}`)} style={{background:selected===`d-${r.value}`?`${r.color}12`:C.bg,border:selected===`d-${r.value}`?`1px solid ${r.color}`:`0.5px solid ${C.border}`,borderRadius:"12px",padding:"14px",cursor:"pointer",transition:"all 0.2s"}}>
                  <p style={{margin:"0 0 4px",color:selected===`d-${r.value}`?r.color:C.textMid,fontFamily:font.body,fontSize:"14px",fontWeight:500}}>{r.label}</p>
                  {selected===`d-${r.value}`&&<p style={{margin:0,color:C.textMid,fontFamily:font.body,fontSize:"13px",lineHeight:1.7}}>{r.description}</p>}
                  {selected!==`d-${r.value}`&&<p style={{margin:0,color:C.textLight,fontFamily:font.body,fontSize:"12px"}}>{r.description.substring(0,60)}...</p>}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Hojas tab */}
        {tab==="hojas"&&(
          <>
            <p style={{color:C.textLight,fontFamily:font.body,fontSize:"11px",textTransform:"uppercase",letterSpacing:"0.12em",margin:"0 0 12px"}}>Tipos de hoja</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"20px"}}>
              {GLOSSARY_LEAVES_TYPES.map(r=>(
                <div key={r.value} onClick={()=>setSelected(selected===r.value?null:r.value)} style={{background:selected===r.value?C.greenPale:C.bg,border:selected===r.value?`1px solid ${C.green}`:`0.5px solid ${C.border}`,borderRadius:"12px",padding:"14px",cursor:"pointer",transition:"all 0.2s"}}>
                  <p style={{margin:"0 0 4px",color:selected===r.value?C.greenText:C.textMid,fontFamily:font.body,fontSize:"14px",fontWeight:500}}>{r.label}</p>
                  <p style={{margin:0,color:C.textLight,fontFamily:font.body,fontSize:"12px",lineHeight:1.6}}>{r.description}</p>
                </div>
              ))}
            </div>
            <p style={{color:C.textLight,fontFamily:font.body,fontSize:"11px",textTransform:"uppercase",letterSpacing:"0.12em",margin:"0 0 12px"}}>Forma de hoja</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:"10px"}}>
              {GLOSSARY_LEAVES_SHAPES.map(r=>(
                <div key={r.value} onClick={()=>setSelected(selected===`lf-${r.value}`?null:`lf-${r.value}`)} style={{background:selected===`lf-${r.value}`?C.greenPale:C.bg,border:selected===`lf-${r.value}`?`1px solid ${C.green}`:`0.5px solid ${C.border}`,borderRadius:"12px",padding:"14px",cursor:"pointer",transition:"all 0.2s"}}>
                  <p style={{margin:"0 0 4px",color:selected===`lf-${r.value}`?C.greenText:C.textMid,fontFamily:font.body,fontSize:"13px",fontWeight:500}}>{r.label}</p>
                  {selected===`lf-${r.value}`&&<p style={{margin:0,color:C.textMid,fontFamily:font.body,fontSize:"12px",lineHeight:1.6}}>{r.description}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Community ──────────────────────────────────────────
function CommunityView({ currentUser, onCopy }) {
  const [allPlants, setAllPlants] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState(null);
  const [selectedPlant, setSelectedPlant] = useState(null);

  useEffect(()=>{
    (async()=>{
      try {
        // Load all users
        const usersSnap = await getDocs(collection(db,"users"));
        const map = {};
        usersSnap.docs.forEach(d=>{ map[d.data().uid]=d.data(); });
        setUsersMap(map);
        // Load all plants except own
        const plantsSnap = await getDocs(collection(db,"plants"));
        const plants = plantsSnap.docs
          .map(d=>({id:d.id,...d.data()}))
          .filter(p=>p.userId !== currentUser.uid);
        setAllPlants(plants);
      } catch(e){ console.error(e); }
      setLoading(false);
    })();
  },[]);

  const allTags = [...new Set(allPlants.flatMap(p=>p.gardenTags||[]))];

  const filtered = allPlants.filter(p=>{
    const ms = !search ||
      p.commonName?.toLowerCase().includes(search.toLowerCase()) ||
      p.scientificName?.toLowerCase().includes(search.toLowerCase());
    const mt = !activeTag || p.gardenTags?.includes(activeTag);
    return ms && mt;
  });

  return (
    <div style={{maxWidth:"1100px",margin:"0 auto",padding:"28px 24px"}}>
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:"12px",marginBottom:"20px",flexWrap:"wrap"}}>
        <div>
          <h2 style={{color:C.text,fontFamily:font.serif,fontSize:"24px",margin:"0 0 4px"}}>Comunidad 🌍</h2>
          <p style={{color:C.textLight,fontFamily:font.body,fontSize:"14px",margin:0}}>{allPlants.length} plantas compartidas</p>
        </div>
      </div>

      {/* Search + tag filters */}
      <div style={{background:"#fff",border:`0.5px solid ${C.border}`,borderRadius:"12px",padding:"14px 16px",marginBottom:"20px"}}>
        <div style={{position:"relative",marginBottom:"12px"}}>
          <span style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:C.textLight}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar planta en toda la comunidad..."
            style={{width:"100%",padding:"9px 14px 9px 38px",background:C.bg,border:`0.5px solid ${C.border}`,borderRadius:"8px",color:C.text,fontFamily:font.body,fontSize:"14px",outline:"none",boxSizing:"border-box"}}/>
        </div>
        {allTags.length>0&&(
          <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
            <TagChip label="Todas" active={!activeTag} onClick={()=>setActiveTag(null)}/>
            {allTags.map(tag=><TagChip key={tag} label={tag} active={activeTag===tag} onClick={()=>setActiveTag(activeTag===tag?null:tag)}/>)}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{display:"flex",justifyContent:"center",padding:"60px"}}><Spinner/></div>
      ) : allPlants.length===0 ? (
        <div style={{textAlign:"center",padding:"80px 20px"}}>
          <div style={{fontSize:"56px",opacity:0.2,marginBottom:"16px"}}>👥</div>
          <p style={{color:C.green,fontFamily:font.serif,fontSize:"20px"}}>Aún no hay más personas</p>
          <p style={{color:C.textLight,fontFamily:font.body,fontSize:"14px"}}>Comparte el enlace con tus amigas para que se unan</p>
        </div>
      ) : filtered.length===0 ? (
        <div style={{textAlign:"center",padding:"60px"}}>
          <p style={{color:C.green,fontFamily:font.serif,fontSize:"18px"}}>No se encontraron plantas</p>
          <p style={{color:C.textLight,fontFamily:font.body,fontSize:"14px"}}>Intenta con otro nombre o etiqueta</p>
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:"16px"}}>
          {filtered.map(plant=>{
            const owner = usersMap[plant.userId];
            return (
              <div key={plant.id}>
                {owner&&(
                  <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"6px",paddingLeft:"2px"}}>
                    <img src={owner.photoURL||"https://api.dicebear.com/7.x/thumbs/svg?seed="+owner.uid} style={{width:"20px",height:"20px",borderRadius:"50%",border:`0.5px solid ${C.border}`}} alt={owner.displayName}/>
                    <span style={{color:C.textLight,fontFamily:font.body,fontSize:"11px"}}>{owner.displayName?.split(" ")[0]}</span>
                  </div>
                )}
                <PlantCard plant={plant} onClick={setSelectedPlant} onCopy={onCopy} isOwn={false}/>
              </div>
            );
          })}
        </div>
      )}

      {selectedPlant&&<DetailModal plant={selectedPlant} onClose={()=>setSelectedPlant(null)} onCopy={p=>{onCopy(p);setSelectedPlant(null);}} isOwn={false}/>}
    </div>
  );
}

// ── Projects View ──────────────────────────────────────
const emptyProject = { name:"", location:"", notes:"", photo:"", isPublic:false, plantIds:[] };

function ProjectForm({ initial, myPlants, onSave, onCancel }) {
  const [form, setForm] = useState(initial || emptyProject);
  const [tab, setTab] = useState("info");
  const fileRef = useRef();
  const set = (f,v) => setForm(p=>({...p,[f]:v}));
  const togglePlant = id => setForm(p=>({ ...p, plantIds: p.plantIds.includes(id) ? p.plantIds.filter(x=>x!==id) : [...p.plantIds, id] }));
  const handlePhoto = e => { const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>set("photo",ev.target.result); r.readAsDataURL(f); };
  const inp = {width:"100%",padding:"10px 12px",background:C.bg,border:`0.5px solid ${C.border}`,borderRadius:"8px",color:C.text,fontFamily:font.body,fontSize:"14px",boxSizing:"border-box",outline:"none"};
  const lbl = {display:"block",color:C.textLight,fontFamily:font.body,fontSize:"11px",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"6px"};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(44,48,32,0.55)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
      <div style={{background:C.bgCard,border:`0.5px solid ${C.border}`,borderRadius:"20px",width:"100%",maxWidth:"580px",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.15)",padding:"28px"}}>
        <h2 style={{color:C.text,fontFamily:font.serif,fontSize:"22px",margin:"0 0 20px"}}>{initial?"Editar proyecto":"Nuevo proyecto"}</h2>

        {/* Tabs */}
        <div style={{display:"flex",gap:"4px",marginBottom:"20px",borderBottom:`0.5px solid ${C.border}`}}>
          {[["info","Información"],["plants","Plantas"]].map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)} style={{padding:"8px 16px",background:tab===t?C.greenPale:"transparent",color:tab===t?C.greenText:C.textLight,border:"none",borderRadius:"8px 8px 0 0",fontFamily:font.body,fontSize:"13px",cursor:"pointer",borderBottom:tab===t?`2px solid ${C.green}`:"2px solid transparent"}}>{l} {t==="plants"?`(${form.plantIds.length})`:""}</button>
          ))}
        </div>

        {tab==="info"&&(
          <>
            {/* Photo */}
            <div style={{marginBottom:"18px"}}>
              <label style={lbl}>Foto de referencia / inspiración</label>
              <div style={{height:"160px",borderRadius:"12px",border:form.photo?`0.5px solid ${C.border}`:`2px dashed ${C.border}`,background:C.bg,overflow:"hidden",position:"relative",display:"flex",alignItems:"center",justifyContent:"center",cursor:form.photo?"default":"pointer"}} onClick={()=>!form.photo&&fileRef.current.click()}>
                {form.photo
                  ? <><img src={form.photo} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="ref"/>
                      <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(240,236,224,0.9)",padding:"8px 12px",display:"flex",gap:"8px"}}>
                        <button onClick={e=>{e.stopPropagation();fileRef.current.click();}} style={{flex:1,padding:"5px",background:C.green,color:"#fff",border:"none",borderRadius:"6px",fontFamily:font.body,fontSize:"12px",cursor:"pointer"}}>Cambiar</button>
                        <button onClick={e=>{e.stopPropagation();set("photo","");}} style={{padding:"5px 10px",background:"#f0e0d8",color:"#a05050",border:`0.5px solid #d4b8b8`,borderRadius:"6px",fontFamily:font.body,fontSize:"12px",cursor:"pointer"}}>✕</button>
                      </div></>
                  : <div style={{textAlign:"center"}}><div style={{fontSize:"26px",opacity:0.3}}>🖼️</div><p style={{color:C.textLight,fontFamily:font.body,fontSize:"12px",margin:"4px 0 0"}}>Agregar foto de referencia</p></div>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{display:"none"}}/>
            </div>

            <div style={{marginBottom:"14px"}}><label style={lbl}>Nombre del proyecto</label><input style={inp} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Ej: Jardín frontal casa nueva"/></div>
            <div style={{marginBottom:"14px"}}><label style={lbl}>Ubicación / contexto</label><input style={inp} value={form.location} onChange={e=>set("location",e.target.value)} placeholder="Ej: Terraza norte, jardín trasero, balcón..."/></div>
            <div style={{marginBottom:"20px"}}><label style={lbl}>Notas y combinaciones</label><textarea style={{...inp,minHeight:"90px",resize:"vertical"}} value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Ideas, combinaciones posibles, paleta de colores, condiciones del espacio..."/></div>

            {/* Visibility toggle */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",background:C.bg,borderRadius:"10px",border:`0.5px solid ${C.border}`,marginBottom:"24px"}}>
              <div>
                <p style={{margin:"0 0 2px",color:C.text,fontFamily:font.body,fontSize:"14px",fontWeight:500}}>{form.isPublic?"Proyecto público":"Proyecto privado"}</p>
                <p style={{margin:0,color:C.textLight,fontFamily:font.body,fontSize:"12px"}}>{form.isPublic?"Visible para toda la comunidad":"Solo tú lo puedes ver"}</p>
              </div>
              <div onClick={()=>set("isPublic",!form.isPublic)} style={{width:"44px",height:"24px",borderRadius:"12px",background:form.isPublic?C.green:C.border,position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0}}>
                <div style={{position:"absolute",top:"3px",left:form.isPublic?"22px":"3px",width:"18px",height:"18px",borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}/>
              </div>
            </div>
          </>
        )}

        {tab==="plants"&&(
          <div>
            <p style={{color:C.textLight,fontFamily:font.body,fontSize:"13px",margin:"0 0 14px"}}>Selecciona las plantas que usarás en este proyecto:</p>
            {myPlants.length===0
              ? <p style={{color:C.textLight,fontFamily:font.body,fontSize:"14px",textAlign:"center",padding:"40px"}}>No tienes plantas en tu biblioteca aún.</p>
              : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:"10px"}}>
                  {myPlants.map(p=>{
                    const selected = form.plantIds.includes(p.id);
                    return (
                      <div key={p.id} onClick={()=>togglePlant(p.id)} style={{borderRadius:"10px",overflow:"hidden",border:selected?`2px solid ${C.green}`:`0.5px solid ${C.border}`,cursor:"pointer",transition:"all 0.15s",boxShadow:selected?`0 0 0 3px ${C.greenPale}`:"none"}}>
                        <div style={{height:"80px",background:C.greenPale,position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {p.photo?<img src={p.photo} style={{width:"100%",height:"100%",objectFit:"cover"}} alt={p.commonName}/>:<span style={{fontSize:"28px",opacity:0.3}}>🌿</span>}
                          {selected&&<div style={{position:"absolute",top:"5px",right:"5px",width:"18px",height:"18px",borderRadius:"50%",background:C.green,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontSize:"11px",fontWeight:"bold"}}>✓</span></div>}
                        </div>
                        <div style={{padding:"6px 8px",background:selected?C.greenPale:"#fff"}}>
                          <p style={{margin:0,color:selected?C.greenText:C.text,fontFamily:font.body,fontSize:"11px",fontWeight:500,lineHeight:1.2}}>{p.commonName||"Sin nombre"}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
            }
            <div style={{marginTop:"16px",padding:"10px 14px",background:C.greenPale,borderRadius:"8px",border:`0.5px solid ${C.green}`}}>
              <p style={{margin:0,color:C.greenText,fontFamily:font.body,fontSize:"13px"}}>{form.plantIds.length} {form.plantIds.length===1?"planta seleccionada":"plantas seleccionadas"}</p>
            </div>
          </div>
        )}

        <div style={{display:"flex",gap:"10px",marginTop:"8px"}}>
          <button onClick={()=>onSave(form)} style={{flex:1,padding:"12px",background:C.green,color:"#fff",border:"none",borderRadius:"10px",fontFamily:font.serif,fontSize:"15px",cursor:"pointer"}}>{initial?"Guardar cambios":"Crear proyecto"}</button>
          <button onClick={onCancel} style={{padding:"12px 18px",background:C.bg,color:C.textMid,border:`0.5px solid ${C.border}`,borderRadius:"10px",fontFamily:font.body,fontSize:"14px",cursor:"pointer"}}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function ProjectsView({ user, myPlants, showToast }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [canvasProject, setCanvasProject] = useState(null);
  const canvasAccess = useFeature("canvas", user);

  const loadProjects = async () => {
    try {
      const q = query(collection(db,"projects"), where("userId","==",user.uid));
      const snap = await getDocs(q);
      setProjects(snap.docs.map(d=>({id:d.id,...d.data()})));
    } catch(e){ console.error(e); }
    setLoading(false);
  };

  useEffect(()=>{ loadProjects(); },[]);

  const handleSave = async form => {
    if(!form.name.trim()) return;
    try {
      if(editingProject){
        await setDoc(doc(db,"projects",editingProject.id),{...form,userId:user.uid,updatedAt:serverTimestamp()},{merge:true});
      } else {
        const ref = doc(collection(db,"projects"));
        await setDoc(ref,{...form,id:ref.id,userId:user.uid,createdAt:serverTimestamp()});
      }
      await loadProjects();
      showToast(editingProject?"Proyecto actualizado ✓":"Proyecto creado ✓");
    } catch(e){ console.error(e); showToast("Error al guardar"); }
    setShowForm(false); setEditingProject(null);
  };

  const handleDelete = async id => {
    try { await deleteDoc(doc(db,"projects",id)); await loadProjects(); showToast("Proyecto eliminado"); }
    catch(e){ console.error(e); }
    setSelectedProject(null);
  };

  // Build plant lookup
  const plantMap = {};
  myPlants.forEach(p=>{ plantMap[p.id]=p; });

  if(loading) return <div style={{display:"flex",justifyContent:"center",padding:"80px"}}><Spinner/></div>;

  return (
    <div style={{maxWidth:"1100px",margin:"0 auto",padding:"28px 24px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",marginBottom:"24px",flexWrap:"wrap"}}>
        <div>
          <h2 style={{color:C.text,fontFamily:font.serif,fontSize:"24px",margin:"0 0 4px"}}>Mis proyectos 📋</h2>
          <p style={{color:C.textLight,fontFamily:font.body,fontSize:"14px",margin:0}}>{projects.length} {projects.length===1?"proyecto":"proyectos"}</p>
        </div>
        <button onClick={()=>{setEditingProject(null);setShowForm(true);}} style={{padding:"9px 18px",background:C.green,color:"#fff",border:"none",borderRadius:"8px",fontFamily:font.serif,fontSize:"14px",cursor:"pointer",boxShadow:`0 2px 8px ${C.green}44`}}>+ Nuevo proyecto</button>
      </div>

      {projects.length===0 ? (
        <div style={{textAlign:"center",padding:"80px 20px"}}>
          <div style={{fontSize:"56px",opacity:0.2,marginBottom:"16px"}}>📋</div>
          <p style={{color:C.green,fontFamily:font.serif,fontSize:"20px"}}>Sin proyectos aún</p>
          <p style={{color:C.textLight,fontFamily:font.body,fontSize:"14px"}}>Crea tu primer proyecto para organizar combinaciones de plantas</p>
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"16px"}}>
          {projects.map(proj=>{
            const projPlants = (proj.plantIds||[]).map(id=>plantMap[id]).filter(Boolean);
            return (
              <div key={proj.id} onClick={()=>setSelectedProject(proj)} style={{background:C.bgCard,border:`0.5px solid ${C.border}`,borderRadius:"16px",overflow:"hidden",cursor:"pointer",transition:"transform 0.2s,box-shadow 0.2s",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.12)";}}
                onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,0.06)";}}>
                {/* Cover photo or plant mosaic */}
                <div style={{height:"140px",background:C.greenPale,position:"relative",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {proj.photo
                    ? <img src={proj.photo} style={{width:"100%",height:"100%",objectFit:"cover"}} alt={proj.name}/>
                    : projPlants.length>0
                      ? <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(projPlants.length,3)},1fr)`,width:"100%",height:"100%"}}>
                          {projPlants.slice(0,3).map(p=>(
                            <div key={p.id} style={{overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",background:C.greenPale}}>
                              {p.photo?<img src={p.photo} style={{width:"100%",height:"100%",objectFit:"cover"}} alt={p.commonName}/>:<span style={{fontSize:"28px",opacity:0.3}}>🌿</span>}
                            </div>
                          ))}
                        </div>
                      : <span style={{fontSize:"36px",opacity:0.25}}>📋</span>}
                  {/* Public/private badge */}
                  <div style={{position:"absolute",top:"8px",right:"8px",padding:"3px 9px",borderRadius:"999px",background:"rgba(255,255,255,0.9)",border:`0.5px solid ${C.border}`}}>
                    <span style={{color:proj.isPublic?C.green:C.textLight,fontFamily:font.body,fontSize:"10px"}}>{proj.isPublic?"🌐 Público":"🔒 Privado"}</span>
                  </div>
                </div>
                <div style={{padding:"14px 16px"}}>
                  <h3 style={{margin:"0 0 4px",color:C.text,fontFamily:font.serif,fontSize:"16px",fontWeight:600}}>{proj.name||"Sin nombre"}</h3>
                  {proj.location&&<p style={{margin:"0 0 8px",color:C.green,fontFamily:font.body,fontSize:"12px"}}>📍 {proj.location}</p>}
                  {proj.notes&&<p style={{margin:"0 0 10px",color:C.textMid,fontFamily:font.body,fontSize:"12px",lineHeight:1.5,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{proj.notes}</p>}
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{color:C.textLight,fontFamily:font.body,fontSize:"12px"}}>🌿 {projPlants.length} {projPlants.length===1?"planta":"plantas"}</span>
                    <div style={{display:"flex",gap:"-6px"}}>
                      {projPlants.slice(0,4).map((p,i)=>(
                        <div key={p.id} style={{width:"22px",height:"22px",borderRadius:"50%",border:`2px solid #fff`,overflow:"hidden",marginLeft:i>0?"-6px":"0",background:C.greenPale,display:"inline-block"}}>
                          {p.photo?<img src={p.photo} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>:<span style={{fontSize:"10px",lineHeight:"18px",display:"block",textAlign:"center"}}>🌿</span>}
                        </div>
                      ))}
                      {projPlants.length>4&&<div style={{width:"22px",height:"22px",borderRadius:"50%",border:`2px solid #fff`,background:C.green,display:"inline-flex",alignItems:"center",justifyContent:"center",marginLeft:"-6px"}}><span style={{color:"#fff",fontSize:"9px",fontFamily:font.body}}>+{projPlants.length-4}</span></div>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Project detail modal */}
      {selectedProject&&(()=>{
        const proj = selectedProject;
        const projPlants = (proj.plantIds||[]).map(id=>plantMap[id]).filter(Boolean);
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(44,48,32,0.6)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}} onClick={()=>setSelectedProject(null)}>
            <div onClick={e=>e.stopPropagation()} style={{background:C.bgCard,border:`0.5px solid ${C.border}`,borderRadius:"20px",width:"100%",maxWidth:"620px",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
              {proj.photo&&<div style={{height:"220px",overflow:"hidden",borderRadius:"20px 20px 0 0"}}><img src={proj.photo} style={{width:"100%",height:"100%",objectFit:"cover"}} alt={proj.name}/></div>}
              <div style={{padding:"24px"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px",marginBottom:"6px"}}>
                  <h2 style={{margin:0,color:C.text,fontFamily:font.serif,fontSize:"24px",fontWeight:600}}>{proj.name}</h2>
                  <span style={{padding:"3px 10px",borderRadius:"999px",background:proj.isPublic?C.greenPale:C.bg,color:proj.isPublic?C.greenText:C.textLight,border:`0.5px solid ${proj.isPublic?C.green:C.border}`,fontFamily:font.body,fontSize:"11px",flexShrink:0,marginTop:"4px"}}>{proj.isPublic?"🌐 Público":"🔒 Privado"}</span>
                </div>
                {proj.location&&<p style={{margin:"0 0 14px",color:C.green,fontFamily:font.body,fontSize:"13px"}}>📍 {proj.location}</p>}
                {proj.notes&&<div style={{marginBottom:"20px"}}><p style={{color:C.textLight,fontFamily:font.body,fontSize:"11px",textTransform:"uppercase",letterSpacing:"0.1em",margin:"0 0 8px"}}>Notas y combinaciones</p><p style={{color:C.textMid,fontFamily:font.body,fontSize:"14px",lineHeight:1.7,margin:0,background:C.bg,padding:"12px 14px",borderRadius:"10px",border:`0.5px solid ${C.border}`}}>{proj.notes}</p></div>}

                <p style={{color:C.textLight,fontFamily:font.body,fontSize:"11px",textTransform:"uppercase",letterSpacing:"0.1em",margin:"0 0 12px"}}>Plantas del proyecto ({projPlants.length})</p>
                {projPlants.length===0
                  ? <p style={{color:C.textLight,fontFamily:font.body,fontSize:"13px",fontStyle:"italic"}}>No hay plantas asignadas aún.</p>
                  : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:"10px",marginBottom:"20px"}}>
                      {projPlants.map(p=>(
                        <div key={p.id} style={{background:C.bg,border:`0.5px solid ${C.border}`,borderRadius:"10px",overflow:"hidden"}}>
                          <div style={{height:"80px",background:C.greenPale,display:"flex",alignItems:"center",justifyContent:"center"}}>
                            {p.photo?<img src={p.photo} style={{width:"100%",height:"100%",objectFit:"cover"}} alt={p.commonName}/>:<span style={{fontSize:"28px",opacity:0.3}}>🌿</span>}
                          </div>
                          <div style={{padding:"6px 8px"}}>
                            <p style={{margin:0,color:C.text,fontFamily:font.body,fontSize:"11px",fontWeight:500,lineHeight:1.3}}>{p.commonName||"Sin nombre"}</p>
                            {p.scientificName&&<p style={{margin:0,color:C.textLight,fontFamily:font.body,fontSize:"10px",fontStyle:"italic"}}>{p.scientificName}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                }

                <div style={{display:"flex",gap:"8px"}}>
                  {canvasAccess==="granted"&&(
                    <button onClick={()=>{setCanvasProject(proj);setSelectedProject(null);}} style={{flex:1,padding:"10px",background:C.bgDeep,color:"#d4e8c2",border:"none",borderRadius:"10px",fontFamily:font.body,fontSize:"14px",cursor:"pointer"}}>📐 Canvas</button>
                  )}
                  {canvasAccess==="upgrade"&&(
                    <button disabled style={{flex:1,padding:"10px",background:C.bg,color:C.textLight,border:`0.5px solid ${C.border}`,borderRadius:"10px",fontFamily:font.body,fontSize:"14px",cursor:"not-allowed",opacity:0.7}}>📐 Canvas · Pro</button>
                  )}
                  <button onClick={()=>{setEditingProject(proj);setSelectedProject(null);setShowForm(true);}} style={{flex:1,padding:"10px",background:C.green,color:"#fff",border:"none",borderRadius:"10px",fontFamily:font.body,fontSize:"14px",cursor:"pointer"}}>✏️ Editar</button>
                  <button onClick={()=>handleDelete(proj.id)} style={{padding:"10px 14px",background:"#f8ece8",color:"#a05050",border:`0.5px solid #d4b8b8`,borderRadius:"10px",fontFamily:font.body,fontSize:"14px",cursor:"pointer"}}>🗑</button>
                  <button onClick={()=>setSelectedProject(null)} style={{padding:"10px 14px",background:C.bg,color:C.textMid,border:`0.5px solid ${C.border}`,borderRadius:"10px",fontFamily:font.body,fontSize:"14px",cursor:"pointer"}}>Cerrar</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showForm&&<ProjectForm initial={editingProject} myPlants={myPlants} onSave={handleSave} onCancel={()=>{setShowForm(false);setEditingProject(null);}}/>}
      {canvasProject&&<PlantCanvas project={canvasProject} plants={myPlants} onClose={()=>setCanvasProject(null)}/>}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [plants, setPlants] = useState([]);
  const [customTags, setCustomTags] = useState(DEFAULT_TAGS);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState(null);
  const [activePlantType, setActivePlantType] = useState(null);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPlant, setEditingPlant] = useState(null);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);
  const [view, setView] = useState("myplants");
  const [toast, setToast] = useState(null);

  useEffect(()=>{
    return onAuthStateChanged(auth, async u=>{
      setUser(u);
      if(u){
        await setDoc(doc(db,"users",u.uid),{uid:u.uid,displayName:u.displayName,photoURL:u.photoURL,email:u.email},{merge:true});
        loadPlants(u.uid);
        try { const td=await getDoc(doc(db,"userTags",u.uid)); if(td.exists()) setCustomTags(td.data().tags||DEFAULT_TAGS); } catch(e){}
      }
      setAuthLoading(false);
    });
  },[]);

  const loadPlants = async uid=>{ try { const q=query(collection(db,"plants"),where("userId","==",uid)); const snap=await getDocs(q); setPlants(snap.docs.map(d=>({id:d.id,...d.data()}))); } catch(e){console.error(e);} };
  const showToast = msg=>{ setToast(msg); setTimeout(()=>setToast(null),3000); };

  const handleSave = async form=>{ if(!user) return; try { if(editingPlant){ await setDoc(doc(db,"plants",editingPlant.id),{...form,userId:user.uid,updatedAt:serverTimestamp()},{merge:true}); } else { const ref=doc(collection(db,"plants")); await setDoc(ref,{...form,id:ref.id,userId:user.uid,createdAt:serverTimestamp()}); } await loadPlants(user.uid); await setDoc(doc(db,"users",user.uid),{plantCount:plants.length+(editingPlant?0:1)},{merge:true}); showToast(editingPlant?"Planta actualizada ✓":"Planta agregada ✓"); } catch(e){console.error(e);showToast("Error al guardar");} setShowForm(false); setEditingPlant(null); };
  const handleDelete = async id=>{ try { await deleteDoc(doc(db,"plants",id)); await loadPlants(user.uid); await setDoc(doc(db,"users",user.uid),{plantCount:Math.max(0,plants.length-1)},{merge:true}); showToast("Planta eliminada"); } catch(e){console.error(e);} setSelectedPlant(null); };
  const handleCopy = async plant=>{ if(!user) return; try { const ref=doc(collection(db,"plants")); const {id:_,...rest}=plant; await setDoc(ref,{...rest,id:ref.id,userId:user.uid,copiedFrom:plant.userId||null,createdAt:serverTimestamp()}); await loadPlants(user.uid); await setDoc(doc(db,"users",user.uid),{plantCount:plants.length+1},{merge:true}); showToast("¡Planta copiada a tu colección! 🌿"); } catch(e){console.error(e);showToast("Error al copiar");} };
  const handleSaveTags = async tags=>{ setCustomTags(tags); setShowTagManager(false); try { await setDoc(doc(db,"userTags",user.uid),{tags}); } catch(e){} };

  const usedTags  = [...new Set(plants.flatMap(p=>p.gardenTags||[]))];
  const usedTypes = [...new Set(plants.map(p=>p.plantType).filter(Boolean))];
  const filtered  = plants.filter(p=>{ const ms=!search||p.commonName?.toLowerCase().includes(search.toLowerCase())||p.scientificName?.toLowerCase().includes(search.toLowerCase()); const mt=!activeTag||p.gardenTags?.includes(activeTag); const mp=!activePlantType||p.plantType===activePlantType; return ms&&mt&&mp; });

  if(authLoading) return <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:"16px"}}><span style={{fontSize:"48px"}}>🌿</span><Spinner/></div>;
  if(!user) return <LoginScreen/>;

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Lora:ital,wght@0,400;0,500;1,400&display=swap');*{box-sizing:border-box}body{margin:0;background:${C.bg}}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {toast&&<div style={{position:"fixed",top:"20px",left:"50%",transform:"translateX(-50%)",background:C.green,color:"#fff",padding:"10px 20px",borderRadius:"10px",fontFamily:font.body,fontSize:"14px",zIndex:2000,boxShadow:"0 4px 16px rgba(0,0,0,0.15)",whiteSpace:"nowrap"}}>{toast}</div>}

      <div style={{minHeight:"100vh",background:C.bg}}>
        {/* Header */}
        <div style={{background:C.bgDeep,padding:"20px 24px 0",borderBottom:`0.5px solid ${C.bgPanel}`}}>
          <div style={{maxWidth:"1100px",margin:"0 auto"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px",marginBottom:"16px",flexWrap:"wrap"}}>
              <div>
                <p style={{color:C.greenLight,fontFamily:font.body,fontSize:"11px",textTransform:"uppercase",letterSpacing:"0.2em",margin:"0 0 4px"}}>Mi colección</p>
                <h1 style={{margin:0,fontFamily:font.serif,fontSize:"clamp(20px,4vw,32px)",fontWeight:600,color:"#e8f0d8",lineHeight:1}}>Catálogo de Plantas 🌿</h1>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <img src={user.photoURL} style={{width:"32px",height:"32px",borderRadius:"50%",border:`1px solid ${C.bgPanel}`}} alt={user.displayName}/>
                <button onClick={()=>signOut(auth)} style={{padding:"7px 14px",background:"transparent",color:"#a8c898",border:`0.5px solid ${C.bgPanel}`,borderRadius:"8px",fontFamily:font.body,fontSize:"13px",cursor:"pointer"}}>Salir</button>
              </div>
            </div>
            <div style={{display:"flex",gap:"4px"}}>
              {[["myplants","🌿 Mi biblioteca"],["community","🌍 Comunidad"],["projects","📋 Proyectos"],["glossary","📖 Glosario botánico"]].map(([v,label])=>(
                <button key={v} onClick={()=>{ if(v==="glossary"){ setShowGlossary(true); } else setView(v); }} style={{padding:"9px 16px",background:view===v&&v!=="glossary"?"rgba(255,255,255,0.1)":"transparent",color:view===v&&v!=="glossary"?"#d4e8c2":"#7aaa50",border:"none",borderRadius:"8px 8px 0 0",fontFamily:font.body,fontSize:"13px",cursor:"pointer",borderBottom:view===v&&v!=="glossary"?`2px solid ${C.greenLight}`:"2px solid transparent"}}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {view==="myplants"&&(
          <>
            <div style={{background:"#fff",borderBottom:`0.5px solid ${C.border}`,padding:"16px 24px"}}>
              <div style={{maxWidth:"1100px",margin:"0 auto"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",marginBottom:"14px",flexWrap:"wrap"}}>
                  <p style={{color:C.textLight,fontFamily:font.body,fontSize:"14px",margin:0}}>{plants.length} {plants.length===1?"planta registrada":"plantas registradas"}</p>
                  <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                    <button onClick={()=>setShowTagManager(true)} style={{padding:"8px 14px",background:C.bg,color:C.textMid,border:`0.5px solid ${C.border}`,borderRadius:"8px",fontFamily:font.body,fontSize:"13px",cursor:"pointer"}}>🏷️ Mis etiquetas</button>
                    <button onClick={()=>{setEditingPlant(null);setShowForm(true);}} style={{padding:"8px 18px",background:C.green,color:"#fff",border:"none",borderRadius:"8px",fontFamily:font.serif,fontSize:"14px",cursor:"pointer",boxShadow:`0 2px 8px ${C.green}44`}}>+ Nueva planta</button>
                  </div>
                </div>
                <div style={{position:"relative",maxWidth:"380px",marginBottom:"12px"}}>
                  <span style={{position:"absolute",left:"12px",top:"50%",transform:"translateY(-50%)",color:C.textLight}}>🔍</span>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre..." style={{width:"100%",padding:"9px 14px 9px 38px",background:C.bg,border:`0.5px solid ${C.border}`,borderRadius:"8px",color:C.text,fontFamily:font.body,fontSize:"14px",outline:"none"}}/>
                </div>
                {usedTypes.length>0&&<div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"8px"}}>
                  <span onClick={()=>setActivePlantType(null)} style={{display:"inline-flex",alignItems:"center",padding:"3px 12px",borderRadius:"999px",fontSize:"12px",fontFamily:font.body,cursor:"pointer",background:!activePlantType?C.tealBg:C.bg,color:!activePlantType?C.teal:C.textLight,border:!activePlantType?`1px solid #a0c8d8`:`0.5px solid ${C.border}`,userSelect:"none"}}>Todos</span>
                  {PLANT_TYPES.filter(pt=>usedTypes.includes(pt.value)).map(pt=>(<span key={pt.value} onClick={()=>setActivePlantType(activePlantType===pt.value?null:pt.value)} style={{display:"inline-flex",alignItems:"center",gap:"5px",padding:"3px 12px",borderRadius:"999px",fontSize:"12px",fontFamily:font.body,cursor:"pointer",background:activePlantType===pt.value?C.tealBg:C.bg,color:activePlantType===pt.value?C.teal:C.textLight,border:activePlantType===pt.value?`1px solid #a0c8d8`:`0.5px solid ${C.border}`,userSelect:"none"}}>{pt.emoji} {pt.label}</span>))}
                </div>}
                {usedTags.length>0&&<div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                  <TagChip label="Todas" active={!activeTag} onClick={()=>setActiveTag(null)}/>
                  {usedTags.map(tag=><TagChip key={tag} label={tag} active={activeTag===tag} onClick={()=>setActiveTag(activeTag===tag?null:tag)}/>)}
                </div>}
              </div>
            </div>
            <div style={{maxWidth:"1100px",margin:"0 auto",padding:"24px"}}>
              {filtered.length===0?(
                <div style={{textAlign:"center",padding:"80px 20px"}}>
                  <div style={{fontSize:"56px",opacity:0.2,marginBottom:"16px"}}>🌱</div>
                  <p style={{color:C.green,fontFamily:font.serif,fontSize:"20px"}}>{plants.length===0?"Tu catálogo está vacío":"No se encontraron plantas"}</p>
                  <p style={{color:C.textLight,fontFamily:font.body,fontSize:"14px"}}>{plants.length===0?"Agrega tu primera planta para comenzar":"Intenta con otro nombre o filtro"}</p>
                </div>
              ):(
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:"16px"}}>
                  {filtered.map(plant=><PlantCard key={plant.id} plant={plant} onClick={setSelectedPlant} isOwn={true}/>)}
                </div>
              )}
            </div>
          </>
        )}
        {view==="community"&&<CommunityView currentUser={user} onCopy={handleCopy}/>}
        {view==="projects"&&<ProjectsView user={user} myPlants={plants} showToast={showToast}/>}
      </div>

      {selectedPlant&&<DetailModal plant={selectedPlant} onClose={()=>setSelectedPlant(null)} onEdit={p=>{setEditingPlant(p);setSelectedPlant(null);setShowForm(true);}} onDelete={handleDelete} onCopy={handleCopy} isOwn={selectedPlant.userId===user?.uid}/>}
      {showForm&&<PlantForm initial={editingPlant} allTags={customTags} onSave={handleSave} onCancel={()=>{setShowForm(false);setEditingPlant(null);}}/>}
      {showTagManager&&<ManageTagsPanel tags={customTags} onSave={handleSaveTags} onClose={()=>setShowTagManager(false)}/>}
      {showGlossary&&<GlossaryPanel onClose={()=>setShowGlossary(false)}/>}
    </> 
  );
}
