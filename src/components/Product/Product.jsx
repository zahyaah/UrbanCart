import { useParams } from "react-router-dom"
import ErrorPage from "../ErrorPage/ErrorPage"
import { useAddToCart } from "../../hooks/useAddToCart"
import { useGetProductByIdQuery } from "../../features/products/productsApi"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { Skeleton } from "../ui/skeleton"

function ProductSkeleton() {
    return (
        <div className="flex h-[calc(100vh-11rem)] flex-col gap-4 md:flex-row">
            <Skeleton className="w-full rounded-md border-2 border-foreground md:h-[500px] md:w-1/2" />
            <div className="w-full space-y-3 rounded-md border-2 border-foreground p-6 md:w-1/2">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-6 w-1/4" />
                <Skeleton className="h-11 w-full" />
            </div>
        </div>
    );
}

function Product() {
    const params = useParams();
    const id = parseInt(params.id, 10);

    const { data, isLoading, isError } = useGetProductByIdQuery(id, {
        skip: Number.isNaN(id),
    });
    const notFound = Number.isNaN(id) || isError || (!isLoading && !data);

    const { addProductToCart } = useAddToCart();

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
                <ProductSkeleton />
            ) : notFound ? (
                <ErrorPage errorMessage="Product not found" />
            ) : (
                <>
                    <div key={data.id} className="h-[calc(100vh-11rem)] flex flex-col md:flex-row md:gap-4">
                        <section className="w-full md:w-1/2">
                            <img src={data.image} alt={data.title} width={600} height={600} className="border-foreground bg-card border-2 w-full h-auto p-4 md:h-[500px] object-contain rounded-md"/>
                        </section>

                        <aside className="h-fit w-full md:w-1/2 md:mt-0 md:ml-4 p-6 border-foreground border-2 rounded-md bg-card">
                            <h2 className="font-display text-display-sm">{data.title}</h2>
                            <p className="text-base sm:text-xl text-muted-foreground mt-2">{data.description}</p>
                            <Badge className="mt-3 bg-accent text-accent-foreground text-base px-3 py-1">${data.price}</Badge>

                            <Button
                                className="min-h-[44px] w-full mt-4 font-display tracking-wide"
                                onClick={handleAddToCart}
                            >
                                ADD TO CART
                            </Button>
                        </aside>
                    </div>
                </>
            )}
        </>
    )
}

export default Product;
