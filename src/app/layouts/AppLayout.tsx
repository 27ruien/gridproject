import * as React from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BriefcaseBusiness,
  CalendarClock,
  Command,
  ChevronRight,
  FolderKanban,
  Home,
  LogOut,
  Search,
  Settings,
  ShieldAlert,
  Trash2,
  User,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { canAccessAdminPage } from "@/lib/permissions/policies";
import { useAppStore } from "@/lib/state/app-store";
import { cn } from "@/lib/utils";

const workspaceNavItems = [
  { label: "工作台", href: "/", icon: Home },
  { label: "回收站", href: "/trash", icon: Trash2 },
];

const projectNavItems = [
  { label: "项目列表", href: "/projects", icon: FolderKanban },
  { label: "工时填报", href: "/timesheets", icon: CalendarClock },
  { label: "工时列表", href: "/timesheet-list", icon: BriefcaseBusiness },
];

const adminNavItems = [
  { label: "成本管理", href: "/costs", icon: WalletCards },
  { label: "人员管理", href: "/people", icon: UsersRound },
  { label: "平台设置", href: "/settings", icon: Settings },
];

type NavItem = (typeof workspaceNavItems | typeof projectNavItems | typeof adminNavItems)[number];

export function AppLayout() {
  const store = useAppStore();
  const [commandOpen, setCommandOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const title = pageTitle(location.pathname);
  const platformName = store.state.settings.platformName || "GridProject";
  const organizationName = store.state.organization.name || "组织工作台";
  const showAdmin = canAccessAdminPage(store.context);
  const visibleNav = showAdmin ? [...workspaceNavItems, ...projectNavItems, ...adminNavItems] : [...workspaceNavItems, ...projectNavItems];
  const avatarUrl = store.currentUser?.preferences?.avatarUrl || "";

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

  return (
    <SidebarProvider defaultOpen={store.currentUser?.preferences?.defaultNav !== "collapsed"} className="min-w-0">
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild size="lg" tooltip={platformName}>
                <Link to="/">
                  <BrandMark
                    logoUrl={store.state.settings.logoUrl}
                    logoText={store.state.settings.logoText}
                    className="size-8 rounded-md border border-sidebar-border bg-sidebar-accent text-sm text-sidebar-accent-foreground"
                  />
                  <span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{platformName}</span>
                    <span className="truncate text-xs text-sidebar-foreground/70">{organizationName}</span>
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarNav label="工作区" items={workspaceNavItems} pathname={location.pathname} />
          <SidebarProjectManagement items={projectNavItems} pathname={location.pathname} />
          {showAdmin ? (
            <>
              <SidebarSeparator />
              <SidebarNav label="管理" items={adminNavItems} pathname={location.pathname} />
            </>
          ) : null}
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="个人设置">
                <Link to="/profile">
                  <Avatar className="size-6">
                    {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                    <AvatarFallback className="bg-muted text-xs text-muted-foreground">
                      {store.currentUser?.name?.slice(0, 1) || "用"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{store.currentUser?.name || "未登录"}</span>
                  <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[11px]">
                    {store.currentUser?.role === "ADMIN" ? "ADMIN" : "MEMBER"}
                  </Badge>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 flex-1 overflow-x-hidden">
        <header className="sticky top-0 z-20 flex h-14 min-w-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
          <SidebarTrigger aria-label="切换导航" />
          <Breadcrumb className="min-w-0 flex-1">
            <BreadcrumbList>
              <BreadcrumbItem className="hidden sm:inline-flex">{platformName}</BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:inline-flex" />
              <BreadcrumbItem>
                <BreadcrumbPage className="truncate">{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <Button variant="outline" className="hidden h-8 justify-start gap-2 px-2 text-muted-foreground md:flex md:w-60" onClick={() => setCommandOpen(true)}>
            <Search />
            搜索项目或事项
            <kbd className="ml-auto rounded border bg-muted px-1 text-[10px] text-muted-foreground">⌘K</kbd>
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="搜索" onClick={() => setCommandOpen(true)}>
            <Search />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 gap-2 px-2">
                <Avatar className="size-6">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
                  <AvatarFallback className="bg-muted text-xs text-muted-foreground">
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
              <DropdownMenuItem onClick={() => navigate("/profile")}><User />个人资料</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/profile/security")}><ShieldAlert />安全设置</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => store.logout()}><LogOut />退出登录</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </SidebarInset>

      <CommandDialog title="全局搜索" description="搜索项目、事项或页面" open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="搜索项目、事项或页面" />
        <CommandList>
          <CommandEmpty>没有找到匹配结果。</CommandEmpty>
          <CommandGroup heading="页面">
            {visibleNav.map((item) => (
              <CommandItem key={item.href} value={item.label} onSelect={() => { navigate(item.href); setCommandOpen(false); }}>
                <item.icon />{item.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="项目">
            {store.state.projects.map((project) => (
              <CommandItem key={project.id} value={`${project.name} ${project.code}`} onSelect={() => { navigate(`/projects/${project.id}`); setCommandOpen(false); }}>
                <FolderKanban />{project.name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="事项">
            {store.state.issues.slice(0, 20).map((issue) => (
              <CommandItem key={issue.id} value={`${issue.code} ${issue.title}`} onSelect={() => { navigate(`/projects/${issue.projectId}?issue=${issue.id}`); setCommandOpen(false); }}>
                <Command />{issue.code} · {issue.title}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </SidebarProvider>
  );
}

function SidebarNav({ label, items, pathname }: { label: string; items: NavItem[]; pathname: string }) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = isActiveHref(pathname, item.href);
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                  <NavLink to={item.href} end={item.href === "/"} onClick={() => isMobile && setOpenMobile(false)}>
                    <item.icon />
                    <span>{item.label}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function SidebarProjectManagement({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const active = items.some((item) => isActiveHref(pathname, item.href));
  return (
    <SidebarGroup>
      <SidebarGroupLabel>项目管理</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <Collapsible defaultOpen={active} className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton isActive={active} tooltip="项目管理">
                  <FolderKanban />
                  <span>项目管理</span>
                  <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {items.map((item) => (
                    <SidebarMenuSubItem key={item.href}>
                      <SidebarMenuSubButton asChild isActive={isActiveHref(pathname, item.href)}>
                        <NavLink to={item.href} onClick={() => isMobile && setOpenMobile(false)}>
                          <item.icon />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function isActiveHref(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function pageTitle(pathname: string) {
  if (pathname === "/") return "工作台";
  if (pathname.startsWith("/projects/")) return "项目详情";
  if (pathname === "/projects") return "项目列表";
  if (pathname === "/timesheets") return "工时填报";
  if (pathname === "/timesheet-list") return "工时列表";
  if (pathname === "/costs") return "成本管理";
  if (pathname === "/people") return "人员管理";
  if (pathname === "/settings") return "平台设置";
  if (pathname === "/trash") return "回收站";
  if (pathname.startsWith("/profile")) return "个人设置";
  return "页面";
}

function BrandMark({ logoUrl, logoText, className }: { logoUrl?: string; logoText?: string; className?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden font-semibold", className)}>
      {logoUrl ? <img src={logoUrl} alt="" className="size-full object-cover" /> : (logoText || "G").slice(0, 2)}
    </span>
  );
}
