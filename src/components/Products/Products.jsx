import Loading from "../Loading/Loading"
import Card from "../Card/Card";
import ErrorPage from "../ErrorPage/ErrorPage";
import { useGetProductsQuery } from "../../features/products/productsApi"

function Products() {
    const { data, isLoading, isError } = useGetProductsQuery();

    if (isLoading) return <Loading />;
    if (isError) return <ErrorPage errorMessage="Unable to fetch products" />;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-8">
            {data && data.map((element) => (
                <Card key={element.id} id={element.id} image={element.image} title={element.title} price={element.price} />
            ))}
        </div>
    )
}

export default Products;
