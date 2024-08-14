import {useState, useEffect} from "react"
import Loading from "../Loading/Loading"
import NavBar from "../NavBar/NavBar"
import Card from "../Card/Card";
import ErrorPage from "../ErrorPage/ErrorPage";

async function fetchData() {
    try {
        const response = await fetch("https://65fab3a63909a9a65b1b3cba.mockapi.io/mockAPI/zayd/products", {
            method: "GET"
        })

        if (!response.ok)
            throw new Error("Unable to fetch the data!");

        const storeData = await response.json(); 

        return storeData; 
    }
    catch (err) {
        console.log(err); 
        throw err; 
    }
}
function Products() {
    const [loading, setLoading] = useState(true);
    const [err, setError] = useState(null);
    const [data, setData] = useState([]);

    useEffect(() => {
        fetchData()
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
    }, []);

    return (
        <>
            {loading ? (
                <Loading />
            ) : err ? (
                <ErrorPage errorMessage={err} />
            ) : (
                <>
                    <NavBar />
                    <div className="flex flex-wrap justify-start items-stretch mt-44 ml-2 mr-2 h-screen w-full">
                        {data && data.map((element) => (
                            <Card key={element.id} id={element.id} image={element.image} name={element.name} price={element.price} />
                        ))}
                    </div>
                </>
            )}
        </>
    )
}

export default Products; 