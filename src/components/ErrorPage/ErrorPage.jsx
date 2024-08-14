function ErrorPage(props) {
    return (
        <div className="h-screen w-full overflow-x-hidden overflow-y-hidden bg-red-900 flex items-center">
            <p className="text-5xl text-black ml-7">
                {props.errorMessage ? props.errorMessage : "ERROR INVALID PAGE"}
            </p>
        </div>
    )
}

export default ErrorPage; 