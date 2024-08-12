import {useState, useEffect} from "react";


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
function Product() {
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
            {loading && <p>Loading...</p>}
            {err && <p>Error! {err}</p>}
            {data && data.map((element) => (
                <div key={element.id}>
                    <img src={element.image} alt={element.name} />
                    <p>{element.name}</p>
                    <p>{element.price}</p>
                </div>
            ))}
        </>
    )
}

export default Product; 