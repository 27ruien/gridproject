export const TRASH_RETENTION_DAYS = 30;

export function createTrashItem(type, entity) {
  const deletedAt = new Date().toISOString();
  return {
    id: `trash-${type}-${entity.id}-${Date.now()}`,
    type,
    entity,
    deletedAt,
  };
}

export function normalizeTrashItem(item) {
  return {
    id: item.id || `trash-${item.type}-${item.entity?.id || Date.now()}`,
    type: item.type,
    entity: item.entity,
    deletedAt: item.deletedAt || new Date().toISOString(),
  };
}

export function isTrashRestorable(item, now = new Date()) {
  return daysSinceDeleted(item, now) <= TRASH_RETENTION_DAYS;
}

export function daysSinceDeleted(item, now = new Date()) {
  const deletedAt = new Date(item.deletedAt);
  return Math.floor((startOfDay(now).getTime() - startOfDay(deletedAt).getTime()) / 86400000);
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
