import { createInputField, createSelectField, createMultiSelectField, createColorPickerField, getFormData } from '../formHelpers.js';

export default class FormModal {
  constructor(modalSelector, formSelector, multiSelectOptions) {
    this.modalElement = document.querySelector(modalSelector);
    this.formElement = document.querySelector(formSelector);
    this.modalInstance = M.Modal.getInstance(this.modalElement);
    this.multiSelectOptions = multiSelectOptions;
  }

  open(formConfig, callback, formData = {}, shouldClear = true) {
    if (shouldClear) {
      this.renderForm(formConfig);
    } else {
      this.renderForm(formConfig, formData);
    }

    this.modalInstance.open();

    document.querySelector('#submitFormBtn').onclick = () => {
      const data = getFormData(formConfig);
      callback(data);
      this.modalInstance.close();
    };

    // Manejo dinámico de la visibilidad de los campos
    const actionTypeElement = document.querySelector('[name="actionType"]');
    actionTypeElement.addEventListener('change', () => this.toggleFieldsVisibility(actionTypeElement.value));

    this.toggleFieldsVisibility(actionTypeElement.value); // Inicializa la visibilidad
  }

  renderForm(config, formData = {}) {
    this.formElement.innerHTML = '';

    config.forEach(field => {
      let formField;
      switch (field.type) {
        case 'input':
          formField = createInputField(field);
          break;
        case 'select':
          formField = createSelectField(field);
          break;
        case 'multiSelect':
          formField = createMultiSelectField(field);
          break;
        case 'colorPicker':
          formField = createColorPickerField(field);
          break;
        default:
          console.warn(`Unsupported field type: ${field.type}`);
      }

      if (formField) this.formElement.appendChild(formField);
    });

    M.FormSelect.init(document.querySelectorAll('select'));
    this.initializeFormData(config, formData); // Inicializa el formulario si hay datos
  }

  initializeFormData(config, data = {}) {
    config.forEach(field => {
      const element = document.querySelector(`[name="${field.name}"]`);
      if (element && data[field.name] !== undefined) {
        if (field.type === 'multiSelect') {
          const checkboxes = document.querySelectorAll(`[name="${field.name}"]`);
          const selectedValues = data[field.name];

          selectedValues.forEach(selectedValue => {
            checkboxes.forEach(checkbox => {
              if (checkbox.value.toLowerCase().includes(selectedValue.toLowerCase())) {
                checkbox.checked = true;
              }
            });
          });
        } else {
          element.value = Array.isArray(data[field.name]) ? data[field.name][0] : data[field.name];

          // Asegúrate de que el label se mueva si hay un valor
          const label = document.querySelector(`label[for="${field.name}"]`);
          if (label && element.value) {
            label.classList.add('active');
          }
        }
      }
    });
  }


  toggleFieldsVisibility(actionType) {
    const keyvalueField = document.querySelector('[name="keyvalue"]').closest('.input-field');
    const applicationField = document.querySelector('[name="application"]').closest('.input-field');

    if (actionType === 'keyPress') {
      keyvalueField.style.display = '';
      applicationField.style.display = 'none';
    } else if (actionType === 'openApp') {
      keyvalueField.style.display = 'none';
      applicationField.style.display = '';
    }
  }
}
