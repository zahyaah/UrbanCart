import Products from "./components/Products/Products"
import Product from "./components/Product/Product"
import ErrorPage from "./components/ErrorPage/ErrorPage"
import Cart from "./components/Cart/Cart"
import Checkout from "./components/Checkout/Checkout"
import ConfirmationPage from "./components/Checkout/ConfirmationPage"
import Layout from "./components/Layout/Layout"
import LoginPage from "./components/Auth/LoginPage"
import RegisterPage from "./components/Auth/RegisterPage"
import { createBrowserRouter, RouterProvider } from "react-router-dom"

function App() {
    const router = createBrowserRouter([
      {
        element: <Layout />,
        children: [
          { path: "/", element: <Products /> },
          { path: "/product/:id", element: <Product /> },
          { path: "/cart", element: <Cart /> },
          { path: "/checkout", element: <Checkout /> },
          { path: "/checkout/confirmation", element: <ConfirmationPage /> },
          { path: "/login", element: <LoginPage /> },
          { path: "/register", element: <RegisterPage /> },
          { path: "*", element: <ErrorPage /> }
        ]
      }
    ])
    return (
        <RouterProvider router={router} />
    )
}

export default App
