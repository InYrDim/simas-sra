type PersonProjection = {
  nik: string | null;
  nip: string | null;
  street: string;
  village: string | null;
  district: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
};

export function projectPeopleProfile<T extends PersonProjection>(
  person: T,
  permissions?: ReadonlySet<string>,
): T {
  if (!permissions) return person;

  const contact = permissions.has("people.people.view-contact");
  const sensitive = permissions.has("people.people.view-sensitive");
  return {
    ...person,
    nik: sensitive ? person.nik : null,
    nip: sensitive ? person.nip : null,
    street: contact ? person.street : "",
    village: contact ? person.village : null,
    district: contact ? person.district : null,
    city: contact ? person.city : null,
    province: contact ? person.province : null,
    postalCode: contact ? person.postalCode : null,
    phone: contact ? person.phone : null,
    email: contact ? person.email : null,
  };
}
