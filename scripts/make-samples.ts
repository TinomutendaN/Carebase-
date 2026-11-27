/**
 * Makes the 8 demo documents in public/samples/: 5 intake forms and 3 referral letters.
 * Run once: `npm run samples`. Needs Google Chrome (or Edge) installed; no npm packages.
 *
 * Each document is an HTML page rendered by headless Chrome:
 * - "text" PDFs are printed straight to PDF (with a text layer)
 * - "scan" files are screenshotted with a flatbed-scan look (grey, slight tilt, speckle);
 *   a scanned PDF is that screenshot printed to PDF, so it has no text layer
 * - "photo" files are screenshotted with a phone-photo look (desk, tilt, perspective,
 *   uneven light, grain), then encoded as JPEG by Chrome's own canvas
 *
 * Every made-up name is checked against the patients table first: only Bert Hammes
 * (MRN 76057, the referral demo case) may match an existing patient.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";

const OUT_DIR = resolve("public/samples");
const WORK_DIR = join(tmpdir(), "carebase-samples");
const MAX_BYTES = 4 * 1024 * 1024;

const CHROME_PATHS = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean) as string[];

type Style = "text" | "scan" | "photo";
type Output = "pdf" | "png" | "jpg";

type IntakeForm = {
  kind: "intake";
  file: string;
  style: Style;
  handwritten?: boolean;
  name: string;
  dob: string; // as written on the form, DD/MM/YYYY
  phone: string;
  address: string;
  insurer: string;
  memberId: string;
  validTo: string;
  medications: string[]; // empty: the patient wrote "None"
  allergies: string;
  reason: string;
  signedOn: string;
};

type Referral = {
  kind: "referral";
  file: string;
  style: Style;
  practice: string;
  practiceAddress: string;
  doctor: string;
  letterDate: string;
  urgency: "Routine" | "Soon" | "Urgent";
  patient: string;
  dob: string | null; // null: left off the letter
  body: string[];
  reason: string | null; // null: no reason given
};

type Doc = IntakeForm | Referral;

const DOCS: Doc[] = [
  {
    kind: "intake", file: "intake_01.pdf", style: "text",
    name: "Anika Venkataraman", dob: "22/07/1985", phone: "(555) 014-2290", address: "18 Alder Row, Brookfield",
    insurer: "Harborview Mutual", memberId: "HMV-448210", validTo: "30/06/2027",
    medications: ["Levothyroxine 75 mcg once daily"], allergies: "Penicillin (rash)",
    reason: "Annual check-up and thyroid review", signedOn: "21/11/2026",
  },
  {
    kind: "intake", file: "intake_02.jpg", style: "photo", handwritten: true,
    name: "Tomasz Wierzbicki", dob: "02/11/1958", phone: "(555) 018-7741", address: "4 Quarry Lane, Eastmoor",
    insurer: "Keystone Health Plan", memberId: "KHP 7730192", validTo: "31/03/2027",
    medications: ["Metformin 500 mg twice daily", "Atorvastatin 20 mg at night"], allergies: "None known",
    reason: "Diabetes follow-up, feeling tired", signedOn: "23/11/2026",
  },
  {
    kind: "intake", file: "intake_03.png", style: "scan",
    name: "Marisol Quintero", dob: "09/05/1992", phone: "(555) 012-6083", address: "77 Fenwick Court, Apt 3",
    insurer: "Pinecrest Health", memberId: "PCH-55102-7", validTo: "31/12/2027",
    medications: ["Sertraline 50 mg once daily", "Cetirizine 10 mg as needed"], allergies: "Latex",
    reason: "Persistent cough for three weeks", signedOn: "24/11/2026",
  },
  {
    kind: "intake", file: "intake_04.jpg", style: "photo", handwritten: true,
    name: "Daniel Okafor", dob: "14/03/1979", phone: "(555) 019-3356", address: "212 Wren Street, Millbank",
    insurer: "BlueRiver Health", memberId: "BRH-209331", validTo: "31/10/2026",
    medications: ["Amlodipine 5 mg once daily"], allergies: "None known",
    reason: "Recurring headaches", signedOn: "25/11/2026",
  },
  {
    kind: "intake", file: "intake_05.pdf", style: "scan",
    name: "Eleanor Fitzwilliam", dob: "28/01/1947", phone: "(555) 011-5902", address: "9 Orchard Mews, Halden",
    insurer: "Silverline Senior Care", memberId: "SSC 4410-882", validTo: "30/09/2027",
    medications: [], allergies: "Sulfa drugs",
    reason: "New patient registration, right knee pain", signedOn: "26/11/2026",
  },
  {
    kind: "referral", file: "referral_01.pdf", style: "text",
    practice: "Riverside Family Practice", practiceAddress: "40 Mill Road, Riverside · (555) 010-4400",
    doctor: "Dr Priya Nair", letterDate: "20 November 2026", urgency: "Routine",
    patient: "Bert Hammes", dob: "17/10/1969",
    body: [
      "Dear colleague,",
      "I am referring the patient below for review of his diabetes control. His HbA1c has risen over his last three results despite good adherence to his current treatment, and I would value your opinion on next steps.",
    ],
    reason: "Review of rising HbA1c",
  },
  {
    kind: "referral", file: "referral_02.jpg", style: "photo",
    practice: "Lakeside Medical Group", practiceAddress: "3 Harbour Walk, Lakeside · (555) 017-2100",
    doctor: "Dr Marcus Feld", letterDate: "18 November 2026", urgency: "Soon",
    patient: "Ingrid Solberg", dob: "03/08/1974",
    body: [
      "Dear colleague,",
      "Thank you for seeing this patient, who has had episodes of a racing heartbeat over the past two months. Her resting ECG in clinic was normal.",
    ],
    reason: "Palpitations and breathlessness on exertion, for cardiology review",
  },
  {
    kind: "referral", file: "referral_03.pdf", style: "scan",
    practice: "Northgate Clinic", practiceAddress: "112 Northgate Parade · (555) 013-8800",
    doctor: "Dr Sam Lee", letterDate: "24 November 2026", urgency: "Urgent",
    patient: "Joseph Moyo", dob: null,
    body: [
      "Dear colleague,",
      "I would be grateful if you could see this patient at your earliest convenience. He is happy to be contacted directly to arrange a time.",
    ],
    reason: null,
  },
];

// ---------- HTML ----------

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const HAND = "'Segoe Print', 'Ink Free', 'Bradley Hand', 'Comic Sans MS', cursive";

function intakeHtml(d: IntakeForm): string {
  const answer = (v: string) =>
    `<span class="answer">${esc(v)}</span>`;
  const box = (label: string, value: string, wide = false) =>
    `<div class="box${wide ? " wide" : ""}"><span class="label">${label}</span>${answer(value)}</div>`;
  return `
    <header class="form-head">
      <div><div class="clinic">MAPLE STREET CLINIC</div><div class="small">220 Maple Street · (555) 010-1200</div></div>
      <div class="small right">Form IF-2<br>Page 1 of 1</div>
    </header>
    <h1>PATIENT INTAKE FORM</h1>
    <p class="small">Please complete in BLOCK CAPITALS or clear handwriting. Dates as DD/MM/YYYY.</p>
    <section class="grid">
      ${box("FULL NAME", d.name, true)}
      ${box("DATE OF BIRTH", d.dob.replace(/\//g, " / "))}
      ${box("PHONE", d.phone)}
      ${box("ADDRESS", d.address, true)}
    </section>
    <h2>Insurance</h2>
    <section class="grid">
      ${box("INSURANCE PROVIDER", d.insurer)}
      ${box("MEMBER ID", d.memberId)}
      ${box("CARD VALID TO", d.validTo)}
    </section>
    <h2>Health</h2>
    <section class="grid">
      <div class="box wide tall"><span class="label">CURRENT MEDICATIONS (name, dose, how often)</span><span class="answer">${d.medications.length ? d.medications.map(esc).join("<br>") : "None"}</span></div>
      ${box("ALLERGIES", d.allergies, true)}
      ${box("REASON FOR VISIT", d.reason, true)}
    </section>
    <section class="sign">
      <div class="box"><span class="label">SIGNATURE</span><span class="answer sig">${esc(d.name.split(" ")[0][0] + ". " + d.name.split(" ").slice(-1)[0])}</span></div>
      ${box("DATE", d.signedOn)}
    </section>
    <p class="small foot">Office use only: ______________ &nbsp; Synthetic demo document. Not a real patient.</p>`;
}

function referralHtml(d: Referral): string {
  return `
    <header class="letterhead">
      <div class="clinic">${esc(d.practice.toUpperCase())}</div>
      <div class="small">${esc(d.practiceAddress)}</div>
    </header>
    <div class="meta">
      <div>To: Maple Street Clinic<br>220 Maple Street</div>
      <div class="right">${esc(d.letterDate)}<br><strong>${d.urgency.toUpperCase()}</strong></div>
    </div>
    <h1 class="re">Re: Referral</h1>
    <table class="pt">
      <tr><th>Patient</th><td>${esc(d.patient)}</td></tr>
      ${d.dob ? `<tr><th>Date of birth</th><td>${d.dob}</td></tr>` : ""}
      ${d.reason ? `<tr><th>Reason for referral</th><td>${esc(d.reason)}</td></tr>` : ""}
      <tr><th>Urgency</th><td>${d.urgency}</td></tr>
    </table>
    ${d.body.map((p) => `<p>${esc(p)}</p>`).join("")}
    <p>Yours sincerely,</p>
    <p class="sig">${esc(d.doctor)}</p>
    <p>${esc(d.doctor)}<br>${esc(d.practice)}</p>
    <p class="small foot">Synthetic demo document. Not a real patient.</p>`;
}

const BASE_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  .paper { width: 794px; min-height: 1123px; padding: 56px 60px; background: #fff; color: #1d1d1d;
           font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.45; position: relative; }
  .form-head, .letterhead { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1d1d1d; padding-bottom: 10px; }
  .letterhead { flex-direction: column; border-bottom-color: #2c4a6e; }
  .letterhead .clinic { color: #2c4a6e; }
  .clinic { font-weight: 700; letter-spacing: 0.08em; font-size: 16px; }
  .small { font-size: 11px; color: #555; }
  .right { text-align: right; }
  h1 { font-size: 20px; letter-spacing: 0.12em; margin: 22px 0 4px; }
  h1.re { letter-spacing: 0; font-size: 16px; }
  h2 { font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; margin: 20px 0 6px; color: #333; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; }
  .box { border: 1px solid #8a8a8a; padding: 6px 10px 8px; min-height: 52px; display: flex; flex-direction: column; gap: 4px; }
  .box.wide { grid-column: span 2; }
  .box.tall { min-height: 92px; }
  .label { font-size: 10px; letter-spacing: 0.1em; color: #666; }
  .answer { font-family: 'Courier New', monospace; font-size: 16px; color: #111; }
  .sign { display: grid; grid-template-columns: 2fr 1fr; gap: 14px; margin-top: 22px; }
  .sig { font-family: ${HAND}; font-size: 20px; color: #1b2f73; }
  .meta { display: flex; justify-content: space-between; margin: 26px 0 8px; }
  table.pt { border-collapse: collapse; margin: 10px 0 18px; width: 100%; }
  table.pt th { text-align: left; width: 190px; font-weight: 600; padding: 5px 0; color: #333; vertical-align: top; }
  table.pt td { padding: 5px 0; }
  p { margin: 0 0 12px; }
  .foot { position: absolute; bottom: 30px; left: 60px; right: 60px; }
  .hand .answer { font-family: ${HAND}; font-size: 19px; color: #1b2f73; letter-spacing: 0.01em; }`;

const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
)}")`;

/** Paper laid on a desk and photographed at a slight angle, lit from one corner. */
const PHOTO_CSS = `
  body { width: 1100px; height: 1450px; overflow: hidden;
         background: radial-gradient(900px 700px at 20% 10%, #8d7f6c, #5b5044 60%, #3b342d); }
  .stage { position: absolute; left: 110px; top: 70px; transform-origin: 50% 50%;
           transform: perspective(1600px) rotateX(5deg) rotateY(-3deg) rotate(-2.2deg) scale(1.08); }
  .paper { background: #f7f4ec; box-shadow: 0 30px 50px rgba(0,0,0,0.45), 0 4px 10px rgba(0,0,0,0.3);
           filter: blur(0.35px) saturate(0.92); }
  .light { position: absolute; inset: 0; pointer-events: none;
           background: radial-gradient(1000px 800px at 15% 5%, rgba(255,250,235,0.35), transparent 55%),
                       linear-gradient(160deg, transparent 50%, rgba(40,30,20,0.28)); }
  .grain { position: absolute; inset: 0; pointer-events: none; opacity: 0.18; mix-blend-mode: multiply; background-image: ${GRAIN}; }`;

/** A flatbed scan: grey cast, a small tilt, speckle and a darker edge. */
const SCAN_CSS = `
  body { width: 900px; height: 1220px; overflow: hidden; background: #f2f2f0; }
  .stage { position: absolute; left: 50px; top: 40px; transform: rotate(0.7deg); }
  .paper { filter: grayscale(1) contrast(1.18) brightness(0.98); box-shadow: 0 0 0 1px #d0d0d0; }
  .light { position: absolute; inset: 0; pointer-events: none; box-shadow: inset 0 0 120px rgba(0,0,0,0.12); }
  .grain { position: absolute; inset: 0; pointer-events: none; opacity: 0.12; mix-blend-mode: multiply; background-image: ${GRAIN}; filter: grayscale(1); }`;

function pageHtml(doc: Doc, style: Style): string {
  const inner = doc.kind === "intake" ? intakeHtml(doc) : referralHtml(doc);
  const hand = doc.kind === "intake" && doc.handwritten ? " hand" : "";
  const paper = `<div class="paper${hand}">${inner}</div>`;
  const css = BASE_CSS + (style === "photo" ? PHOTO_CSS : style === "scan" ? SCAN_CSS : "@page { size: A4; margin: 0; }");
  const body = style === "text" ? paper : `<div class="stage">${paper}</div><div class="light"></div><div class="grain"></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`;
}

// ---------- Chrome ----------

function findChrome(): string {
  const found = CHROME_PATHS.find((p) => existsSync(p));
  if (!found) throw new Error("Chrome not found. Install Google Chrome or set CHROME_PATH.");
  return found;
}

function chrome(args: string[], opts: { capture?: boolean } = {}): string {
  const out = execFileSync(
    findChrome(),
    ["--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars", "--force-device-scale-factor=1", `--user-data-dir=${join(WORK_DIR, "profile")}`, ...args],
    { encoding: opts.capture ? "utf8" : undefined, maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", opts.capture ? "pipe" : "ignore", "ignore"] },
  );
  return opts.capture ? String(out) : "";
}

const url = (path: string) => pathToFileURL(path).href;

function writeHtml(name: string, html: string): string {
  const path = join(WORK_DIR, name);
  writeFileSync(path, html);
  return path;
}

function printPdf(htmlPath: string, out: string) {
  chrome(["--no-pdf-header-footer", `--print-to-pdf=${out}`, url(htmlPath)]);
}

function screenshot(htmlPath: string, out: string, size: [number, number]) {
  chrome([`--window-size=${size[0]},${size[1]}`, `--screenshot=${out}`, url(htmlPath)]);
}

/** PNG → JPEG with Chrome's canvas encoder, read back from the dumped DOM. */
function toJpeg(pngPath: string, out: string, quality = 0.82) {
  const b64 = readFileSync(pngPath).toString("base64");
  const html = `<!doctype html><html><body><pre id="out"></pre><script>
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      document.getElementById("out").textContent = "JPEG:" + c.toDataURL("image/jpeg", ${quality}).split(",")[1] + ":END";
    };
    img.src = "data:image/png;base64,${b64}";
  </script></body></html>`;
  const dom = chrome(["--virtual-time-budget=10000", "--dump-dom", url(writeHtml("to-jpeg.html", html))], { capture: true });
  const m = /JPEG:([A-Za-z0-9+/=]+):END/.exec(dom);
  if (!m) throw new Error(`JPEG encoding failed for ${pngPath}`);
  writeFileSync(out, Buffer.from(m[1], "base64"));
}

/** An image-only PDF: the scan, one A4 page, no text layer. */
function imageToPdf(imagePath: string, out: string) {
  const html = `<!doctype html><html><head><style>@page { size: A4; margin: 0; } html, body { margin: 0; }
    img { display: block; width: 210mm; height: 297mm; object-fit: cover; }</style></head>
    <body><img src="${url(imagePath)}"></body></html>`;
  chrome(["--allow-file-access-from-files", "--no-pdf-header-footer", `--print-to-pdf=${out}`, url(writeHtml("to-pdf.html", html))]);
}

// ---------- Name check ----------

async function checkNames() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  const sql = neon(process.env.DATABASE_URL);
  for (const d of DOCS) {
    const name = d.kind === "intake" ? d.name : d.patient;
    const rows = await sql`
      SELECT mrn, birth_date::text AS birth_date FROM patients
      WHERE lower(first_name || ' ' || last_name) = lower(${name}) AND source = 'synthea'
    `;
    const allowed = name === "Bert Hammes";
    if (allowed && !(rows.length === 1 && rows[0].mrn === "76057" && rows[0].birth_date === "1969-10-17")) {
      throw new Error("Bert Hammes (MRN 76057, born 1969-10-17) must exist for referral_01 to match.");
    }
    if (!allowed && rows.length) throw new Error(`${d.file}: "${name}" matches an existing patient. Pick another name.`);
  }
  console.log("Names checked: only Bert Hammes matches an existing patient.");
}

// ---------- Main ----------

function outputOf(file: string): Output {
  return file.endsWith(".pdf") ? "pdf" : file.endsWith(".png") ? "png" : "jpg";
}

async function main() {
  await checkNames();
  rmSync(WORK_DIR, { recursive: true, force: true });
  mkdirSync(WORK_DIR, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });

  for (const doc of DOCS) {
    const out = join(OUT_DIR, doc.file);
    const html = writeHtml(`${doc.file}.html`, pageHtml(doc, doc.style));
    const kind = outputOf(doc.file);

    if (doc.style === "text") {
      if (kind !== "pdf") throw new Error(`${doc.file}: text style must be a PDF.`);
      printPdf(html, out);
    } else {
      const size: [number, number] = doc.style === "photo" ? [1100, 1450] : [900, 1220];
      const png = join(WORK_DIR, `${doc.file}.png`);
      screenshot(html, png, size);
      if (kind === "png") writeFileSync(out, readFileSync(png));
      else if (kind === "jpg") toJpeg(png, out);
      else {
        const jpg = join(WORK_DIR, `${doc.file}.jpg`);
        toJpeg(png, jpg, 0.85);
        imageToPdf(jpg, out);
      }
    }

    const bytes = statSync(out).size;
    if (bytes > MAX_BYTES) throw new Error(`${doc.file} is ${bytes} bytes, over the 4 MB upload limit.`);
    console.log(`${doc.file.padEnd(16)} ${doc.style.padEnd(6)} ${(bytes / 1024).toFixed(0).padStart(5)} KB`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
