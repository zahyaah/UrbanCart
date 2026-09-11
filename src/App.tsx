import { lazy, Suspense } from "react"
import Products from "./components/Products/Products"
import Layout from "./components/Layout/Layout"
import { createBrowserRouter, RouterProvider } from "react-router-dom"

// Products (the landing route) and Layout load eagerly -- first paint must
// not be gated on a lazy chunk. Everything else, especially Checkout (which
// pulls in the ~130 KB Stripe Elements SDK), only needs to load once a
// shopper actually navigates there.
const Product = lazy(() => import("./components/Product/Product"))
const ErrorPage = lazy(() => import("./components/ErrorPage/ErrorPage"))
const Cart = lazy(() => import("./components/Cart/Cart"))
const Checkout = lazy(() => import("./components/Checkout/Checkout"))
const ConfirmationPage = lazy(() => import("./components/Checkout/ConfirmationPage"))
const LoginPage = lazy(() => import("./components/Auth/LoginPage"))
const RegisterPage = lazy(() => import("./components/Auth/RegisterPage"))

const routeFallback = <p className="py-16 text-center text-muted-foreground">Loading…</p>

function withSuspense(element: React.ReactNode) {
    return <Suspense fallback={routeFallback}>{element}</Suspense>
}

function App() {
    const router = createBrowserRouter([
      {
        element: <Layout />,
        children: [
          { path: "/", element: <Products /> },
          { path: "/product/:id", element: withSuspense(<Product />) },
          { path: "/cart", element: withSuspense(<Cart />) },
          { path: "/checkout", element: withSuspense(<Checkout />) },
          { path: "/checkout/confirmation", element: withSuspense(<ConfirmationPage />) },
          { path: "/login", element: withSuspense(<LoginPage />) },
          { path: "/register", element: withSuspense(<RegisterPage />) },
          { path: "*", element: withSuspense(<ErrorPage />) }
        ]
      }
    ])
    return (
        <RouterProvider router={router} />
    )
}

export default App
