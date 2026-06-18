import type { User } from "../generated/prisma/client.js";

export type AuthContext = {
  organizationId: string;
  userId: string;
  user: Omit<User, "passwordHash">;
  role: "ADMIN" | "MEMBER";
  isAdmin: boolean;
  isActiveUser: boolean;
};

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}
