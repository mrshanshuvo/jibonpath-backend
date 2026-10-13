declare global {
  namespace Express {
    interface User {
      userId: string;
      role: string;
    }
    interface Request {
      user?: User;
      rawBody?: Buffer;
    }
  }
}

export {};
