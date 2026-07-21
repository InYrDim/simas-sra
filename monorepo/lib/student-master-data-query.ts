import { normalizeMasterDataQuery, type MasterDataSearchParams } from "@/lib/master-data-workspace";
import { STUDENT_STATUSES, type StudentRecord } from "@/lib/student-master-data";

export const STUDENT_GENDERS = ["female", "male"] as const;
export const STUDENT_ACCOUNT_STATUSES = ["active", "inactive", "unlinked"] as const;

const compact = (value: string) => value.replace(/[^\p{L}\p{N}]/gu, "").toLocaleLowerCase("id-ID");

export function queryStudents(records: readonly StudentRecord[], params: MasterDataSearchParams) {
  const classGroups = [...new Set(records.flatMap(({ classGroupName }) => classGroupName ? [classGroupName] : []))];
  const entryYears = [...new Set(records.map(({ student }) => student.entryDate.slice(0, 4)))];
  let query = normalizeMasterDataQuery(params, {
    filters: {
      status: STUDENT_STATUSES,
      gender: STUDENT_GENDERS,
      classGroup: classGroups,
      account: STUDENT_ACCOUNT_STATUSES,
      entryYear: entryYears,
    },
    sorts: ["name-asc", "name-desc", "nis-asc", "nis-desc"],
  });
  const search = compact(query.search);
  const statuses = query.filters.status ?? [];
  const genders = query.filters.gender ?? [];
  const selectedClassGroups = query.filters.classGroup ?? [];
  const accountStatuses = query.filters.account ?? [];
  const selectedEntryYears = query.filters.entryYear ?? [];

  const filtered = records
    .filter(({ person, student, classGroupName }) => {
      const accountStatus = !person.accountUserId
        ? "unlinked"
        : person.accountActive
          ? "active"
          : "inactive";
      return (
        (query.archive === "all" || student.archived === (query.archive === "archived")) &&
        (!statuses.length || statuses.includes(student.status)) &&
        (!genders.length || genders.includes(person.gender)) &&
        (!selectedClassGroups.length || Boolean(classGroupName && selectedClassGroups.includes(classGroupName))) &&
        (!accountStatuses.length || accountStatuses.includes(accountStatus)) &&
        (!selectedEntryYears.length || selectedEntryYears.includes(student.entryDate.slice(0, 4))) &&
        (!search ||
          compact(person.fullName).includes(search) ||
          compact(student.nis).includes(search) ||
          Boolean(student.nisn && compact(student.nisn).includes(search)) ||
          Boolean(person.nik && compact(person.nik).includes(search)) ||
          Boolean(person.nip && compact(person.nip).includes(search)))
      );
    })
    .sort((left, right) => {
      const byNis = query.sort.startsWith("nis");
      const compared = byNis
        ? left.student.normalizedNis.localeCompare(right.student.normalizedNis, "id-ID")
        : left.person.normalizedName.localeCompare(right.person.normalizedName, "id-ID");
      const stable = compared || left.student.id.localeCompare(right.student.id);
      return query.sort.endsWith("desc") ? -stable : stable;
    });
  const pages = Math.max(1, Math.ceil(filtered.length / query.pageSize));
  if (query.page > pages) query = { ...query, page: pages };
  const offset = (query.page - 1) * query.pageSize;
  return {
    query,
    items: filtered.slice(offset, offset + query.pageSize),
    total: filtered.length,
    state: records.length === 0 ? "empty" as const : filtered.length === 0 ? "no-results" as const : "results" as const,
  };
}
