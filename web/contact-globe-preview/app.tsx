import {createRoot} from "react-dom/client";
import {useState} from "react";
import {Moon,Sun} from "lucide-react";
import ContactWithGlobe from "@/components/ui/contact-with-globe";
function App(){
 const [dark,setDark]=useState(true);
 return <div className={dark?"dark":""}>
  <div className="demo-tools"><span>İletişim · Tasarım önizlemesi</span><button type="button" onClick={()=>setDark(!dark)} aria-label={dark?"Gündüz moduna geç":"Gece moduna geç"}>{dark?<Sun size={17}/>:<Moon size={17}/>}</button></div>
  <ContactWithGlobe/>
 </div>;
}
createRoot(document.getElementById("root")!).render(<App/>);
