import { Sidebar } from "@/components/sidebar";
import { getFranchisee } from "@/lib/get-franchisee";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const franchisee = await getFranchisee();

  return (
    <div className="shell">
      <Sidebar franchisee={franchisee} />
      <main className="main">{children}</main>
    </div>
  );
}
