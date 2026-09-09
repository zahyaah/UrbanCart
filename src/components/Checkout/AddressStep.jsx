import { useCheckoutForm } from "../../hooks/useCheckoutForm";
import FormField from "./FormField";

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
        if (validateAll()) {
            onSubmit(values);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold">Shipping Address</h2>

            <FormField label="Full name" name="fullName" value={values.fullName} error={errors.fullName} onChange={handleChange} />
            <FormField label="Address" name="addressLine1" value={values.addressLine1} error={errors.addressLine1} onChange={handleChange} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="City" name="city" value={values.city} error={errors.city} onChange={handleChange} />
                <FormField label="State / Region" name="region" value={values.region} error={errors.region} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Postal code" name="postalCode" value={values.postalCode} error={errors.postalCode} onChange={handleChange} />
                <FormField label="Country" name="country" value={values.country} error={errors.country} onChange={handleChange} />
            </div>

            <button type="submit" className="min-h-[44px] w-full bg-black text-white font-semibold rounded-md hover:bg-gray-800">
                Continue to Payment
            </button>
        </form>
    );
}

export default AddressStep;
