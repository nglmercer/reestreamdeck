export function createInputField(field) {
  const div = document.createElement('div');
  div.className = 'input-field';
  if (field.hidden) {
    div.style.display = 'none'; // Oculta el campo si `hidden` es true
  }

  const input = document.createElement('input');
  input.type = field.inputType || 'text';
  input.name = field.name;
  input.id = field.name;

  const label = document.createElement('label');
  label.htmlFor = field.name;
  label.innerText = field.label;

  div.appendChild(input);
  div.appendChild(label);
  return div;
}
export function createSelectField(field) {
  const div = document.createElement('div');
  div.className = 'input-field';
  if (field.hidden) {
    div.style.display = 'none';
  }

  const select = document.createElement('select');
  select.name = field.name;
  select.id = field.name;

  field.options.forEach(option => {
    const opt = document.createElement('option');
    opt.value = option.value;
    opt.innerText = option.label || option.value;
    select.appendChild(opt);
  });

  const label = document.createElement('label');
  label.htmlFor = field.name;
  label.innerText = field.label;

  div.appendChild(select);
  div.appendChild(label);
  return div;
}

export function createMultiSelectField(field) {
  const container = document.createElement('div');
  container.classList.add('input-field', 'col', 's12', 'gap-padding-margin-10');

  const label = document.createElement('label');
  label.textContent = field.label;

  // Campo de búsqueda
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Buscar...';
  searchInput.classList.add('search-input');
  searchInput.className = 'center-text';

  // Contenedor de las opciones
  const gridSelect = document.createElement('div');
  gridSelect.classList.add('grid-select');

  // Función para renderizar las opciones
  function renderOptions(options) {
    gridSelect.innerHTML = '';  // Limpiar las opciones actuales
    options.forEach(option => {
      const checkbox = document.createElement('label');
      checkbox.classList.add('grid-select__option');

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = field.name;
      input.value = option.value;
      input.dataset.id = option.id;
      input.classList.add('filled-in');

      const labelText = document.createElement('span');
      labelText.textContent = option.label;

      checkbox.appendChild(input);
      checkbox.appendChild(labelText);
      gridSelect.appendChild(checkbox);
    });
  }

  // Inicializar las opciones
  renderOptions(field.options);

  // Filtrar opciones en base al texto ingresado en el buscador
  searchInput.addEventListener('input', function () {
    const searchTerm = this.value.toLowerCase();
    const filteredOptions = field.options.filter(option =>
      option.label.toLowerCase().includes(searchTerm)
    );
    renderOptions(filteredOptions);  // Renderizar las opciones filtradas
  });

  container.appendChild(label);
  container.appendChild(searchInput);  // Agregar el campo de búsqueda
  container.appendChild(gridSelect);

  return container;
}
export function createColorPickerField(field) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('input-field', 'color-picker-field');

  // Crear un contenedor para el input y la vista previa del color
  const colorWrapper = document.createElement('div');
  colorWrapper.style.display = 'flex';
  colorWrapper.style.alignItems = 'center';

  // Input para seleccionar el color
  const input = document.createElement('input');
  input.type = 'color';
  input.name = field.name;
  input.id = field.name;
  input.classList.add('color-picker-input');
  input.style.width = '100%';
  input.style.height = '60px';
  input.style.border = 'none';
  input.style.padding = '0';
  input.style.margin = '0';

  // Añadir el input y la vista previa al contenedor
  colorWrapper.appendChild(input);

  // Etiqueta (label) para el campo de color
  const label = document.createElement('label');
  label.htmlFor = field.name;
  label.textContent = field.label;
  label.classList.add('active');  // Asegúrate de que el label esté activo (arriba)

  // Añadir la etiqueta y el contenedor de color al wrapper
  wrapper.appendChild(label);
  wrapper.appendChild(colorWrapper);

  return wrapper;
}



export function getFormData(config) {
  const formData = {};
  config.forEach(field => {
    let value;

    if (field.type === 'multiSelect') {
      const checkboxes = document.querySelectorAll(`[name="${field.name}"]:checked`);
      value = Array.from(checkboxes).map(checkbox => {
        const label = checkbox.nextElementSibling;  // Accede al texto asociado al checkbox
        return label ? label.textContent : checkbox.value;  // Si existe un label, devuelve su texto, de lo contrario el valor del checkbox
      });
    } else {
      const element = document.querySelector(`[name="${field.name}"]`);
      if (element) {
        value = element.value;
      }
    }

    switch (field.returnType) {
      case 'boolean':
        formData[field.name] = value === 'true';
        break;
      case 'number':
        formData[field.name] = parseFloat(value);
        break;
      case 'array':
        formData[field.name] = Array.isArray(value) ? value : [value];
        break;
      case 'object':
        formData[field.name] = { value };
        break;
      default:
        formData[field.name] = value;
    }
  });

  return formData;
}
