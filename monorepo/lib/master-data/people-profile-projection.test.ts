import assert from "node:assert/strict";
import test from "node:test";

import { projectPeopleProfile } from "@/lib/master-data/people-profile-projection";

const person = {
  id: "person-1",
  tenantId: "tenant-1",
  fullName: "Aisyah Putri",
  nik: "1234567890123456",
  nip: "198001012000011001",
  street: "Jalan Melati",
  village: "Batu",
  district: "Palu",
  city: "Palu",
  province: "Sulawesi Tengah",
  postalCode: "94111",
  phone: "+628123456789",
  email: "aisyah@example.test",
};

test("ordinary people projection omits contact and sensitive identifiers", () => {
  const projected = projectPeopleProfile(person, new Set(["people.people.view"]));
  assert.equal(projected.nik, null);
  assert.equal(projected.nip, null);
  assert.equal(projected.phone, null);
  assert.equal(projected.email, null);
  assert.equal(projected.street, "");
});

test("supplemental permissions independently restore contact and sensitive identifiers", () => {
  const projected = projectPeopleProfile(person, new Set([
    "people.people.view",
    "people.people.view-contact",
    "people.people.view-sensitive",
  ]));
  assert.equal(projected.nik, person.nik);
  assert.equal(projected.nip, person.nip);
  assert.equal(projected.phone, person.phone);
  assert.equal(projected.email, person.email);
});

test("legacy principals without an effective permission set are not projected", () => {
  assert.deepEqual(projectPeopleProfile(person), person);
});
