export const stringToArray = (value: string, separator = ','): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(separator)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};
