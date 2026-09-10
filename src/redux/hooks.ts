import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";
import type { AppDispatch, RootState } from "./store";

// Pre-typed versions of the plain react-redux hooks, bound to this app's
// actual store shape. Prefer these over useDispatch/useSelector everywhere:
// state is inferred as RootState instead of `unknown`, and dispatch knows
// about thunks/RTK Query's extra dispatch types instead of being `Dispatch`.
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
