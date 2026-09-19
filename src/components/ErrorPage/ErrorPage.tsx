import { Link } from "react-router-dom";
import { CircleAlert } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";

interface ErrorPageProps {
    errorMessage?: string;
}

function ErrorPage({ errorMessage }: ErrorPageProps) {
    return (
        <div className="min-h-[calc(100vh-11rem)] w-full flex flex-col items-center justify-center gap-4 px-6">
            <Alert variant="destructive" className="max-w-md">
                <CircleAlert aria-hidden="true" />
                <AlertTitle className="font-display text-base">Something went wrong</AlertTitle>
                <AlertDescription>
                    {errorMessage ? errorMessage : "This page doesn't exist."}
                </AlertDescription>
            </Alert>
            {/* A dead end otherwise -- this is often the first page a
                visitor lands on (bad link, stale product id), so it links
                home rather than relying on browser history. */}
            <Button asChild variant="outline" className="min-h-[44px]">
                <Link to="/">Back to shop</Link>
            </Button>
        </div>
    )
}

export default ErrorPage;
