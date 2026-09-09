import PropTypes from "prop-types";

// Shared shape for a cart item snapshot, used wherever a cart item is
// passed as a prop (CartItem, CartDrawer, checkout confirmation).
export const cartItemPropType = PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    title: PropTypes.string.isRequired,
    price: PropTypes.number.isRequired,
    image: PropTypes.string.isRequired,
    quantity: PropTypes.number.isRequired,
});
