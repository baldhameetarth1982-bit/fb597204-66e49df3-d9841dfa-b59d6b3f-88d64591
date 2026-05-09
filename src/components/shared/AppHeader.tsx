import { Bell, LogOut, Settings, User } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Global app header. Mobile: hamburger (SidebarTrigger) reveals the sidebar
 * via the off-canvas Sheet baked into shadcn's Sidebar.
 */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="h-full flex items-center gap-2 px-3 md:px-6">
        <SidebarTrigger className="rounded-xl h-10 w-10" />

        {/* Compact wordmark — visible when sidebar collapses on mobile */}
        <a href="/" className="md:hidden flex items-center gap-2 ml-1">
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground grid place-items-center text-sm font-bold">
            S
          </div>
          <span className="font-semibold tracking-tight">SocioHub</span>
        </a>

        <div className="ml-auto flex items-center gap-1 md:gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notifications"
            className="relative rounded-xl h-10 w-10 text-primary hover:bg-secondary hover:text-primary"
          >
            <Bell className="h-5 w-5" />
            <span
              aria-hidden
              className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
            />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Account menu"
                className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar className="h-10 w-10 ring-1 ring-border">
                  <AvatarFallback className="bg-secondary text-primary font-semibold">
                    AD
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl">
              <DropdownMenuLabel className="flex flex-col">
                <span className="text-sm font-semibold">Admin User</span>
                <span className="text-xs text-muted-foreground font-normal">
                  admin@sociohub.app
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="rounded-lg">
                <User className="h-4 w-4 mr-2" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-lg">
                <Settings className="h-4 w-4 mr-2" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="rounded-lg text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4 mr-2" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
