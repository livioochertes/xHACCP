import { useEffect, useRef } from "react";
import { Grouped } from "./Grouped";
import "./GroupedMobile.css";

export function GroupedMobile() {
  const frameRef = useRef<HTMLDivElement>(null);
  const didAutoOpen = useRef(false);

  useEffect(() => {
    if (!window.matchMedia("(max-width: 760px)").matches || didAutoOpen.current) return;

    const menuButton = frameRef.current?.querySelector<HTMLButtonElement>(".admin-mobile-menu");
    if (!menuButton || menuButton.getAttribute("aria-expanded") === "true") return;

    didAutoOpen.current = true;
    menuButton.click();
  }, []);

  return (
    <div className="grouped-mobile-frame" ref={frameRef}>
      <Grouped />
    </div>
  );
}