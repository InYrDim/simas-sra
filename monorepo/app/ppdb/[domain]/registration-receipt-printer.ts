import type { PpdbFormField } from "@/lib/ppdb-session"

export type PpdbReceiptAnswers = Readonly<Record<string, string | readonly string[]>>

function answerText(field: PpdbFormField, answers: PpdbReceiptAnswers) {
  const value = answers[field.id]
  if (typeof value === "string") return value.trim() ? value : "–"
  return value?.length ? value.join(", ") : "–"
}

export function printPpdbRegistrationReceipt({
  domain,
  sessionId,
  registrationCode,
  fields,
  answers,
}: {
  domain: string
  sessionId: string
  registrationCode: string
  fields: readonly PpdbFormField[]
  answers: PpdbReceiptAnswers
}) {
  const iframe = document.createElement("iframe")
  iframe.title = "Bukti pendaftaran PPDB"
  Object.assign(iframe.style, {
    position: "fixed",
    width: "1px",
    height: "1px",
    right: "0",
    bottom: "0",
    border: "0",
    opacity: "0",
  })
  document.body.appendChild(iframe)

  const printDocument = iframe.contentDocument
  const printWindow = iframe.contentWindow
  if (!printDocument || !printWindow) {
    iframe.remove()
    return
  }

  printDocument.open()
  printDocument.write(`<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Bukti Pendaftaran PPDB</title>
  <style>
    @page { size: A4 portrait; margin: 15mm 17mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #0f172a; font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.45; }
    .document { min-height: 267mm; border: 1px solid #cbd5e1; padding: 12mm; position: relative; }
    header { border-bottom: 2px solid #0f172a; padding-bottom: 6mm; text-align: center; }
    .eyebrow { margin: 0; color: #475569; font-size: 8pt; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
    h1 { margin: 2mm 0 0; font-size: 18pt; }
    .school { margin: 2mm 0 0; color: #475569; }
    .code { margin: 7mm 0; border: 2px dashed #0284c7; background: #f0f9ff; padding: 5mm; text-align: center; break-inside: avoid; }
    .code-label { margin: 0; color: #0369a1; font-size: 8pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .code-value { margin: 1mm 0 0; color: #075985; font-size: 19pt; font-weight: 800; letter-spacing: .05em; }
    .meta, .answers { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 2.5mm 3mm; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    th { width: 34%; background: #f8fafc; color: #475569; font-size: 8pt; text-transform: uppercase; }
    h2 { margin: 7mm 0 3mm; font-size: 11pt; text-transform: uppercase; letter-spacing: .05em; }
    .notice { margin-top: 7mm; border-top: 1px solid #cbd5e1; padding-top: 4mm; color: #475569; font-size: 9pt; }
    footer { position: absolute; right: 12mm; bottom: 8mm; color: #64748b; font-size: 8pt; }
  </style>
</head>
<body>
  <article class="document">
    <header>
      <p class="eyebrow">Bukti Pendaftaran</p>
      <h1>Penerimaan Peserta Didik Baru</h1>
      <p class="school" id="school"></p>
    </header>
    <section class="code"><p class="code-label">Kode Pendaftaran</p><p class="code-value" id="registration-code"></p></section>
    <table class="meta"><tbody>
      <tr><th>ID Sesi PPDB</th><td id="session-id"></td></tr>
      <tr><th>Waktu Cetak</th><td id="printed-at"></td></tr>
    </tbody></table>
    <h2>Data yang Dikirim</h2>
    <table class="answers"><tbody id="answers"></tbody></table>
    <p class="notice">Simpan bukti dan kode pendaftaran ini. Kode pendaftaran diperlukan untuk memeriksa status serta hasil seleksi PPDB.</p>
    <footer>Dicetak melalui SIMAS</footer>
  </article>
</body>
</html>`)
  printDocument.close()

  const setText = (id: string, value: string) => {
    const element = printDocument.getElementById(id)
    if (element) element.textContent = value
  }
  setText("school", domain.replaceAll("-", " ").toLocaleUpperCase("id-ID"))
  setText("registration-code", registrationCode)
  setText("session-id", sessionId)
  setText("printed-at", new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short" }).format(new Date()))

  const body = printDocument.getElementById("answers")
  for (const field of fields) {
    const row = printDocument.createElement("tr")
    const label = printDocument.createElement("th")
    const value = printDocument.createElement("td")
    label.textContent = field.label
    value.textContent = answerText(field, answers)
    row.append(label, value)
    body?.appendChild(row)
  }

  const cleanup = () => iframe.remove()
  printWindow.onafterprint = cleanup
  window.setTimeout(cleanup, 60_000)
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    printWindow.focus()
    printWindow.print()
  }))
}
