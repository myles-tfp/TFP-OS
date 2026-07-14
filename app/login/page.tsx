import Image from "next/image";
import { LoginForm } from "./login-form";

const ERROR_MESSAGES: Record<string, string> = {
  not_authorized:
    "That email isn't on the franchisee roster yet. Reach out to TFP HQ to get set up.",
  auth_failed: "Sign-in didn't go through. Give it another try.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] ?? ERROR_MESSAGES.auth_failed : null;

  return (
    <div className="login-wrap">
      <div className="login-card">
        <Image
          src="/Full_Logo_Green.png"
          alt="The Flying Pickle"
          width={170}
          height={88}
          className="brand-logo"
          priority
        />
        <h1>Welcome to TFP OS</h1>
        <p className="lede">
          Your home base for running your Flying Pickle location.
        </p>
        <LoginForm serverError={errorMessage} />
        <p className="auth-note">
          Access is by invitation from TFP HQ — sign in with the email on your
          franchise agreement.
        </p>
      </div>
    </div>
  );
}
