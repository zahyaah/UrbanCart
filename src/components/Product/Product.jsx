import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import Loading from "../Loading/Loading"
import ErrorPage from "../ErrorPage/ErrorPage"
import NavBar from "../NavBar/NavBar"

async function fetchDataById(id) {
    try {
        const response = await fetch("https://65fab3a63909a9a65b1b3cba.mockapi.io/mockAPI/zayd/products", {
            method: "GET"
        })
        if (!response.ok)
            throw new Error("Unable to fetch products")
        const data = await response.json(); 
        const productFound = data.find((element) => element.id === id); 
        if (!productFound)
            throw new Error("Product not found!")
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

    return (
        <>
            { loading && <Loading /> }
            { err && <ErrorPage />}
            <NavBar />
            <div key={data.id} className="mt-44 h-[calc(100vh-11rem)] flex flex-wrap">
                <section className="w-1/2 border-black border-2 border-r-0">
                    <img src={data.image} alt={data.name} />
                </section>
                <aside className="w-1/2 border-black border-2">
                    <p> {data.name} </p>
                    <p> {data.price} </p>
                </aside>
            </div>
        </>
    )
}

export default Product; 