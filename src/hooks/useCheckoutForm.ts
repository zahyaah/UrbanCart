import { useCallback, useState, type ChangeEvent } from "react";

type FormErrors<T> = Partial<Record<keyof T, string>>;

// Small controlled-form hook shared by the checkout Address/Payment steps.
// Not worth a form library for two steps -- this is the whole pattern.
//
// T isn't constrained to Record<string, string>: a concrete form-values
// interface (Address, Payment) has no index signature, so it fails that
// constraint even though every field really is a string. The per-field
// contract is enforced where it matters -- callers pass a real interface,
// and `validate` is typed against that same T.
export function useCheckoutForm<T extends object>(
    initialValues: T,
    validate: (values: T) => FormErrors<T>
) {
    const [values, setValues] = useState<T>(initialValues);
    const [errors, setErrors] = useState<FormErrors<T>>({});

    const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        setValues((prev) => ({ ...prev, [name]: value }) as T);
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
