export const ok = (res, { message = "OK", data = {}, ...rest } = {}) =>
  res.json({
    success: true,
    message,
    data,
    ...rest,
  });

export const paginated = (
  res,
  {
    items = [],
    nextCursor = null,
    hasMore = false,
    message = "OK",
    itemKey = "items",
    data = {},
    ...rest
  } = {}
) =>
  res.json({
    success: true,
    message,
    data: {
      ...data,
      nextCursor,
      hasMore,
      count: items.length,
    },
    [itemKey]: items,
    nextCursor,
    hasMore,
    meta: {
      nextCursor,
      hasMore,
      count: items.length,
    },
    ...rest,
  });
