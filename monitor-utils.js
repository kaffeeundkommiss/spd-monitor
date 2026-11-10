/* Reine Hilfsfunktionen für index.html (Formatierung, Escaping, dawum-Extraktion).
   In eigener Datei, damit sie ohne Browser/DOM getestet werden können. */
(function (root) {
  "use strict";

  function fmt(n) {
    return (Math.round(n * 10) / 10).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  /* Datumsanzeige, unabhängig von der Zeitzone des Lesers.

     "2026-09-06" ist ein Kalendertag, kein Zeitpunkt. new Date() legt es auf
     UTC-Mitternacht, und toLocaleDateString rechnete das bisher in die lokale Zone
     um – westlich von Greenwich kam dabei der Vortag heraus: ein Wahltermin vom
     06.09. stand in New York als 05.09. auf der Seite. Deshalb wird ein reines
     Datum ausdrücklich in UTC formatiert.

     Ein vollständiger Zeitstempel ("erstellt", dawums Last_Update) ist dagegen ein
     echter Zeitpunkt und wird in Berliner Zeit gezeigt – das ist die Zone, in der
     die Daten entstehen, und sie bleibt für alle Leser dieselbe. */
  function dfmt(s) {
    if (!s) return "";
    const nurDatum = /^\d{4}-\d{2}-\d{2}$/.test(String(s));
    const d = new Date(nurDatum ? s + "T00:00:00Z" : s);
    return isNaN(d) ? s : d.toLocaleDateString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric",
      timeZone: nurDatum ? "UTC" : "Europe/Berlin",
    });
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  /* Partei, um die es auf der Seite geht (dawum-Kürzel). Die einzige Stelle im Code,
     die die Partei festlegt; update.py hat dafür PARTEI. */
  const PARTEI = "SPD";

  function extractPartei(db, parlMatch, kuerzel) {
    const parties = db.Parties || {}, parls = db.Parliaments || {}, insts = db.Institutes || {};
    const ziel = (kuerzel || PARTEI).toUpperCase();
    const parteiId = Object.keys(parties).find((k) => (parties[k].Shortcut || "").toUpperCase() === ziel);
    const parlIds = Object.keys(parls).filter((k) => parlMatch((parls[k].Shortcut || "") + " " + (parls[k].Name || "")));
    const out = [];
    for (const s of Object.values(db.Surveys || {})) {
      if (!parlIds.includes(String(s.Parliament_ID))) continue;
      const v = s.Results && s.Results[parteiId];
      if (v == null) continue;
      out.push({ institut: (insts[s.Institute_ID] || {}).Name || "Institut " + s.Institute_ID, datum: s.Date, wert: Number(v) });
    }
    return out;
  }

  function filterByAge(rows, maxAgeDays, now) {
    if (maxAgeDays == null) return rows;
    now = now || new Date();
    // Vergleich auf Tagesebene (UTC-Mitternacht), damit "genau N Tage alt" wie in
    // update.py's filter_by_age() (das mit date-Objekten ohne Uhrzeit rechnet) zählt.
    const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    cutoff.setUTCDate(cutoff.getUTCDate() - maxAgeDays);
    return rows.filter((r) => {
      if (!r.datum) return false;
      const d = new Date(r.datum);
      return !isNaN(d) && d >= cutoff;
    });
  }

  /* Einen Wahltrend verwerfen, der zu alt ist, damit er nicht dauerhaft als Leitzahl
     stehen bleibt. Nötig, weil dawum den Wahltrend einer Ebene nicht mehr ausweist,
     sobald dort länger keine Umfragen erscheinen: die Routine findet dann keinen Wert
     mehr, der zuletzt gespeicherte würde ohne diese Prüfung ewig weitergezeigt.
     Gibt den Trend zurück, wenn er verwertbar ist, sonst null. */
  function filterTrend(trend, maxAgeDays, now) {
    if (!trend || trend.wert == null) return null;
    if (maxAgeDays == null) return trend;
    if (!trend.stand) return null; // ohne Stand nicht datierbar, also nicht als Leitzahl
    now = now || new Date();
    // Tagesebene (UTC-Mitternacht) wie in filterByAge, damit JS und update.py gleich rechnen.
    const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    cutoff.setUTCDate(cutoff.getUTCDate() - maxAgeDays);
    const d = new Date(trend.stand);
    return !isNaN(d) && d >= cutoff ? trend : null;
  }

  /* Wahl gelaufen und amtlich endgültig festgestellt: dann ist das Ergebnis maßgeblich
     und es braucht keine Umfragedaten mehr – weder gespeicherte noch frisch abgerufene.
     Ein noch vorläufiges Ergebnis zählt nicht, dort läuft die Aktualisierung weiter.
     Spiegelt abgeschlossen() in update.py. */
  function wahlAbgeschlossen(ebene) {
    const erg = (ebene && ebene.wahlergebnis) || {};
    return erg.wert != null && !erg.vorlaeufig;
  }

  /* Nach einer gelaufenen Wahl zählen nur die Umfragen, die nach dem Wahltag erhoben
     wurden: die älteren betreffen eine entschiedene Frage. Beide in einen Mittelwert zu
     legen ergibt keine aussagekräftige Zahl. Der Wahltag selbst gehört zur alten Wahl. */
  function rowsNachWahl(rows, wahltag) {
    if (!wahltag) return rows || [];
    return (rows || []).filter((r) => r.datum && r.datum > wahltag);
  }

  /* Reihenfolge der Panels: Bundesebene immer zuerst, dann die anstehenden Wahlen
     (nächster Termin zuerst), danach die bereits gelaufenen (zuletzt gewählte zuerst),
     ganz am Ende Ebenen ohne Wahltermin. Der Wahltag selbst zählt noch als anstehend. */
  function sortEbenen(ebenen, now) {
    now = now || new Date();
    const heute = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      .toISOString()
      .slice(0, 10);
    const bund = ebenen.filter((e) => e.id === "bund");
    const rest = ebenen.filter((e) => e.id !== "bund");
    const anstehend = rest
      .filter((e) => e.wahltermin != null && e.wahltermin >= heute)
      .sort((a, b) => a.wahltermin.localeCompare(b.wahltermin));
    const gelaufen = rest
      .filter((e) => e.wahltermin != null && e.wahltermin < heute)
      .sort((a, b) => b.wahltermin.localeCompare(a.wahltermin));
    const ohneTermin = rest.filter((e) => e.wahltermin == null);
    return [...bund, ...anstehend, ...gelaufen, ...ohneTermin];
  }

  /* Tagesgenaues Heute als ISO-Datum (UTC-Mitternacht), wie filterByAge und sortEbenen
     es benutzen – damit alle Datumsvergleiche dieselbe Grenze ziehen. */
  function heuteIso(now) {
    now = now || new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      .toISOString()
      .slice(0, 10);
  }

  /* Die Ebenen in die vier Blöcke der Seite teilen. Maßgeblich für "gelaufen" ist ein
     vorhandenes amtliches Ergebnis oder ein Wahltermin in der Vergangenheit – der
     Wahltag selbst zählt noch als anstehend (wie in sortEbenen). */
  function gruppiereEbenen(ebenen, now) {
    const heute = heuteIso(now);
    const sortiert = sortEbenen(ebenen || [], now);
    const gelaufen = (e) =>
      (e.wahlergebnis && e.wahlergebnis.wert != null) || (e.wahltermin != null && e.wahltermin < heute);
    return {
      bund: sortiert.filter((e) => e.id === "bund"),
      anstehend: sortiert.filter((e) => e.id !== "bund" && e.wahltermin != null && !gelaufen(e)),
      gelaufen: sortiert.filter((e) => e.id !== "bund" && gelaufen(e)),
      ohneTermin: sortiert.filter((e) => e.id !== "bund" && e.wahltermin == null && !gelaufen(e)),
    };
  }

  /* Volle Tage von heute bis zum Wahltermin. 0 = heute, null wenn kein Termin. */
  function tageBis(wahltermin, now) {
    if (!wahltermin) return null;
    const ziel = new Date(wahltermin + "T00:00:00Z");
    if (isNaN(ziel)) return null;
    return Math.round((ziel - new Date(heuteIso(now) + "T00:00:00Z")) / 86400000);
  }

  /* Lage zum Ergebnis der letzten Wahl derselben Ebene (vorwahl = {wert, jahr}), als
     Kurzform für Kacheln und als Satz für die Leitzahl. Für die SPD ist die 5-%-Hürde
     kein Maßstab; die Veränderung zur letzten Wahl ist es.
     Toleranz 0,05, weil überall auf eine Dezimale gerundet angezeigt wird: ein Wert,
     der als "±0,0" erscheint, darf nicht "unter" heißen. */
  function vergleichText(wert, vorwahl) {
    if (wert == null) return { status: "keine", kurz: "keine Daten", lang: "keine Umfragedaten" };
    if (!vorwahl || vorwahl.wert == null)
      return { status: "ohne", kurz: "ohne Vergleich", lang: "kein Vergleichswert hinterlegt" };
    const wahl = "Wahl " + (vorwahl.jahr || "");
    const diff = wert - vorwahl.wert;
    if (Math.abs(diff) < 0.05)
      return { status: "auf", kurz: "±0,0 zur " + wahl, lang: "gleichauf mit der " + wahl + " (" + fmt(vorwahl.wert) + " %)" };
    const punkte = fmt(Math.abs(diff)) + " Punkte";
    return diff < 0
      ? { status: "unter", kurz: "−" + fmt(-diff) + " zur " + wahl, lang: punkte + " unter der " + wahl + " (" + fmt(vorwahl.wert) + " %)" }
      : { status: "ueber", kurz: "+" + fmt(diff) + " zur " + wahl, lang: punkte + " über der " + wahl + " (" + fmt(vorwahl.wert) + " %)" };
  }

  /* Zeitreihe aufbereiten: auf das Fenster der letzten <tage> Tage beschränken, nach
     Datum sortieren, unbrauchbare Zeilen verwerfen. Tagesgenau wie filterByAge. */
  function verlaufPunkte(rows, tage, now) {
    now = now || new Date();
    const heute = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const ab = tage == null ? -Infinity : heute - tage * 86400000;
    return (rows || [])
      // Erst auf fehlende Werte prüfen: Number(null) ist 0, nicht NaN – eine Umfrage
      // ohne Parteiwert käme sonst als 0 % ins Diagramm und zöge das Mittel herunter.
      .filter((r) => r && r.datum && r.wert != null && r.wert !== "")
      .map((r) => ({ t: Date.parse(r.datum + "T00:00:00Z"), v: Number(r.wert), institut: r.institut }))
      .filter((p) => !isNaN(p.t) && !isNaN(p.v) && p.t >= ab && p.t <= heute)
      .sort((a, b) => a.t - b.t || String(a.institut).localeCompare(String(b.institut)));
  }

  /* Gleitendes Mittel über <fensterTage> Tage, je einen Wert pro Tag mit Umfragen.
     Ungewichtet: jede Umfrage im Fenster zählt gleich viel – darum weist die Quellenzeile
     unter dem Diagramm das ausdrücklich aus. Ein Punkt genau am Fensterrand zählt noch mit
     (wie überall sonst auf der Seite der Grenzfall "genau N Tage alt"). */
  function gleitendesMittel(punkte, fensterTage) {
    const fenster = fensterTage * 86400000;
    const tage = [...new Set((punkte || []).map((p) => p.t))].sort((a, b) => a - b);
    return tage.map((t) => {
      const drin = punkte.filter((p) => p.t <= t && t - p.t <= fenster);
      return { t, v: drin.reduce((s, p) => s + p.v, 0) / drin.length, n: drin.length };
    });
  }

  /* Gespeicherte Zeitreihe und frisch von dawum geholte Zeilen zusammenlegen.
     Zwischen zwei Routineläufen kennt die Seite neuere Umfragen als die Datei; die
     dürfen aber nicht doppelt gezählt werden, sonst verzerren sie das Mittel.
     Schlüssel ist Institut + Datum – genau eine Erhebung je Institut und Tag. */
  function mergeVerlauf(gespeichert, live) {
    const map = new Map();
    for (const r of [...(gespeichert || []), ...(live || [])]) {
      if (!r || !r.datum) continue;
      map.set(r.institut + "|" + r.datum, r);   // Live gewinnt, da zuletzt gesetzt
    }
    return [...map.values()];
  }

  /* Kennung einer Wochen-Momentaufnahme ("2026-KW45") aus dem Zeitstempel "erstellt".
     Maßgeblich ist das Kalenderdatum, wie es im Zeitstempel steht (Berliner Zeit), nicht
     die Zone des Lesers – sonst verwiese ein Link aus New York auf die Vorwoche.
     ISO-Woche wie Pythons date.isocalendar() in update.py, das die Datei anlegt. */
  function isoWoche(erstellt) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(erstellt || ""));
    if (!m) return null;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    const wt = d.getUTCDay() || 7;            // Mo=1 … So=7
    d.setUTCDate(d.getUTCDate() + 4 - wt);    // Donnerstag derselben Woche bestimmt das Jahr
    const jahr = d.getUTCFullYear();
    const woche = Math.ceil(((d - Date.UTC(jahr, 0, 1)) / 86400000 + 1) / 7);
    return jahr + "-KW" + String(woche).padStart(2, "0");
  }

  /* Statistische Unschärfe einer einzelnen Umfrage (95-%-Intervall, einfache
     Zufallsstichprobe) in Prozentpunkten. Richtwert: echte Umfragen sind gewichtet
     und haben eher größere Fehler. */
  function unschaerfe(prozent, befragte) {
    if (prozent == null || !befragte) return null;
    const p = prozent / 100;
    return 1.96 * Math.sqrt(p * (1 - p) / befragte) * 100;
  }

  const api = { fmt, dfmt, esc, PARTEI, extractPartei, sortEbenen, filterByAge, filterTrend, rowsNachWahl, gruppiereEbenen, tageBis, vergleichText, wahlAbgeschlossen, verlaufPunkte, gleitendesMittel, mergeVerlauf, isoWoche, unschaerfe };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.MonitorUtils = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
