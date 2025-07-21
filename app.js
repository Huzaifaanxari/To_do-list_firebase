// StockpileAI - Inventory Manager JS
// -----------------------------------
// - Handles all UI rendering and logic
// - Manages categories, items, and variants
// - Uses localStorage for persistence
// - Pure vanilla JavaScript - no framework dependencies

// --- Data Model & State ---
// Category: { id: number, name: string }
// Item: { id: number, name: string, catId: number, variants: Variant[] }
// Variant: { id: number, color: string, price: string, qty: string }
let categories = [];
let items = [];
let currentView = "categories"; // or 'items'
let selectedCategory = null;
let editingItemId = null;
let saveTimeout = null;

// --- DOM Helper Functions ---
function getEl(id) {
  return document.getElementById(id);
}
function on(el, event, handler) {
  if (el) el.addEventListener(event, handler);
}

// --- DOM Elements ---
const mainTitle = getEl("main-title");
const backBtn = getEl("back-btn");
const mainContent = getEl("main-content");
const modalOverlay = getEl("modal-overlay");
const modalTitle = getEl("modal-title");
const modalMessage = getEl("modal-message");
const modalCancel = getEl("modal-cancel");
const modalConfirm = getEl("modal-confirm");
const toast = getEl("toast");

// --- Utility: Local Storage ---
function saveData() {
  try {
    localStorage.setItem("stockpile-cats", JSON.stringify(categories));
    localStorage.setItem("stockpile-items", JSON.stringify(items));
  } catch (error) {
    console.error("Failed to save data:", error);
    showToast("Failed to save data. Please try again.");
  }
}

function loadData() {
  try {
    categories = JSON.parse(localStorage.getItem("stockpile-cats") || "[]");
    items = JSON.parse(localStorage.getItem("stockpile-items") || "[]");
  } catch (error) {
    console.error("Failed to load data:", error);
    categories = [];
    items = [];
    showToast("Failed to load saved data. Starting fresh.");
  }
}

// --- Utility: Debounced Save ---
function debouncedSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveData, 300);
}

// --- Helper: Show Toast ---
function showToast(msg, type = "error") {
  toast.textContent = msg;
  toast.className = "toast" + (type === "success" ? " success" : "");
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2200);
}

// --- Helper: Show Modal ---
function showModal(title, message, onConfirm) {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalOverlay.classList.remove("hidden");
  modalCallback = onConfirm;
}
function hideModal() {
  modalOverlay.classList.add("hidden");
  modalCallback = null;
}

on(modalConfirm, "click", function () {
  if (modalCallback) modalCallback();
  hideModal();
});
on(modalCancel, "click", hideModal);

// --- Navigation ---
on(backBtn, "click", () => {
  currentView = "categories";
  selectedCategory = null;
  editingItemId = null;
  render();
});

// --- Render Functions ---
function render() {
  if (currentView === "categories") {
    mainTitle.textContent = "FAYYAZ & SONS";
    mainTitle.classList.remove("category-title");
  } else {
    mainTitle.textContent = selectedCategory ? selectedCategory.name : "";
    mainTitle.classList.add("category-title");
  }
  backBtn.classList.toggle("hidden", currentView === "categories");
  mainContent.innerHTML = "";
  if (currentView === "categories") {
    renderCategoriesView();
  } else {
    renderItemsView();
  }
}

// --- Helper: Create Card Element ---
function createCard(innerHTML) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = innerHTML;
  return card;
}

// --- Helper: Create Empty State ---
function createEmptyState(message, subMessage) {
  const empty = document.createElement("div");
  empty.className = "card card-content text-center";
  empty.innerHTML = `<p>${message}</p><p class="text-muted">${subMessage}</p>`;
  return empty;
}

// --- Helper: Bind Add Input/Button ---
function bindAddInput(inputId, btnId, onAdd) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  btn.onclick = onAdd;
  input.onkeydown = (e) => { if (e.key === "Enter") btn.onclick(); };
}

// --- Categories View ---
function renderCategoriesView() {
  mainContent.appendChild(createCard(`
    <div class="card-content">
      <input id="new-cat-input" type="text" placeholder="New Category...">
      <button id="add-cat-btn" class="btn btn-primary">Add Category</button>
    </div>
  `));

  if (categories.length > 0) {
    const ul = document.createElement("ul");
    ul.style.listStyle = "none";
    ul.style.padding = "0";
    ul.style.margin = "0";
    categories.forEach((cat) => {
      const li = document.createElement("li");
      li.style.marginBottom = "24px";
      li.innerHTML = `
        <div class="card">
          <div class="item-header">
            <div class="item-name" style="cursor: pointer;">${cat.name}</div>
            <div class="item-actions">
              <button class="icon-btn edit-cat-btn" title="Edit" aria-label="Edit category"><i class="fa-solid fa-pen-to-square fa-xl"></i></button>
              <button class="icon-btn del-cat-btn" title="Delete" aria-label="Delete category" style="color: var(--destructive);"><i class="fa-regular fa-trash-can fa-xl"></i></button>
            </div>
          </div>
        </div>
      `;
      li.querySelector(".item-name").onclick = () => {
        selectedCategory = cat;
        currentView = "items";
        render();
      };
      li.querySelector(".edit-cat-btn").onclick = () => startEditCategory(cat.id);
      li.querySelector(".del-cat-btn").onclick = () => {
        showModal(
          "Delete Category",
          `This will permanently delete "${cat.name}" and all its items.`,
          () => {
            categories = categories.filter((c) => c.id !== cat.id);
            items = items.filter((i) => i.catId !== cat.id);
            saveData();
            render();
            showToast("Category deleted", "success");
          }
        );
      };
      ul.appendChild(li);
    });
    mainContent.appendChild(ul);
  } else {
    mainContent.appendChild(createEmptyState("No categories yet.", "Add one above to get started!"));
  }

  bindAddInput("new-cat-input", "add-cat-btn", () => {
    const newCatInput = document.getElementById("new-cat-input");
    const name = newCatInput.value.trim();
    if (!name) return showToast("Category name cannot be empty.");
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase()))
      return showToast("Category with this name already exists.");
    categories.push({ id: Date.now(), name });
    saveData();
    newCatInput.value = "";
    render();
    showToast("Category added!", "success");
  });
}

// --- Edit Category Inline ---
function startEditCategory(catId) {
  render();
  const ul = mainContent.querySelector("ul");
  if (!ul) return;
  const idx = categories.findIndex((c) => c.id === catId);
  const li = ul.children[idx];
  const cat = categories[idx];
  li.innerHTML = `
    <div class="card">
      <div class="item-header">
        <input id="edit-cat-input" type="text" value="${cat.name}">
        <div class="item-actions">
          <button class="icon-btn save-edit-cat-btn" title="Save" aria-label="Save category" style="color: var(--success);"><i class="fa-solid fa-check fa-xl"></i></button>
          <button class="icon-btn cancel-edit-cat-btn" title="Cancel" aria-label="Cancel edit"><i class="fa-solid fa-xmark fa-xl"></i></button>
        </div>
      </div>
    </div>
  `;
  const input = li.querySelector("#edit-cat-input");
  const saveBtn = li.querySelector(".save-edit-cat-btn");
  const cancelBtn = li.querySelector(".cancel-edit-cat-btn");
  input.focus();
  setCursorToEnd(input);
  saveBtn.onclick = () => {
    const newName = input.value.trim();
    if (!newName) return showToast("Category name cannot be empty.");
    categories[idx].name = newName;
    saveData();
    render();
    showToast("Category updated!", "success");
  };
  cancelBtn.onclick = render;
  input.onkeydown = (e) => {
    if (e.key === "Enter") saveBtn.onclick();
    if (e.key === "Escape") cancelBtn.onclick();
  };
}

// --- Items View ---
function renderItemsView() {
  mainContent.appendChild(createCard(`
    <div class="card-content">
      <input id="new-item-input" type="text" placeholder="New Item...">
      <button id="add-item-btn" class="btn btn-primary">Add Item</button>
    </div>
  `));
  const categoryItems = items.filter((i) => i.catId === selectedCategory.id);
  if (categoryItems.length > 0) {
    categoryItems.forEach((item) => {
      renderItemCard(item);
    });
  } else {
    mainContent.appendChild(createEmptyState(
      `No items found in "${selectedCategory.name}".`,
      "Add a new item type above to get started."
    ));
  }
  bindAddInput("new-item-input", "add-item-btn", () => {
    const newItemInput = document.getElementById("new-item-input");
    const name = newItemInput.value.trim();
    if (!name) return showToast("Item name cannot be empty.");
    if (categoryItems.some((i) => i.name.toLowerCase() === name.toLowerCase()))
      return showToast("Item with this name already exists.");
    items.push({
      id: Date.now(),
      name,
      catId: selectedCategory.id,
      variants: [],
    });
    saveData();
    newItemInput.value = "";
    render();
    showToast("Item added!", "success");
  });
}

// --- Edit Item Inline ---
function startEditItem(itemId) {
  editingItemId = itemId;
  render();
}

// --- Helper: Create Action Button ---
function createActionButton({ className, title, ariaLabel, style, iconClass, onClick }) {
  const btn = document.createElement('button');
  btn.className = className;
  btn.title = title;
  btn.setAttribute('aria-label', ariaLabel);
  if (style) btn.style = style;
  btn.innerHTML = `<i class="${iconClass}" aria-hidden="true"></i>`;
  btn.onclick = onClick;
  return btn;
}

// --- Helper: Create Item Actions ---
function createItemActions({ onEdit, onDelete, editTitle, deleteTitle }) {
  const actions = document.createElement('div');
  actions.className = 'item-actions';
  actions.appendChild(createActionButton({
    className: 'icon-btn edit-item-btn',
    title: editTitle,
    ariaLabel: editTitle,
    iconClass: 'fa-solid fa-pen-to-square fa-xl',
    onClick: onEdit
  }));
  actions.appendChild(createActionButton({
    className: 'icon-btn del-item-btn',
    title: deleteTitle,
    ariaLabel: deleteTitle,
    style: 'color: var(--destructive);',
    iconClass: 'fa-regular fa-trash-can fa-xl',
    onClick: onDelete
  }));
  return actions;
}

// --- Helper: Create Save/Cancel Actions ---
function createSaveCancelActions({ onSave, onCancel, saveTitle, cancelTitle }) {
  const actions = document.createElement('div');
  actions.className = 'item-actions';
  actions.appendChild(createActionButton({
    className: 'icon-btn save-edit-item-btn',
    title: saveTitle,
    ariaLabel: saveTitle,
    style: 'color: var(--success);',
    iconClass: 'fa-solid fa-check fa-xl',
    onClick: onSave
  }));
  actions.appendChild(createActionButton({
    className: 'icon-btn cancel-edit-item-btn',
    title: cancelTitle,
    ariaLabel: cancelTitle,
    iconClass: 'fa-solid fa-xmark fa-xl',
    onClick: onCancel
  }));
  return actions;
}

// --- Helper: Create Variant Actions ---
function createVariantActions({ onDelete, deleteTitle }) {
  const actions = document.createElement('div');
  actions.className = 'item-actions';
  actions.appendChild(createActionButton({
    className: 'icon-btn del-variant-btn',
    title: deleteTitle,
    ariaLabel: deleteTitle,
    style: 'color: var(--destructive);',
    iconClass: 'fa-regular fa-trash-can fa-xl',
    onClick: onDelete
  }));
  return actions;
}

// --- Refactor renderItemCard ---
function renderItemCard(item) {
  const isItemEditing = editingItemId === item.id;
  const card = document.createElement("div");
  card.className = "card";
  const header = document.createElement("div");
  header.className = "item-header";
  if (isItemEditing) {
    header.innerHTML = `<input id="edit-item-input" type="text" value="${item.name}">`;
    const input = header.querySelector("#edit-item-input");
    const save = () => {
      const newName = input.value.trim();
      if (!newName) return showToast("Item name cannot be empty.");
      item.name = newName;
      editingItemId = null;
      saveData();
      render();
      showToast("Item updated!", "success");
    };
    const cancel = () => {
      editingItemId = null;
      render();
    };
    header.appendChild(createSaveCancelActions({
      onSave: save,
      onCancel: cancel,
      saveTitle: 'Save item',
      cancelTitle: 'Cancel edit'
    }));
    input.focus();
    setCursorToEnd(input);
    input.onkeydown = (e) => {
      if (e.key === "Enter") save();
      if (e.key === "Escape") cancel();
    };
  } else {
    header.innerHTML = `<div class="item-name">${item.name}</div>`;
    header.appendChild(createItemActions({
      onEdit: () => startEditItem(item.id),
      onDelete: () => {
        showModal(
          "Delete Item",
          `This will permanently delete "${item.name}" and all its variants.`,
          () => {
            items = items.filter((i) => i.id !== item.id);
            saveData();
            render();
            showToast("Item deleted", "success");
          }
        );
      },
      editTitle: 'Edit item',
      deleteTitle: 'Delete item'
    }));
  }
  card.appendChild(header);
  // Variants table
  const tableContainer = document.createElement("div");
  tableContainer.className = "table-container";
  const table = document.createElement("div");
  table.className = "variant-table";
  table.innerHTML = `
    <table class="variant-table">
      <thead>
        <tr>
          <th>Color</th>
          <th>Price</th>
          <th>Qty</th>
          ${isItemEditing ? '<th class="actions-col">Actions</th>' : ''}
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;
  const tbody = table.querySelector("tbody");
  item.variants.forEach((variant) => {
    renderVariantRow(item, variant, tbody);
  });
  // Add variant button
  const tr = document.createElement("tr");
  if (isItemEditing) {
    tr.innerHTML = `
      <td colspan="4">
        <button class="btn add-variant-btn">
          <i class="fa-solid fa-circle-plus fa-xl" aria-hidden="true"></i> Add Variant
        </button>
      </td>`;
    tr.querySelector("button").onclick = () => startAddVariant(item.id);
  }
  tbody.appendChild(tr);
  tableContainer.appendChild(table);
  card.appendChild(tableContainer);
  mainContent.appendChild(card);
}

// --- Refactor renderVariantRow ---
function renderVariantRow(item, variant, tbody) {
  const tr = document.createElement("tr");
  const isItemEditing = editingItemId === item.id;
  if (isItemEditing) {
    tr.innerHTML = `
      <td><input id="edit-variant-color-${variant.id}" type="text" value="${variant.color}" class="variant-input" /></td>
      <td><input id="edit-variant-price-${variant.id}" type="number" min="0" value="${variant.price}" class="variant-input" /></td>
      <td><input id="edit-variant-qty-${variant.id}" type="number" min="0" value="${variant.qty}" class="variant-input" /></td>
      <td class="actions-col">
        <div class="item-actions"></div>
      </td>
    `;
    const colorInput = tr.querySelector(`#edit-variant-color-${variant.id}`);
    const priceInput = tr.querySelector(`#edit-variant-price-${variant.id}`);
    const qtyInput = tr.querySelector(`#edit-variant-qty-${variant.id}`);
    const actionsTd = tr.querySelector('td:last-child > div.item-actions');
    // Remove any nested .item-actions if present (defensive)
    while (actionsTd.firstElementChild && actionsTd.firstElementChild.classList.contains('item-actions')) {
      actionsTd.replaceWith(actionsTd.firstElementChild);
    }
    actionsTd.appendChild(createVariantActions({
      onDelete: () => {
        showModal(
          "Delete Variant",
          `This will permanently delete the variant (Color: ${variant.color}).`,
          () => {
            item.variants = item.variants.filter((v) => v.id !== variant.id);
            saveData();
            render();
            showToast("Variant deleted", "success");
          }
        );
      },
      deleteTitle: 'Delete variant'
    }));
    // Auto-save on input change with debouncing
    const autoSave = () => {
      const color = colorInput.value.trim();
      const price = priceInput.value.trim();
      const qty = qtyInput.value.trim();
      if (color && price && qty) {
        variant.color = color;
        variant.price = price;
        variant.qty = qty;
        debouncedSave();
      }
    };
    colorInput.oninput = autoSave;
    priceInput.oninput = autoSave;
    qtyInput.oninput = autoSave;
    // Keyboard shortcuts
    const handleKeydown = (e) => {
      if (e.key === "Escape") {
        editingItemId = null;
        render();
      }
    };
    colorInput.onkeydown = handleKeydown;
    priceInput.onkeydown = handleKeydown;
    qtyInput.onkeydown = handleKeydown;
  } else {
    tr.innerHTML = `
      <td>${variant.color}</td>
      <td>${formatPrice(variant.price)}</td>
      <td>${variant.qty}</td>
    `;
  }
  tbody.appendChild(tr);
}

// --- Add Variant Inline ---
function startAddVariant(itemId) {
  render();
  const item = items.find((i) => i.id === itemId);
  if (!item) return;
  const cards = mainContent.querySelectorAll(".card");
  let targetCard = null;
  for (let card of cards) {
    const itemName = card.querySelector(".item-name");
    const editInput = card.querySelector("#edit-item-input");
    if (itemName && itemName.textContent === item.name) {
      targetCard = card;
      break;
    } else if (editInput && editInput.value === item.name) {
      targetCard = card;
      break;
    }
  }
  if (!targetCard) return;
  const table = targetCard.querySelector("table");
  const tbody = table.querySelector("tbody");
  const addVariantRow = tbody.querySelector("tr:last-child");
  if (addVariantRow) {
    addVariantRow.innerHTML = `
      <td><input id="new-variant-color" type="text" placeholder="Color" class="variant-input" /></td>
      <td><input id="new-variant-price" type="number" min="0" placeholder="Price" class="variant-input" /></td>
      <td><input id="new-variant-qty" type="number" min="0" placeholder="Qty" class="variant-input" /></td>
      <td class="actions-col">
        <div class="item-actions">
          <button class="icon-btn save-variant-btn" title="Add variant" aria-label="Add variant" style="color: var(--success);"><i class="fa-solid fa-check fa-xl"></i></button>
          <button class="icon-btn cancel-variant-btn" title="Cancel" aria-label="Cancel"><i class="fa-solid fa-xmark fa-xl"></i></button>
        </div>
      </td>
    `;
  }
  const colorInput = addVariantRow.querySelector("#new-variant-color");
  const priceInput = addVariantRow.querySelector("#new-variant-price");
  const qtyInput = addVariantRow.querySelector("#new-variant-qty");
  const saveBtn = addVariantRow.querySelector(".save-variant-btn");
  const cancelBtn = addVariantRow.querySelector(".cancel-variant-btn");
  colorInput.focus();
  setCursorToEnd(colorInput);
  saveBtn.onclick = () => {
    const color = colorInput.value.trim();
    const price = priceInput.value.trim();
    const qty = qtyInput.value.trim();
    if (!color || !price || !qty) {
      return showToast("All variant fields are required.");
    }
    item.variants.push({ id: Date.now(), color, price, qty });
    saveData();
    render();
    showToast("Variant added!", "success");
  };
  cancelBtn.onclick = () => {
    render();
  };
  colorInput.onkeydown =
    priceInput.onkeydown =
    qtyInput.onkeydown =
      (e) => {
        if (e.key === "Enter") saveBtn.onclick();
        if (e.key === "Escape") cancelBtn.onclick();
      };
}

// --- Utility: Format Price ---
function formatPrice(val) {
  const n = Number(val);
  return isNaN(n) ? "N/A" : Math.round(n);
}

// --- Helper: Set Cursor to End ---
function setCursorToEnd(input) {
  if (
    input &&
    typeof input.value === 'string' &&
    input.setSelectionRange &&
    input.type &&
    (
      input.type.toLowerCase() === 'text' ||
      input.type.toLowerCase() === 'search' ||
      input.type.toLowerCase() === 'password' ||
      input.type.toLowerCase() === 'email' ||
      input.type.toLowerCase() === 'tel' ||
      input.type.toLowerCase() === 'url' ||
      input.tagName === 'TEXTAREA'
    )
  ) {
    const len = input.value.length;
    input.setSelectionRange(len, len);
  }
}

// --- Ensure cursor is at end on input for all inputs/textareas ---
document.addEventListener('input', function(event) {
  const el = event.target;
  if (
    (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') &&
    typeof el.value === 'string' &&
    el.type &&
    (
      el.type.toLowerCase() === 'text' ||
      el.type.toLowerCase() === 'search' ||
      el.type.toLowerCase() === 'password' ||
      el.type.toLowerCase() === 'email' ||
      el.type.toLowerCase() === 'tel' ||
      el.type.toLowerCase() === 'url' ||
      el.tagName === 'TEXTAREA'
    )
  ) {
    if (el.selectionStart !== el.value.length || el.selectionEnd !== el.value.length) {
      setCursorToEnd(el);
    }
  }
});

// --- Initialize ---
loadData();
render();
