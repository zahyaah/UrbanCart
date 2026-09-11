import { Link, useNavigate } from "react-router-dom";
import { User, LogOut } from "lucide-react";
import { useGetMeQuery, useLogoutMutation } from "../../features/auth/authApi";
import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuItem,
} from "../ui/dropdown-menu";

function AuthMenu() {
    // A 401 here is the ordinary "not logged in" state, not a real error --
    // isLoading covers the one moment before that's known, so a logged-out
    // visitor never sees a flash of the wrong control.
    const { data: user, isLoading } = useGetMeQuery();
    const [logout] = useLogoutMutation();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate("/");
    };

    if (isLoading) {
        return <div className="h-11 w-11" aria-hidden="true" />;
    }

    if (!user) {
        return (
            <Button asChild variant="ghost" className="min-h-[44px] tracking-wide">
                <Link to="/login">Sign In</Link>
            </Button>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Account menu for ${user.email}`}
                    className="min-h-[44px] min-w-[44px]"
                >
                    <User aria-hidden="true" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {/* inset={undefined}: dropdown-menu.jsx infers `inset` as a
                    required prop (no default in the vendored source) --
                    passing undefined explicitly satisfies that without
                    changing behavior. A real default of `false` would
                    render data-inset="false" (present) instead of omitted,
                    which the component's own data-inset:pl-7 style matches
                    on presence, not truthiness -- see Phase B's className
                    fix for the same class of vendored-prop gap. */}
                <DropdownMenuLabel className="truncate" inset={undefined}>{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout} inset={undefined}>
                    <LogOut aria-hidden="true" />
                    Log out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default AuthMenu;
