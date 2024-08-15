import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

async function fetchProductById(id) {
    try {
        const response = await fetch(`https://fakestoreapi.com/products/${id}`);
        if (!response.ok) throw new Error("Unable to fetch product");
        const product = await response.json();
        return product;
    } catch (err) {
        console.log(err);
        throw err;
    }
}

function CartSummary() {
    // accessing the cart state from the redux store
    const store = useSelector(state => state.cart);
    const [items, setItems] = useState(0);
    const [totalAmount, setTotalAmount] = useState(0);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPrices = async () => {
            const promises = store.map(item => fetchProductById(item.id));
            try {
                const products = await Promise.all(promises);
                const total = products.reduce((acc, product, index) => {
                    return acc + product.price * store[index].quantity;
                }, 0);
                setTotalAmount(total);
            } catch (err) {
                console.log(err);
                setError(err);
            }
            setLoading(false);
        };
        fetchPrices();

        const totalItems = store.reduce((sum, item) => sum + parseInt(item.quantity, 10), 0);
        setItems(totalItems);
    }, [store]);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error.message}</div>;

    return (
        <div className="w-full md:w-5/6 lg:w-1/2 border border-gray-300 shadow-lg rounded-lg p-6 mb-4 bg-white">
            <h2 className="text-xl font-semibold mb-6 text-gray-800">PRICE DETAILS ({items} Items)</h2>
            <div className="space-y-3">
                <div className="flex justify-between text-gray-600">
                    <span>Total MRP</span>
                    <span className="font-medium">${totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-gray-600">
                    <span>
                        Platform Fee 
                        <span className="text-blue-600 ml-1 cursor-pointer">Know More</span>
                    </span>
                    <span className="font-medium text-green-600">FREE</span>
                </div>
                <div className="flex justify-between items-center text-gray-600">
                    <span>
                        Shipping Fee 
                        <span className="text-blue-600 ml-1 cursor-pointer">Know More</span>
                    </span>
                    <span className="font-medium text-green-600">FREE</span>
                </div>
                <div className="flex justify-between text-gray-600 font-semibold">
                    <span className="text-green-600">Free shipping for you</span>
                    <span className="font-medium text-green-600">FREE</span>
                </div>
            </div>
            <hr className="my-4 border-gray-300"/>
            <div className="flex justify-between text-gray-800 text-lg font-semibold">
                <span>Total Amount</span>
                <span>${totalAmount.toFixed(2)}</span>
            </div>
            <button className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 rounded-lg mt-6">
                PLACE ORDER
            </button>
        </div>
    );
}

export default CartSummary;
