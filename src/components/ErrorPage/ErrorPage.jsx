import PropTypes from "prop-types";
import { CircleAlert } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "../ui/alert";

function ErrorPage(props) {
    return (
        <div className="min-h-[calc(100vh-11rem)] w-full flex items-center justify-center px-6">
            <Alert variant="destructive" className="max-w-md border-2 border-destructive">
                <CircleAlert aria-hidden="true" />
                <AlertTitle className="font-display text-base">Something went wrong</AlertTitle>
                <AlertDescription>
                    {props.errorMessage ? props.errorMessage : "This page doesn't exist."}
                </AlertDescription>
            </Alert>
        </div>
    )
}

ErrorPage.propTypes = {
    errorMessage: PropTypes.string,
};

export default ErrorPage;
