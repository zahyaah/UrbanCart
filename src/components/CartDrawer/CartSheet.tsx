import { Link } from "react-router-dom";
import { Minus, Plus } from "lucide-react";

import { decrementQuantity, incrementQuantity, removeFromCart, type CartItem } from "../../features/cart/cartSlice";
import { selectCartItems, selectCartSubtotal } from "../../features/cart/cartSelectors";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "../ui/sheet";
import { Button } from "../ui/button";

function CartSheetItem({ item }: { item: CartItem }) {
    const dispatch = useAppDispatch();

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

interface CartSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function CartSheet({ open, onOpenChange }: CartSheetProps) {
    const items = useAppSelector(selectCartItems);
    const subtotal = useAppSelector(selectCartSubtotal);

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
                        <Button asChild variant="outline" className="min-h-[44px] tracking-wide">
                            <Link to="/cart" onClick={() => onOpenChange(false)}>VIEW CART</Link>
                        </Button>
                        <Button asChild className="min-h-[44px] tracking-wide">
                            <Link to="/checkout" onClick={() => onOpenChange(false)}>CHECKOUT</Link>
                        </Button>
                    </SheetFooter>
                )}
            </SheetContent>
        </Sheet>
    );
}

export default CartSheet;
