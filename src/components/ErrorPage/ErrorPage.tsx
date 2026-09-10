import { CircleAlert } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "../ui/alert";

interface ErrorPageProps {
    errorMessage?: string;
}

function ErrorPage({ errorMessage }: ErrorPageProps) {
    return (
        <div className="min-h-[calc(100vh-11rem)] w-full flex items-center justify-center px-6">
            <Alert variant="destructive" className="max-w-md">
                <CircleAlert aria-hidden="true" />
                <AlertTitle className="font-display text-base">Something went wrong</AlertTitle>
                <AlertDescription>
                    {errorMessage ? errorMessage : "This page doesn't exist."}
                </AlertDescription>
            </Alert>
        </div>
    )
}

export default ErrorPage;
