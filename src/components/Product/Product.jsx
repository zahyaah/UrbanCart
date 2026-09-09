import { useParams } from "react-router-dom"
import Loading from "../Loading/Loading"
import ErrorPage from "../ErrorPage/ErrorPage"
import { useAddToCart } from "../../hooks/useAddToCart"
import PopUp from "../PopUp/PopUp"
import { useGetProductByIdQuery } from "../../features/products/productsApi"

function Product() {
    const params = useParams();
    const id = parseInt(params.id, 10);

    const { data, isLoading, isError } = useGetProductByIdQuery(id, {
        skip: Number.isNaN(id),
    });
    const notFound = Number.isNaN(id) || isError || (!isLoading && !data);

    const { addProductToCart, toastVisible } = useAddToCart();

    const handleAddToCart = () => {
        addProductToCart({
            id: parseInt(data.id, 10),
            title: data.title,
            price: data.price,
            image: data.image,
        });
    }

    return (
        <>
            {isLoading ? (
                <Loading />
            ) : notFound ? (
                <ErrorPage errorMessage="Product not found" />
            ) : (
                <>
                    { toastVisible && <PopUp /> }
                    <div key={data.id} className="h-[calc(100vh-11rem)] flex flex-col md:flex-row md:gap-4">
                        <section className="w-full md:w-1/2">
                            <img src={data.image} alt={data.title} className="border-black border-2 w-full h-auto p-4 md:h-[500px] object-contain"/>
                        </section>

                        <aside className="h-fit w-full md:w-1/2 md:mt-0 md:ml-4 p-6 border-black border-2 rounded-md">
                            <h2 className="font-display text-display-sm">{data.title}</h2>
                            <p className="text-base sm:text-xl text-gray-500 mt-2">{data.description}</p>
                            <p className="text-2xl font-bold mt-2">${data.price}</p>

                            <button className="min-h-[44px] w-full border-2 p-2 mt-4 border-black font-display tracking-wide text-center bg-white hover:bg-black hover:text-white"
                                onClick={handleAddToCart}
                            >
                                ADD TO CART
                            </button>
                        </aside>
                    </div>
                </>
            )}
        </>
    )
}

export default Product;
