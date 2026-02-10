import React from 'react';
import { X } from 'lucide-react';

interface TaskFiltersProps {
  filters: {
    search: string;
    priority: string[];
    assignee: string | null;
    labels: string[];
  };
  onFiltersChange: (filters: any) => void;
  projectId: string;
}

const TaskFilters: React.FC<TaskFiltersProps> = ({ filters, onFiltersChange, projectId }) => {
  const priorities = ['low', 'medium', 'high', 'critical'];

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, search: e.target.value });
  };

  const handlePriorityToggle = (priority: string) => {
    const newPriorities = filters.priority.includes(priority)
      ? filters.priority.filter((p) => p !== priority)
      : [...filters.priority, priority];
    onFiltersChange({ ...filters, priority: newPriorities });
  };

  const handleClearFilters = () => {
    onFiltersChange({ search: '', priority: [], assignee: null, labels: [] });
  };

  const activeFilterCount =
    (filters.search ? 1 : 0) +
    filters.priority.length +
    (filters.assignee ? 1 : 0) +
    filters.labels.length;

  return (
    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Filters {activeFilterCount > 0 && `(${activeFilterCount} active)`}
        </h3>
        {activeFilterCount > 0 && (
          <button
            onClick={handleClearFilters}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Search */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Search
          </label>
          <input
            type="text"
            value={filters.search}
            onChange={handleSearchChange}
            placeholder="Search tasks..."
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Priority */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Priority
          </label>
          <div className="flex flex-wrap gap-2">
            {priorities.map((priority) => (
              <button
                key={priority}
                onClick={() => handlePriorityToggle(priority)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  filters.priority.includes(priority)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {priority}
              </button>
            ))}
          </div>
        </div>

        {/* Assignee - Simplified for now */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Assignee
          </label>
          <select
            value={filters.assignee || ''}
            onChange={(e) =>
              onFiltersChange({ ...filters, assignee: e.target.value || null })
            }
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All assignees</option>
            {/* Add project members here */}
          </select>
        </div>
      </div>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {filters.search && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
              Search: "{filters.search}"
              <button
                onClick={() => onFiltersChange({ ...filters, search: '' })}
                className="hover:text-blue-900 dark:hover:text-blue-100"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.priority.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full"
            >
              Priority: {p}
              <button
                onClick={() => handlePriorityToggle(p)}
                className="hover:text-purple-900 dark:hover:text-purple-100"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskFilters;
