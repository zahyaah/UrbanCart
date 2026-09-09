import Card from "../Card/Card";
import ErrorPage from "../ErrorPage/ErrorPage";
import { Skeleton } from "../ui/skeleton";
import { useGetProductsQuery } from "../../features/products/productsApi"

const SKELETON_COUNT = 8;

function ProductsSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-6 pb-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
                <div key={index} className="overflow-hidden rounded-lg border-2 border-foreground">
                    <Skeleton className="aspect-square w-full rounded-none" />
                    <div className="space-y-2 p-3">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-5 w-1/3" />
                    </div>
                    <Skeleton className="h-11 w-full rounded-none" />
                </div>
            ))}
        </div>
    );
}

function Products() {
    const { data, isLoading, isError } = useGetProductsQuery();

    if (isLoading) return <ProductsSkeleton />;
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
