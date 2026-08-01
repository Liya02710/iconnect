export type Role = "Admin" | "Client";

export type User = {
  id: number | string;
  name: string;
  username: string;
  password: string;
  phone: string;
  role: Role;
  active: boolean;
  lastActive: string;
  joined: string;
  avatar: string;
};
