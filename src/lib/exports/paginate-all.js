const appendPageSize = (path, pageNumber, pageSize) => {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}pageSize=${pageSize}&pageNumber=${pageNumber}`;
};

const paginateAllWithApiClient = async (apiClient, path, { pageSize = 100, itemContext = {} } = {}) => {
  let pageNumber = 1;
  let pageCount = 1;
  const entities = [];

  while (pageNumber <= pageCount) {
    const data = await apiClient.get(appendPageSize(path, pageNumber, pageSize), { itemContext });
    if (Array.isArray(data?.entities)) {
      entities.push(...data.entities);
    }
    pageCount = Number(data?.pageCount || 1);
    pageNumber += 1;
  }

  return entities;
};

export { paginateAllWithApiClient, appendPageSize };
