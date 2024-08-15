import { useDispatch, useSelector } from "react-redux";
import { removeFromCart, addToCart, reduceQuantity } from "../../features/cart/cartSlice";

function CartItem(props) {
    const dispatch = useDispatch(); 

    // Function to remove item from cart
    const removeItem = () => {
        dispatch(removeFromCart({ id: props.id }));
    };

    // Functions to increase and decrease quantity
    const increaseQuantity = () => {
        dispatch(addToCart({ id: props.id, quantity: 1 }));
    };

    const decreaseQuantity = () => {
        dispatch(reduceQuantity({ id: props.id, quantity: 1 }));
    };

    // Accessing the cart state from the Redux store
    const store = useSelector(state => state.cart);
    const thatProduct = store.find(item => item.id === props.id);

    // Handling case where product is not found
    if (!thatProduct) {
        return null;
    }
    
    return (
        <div className="w-full md:w-5/6 border border-gray-300 shadow-lg rounded-lg flex flex-col md:flex-row items-center p-4 mb-4 bg-white">
            <div className="h-48 md:h-72 w-full md:w-2/5 mb-4 md:mb-0 flex-shrink-0">
                <img 
                    src={props.image} 
                    alt={props.title} 
                    className="h-full w-full object-contain rounded-lg"
                />
            </div>
            <div className="w-full md:w-3/5 pl-0 md:pl-4 flex flex-col justify-between">
                <h2 className="text-lg md:text-xl font-semibold mb-2 break-words">
                    {props.title}
                </h2>
                <h1 className="text-sm md:text-[15px] text-gray-500 break-words">
                    {props.description.slice(0, 100)}...
                </h1>

                {/* quantity controls */}
                <div className="flex items-center mt-4">
                    <button 
                        onClick={decreaseQuantity} 
                        className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-l"
                    >
                        -
                    </button>
                    <span className="px-4 py-2 text-xl md:text-2xl font-semibold bg-gray-100 text-gray-800">
                        {thatProduct.quantity}
                    </span>
                    <button 
                        onClick={increaseQuantity} 
                        className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-r"
                    >
                        +
                    </button>
                </div>

                <p className="text-2xl md:text-3xl font-bold mt-2">
                    $ {thatProduct.quantity * parseFloat(props.price)}
                </p>

                <button 
                    onClick={removeItem} 
                    className="mt-4 bg-transparent hover:bg-red-600 text-red-700 font-semibold hover:text-white py-2 px-4 border border-red-500 hover:border-transparent rounded"
                >
                    Remove Item
                </button>
            </div>
        </div>
    );
}

export default CartItem;
