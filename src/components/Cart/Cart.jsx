import { useSelector } from "react-redux";
import { useState, useEffect } from "react";
import ErrorPage from "../ErrorPage/ErrorPage";
import Loading from "../Loading/Loading";
import NavBar from "../NavBar/NavBar";
import CartItem from "../CartItem/CartItem";
import OrderSummary from "../OrderSummary/OrderSummary"

async function fetchDataById(id) {
    try {
        const response = await fetch(`https://fakestoreapi.com/products/${id}`, {
            method: "GET"
        });
        if (!response.ok) throw new Error("Unable to fetch product");
        const productFound = await response.json();
        return productFound;
    } catch (err) {
        console.log(err);
        throw err;
    }
}

function Cart() {
    // Accessing the cart state from the Redux store
    const store = useSelector((state) => state.cart);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [addedProducts, setAddedProducts] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            const result = [];
            for (const item of store) {
                try {
                    const product = await fetchDataById(item.id);
                    result.push({ product, quantity: item.quantity });
                } catch (err) {
                    console.log(err);
                    setError(err);
                }
            }
            setAddedProducts(result);
            setLoading(false);
        };

        fetchData();
    }, [store]);

    return (
        <>
            {loading ? (
                <Loading />
            ) : error ? (
                <ErrorPage errorMessage={error.message} />
            ) : (
                <>
                    <NavBar />
                    <div className="flex flex-col items-center mt-44 h-fit w-full bg-gray-100 p-8">
                        {addedProducts.length !== 0 ? (
                            <>
                                <OrderSummary />
                                {addedProducts.map((element, index) => (
                                    <CartItem 
                                        key={index} 
                                        id={element.product.id} 
                                        title={element.product.title} 
                                        image={element.product.image} 
                                        price={element.product.price} 
                                        description={element.product.description} 
                                    />
                                ))}
                            </>
                        ) : (
                            <p className="text-center text-3xl">Cart is empty!</p>
                        )}
                    </div>

                </>
            )}
        </>
    );
}

export default Cart;
