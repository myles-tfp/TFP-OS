import { getFranchisee } from "@/lib/get-franchisee";

export default async function HomePage() {
  const franchisee = await getFranchisee();

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const name = franchisee.location_name || "pickler";

  return (
    <>
      <div className="page-head">
        <h1>Welcome back, {name}</h1>
        <span className="date">{today}</span>
      </div>
      <p className="subtitle">
        Everything you need to run your location — resources, updates, and your
        onboarding, all in one place.
      </p>

      <section className="panel">
        <div className="panel-head">
          <h2>You&apos;re in</h2>
        </div>
        <p className="panel-note">
          Login and the app shell are live. Next up: the franchisor feed,
          resource library, and your home dashboard.
        </p>
      </section>
    </>
  );
}
