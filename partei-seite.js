/* Skript von partei.html (Daten: partei.json).
   Jede Seite enthält nur einen Teil der Abschnitte; was fehlt, wird übersprungen. */
(async function(){
  const {fmt, dfmt, esc} = window.MonitorUtils || {};
  const PU = window.ParteiUtils;
  const $ = (id) => document.getElementById(id);
  if(!fmt || !PU) throw new Error('Hilfsdateien nicht geladen – bitte die Seite neu laden.');

  const d = await (await fetch('partei.json?t=' + Date.now(), {cache: 'no-store'})).json();
  document.getElementById('stand').textContent = 'Stand ' + (d.stand ? dfmt(d.stand) : 'unbekannt');
  // Quelle je Abschnitt, damit sie auch auf einem Screenshot oder exportierten Bild steht.
  document.querySelectorAll('.quelle[data-beleg]').forEach((p) => {
    const k = p.dataset.beleg;
    const links = ((d.belege || {})[k] || []).filter((b) => /^https:\/\//.test(b.url || ''))
      .map((b) => `<a href="${esc(b.url)}" rel="noopener">${esc(b.name)}</a>`);
    const hinweis = (d.belege_hinweis || {})[k];
    const teile = [links.length ? 'Quelle: ' + links.join(' · ') : '', hinweis ? esc(hinweis) : ''].filter(Boolean);
    if(teile.length) p.innerHTML = teile.join(' '); else p.remove();
  });

  // Rollen, die in den Daten vorkommen; die SPD war seit 1949 immer im Bundestag.
  const ROLLEN_ALLE = [['Regierung', 'var(--partei)'], ['Opposition', 'var(--opp)'], ['Nicht im Bundestag', 'var(--huerde)']];
  const ROLLEN = ROLLEN_ALLE.filter(([r]) => (d.wahlen || []).some((w) => w.rolle === r)
    || (d.zeitleiste || []).some((z) => z.status === r));
  const rolleFarbe = (r) => (ROLLEN.find((x) => x[0] === r) || [, 'var(--opp)'])[1];
  const sign = (v) => (v > 0 ? '+' : v < 0 ? '−' : '±') + fmt(Math.abs(v));

  const NS = 'http://www.w3.org/2000/svg';
  const el = (n, a, eltern) => { const e = document.createElementNS(NS, n);
    for(const k in a) e.setAttribute(k, a[k]); if(eltern) eltern.appendChild(e); return e; };
  const txt = (eltern, a, t) => { const e = el('text', a, eltern); e.textContent = t; return e; };
  // Breite eines Textes im SVG messen, damit Ränder zum längsten Label passen.
  const textBreite = (svg, liste, cls) => { let b = 0;
    liste.forEach((t) => { const e = txt(svg, {class: cls || ''}, t); b = Math.max(b, e.getComputedTextLength()); e.remove(); });
    return Math.ceil(b); };
  const legende = (id, eintraege) => {
    const l = document.getElementById(id); l.replaceChildren();
    eintraege.forEach(([farbe, name, stil]) => { const s = document.createElement('span'), i = document.createElement('i');
      i.style.background = farbe; if(stil) Object.assign(i.style, stil);
      s.append(i, name); l.appendChild(s); });
  };

  // Tooltip je Diagramm: eine Kopfzeile, darunter Zeilen. Antippen zeigt ihn auch am Handy.
  function tooltip(host){
    const tip = document.createElement('div'); tip.className = 'tip'; host.appendChild(tip);
    return {
      zeige(ev, kopf, zeilen){
        tip.replaceChildren();
        const z = (t, c) => { const e = document.createElement('div'); if(c) e.className = c; e.textContent = t; tip.appendChild(e); };
        z(kopf, 'k'); zeilen.forEach((t, i) => z(t, i === 0 ? 'm' : ''));
        tip.style.display = 'block';
        const r = host.getBoundingClientRect(), b = tip.offsetWidth, h = tip.offsetHeight;
        let x = ev.clientX - r.left + 12, y = ev.clientY - r.top + 12;
        if(x + b > r.width) x = Math.max(0, ev.clientX - r.left - b - 12);
        if(y + h > r.height) y = Math.max(0, ev.clientY - r.top - h - 12);
        tip.style.left = x + 'px'; tip.style.top = y + 'px';
      },
      weg(){ tip.style.display = 'none'; },
    };
  }
  const hover = (e, tip, f) => { e.addEventListener('pointermove', f); e.addEventListener('pointerdown', f);
    e.addEventListener('pointerleave', () => tip.weg()); };

  // ---------- Kennzahlen ----------
  const k = PU.kennzahlen(d.wahlen);
  if(k && $('kennzahlen')){
    const regierung = d.wahlen.filter((w) => w.rolle === 'Regierung').length;
    document.getElementById('kennzahlen').innerHTML = [
      ['Bestes Ergebnis', fmt(k.best.ergebnis) + ' %', 'Bundestagswahl ' + k.best.jahr, ''],
      ['Letztes Ergebnis', fmt(k.letzte.ergebnis) + ' %', 'Bundestagswahl ' + k.letzte.jahr + ' · ' + k.letzte.rolle, ''],
      ['In Regierung danach', regierung + ' von ' + k.anzahl, 'Wahlperioden nach den Wahlen ' + d.wahlen[0].jahr + '–' + k.letzte.jahr, ''],
    ].map(([l, n, s, c]) => `<div class="karte"><div class="lbl">${esc(l)}</div><div class="num ${c}">${esc(n)}</div><div class="sub">${esc(s)}</div></div>`).join('');
  }

  // ---------- Bundesvorsitzende: Kennzahlen und Tabelle ----------
  // Laufende Amtszeit zählt bis heute, deshalb einmal beim Laden berechnet.
  const zeiten = PU.amtszeiten(d.vorsitzende);
  const vk = PU.amtsKennzahlen(zeiten);
  const jahre = (v) => fmt(v) + ' J.';
  if(vk && $('vorsitz-kennzahlen')){
    document.getElementById('vorsitz-kennzahlen').innerHTML = [
      [d.vorsitz_titel || 'Amtszeiten', String(vk.anzahl), vk.amtierend ? 'amtierend: ' + vk.amtierend.name : ''],
      ['Längste Amtszeit', jahre(vk.laengste.jahre), vk.laengste.name + (vk.laengste.laufend ? ' (amtierend)' : '')],
      ['Kürzeste Amtszeit', jahre(vk.kuerzeste.jahre), vk.kuerzeste.name],
      ['Ø Amtszeit', jahre(vk.mittel), 'abgeschlossene Amtszeiten'],
    ].map(([l, n, s]) => `<div class="karte"><div class="lbl">${esc(l)}</div><div class="num">${esc(n)}</div><div class="sub">${esc(s)}</div></div>`).join('');
  }
  const tbody = document.querySelector('#tabelle-vorsitz tbody');
  if(tbody) tbody.innerHTML = zeiten.map((z) =>
    `<tr${z.laufend ? ' class="laufend"' : ''}><td class="zahl">${z.nr}</td><td>${esc(z.name)}</td>
      <td class="datum">${dfmt(z.beginn)}</td><td class="datum">${z.ende ? dfmt(z.ende) : 'amtierend'}</td>
      <td class="zahl">${fmt(z.jahre)}</td></tr>`).join('');

  // ---------- Bundesvorsitzende: Zeitstrahl ----------
  function vorsitzChart(){
    const host = document.getElementById('chart-vorsitz'); host.replaceChildren();
    const W = Math.max(280, host.clientWidth), schmal = W < 520;
    // Auf schmalen Schirmen nur Nachnamen, sonst bleibt für die Balken kaum Platz.
    const name = (z) => schmal ? z.name.split(' ').slice(-1)[0] : z.name;
    const svg = el('svg', {role: 'img', 'aria-label': 'Amtszeiten der SPD-Vorsitzenden: '
      + zeiten.map((z) => z.name + ' ' + fmt(z.jahre) + ' Jahre').join(', ')}, host);
    const ml = textBreite(svg, zeiten.map(name), 'stark') + 10;
    const mr = textBreite(svg, zeiten.map((z) => jahre(z.jahre)), 'wert') + 8;
    const mt = 4, mb = 24, zh = 24, H = mt + zeiten.length * zh + mb;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const von = Date.UTC(Math.min(...zeiten.map((z) => new Date(z.a).getUTCFullYear())), 0, 1), bis = Math.max(...zeiten.map((z) => z.b));
    const X = (t) => ml + (t - von) / (bis - von) * (W - ml - mr);
    const tip = tooltip(host);
    const schritt = schmal ? 20 : 10;
    for(let j = 1950; j <= new Date(bis).getUTCFullYear(); j += schritt){
      el('line', {x1: X(Date.UTC(j, 0, 1)), x2: X(Date.UTC(j, 0, 1)), y1: mt, y2: H - mb, stroke: 'var(--line)'}, svg);
      txt(svg, {x: X(Date.UTC(j, 0, 1)), y: H - 6, 'text-anchor': 'middle'}, j);
    }
    zeiten.forEach((z, i) => {
      const y = mt + i * zh, m = y + zh / 2;
      txt(svg, {x: ml - 8, y: m, dy: '0.32em', 'text-anchor': 'end', class: 'stark'}, name(z));
      const b = el('rect', {x: X(z.a), y: y + 4, width: Math.max(3, X(z.b) - X(z.a)), height: zh - 8, rx: 4,
        fill: z.laufend ? 'var(--partei)' : 'var(--ink)'}, svg);
      hover(b, tip, (ev) => tip.zeige(ev, z.nr + '. ' + z.name, [
        fmt(z.jahre) + ' Jahre' + (z.laufend ? ' (amtierend)' : ''),
        dfmt(z.beginn) + ' – ' + (z.ende ? dfmt(z.ende) : 'heute')]));
      txt(svg, {x: X(z.b) + 5, y: m, dy: '0.32em', class: 'wert'}, jahre(z.jahre));
    });
  }

  // ---------- Bundestagswahlen ----------
  function wahlen(){
    const host = document.getElementById('chart-wahlen'); host.replaceChildren();
    const rows = d.wahlen, W = Math.max(280, host.clientWidth), H = 250, schmal = W < 420;
    const ml = 30, mr = 6, mt = 22, mb = 26;
    const yMax = Math.max(16, Math.ceil(Math.max(...rows.map((r) => r.ergebnis)) / 10) * 10);
    const band = (W - ml - mr) / rows.length, bw = Math.min(32, band * 0.62);
    const X = (i) => ml + i * band + band / 2, Y = (v) => H - mb - v / yMax * (H - mt - mb);
    const svg = el('svg', {viewBox: `0 0 ${W} ${H}`, role: 'img',
      'aria-label': 'SPD-Ergebnisse bei Bundestagswahlen ' + rows.map((r) => r.jahr + ': ' + fmt(r.ergebnis) + ' %').join(', ')}, host);
    const tip = tooltip(host);
    for(let v = 0; v <= yMax; v += 10){
      el('line', {x1: ml, x2: W - mr, y1: Y(v), y2: Y(v), stroke: 'var(--line)'}, svg);
      txt(svg, {x: ml - 6, y: Y(v), dy: '0.32em', 'text-anchor': 'end'}, v);
    }
    rows.forEach((r, i) => {
      const b = el('rect', {x: X(i) - bw / 2, y: Y(r.ergebnis), width: bw, height: Y(0) - Y(r.ergebnis),
        rx: 4, fill: rolleFarbe(r.rolle)}, svg);
      hover(b, tip, (ev) => tip.zeige(ev, 'Bundestagswahl ' + dfmt(r.datum), [
        fmt(r.ergebnis) + ' % · ' + r.sitze + ' Sitze', ...(r.programm ? ['Programm: ' + r.programm] : []),
        'Vorsitz: ' + r.vorsitz, 'Danach: ' + r.rolle]));
      txt(svg, {x: X(i), y: Y(r.ergebnis) - 6, 'text-anchor': 'middle', class: 'wert frei'}, fmt(r.ergebnis));
      txt(svg, {x: X(i), y: H - 8, 'text-anchor': 'middle'}, schmal ? "'" + String(r.jahr).slice(2) : r.jahr);
    });
    legende('legende-wahlen', ROLLEN.map(([n, f]) => [f, n]));
  }

  // ---------- Zeitleiste ----------
  const SPUREN = ['Rolle im Bund', 'Vorsitz', 'Grundsatzprogramm', 'Neues Programm'];
  function zeitleiste(){
    const host = document.getElementById('chart-zeit'); host.replaceChildren();
    const jetzt = new Date();
    const von = Date.UTC(1998, 0, 1), bis = Date.UTC(jetzt.getUTCFullYear(), jetzt.getUTCMonth(), jetzt.getUTCDate());
    const balken = PU.zeitBalken(d.zeitleiste, von, bis);
    const W = Math.max(280, host.clientWidth), ml = 4, mr = 4, mt = 4, mb = 24, lh = 26, kopf = 16;
    const H = mt + SPUREN.length * (lh + kopf + 4) + mb;
    const X = (t) => ml + (t - von) / (bis - von) * (W - ml - mr);
    const spurY = (i) => mt + i * (lh + kopf + 4) + kopf;
    const svg = el('svg', {viewBox: `0 0 ${W} ${H}`, role: 'img',
      'aria-label': 'Zeitleiste: ' + balken.filter((b) => b.spur === 'Vorsitz').map((b) => b.label).join(', ')}, host);
    const tip = tooltip(host);
    d.wahlen.forEach((w) => { const x = X(PU.monat(w.datum));
      el('line', {x1: x, x2: x, y1: mt, y2: H - mb, stroke: 'var(--opp)', 'stroke-dasharray': '3 3'}, svg); });
    const schritt = W < 480 ? 8 : 4;
    for(let j = 2000; j <= jetzt.getUTCFullYear(); j += schritt)
      txt(svg, {x: X(Date.UTC(j, 0, 1)), y: H - 6, 'text-anchor': 'middle'}, j);
    SPUREN.forEach((s, i) => txt(svg, {x: ml, y: spurY(i) - 5, class: 'stark'}, s));
    const vorsitz = balken.filter((b) => b.spur === 'Vorsitz');
    const farbe = (b) => b.spur === 'Rolle im Bund' ? rolleFarbe(b.status)
      : b.spur === 'Vorsitz' ? (vorsitz.indexOf(b) % 2 ? '#4A505B' : 'var(--ink)') : '#F2B8BC';
    const mfmt = (t) => new Date(t).toLocaleDateString('de-DE', {month: '2-digit', year: 'numeric', timeZone: 'UTC'});
    const unbeschriftet = new Set();   // Spuren mit mindestens einem Balken ohne Platz für sein Label
    balken.forEach((b) => {
      const i = SPUREN.indexOf(b.spur); if(i < 0) return;
      const x0 = X(b.x0) + 1, w = Math.max(2, X(b.x1) - X(b.x0) - 2);
      const r = el('rect', {x: x0, y: spurY(i), width: w, height: lh, rx: 4, fill: farbe(b),
        'fill-opacity': b.status === 'in Arbeit' ? .45 : 1}, svg);
      hover(r, tip, (ev) => tip.zeige(ev, b.spur, [b.label, mfmt(b.a) + ' bis ' + (b.laeuft ? 'heute' : mfmt(b.b))]));
      const hell = b.spur === 'Vorsitz' || b.status === 'Regierung' || b.status === 'Nicht im Bundestag';
      const t = txt(svg, {x: x0 + 6, y: spurY(i) + lh / 2, dy: '0.32em', 'pointer-events': 'none'}, b.label);
      t.style.fill = hell ? '#FFFFFF' : 'var(--ink)';
      if(t.getComputedTextLength() > w - 10){ t.remove(); unbeschriftet.add(b.spur); }
    });

    // Farblegende für die Rolle im Bund, wie beim Diagramm der Bundestagswahlen.
    document.getElementById('legende-zeit').innerHTML = ROLLEN.map(([n, f]) =>
      `<span><i style="background:${f}"></i>${esc(n)}</span>`).join('');
    // Fehlen Beschriftungen (am Handy die Regel), stehen die Namen als Liste darunter.
    // Die Rolle im Bund deckt die Farblegende ab.
    const schl = document.getElementById('schluessel-zeit');
    const spuren = SPUREN.filter((s) => s !== 'Rolle im Bund' && unbeschriftet.has(s));
    schl.hidden = !spuren.length;
    schl.innerHTML = spuren.map((s) => `<dt>${esc(s)}</dt><dd>${
      balken.filter((b) => b.spur === s).map((b) => esc(b.label)).join(' · ')}</dd>`).join('');
  }

  // Jede Seite zeichnet nur die Diagramme, die sie enthält.
  const diagramme = [['chart-wahlen', wahlen], ['chart-zeit', zeitleiste], ['chart-vorsitz', vorsitzChart]];
  const alles = () => diagramme.forEach(([id, f]) => { if($(id)) f(); });
  alles();
  if(window.Teilen) Teilen.init({quelle: 'redaktionell zusammengestellt', stand: d.stand ? 'Stand ' + dfmt(d.stand) : ''});
  let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(alles, 150); });
})().catch((e) => {
  console.error('SPD-Monitor (Partei):', e);
  const el = document.getElementById('kennzahlen') || document.querySelector('main section');
  if(el) el.innerHTML = '<div class="fehler"><strong>Die Seite konnte nicht geladen werden.</strong><br>'
    + 'Technischer Hinweis: ' + String(e && e.message ? e.message : e).replace(/[&<>]/g, '') + '</div>';
});
