const getValueByPath = (object, path) => {
  if (!path) {
    return undefined;
  }

  return path.split(".").reduce((current, key) => {
    if (current === null || current === undefined) {
      return undefined;
    }

    return current[key];
  }, object);
};

const resolveTemplate = (value, data) => {
  if (typeof value !== "string") {
    return value;
  }

  const exactMatch = value.match(/^{{\s*([^{}]+?)\s*}}$/);

  if (exactMatch) {
    return getValueByPath(data, exactMatch[1].trim());
  }

  return value.replace(
    /{{\s*([^{}]+?)\s*}}/g,
    (match, path) => {
      const result = getValueByPath(
        data,
        path.trim()
      );

      if (result === undefined || result === null) {
        return "";
      }

      if (typeof result === "object") {
        return JSON.stringify(result);
      }

      return String(result);
    }
  );
};

const resolveMappings = (value, data) => {
  if (typeof value === "string") {
    return resolveTemplate(value, data);
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      resolveMappings(item, data)
    );
  }

  if (
    value !== null &&
    typeof value === "object"
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        resolveMappings(item, data)
      ])
    );
  }

  return value;
};

module.exports = {
  getValueByPath,
  resolveTemplate,
  resolveMappings
};