import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { type JwtPayload, verifyAccessToken } from "../utils/jwt";

// Extend Express.User so Passport and custom auth middlewares share the same type definition
declare global {
  namespace Express {
    interface User {
      userId: string;
      role: string;
    }
  }
}

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.query?.token && typeof req.query.token === "string") {
    token = req.query.token;
  }

  if (!token) {
    return next(new AppError("Access token missing or malformed", 401));
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error) {
    next(error);
  }
};
