import { useState, useMemo, useRef, useCallback, useEffect } from "react";

const fmt    = (n) => `${Number(n).toLocaleString("fr-MA")} MAD`;
const uid    = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const MOIS   = ["Janvier","Fevrier","Mars","Avril","Mai","Juin","Juillet","Aout","Septembre","Octobre","Novembre","Decembre"];
const MOIS_FR= ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const now    = new Date();

const INIT_MENUS = [
  { id:"m1", nom:"Thiéboudienne", prix:45, cout:20, emoji:"🍛" },
  { id:"m2", nom:"Yassa Poulet",  prix:35, cout:15, emoji:"🍗" },
  { id:"m3", nom:"Mafé",          prix:40, cout:18, emoji:"🥘" },
];

// ── PDF Facture ───────────────────────────────────────────────────────────────
async function genererPDF(abonne, cmdMois, moisBilan, anneeBilan) {
  if (!window.jspdf) {
    await new Promise((res,rej)=>{
      const s=document.createElement("script");
      s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.onload=res; s.onerror=rej; document.head.appendChild(s);
    });
  }
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
  const W=210, PL=20, PR=20, CW=W-PL-PR;
  let y=0;
  const checkY=(n=10)=>{ if(y+n>272){doc.addPage();y=24;} };

  // ── Numéro de facture unique
  const numFacture=`RG-${anneeBilan}${String(moisBilan+1).padStart(2,"0")}-${Math.floor(Math.random()*9000+1000)}`;
  const dateGen=new Date().toLocaleDateString("fr-FR");

  // ══ HEADER ══
  // Fond vert haut
  doc.setFillColor(22,163,74);
  doc.rect(0,0,W,50,"F");

  // Nom restaurant
  doc.setTextColor(255,255,255);
  doc.setFont("helvetica","bold");
  doc.setFontSize(26);
  doc.text("ROZIE GOURMET",PL,22);

  // Sous-titre
  doc.setFontSize(10);
  doc.setFont("helvetica","normal");
  doc.setTextColor(187,247,208);
  doc.text("Service de restauration - Livraison WhatsApp",PL,30);

  // Badge FACTURE à droite
  doc.setFillColor(255,255,255);
  doc.roundedRect(W-PR-42,8,42,20,3,3,"F");
  doc.setTextColor(22,163,74);
  doc.setFont("helvetica","bold");
  doc.setFontSize(13);
  doc.text("FACTURE",W-PR-21,17,{align:"center"});
  doc.setFontSize(8);
  doc.setFont("helvetica","normal");
  doc.setTextColor(71,85,105);
  doc.text(numFacture,W-PR-21,23,{align:"center"});

  y=58;

  // ══ BLOC INFOS : Émetteur | Client ══
  // Colonne gauche - Rozie Gourmet
  doc.setFillColor(248,250,252);
  doc.roundedRect(PL,y,CW/2-4,36,3,3,"F");
  doc.setTextColor(100,116,139);
  doc.setFont("helvetica","normal");
  doc.setFontSize(7.5);
  doc.text("DE",PL+4,y+7);
  doc.setTextColor(30,41,59);
  doc.setFont("helvetica","bold");
  doc.setFontSize(10);
  doc.text("Rozie Gourmet",PL+4,y+14);
  doc.setFont("helvetica","normal");
  doc.setFontSize(8);
  doc.setTextColor(71,85,105);
  doc.text("Restauration & Livraison",PL+4,y+21);
  doc.text("WhatsApp Business",PL+4,y+27);
  doc.text(`Date : ${dateGen}`,PL+4,y+33);

  // Colonne droite - Client
  const cx=PL+CW/2+4;
  doc.setFillColor(240,253,244);
  doc.roundedRect(cx,y,CW/2-4,36,3,3,"F");
  doc.setTextColor(100,116,139);
  doc.setFont("helvetica","normal");
  doc.setFontSize(7.5);
  doc.text("FACTURÉ À",cx+4,y+7);
  doc.setTextColor(22,101,52);
  doc.setFont("helvetica","bold");
  doc.setFontSize(10);
  doc.text(abonne.nom,cx+4,y+14);
  doc.setFont("helvetica","normal");
  doc.setFontSize(8);
  doc.setTextColor(71,85,105);
  if(abonne.phone) doc.text(`Tel : ${abonne.phone}`,cx+4,y+21);
  doc.text(`Abonne depuis : ${abonne.dateDebut}`,cx+4,y+(abonne.phone?27:21));
  doc.text(`Periode : ${MOIS_FR[moisBilan]} ${anneeBilan}`,cx+4,y+(abonne.phone?33:27));

  y+=44;

  // ══ TABLEAU DES PLATS ══
  // Titre section
  doc.setTextColor(30,41,59);
  doc.setFont("helvetica","bold");
  doc.setFontSize(10);
  doc.text("DETAIL DES COMMANDES",PL,y); y+=6;

  const totalPlats   = cmdMois.reduce((s,o)=>s+o.qte,0);
  const totalMontant = cmdMois.reduce((s,o)=>s+o.prix*o.qte,0);
  const totalPaye    = cmdMois.filter(o=>o.paid).reduce((s,o)=>s+o.prix*o.qte,0);
  const totalDu      = cmdMois.filter(o=>!o.paid).reduce((s,o)=>s+o.prix*o.qte,0);

  if(cmdMois.length===0){
    doc.setFillColor(248,250,252);
    doc.roundedRect(PL,y,CW,16,3,3,"F");
    doc.setFont("helvetica","italic"); doc.setFontSize(9); doc.setTextColor(148,163,184);
    doc.text("Aucune commande ce mois.",W/2,y+9,{align:"center"}); y+=22;
  } else {
    // Agregation par plat
    const byPlat={};
    cmdMois.forEach(o=>{
      if(!byPlat[o.menuNom]) byPlat[o.menuNom]={nom:o.menuNom,prix:o.prix,qte:0,montant:0};
      byPlat[o.menuNom].qte+=o.qte;
      byPlat[o.menuNom].montant+=o.prix*o.qte;
    });
    const lignes=Object.values(byPlat);

    // Header tableau
    const TH=9;
    doc.setFillColor(22,163,74);
    doc.roundedRect(PL,y,CW,TH,2,2,"F");
    doc.setTextColor(255,255,255);
    doc.setFont("helvetica","bold");
    doc.setFontSize(8);
    // Colonnes : Désignation | Qté | Prix unit. | Total
    doc.text("DESIGNATION",PL+4,y+6);
    doc.text("QTE",PL+110,y+6,{align:"center"});
    doc.text("PRIX UNIT.",PL+138,y+6,{align:"center"});
    doc.text("MONTANT",PL+CW-2,y+6,{align:"right"});
    y+=TH;

    lignes.forEach((l,i)=>{
      checkY(10);
      const TR=10;
      doc.setFillColor(i%2===0?248:255,i%2===0?250:255,i%2===0?252:255);
      doc.rect(PL,y,CW,TR,"F");
      // Séparateur bas
      doc.setDrawColor(226,232,240);
      doc.line(PL,y+TR,PL+CW,y+TR);
      doc.setTextColor(30,41,59);
      doc.setFont("helvetica","normal");
      doc.setFontSize(9);
      doc.text(l.nom,PL+4,y+6.5);
      doc.text(`${l.qte}`,PL+110,y+6.5,{align:"center"});
      doc.text(`${l.prix} MAD`,PL+138,y+6.5,{align:"center"});
      doc.setFont("helvetica","bold");
      doc.setTextColor(22,101,52);
      doc.text(`${l.montant} MAD`,PL+CW-2,y+6.5,{align:"right"});
      y+=TR;
    });

    y+=4;

    // ══ RECAP FINANCIER ══
    const recapX=PL+CW/2;
    const recapW=CW/2;

    // Ligne sous-total
    checkY(10);
    doc.setFillColor(248,250,252);
    doc.rect(recapX,y,recapW,9,"F");
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(71,85,105);
    doc.text("Sous-total",recapX+4,y+6);
    doc.setFont("helvetica","bold"); doc.setTextColor(30,41,59);
    doc.text(`${totalMontant} MAD`,recapX+recapW-4,y+6,{align:"right"}); y+=9;

    // Ligne plats
    checkY(9);
    doc.setFillColor(255,255,255);
    doc.rect(recapX,y,recapW,9,"F");
    doc.setFont("helvetica","normal"); doc.setTextColor(71,85,105);
    doc.text(`Nombre de plats`,recapX+4,y+6);
    doc.setFont("helvetica","bold"); doc.setTextColor(30,41,59);
    doc.text(`${totalPlats} plat(s)`,recapX+recapW-4,y+6,{align:"right"}); y+=9;

    // Ligne déjà payé
    if(totalPaye>0){
      checkY(9);
      doc.setFillColor(240,253,244);
      doc.rect(recapX,y,recapW,9,"F");
      doc.setFont("helvetica","normal"); doc.setTextColor(22,101,52);
      doc.text("Deja paye",recapX+4,y+6);
      doc.setFont("helvetica","bold");
      doc.text(`- ${totalPaye} MAD`,recapX+recapW-4,y+6,{align:"right"}); y+=9;
    }

    // ══ TOTAL À PAYER (grande box) ══
    checkY(16);
    doc.setFillColor(22,163,74);
    doc.roundedRect(recapX,y,recapW,16,3,3,"F");
    doc.setTextColor(255,255,255);
    doc.setFont("helvetica","bold");
    doc.setFontSize(10);
    doc.text("TOTAL A PAYER",recapX+4,y+7);
    doc.setFontSize(13);
    doc.text(`${totalDu} MAD`,recapX+recapW-4,y+11,{align:"right"});
    y+=22;
  }

  // ══ STATUT PAIEMENT ══
  checkY(20);
  const isPaye=totalDu===0;
  doc.setFillColor(isPaye?240:255,isPaye?253:251,isPaye?244:235);
  doc.setDrawColor(isPaye?22:245,isPaye?163:158,isPaye?74:11);
  doc.roundedRect(PL,y,CW,14,3,3,"FD");
  doc.setFont("helvetica","bold"); doc.setFontSize(11);
  doc.setTextColor(isPaye?22:146,isPaye?101:64,isPaye?52:14);
  doc.text(isPaye?"✓ FACTURE REGLEE":"⚠ EN ATTENTE DE REGLEMENT",W/2,y+9,{align:"center"});
  y+=20;

  // ══ PIED DE PAGE ══
  checkY(24);
  doc.setFillColor(248,250,252);
  doc.rect(PL,y,CW,22,"F");
  doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(22,163,74);
  doc.text("Rozie Gourmet - Merci de votre fidelite !",PL+4,y+7);
  doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(100,116,139);
  doc.text(`Facture N° ${numFacture}  |  Emise le ${dateGen}  |  Periode : ${MOIS_FR[moisBilan]} ${anneeBilan}`,PL+4,y+13);
  doc.text("Paiement via WhatsApp - Rozie Gourmet",PL+4,y+19);

  // Numéros de page
  const pages=doc.getNumberOfPages();
  for(let i=1;i<=pages;i++){
    doc.setPage(i);
    doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(148,163,184);
    doc.text(`Page ${i}/${pages}  -  Rozie Gourmet`,W/2,290,{align:"center"});
  }

  const blob=doc.output("blob");
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=`Facture_RozieGourmet_${abonne.nom.replace(/\s+/g,"_")}_${MOIS[moisBilan]}_${anneeBilan}.pdf`;
  a.target="_blank"; document.body.appendChild(a); a.click();
  document.body.removeChild(a); setTimeout(()=>URL.revokeObjectURL(url),3000);
}

// ── Camera ────────────────────────────────────────────────────────────────────
function CameraCapture({onCapture,onClose}){
  const videoRef=useRef(null),canvasRef=useRef(null),streamRef=useRef(null);
  const [ready,setReady]=useState(false),[captured,setCaptured]=useState(null);
  const [facing,setFacing]=useState("user"),[error,setError]=useState(null);
  const startCamera=useCallback(async(fm)=>{
    if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop());
    setReady(false);setError(null);
    try{
      const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:fm,width:{ideal:640},height:{ideal:480}},audio:false});
      streamRef.current=s;
      if(videoRef.current){videoRef.current.srcObject=s;videoRef.current.onloadedmetadata=()=>setReady(true);}
    }catch{setError("Accès caméra refusé.");}
  },[]);
  useEffect(()=>{startCamera(facing);return()=>{if(streamRef.current)streamRef.current.getTracks().forEach(t=>t.stop());};},[]);
  const flip=()=>{const n=facing==="user"?"environment":"user";setFacing(n);setCaptured(null);startCamera(n);};
  const takePhoto=()=>{
    const v=videoRef.current,c=canvasRef.current;if(!v||!c)return;
    c.width=v.videoWidth||640;c.height=v.videoHeight||480;
    const ctx=c.getContext("2d");
    if(facing==="user"){ctx.translate(c.width,0);ctx.scale(-1,1);}
    ctx.drawImage(v,0,0);setCaptured(c.toDataURL("image/jpeg",0.85));
  };
  return(
    <div style={{position:"fixed",inset:0,background:"#000",zIndex:300,display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px",background:"#000"}}>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#fff",fontSize:26,cursor:"pointer"}}>✕</button>
        <span style={{color:"#fff",fontWeight:700,fontSize:16}}>📸 Photo client</span>
        <button onClick={flip} style={{background:"none",border:"none",color:"#fff",fontSize:24,cursor:"pointer"}}>🔄</button>
      </div>
      <div style={{flex:1,position:"relative",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
        {error?<div style={{color:"#f87171",textAlign:"center",padding:24}}><div style={{fontSize:40}}>🚫</div><div>{error}</div></div>:
          <>{<video ref={videoRef} autoPlay playsInline muted style={{width:"100%",height:"100%",objectFit:"cover",transform:facing==="user"?"scaleX(-1)":"none",display:captured?"none":"block"}}/>}
            {captured&&<img src={captured} alt="cap" style={{width:"100%",height:"100%",objectFit:"cover"}}/>}
            {!captured&&<div style={{position:"absolute",width:200,height:200,border:"3px dashed rgba(255,255,255,0.6)",borderRadius:"50%",top:"50%",left:"50%",transform:"translate(-50%,-50%)",pointerEvents:"none"}}/>}</>}
        <canvas ref={canvasRef} style={{display:"none"}}/>
      </div>
      <div style={{background:"#000",padding:"20px 30px 30px",display:"flex",justifyContent:"center",alignItems:"center",gap:40}}>
        {!captured?<button onClick={takePhoto} disabled={!ready} style={{width:72,height:72,borderRadius:"50%",border:"4px solid #fff",background:ready?"#fff":"#555",cursor:ready?"pointer":"not-allowed",fontSize:28}}>📷</button>:
          <><button onClick={()=>setCaptured(null)} style={{flex:1,background:"#374151",color:"#fff",border:"none",borderRadius:14,padding:"14px 0",fontWeight:700,fontSize:15,cursor:"pointer"}}>🔁 Reprendre</button>
            <button onClick={()=>onCapture(captured)} style={{flex:1,background:"#16a34a",color:"#fff",border:"none",borderRadius:14,padding:"14px 0",fontWeight:700,fontSize:15,cursor:"pointer",marginLeft:12}}>✅ Utiliser</button></>}
      </div>
    </div>
  );
}

// ── Small Components ──────────────────────────────────────────────────────────
function StatCard({label,value,color,icon}){
  return(<div style={{background:"#fff",borderRadius:16,padding:"16px 18px",boxShadow:"0 2px 12px #0001",borderLeft:`4px solid ${color}`,flex:1,minWidth:130}}>
    <div style={{fontSize:20,marginBottom:4}}>{icon}</div>
    <div style={{fontSize:20,fontWeight:800,color}}>{value}</div>
    <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{label}</div>
  </div>);
}
function Avatar({photo,emoji,size=46}){
  return photo?<img src={photo} alt="" style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",border:"2px solid #e2e8f0",flexShrink:0}}/>
    :<div style={{width:size,height:size,borderRadius:"50%",background:"#f0fdf4",border:"2px solid #bbf7d0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.45,flexShrink:0}}>{emoji||"👤"}</div>;
}
function OrderCard({o,onPay,onDel}){
  return(<div style={{background:"#fff",borderRadius:14,padding:"12px 14px",marginBottom:8,boxShadow:"0 1px 6px #0001",borderLeft:`4px solid ${o.paid?"#16a34a":"#f59e0b"}`}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        <Avatar photo={o.photo} emoji={o.emoji}/>
        <div>
          <div style={{fontWeight:700,fontSize:14}}>{o.client||"Client photo"}</div>
          <div style={{fontSize:12,color:"#64748b"}}>{o.menuNom} × {o.qte}</div>
          <div style={{fontSize:11,color:"#94a3b8"}}>{o.date}</div>
        </div>
      </div>
      <div style={{textAlign:"right"}}>
        <div style={{fontWeight:800,fontSize:15,color:"#16a34a"}}>{o.prix*o.qte} MAD</div>
        <div style={{fontSize:11,color:"#8b5cf6"}}>Marge: {(o.prix-o.cout)*o.qte} MAD</div>
      </div>
    </div>
    <div style={{display:"flex",gap:8,marginTop:10}}>
      <button onClick={()=>onPay(o.id)} style={{flex:1,background:o.paid?"#fef3c7":"#dcfce7",color:o.paid?"#d97706":"#16a34a",border:"none",borderRadius:10,padding:"8px 0",fontWeight:700,fontSize:13,cursor:"pointer"}}>
        {o.paid?"⏳ Marquer non payé":"✅ Marquer payé"}
      </button>
      <button onClick={()=>onDel(o.id)} style={{background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:10,padding:"8px 14px",fontWeight:700,cursor:"pointer"}}>🗑️</button>
    </div>
  </div>);
}
const waLink=(phone,msg)=>`https://wa.me/${phone.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`;

// ── App ───────────────────────────────────────────────────────────────────────
export default function App(){
  const [tab,setTab]=useState("commandes");
  const [menus,setMenus]=useState(INIT_MENUS);
  const [orders,setOrders]=useState([]);
  const [abonnes,setAbonnes]=useState([]);
  const [modal,setModal]=useState(null);
  const [camera,setCamera]=useState(false);
  const [cameraTarget,setCameraTarget]=useState(null);
  const [moisBilan,setMoisBilan]=useState(now.getMonth());
  const [anneeBilan,setAnneeBilan]=useState(now.getFullYear());
  const [pdfLoading,setPdfLoading]=useState(null);
  const [importText,setImportText]=useState("");
  const [platJour,setPlatJour]=useState("");
  const [importResult,setImportResult]=useState(null);

  const [fPlat,setFPlat]=useState({nom:"",prix:"",cout:"",emoji:"🍽️"});
  const [fCmd,setFCmd]=useState({client:"",menuId:"",qte:1,photo:null,abonneIdx:""});
  const [fAbo,setFAbo]=useState({nom:"",phone:"",photo:null});

  // ── Persistance localStorage ──
  useEffect(()=>{
    try{
      const m=localStorage.getItem("rg_menus");
      const o=localStorage.getItem("rg_orders");
      const a=localStorage.getItem("rg_abonnes");
      if(m) setMenus(JSON.parse(m));
      if(o) setOrders(JSON.parse(o));
      if(a) setAbonnes(JSON.parse(a));
    }catch(e){ console.warn("Erreur chargement localStorage",e); }
  },[]);

  useEffect(()=>{ try{ localStorage.setItem("rg_menus",JSON.stringify(menus)); }catch(e){} },[menus]);
  useEffect(()=>{ try{ localStorage.setItem("rg_orders",JSON.stringify(orders)); }catch(e){} },[orders]);
  useEffect(()=>{ try{ localStorage.setItem("rg_abonnes",JSON.stringify(abonnes)); }catch(e){} },[abonnes]);

  // ── Stats ──
  const stats=useMemo(()=>({
    totalCmd:     orders.length,
    totalPaye:    orders.filter(o=>o.paid).reduce((s,o)=>s+o.prix*o.qte,0),
    totalAttente: orders.filter(o=>!o.paid).reduce((s,o)=>s+o.prix*o.qte,0),
    totalBenef:   orders.filter(o=>o.paid).reduce((s,o)=>s+(o.prix-o.cout)*o.qte,0),
  }),[orders]);

  const aRelancer=useMemo(()=>{
    const g={};
    orders.filter(o=>!o.paid&&!o.abonneId).forEach(o=>{
      const k=o.client||o.id;
      if(!g[k]) g[k]={client:o.client,photo:o.photo,emoji:o.emoji,commandes:[],total:0};
      g[k].commandes.push(o); g[k].total+=o.prix*o.qte;
    });
    return Object.values(g).filter(x=>x.commandes.length>=5);
  },[orders]);

  const bilanMensuel=useMemo(()=>abonnes.map(a=>{
    const cmdMois=orders.filter(o=>{
      if(String(o.abonneId)!==String(a.id)) return false;
      const d=new Date(o.rawDate);
      return d.getMonth()===moisBilan&&d.getFullYear()===anneeBilan;
    });
    const byPlat={};
    cmdMois.forEach(o=>{
      if(!byPlat[o.menuNom]) byPlat[o.menuNom]={nom:o.menuNom,prix:o.prix,qte:0,montant:0};
      byPlat[o.menuNom].qte+=o.qte; byPlat[o.menuNom].montant+=o.prix*o.qte;
    });
    return{...a,cmdMois,byPlat:Object.values(byPlat),
      platsCount:cmdMois.reduce((s,o)=>s+o.qte,0),
      montantTotal:cmdMois.reduce((s,o)=>s+o.prix*o.qte,0)};
  }),[abonnes,orders,moisBilan,anneeBilan]);

  const totalBilan=useMemo(()=>({
    plats:bilanMensuel.reduce((s,a)=>s+a.platsCount,0),
    montant:bilanMensuel.reduce((s,a)=>s+a.montantTotal,0),
  }),[bilanMensuel]);

  // ── Handlers ──
  const addMenu=()=>{
    if(!fPlat.nom||!fPlat.prix) return;
    setMenus(p=>[...p,{id:uid(),nom:fPlat.nom,prix:+fPlat.prix,cout:+fPlat.cout||0,emoji:fPlat.emoji}]);
    setFPlat({nom:"",prix:"",cout:"",emoji:"🍽️"}); setModal(null);
  };
  const delMenu=id=>{setMenus(p=>p.filter(m=>m.id!==id));setOrders(p=>p.filter(o=>o.menuId!==id));};

  const addOrder=()=>{
    if(!fCmd.menuId) return;
    const menu=menus.find(m=>m.id===fCmd.menuId); if(!menu) return;
    const abonne=fCmd.abonneIdx!==""?abonnes.filter(a=>a.actif)[+fCmd.abonneIdx]:null;
    setOrders(p=>[...p,{
      id:uid(),client:abonne?abonne.nom:(fCmd.client||"Client photo"),
      photo:abonne?abonne.photo:fCmd.photo, abonneId:abonne?abonne.id:null,
      menuId:menu.id,menuNom:menu.nom,emoji:menu.emoji,prix:menu.prix,cout:menu.cout,
      qte:+fCmd.qte, paid:!!abonne,
      date:new Date().toLocaleString("fr-MA"), rawDate:new Date().toISOString(),
    }]);
    setFCmd({client:"",menuId:"",qte:1,photo:null,abonneIdx:""}); setModal(null);
  };

  const addAbonne=()=>{
    if(!fAbo.nom) return;
    setAbonnes(p=>[...p,{id:uid(),nom:fAbo.nom,phone:fAbo.phone,photo:fAbo.photo,actif:true,dateDebut:new Date().toLocaleDateString("fr-MA")}]);
    setFAbo({nom:"",phone:"",photo:null}); setModal(null);
  };

  const toggleAbo=id=>setAbonnes(p=>p.map(a=>a.id===id?{...a,actif:!a.actif}:a));
  const delAbonne=id=>setAbonnes(p=>p.filter(a=>a.id!==id));
  const togglePaid=id=>setOrders(p=>p.map(o=>o.id===id?{...o,paid:!o.paid}:o));
  const delOrder=id=>setOrders(p=>p.filter(o=>o.id!==id));
  const openCamera=t=>{setCameraTarget(t);setCamera(true);};
  const onCapture=d=>{
    if(cameraTarget==="commande") setFCmd(p=>({...p,photo:d}));
    if(cameraTarget==="abonne")   setFAbo(p=>({...p,photo:d}));
    setCamera(false);
  };
  const downloadPDF=async(a)=>{
    setPdfLoading(a.id);
    try{ const b=bilanMensuel.find(x=>x.id===a.id); await genererPDF(a,b?.cmdMois||[],moisBilan,anneeBilan); }
    catch{ alert("Erreur PDF."); }
    setPdfLoading(null);
  };

  // ── WhatsApp Parser (Plat du Jour) ──
  const parseWhatsApp=(text)=>{
    if(!menus.length){ alert("Ajoute d'abord tes plats."); return; }
    const menu=menus.find(m=>m.id===platJour);
    if(!menu){ alert("Sélectionne le plat du jour avant d'analyser."); return; }

    const lines=text.split("\n").map(l=>l.trim()).filter(Boolean);
    const found=[];
    let i=0;
    while(i<lines.length){
      const line=lines[i];
      // Skip phone numbers, timestamps, tildes alone, empty
      const isPhone=/^[+\d][\d\s\-().]{5,}$/.test(line);
      const isTimestamp=/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(line)||/^yesterday/.test(line.toLowerCase())||/^aujourd/.test(line.toLowerCase());
      const isSystem=line.includes("a rejoint")||line.includes("a quitt")||line.includes("chiffré")||line.includes("messages");

      if(!isPhone&&!isTimestamp&&!isSystem&&line.length>=2){
        // Clean the name: remove leading ~ and special chars
        let name=line.replace(/^[~\s]+/,"").replace(/[łśŚšäöü]/g,"").trim();
        // Remove trailing junk (digits at end like "26/6/26 14:04" merged)
        name=name.replace(/\s+\d{1,2}\/\d{1,2}\/\d{2,4}.*$/,"").replace(/\s+\d{1,2}:\d{2}.*$/,"").trim();
        if(name.length<2||name.length>50){i++;continue;}
        // Check if it's a plat name — skip
        const isPlat=menus.some(m=>name.toLowerCase().includes(m.nom.toLowerCase().split(" ")[0].toLowerCase()));
        if(isPlat){i++;continue;}

        // Matching intelligent : compare chaque mot du nom WA avec chaque mot du nom abonné
        const normalize=s=>s.toLowerCase()
          .replace(/[éèêë]/g,"e").replace(/[àâä]/g,"a").replace(/[ôö]/g,"o")
          .replace(/[ùûü]/g,"u").replace(/[îï]/g,"i").replace(/[ç]/g,"c")
          .replace(/[^a-z0-9\s]/g,"").trim();

        const abonne=abonnes.find(a=>{
          const wordsAbo=normalize(a.nom).split(/\s+/).filter(w=>w.length>=3);
          const wordsWA =normalize(name).split(/\s+/).filter(w=>w.length>=3);
          // Un seul mot en commun (≥3 lettres) suffit pour matcher
          return wordsAbo.some(wa=>wordsWA.some(ww=>wa===ww||wa.startsWith(ww)||ww.startsWith(wa)));
        });
        const clientName=abonne?abonne.nom:name;
        const dup=found.find(f=>f.client===clientName);
        if(!dup){
          found.push({client:clientName,abonne:abonne||null,
            menuId:menu.id,menuNom:menu.nom,emoji:menu.emoji,
            prix:menu.prix,cout:menu.cout,qte:1});
        }
      }
      i++;
    }
    setImportResult(found);
  };

  const confirmImport=()=>{
    if(!importResult?.length) return;
    setOrders(p=>[...p,...importResult.map(r=>({
      id:uid(),
      client:r.abonne?r.abonne.nom:r.client,
      photo:r.abonne?.photo||null,
      abonneId:r.abonne?r.abonne.id:null,
      menuId:r.menuId,menuNom:r.menuNom,emoji:r.emoji,prix:r.prix,cout:r.cout,
      qte:r.qte,
      paid:!!r.abonne, // abonnés = payé automatiquement
      date:new Date().toLocaleString("fr-MA"),rawDate:new Date().toISOString(),
    }))]);
    setImportText("");setImportResult(null);setPlatJour("");setModal(null);
  };

  const platStats=useMemo(()=>menus.map(m=>{
    const r=orders.filter(o=>o.menuId===m.id);
    return{...m,qte:r.reduce((s,o)=>s+o.qte,0),
      ca:r.filter(o=>o.paid).reduce((s,o)=>s+o.prix*o.qte,0),
      benef:r.filter(o=>o.paid).reduce((s,o)=>s+(o.prix-o.cout)*o.qte,0),
      nbCommandes:r.length};
  }),[menus,orders]);

  // ── Styles ──
  const S={
    app:{fontFamily:"'Segoe UI',system-ui,sans-serif",background:"#f0fdf4",minHeight:"100vh",maxWidth:540,margin:"0 auto",paddingBottom:90},
    header:{background:"linear-gradient(135deg,#16a34a 0%,#15803d 100%)",padding:"20px 20px 14px",color:"#fff"},
    nav:{display:"flex",background:"#fff",position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:540,borderTop:"1px solid #e2e8f0",zIndex:100},
    navBtn:a=>({flex:1,padding:"10px 2px 8px",background:"none",border:"none",cursor:"pointer",color:a?"#16a34a":"#94a3b8",fontWeight:a?700:500,fontSize:10,display:"flex",flexDirection:"column",alignItems:"center",gap:2}),
    body:{padding:"16px 14px"},
    fab:{position:"fixed",bottom:74,right:"calc(50% - 260px)",background:"#16a34a",color:"#fff",border:"none",borderRadius:"50%",width:52,height:52,fontSize:26,cursor:"pointer",boxShadow:"0 4px 20px #16a34a55",display:"flex",alignItems:"center",justifyContent:"center",zIndex:101},
    overlay:{position:"fixed",inset:0,background:"#0006",zIndex:200,display:"flex",alignItems:"flex-end"},
    sheet:{background:"#fff",borderRadius:"20px 20px 0 0",padding:24,width:"100%",maxWidth:540,margin:"0 auto",maxHeight:"92vh",overflowY:"auto"},
    input:{width:"100%",border:"1.5px solid #e2e8f0",borderRadius:10,padding:"10px 12px",fontSize:15,marginBottom:10,boxSizing:"border-box",outline:"none"},
    btn:(c="#16a34a")=>({background:c,color:c==="#f1f5f9"?"#64748b":"#fff",border:"none",borderRadius:12,padding:"13px 0",width:"100%",fontWeight:700,fontSize:16,cursor:"pointer"}),
    card:{background:"#fff",borderRadius:14,padding:"14px 16px",marginBottom:10,boxShadow:"0 1px 6px #0001"},
    label:{fontSize:11,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:.5,marginBottom:8,marginTop:14},
    row:{display:"flex",alignItems:"center",gap:10},
  };

  const TABS=[
    {key:"commandes",label:"Commandes",icon:"📋"},
    {key:"abonnes",  label:"Abonnés",  icon:"⭐"},
    {key:"relance",  label:"Relance",  icon:"🔔"},
    {key:"plats",    label:"Plats",    icon:"🍽️"},
    {key:"stats",    label:"Stats",    icon:"📊"},
  ];

  return(
    <div style={S.app}>
      {camera&&<CameraCapture onCapture={onCapture} onClose={()=>setCamera(false)}/>}

      {/* Header */}
      <div style={S.header}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:28}}>🟢</span>
          <div>
            <div style={{fontSize:22,fontWeight:800}}>Restaurant WhatsApp</div>
            <div style={{fontSize:13,opacity:.8}}>{orders.length} commandes · {abonnes.filter(a=>a.actif).length} abonnés actifs</div>
          </div>
        </div>
      </div>

      <div style={S.body}>

        {/* ══ COMMANDES ══ */}
        {tab==="commandes"&&<>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:10}}>
            <StatCard label="Total"    value={stats.totalCmd}         color="#16a34a" icon="📋"/>
            <StatCard label="Encaissé" value={fmt(stats.totalPaye)}   color="#0ea5e9" icon="✅"/>
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>
            <StatCard label="En attente" value={fmt(stats.totalAttente)} color="#f59e0b" icon="⏳"/>
            <StatCard label="Bénéfice"   value={fmt(stats.totalBenef)}   color="#8b5cf6" icon="💰"/>
          </div>

          {/* Import WhatsApp */}
          <button onClick={()=>setModal("import")} style={{display:"flex",alignItems:"center",gap:10,background:"#fff",border:"2px dashed #86efac",borderRadius:12,padding:"12px 16px",cursor:"pointer",width:"100%",boxSizing:"border-box",marginBottom:14}}>
            <span style={{fontSize:26}}>📲</span>
            <div style={{textAlign:"left"}}>
              <div style={{fontWeight:700,color:"#16a34a",fontSize:14}}>Importer depuis WhatsApp</div>
              <div style={{fontSize:12,color:"#64748b"}}>Colle le texte du groupe → commandes créées auto</div>
            </div>
          </button>

          {aRelancer.length>0&&<div onClick={()=>setTab("relance")} style={{background:"#fef3c7",border:"1.5px solid #fbbf24",borderRadius:12,padding:"10px 14px",marginBottom:16,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:22}}>🔔</span>
            <div>
              <div style={{fontWeight:700,color:"#d97706",fontSize:14}}>{aRelancer.length} client(s) à relancer</div>
              <div style={{fontSize:12,color:"#92400e"}}>5+ commandes impayées → voir Relance</div>
            </div>
          </div>}

          {orders.length>0?<>
            <div style={S.label}>⏳ Non payés ({orders.filter(o=>!o.paid).length})</div>
            {orders.filter(o=>!o.paid).map(o=><OrderCard key={o.id} o={o} onPay={togglePaid} onDel={delOrder}/>)}
            <div style={S.label}>✅ Payés ({orders.filter(o=>o.paid).length})</div>
            {orders.filter(o=>o.paid).map(o=><OrderCard key={o.id} o={o} onPay={togglePaid} onDel={delOrder}/>)}
          </>:<div style={{textAlign:"center",padding:"50px 20px",color:"#94a3b8"}}>
            <div style={{fontSize:48}}>📭</div>
            <div style={{fontSize:16,marginTop:10}}>Aucune commande</div>
            <div style={{fontSize:13}}>Appuie sur + ou importe depuis WhatsApp</div>
          </div>}
        </>}

        {/* ══ ABONNÉS ══ */}
        {tab==="abonnes"&&<>
          <div style={{background:"#fff",borderRadius:14,padding:"14px 16px",marginBottom:14,boxShadow:"0 1px 6px #0001"}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>📅 Bilan mensuel</div>
            <div style={{display:"flex",gap:8}}>
              <select style={{...S.input,marginBottom:0,flex:2}} value={moisBilan} onChange={e=>setMoisBilan(+e.target.value)}>
                {MOIS_FR.map((m,i)=><option key={i} value={i}>{m}</option>)}
              </select>
              <input type="number" style={{...S.input,marginBottom:0,flex:1}} value={anneeBilan} onChange={e=>setAnneeBilan(+e.target.value)}/>
            </div>
            <div style={{display:"flex",gap:8,marginTop:10}}>
              {[
                {label:"Plats servis",val:totalBilan.plats+" plats",color:"#16a34a"},
                {label:"CA total",    val:totalBilan.montant+" MAD",color:"#0ea5e9"},
                {label:"Abonnés",     val:abonnes.filter(a=>a.actif).length+" actifs",color:"#8b5cf6"},
              ].map(s=><div key={s.label} style={{flex:1,background:"#f8fafc",borderRadius:10,padding:"8px 6px",textAlign:"center"}}>
                <div style={{fontWeight:800,color:s.color,fontSize:14}}>{s.val}</div>
                <div style={{fontSize:10,color:"#94a3b8"}}>{s.label}</div>
              </div>)}
            </div>
          </div>
          <div style={S.label}>Liste abonnés ({abonnes.length})</div>
          {abonnes.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:"#94a3b8"}}>
            <div style={{fontSize:44}}>⭐</div><div style={{marginTop:8}}>Aucun abonné</div>
            <div style={{fontSize:13}}>Appuie sur + pour ajouter</div>
          </div>}
          {bilanMensuel.map(a=><div key={a.id} style={{...S.card,borderLeft:`4px solid ${a.actif?"#16a34a":"#94a3b8"}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={S.row}>
                <Avatar photo={a.photo} emoji="👤" size={48}/>
                <div>
                  <div style={{fontWeight:700,fontSize:15}}>{a.nom}</div>
                  <div style={{fontSize:12,color:"#64748b"}}>{a.actif?<span style={{color:"#16a34a",fontWeight:600}}>✅ Actif</span>:<span style={{color:"#94a3b8"}}>❌ Inactif</span>}</div>
                  {a.phone&&<div style={{fontSize:11,color:"#94a3b8"}}>📱 {a.phone}</div>}
                  <div style={{fontSize:11,color:"#94a3b8"}}>Depuis {a.dateDebut}</div>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:800,fontSize:22,color:"#16a34a"}}>{a.platsCount}</div>
                <div style={{fontSize:11,color:"#64748b"}}>plats ce mois</div>
                <div style={{fontWeight:700,fontSize:14,color:"#0ea5e9"}}>{a.montantTotal} MAD</div>
              </div>
            </div>
            {a.byPlat.length>0?<div style={{marginTop:12,background:"#f8fafc",borderRadius:10,overflow:"hidden"}}>
              <div style={{background:"#16a34a",padding:"5px 12px"}}>
                <span style={{fontSize:11,color:"#fff",fontWeight:700}}>RÉCAP — {MOIS_FR[moisBilan]} {anneeBilan}</span>
              </div>
              <div style={{padding:"0 0 4px"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 60px 60px 70px",padding:"5px 12px",background:"#f0fdf4"}}>
                  {["Plat","Qté","Prix","Total"].map(h=><div key={h} style={{fontSize:10,fontWeight:700,color:"#64748b"}}>{h}</div>)}
                </div>
                {a.byPlat.map((p,i)=><div key={p.nom} style={{display:"grid",gridTemplateColumns:"1fr 60px 60px 70px",padding:"6px 12px",background:i%2===0?"#fff":"#f8fafc"}}>
                  <div style={{fontSize:12,fontWeight:600,color:"#1e293b"}}>{p.nom}</div>
                  <div style={{fontSize:12,color:"#475569"}}>×{p.qte}</div>
                  <div style={{fontSize:12,color:"#475569"}}>{p.prix} MAD</div>
                  <div style={{fontSize:12,fontWeight:700,color:"#16a34a"}}>{p.montant} MAD</div>
                </div>)}
                <div style={{display:"grid",gridTemplateColumns:"1fr 60px 60px 70px",padding:"6px 12px",background:"#dcfce7",borderTop:"1px solid #bbf7d0"}}>
                  <div style={{fontSize:12,fontWeight:800,color:"#15803d"}}>TOTAL</div>
                  <div style={{fontSize:12,fontWeight:800,color:"#15803d"}}>×{a.platsCount}</div>
                  <div/>
                  <div style={{fontSize:12,fontWeight:800,color:"#15803d"}}>{a.montantTotal} MAD</div>
                </div>
              </div>
            </div>:<div style={{marginTop:10,padding:"10px 12px",background:"#f8fafc",borderRadius:10,textAlign:"center",fontSize:12,color:"#94a3b8"}}>Aucune commande ce mois</div>}
            <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
              <button onClick={()=>toggleAbo(a.id)} style={{flex:1,background:a.actif?"#fef3c7":"#dcfce7",color:a.actif?"#d97706":"#16a34a",border:"none",borderRadius:10,padding:"8px 0",fontWeight:700,fontSize:11,cursor:"pointer",minWidth:70}}>
                {a.actif?"❌ Désactiver":"✅ Activer"}
              </button>
              {a.phone&&<a href={waLink(a.phone,`Bonjour ${a.nom} 👋\nBilan ${MOIS_FR[moisBilan]} ${anneeBilan} :\n${a.byPlat.map(p=>`- ${p.nom} x${p.qte} = ${p.montant} MAD`).join("\n")}\n\nTotal : ${a.platsCount} plats — ${a.montantTotal} MAD\n\nMerci ! 🙏`)}
                target="_blank" rel="noreferrer"
                style={{flex:1,background:"#dcfce7",color:"#16a34a",border:"none",borderRadius:10,padding:"8px 0",fontWeight:700,fontSize:11,cursor:"pointer",textDecoration:"none",display:"flex",alignItems:"center",justifyContent:"center",minWidth:70}}>
                💬 WA
              </a>}
              <button onClick={()=>downloadPDF(a)} disabled={pdfLoading===a.id}
                style={{flex:1,background:pdfLoading===a.id?"#e2e8f0":"#ede9fe",color:pdfLoading===a.id?"#94a3b8":"#7c3aed",border:"none",borderRadius:10,padding:"8px 0",fontWeight:700,fontSize:11,cursor:pdfLoading===a.id?"not-allowed":"pointer",minWidth:70}}>
                {pdfLoading===a.id?"⏳...":"📄 PDF"}
              </button>
              <button onClick={()=>delAbonne(a.id)} style={{background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:10,padding:"8px 10px",fontWeight:700,cursor:"pointer"}}>🗑️</button>
            </div>
          </div>)}
        </>}

        {/* ══ RELANCE ══ */}
        {tab==="relance"&&<>
          <div style={{background:"#fffbeb",border:"1.5px solid #fcd34d",borderRadius:14,padding:"14px 16px",marginBottom:16}}>
            <div style={{fontWeight:700,fontSize:14,color:"#92400e"}}>⚠️ Clients sans abonnement avec 5+ plats impayés</div>
            <div style={{fontSize:12,color:"#b45309",marginTop:4}}>Relance-les ou convertis-les en abonnés.</div>
          </div>
          {aRelancer.length===0?<div style={{textAlign:"center",padding:"50px 20px",color:"#94a3b8"}}>
            <div style={{fontSize:48}}>🎉</div><div style={{fontSize:16,marginTop:10}}>Aucune relance nécessaire</div>
          </div>:aRelancer.map((g,i)=><div key={i} style={{...S.card,borderLeft:"4px solid #f59e0b"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={S.row}>
                <Avatar photo={g.photo} emoji={g.emoji} size={46}/>
                <div>
                  <div style={{fontWeight:700,fontSize:14}}>{g.client||"Client photo"}</div>
                  <div style={{fontSize:12,color:"#f59e0b",fontWeight:600}}>🚨 {g.commandes.length} plats impayés</div>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:800,fontSize:16,color:"#dc2626"}}>{g.total} MAD</div>
                <div style={{fontSize:11,color:"#94a3b8"}}>dû total</div>
              </div>
            </div>
            <div style={{background:"#fffbeb",borderRadius:10,padding:"8px 12px",marginBottom:10}}>
              {g.commandes.map(c=><div key={c.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#475569",marginBottom:2}}>
                <span>{c.emoji} {c.menuNom} ×{c.qte}</span>
                <span style={{color:"#f59e0b",fontWeight:600}}>{c.prix*c.qte} MAD</span>
              </div>)}
            </div>
            <div style={{display:"flex",gap:8}}>
              <a href={waLink("",`Bonjour ${g.client||""} 👋\n\nVous avez ${g.commandes.length} commandes en attente : ${g.total} MAD.\n\nMerci de régulariser ou de prendre un abonnement 🍽️`)}
                target="_blank" rel="noreferrer"
                style={{flex:1,background:"#dcfce7",color:"#15803d",border:"none",borderRadius:10,padding:"10px 0",fontWeight:700,fontSize:12,cursor:"pointer",textDecoration:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                💬 Relancer WA
              </a>
              <button onClick={()=>{setFAbo({nom:g.client||"",phone:"",photo:g.photo});setModal("abonne");setTab("abonnes");}}
                style={{flex:1,background:"#ede9fe",color:"#7c3aed",border:"none",borderRadius:10,padding:"10px 0",fontWeight:700,fontSize:12,cursor:"pointer"}}>
                ⭐ Convertir abonné
              </button>
            </div>
          </div>)}
        </>}

        {/* ══ PLATS ══ */}
        {tab==="plats"&&<>
          <div style={S.label}>Menu ({menus.length} plats)</div>
          {menus.map(m=><div key={m.id} style={{...S.card,...S.row,justifyContent:"space-between"}}>
            <div style={S.row}>
              <span style={{fontSize:28}}>{m.emoji}</span>
              <div>
                <div style={{fontWeight:700,fontSize:15}}>{m.nom}</div>
                <div style={{fontSize:12,color:"#64748b"}}>Prix: <b style={{color:"#16a34a"}}>{m.prix} MAD</b> · Coût: {m.cout} MAD · Marge: <b style={{color:"#8b5cf6"}}>{m.prix-m.cout} MAD</b></div>
              </div>
            </div>
            <button onClick={()=>delMenu(m.id)} style={{background:"#fee2e2",border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",color:"#dc2626"}}>🗑️</button>
          </div>)}
        </>}

        {/* ══ STATS ══ */}
        {tab==="stats"&&<>
          <div style={S.label}>📊 Performance par plat</div>
          {platStats.map(p=><div key={p.id} style={S.card}>
            <div style={{...S.row,marginBottom:10}}><span style={{fontSize:26}}>{p.emoji}</span><div style={{fontWeight:700,fontSize:15}}>{p.nom}</div></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {[{label:"Commandes",val:p.nbCommandes,color:"#0ea5e9"},{label:"Quantité",val:`×${p.qte}`,color:"#f59e0b"},{label:"CA",val:`${p.ca} MAD`,color:"#16a34a"}].map(s=>
                <div key={s.label} style={{background:"#f8fafc",borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
                  <div style={{fontSize:15,fontWeight:800,color:s.color}}>{s.val}</div>
                  <div style={{fontSize:10,color:"#94a3b8"}}>{s.label}</div>
                </div>)}
            </div>
            <div style={{marginTop:10,background:"#f0fdf4",borderRadius:10,padding:"8px 12px",display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:13,color:"#64748b"}}>💰 Bénéfice net</span>
              <span style={{fontWeight:800,color:"#16a34a",fontSize:16}}>{p.benef} MAD</span>
            </div>
            {p.qte>0&&<div style={{marginTop:8}}>
              <div style={{height:6,background:"#e2e8f0",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${Math.min(100,(p.benef/Math.max(1,p.ca))*100)}%`,background:"linear-gradient(90deg,#16a34a,#22c55e)",borderRadius:3}}/>
              </div>
              <div style={{fontSize:10,color:"#94a3b8",marginTop:3}}>Marge: {p.ca>0?Math.round((p.benef/p.ca)*100):0}%</div>
            </div>}
          </div>)}
          <div style={{...S.card,background:"linear-gradient(135deg,#16a34a,#15803d)",color:"#fff",marginTop:8}}>
            <div style={{fontWeight:700,fontSize:16,marginBottom:12}}>📈 Résumé global</div>
            {[{label:"Total encaissé",val:fmt(stats.totalPaye)},{label:"En attente",val:fmt(stats.totalAttente)},{label:"Bénéfice net",val:fmt(stats.totalBenef)}].map(r=>
              <div key={r.label} style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{opacity:.85,fontSize:13}}>{r.label}</span>
                <span style={{fontWeight:800}}>{r.val}</span>
              </div>)}
          </div>
        </>}

      </div>

      {/* FAB */}
      <button style={S.fab} onClick={()=>{
        if(tab==="plats") setModal("plat");
        else if(tab==="abonnes"||tab==="relance") setModal("abonne");
        else setModal("commande");
      }}>+</button>

      {/* Nav */}
      <nav style={S.nav}>
        {TABS.map(t=><button key={t.key} style={S.navBtn(tab===t.key)} onClick={()=>setTab(t.key)}>
          <span style={{fontSize:17,position:"relative"}}>
            {t.icon}
            {t.key==="relance"&&aRelancer.length>0&&<span style={{position:"absolute",top:-4,right:-6,background:"#dc2626",color:"#fff",borderRadius:"50%",width:14,height:14,fontSize:9,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{aRelancer.length}</span>}
          </span>
          {t.label}
        </button>)}
      </nav>

      {/* ── Modal Commande ── */}
      {modal==="commande"&&<div style={S.overlay} onClick={()=>setModal(null)}>
        <div style={S.sheet} onClick={e=>e.stopPropagation()}>
          <div style={{fontWeight:800,fontSize:17,marginBottom:16}}>➕ Nouvelle commande</div>
          {abonnes.length>0&&<div style={{marginBottom:12}}>
            <div style={{fontSize:12,color:"#64748b",marginBottom:6,fontWeight:600}}>CLIENT ABONNÉ ?</div>
            <select style={S.input} value={fCmd.abonneIdx} onChange={e=>setFCmd(p=>({...p,abonneIdx:e.target.value}))}>
              <option value="">-- Non abonné --</option>
              {abonnes.filter(a=>a.actif).map((a,i)=><option key={i} value={i}>⭐ {a.nom}</option>)}
            </select>
          </div>}
          {fCmd.abonneIdx===""&&<>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,color:"#64748b",marginBottom:6,fontWeight:600}}>PHOTO DU CLIENT</div>
              {fCmd.photo?<div style={{position:"relative",display:"inline-block"}}>
                <img src={fCmd.photo} alt="cl" style={{width:80,height:80,borderRadius:"50%",objectFit:"cover",border:"3px solid #16a34a"}}/>
                <button onClick={()=>setFCmd(p=>({...p,photo:null}))} style={{position:"absolute",top:-4,right:-4,background:"#dc2626",color:"#fff",border:"none",borderRadius:"50%",width:22,height:22,fontSize:12,cursor:"pointer"}}>✕</button>
              </div>:<button onClick={()=>openCamera("commande")} style={{display:"flex",alignItems:"center",gap:10,background:"#f0fdf4",border:"2px dashed #86efac",borderRadius:14,padding:"12px 18px",cursor:"pointer",width:"100%",boxSizing:"border-box"}}>
                <span style={{fontSize:28}}>📸</span>
                <div style={{textAlign:"left"}}>
                  <div style={{fontWeight:700,color:"#16a34a",fontSize:14}}>Prendre une photo</div>
                  <div style={{fontSize:12,color:"#64748b"}}>Identifie le client</div>
                </div>
              </button>}
            </div>
            <input style={S.input} placeholder="Nom du client (optionnel)" value={fCmd.client} onChange={e=>setFCmd(p=>({...p,client:e.target.value}))}/>
          </>}
          <select style={S.input} value={fCmd.menuId} onChange={e=>setFCmd(p=>({...p,menuId:e.target.value}))}>
            <option value="">-- Choisir un plat --</option>
            {menus.map(m=><option key={m.id} value={m.id}>{m.emoji} {m.nom} — {m.prix} MAD</option>)}
          </select>
          <div style={{display:"flex",gap:10,marginBottom:10}}>
            <div style={{flex:1}}>
              <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>Quantité</div>
              <input type="number" min={1} style={S.input} value={fCmd.qte} onChange={e=>setFCmd(p=>({...p,qte:e.target.value}))}/>
            </div>
            {fCmd.menuId&&<div style={{flex:1,background:"#f0fdf4",borderRadius:10,padding:"10px 12px"}}>
              <div style={{fontSize:11,color:"#64748b"}}>Total</div>
              <div style={{fontWeight:800,color:"#16a34a",fontSize:18}}>{(menus.find(m=>m.id===fCmd.menuId)?.prix||0)*fCmd.qte} MAD</div>
            </div>}
          </div>
          <button style={S.btn()} onClick={addOrder} disabled={!fCmd.menuId}>✅ Ajouter la commande</button>
          <button style={{...S.btn("#f1f5f9"),marginTop:8}} onClick={()=>{setModal(null);setFCmd({client:"",menuId:"",qte:1,photo:null,abonneIdx:""});}}>Annuler</button>
        </div>
      </div>}

      {/* ── Modal Abonné ── */}
      {modal==="abonne"&&<div style={S.overlay} onClick={()=>setModal(null)}>
        <div style={S.sheet} onClick={e=>e.stopPropagation()}>
          <div style={{fontWeight:800,fontSize:17,marginBottom:16}}>⭐ Nouvel abonné</div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,color:"#64748b",marginBottom:6,fontWeight:600}}>PHOTO</div>
            {fAbo.photo?<div style={{position:"relative",display:"inline-block"}}>
              <img src={fAbo.photo} alt="abo" style={{width:80,height:80,borderRadius:"50%",objectFit:"cover",border:"3px solid #16a34a"}}/>
              <button onClick={()=>setFAbo(p=>({...p,photo:null}))} style={{position:"absolute",top:-4,right:-4,background:"#dc2626",color:"#fff",border:"none",borderRadius:"50%",width:22,height:22,fontSize:12,cursor:"pointer"}}>✕</button>
            </div>:<button onClick={()=>openCamera("abonne")} style={{display:"flex",alignItems:"center",gap:10,background:"#f0fdf4",border:"2px dashed #86efac",borderRadius:14,padding:"12px 18px",cursor:"pointer",width:"100%",boxSizing:"border-box"}}>
              <span style={{fontSize:28}}>📸</span>
              <div><div style={{fontWeight:700,color:"#16a34a",fontSize:14}}>Photo de l'abonné</div><div style={{fontSize:12,color:"#64748b"}}>Optionnel</div></div>
            </button>}
          </div>
          <input style={S.input} placeholder="Nom complet *" value={fAbo.nom} onChange={e=>setFAbo(p=>({...p,nom:e.target.value}))}/>
          <input style={S.input} placeholder="Numéro WhatsApp (ex: 212612345678)" value={fAbo.phone} onChange={e=>setFAbo(p=>({...p,phone:e.target.value}))}/>
          <button style={S.btn()} onClick={addAbonne} disabled={!fAbo.nom}>⭐ Ajouter l'abonné</button>
          <button style={{...S.btn("#f1f5f9"),marginTop:8}} onClick={()=>{setModal(null);setFAbo({nom:"",phone:"",photo:null});}}>Annuler</button>
        </div>
      </div>}

      {/* ── Modal Plat ── */}
      {modal==="plat"&&<div style={S.overlay} onClick={()=>setModal(null)}>
        <div style={S.sheet} onClick={e=>e.stopPropagation()}>
          <div style={{fontWeight:800,fontSize:17,marginBottom:16}}>🍽️ Nouveau plat</div>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <input style={{...S.input,width:60,textAlign:"center",fontSize:22,marginBottom:0}} placeholder="🍛" value={fPlat.emoji} onChange={e=>setFPlat(p=>({...p,emoji:e.target.value}))} maxLength={2}/>
            <input style={{...S.input,flex:1,marginBottom:0}} placeholder="Nom du plat" value={fPlat.nom} onChange={e=>setFPlat(p=>({...p,nom:e.target.value}))}/>
          </div>
          <div style={{display:"flex",gap:10}}>
            <div style={{flex:1}}>
              <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>Prix de vente (MAD)</div>
              <input type="number" style={S.input} placeholder="45" value={fPlat.prix} onChange={e=>setFPlat(p=>({...p,prix:e.target.value}))}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>Coût (MAD)</div>
              <input type="number" style={S.input} placeholder="20" value={fPlat.cout} onChange={e=>setFPlat(p=>({...p,cout:e.target.value}))}/>
            </div>
          </div>
          {fPlat.prix&&fPlat.cout&&<div style={{background:"#f0fdf4",borderRadius:10,padding:"10px 12px",marginBottom:10,display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:13,color:"#64748b"}}>Marge par portion</span>
            <span style={{fontWeight:800,color:"#16a34a"}}>{fPlat.prix-fPlat.cout} MAD</span>
          </div>}
          <button style={S.btn()} onClick={addMenu}>✅ Ajouter le plat</button>
          <button style={{...S.btn("#f1f5f9"),marginTop:8}} onClick={()=>setModal(null)}>Annuler</button>
        </div>
      </div>}

      {/* ── Modal Import WhatsApp ── */}
      {modal==="import"&&<div style={S.overlay} onClick={()=>{setModal(null);setImportText("");setImportResult(null);}}>
        <div style={S.sheet} onClick={e=>e.stopPropagation()}>
          <div style={{fontWeight:800,fontSize:17,marginBottom:6}}>📲 Importer depuis WhatsApp</div>
          <div style={{fontSize:12,color:"#64748b",marginBottom:14}}>
            Dans ton groupe WA → <b>3 points → Exporter la discussion</b> → copie le texte ici. Ou colle directement les réponses au sondage.
          </div>

          {!importResult?<>
            {/* Plat du jour selector */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:"#64748b",fontWeight:700,marginBottom:6}}>🍽️ PLAT DU JOUR</div>
              <select style={S.input} value={platJour} onChange={e=>setPlatJour(e.target.value)}>
                <option value="">-- Sélectionne le plat du jour --</option>
                {menus.map(m=><option key={m.id} value={m.id}>{m.emoji} {m.nom} — {m.prix} MAD</option>)}
              </select>
              {platJour&&<div style={{background:"#f0fdf4",borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",marginTop:-6,marginBottom:6}}>
                <span style={{fontSize:13,color:"#64748b"}}>Tous les clients paieront</span>
                <span style={{fontWeight:800,color:"#16a34a"}}>{menus.find(m=>m.id===platJour)?.prix} MAD</span>
              </div>}
            </div>
            <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"10px 12px",marginBottom:12,fontSize:12,color:"#166534"}}>
              <div style={{fontWeight:700,marginBottom:4}}>📋 Comment faire :</div>
              <div style={{fontSize:11,lineHeight:1.8}}>
                1. Ouvre le sondage dans ton groupe WhatsApp<br/>
                2. Appuie sur le nombre de votes → tu vois la liste<br/>
                3. Fais une capture ou <b>copie tous les noms</b><br/>
                4. Colle ici → chaque nom = 1 commande du plat du jour
              </div>
            </div>
            <textarea
              style={{...S.input,height:200,resize:"vertical",fontFamily:"monospace",fontSize:12,lineHeight:1.7}}
              placeholder={"~ Mohamed\n+212 770-956542\nyesterday 15:36\n~ Fatou\n+212 600-234721\n..."}
              value={importText}
              onChange={e=>setImportText(e.target.value)}
            />
            <button style={S.btn()} onClick={()=>parseWhatsApp(importText)} disabled={!importText.trim()||!platJour}>🔍 Analyser les commandes</button>
            <button style={{...S.btn("#f1f5f9"),marginTop:8}} onClick={()=>{setModal(null);setImportText("");setImportResult(null);}}>Annuler</button>
          </>:<>
            <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>
              {importResult.length>0?`✅ ${importResult.length} commande(s) détectée(s)`:"❌ Aucune commande reconnue"}
            </div>
            {importResult.length>0?<>
              {/* Summary badges */}
              <div style={{display:"flex",gap:8,marginBottom:12}}>
                <div style={{flex:1,background:"#f0fdf4",borderRadius:10,padding:"8px",textAlign:"center"}}>
                  <div style={{fontWeight:800,color:"#16a34a",fontSize:16}}>{importResult.filter(r=>r.abonne).length}</div>
                  <div style={{fontSize:10,color:"#64748b"}}>⭐ Abonnés</div>
                </div>
                <div style={{flex:1,background:"#fffbeb",borderRadius:10,padding:"8px",textAlign:"center"}}>
                  <div style={{fontWeight:800,color:"#f59e0b",fontSize:16}}>{importResult.filter(r=>!r.abonne).length}</div>
                  <div style={{fontSize:10,color:"#64748b"}}>👤 Non abonnés</div>
                </div>
                <div style={{flex:1,background:"#f0fdf4",borderRadius:10,padding:"8px",textAlign:"center"}}>
                  <div style={{fontWeight:800,color:"#0ea5e9",fontSize:16}}>{importResult.reduce((s,r)=>s+r.prix*r.qte,0)} MAD</div>
                  <div style={{fontSize:10,color:"#64748b"}}>💰 Total</div>
                </div>
              </div>
              {importResult.map((r,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:r.abonne?"#f0fdf4":"#f8fafc",borderRadius:10,padding:"10px 12px",marginBottom:6,border:`1.5px solid ${r.abonne?"#86efac":"#e2e8f0"}`}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <Avatar photo={r.abonne?.photo||null} emoji={r.emoji} size={34}/>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,display:"flex",alignItems:"center",gap:5}}>
                      {r.abonne&&<span style={{fontSize:10,background:"#16a34a",color:"#fff",borderRadius:6,padding:"1px 5px"}}>⭐</span>}
                      {r.abonne?r.abonne.nom:r.client}
                    </div>
                    <div style={{fontSize:11,color:r.abonne?"#16a34a":"#f59e0b",fontWeight:600}}>{r.abonne?"✅ Abonné → payé auto":"⏳ En attente paiement"}</div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:800,color:"#16a34a",fontSize:14}}>{r.prix*r.qte} MAD</div>
                  <div style={{fontSize:10,color:"#94a3b8"}}>{r.emoji} {r.menuNom}</div>
                </div>
              </div>)}
              <div style={{background:"#f0fdf4",borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:13,color:"#64748b"}}>Total détecté</span>
                <span style={{fontWeight:800,color:"#16a34a"}}>{importResult.reduce((s,r)=>s+r.prix*r.qte,0)} MAD</span>
              </div>
              <button style={S.btn()} onClick={confirmImport}>✅ Confirmer et importer</button>
            </>:<div style={{textAlign:"center",padding:"20px",color:"#94a3b8"}}>
              <div style={{fontSize:36}}>🤔</div>
              <div style={{fontSize:13,marginTop:8}}>Aucun plat reconnu.<br/>Vérifie que tes plats sont configurés et que les noms correspondent.</div>
            </div>}
            <button style={{...S.btn("#f1f5f9"),marginTop:8}} onClick={()=>setImportResult(null)}>↩️ Réessayer</button>
          </>}
        </div>
      </div>}

    </div>
  );
}
