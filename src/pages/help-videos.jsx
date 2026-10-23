import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import Sidebar from "@/components/layout/sidebar";
import Loader from "@/components/common/loader";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Menu, Loader2, ExternalLink, PlayCircle, Video, ChevronsUpDown, Check } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_BASE_URL || "";

function helpVideosListUrl() {
  return `${API_BASE_URL}/api/get-help-videos/`;
}

function helpVideosModulesUrl() {
  return `${API_BASE_URL}/api/get-help-videos/?modules_list=true`;
}

function isVideoRow(item) {
  return (
    item &&
    typeof item === "object" &&
    "id" in item &&
    "module_name" in item &&
    "title" in item &&
    "video_url" in item
  );
}

async function fetchHelpVideos() {
  const res = await fetch(helpVideosListUrl(), { method: "GET" });
  if (!res.ok) {
    throw new Error(`Failed to load videos (${res.status})`);
  }
  const json = await res.json();
  const raw = json?.data;
  if (!Array.isArray(raw)) return [];
  return raw.filter(isVideoRow);
}

async function fetchHelpVideoModules() {
  const res = await fetch(helpVideosModulesUrl(), { method: "GET" });
  if (!res.ok) {
    throw new Error(`Failed to load modules (${res.status})`);
  }
  const json = await res.json();
  const raw = json?.data;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => typeof x === "string" && x.trim().length > 0);
}

function SearchableModuleCombobox({
  value,
  onSelect,
  options = [],
  disabled = false,
}) {
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    if (value === "__all__") return "All modules";
    return value || "All modules";
  }, [value]);

  const handleSelect = (nextValue) => {
    onSelect(nextValue);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          id="help-video-module"
          className="w-full justify-between h-10 font-normal"
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0 z-50"
        align="start"
        side="bottom"
        sideOffset={4}
      >
        <Command shouldFilter>
          <CommandInput placeholder="Search modules..." />
          <CommandList>
            <CommandEmpty>No modules match your search.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all modules"
                onSelect={() => handleSelect("__all__")}
                className="cursor-pointer"
              >
                <Check
                  className={`mr-2 h-4 w-4 shrink-0 ${
                    value === "__all__" ? "opacity-100" : "opacity-0"
                  }`}
                />
                All modules
              </CommandItem>
              {options.map((name) => (
                <CommandItem
                  key={name}
                  value={name}
                  onSelect={() => handleSelect(name)}
                  className="cursor-pointer"
                >
                  <Check
                    className={`mr-2 h-4 w-4 shrink-0 ${
                      value === name ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <span className="truncate">{name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function HelpVideos() {
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [moduleFilter, setModuleFilter] = useState("__all__");
  const [search, setSearch] = useState("");

  const {
    data: videos = [],
    isLoading: videosLoading,
    error: videosError,
    refetch: refetchVideos,
  } = useQuery({
    queryKey: [helpVideosListUrl()],
    queryFn: fetchHelpVideos,
  });

  const { data: moduleOptionsFromApi = [], isLoading: modulesLoading } = useQuery({
    queryKey: [helpVideosModulesUrl()],
    queryFn: fetchHelpVideoModules,
  });

  const moduleOptions = useMemo(() => {
    const fromApi = [...moduleOptionsFromApi].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
    if (fromApi.length > 0) return fromApi;
    const set = new Set();
    videos.forEach((v) => {
      if (v.module_name) set.add(v.module_name);
    });
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [moduleOptionsFromApi, videos]);

  const filteredVideos = useMemo(() => {
    const q = search.trim().toLowerCase();
    return videos.filter((v) => {
      if (moduleFilter !== "__all__" && v.module_name !== moduleFilter) {
        return false;
      }
      if (!q) return true;
      const title = (v.title || "").toLowerCase();
      const mod = (v.module_name || "").toLowerCase();
      return title.includes(q) || mod.includes(q);
    });
  }, [videos, moduleFilter, search]);

  return (
    <div className="app-layout bg-gray-50">
      {!isMobile && <Sidebar />}
      {isMobile && (
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <div className="app-main-content">
        <header className="app-header bg-white shadow-sm border-b border-gray-200 px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center min-w-0">
              {isMobile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 mr-3"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              )}
              <div className="flex items-center gap-2 min-w-0">
                <PlayCircle className="h-8 w-8 text-emerald-600 shrink-0" />
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                  Help Videos
                </h1>
              </div>
            </div>
          </div>
        </header>

        <main className="app-main-scrollable p-4 sm:p-6">
          <div className="max-w-5xl mx-auto space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Browse tutorials</CardTitle>
                <p className="text-sm text-muted-foreground font-normal">
                  Filter by module or search by title or module name.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="help-video-module">Module</Label>
                    <SearchableModuleCombobox
                      value={moduleFilter}
                      onSelect={setModuleFilter}
                      options={moduleOptions}
                      disabled={videosLoading || modulesLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="help-video-search">Search</Label>
                    <Input
                      id="help-video-search"
                      placeholder="Search by title or module…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {videosLoading && (
              <div className="flex items-center justify-center py-16 text-gray-600 gap-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Loading videos…</span>
              </div>
            )}

            {videosError && !videosLoading && (
              <Card className="border-red-200 bg-red-50/50">
                <CardContent className="pt-6">
                  <p className="text-red-800 font-medium">Could not load help videos</p>
                  <p className="text-sm text-red-700 mt-1">{videosError.message}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4"
                    onClick={() => refetchVideos()}
                  >
                    Try again
                  </Button>
                </CardContent>
              </Card>
            )}

            {!videosLoading && !videosError && (
              <>
                <p className="text-sm text-gray-600">
                  Showing{" "}
                  <span className="font-medium text-gray-900">
                    {filteredVideos.length}
                  </span>{" "}
                  of <span className="font-medium text-gray-900">{videos.length}</span>{" "}
                  video{videos.length === 1 ? "" : "s"}
                </p>

                {filteredVideos.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-gray-600">
                      No videos match your filters.
                    </CardContent>
                  </Card>
                ) : (
                  <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredVideos.map((v) => (
                      <li key={v.id}>
                        <Card className="h-full overflow-hidden hover:shadow-md transition-shadow">
                          <CardContent className="p-4 sm:p-5 h-full flex flex-col gap-4">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide">
                                {v.module_name}
                              </p>
                              <Video className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                            </div>

                            <h2 className="text-base sm:text-lg font-semibold text-gray-900 line-clamp-2 min-h-12">
                                {v.title}
                            </h2>

                            <p className="text-xs text-gray-500 truncate">{v.video_url}</p>

                            <div className="mt-auto">
                              <Button variant="default" size="sm" asChild>
                                <a
                                  href={v.video_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  Watch video
                                </a>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </main>
      </div>
      <Loader isLoading={videosLoading} text="Loading help videos" />
    </div>
  );
}
