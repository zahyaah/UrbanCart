import { useCallback, useState } from "react";

// Small controlled-form hook shared by the checkout Address/Payment steps.
// Not worth a form library for two steps -- this is the whole pattern.
export function useCheckoutForm(initialValues, validate) {
    const [values, setValues] = useState(initialValues);
    const [errors, setErrors] = useState({});

    const handleChange = useCallback((event) => {
        const { name, value } = event.target;
        setValues((prev) => ({ ...prev, [name]: value }));
    }, []);

    const validateAll = useCallback(() => {
        const nextErrors = validate(values);
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    }, [values, validate]);

    return { values, errors, handleChange, validateAll };
}
