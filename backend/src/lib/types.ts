// Shared Mongo document shapes used across route modules.
export type UserDoc = {
  _id: string;
  email: string;
  emailLower: string;
  passwordHash: string;
  name: string;
  country?: string;
  phone?: string;
  avatarUrl?: string;
  referralCode: string;
  referredBy?: string | null;
  walletBalance: number;
  status: "active" | "frozen" | "blocked";
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  resellerPanelId?: string | null;
};

export type PublicUserDto = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  createdAt: string;
  wallet: number;
  verified: true;
  avatarUrl?: string;
};

export function toPublicUser(doc: UserDoc): PublicUserDto {
  const isAdmin = doc.roles.includes("admin") || doc.roles.includes("sub_admin");
  return {
    id: doc._id,
    name: doc.name,
    email: doc.email,
    role: isAdmin ? "admin" : "user",
    createdAt: doc.createdAt.toISOString(),
    wallet: Number(doc.walletBalance ?? 0),
    verified: true,
    avatarUrl: doc.avatarUrl,
  };
}
