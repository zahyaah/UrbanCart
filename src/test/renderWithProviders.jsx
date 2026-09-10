import PropTypes from "prop-types";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";
import { createStore } from "../redux/store";

// Renders a component inside a fresh store + router, so component tests never
// share state through the app singleton.
export function renderWithProviders(
    ui,
    { preloadedState, store = createStore(preloadedState), route = "/", ...options } = {}
) {
    function Wrapper({ children }) {
        return (
            <Provider store={store}>
                <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
            </Provider>
        );
    }

    Wrapper.propTypes = { children: PropTypes.node };

    return { store, ...render(ui, { wrapper: Wrapper, ...options }) };
}
