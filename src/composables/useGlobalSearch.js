import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";

export function useGlobalSearch({ projects, issues, projectName }) {
  const rawSearchText = ref("");
  const debouncedSearchText = ref("");
  const searchFocused = ref(false);
  const searchExpanded = ref(false);
  const searchRoot = ref(null);
  const searchInput = ref(null);
  const selectedSearchIndex = ref(0);
  const searchPanelId = `search-results-${Math.random().toString(36).slice(2)}`;
  let searchTimer = 0;

  const normalizedSearch = computed(() => debouncedSearchText.value.trim().toLowerCase());
  const searchResults = computed(() => {
    if (normalizedSearch.value.length < 2) return { projects: [], issues: [] };
    const projectsResult = projects.value
      .filter((entry) => `${entry.name}${entry.owner}${entry.status}${entry.description}${(entry.executionTeams || []).join("")}`.toLowerCase().includes(normalizedSearch.value))
      .slice(0, 5)
      .map((entry) => ({ ...entry, kind: "project" }));
    const issuesResult = issues.value
      .filter((entry) => `${entry.code}${entry.title}${entry.owner}${entry.creator}${entry.type}${entry.status}${entry.startDate}${entry.dueDate}`.toLowerCase().includes(normalizedSearch.value))
      .slice(0, 6)
      .map((entry) => ({ ...entry, kind: "issue", projectName: projectName(entry.projectId) }));
    return { projects: projectsResult, issues: issuesResult };
  });
  const flatSearchResults = computed(() => [...searchResults.value.projects, ...searchResults.value.issues]);
  const searchPanelOpen = computed(() => searchFocused.value && normalizedSearch.value.length >= 2);
  const activeSearchResult = computed(() => flatSearchResults.value[selectedSearchIndex.value] || flatSearchResults.value[0] || null);

  onMounted(() => {
    document.addEventListener("pointerdown", handleOutsideSearch);
  });

  onBeforeUnmount(() => {
    document.removeEventListener("pointerdown", handleOutsideSearch);
    window.clearTimeout(searchTimer);
  });

  function moveSearch(step) {
    if (!flatSearchResults.value.length) return;
    selectedSearchIndex.value = (selectedSearchIndex.value + step + flatSearchResults.value.length) % flatSearchResults.value.length;
  }

  function closeSearch() {
    searchFocused.value = false;
    if (!rawSearchText.value.trim()) searchExpanded.value = false;
  }

  function expandSearch() {
    searchExpanded.value = true;
    nextTick(() => searchInput.value?.focus());
  }

  function handleSearchInput() {
    selectedSearchIndex.value = 0;
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      debouncedSearchText.value = rawSearchText.value;
    }, 200);
  }

  function handleOutsideSearch(event) {
    if (!searchRoot.value?.contains(event.target)) closeSearch();
  }

  function setSearchText(value = "") {
    rawSearchText.value = value;
    debouncedSearchText.value = value;
    selectedSearchIndex.value = 0;
    searchExpanded.value = Boolean(value);
  }

  return {
    rawSearchText,
    debouncedSearchText,
    searchFocused,
    searchExpanded,
    searchRoot,
    searchInput,
    selectedSearchIndex,
    searchPanelId,
    normalizedSearch,
    searchResults,
    flatSearchResults,
    searchPanelOpen,
    activeSearchResult,
    moveSearch,
    closeSearch,
    expandSearch,
    handleSearchInput,
    setSearchText,
  };
}
