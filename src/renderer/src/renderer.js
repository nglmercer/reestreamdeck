import SliderCreator from "./components/slider";
import socketManager from "./utils/socket";
import keyboardMap  from '../json/keyboard.json';
const sliderCreator = new SliderCreator('sliders-container');

socketManager.onMessage("audioData", (data) => {
  // console.log("Received message from server:", data);
  sliderCreator.createOrUpdateSlider({
    id: "masterVolume",
    text: "Master Volume",
    value: Number((data.masterVolume * 100).toFixed(5)),
    min: 0,
    max: 100,
    step: 1,
    callback: (value) => {
      socketManager.emitMessage("setMasterVolume", value / 100);
    }
  });
  data.sessions.forEach(element => {
    setupSliders(element);
  });
});
function setupSliders(element) {
  const roundedValue = Number((element.volume * 100).toFixed(5));

  sliderCreator.createOrUpdateSlider({
    id: element.pid,
    text: element.name + " - " + element.pid,
    value: roundedValue,
    min: 0,
    max: 100,
    step: 1,
    callback: (value) => {
      socketManager.emitMessage("setVolume", { pid: element.pid, volume: value / 100 });
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  let isPressed = {}; // Objeto para rastrear el estado de cada tecla por su etiqueta
  let pressTimers = {}; // Objeto para rastrear los temporizadores de presionar para cada tecla

  function createVirtualKeyboard() {
    const keyboardContainer = document.getElementById('keyboard-container');
    Object.entries(keyboardMap).forEach(([key, label]) => {
      initializebuttons(label, keyboardContainer);
    });
  }

  function initializebuttons(label, keyboardContainer) {
    const keyElement = document.createElement('button');
    keyElement.classList.add('key');
    keyElement.textContent = label;
    keyElement.addEventListener('mouseenter', () => handleMouseEnter(label));
    keyElement.addEventListener('mouseleave', () => handleMouseLeave(label));
    keyElement.addEventListener('click', () => presskey(label));
    keyboardContainer.appendChild(keyElement);

    isPressed[label] = false; // Inicializar el estado de cada tecla como no presionada
    pressTimers[label] = null; // Inicializar el temporizador como null
  }

  function handleMouseEnter(label) {
    if (!isPressed[label]) {
      // Iniciar un temporizador de 500ms para determinar si la tecla debe presionarse
      pressTimers[label] = setTimeout(() => {
        isPressed[label] = true;
        socketManager.emitMessage("pressKey2", label);
        console.log('Mouse enter and key pressed:', label);
      }, 100); // Tiempo mínimo encima del botón: 500ms
    }
  }

  function handleMouseLeave(label) {
    if (pressTimers[label]) {
      // Si el mouse sale antes de que el temporizador termine, cancelar la acción
      clearTimeout(pressTimers[label]);
      pressTimers[label] = null;
      console.log('Mouse left before 500ms:', label);
    } else if (isPressed[label]) {
      // Si el mouse sale después de que la tecla ya está presionada, liberarla
      isPressed[label] = false;
      socketManager.emitMessage("releaseKey", label);
      console.log('Mouse leave and key released:', label);
    }
  }

  function presskey(label) {
    socketManager.emitMessage("pressKey", label);

    if (isPressed[label]) {
      // Si la tecla está presionada, liberarla
      isPressed[label] = false;
      socketManager.emitMessage("releaseKey", label);
      console.log('Key released on click:', label);
    } else {
      // Si no está presionada, presionarla
      isPressed[label] = true;
      socketManager.emitMessage("pressKey", label);
    }
  }

  createVirtualKeyboard();
});

