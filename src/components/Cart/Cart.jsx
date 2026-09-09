import { useSelector } from "react-redux";
import CartItem from "../CartItem/CartItem";
import OrderSummary from "../OrderSummary/OrderSummary";
import { selectCartItems } from "../../features/cart/cartSelectors";

function Cart() {
    const items = useSelector(selectCartItems);

    return (
        <div className="flex flex-col items-center h-fit w-full bg-gray-100 p-4 sm:p-8 rounded-lg">
            {items.length !== 0 ? (
                <>
                    <OrderSummary mode="cart" />
                    {items.map((item) => (
                        <CartItem key={item.id} item={item} />
                    ))}
                </>
            ) : (
                <p className="text-center text-2xl sm:text-3xl py-12">Cart is empty!</p>
            )}
        </div>
    );
}

export default Cart;
