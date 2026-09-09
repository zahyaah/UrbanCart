import { useSelector } from "react-redux";
import CartItem from "../CartItem/CartItem";
import OrderSummary from "../OrderSummary/OrderSummary";
import { selectCartItems } from "../../features/cart/cartSelectors";

function Cart() {
    const items = useSelector(selectCartItems);

    return (
        <div className="flex flex-col items-center h-fit w-full rounded-lg bg-muted/40 p-4 sm:p-8">
            {items.length !== 0 ? (
                <>
                    <OrderSummary mode="cart" />
                    {items.map((item) => (
                        <CartItem key={item.id} item={item} />
                    ))}
                </>
            ) : (
                <p className="text-center text-2xl sm:text-3xl py-12 text-muted-foreground">Cart is empty!</p>
            )}
        </div>
    );
}

export default Cart;
