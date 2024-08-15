import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import Loading from "../Loading/Loading"
import ErrorPage from "../ErrorPage/ErrorPage"
import NavBar from "../NavBar/NavBar"
import { useDispatch } from "react-redux";
import { addToCart } from "../../features/cart/cartSlice"
import PopUp from "../PopUp/PopUp"


async function fetchDataById(id) {
    try {
        const response = await fetch("https://fakestoreapi.com/products", {
            method: "GET"
        })
        if (!response.ok)
            throw new Error("Unable to fetch products")
        const data = await response.json(); 
        const productFound = data.find((element) => element.id === id); 
        if (!productFound)
            throw new Error("Product not found :')")
        return productFound; 
    }
    catch (err) {
        console.log(err); 
        throw err; 
    }
}
function Product() {
    const params = useParams(); 

    const [loading, setLoading] = useState(true);
    const [err, setError] = useState(null);
    const [data, setData] = useState([]);
    const id = parseInt(params.id);
    useEffect(() => {
        fetchDataById(id)
        .then((dataFetched) => {
            if (dataFetched)
                setData(dataFetched);
            else 
                setError("No data available")
            setLoading(false);
        })
        .catch((fetchError) => {
            setError(fetchError.message || "An error occurred :')");
            setLoading(false);
        })
    }, [id]);

    const dispatch = useDispatch(); 
    const [visible, setVisible] = useState(false);
    
    const handleAddToCart = () => {
        setVisible(true);
        const getId = parseInt(data.id, 10);
        dispatch(addToCart({id: getId}));
        setTimeout(() => {
            setVisible(false);
        }, 3000);
    }
    

    return (
        <>
            {loading ? (
                <Loading />
            ) : err ? (
                <ErrorPage errorMessage={err} />
            ) : (
                <>
                                
                    { visible && <PopUp /> }
                    <NavBar />
                    <div key={data.id} className="mt-44 ml-2 mr-2 h-[calc(100vh-11rem)] flex flex-col md:flex-row md:gap-4">
                        <section className="w-full md:w-1/2">
                            <img src={data.image} alt={data.title} className="border-black border-2 w-full h-auto p-4 md:h-[500px] object-contain"/>
                        </section>

                        <aside className="h-fit w-full md:w-1/2 md:mt-0 md:ml-4 p-6 border-black border-2 rounded-md">
                            <h2 className="font-mono text-2xl">{data.title}</h2>
                            <p className="text-xl text-gray-500">{data.description}</p>
                            <p className="text-2xl font-bold">${data.price}</p>

                            <button className="h-[40px] w-full border-2 p-2 mt-4 border-black font-mono text-center bg-white hover:bg-black hover:text-white"
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
