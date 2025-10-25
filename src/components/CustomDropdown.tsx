'use client';

import { useState, useRef, useEffect } from 'react';

/**
 * CUSTOM DROPDOWN COMPONENT
 * 
 * Features:
 * - Fully responsive with proper viewport handling
 * - Search/filter functionality for large option lists
 * - Touch-friendly (44x44px minimum tap targets)
 * - Proper z-index layering
 * - Scrollable with max-height constraints
 * - Keyboard navigation support
 * - Accessibility (ARIA labels)
 * - Click outside to close
 * - Smooth animations
 */

interface CustomDropdownProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  searchable?: boolean;
  name?: string;
  renderOption?: (option: string) => React.ReactNode;
  className?: string;
}

export default function CustomDropdown({
  label,
  value,
  options,
  onChange,
  required = false,
  placeholder = 'Select an option',
  searchable = false,
  name,
  renderOption,
  className = '',
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search term
  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Handle option selection
  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
    setSearchTerm('');
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  return (
    <div className={`dropdown-container ${className}`} ref={dropdownRef}>
      {/* Label */}
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        className="dropdown-trigger focus-ring"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`${label} dropdown`}
        name={name}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value || placeholder}
        </span>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'transform rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="dropdown-menu" role="listbox">
          {/* Search Input */}
          {searchable && options.length > 5 && (
            <div className="dropdown-search">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={`Search ${label.toLowerCase()}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 focus-ring"
                  aria-label={`Search ${label}`}
                />
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option}
                  className={`dropdown-item ${option === value ? 'selected' : ''}`}
                  onClick={() => handleSelect(option)}
                  role="option"
                  aria-selected={option === value}
                >
                  {renderOption ? renderOption(option) : option}
                  {option === value && (
                    <svg
                      className="w-5 h-5 ml-auto text-blue-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
