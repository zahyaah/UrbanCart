import Loading from "../Loading/Loading"
import NavBar from "../NavBar/NavBar"
import Card from "../Card/Card";
import ErrorPage from "../ErrorPage/ErrorPage";
import { useGetProductsQuery } from "../../features/products/productsApi"

function Products() {
    const { data, isLoading, isError } = useGetProductsQuery();

    return (
        <>
            {isLoading ? (
                <Loading />
            ) : isError ? (
                <ErrorPage errorMessage="Unable to fetch products" />
            ) : (
                <>
                    <NavBar />
                    <div className="flex flex-wrap justify-start items-stretch mt-44 ml-2 mr-2 h-screen w-full">
                        {data && data.map((element) => (
                            <Card key={element.id} id={element.id} image={element.image} title={element.title} price={element.price} />
                        ))}
                    </div>
                </>
            )}
        </>
    )
}

export default Products;
