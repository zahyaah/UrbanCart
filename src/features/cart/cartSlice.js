import { createSlice } from "@reduxjs/toolkit";

// load initial state from localstorage
const loadState = () => {
    try {
        const serializedState = localStorage.getItem("cart");
        return serializedState ? JSON.parse(serializedState) : { cart: [] };
    } catch (e) {
        console.error("Could not load state", e);
        return { cart: [] };
    }
};

const initialState = loadState();

export const cartSlice = createSlice({
    name: "cart",
    initialState, 
    reducers: {
        addToCart: (state, action) => {
            const existingItem = state.cart.find(item => item.id === action.payload.id);
            if (existingItem) {
                existingItem.quantity += action.payload.quantity || 1;
            } 
            else {
                state.cart.push({
                    id: action.payload.id, 
                    quantity: action.payload.quantity || 1
                });
            }

            // save the updated cart state in the loclastorage. 
            localStorage.setItem("cart", JSON.stringify(state));
        },
        reduceQuantity: (state, action) => {
            const existingItem = state.cart.find(item => item.id === action.payload.id);
            if (existingItem) {
                existingItem.quantity -= action.payload.quantity || 1;
                if (existingItem.quantity <= 0) {
                    state.cart = state.cart.filter(item => item.id !== action.payload.id);
                }
            }
            
            // save the updated cart state in the localstorage. 
            localStorage.setItem("cart", JSON.stringify(state));
        },
        removeFromCart: (state, action) => {
            state.cart = state.cart.filter(item => item.id !== action.payload.id);

            // save the updated cart state in the localstorage. 
            localStorage.setItem("cart", JSON.stringify(state));
        }
    } 
});

export const { addToCart, reduceQuantity, removeFromCart } = cartSlice.actions; 
export default cartSlice.reducer;
