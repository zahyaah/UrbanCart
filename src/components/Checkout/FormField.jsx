import PropTypes from "prop-types";
import { Label } from "../ui/label";
import { Input } from "../ui/input";

function FormField({ label, name, value, error, onChange, placeholder, type = "text", ...inputProps }) {
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

FormField.propTypes = {
    label: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired,
    error: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    placeholder: PropTypes.string,
    type: PropTypes.string,
};

export default FormField;
