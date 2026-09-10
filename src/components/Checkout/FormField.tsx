import type { ChangeEvent, InputHTMLAttributes } from "react";
import { Label } from "../ui/label";
import { Input } from "../ui/input";

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "name" | "id"> {
    label: string;
    name: string;
    value: string;
    error?: string;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

function FormField({ label, name, value, error, onChange, placeholder, type = "text", ...inputProps }: FormFieldProps) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={name}>{label}</Label>
            <Input
                id={name}
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                aria-invalid={Boolean(error)}
                className="min-h-[44px]"
                {...inputProps}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
    );
}

export default FormField;
