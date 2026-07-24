import { getFranchisee, locationName } from "@/lib/get-franchisee";
import { AccountForm } from "@/components/account-form";

export default async function AccountPage() {
  const me = await getFranchisee();

  return (
    <>
      <div className="page-head">
        <h1>Your account</h1>
      </div>
      <p className="subtitle">
        Your name and photo show up in chat and reactions — always alongside{" "}
        {locationName(me)}.
      </p>

      <section className="panel" style={{ maxWidth: 520 }}>
        <AccountForm me={me} />
      </section>
    </>
  );
}
