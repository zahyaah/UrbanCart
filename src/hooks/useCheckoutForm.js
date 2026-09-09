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

    // Returns the errors object (not just a boolean) so callers can focus
    // the first invalid field on a failed submit.
    const validateAll = useCallback(() => {
        const nextErrors = validate(values);
        setErrors(nextErrors);
        return nextErrors;
    }, [values, validate]);

    return { values, errors, handleChange, validateAll };
}
