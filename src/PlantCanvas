import { useState, useRef, useCallback, useEffect } from "react";

// ── Theme (mismo que App.jsx) ──────────────────────────
const C = {
  bg:        "#f5f0e8",
  bgCard:    "#ffffff",
  bgDeep:    "#3a5c28",
  bgPanel:   "#4a7235",
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
};
const font = { serif:"'Playfair Display', serif", body:"'Lora', serif" };

// ── Helpers ────────────────────────────────────────────
const CELL_M = 1;      // each grid cell = 1 metre
const PX_PER_M = 40;   // pixels per metre at zoom=1

function getPlantVisuals(plant) {
  const heightMid = plant.heightMax
    ? (parseFloat(plant.heightMin||0) + parseFloat(plant.heightMax)) / 2
    : parseFloat(plant.heightMin||0) || 3;
  const canopyR = plant.canopySize
    ? parseFloat(plant.canopySize) / 2
    : Math.max(0.5, heightMid * 0.4);
  const rootR = canopyR * (plant.rootGrowth === "horizontal" ? 1.2 : plant.rootGrowth === "vertical" ? 0.5 : 0.8);
  return { heightMid, canopyR, rootR };
}

// Canopy shape for plan view (SVG circle/ellipse/etc)
function CanopyPlanSVG({ plant, r, selected }) {
  const type = plant.canopyType || "Globosa";
  const col = selected ? C.green : C.greenPale;
  const stroke = selected ? C.greenText : C.green;
  const sw = selected ? 2 : 1;

  if (type === "Columnar") {
    return <ellipse cx={r} cy={r} rx={r * 0.45} ry={r * 0.7} fill={col} stroke={stroke} strokeWidth={sw} opacity={0.85}/>;
  }
  if (type === "Piramidal") {
    return <ellipse cx={r} cy={r} rx={r * 0.6} ry={r * 0.6} fill={col} stroke={stroke} strokeWidth={sw} opacity={0.85}/>;
  }
  if (type === "Aparasolada") {
    return (
      <>
        <ellipse cx={r} cy={r} rx={r * 0.95} ry={r * 0.55} fill={col} stroke={stroke} strokeWidth={sw} opacity={0.85}/>
        <ellipse cx={r} cy={r} rx={r * 0.4} ry={r * 0.25} fill="none" stroke={stroke} strokeWidth={0.5} opacity={0.4}/>
      </>
    );
  }
  if (type === "Irregular") {
    return (
      <path
        d={`M${r},${r*0.15} Q${r*1.7},${r*0.3} ${r*1.8},${r} Q${r*1.6},${r*1.7} ${r},${r*1.85} Q${r*0.2},${r*1.6} ${r*0.15},${r} Q${r*0.3},${r*0.3} ${r},${r*0.15}Z`}
        fill={col} stroke={stroke} strokeWidth={sw} opacity={0.85}
      />
    );
  }
  // Globosa default
  return <circle cx={r} cy={r} r={r * 0.88} fill={col} stroke={stroke} strokeWidth={sw} opacity={0.85}/>;
}

// Isometric projection helpers
// Isometric: x' = (x - y) * cos30, y' = (x + y) * sin30 - z
const ISO_COS = Math.cos(Math.PI / 6);
const ISO_SIN = Math.sin(Math.PI / 6);
function toIso(x, y, z = 0) {
  return {
    ix: (x - y) * ISO_COS,
    iy: (x + y) * ISO_SIN - z,
  };
}

// Draw one plant in isometric SVG
function PlantIsoSVG({ plant, px, py, pxPerM, selected }) {
  const { heightMid, canopyR } = getPlantVisuals(plant);
  const h = heightMid * pxPerM;
  const cr = canopyR * pxPerM;
  const type = plant.canopyType || "Globosa";

  // trunk base in iso
  const base = toIso(px / pxPerM, py / pxPerM, 0);
  const top  = toIso(px / pxPerM, py / pxPerM, heightMid);

  const bx = base.ix * pxPerM;
  const by = base.iy * pxPerM;
  const tx = top.ix * pxPerM;
  const ty = top.iy * pxPerM;

  const trunkW = Math.max(3, cr * 0.12);
  const green = selected ? C.greenText : C.green;
  const canopyFill = selected ? C.greenPale : "#c8e0a8";
  const canopyStroke = green;

  // Canopy shape in iso
  let canopyShape;
  if (type === "Columnar") {
    const w = cr * 0.5;
    const ht = h * 0.7;
    canopyShape = <ellipse cx={tx} cy={ty} rx={w} ry={ht * 0.25} fill={canopyFill} stroke={canopyStroke} strokeWidth={selected?2:1}/>;
  } else if (type === "Piramidal") {
    canopyShape = (
      <polygon
        points={`${tx},${ty - h * 0.55} ${tx - cr * 0.7},${ty + cr * 0.3} ${tx + cr * 0.7},${ty + cr * 0.3}`}
        fill={canopyFill} stroke={canopyStroke} strokeWidth={selected?2:1}
      />
    );
  } else if (type === "Aparasolada") {
    canopyShape = <ellipse cx={tx} cy={ty} rx={cr * 0.95} ry={cr * 0.35} fill={canopyFill} stroke={canopyStroke} strokeWidth={selected?2:1}/>;
  } else if (type === "Irregular") {
    canopyShape = (
      <ellipse cx={tx} cy={ty - cr * 0.1} rx={cr * 0.85} ry={cr * 0.55}
        fill={canopyFill} stroke={canopyStroke} strokeWidth={selected?2:1}
        style={{filter:"url(#noise)"}}
      />
    );
  } else {
    // Globosa
    canopyShape = <ellipse cx={tx} cy={ty - cr * 0.1} rx={cr * 0.78} ry={cr * 0.55} fill={canopyFill} stroke={canopyStroke} strokeWidth={selected?2:1}/>;
  }

  return (
    <g>
      {/* trunk */}
      <line x1={bx} y1={by} x2={tx} y2={ty} stroke="#8a6a40" strokeWidth={trunkW} strokeLinecap="round"/>
      {/* canopy */}
      {canopyShape}
      {selected && <ellipse cx={tx} cy={ty} rx={cr * 0.82} ry={cr * 0.55} fill="none" stroke={C.green} strokeWidth={2} strokeDasharray="4 3" opacity={0.6}/>}
    </g>
  );
}

// ── Main Component ─────────────────────────────────────
export default function PlantCanvas({ project, plants, onClose }) {
  // plants = only plants belonging to this project
  const projPlants = plants.filter(p => (project.plantIds || []).includes(p.id));

  const [view, setView] = useState("plan"); // "plan" | "iso"
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [placed, setPlaced] = useState([]); // { id, plantId, x, y (in metres) }
  const [selected, setSelected] = useState(null); // placed item id
  const [dragging, setDragging] = useState(null); // { id, offsetX, offsetY }
  const [draggingFromPanel, setDraggingFromPanel] = useState(null); // plantId being dragged from panel

  const canvasRef = useRef();
  const idCounter = useRef(1);

  const CANVAS_W = 800;
  const CANVAS_H = 560;
  const GRID_COLS = 20;
  const GRID_ROWS = 14;

  // ── Pan with middle-mouse / space+drag
  const panning = useRef(false);
  const panStart = useRef(null);

  // ── Drop from panel onto canvas
  const handleCanvasDrop = useCallback(e => {
    e.preventDefault();
    const plantId = e.dataTransfer.getData("plantId");
    if (!plantId) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = (e.clientX - rect.left - pan.x) / (PX_PER_M * zoom);
    const cy = (e.clientY - rect.top  - pan.y) / (PX_PER_M * zoom);
    setPlaced(prev => [...prev, { id: idCounter.current++, plantId, x: cx, y: cy }]);
  }, [pan, zoom]);

  const handleCanvasDragOver = e => e.preventDefault();

  // ── Drag existing placed plant
  const startDragPlaced = (e, item) => {
    e.stopPropagation();
    setSelected(item.id);
    const rect = canvasRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - pan.x - item.x * PX_PER_M * zoom;
    const offsetY = e.clientY - rect.top  - pan.y - item.y * PX_PER_M * zoom;
    setDragging({ id: item.id, offsetX, offsetY });
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = e => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const nx = (e.clientX - rect.left - pan.x - dragging.offsetX) / (PX_PER_M * zoom);
      const ny = (e.clientY - rect.top  - pan.y - dragging.offsetY) / (PX_PER_M * zoom);
      setPlaced(prev => prev.map(p => p.id === dragging.id ? { ...p, x: nx, y: ny } : p));
    };
    const onUp = () => setDragging(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging, pan, zoom]);

  // ── Delete selected
  const deleteSelected = () => {
    setPlaced(prev => prev.filter(p => p.id !== selected));
    setSelected(null);
  };

  // ── Export as PNG
  const exportPNG = () => {
    const svg = canvasRef.current.querySelector("svg.canvas-svg");
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name || "plano"}-${view}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Grid lines
  const gridLines = [];
  for (let c = 0; c <= GRID_COLS; c++) {
    const x = c * PX_PER_M;
    gridLines.push(<line key={`v${c}`} x1={x} y1={0} x2={x} y2={GRID_ROWS * PX_PER_M} stroke={C.border} strokeWidth={c % 5 === 0 ? 0.8 : 0.35} opacity={c % 5 === 0 ? 0.6 : 0.35}/>);
    if (c % 5 === 0 && c > 0) gridLines.push(<text key={`vl${c}`} x={x} y={-4} fill={C.textLight} fontSize={8} fontFamily={font.body} textAnchor="middle">{c}m</text>);
  }
  for (let r = 0; r <= GRID_ROWS; r++) {
    const y = r * PX_PER_M;
    gridLines.push(<line key={`h${r}`} x1={0} y1={y} x2={GRID_COLS * PX_PER_M} y2={y} stroke={C.border} strokeWidth={r % 5 === 0 ? 0.8 : 0.35} opacity={r % 5 === 0 ? 0.6 : 0.35}/>);
    if (r % 5 === 0 && r > 0) gridLines.push(<text key={`hl${r}`} x={-5} y={y + 3} fill={C.textLight} fontSize={8} fontFamily={font.body} textAnchor="end">{r}m</text>);
  }

  const plantMap = {};
  projPlants.forEach(p => { plantMap[p.id] = p; });

  // ── Plan View render
  const planItems = placed.map(item => {
    const plant = plantMap[item.plantId];
    if (!plant) return null;
    const { canopyR, rootR } = getPlantVisuals(plant);
    const px = item.x * PX_PER_M;
    const py = item.y * PX_PER_M;
    const cr = canopyR * PX_PER_M;
    const rr = rootR * PX_PER_M;
    const isSelected = selected === item.id;
    return (
      <g key={item.id}
        style={{ cursor: dragging?.id === item.id ? "grabbing" : "grab" }}
        onMouseDown={e => startDragPlaced(e, item)}
        onClick={e => { e.stopPropagation(); setSelected(item.id); }}>
        {/* Root spread (dashed) */}
        <circle cx={px} cy={py} r={rr} fill="none" stroke="#8a6a40" strokeWidth={0.8} strokeDasharray="3 3" opacity={0.4}/>
        {/* Canopy SVG */}
        <svg x={px - cr} y={py - cr} width={cr * 2} height={cr * 2} overflow="visible">
          <CanopyPlanSVG plant={plant} r={cr} selected={isSelected}/>
        </svg>
        {/* Center dot */}
        <circle cx={px} cy={py} r={3} fill={isSelected ? C.green : C.borderMid}/>
        {/* Label */}
        <text x={px} y={py + cr + 10} textAnchor="middle" fill={isSelected ? C.greenText : C.textMid} fontSize={9} fontFamily={font.body}>{plant.commonName}</text>
        {isSelected && <circle cx={px} cy={py} r={cr + 4} fill="none" stroke={C.green} strokeWidth={1.5} strokeDasharray="5 3" opacity={0.7}/>}
      </g>
    );
  });

  // ── Iso View
  // Determine iso canvas centre
  const ISO_SCALE = PX_PER_M * zoom * 0.6;
  const isoOffX = CANVAS_W / 2;
  const isoOffY = CANVAS_H * 0.7;

  const isoGrid = [];
  const gsize = 10;
  for (let c = 0; c <= gsize; c++) {
    for (let r = 0; r <= gsize; r++) {
      if (c < gsize && r < gsize) {
        const a = toIso(c * 2, r * 2, 0);
        const b = toIso((c+1) * 2, r * 2, 0);
        const d = toIso(c * 2, (r+1) * 2, 0);
        isoGrid.push(
          <polygon key={`t${c}-${r}`}
            points={`${a.ix*ISO_SCALE+isoOffX},${a.iy*ISO_SCALE+isoOffY} ${b.ix*ISO_SCALE+isoOffX},${b.iy*ISO_SCALE+isoOffY} ${toIso((c+1)*2,(r+1)*2,0).ix*ISO_SCALE+isoOffX},${toIso((c+1)*2,(r+1)*2,0).iy*ISO_SCALE+isoOffY} ${d.ix*ISO_SCALE+isoOffX},${d.iy*ISO_SCALE+isoOffY}`}
            fill={C.bg} stroke={C.border} strokeWidth={0.4} opacity={0.7}
          />
        );
      }
    }
  }

  // Sort iso plants by y+x for painter's algorithm
  const isoPlants = [...placed]
    .filter(item => plantMap[item.plantId])
    .sort((a, b) => (a.x + a.y) - (b.x + b.y))
    .map(item => {
      const plant = plantMap[item.plantId];
      const iso = toIso(item.x, item.y, 0);
      const px = iso.ix * ISO_SCALE + isoOffX;
      const py = iso.iy * ISO_SCALE + isoOffY;
      return (
        <PlantIsoSVG key={item.id} plant={plant}
          px={px - isoOffX} py={py - isoOffY}
          pxPerM={ISO_SCALE / 2}
          selected={selected === item.id}
        />
      );
    });

  // ── Labels for iso grid
  const isoLabels = [];
  for (let c = 0; c <= gsize; c += 5) {
    const pt = toIso(c * 2, 0, 0);
    isoLabels.push(<text key={`ilc${c}`} x={pt.ix * ISO_SCALE + isoOffX} y={pt.iy * ISO_SCALE + isoOffY + 12} fill={C.textLight} fontSize={8} fontFamily={font.body} textAnchor="middle">{c * 2}m</text>);
  }

  const selectedPlantItem = placed.find(p => p.id === selected);
  const selectedPlant = selectedPlantItem ? plantMap[selectedPlantItem.plantId] : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(44,48,32,0.65)", backdropFilter: "blur(6px)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: "12px" }}>
      <div style={{ background: C.bgCard, borderRadius: "20px", border: `0.5px solid ${C.border}`, width: "100%", maxWidth: "1120px", height: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.18)", overflow: "hidden" }}>

        {/* ── Header ── */}
        <div style={{ background: C.bgDeep, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ color: C.greenLight, fontFamily: font.body, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.15em" }}>Canvas</span>
            <span style={{ color: "#8a9a72", fontFamily: font.body, fontSize: "11px" }}>·</span>
            <span style={{ color: "#d4e8c2", fontFamily: font.serif, fontSize: "16px" }}>{project.name}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* View toggle */}
            <div style={{ display: "flex", background: "rgba(255,255,255,0.08)", borderRadius: "8px", padding: "3px", gap: "2px" }}>
              {[["plan", "📐 Plano"], ["iso", "🏔️ Isométrica"]].map(([v, l]) => (
                <button key={v} onClick={() => setView(v)} style={{ padding: "5px 12px", background: view === v ? "rgba(255,255,255,0.15)" : "transparent", color: view === v ? "#d4e8c2" : "#7aaa50", border: "none", borderRadius: "6px", fontFamily: font.body, fontSize: "12px", cursor: "pointer" }}>{l}</button>
              ))}
            </div>
            {/* Zoom */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "8px", padding: "4px 10px" }}>
              <button onClick={() => setZoom(z => Math.max(0.4, z - 0.1))} style={{ background: "none", border: "none", color: "#7aaa50", cursor: "pointer", fontSize: "14px", padding: "0 4px" }}>−</button>
              <span style={{ color: "#a8c898", fontFamily: font.body, fontSize: "11px", minWidth: "34px", textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(2.5, z + 0.1))} style={{ background: "none", border: "none", color: "#7aaa50", cursor: "pointer", fontSize: "14px", padding: "0 4px" }}>+</button>
            </div>
            <button onClick={exportPNG} style={{ padding: "6px 12px", background: "transparent", color: "#7aaa50", border: `0.5px solid rgba(122,170,80,0.4)`, borderRadius: "8px", fontFamily: font.body, fontSize: "12px", cursor: "pointer" }}>⬇ Exportar SVG</button>
            <button onClick={onClose} style={{ padding: "6px 14px", background: "rgba(255,255,255,0.08)", color: "#a8c898", border: `0.5px solid rgba(255,255,255,0.1)`, borderRadius: "8px", fontFamily: font.body, fontSize: "12px", cursor: "pointer" }}>Cerrar</button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* ── Left panel: plantas del proyecto ── */}
          <div style={{ width: "180px", flexShrink: 0, borderRight: `0.5px solid ${C.border}`, background: C.bg, overflowY: "auto", padding: "14px 10px" }}>
            <p style={{ color: C.textLight, fontFamily: font.body, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 10px 2px" }}>Plantas del proyecto</p>
            {projPlants.length === 0 && (
              <p style={{ color: C.textLight, fontFamily: font.body, fontSize: "12px", textAlign: "center", padding: "20px 8px", lineHeight: 1.5 }}>Este proyecto no tiene plantas asignadas</p>
            )}
            {projPlants.map(plant => (
              <div key={plant.id}
                draggable
                onDragStart={e => { e.dataTransfer.setData("plantId", plant.id); setDraggingFromPanel(plant.id); }}
                onDragEnd={() => setDraggingFromPanel(null)}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px", borderRadius: "10px", marginBottom: "6px", background: draggingFromPanel === plant.id ? C.greenPale : "#fff", border: draggingFromPanel === plant.id ? `1px solid ${C.green}` : `0.5px solid ${C.border}`, cursor: "grab", transition: "all 0.15s", userSelect: "none" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "8px", overflow: "hidden", background: C.greenPale, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {plant.photo ? <img src={plant.photo} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={plant.commonName}/> : <span style={{ fontSize: "18px", opacity: 0.4 }}>🌿</span>}
                </div>
                <div style={{ overflow: "hidden" }}>
                  <p style={{ margin: 0, color: C.text, fontFamily: font.body, fontSize: "11px", fontWeight: 500, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{plant.commonName || "Sin nombre"}</p>
                  {plant.heightMax && <p style={{ margin: 0, color: C.textLight, fontFamily: font.body, fontSize: "10px" }}>{plant.heightMin}–{plant.heightMax}m</p>}
                </div>
              </div>
            ))}
            <div style={{ marginTop: "10px", padding: "8px", background: C.greenPale, borderRadius: "8px", border: `0.5px solid ${C.green}` }}>
              <p style={{ margin: 0, color: C.greenText, fontFamily: font.body, fontSize: "10px", lineHeight: 1.5 }}>Arrastra las plantas al canvas para posicionarlas</p>
            </div>
          </div>

          {/* ── Canvas area ── */}
          <div ref={canvasRef} style={{ flex: 1, overflow: "hidden", position: "relative", background: "#faf7f2", cursor: dragging ? "grabbing" : "default" }}
            onDrop={view === "plan" ? handleCanvasDrop : undefined}
            onDragOver={view === "plan" ? handleCanvasDragOver : undefined}
            onClick={() => setSelected(null)}>

            {view === "plan" && (
              <svg className="canvas-svg" width="100%" height="100%" style={{ display: "block" }}>
                <defs>
                  <pattern id="grid" width={PX_PER_M * zoom} height={PX_PER_M * zoom} patternUnits="userSpaceOnUse" x={pan.x} y={pan.y}>
                    <path d={`M ${PX_PER_M * zoom} 0 L 0 0 0 ${PX_PER_M * zoom}`} fill="none" stroke={C.border} strokeWidth={0.4} opacity={0.5}/>
                  </pattern>
                  <pattern id="grid5" width={PX_PER_M * zoom * 5} height={PX_PER_M * zoom * 5} patternUnits="userSpaceOnUse" x={pan.x} y={pan.y}>
                    <rect width={PX_PER_M * zoom * 5} height={PX_PER_M * zoom * 5} fill="url(#grid)" />
                    <path d={`M ${PX_PER_M * zoom * 5} 0 L 0 0 0 ${PX_PER_M * zoom * 5}`} fill="none" stroke={C.borderMid} strokeWidth={0.8} opacity={0.5}/>
                  </pattern>
                </defs>
                {/* grid bg */}
                <rect width="100%" height="100%" fill="url(#grid5)"/>

                {/* scale labels */}
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                  {Array.from({ length: 21 }, (_, i) => i).filter(i => i % 5 === 0).map(i => (
                    <g key={i}>
                      <text x={i * PX_PER_M} y={-8} fill={C.textLight} fontSize={9 / zoom} fontFamily={font.body} textAnchor="middle">{i}m</text>
                      <text x={-14} y={i * PX_PER_M + 4} fill={C.textLight} fontSize={9 / zoom} fontFamily={font.body} textAnchor="end">{i}m</text>
                    </g>
                  ))}
                </g>

                {/* Plants in plan */}
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                  {planItems}
                </g>
              </svg>
            )}

            {view === "iso" && (
              <svg className="canvas-svg" width="100%" height="100%" style={{ display: "block" }}>
                <defs>
                  <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feBlend in="SourceGraphic" mode="multiply" result="blend"/></filter>
                </defs>
                <rect width="100%" height="100%" fill="#faf7f2"/>
                {/* iso grid tiles */}
                <g transform={`translate(0, 0) scale(${zoom})`} style={{ transformOrigin: "50% 70%" }}>
                  {isoGrid}
                  {isoLabels}
                  {/* iso plants */}
                  {isoPlants}
                </g>
              </svg>
            )}

            {/* Empty state */}
            {placed.length === 0 && view === "plan" && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <div style={{ textAlign: "center", opacity: 0.4 }}>
                  <div style={{ fontSize: "40px", marginBottom: "8px" }}>🌱</div>
                  <p style={{ color: C.textMid, fontFamily: font.body, fontSize: "13px" }}>Arrastra plantas desde el panel izquierdo</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Right panel: selected plant info ── */}
          <div style={{ width: "200px", flexShrink: 0, borderLeft: `0.5px solid ${C.border}`, background: C.bg, padding: "14px 12px", overflowY: "auto" }}>
            <p style={{ color: C.textLight, fontFamily: font.body, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 10px" }}>Selección</p>
            {!selectedPlant ? (
              <p style={{ color: C.textLight, fontFamily: font.body, fontSize: "12px", lineHeight: 1.6, marginTop: "8px" }}>Haz clic en una planta para ver sus datos</p>
            ) : (
              <div>
                {selectedPlant.photo && <img src={selectedPlant.photo} style={{ width: "100%", height: "100px", objectFit: "cover", borderRadius: "10px", marginBottom: "10px", border: `0.5px solid ${C.border}` }} alt={selectedPlant.commonName}/>}
                <p style={{ margin: "0 0 2px", color: C.text, fontFamily: font.serif, fontSize: "14px", fontWeight: 600 }}>{selectedPlant.commonName}</p>
                {selectedPlant.scientificName && <p style={{ margin: "0 0 10px", color: C.textLight, fontFamily: font.body, fontSize: "11px", fontStyle: "italic" }}>{selectedPlant.scientificName}</p>}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {(selectedPlant.heightMin || selectedPlant.heightMax) && (
                    <div style={{ background: "#fff", border: `0.5px solid ${C.border}`, borderRadius: "8px", padding: "7px 10px" }}>
                      <p style={{ margin: 0, color: C.textLight, fontFamily: font.body, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Altura</p>
                      <p style={{ margin: "2px 0 0", color: C.text, fontFamily: font.serif, fontSize: "13px" }}>{selectedPlant.heightMin && selectedPlant.heightMax ? `${selectedPlant.heightMin}–${selectedPlant.heightMax} m` : `${selectedPlant.heightMin || selectedPlant.heightMax} m`}</p>
                    </div>
                  )}
                  {selectedPlant.canopySize && (
                    <div style={{ background: "#fff", border: `0.5px solid ${C.border}`, borderRadius: "8px", padding: "7px 10px" }}>
                      <p style={{ margin: 0, color: C.textLight, fontFamily: font.body, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Copa</p>
                      <p style={{ margin: "2px 0 0", color: C.text, fontFamily: font.serif, fontSize: "13px" }}>{selectedPlant.canopySize} m</p>
                    </div>
                  )}
                  {selectedPlant.canopyType && (
                    <div style={{ background: "#fff", border: `0.5px solid ${C.border}`, borderRadius: "8px", padding: "7px 10px" }}>
                      <p style={{ margin: 0, color: C.textLight, fontFamily: font.body, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Forma de copa</p>
                      <p style={{ margin: "2px 0 0", color: C.text, fontFamily: font.body, fontSize: "12px" }}>{selectedPlant.canopyType}</p>
                    </div>
                  )}
                  {selectedPlant.light && (
                    <div style={{ background: "#fff", border: `0.5px solid ${C.border}`, borderRadius: "8px", padding: "7px 10px" }}>
                      <p style={{ margin: 0, color: C.textLight, fontFamily: font.body, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Luz</p>
                      <p style={{ margin: "2px 0 0", color: C.text, fontFamily: font.body, fontSize: "12px" }}>{selectedPlant.light}</p>
                    </div>
                  )}
                </div>
                <button onClick={deleteSelected} style={{ marginTop: "12px", width: "100%", padding: "7px", background: "#f8ece8", color: "#a05050", border: `0.5px solid #d4b8b8`, borderRadius: "8px", fontFamily: font.body, fontSize: "12px", cursor: "pointer" }}>🗑 Eliminar del plano</button>
              </div>
            )}

            {/* Legend */}
            <div style={{ marginTop: "24px", paddingTop: "14px", borderTop: `0.5px solid ${C.border}` }}>
              <p style={{ color: C.textLight, fontFamily: font.body, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 8px" }}>Referencia</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="18" height="18"><circle cx="9" cy="9" r="7" fill={C.greenPale} stroke={C.green} strokeWidth="1"/></svg>
                  <span style={{ color: C.textMid, fontFamily: font.body, fontSize: "11px" }}>Copa</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="18" height="18"><circle cx="9" cy="9" r="7" fill="none" stroke="#8a6a40" strokeWidth="1" strokeDasharray="2 2"/></svg>
                  <span style={{ color: C.textMid, fontFamily: font.body, fontSize: "11px" }}>Raíces</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="18" height="18"><circle cx="9" cy="9" r="3" fill={C.borderMid}/></svg>
                  <span style={{ color: C.textMid, fontFamily: font.body, fontSize: "11px" }}>Tronco</span>
                </div>
              </div>
            </div>

            {placed.length > 0 && (
              <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: `0.5px solid ${C.border}` }}>
                <p style={{ color: C.textLight, fontFamily: font.body, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 6px" }}>En el plano</p>
                <p style={{ color: C.text, fontFamily: font.serif, fontSize: "18px", margin: 0 }}>{placed.length}</p>
                <p style={{ color: C.textLight, fontFamily: font.body, fontSize: "11px", margin: "0" }}>instancias</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
