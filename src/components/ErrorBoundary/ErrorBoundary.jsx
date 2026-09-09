import { Component } from "react";
import PropTypes from "prop-types";

// React error boundaries must be class components -- there is no hook
// equivalent (as of React 18).
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Unhandled error in component tree:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 px-6">
                    <div className="text-center space-y-2">
                        <h1 className="font-display text-display-md">Something went wrong</h1>
                        <p className="text-gray-600">
                            Please refresh the page. If the problem persists, try again later.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

ErrorBoundary.propTypes = {
    children: PropTypes.node.isRequired,
};

export default ErrorBoundary;
