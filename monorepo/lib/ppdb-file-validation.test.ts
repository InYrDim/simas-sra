import assert from "node:assert/strict"
import test from "node:test"

import { PPDB_FILE_MAX_BYTES, validatePpdbFileSize } from "@/lib/ppdb-file-validation"

test("accepts a PPDB file at the 2 MB limit", () => {
  assert.equal(validatePpdbFileSize(PPDB_FILE_MAX_BYTES), null)
})

test("rejects a PPDB file larger than 2 MB with a clear message", () => {
  assert.equal(
    validatePpdbFileSize(PPDB_FILE_MAX_BYTES + 1),
    "Ukuran file tidak boleh lebih dari 2 MB.",
  )
})
