import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
    return (
        <div
            style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "calc(100vh - 64px)",
            }}
        >
            <SignIn />
        </div>
    );
}
