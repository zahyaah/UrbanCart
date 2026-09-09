import PropTypes from "prop-types";

function ErrorPage(props) {
    return (
        <div className="min-h-[calc(100vh-11rem)] w-full bg-red-900 flex items-center px-6 rounded-lg">
            <p className="text-2xl sm:text-4xl md:text-5xl text-white">
                {props.errorMessage ? props.errorMessage : "ERROR INVALID PAGE"}
            </p>
        </div>
    )
}

ErrorPage.propTypes = {
    errorMessage: PropTypes.string,
};

export default ErrorPage;
