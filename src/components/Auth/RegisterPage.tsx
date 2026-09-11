import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCheckoutForm } from "../../hooks/useCheckoutForm";
import { useRegisterMutation } from "../../features/auth/authApi";
import { useGuestCartMerge } from "../../hooks/useGuestCartMerge";
import { getApiErrorMessage } from "../../lib/apiErrors";
import FormField from "../Checkout/FormField";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "../ui/alert";

interface RegisterValues {
    email: string;
    password: string;
}

const EMPTY_VALUES: RegisterValues = { email: "", password: "" };
const MIN_PASSWORD_LENGTH = 8;

function validate(values: RegisterValues) {
    const errors: Partial<Record<keyof RegisterValues, string>> = {};
    if (!values.email.trim()) errors.email = "Email is required";
    if (!values.password) {
        errors.password = "Password is required";
    } else if (values.password.length < MIN_PASSWORD_LENGTH) {
        errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    return errors;
}

function RegisterPage() {
    const { values, errors, handleChange, validateAll } = useCheckoutForm(EMPTY_VALUES, validate);
    const [register, { isLoading }] = useRegisterMutation();
    const { mergeAndClearLocalCart } = useGuestCartMerge();
    const [formError, setFormError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFormError(null);
        const validationErrors = validateAll();
        const firstErrorField = Object.keys(validationErrors)[0];
        if (firstErrorField) {
            document.getElementsByName(firstErrorField)[0]?.focus();
            return;
        }

        try {
            await register(values).unwrap();
            await mergeAndClearLocalCart();
            navigate("/", { replace: true });
        } catch (err) {
            setFormError(getApiErrorMessage(err as Parameters<typeof getApiErrorMessage>[0]));
        }
    };

    return (
        <div className="mx-auto max-w-md pb-12">
            <Card className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    <h1 className="font-display text-display-sm">Create Account</h1>

                    {formError && (
                        <Alert variant="destructive" role="alert">
                            <AlertDescription>{formError}</AlertDescription>
                        </Alert>
                    )}

                    <FormField
                        label="Email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={values.email}
                        error={errors.email}
                        onChange={handleChange}
                    />
                    <FormField
                        label="Password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        value={values.password}
                        error={errors.password}
                        onChange={handleChange}
                    />

                    <Button type="submit" className="min-h-[44px] w-full tracking-wide" disabled={isLoading}>
                        {isLoading ? "Creating account…" : "Create Account"}
                    </Button>

                    <p className="text-center text-sm text-muted-foreground">
                        Already have an account?{" "}
                        <Link to="/login" className="font-medium text-foreground hover:underline">
                            Sign in
                        </Link>
                    </p>
                </form>
            </Card>
        </div>
    );
}

export default RegisterPage;
