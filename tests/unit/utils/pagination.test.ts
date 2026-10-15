import type { Request } from "express";
import { describe, expect, it } from "vitest";
import { buildMeta, getPagination } from "../../../src/utils/pagination";

describe("Pagination Utility", () => {
  describe("getPagination", () => {
    it("should return default pagination when no query parameters are provided", () => {
      const mockReq = { query: {} } as unknown as Request;
      const pagination = getPagination(mockReq);

      expect(pagination).toEqual({
        page: 1,
        limit: 10,
        skip: 0,
      });
    });

    it("should correctly compute skip for page 2 and limit 20", () => {
      const mockReq = {
        query: { page: "2", limit: "20" },
      } as unknown as Request;
      const pagination = getPagination(mockReq);

      expect(pagination).toEqual({
        page: 2,
        limit: 20,
        skip: 20,
      });
    });

    it("should cap limit at maximum 100", () => {
      const mockReq = {
        query: { page: "1", limit: "500" },
      } as unknown as Request;
      const pagination = getPagination(mockReq);

      expect(pagination.limit).toBe(100);
    });

    it("should fallback to page 1 for invalid or negative numbers", () => {
      const mockReq = {
        query: { page: "-5", limit: "invalid" },
      } as unknown as Request;
      const pagination = getPagination(mockReq);

      expect(pagination).toEqual({
        page: 1,
        limit: 10,
        skip: 0,
      });
    });
  });

  describe("buildMeta", () => {
    it("should construct correct metadata for single page results", () => {
      const meta = buildMeta(1, 10, 5);

      expect(meta).toEqual({
        page: 1,
        limit: 10,
        total: 5,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
        hasMore: false,
      });
    });

    it("should calculate multiple totalPages correctly", () => {
      const meta = buildMeta(2, 10, 25);

      expect(meta).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true,
        hasMore: true,
      });
    });
  });
});
