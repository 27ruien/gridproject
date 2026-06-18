import { createStorageAdapter } from "./storageAdapter.js";
import { apiClient, isApiDataSource } from "../services/apiClient.js";

export const apiStorageAdapter = createStorageAdapter({
  read() {
    return null;
  },
  write() {},
  remove() {},
});

export async function hydrateStateFromApi(state) {
  if (!isApiDataSource()) return null;
  const payload = await apiClient.bootstrap();
  assignObject(state.organization, payload.organization);
  assignObject(state.settings, payload.settings);
  replaceArray(state.users, payload.users);
  replaceArray(state.projects, payload.projects);
  replaceArray(state.issues, payload.issues);
  replaceArray(state.timeEntries, payload.timeEntries);
  replaceArray(state.projectMembers, payload.projectMembers);
  replaceArray(state.costRecords, payload.costRecords);
  replaceArray(state.sessions, payload.sessions);
  replaceArray(state.auditLogs, payload.auditLogs);
  replaceArray(state.trash, payload.trash);
  return payload;
}

function replaceArray(target, value = []) {
  target.splice(0, target.length, ...value);
}

function assignObject(target, value = {}) {
  Object.keys(target).forEach((key) => {
    if (!(key in value)) delete target[key];
  });
  Object.assign(target, value);
}
