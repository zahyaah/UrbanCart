import { motion, useReducedMotion } from "framer-motion";
import Card from "../Card/Card";
import ErrorPage from "../ErrorPage/ErrorPage";
import { Skeleton } from "../ui/skeleton";
import { useGetProductsQuery } from "../../features/products/productsApi"
import { staggerContainer, fadeUp, reduce } from "../../lib/motion";

const SKELETON_COUNT = 8;
const GRID = "grid grid-cols-2 gap-3 pb-8 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4";

function ProductsSkeleton() {
    return (
        <div className={GRID}>
            {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
                <div key={index} className="overflow-hidden rounded-lg border border-border">
                    <Skeleton className="aspect-square w-full rounded-none" />
                    <div className="space-y-2 p-2.5">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-3 w-1/3" />
                        <Skeleton className="h-11 w-full" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function Products() {
    const prefersReducedMotion = useReducedMotion();
    const { data, isLoading, isError } = useGetProductsQuery();

    if (isLoading) return <ProductsSkeleton />;
    if (isError) return <ErrorPage errorMessage="Unable to fetch products" />;

    return (
        <>
            <motion.div
                initial="hidden"
                animate="show"
                variants={reduce(fadeUp, prefersReducedMotion)}
                className="mb-6 sm:mb-8"
            >
                <h1 className="font-display text-display-sm sm:text-display-md">Everything, in one cart.</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    {data?.length ?? 0} products, hand-picked for no particular reason.
                </p>
            </motion.div>

            <motion.div
                variants={reduce(staggerContainer, prefersReducedMotion)}
                initial="hidden"
                animate="show"
                className={GRID}
            >
                {data && data.map((element) => (
                    <Card key={element.id} id={element.id} image={element.image} title={element.title} price={element.price} />
                ))}
            </motion.div>
        </>
    )
}

export default Products;
