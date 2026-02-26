import { UserProfile } from "@clerk/nextjs";

export default function ProfilePage() {
    return (
        <div
            style={{
                display: "flex",
                justifyContent: "center",
                padding: "2rem 1rem",
                minHeight: "calc(100vh - 64px)",
                animation: "pageIn 0.3s ease",
            }}
        >
            <UserProfile
                appearance={{
                    elements: {
                        rootBox: {
                            width: "100%",
                            maxWidth: "800px",
                        },
                        card: {
                            background: "#12121a",
                            border: "1px solid #1e1e2e",
                            borderRadius: "16px",
                            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                        },
                    },
                }}
            />
        </div>
    );
}
