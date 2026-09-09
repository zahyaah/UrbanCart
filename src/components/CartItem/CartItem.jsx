import { useDispatch } from "react-redux";
import { Minus, Plus } from "lucide-react";
import { removeFromCart, incrementQuantity, decrementQuantity } from "../../features/cart/cartSlice";
import { cartItemPropType } from "../../features/cart/cartItemPropType";
import { Card } from "../ui/card";
import { Button } from "../ui/button";

function CartItem({ item }) {
    const dispatch = useDispatch();

    const removeItem = () => {
        dispatch(removeFromCart({ id: item.id }));
    };

    const increaseQuantity = () => {
        dispatch(incrementQuantity({ id: item.id }));
    };

    const decreaseQuantity = () => {
        dispatch(decrementQuantity({ id: item.id }));
    };

    return (
        <Card className="w-full md:w-5/6 flex-col md:flex-row items-center gap-4 border-2 border-foreground p-4 mb-4">
            <div className="h-48 md:h-72 w-full md:w-2/5 mb-4 md:mb-0 flex-shrink-0">
                <img
                    src={item.image}
                    alt={item.title}
                    width={400}
                    height={400}
                    className="h-full w-full object-contain rounded-lg"
                />
            </div>
            <div className="w-full md:w-3/5 pl-0 md:pl-4 flex flex-col justify-between">
                <h2 className="font-display text-lg md:text-xl mb-2 break-words">
                    {item.title}
                </h2>

                <div className="flex items-center mt-4 gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="min-h-[44px] min-w-[44px]"
                        onClick={decreaseQuantity}
                        aria-label={`Decrease quantity of ${item.title}`}
                    >
                        <Minus aria-hidden="true" />
                    </Button>
                    <span className="min-h-[44px] px-4 flex items-center justify-center text-xl md:text-2xl font-semibold">
                        {item.quantity}
                    </span>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="min-h-[44px] min-w-[44px]"
                        onClick={increaseQuantity}
                        aria-label={`Increase quantity of ${item.title}`}
                    >
                        <Plus aria-hidden="true" />
                    </Button>
                </div>

                <p className="text-2xl md:text-3xl font-bold mt-2">
                    $ {(item.quantity * item.price).toFixed(2)}
                </p>

                <Button
                    type="button"
                    variant="outline"
                    className="mt-4 w-fit min-h-[44px] border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={removeItem}
                >
                    Remove Item
                </Button>
            </div>
        </Card>
    );
}

CartItem.propTypes = {
    item: cartItemPropType.isRequired,
};

export default CartItem;
