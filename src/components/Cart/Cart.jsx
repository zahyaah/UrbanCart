import { useSelector } from "react-redux";
import NavBar from "../NavBar/NavBar";
import CartItem from "../CartItem/CartItem";
import OrderSummary from "../OrderSummary/OrderSummary";
import { selectCartItems } from "../../features/cart/cartSelectors";

function Cart() {
    const items = useSelector(selectCartItems);

    return (
        <>
            <NavBar />
            <div className="flex flex-col items-center mt-44 h-fit w-full bg-gray-100 p-8">
                {items.length !== 0 ? (
                    <>
                        <OrderSummary mode="cart" />
                        {items.map((item) => (
                            <CartItem key={item.id} item={item} />
                        ))}
                    </>
                ) : (
                    <p className="text-center text-3xl">Cart is empty!</p>
                )}
            </div>
        </>
    );
}

export default Cart;
