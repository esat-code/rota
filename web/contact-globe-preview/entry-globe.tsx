import {createRoot} from "react-dom/client";
import {useEffect, useState} from "react";
import {GlobeWireframe} from "./components/ui/contact-with-globe";
import world from "world-atlas/countries-110m.json";
const mount = document.getElementById("entry-globe");
function EntryGlobe() {
  const shouldPause = () => document.hidden || document.body.dataset.nativePasswordEditing === "true" || document.getElementById("entry-screen")?.hidden === true ||
    !!document.activeElement?.matches('input, textarea, [contenteditable="true"]');
  const [paused, setPaused] = useState(shouldPause);
  useEffect(() => {
    const update = () => setPaused(shouldPause());
    let blurTimer: ReturnType<typeof setTimeout>;
    const afterBlur = () => {clearTimeout(blurTimer); blurTimer = setTimeout(update, 0);};
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", afterBlur);
    document.addEventListener("visibilitychange", update);
    const observer = new MutationObserver(update);
    const entry = document.getElementById("entry-screen");
    if (entry) observer.observe(entry, {attributes:true, attributeFilter:["hidden"]});
    observer.observe(document.body, {attributes:true, attributeFilter:["data-native-password-editing"]});
    update();
    return () => {
      clearTimeout(blurTimer);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", afterBlur);
      document.removeEventListener("visibilitychange", update);
      observer.disconnect();
    };
  }, []);
  return <GlobeWireframe
    className="entry-globe-canvas"
    variant="wireframesolid"
    worldTopology={world as unknown as NonNullable<React.ComponentProps<typeof GlobeWireframe>["worldTopology"]>}
    autoRotateSpeed={0.12}
    autoRotate={!paused}
    initialRotation={[-30,-12]}
    strokeColor="#b6bcc5"
    strokeWidth={0.65}
    sphereOutlineColor="#8c939e"
    sphereOutlineWidth={0.8}
    enableInteraction={!paused}
  />;
}
if (mount) createRoot(mount).render(<EntryGlobe />);
