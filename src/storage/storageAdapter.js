export function createStorageAdapter({ read, write, remove }) {
  return {
    read(key, fallbackValue) {
      const value = read(key);
      return value == null ? fallbackValue : value;
    },
    write,
    remove,
  };
}

