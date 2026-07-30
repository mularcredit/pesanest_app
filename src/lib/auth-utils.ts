import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

export interface MobileUser {
  id: string;
  email: string;
  name: string;
  role: string;
  branchId: string | null;
  regionId: string | null;
  permissions: string[];
}

export function getMobileUser(req: NextRequest | Request): MobileUser | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.AUTH_SECRET || "default_secret") as MobileUser;
    return decoded;
  } catch (err) {
    console.error("Invalid mobile token", err);
    return null;
  }
}
