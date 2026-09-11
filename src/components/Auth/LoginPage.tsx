import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useCheckoutForm } from "../../hooks/useCheckoutForm";
import { useLoginMutation } from "../../features/auth/authApi";
import { useGuestCartMerge } from "../../hooks/useGuestCartMerge";
import { getApiErrorMessage } from "../../lib/apiErrors";
import FormField from "../Checkout/FormField";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Alert, AlertDescription } from "../ui/alert";

interface LoginValues {
    email: string;
    password: string;
}

const EMPTY_VALUES: LoginValues = { email: "", password: "" };

function validate(values: LoginValues) {
    const errors: Partial<Record<keyof LoginValues, string>> = {};
    if (!values.email.trim()) errors.email = "Email is required";
    if (!values.password) errors.password = "Password is required";
    return errors;
}

function LoginPage() {
    const { values, errors, handleChange, validateAll } = useCheckoutForm(EMPTY_VALUES, validate);
    const [login, { isLoading }] = useLoginMutation();
    const { mergeAndClearLocalCart } = useGuestCartMerge();
    const [formError, setFormError] = useState<string | null>(null);
    const navigate = useNavigate();
    const location = useLocation();
    const redirectTo = (location.state as { from?: string } | null)?.from ?? "/";

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
            await login(values).unwrap();
            await mergeAndClearLocalCart();
            navigate(redirectTo, { replace: true });
        } catch (err) {
            setFormError(getApiErrorMessage(err as Parameters<typeof getApiErrorMessage>[0]));
        }
    };

    return (
        <div className="mx-auto max-w-md pb-12">
            <Card className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    <h1 className="font-display text-display-sm">Sign In</h1>

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
                        autoComplete="current-password"
                        value={values.password}
                        error={errors.password}
                        onChange={handleChange}
                    />

                    <Button type="submit" className="min-h-[44px] w-full tracking-wide" disabled={isLoading}>
                        {isLoading ? "Signing in…" : "Sign In"}
                    </Button>

                    <p className="text-center text-sm text-muted-foreground">
                        New here?{" "}
                        <Link to="/register" className="font-medium text-foreground hover:underline">
                            Create an account
                        </Link>
                    </p>
                </form>
            </Card>
        </div>
    );
}

export default LoginPage;
