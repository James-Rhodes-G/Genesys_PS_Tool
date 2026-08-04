const normalizeIds = (values) =>
  Array.isArray(values) ? values.map((value) => String(value || "").trim()).filter(Boolean) : [];

const executeBulkMutation = async ({ ids, executeItem }) => {
  const normalizedIds = normalizeIds(ids);
  const results = [];

  for (const id of normalizedIds) {
    try {
      const response = await executeItem(id);
      results.push({
        id,
        status: "success",
        response: response || null,
      });
    } catch (error) {
      results.push({
        id,
        status: "failed",
        error: error.message,
        details: error.details || null,
      });
    }
  }

  return results;
};

const executeChunkedBulkMutation = async ({ ids, chunkSize, executeChunk, buildSuccessRow, buildFailureRow }) => {
  const normalizedIds = normalizeIds(ids);
  const results = [];

  for (let index = 0; index < normalizedIds.length; index += chunkSize) {
    const chunk = normalizedIds.slice(index, index + chunkSize);

    try {
      const response = await executeChunk(chunk);
      chunk.forEach((id) => {
        results.push(buildSuccessRow({ id, chunk, response }));
      });
    } catch (error) {
      chunk.forEach((id) => {
        results.push(buildFailureRow({ id, chunk, error }));
      });
    }
  }

  return results;
};

export { executeBulkMutation, executeChunkedBulkMutation, normalizeIds };
