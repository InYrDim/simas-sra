import assert from "node:assert/strict"
import test from "node:test"

import {
  inspectPpdbDocument,
  PPDB_FILE_MAX_BYTES,
  validatePpdbFileSize,
} from "@/lib/ppdb-file-validation"

test("accepts a PPDB file at the 2 MB limit", () => {
  assert.equal(validatePpdbFileSize(PPDB_FILE_MAX_BYTES), null)
})

test("rejects a PPDB file larger than 2 MB with a clear message", () => {
  assert.equal(
    validatePpdbFileSize(PPDB_FILE_MAX_BYTES + 1),
    "Ukuran file tidak boleh lebih dari 2 MB.",
  )
})

test("recognizes supported PPDB documents from their content signature", () => {
  assert.deepEqual(inspectPpdbDocument(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])), {
    mimeType: "application/pdf",
    extension: "pdf",
  })
  assert.deepEqual(inspectPpdbDocument(new Uint8Array([0xff, 0xd8, 0xff, 0x01])), {
    mimeType: "image/jpeg",
    extension: "jpg",
  })
  assert.deepEqual(inspectPpdbDocument(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), {
    mimeType: "image/png",
    extension: "png",
  })
})

test("rejects unsupported or empty PPDB document content", () => {
  assert.equal(inspectPpdbDocument(new Uint8Array()), null)
  assert.equal(inspectPpdbDocument(new TextEncoder().encode("not really a PDF")), null)
})
