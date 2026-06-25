<template>
  <section class="view-toolbar" aria-label="项目视图工具栏">
    <div class="view-toolbar-main">
      <details v-if="showViewMenu" class="toolbar-menu view-options-menu">
        <summary class="toolbar-button">
          <Icon :name="activeView === '看板' || activeView === '阶段计划' ? 'board' : 'list'" />
          <span>{{ activeView }}</span>
          <Icon name="chevronDown" />
        </summary>
        <div class="toolbar-popover view-options-popover">
          <section class="toolbar-option-section">
            <strong>切换视图</strong>
            <div class="toolbar-option-list">
              <button
                v-for="view in views"
                :key="view"
                type="button"
                :class="{ active: activeView === view }"
                @click="selectView(view, $event)"
              >
                <Icon :name="view === '看板' || view === '阶段计划' ? 'board' : 'list'" />
                <span>{{ view }}</span>
                <Icon v-if="activeView === view" name="check" />
              </button>
            </div>
          </section>

          <section class="toolbar-option-section">
            <strong>排序</strong>
            <div class="toolbar-option-list">
              <button v-for="option in sortOptions" :key="option.value" type="button" :class="{ active: sort === option.value }" @click="setOption('sort', option.value, $event)">
                <span>{{ option.label }}</span>
                <Icon v-if="sort === option.value" name="check" />
              </button>
            </div>
          </section>

          <section class="toolbar-option-section">
            <strong>显示密度</strong>
            <div class="toolbar-option-list">
              <button type="button" :class="{ active: normalizedViewMode === 'comfortable' }" @click="setOption('viewMode', '', $event)">
                <span>舒适</span>
                <Icon v-if="normalizedViewMode === 'comfortable'" name="check" />
              </button>
              <button type="button" :class="{ active: normalizedViewMode === 'compact' }" @click="setOption('viewMode', 'compact', $event)">
                <span>紧凑</span>
                <Icon v-if="normalizedViewMode === 'compact'" name="check" />
              </button>
            </div>
          </section>
        </div>
      </details>

      <label class="view-search desktop-view-search">
        <Icon name="search" />
        <input v-model="filters.keyword" type="search" placeholder="搜索事项" aria-label="搜索事项" />
      </label>

      <details class="toolbar-menu mobile-search-menu">
        <summary class="toolbar-button icon-only" title="搜索事项" aria-label="搜索事项">
          <Icon name="search" />
        </summary>
        <div class="toolbar-popover mobile-search-popover">
          <label class="view-search">
            <Icon name="search" />
            <input v-model="filters.keyword" type="search" placeholder="搜索事项" aria-label="搜索事项" />
          </label>
        </div>
      </details>

      <FilterPopover v-model="filters" :people="people" @reset="$emit('reset')" />
    </div>

    <Button class="create-issue-button" variant="primary" size="small" title="新建事项" @click="$emit('create')">
      <Icon name="plus" />
      <span>新建事项</span>
    </Button>

    <div v-if="chips.length" class="view-toolbar-chips">
      <button v-for="chip in chips" :key="chip.key" class="filter-chip" type="button" :title="`清除${chip.label}`" @click="clearChip(chip.key)">
        <span>{{ chip.label }}</span>
        <Icon name="close" />
      </button>
      <button class="clear-filters" type="button" @click="$emit('reset')">清除全部</button>
    </div>
  </section>
</template>

<script setup>
import { computed } from "vue";
import Button from "../ui/Button.vue";
import Icon from "../ui/Icon.vue";
import FilterPopover from "../issue/FilterPopover.vue";

const filters = defineModel("filters", { type: Object, required: true });
const sort = defineModel("sort", { type: String, default: "" });
const viewMode = defineModel("viewMode", { type: String, default: "" });
const activeView = defineModel("activeView", { type: String, required: true });

defineProps({
  people: { type: Array, required: true },
  views: { type: Array, required: true },
  showViewMenu: { type: Boolean, default: true },
});

defineEmits(["create", "reset"]);

const sortOptions = [
  { value: "", label: "默认排序" },
  { value: "dueDate:asc", label: "截止日期由近到远" },
  { value: "dueDate:desc", label: "截止日期由远到近" },
  { value: "priority", label: "优先级优先" },
];

const normalizedViewMode = computed(() => viewMode.value === "compact" ? "compact" : "comfortable");
const chips = computed(() => [
  filters.value.keyword && { key: "keyword", label: `搜索：${filters.value.keyword}` },
  filters.value.dateFrom && { key: "dateFrom", label: `开始：${filters.value.dateFrom}` },
  filters.value.dateTo && { key: "dateTo", label: `结束：${filters.value.dateTo}` },
  filters.value.owner && { key: "owner", label: `执行人：${filters.value.owner}` },
  filters.value.creator && { key: "creator", label: `创建人：${filters.value.creator}` },
].filter(Boolean));

function clearChip(key) {
  filters.value[key] = "";
}

function selectView(view, event) {
  activeView.value = view;
  closeMenu(event);
}

function setOption(type, value, event) {
  if (type === "sort") sort.value = value;
  else viewMode.value = value;
  closeMenu(event);
}

function closeMenu(event) {
  event.currentTarget.closest("details")?.removeAttribute("open");
}
</script>
