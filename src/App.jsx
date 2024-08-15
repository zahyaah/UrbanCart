import Products from "./components/Products/Products"
import Product from "./components/Product/Product"
import ErrorPage from "./components/ErrorPage/ErrorPage"
import Cart from "./components/Cart/Cart"
import { createBrowserRouter, RouterProvider } from "react-router-dom"

function App() {
    const router = createBrowserRouter([
      { path: "/", element: <Products /> },
      { path: "/product/:id", element: <Product /> },
      { path: "/cart", element: <Cart />},
      { path: "*", element: <ErrorPage /> }
    ])
    return (
        <RouterProvider router={router} />
    )
}

export default App