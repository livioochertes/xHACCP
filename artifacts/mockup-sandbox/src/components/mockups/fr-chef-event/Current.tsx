import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./_group.css";

const covers = [
  {
    src: "/__mockup/images/fr-chef-event/cover-light.png",
    alt: "Couverture claire de l’offre La Pétanque des Toqués",
    backdrop: "#f0f0e8",
  },
  {
    src: "/__mockup/images/fr-chef-event/cover-navy.png",
    alt: "Couverture bleu marine de l’offre La Pétanque des Toqués",
    backdrop: "#0c3c52",
  },
];

export function Current() {
  const [active, setActive] = useState(0);
  const move = (direction: number) =>
    setActive((index) => (index + direction + covers.length) % covers.length);

  return (
    <main className="min-h-screen w-full">
      <section
        aria-label="Promotions xHACCP France"
        aria-roledescription="carousel"
        className="relative h-[360px] w-full overflow-hidden text-white md:h-[410px]"
        style={{ backgroundColor: covers[active].backdrop }}
      >
        {covers.map((cover, index) => (
          <img
            key={cover.src}
            src={cover.src}
            alt={cover.alt}
            aria-hidden={index !== active}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${
              index === active ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          />
        ))}

        <button
          type="button"
          aria-label="Promotion précédente"
          onClick={() => move(-1)}
          className="absolute left-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white transition hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Promotion suivante"
          onClick={() => move(1)}
          className="absolute right-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white transition hover:bg-black/60 focus:outline-none focus:ring-2 focus:ring-white"
        >
          <ChevronRight aria-hidden="true" />
        </button>

        <div
          className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2"
          role="tablist"
          aria-label="Choisir une promotion"
        >
          {covers.map((cover, index) => (
            <button
              key={cover.src}
              type="button"
              role="tab"
              aria-label={`Afficher la promotion ${index + 1}`}
              aria-selected={active === index}
              onClick={() => setActive(index)}
              className={`h-2.5 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-white ${
                active === index
                  ? "w-8 bg-white"
                  : "w-2.5 bg-white/50 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      </section>
    </main>
  );
}