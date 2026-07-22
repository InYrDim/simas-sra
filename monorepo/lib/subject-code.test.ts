import assert from "node:assert/strict";
import test from "node:test";

import { generateSubjectCode } from "@/lib/subject-code";

test("generates readable Mata Pelajaran codes from names", () => {
  assert.equal(generateSubjectCode("Matematika"), "MAT");
  assert.equal(generateSubjectCode("Bahasa Indonesia"), "BIN");
  assert.equal(generateSubjectCode("Pendidikan Agama Islam"), "PAI");
  assert.equal(generateSubjectCode("  Ilmu   Pengetahuan Alam  "), "IPA");
  assert.equal(generateSubjectCode(""), "");
});
