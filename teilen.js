/* Teilen: Permalink und Bild je Karte – für Social Media und Blogposts.

   Jedes Element mit data-teilen="<Titel>" und einer id bekommt unten rechts zwei
   Knöpfe:
   - „Link kopieren": kopiert die Adresse der Seite mit #id (auf dem Handy über das
     Teilen-Menü des Systems). Eine Momentaufnahme (?stand=…) bleibt im Link, damit
     ein Blogpost auch später dieselben Zahlen zeigt.
   - „Als Bild": rendert die Karte als PNG (doppelte Auflösung) und hängt eine Fußzeile
     mit Quelle, Stand und Adresse an, damit ein Screenshot nicht ohne Beleg kursiert.
     Die Bibliothek dafür (vendor/html-to-image) wird erst beim ersten Klick geladen.

   Quelle und Stand liest die Fußzeile aus data-quelle / data-stand des Elements,
   sonst aus Teilen.init({quelle, stand}). */
(function (root) {
  "use strict";

  const H2I = "vendor/html-to-image-1.11.11.js";
  let opts = { quelle: "", stand: "" };
  let h2iLaden = null;

  function link(id) {
    const u = new URL(location.href);
    u.hash = id ? "#" + id : "";
    return u.toString();
  }

  function rueckmeldung(knopf, text) {
    const alt = knopf.dataset.label;
    knopf.textContent = text;
    knopf.classList.add("ok");
    setTimeout(() => { knopf.textContent = alt; knopf.classList.remove("ok"); }, 1800);
  }

  async function kopiereLink(el, knopf) {
    const url = link(el.id);
    const touch = matchMedia("(pointer:coarse)").matches;
    if (touch && navigator.share) {
      try { await navigator.share({ title: document.title + " · " + el.dataset.teilen, url }); return; }
      catch (e) { if (e && e.name === "AbortError") return; }
    }
    try {
      await navigator.clipboard.writeText(url);
      rueckmeldung(knopf, "Kopiert");
    } catch (e) {
      // Ohne Zwischenablage (z. B. http oder alter Browser): Adresse zeigen.
      window.prompt("Link zu diesem Abschnitt:", url);
    }
  }

  function ladeH2I() {
    if (root.htmlToImage) return Promise.resolve(root.htmlToImage);
    if (!h2iLaden) {
      h2iLaden = new Promise((ok, fehler) => {
        const s = document.createElement("script");
        s.src = H2I;
        s.onload = () => ok(root.htmlToImage);
        s.onerror = () => { h2iLaden = null; fehler(new Error("Bild-Export konnte nicht geladen werden")); };
        document.head.appendChild(s);
      });
    }
    return h2iLaden;
  }

  function dateiname(el) {
    const d = new Date().toISOString().slice(0, 10);
    return "spd-monitor-" + el.id + "-" + d + ".png";
  }

  async function exportiereBild(el, knopf) {
    knopf.disabled = true;
    knopf.textContent = "…";
    const fuss = document.createElement("div");
    fuss.className = "teilen-fuss";
    // Steht im Abschnitt schon eine Quellenzeile, reicht im Fuß Stand und Adresse.
    const quelle = el.querySelector(".quelle, .fv-quelle") ? "" : (el.dataset.quelle || opts.quelle);
    const stand = el.dataset.stand || opts.stand;
    fuss.innerHTML = "<span></span><span></span>";
    fuss.children[0].textContent = [quelle && "Quelle: " + quelle, stand].filter(Boolean).join(" · ");
    fuss.children[1].textContent = link(el.id).replace(/^https?:\/\//, "");
    el.appendChild(fuss);
    el.classList.add("teilen-export");
    try {
      const h2i = await ladeH2I();
      const transparent = (c) => !c || c === "transparent" || c === "rgba(0, 0, 0, 0)";
      let bg = getComputedStyle(el).backgroundColor;
      if (transparent(bg)) bg = getComputedStyle(document.body).backgroundColor;
      const url = await h2i.toPng(el, {
        pixelRatio: 2,
        backgroundColor: transparent(bg) ? "#ffffff" : bg,
        // Die Knöpfe selbst gehören nicht ins Bild.
        filter: (n) => !(n.classList && n.classList.contains("teilen-leiste")),
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = dateiname(el);
      document.body.appendChild(a);
      a.click();
      a.remove();
      rueckmeldung(knopf, "Gespeichert");
    } catch (e) {
      console.error("Bild-Export:", e);
      rueckmeldung(knopf, "Fehler");
    } finally {
      fuss.remove();
      el.classList.remove("teilen-export");
      knopf.disabled = false;
    }
  }

  function knopf(label, titel, aktion) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "teilen-knopf";
    b.textContent = label;
    b.dataset.label = label;
    b.title = titel;
    b.setAttribute("aria-label", titel);
    b.addEventListener("click", aktion);
    return b;
  }

  function ausstatten(el) {
    if (!el.id || el.hidden || el.querySelector(":scope > .teilen-leiste")) return;
    const leiste = document.createElement("div");
    leiste.className = "teilen-leiste";
    const name = el.dataset.teilen;
    leiste.append(
      knopf("Link kopieren", "Link zu „" + name + "“ kopieren", function () { kopiereLink(el, this); }),
      knopf("Als Bild", "„" + name + "“ als Bild speichern", function () { exportiereBild(el, this); })
    );
    el.classList.add("teilbar");
    // Ans Ende, nicht rechts oben: dort stehen Überschriften und Legenden.
    el.append(leiste);
  }

  // Gemeinsame Optik für beide Seiten; nutzt deren Farbvariablen.
  const CSS = `
  .teilbar{position:relative}
  .teilen-leiste{display:flex;justify-content:flex-end;gap:6px;margin-top:12px}
  .teilen-knopf{font:600 13px/1 var(--body,sans-serif);padding:9px 12px;min-height:36px;border:1px solid var(--line);
    border-radius:6px;background:var(--paper,#fff);color:var(--mute);cursor:pointer}
  .teilen-knopf:hover{color:var(--ink);border-color:var(--mute)}
  .teilen-knopf.ok{color:var(--ok-fg,#1E4FD8);border-color:currentColor}
  .teilen-export{padding:16px}
  .karte.teilen-export,.diagramm.teilen-export{padding:24px 28px}
  .teilen-fuss{display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px 16px;margin-top:16px;padding-top:10px;
    border-top:1px solid var(--line);font-size:13px;color:var(--mute)}
  .teilen-fuss span:first-child{flex:1 1 320px}
  .teilen-fuss span:last-child{font-family:var(--mono,monospace);color:var(--ink)}
  .angesprungen{outline:2px solid #E3000F;outline-offset:4px;border-radius:var(--r,12px);transition:outline-color 1s}`;

  function stil() {
    if (document.getElementById("teilen-stil")) return;
    const st = document.createElement("style");
    st.id = "teilen-stil";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* Nach dem Rendern aufrufen: Knöpfe anbringen und zum #Anker springen. Der Browser
     springt beim Laden selbst nicht hin, weil die Inhalte erst nachträglich entstehen. */
  function init(o) {
    opts = Object.assign(opts, o || {});
    stil();
    document.querySelectorAll("[data-teilen]").forEach(ausstatten);
    const id = decodeURIComponent(location.hash.slice(1));
    const ziel = id && document.getElementById(id);
    if (ziel) {
      ziel.scrollIntoView({ block: "start" });
      ziel.classList.add("angesprungen");
      setTimeout(() => ziel.classList.remove("angesprungen"), 2400);
    }
  }

  const api = { init, link };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Teilen = api;
})(typeof window !== "undefined" ? window : globalThis);
