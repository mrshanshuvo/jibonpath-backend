import type { Request } from "express";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  hasMore: boolean;
}

export interface PaginationLinks {
  self: string;
  first: string;
  prev: string | null;
  next: string | null;
  last: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
  links: PaginationLinks;
  [key: string]: unknown;
}

export const getPagination = (req: Request) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
  const skip = (page - 1) * limit;
  const search =
    (typeof req.query.search === "string" && req.query.search.trim()) ||
    (typeof req.query.q === "string" && req.query.q.trim()) ||
    undefined;

  return {
    page,
    limit,
    skip,
    ...(search ? { search } : {}),
  };
};

export const buildMeta = (
  page: number,
  limit: number,
  total: number,
): PaginationMeta => {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    hasMore: page < totalPages,
  };
};

export const buildLinks = (
  req: Request,
  page: number,
  limit: number,
  totalPages: number,
): PaginationLinks => {
  const baseUrl = req.baseUrl || req.path || "";
  const query = { ...(req.query as Record<string, string>) };

  const makeUrl = (targetPage: number) => {
    const params = new URLSearchParams({
      ...query,
      page: String(targetPage),
      limit: String(limit),
    });
    return `${baseUrl}?${params.toString()}`;
  };

  return {
    self: makeUrl(page),
    first: makeUrl(1),
    prev: page > 1 ? makeUrl(page - 1) : null,
    next: page < totalPages ? makeUrl(page + 1) : null,
    last: makeUrl(totalPages),
  };
};

export const createPaginatedResponse = <T>(
  req: Request,
  items: T[],
  total: number,
  legacyKey?: string,
): PaginatedResult<T> => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
  const meta = buildMeta(page, limit, total);
  const links = buildLinks(req, page, limit, meta.totalPages);

  const response: PaginatedResult<T> = {
    data: items,
    meta,
    links,
  };

  if (legacyKey) {
    response[legacyKey] = items;
  }

  return response;
};
