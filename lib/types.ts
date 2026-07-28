export type Role = "franchisee" | "admin" | "owner";
export type LocationRole = "manager" | "user";

export interface Location {
  id: string;
  name: string;
  founding_members: number | null;
  founding_goal: number;
  grand_opening: string | null;
  /** PlayByPoint facility id or exact facility name feeding this location */
  pbp_facility?: string | null;
  created_at?: string;
}

export interface Franchisee {
  id: string;
  email: string;
  /** legacy display name; location data now lives on `locations` */
  location_name?: string | null;
  role: Role;
  status: "active" | "inactive";
  created_at: string;
  location_id: string | null;
  location_role: LocationRole;
  notifications_seen_at?: string;
  display_name?: string | null;
  avatar_url?: string | null;
  /** joined location row when selected with locations(*) */
  locations?: Location | null;
}
