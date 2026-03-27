import { useState, useEffect, useRef } from "react";
import { auth, provider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import {
  collection, doc, setDoc, getDoc, getDocs, deleteDoc,
  query, where, orderBy, serverTimestamp
} from "firebase/firestore";

// ── Constants ─────────────────────────────────────────
const LIGHT_OPTIONS = ["Pleno sol","Sol parcial","Sombra","Sombra parcial"];
const WATER_OPTIONS = ["Diario","Cada 2-3 días","Semanal","Quincenal","Mensual"];
const SOIL_OPTIONS  = ["Tierra común","Arena / bien drenada","Ácida","Alcalina","Rica en nutrientes"];
const ROOT_OPTIONS  = ["Fibrosa","Pivotante","Bulbosa","Rizoma","Tuberosa","Aérea","Adventicia"];

const PLANT_TYPES = [
  { value:"cubresuelo", label:"Cubresuelo", emoji:"🍀", desc:"Crece al ras del suelo cubriendo superficies" },
  { value:"herbaceas",  label:"Herbácea",   emoji:"🌿", desc:"Tallo blando sin madera, generalmente pequeña" },
  { value:"arbustivas", label:"Arbustiva",  emoji:"🪴", desc:"Tallo leñoso ramificado desde la base" },
  { value:"arboles",    label:"Árbol",      emoji:"🌲", desc:"Tallo leñoso principal con copa definida" },
];

const DEFAULT_TAGS = ["Interior","Exterior","Jardín tropical","Jardín desértico","Jardín zen",
  "Jardín acuático","Balcón","Terrario","Huerto","Sombra profunda","Cubierta","Maceta"];

const ROOT_GLOSSARY = [
  { name:"Fibrosa",    emoji:"🌾", color:"#3d5a20", description:"Conjunto de raíces delgadas y muy ramificadas que se extienden desde la base del tallo. Eficientes absorbiendo agua de la capa superficial.", examples:"Helechos, bambú, césped, maíz" },
  { name:"Pivotante",  emoji:"🥕", color:"#5a3d20", description:"Raíz principal gruesa y vertical con raíces secundarias a los lados. Llega a capas profundas para obtener agua en épocas secas.", examples:"Zanahoria, roble, diente de león, pino" },
  { name:"Bulbosa",    emoji:"🧅", color:"#5a4a20", description:"Estructura subterránea que almacena energía. La parte aérea muere en temporada fría y renace desde el bulbo cada ciclo.", examples:"Tulipán, cebolla, ajo, jacinto, narciso" },
  { name:"Rizoma",     emoji:"🫚", color:"#3a5a3a", description:"Tallo subterráneo horizontal que produce nuevas plantas a lo largo de su recorrido. Excelente mecanismo de reproducción vegetativa.", examples:"Jengibre, iris, menta, lirio, espárrago" },
  { name:"Tuberosa",   emoji:"🥔", color:"#5a3520", description:"Raíz engrosada que almacena almidón y agua. A diferencia del bulbo, es una raíz verdadera modificada.", examples:"Camote, dalia, mandioca, rábano" },
  { name:"Aérea",      emoji:"🌀", color:"#205a4a", description:"Raíces que crecen fuera del suelo. Absorben humedad ambiental y sirven de sostén. Típicas de epífitas y trepadoras.", examples:"Orquídea, hiedra, ficus, monstera, vainilla" },
  { name:"Adventicia", emoji:"🌱", color:"#2a4a5a", description:"Raíces que emergen en lugares atípicos como tallos o hojas. Clave en la propagación y en plantas que crecen sobre superficies.", examples:"Pothos, fresa (estolones), maíz (raíces zancos)" },
];

const emptyForm = {
  commonName:"", scientificName:"", photo:"",
  light:"", water:"", soil:"", rootType:"",
  plantType:"", heightMin:"", heightMax:"", canopySize:"",
  gardenTags:[], notes:"",
};

const font = { serif:"'Playfair Display', serif", body:"'Lora', serif" };

// ── Shared UI components ──────────────────────────────
function TagChip({ label, active, onClick, onDelete }) {
  return (
    <span onClick={onClick} style={{display:"inline-flex",alignItems:"center",gap:"4px",padding:"3px 12px",borderRadius:"999px",fontSize:"12px",fontFamily:font.body,cursor:onClick?"pointer":"default",background:active?"#2d5a27":"#1a2e1a",color:active?"#a8d5a2":"#5a7a4a",border:active?"1px solid #4a8a3a":"1px solid #2a4a2a",transition:"all 0.15s",userSelect:"none"}}>
      {label}
      {onDelete && <span onClick={e=>{e.stopPropagation();onDelete();}} style={{marginLeft:"2px",opacity:0.6,fontWeight:"bold"}}>×</span>}
    </span>
  );
}
function BrownChip({ label }) {
  return <span style={{display:"inline-flex",alignItems:"center",padding:"3px 12px",borderRadius:"999px",fontSize:"12px",fontFamily:font.body,background:"#3d2b1f",color:"#c4a882",border:"1px solid rgba(255,255,255,0.08)"}}>{label}</span>;
}
function TealChip({ label }) {
  return <span style={{display:"inline-flex",alignItems:"center",padding:"3px 12px",borderRadius:"999px",fontSize:"12px",fontFamily:font.body,background:"#1a4040",color:"#7ecece",border:"1px solid rgba(255,255,255,0.08)"}}>{label}</span>;
}
function TypeChip({ value }) {
  const t = PLANT_TYPES.find(o=>o.value===value);
  if (!t) return null;
  return <span style={{display:"inline-flex",alignItems:"center",gap:"4px",padding:"3px 12px",borderRadius:"999px",fontSize:"12px",fontFamily:font.body,background:"#1e2a40",color:"#90b8e0",border:"1px solid #2a4060"}}>{t.emoji} {t.label}</span>;
}
function SectionLabel({ children }) {
  return <p style={{color:"#5a8a4a",fontFamily:font.body,fontSize:"11px",textTransform:"uppercase",letterSpacing:"0.1em",margin:"0 0 8px"}}>{children}</p>;
}
function Spinner() {
  return <div style={{width:"20px",height:"20px",border:"2px solid #2a4a2a",borderTop:"2px solid #5a9a4a",borderRadius:"50%",animation:"spin 0.8s linear infinite"}} />;
}

// ── Login Screen ──────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const handleLogin = async () => {
    setLoading(true);
    try { await signInWithPopup(auth, provider); }
    catch(e) { console.error(e); setLoading(false); }
  };
  return (
    <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at top left,#0f2010 0%,#080f08 60%,#050a05 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px"}}>
      <div style={{textAlign:"center",maxWidth:"360px"}}>
        <div style={{fontSize:"64px",marginBottom:"16px"}}>🌿</div>
        <p style={{color:"#4a7a3a",fontFamily:font.body,fontSize:"12px",textTransform:"uppercase",letterSpacing:"0.2em",margin:"0 0 8px"}}>Bienvenida a</p>
        <h1 style={{color:"#d4e8c2",fontFamily:font.serif,fontSize:"32px",fontWeight:700,margin:"0 0 12px",lineHeight:1.1}}>Catálogo de Plantas</h1>
        <p style={{color:"#5a8a4a",fontFamily:font.body,fontSize:"14px",lineHeight:1.7,margin:"0 0 40px"}}>Tu biblioteca personal y comunidad de plantas. Guarda, organiza y comparte tu colección con amigas.</p>
        <button onClick={handleLogin} disabled={loading} style={{display:"inline-flex",alignItems:"center",gap:"12px",padding:"14px 28px",background:"#fff",color:"#333",border:"none",borderRadius:"12px",fontFamily:font.body,fontSize:"15px",cursor:"pointer",boxShadow:"0 4px 20px rgba(0,0,0,0.4)",width:"100%",justifyContent:"center"}}>
          {loading ? <Spinner/> : <><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="20" alt="Google"/> Continuar con Gmail</>}
        </button>
        <p style={{color:"#3a5a3a",fontFamily:font.body,fontSize:"12px",marginTop:"20px"}}>Cualquier persona con el enlace puede unirse</p>
      </div>
    </div>
  );
}

// ── Plant Card ────────────────────────────────────────
function PlantCard({ plant, onClick, onCopy, isOwn }) {
  const pt = PLANT_TYPES.find(o=>o.value===plant.plantType);
  const heightStr = plant.heightMin||plant.heightMax
    ? (plant.heightMin&&plant.heightMax?`${plant.heightMin}–${plant.heightMax} m`:`${plant.heightMin||plant.heightMax} m`) : null;
  return (
    <div style={{background:"linear-gradient(160deg,#1a2e1a,#0f1f0f)",border:"1px solid #2a4a2a",borderRadius:"16px",overflow:"hidden",cursor:"pointer",transition:"transform 0.2s,box-shadow 0.2s",boxShadow:"0 4px 20px rgba(0,0,0,0.4)",position:"relative"}}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="0 12px 32px rgba(0,0,0,0.6)";}}
      onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,0.4)";}}>
      <div onClick={()=>onClick(plant)} style={{height:"160px",overflow:"hidden",position:"relative",background:"linear-gradient(135deg,#1e3a1e,#2d5a2d)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        {plant.photo?<img src={plant.photo} alt={plant.commonName} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:"44px",opacity:0.35}}>🌿</span>}
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:"60px",background:"linear-gradient(transparent,rgba(0,0,0,0.7))"}}/>
        {pt&&<span style={{position:"absolute",top:"8px",right:"8px",fontSize:"18px",background:"rgba(0,0,0,0.45)",borderRadius:"8px",padding:"3px 6px"}}>{pt.emoji}</span>}
      </div>
      <div onClick={()=>onClick(plant)} style={{padding:"12px 14px 6px"}}>
        <h3 style={{margin:"0 0 2px",color:"#d4e8c2",fontFamily:font.serif,fontSize:"15px",fontWeight:600,lineHeight:1.2}}>{plant.commonName||"Sin nombre"}</h3>
        <p style={{margin:"0 0 8px",color:"#7a9e6a",fontFamily:font.body,fontSize:"11px",fontStyle:"italic"}}>{plant.scientificName||"—"}</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:"4px",marginBottom:"6px"}}>
          {plant.gardenTags?.slice(0,2).map(t=><TagChip key={t} label={t} active/>)}
          {plant.gardenTags?.length>2&&<span style={{color:"#7a9e6a",fontSize:"11px",alignSelf:"center"}}>+{plant.gardenTags.length-2}</span>}
        </div>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          {plant.light&&<span style={{color:"#7a9e6a",fontSize:"11px",fontFamily:font.body}}>☀️ {plant.light}</span>}
          {heightStr&&<span style={{color:"#7a9e6a",fontSize:"11px",fontFamily:font.body}}>📏 {heightStr}</span>}
        </div>
      </div>
      {!isOwn && onCopy && (
        <div style={{padding:"8px 14px 12px"}}>
          <button onClick={e=>{e.stopPropagation();onCopy(plant);}} style={{width:"100%",padding:"7px",background:"#1e2a40",color:"#90b8e0",border:"1px solid #2a4060",borderRadius:"8px",fontFamily:font.body,fontSize:"12px",cursor:"pointer"}}>
            ＋ Traer a mi colección
          </button>
        </div>
      )}
      {isOwn && <div style={{height:"12px"}}/>}
    </div>
  );
}

// ── Detail Modal ──────────────────────────────────────
function DetailModal({ plant, onClose, onEdit, onDelete, onCopy, isOwn }) {
  if (!plant) return null;
  const root = ROOT_GLOSSARY.find(r=>r.name===plant.rootType);
  const pt = PLANT_TYPES.find(o=>o.value===plant.plantType);
  const heightStr = plant.heightMin||plant.heightMax
    ? (plant.heightMin&&plant.heightMax?`${plant.heightMin} – ${plant.heightMax} m`:`${plant.heightMin||plant.heightMax} m`) : null;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(160deg,#1a2e1a,#0e1d0e)",border:"1px solid #2a4a2a",borderRadius:"20px",width:"100%",maxWidth:"540px",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 60px rgba(0,0,0,0.8)"}}>
        {plant.photo&&<div style={{height:"220px",overflow:"hidden",borderRadius:"20px 20px 0 0"}}><img src={plant.photo} alt={plant.commonName} style={{width:"100%",height:"100%",objectFit:"cover"}}/></div>}
        <div style={{padding:"24px"}}>
          <h2 style={{margin:"0 0 4px",color:"#d4e8c2",fontFamily:font.serif,fontSize:"26px"}}>{plant.commonName}</h2>
          <p style={{margin:"0 0 16px",color:"#7a9e6a",fontFamily:font.body,fontStyle:"italic",fontSize:"14px"}}>{plant.scientificName}</p>
          {pt&&<div style={{marginBottom:"16px"}}><SectionLabel>Clasificación</SectionLabel><TypeChip value={plant.plantType}/><p style={{margin:"8px 0 0",color:"#a8a878",fontFamily:font.body,fontSize:"13px",lineHeight:1.6}}>{pt.desc}</p></div>}
          {(heightStr||plant.canopySize)&&(
            <div style={{marginBottom:"16px"}}>
              <SectionLabel>Dimensiones</SectionLabel>
              <div style={{display:"flex",gap:"12px",flexWrap:"wrap"}}>
                {heightStr&&<div style={{background:"#0e1d0e",border:"1px solid #2a4a2a",borderRadius:"10px",padding:"10px 16px",textAlign:"center"}}><p style={{margin:0,color:"#5a8a4a",fontFamily:font.body,fontSize:"10px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Altura</p><p style={{margin:"4px 0 0",color:"#d4e8c2",fontFamily:font.serif,fontSize:"18px",fontWeight:600}}>{heightStr}</p></div>}
                {plant.canopySize&&<div style={{background:"#0e1d0e",border:"1px solid #2a4a2a",borderRadius:"10px",padding:"10px 16px",textAlign:"center"}}><p style={{margin:0,color:"#5a8a4a",fontFamily:font.body,fontSize:"10px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Copa / Extensión</p><p style={{margin:"4px 0 0",color:"#d4e8c2",fontFamily:font.serif,fontSize:"18px",fontWeight:600}}>{plant.canopySize} m</p></div>}
              </div>
            </div>
          )}
          {(plant.light||plant.water||plant.soil)&&<div style={{marginBottom:"16px"}}><SectionLabel>Cuidados</SectionLabel><div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>{plant.light&&<TealChip label={"☀️ "+plant.light}/>}{plant.water&&<TealChip label={"💧 "+plant.water}/>}{plant.soil&&<TealChip label={"🪴 "+plant.soil}/>}</div></div>}
          {plant.rootType&&<div style={{marginBottom:"16px"}}><SectionLabel>Tipo de raíz</SectionLabel><BrownChip label={`${root?.emoji||""} ${plant.rootType}`}/>{root&&<p style={{margin:"8px 0 0",color:"#a8a878",fontFamily:font.body,fontSize:"13px",lineHeight:1.6}}>{root.description}</p>}</div>}
          {plant.gardenTags?.length>0&&<div style={{marginBottom:"16px"}}><SectionLabel>Tipo de jardín</SectionLabel><div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>{plant.gardenTags.map(t=><TagChip key={t} label={t} active/>)}</div></div>}
          {plant.notes&&<div style={{marginBottom:"20px"}}><SectionLabel>Notas</SectionLabel><p style={{color:"#a8c898",fontFamily:font.body,fontSize:"14px",lineHeight:1.7,margin:0}}>{plant.notes}</p></div>}
          <div style={{display:"flex",gap:"10px"}}>
            {isOwn?(
              <><button onClick={()=>onEdit(plant)} style={{flex:1,padding:"10px",background:"#2d5a27",color:"#a8d5a2",border:"none",borderRadius:"10px",fontFamily:font.body,fontSize:"14px",cursor:"pointer"}}>✏️ Editar</button>
              <button onClick={()=>onDelete(plant.id)} style={{padding:"10px 16px",background:"#3a1a1a",color:"#c47a7a",border:"none",borderRadius:"10px",fontFamily:font.body,fontSize:"14px",cursor:"pointer"}}>🗑</button></>
            ):(
              <button onClick={()=>onCopy(plant)} style={{flex:1,padding:"10px",background:"#1e2a40",color:"#90b8e0",border:"1px solid #2a4060",borderRadius:"10px",fontFamily:font.body,fontSize:"14px",cursor:"pointer"}}>＋ Traer a mi colección</button>
            )}
            <button onClick={onClose} style={{padding:"10px 16px",background:"#1a2a1a",color:"#7a9e6a",border:"1px solid #2a4a2a",borderRadius:"10px",fontFamily:font.body,fontSize:"14px",cursor:"pointer"}}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Plant Form ────────────────────────────────────────
function PlantForm({ initial, allTags, onSave, onCancel }) {
  const [form, setForm] = useState(initial||emptyForm);
  const [preview, setPreview] = useState(initial?.photo||"");
  const fileRef = useRef();
  const set = (f,v)=>setForm(p=>({...p,[f]:v}));
  const toggleTag = tag=>setForm(p=>({...p,gardenTags:p.gardenTags.includes(tag)?p.gardenTags.filter(t=>t!==tag):[...p.gardenTags,tag]}));
  const handlePhoto = e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=ev=>{setPreview(ev.target.result);set("photo",ev.target.result);};r.readAsDataURL(file);};
  const inp={width:"100%",padding:"10px 12px",background:"#0e1d0e",border:"1px solid #2a4a2a",borderRadius:"8px",color:"#c8e0b8",fontFamily:font.body,fontSize:"14px",boxSizing:"border-box",outline:"none"};
  const lbl={display:"block",color:"#5a8a4a",fontFamily:font.body,fontSize:"11px",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"6px"};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
      <div style={{background:"linear-gradient(160deg,#1a2e1a,#0e1d0e)",border:"1px solid #2a4a2a",borderRadius:"20px",width:"100%",maxWidth:"580px",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 24px 60px rgba(0,0,0,0.8)",padding:"28px"}}>
        <h2 style={{color:"#d4e8c2",fontFamily:font.serif,fontSize:"22px",margin:"0 0 24px"}}>{initial?"Editar planta":"Nueva ficha de planta"}</h2>
        <div style={{marginBottom:"20px"}}>
          <div onClick={()=>fileRef.current.click()} style={{height:"120px",borderRadius:"12px",border:"2px dashed #2a4a2a",background:"#0e1d0e",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden"}}>
            {preview?<img src={preview} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{textAlign:"center"}}><div style={{fontSize:"28px",opacity:0.4}}>📷</div><p style={{color:"#5a8a4a",fontFamily:font.body,fontSize:"12px",margin:"4px 0 0"}}>Toca para agregar foto</p></div>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{display:"none"}}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px",marginBottom:"14px"}}>
          <div><label style={lbl}>Nombre común</label><input style={inp} value={form.commonName} onChange={e=>set("commonName",e.target.value)} placeholder="Ej: Helecho"/></div>
          <div><label style={lbl}>Nombre científico</label><input style={inp} value={form.scientificName} onChange={e=>set("scientificName",e.target.value)} placeholder="Ej: Nephrolepis"/></div>
        </div>
        <div style={{marginBottom:"16px"}}>
          <label style={lbl}>Clasificación de la planta</label>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px"}}>
            {PLANT_TYPES.map(pt=>(
              <div key={pt.value} onClick={()=>set("plantType",form.plantType===pt.value?"":pt.value)} style={{padding:"10px 8px",borderRadius:"10px",textAlign:"center",cursor:"pointer",transition:"all 0.15s",background:form.plantType===pt.value?"#1e2a40":"#0e1d0e",border:form.plantType===pt.value?"1px solid #4a7ab0":"1px solid #2a4a2a"}}>
                <div style={{fontSize:"22px"}}>{pt.emoji}</div>
                <p style={{margin:"4px 0 0",color:form.plantType===pt.value?"#90b8e0":"#5a8a4a",fontFamily:font.body,fontSize:"11px"}}>{pt.label}</p>
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
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"12px",marginBottom:"14px"}}>
          {[["Luz","light",LIGHT_OPTIONS],["Riego","water",WATER_OPTIONS],["Tierra","soil",SOIL_OPTIONS]].map(([l,f,opts])=>(
            <div key={f}><label style={lbl}>{l}</label><select style={{...inp,appearance:"none"}} value={form[f]} onChange={e=>set(f,e.target.value)}><option value="">—</option>{opts.map(o=><option key={o}>{o}</option>)}</select></div>
          ))}
        </div>
        <div style={{marginBottom:"14px"}}><label style={lbl}>Tipo de raíz</label><select style={{...inp,appearance:"none"}} value={form.rootType} onChange={e=>set("rootType",e.target.value)}><option value="">—</option>{ROOT_OPTIONS.map(o=><option key={o}>{o}</option>)}</select></div>
        <div style={{marginBottom:"18px"}}>
          <label style={lbl}>Etiquetas de jardín</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
            {allTags.map(tag=><TagChip key={tag} label={tag} active={form.gardenTags.includes(tag)} onClick={()=>toggleTag(tag)}/>)}
          </div>
        </div>
        <div style={{marginBottom:"24px"}}><label style={lbl}>Notas personales</label><textarea style={{...inp,minHeight:"80px",resize:"vertical"}} value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Observaciones, dónde la conseguiste, recuerdos..."/></div>
        <div style={{display:"flex",gap:"10px"}}>
          <button onClick={()=>onSave(form)} style={{flex:1,padding:"12px",background:"linear-gradient(135deg,#2d5a27,#3a7a30)",color:"#d4e8c2",border:"none",borderRadius:"10px",fontFamily:font.serif,fontSize:"15px",cursor:"pointer"}}>{initial?"Guardar cambios":"Agregar planta"}</button>
          <button onClick={onCancel} style={{padding:"12px 18px",background:"#1a2a1a",color:"#7a9e6a",border:"1px solid #2a4a2a",borderRadius:"10px",fontFamily:font.body,fontSize:"14px",cursor:"pointer"}}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── Glossary Panel ────────────────────────────────────
function GlossaryPanel({ onClose }) {
  const [selected, setSelected] = useState(null);
  const root = ROOT_GLOSSARY.find(r=>r.name===selected);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",backdropFilter:"blur(6px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(160deg,#111e11,#0a130a)",border:"1px solid #2a4a2a",borderRadius:"20px",width:"100%",maxWidth:"660px",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 60px rgba(0,0,0,0.9)",padding:"28px"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"6px"}}>
          <div><p style={{color:"#4a7a3a",fontFamily:font.body,fontSize:"11px",textTransform:"uppercase",letterSpacing:"0.2em",margin:0}}>Referencia botánica</p><h2 style={{color:"#d4e8c2",fontFamily:font.serif,fontSize:"24px",margin:"4px 0 0"}}>Tipos de Raíz 🌱</h2></div>
          <button onClick={onClose} style={{background:"#1a2a1a",border:"1px solid #2a4a2a",color:"#7a9e6a",borderRadius:"10px",padding:"8px 14px",fontFamily:font.body,cursor:"pointer",fontSize:"13px"}}>Cerrar</button>
        </div>
        <p style={{color:"#5a8a4a",fontFamily:font.body,fontSize:"13px",marginBottom:"24px"}}>Selecciona un tipo para leer su descripción completa.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:"10px",marginBottom:"24px"}}>
          {ROOT_GLOSSARY.map(r=>(
            <div key={r.name} onClick={()=>setSelected(selected===r.name?null:r.name)} style={{background:selected===r.name?`${r.color}55`:"#0e1d0e",border:`1px solid ${selected===r.name?r.color:"#2a4a2a"}`,borderRadius:"12px",padding:"14px",cursor:"pointer",transition:"all 0.2s"}}>
              <span style={{fontSize:"24px"}}>{r.emoji}</span>
              <p style={{margin:"6px 0 0",color:"#d4e8c2",fontFamily:font.serif,fontSize:"15px",fontWeight:600}}>{r.name}</p>
              <p style={{margin:"4px 0 0",color:"#5a8a4a",fontFamily:font.body,fontSize:"11px"}}>Ej: {r.examples.split(",")[0].trim()}</p>
            </div>
          ))}
        </div>
        {root&&<div style={{background:`${root.color}33`,border:`1px solid ${root.color}`,borderRadius:"14px",padding:"20px"}}><div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"12px"}}><span style={{fontSize:"34px"}}>{root.emoji}</span><h3 style={{margin:0,color:"#d4e8c2",fontFamily:font.serif,fontSize:"20px"}}>Raíz {root.name}</h3></div><p style={{color:"#c8e0b8",fontFamily:font.body,fontSize:"14px",lineHeight:1.8,margin:"0 0 14px"}}>{root.description}</p><div style={{borderTop:"1px solid rgba(255,255,255,0.08)",paddingTop:"12px"}}><p style={{color:"#5a8a4a",fontFamily:font.body,fontSize:"11px",textTransform:"uppercase",letterSpacing:"0.1em",margin:"0 0 6px"}}>Ejemplos</p><p style={{color:"#a8c898",fontFamily:font.body,fontSize:"13px",fontStyle:"italic",margin:0}}>{root.examples}</p></div></div>}
      </div>
    </div>
  );
}

// ── Manage Tags Panel ─────────────────────────────────
function ManageTagsPanel({ tags, onSave, onClose }) {
  const [local, setLocal] = useState([...tags]);
  const [newTag, setNewTag] = useState("");
  const add = ()=>{const t=newTag.trim();if(t&&!local.includes(t))setLocal(p=>[...p,t]);setNewTag("");};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(4px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(160deg,#1a2e1a,#0e1d0e)",border:"1px solid #2a4a2a",borderRadius:"20px",width:"100%",maxWidth:"480px",boxShadow:"0 24px 60px rgba(0,0,0,0.9)",padding:"28px"}}>
        <p style={{color:"#4a7a3a",fontFamily:font.body,fontSize:"11px",textTransform:"uppercase",letterSpacing:"0.2em",margin:"0 0 4px"}}>Personalizar</p>
        <h2 style={{color:"#d4e8c2",fontFamily:font.serif,fontSize:"22px",margin:"0 0 20px"}}>Gestionar etiquetas 🏷️</h2>
        <div style={{display:"flex",gap:"8px",marginBottom:"20px"}}>
          <input value={newTag} onChange={e=>setNewTag(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Escribe una nueva etiqueta..." style={{flex:1,padding:"10px 12px",background:"#0e1d0e",border:"1px solid #2a4a2a",borderRadius:"8px",color:"#c8e0b8",fontFamily:font.body,fontSize:"14px",outline:"none"}}/>
          <button onClick={add} style={{padding:"10px 18px",background:"#2d5a27",color:"#a8d5a2",border:"none",borderRadius:"8px",fontFamily:font.body,fontSize:"14px",cursor:"pointer"}}>+ Agregar</button>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:"8px",minHeight:"60px",marginBottom:"16px"}}>
          {local.length===0?<p style={{color:"#3a5a3a",fontFamily:font.body,fontSize:"13px"}}>No hay etiquetas aún.</p>:local.map(tag=><TagChip key={tag} label={tag} active onDelete={()=>setLocal(p=>p.filter(t=>t!==tag))}/>)}
        </div>
        <p style={{color:"#4a6a3a",fontFamily:font.body,fontSize:"12px",margin:"0 0 20px"}}>⚠️ Eliminar una etiqueta no la quita de las fichas ya guardadas.</p>
        <div style={{display:"flex",gap:"10px"}}>
          <button onClick={()=>onSave(local)} style={{flex:1,padding:"12px",background:"linear-gradient(135deg,#2d5a27,#3a7a30)",color:"#d4e8c2",border:"none",borderRadius:"10px",fontFamily:font.serif,fontSize:"15px",cursor:"pointer"}}>Guardar cambios</button>
          <button onClick={onClose} style={{padding:"12px 18px",background:"#1a2a1a",color:"#7a9e6a",border:"1px solid #2a4a2a",borderRadius:"10px",fontFamily:font.body,fontSize:"14px",cursor:"pointer"}}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── Community View ────────────────────────────────────
function CommunityView({ currentUser, onCopy }) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPlants, setUserPlants] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingPlants, setLoadingPlants] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState(null);

  useEffect(()=>{
    (async()=>{
      try {
        const snap = await getDocs(collection(db,"users"));
        const all = snap.docs.map(d=>d.data()).filter(u=>u.uid!==currentUser.uid);
        setUsers(all);
      } catch(e){ console.error(e); }
      setLoadingUsers(false);
    })();
  },[]);

  const loadUserPlants = async(user)=>{
    setSelectedUser(user); setLoadingPlants(true); setUserPlants([]);
    try {
      const q = query(collection(db,"plants"),where("userId","==",user.uid),orderBy("createdAt","desc"));
      const snap = await getDocs(q);
      setUserPlants(snap.docs.map(d=>({id:d.id,...d.data()})));
    } catch(e){ console.error(e); }
    setLoadingPlants(false);
  };

  return (
    <div style={{maxWidth:"1100px",margin:"0 auto",padding:"28px 24px"}}>
      {!selectedUser ? (
        <>
          <p style={{color:"#4a7a3a",fontFamily:font.body,fontSize:"12px",textTransform:"uppercase",letterSpacing:"0.15em",margin:"0 0 6px"}}>Red de plantas</p>
          <h2 style={{color:"#d4e8c2",fontFamily:font.serif,fontSize:"26px",margin:"0 0 24px"}}>Colecciones de la comunidad 🌍</h2>
          {loadingUsers ? (
            <div style={{display:"flex",justifyContent:"center",padding:"60px"}}><Spinner/></div>
          ) : users.length===0 ? (
            <div style={{textAlign:"center",padding:"80px 20px"}}>
              <div style={{fontSize:"60px",opacity:0.25,marginBottom:"16px"}}>👥</div>
              <p style={{color:"#4a7a3a",fontFamily:font.serif,fontSize:"20px"}}>Aún no hay más personas</p>
              <p style={{color:"#3a5a3a",fontFamily:font.body,fontSize:"14px"}}>Comparte el enlace de la app con tus amigas para que se unan</p>
            </div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"14px"}}>
              {users.map(u=>(
                <div key={u.uid} onClick={()=>loadUserPlants(u)} style={{background:"linear-gradient(160deg,#1a2e1a,#0f1f0f)",border:"1px solid #2a4a2a",borderRadius:"16px",padding:"20px",cursor:"pointer",textAlign:"center",transition:"transform 0.2s,box-shadow 0.2s",boxShadow:"0 4px 20px rgba(0,0,0,0.4)"}}
                  onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="0 12px 32px rgba(0,0,0,0.6)";}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,0.4)";}}>
                  <img src={u.photoURL||"https://api.dicebear.com/7.x/thumbs/svg?seed="+u.uid} style={{width:"56px",height:"56px",borderRadius:"50%",border:"2px solid #2a4a2a",marginBottom:"10px"}} alt={u.displayName}/>
                  <p style={{margin:"0 0 4px",color:"#d4e8c2",fontFamily:font.serif,fontSize:"15px",fontWeight:600}}>{u.displayName||"Usuaria"}</p>
                  <p style={{margin:0,color:"#5a8a4a",fontFamily:font.body,fontSize:"12px"}}>{u.plantCount||0} plantas</p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <button onClick={()=>{setSelectedUser(null);setUserPlants([]);}} style={{display:"inline-flex",alignItems:"center",gap:"8px",padding:"8px 16px",background:"#1a2a1a",color:"#7a9e6a",border:"1px solid #2a4a2a",borderRadius:"10px",fontFamily:font.body,fontSize:"13px",cursor:"pointer",marginBottom:"20px"}}>← Volver</button>
          <div style={{display:"flex",alignItems:"center",gap:"14px",marginBottom:"24px"}}>
            <img src={selectedUser.photoURL||"https://api.dicebear.com/7.x/thumbs/svg?seed="+selectedUser.uid} style={{width:"48px",height:"48px",borderRadius:"50%",border:"2px solid #2a4a2a"}} alt={selectedUser.displayName}/>
            <div>
              <p style={{color:"#4a7a3a",fontFamily:font.body,fontSize:"11px",textTransform:"uppercase",letterSpacing:"0.15em",margin:0}}>Colección de</p>
              <h2 style={{color:"#d4e8c2",fontFamily:font.serif,fontSize:"22px",margin:"2px 0 0"}}>{selectedUser.displayName}</h2>
            </div>
          </div>
          {loadingPlants ? (
            <div style={{display:"flex",justifyContent:"center",padding:"60px"}}><Spinner/></div>
          ) : userPlants.length===0 ? (
            <div style={{textAlign:"center",padding:"60px"}}><p style={{color:"#4a7a3a",fontFamily:font.serif,fontSize:"18px"}}>Esta colección está vacía</p></div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"14px"}}>
              {userPlants.map(plant=><PlantCard key={plant.id} plant={plant} onClick={setSelectedPlant} onCopy={onCopy} isOwn={false}/>)}
            </div>
          )}
          {selectedPlant&&<DetailModal plant={selectedPlant} onClose={()=>setSelectedPlant(null)} onCopy={p=>{onCopy(p);setSelectedPlant(null);}} isOwn={false}/>}
        </>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────
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
  const [showGlossary, setShowGlossary] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [view, setView] = useState("myplants"); // "myplants" | "community"
  const [toast, setToast] = useState(null);

  // Auth listener
  useEffect(()=>{
    return onAuthStateChanged(auth, async u=>{
      setUser(u);
      if(u){
        // Save/update user profile
        await setDoc(doc(db,"users",u.uid),{uid:u.uid,displayName:u.displayName,photoURL:u.photoURL,email:u.email},{merge:true});
        // Load plants
        loadPlants(u.uid);
        // Load tags
        const tagsDoc = await getDoc(doc(db,"userTags",u.uid));
        if(tagsDoc.exists()) setCustomTags(tagsDoc.data().tags||DEFAULT_TAGS);
      }
      setAuthLoading(false);
    });
  },[]);

  const loadPlants = async(uid)=>{
    try {
      const q = query(collection(db,"plants"),where("userId","==",uid),orderBy("createdAt","desc"));
      const snap = await getDocs(q);
      setPlants(snap.docs.map(d=>({id:d.id,...d.data()})));
    } catch(e){ console.error(e); }
  };

  const showToast = (msg)=>{ setToast(msg); setTimeout(()=>setToast(null),3000); };

  const handleSave = async(form)=>{
    try {
      if(editingPlant){
        await setDoc(doc(db,"plants",editingPlant.id),{...form,userId:user.uid,updatedAt:serverTimestamp()},{merge:true});
      } else {
        const ref = doc(collection(db,"plants"));
        await setDoc(ref,{...form,id:ref.id,userId:user.uid,createdAt:serverTimestamp()});
      }
      await loadPlants(user.uid);
      // Update plant count
      await setDoc(doc(db,"users",user.uid),{plantCount:plants.length+(editingPlant?0:1)},{merge:true});
      showToast(editingPlant?"Planta actualizada ✓":"Planta agregada ✓");
    } catch(e){ console.error(e); showToast("Error al guardar"); }
    setShowForm(false); setEditingPlant(null);
  };

  const handleDelete = async(id)=>{
    try {
      await deleteDoc(doc(db,"plants",id));
      await loadPlants(user.uid);
      await setDoc(doc(db,"users",user.uid),{plantCount:Math.max(0,plants.length-1)},{merge:true});
      showToast("Planta eliminada");
    } catch(e){ console.error(e); }
    setSelectedPlant(null);
  };

  const handleCopy = async(plant)=>{
    try {
      const ref = doc(collection(db,"plants"));
      const {id:_,...rest} = plant;
      await setDoc(ref,{...rest,id:ref.id,userId:user.uid,copiedFrom:plant.userId||null,createdAt:serverTimestamp()});
      await loadPlants(user.uid);
      await setDoc(doc(db,"users",user.uid),{plantCount:plants.length+1},{merge:true});
      showToast("¡Planta copiada a tu colección! 🌿");
    } catch(e){ console.error(e); showToast("Error al copiar"); }
  };

  const handleSaveTags = async(tags)=>{
    setCustomTags(tags);
    setShowTagManager(false);
    try { await setDoc(doc(db,"userTags",user.uid),{tags}); } catch(e){ console.error(e); }
  };

  const usedTags = [...new Set(plants.flatMap(p=>p.gardenTags||[]))];
  const usedTypes = [...new Set(plants.map(p=>p.plantType).filter(Boolean))];
  const filtered = plants.filter(p=>{
    const ms=!search||p.commonName?.toLowerCase().includes(search.toLowerCase())||p.scientificName?.toLowerCase().includes(search.toLowerCase());
    const mt=!activeTag||p.gardenTags?.includes(activeTag);
    const mp=!activePlantType||p.plantType===activePlantType;
    return ms&&mt&&mp;
  });

  if(authLoading) return (
    <div style={{minHeight:"100vh",background:"#080f08",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:"16px"}}>
      <span style={{fontSize:"48px"}}>🌿</span>
      <Spinner/>
    </div>
  );

  if(!user) return <LoginScreen/>;

  const btnSec={padding:"9px 16px",background:"#1a2a1a",color:"#7a9e6a",border:"1px solid #2a4a2a",borderRadius:"10px",fontFamily:font.body,fontSize:"13px",cursor:"pointer",whiteSpace:"nowrap"};

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Lora:ital,wght@0,400;0,500;1,400&display=swap');*{box-sizing:border-box}body{margin:0}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#0a150a}::-webkit-scrollbar-thumb{background:#2a4a2a;border-radius:3px}@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Toast */}
      {toast&&<div style={{position:"fixed",top:"20px",left:"50%",transform:"translateX(-50%)",background:"#2d5a27",color:"#a8d5a2",padding:"10px 20px",borderRadius:"10px",fontFamily:font.body,fontSize:"14px",zIndex:2000,boxShadow:"0 4px 20px rgba(0,0,0,0.4)"}}>{toast}</div>}

      <div style={{minHeight:"100vh",background:"radial-gradient(ellipse at top left,#0f2010 0%,#080f08 50%,#050a05 100%)",color:"#c8e0b8"}}>

        {/* Header */}
        <div style={{padding:"20px 24px 0",borderBottom:"1px solid #1a2e1a",background:"linear-gradient(180deg,#0d1f0d 0%,transparent 100%)"}}>
          <div style={{maxWidth:"1100px",margin:"0 auto"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px",marginBottom:"16px",flexWrap:"wrap"}}>
              <div>
                <p style={{color:"#4a7a3a",fontFamily:font.body,fontSize:"12px",textTransform:"uppercase",letterSpacing:"0.2em",margin:"0 0 4px"}}>Mi colección</p>
                <h1 style={{margin:0,fontFamily:font.serif,fontSize:"clamp(22px,4vw,36px)",fontWeight:700,color:"#d4e8c2",lineHeight:1}}>Catálogo de Plantas 🌿</h1>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
                {/* User avatar */}
                <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  <img src={user.photoURL} style={{width:"32px",height:"32px",borderRadius:"50%",border:"1px solid #2a4a2a"}} alt={user.displayName}/>
                  <span style={{color:"#7a9e6a",fontFamily:font.body,fontSize:"13px",display:"none"}}>{user.displayName?.split(" ")[0]}</span>
                </div>
                <button onClick={()=>signOut(auth)} style={{...btnSec,color:"#c47a7a",borderColor:"#4a2a2a"}}>Salir</button>
              </div>
            </div>

            {/* Nav tabs */}
            <div style={{display:"flex",gap:"4px",marginBottom:"0"}}>
              {[["myplants","🌿 Mi biblioteca"],["community","🌍 Comunidad"]].map(([v,label])=>(
                <button key={v} onClick={()=>setView(v)} style={{padding:"10px 18px",background:view===v?"#1a2e1a":"transparent",color:view===v?"#a8d5a2":"#5a7a4a",border:"none",borderRadius:"10px 10px 0 0",fontFamily:font.body,fontSize:"14px",cursor:"pointer",borderBottom:view===v?"2px solid #4a8a3a":"2px solid transparent"}}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* My Plants View */}
        {view==="myplants"&&(
          <>
            <div style={{padding:"20px 24px 0",borderBottom:"1px solid #1a2e1a"}}>
              <div style={{maxWidth:"1100px",margin:"0 auto"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",marginBottom:"16px",flexWrap:"wrap"}}>
                  <p style={{color:"#5a8a4a",fontFamily:font.body,fontSize:"14px",margin:0}}>{plants.length} {plants.length===1?"planta registrada":"plantas registradas"}</p>
                  <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                    <button onClick={()=>setShowGlossary(true)} style={btnSec}>📖 Tipos de raíz</button>
                    <button onClick={()=>setShowTagManager(true)} style={btnSec}>🏷️ Mis etiquetas</button>
                    <button onClick={()=>{setEditingPlant(null);setShowForm(true);}} style={{padding:"9px 18px",background:"linear-gradient(135deg,#2d5a27,#3a7a30)",color:"#d4e8c2",border:"none",borderRadius:"10px",fontFamily:font.serif,fontSize:"14px",cursor:"pointer",boxShadow:"0 4px 16px rgba(60,120,50,0.3)",whiteSpace:"nowrap"}}>+ Nueva planta</button>
                  </div>
                </div>
                <div style={{position:"relative",maxWidth:"380px",marginBottom:"14px"}}>
                  <span style={{position:"absolute",left:"14px",top:"50%",transform:"translateY(-50%)",color:"#4a7a3a"}}>🔍</span>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre..." style={{width:"100%",padding:"9px 14px 9px 40px",background:"#0e1d0e",border:"1px solid #2a4a2a",borderRadius:"10px",color:"#c8e0b8",fontFamily:font.body,fontSize:"14px",outline:"none"}}/>
                </div>
                {usedTypes.length>0&&<div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"10px"}}>
                  <span onClick={()=>setActivePlantType(null)} style={{display:"inline-flex",alignItems:"center",gap:"5px",padding:"4px 14px",borderRadius:"999px",fontSize:"12px",fontFamily:font.body,cursor:"pointer",background:!activePlantType?"#1e2a40":"#0e1d0e",color:!activePlantType?"#90b8e0":"#5a7a8a",border:!activePlantType?"1px solid #4a7ab0":"1px solid #2a3a4a",userSelect:"none"}}>Todos</span>
                  {PLANT_TYPES.filter(pt=>usedTypes.includes(pt.value)).map(pt=>(
                    <span key={pt.value} onClick={()=>setActivePlantType(activePlantType===pt.value?null:pt.value)} style={{display:"inline-flex",alignItems:"center",gap:"5px",padding:"4px 14px",borderRadius:"999px",fontSize:"12px",fontFamily:font.body,cursor:"pointer",background:activePlantType===pt.value?"#1e2a40":"#0e1d0e",color:activePlantType===pt.value?"#90b8e0":"#5a7a8a",border:activePlantType===pt.value?"1px solid #4a7ab0":"1px solid #2a3a4a",userSelect:"none"}}>{pt.emoji} {pt.label}</span>
                  ))}
                </div>}
                {usedTags.length>0&&<div style={{display:"flex",gap:"6px",flexWrap:"wrap",paddingBottom:"16px"}}>
                  <TagChip label="Todas" active={!activeTag} onClick={()=>setActiveTag(null)}/>
                  {usedTags.map(tag=><TagChip key={tag} label={tag} active={activeTag===tag} onClick={()=>setActiveTag(activeTag===tag?null:tag)}/>)}
                </div>}
              </div>
            </div>
            <div style={{maxWidth:"1100px",margin:"0 auto",padding:"24px"}}>
              {filtered.length===0?(
                <div style={{textAlign:"center",padding:"80px 20px"}}>
                  <div style={{fontSize:"60px",opacity:0.25,marginBottom:"16px"}}>🌱</div>
                  <p style={{color:"#4a7a3a",fontFamily:font.serif,fontSize:"20px"}}>{plants.length===0?"Tu catálogo está vacío":"No se encontraron plantas"}</p>
                  <p style={{color:"#3a5a3a",fontFamily:font.body,fontSize:"14px"}}>{plants.length===0?"Agrega tu primera planta para comenzar":"Intenta con otro nombre o filtro"}</p>
                </div>
              ):(
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"14px"}}>
                  {filtered.map(plant=><PlantCard key={plant.id} plant={plant} onClick={setSelectedPlant} isOwn={true}/>)}
                </div>
              )}
            </div>
          </>
        )}

        {/* Community View */}
        {view==="community"&&<CommunityView currentUser={user} onCopy={handleCopy}/>}
      </div>

      {selectedPlant&&<DetailModal plant={selectedPlant} onClose={()=>setSelectedPlant(null)} onEdit={p=>{setEditingPlant(p);setSelectedPlant(null);setShowForm(true);}} onDelete={handleDelete} onCopy={handleCopy} isOwn={selectedPlant.userId===user.uid}/>}
      {showForm&&<PlantForm initial={editingPlant} allTags={customTags} onSave={handleSave} onCancel={()=>{setShowForm(false);setEditingPlant(null);}}/>}
      {showGlossary&&<GlossaryPanel onClose={()=>setShowGlossary(false)}/>}
      {showTagManager&&<ManageTagsPanel tags={customTags} onSave={handleSaveTags} onClose={()=>setShowTagManager(false)}/>}
    </>
  );
}
