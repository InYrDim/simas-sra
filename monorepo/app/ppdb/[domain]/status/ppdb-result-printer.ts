type PrintablePpdbResult = Readonly<{
  registrationCode: string
  studentName: string
  submissionStatus: "pending" | "accepted" | "rejected"
  score: number | null
  feedback: string
  nextSteps: string
}>

const statusLabels: Record<PrintablePpdbResult["submissionStatus"], string> = {
  accepted: "DITERIMA",
  rejected: "TIDAK DITERIMA",
  pending: "MASIH DITINJAU",
}

export function printPpdbResult({
  state,
  domain,
  sessionId,
  whatsappUrl,
}: {
  state: PrintablePpdbResult
  domain: string
  sessionId: string
  whatsappUrl: string | null
}) {
  const iframe = document.createElement("iframe")
  iframe.title = "Dokumen hasil pendaftaran PPDB"
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
  <title>Hasil PPDB</title>
  <style>
    @page { size: A4 portrait; margin: 16mm 18mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #0f172a; font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.55; }
    .document { min-height: 260mm; border: 1px solid #cbd5e1; padding: 14mm; position: relative; }
    .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8mm; margin-bottom: 9mm; }
    .eyebrow { margin: 0; font-size: 9pt; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: #475569; }
    h1 { margin: 2mm 0 0; font-size: 19pt; line-height: 1.25; }
    .school { margin: 2mm 0 0; color: #475569; }
    .meta { width: 100%; border-collapse: collapse; margin-bottom: 9mm; }
    .meta th, .meta td { border: 1px solid #cbd5e1; padding: 3mm 4mm; text-align: left; vertical-align: top; }
    .meta th { width: 34%; background: #f8fafc; font-size: 9pt; text-transform: uppercase; letter-spacing: .06em; color: #475569; }
    .decision { border: 2px solid #0f172a; padding: 7mm; text-align: center; margin-bottom: 8mm; }
    .decision-label { margin: 0; font-size: 9pt; text-transform: uppercase; letter-spacing: .12em; color: #475569; }
    .decision-value { margin: 2mm 0 0; font-size: 20pt; font-weight: 800; }
    .section { margin-top: 7mm; break-inside: avoid; }
    .section h2 { margin: 0 0 2mm; font-size: 10pt; text-transform: uppercase; letter-spacing: .08em; color: #475569; }
    .section p { margin: 0; white-space: pre-wrap; }
    .notice { margin-top: 9mm; border-top: 1px solid #cbd5e1; padding-top: 5mm; font-size: 9pt; color: #475569; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 16mm; margin-top: 18mm; text-align: center; break-inside: avoid; }
    .signature-space { height: 22mm; }
    .signature-line { border-top: 1px solid #0f172a; padding-top: 2mm; }
    .footer { position: absolute; left: 14mm; right: 14mm; bottom: 9mm; display: flex; justify-content: space-between; font-size: 8pt; color: #64748b; }
  </style>
</head>
<body>
  <article class="document">
    <header class="header">
      <p class="eyebrow">Pengumuman Hasil Seleksi</p>
      <h1>Penerimaan Peserta Didik Baru</h1>
      <p class="school" id="school"></p>
    </header>
    <table class="meta"><tbody>
      <tr><th>Kode Pendaftaran</th><td id="registration-code"></td></tr>
      <tr><th>Nama Peserta</th><td id="student-name"></td></tr>
      <tr><th>ID Sesi PPDB</th><td id="session-id"></td></tr>
      <tr><th>Tanggal Cetak</th><td id="printed-at"></td></tr>
    </tbody></table>
    <section class="decision">
      <p class="decision-label">Keputusan Hasil Seleksi</p>
      <p class="decision-value" id="decision"></p>
    </section>
    <section class="section" id="score-section"><h2>Skor Seleksi</h2><p id="score"></p></section>
    <section class="section" id="feedback-section"><h2>Umpan Balik</h2><p id="feedback"></p></section>
    <section class="section" id="steps-section"><h2>Langkah Selanjutnya</h2><p id="steps"></p></section>
    <section class="section" id="whatsapp-section"><h2>Grup WhatsApp</h2><p id="whatsapp"></p></section>
    <p class="notice">Dokumen ini dicetak dari sistem pengumuman PPDB. Simpan kode pendaftaran dan dokumen ini untuk keperluan administrasi berikutnya.</p>
    <section class="signatures">
      <div><p>Peserta / Orang Tua</p><div class="signature-space"></div><div class="signature-line">Nama dan tanda tangan</div></div>
      <div><p>Panitia PPDB</p><div class="signature-space"></div><div class="signature-line">Nama dan tanda tangan</div></div>
    </section>
    <footer class="footer"><span id="document-code"></span><span>Dicetak melalui SIMAS</span></footer>
  </article>
</body>
</html>`)
  printDocument.close()

  const setText = (id: string, value: string) => {
    const element = printDocument.getElementById(id)
    if (element) element.textContent = value
  }
  const hideEmptySection = (sectionId: string, value: string | null) => {
    if (!value) printDocument.getElementById(sectionId)?.remove()
  }

  setText("school", domain.replaceAll("-", " ").toLocaleUpperCase("id-ID"))
  setText("registration-code", state.registrationCode)
  setText("student-name", state.studentName)
  setText("session-id", sessionId)
  setText("printed-at", new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short" }).format(new Date()))
  setText("decision", statusLabels[state.submissionStatus])
  setText("document-code", state.registrationCode)
  setText("score", state.score === null ? "" : String(state.score))
  setText("feedback", state.feedback)
  setText("steps", state.nextSteps)
  setText("whatsapp", whatsappUrl ?? "")
  hideEmptySection("score-section", state.score === null ? null : String(state.score))
  hideEmptySection("feedback-section", state.feedback)
  hideEmptySection("steps-section", state.nextSteps)
  hideEmptySection("whatsapp-section", whatsappUrl)

  const cleanup = () => iframe.remove()
  printWindow.onafterprint = cleanup
  window.setTimeout(cleanup, 60_000)
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    printWindow.focus()
    printWindow.print()
  }))
}
