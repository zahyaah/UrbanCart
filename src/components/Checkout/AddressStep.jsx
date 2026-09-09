import PropTypes from "prop-types";
import { useCheckoutForm } from "../../hooks/useCheckoutForm";
import FormField from "./FormField";
import { addressPropType } from "./checkoutPropTypes";
import { Card } from "../ui/card";
import { Button } from "../ui/button";

const EMPTY_ADDRESS = {
    fullName: "",
    addressLine1: "",
    city: "",
    region: "",
    postalCode: "",
    country: "",
};

function validateAddress(values) {
    const errors = {};
    if (!values.fullName.trim()) errors.fullName = "Full name is required";
    if (!values.addressLine1.trim()) errors.addressLine1 = "Address is required";
    if (!values.city.trim()) errors.city = "City is required";
    if (!values.postalCode.trim()) errors.postalCode = "Postal code is required";
    if (!values.country.trim()) errors.country = "Country is required";
    return errors;
}

function AddressStep({ initialValues, onSubmit }) {
    const { values, errors, handleChange, validateAll } = useCheckoutForm(
        initialValues || EMPTY_ADDRESS,
        validateAddress
    );

    const handleSubmit = (event) => {
        event.preventDefault();
        const validationErrors = validateAll();
        const firstErrorField = Object.keys(validationErrors)[0];
        if (!firstErrorField) {
            onSubmit(values);
        } else {
            document.getElementsByName(firstErrorField)[0]?.focus();
        }
    };

    return (
        <Card className="border-2 border-foreground p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="font-display text-display-sm">Shipping Address</h2>

                <FormField label="Full name" name="fullName" autoComplete="name" value={values.fullName} error={errors.fullName} onChange={handleChange} />
                <FormField label="Address" name="addressLine1" autoComplete="street-address" value={values.addressLine1} error={errors.addressLine1} onChange={handleChange} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="City" name="city" autoComplete="address-level2" value={values.city} error={errors.city} onChange={handleChange} />
                    <FormField label="State / Region" name="region" autoComplete="address-level1" value={values.region} error={errors.region} onChange={handleChange} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Postal code" name="postalCode" autoComplete="postal-code" value={values.postalCode} error={errors.postalCode} onChange={handleChange} />
                    <FormField label="Country" name="country" autoComplete="country-name" value={values.country} error={errors.country} onChange={handleChange} />
                </div>

                <Button type="submit" className="min-h-[44px] w-full font-display tracking-wide">
                    Continue to Payment
                </Button>
            </form>
        </Card>
    );
}

AddressStep.propTypes = {
    initialValues: addressPropType,
    onSubmit: PropTypes.func.isRequired,
};

export default AddressStep;
