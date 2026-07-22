// Groups are streets/areas with a fixed physical order the temple committee
// walks in; anything not in this list (a newly-added group not yet added
// here) sorts after the known ones and before "Others". Shared by every
// report that groups Silai fund data by street (Silai by Group, Silai
// Follow-up), so the walking order only needs to be edited in one place.
export const OTHERS_GROUP_LABEL = "Others";

export const GROUP_ORDER = [
  "Ramaiya Nagar",
  "Kalaignar Nagar 2nd Street",
  "Kalaignar Nagar 1st Street",
  "Kalluri Salai",
  "Kalluri Salai Cross Street",
  "Balamurugan Nagar"
];

export function groupSortRank(name: string) {
  if (name === OTHERS_GROUP_LABEL) return Number.POSITIVE_INFINITY;
  const index = GROUP_ORDER.indexOf(name);
  return index === -1 ? GROUP_ORDER.length : index;
}

export function groupKeyFor(group: string | null) {
  return group?.trim() || OTHERS_GROUP_LABEL;
}

export function sortGroupNames(names: string[]) {
  return [...names].sort((a, b) => {
    const rankA = groupSortRank(a);
    const rankB = groupSortRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return a.localeCompare(b);
  });
}

// Groups an array of items by street, sorted by the fixed walking order,
// with each group's own items ordered by orderNumber (nulls last) then name.
export function groupByStreet<T extends { group: string | null; orderNumber: number | null; name: string }>(
  items: T[]
): { groupName: string; rows: T[] }[] {
  const byGroup = new Map<string, T[]>();

  items.forEach((item) => {
    const key = groupKeyFor(item.group);
    const list = byGroup.get(key) ?? [];
    list.push(item);
    byGroup.set(key, list);
  });

  return sortGroupNames(Array.from(byGroup.keys())).map((groupName) => {
    const rows = [...(byGroup.get(groupName) ?? [])].sort((a, b) => {
      const aOrder = a.orderNumber ?? Number.POSITIVE_INFINITY;
      const bOrder = b.orderNumber ?? Number.POSITIVE_INFINITY;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.name.localeCompare(b.name);
    });
    return { groupName, rows };
  });
}
