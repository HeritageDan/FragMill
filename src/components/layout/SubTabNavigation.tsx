import React from 'react';

export interface SubTabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
}

interface SubTabNavigationProps<T extends string = string> {
  tabs: SubTabItem<T>[];
  activeTab: T;
  onSelectTab: (tabId: T) => void;
  className?: string;
}

export function SubTabNavigation<T extends string = string>({
  tabs,
  activeTab,
  onSelectTab,
  className = '',
}: SubTabNavigationProps<T>) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-white px-3 py-2 rounded-xl shadow-xs ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              isActive
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge && (
              <span
                className={`ml-1 text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
