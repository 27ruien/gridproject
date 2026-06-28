import * as React from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BriefcaseBusiness,
  CalendarClock,
  ChevronRight,
  Command,
  FolderKanban,
  Home,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldAlert,
  Trash2,
  User,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { canAccessAdminPage } from "@/lib/permissions/policies";
import { useAppStore } from "@/lib/state/app-store";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "首页", href: "/", icon: Home },
  { label: "项目库", href: "/projects", icon: FolderKanban },
  { label: "工时填报", href: "/timesheets", icon: CalendarClock },
  { label: "工时列表", href: "/timesheet-list", icon: BriefcaseBusiness },
  { label: "回收站", href: "/trash", icon: Trash2 },
  { label: "成本管理", href: "/costs", icon: WalletCards, adminOnly: true },
  { label: "人员管理", href: "/people", icon: UsersRound, adminOnly: true },
  { label: "平台设置", href: "/settings", icon: Settings, adminOnly: true },
];

export function AppLayout() {
  const store = useAppStore();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  React.useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  if (store.initializing) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="w-[min(420px,90vw)] space-y-4 rounded-md border bg-card p-6">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    );
  }

  const visibleNav = navItems.filter((item) => !item.adminOnly || canAccessAdminPage(store.context));
  const title = pageTitle(location.pathname);

  const nav = (
    <nav className="flex flex-col gap-1 px-2 py-3">
      {visibleNav.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          end={item.href === "/"}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) => cn(
            "flex h-9 items-center gap-2 rounded-md px-3 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
          )}
        >
          <item.icon className="h-4 w-4" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block">
        <Link to="/" className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">{store.state.settings.logoText}</span>
          <span className="truncate text-sm font-semibold">{store.state.settings.platformName}</span>
        </Link>
        <ScrollArea className="h-[calc(100vh-3.5rem)]">{nav}</ScrollArea>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="lg:hidden" aria-label="打开导航"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
              <SheetHeader className="border-b border-sidebar-border px-4 py-4 text-left">
                <SheetTitle className="text-sidebar-foreground">{store.state.settings.platformName}</SheetTitle>
              </SheetHeader>
              {nav}
            </SheetContent>
          </Sheet>

          <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            <span className="text-muted-foreground">GridProject</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <strong className="truncate">{title}</strong>
          </div>

          <Button variant="outline" className="hidden h-8 justify-start gap-2 px-2 text-muted-foreground md:flex md:w-60" onClick={() => setCommandOpen(true)}>
            <Search className="h-4 w-4" />
            搜索项目或事项
            <kbd className="ml-auto rounded border px-1 text-[10px]">⌘K</kbd>
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="搜索" onClick={() => setCommandOpen(true)}>
            <Search className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 px-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback style={{ background: store.currentUser?.preferences?.avatarColor || "#315a9f", color: "white" }}>
                    {store.currentUser?.name?.slice(0, 1) || "用"}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-24 truncate text-sm md:inline">{store.currentUser?.name || "未登录"}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                <span className="block truncate">{store.currentUser?.name}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">{store.currentUser?.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profile")}><User className="mr-2 h-4 w-4" />个人资料</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/profile/preferences")}><Settings className="mr-2 h-4 w-4" />偏好设置</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/profile/security")}><ShieldAlert className="mr-2 h-4 w-4" />安全设置</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => store.logout()}><LogOut className="mr-2 h-4 w-4" />退出登录</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="min-h-[calc(100vh-3.5rem)]">
          <Outlet />
        </main>
      </div>

      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="搜索项目、事项或页面" />
        <CommandList>
          <CommandEmpty>没有找到匹配结果。</CommandEmpty>
          <CommandGroup heading="页面">
            {visibleNav.map((item) => (
              <CommandItem key={item.href} value={item.label} onSelect={() => { navigate(item.href); setCommandOpen(false); }}>
                <item.icon className="mr-2 h-4 w-4" />{item.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <Separator />
          <CommandGroup heading="项目">
            {store.state.projects.map((project) => (
              <CommandItem key={project.id} value={`${project.name} ${project.code}`} onSelect={() => { navigate(`/projects/${project.id}`); setCommandOpen(false); }}>
                <FolderKanban className="mr-2 h-4 w-4" />{project.name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="事项">
            {store.state.issues.slice(0, 20).map((issue) => (
              <CommandItem key={issue.id} value={`${issue.code} ${issue.title}`} onSelect={() => { navigate(`/projects/${issue.projectId}?issue=${issue.id}`); setCommandOpen(false); }}>
                <Command className="mr-2 h-4 w-4" />{issue.code} · {issue.title}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

function pageTitle(pathname: string) {
  if (pathname === "/") return "首页";
  if (pathname.startsWith("/projects/")) return "项目详情";
  if (pathname === "/projects") return "项目库";
  if (pathname === "/timesheets") return "工时填报";
  if (pathname === "/timesheet-list") return "工时列表";
  if (pathname === "/costs") return "成本管理";
  if (pathname === "/people") return "人员管理";
  if (pathname === "/settings") return "平台设置";
  if (pathname === "/trash") return "回收站";
  if (pathname.startsWith("/profile")) return "个人设置";
  return "页面";
}
