import NavBar from "./components/NavBar/NavBar"
import Products from "./components/Products/Products"
import Product from "./components/Product/Product"
import ErrorPage from "./components/ErrorPage/ErrorPage"
import { createBrowserRouter, RouterProvider } from "react-router-dom"

function App() {
  const router = createBrowserRouter([
    { path: "/", element: <> <NavBar /><Products /> </> },
    { path: "/product/:id", element: <Product /> },
    { path: "*", element: <ErrorPage /> }
  ])
  return (
      <RouterProvider router={router} />
  )
}

export default App