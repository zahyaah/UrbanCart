import { useParams } from "react-router-dom"
import { motion, useReducedMotion } from "framer-motion"
import ErrorPage from "../ErrorPage/ErrorPage"
import { useAddToCart } from "../../hooks/useAddToCart"
import { useGetProductByIdQuery } from "../../features/products/productsApi"
import { Card } from "../ui/card"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { Skeleton } from "../ui/skeleton"
import { staggerContainer, fadeUp, scaleIn, reduce } from "../../lib/motion"

function ProductSkeleton() {
    return (
        <div className="flex flex-col gap-6 pb-10 md:flex-row">
            <Skeleton className="aspect-square w-full rounded-lg md:w-1/2" />
            <div className="w-full space-y-3 md:w-1/2">
                <Skeleton className="h-9 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-11 w-full" />
            </div>
        </div>
    );
}

function Product() {
    const prefersReducedMotion = useReducedMotion();
    const params = useParams<{ id: string }>();
    const id = params.id;

    const { data, isLoading, isError } = useGetProductByIdQuery(id ?? "", {
        skip: !id,
    });

    const { addProductToCart } = useAddToCart();

    const handleAddToCart = () => {
        if (!data) return;
        addProductToCart({
            id: data.id,
            title: data.title,
            price: data.price,
            image: data.image,
        });
    }

    if (isLoading) return <ProductSkeleton />;
    // isLoading is false past this point, so the earlier "still loading"
    // case is already ruled out -- !data here means the fetch genuinely
    // came back empty (404, or no :id in the route at all). Checking !data
    // directly (rather than a separately computed boolean) is also what
    // lets TS narrow `data` for the JSX below.
    if (isError || !data) {
        return <ErrorPage errorMessage="Product not found" />;
    }

    return (
        <motion.div
            key={data.id}
            variants={reduce(staggerContainer, prefersReducedMotion)}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-6 pb-10 md:flex-row md:gap-10"
        >
            <motion.section
                variants={reduce(scaleIn, prefersReducedMotion)}
                className="w-full md:w-1/2"
            >
                <Card className="overflow-hidden p-0">
                    <div className="mx-auto aspect-square w-full max-h-[28rem] md:max-h-[32rem]">
                        <img
                            src={data.image}
                            alt={data.title}
                            width={600}
                            height={600}
                            className="h-full w-full object-contain p-6"
                        />
                    </div>
                </Card>
            </motion.section>

            <div className="flex w-full flex-col justify-center md:w-1/2">
                <motion.h1
                    variants={reduce(fadeUp, prefersReducedMotion)}
                    className="font-display text-display-sm sm:text-display-md"
                >
                    {data.title}
                </motion.h1>

                {/* shadcn Badge is a fixed h-5; bumping the font past that clips
                    the glyphs, so grow the box with the text instead. */}
                <motion.div variants={reduce(fadeUp, prefersReducedMotion)} className="mt-3">
                    <Badge variant="secondary" className="h-auto px-3 py-1 font-display text-base leading-normal">
                        ${data.price}
                    </Badge>
                </motion.div>

                <motion.p
                    variants={reduce(fadeUp, prefersReducedMotion)}
                    className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base"
                >
                    {data.description}
                </motion.p>

                <motion.div variants={reduce(fadeUp, prefersReducedMotion)}>
                    <Button
                        className="mt-6 min-h-[44px] w-full tracking-wide"
                        onClick={handleAddToCart}
                    >
                        ADD TO CART
                    </Button>
                </motion.div>
            </div>
        </motion.div>
    )
}

export default Product;
