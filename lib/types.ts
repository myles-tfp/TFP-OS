export type Role = "franchisee" | "admin";

export interface Franchisee {
  id: string;
  email: string;
  location_name: string | null;
  role: Role;
  status: "active" | "inactive";
  created_at: string;
}
