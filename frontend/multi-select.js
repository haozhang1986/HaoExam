/**
 * Multi-Select Dropdown Component
 * Provides checkbox-based multi-selection with chip display
 */

class MultiSelectDropdown {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Multi-select container #${containerId} not found`);
            return;
        }

        this.options = {
            placeholder: options.placeholder || 'Select...',
            showSelectAll: options.showSelectAll !== false,
            onChange: options.onChange || (() => { })
        };

        this.selectedValues = [];
        this.availableOptions = [];

        this.init();
    }

    init() {
        // Create structure
        this.container.classList.add('multi-select-dropdown');
        this.container.innerHTML = `
            <div class="multi-select-trigger">
                <div class="multi-select-chips"></div>
                <span class="multi-select-placeholder">${this.options.placeholder}</span>
                <span class="multi-select-arrow">▼</span>
            </div>
            <div class="multi-select-menu" style="display: none;">
                ${this.options.showSelectAll ? '<label class="multi-select-option select-all-option"><input type="checkbox"> Select All</label>' : ''}
                <div class="multi-select-options-list"></div>
                <div class="multi-select-actions">
                    <button type="button" class="multi-select-clear">Clear All</button>
                </div>
            </div>
        `;

        this.trigger = this.container.querySelector('.multi-select-trigger');
        this.menu = this.container.querySelector('.multi-select-menu');
        this.optionsList = this.container.querySelector('.multi-select-options-list');
        this.chipsContainer = this.container.querySelector('.multi-select-chips');
        this.placeholder = this.container.querySelector('.multi-select-placeholder');
        this.clearBtn = this.container.querySelector('.multi-select-clear');

        // Event listeners
        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        this.clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.clearAll();
        });

        if (this.options.showSelectAll) {
            const selectAllCheckbox = this.container.querySelector('.select-all-option input');
            selectAllCheckbox.addEventListener('change', (e) => {
                e.stopPropagation();
                this.toggleSelectAll(selectAllCheckbox.checked);
            });
        }

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.close();
            }
        });
    }

    setOptions(options) {
        this.availableOptions = options;
        this.renderOptions();
    }

    renderOptions() {
        this.optionsList.innerHTML = '';

        this.availableOptions.forEach(option => {
            const label = document.createElement('label');
            label.className = 'multi-select-option';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = option;
            checkbox.checked = this.selectedValues.includes(option);

            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                if (checkbox.checked) {
                    this.addValue(option);
                } else {
                    this.removeValue(option);
                }
            });

            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ${option}`));
            this.optionsList.appendChild(label);
        });
    }

    addValue(value) {
        if (!this.selectedValues.includes(value)) {
            this.selectedValues.push(value);
            this.updateDisplay();
            this.options.onChange(this.selectedValues);
        }
    }

    removeValue(value) {
        const index = this.selectedValues.indexOf(value);
        if (index > -1) {
            this.selectedValues.splice(index, 1);
            this.updateDisplay();
            this.options.onChange(this.selectedValues);
        }
    }

    updateDisplay() {
        this.chipsContainer.innerHTML = '';

        if (this.selectedValues.length === 0) {
            this.placeholder.style.display = 'inline';
        } else {
            this.placeholder.style.display = 'none';

            this.selectedValues.forEach(value => {
                const chip = document.createElement('span');
                chip.className = 'multi-select-chip';
                chip.innerHTML = `
                    ${value} 
                    <span class="chip-remove">×</span>
                `;

                chip.querySelector('.chip-remove').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.removeValue(value);
                    this.renderOptions(); // Re-render to update checkboxes
                });

                this.chipsContainer.appendChild(chip);
            });
        }
    }

    clearAll() {
        this.selectedValues = [];
        this.updateDisplay();
        this.renderOptions();
        this.options.onChange(this.selectedValues);
    }

    toggleSelectAll(checked) {
        if (checked) {
            this.selectedValues = [...this.availableOptions];
        } else {
            this.selectedValues = [];
        }
        this.updateDisplay();
        this.renderOptions();
        this.options.onChange(this.selectedValues);
    }

    getSelectedValues() {
        return [...this.selectedValues];
    }

    setSelectedValues(values) {
        this.selectedValues = values;
        this.updateDisplay();
        this.renderOptions();
    }

    toggle() {
        if (this.menu.style.display === 'none') {
            this.open();
        } else {
            this.close();
        }
    }

    open() {
        this.menu.style.display = 'block';
        this.container.classList.add('open');
    }

    close() {
        this.menu.style.display = 'none';
        this.container.classList.remove('open');
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MultiSelectDropdown;
}
