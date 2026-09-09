import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { Minus, Plus } from "lucide-react";

import { decrementQuantity, incrementQuantity, removeFromCart } from "../../features/cart/cartSlice";
import { selectCartItems, selectCartSubtotal } from "../../features/cart/cartSelectors";
import { cartItemPropType } from "../../features/cart/cartItemPropType";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "../ui/sheet";
import { Button } from "../ui/button";

function CartSheetItem({ item }) {
    const dispatch = useDispatch();

    return (
        <div className="flex items-center gap-3 border-b border-border pb-3">
            <img src={item.image} alt={item.title} width={56} height={56} className="h-14 w-14 flex-shrink-0 rounded-md border border-border bg-card object-contain p-1" />
            <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">$ {item.price.toFixed(2)}</p>
                <div className="mt-1 flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => dispatch(decrementQuantity({ id: item.id }))}
                        aria-label={`Decrease quantity of ${item.title}`}
                    >
                        <Minus aria-hidden="true" />
                    </Button>
                    <span className="w-5 text-center text-sm">{item.quantity}</span>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => dispatch(incrementQuantity({ id: item.id }))}
                        aria-label={`Increase quantity of ${item.title}`}
                    >
                        <Plus aria-hidden="true" />
                    </Button>
                </div>
            </div>
            <Button
                type="button"
                variant="ghost"
                className="flex-shrink-0 text-xs text-destructive hover:text-destructive"
                onClick={() => dispatch(removeFromCart({ id: item.id }))}
            >
                Remove
            </Button>
        </div>
    );
}

CartSheetItem.propTypes = {
    item: cartItemPropType.isRequired,
};

function CartSheet({ open, onOpenChange }) {
    const items = useSelector(selectCartItems);
    const subtotal = useSelector(selectCartSubtotal);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="flex w-full flex-col sm:max-w-md">
                <SheetHeader className="border-b border-border">
                    <SheetTitle className="font-display text-xl">Your Cart</SheetTitle>
                </SheetHeader>

                <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4">
                    {items.length === 0 ? (
                        <p className="mt-8 text-center text-muted-foreground">Cart is empty!</p>
                    ) : (
                        items.map((item) => <CartSheetItem key={item.id} item={item} />)
                    )}
                </div>

                {items.length > 0 && (
                    <SheetFooter className="border-t border-border">
                        <div className="flex justify-between font-semibold">
                            <span>Subtotal</span>
                            <span>$ {subtotal.toFixed(2)}</span>
                        </div>
                        <Button asChild variant="outline" className="min-h-[44px] font-display tracking-wide">
                            <Link to="/cart" onClick={() => onOpenChange(false)}>VIEW CART</Link>
                        </Button>
                        <Button asChild className="min-h-[44px] bg-accent text-accent-foreground font-display tracking-wide hover:bg-accent/90">
                            <Link to="/checkout" onClick={() => onOpenChange(false)}>CHECKOUT</Link>
                        </Button>
                    </SheetFooter>
                )}
            </SheetContent>
        </Sheet>
    );
}

CartSheet.propTypes = {
    open: PropTypes.bool.isRequired,
    onOpenChange: PropTypes.func.isRequired,
};

export default CartSheet;
