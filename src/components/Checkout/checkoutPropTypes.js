import PropTypes from "prop-types";

// Shared shapes for the checkout wizard's captured step data, used by
// both the step that produces it and ReviewStep, which displays it.
export const addressPropType = PropTypes.shape({
    fullName: PropTypes.string,
    addressLine1: PropTypes.string,
    city: PropTypes.string,
    region: PropTypes.string,
    postalCode: PropTypes.string,
    country: PropTypes.string,
});

export const paymentPropType = PropTypes.shape({
    cardholderName: PropTypes.string,
    cardNumber: PropTypes.string,
    expiry: PropTypes.string,
    cvc: PropTypes.string,
});
