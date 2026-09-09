function FormField({ label, name, value, error, onChange, placeholder, type = "text" }) {
    return (
        <label className="block">
            <span className="text-sm font-medium text-gray-700">{label}</span>
            <input
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className={`mt-1 block w-full min-h-[44px] rounded-md border px-3 ${
                    error ? "border-red-500" : "border-gray-300"
                }`}
            />
            {error && <span className="text-sm text-red-600">{error}</span>}
        </label>
    );
}

export default FormField;
