import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { cartItemPropType } from "../../features/cart/cartItemPropType";
import { Card } from "../ui/card";
import { Button } from "../ui/button";

function ConfirmationStep({ order }) {
    if (!order) return null;

    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <Card className="border-2 border-foreground p-8 text-center space-y-4">
            <h2 className="font-display text-display-md text-success">Order Placed!</h2>
            <p className="text-muted-foreground">
                Order number <span className="font-mono font-semibold text-foreground">{order.orderNumber}</span>
            </p>
            <p className="text-muted-foreground">
                {itemCount} item{itemCount === 1 ? "" : "s"} &middot; $ {order.subtotal.toFixed(2)} subtotal
            </p>
            <p className="text-sm text-muted-foreground">This is a demo order confirmation. No real purchase was made.</p>

            <Button asChild className="min-h-[44px] font-display tracking-wide">
                <Link to="/">Continue Shopping</Link>
            </Button>
        </Card>
    );
}

ConfirmationStep.propTypes = {
    order: PropTypes.shape({
        items: PropTypes.arrayOf(cartItemPropType).isRequired,
        subtotal: PropTypes.number.isRequired,
        orderNumber: PropTypes.string.isRequired,
    }),
};

export default ConfirmationStep;
